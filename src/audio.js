/** Tiny procedural motor synthesizer, no downloaded audio assets. */
export class EngineAudio {
  constructor(){this.context=null;this.muted=false;this.gain=null;this.low=null;this.osc=null;this.harmonic=null;}
  unlock(){
    if(this.context){if(this.context.state==='suspended')this.context.resume().catch(()=>{});return;}
    const C=window.AudioContext||window.webkitAudioContext;if(!C)return;
    try{
      this.context=new C();const ctx=this.context;
      this.gain=ctx.createGain();this.gain.gain.value=0;
      this.low=ctx.createBiquadFilter();this.low.type='lowpass';this.low.frequency.value=500;
      this.osc=ctx.createOscillator();this.osc.type='sawtooth';this.osc.frequency.value=85;
      this.harmonic=ctx.createOscillator();this.harmonic.type='triangle';this.harmonic.frequency.value=145;
      const harmGain=ctx.createGain();harmGain.gain.value=.28;
      this.osc.connect(this.low);this.harmonic.connect(harmGain);harmGain.connect(this.low);
      this.low.connect(this.gain);this.gain.connect(ctx.destination);
      this.osc.start();this.harmonic.start();
    }catch{this.context=null}
  }
  update(player,active){if(!this.context)return;const now=this.context.currentTime;
    const vol=active&&!this.muted?0.036:0;
    const rpm=player?.dyn?.rpm||3000;
    this.gain.gain.setTargetAtTime(vol,now,.07);
    this.osc.frequency.setTargetAtTime(55+rpm*.011,now,.055);
    this.harmonic.frequency.setTargetAtTime(95+rpm*.021,now,.055);
    this.low.frequency.setTargetAtTime(460+(player?.dyn?.vx||0)*29,now,.06);
  }
  toggle(){this.muted=!this.muted;return this.muted}
}
