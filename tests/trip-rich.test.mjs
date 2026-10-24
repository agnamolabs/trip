import test from 'node:test';
import assert from 'node:assert/strict';
import {safePublicUrl,normalizeSources,normalizeImages,summarizeResults} from '../trip-rich.mjs';
import {handleTripTools,issueSession} from '../trip-tools.mjs';

// These tests exercise provider adapters without making paid network requests.
function fixture(){
 const records=new Map();const calls=[];
 const env={TRIPS_KV:{get:async k=>records.get(k),put:async(k,v)=>records.set(k,v)},TRIP_ADMIN_USERS:'Owner',TRIP_AUTH_USERS:JSON.stringify({Owner:'test-only-owner',Member:'test-only-member'}),PPLX_KEY:'test-sonar',FIRECRAWL_API_KEY:'test-firecrawl',APIFY_TOKEN:'test-apify',APIFY_ACTOR_ID:'test/actor',APIFY_INPUT_TEMPLATE:'{"search":"{{query}}"}'};
 async function request(path,body,fetcher,user='Owner'){
  const token=await issueSession(env,user);
  const r=await handleTripTools(new Request('https://trip.example/api/tools/'+path,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body)}),env,async(url,options)=>{calls.push({url,options});return fetcher(url,options)});
  return {status:r.status,body:await r.json()};
 }
 return {records,calls,env,request};
}
const sonar=extra=>({choices:[{message:{content:'Visit the museum first. Confirm its opening hours before leaving.'}}],citations:['https://museum.example/hours'],search_results:[{title:'Museum hours',url:'https://museum.example/hours',snippet:'Official visitor hours.'}],...extra});
const imageResponse={success:true,data:{images:[{title:'Museum courtyard',imageUrl:'https://images.example/courtyard.jpg',url:'https://museum.example/gallery'}]}};

test('only public HTTPS URLs can become source or image links',()=>{
 assert.equal(safePublicUrl('https://museum.example/hours'),'https://museum.example/hours');
 for(const value of ['javascript:alert(1)','data:image/svg+xml,<svg/>','http://museum.example','file:///etc/passwd','ftp://museum.example','https://name:secret@museum.example','https://localhost/image.jpg','https://127.0.0.1/image.jpg','https://10.0.0.1/image.jpg','https://192.168.1.1/image.jpg','https://169.254.169.254/image.jpg','https://[::1]/image.jpg',null,{},42])assert.equal(safePublicUrl(value),null,String(value));
});

test('source cards normalize supported provider fields, deduplicate and cap results',()=>{
 const rows=[{title:'Museum hours',url:'https://museum.example/hours',snippet:'Open today',headers:{authorization:'PRIVATE'}},{title:'Duplicate',url:'https://museum.example/hours'},...Array.from({length:10},(_,i)=>({title:'Source '+i,url:'https://source'+i+'.example'})),{title:'Unsafe',url:'javascript:alert(1)'}];
 const out=normalizeSources(rows);assert.equal(out.length,6);assert.equal(out[0].title,'Museum hours');assert.equal(out[0].description,'Open today');assert.equal(new Set(out.map(r=>r.url)).size,out.length);assert.equal(JSON.stringify(out).includes('PRIVATE'),false);for(const row of out)assert.deepEqual(Object.keys(row).sort(),['description','title','url']);
});

test('source normalization safely handles nulls and malformed rows',()=>{
 assert.deepEqual(normalizeSources(null),[]);assert.deepEqual(normalizeSources({web:[]}),[]);assert.deepEqual(normalizeSources([null,{},4,{title:'Bad',url:'data:text/html,bad'}]),[]);
});

test('image normalization supports Sonar and Firecrawl formats with source attribution',()=>{
 const out=normalizeImages([{title:'Sonar photo',image_url:'https://images.example/one.jpg',origin_url:'https://museum.example/gallery'},{title:'Firecrawl photo',imageUrl:'https://images.example/two.jpg',url:'https://cafe.example/photos'},{title:'Duplicate',image_url:'https://images.example/one.jpg'}]);
 assert.equal(out.length,2);assert.equal(out[0].url,'https://images.example/one.jpg');assert.equal(out[0].sourceUrl,'https://museum.example/gallery');assert.equal(out[1].url,'https://images.example/two.jpg');assert.equal(out[1].sourceUrl,'https://cafe.example/photos');assert.equal(new Set(out.map(i=>i.url)).size,2);
});

