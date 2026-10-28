import type {LiveStop} from './live-trip';
export type DiscoveryKind='places'|'trails'|'events';
export type Discovery={id:string;title:string;description?:string;url:string;image?:string;sourceTitle?:string;kind:DiscoveryKind;state:'recommended'|'dismissed'|'visited';visitedOn?:string;date?:string;time?:string;place?:string;lat?:number;lon?:number};
export const validDate=(v:string)=>/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v+'T12:00:00Z'))&&new Date(v+'T12:00:00Z').toISOString().slice(0,10)===v;
const minutes=(s:string)=>/^([01]\d|2[0-3]):[0-5]\d$/.test(s)?Number(s.slice(0,2))*60+Number(s.slice(3)):NaN;
export function fitIntoDay(stops:LiveStop[],date:string,duration:number,stopDate:(s:LiveStop)=>string,earliest='09:00',latest='20:00',buffer=15):{time:string;error?:never}|{time?:never;error:string}{
 const start=minutes(earliest),end=minutes(latest);
 if(!validDate(date)||!Number.isSafeInteger(duration)||duration<1||duration>1440||!Number.isFinite(start)||!Number.isFinite(end)||end<=start||buffer<0)return {error:'Choose a valid date, duration and time window.'};
 const day=stops.filter(s=>stopDate(s)===date);
 if(day.some(s=>!Number.isFinite(minutes(s.time))||!Number.isFinite(s.duration)||s.duration<1))return {error:'Set times and durations for the unscheduled activities on this day before fitting another.'};
 const busy=day.map(s=>({start:minutes(s.time)-buffer,end:minutes(s.time)+s.duration+buffer})).sort((a,b)=>a.start-b.start);
 let candidate=start;
 for(const slot of busy){if(candidate+duration<=slot.start)break;if(candidate<slot.end)candidate=slot.end;}
 if(candidate+duration>end)return {error:'No free slot in this window. Try another day or a shorter visit.'};
 return {time:String(Math.floor(candidate/60)).padStart(2,'0')+':'+String(candidate%60).padStart(2,'0')};
}
export function discoveryKey(url:string){try{const u=new URL(url);u.hash='';for(const key of [...u.searchParams.keys()])if(/^utm_|^(fbclid|gclid)$/i.test(key))u.searchParams.delete(key);u.searchParams.sort();return u.href.replace(/\/$/,'')}catch{return url}}
export function mergeDiscoveries(saved:Discovery[],incoming:Discovery[]){const records=new Map(saved.map(d=>[discoveryKey(d.url),d]));for(const d of incoming)if(!records.has(discoveryKey(d.url)))records.set(discoveryKey(d.url),d);return [...records.values()]}
