import test from 'node:test';
import assert from 'node:assert/strict';
import {createD1} from './helpers/d1.mjs';
import {storageEnv,initializeStore,listTrips,getTrip,saveTrip,deleteTrip,getRegistry} from '../trip-store.mjs';
import {addAccount,deleteAccount,authenticateTrip} from '../trip-auth.mjs';

function fixture(legacyValues={}){
 const sqlite=createD1();const legacy=new Map(Object.entries(legacyValues));const reads=new Map(),writes=[];
 const kv={get:async key=>{reads.set(key,(reads.get(key)||0)+1);return legacy.get(key)??null},put:async(key,value)=>{writes.push({key,value});legacy.set(key,value)},delete:async key=>legacy.delete(key)};
 const original={TRIP_DB:sqlite.db,TRIPS_KV:kv,TRIP_STORE_REQUIRED:'d1'};
 const env=storageEnv(original)||original;
 return {...sqlite,env,legacy,reads,writes};
}
const conflict=error=>error?.status===409;

// Real SQLite tests validate persisted SQL rows, ACLs and atomic CAS behavior.
// The only substitute is Cloudflare's transport-shaped D1 interface.
const legacyRows=[
 {id:'owned',city:'Honolulu',created_by:'Owner',shared_with:['Member'],shared_roles:{Member:'Editor'},items:{passport:{label:'Passport',qty:1,packed:1}},ui:{pages:[{id:'stay',title:'Stay',text:'Check-in 15:00'}],items:[{id:'shirt',name:'Shirt',qty:2,owner:'Owner',packed:{Owner:1,Member:0}}]},opaque:{future:'preserve'}},
 {id:'camel',city:'Lisbon',createdBy:'Other',sharedWith:['Member'],customLegacy:'keep'},
 {id:'private',city:'Tokyo',created_by:'Other',shared_with:[]},
];

test('KV migration preserves old trip data and builds owner/editor/viewer ACLs',async()=>{
 const f=fixture({all_trips:JSON.stringify(legacyRows)});try{
  await initializeStore(f.env);const records=await listTrips(f.env);assert.equal(records.length,3);
  const own=await getTrip(f.env,'owned');assert.equal(own.city,'Honolulu');assert.deepEqual(own.items,legacyRows[0].items);assert.deepEqual(own.ui,legacyRows[0].ui);assert.deepEqual(own.opaque,{future:'preserve'});assert.ok(Number.isInteger(own.revision));
  const member=await listTrips(f.env,'Member');assert.deepEqual(member.map(t=>t.id).sort(),['camel','owned']);
  const owner=await listTrips(f.env,'Owner');assert.deepEqual(owner.map(t=>t.id),['owned']);
  const acl=(await f.db.prepare('SELECT trip_id,user_id,role FROM trip_acl ORDER BY trip_id,user_id').all()).results;
  assert.ok(acl.some(row=>row.trip_id==='owned'&&row.user_id==='Owner'&&row.role==='Owner'));
  assert.ok(acl.some(row=>row.trip_id==='owned'&&row.user_id==='Member'&&row.role==='Editor'));
  assert.ok(acl.some(row=>row.trip_id==='camel'&&row.user_id==='Member'&&row.role==='Viewer'));
 }finally{f.close()}
});

test('after migration D1 is authoritative and later KV edits cannot overwrite or inject trips',async()=>{
 const f=fixture({all_trips:JSON.stringify(legacyRows)});try{
  await initializeStore(f.env);f.legacy.set('all_trips',JSON.stringify([{id:'injected',created_by:'Member',city:'Not migrated'},...legacyRows.map(t=>({...t,city:'Stale overwrite'}))]));
  await initializeStore(f.env);const records=await listTrips(f.env);assert.equal(records.length,3);assert.equal(records.some(t=>t.id==='injected'),false);assert.equal((await getTrip(f.env,'owned')).city,'Honolulu');assert.equal(f.writes.length,0);
 }finally{f.close()}
});

