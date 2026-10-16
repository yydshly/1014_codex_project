// An optional, locally synthesized sound bed, started only by the sound button.
export class TrainSound {
  constructor(){this.context=null;this.enabled=false;this.timer=null;this.nodes=[];this.volume=null;}
  async toggle(){if(this.enabled){this.stop();return false;}return this.start();}
  async start(){
    try{
      const Audio=globalThis.AudioContext??globalThis.webkitAudioContext;if(!Audio)return false;
      this.context??=new Audio();await this.context.resume();this.enabled=true;
      const ctx=this.context,master=ctx.createGain();master.gain.value=.11;master.connect(ctx.destination);this.volume=master;
      const buffer=ctx.createBuffer(1,ctx.sampleRate*3,ctx.sampleRate),data=buffer.getChannelData(0);let last=0;
      for(let i=0;i<data.length;i++){last=(last+(Math.random()*2-1)*.03)/1.02;data[i]=last*3;}
      const source=ctx.createBufferSource();source.buffer=buffer;source.loop=true;
      const filter=ctx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=240;source.connect(filter);filter.connect(master);source.start();this.nodes.push(source);
      const clack=()=>{if(!this.enabled||document.hidden)return;const t=ctx.currentTime;for(let j=0;j<2;j++){const o=ctx.createOscillator(),g=ctx.createGain();o.type='triangle';o.frequency.setValueAtTime(j?93:65,t+j*.12);g.gain.setValueAtTime(0,t+j*.12);g.gain.linearRampToValueAtTime(.16,t+j*.12+.006);g.gain.exponentialRampToValueAtTime(.001,t+j*.12+.1);o.connect(g);g.connect(master);o.start(t+j*.12);o.stop(t+j*.12+.12);}};
      clack();this.timer=setInterval(clack,830);return true;
    }catch{this.stop();return false;}
  }
  stop(){this.enabled=false;clearInterval(this.timer);this.timer=null;for(const n of this.nodes){try{n.stop();}catch{/* Already stopped. */}}this.nodes=[];this.volume?.disconnect();this.volume=null;}
  setPerspective(role,place){if(!this.volume||!this.context)return;const value=role==='cat'&&place!=='aisle'?.065:.11;this.volume.gain.setTargetAtTime(value,this.context.currentTime,.25);}
}
