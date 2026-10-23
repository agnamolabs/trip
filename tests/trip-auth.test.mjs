import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../_worker.js';
const makeEnv=()=>{
 const values=new Map();
 return {values,TRIP_AUTH_USERS:JSON.stringify({Owner:'test-only-owner-password',Member:'test-only-member-password'}),TRIP_ADMIN_USERS:'Owner',TRIPS_KV:{get:async key=>values.get(key),put:async(key,value,options)=>{values.set(key,value);values.set(key+':ttl',options?.expirationTtl)}}};
};
const auth=(user='Owner',password='test-only-owner-password')=>new Request('https://trip.example/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({user,password})});
test('valid login creates an expiring opaque session without saving the password',async()=>{
 const env=makeEnv();const r=await worker.fetch(auth(),env);assert.equal(r.status,200);const data=await r.json();assert.equal(data.valid,true);assert.equal(data.user,'Owner');assert.ok(data.token.length>=64);assert.ok(!JSON.stringify(data).includes('test-only-owner-password'));
 const session=JSON.parse(env.values.get('tool-session:'+data.token));assert.equal(session.user,'Owner');assert.ok(session.expires>Date.now());assert.equal(env.values.get('tool-session:'+data.token+':ttl'),3600);assert.ok([...env.values.values()].every(value=>!String(value).includes('test-only-owner-password')));
});
test('incorrect or unknown login cannot mint sessions',async()=>{
 for(const [user,password]of [['Owner','wrong'],['Unlisted','test-only-owner-password']]){
 const env=makeEnv();const r=await worker.fetch(auth(user,password),env);assert.equal(r.status,401);assert.equal(env.values.size,0);
 }
});
test('unknown account is rejected when legacy migration fallback is active',async()=>{
 const env=makeEnv();delete env.TRIP_AUTH_USERS;const r=await worker.fetch(auth(),env);assert.equal(r.status,401);assert.equal((await r.json()).valid,false);
});
test('invalid account configuration is a server failure, not invalid credentials',async()=>{
 const env=makeEnv();env.TRIP_AUTH_USERS='{invalid';const r=await worker.fetch(auth(),env);assert.equal(r.status,503);
});
test('missing session storage cannot report a successful login',async()=>{
 const env=makeEnv();delete env.TRIPS_KV;const r=await worker.fetch(auth(),env);assert.equal(r.status,503);assert.equal((await r.json()).valid,false);
});
test('malformed login input returns a controlled client error',async()=>{
 const env=makeEnv();const r=await worker.fetch(new Request('https://trip.example/api/auth',{method:'POST',body:'{bad'}),env);assert.equal(r.status,400);
});
test('settings storage rejection is returned as JSON instead of escaping the handler',async()=>{
 const env=makeEnv();const login=await (await worker.fetch(auth(),env)).json();
 const get=env.TRIPS_KV.get;env.TRIPS_KV.get=async key=>{if(key==='trip:integration-settings:v1')throw Error('Storage unavailable');return get(key)};
 const r=await worker.fetch(new Request('https://trip.example/api/tools/settings',{headers:{Authorization:'Bearer '+login.token}}),env);assert.equal(r.status,500);assert.ok((await r.json()).error);
});
test('legacy provider routes cannot bypass shared-key authorization',async()=>{
 const oldFetch=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;return Response.json({choices:[{message:{content:'test-only'}}]})};
 try{
  for(const path of ['/api/chat','/api/agents/run','/api/flights/search','/api/flights/track','/api/scan-trip','/api/suggest-packing']){
   const env=makeEnv();env.PPLX_KEY='test-only-key';
   const r=await worker.fetch(new Request('https://trip.example'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query:'Test',messages:[{role:'user',content:'test'}],from:'SAN',to:'HNL',date:'2026-10-24',airline:'HA',flightNumber:'15',destination:'Honolulu'})}),env);
   assert.equal(r.status,401,path+' must require a session before using server credentials');
  }
  assert.equal(calls,0);
 }finally{globalThis.fetch=oldFetch}
});

test('ordinary authenticated users cannot spend server keys through legacy routes',async()=>{
 const env=makeEnv();const login=await (await worker.fetch(auth('Member','test-only-member-password'),env)).json();
 const r=await worker.fetch(new Request('https://trip.example/api/chat',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+login.token},body:JSON.stringify({messages:[{role:'user',content:'test'}]})}),env);assert.equal(r.status,403);
});

test('legacy verifier compatibility works without new account configuration',async()=>{
 const {authenticateTrip}=await import('../trip-auth.mjs');
 const user='LegacyTestAccount',password='legacy-test-only';
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('trip-legacy:'+user+':'+password));
 const hash=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
 const verifiers={[user]:hash};
 assert.equal(await authenticateTrip({},user,password,verifiers),true);
 assert.equal(await authenticateTrip({},user,'wrong',verifiers),false);
 assert.equal(await authenticateTrip({TRIP_AUTH_USERS:JSON.stringify({[user]:'new-test-only'})},user,password,verifiers),false);
});
