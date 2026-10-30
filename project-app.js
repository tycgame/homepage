import {ProjectPreloader,projectURL,UPDATE_INTERVAL} from './project-preloader.js';
import {createProjectStage,createProjectNavigation} from './navigation.js';

export function startProjectPreloads({motionEnabled,notify}) {
  const root=document.getElementById('project-preload-root'),template=document.getElementById('project-stage-template');
  const bound=new WeakSet(),projectLinks=new Map();let navigation;
  function renderState(entry,state) {
    for(const link of projectLinks.get(entry.id)||[]) {
      link.dataset.preloadState=state;
      const label=link.querySelector('[data-project-status]');
      if(label)label.textContent=state==='ready'?'开场已准备':state==='error'?'点击进入游戏':'正在准备开场…';
    }
  }
  const pool=new ProjectPreloader({
    createSlot:(project,src)=>createProjectStage(project,src,{root,template}),
    onState:renderState,
    onReady:()=>queueMicrotask(()=>{if(!document.hidden&&!navigation.isOpen)pool.checkForUpdates({force:true});})
  });
  navigation=createProjectNavigation({pool,motionEnabled,shell:document.querySelector('.page-shell'),notify});
  function scan() {
    for(const link of document.querySelectorAll('a[data-project]')) {
      if(bound.has(link))continue;
      try {
        const id=link.dataset.project;if(!id)continue;
        const url=projectURL(link.href,location.href),title=link.dataset.projectTitle||link.textContent.trim();
        if(!projectLinks.has(id))projectLinks.set(id,new Set());projectLinks.get(id).add(link);
        const entry=pool.register({id,url,title});navigation.bind(link,id);bound.add(link);renderState(entry,entry.current?'ready':entry.error?'error':'loading');
      }catch{link.dataset.preloadState='unsupported';}
    }
  }
  scan();navigation.restoreLegacyRoute();
  const observer=new MutationObserver(records=>{
    if(records.some(record=>[...record.addedNodes].some(node=>node.nodeType===1&&(node.matches?.('a[data-project]')||node.querySelector?.('a[data-project]')))))scan();
  });
  observer.observe(document.querySelector('.page-shell'),{subtree:true,childList:true});
  let timer=0;
  async function refresh() {
    clearTimeout(timer);
    if(!document.hidden&&!navigation.isOpen)await pool.checkForUpdates({force:true});
    if(!document.hidden)timer=setTimeout(refresh,UPDATE_INTERVAL);
  }
  // The first validator is captured as soon as a document finishes loading,
  // not one poll later, so the first subsequent deployment is detected too.
  window.addEventListener('tyc:project',event=>{if(event.detail.open)clearTimeout(timer);else refresh();});
  document.addEventListener('visibilitychange',()=>{clearTimeout(timer);if(!document.hidden)refresh();});
  window.addEventListener('online',refresh);
  window.addEventListener('pageshow',()=>{scan();refresh();});
  refresh();return {pool,navigation};
}