test('new D1 trip writes persist rows, numeric revision and ACL without touching KV',async()=>{
 const f=fixture();try{
  const created=await saveTrip(f.env,{id:'new',created_by:'Owner',city:'Paris',shared_with:['Member'],shared_roles:{Member:'Editor'},ui:{items:[],pages:[]}});
  assert.ok(Number.isInteger(created.revision));assert.equal((await getTrip(f.env,'new')).city,'Paris');assert.deepEqual((await listTrips(f.env,'Member')).map(t=>t.id),['new']);assert.equal((await listTrips(f.env,'Other')).length,0);assert.equal(f.writes.length,0);
  const row=await f.db.prepare('SELECT owner,revision,record_json FROM trips WHERE id=?').bind('new').first();assert.equal(row.owner,'Owner');assert.equal(row.revision,created.revision);assert.equal(JSON.parse(row.record_json).city,'Paris');
 }finally{f.close()}
});

test('D1 CAS updates reject stale revisions without losing the winning write',async()=>{
 const f=fixture();try{
  const created=await saveTrip(f.env,{id:'cas',created_by:'Owner',city:'Original'});
  const updated=await saveTrip(f.env,{...created,city:'Winner'},created.revision);assert.ok(updated.revision>created.revision);
  await assert.rejects(()=>saveTrip(f.env,{...created,city:'Stale overwrite'},created.revision),conflict);assert.equal((await getTrip(f.env,'cas')).city,'Winner');
  await assert.rejects(()=>saveTrip(f.env,{id:'cas',created_by:'Owner',city:'Create over existing'}),conflict);assert.equal((await getTrip(f.env,'cas')).city,'Winner');
 }finally{f.close()}
});

test('simultaneous saves from one revision permit one winner rather than last-writer data loss',async()=>{
 const f=fixture();try{
  const created=await saveTrip(f.env,{id:'race',created_by:'Owner',city:'Original'});
  const outcomes=await Promise.allSettled([saveTrip(f.env,{...created,city:'A'},created.revision),saveTrip(f.env,{...created,city:'B'},created.revision)]);
  assert.equal(outcomes.filter(r=>r.status==='fulfilled').length,1);assert.equal(outcomes.filter(r=>r.status==='rejected'&&r.reason.status===409).length,1);const winner=outcomes.find(r=>r.status==='fulfilled').value;assert.equal((await getTrip(f.env,'race')).city,winner.city);
 }finally{f.close()}
});

test('trip deletion uses CAS and removes ACLs atomically',async()=>{
 const f=fixture();try{
  const created=await saveTrip(f.env,{id:'remove',created_by:'Owner',city:'Rome',shared_with:['Member']});const updated=await saveTrip(f.env,{...created,city:'Updated'},created.revision);
  await assert.rejects(()=>deleteTrip(f.env,'remove',created.revision),conflict);assert.ok(await getTrip(f.env,'remove'));
  await deleteTrip(f.env,'remove',updated.revision);assert.equal(await getTrip(f.env,'remove'),null);assert.equal((await f.db.prepare('SELECT COUNT(*) AS n FROM trip_acl WHERE trip_id=?').bind('remove').first()).n,0);
 }finally{f.close()}
});

test('generic session and settings records migrate through D1 once, then ignore stale KV',async()=>{
 const sessionKey='tool-session:test-read-through',settingsKey='trip:integration-settings:v1';const session=JSON.stringify({user:'Owner',expires:Date.now()+3600000}),settings=JSON.stringify({groups:[{id:'test-group',name:'Family',providers:{}}]});
 const f=fixture({[sessionKey]:session,[settingsKey]:settings});try{
  await initializeStore(f.env);assert.equal(await f.env.TRIPS_KV.get(sessionKey),session);assert.equal(await f.env.TRIPS_KV.get(settingsKey),settings);
  f.legacy.set(sessionKey,'STALE_SESSION');f.legacy.set(settingsKey,'STALE_SETTINGS');assert.equal(await f.env.TRIPS_KV.get(sessionKey),session);assert.equal(await f.env.TRIPS_KV.get(settingsKey),settings);assert.equal(f.reads.get(sessionKey),1);assert.equal(f.reads.get(settingsKey),1);
  const changed=JSON.stringify({groups:[]});await f.env.TRIPS_KV.put(settingsKey,changed);assert.equal(await f.env.TRIPS_KV.get(settingsKey),changed);assert.equal(f.legacy.get(settingsKey),'STALE_SETTINGS');assert.equal(f.writes.length,0);
 }finally{f.close()}
});

