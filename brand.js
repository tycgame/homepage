export function clamp(value,min,max){return Math.max(min,Math.min(max,value));}
export function brandAngles(dx,dy){return {x:clamp(-dy*.055,-13,13),y:clamp(dx*.055,-19,19)};}

// Vector layers have fixed CSS geometry. This controller never sizes a bitmap,
// observes its own output, or starts a continuous JavaScript render loop.
export function createBrandInteraction(surface,mark){
  let pointer=null,startX=0,startY=0,baseX=0,baseY=0,angleX=0,angleY=0,raf=0,pending=null;
  function paint(){raf=0;if(!pending)return;angleX=pending.x;angleY=pending.y;mark.style.setProperty('--rx',`${angleX}deg`);mark.style.setProperty('--ry',`${angleY}deg`);pending=null;}
  function set(x,y){pending={x:clamp(x,-18,18),y:clamp(y,-25,25)};if(!raf)raf=requestAnimationFrame(paint);}
  function reset(){set(0,0);mark.classList.remove('is-dragging');}
  surface.addEventListener('pointerdown',event=>{if(!event.isPrimary||event.button!==0)return;pointer=event.pointerId;startX=event.clientX;startY=event.clientY;baseX=angleX;baseY=angleY;});
  surface.addEventListener('pointermove',event=>{if(pointer!==event.pointerId)return;const dx=event.clientX-startX,dy=event.clientY-startY;if(Math.hypot(dx,dy)<6)return;if(!surface.hasPointerCapture(event.pointerId))surface.setPointerCapture(event.pointerId);mark.classList.add('is-dragging');const next=brandAngles(dx,dy);set(baseX+next.x,baseY+next.y);});
  const release=event=>{if(pointer!==event.pointerId)return;pointer=null;if(surface.hasPointerCapture(event.pointerId))surface.releasePointerCapture(event.pointerId);mark.classList.remove('is-dragging');};
  surface.addEventListener('pointerup',release);surface.addEventListener('pointercancel',release);surface.addEventListener('lostpointercapture',()=>{pointer=null;mark.classList.remove('is-dragging');});
  surface.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home'].includes(event.key))return;event.preventDefault();if(event.key==='Home')reset();else set(angleX+(event.key==='ArrowUp'?-4:event.key==='ArrowDown'?4:0),angleY+(event.key==='ArrowLeft'?-5:event.key==='ArrowRight'?5:0));});
  window.addEventListener('orientationchange',()=>{if(pointer!==null&&surface.hasPointerCapture(pointer))surface.releasePointerCapture(pointer);pointer=null;reset();},{passive:true});
  return {reset};
}
