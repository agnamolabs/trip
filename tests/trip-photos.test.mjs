import test from 'node:test';
import assert from 'node:assert/strict';
import {handlePhotoTools} from '../trip-photos.mjs';
import {issueSession} from '../trip-tools.mjs';

const JPEG='data:image/jpeg;base64,'+Buffer.from('x'.repeat(600)).toString('base64');
const memory=new Map();
function makeEnv(){
 const runs=[];
 const ai={runs,run:async(model,payload)=>{
  runs.push({model,payload});
  if(String(payload.messages[0].content).includes('draft Instagram posts'))return {choices:[{message:{content:'{"summary":"Golden hour roll.","posts":[{"format":"carousel","title":"Sunset set","caption":"Line one\\nLine two #not-a-tag","hashtags":["#Oahu","oahu sunset","<script>"],"photoIds":["p1","ghost","p2"],"why":"Same light across three frames."}]}'}}],usage:{neurons:12}};
  return {choices:[{message:{content:'{"scene":"Sunset by the water","subjects":["sun","palms"],"vibe":"warm calm","palette":["orange","blue"],"post":4,"format":"single","caption":"Golden hour by the water","tags":["sunset","oahu","golden"]}'}}],usage:{neurons:3}};
 }};
 return {TRIPS_KV:{get:async key=>memory.get(key),put:async(key,value)=>memory.set(key,value)},AI:ai};
}
let counter=0;
async function sessionToken(instance){counter++;const user='account-'+counter;return {user,token:await issueSession(instance,user)}}
const post=(instance,path,body,opts={})=>new Request('https://trip.example/api/tools/photos/'+path,{method:opts.method||'POST',headers:{Authorization:'Bearer '+(opts.token??''),'Content-Type':'application/json',...(opts.headers||{})},body:body===undefined?undefined:JSON.stringify(body)});

