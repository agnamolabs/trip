// Small, escaped Markdown renderer for AI answers.
// Handles headings, lists, tables, code, quotes, emphasis, https links, [n] citations
// and [map:Place] chips. Nothing is ever injected as HTML — every token becomes a text node.
import {Fragment} from 'react';

function safeLink(value:string|undefined){
 if(!value)return null;
 try{
  const url=new URL(value);
  if(url.protocol!=='https:'||url.username||url.password)return null;
  if(!url.hostname.includes('.')||url.hostname.endsWith('.local')||url.hostname.endsWith('.internal'))return null;
  if(/^(localhost|127\.|10\.|192\.168\.|169\.254\.)/.test(url.hostname))return null;
  return url.href;
 }catch{return null}
}

type Inline={kind:'text'|'strong'|'em'|'code'|'strike'|'link'|'cite'|'map';text:string;href?:string};
export type Block=
 |{type:'heading';level:number;text:string}
 |{type:'paragraph';text:string}
 |{type:'list';ordered:boolean;items:{depth:number;text:string;ordered:boolean}[]}
 |{type:'code';lang:string;text:string}
 |{type:'quote';text:string}
 |{type:'table';head:string[];rows:string[][]}
 |{type:'rule'};

const INLINE=/(`[^`\n]+`|\*\*[^*\n]+\*\*|__[^_\n]+__|~~[^~\n]+~~|\*[^*\n]+\*|_[^_\n]+_|\[[^\]\n]+\]\(https:\/\/[^\s)]+\)|\[\d+\]|\[map:[^\]\n]{1,80}\])/g;

export function inlineTokens(line:string):Inline[]{
 const parts=line.split(INLINE).filter(part=>part!=='');
 return parts.map<Inline>(part=>{
  if(part.startsWith('`')&&part.endsWith('`')&&part.length>2)return{kind:'code',text:part.slice(1,-1)};
  if((part.startsWith('**')&&part.endsWith('**'))||(part.startsWith('__')&&part.endsWith('__')))return{kind:'strong',text:part.slice(2,-2)};
  if(part.startsWith('~~')&&part.endsWith('~~'))return{kind:'strike',text:part.slice(2,-2)};
  if((part.startsWith('*')&&part.endsWith('*'))||(part.startsWith('_')&&part.endsWith('_')))return{kind:'em',text:part.slice(1,-1)};
  const link=/^\[([^\]]+)\]\((https:\/\/[^\s)]+)\)$/.exec(part);
  if(link)return{kind:'link',text:link[1],href:link[2]};
  const cite=/^\[(\d+)\]$/.exec(part);
  if(cite)return{kind:'cite',text:cite[1]};
  const map=/^\[map:([^\]]+)\]$/.exec(part);
  if(map)return{kind:'map',text:map[1].trim()};
  return{kind:'text',text:part};
 });
}

const LIST=/^(\s*)([-*+]|\d+[.)])\s+(.*)$/;
const isTableRow=(line:string)=>line.trim().startsWith('|')&&line.trim().endsWith('|');
const splitRow=(line:string)=>line.trim().slice(1,-1).split('|').map(cell=>cell.trim());

export function parseBlocks(source:string):Block[]{
 const lines=String(source||'').replace(/\r\n?/g,'\n').split('\n');
 const blocks:Block[]=[];let index=0;
 while(index<lines.length){
  const line=lines[index];
  if(!line.trim()){index++;continue}
  if(/^\s*```/.test(line)){
   const lang=line.trim().slice(3).trim();const body:string[]=[];index++;
   while(index<lines.length&&!/^\s*```/.test(lines[index]))body.push(lines[index++]);
   index++;
   blocks.push({type:'code',lang,text:body.join('\n')});continue;
  }
  const heading=/^\s*(#{1,6})\s+(.*)$/.exec(line);
  if(heading){blocks.push({type:'heading',level:Math.min(4,Math.max(2,heading[1].length)),text:heading[2].trim()});index++;continue}
  if(/^\s*([-*_])\s*\1\s*\1[\s\-*_]*$/.test(line.trim())){blocks.push({type:'rule'});index++;continue}
  if(/^\s*>\s?/.test(line)){
   const body:string[]=[];
   while(index<lines.length&&/^\s*>\s?/.test(lines[index]))body.push(lines[index++].replace(/^\s*>\s?/,''));
   blocks.push({type:'quote',text:body.join(' ')});continue;
  }
  if(isTableRow(line)&&isTableRow(lines[index+1]||'')&&/^[\s|:-]+$/.test(lines[index+1])){
   const head=splitRow(line);index+=2;const rows:string[][]=[];
   while(index<lines.length&&isTableRow(lines[index]))rows.push(splitRow(lines[index++]));
   blocks.push({type:'table',head,rows});continue;
  }
  const list=LIST.exec(line);
  if(list){
   const items:{depth:number;text:string;ordered:boolean}[]=[];const ordered=/\d/.test(list[2]);
   while(index<lines.length){
    const match=LIST.exec(lines[index]);
    if(match){items.push({depth:Math.min(2,Math.floor(match[1].replace(/\t/g,'  ').length/2)),text:match[3].trim(),ordered:/\d/.test(match[2])});index++;continue}
    if(lines[index].trim()&&/^\s{2,}\S/.test(lines[index])&&items.length){items[items.length-1].text+=' '+lines[index].trim();index++;continue}
    break;
   }
   blocks.push({type:'list',ordered,items});continue;
  }
  const body:string[]=[];
  while(index<lines.length&&lines[index].trim()&&!LIST.test(lines[index])&&!/^\s*(#{1,6})\s|^\s*```|^\s*>/.test(lines[index])&&!isTableRow(lines[index]))body.push(lines[index++].trim());
  blocks.push({type:'paragraph',text:body.join(' ')});
 }
 return blocks;
}

