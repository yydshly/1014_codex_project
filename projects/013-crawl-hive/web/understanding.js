import { initSourceCatalog } from './source-catalog-ui.js';

export function initUnderstanding() {
  initSourceCatalog();
  const dialog = document.querySelector('#understanding-map-dialog');
  const zoom = document.querySelector('#map-zoom');
  const image = document.querySelector('#map-zoom-image');
  const output = document.querySelector('#map-zoom-value');
  function updateZoom() {
    image.style.width = zoom.value + '%';
    output.textContent = zoom.value + '%';
    zoom.setAttribute('aria-valuetext', zoom.value + '%，相对于窗口适配宽度');
  }
  document.querySelectorAll('[data-open-understanding-map]').forEach(button => button.addEventListener('click', () => {
    zoom.value = '100';
    updateZoom();
    if (!dialog.open) dialog.showModal();
    document.querySelector('#map-canvas').scrollTo({top:0,left:0});
  }));
  zoom.addEventListener('input', updateZoom);
  document.querySelector('#map-fit').addEventListener('click', () => {zoom.value='100';updateZoom();});
  document.querySelector('#close-understanding-map').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  });
}