test('photo routes are delegated away from other paths',async()=>{
 assert.equal(await handlePhotoTools(new Request('https://trip.example/api/tools/chat',{method:'POST'}),makeEnv()),null);
});
test('photo desk requires a signed-in session',async()=>{
 const instance=makeEnv();const response=await handlePhotoTools(post(instance,'analyze',{photos:[{id:'p1',dataUrl:JPEG}]}),instance);
 assert.equal(response.status,401);assert.equal(instance.AI.runs.length,0);
});
test('photo desk refuses cross-origin calls',async()=>{
 const instance=makeEnv();const {token}=await sessionToken(instance);
 const response=await handlePhotoTools(post(instance,'analyze',{photos:[{id:'p1',dataUrl:JPEG}]},{token,headers:{Origin:'https://evil.example'}}),instance);
 assert.equal(response.status,403);
});
test('missing AI binding is explicit rather than a fake result',async()=>{
 const instance=makeEnv();delete instance.AI;const {token}=await sessionToken(instance);
 const response=await handlePhotoTools(post(instance,'analyze',{photos:[{id:'p1',dataUrl:JPEG}]},{token}),instance);
 assert.equal(response.status,503);assert.match((await response.json()).error,/not configured/);
});
test('non-image and oversized batches never reach the model',async()=>{
 const instance=makeEnv();const {token}=await sessionToken(instance);
 assert.equal((await handlePhotoTools(post(instance,'analyze',{photos:[{id:'p1',dataUrl:'https://example.com/x.jpg'}]},{token}),instance)).status,400);
 const many={photos:Array.from({length:7},(_,index)=>({id:'p'+index,dataUrl:JPEG}))};
 assert.equal((await handlePhotoTools(post(instance,'analyze',many,{token}),instance)).status,413);
 assert.equal((await handlePhotoTools(post(instance,'analyze',{photos:[]},{token}),instance)).status,400);
 assert.equal(instance.AI.runs.length,0);
});
test('analysis returns one label set per photo and caps every field',async()=>{
 const instance=makeEnv();const {token}=await sessionToken(instance);
 const response=await handlePhotoTools(post(instance,'analyze',{photos:[{id:'p1',dataUrl:JPEG},{id:'p2',dataUrl:JPEG}]},{token}),instance);
 const body=await response.json();
 assert.equal(response.status,200);assert.equal(body.results.length,2);
 for(const result of body.results){assert.equal(result.ok,true);assert.equal(result.tags.scene,'Sunset by the water');assert.equal(result.tags.post,4);assert.deepEqual(result.tags.palette,['orange','blue']);assert.ok(result.tags.tags.length<=4)}
 assert.equal(instance.AI.runs.length,2);assert.equal(instance.AI.runs[0].model,'@cf/mistralai/mistral-small-3.1-24b-instruct');
});
test('an unreadable model reply is scoped to that photo',async()=>{
 const instance=makeEnv();let call=0;
 instance.AI.run=async()=>{call++;if(call===1)throw new Error('upstream exploded');return {choices:[{message:{content:'{"scene":"Beach","post":5,"format":"single","caption":"Shoreline","tags":["beach"]}'}}]}};
 const {token}=await sessionToken(instance);
 const response=await handlePhotoTools(post(instance,'analyze',{photos:[{id:'p1',dataUrl:JPEG},{id:'p2',dataUrl:JPEG}]},{token}),instance);
 const body=await response.json();assert.equal(response.status,200);
 assert.deepEqual(body.results.map(result=>result.ok).sort(),[false,true]);
 assert.equal(JSON.stringify(body).includes('upstream exploded'),false);
});
test('planning only cites real photos and sanitises formats and tags',async()=>{
 const instance=makeEnv();const {token}=await sessionToken(instance);
 const response=await handlePhotoTools(post(instance,'plan',{
  trip:{city:'Honolulu',depart:'2026-10-24',returnDate:'2026-10-29'},
  photos:[{id:'p1',scene:'Sunset',vibe:'warm',post:4,format:'single',caption:'Golden hour',tags:['sunset']},{id:'p2',scene:'Palms',vibe:'calm',post:3,format:'single',caption:'Palms',tags:['palms']}],
 },{token}),instance);
 const body=await response.json();
 assert.equal(response.status,200);assert.equal(body.summary,'Golden hour roll.');
 const only=body.posts[0];
 assert.deepEqual(only.photoIds,['p1']); // a single frame cites one photo
 assert.equal(only.format,'single'); // a carousel needs three cited photos
 assert.deepEqual(only.hashtags,['#Oahu','#oahusunset']);
 assert.ok(only.caption.length<=700);
 assert.ok(instance.AI.runs.every(run=>run.payload.max_tokens<=2200));
});
test('an empty plan is a failure, not an invented post',async()=>{
 const instance=makeEnv();const {token}=await sessionToken(instance);
 instance.AI.run=async()=>({choices:[{message:{content:'{"summary":"none","posts":[]}'}}]});
 const response=await handlePhotoTools(post(instance,'plan',{photos:[{id:'p1',scene:'Beach',caption:'x',post:3,format:'single'}]},{token}),instance);
 assert.equal(response.status,502);assert.ok(!(await response.json()).posts);
});
test('planning rejects an empty photo set before calling the model',async()=>{
 const instance=makeEnv();const {token}=await sessionToken(instance);
 const response=await handlePhotoTools(post(instance,'plan',{photos:[]},{token}),instance);
 assert.equal(response.status,400);assert.equal(instance.AI.runs.length,0);
});
test('capabilities report the configured models without secrets',async()=>{
 const instance=makeEnv();const {token}=await sessionToken(instance);
 const response=await handlePhotoTools(post(instance,'capabilities',undefined,{method:'GET',token}),instance);
 const body=await response.json();
 assert.equal(body.vision,true);assert.equal(body.photosPerRequest,6);assert.equal(JSON.stringify(body).includes('Bearer'),false);
});

test('a carousel keeps its format only with three or more cited photos',async()=>{
 const instance=makeEnv();const {token}=await sessionToken(instance);
 instance.AI.run=async(model,payload)=>{
  if(String(payload.messages[0].content).includes('draft Instagram posts'))return {choices:[{message:{content:'{"summary":"Night set","posts":[{"format":"carousel","title":"Three nights","caption":"Lights on the water.\\nWatched them until the ferry left.","hashtags":["night"],"photoIds":["p1","p2","p3"],"why":"repetition of reflections"}]}'}}]};
  return {choices:[{message:{content:'{"scene":"Night","details":["water","lights","sky"],"light":"night","post":4,"format":"single","caption":"Lights","tags":["night"]}'}}]};
 };
 const photos=['p1','p2','p3'].map(id=>({id,scene:'Night',details:['water'],light:'night',post:4,format:'single',rank:70}));
 const response=await handlePhotoTools(post(instance,'plan',{photos},{token}),instance);
 const body=await response.json();
 assert.equal(response.status,200);assert.equal(body.posts[0].format,'carousel');assert.deepEqual(body.posts[0].photoIds,['p1','p2','p3']);
});
