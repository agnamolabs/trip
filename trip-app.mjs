import {toolSession} from './trip-tools.mjs';
import {isAdmin} from './trip-settings.mjs';
import {knownAccountNames} from './trip-auth.mjs';
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
 if((incoming.pages||[]).length>30)throw fail('Whitepages is limited to 30 pages');
 for(const key of ['stops','pages','bookings','clothes'])if(incoming[key]!==undefined&&!Array.isArray(incoming[key]))throw fail('Invalid '+key);
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
export async function handleTripApp(request,env,fetcher=fetch){
 const url=new URL(request.url),path=url.pathname;
 const legacy=['/api/trips','/api/trips/shared','/api/trips/share'].includes(path);
 if(!path.startsWith('/api/app/')&&!legacy)return null;
 try{
  if(request.headers.get('origin')&&request.headers.get('origin')!==url.origin)throw fail('Same-origin requests required',403);
  const session=await toolSession(request,env);if(!session)throw fail('Sign in to Trip',401);const user=session.user;
  if(!env.TRIPS_KV)throw fail('Trip storage unavailable',503);
  const raw=await env.TRIPS_KV.get('all_trips');const trips=raw?JSON.parse(raw):[];if(!Array.isArray(trips))throw fail('Trip data is unavailable',503);
  const list=['/api/app/trips','/api/trips','/api/trips/shared'].includes(path);
  if(list&&request.method==='GET'){const visible=trips.filter(t=>canRead(t,user)).map(t=>view(t,user));return json(legacy?visible:{user,trips:visible})}
  if(list&&request.method==='POST'){
   const payload=await readBody(request,12*1024*1024),incoming=legacy?payload:payload.trip;
   if(!incoming||typeof incoming!=='object'||typeof incoming.id!=='string'||incoming.id.length>100)throw fail('Trip ID is required');
   const index=trips.findIndex(t=>t.id===incoming.id),old=trips[index];
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
   await env.TRIPS_KV.put('all_trips',JSON.stringify(trips));return json(legacy?{ok:true}:{trip:view(record,user)});
  }
  if(list&&request.method==='DELETE'){
   const id=url.searchParams.get('id');const t=trips.find(t=>t.id===id);if(!t||owner(t)!==user)throw fail('Trip not found',404);
   await env.TRIPS_KV.put('all_trips',JSON.stringify(trips.filter(t=>t.id!==id)));return json({ok:true});
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
   await env.TRIPS_KV.put('all_trips',JSON.stringify(trips));return json({ok:true,trip:view(t,user)});
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