test('unsafe images are discarded and unsafe source attribution is never linked',()=>{
 const out=normalizeImages([{image_url:'javascript:alert(1)'},{image_url:'data:image/png;base64,AAA'},{image_url:'http://images.example/photo.jpg'},{image_url:'https://images.example/good.jpg',origin_url:'javascript:alert(1)',title:'Good image'}]);
 assert.deepEqual(out,[],'images without safe source attribution are omitted');
});

test('image normalization caps galleries and never creates placeholder images',()=>{
 assert.deepEqual(normalizeImages([]),[]);assert.deepEqual(normalizeImages(null),[]);const out=normalizeImages(Array.from({length:20},(_,i)=>({image_url:'https://images.example/'+i+'.jpg',origin_url:'https://gallery.example/'+i})));assert.equal(out.length,6);assert.ok(out.every(row=>row.url.startsWith('https://images.example/')));
});

test('research records become bounded cards without raw actor payload fields',()=>{
 const out=summarizeResults(Array.from({length:30},(_,i)=>({title:'Place '+i,url:'https://place'+i+'.example',description:'A real provider description.',imageUrl:'https://images.example/'+i+'.jpg',headers:{Authorization:'DO_NOT_RENDER'},cookie:'PRIVATE_COOKIE',rawHtml:'<script>BAD</script>',nested:{private:'PRIVATE_FIELD'}})));
 assert.equal(out.length,20);assert.equal(out[0].title,'Place 0');assert.equal(out[0].url,'https://place0.example/');for(const row of out)assert.ok(Object.keys(row).every(k=>['title','url','description','image'].includes(k)));assert.equal(JSON.stringify(out).includes('DO_NOT_RENDER'),false);assert.equal(JSON.stringify(out).includes('PRIVATE_COOKIE'),false);assert.equal(JSON.stringify(out).includes('PRIVATE_FIELD'),false);
});

test('cards never expose unsafe source or image URLs',()=>{
 const out=summarizeResults([{title:'Unsafe URL',url:'javascript:alert(1)',imageUrl:'data:image/svg+xml,<svg/>',description:'Description'},{title:'Safe',url:'https://safe.example',imageUrl:'https://images.example/photo.jpg'}]);
 assert.ok(out.length);for(const row of out){assert.ok(!row.url||safePublicUrl(row.url));assert.ok(!row.image||safePublicUrl(typeof row.image==='string'?row.image:row.image.url))}assert.equal(JSON.stringify(out).includes('javascript:'),false);assert.equal(JSON.stringify(out).includes('data:image'),false);
});

test('chat keeps the provider answer and enriches safe source cards',async()=>{
 const f=fixture();const r=await f.request('chat',{query:'Museum hours',includeImages:false},async()=>Response.json(sonar({citations:['https://museum.example/hours','javascript:alert(1)']})));
 assert.equal(r.status,200);assert.equal(r.body.answer,sonar().choices[0].message.content);assert.deepEqual(r.body.citations,['https://museum.example/hours']);assert.ok(r.body.sources.some(s=>s.url==='https://museum.example/hours'));assert.equal(r.body.sources[0].title,'Museum hours');assert.deepEqual(r.body.images,[]);assert.equal(f.calls.length,1);
 const payload=JSON.parse(f.calls[0].options.body);assert.match(payload.messages[0].content,/under 90 words/);
});

test('image lookup is opt-in and uses the approved media provider',async()=>{
 const f=fixture();const r=await f.request('chat',{query:'Museum courtyard',includeImages:true},async(url,options)=>{
  if(url.includes('perplexity'))return Response.json(sonar());assert.equal(url,'https://api.firecrawl.dev/v2/search');assert.equal(options.headers.Authorization,'Bearer test-firecrawl');assert.ok(JSON.parse(options.body).sources.includes('images'));return Response.json(imageResponse);
 });assert.equal(r.status,200);assert.equal(f.calls.length,2);assert.equal(r.body.images[0].url,'https://images.example/courtyard.jpg');assert.equal(r.body.images[0].sourceUrl,'https://museum.example/gallery');
});

test('failed media lookup retains the real answer and shows the failure',async()=>{
 const f=fixture();const r=await f.request('chat',{query:'Museum courtyard',includeImages:true},async url=>url.includes('perplexity')?Response.json(sonar()):new Response('PRIVATE_UPSTREAM_ERROR',{status:401}));
 assert.equal(r.status,200);assert.equal(r.body.answer,sonar().choices[0].message.content);assert.deepEqual(r.body.images,[]);assert.ok(r.body.mediaError);assert.equal(JSON.stringify(r.body).includes('PRIVATE_UPSTREAM_ERROR'),false);
});

