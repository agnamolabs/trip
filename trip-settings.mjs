import {knownAccountNames,knownAccounts} from './trip-auth.mjs';
const PROVIDERS=['sonar','firecrawl','apify','openrouter','google','nitemcp'];
const AGENTS=['Chat','Guide','Research','Planning'];
const KEY='trip:integration-settings:v1';
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
const admins=env=>String(env.TRIP_ADMIN_USERS===undefined?'Gabe,Lux':env.TRIP_ADMIN_USERS).split(',').map(s=>s.trim()).filter(Boolean);
export const isAdmin=(env,user)=>admins(env).includes(user);
const serverKey=(env,p)=>({sonar:env.PPLX_KEY||env.PERPLEXITY_API_KEY,firecrawl:env.FIRECRAWL_API_KEY,apify:env.APIFY_TOKEN,openrouter:env.OPENROUTER_API_KEY,google:env.GOOGLE_SEARCH_KEY,nitemcp:env.NITEMCP_API_KEY}[p]);
async function encryptionKey(env,create=false){
 let secret=env.TRIP_KEYS_ENCRYPTION_KEY;
 if(!secret&&env.trip_agents){
  const path='private/trip/keys-master-v1';
  let object;try{object=await env.trip_agents.get(path)}catch{throw fail('Secure key storage is unavailable',503)}
  if(object)secret=await object.text();
  else if(create){
   const candidate=btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));
   try{const saved=await env.trip_agents.put(path,candidate,{onlyIf:{etagDoesNotMatch:'*'},httpMetadata:{contentType:'application/octet-stream'}});if(saved)secret=candidate;else{const winner=await env.trip_agents.get(path);secret=winner&&await winner.text()}}catch{throw fail('Secure key storage is unavailable',503)}
  }
 }
 let bytes;try{bytes=Uint8Array.from(atob(secret||''),c=>c.charCodeAt(0))}catch{}
 if(bytes?.length!==32)throw fail('Secure key storage is not configured on this server',503);
 return crypto.subtle.importKey('raw',bytes,'AES-GCM',false,['encrypt','decrypt']);
}
const encode=b=>btoa(String.fromCharCode(...new Uint8Array(b)));
const decode=b=>Uint8Array.from(atob(b),c=>c.charCodeAt(0));
async function encrypt(env,secret,scope){const iv=crypto.getRandomValues(new Uint8Array(12));const value=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode(scope)},await encryptionKey(env,true),new TextEncoder().encode(secret));return {iv:encode(iv),value:encode(value)}}
async function decrypt(env,cipher,scope){try{return new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(cipher.iv),additionalData:new TextEncoder().encode(scope)},await encryptionKey(env),decode(cipher.value)))}catch(error){if(error.status)throw error;throw fail('Stored key could not be opened. Ask the owner to reconnect it.',503)}}
async function read(env){if(!env.TRIPS_KV)throw fail('Settings storage unavailable',503);return JSON.parse(await env.TRIPS_KV.get(KEY)||'{"groups":[]}')}
function access(env,user,g,p){return isAdmin(env,user)||g.members?.[user]?.includes(p)}
function publicGroup(env,user,g){const allowed=PROVIDERS.filter(p=>access(env,user,g,p));return {id:g.id,name:g.name,allowedProviders:allowed,providers:Object.fromEntries(allowed.map(p=>[p,{configured:!!g.providers?.[p],source:g.providers?.[p]?.source||null,testedAt:g.providers?.[p]?.testedAt||null}])),prompts:g.prompts||{},mediaProvider:g.mediaProvider||'firecrawl',apifyActor:g.apifyActor||'',apifyInputTemplate:g.apifyInputTemplate||'',googleCx:g.settings?.googleCx||'',chatModel:g.settings?.chatModel||'sonar',nitemcpModel:g.settings?.nitemcpModel||'',nitemcpBase:g.settings?.nitemcpBase||'',openrouterModel:g.settings?.openrouterModel||'',discoverySource:g.settings?.discoverySource||'firecrawl',...(isAdmin(env,user)?{members:g.members||{}}:{})}}
export async function settingsContext(env,user,groupId){
 const config=await read(env);let group=null;
 if(groupId){group=config.groups.find(g=>g.id===groupId);if(!group||!PROVIDERS.some(p=>access(env,user,group,p)))throw fail('You are not approved for this integration group',403)}
 return {
  prompt:agent=>group?.prompts?.[agent]||'',
  actor:group?.apifyActor||env.APIFY_ACTOR_ID,
  inputTemplate:group?.apifyInputTemplate||env.APIFY_INPUT_TEMPLATE,
  mediaProvider:group?.mediaProvider||'firecrawl',
  settings:()=>group?.settings||{},
  async key(provider,supplied){
   if(group&&!access(env,user,group,provider))throw fail('Your group has not approved '+provider+' access',403);
   if(supplied)return supplied;
   const entry=group?.providers?.[provider];
   if(entry?.source==='stored')return decrypt(env,entry.cipher,group.id+':'+provider);
   if(entry?.source==='server'){const k=serverKey(env,provider);if(k)return k;throw fail(provider+' server key is not configured',503)}
   if(!group&&isAdmin(env,user)){const k=serverKey(env,provider);if(k)return k}
   throw fail(provider+' key not configured or approved. Open Account settings.',503);
  }
 };
}
export async function handleSettings(request,env,user,body,fetcher=fetch){
 const path=new URL(request.url).pathname;
 if(path!=='/api/tools/settings'&&path!=='/api/tools/settings/test')return null;
 const config=await read(env);
 if(path==='/api/tools/settings'&&request.method==='GET')return json({user,isAdmin:isAdmin(env,user),secureStorageReady:!env.TRIP_KEYS_ENCRYPTION_KEY&&!!env.trip_agents?true:await encryptionKey(env).then(()=>true,()=>false),serverProviders:Object.fromEntries(PROVIDERS.map(p=>[p,isAdmin(env,user)&&!!serverKey(env,p)])),groups:config.groups.filter(g=>PROVIDERS.some(p=>access(env,user,g,p))).map(g=>publicGroup(env,user,g))});
 if(!isAdmin(env,user))throw fail('Only an integration owner can change keys, prompts or approvals',403);
 if(request.method!=='POST')throw fail('Method not allowed',405);
 if(path.endsWith('/test')){
  if(!PROVIDERS.includes(body.provider))throw fail('Unknown provider');
  const context=await settingsContext(env,user,body.groupId);const key=await context.key(body.provider);
  const groupForCx=config.groups.find(g=>g.id===body.groupId);
  const googleCx=String(body.googleCx??groupForCx?.settings?.googleCx??'').trim();
  if(body.provider==='google'&&!googleCx)throw fail('Add the Google engine ID (cx) before testing');
  const specs={
   sonar:['https://api.perplexity.ai/v1/sonar','POST',{model:'sonar',max_tokens:8,messages:[{role:'user',content:'Reply OK.'}]}],
   firecrawl:['https://api.firecrawl.dev/v2/search','POST',{query:'site:example.com',limit:1}],
   apify:['https://api.apify.com/v2/users/me','GET',null],
   openrouter:['https://openrouter.ai/api/v1/key','GET',null],
   nitemcp:[String(body.nitemcpBase||'https://api.nitemcp.com/v1').replace(/\/+$/,'')+'/models','GET',null],
   google:['https://www.googleapis.com/customsearch/v1?q=honolulu&num=1&key='+encodeURIComponent(key)+'&cx='+encodeURIComponent(googleCx),'GET',null],
  };
  const [url,method,payload]=specs[body.provider];let r;try{r=await fetcher(url,{method,headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},...(payload?{body:JSON.stringify(payload)}:{}),signal:AbortSignal.timeout(30000)})}catch{throw fail('Connection test timed out or failed',502)}
  if(!r.ok){
   const name={sonar:'Perplexity Sonar',firecrawl:'Firecrawl',apify:'Apify',openrouter:'OpenRouter',nitemcp:'nitemcp',google:'Google Search'}[body.provider]||body.provider;
   if(r.status===401||r.status===403)throw fail(name+' rejected this API key. Check the key and save it again.',502);
   if(r.status===429)throw fail(name+' is rate limiting the test. Try again in a minute.',502);
   throw fail(body.provider+' test returned HTTP '+r.status,502);
  }
  const group=config.groups.find(g=>g.id===body.groupId);
  if(!group?.providers?.[body.provider])throw fail('Save the provider before testing');
  let result;try{result=await r.json()}catch{throw fail('Provider test returned invalid JSON',502)}
  const valid=body.provider==='sonar' ? typeof result?.choices?.[0]?.message?.content==='string'&&!!result.choices[0].message.content.trim()
    : body.provider==='firecrawl' ? result?.success===true&&(Array.isArray(result.data)||Array.isArray(result.data?.web))
    : body.provider==='openrouter' ? !!result?.data&&typeof result.data==='object'
    : body.provider==='nitemcp' ? Array.isArray(result?.data)
    : body.provider==='google' ? Array.isArray(result?.items)
    : typeof result?.data?.id==='string'&&!!result.data.id;
  if(!valid||result?.error)throw fail('Provider rejected the connection test or returned an invalid response',502);
  const current=await read(env);const currentGroup=current.groups.find(g=>g.id===body.groupId);if(!currentGroup?.providers?.[body.provider]||JSON.stringify(currentGroup.providers[body.provider])!==JSON.stringify(group.providers[body.provider]))throw fail('Connection changed during the test. Save and test it again.',409);
  const testedAt=new Date().toISOString();currentGroup.providers[body.provider].testedAt=testedAt;await env.TRIPS_KV.put(KEY,JSON.stringify(current));return json({ok:true,provider:body.provider,testedAt});
 }
 if(typeof body.name!=='string'||!body.name.trim()||body.name.length>80)throw fail('Group name is required (max 80 characters)');
 let group=config.groups.find(g=>g.id===body.id);
 if(body.id&&!group)throw fail('Group not found',404);
 group=group?structuredClone(group):{id:crypto.randomUUID(),name:'',providers:{},prompts:{},members:{}};
 group.name=body.name.trim();
 if(body.mediaProvider!==undefined){if(!['firecrawl','apify','none'].includes(body.mediaProvider))throw fail('Invalid image search provider');group.mediaProvider=body.mediaProvider}
 if(body.members!==undefined){
  if(!body.members||typeof body.members!=='object'||Array.isArray(body.members))throw fail('Invalid member approvals');
  const known=[...new Set([...knownAccountNames(env),...(await knownAccounts(env))])];
  const entries=Object.entries(body.members);if(entries.length>50)throw fail('A group supports up to 50 approved users');
  for(const [name,providers]of entries){if(!known.includes(name))throw fail('Unknown account: '+name);if(!Array.isArray(providers)||providers.some(p=>!PROVIDERS.includes(p)))throw fail('Invalid provider approval')}
  group.members=Object.fromEntries(entries.map(([u,p])=>[u,[...new Set(p)]]));
 }
 if(body.prompts!==undefined){if(!body.prompts||typeof body.prompts!=='object'||Array.isArray(body.prompts))throw fail('Invalid prompts');for(const agent of AGENTS){if(body.prompts[agent]!==undefined){if(typeof body.prompts[agent]!=='string'||body.prompts[agent].length>4000)throw fail('Prompt exceeds 4000 characters');group.prompts[agent]=body.prompts[agent]}}}
 if(body.chatModel!==undefined){if(!['sonar','openrouter','nitemcp'].includes(body.chatModel))throw fail('Invalid chat model');group.settings={...(group.settings||{}),chatModel:body.chatModel}}
 if(body.nitemcpModel!==undefined){if(typeof body.nitemcpModel!=='string'||body.nitemcpModel.length>120)throw fail('Invalid nitemcp model');group.settings={...(group.settings||{}),nitemcpModel:body.nitemcpModel.trim()}}
 if(body.nitemcpBase!==undefined){if(typeof body.nitemcpBase!=='string'||body.nitemcpBase.length>200||!/^https:\/\//.test(body.nitemcpBase))throw fail('nitemcp base URL must be https');group.settings={...(group.settings||{}),nitemcpBase:body.nitemcpBase.trim()}}
 if(body.openrouterModel!==undefined){if(typeof body.openrouterModel!=='string'||body.openrouterModel.length>120)throw fail('Invalid OpenRouter model');group.settings={...(group.settings||{}),openrouterModel:body.openrouterModel.trim()}}
 if(body.discoverySource!==undefined){if(!['firecrawl','google'].includes(body.discoverySource))throw fail('Invalid discovery source');group.settings={...(group.settings||{}),discoverySource:body.discoverySource}}
 if(body.googleCx!==undefined){if(typeof body.googleCx!=='string'||body.googleCx.length>120)throw fail('Invalid Google engine ID');group.settings={...(group.settings||{}),googleCx:body.googleCx.trim()}}
 if(body.apifyActor!==undefined){if(typeof body.apifyActor!=='string'||body.apifyActor.length>120)throw fail('Invalid Actor ID');group.apifyActor=body.apifyActor}
 if(body.apifyInputTemplate!==undefined){if(typeof body.apifyInputTemplate!=='string'||body.apifyInputTemplate.length>8000)throw fail('Invalid Actor template');if(body.apifyInputTemplate){try{JSON.parse(body.apifyInputTemplate.replaceAll('{{query}}','query'))}catch{throw fail('Actor template must be valid JSON')}}group.apifyInputTemplate=body.apifyInputTemplate}
 for(const p of PROVIDERS){
  if(body.keys?.[p]===null)delete group.providers[p];
  else if(body.keys?.[p]){if(typeof body.keys[p]!=='string'||body.keys[p].length>4000)throw fail('Invalid key');group.providers[p]={source:'stored',cipher:await encrypt(env,body.keys[p],group.id+':'+p)}}
  else if(body.useServerKeys?.[p]){if(!serverKey(env,p))throw fail(p+' server key is not configured',503);group.providers[p]={source:'server'}}
 }
 const index=config.groups.findIndex(g=>g.id===group.id);if(index<0)config.groups.push(group);else config.groups[index]=group;
 await env.TRIPS_KV.put(KEY,JSON.stringify(config));return json({ok:true,group:publicGroup(env,user,group)});
}

// When a client omits a group, fall back to the first group this user can actually use,
// so a configured brain is never silently ignored.
export async function defaultGroupId(env,user){
 const config=await read(env);
 const group=config.groups.find(g=>PROVIDERS.some(provider=>g.providers?.[provider]&&access(env,user,g,provider)));
 return group?.id||'';
}
