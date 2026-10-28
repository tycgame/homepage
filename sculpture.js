import { createKnot, perspective, rotationMatrix } from './geometry.js';
import { createCPUSculpture } from './sculpture-cpu.js';

const vertexSource = `
attribute vec3 aPosition; attribute vec3 aNormal;
uniform mat4 uProjection; uniform mat4 uModel; uniform float uBob;
varying vec3 vNormal; varying vec3 vWorld;
void main(){vec4 p=uModel*vec4(aPosition,1.);vWorld=p.xyz;vNormal=mat3(uModel)*aNormal;p.z-=9.7;p.y+=uBob;gl_Position=uProjection*p;}`;
const fragmentSource = `
precision mediump float;
varying vec3 vNormal; varying vec3 vWorld;
uniform vec3 uCamera;
vec3 studio(vec3 r){
  vec3 env=mix(vec3(.16,.19,.17),vec3(.81,.83,.76),smoothstep(-.65,.7,r.y));
  float softbox=pow(max(0.,dot(r,normalize(vec3(-.7,1.,1.2)))),15.);
  float strip=pow(max(0.,dot(r,normalize(vec3(1.,.4,.8)))),44.);
  float edge=pow(max(0.,dot(r,normalize(vec3(-1.,-.3,.2)))),12.);
  float band=smoothstep(.24,.3,r.x)*(1.-smoothstep(.5,.56,r.x));
  env*=1.-.69*band;env+=softbox*vec3(1.5,1.46,1.27)+strip*vec3(1.1,1.3,1.)+edge*vec3(.65,.73,.68);
  return env;
}
void main(){
  vec3 n=normalize(vNormal),v=normalize(uCamera-vWorld),r=reflect(-v,n);
  float f=pow(1.-max(dot(n,v),0.),4.);
  vec3 env=studio(r);
  float diffuse=max(0.,dot(n,normalize(vec3(-.5,1.,1.))));
  vec3 color=env*vec3(.75,.79,.73)+diffuse*vec3(.07,.078,.067);
  color=mix(color,studio(r)*vec3(.93,.97,.87),.23+f*.44);
  color=color/(color+vec3(.48));
  color=pow(color,vec3(.88));
  gl_FragColor=vec4(color,1.);
}`;

