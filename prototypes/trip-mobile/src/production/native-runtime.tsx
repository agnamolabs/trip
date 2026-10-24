import {createContext,useContext,useEffect,useMemo,useRef,useState,type PropsWithChildren,type RefObject,type InputHTMLAttributes,type TextareaHTMLAttributes} from 'react';
import * as Dialog from '@radix-ui/react-dialog';
const ScreenContext=createContext<{screenRef:RefObject<HTMLDivElement|null>}|null>(null);
const dismiss=()=>{const el=document.activeElement;if(el instanceof HTMLElement)el.blur()};
const keyboard={visible:false,height:0,fullHeight:0,progress:0,dragOffset:0,isDragging:false,focusedElement:null,show:()=>{},hide:dismiss,setDragOffset:()=>{},setDragging:()=>{}};
function viewport(){return {width:window.visualViewport?.width||window.innerWidth,height:window.visualViewport?.height||window.innerHeight}}
export function ProductionRuntime({children}:PropsWithChildren){
 const screenRef=useRef<HTMLDivElement|null>(null),[size,setSize]=useState(viewport);
 useEffect(()=>{const update=()=>setSize(viewport());window.addEventListener('resize',update);window.visualViewport?.addEventListener('resize',update);return()=>{window.removeEventListener('resize',update);window.visualViewport?.removeEventListener('resize',update)}},[]);
 const context=useMemo(()=>({screenRef}),[]);
 return <ScreenContext.Provider value={context}><div className="production-screen" ref={screenRef} style={{height:size.height}}>{children}</div></ScreenContext.Provider>;
}
export const MobileRuntime=ProductionRuntime;
export function useScreenPortal(){const context=useContext(ScreenContext);if(!context)throw Error('Production screen is not mounted');return context}
export function useMobileDevice(){return {device:{id:'web',platform:'web',geometry:{safeArea:{top:0,bottom:0},screen:{height:window.innerHeight,width:window.innerWidth},keyboard:{height:0}}},deviceId:'web',setDeviceId:()=>{}}}
export function useKeyboard(){return keyboard}
export function useKeyboardInsets(){return {keyboardHeight:0,keyboardFullHeight:0,keyboardDragging:false,bottomInset:0,availableHeight:window.visualViewport?.height||window.innerHeight,isKeyboardVisible:false}}
export function KeyboardInput(props:InputHTMLAttributes<HTMLInputElement>&{ref?:React.Ref<HTMLInputElement>}){return <input {...props}/>}
export function KeyboardTextarea(props:TextareaHTMLAttributes<HTMLTextAreaElement>){return <textarea {...props}/>}
export function MobileScroll({className='',children}:PropsWithChildren<{className?:string}>){return <div className={'mobile-scroll production-scroll '+className}>{children}</div>}
export function BottomSheet({open,onOpenChange,title,description,children}:{open:boolean;onOpenChange:(value:boolean)=>void;title:string;description?:string;snap?:number;children?:React.ReactNode}){
 const {screenRef}=useScreenPortal();
 return <Dialog.Root open={open} onOpenChange={onOpenChange}><Dialog.Portal container={screenRef.current||undefined}><Dialog.Overlay className="sheet-overlay"/><Dialog.Content className="bottom-sheet"><div className="sheet-header"><Dialog.Title className="sheet-title">{title}</Dialog.Title><Dialog.Close className="sheet-close" aria-label="Close">×</Dialog.Close></div>{description?<Dialog.Description>{description}</Dialog.Description>:<Dialog.Description className="sr-only">{title} options</Dialog.Description>}<div className="production-sheet-scroll">{children}</div></Dialog.Content></Dialog.Portal></Dialog.Root>;
}
