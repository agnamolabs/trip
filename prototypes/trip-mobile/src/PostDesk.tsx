import {useRef,useState} from 'react';
import {ImageIcon,CopyIcon,PlusIcon} from '@radix-ui/react-icons';
import {apiRequest} from './integration-api';
import type {LivePost,PostShot} from './live-trip';

type Status='queued'|'working'|'done'|'skipped'|'failed';
type Shot={id:string;name:string;thumb:string;analysis:string;hash:string;status:Status;sharp:number;rank:number;portrait:boolean;tags?:PostShot;error?:string};
type Plan={summary:string;posts:LivePost[]};

const JPEG_ANALYSIS=512;
const ANALYSIS_QUALITY=0.7;
const THUMB=280;
const BATCH=6;
const CONCURRENCY=3;
const MAX_PHOTOS=800;

function hamming(a:string,b:string){let n=0;for(let i=0;i<a.length;i++)if(a[i]!==b[i])n++;return n}

function canvasUrl(bitmap:ImageBitmap|HTMLImageElement,width:number,quality:number){
 const scale=Math.min(1,width/Math.max(bitmap.width,bitmap.height));
 const canvas=document.createElement('canvas');
 canvas.width=Math.max(1,Math.round(bitmap.width*scale));
 canvas.height=Math.max(1,Math.round(bitmap.height*scale));
 const context=canvas.getContext('2d');
 if(!context)return '';
 context.drawImage(bitmap,0,0,canvas.width,canvas.height);
 return canvas.toDataURL('image/jpeg',quality);
}

function perceptualHash(source:ImageBitmap|HTMLImageElement){
 const canvas=document.createElement('canvas');
 canvas.width=9;canvas.height=8;
 const context=canvas.getContext('2d');
 if(!context)return '';
 context.drawImage(source,0,0,9,8);
 const {data}=context.getImageData(0,0,9,8);
 const grey:number[]=[];
 for(let i=0;i<data.length;i+=4)grey.push(0.299*data[i]+0.587*data[i+1]+0.114*data[i+2]);
 let bits='';
 for(let row=0;row<8;row++)for(let col=0;col<8;col++)bits+=grey[row*9+col]>grey[row*9+col+1]?'1':'0';
 return bits;
}

function sharpness(source:ImageBitmap|HTMLImageElement){
 const canvas=document.createElement('canvas');
 canvas.width=96;canvas.height=96;
 const context=canvas.getContext('2d');
 if(!context)return {value:0,portrait:false};
 context.drawImage(source,0,0,96,96);
 const {data}=context.getImageData(0,0,96,96);
 const grey=new Float32Array(96*96);
 for(let i=0;i<grey.length;i++){const p=i*4;grey[i]=0.299*data[p]+0.587*data[p+1]+0.114*data[p+2]}
 let sum=0,sumSquares=0,count=0;
 for(let y=1;y<95;y++)for(let x=1;x<95;x++){
  const i=y*96+x;
  const value=4*grey[i]-grey[i-1]-grey[i+1]-grey[i-96]-grey[i+96];
  sum+=value;sumSquares+=value*value;count++;
 }
 const mean=sum/count,variance=Math.max(0,sumSquares/count-mean*mean);
 return {value:Math.min(1,Math.log1p(variance)/Math.log1p(1500)),portrait:source.height>source.width};
}
function rankOf(post:number,sharp:number,portrait:boolean){
 return Math.max(0,Math.min(100,Math.round(100*(0.5*(post/5)+0.35*sharp+0.15*(portrait?1:0.35)))));
}

async function loadBitmap(file:File):Promise<ImageBitmap|HTMLImageElement>{
 if(typeof createImageBitmap==='function'){
  try{return await createImageBitmap(file)}catch{/* fall through to the Image path */}
 }
 return await new Promise((resolve,reject)=>{
  const url=URL.createObjectURL(file);
  const image=new Image();
  image.onload=()=>{URL.revokeObjectURL(url);resolve(image)};
  image.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('This image could not be read.'))};
  image.src=url;
 });
}

const formatLabel=(value:string)=>value==='carousel'?'Carousel':value==='reel'?'Reel':value==='story'?'Story':'Single';
const score=(shot:Shot)=>shot.tags?.post??0;

