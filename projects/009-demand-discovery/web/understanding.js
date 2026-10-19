const viewport=document.querySelector('#map-viewport');
const sheet=document.querySelector('#map-sheet');
const header=document.querySelector('#map-header');
const scale=document.querySelector('#map-scale');
let zoom=1;
let fitted=true;
function fitZoom(){const style=getComputedStyle(viewport);return Math.min(1,(viewport.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight))/2000);}
function draw(){
  document.documentElement.style.setProperty('--map-header-height',`${header.getBoundingClientRect().height}px`);
  if(fitted)zoom=fitZoom();
  sheet.style.width=`${Math.max(.1,Math.min(2,zoom))*2000}px`;
  scale.textContent=`${Math.round(zoom*100)}%`;
  document.querySelector('#map-minus').disabled=zoom<=.1;
  document.querySelector('#map-plus').disabled=zoom>=2;
}
function adjust(factor){fitted=false;zoom=Math.max(.1,Math.min(2,zoom*factor));draw();}
document.querySelector('#map-minus').addEventListener('click',()=>adjust(1/1.3));
document.querySelector('#map-plus').addEventListener('click',()=>adjust(1.3));
document.querySelector('#map-fit').addEventListener('click',()=>{fitted=true;draw();viewport.scrollLeft=0;});
document.querySelector('#map-original').addEventListener('click',()=>{fitted=false;zoom=1;draw();});
new ResizeObserver(draw).observe(header);
window.addEventListener('resize',draw);
draw();
