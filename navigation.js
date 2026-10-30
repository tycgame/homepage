export const PHIGROS_URL='https://tycofficial.github.io/phigros/';
export function shouldAnimateNavigation(event){return !event.defaultPrevented&&event.button===0&&!event.metaKey&&!event.ctrlKey&&!event.shiftKey&&!event.altKey;}
export function portalGeometry(rect,viewport){
  const width=Math.max(1,viewport.width),height=Math.max(1,viewport.height),scale=Math.min(1,Math.min(Math.max(1,rect.width)/width,Math.max(1,rect.height)/height));
  return {transform:`translate(${rect.left+rect.width/2-width/2}px, ${rect.top+rect.height/2-height/2}px) scale(${scale})`,clip:`inset(${Math.max(0,rect.top)}px ${Math.max(0,width-rect.right)}px ${Math.max(0,height-rect.bottom)}px ${Math.max(0,rect.left)}px round 18px)`};
}
export function projectFromHash(hash){if(!hash.startsWith('#project='))return null;try{return decodeURIComponent(hash.slice(9));}catch{return null;}}
export function createProjectStage(project,src,{root,template}){
  let stage=[...root.children].find(node=>node.dataset.projectStage===project.id&&node.dataset.adopted!=='true');
  const adopted=!!stage;
  if(!stage)stage=template.content.firstElementChild.cloneNode(true);
  const frame=stage.querySelector('iframe'),viewport=stage.querySelector('.project-frame-wrap');
  stage.dataset.adopted='true';stage.dataset.projectStage=project.id;stage.inert=true;stage.setAttribute('aria-hidden','true');frame.title=`${project.title} 预载开场`;
  let settled=false,disposed=false,rejectReady,timeout;
  const alreadyLoaded=frame.dataset.loaded==='true';frame.dataset.loadCount=alreadyLoaded?'1':'0';
  const ready=new Promise((resolve,reject)=>{
    rejectReady=reject;
    const loaded=()=>{if(disposed||settled)return;settled=true;clearTimeout(timeout);frame.dataset.loaded='true';frame.dataset.loadCount='1';stage.dataset.loaded='true';resolve();};
    if(alreadyLoaded){loaded();return;}
    frame.addEventListener('load',loaded,{once:true});
    timeout=setTimeout(()=>{if(!settled){settled=true;reject(new Error('开场准备超时'));}},40000);
  });
  // The parser has already started the primary iframe. Adopting it must not
  // assign src or reparent it, both of which would waste its warmed document.
  if(!adopted){frame.src=src;root.appendChild(stage);}
  return {stage,frame,viewport,ready,dispose(){if(disposed)return;disposed=true;clearTimeout(timeout);if(!settled){settled=true;rejectReady(new Error('预载已取消'));}stage.remove();}};
}
function finishAnimation(animation,duration){return new Promise(resolve=>{const timer=setTimeout(resolve,duration+120);animation.finished.catch(()=>{}).then(()=>{clearTimeout(timer);resolve();});});}

// The iframe is only a visual bridge. Navigation always commits to the canonical
// project URL in the top-level tab; games never remain in a homepage workspace.
export function createProjectNavigation({pool,motionEnabled,shell,navigate=url=>window.location.assign(url)}){
  let current=null,generation=0,oldPadding=null,recovery=0,committed=false;
  const animations=[],links=new Map();
  function announce(open){window.dispatchEvent(new CustomEvent('tyc:project',{detail:{open}}));}
  function cancelAnimations(){animations.splice(0).forEach(animation=>animation.cancel());}
  function reset(){
    ++generation;clearTimeout(recovery);cancelAnimations();
    if(current){current.slot?.stage.classList.remove('is-active','is-opening');pool.release(current.id);for(const link of links.get(current.id)||[])link.removeAttribute('aria-busy');}
    current=null;committed=false;document.body.classList.remove('is-leaving');
    if(oldPadding!==null){document.body.style.paddingRight=oldPadding;oldPadding=null;}
    shell.inert=false;shell.removeAttribute('aria-hidden');announce(false);
  }
  async function open(id,link,{transition=true}={}){
    if(current)return;
    const project=pool.entries.get(id);if(!project)return;
    const attempt=++generation;current={id,slot:null};committed=false;
    for(const item of links.get(id)||[])item.setAttribute('aria-busy','true');
    // Never wait for the entire game bundle before allowing a click through.
    const slot=pool.claim(id);current.slot=slot;
    const animate=transition&&motionEnabled()&&slot&&typeof slot.stage.animate==='function';
    if(animate){
      const geometry=portalGeometry(link.getBoundingClientRect(),{width:innerWidth,height:innerHeight});
      oldPadding=document.body.style.paddingRight;document.body.style.paddingRight=`${Math.max(0,innerWidth-document.documentElement.clientWidth)}px`;
      document.body.classList.add('is-leaving');shell.inert=true;shell.setAttribute('aria-hidden','true');announce(true);
      slot.stage.classList.add('is-active','is-opening');
      try{
        const options={duration:880,easing:'cubic-bezier(.76,0,.24,1)',fill:'both'};
        const mask=slot.stage.animate([{clipPath:geometry.clip},{clipPath:'inset(0px 0px 0px 0px round 0px)'}],options);
        const zoom=slot.viewport.animate([{transform:geometry.transform},{transform:'translate(0px, 0px) scale(1)'}],options);
        animations.push(mask,zoom);await finishAnimation(mask,880);
      }catch{/* A missing animation implementation must not block navigation. */}
    }
    if(attempt!==generation||!current)return;
    committed=true;
    try{navigate(project.url);}catch{reset();return;}
    // A blocked navigation should never strand the visitor behind an overlay.
    recovery=setTimeout(reset,4500);
  }
  function bind(link,id){if(!links.has(id))links.set(id,new Set());links.get(id).add(link);link.addEventListener('click',event=>{if(!shouldAnimateNavigation(event))return;event.preventDefault();open(id,link);});}
  function restoreLegacyRoute(){const id=projectFromHash(location.hash);if(id&&pool.entries.has(id)){history.replaceState(history.state,'',location.pathname+location.search);open(id,[...(links.get(id)||[])][0],{transition:false});}}
  window.addEventListener('pageshow',event=>{if(event.persisted||!current)reset();});
  window.addEventListener('pagehide',()=>{++generation;clearTimeout(recovery);if(!committed)reset();});
  window.addEventListener('keydown',event=>{if(event.key==='Escape'&&current&&!committed)reset();});
  return {bind,open,reset,restoreLegacyRoute,get isOpen(){return !!current;}};
}
