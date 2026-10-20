import * as PIXI from 'pixi.js';

export class Avatar {
  mouth = 0; emotion = 'neutral'; ready = false;
  async mount(container) {
    window.PIXI = PIXI;
    const { Live2DModel } = await import('pixi-live2d-display/cubism4');
    Live2DModel.registerTicker(PIXI.Ticker);
    this.app = new PIXI.Application({ resizeTo: container, backgroundAlpha: 0, antialias: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2), autoDensity: true });
    this.app.view.setAttribute('aria-label', '小汐 Live2D 动态角色');
    container.append(this.app.view);
    this.model = await Live2DModel.from(`${import.meta.env.BASE_URL}avatar/mao_pro.model3.json`, { autoInteract: true });
    this.model.anchor.set(0.5, 1);
    this.app.stage.addChild(this.model);
    this.model.internalModel.on('beforeModelUpdate', () => {
      const core = this.model.internalModel.coreModel;
      core.setParameterValueById('ParamA', this.mouth);
      core.setParameterValueById('ParamI', this.mouth * 0.2);
      core.setParameterValueById('ParamU', this.mouth * 0.14);
    });
    this.observer = new ResizeObserver(() => this.fit(container));
    this.observer.observe(container);
    this.fit(container); this.ready = true;
    return this;
  }
  fit(container) {
    if (!this.model) return;
    const { width, height } = this.model.internalModel;
    const w = container.clientWidth, h = container.clientHeight;
    this.model.scale.set(Math.min(w * 0.95 / width, h * 1.4 / height));
    this.model.position.set(w * 0.52, h * 1.37);
  }
  async setEmotion(emotion) {
    if (emotion === this.emotion) return;
    this.emotion = emotion;
    if (!this.model) return;
    const expressions = { neutral: 'exp_01', happy: 'exp_04', gentle: 'exp_02', surprised: 'exp_07' };
    try { await this.model.expression(expressions[emotion] || expressions.neutral); } catch {}
  }
  greet() { if (this.model) this.model.motion('', 0, 3); }
}
