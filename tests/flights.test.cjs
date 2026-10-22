const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const workerSource=fs.readFileSync('_worker.js','utf8');
let provider;
const context=vm.createContext({Response,Request,URL,AbortSignal,fetch:async()=>provider()});
vm.runInContext(workerSource.replace('export default {','globalThis.worker = {'),context);
const worker=context.worker;
const query={from:'SAN',to:'HNL',date:'2026-10-22'};
const f={airline:'Test Air',flightNumber:'TA 10',departureTime:'10:00',price:'$120'};
async function request(content,body=query,path='search'){
  provider=()=>Response.json({choices:[{message:{content:typeof content==='string'?content:JSON.stringify(content)}}]});
  return worker.fetch(new Request('https://trip.test/api/flights/'+path,{method:'POST',body:JSON.stringify(body)}),{PPLX_KEY:'test'});
}
test('null, empty arrays and supported object envelopes are safe',async()=>{
  for(const input of ['null',[],{flights:[]},{results:[f]},{data:[f]}]){
    const response=await request(input);assert.equal(response.status,200);
    const data=await response.json();assert.equal(data.verified,false);assert.equal(data.pagination_supported,false);assert.equal(data.has_more,false);assert.ok(Array.isArray(data.flights));
  }
});
test('malformed JSON, scalars, wrong objects and bad provider content return 502, not 500',async()=>{
  for(const input of ['{broken','true','42','"text"',{}, {flights:null}])assert.equal((await request(input)).status,502);
  provider=()=>Response.json({choices:[{message:{content:{flights:[f]}}}]});
  const r=await worker.fetch(new Request('https://trip.test/api/flights/search',{method:'POST',body:JSON.stringify(query)}),{PPLX_KEY:'test'});assert.equal(r.status,502);
});
test('mixed model records, malicious strings and duplicates are normalized without trusting metadata',async()=>{
  const response=await request([null,4,[],{},f,{...f,flightNumber:'TA10',verified:true},{...f,flightNumber:'TA11',airline:'<img src=x onerror=alert(1)>',status:{evil:1},price:[],verified:true}]);
  const data=await response.json();assert.equal(data.flights.length,2);assert.equal(data.flights[1].status,'');assert.equal(data.flights[1].price,'');assert.equal(data.flights[1].verified,undefined);assert.equal(data.verified,false);
});
test('fenced JSON and exploratory offset retain explicit unverified metadata',async()=>{
  const r=await request('```json\n'+JSON.stringify([f])+'\n```',{...query,offset:10});const data=await r.json();assert.equal(data.offset,10);assert.equal(data.can_request_more,true);assert.equal(data.has_more,false);
});
test('invalid requests do not reach provider',async()=>{
  for(const body of [null,{...query,offset:-1},{...query,offset:'10'},{...query,offset:100},{...query,from:'<script>'},{...query,to:'SAN'},{...query,date:[]}])assert.equal((await request([],body)).status,400);
});
test('provider rejection and network failure are recoverable 502s',async()=>{
  for(const impl of [()=>new Response('no',{status:429}),()=>{throw Error('secret provider detail')}]){
    provider=impl;const r=await worker.fetch(new Request('https://trip.test/api/flights/search',{method:'POST',body:JSON.stringify(query)}),{PPLX_KEY:'test'});assert.equal(r.status,502);assert.ok(!(await r.text()).includes('secret'));
  }
});
test('tracking rejects null/array/empty status and labels valid model status unverified',async()=>{
  const body={airline:'Test Air',flightNumber:'TA 10',date:query.date};
  for(const value of ['null',[],{},4])assert.equal((await request(value,body,'track')).status,502);
  const data=await (await request({status:'On time',gate:'<svg onload=alert(1)>',verified:true},body,'track')).json();assert.equal(data.verified,false);assert.equal(data.flight.verified,undefined);
});
test('embedded and standalone flight implementations stay identical; trip persistence stays unchanged',()=>{
  const html=vm.runInContext('INDEX_HTML',context),standalone=fs.readFileSync('index.html','utf8');
  const block=s=>s.slice(s.indexOf('/* Flight search:'),s.indexOf('/* Shared trips */'));
  assert.equal(block(html),block(standalone));
  for(const source of [html,standalone])new vm.Script(source.match(/<script>([\s\S]*?)<\/script>/)[1]);
  const original=require('node:child_process').execFileSync('git',['show','6665b703:_worker.js'],{encoding:'utf8'});
  const persistence=s=>s.slice(s.indexOf('    // ─── /api/auth'),s.indexOf('    // ─── /api/health'));
  assert.equal(persistence(workerSource),persistence(original));
});
