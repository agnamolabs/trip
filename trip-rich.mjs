// Provider metadata only: never fetch arbitrary preview URLs or render provider HTML.
export function safePublicUrl(value){
 if(typeof value!=='string'||value.length>4096)return null;
 try{const u=new URL(value);const host=u.hostname.toLowerCase().replace(/^\[|\]$/g,'');
  if(u.protocol!=='https:'||u.username||u.password||!host.includes('.')||host.endsWith('.local')||host.endsWith('.localhost')||host.endsWith('.internal')||host==='localhost'||host==='metadata.google.internal'||host.includes(':'))return null;
  if(/^\d+\.\d+\.\d+\.\d+$/.test(host)){const a=host.split('.').map(Number);if(a[0]===0||a[0]===10||a[0]===127||a[0]>=224||a[0]===169&&a[1]===254||a[0]===172&&a[1]>=16&&a[1]<=31||a[0]===192&&a[1]===168||a[0]===100&&a[1]>=64&&a[1]<=127)return null}
  return u.href;
 }catch{return null}
}
const text=(v,n)=>typeof v==='string'?v.trim().slice(0,n):'';
export function normalizeSources(rows,limit=6){const seen=new Set();return (Array.isArray(rows)?rows:[]).flatMap(r=>{if(typeof r==='string')r={url:r};if(!r||typeof r!=='object')return[];const url=safePublicUrl(r.url||r.link);if(!url||seen.has(url))return[];seen.add(url);return[{title:text(r.title||r.name,160)||new URL(url).hostname,url,description:text(r.description||r.snippet,300)}]}).slice(0,limit)}
export function normalizeImages(rows,limit=6){const seen=new Set();return(Array.isArray(rows)?rows:[]).flatMap(r=>{if(!r||typeof r!=='object')return[];const url=safePublicUrl(r.imageUrl||r.image_url||r.original||r.image?.url||r.image||r.url);const sourceUrl=safePublicUrl(r.sourceUrl||r.origin_url||r.original_url||r.pageUrl||r.link||r.source?.url||((r.imageUrl||r.image_url||r.original)?r.url:null));if(!url||!sourceUrl||seen.has(url))return[];seen.add(url);return[{url,sourceUrl,title:text(r.title||r.alt||r.name,160)||'Image result'}]}).slice(0,limit)}
export function summarizeResults(rows){return(Array.isArray(rows)?rows:[]).slice(0,20).flatMap(r=>{if(!r||typeof r!=='object')return[];const url=safePublicUrl(r.url||r.link||r.website);const title=text(r.title||r.name,160);const description=text(r.description||r.snippet||r.text||r.address,300);const image=safePublicUrl(r.imageUrl||r.image_url||r.thumbnailUrl||r.thumbnail||r.image?.url||r.image);if(!url&&!title&&!description)return[];return[{title:title||(url?new URL(url).hostname:'Result'),...(url?{url}:{}),description,...(image&&url?{image}:{})}]})}
