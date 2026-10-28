import {useEffect,useRef,useState} from 'react';
import {ArrowLeftIcon,ArrowRightIcon,PlusIcon,MagnifyingGlassIcon} from '@radix-ui/react-icons';
import {KeyboardInput,useKeyboard} from './mobile';
import {apiRequest,credentials} from './integration-api';
import type {LiveStop} from './live-trip';
import {discoveryKey,mergeDiscoveries,validDate,type Discovery,type DiscoveryKind} from './trip-planning';
import './trip-discovery.css';
function PlaceMedia({src,name}:{src?:string;name:string}){
 const [failed,setFailed]=useState(false);
 const initials=name.split(/\s+/).filter(Boolean).slice(0,2).map(word=>word[0]).join('').toUpperCase();
 return <span className="place-media">
  {src&&!failed?<img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={()=>setFailed(true)}/>:<span className="place-fallback" aria-hidden="true">{initials||'·'}</span>}
 </span>;
}
export type EventDraft={title:string;place:string;date:string;time:string;duration:number;sourceUrl:string;discoveryId?:string;lat?:number;lon?:number};
const safeUrl=(value:string)=>{try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password?url.href:''}catch{return ''}};
const safeDate=(value:string|undefined)=>typeof value==='string'&&validDate(value)?value:'';
const safeTime=(value:string|undefined)=>typeof value==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(value)?value:'';
type Props={tripId:string;city:string;date:string;stops:LiveStop[];discoveries:Discovery[];stopDate:(stop:LiveStop)=>string;overlaps:Set<string>;canEdit:boolean;saving:boolean;onBack:()=>void;onAdd:(draft?:EventDraft)=>void;onEdit:(stop:LiveStop)=>void;onDateChange:(date:string)=>void;onAuthRequired:()=>void;onDiscoveries:(items:Discovery[])=>Promise<boolean>};
export default function TripEvents({tripId,city,date,stops,discoveries,stopDate,overlaps,canEdit,saving,onBack,onAdd,onEdit,onDateChange,onAuthRequired,onDiscoveries}:Props){
 const active=useRef(true),tripRef=useRef(tripId),run=useRef(0);tripRef.current=tripId;useEffect(()=>{active.current=true;return()=>{active.current=false;run.current++}},[tripId]);
 const keyboard=useKeyboard();
 const [query,setQuery]=useState(''),[kind,setKind]=useState<DiscoveryKind>('places'),[view,setView]=useState('Discover'),[found,setFound]=useState<Discovery[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[importOpen,setImportOpen]=useState(false),[url,setUrl]=useState('');
 const filtered=stops.filter(s=>!s.visitedOn&&(s.title+' '+s.place).toLowerCase().includes(query.toLowerCase()));
 const days=[...new Set(filtered.map(stopDate))];
 const all=mergeDiscoveries(discoveries,found);
 const state=view==='Hidden'?'dismissed':view==='History'?'visited':'recommended';
 const cards=all.filter(d=>d.state===state&&(view==='History'||view==='Hidden'||d.kind===kind));
 async function discover(term?:string){
  const token=credentials.token,id=tripId,request=++run.current;keyboard.hide();setBusy(true);setError('');
  try{const result=await apiRequest<{results:Discovery[]}>('/api/app/discover',{tripId,date,kind,...((term??query).trim()?{query:(term??query).trim()}:{}),...(credentials.groupId?{groupId:credentials.groupId}:{})});
   if(!active.current||tripRef.current!==id||credentials.token!==token||request!==run.current)return;
   if(!Array.isArray(result.results))throw Error('Search returned an invalid response.');
   const rows=result.results.filter(r=>r&&typeof r.title==='string'&&typeof r.url==='string'&&safeUrl(r.url)).map(r=>({...r,id:discoveryKey(r.url),kind,state:'recommended' as const}));
   setFound(rows);
   if(canEdit&&rows.length){if(await onDiscoveries(mergeDiscoveries(discoveries,rows)))setFound([]);else setError('Results are shown but could not be saved. Refresh the trip and search again.');}
   if(!rows.length)setError('No results returned. Try a more specific search or import a known link.');
  }catch(e){if(!active.current||tripRef.current!==id||request!==run.current)return;if(credentials.token!==token){if(!credentials.token)onAuthRequired();return}setError((e as Error).message)}finally{if(active.current&&tripRef.current===id&&request===run.current)setBusy(false)}
 }
 async function importLink(item?:Discovery){
  const token=credentials.token,id=tripId,request=++run.current,source=safeUrl(item?.url||url);if(!source){setError('Enter a valid HTTPS link.');return}keyboard.hide();setBusy(true);setError('');
  try{const result=await apiRequest<{draft:Partial<EventDraft>}>('/api/app/import',{tripId,url:source,...(credentials.groupId?{groupId:credentials.groupId}:{})});if(!active.current||tripRef.current!==id||credentials.token!==token||request!==run.current)return;if(!result.draft||typeof result.draft.title!=='string')throw Error('The source did not return a draft.');const draft=result.draft;onAdd({title:draft.title!,place:typeof draft.place==='string'?draft.place:'',date:safeDate(draft.date)||date,time:safeTime(draft.time),duration:Number(draft.duration)>0?Number(draft.duration):60,sourceUrl:safeUrl(draft.sourceUrl||source)||source,discoveryId:item?.id,lat:draft.lat,lon:draft.lon})}catch(e){if(!active.current||tripRef.current!==id||request!==run.current)return;if(credentials.token!==token){if(!credentials.token)onAuthRequired();return}setError((e as Error).message)}finally{if(active.current&&tripRef.current===id&&request===run.current)setBusy(false)}
 }
 async function changeState(item:Discovery,next:Discovery['state']){setError('');const updated=all.map(d=>d.id===item.id?{...d,state:next,visitedOn:next==='visited'?date:undefined}:d);if(await onDiscoveries(updated))setFound([]);else setError('Could not save this change. Refresh the trip and retry.');}
 const draft=(item:Discovery):EventDraft=>({title:item.title,place:item.place||item.title,date:safeDate(item.date)||date,time:safeTime(item.time),duration:60,sourceUrl:safeUrl(item.url),discoveryId:item.id,lat:item.lat,lon:item.lon});
 return <><div className="section-title"><button className="text-btn" onClick={onBack}><ArrowLeftIcon/> Trip</button><span className="eyebrow">SEARCH</span></div><div className="page-title"><h1>Search.</h1><button className="primary" disabled={!canEdit||saving||busy} onClick={()=>onAdd()}><PlusIcon/> Add</button></div>
 <div className="view-tabs discovery-tabs">{['Discover','Saved plan','History','Hidden'].map(v=><button key={v} className={view===v?'selected':''} onClick={()=>setView(v)}>{v}</button>)}</div>
 <label className="field">Plan or visited date<KeyboardInput type="date" aria-label="Discovery date" value={date} onChange={e=>{if(safeDate(e.target.value))onDateChange(e.target.value)}}/></label>
 {view==='Discover'&&<><div className="view-tabs">{(['places','trails','events'] as const).map(k=><button className={kind===k?'selected':''} key={k} onClick={()=>setKind(k)}>{k[0].toUpperCase()+k.slice(1)}</button>)}</div><form onSubmit={e=>{e.preventDefault();discover()}}><div className="search"><MagnifyingGlassIcon/><KeyboardInput aria-label="Search places trails or events" placeholder={'Find '+kind+' in '+city} value={query} onChange={e=>setQuery(e.target.value)} onBlur={()=>keyboard.hide()}/></div><div className="trip-events-actions"><button className="primary" disabled={busy||saving||!canEdit}>{busy?'Searching…':'Search '+kind}</button><button type="button" className="text-btn" disabled={busy||!canEdit} onClick={()=>setImportOpen(v=>!v)}>Import link <ArrowRightIcon/></button></div></form>
 {importOpen&&<form className="trip-events-import" onSubmit={e=>{e.preventDefault();importLink()}}><label className="field">Place or event link<KeyboardInput type="url" aria-label="Event link" placeholder="https://…" value={url} onChange={e=>setUrl(e.target.value)}/></label><button className="subtle wide" disabled={busy||!url.trim()}>Read link and review <ArrowRightIcon/></button></form>}<p className="quiet">Search results are recommendations. Check opening hours, trail conditions and event times at the source.</p></>}
 {error&&<p role="alert" className="live-error">{error}</p>}
 {view==='Saved plan'?<div className="trip-ux-events"><h2>Saved events and places</h2>{days.length?days.map(day=><section key={day}><h3>{day}</h3>{filtered.filter(s=>stopDate(s)===day).map(stop=><button key={stop.id} className="agenda-row full" disabled={saving} onClick={()=>onEdit(stop)}><span className="time">{stop.time||'Not set'}</span><span className="event-name">{stop.title}<small>{stop.place||'Place not saved'} · {stop.duration} min</small>{overlaps.has(stop.id)&&<small className="trip-ux-overlap">Time overlap</small>}</span><ArrowRightIcon/></button>)}</section>):<p className="quiet">No activities in your plan yet. Add a discovery to get started.</p>}</div>:<section className="trip-events-found"><h2>{view==='History'?'Trip history':view==='Hidden'?'Hidden recommendations':'Recommendations'}</h2>
 <div className="place-grid">{cards.map(item=>{const planned=stops.find(s=>s.discoveryId===item.id||(s.sourceUrl&&discoveryKey(s.sourceUrl)===discoveryKey(item.url)));const domain=(()=>{try{return new URL(safeUrl(item.url)||'').hostname.replace(/^www\./,'')}catch{return ''}})();return <article className="place-card" key={item.id}>
  <a className="place-media-link" href={safeUrl(item.url)} target="_blank" rel="noopener noreferrer" aria-label={'Open '+item.title}>
   <PlaceMedia src={item.image} name={item.title}/>
   <span className="place-top"><span className="place-kind">{item.kind}</span>{item.sourceTitle?<span className="place-via">{item.sourceTitle}</span>:domain&&<span className="place-via">{domain}</span>}</span>
  </a>
  <div className="place-body">
   <h3>{item.title}</h3>
   {item.description&&<p>{item.description}</p>}
   <div className="place-meta"><span>{domain||item.kind}</span>{item.date&&<><span>·</span><span>{item.date}{item.time?' '+item.time:''}</span></>}{view==='History'&&item.visitedOn&&<><span>·</span><span>visited {item.visitedOn}</span></>}</div>
  </div>
  <div className="place-actions">
   {view==='Discover'&&<>{planned?<button className="pill-action" disabled={saving} onClick={()=>onEdit(planned)}>View in plan</button>:<button className="pill-action primary" disabled={!canEdit||saving||busy} onClick={()=>onAdd(draft(item))}>Add to a day <PlusIcon/></button>}<a className="pill-action" href={'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent((item.place||item.title)+', '+city)} target="_blank" rel="noopener noreferrer">Map</a><button className="icon-action" aria-label={'Dismiss '+item.title} disabled={!canEdit||saving||busy} onClick={()=>changeState(item,'dismissed')}>✕</button><button className="icon-action" aria-label={'Mark '+item.title+' visited'} disabled={!canEdit||saving||busy} onClick={()=>changeState(item,'visited')}>✓</button></>}
   {view!=='Discover'&&<button className="pill-action" disabled={!canEdit||saving||busy} onClick={()=>changeState(item,'recommended')}>{view==='History'?'Undo visited':'Restore'}</button>}
  </div>
 </article>})}</div>
 {view==='History'&&stops.filter(s=>s.visitedOn&&!cards.some(d=>d.id===s.discoveryId||discoveryKey(d.url)===discoveryKey(s.sourceUrl||''))).map(s=><button className="agenda-row full" key={s.id} onClick={()=>onEdit(s)}><span className="event-name">{s.title}<small>Visited {s.visitedOn} · {s.place}</small></span><ArrowRightIcon/></button>)}
 {!cards.length&&!(view==='History'&&stops.some(s=>s.visitedOn))&&<p className="quiet">{view==='History'?'Mark places or activities visited to keep them here.':view==='Hidden'?'Dismissed recommendations appear here. Restore them anytime.':'Search to discover places, trails and events. Saved and dismissed choices survive reloads.'}
  <div className="search-seeds">{[
    {label:'Hikes near me',kind:'trails',query:'hikes'},
    {label:'Good food nearby',kind:'places',query:'food'},
    {label:'Free things to do',kind:'places',query:'free things to do'},
    {label:'What is on this week',kind:'events',query:'events this week'},
  ].map(seed=><button key={seed.label} type="button" className="chip" disabled={busy||!canEdit} onClick={()=>{setQuery(seed.query);void discover(seed.query)}}>{seed.label}</button>)}</div>
  <p className="micro">Each tap runs one search. Results are cached for the trip, so revisiting is free.</p></p>}
 </section>}</>;
}
