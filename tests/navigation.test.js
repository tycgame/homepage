import test from 'node:test';
import assert from 'node:assert/strict';
import {PHIGROS_URL,shouldAnimateNavigation,portalGeometry,projectFromHash,createProjectNavigation} from '../navigation.js';

const tick=()=>new Promise(resolve=>setImmediate(resolve));
class Classes {constructor(){this.values=new Set();}add(...names){names.forEach(n=>this.values.add(n));}remove(...names){names.forEach(n=>this.values.delete(n));}contains(n){return this.values.has(n);}}
function node() {const attrs=new Map();return {isConnected:true,classList:new Classes(),inert:false,addEventListener(){},focus(){this.focused=true;},setAttribute:(k,v)=>attrs.set(k,v),removeAttribute:k=>attrs.delete(k),getAttribute:k=>attrs.get(k),getBoundingClientRect:()=>({left:20,top:180,right:380,bottom:580,width:360,height:400})};}
async function browserFixture(action) {
  const names=['window','document','history','location','innerWidth','innerHeight','CustomEvent'],saved=Object.fromEntries(names.map(n=>[n,Object.getOwnPropertyDescriptor(globalThis,n)]));
  const listeners={},shell=node(),link=node(),stage=node(),frame=node(),viewport=node(),entry={title:'TYC Phigros'};
  let resolveReady,rejectReady,motion=false,pushes=0,backs=0,acquires=0;const releases=[],notices=[];
  const slot={stage,frame,viewport};const ready=new Promise((resolve,reject)=>{resolveReady=()=>resolve(slot);rejectReady=reject;});
  globalThis.window={addEventListener(name,fn){(listeners[name]??=[]).push(fn);},dispatchEvent(event){listeners[event.type]?.forEach(fn=>fn(event));}};
  globalThis.document={title:'TYC Home',documentElement:{clientWidth:385},body:{style:{paddingRight:''},classList:new Classes()}};
  globalThis.location={href:'https://tycgame.github.io/homepage/#worlds',hash:'#worlds'};
  const setURL=value=>{const u=new URL(value,location.href);location.href=u.href;location.hash=u.hash;};
  const home=location.href;
  globalThis.history={state:null,pushState(state,_,url){pushes++;this.state=state;setURL(url);},replaceState(state,_,url){this.state=state;setURL(url);},back(){backs++;this.state=null;setURL(home);window.dispatchEvent(new Event('popstate'));window.dispatchEvent(new Event('hashchange'));}};
  globalThis.innerWidth=400;globalThis.innerHeight=800;
  if(!globalThis.CustomEvent)globalThis.CustomEvent=class extends Event {constructor(name,{detail}){super(name);this.detail=detail;}};
  const pool={entries:new Map([['phigros',entry]]),acquire(){acquires++;return ready;},release(id,options){releases.push([id,options]);}};
  const navigation=createProjectNavigation({pool,motionEnabled:()=>motion,shell,notify:message=>notices.push(message)});
  navigation.bind(link,'phigros');
  const f={navigation,link,slot,shell,resolveReady,rejectReady,releases,notices,listeners,motion:v=>motion=v,get pushes(){return pushes;},get backs(){return backs;},get acquires(){return acquires;}};
  try{await action(f);}finally{for(const name of names){if(saved[name])Object.defineProperty(globalThis,name,saved[name]);else delete globalThis[name];}}
}

