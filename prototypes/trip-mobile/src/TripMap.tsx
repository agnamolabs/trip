import {useEffect,useRef,useState} from 'react';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './trip-map.css';
import {ArrowLeftIcon,ArrowRightIcon,ChevronRightIcon} from '@radix-ui/react-icons';
import {apiRequest,credentials} from './integration-api';
import {directionsUrl,type LiveStop} from './live-trip';
type Place={id:string;title:string;place:string;time:string;lat?:number;lon?:number};
type MapData={destination?:{lat:number;lon:number;label:string};places:Place[];provider:string};
const validPoint=(point:{lat?:number;lon?:number}|undefined):point is {lat:number;lon:number}=>!!point&&Number.isFinite(point.lat)&&Number.isFinite(point.lon)&&Math.abs(point.lat!)<=90&&Math.abs(point.lon!)<=180;
export default function TripMap({tripId,date,city,stops,onBack,onOpenActivity,onAuthRequired}:{tripId:string;date:string;city:string;stops:LiveStop[];onBack:()=>void;onOpenActivity:(id:string)=>void;onAuthRequired:()=>void}){
 const [data,setData]=useState<MapData|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[selected,setSelected]=useState(''),[version,setVersion]=useState(0),[tileAttempt,setTileAttempt]=useState(0),[tileError,setTileError]=useState(''),[tilesLoading,setTilesLoading]=useState(false);
 const containerRef=useRef<HTMLDivElement>(null),mapRef=useRef<L.Map|null>(null),markersRef=useRef(new Map<string,L.CircleMarker>());
 useEffect(()=>{let active=true;const token=credentials.token;setBusy(true);setError('');setData(null);setSelected('');apiRequest<MapData>('/api/app/map?tripId='+encodeURIComponent(tripId)+'&date='+encodeURIComponent(date)).then(result=>{if(active&&credentials.token===token)setData(result)}).catch(e=>{if(active){setError((e as Error).message);if(!credentials.token)onAuthRequired()}}).finally(()=>{if(active)setBusy(false)});return()=>{active=false}},[tripId,date,version]);
 const places:Place[]=data?.places||stops.map(s=>({id:s.id,title:s.title,place:s.place,time:s.time}));
 const place=places.find(p=>p.id===selected),destination=validPoint(data?.destination)?data.destination:null;
 const confirmedPlace=validPoint(place)?place:null,point=confirmedPlace||destination;
 useEffect(()=>{
  const element=containerRef.current;if(!element||!data||!destination)return;
  let active=true,map:L.Map|null=null,timer:ReturnType<typeof setTimeout>|undefined,observer:ResizeObserver|undefined;
  let loaded=0,failed=0;setTileError('');setTilesLoading(true);markersRef.current.clear();
  const textNode=(value:string)=>{const node=document.createElement('span');node.textContent=value;return node};
  try{
   map=L.map(element,{zoomControl:true,scrollWheelZoom:true,touchZoom:true,dragging:true,preferCanvas:true}).setView([destination.lat,destination.lon],13);mapRef.current=map;
   const tiles=L.tileLayer('https://tile.openstreetmap.de/{z}/{x}/{y}.png',{maxZoom:18,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors · <a href="https://openstreetmap.de/nutzen/dienste-osm-de/" target="_blank" rel="noopener noreferrer">OSM Deutschland</a>'});
   const waitForTiles=()=>{if(timer)clearTimeout(timer);timer=setTimeout(()=>{if(active&&loaded===0){setTilesLoading(false);setTileError('Map tiles are taking too long to load. Retry or open directions in Maps.')}},15000)};
   tiles.on('loading',()=>{loaded=0;failed=0;if(active)setTilesLoading(true);waitForTiles()});
   tiles.on('tileload',()=>{loaded++;if(timer)clearTimeout(timer);if(active){setTilesLoading(false);setTileError('')}});
   tiles.on('tileerror',()=>{failed++});
   tiles.on('load',()=>{if(timer)clearTimeout(timer);if(!active)return;setTilesLoading(false);if(loaded===0&&failed>=2)setTileError('Map tiles could not load. Retry or open directions in Maps.')});
   tiles.addTo(map);waitForTiles();
   const destinationMarker=L.circleMarker([destination.lat,destination.lon],{radius:9,color:'#fff',weight:3,fillColor:'#174d4c',fillOpacity:1}).addTo(map).bindTooltip(textNode(data.destination?.label||city));markersRef.current.set('destination',destinationMarker);
   for(const stop of data.places||[]){if(!validPoint(stop))continue;const marker=L.circleMarker([stop.lat,stop.lon],{radius:7,color:'#fff',weight:2,fillColor:'#b83b20',fillOpacity:1}).addTo(map).bindTooltip(textNode(stop.title));marker.on('click',()=>setSelected(stop.id));markersRef.current.set(stop.id,marker)}
   const resize=()=>{if(active)map?.invalidateSize({animate:false})};
   if(typeof ResizeObserver!=='undefined'){observer=new ResizeObserver(resize);observer.observe(element)}
   queueMicrotask(resize);
  }catch{if(active){setTilesLoading(false);setTileError('The map could not start. Retry or open directions in Maps.')}}
  return()=>{active=false;if(timer)clearTimeout(timer);observer?.disconnect();markersRef.current.clear();if(map){map.remove();if(mapRef.current===map)mapRef.current=null}};
 },[data,tileAttempt]);
 useEffect(()=>{const map=mapRef.current;if(!map||!point)return;map.setView([point.lat,point.lon],confirmedPlace?Math.max(14,map.getZoom()):map.getZoom(),{animate:false});for(const [id,marker]of markersRef.current)marker.setStyle({radius:id===selected?10:id==='destination'?9:7,weight:id===selected?3:2})},[selected,data,tileAttempt]);
 const searchUrl=(p:Place)=>'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent([p.place||p.title,city].filter(Boolean).join(', '));
 return <><div className="section-title"><button className="text-btn" onClick={onBack}><ArrowLeftIcon/> Travel</button><span className="eyebrow">MAP</span></div><div className="page-title"><h1>{city}.</h1><button className="text-btn" disabled={busy} onClick={()=>setVersion(v=>v+1)}>Refresh</button></div><p className="quiet trip-map-summary">Your saved destination and {places.length} stop{places.length===1?'':'s'} for {date}.</p>
 {busy&&<p role="status" className="quiet">Loading destination map…</p>}{error&&<p role="alert" className="live-error">{error}</p>}
 {destination?<><div className="trip-map-frame" ref={containerRef} role="region" aria-label={confirmedPlace?place!.title:city+' destination map'}/><p className="micro">{confirmedPlace?place!.title:data?.destination?.label||city} · OpenStreetMap</p>{tilesLoading&&!tileError&&<p className="quiet" role="status">Loading map tiles…</p>}{tileError&&<div className="live-error"><p role="alert">{tileError}</p><button className="subtle" onClick={()=>setTileAttempt(value=>value+1)}>Retry map</button></div>}</>:!busy&&<p className="quiet">No confirmed coordinates are available. Saved places can still open in Maps.</p>}
 {place&&!confirmedPlace&&<p className="quiet">This stop has no saved coordinates. The map shows the destination.</p>}
 <a className="primary wide trip-map-route" href={directionsUrl(stops,city)} target="_blank" rel="noopener noreferrer">Open day route in Maps <ArrowRightIcon/></a>
 <section className="trip-map-stops"><h2>Saved stops</h2>{places.length?places.map(p=><div className={'trip-map-stop '+(selected===p.id?'selected':'')} key={p.id}><button className="trip-map-place" onClick={()=>setSelected(p.id)} aria-pressed={selected===p.id}><span className="time">{p.time||'Not set'}</span><span><b>{p.title}</b><small>{p.place||'Place not saved'}</small></span><ChevronRightIcon/></button><div className="trip-map-stop-actions"><a href={searchUrl(p)} target="_blank" rel="noopener noreferrer">Directions</a><button onClick={()=>onOpenActivity(p.id)}>View activity</button></div></div>):<p className="quiet">Save an activity to see its place here.</p>}</section></>;
}
