import {useEffect,useMemo,useRef,useState} from 'react';
import {ArrowLeftIcon,ArrowRightIcon,GearIcon,ExternalLinkIcon,ImageIcon,SunIcon,ClockIcon,GlobeIcon,BackpackIcon,CameraIcon,ShadowIcon} from '@radix-ui/react-icons';
import {MobileScroll,KeyboardInput,useKeyboard,useKeyboardInsets} from './mobile';
import IntegrationSettings from './IntegrationSettings';
import Markdown from './markdown';
import {chatSuggestions,type SuggestionIcon} from './chat-suggestions';
import './chat-markdown.css';
import {apiRequest,credentials,loadSettings,type SettingsData} from './integration-api';
type Source={title:string;url:string;description?:string;image?:string};
type ImageResult={url:string;sourceUrl:string;title:string};
type Result={agent?:string;answer?:string;error?:string;citations?:string[];provider?:string;cards?:Source[];images?:ImageResult[];mediaError?:string;researchError?:string;agents?:Result[];sources?:Source[]};
type Turn={id:number;query:string;mode:string;result?:Result;error?:string};
function safeHref(value:unknown){if(typeof value!=='string')return null;try{const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||!u.hostname.includes('.')||/^(localhost|127\.|10\.|192\.168\.|169\.254\.)/.test(u.hostname)||u.hostname.endsWith('.local')||u.hostname.endsWith('.internal'))return null;return u.href}catch{return null}}
const SUGGEST_ICON={sun:SunIcon,rain:ShadowIcon,clock:ClockIcon,pin:GlobeIcon,bag:BackpackIcon,camera:CameraIcon} as const;
function suggestionIcon(kind:SuggestionIcon){const Icon=SUGGEST_ICON[kind]||ClockIcon;return <Icon/>}
function Photo({item}:{item:ImageResult}){const [failed,setFailed]=useState(false);const src=safeHref(item.url),source=safeHref(item.sourceUrl);if(!src||!source)return null;return <a className="ai-photo" href={source} target="_blank" rel="noopener noreferrer">{failed?<span className="ai-image-fallback"><ImageIcon/> Preview unavailable</span>:<img src={src} alt={item.title||'Image result'} loading="lazy" referrerPolicy="no-referrer" onError={()=>setFailed(true)}/>}<span>{item.title||'Image result'}<small>{new URL(source).hostname} <ExternalLinkIcon/></small></span></a>}
function LinkCard({item}:{item:Source}){const href=safeHref(item.url);if(!href)return null;return <a className="ai-link-card" href={href} target="_blank" rel="noopener noreferrer"><span><small>{new URL(href).hostname}</small><b>{item.title||new URL(href).hostname}</b>{item.description&&<span>{item.description}</span>}</span><ExternalLinkIcon/></a>}
function RichResult({result,onAction}:{result:Result;onAction?:(action:{type:'map';value:string})=>void}){const response=(r:Result,i=0)=><article className="response ai-response" key={i}><span className="eyebrow">{r.agent||r.provider||'Trip'}</span>{r.error?<p role="alert">{r.error}</p>:r.answer?<Markdown value={r.answer} citations={r.citations} onAction={onAction}/>:null}{!!r.sources?.length&&<div className="ai-links">{r.sources.slice(0,3).map(s=><LinkCard key={s.url} item={s}/>)}</div>}{!r.sources?.length&&!!r.citations?.length&&<details><summary>Sources · {r.citations.length}</summary>{r.citations.map(url=><LinkCard key={url} item={{title:safeHref(url)?new URL(url).hostname:'Source',url}}/>)}</details>}{!!r.images?.length&&<div className="ai-image-grid">{r.images.slice(0,6).map((item,j)=><Photo key={item.url+j} item={item}/>)}</div>}</article>;return <>{result.agents?result.agents.map(response):response(result)}{result.researchError&&<p role="status" className="quiet">Research unavailable: {result.researchError}</p>}{result.cards&&<div className="ai-links">{result.cards.length?result.cards.map((item,i)=>safeHref(item.url)?<LinkCard item={item} key={item.url||i}/>:<article className="response" key={i}><b>{item.title}</b><p>{item.description}</p></article>):<p className="quiet">No matching results returned.</p>}</div>}{!!result.agents&&!!result.images?.length&&<div className="ai-image-grid">{result.images.slice(0,6).map((item,i)=><Photo key={item.url+i} item={item}/>)}</div>}{result.mediaError&&<p role="status" className="quiet">{result.mediaError} Text results are still available.</p>}</>}
export default function LiveTools({onClose,context,initialMode='Chat',onAction}:{onClose:()=>void;context:string;initialMode?:string;onAction?:(action:{type:'map';value:string})=>void}) {
 const [signedIn,setSignedIn]=useState(!!credentials.token),[settings,setSettings]=useState(false),[config,setConfig]=useState<SettingsData|null>(null),[groupId,setGroupId]=useState(credentials.groupId);
 const [mode,setMode]=useState(initialMode),[query,setQuery]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[turns,setTurns]=useState<Turn[]>([]),[includeImages,setIncludeImages]=useState(false);
 const conversationScope=useRef(credentials.user+'|'+groupId);
 const requestId=useRef(0),active=useRef(true);useEffect(()=>{active.current=true;return()=>{active.current=false;requestId.current++}},[]);
 const keyboard=useKeyboard(),insets=useKeyboardInsets();
 async function refreshGroups(){const token=credentials.token;try{const next=await loadSettings();if(!active.current||credentials.token!==token)return;setConfig(next);const selected=next.groups.find(g=>g.id===credentials.groupId)||next.groups[0];const scope=next.user+'|'+(selected?.id||'');if(conversationScope.current!==scope){setTurns([]);conversationScope.current=scope}setGroupId(selected?.id||'');credentials.groupId=selected?.id||'';setError('')}catch(e){if(!active.current)return;setError((e as Error).message);if(!credentials.token)setSignedIn(false)}}
 useEffect(()=>{if(signedIn)refreshGroups()},[signedIn]);
 const group=config?.groups.find(g=>g.id===groupId);
 const provider=mode==='Firecrawl'?'firecrawl':mode==='Apify'?'apify':'sonar';
 const allowed=!!config&&(group?group.allowedProviders.includes(provider):!!config.isAdmin);
 const imageProvider=group?.mediaProvider||'firecrawl';
 const imagesAllowed=imageProvider!=='none'&&!!config&&(group?group.allowedProviders.includes(imageProvider as 'firecrawl'|'apify'):!!config.isAdmin);
 async function run(text?:string){const ask=(text??query).trim();if(!ask||!allowed||busy)return;keyboard.hide();setBusy(true);setError('');const question=ask,id=++requestId.current,token=credentials.token;
  const history=turns.slice(-3).flatMap(t=>[{role:'user',content:t.query.slice(0,800)},...(t.result?.answer?[{role:'assistant',content:t.result.answer.slice(0,800)}]:[])]);
  setTurns(current=>[...current,{id,query:question,mode}].slice(-12));setQuery('');
  try{let path='/api/tools/chat',body:Record<string,unknown>={query:question,context,history,agent:mode,includeImages:includeImages&&imagesAllowed,...(groupId?{groupId}:{})};
   if(mode==='All agents')path='/api/tools/agents';
   if(mode==='Firecrawl'||mode==='Apify'){path='/api/tools/research';body={query:question,provider:mode.toLowerCase(),includeImages:includeImages&&imagesAllowed,...(groupId?{groupId}:{})}}
   const result=await apiRequest<Result>(path,body);if(!active.current||credentials.token!==token||requestId.current!==id)return;setTurns(current=>current.map(t=>t.id===id?{...t,result}:t));
  }catch(e){if(!active.current||(credentials.token&&credentials.token!==token)||requestId.current!==id)return;setTurns(current=>current.map(t=>t.id===id?{...t,error:(e as Error).message}:t));if(!credentials.token)setSignedIn(false)}finally{if(active.current&&requestId.current===id)setBusy(false)}
 }
 const tripContext=useMemo(()=>{try{return JSON.parse(context||'{}') as {trip?:{city?:string;depart?:string;returnDate?:string};stops?:{title:string;place?:string;time?:string}[];items?:{packed?:Record<string,boolean>}[];posts?:unknown[];weather?:{temp?:number;rain?:number;localTime?:string}} }catch{return {}}},[context]);
 const suggestions=useMemo(()=>chatSuggestions({
  city:tripContext.trip?.city,
  hour:undefined,
  tempC:tripContext.weather?.temp,
  localTime:(tripContext.weather as {localTime?:string}|undefined)?.localTime,
  rainChance:tripContext.weather?.rain,
  stops:tripContext.stops,
  tripStart:tripContext.trip?.depart,
  today:new Date().toISOString().slice(0,10),
  unpacked:(tripContext.items||[]).filter(item=>!Object.values(item.packed||{}).some(Boolean)).length,
  photoCount:(tripContext.posts||[]).length,
 }),[tripContext]);
 if(settings||!signedIn)return <IntegrationSettings onClose={()=>{keyboard.hide();if(!credentials.token){onClose();return}setSignedIn(true);setSettings(false);refreshGroups()}} onChanged={()=>{setSignedIn(!!credentials.token);refreshGroups()}}/>;
 return <><div className="chat-head"><button className="text-btn" onClick={()=>{keyboard.hide();onClose()}}><ArrowLeftIcon/> Trip AI</button><button aria-label="Account settings" onClick={()=>{keyboard.hide();setSettings(true)}}><GearIcon/> Settings</button></div>
 <MobileScroll className="chat-scroll"><div className="chat-content"><h1>What’s next?</h1>
 {!allowed&&config&&<p className="quiet">Choose an approved connection to use this tool. <button className="text-btn" onClick={()=>setSettings(true)}>Open Settings</button></p>}
 {mode==='Apify'&&<p className="quiet">Uses your configured Actor. Up to 20 results per run.</p>}
 {turns.map(t=><section className="ai-turn" key={t.id}><p className="ai-question">{t.query}</p>{t.result&&<RichResult result={t.result} onAction={onAction}/>} {t.error&&<div role="alert" className="live-error">{t.error}<div><button className="text-btn" disabled={busy} onClick={()=>{setQuery(t.query);setMode(t.mode)}}>Try again</button> <button className="text-btn" onClick={()=>setSettings(true)}>Connection settings</button></div></div>}</section>)}
 {busy&&<p role="status">Thinking…</p>}
 {!busy&&!turns.length&&<section className="ai-suggest"><p className="eyebrow">START HERE</p><div className="ai-suggest-grid">{suggestions.map(item=><button type="button" className="ai-suggest-card" key={item.label} disabled={!allowed||busy} onClick={()=>void run(item.query)}><span className="ai-suggest-icon">{suggestionIcon(item.icon)}</span><span><b>{item.label}</b><small>{item.hint}</small></span></button>)}</div></section>}
 {error&&<p role="alert" className="live-error">{error}</p>}
 </div></MobileScroll><form className="composer" style={{bottom:(Number(insets.bottomInset)||0)+12}} onSubmit={e=>{e.preventDefault();run()}}>
  <button type="button" className={'composer-img'+(includeImages?' on':'')} aria-pressed={includeImages} aria-label="Include web images" title={imagesAllowed?'Search the web for images':'Enable an approved image connection in Settings'} disabled={!imagesAllowed||busy} onClick={()=>setIncludeImages(value=>!value)}><ImageIcon/></button>
  <KeyboardInput aria-label="Ask Trip" placeholder="Ask Trip…" value={query} onChange={e=>setQuery(e.target.value)} onBlur={()=>keyboard.hide()}/>
  <button aria-label="Send message" className="composer-send" disabled={busy||!query.trim()||!allowed}><ArrowRightIcon/></button>
 </form></>;
}
