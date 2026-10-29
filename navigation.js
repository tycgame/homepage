export const PHIGROS_URL = 'https://tycofficial.github.io/phigros/';
export function shouldAnimateNavigation(event) {
  return !event.defaultPrevented && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}
export function portalGeometry(rect, viewport) {
  const width=Math.max(1,viewport.width),height=Math.max(1,viewport.height);
  const scale=Math.max(Math.max(1,rect.width)/width,Math.max(1,rect.height)/height);
  const right=Math.max(0,width-rect.right),bottom=Math.max(0,height-rect.bottom);
  return {transform:`translate(${rect.left+rect.width/2-width/2}px, ${rect.top+rect.height/2-height/2}px) scale(${scale})`,clip:`inset(${Math.max(0,rect.top)}px ${right}px ${bottom}px ${Math.max(0,rect.left)}px round 3px)`};
}
export function projectFromHash(hash) {
  if(!hash.startsWith('#project='))return null;
  try{return decodeURIComponent(hash.slice(9));}catch{return null;}
}
export function createProjectStage(project,src,{root,template,onClose}) {
  const stage=template.content.firstElementChild.cloneNode(true),frame=stage.querySelector('iframe'),viewport=stage.querySelector('.project-frame-wrap');
  stage.dataset.projectStage=project.id;stage.inert=true;stage.setAttribute('aria-hidden','true');stage.setAttribute('aria-label',`${project.title} 项目窗口`);
  stage.querySelector('.project-workspace-title').textContent=project.title;
  stage.querySelector('.project-open-original').href=project.url;
  stage.querySelector('.project-back').addEventListener('click',onClose);
  frame.title=`${project.title} · 实时首页`;frame.tabIndex=-1;
  let timeout,settled=false,disposed=false,rejectReady;
  const ready=new Promise((resolve,reject)=>{
    rejectReady=reject;
    frame.addEventListener('load',()=>{
      if(disposed)return;frame.dataset.loadCount=String(Number(frame.dataset.loadCount||0)+1);
      if(settled)return;settled=true;clearTimeout(timeout);stage.dataset.loaded='true';resolve();
    });
    // Cross-origin load events cannot distinguish every HTTP/embed error. An
    // original-site link remains available in every workspace as a fallback.
    timeout=setTimeout(()=>{if(!settled){settled=true;reject(new Error('项目首页预载超时'));}},35000);
  });
  frame.src=src;root.appendChild(stage);
  return {stage,frame,viewport,ready,dispose(){
    if(disposed)return;disposed=true;clearTimeout(timeout);
    if(!settled){settled=true;rejectReady(new Error('预载已取消'));}
    stage.remove(); // Discard the browsing context to stop audio on leaving.
  }};
}
function waitForAnimation(animation,duration) {
  return new Promise(resolve=>{const timer=setTimeout(resolve,duration+150);animation.finished.catch(()=>{}).then(()=>{clearTimeout(timer);resolve();});});
}
export function createProjectNavigation({pool,motionEnabled,shell,notify=()=>{}}) {
  let current=null,generation=0,returnURL=location.href,ownedHistory=false,oldTitle=document.title,oldPadding=null;
  const animations=[],links=new Map();
  function stateChanged(open){window.dispatchEvent(new CustomEvent('tyc:project',{detail:{open}}));}
  function cleanAnimations(){animations.splice(0).forEach(animation=>animation.cancel());}
  function setShellHidden(hidden){shell.inert=hidden;if(hidden)shell.setAttribute('aria-hidden','true');else shell.removeAttribute('aria-hidden');}
  function setBusy(id,busy){for(const link of links.get(id)||[])if(busy)link.setAttribute('aria-busy','true');else link.removeAttribute('aria-busy');}
  function clearCurrent({focus=true}={}) {
    ++generation;cleanAnimations();const previous=current;current=null;
    if(previous){setBusy(previous.id,false);pool.release(previous.id,{discard:previous.revealed});}
    document.body.classList.remove('project-is-open','project-is-transitioning');
    if(oldPadding!==null){document.body.style.paddingRight=oldPadding;oldPadding=null;}
    setShellHidden(false);document.title=oldTitle;stateChanged(false);
    if(focus&&previous?.link?.isConnected)previous.link.focus({preventScroll:true});
  }
  async function animate(slot,link,opening) {
    if(!motionEnabled()||typeof slot.stage.animate!=='function'||!link?.isConnected)return;
    const geometry=portalGeometry(link.getBoundingClientRect(),{width:innerWidth,height:innerHeight});
    const fullClip='inset(0px 0px 0px 0px round 0px)',fullTransform='translate(0px, 0px) scale(1)';
    const clips=opening?[geometry.clip,fullClip]:[fullClip,geometry.clip],transforms=opening?[geometry.transform,fullTransform]:[fullTransform,geometry.transform];
    const duration=opening?940:620,options={duration,easing:'cubic-bezier(.76,0,.24,1)',fill:'both'};
    const mask=slot.stage.animate(clips.map(clipPath=>({clipPath})),options),zoom=slot.viewport.animate(transforms.map(transform=>({transform})),options);
    animations.push(mask,zoom);await waitForAnimation(mask,duration);
  }
  async function open(id,link,{push=true,transition=true}={}) {
    if(current?.id===id){
      if(current.closing){
        ++generation;cleanAnimations();current.closing=false;current.closeRequested=false;
        current.slot.stage.classList.remove('is-opening');setShellHidden(true);
        document.body.classList.add('project-is-open');document.body.classList.remove('project-is-transitioning');stateChanged(true);
      }
      return;
    }
    if(current)clearCurrent({focus:false});
    returnURL=location.href;oldTitle=document.title;const attempt=++generation;
    current={id,link,slot:null,revealed:false};setBusy(id,true);
    if(push){history.pushState({...history.state,tycProject:id},'',`#project=${encodeURIComponent(id)}`);ownedHistory=true;}
    try {
      const slot=await pool.acquire(id);if(attempt!==generation||!current)return;
      current.slot=slot;current.revealed=true;
      slot.stage.inert=false;slot.stage.removeAttribute('aria-hidden');slot.stage.classList.add('is-active','is-opening');
      oldPadding=document.body.style.paddingRight;
      document.body.style.paddingRight=`${Math.max(0,innerWidth-document.documentElement.clientWidth)}px`;
      document.body.classList.add('project-is-open','project-is-transitioning');setShellHidden(true);stateChanged(true);document.title=`${pool.entries.get(id).title} · TYC`;
      // Reveal the same connected document: no src assignment, DOM reparenting,
      // location.assign or second navigation occurs when the visitor enters.
      if(transition)await animate(slot,link,true);
      if(attempt!==generation||!current)return;
      cleanAnimations();slot.stage.classList.remove('is-opening');document.body.classList.remove('project-is-transitioning');setBusy(id,false);
      slot.frame.tabIndex=0;slot.frame.focus({preventScroll:true});
    } catch {
      if(attempt!==generation)return;
      clearCurrent();history.replaceState({...history.state,tycProject:null},'',returnURL);ownedHistory=false;
      notify('首页尚未完成预载，请重试；也可长按入口，在新标签页直接打开。');
    }
  }
  async function hide() {
    if(!current||current.closing)return;const attempt=++generation,previous=current;current.closing=true;cleanAnimations();
    if(previous.revealed){previous.slot.stage.classList.add('is-opening');document.body.classList.add('project-is-transitioning');setShellHidden(false);await animate(previous.slot,previous.link,false);}
    if(attempt===generation)clearCurrent();
  }
  function close() {
    if(!current||current.closeRequested)return;current.closeRequested=true;
    if(ownedHistory&&history.state?.tycProject===current.id){history.back();return;}
    history.replaceState({...history.state,tycProject:null},'',returnURL.includes('#project=')?'#worlds':returnURL);ownedHistory=false;hide();
  }
  function bind(link,id) {
    if(!links.has(id))links.set(id,new Set());links.get(id).add(link);
    link.addEventListener('click',event=>{if(!shouldAnimateNavigation(event))return;event.preventDefault();open(id,link);});
  }
  function restoreRoute({transition=false}={}) {
    const id=projectFromHash(location.hash);
    if(id&&pool.entries.has(id))open(id,[...(links.get(id)||[])][0],{push:false,transition});else hide();
  }
  window.addEventListener('popstate',()=>restoreRoute({transition:true}));
  window.addEventListener('hashchange',()=>restoreRoute());
  window.addEventListener('keydown',event=>{if(event.key==='Escape'&&current)close();});
  return {bind,open,close,restoreRoute,get isOpen(){return !!current;}};
}
