import test from 'node:test';
import assert from 'node:assert/strict';
import {issueSession} from '../trip-tools.mjs';
import {handleTripApp} from '../trip-app.mjs';

// API acceptance tests use the actual Worker handlers and isolated storage.
// Network providers are explicit test doubles; these tests never call paid APIs.
function fixture(rows=[]){
 const records=new Map([['all_trips',JSON.stringify(rows)]]);
 const env={TRIPS_KV:{get:async key=>records.get(key),put:async(key,value)=>records.set(key,value)},TRIP_AUTH_USERS:JSON.stringify({Owner:'test-owner',Member:'test-member',Other:'test-other',Viewer:'test-viewer'}),TRIP_ADMIN_USERS:'Owner'};
 const calls=[];
 const fetcher=async(url,options)=>{calls.push({url:String(url),options});return Response.json({current:{temperature_2m:25,weather_code:1},daily:{time:['2026-10-24'],temperature_2m_max:[28],temperature_2m_min:[23]}})};
 async function request(user,path,body,provider=fetcher){
  const token=user?await issueSession(env,user):null;
  const response=await handleTripApp(new Request('https://trip.example/api/app/'+path,{method:body===undefined?'GET':'POST',headers:{...(token?{Authorization:'Bearer '+token}:{}),'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})}),env,provider);
  assert.ok(response instanceof Response,'app endpoint must return an HTTP response');
  return {status:response.status,body:await response.json()};
 }
 return {records,env,calls,request,stored:()=>JSON.parse(records.get('all_trips'))};
}

test('trip endpoints require a valid session',async()=>{
 const f=fixture([{id:'private',city:'Private place',created_by:'Owner'}]);
 const r=await f.request(null,'trips');assert.equal(r.status,401);assert.equal(JSON.stringify(r.body).includes('Private place'),false);assert.equal(f.calls.length,0);
});

test('GET trips returns only records owned by or shared with authenticated account',async()=>{
 const f=fixture([{id:'own',city:'Mine',created_by:'Member'},{id:'shared',city:'Shared',created_by:'Owner',shared_with:['Member']},{id:'private',city:'Private',created_by:'Other'},{id:'unowned',city:'Unknown ownership'}]);
 const r=await f.request('Member','trips');assert.equal(r.status,200);assert.equal(r.body.user,'Member');assert.deepEqual(r.body.trips.map(t=>t.id).sort(),['own','shared']);
});

test('legacy camel-case ownership is honored without exposing other records',async()=>{
 const f=fixture([{id:'camel-owner',city:'Mine',createdBy:'Member'},{id:'camel-shared',city:'Shared',createdBy:'Owner',sharedWith:['Member']},{id:'camel-private',createdBy:'Other'}]);
 const r=await f.request('Member','trips');assert.equal(r.status,200);assert.deepEqual(r.body.trips.map(t=>t.id).sort(),['camel-owner','camel-shared']);
});

test('query-string user cannot impersonate another account',async()=>{
 const f=fixture([{id:'owned',created_by:'Owner'},{id:'member',created_by:'Member'}]);
 const r=await f.request('Member','trips?user=Owner');assert.equal(r.status,200);assert.deepEqual(r.body.trips.map(t=>t.id),['member']);
});

test('creating a trip assigns the authenticated creator regardless of submitted owner',async()=>{
 const f=fixture();const r=await f.request('Member','trips',{trip:{id:'new-trip',city:'Honolulu',depart:'2026-10-24',created_by:'Other',createdBy:'Owner'}});assert.equal(r.status,200);
 const saved=f.stored().find(t=>t.id==='new-trip');assert.equal(saved.created_by,'Member');assert.notEqual(saved.createdBy,'Owner');
});

test('an update cannot take ownership of another user’s private trip',async()=>{
 const old={id:'private',city:'Original',created_by:'Other',items:{legacy:{label:'Passport',qty:1,packed:0}},opaqueMetadata:{preserve:'yes'}};
 const f=fixture([old]);const r=await f.request('Member','trips',{trip:{id:'private',city:'Overwritten',created_by:'Member'}});assert.equal(r.status,403);assert.deepEqual(f.stored(),[old]);
});

test('saving one trip does not drop unrelated records or legacy metadata',async()=>{
 const unrelated={id:'other',created_by:'Other',city:'Keep',items:{id:{label:'Coat',qty:2}},custom:{futureSchema:[1,2,3]}};
 const mine={id:'own',created_by:'Member',city:'Old',customLegacy:'preserve me'};
 const f=fixture([unrelated,mine]);const r=await f.request('Member','trips',{trip:{id:'own',city:'Updated'}});assert.equal(r.status,200);assert.deepEqual(f.stored().find(t=>t.id==='other'),unrelated);assert.equal(f.stored().find(t=>t.id==='own').customLegacy,'preserve me');assert.equal(f.stored().find(t=>t.id==='own').created_by,'Member');
});

test('ordinary trip update cannot grant sharing access',async()=>{
 const f=fixture([{id:'own',created_by:'Owner',city:'Honolulu',shared_with:['Member']}]);
 const r=await f.request('Owner','trips',{trip:{id:'own',city:'Honolulu',shared_with:['Member','Other']}});assert.equal(r.status,200);assert.deepEqual(f.stored()[0].shared_with,['Member']);
});

test('sharing is owner-only and requires a known account',async()=>{
 const f=fixture([{id:'own',created_by:'Owner',city:'Honolulu',shared_with:['Member']}]);
 assert.equal((await f.request('Member','share',{tripId:'own',user:'Other',role:'editor'})).status,403);
 assert.equal((await f.request('Owner','share',{tripId:'own',user:'Unregistered',role:'viewer'})).status,400);
 assert.deepEqual(f.stored()[0].shared_with,['Member']);
});

test('weather denies inaccessible trip before contacting provider',async()=>{
 const f=fixture([{id:'private',created_by:'Owner',lat:21.3,lon:-157.8}]);const r=await f.request('Member','weather?tripId=private');assert.equal(r.status,404);assert.equal(f.calls.length,0);
});

test('map places stops that have no coordinates and draws a route, then serves the cache',async()=>{
 const f=fixture([{id:'map',created_by:'Member',city:'Honolulu',lat:21.3,lon:-157.8,ui:{stops:[
  {id:'a',title:'Hike',place:'Diamond Head',time:'09:15',date:'2026-10-24'},
  {id:'b',title:'Swim',place:'Hanauma Bay',time:'12:30',date:'2026-10-24'}]}}]);
 const provider=async url=>{
  if(String(url).includes('geocoding-api'))return Response.json({results:[{name:'Diamond Head',latitude:21.2627,longitude:-157.796}]});
  if(String(url).includes('router.project-osrm.org'))return Response.json({routes:[{geometry:{coordinates:[[-157.796,21.2627],[-157.691,21.272],[-157.8,21.28]]}}]});
  return Response.json({});
 };
 const first=await f.request('Member','map?tripId=map&date=2026-10-24',undefined,provider);
 assert.equal(first.status,200);
 assert.equal(first.body.places.filter(p=>typeof p.lat==='number').length,2,'every stop gets coordinates');
 assert.equal(first.body.approxCount,2,'name-placed pins are labelled approximate');
 assert.ok(Array.isArray(first.body.route)&&first.body.route.length>=2,'a driving line comes back');
 const calls=f.calls.length;
 const again=await f.request('Member','map?tripId=map&date=2026-10-24',undefined,provider);
 assert.equal(again.status,200);
 assert.equal(f.calls.length,calls,'second view is served from the KV cache');
});

test('weather provider failure is explicit rather than fabricated weather',async()=>{
 const f=fixture([{id:'own',created_by:'Member',lat:21.3,lon:-157.8}]);const r=await f.request('Member','weather?tripId=own',undefined,async()=>new Response('unavailable',{status:503}));assert.equal(r.status,502);assert.ok(r.body.error);assert.equal(r.body.temperature,undefined);
});

test('viewers cannot save trip content while explicitly approved editors can',async()=>{
 const original={id:'shared',created_by:'Owner',city:'Honolulu',shared_with:['Member','Viewer'],shared_roles:{Member:'Editor',Viewer:'Viewer'}};
 const f=fixture([original]);assert.equal((await f.request('Viewer','trips',{trip:{id:'shared',city:'Tampered'}})).status,403);assert.equal(f.stored()[0].city,'Honolulu');
 assert.equal((await f.request('Member','trips',{trip:{id:'shared',city:'Updated by editor',created_by:'Member',shared_roles:{Member:'Owner'}}})).status,200);const saved=f.stored()[0];assert.equal(saved.city,'Updated by editor');assert.equal(saved.created_by,'Owner');assert.equal(saved.shared_roles.Member,'Editor');
});

test('default shared role is Viewer until the owner explicitly grants Editor',async()=>{
 const f=fixture([{id:'shared',created_by:'Owner',city:'Honolulu',shared_with:['Member']}]);
 assert.equal((await f.request('Member','trips',{trip:{id:'shared',city:'Blocked'}})).status,403);
 assert.equal((await f.request('Owner','share',{tripId:'shared',user:'Member',role:'Editor'})).status,200);
 assert.equal((await f.request('Member','trips',{trip:{id:'shared',city:'Allowed'}})).status,200);
 assert.equal((await f.request('Owner','share',{tripId:'shared',user:'Member',role:null})).status,200);
 assert.equal((await f.request('Member','trips')).body.trips.length,0);assert.equal((await f.request('Member','trips',{trip:{id:'shared',city:'Revoked'}})).status,403);
});

function packingTrip(){return {id:'pack',created_by:'Owner',city:'Honolulu',shared_with:['Member'],shared_roles:{Member:'Editor'},items:{legacy:{label:'Legacy passport',qty:1,packed:1,other:'preserve'}},ui:{items:[{id:'owner-private',name:'Owner medicine',qty:3,owner:'Owner',packed:{Owner:2,Member:0}},{id:'member-private',name:'Member shirt',qty:2,owner:'Member',packed:{Owner:0,Member:1}},{id:'shared-sun',name:'Sunscreen',qty:1,owner:'Owner',shared:true,packed:{Owner:1,Member:0}}],clothes:[{id:'owner-photo',owner:'Owner',name:'Owner jacket',src:'data:image/jpeg;base64,OWNER'},{id:'member-photo',owner:'Member',name:'Member shirt',src:'data:image/jpeg;base64,MEMBER'}],pages:[{id:'notes',title:'Stay details',text:'Check-in 15:00'}]}}}

test('packing and clothes reads expose only own private items plus shared items',async()=>{
 const f=fixture([packingTrip()]);const member=(await f.request('Member','trips')).body.trips[0];assert.deepEqual(member.ui.items.map(i=>i.id).sort(),['member-private','shared-sun']);assert.equal(JSON.stringify(member).includes('Owner medicine'),false);assert.deepEqual(member.ui.items.find(i=>i.id==='shared-sun').packed,{Member:0});assert.deepEqual(member.ui.clothes.map(c=>c.id),['member-photo']);assert.equal(JSON.stringify(member).includes('base64,OWNER'),false);assert.deepEqual(member.items,{});
 const owned=(await f.request('Owner','trips')).body.trips[0];assert.deepEqual(owned.ui.items.map(i=>i.id).sort(),['owner-private','shared-sun']);assert.deepEqual(owned.ui.clothes.map(c=>c.id),['owner-photo']);
});

test('an editor’s packing save cannot alter another traveler’s progress or private items',async()=>{
 const original=packingTrip(),f=fixture([original]);const visible=(await f.request('Member','trips')).body.trips[0].ui;
 visible.items.find(i=>i.id==='member-private').packed={Member:2,Owner:999};visible.items.find(i=>i.id==='shared-sun').packed={Member:1,Owner:0};visible.clothes=[];
 const r=await f.request('Member','trips',{trip:{id:'pack',ui:visible}});assert.equal(r.status,200);const saved=f.stored()[0];
 assert.deepEqual(saved.ui.items.find(i=>i.id==='owner-private'),original.ui.items[0]);assert.equal(saved.ui.items.find(i=>i.id==='shared-sun').packed.Owner,1);assert.equal(saved.ui.items.find(i=>i.id==='shared-sun').packed.Member,1);assert.equal(saved.ui.items.find(i=>i.id==='member-private').packed.Owner,0);assert.equal(saved.ui.items.find(i=>i.id==='member-private').packed.Member,2);assert.deepEqual(saved.items,original.items);assert.deepEqual(saved.ui.clothes,[original.ui.clothes[0]]);
});

test('private packing IDs cannot be overwritten through a forged visible list',async()=>{
 const original=packingTrip(),f=fixture([original]);const r=await f.request('Member','trips',{trip:{id:'pack',ui:{items:[{id:'owner-private',name:'Forged private item',qty:1,packed:{Member:1}}],clothes:[]}}});assert.equal(r.status,400);assert.deepEqual(f.stored(),[original]);
});

test('new private items and clothes are assigned to the authenticated account',async()=>{
 const f=fixture([packingTrip()]);const visible=(await f.request('Member','trips')).body.trips[0].ui;visible.items.push({id:'new-item',name:'New shirt',qty:1,owner:'Owner',packed:{Owner:1,Member:1}});visible.clothes.push({id:'new-photo',name:'Shirt',src:'data:image/png;base64,TEST',owner:'Owner'});
 assert.equal((await f.request('Member','trips',{trip:{id:'pack',ui:visible}})).status,200);const saved=f.stored()[0];assert.equal(saved.ui.items.find(i=>i.id==='new-item').owner,'Member');assert.equal(saved.ui.items.find(i=>i.id==='new-item').packed.Owner,undefined);assert.equal(saved.ui.clothes.find(i=>i.id==='new-photo').owner,'Member');
});

test('a UI save cannot exceed the Whitepages limit',async()=>{
 const original=packingTrip(),f=fixture([original]);const visible=(await f.request('Member','trips')).body.trips[0].ui;visible.pages=Array.from({length:31},(_,i)=>({id:String(i),title:'Page',text:''}));assert.equal((await f.request('Member','trips',{trip:{id:'pack',ui:visible}})).status,400);assert.deepEqual(f.stored(),[original]);
});

test('integration admin status does not grant access to other users’ private trips',async()=>{
 const f=fixture([{id:'other-private',created_by:'Other',city:'Private'}]);const r=await f.request('Owner','trips');assert.equal(r.status,200);assert.deepEqual(r.body.trips,[]);
});

test('weather uses the fixed Open-Meteo host and returns provider provenance',async()=>{
 const f=fixture([{id:'mine',created_by:'Member',lat:21.3,lon:-157.8,city:'Honolulu'}]);const r=await f.request('Member','weather?tripId=mine');assert.equal(r.status,200);assert.equal(f.calls.length,1);assert.equal(new URL(f.calls[0].url).hostname,'api.open-meteo.com');assert.equal(r.body.provider,'Open-Meteo');assert.ok(Number.isFinite(Date.parse(r.body.retrievedAt)));assert.equal(r.body.current.temperature_2m,25);
});

test('cross-origin trip writes cannot change stored records',async()=>{
 const f=fixture([{id:'mine',created_by:'Member',city:'Old'}]),token=await issueSession(f.env,'Member');const r=await handleTripApp(new Request('https://trip.example/api/app/trips',{method:'POST',headers:{Authorization:'Bearer '+token,Origin:'https://evil.example','Content-Type':'application/json'},body:JSON.stringify({trip:{id:'mine',city:'Changed'}})}),f.env);assert.equal(r.status,403);assert.equal(f.stored()[0].city,'Old');
});

test('scanner rejects nonowners before contacting the vision provider',async()=>{
 const f=fixture([{id:'shared',created_by:'Owner',shared_with:['Member'],shared_roles:{Member:'Editor'}}]);f.env.CF_ACCOUNT_ID='test-account';f.env.DEEPSEEK_KEY='test-vision-key';assert.equal((await f.request('Member','scan',{tripId:'shared',image:'data:image/png;base64,TEST'})).status,403);assert.equal(f.calls.length,0);
});

test('scanner returns extracted fields for review without automatically saving a trip',async()=>{
 const original={id:'own',created_by:'Owner',city:'Honolulu'},f=fixture([original]);f.env.CF_ACCOUNT_ID='test-account';f.env.DEEPSEEK_KEY='test-vision-key';
 const r=await f.request('Owner','scan',{tripId:'own',image:'data:image/png;base64,TEST'},async(url,options)=>{assert.equal(new URL(url).hostname,'gateway.ai.cloudflare.com');assert.equal(options.headers.Authorization,'Bearer test-vision-key');return Response.json({choices:[{message:{content:JSON.stringify({airline:'Test Air',flightNumber:'TA 100',departureDate:'2026-10-24',unexpected:'discard'})}}]})});assert.equal(r.status,200);assert.equal(r.body.parsed.flightNumber,'TA 100');assert.equal(r.body.parsed.unexpected,undefined);assert.equal(r.body.parsed.bookingRef,null);assert.deepEqual(f.stored(),[original]);
});

test('shared trip readers never receive raw OCR through either legacy naming convention',async()=>{
 const f=fixture([{id:'shared',created_by:'Owner',shared_with:['Member'],raw_ocr:'PRIVATE_OCR_SNAKE',rawOcr:'PRIVATE_OCR_CAMEL',closet:[{src:'PRIVATE_CLOSET_PHOTO'}]}]);const r=await f.request('Member','trips');assert.equal(r.status,200);assert.equal(r.body.trips[0].raw_ocr,undefined);assert.equal(r.body.trips[0].rawOcr,undefined);assert.deepEqual(r.body.trips[0].closet,[]);assert.equal(JSON.stringify(r.body).includes('PRIVATE_OCR'),false);
});


test('owner can revoke a previously shared account after its login is removed',async()=>{
 const f=fixture([{id:'shared',created_by:'Owner',shared_with:['Member'],sharedWith:['Member'],shared_roles:{Member:'Editor'}}]);
 const token=await issueSession(f.env,'Member');
 f.env.TRIP_AUTH_USERS=JSON.stringify({Owner:'test-owner',Other:'test-other'});
 const revoked=await f.request('Owner','share',{tripId:'shared',user:'Member',role:null});assert.equal(revoked.status,200);assert.deepEqual(f.stored()[0].shared_with,[]);assert.deepEqual(f.stored()[0].sharedWith,[]);assert.equal(f.stored()[0].shared_roles.Member,undefined);
 const r=await handleTripApp(new Request('https://trip.example/api/app/trips',{headers:{Authorization:'Bearer '+token}}),f.env);assert.equal(r.status,200);assert.deepEqual((await r.json()).trips,[]);
 assert.equal((await f.request('Owner','share',{tripId:'shared',user:'Member',role:'Editor'})).status,400);
});

test('discovery recommendations dismissal and history persist with trip ACLs',async()=>{
 const f=fixture([{id:'shared',created_by:'Owner',city:'Honolulu',shared_with:['Member','Viewer'],shared_roles:{Member:'Editor'},ui:{items:[],stops:[]}}]);
 const discovery={id:'museum',title:'Museum',url:'https://museum.example/visit',kind:'places',state:'dismissed'};
 assert.equal((await f.request('Member','trips',{trip:{id:'shared',ui:{items:[],discoveries:[discovery]}}})).status,200);
 let read=await f.request('Member','trips');assert.deepEqual(read.body.trips[0].ui.discoveries,[discovery]);
 const visited={...discovery,state:'visited',visitedOn:'2026-10-24'};
 assert.equal((await f.request('Viewer','trips',{trip:{id:'shared',ui:{items:[],discoveries:[visited]}}})).status,403);
 assert.equal((await f.request('Member','trips',{trip:{id:'shared',ui:{items:[],discoveries:[visited]}}})).status,200);
 read=await f.request('Owner','trips');assert.deepEqual(read.body.trips[0].ui.discoveries,[visited]);assert.equal((await f.request('Other','trips')).body.trips.length,0);
});
test('discovery saves reject malformed state and unsafe source URLs',async()=>{
 const f=fixture([{id:'mine',created_by:'Owner',city:'Honolulu',ui:{items:[]}}]);
 for(const bad of [{kind:'invented'},{state:'gone'},{url:'javascript:alert(1)'},{url:'https://user:pass@museum.example'},{visitedOn:'not-a-date'}]){const d={id:'museum',title:'Museum',url:'https://museum.example',kind:'places',state:'recommended',...bad};assert.equal((await f.request('Owner','trips',{trip:{id:'mine',ui:{items:[],discoveries:[d]}}})).status,400)}
 assert.equal(f.stored()[0].ui.discoveries,undefined);
});

test('the 30-page limit names the Notes screen, not the retired Whitepages label',async()=>{
 const original=packingTrip(),f=fixture([original]);const visible=(await f.request('Member','trips')).body.trips[0].ui;
 visible.pages=Array.from({length:31},(_,i)=>({id:String(i),title:'Page',text:''}));
 const r=await f.request('Member','trips',{trip:{id:'pack',ui:visible}});
 assert.equal(r.status,400);assert.match(r.body.error,/^Notes is limited to 30 pages$/);
});
