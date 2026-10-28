import {useEffect,useState} from 'react';
import {ArrowLeftIcon,PlusIcon,Cross2Icon,CheckIcon} from '@radix-ui/react-icons';
import {KeyboardInput,KeyboardTextarea,MobileScroll,useKeyboard,useKeyboardInsets} from './mobile';
import {agents,providers,apiRequest,credentials,loadSettings,signIn,type Agent,type Provider,type IntegrationGroup,type SettingsData} from './integration-api';
type Member={name:string;providers:Provider[]};
const emptyPrompts=()=>Object.fromEntries(agents.map(a=>[a,''])) as Record<Agent,string>;
const emptyKeys=()=>({sonar:'',firecrawl:'',apify:'',openrouter:'',google:''}) as Record<Provider,string|null>;
const emptyServer=()=>({sonar:false,firecrawl:false,apify:false,openrouter:false,google:false});
export default function IntegrationSettings({onClose,onChanged,onSignedIn}:{onClose?:()=>void;onChanged?:()=>void;onSignedIn?:()=>void}){
 const keyboard=useKeyboard(); const keyboardInsets=useKeyboardInsets();
 const [signedIn,setSignedIn]=useState(!!credentials.token),[username,setUsername]=useState(''),[password,setPassword]=useState('');
 const [data,setData]=useState<SettingsData|null>(null),[selected,setSelected]=useState(''),[name,setName]=useState(''),[members,setMembers]=useState<Member[]>([]),[prompts,setPrompts]=useState(emptyPrompts),[agent,setAgent]=useState<Agent>('Chat');
 const [chatModel,setChatModel]=useState<'sonar'|'openrouter'|'nitemcp'>('sonar'),[openrouterModel,setOpenrouterModel]=useState(''),[nitemcpModel,setNitemcpModel]=useState(''),[nitemcpBase,setNitemcpBase]=useState(''),[discoverySource,setDiscoverySource]=useState<'firecrawl'|'google'>('firecrawl'),[googleCx,setGoogleCx]=useState(''),[accounts,setAccounts]=useState<{user:string;role:string;createdAt:string|null}[]>([]),[newUser,setNewUser]=useState(''),[newPass,setNewPass]=useState('');
 const [mediaProvider,setMediaProvider]=useState<'firecrawl'|'apify'|'none'>('firecrawl'),[keys,setKeys]=useState(emptyKeys),[useServer,setUseServer]=useState(emptyServer),[actor,setActor]=useState(''),[template,setTemplate]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const group=data?.groups?.find(g=>g.id===selected);
 const groups=data?.groups??[];
 function selectGroup(g?:IntegrationGroup){
  setMediaProvider(g?.mediaProvider||'firecrawl');setSelected(g?.id||'');setName(g?.name||'');setMembers(Object.entries(g?.members||{}).map(([name,providers])=>({name,providers:[...providers]})));setPrompts({...emptyPrompts(),...g?.prompts});setKeys(emptyKeys());setUseServer(emptyServer());setActor(g?.apifyActor||'');setTemplate(g?.apifyInputTemplate||'');setGoogleCx(g?.googleCx||'');setChatModel((g?.chatModel as 'sonar'|'openrouter'|'nitemcp')||'sonar');setNitemcpModel(g?.nitemcpModel||'');setNitemcpBase(g?.nitemcpBase||'');setOpenrouterModel(g?.openrouterModel||'');setDiscoverySource((g?.discoverySource as 'firecrawl'|'google')||'firecrawl');setError('');setNotice('');
 }
 async function refresh(preferred=credentials.groupId){const next=await loadSettings();setData(next);const list=next.groups??[];const chosen=list.find(g=>g.id===preferred)||list[0];selectGroup(chosen);if(chosen)credentials.groupId=chosen.id;return next}
 useEffect(()=>{if(!signedIn)return;let active=true;setBusy(true);void loadAccounts();loadSettings().then(next=>{if(!active)return;setData(next);const list=next.groups??[];const chosen=list.find(g=>g.id===credentials.groupId)||list[0];selectGroup(chosen);if(chosen)credentials.groupId=chosen.id}).catch(e=>{if(!active)return;setError((e as Error).message);if(!credentials.token)setSignedIn(false)}).finally(()=>{if(active)setBusy(false)});return()=>{active=false}},[signedIn]);
 async function login(){keyboard.hide();setBusy(true);setError('');try{await signIn(username.trim(),password);setPassword('');setSignedIn(true);onSignedIn?.()}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 async function persist(){
  keyboard.hide();setBusy(true);setError('');setNotice('');
  try{
   const approvals:Record<string,Provider[]>={};
   for(const row of members){const username=row.name.trim();if(!username)throw Error('Enter a username for each approval.');if(Object.hasOwn(approvals,username))throw Error('Each user can appear once.');approvals[username]=row.providers}
   const changedKeys=Object.fromEntries(providers.filter(p=>keys[p]===null||!!keys[p]?.trim()).map(p=>[p,keys[p]===null?null:keys[p]!.trim()]));
   const saved=await apiRequest<{ok:boolean;group:IntegrationGroup}>('/api/tools/settings',{...(selected?{id:selected}:{}),name,mediaProvider,members:approvals,prompts,keys:changedKeys,useServerKeys:useServer,apifyActor:actor,apifyInputTemplate:template,googleCx,chatModel,openrouterModel,discoverySource,nitemcpModel,nitemcpBase});
   credentials.groupId=saved.group.id;await refresh(saved.group.id);onChanged?.();return saved.group.id;
  }catch(e){setError((e as Error).message);if(!credentials.token)setSignedIn(false);return null}finally{setBusy(false)}
 }
 async function save(){const id=await persist();if(id)setNotice('Settings saved.')}
 async function saveAndTest(provider:Provider){
  const id=await persist();if(!id)return;
  setBusy(true);setNotice('');
  try{const tested=await apiRequest<{ok:boolean;testedAt:string}>('/api/tools/settings/test',{groupId:id,provider,googleCx});await refresh(id);setNotice(title(provider)+' verified · '+new Date(tested.testedAt).toLocaleTimeString())}
  catch(e){setError((e as Error).message)}finally{setBusy(false)}
 }
 async function loadAccounts(){try{const result=await apiRequest<{accounts:{user:string;role:string;createdAt:string|null}[]}>('/api/app/accounts');setAccounts(Array.isArray(result.accounts)?result.accounts:[])}catch{setAccounts([])}}
 async function createAccount(){
  setBusy(true);setError('');
  try{await apiRequest('/api/app/accounts',{user:newUser.trim(),password:newPass});setNewUser('');setNewPass('');await loadAccounts();setNotice('Account added. Share a trip with them from the trip screen.')}
  catch(e){setError((e as Error).message)}finally{setBusy(false)}
 }
 async function removeAccount(user:string){
  setBusy(true);setError('');
  try{await apiRequest('/api/app/accounts',{remove:user});await loadAccounts();setNotice(user+' removed.')}
  catch(e){setError((e as Error).message)}finally{setBusy(false)}
 }
 async function testConnection(provider:Provider){keyboard.hide();setBusy(true);setError('');setNotice('');try{const tested=await apiRequest<{ok:boolean;testedAt:string}>('/api/tools/settings/test',{groupId:selected,provider});await refresh(selected);setNotice(provider+' connection verified at '+new Date(tested.testedAt).toLocaleTimeString()+'.')}catch(e){setError((e as Error).message);if(!credentials.token)setSignedIn(false)}finally{setBusy(false)}}
 const draftDirty=!group||name!==group.name||mediaProvider!==(group.mediaProvider||'firecrawl')||actor!==(group.apifyActor||'')||template!==(group.apifyInputTemplate||'')||JSON.stringify(prompts)!==JSON.stringify({...emptyPrompts(),...group.prompts})||JSON.stringify(members)!==JSON.stringify(Object.entries(group.members||{}).map(([name,providers])=>({name,providers})))||chatModel!==(group?.chatModel||'sonar')||nitemcpModel!==(group?.nitemcpModel||'')||nitemcpBase!==(group?.nitemcpBase||'')||openrouterModel!==(group?.openrouterModel||'')||discoverySource!==(group?.discoverySource||'firecrawl')||providers.some(p=>keys[p]===null||!!keys[p]||useServer[p]);
 const title=(p:Provider)=>({sonar:'Perplexity Sonar',firecrawl:'Firecrawl',apify:'Apify',openrouter:'OpenRouter',google:'Google Search'}[p]);
 const allowed=(group?.allowedProviders||[]).filter(p=>!!title(p));
 return <><div className="chat-head"><button className="text-btn" onClick={()=>{keyboard.hide();onClose?.()}}><ArrowLeftIcon/> Account</button>{keyboardInsets.isKeyboardVisible?<button type="button" className="text-btn" onClick={()=>keyboard.hide()}>Done</button>:data&&<span className="micro">{data.user} · {data.isAdmin?'Owner':'Member'}</span>}</div><MobileScroll className="chat-scroll"><div className="chat-content">
 {!signedIn?<form onSubmit={e=>{e.preventDefault();login()}}><h1>Sign in to Trip.</h1><p className="quiet">Your trips, plans and packing.</p><label className="field">User<KeyboardInput autoComplete="username" value={username} onChange={e=>setUsername(e.target.value)} onBlur={()=>keyboard.hide()}/></label><label className="field">Password<KeyboardInput type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} onBlur={()=>keyboard.hide()}/></label><button className="primary wide" disabled={busy||!username.trim()||!password}>Sign in</button></form>:<>
 <div className="section-title"><h1>Connections.</h1>{data?.isAdmin&&<button disabled={busy} onClick={()=>selectGroup()}><PlusIcon/> Group</button>}</div>
 {data&&<label className="field">Integration group<select aria-label="Integration group" value={selected} disabled={busy} onChange={e=>{const g=groups.find(x=>x.id===e.target.value);selectGroup(g);credentials.groupId=g?.id||''}}>{!selected&&<option value="">{data.isAdmin?'New group':'No approved group'}</option>}{groups.map(g=><option value={g.id} key={g.id}>{g.name}</option>)}</select></label>}
 {data?.isAdmin?<fieldset disabled={busy} style={{border:0,padding:0,minWidth:0}}>
 <label className="field">Group name<KeyboardInput value={name} maxLength={80} onChange={e=>setName(e.target.value)} onBlur={()=>keyboard.hide()}/></label>
 {!data.secureStorageReady&&<p role="status" className="quiet">Secure key storage needs server setup. Existing server connections can still be assigned.</p>}
 {draftDirty&&selected&&<p className="quiet">Save your changes before testing a connection.</p>}
 {providers.map(p=>{const saved=group?.providers?.[p];return <details key={p} open={p==='sonar'||(!saved?.configured&&p!=='apify')} className="response">
  <summary><span className={'keydot '+(saved?.configured?(saved.testedAt?'ok':'warn'):'')}/>{title(p)}<span className="micro" style={{marginLeft:8}}>{keys[p]===null?'will remove':saved?.configured?(saved.testedAt?'verified':'saved · untested'):'not connected'}</span></summary>
  <label className="field">{saved?.configured?'Replace key':'API key'}<KeyboardInput type="password" autoComplete="off" aria-label={title(p)+' API key'} disabled={!data.secureStorageReady} placeholder={saved?.configured?'Leave blank to keep saved key':p==='google'?'Google API key':'Paste key'} value={keys[p]||''} onChange={e=>{setKeys({...keys,[p]:e.target.value});setUseServer({...useServer,[p]:false})}} onBlur={()=>keyboard.hide()}/></label>
  {p==='google'&&<label className="field">Search engine ID (cx)<KeyboardInput aria-label="Google engine id" placeholder="e.g. 017576662512468239146:omuauf_lfve" value={googleCx} onChange={e=>setGoogleCx(e.target.value)} onBlur={()=>keyboard.hide()}/></label>}
  {data.serverProviders?.[p]&&<label className="checkbox-label"><input type="checkbox" checked={useServer[p]} onChange={e=>{setUseServer({...useServer,[p]:e.target.checked});if(e.target.checked)setKeys({...keys,[p]:''})}}/> Assign the server key on save</label>}
  <div className="section-title">
   <button type="button" disabled={busy||!selected||keys[p]===null||(!keys[p]?.trim()&&!saved?.configured&&!(p==='google'&&googleCx))} onClick={()=>void saveAndTest(p)}>Save &amp; test</button>
   <button type="button" disabled={busy||draftDirty||!saved?.configured} onClick={()=>void testConnection(p)}>Test saved</button>
   <button type="button" disabled={busy||!saved?.configured} onClick={()=>{setKeys({...keys,[p]:null});setUseServer({...useServer,[p]:false})}}>Remove</button>
  </div>
  <p className="quiet">{saved?.source==='server'?'Uses a server-managed key.':'Encrypted at rest with AES-GCM. Members never see it.'}</p>
 </details>})}
 <label className="field">Image search<select aria-label="Image search provider" value={mediaProvider} onChange={e=>setMediaProvider(e.target.value as typeof mediaProvider)}><option value="firecrawl">Web images · Firecrawl</option><option value="apify">Configured Apify Actor</option><option value="none">Off</option></select><small>Uses this group’s approved key. For Google Images, configure a compatible Apify Actor below.</small></label>

 <label className="field">Chat model<select aria-label="Chat model" value={chatModel} onChange={e=>setChatModel(e.target.value as 'sonar'|'openrouter')}><option value="sonar">Perplexity Sonar</option><option value="openrouter">OpenRouter</option><option value="nitemcp">nitemcp</option></select><small>One brain for the chat tab — there is no model picker in the app.</small></label>
 {chatModel==='openrouter'&&<label className="field">OpenRouter model<KeyboardInput aria-label="OpenRouter model" placeholder="google/gemini-2.0-flash-001" value={openrouterModel} onChange={e=>setOpenrouterModel(e.target.value)} onBlur={()=>keyboard.hide()}/></label>}
 {chatModel==='nitemcp'&&<><label className="field">nitemcp model<KeyboardInput aria-label="nitemcp model" placeholder="model id from the pool" value={nitemcpModel} onChange={e=>setNitemcpModel(e.target.value)} onBlur={()=>keyboard.hide()}/></label><label className="field">nitemcp base URL<KeyboardInput aria-label="nitemcp base url" placeholder="https://api.nitemcp.com/v1" value={nitemcpBase} onChange={e=>setNitemcpBase(e.target.value)} onBlur={()=>keyboard.hide()}/><small>Defaults to api.nitemcp.com/v1. Point it at /dono instead if that is your route.</small></label></>}
 <label className="field">Discovery source<select aria-label="Discovery source" value={discoverySource} onChange={e=>setDiscoverySource(e.target.value as 'firecrawl'|'google')}><option value="firecrawl">Firecrawl</option><option value="google">Google Search</option></select><small>Where Search pulls places, trails and events from.</small></label>
 <details className="response"><summary>System prompts</summary><label className="field">Agent<select aria-label="System prompt agent" value={agent} onChange={e=>setAgent(e.target.value as Agent)}>{agents.map(a=><option key={a}>{a}</option>)}</select></label><label className="field">{agent} instructions<KeyboardTextarea rows={5} maxLength={4000} value={prompts[agent]||''} onChange={e=>setPrompts({...prompts,[agent]:e.target.value})} onBlur={()=>keyboard.hide()}/></label><p className="quiet">Applies to this group’s requests. Built-in accuracy safeguards stay active.</p></details>
 <details className="response"><summary>Trip accounts · {accounts.length}</summary>
  <p className="quiet">People who can sign in. Add someone here, then share a trip with them from the trip screen. Passwords are hashed with PBKDF2 and never displayed.</p>
  {accounts.map(account=><div className="member" key={account.user}><b>{account.user}</b><span className="micro">{account.role==='Legacy'?'existing account':account.role}</span>{account.role!=='Legacy'&&<button type="button" aria-label={'Remove '+account.user} disabled={busy} onClick={()=>void removeAccount(account.user)}><Cross2Icon/></button>}</div>)}
  <label className="field">New username<KeyboardInput autoComplete="off" placeholder="e.g. Vrinda" value={newUser} onChange={e=>setNewUser(e.target.value)} onBlur={()=>keyboard.hide()}/></label>
  <label className="field">Password<KeyboardInput type="password" autoComplete="new-password" placeholder="At least 8 characters" value={newPass} onChange={e=>setNewPass(e.target.value)} onBlur={()=>keyboard.hide()}/></label>
  <button type="button" className="primary wide" disabled={busy||newUser.trim().length<2||newPass.length<8} onClick={()=>void createAccount()}>Add account</button>
 </details>
 <details className="response"><summary>Approved users · {members.length}</summary><p className="quiet">Approve existing Trip usernames for each provider. Changes take effect after Save.</p>{members.map((m,i)=><div className="response" key={i}><div className="section-title"><label className="field" style={{flex:1}}>Username<KeyboardInput aria-label={'Approved username '+(i+1)} value={m.name} onChange={e=>setMembers(members.map((x,j)=>j===i?{...x,name:e.target.value}:x))} onBlur={()=>keyboard.hide()}/></label><button type="button" aria-label={'Remove approval '+(i+1)} onClick={()=>setMembers(members.filter((_,j)=>j!==i))}><Cross2Icon/></button></div>{providers.map(p=><label className="checkbox-label" key={p}><input type="checkbox" aria-label={'Approve '+m.name+' for '+p} checked={m.providers.includes(p)} onChange={e=>setMembers(members.map((x,j)=>j===i?{...x,providers:e.target.checked?[...x.providers,p]:x.providers.filter(v=>v!==p)}:x))}/>{title(p)}</label>)}</div>)}<button type="button" className="subtle wide" onClick={()=>setMembers([...members,{name:'',providers:[]}])}><PlusIcon/> Add user approval</button></details>
 <details className="response"><summary>Apify Actor</summary><label className="field">Actor ID<KeyboardInput value={actor} placeholder="owner/actor-name" onChange={e=>setActor(e.target.value)} onBlur={()=>keyboard.hide()}/></label><label className="field">Input template<KeyboardTextarea rows={4} value={template} onChange={e=>setTemplate(e.target.value)} onBlur={()=>keyboard.hide()}/></label><p className="quiet">Use the Actor’s JSON schema. {'{{query}}'} inserts the user’s query.</p></details>
 <button type="button" className="primary wide" disabled={!name.trim()} onClick={save}>Save settings <CheckIcon/></button>
 </fieldset>:data&&<>{group?<><p className="quiet">{allowed.length?'You can use '+allowed.map(title).join(', ')+' in this group.':'No connections are approved for this group yet.'} Only an owner can change keys, prompts or approvals.</p>{allowed.map(p=><div className="member" key={p}><b>{title(p)}</b><span>{group.providers?.[p]?.configured?(group.providers[p]?.testedAt?'Verified':'Saved · untested'):'Not connected'}</span></div>)}<button className="primary wide" onClick={()=>{credentials.groupId=group.id;setNotice('Using '+group.name+'.');onChanged?.()}}>Use this group</button></>:<p className="quiet">No group access yet. Ask the owner to approve your username.</p>}</>}
 </>}
 {busy&&<p role="status">Working…</p>}{error&&<p role="alert" className="live-error">{error}</p>}{notice&&<p role="status" className="success">{notice}</p>}
 </div></MobileScroll></>;
}
