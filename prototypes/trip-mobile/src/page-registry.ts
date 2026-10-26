import {apiRequest} from './integration-api';
const definitions={
 Trip:{path:'/trip',bucket:'Trip',renderer:'trip'},
 Search:{path:'/search',bucket:'Search',renderer:'search'},
 Calendar:{path:'/calendar',bucket:'Calendar',renderer:'calendar'},
 Social:{path:'/social',bucket:'Social',renderer:'social'},
 You:{path:'/you',bucket:'You',renderer:'you'},
 Pack:{path:'/pack',bucket:'Trip',renderer:'packing'},
 Map:{path:'/map',bucket:'Trip',renderer:'map'},
 Weather:{path:'/weather',bucket:'Trip',renderer:'weather'},
 Notes:{path:'/notes',bucket:'Trip',renderer:'whitepages'},
 Travel:{path:'/travel',bucket:'Trip',renderer:'travel'},
} as const;
export type PageId=keyof typeof definitions;
export type RegistryPage={id:PageId;path:string;label:string;bucket:PageId;icon:string;renderer:string;nav:boolean;sort:number};
const legacyPaths:Record<string,PageId>={'/':'Trip','/planner':'Trip','/events':'Search','/posts':'Social','/packing':'Pack','/whitepages':'Notes'};
export function idForPath(path:string):PageId|undefined{if(legacyPaths[path])return legacyPaths[path];return (Object.entries(definitions).find(([,value])=>value.path===path)?.[0]) as PageId|undefined}
export async function loadPageRegistry():Promise<RegistryPage[]>{
 const result=await apiRequest<{storage:string;pages:unknown[]}>('/api/app/registry');
 if(result.storage!=='d1'||!Array.isArray(result.pages))throw Error('The page registry is unavailable. Refresh to retry.');
 const seen=new Set<string>();const pages:RegistryPage[]=[];
 for(const entry of result.pages){if(!entry||typeof entry!=='object')continue;const page=entry as Record<string,unknown>,id=Object.keys(definitions).find(id=>id.toLowerCase()===String(page.id).toLowerCase()) as PageId|undefined;if(!id||seen.has(id))continue;const expected=definitions[id];if(page.path!==expected.path||page.renderer!==expected.renderer||String(page.bucket).toLowerCase()!==expected.bucket.toLowerCase())continue;const navValue=page.nav??page.primaryNav??page.primary;const nav=['Trip','Search','Calendar','Social','You'].includes(id)&&(navValue===true||navValue==='primary'||navValue==='main'||navValue===1);pages.push({id,path:expected.path,label:typeof (page.label??page.name)==='string'&&String(page.label??page.name).trim()?String(page.label??page.name).trim().slice(0,40):id,bucket:expected.bucket,renderer:expected.renderer,icon:typeof page.icon==='string'?page.icon:'',nav,sort:Number.isFinite(Number(page.sort??page.order))?Number(page.sort??page.order):0});seen.add(id)}
 if(Object.keys(definitions).some(id=>!seen.has(id))||pages.filter(p=>p.nav).length!==5)throw Error('The page registry is incomplete. Refresh to retry.');
 return pages.sort((a,b)=>a.sort-b.sort);
}