export default function PostDesk({city,canEdit,saved,onSave}:{city:string;canEdit:boolean;saved:LivePost[];onSave:(posts:LivePost[])=>Promise<boolean>}){
 const [shots,setShots]=useState<Shot[]>([]);
 const [preparing,setPreparing]=useState(0);
 const [working,setWorking]=useState(false);
 const [planning,setPlanning]=useState(false);
 const [saving,setSaving]=useState(false);
 const [plan,setPlan]=useState<Plan|null>(null);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const [openCaption,setOpenCaption]=useState('');
 const inputRef=useRef<HTMLInputElement>(null);

 const analysed=shots.filter(shot=>shot.status==='done');
 const skipped=shots.filter(shot=>shot.status==='skipped');
 const failed=shots.filter(shot=>shot.status==='failed');
 const duplicateCount=skipped.length;

 function say(message:string){setNotice(message);setTimeout(()=>setNotice(current=>current===message?'':current),4000)}

 async function ingest(files:File[]){
  if(working||planning)return;
  const images=files.filter(file=>file.type.startsWith('image/'));
  setError(images.length?'' : 'Those files are not photos.');
  if(!images.length)return;
  if(shots.length+images.length>MAX_PHOTOS){setError('This roll holds '+MAX_PHOTOS+' photos. Clear it before adding more.');return}
  setPlan(null);
  const prepared:(Omit<Shot,'status'|'rank'> & {portrait:boolean}|null)[]=images.map(()=>null);let done=0;let cursor=0;
  setPreparing(images.length);
  async function worker(){
   while(cursor<images.length){
    const index=cursor++;
    const file=images[index];
    try{
     const bitmap=await loadBitmap(file);
     const analysis=canvasUrl(bitmap,JPEG_ANALYSIS,ANALYSIS_QUALITY);
     const thumb=canvasUrl(bitmap,THUMB,0.6);
     const hash=perceptualHash(bitmap);
     const focus=sharpness(bitmap);
     if(typeof ImageBitmap!=='undefined'&&bitmap instanceof ImageBitmap)bitmap.close();
     if(!analysis||!thumb)throw new Error('This image could not be prepared.');
     prepared[index]={id:'p'+Date.now()+Math.random().toString(36).slice(2,6),name:file.name,thumb,analysis,hash,sharp:focus.value,portrait:focus.portrait};
    }catch(reason){setError((reason as Error).message||'A photo could not be read.')}
    done++;setPreparing(images.length-done);
   }
  }
  await Promise.all(Array.from({length:Math.min(4,images.length)},worker));
  // Cluster bursts after decoding so the order of the roll is preserved.
  const known=[...shots.map(shot=>shot.hash).filter(Boolean)];
  const fresh:Shot[]=prepared.filter((item):item is NonNullable<typeof item>=>!!item).map(item=>{
   const twin=known.find(existing=>hamming(existing,item.hash)<=8);
   known.push(item.hash);
   return {...item,status:twin?'skipped':'queued' as Status,rank:rankOf(4,item.sharp,item.portrait)};
  });
  setPreparing(0);setShots(current=>[...current,...fresh]);
  const queue=fresh.filter(shot=>shot.status==='queued');
  if(queue.length)await analyse(queue);
 }

 async function analyse(queue:Shot[]){
  setWorking(true);setError('');let cursor=0;
  const patch=(ids:string[],values:Partial<Shot>)=>setShots(current=>current.map(shot=>ids.includes(shot.id)?{...shot,...values}:shot));
  const batches:Shot[][]=[];
  for(let index=0;index<queue.length;index+=BATCH)batches.push(queue.slice(index,index+BATCH));
  let failed=0;let firstError='';
  async function runner(){
   while(cursor<batches.length){
    const batch=batches[cursor++];
    patch(batch.map(shot=>shot.id),{status:'working'});
    try{
     const result=await apiRequest<{results:{id:string;ok:boolean;tags?:PostShot;error?:string}[]}>('/api/tools/photos/analyze',{
      photos:batch.map(shot=>({id:shot.id,dataUrl:shot.analysis})),
     });
     const seen=new Set<string>();
     for(const item of result.results||[]){
      seen.add(item.id);
      if(item.ok&&item.tags){
       setShots(current=>current.map(shot=>shot.id===item.id?{...shot,status:'done',tags:item.tags,rank:rankOf(item.tags!.post,shot.sharp,shot.portrait)}:shot));
      }else{
       failed+=1;firstError=firstError||item.error||'';
       patch([item.id],{status:'failed',error:item.error||'Photo analysis failed'});
      }
     }
     // A photo the service never answered for must not sit on "working" forever.
     const unanswered=batch.filter(shot=>!seen.has(shot.id));
     if(unanswered.length){
      failed+=unanswered.length;firstError=firstError||'The reader returned no result for some photos.';
      patch(unanswered.map(shot=>shot.id),{status:'failed',error:'No result returned'});
     }
    }catch(error){
     const message=error instanceof Error?error.message:'Photo analysis failed';
     failed+=batch.length;firstError=firstError||message;
     patch(batch.map(shot=>shot.id),{status:'failed',error:message});
    }
   }
  }
  await Promise.all(Array.from({length:Math.min(CONCURRENCY,batches.length)},runner));
  setWorking(false);
  if(failed)setError(failed+(failed===1?' photo could not be read. ':' photos could not be read. ')+(firstError||'Try again in a moment.'));
 }

 async function makePlan(){
  const ready=shots.filter(shot=>shot.status==='done'&&shot.tags);
  if(!ready.length){setError('Read at least one photo first.');return}
  setPlanning(true);setError('');setPlan(null);
  try{
   const payload=ready.slice(0,150).map(shot=>({id:shot.id,...shot.tags,rank:shot.rank}));
   const result=await apiRequest<Plan & {vendor?:string}>('/api/tools/photos/plan',{photos:payload,trip:{city}});
   if(!Array.isArray(result.posts)||!result.posts.length)throw new Error('No post ideas came back. Try again.');
   setPlan({summary:result.summary||'',posts:result.posts});
  }catch(reason){setError((reason as Error).message||'Post ideas could not be created.')}
  finally{setPlanning(false)}
 }

 async function copy(text:string){
  try{await navigator.clipboard.writeText(text);say('Caption copied')}
  catch{setError('Copying is blocked in this browser. Select the caption to copy it.')}
 }

 async function save(){
  if(!plan)return;
  setSaving(true);setError('');
  const savedOk=await onSave(plan.posts);
  setSaving(false);
  if(savedOk)say('Saved to this trip');
  else setError('The plan was not saved. Check the trip and try again.');
 }

 const captionOf=(post:LivePost)=>post.caption+' '+(post.hashtags||[]).join(' ');

 return <div className="post-desk">
  <p className="eyebrow">PHOTOS → POSTS</p>
  <h1>Your best shots.</h1>
  <p className="quiet">Drop the roll from this trip. Trip reads each photo, keeps the post-worthy ones and writes the captions.</p>

  <input ref={inputRef} className="file-input" type="file" accept="image/*" multiple onChange={event=>{const files=Array.from(event.target.files||[]);event.target.value='';void ingest(files)}}/>
  <button className="post-drop" disabled={working||planning} onClick={()=>inputRef.current?.click()} onDragOver={event=>event.preventDefault()} onDrop={event=>{event.preventDefault();void ingest(Array.from(event.dataTransfer.files||[]))}}>
   <span className="post-drop-icon"><ImageIcon/></span>
   <span><b>{shots.length?'Add more photos':'Add photos'}</b><small>Resized on your device before upload. Full photos are never stored.</small></span>
   <PlusIcon/>
  </button>

  {preparing>0&&<p className="post-note" role="status">Preparing {preparing} photo{preparing===1?'':'s'} on this device…</p>}
  {shots.length>0&&<div className="post-progress">
   <div className="post-progress-top">
    <b>{working?`Reading ${analysed.length+failed.length} of ${analysed.length+failed.length+shots.filter(shot=>shot.status==='queued'||shot.status==='working').length}`:`${analysed.length} ready to post`}</b>
    <span>{duplicateCount?`${duplicateCount} near-duplicate${duplicateCount===1?'':'s'} skipped`:''}</span>
   </div>
   <progress value={analysed.length+failed.length} max={Math.max(1,working?analysed.length+failed.length+shots.filter(shot=>shot.status==='queued'||shot.status==='working').length:shots.length)}/>
  </div>}

  {shots.length>0&&<div className="post-roll">
   {shots.map(shot=><figure key={shot.id} className={'post-shot '+shot.status} title={shot.error||shot.tags?.scene||shot.name}>
    <img src={shot.thumb} alt={shot.tags?.scene||shot.name}/>
    {shot.status==='done'&&<figcaption>{shot.tags?.post===5?'Strong':shot.tags?.post===4?'Good':shot.tags?.post===3?'Maybe':'Skip'}</figcaption>}
    {shot.status==='failed'&&<figcaption>Unread</figcaption>}
    {shot.status==='skipped'&&<figcaption>Duplicate</figcaption>}
   </figure>)}
  </div>}

  {shots.length>0&&<div className="post-actions">
   <button className="primary" disabled={working||planning||!analysed.length||!canEdit} onClick={()=>void makePlan()}>
    {planning?'Writing post ideas…':(plan?'Rewrite post ideas':'Make post ideas')}
   </button>
   <button className="post-clear" disabled={working||planning||saving} onClick={()=>{setShots([]);setPlan(null);setError('')}}>Clear roll</button>
  </div>}
  {!canEdit&&shots.length>0&&<p className="post-note">This trip is read-only for your account, so ideas cannot be saved.</p>}

  {error&&<div className="live-error"><p role="alert">{error}</p></div>}

  {plan&&<section className="post-plan">
   {plan.summary&&<p className="post-summary">{plan.summary}</p>}
   {plan.posts.map(post=>{
    const photos=post.photoIds.map(id=>shots.find(shot=>shot.id===id)).filter(Boolean) as Shot[];
    const open=openCaption===post.id;
    return <article className="post-card" key={post.id}>
     <div className="post-card-top"><span className={'post-format '+post.format}>{formatLabel(post.format)}</span>{photos[0]&&score(photos[0])===5&&<span className="post-pick">Top pick</span>}<span className="micro">{photos.length} photo{photos.length===1?'':'s'}</span></div>
     <h2>{post.title}</h2>
     <p className="post-draft">Draft · edit before posting</p>
     <p className={'post-caption'+(open?' open':'')}>{post.caption}</p>
     {post.caption.length>160&&<button className="post-more" onClick={()=>setOpenCaption(open?'':post.id)}>{open?'Show less':'Read full caption'}</button>}
     {!!post.hashtags?.length&&<p className="post-tags">{post.hashtags.map(tag=>tag.startsWith('#')?tag:'#'+tag).join(' ')}</p>}
     <div className="post-card-shots">{photos.slice(0,6).map(photo=><img key={photo.id} src={photo.thumb} alt={photo.tags?.scene||photo.name}/>)}</div>
     {post.why&&<p className="post-why">{post.why}</p>}
     <div className="post-card-actions">
      <button onClick={()=>void copy(captionOf(post))}><CopyIcon/>Copy caption</button>
     </div>
    </article>;
   })}
   <button className="primary wide" disabled={!canEdit||saving} onClick={()=>void save()}>{saving?'Saving…':'Save these ideas to the trip'}</button>
  </section>}

  {!plan&&!!saved?.length&&<section className="post-plan">
   <p className="eyebrow">SAVED TO THIS TRIP</p>
   {saved.map(post=><article className="post-card" key={post.id}>
    <div className="post-card-top"><span className={'post-format '+post.format}>{formatLabel(post.format)}</span></div>
    <h2>{post.title}</h2>
    <p className="post-caption open">{post.caption}</p>
    {!!post.hashtags?.length&&<p className="post-tags">{post.hashtags.map(tag=>tag.startsWith('#')?tag:'#'+tag).join(' ')}</p>}
    <div className="post-card-actions"><button onClick={()=>void copy(captionOf(post))}><CopyIcon/>Copy caption</button></div>
   </article>)}
  </section>}

  {notice&&<div role="status" className="toast">{notice}</div>}
  {!shots.length&&<p className="post-note">Nothing leaves this device except a 512-pixel copy of each photo, sent once for reading. Photos are not saved.</p>}
 </div>;
}
