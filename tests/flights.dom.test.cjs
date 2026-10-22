const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {parseHTML}=require('linkedom');
const html=fs.readFileSync('index.html','utf8');
const code=html.slice(html.indexOf('/* Flight search:'),html.indexOf('/* Shared trips */'));
const base={airline:'Test Air',flightNumber:'TA 10',departureTime:'10:00',arrivalTime:'13:00',duration:'6h',price:'$120'};
const poison=`'");alert(1);//<img src=x onerror="alert(1)"><svg onload="alert(1)">`;
function fixture(){
  const {document}=parseHTML(html),calls=[];
  let handler=()=>Response.json({flights:[base],can_request_more:true});
  const context=vm.createContext({document,AbortController,setTimeout,clearTimeout,activeTrip:()=>({depart:'2026-10-22'}),toast:()=>{},fetch:async(url,options)=>{calls.push({url,...JSON.parse(options.body)});return handler(url,options)}});
  vm.runInContext(code,context);
  document.getElementById('fromInput').value='SAN';document.getElementById('toInput').value='HNL';
  return {document,context,calls,run:s=>vm.runInContext(s,context),set:fn=>handler=fn};
}
test('cards and tracking treat hostile fields literally and preserve click arguments',async()=>{
  const f=fixture();f.set(()=>Response.json({flights:[{...base,airline:poison,flightNumber:poison,departureTime:poison,arrivalTime:poison,duration:poison,price:poison,status:poison}],can_request_more:true}));
  await f.run('searchFlights()');
  assert.equal(f.document.querySelectorAll('#flightResults img, #flightResults svg, #flightResults [onclick]').length,0);
  assert.ok(f.document.getElementById('flightResults').textContent.includes(poison));
  f.context.trackFlight=(...args)=>f.context.clicked=args;
  f.document.querySelector('.track-btn').click();assert.deepEqual([...f.context.clicked],[poison,poison,'2026-10-22']);
  f.context.payload={status:poison,departureTime:poison,arrivalTime:poison,gate:poison,terminal:poison,text:poison};
  f.run('renderTrackPanel(payload,"Test Air","TA10")');
  assert.equal(f.document.querySelectorAll('#trackModalBody img, #trackModalBody svg, #trackModalBody [onclick]').length,0);assert.ok(f.document.getElementById('trackModalBody').textContent.includes('Unverified'));
});
test('pagination removes duplicates, stops repeated batches and resets on refresh',async()=>{
  const f=fixture();await f.run('searchFlights()');
  f.set(()=>Response.json({flights:[base,{...base,flightNumber:'TA10'},{...base,flightNumber:'TA20'}],can_request_more:true}));
  await f.run('loadMoreFlights()');assert.equal(f.calls.at(-1).offset,1);assert.equal(f.document.querySelectorAll('.flight-card').length,2);
  await f.run('loadMoreFlights()');assert.equal(f.document.querySelectorAll('.flight-card').length,2);assert.equal(f.run('flightSearchState.hasMore'),false);
  await f.run('refreshFlights()');assert.equal(f.calls.at(-1).offset,0);assert.equal(f.document.querySelectorAll('.flight-card').length,2);
});
test('failed load more retains cards and offset for retry; failed refresh clears stale cards',async()=>{
  const f=fixture();await f.run('searchFlights()');
  f.set(()=>new Response('down',{status:502}));await f.run('loadMoreFlights()');
  assert.equal(f.document.querySelectorAll('.flight-card').length,1);assert.equal(f.run('flightSearchState.offset'),1);assert.ok(f.document.getElementById('flightResults').textContent.includes('Existing results retained'));
  f.set(()=>{throw Error('network')});await f.run('loadMoreFlights()');assert.equal(f.calls.at(-1).offset,1);
  await f.run('refreshFlights()');assert.equal(f.document.querySelectorAll('.flight-card').length,0);assert.ok(f.document.getElementById('flightResults').textContent.includes('unavailable'));
  assert.ok(f.calls.every(c=>c.url==='/api/flights/search'));
});
test('null/malformed searches and tracking fail safely and can retry',async()=>{
  const f=fixture();for(const body of [null,{}, {flights:null}]){f.set(()=>Response.json(body));await f.run('searchFlights()');assert.ok(f.document.getElementById('flightResults').textContent.includes('unavailable'));assert.equal(f.run('flightSearchState.busy'),false)}
  for(const body of [null,{flight:null},{flight:[]},{flight:{}}]){f.set(()=>Response.json(body));await f.run('trackFlight("Test Air","TA10","2026-10-22")');assert.ok(f.document.getElementById('trackModalBody').textContent.includes('unavailable'))}
  f.set(()=>Response.json({flights:[null,{},base,base],can_request_more:true}));await f.run('refreshFlights()');assert.equal(f.document.querySelectorAll('.flight-card').length,1);
});
test('duplicate load clicks and stale search replies cannot overwrite the current query',async()=>{
  const f=fixture();let release;
  f.set(()=>new Promise(resolve=>release=resolve));const old=f.run('searchFlights()');
  f.set(()=>Response.json({flights:[{...base,flightNumber:'NEW'}],can_request_more:true}));f.document.getElementById('toInput').value='SEA';await f.run('searchFlights()');
  release(Response.json({flights:[{...base,flightNumber:'OLD'}]}));await old;
  assert.ok(f.document.getElementById('flightResults').textContent.includes('NEW'));assert.ok(!f.document.getElementById('flightResults').textContent.includes('OLD'));
  let releaseMore;f.set(()=>new Promise(resolve=>releaseMore=resolve));const more=f.run('loadMoreFlights()');await f.run('loadMoreFlights()');assert.equal(f.calls.length,3);
  releaseMore(Response.json({flights:[base],can_request_more:true}));await more;assert.equal(f.document.querySelectorAll('.flight-card').length,2);
});
test('closed or replaced tracking requests cannot update the modal',async()=>{
  const f=fixture();let release;f.set(()=>new Promise(resolve=>release=resolve));const first=f.run('trackFlight("A","OLD","2026-10-22")');
  f.set(()=>Response.json({flight:{status:'New estimate'}}));await f.run('trackFlight("A","NEW","2026-10-22")');release(Response.json({flight:{status:'Old estimate'}}));await first;
  assert.ok(f.document.getElementById('trackModalBody').textContent.includes('New estimate'));assert.ok(!f.document.getElementById('trackModalBody').textContent.includes('Old estimate'));
  f.set(()=>new Promise(resolve=>release=resolve));const next=f.run('trackFlight("A","LAST","2026-10-22")');f.run('closeTrackModal()');release(Response.json({flight:{status:'Should not display'}}));await next;
  assert.equal(f.document.getElementById('trackModal').classList.contains('show'),false);assert.ok(!f.document.getElementById('trackModalBody').textContent.includes('Should not display'));
});
