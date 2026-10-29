import test from 'node:test';
import assert from 'node:assert/strict';
import {ProjectPreloader,projectURL,freshProjectURL,responseVersion} from '../project-preloader.js';

const tick=()=>new Promise(resolve=>setImmediate(resolve));
function fixture({concurrency=2}={}) {
  let time=100_000,version='one',calls=0,failHead=false;
  const slots=[],states=[];
  const pool=new ProjectPreloader({concurrency,now:()=>time,onState:(entry,state)=>states.push([entry.id,state]),fetcher:async()=>{calls++;if(failHead)throw new TypeError('CORS');return {ok:true,headers:new Headers({'etag':version})};},createSlot:(project,src)=>{
    let resolve,reject,done=false;
    const slot={project,src,disposed:0,ready:new Promise((yes,no)=>{resolve=yes;reject=no;}),finish(){done=true;resolve();},fail(){done=true;reject(new Error('unavailable'));},dispose(){this.disposed++;if(!done){done=true;reject(new Error('cancelled'));}}};slots.push(slot);return slot;
  }});
  const add=id=>pool.register({id,title:id,url:`https://tycofficial.github.io/${id}/`});
  return {pool,slots,states,add,advance:ms=>time+=ms,version:v=>version=v,headFailure:()=>failHead=true,get calls(){return calls;}};
}

test('all registered projects preload automatically with bounded concurrency',async()=>{
  const f=fixture();f.add('one');f.add('two');f.add('three');assert.equal(f.slots.length,2);
  f.slots[0].finish();await tick();assert.equal(f.slots.length,3);
  f.slots[1].finish();f.slots[2].finish();await tick();assert.equal([...f.pool.entries.values()].filter(e=>e.current).length,3);f.pool.destroy();
});
test('entering a warm project returns the exact slot without a second load',async()=>{
  const f=fixture();f.add('phigros');const original=f.slots[0];original.finish();await tick();
  assert.equal(await f.pool.acquire('phigros'),original);assert.equal(f.slots.length,1);assert.equal(original.disposed,0);f.pool.destroy();
});
test('an updated homepage replaces its predecessor only after it is ready',async()=>{
  const f=fixture();const entry=f.add('phigros');f.slots[0].finish();await tick();await f.pool.checkForUpdates({force:true});
  f.version('two');await f.pool.checkForUpdates({force:true});assert.equal(f.slots.length,2);assert.equal(entry.current,f.slots[0]);assert.equal(f.slots[0].disposed,0);
  f.slots[1].finish();await tick();assert.equal(entry.current,f.slots[1]);assert.equal(f.slots[0].disposed,1);assert.ok(entry.version.includes('two'));f.pool.destroy();
});
test('entering during an update keeps the ready document and cancels its replacement',async()=>{
  const f=fixture();const entry=f.add('phigros');f.slots[0].finish();await tick();await f.pool.checkForUpdates({force:true});f.version('two');await f.pool.checkForUpdates({force:true});
  assert.equal(await f.pool.acquire('phigros'),f.slots[0]);await tick();assert.equal(entry.current,f.slots[0]);assert.ok(f.slots[1].disposed>=1);assert.equal(entry.pending,null);f.pool.destroy();
});
test('live games are never version-polled or refreshed',async()=>{
  const f=fixture();f.add('phigros');f.slots[0].finish();await tick();await f.pool.acquire('phigros');f.advance(600_000);f.version('two');await f.pool.checkForUpdates({force:true});assert.equal(f.calls,0);assert.equal(f.slots.length,1);f.pool.destroy();
});
test('a failed cold preload remains failed and can be retried',async()=>{
  const f=fixture();const entry=f.add('phigros');f.slots[0].fail();await tick();assert.equal(entry.current,null);assert.equal(f.states.at(-1)[1],'error');
  const waiting=f.pool.acquire('phigros');f.slots[1].finish();assert.equal(await waiting,f.slots[1]);assert.equal(f.states.at(-1)[1],'ready');f.pool.destroy();
});
test('leaving an opened game disposes audio context ownership and starts a fresh homepage',async()=>{
  const f=fixture();const entry=f.add('phigros');f.slots[0].finish();await tick();await f.pool.acquire('phigros');f.pool.release('phigros',{discard:true});
  assert.equal(f.slots[0].disposed,1);assert.equal(f.slots.length,2);assert.notEqual(f.slots[0].src,f.slots[1].src);assert.equal(entry.current,null);f.pool.destroy();await tick();
});
test('CORS-limited projects refresh idle entries after the fallback age',async()=>{
  const f=fixture();f.add('phigros');f.slots[0].finish();await tick();f.headFailure();await f.pool.checkForUpdates({force:true});assert.equal(f.slots.length,1);
  f.advance(300_001);await f.pool.checkForUpdates({force:true});assert.equal(f.slots.length,2);assert.equal(f.slots[0].disposed,0);f.pool.destroy();await tick();
});
test('destroy cancels running and queued preloads without starting more work',async()=>{
  const f=fixture({concurrency:1});f.add('one');f.add('two');f.pool.destroy();await tick();assert.equal(f.slots.length,1);assert.ok(f.slots[0].disposed>=1);assert.equal(f.pool.queue.length,0);
});
test('project URLs preserve existing routing but reject unsafe schemes and credentials',()=>{
  const base='https://tycgame.github.io/homepage/';
  assert.equal(projectURL('../other/',base),'https://tycgame.github.io/other/');
  for(const url of ['javascript:alert(1)','data:text/html,hello','https://name:password@example.com/','http://example.com/'])assert.throws(()=>projectURL(url,base));
  const fresh=new URL(freshProjectURL('https://example.com/?level=2#start','new'));
  assert.equal(fresh.searchParams.get('level'),'2');assert.equal(fresh.searchParams.get('__tyc_preload'),'new');assert.equal(fresh.hash,'#start');
  assert.throws(()=>responseVersion({ok:false,status:404}));
});
