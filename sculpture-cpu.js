import {createKnot,rotationMatrix} from './geometry.js';

// A local 3D renderer for browsers without GPU/WebGL. The same mesh and camera,
// painter-sorted triangles, reflected studio lighting, and direct manipulation.
export function createCPUSculpture(canvas,motionEnabled){
  const ctx=canvas.getContext('2d',{alpha:true});if(!ctx)throw new Error('Canvas unavailable');
  canvas.parentElement.classList.remove('no-webgl');canvas.dataset.renderer='canvas-3d';
  const mesh=createKnot(192,48),p=mesh.positions,n=mesh.normals,indices=mesh.indices;
  const transformed=new Float32Array(p.length),normals=new Float32Array(n.length),screen=new Float32Array(p.length/3*2),colors=new Float32Array(p.length),front=new Float32Array(p.length/3);
  let image,depth;
  let raf=0,last=0,auto=0,visible=true,width=1,height=1,dpr=1,yaw=-.28,pitch=.65,targetYaw=yaw,targetPitch=pitch;
  let pointer=null,x=0,y=0,startYaw=0,startPitch=0;
  const light=unit([-.7,1,1.2]),strip=unit([1,.4,.8]),edge=unit([-1,-.3,.2]);
  const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
  function unit(v){const len=Math.hypot(...v);return v.map(x=>x/len);}
  function smooth(a,b,x){const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t);}
  function schedule(){if(!raf&&visible&&!document.hidden)raf=requestAnimationFrame(render);}
  function resize(){const box=canvas.getBoundingClientRect();width=Math.max(1,box.width);height=Math.max(1,box.height);dpr=Math.min(devicePixelRatio||1,1.5);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);image=ctx.createImageData(canvas.width,canvas.height);depth=new Float32Array(canvas.width*canvas.height);schedule();}
  function render(now){
    raf=0;if(document.hidden||!visible)return;
    if(motionEnabled()&&now-last<33){schedule();return;}
    const dt=Math.min((now-last)/1000,.07);last=now;
    if(motionEnabled())auto+=dt*.1;
    yaw+=(targetYaw-yaw)*.18;pitch+=(targetPitch-pitch)*.18;
    const matrix=rotationMatrix(pitch,yaw+auto,-.28),scale=Math.min(1,width/height*1.08),f=height/(2*Math.tan(.61/2)),bob=motionEnabled()?Math.sin(auto*1.5)*.075:0;
    for(let i=0;i<p.length;i+=3){
      for(let k=0;k<3;k++){transformed[i+k]=(matrix[k]*p[i]+matrix[4+k]*p[i+1]+matrix[8+k]*p[i+2])*scale;normals[i+k]=matrix[k]*n[i]+matrix[4+k]*n[i+1]+matrix[8+k]*n[i+2];}
      const depth=9.7-transformed[i+2];screen[i/3*2]=width/2+transformed[i]*f/depth;screen[i/3*2+1]=height/2-(transformed[i+1]+bob)*f/depth;
    }
    for(let i=0;i<p.length;i+=3){
      const normal=[normals[i],normals[i+1],normals[i+2]],world=[transformed[i],transformed[i+1],transformed[i+2]];
      const view=unit([-world[0],-world[1],9.7-world[2]]),nv=dot(normal,view);front[i/3]=nv;
      const reflect=normal.map((v,k)=>2*nv*v-view[k]);
      const sky=smooth(-.65,.7,reflect[1]),band=smooth(.24,.3,reflect[0])*(1-smooth(.5,.56,reflect[0]));
      const box=Math.pow(Math.max(0,dot(reflect,light)),15),rim=Math.pow(Math.max(0,dot(reflect,strip)),44),left=Math.pow(Math.max(0,dot(reflect,edge)),12),fresnel=Math.pow(1-Math.max(nv,0),4);
      const env=[.16+sky*.65,.19+sky*.64,.17+sky*.59].map((v,k)=>v*(1-.69*band)+box*[1.5,1.46,1.27][k]+rim*[1.1,1.3,1][k]+left*[.65,.73,.68][k]);
      const blend=.23+fresnel*.44,diff=Math.max(0,dot(normal,unit([-.5,1,1])));
      for(let k=0;k<3;k++){const value=(env[k]*[.75,.79,.73][k]+diff*[.07,.078,.067][k])*(1-blend)+env[k]*[.93,.97,.87][k]*blend;colors[i+k]=255*Math.pow(value/(value+.48),.88);}
    }
    const pixels=image.data,w=canvas.width,h=canvas.height;pixels.fill(0);depth.fill(0);
    // Smoothly interpolate per-vertex reflected light and depth in screen space.
    // The z-buffer resolves overlaps without painter-order seams or facets.
    for(let i=0;i<indices.length;i+=3){
      const a=indices[i],b=indices[i+1],c=indices[i+2];if(front[a]+front[b]+front[c]<=0)continue;
      const ax=screen[a*2]*dpr,ay=screen[a*2+1]*dpr,bx=screen[b*2]*dpr,by=screen[b*2+1]*dpr,cx=screen[c*2]*dpr,cy=screen[c*2+1]*dpr;
      const den=(by-cy)*(ax-cx)+(cx-bx)*(ay-cy);if(Math.abs(den)<.0001)continue;
      const minX=Math.max(0,Math.floor(Math.min(ax,bx,cx))),maxX=Math.min(w-1,Math.ceil(Math.max(ax,bx,cx))),minY=Math.max(0,Math.floor(Math.min(ay,by,cy))),maxY=Math.min(h-1,Math.ceil(Math.max(ay,by,cy)));
      const dx0=(by-cy)/den,dx1=(cy-ay)/den,dy0=(cx-bx)/den,dy1=(ax-cx)/den;
      const izA=1/(9.7-transformed[a*3+2]),izB=1/(9.7-transformed[b*3+2]),izC=1/(9.7-transformed[c*3+2]);
      let row0=((by-cy)*(minX+.5-cx)+(cx-bx)*(minY+.5-cy))/den,row1=((cy-ay)*(minX+.5-cx)+(ax-cx)*(minY+.5-cy))/den;
      for(let py=minY;py<=maxY;py++,row0+=dy0,row1+=dy1){let v0=row0,v1=row1,offset=py*w+minX;
        for(let px=minX;px<=maxX;px++,offset++,v0+=dx0,v1+=dx1){const v2=1-v0-v1;if(v0<-.0001||v1<-.0001||v2<-.0001)continue;const z=v0*izA+v1*izB+v2*izC;if(z<=depth[offset])continue;depth[offset]=z;const out=offset*4;for(let k=0;k<3;k++)pixels[out+k]=colors[a*3+k]*v0+colors[b*3+k]*v1+colors[c*3+k]*v2;pixels[out+3]=255;}
      }
    }
    ctx.putImageData(image,0,0);
    if(motionEnabled()||Math.abs(targetYaw-yaw)>.001||Math.abs(targetPitch-pitch)>.001)schedule();
  }
  new ResizeObserver(resize).observe(canvas);
  new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible){last=performance.now();schedule();}else{cancelAnimationFrame(raf);raf=0;}}).observe(canvas);
  canvas.addEventListener('pointerdown',e=>{if(!e.isPrimary||e.button!==0)return;pointer=e.pointerId;x=e.clientX;y=e.clientY;startYaw=targetYaw;startPitch=targetPitch;});
  canvas.addEventListener('pointermove',e=>{if(pointer!==e.pointerId)return;if(Math.hypot(e.clientX-x,e.clientY-y)>7&&!canvas.hasPointerCapture(e.pointerId))canvas.setPointerCapture(e.pointerId);targetYaw=startYaw+(e.clientX-x)*.009;targetPitch=Math.max(-1.6,Math.min(1.6,startPitch+(e.clientY-y)*.007));schedule();});
  const release=e=>{if(pointer===e.pointerId){pointer=null;if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);}};
  canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',release);canvas.addEventListener('lostpointercapture',()=>{pointer=null;});
  canvas.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home'].includes(e.key))return;e.preventDefault();if(e.key==='Home'){targetYaw=-.28;targetPitch=.65;auto=0;}else{targetYaw+=e.key==='ArrowLeft'?-.22:e.key==='ArrowRight'?.22:0;targetPitch=Math.max(-1.6,Math.min(1.6,targetPitch+(e.key==='ArrowUp'?-.18:e.key==='ArrowDown'?.18:0)));}schedule();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(raf);raf=0;}else{last=performance.now();schedule();}});
  window.addEventListener('tyc:motion',schedule);resize();
}