test('logout tombstones prevent a stale legacy session from being resurrected',async()=>{
 const key='tool-session:test-logout',value=JSON.stringify({user:'Member',expires:Date.now()+3600000});const f=fixture({[key]:value});try{
  await initializeStore(f.env);assert.equal(await f.env.TRIPS_KV.get(key),value);await f.env.TRIPS_KV.delete(key);assert.equal(await f.env.TRIPS_KV.get(key),null);assert.equal(await f.env.TRIPS_KV.get(key),null);assert.equal(f.legacy.get(key),value);assert.equal(f.reads.get(key),1);
  const row=await f.db.prepare('SELECT tombstone FROM app_records WHERE key=?').bind(key).first();assert.equal(row.tombstone,1);
 }finally{f.close()}
});

test('a missing generic key is negatively cached rather than imported later from stale KV',async()=>{
 const f=fixture();try{await initializeStore(f.env);assert.equal(await f.env.TRIPS_KV.get('absent'),null);f.legacy.set('absent','LATE_STALE_VALUE');assert.equal(await f.env.TRIPS_KV.get('absent'),null);assert.equal(f.reads.get('absent'),1)}finally{f.close()}
});

test('D1 generic record expiration is enforced without resurrecting old KV data',async()=>{
 const key='tool-session:expired',f=fixture({[key]:'STALE'});try{await initializeStore(f.env);await f.env.TRIPS_KV.put(key,'NEW',{expirationTtl:60});assert.equal(await f.env.TRIPS_KV.get(key),'NEW');await f.db.prepare('UPDATE app_records SET expires_at=? WHERE key=?').bind(Date.now()-1000,key).run();assert.equal(await f.env.TRIPS_KV.get(key),null);assert.equal(await f.env.TRIPS_KV.get(key),null);assert.equal(f.reads.get(key)||0,0)}finally{f.close()}
});

test('D1 registry carries the seven-screen structure with secondary pages folded under Trip',async()=>{
 const f=fixture();try{
  const registry=await getRegistry(f.env);assert.equal(registry.version,1);assert.deepEqual(registry.pages.map(p=>p.id),['Trip','Search','Calendar','Social','You','Pack','Map','Weather','Notes','Travel']);assert.equal(registry.pages.length,10);
  for(const p of registry.pages){assert.equal(p.path,'/'+p.id.toLowerCase())}
  assert.equal(registry.pages.find(p=>p.id==='Notes').renderer,'whitepages');assert.equal(registry.pages.find(p=>p.id==='Pack').renderer,'packing');
  assert.equal(registry.pages.find(p=>p.id==='Map').bucket,'Trip');assert.equal(registry.pages.find(p=>p.id==='Pack').bucket,'Trip');assert.equal(registry.pages.find(p=>p.id==='Search').bucket,'Search');assert.equal(registry.pages.filter(p=>p.primaryNav).length,5);
  await initializeStore(f.env);assert.equal((await f.db.prepare('SELECT COUNT(*) AS n FROM page_registry').first()).n,10);
 }finally{f.close()}
});

test('required D1 binding cannot silently fall back to KV writes',async()=>{
 const legacyWrites=[];const original={TRIP_STORE_REQUIRED:'d1',TRIPS_KV:{get:async()=>JSON.stringify(legacyRows),put:async(...args)=>legacyWrites.push(args)}};
 assert.throws(()=>storageEnv(original),error=>error?.status===503);assert.deepEqual(legacyWrites,[]);
});

test('legacy all_trips generic writes are rejected to preserve CAS and ACL guarantees',async()=>{
 const f=fixture();try{await initializeStore(f.env);await assert.rejects(()=>f.env.TRIPS_KV.put('all_trips','[]'));assert.equal((await listTrips(f.env)).length,0);assert.equal(f.writes.length,0)}finally{f.close()}
});

