import {TEAMS,ROUNDS,COMPOUNDS,roster,clamp} from './data.js';
import {createDynamics,stepDynamics,tireGrip} from './physics.js';
import {calculateQualGrid,awardRace,saveCareer} from './career.js';
export class Game{
  constructor(world,onEvent){this.world=world;this.onEvent=onEvent;this.mode='garage';this.career=null;this.cars=[];this.player=null;this.elapsed=0;this.session='';this.countdown=0;this.paused=false;this.wetness=0;this.controls={};this.practiceLimit=95;this.qualLimit=110;this.raceLaps=3;this.notification='';this.notifyUntil=0;this.pitCompound='medium';this.engineerLast=-30;}
  setCareer(c){this.career=c;this.world.build(ROUNDS[Math.min(c?.round||0,ROUNDS.length-1)]);this.mode='garage';this.paused=false;this.cars=[];this.player=null;}
  message(s,duration=3){this.notification=s;this.notifyUntil=this.elapsed+duration;this.onEvent('message',s)}
  startSession(stage){
    if(!this.career||this.career.round>=ROUNDS.length)return;
    this.session=stage;this.mode='session';this.elapsed=0;this.paused=false;this.countdown=3.25;
    this.round=ROUNDS[this.career.round];this.raceLaps=this.round.laps;
    this.circuit=this.world.build(this.round);
    this.wetness=this.round.weather==='rain'?.66:this.round.weather==='variable'?.21:0;this.engineerLast=-30;
    this.world.updateWeather(this.wetness);
    this.cars=[];
    const drivers=roster(this.career.teamId,this.career.driverName);
    const grid=stage==='race'&&this.career.qualifyingGrid?this.career.qualifyingGrid.map(i=>i.id):drivers.map(d=>d.id);
    if(stage!=='race')grid.sort((a,b)=>a===drivers.find(d=>d.isPlayer).id?-1:b===drivers.find(d=>d.isPlayer).id?1:0);
    for(let i=0;i<grid.length;i++){
      const d=drivers.find(x=>x.id===grid[i]);const team=TEAMS.find(t=>t.id===d.team);
      const startS=stage==='race'?-23-i*11:-23-i*43;
      const lane=stage==='race'?(i%2?2.4:-2.4):i===0?0:i%2?2.3:-2.3;
      const p=this.circuit.position(startS,lane);
      const preset=this.career.settings?.startCompound||'auto';
      const compound=d.isPlayer&&stage==='race'&&COMPOUNDS[preset]?preset:this.wetness>.5?'intermediate':stage==='qualifying'?'soft':'medium';
      const dynamics=createDynamics(p.x,p.z,p.heading,compound);
      const entry={...d,team,model:this.world.createCar(d.color,d.isPlayer),dyn:dynamics,s:startS,startS,lap:1,completed:0,lastLap:0,bestLap:Infinity,lapStart:0,finishTime:null,offset:lane,laneTarget:lane,projectionIndex:null,requestedPit:false,pitTimer:0,pitCooldown:0,trackWarnings:0,trackTime:0,trackArmed:true,penaltySeconds:0,pitStops:0,usedCompounds:[compound]};
      if(!d.isPlayer)entry.dyn.vx=stage==='race'?0:32;
      this.cars.push(entry);
    }
    this.player=this.cars.find(c=>c.isPlayer);
    this.world.camera.position.set(this.player.dyn.x-10,8,this.player.dyn.z-12);
    this.world.camTarget.set(this.player.dyn.x,2,this.player.dyn.z);
    this.pitCompound=this.wetness>.5?'intermediate':'medium';
    this.onEvent('start',stage);
  }
  setControls(controls){this.controls=controls}
  requestPit(){
    if(this.mode!=='session'||this.session!=='race')return;
    this.player.requestedPit=!this.player.requestedPit;
    this.message(this.player.requestedPit?'Pit stop zamówiony — zjazd przy linii startu':'Pit stop odwołany');
  }
  setCompound(s){if(COMPOUNDS[s]){this.pitCompound=s;this.message('Następny komplet: '+COMPOUNDS[s].label,2)}}
  togglePause(){if(this.mode!=='session')return;this.paused=!this.paused;this.onEvent('pause',this.paused)}
  resetPosition(){if(this.mode!=='session'||!this.player)return;const c=this.player,p=this.circuit.position(c.s,0);Object.assign(c.dyn,{x:p.x,z:p.z,heading:p.heading,vx:0,vy:0,yawRate:0,damage:clamp(c.dyn.damage+.04,0,1)});this.elapsed+=3;this.message('Reset pozycji: +3 sekundy kary')}
  weatherStep(dt){
    const old=this.wetness;
    if(this.round.weather==='variable')this.wetness=clamp(.32+.38*Math.sin(this.elapsed/48-.6),0,.7);
    if(this.round.weather==='rain')this.wetness=clamp(.62+.14*Math.sin(this.elapsed/26),.5,.83);
    if((old<.3&&this.wetness>=.3)||(old>=.3&&this.wetness<.3))this.world.updateWeather(this.wetness);
  }
  step(dt){
    if(this.mode!=='session'||this.paused)return;
    if(this.countdown>0){this.countdown-=dt;return;}
    this.elapsed+=dt;this.weatherStep(dt);
    this.stepPlayer(dt);
    this.stepAI(dt);
    this.engineerStep();
    this.collisions();
    for(const c of this.cars){this.updateLap(c);this.world.placeCar(c.model,c.dyn.x,c.dyn.z,c.dyn.heading,c.dyn.vx,c.dyn.steering);}
    if(this.session==='practice'&&this.elapsed>=this.practiceLimit)this.finishSession('limit');
    if(this.session==='qualifying'&&this.elapsed>=this.qualLimit)this.finishSession('limit');
    if(this.session==='race'&&this.player.completed>=this.raceLaps)this.finishSession('race');
  }
  stepPlayer(dt){
    const c=this.player,d=c.dyn;
    if(c.pitTimer>0){c.pitTimer-=dt;d.vx=0;d.vy=0;d.yawRate=0;if(c.pitTimer<=0){d.tireWear=0;d.tireTemp=83;d.brakeTemp=Math.min(d.brakeTemp,340);d.compound=this.pitCompound;c.usedCompounds.push(d.compound);c.pitStops++;d.damage=Math.max(0,d.damage-.22);this.message('Pit stop zakończony — opony '+COMPOUNDS[d.compound].label)}return;}
    const proj=this.circuit.project(d.x,d.z,c.projectionIndex);c.projectionIndex=proj.index;c.offset=proj.offset;
    const nearest=proj.s+Math.round((c.s-proj.s)/this.circuit.length)*this.circuit.length;
    if(Math.abs(nearest-c.s)<35)c.s=nearest;
    const u=((c.s%this.circuit.length)+this.circuit.length)%this.circuit.length;
    const straight=this.circuit.curvatureAt(c.s+25)<.0035;
    const nextRival=this.cars.filter(o=>o!==c&&o.s>c.s&&o.s-c.s<80).sort((a,b)=>a.s-b.s)[0];
    // W wyścigu DRS tylko, gdy rywal jest w odległości ~1 sekundy.
    c.drsEligible=this.session!=='race'||(c.completed>=1&&nextRival&&nextRival.s-c.s<Math.max(17,d.vx));
    d.drs=!!this.controls.drs&&straight&&this.wetness<.22&&!!c.drsEligible;
    stepDynamics(d,{...this.controls,stability:this.career.settings?.stability!==false},{offset:c.offset,width:this.circuit.width,wetness:this.wetness},dt,this.career.upgrades);
    // Guardrails have a speed and damage cost rather than allowing shortcuts.
    if(Math.abs(c.offset)>this.circuit.width/2+5.7){
      const p=this.circuit.position(c.s,Math.sign(c.offset)*(this.circuit.width/2+5.35));
      d.x=p.x;d.z=p.z;d.vx*=.52;d.vy*=-.15;d.damage=clamp(d.damage+.018,0,.88);
    }
    if(c.requestedPit&&this.session==='race'&&c.completed<this.raceLaps&&c.s>this.circuit.length-48&&u>this.circuit.length-48&&u<this.circuit.length-7&&c.pitCooldown<=0){
      c.requestedPit=false;c.pitTimer=5.3;c.pitCooldown=20;d.vx=0;d.vy=0;this.message('PIT STOP — wymiana opon i naprawa',5);
    }
    c.pitCooldown=Math.max(0,c.pitCooldown-dt);
    const beyond=Math.abs(c.offset)>this.circuit.width/2+1.2;
    if(beyond){c.trackTime+=dt;if(c.trackTime>=.9&&c.trackArmed){
      c.trackWarnings++;c.trackArmed=false;
      if(c.trackWarnings%3===0){c.penaltySeconds+=5;this.message('TRACK LIMITS · +5 s kary');}
      else this.message('TRACK LIMITS · ostrzeżenie '+(c.trackWarnings%3)+'/3');
    }}else {c.trackTime=0;c.trackArmed=true;}
  
  }
  stepAI(dt){
    const L=this.circuit.length;
    for(const c of this.cars){
      if(c.isPlayer||c.finishTime!==null)continue;
      const d=c.dyn,teamStrength=c.team.rating;
      const future=c.s+Math.max(24,d.vx*1.7);
      const futureCurvature=Math.max(this.circuit.curvatureAt(future),this.circuit.curvatureAt(c.s+10)*.8);
      const wetGrip=this.wetness>.45?.79:1;
      const relativeGrip=tireGrip(d.compound,this.wetness,d.tireWear)/Math.max(.25,tireGrip('medium',this.wetness,0));
      let maxCorner=Math.sqrt((1.58*9.81*wetGrip)/Math.max(.0003,futureCurvature));
      const difficulty=this.career.settings?.difficulty||'normal';
      const difficultyFactor=difficulty==='easy'?.86:difficulty==='pro'?1.1:1;
      const speedTarget=clamp(maxCorner,19,78)*(.71+c.skill*.29)*(.9+teamStrength*.13)*difficultyFactor*clamp(relativeGrip,.72,1.10);
      const ahead=this.cars.find(other=>other!==c&&other.finishTime===null&&other.s>c.s&&other.s-c.s<34&&Math.abs(other.offset-c.offset)<3);
      if(ahead){c.laneTarget=(c.s/30%2<1?3:-3);}
      else c.laneTarget=Math.sin(c.s/L*6.283+this.cars.indexOf(c)*1.3)*1.25;
      c.laneTarget=clamp(c.laneTarget,-this.circuit.width/2+2,this.circuit.width/2-2);
      c.offset+=(c.laneTarget-c.offset)*Math.min(1,dt*.82);
      const accel=speedTarget>d.vx?9.4:22;
      d.vx+=(speedTarget-d.vx)*Math.min(1,dt*accel/Math.max(5,Math.abs(speedTarget-d.vx)));
      if(ahead&&Math.abs(ahead.s-c.s)<8&&Math.abs(ahead.offset-c.offset)<2.9)d.vx=Math.min(d.vx,ahead.dyn.vx+1.2);
      if(c.pitTimer>0){c.pitTimer-=dt;d.vx=0;if(c.pitTimer<=0){d.tireWear=0;d.tireTemp=83;d.compound=this.wetness>.5?'intermediate':'hard';c.usedCompounds.push(d.compound);c.pitStops++;}}
      else{
        // AI tire decisions are based on wear and remaining distance.
        if(c.completed>0&&c.completed<this.raceLaps-1&&d.tireWear>.42&&c.s%L>L-42&&c.s%L<L-8){c.pitTimer=4.7;d.vx=0;}
        else c.s+=d.vx*dt;
      }
      d.tireWear=clamp(d.tireWear+dt*.003*(COMPOUNDS[d.compound].wear||1)*(.6+d.vx/60),0,1);
      const p=this.circuit.position(c.s,c.offset),next=this.circuit.position(c.s+4,c.offset);
      d.x=p.x;d.z=p.z;d.heading=Math.atan2(next.x-p.x,next.z-p.z);d.steering=0;
    }
  }
  collisions(){
    const c=this.player,d=c.dyn;if(!c||c.pitTimer>0)return;
    for(const o of this.cars){if(o===c||o.finishTime!==null)continue;
      const dx=d.x-o.dyn.x,dz=d.z-o.dyn.z,dist=Math.hypot(dx,dz);
      if(dist<3.25&&dist>.05){
        const push=(3.25-dist)*.2;d.x+=dx/dist*push;d.z+=dz/dist*push;
        d.vx*=.94;d.vy+=((dx*Math.cos(d.heading)-dz*Math.sin(d.heading))/dist)*1.4;
        d.damage=clamp(d.damage+.0016,0,.9);
      }
    }
  }
  updateLap(c){
    const L=this.circuit.length;
    // Pełne okrążenie liczymy dopiero po przejechaniu linii na s=L, nie od pozycji startowej na polach.
    const completed=Math.max(0,Math.floor((c.s+.3)/L));
    if(completed>c.completed){
      const lapTime=this.elapsed-c.lapStart;c.lastLap=lapTime;c.bestLap=Math.min(c.bestLap,lapTime);c.lapStart=this.elapsed;c.completed=completed;c.lap=completed+1;
      if(c.isPlayer&&this.session!=='race')this.message('Okrążenie '+completed+' — '+lapTime.toFixed(2)+' s');
      if(c.isPlayer&&this.session==='race')this.message('Okrążenie '+Math.min(completed+1,this.raceLaps)+' / '+this.raceLaps);
    }
    if(this.session==='race'&&c.completed>=this.raceLaps&&c.finishTime===null){c.finishTime=this.elapsed+(c.penaltySeconds||0);if(!c.isPlayer)c.dyn.vx=0;}
  }
  rank(){const s=this.player.s-this.player.penaltySeconds*45;return 1+this.cars.filter(c=>c!==this.player&&c.s>s).length}
  order(){return [...this.cars].sort((a,b)=>{
    if(a.finishTime!==null&&b.finishTime!==null)return a.finishTime-b.finishTime;
    if(a.finishTime!==null)return -1;if(b.finishTime!==null)return 1;
    return (b.s-(b.penaltySeconds||0)*45)-(a.s-(a.penaltySeconds||0)*45);
  })}
  engineerStep(){
    const c=this.player,d=c?.dyn;if(!c||this.elapsed-this.engineerLast<24)return;
    let tip='';
    if(d.tireWear>.68)tip='INŻYNIER · Opony zużyte — rozważ pit stop';
    else if(d.brakeTemp>800)tip='INŻYNIER · Przegrzane hamulce — odpuść hamowanie';
    else if(d.tireTemp>125)tip='INŻYNIER · Zbyt gorące opony — oszczędzaj przyczepność';
    else if(this.wetness>.53&&!['wet','intermediate'].includes(d.compound))tip='INŻYNIER · Deszcz! Zalecam opony przejściowe';
    else if(this.wetness<.12&&['wet','intermediate'].includes(d.compound))tip='INŻYNIER · Tor wysycha, przejdź na slicki';
    else if(d.fuel<18)tip='INŻYNIER · Niski poziom paliwa — oszczędzaj';
    if(tip){this.engineerLast=this.elapsed;this.message(tip,6)}
  }
  estimateRaceFinish(){
    if(this.session!=='race')return;
    const finishS=this.raceLaps*this.circuit.length;
    for(const c of this.cars){
      if(c.finishTime!==null)continue;
      const meters=Math.max(0,finishS-c.s);
      // Prognoza na podstawie tempa i krzywizny toru; zawodnicy nie są klasyfikowani jako DNF.
      const teamPace=clamp(c.dyn.vx*(.94+c.skill*.08),20,80);
      c.finishTime=this.elapsed+meters/teamPace+(c.pitTimer>0?c.pitTimer:0)+(c.penaltySeconds||0);
      c.estimated=true;
    }
  }
  finishSession(reason='manual'){
    if(this.mode!=='session')return;
    this.mode='result';let result={stage:this.session,reason,time:this.elapsed,player:this.player,standings:this.order()};
    if(this.session==='qualifying'){
      const grid=calculateQualGrid(this.career,this.player.bestLap);
      this.career.qualifyingGrid=grid;result.grid=grid;this.career.stage='race';saveCareer(this.career);
    }
    if(this.session==='practice'){this.career.stage='qualifying';saveCareer(this.career)}
    if(this.session==='race'){
      this.estimateRaceFinish();
      result.standings=this.order();
      const order=this.order().map(c=>c.id);
      result.award=awardRace(this.career,order);
      result.standings=this.order();
    }
    this.onEvent('finish',result);
  }
  endEarly(){if(this.mode==='session'&&this.session!=='race')this.finishSession('manual')}
  cameraCycle(){this.world.cameraMode=(this.world.cameraMode+1)%3;this.message(['Kamera: pościg','Kamera: kokpit','Kamera: z góry'][this.world.cameraMode],1.6)}
}
