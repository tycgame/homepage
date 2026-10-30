import test from 'node:test';
import assert from 'node:assert/strict';
import {PHIGROS_URL,shouldAnimateNavigation,portalGeometry,projectFromHash,createProjectNavigation} from '../navigation.js';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
class Classes{constructor(){this.values=new Set();}add(...names){names.forEach(n=>this.values.add(n));}remove(...names){names.forEach(n=>this.values.delete(n));}contains(n){return this.values.has(n);}}
function node(){const attrs=new Map(),handlers={};return {isConnected:true,classList:new Classes(),inert:false,addEventListener(type,fn){handlers[type]=fn;},setAttribute:(k,v)=>attrs.set(k,v),removeAttribute:k=>attrs.delete(k),getAttribute:k=>attrs.get(k),getBoundingClientRect:()=>({left:20,top:180,right:380,bottom:580,width:360,height:400}),handlers};}
async function fixture(action){
  const names=['window','document','history','location','innerWidth','innerHeight','CustomEvent'],saved=Object.fromEntries(names.map(n=>[n,Object.getOwnPropertyDescriptor(globalThis,n)]));
  const listeners={},shell=node(),link=node(),stage=node(),viewport=node(),slot={stage,viewport},destinations=[],releases=[],controls=[];
  let motion=false,claims=0,throwNavigation=false;
  globalThis.window={addEventListener(type,fn){(listeners[type]??=[]).push(fn);},dispatchEvent(event){listeners[event.type]?.forEach(fn=>fn(event));}};
  globalThis.document={documentElement:{clientWidth:385},body:{classList:new Classes(),style:{paddingRight:''}}};
  globalThis.location={href:'https://tycgame.github.io/homepage/#projects',pathname:'/homepage/',search:'',hash:'#projects'};
  globalThis.history={state:null,pushState(){throw new Error('must not create an embedded project route');},replaceState(state,_,url){this.state=state;const u=new URL(url,location.href);location.href=u.href;location.hash=u.hash;}};
  globalThis.innerWidth=400;globalThis.innerHeight=800;
  if(!globalThis.CustomEvent)globalThis.CustomEvent=class extends Event{constructor(type,{detail}){super(type);this.detail=detail;}};
  const pool={entries:new Map([['phigros',{url:PHIGROS_URL,title:'TYC Phigros'}]]),claim(){claims++;return slot;},release:id=>releases.push(id)};
  const navigation=createProjectNavigation({pool,motionEnabled:()=>motion,shell,navigate:url=>{if(throwNavigation)throw new Error('blocked');destinations.push(url);}});navigation.bind(link,'phigros');
  function animate(){let resolve;const finished=new Promise(yes=>{resolve=yes;});const control={finished,finish:resolve,cancel:resolve};controls.push(control);return control;}
  const f={navigation,pool,link,slot,shell,destinations,releases,controls,motion(value){motion=value;if(value)stage.animate=viewport.animate=animate;},blockNavigation(){throwNavigation=true;},get claims(){return claims;}};
  try{await action(f);}finally{navigation.reset();for(const name of names){if(saved[name])Object.defineProperty(globalThis,name,saved[name]);else delete globalThis[name];}}
}

test('modified clicks remain native links',()=>{
  const event={button:0,defaultPrevented:false};assert.ok(shouldAnimateNavigation(event));for(const key of ['metaKey','ctrlKey','shiftKey','altKey','defaultPrevented'])assert.equal(shouldAnimateNavigation({...event,[key]:true}),false);assert.equal(shouldAnimateNavigation({...event,button:1}),false);
});
test('handoff keeps uniform scale and clips from the entry card',()=>{
  const g=portalGeometry({left:20,top:180,right:380,bottom:580,width:360,height:400},{width:400,height:800});assert.equal(g.transform,'translate(0px, -20px) scale(0.5)');assert.equal(g.clip,'inset(180px 20px 220px 20px round 18px)');
  assert.equal(projectFromHash('#project=phigros'),'phigros');assert.equal(projectFromHash('#projects'),null);assert.equal(projectFromHash('#project=%zz'),null);
});
test('reduced motion commits directly to the real canonical site URL',async()=>fixture(async f=>{
  await f.navigation.open('phigros',f.link);assert.deepEqual(f.destinations,[PHIGROS_URL]);assert.equal(location.hash,'#projects');assert.equal(f.claims,1);
}));
test('cold preload does not delay a real navigation',async()=>fixture(async f=>{
  f.pool.claim=()=>null;await f.navigation.open('phigros',f.link);assert.deepEqual(f.destinations,[PHIGROS_URL]);assert.equal(f.navigation.isOpen,true);
}));
test('animation uses the preview and navigates exactly once after it finishes',async()=>fixture(async f=>{
  f.motion(true);const opening=f.navigation.open('phigros',f.link);await f.navigation.open('phigros',f.link);assert.equal(f.destinations.length,0);assert.equal(f.controls.length,2);assert.equal(f.claims,1);assert.equal(document.body.style.paddingRight,'15px');
  f.controls.forEach(a=>a.finish());await opening;assert.deepEqual(f.destinations,[PHIGROS_URL]);assert.ok(f.slot.stage.classList.contains('is-active'));
}));
test('leaving during an animation cancels the pending redirect',async()=>fixture(async f=>{
  f.motion(true);const opening=f.navigation.open('phigros',f.link);window.dispatchEvent(new Event('pagehide'));await opening;assert.equal(f.destinations.length,0);assert.equal(f.navigation.isOpen,false);
}));
test('Back restoration removes the overlay and unlocks the home page',async()=>fixture(async f=>{
  f.motion(true);const opening=f.navigation.open('phigros',f.link);f.controls.forEach(a=>a.finish());await opening;window.dispatchEvent(new Event('pagehide'));assert.ok(f.slot.stage.classList.contains('is-active'));const show=new Event('pageshow');Object.defineProperty(show,'persisted',{value:true});window.dispatchEvent(show);
  assert.equal(f.navigation.isOpen,false);assert.equal(f.slot.stage.classList.contains('is-active'),false);assert.equal(f.shell.inert,false);assert.equal(document.body.style.paddingRight,'');assert.equal(f.link.getAttribute('aria-busy'),undefined);
}));
test('a failed Web Animations implementation does not trap the visitor',async()=>fixture(async f=>{
  f.motion(true);f.slot.stage.animate=()=>{throw new Error('unavailable');};await f.navigation.open('phigros',f.link);assert.deepEqual(f.destinations,[PHIGROS_URL]);
}));
test('a blocked navigation restores normal home interaction',async()=>fixture(async f=>{
  f.blockNavigation();await f.navigation.open('phigros',f.link);assert.equal(f.navigation.isOpen,false);assert.equal(f.shell.inert,false);
}));
test('old embedded project bookmarks become real navigation without a redirect loop',async()=>fixture(async f=>{
  location.hash='#project=phigros';f.navigation.restoreLegacyRoute();await tick();assert.equal(location.hash,'');assert.deepEqual(f.destinations,[PHIGROS_URL]);
}));
test('a late initial pageshow cannot cancel a click while the game is warming',async()=>fixture(async f=>{
  f.motion(true);const opening=f.navigation.open('phigros',f.link);window.dispatchEvent(new Event('pageshow'));assert.equal(f.navigation.isOpen,true);f.controls.forEach(a=>a.finish());await opening;assert.deepEqual(f.destinations,[PHIGROS_URL]);
}));
