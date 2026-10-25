import test from 'node:test';import assert from 'node:assert/strict';
import {Game} from '../src/game.js';import {createCareer} from '../src/career.js';
import {ROUNDS} from '../src/data.js';
globalThis.localStorage??={getItem:()=>null,setItem:()=>{},removeItem:()=>{}};
class FakeCircuit{
 constructor(){this.length=1200;this.width=15.4;this.radius=this.length/(Math.PI*2)}
 position(s,offset=0){const t=s/this.radius;const r=this.radius-offset;return {x:r*Math.sin(t),z:r*Math.cos(t),heading:-t}}
 project(x,z){const angle=Math.atan2(x,z);let s=((angle*this.radius)%this.length+this.length)%this.length;return {s,index:0,offset:this.radius-Math.hypot(x,z)}}
 curvatureAt(){return 1/this.radius}
}
class FakeWorld{
 constructor(){this.camera={position:{set:()=>{}}};this.camTarget={set:()=>{}}}
 build(){return new FakeCircuit}
 updateWeather(){}
 createCar(){return {group:{position:{x:0,y:0,z:0}}}}
 placeCar(){}
}
test('weekend sesji jest grywalny i przechodzi trening → kwalifikacje → wyścig',()=>{
 const events=[];const game=new Game(new FakeWorld(),(type,arg)=>events.push(type));
 const career=createCareer();game.setCareer(career);game.startSession('practice');
 assert.equal(game.cars.length,12);assert.ok(game.player);
 game.countdown=0;for(let i=0;i<96*60;i++)game.step(1/60);
 assert.equal(game.mode,'result');assert.equal(career.stage,'qualifying');
 game.startSession('qualifying');game.countdown=0;
 for(let i=0;i<111*60;i++)game.step(1/60);
 assert.equal(game.mode,'result');assert.equal(career.stage,'race');assert.equal(career.qualifyingGrid.length,12);
 game.startSession('race');assert.equal(game.cars.length,12);
 assert.equal(game.session,'race');assert.equal(game.mode,'session');
});
test('ukończenie wyścigu dopisuje wynik do kariery',()=>{
 const game=new Game(new FakeWorld(),()=>{});const career=createCareer();career.stage='race';game.setCareer(career);game.startSession('race');game.countdown=0;
 game.player.s=game.player.startS+game.circuit.length*game.raceLaps+5;
 game.updateLap(game.player);game.finishSession('race');
 assert.equal(game.mode,'result');assert.equal(career.history.length,1);assert.equal(career.stage,'race-result');
});
