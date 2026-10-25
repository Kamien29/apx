import test from 'node:test';import assert from 'node:assert/strict';
import {createDynamics,stepDynamics,tireGrip} from '../src/physics.js';
test('bolid przyspiesza, ma poprawne biegi i hamuje',()=>{
 const car=createDynamics(0,0,0);
 for(let i=0;i<180;i++)stepDynamics(car,{throttle:1},{width:16,offset:0,wetness:0},1/60);
 assert.ok(car.vx>28,`prędkość ${car.vx}`);assert.ok(car.gear>=2);
 const v=car.vx;for(let i=0;i<85;i++)stepDynamics(car,{brake:1},{width:16,offset:0,wetness:0},1/60);
 assert.ok(car.vx<v/2,`hamowanie: ${car.vx}`);
});
test('sterowanie powoduje zmianę kierunku jazdy',()=>{
 const car=createDynamics(0,0,0);
 for(let i=0;i<180;i++)stepDynamics(car,{throttle:1,steer:.2},{width:16,offset:0,wetness:0},1/60);
 assert.ok(car.heading>.3);assert.ok(car.x>10);
});
test('miękkie slicki tracą przyczepność podczas deszczu, opony deszczowe nie',()=>{
 assert.ok(tireGrip('soft',0,0)>tireGrip('wet',0,0));
 assert.ok(tireGrip('wet',.8,0)>tireGrip('soft',.8,0));
 assert.ok(tireGrip('medium',0,.85)<tireGrip('medium',0,0));
});
test('ERS jest zużywany podczas boostu i odzyskiwany przy hamowaniu',()=>{
 const car=createDynamics(0,0,0);for(let i=0;i<90;i++)stepDynamics(car,{throttle:1,boost:true},{width:16,offset:0,wetness:0},1/60);
 const after=car.ers;assert.ok(after<100);for(let i=0;i<90;i++)stepDynamics(car,{brake:1},{width:16,offset:0,wetness:0},1/60);
 assert.ok(car.ers>after);
});