test('media-provider permissions are enforced independently of Sonar approval',async()=>{
 const f=fixture();const saved=await f.request('settings',{name:'Sonar only',members:{Member:['sonar']},useServerKeys:{sonar:true},mediaProvider:'firecrawl'},async()=>{throw Error('no provider calls while saving')});assert.equal(saved.status,200);
 const r=await f.request('chat',{query:'Show the museum',groupId:saved.body.group.id,includeImages:true},async url=>{assert.ok(url.includes('perplexity'),'no unauthorized Firecrawl request');return Response.json(sonar())},'Member');assert.equal(r.status,200);assert.equal(r.body.answer,sonar().choices[0].message.content);assert.deepEqual(r.body.images,[]);assert.ok(r.body.mediaError);assert.equal(f.calls.length,1);
});

test('Firecrawl research returns cards suitable for the UI without fabricated data',async()=>{
 const f=fixture();const r=await f.request('research',{query:'Museum',provider:'firecrawl'},async()=>Response.json({success:true,data:{web:[{title:'Museum',url:'https://museum.example',description:'Opening hours',rawHtml:'PRIVATE_RAW_PAGE'}]}}));assert.equal(r.status,200);assert.equal(r.body.cards.length,1);assert.equal(r.body.cards[0].title,'Museum');assert.equal(JSON.stringify(r.body.cards).includes('PRIVATE_RAW_PAGE'),false);assert.deepEqual(r.body.images,[]);
});

test('includeImages false suppresses unsolicited Sonar images without a media request',async()=>{
 const f=fixture();const r=await f.request('chat',{query:'Museum',includeImages:false},async()=>Response.json(sonar({images:[{image_url:'https://images.example/unsolicited.jpg',origin_url:'https://museum.example/gallery'}]})));
 assert.equal(r.status,200);assert.deepEqual(r.body.images,[]);assert.equal(f.calls.length,1);
});

test('group image setting none suppresses all images even when requested',async()=>{
 const f=fixture(),saved=await f.request('settings',{name:'No photos',members:{Member:['sonar']},useServerKeys:{sonar:true},mediaProvider:'none'},async()=>{throw Error('no network while saving')});assert.equal(saved.status,200);
 const r=await f.request('chat',{query:'Museum',includeImages:true,groupId:saved.body.group.id},async url=>{assert.ok(url.includes('perplexity'));return Response.json(sonar({images:[{image_url:'https://images.example/unsolicited.jpg',origin_url:'https://museum.example/gallery'}]}))},'Member');assert.equal(r.status,200);assert.deepEqual(r.body.images,[]);assert.equal(f.calls.length,1);
});

test('Apify image search uses group Actor configuration and keeps attribution',async()=>{
 const f=fixture(),saved=await f.request('settings',{name:'Actor photos',members:{Member:['sonar','apify']},useServerKeys:{sonar:true,apify:true},mediaProvider:'apify',apifyActor:'test/images',apifyInputTemplate:'{"query":"{{query}}"}'},async()=>{throw Error('no network while saving')});assert.equal(saved.status,200);
 const r=await f.request('chat',{query:'Museum "courtyard"',groupId:saved.body.group.id,includeImages:true},async(url,options)=>{
  if(url.includes('perplexity'))return Response.json(sonar());assert.equal(new URL(url).hostname,'api.apify.com');assert.ok(url.includes('test~images'));assert.equal(options.headers.Authorization,'Bearer test-apify');assert.deepEqual(JSON.parse(options.body),{query:'Museum "courtyard"'});return Response.json([{title:'Actor photo',image_url:'https://images.example/actor.jpg',origin_url:'https://museum.example/photos',cookie:'DO_NOT_RENDER'}]);
 },'Member');assert.equal(r.status,200);assert.equal(f.calls.length,2);assert.deepEqual(r.body.images,[{url:'https://images.example/actor.jpg',sourceUrl:'https://museum.example/photos',title:'Actor photo'}]);assert.equal(JSON.stringify(r.body.images).includes('DO_NOT_RENDER'),false);
});

