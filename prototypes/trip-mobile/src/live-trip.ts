import {apiRequest,credentials} from './integration-api';
export const isProduction=()=>(globalThis as typeof globalThis&{__TRIP_PRODUCTION__?:boolean}).__TRIP_PRODUCTION__===true;
export type LiveStop={id:string;title:string;time:string;duration:number;place:string;day:number;date?:string;fixed?:boolean};
export type LiveItem={id:string;name:string;qty:number;packed:Record<string,number>;shared?:boolean;owner?:string};
export type LivePage={id:string;title:string;text:string};
export type LiveBooking={id:string;route:string;flight:string;date:string;time:string;image:string;bookingRef?:string};
export type LiveClothing={id:string;src:string;name:string;owner?:string};
export type TripUi={stops:LiveStop[];items:LiveItem[];pages:LivePage[];bookings:LiveBooking[];clothes:LiveClothing[];members:{name:string;role:string}[]};
export type LegacyTrip=Record<string,unknown>&{id:string;city?:string;depart?:string;return_date?:string;created_by?:string;ui?:Partial<TripUi>};
export type LiveWeather={daily?:{time:string[];temperature_2m_max:number[];temperature_2m_min:number[];precipitation_probability_max?:number[]};current?:{temperature_2m?:number}};
export const emptyTripUi=():TripUi=>({stops:[],items:[],pages:[],bookings:[],clothes:[],members:[]});
const text=(value:unknown)=>typeof value==='string'?value:'';
export function tripOwner(trip:LegacyTrip){return text(trip.created_by)||text(trip.createdBy)}
export function readTripUi(trip:LegacyTrip,user:string):TripUi{
 const owner=tripOwner(trip),ui=trip.ui||{},legacy=trip.items&&typeof trip.items==='object'&&!Array.isArray(trip.items)?trip.items as Record<string,Record<string,unknown>>:{};
 const items:Array<LiveItem>=Array.isArray(ui.items)?ui.items:Object.entries(legacy).map(([id,item])=>({id,name:text(item.label)||text(item.name)||'Packing item',qty:Math.max(1,Number(item.qty)||1),packed:typeof item.packed==='object'&&item.packed?item.packed as Record<string,number>:{[owner]:Math.max(0,Number(item.packed)||(item.checked?Number(item.qty)||1:0))},shared:item.shared===true,owner:text(item.owner)||owner}));
 const bookings=Array.isArray(ui.bookings)?ui.bookings:(trip.flight_num||trip.flightNum||trip.airline)?[{id:'legacy-flight-'+trip.id,route:text(trip.city),flight:[text(trip.airline),text(trip.flight_num)||text(trip.flightNum)].filter(Boolean).join(' '),date:text(trip.depart),time:text(trip.flight_time)||text(trip.flightTime),image:'',bookingRef:text(trip.booking_ref)||text(trip.bookingRef)}]:[];
 const rawClothes=Array.isArray(ui.clothes)?ui.clothes:Array.isArray(trip.closet)?trip.closet:[];
 const clothes:LiveClothing[]=rawClothes.flatMap((entry,index)=>{if(!entry||typeof entry!=='object')return [];const photo=entry as Record<string,unknown>;const src=text(photo.src)||text(photo.image)||text(photo.url)||text(photo.dataUrl);if(!src||!(/^(https?:\/\/|data:image\/(?:png|jpe?g|webp|gif|avif);base64,)/i.test(src)))return [];return [{id:text(photo.id)||'legacy-photo-'+index,src,name:text(photo.name)||text(photo.label)||'Clothing photo '+(index+1),owner:text(photo.owner)||owner}]}).filter(c=>c.owner===user);
 const names=new Set<string>();const members:{name:string;role:string}[]=[];
 if(owner){names.add(owner);members.push({name:owner,role:'Owner'})}
 const shared=Array.isArray(trip.shared_with)?trip.shared_with:Array.isArray(trip.sharedWith)?trip.sharedWith:[];
 const rawMembers=Array.isArray(trip.members)?trip.members:Array.isArray(ui.members)?ui.members:[];
 for(const entry of [...shared,...rawMembers]){const name=typeof entry==='string'?entry:entry&&typeof entry==='object'?text((entry as Record<string,unknown>).name)||text((entry as Record<string,unknown>).user):'';if(name&&!names.has(name)){names.add(name);members.push({name,role:entry&&typeof entry==='object'?text((entry as Record<string,unknown>).role)||'Viewer':'Viewer'})}else if(name&&name!==owner&&entry&&typeof entry==='object'&&text((entry as Record<string,unknown>).role)){const member=members.find(m=>m.name===name);if(member)member.role=text((entry as Record<string,unknown>).role)}}
 return {stops:Array.isArray(ui.stops)?ui.stops:[],items:items.map(i=>({...i,owner:i.owner||owner,packed:i.packed&&typeof i.packed==='object'?i.packed:{}})).filter(i=>i.shared||i.owner===user),pages:Array.isArray(ui.pages)?ui.pages:[],bookings,clothes,members};
}
export const getTrips=()=>apiRequest<{user:string;trips:LegacyTrip[]}>('/api/app/trips');
export async function saveTripUi(trip:LegacyTrip,ui:TripUi){const result=await apiRequest<{trip:LegacyTrip}>('/api/app/trips',{trip:{...trip,ui:{...trip.ui,...ui}}});if(!result.trip?.id)throw Error('Trip save did not return a saved record.');return result.trip}
export async function createTrip(city:string,depart:string,returnDate:string){const trip={id:crypto.randomUUID(),city,depart,return_date:returnDate,created_by:credentials.user,items:{},ui:emptyTripUi()};const result=await apiRequest<{trip:LegacyTrip}>('/api/app/trips',{trip});if(!result.trip?.id)throw Error('Trip creation did not return a saved record.');return result.trip}
export function tripDates(trip:LegacyTrip){const dates:string[]=[];const start=Date.parse(text(trip.depart)+'T12:00:00Z'),end=Date.parse(text(trip.return_date||trip.return)+'T12:00:00Z');if(!Number.isFinite(start))return [];for(let time=start;time<=(Number.isFinite(end)?Math.max(start,end):start)&&dates.length<90;time+=86400000)dates.push(new Date(time).toISOString().slice(0,10));return dates}
export function directionsUrl(stops:LiveStop[],city:string){const places=stops.map(s=>[s.place||s.title,city].filter(Boolean).join(', ')).filter(Boolean);const url=new URL('https://www.google.com/maps/dir/');url.searchParams.set('api','1');if(places.length>1)url.searchParams.set('origin',places[0]);url.searchParams.set('destination',places[places.length-1]||city);if(places.length>2)url.searchParams.set('waypoints',places.slice(1,-1).join('|'));return url.href}
