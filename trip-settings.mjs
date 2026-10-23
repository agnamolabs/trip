const PROVIDERS=['sonar','firecrawl','apify'];
const AGENTS=['Chat','Guide','Research','Planning'];
const KEY='trip:integration-settings:v1';
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
const admins=env=>String(env.TRIP_ADMIN_USERS||'').split(',').map(s=>s.trim()).filter(Boolean);
export const isAdmin=(env,user)=>admins(env).includes(user);
const serverKey=(env,p)=>({sonar:env.PPLX_KEY||env.PERPLEXITY_API_KEY,firecrawl:env.FIRECRAWL_API_KEY,apify:env.APIFY_TOKEN}[p]);
async function encryptionKey(env){
 let bytes;try{bytes=Uint8Array.from(atob(env.TRIP_KEYS_ENCRYPTION_KEY||''),c=>c.charCodeAt(0))}catch{}
 if(bytes?.length!==32)throw fail('Secure key storage is not configured on this server',503);
 return crypto.subtle.importKey('raw',bytes,'AES-GCM',false,['encrypt','decrypt']);
}
const encode=b=>btoa(String.fromCharCode(...new Uint8Array(b)));
const decode=b=>Uint8Array.from(atob(b),c=>c.charCodeAt(0));
async function encrypt(env,secret,scope){const iv=crypto.getRandomValues(new Uint8Array(12));const value=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode(scope)},await encryptionKey(env),new TextEncoder().encode(secret));return {iv:encode(iv),value:encode(value)}}
async function decrypt(env,cipher,scope){try{return new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(cipher.iv),additionalData:new TextEncoder().encode(scope)},await encryptionKey(env),decode(cipher.value)))}catch(error){if(error.status)throw error;throw fail('Stored key could not be opened. Ask the owner to reconnect it.',503)}}
async function read(env){if(!env.TRIPS_KV)throw fail('Settings storage unavailable',503);return JSON.parse(await env.TRIPS_KV.get(KEY)||'{"groups":[]}')}
function access(env,user,g,p){return isAdmin(env,user)||g.members?.[user]?.includes(p)}
function publicGroup(env,user,g){const allowed=PROVIDERS.filter(p=>access(env,user,g,p));return {id:g.id,name:g.name,allowedProviders:allowed,providers:Object.fromEntries(allowed.map(p=>[p,{configured:!!g.providers?.[p],source:g.providers?.[p]?.source||null,testedAt:g.providers?.[p]?.testedAt||null}])),prompts:g.prompts||{},apifyActor:g.apifyActor||'',apifyInputTemplate:g.apifyInputTemplate||'',...(isAdmin(env,user)?{members:g.members||{}}:{})}}
export async function settingsContext(env,user,groupId){
 const config=await read(env);let group=null;
 if(groupId){group=config.groups.find(g=>g.id===groupId);if(!group||!PROVIDERS.some(p=>access(env,user,group,p)))throw fail('You are not approved for this integration group',403)}
 return {
  prompt:agent=>group?.prompts?.[agent]||'',
  actor:group?.apifyActor||env.APIFY_ACTOR_ID,
  inputTemplate:group?.apifyInputTemplate||env.APIFY_INPUT_TEMPLATE,
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
 if(path==='/api/tools/settings'&&request.method==='GET')return json({user,isAdmin:isAdmin(env,user),secureStorageReady:await encryptionKey(env).then(()=>true,()=>false),serverProviders:Object.fromEntries(PROVIDERS.map(p=>[p,isAdmin(env,user)&&!!serverKey(env,p)])),groups:config.groups.filter(g=>PROVIDERS.some(p=>access(env,user,g,p))).map(g=>publicGroup(env,user,g))});
 if(!isAdmin(env,user))throw fail('Only an integration owner can change keys, prompts or approvals',403);
 if(request.method!=='POST')throw fail('Method not allowed',405);
 if(path.endsWith('/test')){
  if(!PROVIDERS.includes(body.provider))throw fail('Unknown provider');
  const context=await settingsContext(env,user,body.groupId);const key=await context.key(body.provider);
  const specs={sonar:['https://api.perplexity.ai/v1/sonar','POST',{model:'sonar',max_tokens:8,messages:[{role:'user',content:'Reply OK.'}]}],firecrawl:['https://api.firecrawl.dev/v2/search','POST',{query:'site:example.com',limit:1}],apify:['https://api.apify.com/v2/users/me','GET',null]};
  const [url,method,payload]=specs[body.provider];let r;try{r=await fetcher(url,{method,headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},...(payload?{body:JSON.stringify(payload)}:{}),signal:AbortSignal.timeout(30000)})}catch{throw fail('Connection test timed out or failed',502)}
  if(!r.ok)throw fail(body.provider+' test returned HTTP '+r.status,502);
  const group=config.groups.find(g=>g.id===body.groupId);
  if(!group?.providers?.[body.provider])throw fail('Save the provider before testing');
  let result;try{result=await r.json()}catch{throw fail('Provider test returned invalid JSON',502)}
  const valid=body.provider==='sonar' ? typeof result?.choices?.[0]?.message?.content==='string'&&!!result.choices[0].message.content.trim()
    : body.provider==='firecrawl' ? result?.success===true&&(Array.isArray(result.data)||Array.isArray(result.data?.web))
    : typeof result?.data?.id==='string'&&!!result.data.id;
  if(!valid||result?.error)throw fail('Provider rejected the connection test or returned an invalid response',502);
  const testedAt=new Date().toISOString();group.providers[body.provider].testedAt=testedAt;await env.TRIPS_KV.put(KEY,JSON.stringify(config));return json({ok:true,provider:body.provider,testedAt});
 }
 if(typeof body.name!=='string'||!body.name.trim()||body.name.length>80)throw fail('Group name is required (max 80 characters)');
 let group=config.groups.find(g=>g.id===body.id);
 if(body.id&&!group)throw fail('Group not found',404);
 group=group?structuredClone(group):{id:crypto.randomUUID(),name:'',providers:{},prompts:{},members:{}};
 group.name=body.name.trim();
 if(body.members!==undefined){
  if(!body.members||typeof body.members!=='object'||Array.isArray(body.members))throw fail('Invalid member approvals');
  let known={};try{known=JSON.parse(env.TRIP_AUTH_USERS||'{}')}catch{throw fail('Account configuration unavailable',503)}
  const entries=Object.entries(body.members);if(entries.length>50)throw fail('A group supports up to 50 approved users');
  for(const [name,providers]of entries){if(!Object.hasOwn(known,name))throw fail('Unknown account: '+name);if(!Array.isArray(providers)||providers.some(p=>!PROVIDERS.includes(p)))throw fail('Invalid provider approval')}
  group.members=Object.fromEntries(entries.map(([u,p])=>[u,[...new Set(p)]]));
 }
 if(body.prompts!==undefined){if(!body.prompts||typeof body.prompts!=='object'||Array.isArray(body.prompts))throw fail('Invalid prompts');for(const agent of AGENTS){if(body.prompts[agent]!==undefined){if(typeof body.prompts[agent]!=='string'||body.prompts[agent].length>4000)throw fail('Prompt exceeds 4000 characters');group.prompts[agent]=body.prompts[agent]}}}
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
