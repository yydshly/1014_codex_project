import './research.css';
const assets = {
  png: new URL('../../assets/understanding-overview/agent-studio-understanding.png', import.meta.url).href,
  svg: new URL('../../assets/understanding-overview/agent-studio-understanding.svg', import.meta.url).href,
  proof: new URL('../../assets/takeover-voice/verification.json', import.meta.url).href,
};
for (const link of document.querySelectorAll('[data-asset]')) {
  link.href = assets[link.dataset.asset]; link.target = '_blank'; link.rel = 'noopener';
}
