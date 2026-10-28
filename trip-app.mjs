import {storageEnv,initializeStore,listTrips,getTrip,saveTrip,deleteTrip,getRegistry} from './trip-store.mjs';
import {discoverEvents,importEvent} from './trip-discovery.mjs';
import {toolSession} from './trip-tools.mjs';
import {isAdmin,settingsContext,defaultGroupId} from './trip-settings.mjs';
import {knownAccountNames,knownAccounts,addAccount,deleteAccount} from './trip-auth.mjs';
import {nearbyPlaces,nearbyPlacesGoogle,nearbyFromFirecrawl,CATEGORIES} from './trip-nearby.mjs';
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
const owner=t=>t.created_by||t.createdBy||'';
const shared=t=>[...new Set([...(Array.isArray(t.shared_with)?t.shared_with:[]),...(Array.isArray(t.sharedWith)?t.sharedWith:[])])];
const canRead=(t,u)=>owner(t)===u||shared(t).includes(u);
const canEdit=(t,u)=>owner(t)===u||(shared(t).includes(u)&&t.shared_roles?.[u]==='Editor');
function view(t,user){
 const r=structuredClone(t);r.permissions={canEdit:canEdit(t,user),canShare:owner(t)===user};
 r.members=[{name:owner(t),role:'Owner'},...shared(t).map(name=>({name,role:t.shared_roles?.[name]||'Viewer'}))];
 if(r.ui){r.ui.items=(r.ui.items||[]).filter(i=>i.shared||(i.owner||owner(t))===user).map(i=>({...i,owner:i.owner||owner(t),packed:{[user]:typeof i.packed?.[user]==='number'?i.packed[user]:0}}));r.ui.clothes=(r.ui.clothes||[]).filter(c=>(c.owner||owner(t))===user)}
 if(owner(t)!==user){r.items=Object.fromEntries(Object.entries(r.items||{}).filter(([,i])=>i?.shared));r.closet=[];delete r.raw_ocr;delete r.rawOcr}
 return r;
}
async function readBody(request,limit){const reader=request.body?.getReader();let size=0;const chunks=[];if(reader)while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();throw fail('Upload is too large',413)}chunks.push(value)}const bytes=new Uint8Array(size);let off=0;for(const c of chunks){bytes.set(c,off);off+=c.byteLength}try{return JSON.parse(new TextDecoder().decode(bytes))}catch{throw fail('Invalid JSON')}}
function mergeUI(previous,incoming,user,tripOwner){
 if(!incoming||typeof incoming!=='object'||Array.isArray(incoming))throw fail('Invalid trip content');
 if((incoming.pages||[]).length>30)throw fail('Notes is limited to 30 pages');
 for(const key of ['stops','pages','bookings','clothes','discoveries'])if(incoming[key]!==undefined&&!Array.isArray(incoming[key]))throw fail('Invalid '+key);
 if(incoming.discoveries){
  if(incoming.discoveries.length>500)throw fail('Keep up to 500 discoveries per trip');
  const urls=new Set();for(const d of incoming.discoveries){if(!d||typeof d.id!=='string'||typeof d.title!=='string'||!d.title.trim()||d.title.length>500||typeof d.url!=='string'||d.url.length>3000||!['places','trails','events'].includes(d.kind)||!['recommended','dismissed','visited'].includes(d.state))throw fail('Invalid discovery');let url;try{url=new URL(d.url)}catch{throw fail('Invalid discovery URL')}if(url.protocol!=='https:'||url.username||url.password)throw fail('Invalid discovery URL');if(urls.has(d.url))throw fail('Duplicate discovery');urls.add(d.url);if(d.visitedOn&&!/^\d{4}-\d{2}-\d{2}$/.test(d.visitedOn))throw fail('Invalid visited date');}
 }
 const prior=previous||{},next={...prior,...incoming};
 const oldItems=Array.isArray(prior.items)?prior.items:[];
 if(!Array.isArray(incoming.items))throw fail('Invalid packing list');
 const hidden=oldItems.filter(i=>!i.shared&&(i.owner||tripOwner)!==user);
 const ids=new Set();const updated=incoming.items.map(i=>{
  if(!i||typeof i.id!=='string'||typeof i.name!=='string'||!i.name.trim())throw fail('Invalid packing item');
  if(ids.has(i.id)||hidden.some(h=>h.id===i.id))throw fail('Invalid packing item ID');ids.add(i.id);
  const old=oldItems.find(x=>x.id===i.id);
  const qty=Math.max(1,Math.min(999,Math.floor(Number(i.qty)||1)));
  return {...i,name:i.name.trim().slice(0,160),qty,owner:old?.owner||(!old?user:tripOwner),packed:{...(old?.packed||{}),[user]:Math.max(0,Math.min(qty,Math.floor(Number(i.packed?.[user])||0)))}};
 });
 next.items=[...hidden,...updated];
 const oldClothes=Array.isArray(prior.clothes)?prior.clothes:[];
 next.clothes=[...oldClothes.filter(c=>(c.owner||tripOwner)!==user),...(incoming.clothes||[]).map(c=>({...c,owner:user}))];
 delete next.members;return next;
}
// Map helpers: geocode by place name and fetch a driving polyline, both cached in KV
// so a day view costs at most one lookup per new stop.
async function mapCache(env,key,value,ttl){
 try{
  if(!env.TRIPS_KV)return null;
  if(value===undefined){const raw=await env.TRIPS_KV.get(key);return raw?JSON.parse(raw):null}
  await env.TRIPS_KV.put(key,JSON.stringify(value),{expirationTtl:ttl});
  return value;
 }catch{return null}
}
async function geocodePlace(fetcher,env,query,city){
 const clean=String(query||'').trim().slice(0,120);if(!clean)return null;
 const key='geo5:'+String(city||'').toLowerCase()+':'+clean.toLowerCase();
 const hit=await mapCache(env,key);
 if(hit&&Number.isFinite(hit.lat))return hit;
 if(hit&&hit.miss)return null;
 // The geocoder matches a bare place name far better than "place, city".
 const words=clean.split(/\s+/).filter(Boolean);
 // Geocoders miss long phrases ("Waikiki Beach") but match the head noun ("Waikiki").
 const variants=[clean,city?clean+' '+city:null,words.length>2?words.slice(0,2).join(' '):null,words.length>1?words[0]:null]
  .filter(Boolean).filter((term,index,all)=>all.indexOf(term)===index).slice(0,4);
 for(const term of variants){
  try{
   const url='https://geocoding-api.open-meteo.com/v1/search?name='+encodeURIComponent(term)+'&count=1&language=en&format=json';
   const r=await fetcher(url,{signal:AbortSignal.timeout(7000)});
   if(!r.ok)continue;
   const geo=(await r.json()).results?.[0];
   if(!geo||!Number.isFinite(geo.latitude)||!Number.isFinite(geo.longitude))continue;
   const point={lat:geo.latitude,lon:geo.longitude,label:geo.name||clean};
   await mapCache(env,key,point,60*60*24*30);
   return point;
  }catch{/* try the next phrasing */}
 }
 await mapCache(env,key,{miss:true},60*60*24*7);
 return null;
}
async function routeBetween(fetcher,env,points){
 const usable=points.filter(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lon));
 if(usable.length<2||usable.length>12)return null;
 const key='route3:'+usable.map(p=>p.lat.toFixed(4)+','+p.lon.toFixed(4)).join(';');
 const hit=await mapCache(env,key);if(hit&&Array.isArray(hit.geometry))return hit.geometry;
 try{
  const url='https://router.project-osrm.org/route/v1/driving/'+usable.map(p=>p.lon.toFixed(5)+','+p.lat.toFixed(5)).join(';')+'?overview=simplified&geometries=geojson';
  const r=await fetcher(url,{signal:AbortSignal.timeout(9000),headers:{'User-Agent':'trip.agnamo.com map'}});
  if(!r.ok)return null;
  const body=await r.json();
  const coords=body?.routes?.[0]?.geometry?.coordinates;
  if(!Array.isArray(coords))return null;
  const geometry=coords.slice(0,1500).map(pair=>[Number(pair?.[1]),Number(pair?.[0])]).filter(pair=>Number.isFinite(pair[0])&&Number.isFinite(pair[1]));
  if(geometry.length<2)return null;
  await mapCache(env,key,{geometry},60*60*12);
  return geometry;
 }catch{return null}
}
export async function handleTripApp(request,env,fetcher=fetch){
 const url=new URL(request.url),path=url.pathname;
 const legacy=['/api/trips','/api/trips/shared','/api/trips/share'].includes(path);
 if(!path.startsWith('/api/app/')&&!legacy)return null;
 try{
  if(request.headers.get('origin')&&request.headers.get('origin')!==url.origin)throw fail('Same-origin requests required',403);
  env=storageEnv(env);await initializeStore(env);
  const session=await toolSession(request,env);if(!session)throw fail('Sign in to Trip',401);const user=session.user;
  if(path==='/api/app/registry'&&request.method==='GET')return json({...await getRegistry(env),storage:'d1'});
  if(!env.TRIPS_KV)throw fail('Trip storage unavailable',503);
  const d1=!!env.TRIP_DB;const raw=d1?null:await env.TRIPS_KV.get('all_trips');const trips=d1?await listTrips(env,user):raw?JSON.parse(raw):[];if(!Array.isArray(trips))throw fail('Trip data is unavailable',503);
  const list=['/api/app/trips','/api/trips','/api/trips/shared'].includes(path);
  if(list&&request.method==='GET'){const visible=trips.filter(t=>canRead(t,user)).map(t=>view(t,user));return json(legacy?visible:{user,trips:visible})}
  if(list&&request.method==='POST'){
   const payload=await readBody(request,12*1024*1024),incoming=legacy?payload:payload.trip;
   if(!incoming||typeof incoming!=='object'||typeof incoming.id!=='string'||incoming.id.length>100)throw fail('Trip ID is required');
   const index=trips.findIndex(t=>t.id===incoming.id),old=d1?await getTrip(env,incoming.id,{hydrateImages:false}):trips[index];
   if(old&&!canEdit(old,user))throw fail('This trip is read-only for your account',403);
   if(!old&&(!incoming.city||!incoming.depart))throw fail('Destination and departure date are required');
   const record={...(old||{}),...incoming,created_by:old?owner(old):user,shared_with:old?.shared_with||[],sharedWith:old?.sharedWith||[],shared_roles:old?.shared_roles||{}};
   record.createdBy=record.created_by;delete record.permissions;delete record.members;
   if(old){record.items=old.items;record.closet=old.closet}
   if(incoming.ui){
    const previousUi=old?.ui||{items:Object.entries(old?.items||{}).map(([id,item])=>({id,name:item.label||item.name||'Packing item',qty:Number(item.qty)||1,owner:item.owner||record.created_by,shared:item.shared===true,packed:typeof item.packed==='object'&&item.packed?item.packed:{[record.created_by]:Number(item.packed)||(item.checked?Number(item.qty)||1:0)}}))};
    record.ui=mergeUI(previousUi,incoming.ui,user,record.created_by);
   }
   record.updated_at=new Date().toISOString();if(index<0)trips.push(record);else trips[index]=record;
   const saved=d1?await saveTrip(env,record,old?incoming.revision:undefined):record;
   if(!d1)await env.TRIPS_KV.put('all_trips',JSON.stringify(trips));return json(legacy?{ok:true}:{trip:view(saved,user)});
  }
  if(list&&request.method==='DELETE'){
   const id=url.searchParams.get('id');const t=trips.find(t=>t.id===id);if(!t||owner(t)!==user)throw fail('Trip not found',404);
   if(d1)await deleteTrip(env,id,t.revision);else await env.TRIPS_KV.put('all_trips',JSON.stringify(trips.filter(t=>t.id!==id)));return json({ok:true});
  }
  if(['/api/app/share','/api/trips/share'].includes(path)&&request.method==='POST'){
   const body=await readBody(request,2000);const t=trips.find(t=>t.id===body.tripId);if(!t||owner(t)!==user)throw fail('Only the trip owner can change sharing',403);
   const name=body.user||body.username;
   if(typeof name!=='string'||!name.trim())throw fail('Choose a Trip account');
   const role=body.role===undefined?'Viewer':body.role;if(role!==null&&!['Viewer','Editor'].includes(role))throw fail('Invalid sharing role');
   // Revocation must still work after an account is removed from authentication.
   if(role!==null&&!knownAccountNames(env).includes(name))throw fail('Choose an existing Trip account');
   if(name===user)throw fail('The trip owner already has access');
   const members=shared(t).filter(n=>n!==name);if(role)members.push(name);t.shared_with=members;t.sharedWith=members;t.shared_roles={...(t.shared_roles||{})};if(role)t.shared_roles[name]=role;else delete t.shared_roles[name];
   const saved=d1?await saveTrip(env,t,t.revision):t;if(!d1)await env.TRIPS_KV.put('all_trips',JSON.stringify(trips));return json({ok:true,trip:view(saved,user)});
  }
  if(path==='/api/app/map'&&request.method==='GET'){
   const t=trips.find(t=>t.id===url.searchParams.get('tripId'));if(!t||!canRead(t,user))throw fail('Trip not found',404);
   let lat=Number(t.lat),lon=Number(t.lon);const valid=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a)<=90&&Math.abs(b)<=180;
   if(!valid(lat,lon)||(!lat&&!lon)){const r=await fetcher('https://geocoding-api.open-meteo.com/v1/search?name='+encodeURIComponent(t.city||'')+'&count=1&language=en&format=json',{signal:AbortSignal.timeout(10000)});if(!r.ok)throw fail('Destination lookup unavailable',502);const geo=(await r.json()).results?.[0];if(!geo||!valid(geo.latitude,geo.longitude))throw fail('No map coordinates found for this destination. Open directions instead.',404);lat=geo.latitude;lon=geo.longitude}
   const date=url.searchParams.get('date')||t.depart;const showAll=date==='all';
   const stops=(t.ui?.stops||[]).filter(s=>showAll||(s.date?s.date===date:s.day===Number(String(date).slice(-2))));
   // Stops saved without coordinates are looked up by name, then cached for a month.
   let lookups=0;
   const places=await Promise.all(stops.map(async s=>{
    let stopLat=Number(s.lat),stopLon=Number(s.lon);let approximate=false;
    const known=valid(stopLat,stopLon)&&!(stopLat===0&&stopLon===0);
    if(!known&&lookups<12&&(s.place||s.title)){
     lookups++;
     const found=await geocodePlace(fetcher,env,s.place||s.title,t.city||'');
     if(found){stopLat=found.lat;stopLon=found.lon;approximate=true}
    }
    return {id:s.id,title:s.title,place:s.place,time:s.time,day:s.date||null,
     ...(valid(stopLat,stopLon)&&!(stopLat===0&&stopLon===0)?{lat:stopLat,lon:stopLon}:{}),...(approximate?{approximate:true}:{})};
   }));
   const withCoords=places.filter(p=>valid(p.lat,p.lon));
   const route=await routeBetween(fetcher,env,[{lat,lon},...withCoords.map(p=>({lat:p.lat,lon:p.lon}))]);
   return json({destination:{lat,lon,label:t.city},places,route,provider:'OpenStreetMap / Open-Meteo / OSRM',
    ...(withCoords.some(p=>p.approximate)?{approxCount:withCoords.filter(p=>p.approximate).length}:{})});
  }
  if(path==='/api/app/nearby'&&request.method==='GET'){
   const t=trips.find(t=>t.id===url.searchParams.get('tripId'));if(!t||!canRead(t,user))throw fail('Trip not found',404);
   let lat=Number(t.lat),lon=Number(t.lon);
   if(!(Number.isFinite(lat)&&Number.isFinite(lon))||(!lat&&!lon)){
    const found=await geocodePlace(fetcher,env,t.city||'','');
    if(!found)throw fail('No coordinates found for this destination',404);
    lat=found.lat;lon=found.lon;
   }
   const radius=Math.min(20000,Math.max(500,Number(url.searchParams.get('radius'))||8000));
   // Google Places has ratings and a real open-now flag; OSM is the keyless fallback.
   let placesKey='';
   try{
    const ctx=await settingsContext(env,user,await defaultGroupId(env,user));
    placesKey=await ctx.key('google');
   }catch{placesKey=''}
   let firecrawlKey='';
   try{
    const ctx=await settingsContext(env,user,await defaultGroupId(env,user));
    firecrawlKey=await ctx.key('firecrawl');
   }catch{firecrawlKey=''}
   const sourceTag=placesKey?'g':firecrawlKey?'f':'o';
   const key='nearby3:'+sourceTag+':'+lat.toFixed(3)+','+lon.toFixed(3)+':'+radius;
   const cached=await mapCache(env,key);
   let items=cached?.items;
   let provider=placesKey?'Google Places':'OpenStreetMap';
   let listing=false;
   if(!Array.isArray(items)){
    // Places (ratings) → Overpass (hours, trails) → listing pages (never empty).
    if(placesKey){
     try{items=await nearbyPlacesGoogle(placesKey,lat,lon,radius,fetcher);provider='Google Places'}catch{items=null}
    }
    if(!Array.isArray(items)&&!(await mapCache(env,'osm:down'))){
     try{items=await nearbyPlaces(fetcher,lat,lon,radius);provider='OpenStreetMap'}catch{items=null;await mapCache(env,'osm:down',{at:Date.now()},60*30)}
    }
    if(!Array.isArray(items)&&firecrawlKey){
     try{items=await nearbyFromFirecrawl(firecrawlKey,t.city||'this destination',lat,lon,fetcher);provider='Firecrawl listings';listing=true}catch{items=null}
    }
    if(!Array.isArray(items))throw fail('Nearby lookup is unavailable right now. Try again in a minute.',503);
    await mapCache(env,key,{items,provider,listing},60*60*6);
   }else{
    provider=cached?.provider||provider;
    listing=!!cached?.listing;
   }
   return json({center:{lat,lon},radius,provider,listing,categories:CATEGORIES,items,retrievedAt:new Date().toISOString()});
  }
  if(path==='/api/app/accounts'){
   if(!isAdmin(env,user))throw fail('Only an owner can manage accounts',403);
   if(request.method==='GET'){
    const rows=env.TRIP_DB?await env.TRIP_DB.prepare('SELECT user_id, role, created_at FROM accounts ORDER BY user_id').all():{results:[]};
    const records=(rows.results||[]).map(row=>({user:row.user_id,role:row.role,createdAt:row.created_at}));
    const legacy=knownAccountNames(env).filter(name=>!records.some(r=>r.user===name)).map(name=>({user:name,role:'Legacy',createdAt:null}));
    return json({accounts:[...legacy,...records]});
   }
   if(request.method==='POST'){
    const body=await readBody(request,4000);
    try{
     if(body.remove){const gone=await deleteAccount(env,body.remove);return json({ok:true,...gone})}
     const created=await addAccount(env,body.user,body.password,body.role==='Owner'?'Owner':'Member');
     return json({ok:true,account:created});
    }catch(error){throw fail('Account not saved: '+(error?.message||'unknown error'),error?.status||502)}
   }
   throw fail('Method not allowed',405);
  }
  if(['/api/app/discover','/api/app/import'].includes(path)&&request.method==='POST'){
   const body=await readBody(request,6000);const t=trips.find(t=>t.id===body.tripId);if(!t||!canRead(t,user))throw fail('Trip not found',404);if(!canEdit(t,user))throw fail('Choose an editable trip first',403);
   return json(path.endsWith('/discover')?await discoverEvents(request,env,user,t,body,fetcher):await importEvent(request,env,user,t,body,fetcher));
  }
  if(path==='/api/app/weather'&&request.method==='GET'){
   const t=trips.find(t=>t.id===url.searchParams.get('tripId'));if(!t||!canRead(t,user))throw fail('Trip not found',404);
   let lat=Number(t.lat),lon=Number(t.lon);
   if(!Number.isFinite(lat)||!Number.isFinite(lon)||(!lat&&!lon)){
    const res=await fetcher('https://geocoding-api.open-meteo.com/v1/search?name='+encodeURIComponent(t.city||'')+'&count=1&language=en&format=json',{signal:AbortSignal.timeout(10000)});if(!res.ok)throw fail('Destination lookup unavailable',502);const result=await res.json();const geo=result.results?.[0];if(!geo)throw fail('No coordinates found for this destination',404);lat=geo.latitude;lon=geo.longitude;
   }
   const weatherUrl='https://api.open-meteo.com/v1/forecast?latitude='+lat+'&longitude='+lon+'&current=temperature_2m&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=16';
   const res=await fetcher(weatherUrl,{signal:AbortSignal.timeout(10000)});if(!res.ok)throw fail('Weather provider is unavailable',502);const data=await res.json();if(!data.daily?.time)throw fail('Weather provider returned no forecast',502);return json({...data,provider:'Open-Meteo',retrievedAt:new Date().toISOString()});
  }
  if(path==='/api/app/scan'&&request.method==='POST'){
   const body=await readBody(request,6*1024*1024);const t=trips.find(t=>t.id===body.tripId);if(!t||!canEdit(t,user))throw fail('Choose an editable trip first',403);
   if(!isAdmin(env,user))throw fail('The scanner uses the owner’s configured vision provider',403);
   if(typeof body.image!=='string'||!/^data:image\/(png|jpeg|webp);base64,/.test(body.image))throw fail('Choose a PNG, JPEG or WebP image');
   if(!env.CF_ACCOUNT_ID||!(env.DEEPSEEK_KEY||env.CF_AIG_TOKEN))throw fail('Image scanning is not configured on this server. You can enter booking details manually.',503);
   const endpoint='https://gateway.ai.cloudflare.com/v1/'+env.CF_ACCOUNT_ID+'/'+(env.CF_AIG_GATEWAY||'default')+'/deepseek/chat/completions';
   const headers={'Content-Type':'application/json'};if(env.DEEPSEEK_KEY)headers.Authorization='Bearer '+env.DEEPSEEK_KEY;if(env.CF_AIG_TOKEN)headers['cf-aig-authorization']='Bearer '+env.CF_AIG_TOKEN;
   const r=await fetcher(endpoint,{method:'POST',headers,signal:AbortSignal.timeout(35000),body:JSON.stringify({model:env.TRIP_VISION_MODEL||'deepseek-v4-pro',max_tokens:600,temperature:0,messages:[{role:'user',content:[{type:'text',text:'Extract booking fields from this image. Return ONLY JSON with airline, flightNumber, departureTime (HH:MM), departureDate (YYYY-MM-DD), returnDate, destinationCity, bookingRef. Use null for missing fields. Never invent details.'},{type:'image_url',image_url:{url:body.image}}]}]})});
   if(!r.ok)throw fail('Image provider returned HTTP '+r.status,502);const result=await r.json();const content=result.choices?.[0]?.message?.content;const match=typeof content==='string'&&content.match(/\{[\s\S]*\}/);if(!match)throw fail('No booking details could be extracted',502);let parsed;try{parsed=JSON.parse(match[0])}catch{throw fail('Image provider returned invalid booking details',502)}
   const keys=['airline','flightNumber','departureTime','departureDate','returnDate','destinationCity','bookingRef'];parsed=Object.fromEntries(keys.map(k=>[k,typeof parsed[k]==='string'?parsed[k].slice(0,200):null]));return json({parsed});
  }
  throw fail('Trip endpoint not found',404);
 }catch(error){return json({error:error.status?error.message:'Trip request failed'},error.status||500)}
}
