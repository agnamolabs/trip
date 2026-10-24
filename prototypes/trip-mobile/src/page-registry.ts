import {apiRequest} from './integration-api';
const definitions={Travel:{path:'/travel',bucket:'Travel',renderer:'travel'},Planner:{path:'/planner',bucket:'Planner',renderer:'planner'},Packing:{path:'/packing',bucket:'Packing',renderer:'packing'},Weather:{path:'/weather',bucket:'Weather',renderer:'weather'},Whitepages:{path:'/whitepages',bucket:'Whitepages',renderer:'whitepages'},Map:{path:'/map',bucket:'Travel',renderer:'map'},Events:{path:'/events',bucket:'Planner',renderer:'events'}} as const;
export type PageId=keyof typeof definitions;
export type RegistryPage={id:PageId;path:string;label:string;bucket:PageId;icon:string;renderer:string;nav:boolean;sort:number};
export function idForPath(path:string):PageId|undefined{if(path==='/')return 'Planner';return (Object.entries(definitions).find(([,value])=>value.path===path)?.[0]) as PageId|undefined}
export async function loadPageRegistry():Promise<RegistryPage[]>{
 const result=await apiRequest<{storage:string;pages:unknown[]}>('/api/app/registry');
 if(result.storage!=='d1'||!Array.isArray(result.pages))throw Error('The page registry is unavailable. Refresh to retry.');
 const seen=new Set<string>();const pages:RegistryPage[]=[];
 for(const entry of result.pages){if(!entry||typeof entry!=='object')continue;const page=entry as Record<string,unknown>,id=Object.keys(definitions).find(id=>id.toLowerCase()===String(page.id).toLowerCase()) as PageId|undefined;if(!id||seen.has(id))continue;const expected=definitions[id];if(page.path!==expected.path||page.renderer!==expected.renderer||String(page.bucket).toLowerCase()!==expected.bucket.toLowerCase())continue;const navValue=page.nav??page.primaryNav??page.primary;const nav=['Travel','Planner','Packing','Weather','Whitepages'].includes(id)&&(navValue===true||navValue==='primary'||navValue==='main'||navValue===1);pages.push({id,path:expected.path,label:typeof (page.label??page.name)==='string'&&String(page.label??page.name).trim()?String(page.label??page.name).trim().slice(0,40):id,bucket:expected.bucket,renderer:expected.renderer,icon:typeof page.icon==='string'?page.icon:'',nav,sort:Number.isFinite(Number(page.sort??page.order))?Number(page.sort??page.order):0});seen.add(id)}
 if(Object.keys(definitions).some(id=>!seen.has(id))||pages.filter(p=>p.nav).length!==5)throw Error('The page registry is incomplete. Refresh to retry.');
 return pages.sort((a,b)=>a.sort-b.sort);
}
