import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/game.js';
import {createCareer} from '../src/career.js';
import {createDynamics,stepDynamics} from '../src/physics.js';

globalThis.localStorage ??= {getItem:()=>null,setItem:()=>{},removeItem:()=>{}};
const env={width:15.4,offset:0,wetness:0};
class Circle {
  constructor(){this.length=1200;this.width=15.4;this.radius=1200/(Math.PI*2)}
  position(s,offset=0){const angle=s/this.radius,r=this.radius-offset;return {x:r*Math.sin(angle),z:r*Math.cos(angle),heading:-angle}}
  project(x,z){const angle=Math.atan2(x,z);return {index:0,s:((angle*this.radius)%1200+1200)%1200,offset:this.radius-Math.hypot(x,z)}}
  curvatureAt(){return 0}
}
class WorldStub {
  constructor(){this.camera={position:{set(){}}};this.camTarget={set(){}}}
  build(){return new Circle()}
  createCar(){return {group:{position:{}}}}
  placeCar(){}
  updateWeather(){}
}
const launch=(stage='race')=>{const game=new Game(new WorldStub(),()=>{}),career=createCareer();career.stage=stage;game.setCareer(career);game.startSession(stage);game.countdown=0;return game};

test('temperatura rośnie przy hamowaniu, a przegrzane hamulce tracą skuteczność',()=>{
  const good=createDynamics(0,0,0),hot=createDynamics(0,0,0);
  good.vx=45;hot.vx=45;hot.brakeTemp=1050;
  stepDynamics(good,{brake:1},env,1/60);
  stepDynamics(hot,{brake:1},env,1/60);
  assert.ok(good.brakeTemp>320);
  assert.ok(hot.vx>good.vx,'gorące hamulce powinny hamować słabiej');
  assert.ok(Number.isFinite(good.tireTemp));
});

test('opony startowe kariery są uwzględniane bez psucia zapisu kariery',()=>{
  const game=new Game(new WorldStub(),()=>{}),career=createCareer();
  career.stage='race';career.settings.startCompound='hard';game.setCareer(career);game.startSession('race');
  assert.equal(game.player.dyn.compound,'hard');
  assert.equal(game.player.usedCompounds[0],'hard');
});

test('limity toru: trzy ostrzeżenia skutkują karą 5 sekund',()=>{
  const g=launch(),p=g.player,r=g.circuit.radius;
  for(let j=0;j<3;j++){
    p.dyn.x=0;p.dyn.z=r-g.circuit.width/2-2.0;p.offset=0;
    for(let k=0;k<70;k++)g.stepPlayer(1/60);
    p.dyn.x=0;p.dyn.z=r;p.offset=0;g.stepPlayer(1/60);
  }
  assert.equal(p.trackWarnings,3);
  assert.equal(p.penaltySeconds,5);
});

test('DRS w wyścigu wymaga rywala z przodu, suchego toru i ukończenia okrążenia',()=>{
  const g=launch(),p=g.player;
  p.s=100;Object.assign(p.dyn,g.circuit.position(100));p.completed=1;p.dyn.vx=40;
  for(const c of g.cars.filter(x=>!x.isPlayer))c.s=-200;
  const rival=g.cars.find(x=>!x.isPlayer);rival.s=120;
  g.controls={drs:true};g.stepPlayer(1/60);assert.equal(p.dyn.drs,true);
  rival.s=240;g.stepPlayer(1/60);assert.equal(p.dyn.drs,false);
  rival.s=120;g.wetness=.8;g.stepPlayer(1/60);assert.equal(p.dyn.drs,false);
});

test('po dotarciu gracza do mety AI otrzymuje przewidywany czas, a nie DNF',()=>{
  const g=launch();g.elapsed=195;g.player.s=g.raceLaps*g.circuit.length+1;g.updateLap(g.player);g.finishSession('race');
  assert.equal(g.mode,'result');
  assert.equal(g.career.history.length,1);
  assert.ok(g.cars.every(c=>Number.isFinite(c.finishTime)));
  assert.equal(g.cars.filter(c=>c.estimated).length,11);
});
