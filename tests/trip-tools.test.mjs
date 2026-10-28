import test from 'node:test';
import assert from 'node:assert/strict';
import {handleTripTools,issueSession} from '../trip-tools.mjs';
const memory=new Map();
const env={TRIP_ADMIN_USERS:'account-a',TRIPS_KV:{get:async k=>memory.get(k),put:async(k,v)=>memory.set(k,v)},PPLX_KEY:'server-sonar',FIRECRAWL_API_KEY:'server-firecrawl',APIFY_TOKEN:'server-apify',APIFY_ACTOR_ID:'owner/actor',APIFY_INPUT_TEMPLATE:'{"search":"{{query}}"}'};
let token=await issueSession(env,'account-a');
const req=(path,body={},headers={})=>new Request('https://trip.example/api/tools/'+path,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
const read=async r=>({status:r.status,body:await r.json()});
test('unrelated routes are delegated',async()=>assert.equal(await handleTripTools(new Request('https://trip.example/'),env),null));
test('no provider calls before authentication',async()=>{
 let called=false;const r=await handleTripTools(new Request('https://trip.example/api/tools/chat',{method:'POST'}),env,async()=>{called=true});assert.equal(r.status,401);assert.equal(called,false);
});
test('expired sessions cannot call providers',async()=>{
 const r=await handleTripTools(req('chat',{query:'hello'},{Authorization:'Bearer expired'}),{...env,TRIPS_KV:{get:async()=>JSON.stringify({expires:1})}});assert.equal(r.status,401);
});
test('cross-origin calls are blocked',async()=>assert.equal((await handleTripTools(req('chat',{query:'hello'},{Origin:'https://evil.example'}),env)).status,403));
test('Sonar BYOK overrides server key and strips unsafe citations',async()=>{
 let auth,payload;const r=await read(await handleTripTools(req('chat',{query:'Where next?',context:'Trip',agent:'Guide'},{'x-trip-key-sonar':'user-key'}),env,async(url,opts)=>{assert.equal(url,'https://api.perplexity.ai/v1/sonar');auth=opts.headers.Authorization;payload=JSON.parse(opts.body);return Response.json({choices:[{message:{content:'Check the museum opening hours.'}}],citations:['https://museum.example/hours','javascript:alert(1)']})}));assert.equal(auth,'Bearer user-key');assert.equal(payload.model,'sonar');assert.equal(r.body.agent,'Guide');assert.equal(r.body.citations.length,1);assert.equal(env.PPLX_KEY,'server-sonar');
});
test('BYOK credentials do not leak into later requests or storage',async()=>{
 let auth;await handleTripTools(req('chat',{query:'Next question'}),env,async(url,o)=>{auth=o.headers.Authorization;return Response.json({choices:[{message:{content:'Answer'}}]})});assert.equal(auth,'Bearer server-sonar');assert.ok([...memory.values()].every(v=>!v.includes('user-key')));
});
test('missing provider key is explicit and does not contact provider',async()=>{
 let calls=0;const r=await read(await handleTripTools(req('chat',{query:'hello'}),{TRIP_ADMIN_USERS:'account-a',TRIPS_KV:env.TRIPS_KV},async()=>{calls++}));assert.equal(r.status,503);assert.match(r.body.error,/key not configured|key not configured or approved/);assert.equal(calls,0);
});
test('upstream errors never expose returned secrets or fake success',async()=>{
 const r=await read(await handleTripTools(req('chat',{query:'hello'}),env,async()=>new Response('SECRET_KEY',{status:401})));assert.equal(r.status,502);assert.equal(JSON.stringify(r.body).includes('SECRET_KEY'),false);assert.ok(!r.body.answer);
});
test('Firecrawl parses real grouped web results',async()=>{
 const r=await read(await handleTripTools(req('research',{provider:'firecrawl',query:'museum hours'}),env,async(url,opts)=>{assert.equal(url,'https://api.firecrawl.dev/v2/search');assert.equal(opts.headers.Authorization,'Bearer server-firecrawl');return Response.json({success:true,data:{web:[{title:'Museum',url:'https://museum.example',description:'Hours'},{url:'data:text/html,bad'}]}})}));assert.equal(r.body.results.length,1);assert.ok(r.body.retrievedAt);
});
test('Apify server credential only runs the configured Actor and template',async()=>{
 let url,body;const r=await read(await handleTripTools(req('research',{provider:'apify',query:'a "quoted" place',actor:'attacker/actor',input:{overwrite:true}}),env,async(u,o)=>{url=u;body=JSON.parse(o.body);return Response.json([{title:'Place'}])}));assert.match(url,/owner~actor/);assert.match(url,/maxItems=20/);assert.match(url,/maxTotalChargeUsd=1/);assert.deepEqual(body,{search:'a "quoted" place'});assert.equal(r.body.results.length,1);
});
test('Apify BYOK uses explicitly supplied Actor input',async()=>{
 let payload;await handleTripTools(req('research',{provider:'apify',query:'Find places',actor:'my/actor',input:{term:'museum'}},{'x-trip-key-apify':'user-apify'}),env,async(url,o)=>{assert.match(url,/my~actor/);assert.equal(o.headers.Authorization,'Bearer user-apify');payload=JSON.parse(o.body);return Response.json([])});assert.deepEqual(payload,{term:'museum'});
});
test('three agents make three real calls; research failure remains visible',async()=>{
 let calls=0;const r=await read(await handleTripTools(req('agents',{query:'Review my day'}),{...env,FIRECRAWL_API_KEY:''},async()=>{calls++;return Response.json({choices:[{message:{content:'Review the planned order.'}}]})}));assert.equal(calls,3);assert.equal(r.body.agents.length,3);assert.match(r.body.researchError,/key not configured|key not configured or approved/);
});
test('malformed and oversized input is rejected before provider requests',async()=>{
 assert.equal((await handleTripTools(req('chat',{query:'x'.repeat(2001)}),env)).status,400);assert.equal((await handleTripTools(req('chat',{query:'x',context:'x'.repeat(25000)}),env)).status,413);
});
test('invalid provider response does not become a canned answer',async()=>{
 const r=await read(await handleTripTools(req('chat',{query:'hello'}),env,async()=>Response.json({choices:null})));assert.equal(r.status,502);assert.ok(!r.body.answer);
});

test('a rejected provider key reads as an actionable message, not a raw status',async()=>{
 const r=await read(await handleTripTools(req('chat',{query:'hello'}),env,async()=>new Response('SECRET_KEY',{status:401})));
 assert.equal(r.status,502);
 assert.match(r.body.error,/Perplexity Sonar rejected this API key/);
 assert.match(r.body.error,/Settings/);
 assert.equal(/HTTP 401/.test(r.body.error),false);
 assert.equal(JSON.stringify(r.body).includes('SECRET_KEY'),false);
});
test('a rate-limited provider is named without echoing the upstream body',async()=>{
 const r=await read(await handleTripTools(req('research',{provider:'firecrawl',query:'museum hours'}),env,async()=>new Response('slow down',{status:429})));
 assert.equal(r.status,502);
 assert.match(r.body.error,/Firecrawl is rate limiting requests/);
 assert.equal(/slow down/.test(r.body.error),false);
});