type Action={type:'map';value:string};

function Rendered({tokens,citations,onAction}:{tokens:Inline[];citations:string[];onAction?:(action:Action)=>void}){
 return <>{tokens.map((token,index)=>{
  if(token.kind==='strong')return <strong key={index}>{token.text}</strong>;
  if(token.kind==='em')return <em key={index}>{token.text}</em>;
  if(token.kind==='strike')return <s key={index}>{token.text}</s>;
  if(token.kind==='code')return <code key={index}>{token.text}</code>;
  if(token.kind==='link'){const href=safeLink(token.href);return href?<a key={index} href={href} target="_blank" rel="noopener noreferrer">{token.text}</a>:<Fragment key={index}>{token.text}</Fragment>}
  if(token.kind==='cite'){
   const href=safeLink(citations[Number(token.text)-1]);
   return href?<a className="md-cite" key={index} href={href} target="_blank" rel="noopener noreferrer">{token.text}</a>:<sup className="md-cite-plain" key={index}>{token.text}</sup>;
  }
  if(token.kind==='map'){
   if(!onAction)return <span key={index}>{token.text}</span>;
   return <button type="button" className="md-chip" key={index} onClick={()=>onAction({type:'map',value:token.text})}><span aria-hidden="true">◎</span>{token.text ? 'Show '+token.text : 'Show on map'}</button>;
  }
  return <Fragment key={index}>{token.text}</Fragment>;
 })}</>;
}

type ListNode={depth:number;text:string;ordered:boolean;children:ListNode[]};

function NestedList({items,citations,onAction}:{ordered:boolean;items:{depth:number;text:string;ordered:boolean}[];citations:string[];onAction?:(action:Action)=>void}){
 const tree:ListNode[]=[];
 const stack:ListNode[]=[];
 for(const item of items){
  const node:ListNode={depth:item.depth,text:item.text,ordered:item.ordered,children:[]};
  while(stack.length&&stack[stack.length-1].depth>=node.depth)stack.pop();
  if(stack.length)stack[stack.length-1].children.push(node);else tree.push(node);
  stack.push(node);
 }
 const render=(nodes:ListNode[],key:string)=>{
  if(!nodes.length)return null;
  const Tag=nodes[0].ordered?'ol':'ul';
  return <Tag key={key}>{nodes.map((node,index)=><li key={key+index}><Rendered tokens={inlineTokens(node.text)} citations={citations} onAction={onAction}/>{render(node.children,key+index+'.')}</li>)}</Tag>;
 };
 return render(tree,'l');
}

export default function Markdown({value,citations=[],onAction}:{value:string;citations?:string[];onAction?:(action:Action)=>void}){
 const blocks=parseBlocks(value);
 return <div className="md">{blocks.map((block,index)=>{
  if(block.type==='heading'){const Tag=('h'+block.level) as 'h2';return <Tag key={index}><Rendered tokens={inlineTokens(block.text)} citations={citations} onAction={onAction}/></Tag>}
  if(block.type==='list')return <NestedList key={index} ordered={block.ordered} items={block.items} citations={citations} onAction={onAction}/>;
  if(block.type==='code')return <pre key={index} className="md-pre"><code>{block.text}</code></pre>;
  if(block.type==='quote')return <blockquote key={index}><Rendered tokens={inlineTokens(block.text)} citations={citations} onAction={onAction}/></blockquote>;
  if(block.type==='rule')return <hr key={index}/>;
  if(block.type==='table')return <div className="md-table-wrap" key={index}><table className="md-table"><thead><tr>{block.head.map((cell,column)=><th key={column}>{<Rendered tokens={inlineTokens(cell)} citations={citations} onAction={onAction}/>}</th>)}</tr></thead><tbody>{block.rows.map((row,rowIndex)=><tr key={rowIndex}>{row.map((cell,column)=><td key={column}>{<Rendered tokens={inlineTokens(cell)} citations={citations} onAction={onAction}/>}</td>)}</tr>)}</tbody></table></div>;
  return <p key={index}><Rendered tokens={inlineTokens(block.text)} citations={citations} onAction={onAction}/></p>;
 })}</div>;
}
