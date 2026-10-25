import test from 'node:test';import assert from 'node:assert/strict';
import {createCareer,buyUpgrade,awardRace,advanceCareer,standings,calculateQualGrid,startNextSeason} from '../src/career.js';
import {roster,ROUNDS} from '../src/data.js';
const memory=new Map();globalThis.localStorage={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};
test('kariera startuje z rundą 1 i kredytami',()=>{
 const c=createCareer('Tester','zenith');assert.equal(c.round,0);assert.equal(c.credits,1600);assert.equal(c.stage,'practice');assert.equal(standings(c).length,12);
});
test('można ulepszyć silnik i zapisuje się koszt',()=>{
 const c=createCareer();assert.equal(buyUpgrade(c,'engine'),true);assert.equal(c.upgrades.engine,1);assert.equal(c.credits,1050);
 assert.equal(buyUpgrade(c,'invalid'),false);
});
test('kwalifikacje układają kierowców po czasach',()=>{
 const c=createCareer();const grid=calculateQualGrid(c,45);assert.equal(grid.length,12);assert.ok(grid[0].time<=grid[1].time);
 assert.equal(grid.findIndex(d=>d.id==='nova-0'),0);
});
test('punkty dodają się raz; finał sezonu po sześciu rundach',()=>{
 const c=createCareer('Tester');let ids=roster(c.teamId,c.driverName).map(x=>x.id);
 const first=awardRace(c,ids);assert.equal(first.points,25);assert.equal(c.points['nova-0'],25);
 assert.equal(awardRace(c,ids),null);assert.equal(c.points['nova-0'],25);
 assert.equal(advanceCareer(c),true);assert.equal(c.round,1);
 for(let i=1;i<ROUNDS.length;i++){awardRace(c,ids);advanceCareer(c)}
 assert.equal(c.seasonComplete,true);assert.equal(c.round,6);
});

test('kolejny sezon pozwala zmienić zespół i zachowuje historię',()=>{
 const c=createCareer('Tester');c.seasonComplete=true;c.round=6;c.credits=1200;c.upgrades.engine=2;c.history.push({season:1,round:0,position:2});
 assert.equal(startNextSeason(c,'titan'),true);assert.equal(c.season,2);assert.equal(c.teamId,'titan');assert.equal(c.round,0);assert.equal(c.upgrades.engine,0);assert.equal(c.credits,1200);assert.equal(c.history.length,1);
});
