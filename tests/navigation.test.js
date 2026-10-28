import test from 'node:test';
import assert from 'node:assert/strict';
import { PHIGROS_URL, shouldAnimateNavigation, portalTransform, attachPortal } from '../navigation.js';
test('navigation preserves new-tab, keyboard-modified and previously handled clicks',()=>{
  const base={button:0,defaultPrevented:false};assert.ok(shouldAnimateNavigation(base));
  for(const modifier of ['metaKey','ctrlKey','shiftKey','altKey','defaultPrevented'])assert.equal(shouldAnimateNavigation({...base,[modifier]:true}),false);
  assert.equal(shouldAnimateNavigation({...base,button:1}),false);assert.equal(shouldAnimateNavigation({...base,button:2}),false);
  assert.equal(PHIGROS_URL,'https://tycofficial.github.io/phigros/');
});
test('portal originates at the actual card bounds, including small mobile viewports',()=>{
  assert.equal(portalTransform({left:24,top:200,width:350,height:448},{width:400,height:800}),'translate(24px, 200px) scale(0.875, 0.56)');
  assert.ok(!/NaN|Infinity/.test(portalTransform({left:0,top:0,width:0,height:0},{width:0,height:0})));
});
test('reduced motion navigates immediately without starting an animation',async()=>{
  const handlers={};let destination;global.window={addEventListener(){}};
  const link={addEventListener(type,handler){handlers[type]=handler;}};
  attachPortal(link,{},()=>false,{navigate:url=>{destination=url;}});
  let prevented=false;await handlers.click({button:0,preventDefault(){prevented=true;}});
  assert.equal(prevented,true);assert.equal(destination,PHIGROS_URL);delete global.window;
});
test('zoom waits for completion, prevents duplicate navigation and resets for Back',async()=>{
  const handlers={},windowHandlers={},classes=new Set(),attrs=new Map();let finish,navigations=0,animations=0;
  global.window={innerWidth:400,innerHeight:800,addEventListener(type,handler){windowHandlers[type]=handler;}};
  global.document={documentElement:{clientWidth:400},body:{classList:{add:c=>classes.add(c),remove:c=>classes.delete(c)}}};
  const link={addEventListener(type,handler){handlers[type]=handler;},setAttribute:(k,v)=>attrs.set(k,v),removeAttribute:k=>attrs.delete(k),getBoundingClientRect:()=>({left:20,top:150,width:360,height:400})};
  const overlay={style:{removeProperty(){}},classList:{add:c=>classes.add(c),remove:c=>classes.delete(c)},querySelector(){return null;},animate(){animations++;return{finished:new Promise(resolve=>{finish=resolve;}),cancel(){}};}};
  attachPortal(link,overlay,()=>true,{navigate:()=>navigations++});const event={button:0,preventDefault(){}};
  const pending=handlers.click(event);await handlers.click(event);
  assert.equal(animations,1);assert.equal(navigations,0);assert.ok(classes.has('is-active'));
  finish();await pending;assert.equal(navigations,1);windowHandlers.pageshow();
  assert.equal(classes.has('is-active'),false);assert.equal(attrs.has('aria-busy'),false);
  const cancelled=handlers.click(event);windowHandlers.pagehide();finish();await cancelled;
  assert.equal(navigations,1,'Leaving the page during a transition must cancel pending navigation');
  delete global.window;delete global.document;
});
