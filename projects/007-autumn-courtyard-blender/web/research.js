"use strict";
const toc = document.getElementById('research-toc-panel');
const narrow = matchMedia('(max-width: 740px)');
if (narrow.matches) toc.open = false;
document.querySelectorAll('.research-toc nav a').forEach(link => {
  link.addEventListener('click', () => { if (narrow.matches) toc.open = false; });
});
const chapterLinks = [...document.querySelectorAll('.research-toc nav a')];
const chapters = [...document.querySelectorAll('.research-chapter')];
const updateCurrentChapter = () => {
  const threshold = narrow.matches ? 140 : 160;
  let current = chapters[0];
  chapters.forEach(chapter => { if (chapter.getBoundingClientRect().top <= threshold) current = chapter; });
  chapterLinks.forEach(link => {
    if (link.hash === '#' + current.id) link.setAttribute('aria-current','location');
    else link.removeAttribute('aria-current');
  });
};
let scrollFrame = 0;
addEventListener('scroll',() => {
  if (scrollFrame) return;
  scrollFrame = requestAnimationFrame(() => { scrollFrame = 0; updateCurrentChapter(); });
},{passive:true});
addEventListener('resize',updateCurrentChapter);
addEventListener('hashchange',updateCurrentChapter);
updateCurrentChapter();
const questions = [...document.querySelectorAll('.research-faq')];
const expand = document.getElementById('expand-questions');
const updateExpand = () => {
  const allOpen = questions.every(question => question.open);
  expand.textContent = allOpen ? '收起全部问答' : '展开全部问答';
  expand.setAttribute('aria-expanded',String(allOpen));
};
expand.addEventListener('click',() => {
  const next = !questions.every(question => question.open);
  questions.forEach(question => { question.open = next; });
  updateExpand();
});
questions.forEach(question => question.addEventListener('toggle',updateExpand));
const printableDetails = [...document.querySelectorAll('.research-chapter details')];
let printOpen = [];
addEventListener('beforeprint',() => {
  printOpen = printableDetails.map(detail => detail.open);
  printableDetails.forEach(detail => { detail.open = true; });
});
addEventListener('afterprint',() => {
  printableDetails.forEach((detail,index) => { detail.open = printOpen[index]; });
  updateExpand();
});