import {handleTripApp} from '../trip-app.mjs';
import {issueSession,toolSession} from '../trip-tools.mjs';
async function appRequest(f,user,path,body,fetcher=async()=>{throw Error('Unexpected provider request')}){
 f.env.TRIP_AUTH_USERS=JSON.stringify({Owner:'test-owner',Member:'test-member',Other:'test-other',Viewer:'test-viewer'});f.env.TRIP_ADMIN_USERS='Owner';
 const token=user?await issueSession(f.env,user):null;
 const response=await handleTripApp(new Request('https://trip.example/api/app/'+path,{method:body===undefined?'GET':'POST',headers:{...(token?{Authorization:'Bearer '+token}:{}),'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})}),f.env,fetcher);
 return {status:response.status,body:await response.json()};
}

test('authenticated D1 registry endpoint serves the canonical product pages',async()=>{
 const f=fixture();try{assert.equal((await appRequest(f,null,'registry')).status,401);const r=await appRequest(f,'Owner','registry');assert.equal(r.status,200);assert.equal(r.body.storage,'d1');assert.deepEqual(r.body.pages.map(p=>p.id),['Trip','Search','Calendar','Social','You','Pack','Map','Weather','Notes','Travel'])}finally{f.close()}
});

test('trip API uses D1 revisions for end-to-end conflict protection',async()=>{
 const f=fixture();try{
  const created=await appRequest(f,'Owner','trips',{trip:{id:'api-cas',created_by:'Other',city:'Honolulu',depart:'2026-10-24'}});assert.equal(created.status,200);assert.equal(created.body.trip.created_by,'Owner');assert.ok(Number.isInteger(created.body.trip.revision));
  const current=created.body.trip;const first=await appRequest(f,'Owner','trips',{trip:{...current,city:'Winner'}});assert.equal(first.status,200);
  const stale=await appRequest(f,'Owner','trips',{trip:{...current,city:'Stale overwrite'}});assert.equal(stale.status,409);assert.equal((await getTrip(f.env,'api-cas')).city,'Winner');assert.equal(f.writes.length,0);
 }finally{f.close()}
});

test('D1 map endpoint returns only accessible selected-day stops and destination coordinates',async()=>{
 const f=fixture();try{
  await saveTrip(f.env,{id:'map',created_by:'Owner',city:'Honolulu',depart:'2026-10-24',lat:21.3,lon:-157.8,shared_with:['Member'],ui:{stops:[{id:'today',title:'Museum',place:'Downtown',date:'2026-10-24',time:'10:00',lat:21.306,lon:-157.86},{id:'tomorrow',title:'Beach',place:'Waikiki',date:'2026-10-25',time:'12:00'},{id:'legacy-day',title:'Lunch',place:'Cafe',day:24,time:'13:00'}]}});
  assert.equal((await appRequest(f,'Other','map?tripId=map')).status,404);
  const r=await appRequest(f,'Member','map?tripId=map&date=2026-10-24');assert.equal(r.status,200);assert.deepEqual(r.body.destination,{lat:21.3,lon:-157.8,label:'Honolulu'});assert.deepEqual(r.body.places.map(p=>p.id),['today','legacy-day']);assert.equal(r.body.places[0].lat,21.306);
 }finally{f.close()}
});

test('D1 event import returns a reviewed draft without changing persisted itinerary',async()=>{
 const f=fixture();try{
  await saveTrip(f.env,{id:'events',created_by:'Owner',city:'Honolulu',depart:'2026-10-24',ui:{stops:[],items:[],pages:[]}});const before=await getTrip(f.env,'events');f.env.FIRECRAWL_API_KEY='test-firecrawl';let calls=0;
  const r=await appRequest(f,'Owner','import',{tripId:'events',url:'https://events.example/show'},async(url,options)=>{calls++;assert.equal(url,'https://api.firecrawl.dev/v2/scrape');assert.equal(options.headers.Authorization,'Bearer test-firecrawl');assert.equal(JSON.parse(options.body).url,'https://events.example/show');return Response.json({success:true,data:{json:{title:'Gallery opening',place:'Arts district',date:'2026-10-24',time:'18:00'},metadata:{statusCode:200}}})});
  assert.equal(r.status,200);assert.equal(r.body.provider,'Firecrawl');assert.equal(r.body.draft.title,'Gallery opening');assert.equal(r.body.draft.sourceUrl,'https://events.example/show');assert.deepEqual(r.body.missing,[]);assert.equal(calls,1);assert.deepEqual(await getTrip(f.env,'events'),before);
 }finally{f.close()}
});

test('D1 viewer and outsider cannot import events using owner provider credits',async()=>{
 const f=fixture();try{
  await saveTrip(f.env,{id:'events',created_by:'Owner',city:'Honolulu',depart:'2026-10-24',shared_with:['Viewer'],shared_roles:{Viewer:'Viewer'}});f.env.FIRECRAWL_API_KEY='test-firecrawl';let calls=0;const fetcher=async()=>{calls++;throw Error('must not contact provider')};
  assert.equal((await appRequest(f,'Viewer','import',{tripId:'events',url:'https://events.example/show'},fetcher)).status,403);assert.equal((await appRequest(f,'Other','import',{tripId:'events',url:'https://events.example/show'},fetcher)).status,404);assert.equal(calls,0);
 }finally{f.close()}
});

test('tool session validation reads the authoritative D1 tombstone after logout',async()=>{
 const f=fixture();try{
  const token=await issueSession(f.env,'Owner');const request=new Request('https://trip.example/api/tools/status',{headers:{Authorization:'Bearer '+token}});assert.equal((await toolSession(request,f.env)).user,'Owner');await f.env.TRIPS_KV.delete('tool-session:'+token);assert.equal(await toolSession(request,f.env),null);assert.equal((await f.db.prepare('SELECT tombstone FROM app_records WHERE key=?').bind('tool-session:'+token).first()).tombstone,1);
 }finally{f.close()}
});

test('a failed stale CAS cannot modify the winning trip ACL',async()=>{
 const f=fixture();try{
  const first=await saveTrip(f.env,{id:'acl-cas',created_by:'Owner',city:'Original',shared_with:['Member'],shared_roles:{Member:'Editor'}});
  await saveTrip(f.env,{...first,city:'Winner'},first.revision);
  await assert.rejects(()=>saveTrip(f.env,{...first,city:'Stale',shared_with:['Other'],shared_roles:{Other:'Editor'}},first.revision),conflict);
  assert.equal((await listTrips(f.env,'Member')).length,1);assert.equal((await listTrips(f.env,'Other')).length,0);const acl=(await f.db.prepare('SELECT user_id,role FROM trip_acl WHERE trip_id=? ORDER BY user_id').bind('acl-cas').all()).results;assert.deepEqual(acl,[{user_id:'Member',role:'Editor'},{user_id:'Owner',role:'Owner'}]);
 }finally{f.close()}
});

test('KV migration never overwrites a preexisting D1 record or its ACL',async()=>{
 const f=fixture();try{
  const current=await saveTrip(f.env,{id:'same-id',created_by:'Other',city:'Authoritative',shared_with:['Viewer'],shared_roles:{Viewer:'Viewer'}});
  await f.db.prepare('DELETE FROM store_meta WHERE key=?').bind('legacy_all_trips_imported_v1').run();f.legacy.set('all_trips',JSON.stringify([{id:'same-id',created_by:'Owner',city:'Stale KV',shared_with:['Member'],shared_roles:{Member:'Editor'}},{id:'legacy-only',created_by:'Owner',city:'Import me'}]));
  const env2=storageEnv({TRIP_DB:{...f.db},TRIPS_KV:f.env.LEGACY_TRIPS_KV,TRIP_STORE_REQUIRED:'d1'});await initializeStore(env2);
  const saved=await getTrip(env2,'same-id');assert.equal(saved.city,'Authoritative');assert.equal(saved.created_by,'Other');assert.equal(saved.revision,current.revision);assert.equal((await listTrips(env2,'Member')).some(t=>t.id==='same-id'),false);assert.equal((await listTrips(env2,'Viewer')).some(t=>t.id==='same-id'),true);assert.equal((await getTrip(env2,'legacy-only')).city,'Import me');
 }finally{f.close()}
});

test('migration failure rolls back records, ACL and completion marker; retry imports everything',async()=>{
 const f=fixture();try{
  await initializeStore(f.env);await f.db.prepare('DELETE FROM store_meta WHERE key=?').bind('legacy_all_trips_imported_v1').run();
  await f.db.exec("CREATE TRIGGER test_migration_failure BEFORE INSERT ON trips WHEN NEW.id='blocked' BEGIN SELECT RAISE(ABORT, 'injected migration failure'); END");
  f.legacy.set('all_trips',JSON.stringify([{id:'first',created_by:'Owner',city:'First',shared_with:['Member']},{id:'blocked',created_by:'Other',city:'Second'}]));
  const env2=storageEnv({TRIP_DB:{...f.db},TRIPS_KV:f.env.LEGACY_TRIPS_KV,TRIP_STORE_REQUIRED:'d1'});await assert.rejects(()=>initializeStore(env2),error=>error.status===503);
  assert.equal((await f.db.prepare('SELECT COUNT(*) AS n FROM trips').first()).n,0);assert.equal((await f.db.prepare('SELECT COUNT(*) AS n FROM trip_acl').first()).n,0);assert.equal(await f.db.prepare('SELECT value FROM store_meta WHERE key=?').bind('legacy_all_trips_imported_v1').first(),null);
  await f.db.exec('DROP TRIGGER test_migration_failure');await initializeStore(env2);assert.equal((await listTrips(env2)).length,2);assert.ok(await f.db.prepare('SELECT value FROM store_meta WHERE key=?').bind('legacy_all_trips_imported_v1').first());assert.equal((await listTrips(env2,'Member')).length,1);
 }finally{f.close()}
});

test('a fresh D1-only environment initializes without a legacy KV namespace',async()=>{
 const sqlite=createD1();try{const env=storageEnv({TRIP_DB:sqlite.db,TRIP_STORE_REQUIRED:'d1'});await initializeStore(env);assert.deepEqual(await listTrips(env),[]);await env.TRIPS_KV.put('new-setting','saved');assert.equal(await env.TRIPS_KV.get('new-setting'),'saved');assert.equal(await env.TRIPS_KV.get('never-existed'),null)}finally{sqlite.close()}
});

function imageBucket(){const objects=new Map(),writes=[];return {objects,writes,binding:{head:async path=>objects.has(path)?{key:path}:null,put:async(path,value)=>{objects.set(path,value);writes.push(path)},get:async path=>objects.has(path)?{text:async()=>objects.get(path)}:null}}}

test('oversized trip photos are privately externalized, deduplicated, and hydrated from R2',async()=>{
 const f=fixture(),bucket=imageBucket();f.env.trip_agents=bucket.binding;const image='data:image/jpeg;base64,'+'A'.repeat(1000000);
 try{
  const created=await saveTrip(f.env,{id:'photo-trip',created_by:'Owner',city:'Honolulu',ui:{items:[],clothes:[{id:'coat',owner:'Owner',src:image}],bookings:[{id:'flight',image}]}});
  assert.equal(created.ui.clothes[0].src,image);assert.equal(created.ui.bookings[0].image,image);assert.equal(bucket.writes.length,1);assert.ok(bucket.writes[0].startsWith('trip-media/photo-trip/'));
  const row=await f.db.prepare('SELECT record_json FROM trips WHERE id=?').bind('photo-trip').first();assert.ok(row.record_json.length<10000);assert.equal(row.record_json.includes('data:image/jpeg'),false);assert.ok(row.record_json.includes('trip-r2:trip-media/photo-trip/'));
  const metadata=await getTrip(f.env,'photo-trip',{hydrateImages:false});assert.ok(metadata.ui.clothes[0].src.startsWith('trip-r2:'));assert.equal((await getTrip(f.env,'photo-trip')).ui.clothes[0].src,image);
 }finally{f.close()}
});

test('private R2 image references cannot be transplanted into another trip',async()=>{
 const f=fixture(),bucket=imageBucket();f.env.trip_agents=bucket.binding;
 try{
  await saveTrip(f.env,{id:'owner-trip',created_by:'Owner',city:'Paris',image:'data:image/png;base64,AAAA'});const metadata=await getTrip(f.env,'owner-trip',{hydrateImages:false});assert.ok(metadata.image.startsWith('trip-r2:'));
  await assert.rejects(()=>saveTrip(f.env,{id:'other-trip',created_by:'Other',city:'Rome',image:metadata.image}),/image reference is invalid/);assert.equal(await getTrip(f.env,'other-trip'),null);assert.equal((await getTrip(f.env,'owner-trip')).image,'data:image/png;base64,AAAA');
 }finally{f.close()}
});

test('oversized legacy photos without R2 fail migration without altering KV or completing the marker',async()=>{
 const original=JSON.stringify([{id:'oversized',created_by:'Owner',city:'Honolulu',ui:{clothes:[{id:'large',owner:'Owner',src:'data:image/jpeg;base64,'+'A'.repeat(1000000)}]}}]);const f=fixture({all_trips:original});
 try{await assert.rejects(()=>initializeStore(f.env),error=>error.status===503&&/image storage/i.test(error.message));assert.equal(f.legacy.get('all_trips'),original);assert.equal(f.writes.length,0);assert.equal((await f.db.prepare('SELECT COUNT(*) AS n FROM trips').first()).n,0);assert.equal(await f.db.prepare('SELECT value FROM store_meta WHERE key=?').bind('legacy_all_trips_imported_v1').first(),null)}finally{f.close()}
});

test('D1 retains discovery lifecycle and visited activities while rejecting stale overwrites',async()=>{
 const f=fixture();try{
  const discovery={id:'museum',title:'Museum',url:'https://museum.example',kind:'places',state:'recommended'};
  const created=await saveTrip(f.env,{id:'discovery',created_by:'Owner',city:'Honolulu',ui:{items:[],stops:[],discoveries:[discovery]}});
  const hidden=await saveTrip(f.env,{...created,ui:{...created.ui,discoveries:[{...discovery,state:'dismissed'}]}},created.revision);
  assert.equal((await getTrip(f.env,'discovery')).ui.discoveries[0].state,'dismissed');
  const visited=await saveTrip(f.env,{...hidden,ui:{...hidden.ui,discoveries:[{...discovery,state:'visited',visitedOn:'2026-10-24'}],stops:[{id:'visit',title:'Museum',discoveryId:'museum',visitedOn:'2026-10-24'}]}},hidden.revision);
  await assert.rejects(saveTrip(f.env,{...hidden,ui:{items:[],stops:[],discoveries:[discovery]}},hidden.revision),conflict);
  assert.deepEqual((await getTrip(f.env,'discovery')).ui,visited.ui);assert.equal(f.writes.length,0);
 }finally{f.close()}
});

test('owner-created accounts sign in with a hashed password and nothing else',async()=>{
 const f=fixture({});try{
  await initializeStore(f.env);
  const created=await addAccount(f.env,'vrinda','correct horse battery');
  assert.equal(created.user,'Vrinda','account ids are normalised');
  const row=(await f.db.prepare('SELECT salt, iterations, password_hash FROM accounts WHERE user_id=?').bind('Vrinda').first());
  assert.ok(row.salt&&row.password_hash&&row.password_hash.length===64);
  assert.equal(row.password_hash.includes('correct horse'),false,'the password is never stored in clear');
  assert.equal(await authenticateTrip(f.env,'Vrinda','correct horse battery'),true);
  assert.equal(await authenticateTrip(f.env,'Vrinda','wrong password'),false);
  assert.equal(await authenticateTrip(f.env,'Nobody','correct horse battery'),false);
  await addAccount(f.env,'Vrinda','a different password entirely');
  assert.equal(await authenticateTrip(f.env,'Vrinda','a different password entirely'),true,'re-adding rotates the password');
  assert.equal(await authenticateTrip(f.env,'Vrinda','correct horse battery'),false,'the old password stops working');
  await deleteAccount(f.env,'Vrinda');
  assert.equal(await authenticateTrip(f.env,'Vrinda','a different password entirely'),false);
 }finally{f.close()}
});

test('account passwords are rejected unless they meet the minimum length',async()=>{
 const f=fixture({});try{
  await initializeStore(f.env);
  await assert.rejects(()=>addAccount(f.env,'shorty','123'),/8-200 characters/);
  await assert.rejects(()=>addAccount(f.env,'bad name!','longenoughpassword'),/2-40/);
 }finally{f.close()}
});
