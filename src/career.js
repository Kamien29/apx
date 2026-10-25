import {TEAMS,ROUNDS,POINTS,roster,clamp} from './data.js';
const STORAGE='apex-formula-career-v2';
export function createCareer(name='Kierowca',teamId='nova'){
  return {version:2,season:1,driverName:String(name).trim().slice(0,24)||'Kierowca',teamId,round:0,credits:1600,upgrades:{engine:0,aero:0,handling:0},settings:{difficulty:'normal',stability:true,startCompound:'auto'},points:{},history:[],wins:0,podiums:0,stage:'practice',qualifyingGrid:null,seasonComplete:false};
}
export function loadCareer(){try{const data=JSON.parse(localStorage.getItem(STORAGE));if(data?.version===2&&TEAMS.some(t=>t.id===data.teamId)&&Number.isInteger(data.round)&&data.round>=0&&data.round<=ROUNDS.length&&typeof data.points==='object'&&data.upgrades){data.season ||=1;data.settings ||={difficulty:'normal',stability:true,startCompound:'auto'};data.settings.startCompound ||= 'auto';return data;}}catch{}return null;}
export function saveCareer(c){try{localStorage.setItem(STORAGE,JSON.stringify(c));return true}catch{return false}}
export function deleteCareer(){try{localStorage.removeItem(STORAGE)}catch{}}
export function upgradeCost(level){return 550+(level*420)}
export function buyUpgrade(c,kind){if(!['engine','aero','handling'].includes(kind))return false;const level=c.upgrades[kind];const cost=upgradeCost(level);if(level>=5||c.credits<cost)return false;c.credits-=cost;c.upgrades[kind]++;saveCareer(c);return true}
export function standings(c){const drivers=roster(c.teamId,c.driverName);return drivers.map(d=>({...d,pts:c.points[d.id]||0})).sort((a,b)=>b.pts-a.pts||b.skill-a.skill)}
export function constructorStandings(c){
  return TEAMS.map(t=>({id:t.id,name:t.name,pts:(c.points[t.id+'-0']||0)+(c.points[t.id+'-1']||0)}))
    .sort((a,b)=>b.pts-a.pts||a.name.localeCompare(b.name));
}
export function awardRace(c,finishOrder,roundIndex=c.round){
  if(c.history.some(h=>h.round===roundIndex&&(h.season||1)===(c.season||1)))return null;
  const drivers=roster(c.teamId,c.driverName);
  finishOrder.forEach((id,i)=>c.points[id]=(c.points[id]||0)+(POINTS[i]||0));
  const pos=finishOrder.indexOf(drivers.find(d=>d.isPlayer).id)+1;
  const sponsorTarget=TEAMS.find(t=>t.id===c.teamId).rating>.84?6:8;
  const sponsorBonus=pos<=sponsorTarget?350:0;
  const reward=450+Math.max(0,13-pos)*90+sponsorBonus;
  c.credits+=reward;
  if(pos===1)c.wins++;if(pos<=3)c.podiums++;
  c.history.push({season:c.season||1,round:roundIndex,position:pos,reward,sponsorBonus,order:finishOrder});
  c.stage='race-result';c.qualifyingGrid=null;
  saveCareer(c);return {position:pos,reward,points:POINTS[pos-1]||0};
}
export function advanceCareer(c){
  if(c.stage!=='race-result')return false;
  c.round=clamp(c.round+1,0,ROUNDS.length);
  c.stage='practice';c.qualifyingGrid=null;
  if(c.round===ROUNDS.length)c.seasonComplete=true;
  saveCareer(c);return true;
}
export function calculateQualGrid(c,bestLap,roundIndex=c.round){
  const drivers=roster(c.teamId,c.driverName);
  const round=ROUNDS[roundIndex];
  const grid=drivers.map((d,i)=>{
    // Deterministic AI times, with each circuit's technical bias and team strength.
    const team=TEAMS.find(t=>t.id===d.team);
    const variability=Math.sin((roundIndex+2)*19+i*17.1)*.7;
    return {id:d.id,time:d.isPlayer?(bestLap||Infinity):round.base*(1.27-.24*d.skill-.09*team.rating)+variability};
  }).sort((a,b)=>a.time-b.time);
  return grid;
}

export function startNextSeason(c,teamId=c.teamId){
  if(!c.seasonComplete||!TEAMS.some(t=>t.id===teamId))return false;
  const changed=teamId!==c.teamId;
  c.season=(c.season||1)+1;c.teamId=teamId;c.round=0;c.stage='practice';c.points={};c.qualifyingGrid=null;c.seasonComplete=false;
  if(changed)c.upgrades={engine:0,aero:0,handling:0};
  saveCareer(c);return true;
}
