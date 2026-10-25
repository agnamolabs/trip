// Photo desk: reads a traveler's photo roll with a cheap vision model and turns it
// into post ideas. Images are analysed in memory and never written to storage.
//
// Vision + planning run on Workers AI (account-billed, no third-party key).
// The browser downscales every photo before upload; nothing full-size is sent.
import {toolSession} from './trip-tools.mjs';

const VISION_MODEL='@cf/mistralai/mistral-small-3.1-24b-instruct';
const PLAN_MODEL='@cf/mistralai/mistral-small-3.1-24b-instruct';
const PLAN_FALLBACK='@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const MAX_PHOTOS=6;               // images per analyse request
const MAX_BODY=3_000_000;         // ~6 x 70 KB of base64 JPEG plus JSON
const MAX_PLAN_PHOTOS=150;
const VISION_TIMEOUT=25000;
const FORMATS=['single','carousel','reel','story','skip'];
const reply=(value,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const txt=(value,limit)=>typeof value==='string'?value.trim().slice(0,limit):'';
const list=(value,limit,itemLimit)=>Array.isArray(value)?value.slice(0,limit).map(v=>txt(v,itemLimit)).filter(Boolean):[];

const VISION_PROMPT='You are reading one photo from a traveler\'s roll so a writer can caption it without inventing anything.\n'
 +'Reply with JSON only:\n'
 +'{"scene":"<=7 words","subjects":["<=3"],"details":["3 concrete things you can see (objects, food, text on signs, colours, people)"],'
 +'"light":"dawn|day|golden hour|dusk|night|indoor","palette":["2 colours"],'
 +'"post":<1-5>,"format":"single|carousel|reel|story|skip","caption":"<=14 word hook using one of the details","tags":["3"]}\n'
 +'Rubric for post: 5 = stop-the-scroll frame, 4 = solid but common, 3 = ordinary snapshot, 2 = cluttered or bad light, '
 +'1 = unusable (screenshot, receipt, blur, empty). Be strict: most photos in a roll are 3. '
 +'Never name a place you cannot read. Describe only what is visible.';

const PLAN_PROMPT='You draft Instagram posts for one traveler\'s trip from photos that are already read: scene, details, light.\n'
 +'Return raw JSON only (no markdown, no commentary): {"summary":"one sentence about the roll","posts":['
 +'{"format":"single|carousel|reel|story","angle":"hero|food|city|night|detail|people","title":"<=7 words",'
 +'"caption":"40-60 words","hashtags":["<=5, no #"],"photoIds":["ids from the list"],"why":"<=12 words, a visual reason"}]}\n'
 +'Voice: first person, dry, specific. No brochure words ("discover", "hidden gem", "breathtaking"), no emoji.\n'
 +'Caption shape: two sentences. The first names one concrete detail visible in that photo. The second is a short human note about '
 +'the moment (what you were doing, what it felt like, what you would do again). Never repeat the destination name in a caption; '
 +'use it at most once across the whole set. Never describe the photo (no "the image shows"); write as if you were there.\n'
 +'Hard limits: never invent a venue, street, dish name, price, opening time, event, or a claim that something specific happened. '
 +'Captions are drafts the traveler edits, so stay inside what the photo shows and how a person would feel looking at it.\n'
 +'Structure: 4 to 6 posts, best first (higher rank is the stronger photo), one angle per post, each photo used once. '
 +'A carousel needs 3-5 photos that share light or subject. "why" names a visual property: silhouette, symmetry, repetition, '
 +'colour contrast, light. Never "beautiful scene".\n'
 +'Example of the target voice for a different roll (do not copy its facts):\n'
 +'{"summary":"Two slow days of tiles, trams and heat","posts":[{"format":"single","angle":"city","title":"Tiles and a yellow tram",'
 +'"caption":"The tram fills the gap between two tiled buildings like it was measured for it. I let three of them go past before I finally moved.",'
 +'"hashtags":["tram","tiles","streetphotography"],"photoIds":["p3"],"why":"colour contrast between tram and tiles"}]}';


function normalizeTags(value){
 const raw=value&&typeof value==='object'&&!Array.isArray(value)?value:{};
 const post=Math.round(Number(raw.post));
 return {
  scene:txt(raw.scene,90),
  subjects:list(raw.subjects,3,32),
  details:list(raw.details,3,90),
  light:txt(raw.light,14),
  vibe:txt(raw.vibe,40),
  palette:list(raw.palette,3,24),
  post:Number.isFinite(post)?Math.max(1,Math.min(5,post)):3,
  format:FORMATS.includes(raw.format)?raw.format:'single',
  caption:txt(raw.caption,180),
  tags:list(raw.tags,4,24).map(t=>t.replace(/^#/,'').replace(/[^\w\s-]/g,'')).filter(Boolean),
 };
}
function firstJson(text){
 const raw=typeof text==='string'?text:'';
 const start=raw.indexOf('{'),end=raw.lastIndexOf('}');
 if(start<0||end<=start)return null;
 try{return JSON.parse(raw.slice(start,end+1))}catch{return null}
}
function dataImage(value){
 if(typeof value!=='string'||value.length>400_000)return null;
 const match=/^data:image\/(?:jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=\s]+)$/.exec(value);
 if(!match)return null;
 const base64=match[1].replace(/\s+/g,'');
 if(base64.length<200||base64.length%4!==0)return null;
 return 'data:image/jpeg;base64,'+base64;
}
async function readBody(request,limit){
 const declared=Number(request.headers.get('content-length')||0);
 if(declared&&declared>limit)throw fail('Request too large',413);
 const reader=request.body?.getReader();const chunks=[];let size=0;
 if(reader)while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();throw fail('Request too large',413)}chunks.push(value)}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength}
 let body;try{body=JSON.parse(new TextDecoder().decode(bytes))}catch{throw fail('Invalid JSON')}
 if(!body||typeof body!=='object'||Array.isArray(body))throw fail('Invalid request body');
 return body;
}
async function visionOnce(env,image,model=VISION_MODEL){
 const call=env.AI.run(model,{
  messages:[{role:'user',content:[{type:'text',text:VISION_PROMPT},{type:'image_url',image_url:{url:image}}]}],
  max_tokens:320,temperature:0.2,
 });
 let timer;const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>reject(fail('Photo analysis timed out',504)),VISION_TIMEOUT)});
 try{
  const result=await Promise.race([call,timeout]);
  const content=result?.choices?.[0]?.message?.content??result?.response??'';
  const parsed=firstJson(content);
  if(!parsed)throw fail('The vision model returned no usable labels',502);
  return {tags:normalizeTags(parsed),neurons:result?.usage?.neurons??null};
 }catch(error){
  if(error.status)throw error;
  throw fail('Photo analysis failed',502);
 }finally{clearTimeout(timer)}
}
async function planOnce(env,body){
 const photos=Array.isArray(body.photos)?body.photos:[];
 if(!photos.length)throw fail('Analyse photos before planning posts');
 if(photos.length>MAX_PLAN_PHOTOS)throw fail('Keep a plan to '+MAX_PLAN_PHOTOS+' photos');
 const known=new Map();
 const lines=photos.map((photo,index)=>{
  if(!photo||typeof photo!=='object')return '';
  const id=txt(photo.id,40)||'p'+index;
  known.set(id,photo);
  const tags=normalizeTags(photo);
  const rank=Math.max(0,Math.min(100,Math.round(Number(photo.rank)||0)));
  return [id,'rank:'+rank,tags.scene,tags.light?'light:'+tags.light:'',
   tags.details.length?'details: '+tags.details.join('; '):'',tags.vibe].filter(Boolean).join(' | ');
 }).filter(Boolean);
 if(!lines.length)throw fail('No usable photo labels to plan from');
 const trip=body.trip&&typeof body.trip==='object'?body.trip:{};
 const context='Trip: '+(txt(trip.city,120)||'destination unknown')
  +' | dates: '+(txt(trip.depart,10)||'?')+' to '+(txt(trip.returnDate,10)||'?')
  +' | platform: Instagram';
 const messages=[
  {role:'system',content:PLAN_PROMPT},
  {role:'user',content:context+'\nPhotos (id | rank 0-100 | scene | light | details):\n'+lines.join('\n')},
 ];
 let result=await env.AI.run(PLAN_MODEL,{messages,max_tokens:2200,temperature:0.4});
 let parsed=firstJson(result?.choices?.[0]?.message?.content??result?.response??'');
 let model=PLAN_MODEL;
 if(!parsed||!Array.isArray(parsed.posts)){
  // The writer failed to produce JSON: one cheaper, stricter retry rather than a broken plan.
  const short=[...messages,{role:'user',content:'Return the same JSON shape only: at most 4 posts, captions under 35 words, no trailing text.'}];
  result=await env.AI.run(PLAN_FALLBACK,{messages:short,max_tokens:900,temperature:0.2,response_format:{type:'json_object'}});
  parsed=firstJson(result?.choices?.[0]?.message?.content??result?.response??'');
  model=PLAN_FALLBACK;
 }
 if(!parsed||!Array.isArray(parsed.posts))throw fail('The planner returned no usable posts',502);
 const posts=parsed.posts.slice(0,6).flatMap((post,index)=>{
  if(!post||typeof post!=='object')return [];
  const photoIds=list(post.photoIds,6,40).filter(id=>known.has(id));
  const caption=txt(post.caption,700);
  if(!photoIds.length||!caption)return [];
  const suggested=FORMATS.includes(post.format)&&post.format!=='skip'?post.format:'single';
  const format=suggested==='carousel'&&photoIds.length<3?'single':suggested;
  // Only a carousel carries several photos; every other format is one frame.
  const cited=format==='carousel'?photoIds:photoIds.slice(0,1);
  return [{
   id:'post-'+(index+1),
   format,
   angle:txt(post.angle,20),
   title:txt(post.title,80)||caption.split(/\n|\./)[0].slice(0,60),
   caption,
   hashtags:list(post.hashtags,10,30).filter(t=>/^#?[A-Za-z0-9_ -]{2,30}$/.test(t)).slice(0,8).map(t=>'#'+t.replace(/^#+/,'').replace(/[\s-]/g,'')).filter(t=>t.length>2),
   photoIds:cited,
   why:txt(post.why,140),
  }];
 });
 if(!posts.length)throw fail('The planner returned nothing that maps to your photos',502);
 return {summary:txt(parsed.summary,240),posts,neurons:result?.usage?.neurons??null,model};
}

export async function handlePhotoTools(request,env,fetcher=fetch){
 const path=new URL(request.url).pathname;
 if(!path.startsWith('/api/tools/photos/'))return null;
 try{
  if(request.method==='OPTIONS')return new Response(null,{headers:{'Access-Control-Allow-Origin':'','Cache-Control':'no-store'}});
  const origin=request.headers.get('origin');
  if(origin&&origin!==new URL(request.url).origin)throw fail('Same-origin requests required',403);
  const session=await toolSession(request,env);
  if(!session)throw fail('Sign in to Trip to use the photo desk',401);
  if(!env?.AI)throw fail('Photo analysis is not configured on this host',503);
  if(path==='/api/tools/photos/capabilities'&&request.method==='GET')
   return reply({vision:true,model:VISION_MODEL,planner:PLAN_MODEL,photosPerRequest:MAX_PHOTOS,maxPhotosPerPlan:MAX_PLAN_PHOTOS});
  if(request.method!=='POST')throw fail('Method not allowed',405);
  const body=await readBody(request,MAX_BODY);
  if(path==='/api/tools/photos/analyze'){
   const photos=Array.isArray(body.photos)?body.photos:[];
   if(!photos.length)throw fail('Attach at least one photo');
   if(photos.length>MAX_PHOTOS)throw fail('Send at most '+MAX_PHOTOS+' photos per request',413);
   const prepared=photos.map((photo,index)=>{
    if(!photo||typeof photo!=='object')throw fail('Invalid photo');
    const id=txt(photo.id,40)||'p'+index;
    const image=dataImage(photo.dataUrl??photo.image??photo.src);
    if(!image)throw fail('Photo '+id+' is not a resized JPEG or PNG image');
    return {id,image};
   });
   // One model call per photo, in parallel: a failure is scoped to its own photo.
   const settled=await Promise.all(prepared.map(async item=>{
    try{const {tags}=await visionOnce(env,item.image);return {id:item.id,ok:true,tags}}
    catch(error){return {id:item.id,ok:false,error:error.status?error.message:'Photo analysis failed'}}
   }));
   return reply({provider:'workers-ai',model:VISION_MODEL,results:settled,analyzedAt:new Date().toISOString()});
  }
  if(path==='/api/tools/photos/plan'){
   const planned=await planOnce(env,body);
   return reply({...planned,provider:'workers-ai',createdAt:new Date().toISOString()});
  }
  throw fail('Photo tool not found',404);
 }catch(error){return reply({error:error.status?error.message:'Photo desk failed'},error.status||500)}
}

// Exported for the harness and tests; not part of the public API.
export const PHOTO_PROMPTS={vision:VISION_PROMPT,plan:PLAN_PROMPT,models:{vision:VISION_MODEL,plan:PLAN_MODEL,fallback:PLAN_FALLBACK}};
