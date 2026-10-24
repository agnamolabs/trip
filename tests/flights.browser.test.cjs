// Run with: node --test tests/flights.browser.test.cjs (npm install first).
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const vm=require('node:vm');
const {chromium}=require('playwright');
const worker=fs.readFileSync('_worker.js','utf8');
const html=vm.runInNewContext(worker.slice(worker.indexOf('const INDEX_HTML = '),worker.indexOf('const SCHEMA_SQL = '))+'\nINDEX_HTML');
const base={airline:'Test Air',flightNumber:'TA 10',departureTime:'10:00',arrivalTime:'13:00',duration:'6h',price:'$120',status:'On time'};
const poison=`'");window.flightInjected=1;//<img src=x onerror="window.flightInjected=1"><svg onload="window.flightInjected=1">`;
const reply=flights=>({flights,can_request_more:true,verified:true}); // UI must ignore model verification claims.
let browser;
test.before(async()=>{browser=await chromium.launch({headless:true, ...(process.env.TRIP_CHROMIUM_PATH ? {executablePath:process.env.TRIP_CHROMIUM_PATH} : {})})});
test.after(async()=>{await browser?.close()});
async function fixture(width=1440){
  const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'}),errors=[],requests=[];
  let handler=()=>({status:200,body:reply([base])}),trackHandler=()=>({status:200,body:{flight:{status:'On time',departureTime:'10:00',arrivalTime:'13:00',gate:'A12'}}});
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',msg=>{if(['error','warning'].includes(msg.type())&&!/Failed to load resource/.test(msg.text()))errors.push(msg.text())});
  await page.route('**/*',async route=>{
    const url=new URL(route.request().url());
    if(url.pathname==='/api/flights/search'||url.pathname==='/api/flights/track'){
      const body=route.request().postDataJSON();requests.push({path:url.pathname,...body});
      const result=await (url.pathname.endsWith('/search')?handler:trackHandler)(body);
      try{await route.fulfill({status:result.status,contentType:'application/json',body:JSON.stringify(result.body)})}catch{}return;
    }
    if(url.hostname==='trip.test'&&url.pathname==='/')return route.fulfill({contentType:'text/html',body:html});
    return route.fulfill({status:200,body:''});
  });
  await page.goto('https://trip.test/');
  await page.evaluate(()=>{document.getElementById('authGate')?.remove();document.getElementById('tripSetup').classList.add('hidden');document.getElementById('tripSummary').classList.remove('hidden');activeTrip=()=>({depart:'2026-10-22'});});
  const search=async()=>{await page.locator('#fromInput').fill('SAN');await page.locator('#toInput').fill('HNL');await page.getByRole('button',{name:'Search flights →',exact:true}).click();await page.waitForFunction(()=>!flightSearchState.busy)};
  return {page,errors,requests,search,setSearch:fn=>handler=fn,setTrack:fn=>trackHandler=fn};
}
for(const width of [1440,768,390,320])test(`search, malicious text, load more, refresh and tracking at ${width}px`,async()=>{
  const f=await fixture(width),{page}=f;
  try{
    f.setSearch(()=>({status:200,body:reply([base,{...base,flightNumber:poison,airline:poison,departureTime:poison,arrivalTime:poison,duration:poison,price:poison,status:poison}])}));
    await f.search();assert.equal(await page.title(),'agnamo · trip');assert.equal(page.url(),'https://trip.test/');assert.equal(await page.locator('.flight-card').count(),2);
    assert.equal(await page.locator('#flightResults img, #flightResults svg, #flightResults [onclick]').count(),0);
    assert.equal(await page.evaluate(()=>window.flightInjected),undefined);
    assert.ok((await page.locator('#flightResults').innerText()).toLowerCase().includes('unverified'));
    f.setTrack(()=>({status:200,body:{verified:true,flight:{status:poison,departureTime:poison,arrivalTime:poison,gate:poison,terminal:poison,text:poison}}}));
    await page.locator('.track-btn').nth(1).click();await page.waitForFunction(()=>document.querySelector('.track-panel'));
    assert.equal(f.requests.at(-1).airline,poison);assert.equal(f.requests.at(-1).flightNumber,poison);
    assert.equal(await page.locator('#trackModalBody img, #trackModalBody svg, #trackModalBody [onclick]').count(),0);
    assert.ok((await page.locator('#trackModalBody').innerText()).toLowerCase().includes('unverified'));
    assert.equal(await page.evaluate(()=>window.flightInjected),undefined);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    const modal=await page.locator('.track-modal-card').evaluate(el=>({width:el.clientWidth,scroll:el.scrollWidth}));assert.ok(modal.scroll<=modal.width);
    await page.getByRole('button',{name:'Close flight status',exact:true}).click();
    f.setSearch(()=>({status:200,body:reply([{...base,flightNumber:'TA10'},{...base,flightNumber:'TA 20'}])}));
    await page.locator('#loadMoreFlightsBtn').click();await page.waitForFunction(()=>!flightSearchState.busy);
    assert.equal(await page.locator('.flight-card').count(),3);assert.equal(f.requests.at(-1).offset,2);
    f.setSearch(()=>({status:502,body:{error:'failed'}}));
    await page.locator('#loadMoreFlightsBtn').click();await page.waitForFunction(()=>!flightSearchState.busy);
    assert.equal(await page.locator('.flight-card').count(),3);assert.ok((await page.locator('#flightResults').innerText()).includes('Existing results retained'));
    assert.equal(f.requests.at(-1).offset,4);
    f.setSearch(()=>({status:200,body:reply([base])}));
    await page.locator('#refreshFlightsBtn').click();await page.waitForFunction(()=>!flightSearchState.busy);
    assert.equal(f.requests.at(-1).offset,0);assert.equal(await page.locator('.flight-card').count(),1);
    await page.locator('#loadMoreFlightsBtn').click();await page.waitForFunction(()=>!flightSearchState.busy);
    assert.equal(await page.locator('.flight-card').count(),1);assert.equal(await page.locator('#loadMoreFlightsBtn').isVisible(),false);
    await page.screenshot({path:path.join(os.tmpdir(),`trip-flight-results-${width}.png`),fullPage:false});
    f.setTrack(()=>({status:200,body:{flight:{status:'On time',departureTime:'10:00',arrivalTime:'13:00',gate:'A12'}}}));
    await page.locator('.track-btn').click();await page.waitForFunction(()=>document.querySelector('.track-panel'));
    await page.screenshot({path:path.join(os.tmpdir(),`trip-flight-${width}.png`),fullPage:false});
    assert.deepEqual(f.errors,[]);
  }finally{await page.close()}
});
test('null and malformed searches, failures, retries and invalid tracking remain recoverable',async()=>{
  const f=await fixture(),{page}=f;
  try{
    for(const body of [null,{}, {flights:null}]){
      f.setSearch(()=>({status:200,body}));await f.search();assert.ok((await page.locator('#flightResults').innerText()).includes('unavailable'));
    }
    f.setSearch(()=>({status:200,body:reply([null,{},[],base,base])}));await f.search();assert.equal(await page.locator('.flight-card').count(),1);
    for(const body of [null,{flight:null},{flight:[]},{flight:{}}]){
      f.setTrack(()=>({status:200,body}));await page.locator('.track-btn').click();await page.waitForFunction(()=>document.getElementById('trackModalBody').textContent.includes('unavailable'));
      await page.getByRole('button',{name:'Close flight status',exact:true}).click();
    }
    f.setSearch(()=>({status:503,body:{error:'down'}}));await page.locator('#refreshFlightsBtn').click();await page.waitForFunction(()=>!flightSearchState.busy);
    assert.equal(await page.locator('.flight-card').count(),0);assert.ok((await page.locator('#flightResults').innerText()).includes('unavailable'));
    f.setSearch(()=>({status:200,body:reply([])}));await page.locator('#refreshFlightsBtn').click();await page.waitForFunction(()=>!flightSearchState.busy);assert.ok((await page.locator('#flightResults').innerText()).includes('Availability has not been checked'));
    assert.ok(f.requests.every(r=>r.path.startsWith('/api/flights/')));assert.deepEqual(f.errors,[]);
  }finally{await page.close()}
});
test('concurrent requests cannot append twice or overwrite a newer search or closed tracker',async()=>{
  const f=await fixture(),{page}=f;let release;
  try{
    f.setSearch(()=>new Promise(resolve=>release=resolve));
    await page.locator('#fromInput').fill('SAN');await page.locator('#toInput').fill('HNL');await page.getByRole('button',{name:'Search flights →',exact:true}).click();
    await page.waitForFunction(()=>flightSearchState.busy);
    f.setSearch(()=>({status:200,body:reply([{...base,flightNumber:'NEW'}])}));
    await page.locator('#toInput').fill('SEA');await page.getByRole('button',{name:'Search flights →',exact:true}).click();await page.waitForFunction(()=>!flightSearchState.busy);
    release({status:200,body:reply([{...base,flightNumber:'OLD'}])});
    assert.ok((await page.locator('#flightResults').innerText()).includes('NEW'));assert.ok(!(await page.locator('#flightResults').innerText()).includes('OLD'));
    let releasePage;f.setSearch(()=>new Promise(resolve=>releasePage=resolve));
    await page.evaluate(()=>{loadMoreFlights();loadMoreFlights()});
    await page.waitForFunction(()=>flightSearchState.busy);assert.equal(f.requests.filter(r=>r.path.endsWith('/search')).length,3);
    releasePage({status:200,body:reply([{...base,flightNumber:'TA 20'}])});await page.waitForFunction(()=>!flightSearchState.busy);assert.equal(await page.locator('.flight-card').count(),2);
    let releaseTrack;f.setTrack(()=>new Promise(resolve=>releaseTrack=resolve));
    await page.locator('.track-btn').first().click();await page.getByRole('button',{name:'Close flight status',exact:true}).click();
    releaseTrack({status:200,body:{flight:{status:'OLD'}}});
    assert.equal(await page.locator('#trackModal').isVisible(),false);assert.deepEqual(f.errors,[]);
  }finally{await page.close()}
});