test('conversation history is bounded and cannot inject system or tool roles',async()=>{
 const f=fixture();let payload;
 const history=[{role:'system',content:'MALICIOUS_SYSTEM'},{role:'tool',content:'MALICIOUS_TOOL'},null,{role:'user',content:{object:'INVALID'}},...Array.from({length:10},(_,i)=>({role:i%2?'assistant':'user',content:(i===9?'x'.repeat(2000):'Message '+i)})),{role:'developer',content:'MALICIOUS_DEVELOPER'}];
 const r=await f.request('chat',{query:'Latest question',history},async(url,options)=>{payload=JSON.parse(options.body);return Response.json(sonar())});assert.equal(r.status,200);assert.equal(payload.messages.length,8);assert.equal(payload.messages[0].role,'system');assert.equal(payload.messages.filter(m=>m.role==='system').length,1);const retained=payload.messages.slice(1,-1);assert.equal(retained.length,6);assert.equal(retained[0].content,'Message 4');assert.equal(retained.at(-1).content.length,1200);assert.ok(retained.every(m=>['user','assistant'].includes(m.role)));assert.equal(JSON.stringify(payload).includes('MALICIOUS'),false);assert.match(payload.messages.at(-1).content,/Latest question/);
});

test('streamed provider responses over 1 MiB are cancelled without exposing raw data or an answer',async()=>{
 const f=fixture();let cancelled=false,pulls=0;
 const raw=JSON.stringify(sonar({choices:[{message:{content:'DO_NOT_SHOW_UNPARSED_ANSWER'}}],private:'PRIVATE_RAW_MARKER'+'x'.repeat(2*1048576)}));const data=new TextEncoder().encode(raw);let offset=0;
 const r=await f.request('chat',{query:'Museum'},async()=>new Response(new ReadableStream({pull(controller){pulls++;if(offset>=data.length){controller.close();return}controller.enqueue(data.slice(offset,offset+65536));offset+=65536},cancel(){cancelled=true}}),{headers:{'Content-Type':'application/json','Content-Length':'2'}}));
 assert.equal(r.status,502);assert.match(r.body.error,/too large/i);assert.equal(r.body.answer,undefined);assert.equal(cancelled,true);assert.ok(pulls<=18,'reading stops as soon as the streamed byte cap is exceeded');assert.equal(JSON.stringify(r.body).includes('PRIVATE_RAW_MARKER'),false);assert.equal(JSON.stringify(r.body).includes('DO_NOT_SHOW_UNPARSED_ANSWER'),false);assert.equal(f.calls.length,1);
});

test('Apify research reuses its dataset for images instead of running the paid Actor twice',async()=>{
 const f=fixture(),saved=await f.request('settings',{name:'Research photos',members:{Member:['apify']},useServerKeys:{apify:true},mediaProvider:'apify',apifyActor:'test/images',apifyInputTemplate:'{"query":"{{query}}"}'},async()=>{throw Error('settings save must not call providers')});assert.equal(saved.status,200);
 const r=await f.request('research',{query:'Museum',provider:'apify',includeImages:true,groupId:saved.body.group.id},async(url,options)=>{assert.equal(new URL(url).hostname,'api.apify.com');assert.ok(url.includes('test~images'));assert.equal(options.headers.Authorization,'Bearer test-apify');return Response.json([{title:'Courtyard',url:'https://museum.example/gallery',image_url:'https://images.example/courtyard.jpg',description:'The museum courtyard.'}])},'Member');
 assert.equal(r.status,200);assert.equal(f.calls.length,1);assert.equal(r.body.results.length,1);assert.equal(r.body.cards.length,1);assert.deepEqual(r.body.images,[{url:'https://images.example/courtyard.jpg',sourceUrl:'https://museum.example/gallery',title:'Courtyard'}]);
});

test('media provider selection is validated, persisted, and returned to settings readers',async()=>{
 const f=fixture();let id;
 for(const mediaProvider of ['firecrawl','apify','none']){
  const saved=await f.request('settings',{...(id?{id}:{}),name:'Media preferences',members:{Member:['sonar']},useServerKeys:{sonar:true},mediaProvider},async()=>{throw Error('settings save must not call providers')});assert.equal(saved.status,200);id=saved.body.group.id;assert.equal(saved.body.group.mediaProvider,mediaProvider);
  const token=await issueSession(f.env,'Member');const list=await handleTripTools(new Request('https://trip.example/api/tools/settings',{headers:{Authorization:'Bearer '+token}}),f.env);assert.equal(list.status,200);assert.equal((await list.json()).groups[0].mediaProvider,mediaProvider);
  const config=JSON.parse(f.records.get('trip:integration-settings:v1'));assert.equal(config.groups[0].mediaProvider,mediaProvider);
 }
 const before=f.records.get('trip:integration-settings:v1');const invalid=await f.request('settings',{id,name:'Media preferences',mediaProvider:'arbitrary-url-provider'},async()=>{throw Error('no provider calls')});assert.equal(invalid.status,400);assert.match(invalid.body.error,/image search provider/i);assert.equal(f.records.get('trip:integration-settings:v1'),before);assert.equal(f.calls.length,0);
});
