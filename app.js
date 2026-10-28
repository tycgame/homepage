import { createSculpture } from './sculpture.js';
import { attachPortal } from './navigation.js';

const $ = selector => document.querySelector(selector);
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
let motionRequested = true;
try { motionRequested = localStorage.getItem('tyc-motion') !== 'off'; } catch { /* Private browsing may block storage. */ }
const motionEnabled = () => motionRequested && !reduced.matches;
const motionButton = $('.motion-toggle');
function updateMotion() {
  const enabled = motionEnabled();
  document.body.classList.toggle('motion-off', !enabled);
  document.documentElement.style.scrollBehavior = enabled ? '' : 'auto';
  motionButton.setAttribute('aria-pressed', String(enabled));
  motionButton.setAttribute('aria-label', reduced.matches ? '系统已启用减少动态效果' : enabled ? '关闭动态效果' : '开启动态效果');
  motionButton.disabled = reduced.matches;
  motionButton.title = reduced.matches ? '跟随系统「减少动态效果」设置' : '切换动态效果';
  $('.motion-label').textContent = enabled ? '动态开启' : '静态模式';
  window.dispatchEvent(new Event('tyc:motion'));
}
motionButton.addEventListener('click', () => {
  motionRequested = !motionRequested;
  try { localStorage.setItem('tyc-motion', motionRequested ? 'on' : 'off'); } catch { /* Optional preference. */ }
  updateMotion();
});
if (reduced.addEventListener) reduced.addEventListener('change', updateMotion);
else reduced.addListener(updateMotion);
updateMotion();

// Keep the main navigation and transition functional even without WebGL support.
try { createSculpture($('#sculpture'), motionEnabled); } catch { $('#sculpture-panel').classList.add('no-webgl'); }
attachPortal($('#phigros-link'), $('#portal-overlay'), motionEnabled);

const clock = $('#clock');
const formatter = new Intl.DateTimeFormat('en-GB', { timeZone:'Asia/Shanghai', hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false });
function updateClock() {
  const now = new Date();clock.textContent = formatter.format(now);clock.dateTime = now.toISOString();$('#year').textContent = String(now.getFullYear());
}
let clockTimer;
function startClock() { clearInterval(clockTimer);updateClock();if (!document.hidden) clockTimer = setInterval(updateClock, 1000); }
document.addEventListener('visibilitychange', startClock);startClock();

const navLinks = [...document.querySelectorAll('.nav-link')];
if ('IntersectionObserver' in window) {
  const visible = new Map();
  const navObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => visible.set(entry.target.id, entry.isIntersecting));
    const current = ['about','worlds','home'].find(id => visible.get(id)) || 'home';
    navLinks.forEach(link => { const active = link.hash === `#${current}`;link.classList.toggle('active',active);if(active)link.setAttribute('aria-current','location');else link.removeAttribute('aria-current'); });
  }, { rootMargin:'-15% 0px -35% 0px', threshold:0 });
  ['home','worlds','about'].forEach(id => navObserver.observe(document.getElementById(id)));
}

let toastTimer;
function toast(message) { clearTimeout(toastTimer);$('#toast').textContent=message;$('#toast').classList.add('visible');toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),5000); }
const installButton = $('#install-button');
let installPrompt;
window.addEventListener('beforeinstallprompt', event => { event.preventDefault();installPrompt=event;installButton.hidden=false; });
installButton.addEventListener('click', async () => {
  if(!installPrompt)return;const prompt=installPrompt;installPrompt=null;installButton.hidden=true;
  try{await prompt.prompt();const result=await prompt.userChoice;if(result.outcome==='accepted')toast('TYC，已加入你的主屏幕。');}catch{ /* Install UI can be dismissed by the OS. */ }
});
window.addEventListener('appinstalled',()=>{installPrompt=null;installButton.hidden=true;});
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform==='MacIntel' && navigator.maxTouchPoints>1);
if (isIOS && !window.matchMedia('(display-mode: standalone)').matches && !navigator.standalone) {
  installButton.hidden=false;
  installButton.addEventListener('click',()=>{if(!installPrompt)toast('在 Safari 中点「分享」，再选择「添加到主屏幕」。');});
}
if ('serviceWorker' in navigator && (location.protocol==='https:' || location.hostname==='localhost')) {
  // Register only on the deployed site; preview hosts must not retain stale files.
  if (location.hostname.endsWith('.github.io') || location.hostname==='localhost') {
    window.addEventListener('load',()=>{navigator.serviceWorker.register('./sw.js').catch(()=>{});},{once:true});
  }
}
