export const TEAMS = [
  {id:'nova', name:'Nova Velocity', color:0x19e9d2, short:'NVA', rating:0.76, drivers:[['Mira Voss',0.81],['Theo Falk',0.77]]},
  {id:'zenith', name:'Zenith Motorsport', color:0xfc525e, short:'ZEN', rating:0.91, drivers:[['Luca Moretti',0.95],['Elena Costa',0.88]]},
  {id:'orbital', name:'Orbital Racing', color:0x6397ff, short:'ORB', rating:0.86, drivers:[['Kai Nakamura',0.91],['Oliver Reed',0.85]]},
  {id:'aurora', name:'Aurora GP', color:0xd68bff, short:'AUR', rating:0.8, drivers:[['Sofia Marin',0.85],['Noah Hart',0.8]]},
  {id:'titan', name:'Titan Forge', color:0xffbc4b, short:'TTN', rating:0.74, drivers:[['Amir Haddad',0.8],['Alex Kim',0.76]]},
  {id:'pulse', name:'Pulse Dynamics', color:0x68d975, short:'PLS', rating:0.7, drivers:[['Rosa Diaz',0.76],['Oskar Berg',0.72]]}
];
export const ROUNDS = [
  {id:'coast',name:'Costa Azul',country:'PORTUGALIA',weather:'sun',laps:3,shape:'coast',base:54,desc:'Szybkie zakręty i nadmorski wiatr.'},
  {id:'alpine',name:'Alpine Ring',country:'AUSTRIA',weather:'variable',laps:3,shape:'alpine',base:62,desc:'Techniczne łuki i zmienna przyczepność.'},
  {id:'metro',name:'Metro Circuit',country:'JAPONIA',weather:'sun',laps:3,shape:'metro',base:57,desc:'Wąskie szykany i strefy DRS.'},
  {id:'storm',name:'Storm Valley',country:'WIELKA BRYTANIA',weather:'rain',laps:3,shape:'storm',base:65,desc:'Mokry asfalt i ryzykowna strategia.'},
  {id:'desert',name:'Dune International',country:'BAHRAJN',weather:'sun',laps:4,shape:'desert',base:58,desc:'Mocne hamowania i duże obciążenie opon.'},
  {id:'grand',name:'Grand Prix Finale',country:'WŁOCHY',weather:'variable',laps:4,shape:'grand',base:61,desc:'Finał sezonu na szybkim torze.'}
];
export const POINTS=[25,18,15,12,10,8,6,4,2,1];
export const COMPOUNDS={
  soft:{label:'Miękkie',abbr:'S',color:'#f85a61',grip:1.11,wear:1.68},
  medium:{label:'Średnie',abbr:'M',color:'#ffe07d',grip:1,wear:1},
  hard:{label:'Twarde',abbr:'H',color:'#f1f3f7',grip:.92,wear:.7},
  intermediate:{label:'Przejściowe',abbr:'I',color:'#78e7a2',grip:.91,wear:1.15},
  wet:{label:'Deszczowe',abbr:'W',color:'#87b7ff',grip:.83,wear:1.22}
};
export function roster(teamId='nova',name='Kierowca'){
  return TEAMS.flatMap(team=>team.drivers.map(([driver,skill],index)=>({
    id:team.id+'-'+index,
    name:(team.id===teamId&&index===0)?name:driver,
    skill, team:team.id, color:team.color,
    isPlayer:team.id===teamId&&index===0
  })));
}
export const fmtTime=(n)=>{
  if(!Number.isFinite(n)||n<=0)return '—:——.———';
  const m=Math.floor(n/60),s=Math.floor(n%60),ms=Math.floor((n-Math.floor(n))*1000);
  return `${m}:${String(s).padStart(2,'0')}.${String(ms).padStart(3,'0')}`;
};
export function clamp(v,min,max){return Math.min(max,Math.max(min,v))}
