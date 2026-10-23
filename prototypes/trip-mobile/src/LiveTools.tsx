import {useEffect,useState} from 'react';
import {ArrowLeftIcon,ArrowRightIcon,GearIcon} from '@radix-ui/react-icons';
import {MobileScroll,KeyboardInput,useKeyboard,useKeyboardInsets} from './mobile';
import IntegrationSettings from './IntegrationSettings';
import {apiRequest,credentials,loadSettings,type SettingsData} from './integration-api';
type Result={agent?:string;answer?:string;error?:string;citations?:string[];provider?:string;results?:unknown[];researchError?:string;agents?:Result[];sources?:{title:string;url:string}[]};
function safeHref(value:string){try{const u=new URL(value);return u.protocol==='https:'?u.href:null}catch{return null}}
export default function LiveTools({onClose,context}:{onClose:()=>void;context:string}) {
 const [signedIn,setSignedIn]=useState(!!credentials.token),[settings,setSettings]=useState(false),[config,setConfig]=useState<SettingsData|null>(null),[groupId,setGroupId]=useState(credentials.groupId);
 const [mode,setMode]=useState('Chat'),[query,setQuery]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[result,setResult]=useState<Result|null>(null);
 const keyboard=useKeyboard(),insets=useKeyboardInsets();
 async function refreshGroups(){try{const next=await loadSettings();setConfig(next);const selected=next.groups.find(g=>g.id===credentials.groupId)||next.groups[0];setGroupId(selected?.id||'');credentials.groupId=selected?.id||'';setError('')}catch(e){setError((e as Error).message);if(!credentials.token)setSignedIn(false)}}
 useEffect(()=>{if(signedIn)refreshGroups()},[signedIn]);
 const group=config?.groups.find(g=>g.id===groupId);
 const provider=mode==='Firecrawl'?'firecrawl':mode==='Apify'?'apify':'sonar';
 const allowed=group?group.allowedProviders.includes(provider):!!config?.isAdmin;
 async function run(){if(!query.trim()||!allowed)return;keyboard.hide();setBusy(true);setError('');setResult(null);try{
  let path='/api/tools/chat',body:Record<string,unknown>={query,context,agent:mode,...(groupId?{groupId}:{})};
  if(mode==='All agents')path='/api/tools/agents';
  if(mode==='Firecrawl'||mode==='Apify'){path='/api/tools/research';body={query,provider:mode.toLowerCase(),...(groupId?{groupId}:{})}}
  setResult(await apiRequest<Result>(path,body));
 }catch(e){setError((e as Error).message);if(!credentials.token)setSignedIn(false)}finally{setBusy(false)}}
 const response=(r:Result,i=0)=><article className="response" key={i}><span className="eyebrow">{r.agent||r.provider}</span>{r.error?<p role="alert">{r.error}</p>:<p className="live-answer">{r.answer}</p>}{r.citations?.length?<details><summary>Sources · {r.citations.length}</summary>{r.citations.map((url,j)=>{const href=safeHref(url);return href?<a className="live-source" href={href} key={url} target="_blank" rel="noopener noreferrer">{j+1}. {new URL(href).hostname}</a>:null})}</details>:null}</article>;
 if(settings||!signedIn)return <IntegrationSettings onClose={()=>{keyboard.hide();if(!credentials.token){onClose();return}setSignedIn(true);setSettings(false);refreshGroups()}} onChanged={()=>{setSignedIn(!!credentials.token);refreshGroups()}}/>;
 return <><div className="chat-head"><button className="text-btn" onClick={()=>{keyboard.hide();onClose()}}><ArrowLeftIcon/> Trip AI</button><button aria-label="Account settings" onClick={()=>{keyboard.hide();setSettings(true)}}><GearIcon/> Settings</button></div>
 <MobileScroll className="chat-scroll"><div className="chat-content"><h1>What’s next?</h1>
 {config&&<label className="field">Integration group<select aria-label="AI integration group" value={groupId} onChange={e=>{setGroupId(e.target.value);credentials.groupId=e.target.value;setResult(null)}}>{config.isAdmin&&<option value="">Server connections</option>}{!config.isAdmin&&!config.groups.length&&<option value="">No approved group</option>}{config.groups.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select></label>}
 <label className="field">Tool<select aria-label="AI tool" value={mode} onChange={e=>{setMode(e.target.value);setResult(null)}}>{['Chat','Guide','Research','Planning','All agents','Firecrawl','Apify'].map(m=><option key={m}>{m}</option>)}</select></label>
 {!allowed&&config&&<p className="quiet">Your account is not approved for this provider. Choose an approved group or ask the owner.</p>}
 {mode==='Apify'&&<p className="quiet">Uses the group’s configured Actor and input template. Up to 20 items, with a $1 charge ceiling.</p>}
 {busy&&<p role="status">Contacting {mode}…</p>}{result?.agents?result.agents.map((r,i)=>response(r,i)):result?.answer?response(result):null}{result?.researchError&&<p role="alert">Research unavailable: {result.researchError}</p>}{result?.results&&<div className="response"><span className="eyebrow">{result.provider} · {result.results.length} results</span><pre className="live-data">{JSON.stringify(result.results,null,2)}</pre></div>}{result?.sources?.map(s=>{const href=safeHref(s.url);return href?<a className="live-source" key={s.url} href={href} target="_blank" rel="noopener noreferrer">{s.title}</a>:null})}{!busy&&!result&&<p className="quiet">Responses do not edit your plan or make bookings automatically.</p>}
 {error&&<p role="alert" className="live-error">{error}</p>}
 </div></MobileScroll><form className="composer" style={{bottom:insets.bottomInset}} onSubmit={e=>{e.preventDefault();run()}}><KeyboardInput aria-label="Ask Trip" placeholder="Ask Trip…" value={query} onChange={e=>setQuery(e.target.value)} onBlur={()=>keyboard.hide()}/><button aria-label="Send message" disabled={busy||!query.trim()||!allowed}><ArrowRightIcon/></button></form></>;
}
