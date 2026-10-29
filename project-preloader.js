export const UPDATE_INTERVAL = 60_000;
const UNVALIDATED_MAX_AGE = 5 * 60_000;

export function projectURL(value, baseURL) {
  const url = new URL(value, baseURL), base = new URL(baseURL);
  if (url.username || url.password || (url.protocol !== 'https:' && !(url.protocol === 'http:' && url.origin === base.origin))) throw new TypeError('项目地址必须使用 HTTPS');
  return url.href;
}
export function freshProjectURL(value, stamp) {
  const url = new URL(value);url.searchParams.set('__tyc_preload', String(stamp));return url.href;
}
export function responseVersion(response) {
  if (!response.ok) throw new Error(`项目首页响应 ${response.status}`);
  const etag=response.headers.get('etag'),modified=response.headers.get('last-modified');
  return etag || modified ? [etag||'',modified||'',response.headers.get('content-length')||''].join('|') : null;
}

// Every slot owns a connected browsing context. Never move its iframe: that
// destroys the warmed document in current browsers, even if its src is unchanged.
export class ProjectPreloader {
  constructor({createSlot,fetcher=(...args)=>fetch(...args),onState=()=>{},onReady=()=>{},now=()=>Date.now(),concurrency=2}) {
    this.createSlot=createSlot;this.fetcher=fetcher;this.onState=onState;this.onReady=onReady;this.now=now;
    this.concurrency=concurrency;this.entries=new Map();this.queue=[];this.running=0;this.sequence=0;this.destroyed=false;
  }
  register(project) {
    const existing=this.entries.get(project.id);
    if(existing){if(existing.url!==project.url)throw new Error('重复项目标识对应了不同地址');return existing;}
    const entry={...project,current:null,pending:null,active:false,version:null,lastChecked:0,freshAt:0,check:null,error:null};
    this.entries.set(project.id,entry);this.prepare(entry).catch(()=>{});return entry;
  }
  emit(entry){this.onState(entry,entry.current?'ready':entry.error?'error':'loading');}
  prepare(entry,{refresh=false,version=entry.version,priority=false}={}) {
    if(this.destroyed)return Promise.reject(new Error('预载已关闭'));
    if(entry.current&&(!refresh||entry.active))return Promise.resolve(entry.current);
    if(entry.pending)return entry.pending.promise;
    let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});promise.catch(()=>{});
    const task={entry,promise,resolve,reject,version,slot:null,cancelled:false};entry.error=null;entry.pending=task;
    if(priority)this.queue.unshift(task);else this.queue.push(task);
    this.emit(entry);this.pump();return promise;
  }
  pump() {
    while(!this.destroyed&&this.running<this.concurrency&&this.queue.length){
      const task=this.queue.shift();if(task.cancelled)continue;this.running++;
      this.run(task).finally(()=>{this.running--;this.pump();});
    }
  }
  async run(task) {
    const entry=task.entry;
    try {
      task.slot=this.createSlot(entry,freshProjectURL(entry.url,`${this.now()}-${++this.sequence}`));
      await task.slot.ready;
      if(task.cancelled||this.destroyed||entry.pending!==task||(entry.active&&entry.current)){task.slot.dispose();return;}
      const previous=entry.current;entry.current=task.slot;entry.pending=null;entry.freshAt=this.now();entry.version=task.version;entry.error=null;
      previous?.dispose();task.resolve(entry.current);this.emit(entry);this.onReady(entry);
    } catch(error) {
      task.slot?.dispose();
      if(!task.cancelled&&entry.pending===task){entry.pending=null;entry.error=error;task.reject(error);this.emit(entry);}
    }
  }
  cancelPending(entry) {
    const task=entry.pending;if(!task)return;task.cancelled=true;entry.pending=null;task.slot?.dispose();task.reject(new Error('预载替换已取消'));
  }
  async acquire(id) {
    const entry=this.entries.get(id);if(!entry)throw new Error('项目不存在');
    entry.active=true;entry.check?.abort();
    // Once entered, the exact document stays in use until the visitor leaves.
    if(entry.current){this.cancelPending(entry);return entry.current;}
    if(entry.pending){const i=this.queue.indexOf(entry.pending);if(i>0)this.queue.unshift(...this.queue.splice(i,1));}
    return this.prepare(entry,{priority:true});
  }
  release(id,{discard=false}={}) {
    const entry=this.entries.get(id);if(!entry)return;entry.active=false;
    if(discard){this.cancelPending(entry);entry.current?.dispose();entry.current=null;entry.error=null;this.prepare(entry).catch(()=>{});}
  }
  async checkForUpdates({force=false}={}) {
    if(this.destroyed)return;
    for(const entry of this.entries.values()) {
      if(this.destroyed||entry.active||entry.pending||entry.check||(!force&&this.now()-entry.lastChecked<UPDATE_INTERVAL))continue;
      entry.lastChecked=this.now();const controller=new AbortController();entry.check=controller;const timer=setTimeout(()=>controller.abort(),8000);
      try {
        const version=responseVersion(await this.fetcher(entry.url,{method:'HEAD',cache:'no-store',credentials:'omit',signal:controller.signal}));
        if(controller.signal.aborted||entry.active||this.destroyed)continue;
        if((version&&entry.version&&version!==entry.version)||(!version&&this.now()-entry.freshAt>=UNVALIDATED_MAX_AGE))this.prepare(entry,{refresh:true,version}).catch(()=>{});
        else if(version)entry.version=version;
      } catch {
        // Projects without readable CORS validators periodically refresh their
        // idle document. Active games are never refreshed by this fallback.
        if(!controller.signal.aborted&&!entry.active&&!this.destroyed&&this.now()-entry.freshAt>=UNVALIDATED_MAX_AGE)this.prepare(entry,{refresh:true}).catch(()=>{});
      } finally {clearTimeout(timer);if(entry.check===controller)entry.check=null;}
    }
  }
  destroy() {
    this.destroyed=true;
    for(const entry of this.entries.values()){entry.check?.abort();this.cancelPending(entry);entry.current?.dispose();entry.current=null;}
    this.queue.length=0;
  }
}