export function createSculpture(canvas, isMotionEnabled) {
  const panel = canvas.parentElement;
  const fallback = () => { panel.classList.add('no-webgl'); canvas.removeAttribute('tabindex'); };
  function startCPU() {
    // A canvas that already owns a GL context cannot acquire a 2D context.
    const replacement=canvas.cloneNode(false);canvas.replaceWith(replacement);
    try { return createCPUSculpture(replacement,isMotionEnabled); } catch { fallback(); }
  }
  let gl;
  try { gl = canvas.getContext('webgl', { alpha:true, antialias:true, powerPreference:'low-power', preserveDrawingBuffer:false }); } catch { return startCPU(); }
  if (!gl) return startCPU();
  let program, uniforms, count, raf=0, lost=false, visible=true, dragged=false, lastFrame=0, auto=0, bob=0;
  let width=1,height=1,aspect=1, yaw=-.28,pitch=.65,roll=-.28,targetYaw=yaw,targetPitch=pitch;
  let pointer=null, anchorX=0,anchorY=0,downX=0,downY=0,originYaw=0,originPitch=0;
  function initialize() {
    const shader=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error('Shader compilation failed');return s;};
    const vs=shader(gl.VERTEX_SHADER,vertexSource),fs=shader(gl.FRAGMENT_SHADER,fragmentSource);
    program=gl.createProgram();gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);
    gl.deleteShader(vs);gl.deleteShader(fs);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error('Shader link failed');
    gl.useProgram(program);
    const mesh=createKnot();count=mesh.indices.length;
    for(const [name,data] of [['aPosition',mesh.positions],['aNormal',mesh.normals]]){const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);const attr=gl.getAttribLocation(program,name);gl.enableVertexAttribArray(attr);gl.vertexAttribPointer(attr,3,gl.FLOAT,false,0,0);}
    const index=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,index);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,mesh.indices,gl.STATIC_DRAW);
    uniforms=Object.fromEntries(['uProjection','uModel','uBob','uCamera'].map(name=>[name,gl.getUniformLocation(program,name)]));
    gl.enable(gl.DEPTH_TEST);gl.clearColor(0,0,0,0);panel.classList.remove('no-webgl');
  }
  function resize(){
    const rect=canvas.getBoundingClientRect();width=Math.max(1,rect.width);height=Math.max(1,rect.height);aspect=width/height;
    const mobile=width<550, maxDpr=mobile?1.5:1.75,dpr=Math.min(window.devicePixelRatio||1,maxDpr);
    canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);schedule();
  }
  function draw(now){
    raf=0;if(lost||document.hidden||!visible)return;
    const dt=Math.min((now-lastFrame)/1000,.04);lastFrame=now;
    const moving=isMotionEnabled();
    if(moving){auto+=dt*.1;bob=Math.sin(auto*1.5)*.075;}else{bob=0;}
    yaw+=(targetYaw-yaw)*.1;pitch+=(targetPitch-pitch)*.1;
    gl.viewport(0,0,canvas.width,canvas.height);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(program);
    gl.uniformMatrix4fv(uniforms.uProjection,false,perspective(aspect));
    const matrix=rotationMatrix(pitch,yaw+auto,roll);
    // Fit the object to a narrow mobile canvas without cropping the trefoil.
    const scale=Math.min(1,aspect*1.08);for(let i=0;i<12;i++)matrix[i]*=scale;
    gl.uniformMatrix4fv(uniforms.uModel,false,matrix);gl.uniform1f(uniforms.uBob,bob);gl.uniform3f(uniforms.uCamera,0,0,9.7);
    gl.drawElements(gl.TRIANGLES,count,gl.UNSIGNED_SHORT,0);
    if(moving||Math.abs(targetYaw-yaw)>.001||Math.abs(targetPitch-pitch)>.001)schedule();
  }
  function schedule(){if(!raf&&!lost&&visible&&!document.hidden)raf=requestAnimationFrame(draw);}
  try{initialize();}catch(error){console.info('TYC: using Canvas 3D renderer.',error.message);return startCPU();}
  const observer=new ResizeObserver(resize);observer.observe(canvas);
  const intersection=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible){lastFrame=performance.now();schedule();}else{cancelAnimationFrame(raf);raf=0;}});intersection.observe(canvas);
  canvas.addEventListener('pointerdown',e=>{if(!e.isPrimary||e.button!==0)return;pointer=e.pointerId;downX=anchorX=e.clientX;downY=anchorY=e.clientY;originYaw=targetYaw;originPitch=targetPitch;dragged=false;});
  canvas.addEventListener('pointermove',e=>{
    if(pointer!==e.pointerId)return;
    if(!dragged&&Math.hypot(e.clientX-downX,e.clientY-downY)>7){dragged=true;canvas.setPointerCapture(e.pointerId);}
    if(!dragged)return;
    targetYaw=originYaw+(e.clientX-anchorX)*.009;targetPitch=Math.max(-1.6,Math.min(1.6,originPitch+(e.clientY-anchorY)*.007));schedule();
  });
  const release=e=>{if(pointer===e.pointerId){pointer=null;if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);}};
  canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',release);canvas.addEventListener('lostpointercapture',()=>{pointer=null;});
  canvas.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home'].includes(e.key))return;e.preventDefault();if(e.key==='Home'){targetYaw=-.28;targetPitch=.65;auto=0;}else{targetYaw+=e.key==='ArrowLeft'?-.22:e.key==='ArrowRight'?.22:0;targetPitch=Math.max(-1.6,Math.min(1.6,targetPitch+(e.key==='ArrowUp'?-.18:e.key==='ArrowDown'?.18:0)));}schedule();});
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();lost=true;cancelAnimationFrame(raf);raf=0;fallback();});
  canvas.addEventListener('webglcontextrestored',()=>{lost=false;try{initialize();canvas.tabIndex=0;resize();}catch{fallback();}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(raf);raf=0;}else{lastFrame=performance.now();schedule();}});
  window.addEventListener('tyc:motion',schedule);resize();
  return { reset(){targetYaw=-.28;targetPitch=.65;auto=0;schedule();} };
}
