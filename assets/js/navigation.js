/* global document, getComputedStyle */
/* Navigation disclosure toggle */
(function(){const b=document.getElementById('nav-toggle');const n=document.getElementById('primary-nav');if(!b||!n)return;
let last=null;const first=()=>n.querySelector('a,button,[tabindex]:not([tabindex="-1"])');
function open(){last=document.activeElement;n.hidden=false;b.setAttribute('aria-expanded','true');document.body.classList.add('overflow-hidden');const el=first();if(el)el.focus();document.addEventListener('keydown',onKey);backdrop(true);}
function close(){n.hidden=true;b.setAttribute('aria-expanded','false');document.body.classList.remove('overflow-hidden');document.removeEventListener('keydown',onKey);backdrop(false);if(last)b.focus();}
function onKey(e){if(e.key==='Escape')close();}
function toggle(){(b.getAttribute('aria-expanded')==='true')?close():open();}
b.addEventListener('pointerup',toggle);b.addEventListener('click',e=>{e.preventDefault();toggle();});
n.addEventListener('click',e=>{if(e.target.closest('a,button'))close();},{capture:true});
let bd=null;function backdrop(show){if(show){if(!bd){bd=document.createElement('div');bd.className='fixed inset-0 z-40 bg-black/30';bd.setAttribute('data-backdrop','');bd.addEventListener('click',close,{passive:true});document.body.appendChild(bd);}}else if(bd){bd.remove();bd=null;}}
const header=b.closest('header');if(header&&getComputedStyle(header).overflow!=='visible')header.style.overflow='visible';})();
