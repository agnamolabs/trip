export const providers=['sonar','firecrawl','apify'] as const;
export const agents=['Chat','Guide','Research','Planning'] as const;
export type Provider=typeof providers[number];
export type Agent=typeof agents[number];
export type IntegrationGroup={
 id:string; name:string; allowedProviders:Provider[];
 providers:Partial<Record<Provider,{configured:boolean;source:'stored'|'server'|null;testedAt:string|null}>>;
 prompts:Partial<Record<Agent,string>>; members?:Record<string,Provider[]>;
 mediaProvider?:'firecrawl'|'apify'|'none'; apifyActor:string; apifyInputTemplate:string;
};
export type SettingsData={user:string;isAdmin:boolean;secureStorageReady:boolean;serverProviders:Record<Provider,boolean>;groups:IntegrationGroup[]};
// Session and optional request-only keys are deliberately never serialized.
export const credentials={token:'',groupId:'',user:'',keys:{sonar:'',firecrawl:'',apify:''}};
export async function apiRequest<T=Record<string,unknown>>(path:string,body?:unknown):Promise<T>{
 const requestToken=credentials.token;
 const headers:Record<string,string>={Authorization:'Bearer '+requestToken};
 if(body!==undefined)headers['Content-Type']='application/json';
 if((path.startsWith('/api/tools/')&&!path.startsWith('/api/tools/settings'))||['/api/app/discover','/api/app/import'].includes(path))for(const [provider,key]of Object.entries(credentials.keys))if(key)headers['x-trip-key-'+provider]=key;
 const response=await fetch(path,{method:body===undefined?'GET':'POST',headers,...(body===undefined?{}:{body:JSON.stringify(body)})});
 const result=await response.json().catch(()=>({error:'Trip’s API is unavailable on this host.'}));
 if(!response.ok||result?.error){if(response.status===401&&credentials.token===requestToken){credentials.token='';credentials.groupId='';if((globalThis as {__TRIP_PRODUCTION__?:boolean}).__TRIP_PRODUCTION__){sessionStorage.removeItem('tripToolSession');sessionStorage.removeItem('tripToolExpires');sessionStorage.removeItem('tripToolUser')};credentials.user='';credentials.keys={sonar:'',firecrawl:'',apify:''}}throw Object.assign(new Error(result?.error||'Request failed ('+response.status+').'),{status:response.status})}
 return result as T;
}
export async function signIn(user:string,password:string){
 const result=await apiRequest<{valid:boolean;token?:string;user?:string}>('/api/auth',{user,password});
 if(!result.valid||!result.token)throw Error('This host has not deployed the account integration backend.');
 credentials.token=result.token;credentials.groupId='';if((globalThis as {__TRIP_PRODUCTION__?:boolean}).__TRIP_PRODUCTION__){sessionStorage.setItem('tripToolSession',result.token);sessionStorage.setItem('tripToolExpires',String(Date.now()+3600000));sessionStorage.setItem('tripToolUser',user)};credentials.user=result.user||user;credentials.keys={sonar:'',firecrawl:'',apify:''};
}
export const loadSettings=()=>apiRequest<SettingsData>('/api/tools/settings');
