// D1 is authoritative. Legacy KV is read-only migration input and never receives writes.
const fail=(message,status=503)=>Object.assign(new Error(message),{status});
const initByDatabase=new WeakMap();
const wrappedEnvs=new WeakMap();
const MAX_ROW_BYTES=900000;
const IMPORT_MARKER='legacy_all_trips_imported_v1';
const pages=[
 ['Travel','Travel','/travel','travel','Travel',1,0],
 ['Planner','Planner','/planner','planner','Planner',1,1],
 ['Packing','Packing','/packing','packing','Packing',1,2],
 ['Weather','Weather','/weather','weather','Weather',1,3],
 ['Whitepages','Whitepages','/whitepages','whitepages','Whitepages',1,4],
 ['Map','Map','/map','map','Travel',0,5],
 ['Events','Events','/events','events','Planner',0,6],
];
const schema=[
 `CREATE TABLE IF NOT EXISTS trips (id TEXT PRIMARY KEY,owner TEXT NOT NULL DEFAULT '',record_json TEXT NOT NULL,revision INTEGER NOT NULL CHECK(revision>=1),updated_at TEXT NOT NULL,write_token TEXT NOT NULL DEFAULT '')`,
 `CREATE INDEX IF NOT EXISTS trips_owner_updated_idx ON trips(owner,updated_at DESC)`,
 `CREATE TABLE IF NOT EXISTS trip_acl (trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,user_id TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('Owner','Editor','Viewer')),PRIMARY KEY(trip_id,user_id))`,
 `CREATE INDEX IF NOT EXISTS trip_acl_user_trip_idx ON trip_acl(user_id,trip_id)`,
 `CREATE TABLE IF NOT EXISTS app_records (key TEXT PRIMARY KEY,value TEXT,expires_at INTEGER,tombstone INTEGER NOT NULL DEFAULT 0 CHECK(tombstone IN (0,1)))`,
 `CREATE TABLE IF NOT EXISTS store_meta (key TEXT PRIMARY KEY,value TEXT NOT NULL)`,
 `CREATE TABLE IF NOT EXISTS page_registry (id TEXT PRIMARY KEY,name TEXT NOT NULL,path TEXT NOT NULL UNIQUE,renderer TEXT NOT NULL,bucket TEXT NOT NULL,primary_nav INTEGER NOT NULL CHECK(primary_nav IN (0,1)),sort_order INTEGER NOT NULL)`,
];
const ownerOf=r=>typeof r.created_by==='string'&&r.created_by?r.created_by:typeof r.createdBy==='string'?r.createdBy:'';
function aclFor(record){
 const members=new Map();const owner=ownerOf(record);if(owner)members.set(owner,'Owner');
 for(const name of [...(Array.isArray(record.shared_with)?record.shared_with:[]),...(Array.isArray(record.sharedWith)?record.sharedWith:[])])if(typeof name==='string'&&name&&name!==owner)members.set(name,record.shared_roles?.[name]==='Editor'?'Editor':'Viewer');
 return members;
}
function database(env){if(!env?.TRIP_DB)throw fail('Authoritative Trip database is not configured');return env.TRIP_DB}
function legacy(env){if(Object.hasOwn(env,'LEGACY_TRIPS_KV'))return env.LEGACY_TRIPS_KV;if(env.TRIPS_KV?.__d1Adapter)return env.TRIPS_KV.__legacyKV;return env.TRIPS_KV}
function checkedId(id){if(typeof id!=='string'||!id||new TextEncoder().encode(id).length>512)throw fail('A valid trip ID is required',400);return id}
const dataImage=value=>typeof value==='string'&&/^data:image\//i.test(value);
const mediaPrefix=id=>'trip-media/'+encodeURIComponent(id)+'/';
function mediaPath(value,id){
 if(!value.startsWith('trip-r2:'))return null;
 const path=value.slice(8),prefix=mediaPrefix(id);
 if(!path.startsWith(prefix)||!/^[a-f0-9]{64}$/.test(path.slice(prefix.length)))throw fail('Trip image reference is invalid');
 return path;
}
async function externalize(env,record){
 const id=checkedId(record.id),bucket=env.trip_agents,seen=new Map();let imageFound=false;
 async function walk(value){
  if(dataImage(value)){
   imageFound=true;if(!bucket)return value;
   if(seen.has(value))return seen.get(value);
   const bytes=new TextEncoder().encode(value);const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
   const path=mediaPrefix(id)+hash;
   try{const exists=bucket.head?await bucket.head(path):null;if(!exists)await bucket.put(path,value,{httpMetadata:{contentType:'text/plain; charset=utf-8'}})}catch{throw fail('Private trip image storage is unavailable')}
   const ref='trip-r2:'+path;seen.set(value,ref);return ref;
  }
  if(typeof value==='string'){if(value.startsWith('trip-r2:'))mediaPath(value,id);return value}
  if(Array.isArray(value))return Promise.all(value.map(walk));
  if(value&&typeof value==='object'){const pairs=[];for(const [key,item]of Object.entries(value))pairs.push([key,await walk(item)]);return Object.fromEntries(pairs)}
  return value;
 }
 const stored=await walk(record);delete stored.revision;
 const json=JSON.stringify(stored);
 if(new TextEncoder().encode(json).length>MAX_ROW_BYTES)throw fail(imageFound&&!bucket?'Configure private image storage before saving this large trip':'Trip details exceed the database row size limit',imageFound&&!bucket?503:413);
 return {stored,json};
}
async function hydrate(env,record){
 const seen=new Map(),id=checkedId(record.id);
 async function walk(value){
  if(typeof value==='string'&&value.startsWith('trip-r2:')){
   const path=mediaPath(value,id);if(seen.has(path))return seen.get(path);
   if(!env.trip_agents)throw fail('Private trip image storage is unavailable');
   let object;try{object=await env.trip_agents.get(path)}catch{throw fail('Private trip image storage is unavailable')}
   if(!object)throw fail('A saved trip image is unavailable');
   const image=await object.text();if(!dataImage(image))throw fail('Saved trip image data is invalid');seen.set(path,image);return image;
  }
  if(Array.isArray(value))return Promise.all(value.map(walk));
  if(value&&typeof value==='object'){const entries=[];for(const [k,v]of Object.entries(value))entries.push([k,await walk(v)]);return Object.fromEntries(entries)}return value;
 }
 return walk(record);
}
function decode(row){if(!row)return null;let record;try{record=JSON.parse(row.record_json)}catch{throw fail('Stored trip data is invalid')};return {...record,id:row.id,revision:Number(row.revision),updated_at:row.updated_at}}
function aclStatements(db,record,token){const id=record.id;return [...aclFor(record)].map(([user,role])=>db.prepare('INSERT OR REPLACE INTO trip_acl(trip_id,user_id,role) SELECT ?,?,? WHERE EXISTS(SELECT 1 FROM trips WHERE id=? AND write_token=?)').bind(id,user,role,id,token))}
export async function initializeStore(env){
 if(!env?.TRIP_DB){if(env?.TRIP_STORE_REQUIRED==='d1')throw fail('Authoritative Trip database is not configured');return}
 const db=database(env);let pending=initByDatabase.get(db);if(pending)return pending;
 pending=(async()=>{
  await db.batch(schema.map(sql=>db.prepare(sql)));
  await db.batch(pages.map(p=>db.prepare('INSERT OR IGNORE INTO page_registry(id,name,path,renderer,bucket,primary_nav,sort_order) VALUES(?,?,?,?,?,?,?)').bind(...p)));
  const imported=await db.prepare('SELECT value FROM store_meta WHERE key=?').bind(IMPORT_MARKER).first();if(imported)return;
  const source=legacy(env);let raw;try{raw=source?await source.get('all_trips'):null}catch{throw fail('Legacy trip backup is unavailable; migration has not completed')}
  let trips;try{trips=raw?JSON.parse(raw):[]}catch{throw fail('Legacy trip backup is invalid; migration has not completed')}
  if(!Array.isArray(trips))throw fail('Legacy trip backup is invalid; migration has not completed');
  const migrationToken=crypto.randomUUID(),statements=[],ids=new Set();
  for(const original of trips){if(!original||typeof original!=='object'||Array.isArray(original))throw fail('Legacy trip backup contains an invalid trip');checkedId(original.id);if(ids.has(original.id))continue;ids.add(original.id);
   const {stored,json}=await externalize(env,original);const date=typeof original.updated_at==='string'?original.updated_at:new Date().toISOString();
   statements.push(db.prepare('INSERT OR IGNORE INTO trips(id,owner,record_json,revision,updated_at,write_token) VALUES(?,?,?,?,?,?)').bind(stored.id,ownerOf(stored),json,1,date,migrationToken));
   statements.push(...aclStatements(db,stored,migrationToken));
  }
  statements.push(db.prepare('INSERT OR IGNORE INTO store_meta(key,value) VALUES(?,?)').bind(IMPORT_MARKER,new Date().toISOString()));
  await db.batch(statements);
 })();initByDatabase.set(db,pending);try{await pending}catch(error){initByDatabase.delete(db);if(error.status)throw error;throw fail('Trip database initialization failed')}
}
export async function listTrips(env,user){await initializeStore(env);const db=database(env);const result=user===undefined?await db.prepare('SELECT * FROM trips ORDER BY updated_at DESC,id').all():await db.prepare('SELECT t.* FROM trips t WHERE t.owner=? OR EXISTS(SELECT 1 FROM trip_acl a WHERE a.trip_id=t.id AND a.user_id=?) ORDER BY t.updated_at DESC,t.id').bind(user,user).all();return Promise.all((result.results||[]).map(row=>hydrate(env,decode(row))))}
export async function getTrip(env,id,{hydrateImages=true}={}){await initializeStore(env);const row=await database(env).prepare('SELECT * FROM trips WHERE id=?').bind(checkedId(id)).first();const record=decode(row);return record&&hydrateImages?hydrate(env,record):record}
export async function saveTrip(env,record,expectedRevision){
 await initializeStore(env);const db=database(env);if(!record||typeof record!=='object'||Array.isArray(record))throw fail('Invalid trip record',400);checkedId(record.id);
 if(expectedRevision!==undefined&&(!Number.isSafeInteger(expectedRevision)||expectedRevision<1))throw fail('A valid trip revision is required',400);
 const saved={...record,updated_at:new Date().toISOString()};const {stored,json}=await externalize(env,saved),token=crypto.randomUUID();let first;
 if(expectedRevision===undefined)first=db.prepare('INSERT INTO trips(id,owner,record_json,revision,updated_at,write_token) VALUES(?,?,?,?,?,?)').bind(stored.id,ownerOf(stored),json,1,stored.updated_at,token);
 else first=db.prepare('UPDATE trips SET owner=?,record_json=?,revision=revision+1,updated_at=?,write_token=? WHERE id=? AND revision=?').bind(ownerOf(stored),json,stored.updated_at,token,stored.id,expectedRevision);
 const statements=[first,db.prepare('DELETE FROM trip_acl WHERE trip_id=? AND EXISTS(SELECT 1 FROM trips WHERE id=? AND write_token=?)').bind(stored.id,stored.id,token),...aclStatements(db,stored,token)];let result;
 try{result=await db.batch(statements)}catch(error){if(/constraint|unique|primary key/i.test(error.message||''))throw fail('This trip already exists. Reload before saving.',409);throw fail('Trip could not be saved')}
 if(!result[0]?.meta?.changes)throw fail('This trip changed. Reload before saving.',409);
 return hydrate(env,{...stored,revision:expectedRevision===undefined?1:expectedRevision+1});
}
export async function deleteTrip(env,id,expectedRevision){
 await initializeStore(env);checkedId(id);if(!Number.isSafeInteger(expectedRevision)||expectedRevision<1)throw fail('A current trip revision is required',409);const db=database(env);
 const result=await db.batch([db.prepare('DELETE FROM trips WHERE id=? AND revision=?').bind(id,expectedRevision),db.prepare('DELETE FROM trip_acl WHERE trip_id=? AND NOT EXISTS(SELECT 1 FROM trips WHERE id=?)').bind(id,id)]);
 if(!result[0]?.meta?.changes)throw fail('This trip changed or was removed. Reload before deleting.',409);return {ok:true};
}
export async function getRegistry(env){await initializeStore(env);const rows=await database(env).prepare('SELECT id,name,path,renderer,bucket,primary_nav,sort_order FROM page_registry ORDER BY sort_order,id').all();return {version:1,pages:(rows.results||[]).map(p=>({id:p.id,name:p.name,label:p.name,path:p.path,renderer:p.renderer,bucket:p.bucket,nav:!!p.primary_nav,primaryNav:!!p.primary_nav,primary:!!p.primary_nav,sort:p.sort_order,order:p.sort_order}))}}
function checkedKey(key){if(typeof key!=='string'||!key||new TextEncoder().encode(key).length>512)throw fail('Invalid storage key',400);return key}
function adapter(env){
 const db=database(env),source=legacy(env);
 return {__legacyKV:source,async get(key,type){checkedKey(key);await initializeStore(env);if(key==='all_trips')return JSON.stringify(await listTrips(env));
  let row=await db.prepare('SELECT value,expires_at,tombstone FROM app_records WHERE key=?').bind(key).first();
  if(!row){let original;try{original=source?await source.get(key):null}catch{throw fail('Legacy account data is unavailable')}
   let expiry=null;if(key.startsWith('tool-session:')&&original){try{const session=JSON.parse(original);expiry=Number.isFinite(session.expires)?session.expires:0}catch{expiry=0}}
   await db.prepare('INSERT OR IGNORE INTO app_records(key,value,expires_at,tombstone) VALUES(?,?,?,?)').bind(key,original??null,expiry,original===null||original===undefined?1:0).run();
   row=await db.prepare('SELECT value,expires_at,tombstone FROM app_records WHERE key=?').bind(key).first();
  }
  if(!row||row.tombstone||row.expires_at!==null&&row.expires_at<=Date.now())return null;
  const kind=typeof type==='object'?type.type:type;if(kind==='json')return JSON.parse(row.value);if(kind==='arrayBuffer')return new TextEncoder().encode(row.value).buffer;if(kind==='stream')return new Response(row.value).body;return row.value;
 },async put(key,value,options={}){checkedKey(key);if(key==='all_trips')throw fail('Use the trip registry API to write trips',409);if(typeof value!=='string')throw fail('Stored values must be text',400);if(new TextEncoder().encode(value).length>MAX_ROW_BYTES)throw fail('Settings exceed the database row size limit',413);await initializeStore(env);let expiry=null;if(options.expiration!==undefined)expiry=Number(options.expiration)*1000;else if(options.expirationTtl!==undefined)expiry=Date.now()+Number(options.expirationTtl)*1000;if(expiry!==null&&!Number.isFinite(expiry))throw fail('Invalid expiration',400);await db.prepare('INSERT INTO app_records(key,value,expires_at,tombstone) VALUES(?,?,?,0) ON CONFLICT(key) DO UPDATE SET value=excluded.value,expires_at=excluded.expires_at,tombstone=0').bind(key,value,expiry).run();
 },async delete(key){checkedKey(key);if(key==='all_trips')throw fail('Use the trip registry API to delete trips',409);await initializeStore(env);await db.prepare('INSERT INTO app_records(key,value,expires_at,tombstone) VALUES(?,NULL,NULL,1) ON CONFLICT(key) DO UPDATE SET value=NULL,expires_at=NULL,tombstone=1').bind(key).run();}};
}
export function storageEnv(env){
 if(env?.TRIPS_KV?.__d1Adapter)return env;
 if(!env?.TRIP_DB){if(env?.TRIP_STORE_REQUIRED==='d1')throw fail('Authoritative Trip database is not configured');return env}
 if(wrappedEnvs.has(env))return wrappedEnvs.get(env);
 const next={...env,LEGACY_TRIPS_KV:env.LEGACY_TRIPS_KV||env.TRIPS_KV};const store=adapter(next);store.__d1Adapter=true;next.TRIPS_KV=store;wrappedEnvs.set(env,next);return next;
}