test('normal clicks enter the workspace while modified clicks preserve native links',()=>{
  const base={button:0,defaultPrevented:false};assert.ok(shouldAnimateNavigation(base));
  for(const modifier of ['metaKey','ctrlKey','shiftKey','altKey','defaultPrevented'])assert.equal(shouldAnimateNavigation({...base,[modifier]:true}),false);
  assert.equal(shouldAnimateNavigation({...base,button:1}),false);assert.equal(shouldAnimateNavigation({...base,button:2}),false);
  assert.equal(PHIGROS_URL,'https://tycofficial.github.io/phigros/');
});
test('page geometry uses uniform scaling and a card mask without stretching the game',()=>{
  const g=portalGeometry({left:20,top:180,right:380,bottom:580,width:360,height:400},{width:400,height:800});
  assert.equal(g.transform,'translate(0px, -20px) scale(0.9)');assert.equal(g.clip,'inset(180px 20px 220px 20px round 3px)');
  assert.ok(!/NaN|Infinity/.test(JSON.stringify(portalGeometry({left:0,top:0,right:0,bottom:0,width:0,height:0},{width:0,height:0}))));
  assert.equal(projectFromHash('#project=phigros'),'phigros');assert.equal(projectFromHash('#worlds'),null);assert.equal(projectFromHash('#project=%zz'),null);
});
test('a click waits honestly for cold preload and then reveals that same document',async()=>browserFixture(async f=>{
  const opening=f.navigation.open('phigros',f.link);assert.equal(f.slot.stage.classList.contains('is-active'),false);assert.equal(f.link.getAttribute('aria-busy'),'true');
  f.resolveReady();await opening;assert.equal(f.slot.stage.classList.contains('is-active'),true);assert.equal(f.shell.inert,true);assert.equal(f.slot.frame.focused,true);assert.equal(f.pushes,1);assert.equal(document.body.style.paddingRight,'15px');
  f.navigation.close();await tick();assert.equal(f.navigation.isOpen,false);assert.equal(f.releases.at(-1)[1].discard,true);assert.equal(f.shell.inert,false);assert.equal(document.body.style.paddingRight,'');
}));
test('duplicate taps create one history entry and acquire one live page',async()=>browserFixture(async f=>{
  const opening=f.navigation.open('phigros',f.link);await f.navigation.open('phigros',f.link);assert.equal(f.pushes,1);assert.equal(f.acquires,1);
  f.resolveReady();await opening;f.navigation.close();f.navigation.close();await tick();assert.equal(f.backs,1);
}));
test('Back during cold preload cancels the pending entry without stealing navigation later',async()=>browserFixture(async f=>{
  const opening=f.navigation.open('phigros',f.link);f.navigation.close();await tick();f.resolveReady();await opening;
  assert.equal(f.navigation.isOpen,false);assert.equal(f.slot.stage.classList.contains('is-active'),false);assert.equal(f.releases[0][1].discard,false);assert.equal(location.hash,'#worlds');
}));
test('reduced motion opens the prepared document without requiring Web Animations',async()=>browserFixture(async f=>{
  f.slot.stage.animate=()=>{throw new Error('animation must not start');};const opening=f.navigation.open('phigros',f.link);f.resolveReady();await opening;
  assert.equal(f.slot.stage.classList.contains('is-active'),true);f.navigation.close();await tick();
}));
test('failed preload restores the home page instead of displaying a false ready screen',async()=>browserFixture(async f=>{
  const opening=f.navigation.open('phigros',f.link);f.rejectReady(new Error('timeout'));await opening;
  assert.equal(f.navigation.isOpen,false);assert.equal(f.shell.inert,false);assert.equal(f.slot.stage.classList.contains('is-active'),false);assert.equal(location.hash,'#worlds');assert.equal(f.notices.length,1);
}));
test('rapid Back then Forward cancels the exit without losing the live document',async()=>browserFixture(async f=>{
  const animationControls=[];
  function animate(){let resolve;const finished=new Promise(yes=>{resolve=yes;});const animation={finished,finish:resolve,cancel:resolve};animationControls.push(animation);return animation;}
  f.slot.stage.animate=f.slot.viewport.animate=animate;f.motion(true);
  const opening=f.navigation.open('phigros',f.link);f.resolveReady();await tick();animationControls.forEach(a=>a.finish());await opening;
  f.navigation.close();assert.equal(f.slot.stage.classList.contains('is-opening'),true);
  location.hash='#project=phigros';location.href='https://tycgame.github.io/homepage/#project=phigros';history.state={tycProject:'phigros'};
  window.dispatchEvent(new Event('popstate'));window.dispatchEvent(new Event('hashchange'));await tick();
  assert.equal(f.navigation.isOpen,true);assert.equal(f.slot.stage.classList.contains('is-opening'),false);assert.equal(f.shell.inert,true);assert.equal(f.releases.length,0);assert.equal(f.acquires,1);
  f.motion(false);f.navigation.close();await tick();assert.equal(f.navigation.isOpen,false);
}));
