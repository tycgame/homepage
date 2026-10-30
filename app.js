import {createBrandInteraction} from './brand.js';
import {startProjectPreloads} from './project-app.js';

const $=selector=>document.querySelector(selector),reduced=matchMedia('(prefers-reduced-motion: reduce)');
let requested=true;try{requested=localStorage.getItem('tyc-motion')!=='off';}catch{}
const motionEnabled=()=>requested&&!reduced.matches;
function updateMotion(){const enabled=motionEnabled();document.body.classList.toggle('motion-off',!enabled);document.documentElement.style.scrollBehavior=enabled?'':'auto';const button=$('.motion-toggle');button.setAttribute('aria-pressed',String(enabled));button.setAttribute('aria-label',enabled?'关闭动态效果':'开启动效');button.disabled=reduced.matches;button.title=reduced.matches?'跟随系统减少动态效果设置':enabled?'关闭动态效果':'开启动效';}
$('.motion-toggle').addEventListener('click',()=>{requested=!requested;try{localStorage.setItem('tyc-motion',requested?'on':'off');}catch{}updateMotion();});
if(reduced.addEventListener)reduced.addEventListener('change',updateMotion);else reduced.addListener(updateMotion);updateMotion();
let toastTimer;
function toast(message){clearTimeout(toastTimer);$('#toast').textContent=message;$('#toast').classList.add('visible');toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),5000);}
// Start/adopt parser-started preloads before initializing optional interactions.
startProjectPreloads({motionEnabled,notify:toast});
createBrandInteraction($('#brand-interaction'),$('#monogram'));
$('#year').textContent=String(new Date().getFullYear());
let prompt;
const install=$('#install-button');
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();prompt=event;install.hidden=false;});
install.addEventListener('click',async()=>{if(!prompt){toast('在 Safari 中点「分享」，再选择「添加到主屏幕」。');return;}const current=prompt;prompt=null;install.hidden=true;try{await current.prompt();}catch{}});
window.addEventListener('appinstalled',()=>{prompt=null;install.hidden=true;});
const isIOS=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
if(isIOS&&!matchMedia('(display-mode: standalone)').matches&&!navigator.standalone)install.hidden=false;
if('serviceWorker' in navigator&&(location.hostname.endsWith('.github.io')||location.hostname==='localhost')){
  // Do not delay service-worker update detection behind the embedded game load.
  navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).catch(()=>{});
}
document.addEventListener('visibilitychange',()=>document.body.classList.toggle('page-is-hidden',document.hidden));
