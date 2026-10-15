const load = document.getElementById('load-video');
const video = document.getElementById('original-video');
const message = document.getElementById('video-message');
load.addEventListener('click', () => {
  video.src='https://video.twimg.com/amplify_video/2109814066734940160/vid/avc1/960x720/__3SqtVeeaK1x6z5.mp4?tag=29';
  load.hidden=true;
  const timer=setTimeout(()=>{
    if(video.readyState<2){message.hidden=false;message.textContent='原帖媒体暂未加载，可能受源站网络限制。可打开原帖查看，封面与图解可继续阅读。';}
  },15000);
  video.addEventListener('canplay',()=>{clearTimeout(timer);message.hidden=true;},{once:true});
  video.addEventListener('error',()=>clearTimeout(timer),{once:true});
  video.play().catch(()=>{message.hidden=false;message.textContent='如播放未启动，请点击视频播放按钮，或打开原帖。';});
},{once:true});
video.addEventListener('error',()=>{message.hidden=false;message.textContent='原帖媒体暂时不可访问，可以通过上方原帖链接查看；研究与图解不受影响。';});
const links=[...document.querySelectorAll('.contents nav a')];
if('IntersectionObserver' in window){
  const observer=new IntersectionObserver(entries=>{
    const visible=entries.filter(x=>x.isIntersecting).sort((a,b)=>a.boundingClientRect.top-b.boundingClientRect.top)[0];
    if(visible) links.forEach(a=>{
      const selected=a.hash===`#${visible.target.id}`;a.classList.toggle('active',selected);
      if(selected)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current');
    });
  },{rootMargin:'-8% 0px -65% 0px',threshold:0});
  document.querySelectorAll('.research-section').forEach(section=>observer.observe(section));
}
