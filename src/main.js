import {World} from './world.js';
import {Game} from './game.js';
import {EngineAudio} from './audio.js';
import {TEAMS,ROUNDS,COMPOUNDS,fmtTime} from './data.js';
import {createCareer,loadCareer,saveCareer,deleteCareer,buyUpgrade,upgradeCost,standings,constructorStandings,advanceCareer,startNextSeason} from './career.js';
import './style.css';
const app=document.querySelector('#app');
app.innerHTML=`
<canvas id="scene" aria-label="Tor wyścigowy 3D"></canvas>
<div class="vignette"></div>
<div id="hud" class="hidden">
  <header class="hud-header"><div class="brand-small"><span class="brand-mark">A<span class="accent">/</span>F</span> APEX FORMULA <span class="tag">CAREER</span></div><div id="session-label"></div><div class="hud-actions"><button data-action="mute" title="Włącz / wyłącz dźwięk silnika">♫</button><button data-action="drs" title="Przełącz DRS (X)">DRS</button><button data-action="camera" title="Zmień kamerę (C)">◉ <span>Kamera</span></button><button data-action="pause" title="Pauza (Esc)">Ⅱ <span>Pauza</span></button></div></header>
  <div class="hud-left"><div class="position"><span id="position">P01</span><span id="car-count">/12</span></div><div class="hud-pill" id="lap">OKRĄŻENIE 1 / 3</div><div class="hud-pill" id="time">0:00.000</div><div class="timing">OSTATNIE <strong id="lastlap">—</strong> <span>NAJLEPSZE <strong id="bestlap">—</strong></span></div><div id="leaderboard"></div></div>
  <div class="hud-right"><canvas id="minimap" width="210" height="190" aria-label="Minimapa toru"></canvas><div id="weather"></div><div class="telemetry"><div class="tele-label"><span>OPONY <b id="tire-name">M</b></span><span id="tire-percent">100%</span></div><div class="progress"><i id="tire-bar" style="width:100%;background:#ffe07d"></i></div><div class="tele-label"><span>TEMP. OPON</span><span id="tire-temp">86°C</span></div><div class="tele-label"><span>TEMP. HAMULCÓW</span><span id="brake-temp">320°C</span></div><div class="tele-label"><span>KARY / LIMITY</span><span id="penalties">0 s · 0/3</span></div><div class="tele-label"><span>ERS</span><span id="ers-percent">100%</span></div><div class="progress"><i id="ers-bar" style="width:100%;background:#24ebdc"></i></div><div class="tele-label"><span>USZKODZENIA</span><span id="damage-percent">0%</span></div><div class="progress"><i id="damage-bar" style="width:0%;background:#ff525b"></i></div><div class="tele-label"><span>PALIWO</span><span id="fuel-percent">100%</span></div><div class="progress"><i id="fuel-bar" style="width:100%;background:#629bff"></i></div></div><div id="pit-setup"><div class="small-caption">STRATEGIA / OPONY NA PIT STOP</div><div class="compound-row" id="compounds"></div><button data-action="pit" class="pit-button">P · WEZWIJ DO BOKSU</button><small id="pit-status"></small></div></div>
  <div class="speedometer"><div id="gear">N</div><div><span id="speed">0</span><span class="unit">KM/H</span></div><div class="speed-track"><span id="speed-fill"></span></div><div class="status-lights"><span id="drs">DRS</span><span id="boost">ERS BOOST</span><span id="grip">GRIP</span></div></div>
  <div id="notification"></div><div id="countdown"></div>
  <div id="mobile-controls"><div class="steering-mobile"><div class="pad steer-pad"><button data-hold="left" aria-label="Skręć w lewo">◀</button><button data-hold="right" aria-label="Skręć w prawo">▶</button></div><label class="analog-label" for="touch-steer">ANALOGOWY SKRĘT</label><input id="touch-steer" type="range" min="-100" max="100" step="1" value="0" aria-label="Precyzyjny skręt kierownicą" /></div><div class="pad pedal-pad"><button data-hold="boost" class="boost-pedal">ERS</button><button data-hold="brake" class="brake-pedal">HAMULEC</button><button data-hold="throttle" class="gas-pedal">GAZ</button></div></div>
</div>
<div id="overlay" class="overlay"></div>
<footer id="help-line" class="hidden">WASD / STRZAŁKI — JAZDA &nbsp; • &nbsp; E — ERS &nbsp; • &nbsp; X — DRS &nbsp; • &nbsp; P — PIT &nbsp; • &nbsp; C — KAMERA &nbsp; • &nbsp; ESC — PAUZA &nbsp; • &nbsp; R — RESET</footer>
`;
const $=s=>document.querySelector(s);
const overlay=$('#overlay'),hud=$('#hud'),help=$('#help-line');
const world=new World($('#scene'));
const audio=new EngineAudio();
window.addEventListener('pointerdown',()=>audio.unlock(),{passive:true});
const game=new Game(world,(kind,payload)=>{
  if(kind==='start'){overlay.classList.add('hidden');hud.classList.remove('hidden');help.classList.remove('hidden');$('#session-label').textContent={practice:'TRENING',qualifying:'KWALIFIKACJE',race:'WYŚCIG'}[payload];$('#pit-setup').classList.toggle('hidden',payload!=='race');drawCompounds();}
  if(kind==='message'){$('#notification').textContent=payload;$('#notification').classList.add('show')}
  if(kind==='finish'){renderResults(payload)}
  if(kind==='pause'){renderPause(payload)}
});
let career=loadCareer();
const names={engine:'SILNIK',aero:'AERODYNAMIKA',handling:'ZAWIESZENIE'},upgradeInfo={engine:'Większa moc i lepsza prędkość na prostych.',aero:'Więcej docisku i stabilności przy dużej prędkości.',handling:'Większa przyczepność podczas skręcania i hamowania.'};
const formatCredits=n=>new Intl.NumberFormat('pl-PL').format(n);
const safe=s=>String(s).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
function color(team){return '#'+team.color.toString(16).padStart(6,'0')}
function launch(){if(!career)renderWelcome();else renderGarage();}
function resetScreen(){hud.classList.add('hidden');help.classList.add('hidden');overlay.classList.remove('hidden');}
function menuShell(eyebrow,title,content,footer=''){
  resetScreen();overlay.innerHTML=`<section class="menu-card"><div class="menu-top"><span class="eyebrow">${eyebrow}</span><span class="top-brand">APEX<span> / </span>FORMULA</span></div><h1>${title}</h1>${content}${footer}</section>`;
}
function renderWelcome(){
  menuShell('NOWA KARIERA — SEZON 01','TWOJA DROGA <em>NA SZCZYT.</em>',`
    <p class="lead">Stwórz kierowcę, wybierz zespół i walcz w sześciu Grand Prix. Rozwijaj bolid, zdobywaj punkty i mistrzostwo.</p>
    <div class="form-line"><label for="driver-name">NAZWA KIEROWCY</label><input id="driver-name" maxlength="24" value="Kierowca" autocomplete="nickname" /></div>
    <div class="section-title">WYBIERZ ZESPÓŁ</div><div id="team-choices" class="team-grid">${TEAMS.map((t,i)=>`<button class="team-choice ${i===0?'selected':''}" data-team="${t.id}" style="--team:${color(t)}"><span class="team-swatch"></span><span><b>${t.name}</b><small>OSIĄGI ${Math.round(t.rating*100)}</small></span></button>`).join('')}</div>
    <div class="menu-actions"><button class="primary" data-action="create">ROZPOCZNIJ KARIERĘ <span>→</span></button></div>
    <p class="fineprint">Gra zapisuje postępy lokalnie w tej przeglądarce. Własne zespoły i nazwiska — bez oficjalnej licencji F1.</p>`);
}
function renderGarage(){
  game.setCareer(career);
  const round=ROUNDS[career.round];if(!round){renderChampion();return;}
  const last=career.history.at(-1),rank=standings(career).findIndex(d=>d.isPlayer)+1;
  menuShell(`KARIERA · SEZON ${String(career.season||1).padStart(2,'0')} · RUNDA ${String(career.round+1).padStart(2,'0')}/${ROUNDS.length}`,
    `GARAŻ <em>${safe(TEAMS.find(t=>t.id===career.teamId).name.toUpperCase())}</em>`,
    `<div class="garage-layout"><div class="garage-left"><div class="track-card"><div class="track-index">NASTĘPNE GRAND PRIX <span>0${career.round+1} / 0${ROUNDS.length}</span></div><h2>${round.name}</h2><div class="country">${round.country} <b>•</b> ${round.laps} OKRĄŻENIA <b>•</b> ${round.weather==='rain'?'DESZCZ':round.weather==='variable'?'ZMIENNA POGODA':'SUCHO'}</div><p>${round.desc}</p><div class="track-decoration">◉</div></div>
    <div class="garage-kpis"><div><small>POZYCJA W MŚ</small><b>#${rank}</b></div><div><small>PUNKTY</small><b>${career.points[TEAMS.find(t=>t.id===career.teamId).id+'-0']||0}</b></div><div><small>PORTFEL</small><b>${formatCredits(career.credits)} <span>CR</span></b></div></div>
    <div class="setup-row"><span>USTAWIENIA WYŚCIGU</span><button data-action="start-tires" title="Mieszanka opon startowych na wyścig">OPONY: ${career.settings?.startCompound==='auto'||!career.settings?.startCompound?'AUTO':COMPOUNDS[career.settings.startCompound]?.label.toUpperCase()||'AUTO'}</button><button data-action="difficulty">RYWALE: ${{easy:'ŁATWI',normal:'NORMALNI',pro:'PRO'}[career.settings?.difficulty||'normal']}</button><button data-action="assist">STABILIZACJA: ${career.settings?.stability!==false?'WŁ':'WYŁ'}</button></div>
    <div class="section-title">ROZWÓJ BOLIDU <span class="sponsor-note">CEL SPONSORA: TOP ${TEAMS.find(t=>t.id===career.teamId).rating>.84?6:8} → +350 CR</span></div><div class="upgrade-list">${Object.entries(names).map(([id,name])=>{const lvl=career.upgrades[id],cost=upgradeCost(lvl);return `<div class="upgrade"><div><b>${name}</b><small>${upgradeInfo[id]}</small><div class="pips">${Array.from({length:5},(_,i)=>`<i class="${i<lvl?'on':''}"></i>`).join('')}</div></div><button ${lvl>=5||career.credits<cost?'disabled':''} data-action="upgrade" data-upgrade="${id}">${lvl>=5?'MAX':`+ ${formatCredits(cost)} CR`}</button></div>`}).join('')}</div></div>
    <div class="garage-right"><div class="section-title">STAWKA KIEROWCÓW</div><div class="standings-list">${standings(career).slice(0,8).map((d,i)=>`<div class="standings-row ${d.isPlayer?'mine':''}"><span>${String(i+1).padStart(2,'0')}</span><i style="background:${color(TEAMS.find(t=>t.id===d.team))}"></i><b>${safe(d.name)}</b><strong>${d.pts}</strong></div>`).join('')}</div><div class="section-title">KLASYFIKACJA KONSTRUKTORÓW</div><div class="standings-list">${constructorStandings(career).map((t,i)=>`<div class="standings-row ${t.id===career.teamId?'mine':''}"><span>${String(i+1).padStart(2,'0')}</span><i style="background:${color(TEAMS.find(x=>x.id===t.id))}"></i><b>${safe(t.name)}</b><strong>${t.pts}</strong></div>`).join('')}</div><div class="garage-side-note"><b>${safe(career.driverName)}</b><br/>WYGRANE: ${career.wins} &nbsp; · &nbsp; PODIA: ${career.podiums} ${last?`<br/>POPRZEDNIE GP: P${last.position}`:''}</div></div></div>
    <div class="menu-actions"><button class="primary" data-action="start-stage">${{practice:'TRENING WOLNY',qualifying:'KWALIFIKACJE',race:'START WYŚCIGU','race-result':'ODBIERZ NAGRODY'}[career.stage]||'ROZPOCZNIJ SESJĘ'} <span>→</span></button>${career.stage==='practice'?'<button class="secondary" data-action="skip-practice">POMIŃ TRENING</button>':''}${career.stage==='qualifying'?'<button class="secondary" data-action="skip-qual">POMIŃ KWALIFIKACJE</button>':''}<button class="secondary" data-action="help">STEROWANIE</button><button class="subtle" data-action="new-career">NOWA KARIERA</button></div>`,
    `<p class="fineprint">Postęp zapisywany automatycznie. Mistrzostwa: 6 rund · 12 kierowców · punkty 25–18–15–12–10–8–6–4–2–1.</p>`);
}
function renderResults(result){
  resetScreen();const practice=result.stage==='practice',qual=result.stage==='qualifying',race=result.stage==='race';
  const playerId=game.player.id;
  const rows=qual?result.grid.map((g,i)=>{const d=game.cars.find(c=>c.id===g.id);return {id:g.id,name:d.name,team:d.team,position:i+1,time:g.time};}):result.standings.map((d,i)=>({...d,position:i+1,time:practice?d.bestLap:d.finishTime}));
  const playerPos=rows.findIndex(r=>r.id===playerId)+1;
  let heading=race?`WYŚCIG <em>UKOŃCZONY</em>`:practice?`TRENING <em>ZAKOŃCZONY</em>`:`WYNIKI <em>KWALIFIKACJI</em>`;
  menuShell(`${ROUNDS[career.round].name.toUpperCase()} · ${race?'GRAND PRIX':practice?'TRENING':'KWALIFIKACJE'}`,heading,
  `<div class="results-grid"><div class="big-result"><span>TWOJA POZYCJA</span><b>${practice?'—':'P'+String(playerPos).padStart(2,'0')}</b><div>${race?`+${result.award?.points||0} PUNKTÓW MŚ`:practice?'SESJA TRENINGOWA':'POLE POSITION: P01'}</div><p>NAJLEPSZE OKRĄŻENIE<br/><strong>${fmtTime(game.player.bestLap)}</strong></p>${race?`<p>NAGRODA<br/><strong>+${formatCredits(result.award?.reward||0)} CR</strong></p><p>KARY CZASOWE<br/><strong>+${game.player.penaltySeconds||0} s</strong></p>`:''}</div><div class="results-rows"><div class="section-title">${race?'KLASYFIKACJA WYŚCIGU':qual?'SIATKA STARTOWA':'WYNIKI TRENINGU'}</div>${rows.slice(0,12).map(r=>`<div class="standings-row ${r.id===playerId?'mine':''}"><span>${String(r.position).padStart(2,'0')}</span><i style="background:${color(r.team)}"></i><b>${safe(r.name)}</b><strong>${race?(r.time===null?'DNF':(r.estimated?'~ ':'')+fmtTime(r.time)):fmtTime(r.time)}</strong></div>`).join('')}</div></div>
  <div class="menu-actions"><button class="primary" data-action="continue">${race?'ODBIERZ NAGRODY I DALEJ':practice?'PRZEJDŹ DO KWALIFIKACJI':'PRZEJDŹ DO WYŚCIGU'} <span>→</span></button><button class="secondary" data-action="return-garage">GARAŻ</button></div>`);
}
function renderChampion(){
  const table=standings(career),place=table.findIndex(d=>d.isPlayer)+1;
  menuShell(`KONIEC SEZONU ${career.season||1}`,'SEZON <em>UKOŃCZONY!</em>',`<div class="champion"><span>${place===1?'🏆':'🏁'}</span><h2>${place===1?'JESTEŚ MISTRZEM!':`MIEJSCE ${place} W MISTRZOSTWACH`}</h2><p>${safe(career.driverName)} · ${safe(TEAMS.find(t=>t.id===career.teamId).name)}</p><div class="garage-kpis"><div><small>PUNKTY</small><b>${table.find(d=>d.isPlayer).pts}</b></div><div><small>WYGRANE</small><b>${career.wins}</b></div><div><small>PODIA</small><b>${career.podiums}</b></div></div></div><div class="menu-actions"><button class="primary" data-action="transfer">KOLEJNY SEZON / KONTRAKT</button><button class="secondary" data-action="final-table">ZOBACZ KLASYFIKACJĘ</button></div>`);
}
function renderPause(yes){if(!yes){overlay.classList.add('hidden');return}overlay.classList.remove('hidden');overlay.innerHTML=`<section class="pause-card"><span class="eyebrow">APEX FORMULA</span><h1>PAUZA</h1><p>Postęp bieżącej sesji nie jest zapisany. Kariera zapisuje się po jej ukończeniu.</p><div class="menu-actions vertical"><button class="primary" data-action="resume">WRÓĆ NA TOR</button>${game.session==='race'?'':'<button class="secondary" data-action="end-early">ZAKOŃCZ SESJĘ</button>'}<button class="secondary" data-action="exit-session">WYJDŹ DO GARAŻU</button></div></section>`}

function renderTransfer(){
  selectedTeam=career.teamId;
  menuShell(`SEZON ${career.season||1} ZAKOŃCZONY · NEGOCJACJE KONTRAKTOWE`, 'NOWY <em>KONTRAKT</em>',
   `<p class="lead">Możesz zostać w obecnym zespole albo podpisać kontrakt z innym. Zmiana zespołu zeruje ulepszenia konstrukcji bolidu; kredyty i statystyki kariery zachowasz.</p><div class="section-title">WYBIERZ ZESPÓŁ NA SEZON ${(career.season||1)+1}</div><div class="team-grid">${TEAMS.map(t=>`<button class="team-choice ${t.id===career.teamId?'selected':''}" data-team="${t.id}" style="--team:${color(t)}"><span class="team-swatch"></span><span><b>${t.name}</b><small>OSIĄGI ${Math.round(t.rating*100)}</small></span></button>`).join('')}</div><div class="menu-actions"><button class="primary" data-action="new-season">PODPISZ KONTRAKT <span>→</span></button><button class="secondary" data-action="champion">POWRÓT</button></div>`);
}

function renderHelp(){menuShell('POMOC','STEROWANIE <em>I ZASADY</em>',`<div class="help-grid"><div><h3>⌨️ KLAWIATURA</h3><p><b>W / ↑</b> — gaz<br/><b>S / ↓ / SPACJA</b> — hamulec<br/><b>A D / ← →</b> — skręcanie<br/><b>E</b> — odzyskana energia ERS<br/><b>X</b> — DRS w wyścigu po 1. okrążeniu, gdy jesteś blisko auta przed Tobą<br/><b>P</b> — pit stop<br/><b>C</b> — zmiana kamery<br/><b>Esc</b> — pauza<br/><b>R</b> — powrót na tor (+3 s)</p></div><div><h3>📱 DOTYK / PAD</h3><p>Przyciski ekranowe do kierowania, hamowania, przyspieszania i ERS. DRS, pit stop i kamerę obsłużysz przyciskami w HUD. Obsługa analogów i spustów typowego kontrolera.</p><h3>🏎️ KARIERA</h3><p>Trening → kwalifikacje → wyścig. Zdobywaj punkty, kredyty i ulepszenia. W garażu wybierz opony startowe. Opony i hamulce mają temperaturę; przegrzanie obniża osiągi. Trzy wyjazdy poza limity toru oznaczają +5 sekund kary. DRS wymaga suchego toru i niewielkiej odległości do rywala.</p></div></div><div class="menu-actions"><button class="primary" data-action="return-garage">WRÓĆ DO GARAŻU</button></div>`)}
function drawCompounds(){const el=$('#compounds');el.innerHTML=Object.entries(COMPOUNDS).map(([id,t])=>`<button data-compound="${id}" title="${t.label}" class="compound ${id===game.pitCompound?'active':''}" style="--compound:${t.color}">${t.abbr}</button>`).join('')}
const pressed=new Set();
const keybind={arrowup:'throttle',w:'throttle',arrowdown:'brake',s:'brake',' ':'brake',arrowleft:'left',a:'left',arrowright:'right',d:'right',e:'boost'};
window.addEventListener('keydown',e=>{
  const k=e.key.toLowerCase();if(keybind[k]||['escape','x','p','r','c'].includes(k))e.preventDefault();
  if(keybind[k])pressed.add(keybind[k]);
  if(e.repeat)return;
  if(game.mode==='session')audio.unlock();
  if(k==='escape'&&game.mode==='session')game.togglePause();
  if(k==='c'&&game.mode==='session')game.cameraCycle();
  if(k==='p'&&game.mode==='session')game.requestPit();
  if(k==='r'&&game.mode==='session')game.resetPosition();
  if(k==='x'&&game.mode==='session')drsToggle=!drsToggle;
});
window.addEventListener('keyup',e=>{const k=keybind[e.key.toLowerCase()];if(k)pressed.delete(k)});
window.addEventListener('blur',()=>{pressed.clear();if(game.mode==='session'&&!game.paused)game.togglePause()});
for(const el of document.querySelectorAll('[data-hold]')){
  const key=el.dataset.hold;
  el.addEventListener('pointerdown',e=>{e.preventDefault();el.setPointerCapture(e.pointerId);pressed.add(key);el.classList.add('held')});
  for(const type of ['pointerup','pointercancel','lostpointercapture'])el.addEventListener(type,()=>{pressed.delete(key);el.classList.remove('held')});
}
const steeringSlider=$('#touch-steer');let steeringActive=false;
steeringSlider.addEventListener('pointerdown',()=>{steeringActive=true});
const resetSteering=()=>{steeringActive=false;steeringSlider.value='0'};
for(const eventName of ['pointerup','pointercancel','lostpointercapture'])steeringSlider.addEventListener(eventName,resetSteering);
let drsToggle=false,selectedTeam='nova',rafPrev=performance.now(),accumulator=0,hudTick=0,miniTick=0;
function readControls(){
  const keys={throttle:pressed.has('throttle')?1:0,brake:pressed.has('brake')?1:0,steer:(pressed.has('right')?1:0)-(pressed.has('left')?1:0),boost:pressed.has('boost'),drs:drsToggle};
  if(steeringActive)keys.steer=Number(steeringSlider.value)/100;
  const pad=navigator.getGamepads?.()[0];if(pad){
    const ax=pad.axes?.[0]||0;if(Math.abs(ax)>.12)keys.steer=ax;
    const lt=pad.buttons?.[6]?.value||0,rt=pad.buttons?.[7]?.value||0;
    keys.throttle=Math.max(keys.throttle,rt,pad.buttons?.[0]?.pressed?1:0);
    keys.brake=Math.max(keys.brake,lt,pad.buttons?.[1]?.pressed?1:0);
    keys.boost=keys.boost||!!pad.buttons?.[2]?.pressed;
    if(pad.buttons?.[4]?.pressed)keys.steer=-1;if(pad.buttons?.[5]?.pressed)keys.steer=1;
  }
  return keys;
}
function drawMinimap(){
  const canvas=$('#minimap'),ctx=canvas.getContext('2d');if(!game.circuit)return;
  const w=canvas.width,h=canvas.height;ctx.clearRect(0,0,w,h);const coords=game.circuit.frames;
  const xs=coords.map(p=>p.x),zs=coords.map(p=>p.z);const xmin=Math.min(...xs),xmax=Math.max(...xs),zmin=Math.min(...zs),zmax=Math.max(...zs);
  const scale=Math.min((w-30)/(xmax-xmin),(h-30)/(zmax-zmin));const xy=p=>[15+(p.x-xmin)*scale,15+(p.z-zmin)*scale];
  ctx.beginPath();for(let i=0;i<coords.length;i+=6){const [x,y]=xy(coords[i]);if(!i)ctx.moveTo(x,y);else ctx.lineTo(x,y)}ctx.closePath();ctx.strokeStyle='rgba(255,255,255,.28)';ctx.lineWidth=7;ctx.lineJoin='round';ctx.stroke();ctx.strokeStyle='#ecf2fa';ctx.lineWidth=1.6;ctx.stroke();
  for(const c of game.cars){const [x,y]=xy(c.dyn);ctx.fillStyle=c.isPlayer?'#29f4db':'#ff8c6c';ctx.beginPath();ctx.arc(x,y,c.isPlayer?4.7:2.4,0,Math.PI*2);ctx.fill()}
}
function updateHud(dt){if(game.mode!=='session')return;
  hudTick+=dt;miniTick+=dt;if(hudTick<.09)return;hudTick=0;
  const p=game.player,d=p.dyn;
  const put=(s,t)=>{$(s).textContent=t};
  put('#speed',Math.round(d.vx*3.6));put('#gear',d.vx<1?'N':d.gear);
  $('#speed-fill').style.width=Math.min(100,d.vx/94*100)+'%';
  put('#position','P'+String(game.rank()).padStart(2,'0'));put('#lap',game.session==='race'?`OKRĄŻENIE ${Math.min(game.raceLaps,p.completed+1)} / ${game.raceLaps}`:`OKRĄŻENIA ${p.completed} · SESJA`);
  put('#time',fmtTime(game.elapsed));put('#lastlap',fmtTime(p.lastLap));put('#bestlap',fmtTime(p.bestLap));
  put('#tire-name',COMPOUNDS[d.compound].abbr);put('#tire-percent',Math.round((1-d.tireWear)*100)+'%');$('#tire-bar').style.width=(1-d.tireWear)*100+'%';$('#tire-bar').style.background=COMPOUNDS[d.compound].color;
  put('#tire-temp',Math.round(d.tireTemp)+'°C');
  put('#brake-temp',Math.round(d.brakeTemp)+'°C');
  $('#tire-temp').classList.toggle('tele-warning',d.tireTemp>120||d.tireTemp<65);
  $('#brake-temp').classList.toggle('tele-warning',d.brakeTemp>780);
  put('#penalties',`${p.penaltySeconds||0} s · ${p.trackWarnings%3}/3`);
  put('#ers-percent',Math.round(d.ers)+'%');$('#ers-bar').style.width=d.ers+'%';
  put('#damage-percent',Math.round(d.damage*100)+'%');$('#damage-bar').style.width=d.damage*100+'%';
  put('#fuel-percent',Math.round(d.fuel)+'%');$('#fuel-bar').style.width=d.fuel+'%';
  put('#weather',`${game.wetness>.49?'🌧️ MOKRO':game.wetness>.2?'🌦️ ZMIENNA':'☀️ SUCHO'} · ${Math.round(game.wetness*100)}% WODY`);
  $('#drs').classList.toggle('active',d.drs);$('#boost').classList.toggle('active',d.boost);$('#grip').textContent=d.offroad?'POZA TOREM':'GRIP';$('#grip').classList.toggle('warn',d.offroad);
  put('#pit-status',p.pitTimer>0?`POSTÓJ ${p.pitTimer.toFixed(1)} S`:p.requestedPit?'PIT ZAMÓWIONY':'P — WEZWIJ DO BOKSU');
  $('#leaderboard').innerHTML=game.order().slice(0,6).map((c,i)=>`<div class="leader-row ${c.isPlayer?'leader-me':''}"><span>${String(i+1).padStart(2,'0')}</span><i style="background:${color(c.team)}"></i><b>${safe(c.name).slice(0,18)}</b><small>${c.isPlayer?'TY':`${Math.round(Math.abs(c.s-p.s))} m`}</small></div>`).join('');
  if(game.elapsed>game.notifyUntil)$('#notification').classList.remove('show');
  $('#countdown').textContent=game.countdown>0?Math.ceil(game.countdown):'';
  if(miniTick>.35){drawMinimap();miniTick=0;}
}
function updateMenuCamera(dt){const c=world.circuit;if(!c)return;const p=c.position(c.length*.07,0);world.camera.position.lerp({x:p.x-115,y:145,z:p.z-160},Math.min(1,dt*2));world.camera.lookAt(p.x,0,p.z)}
function animate(now){requestAnimationFrame(animate);const dt=Math.min(.07,Math.max(0,(now-rafPrev)/1000));rafPrev=now;accumulator=Math.min(accumulator+dt,.15);
  game.setControls(readControls());
  if(game.mode==='session'&&!game.paused){while(accumulator>=1/60){game.step(1/60);accumulator-=1/60;if(game.mode!=='session')break;}}else accumulator=0;
  if(game.player&&game.mode!=='garage')world.cameraFollow({...game.player.model,speed:game.player.dyn.vx},dt);
  else updateMenuCamera(dt);
  if(game.mode==='session')updateHud(dt);
  world.updateRain(game.player?.dyn,game.mode==='session'?game.wetness:0,dt);
  audio.update(game.player,game.mode==='session'&&!game.paused);
  world.render();
}
app.addEventListener('click',e=>{
  const team=e.target.closest('[data-team]');if(team){selectedTeam=team.dataset.team;document.querySelectorAll('[data-team]').forEach(x=>x.classList.toggle('selected',x===team));return;}
  const compound=e.target.closest('[data-compound]');if(compound){game.setCompound(compound.dataset.compound);drawCompounds();return;}
  const button=e.target.closest('[data-action]');if(!button)return;const action=button.dataset.action;
  switch(action){
    case 'create':career=createCareer($('#driver-name')?.value||'Kierowca',selectedTeam);saveCareer(career);renderGarage();break;
    case 'upgrade':if(buyUpgrade(career,button.dataset.upgrade))renderGarage();break;
    case 'difficulty':{const order=['easy','normal','pro'];const current=career.settings?.difficulty||'normal';career.settings.difficulty=order[(order.indexOf(current)+1)%3];saveCareer(career);renderGarage();break;}
    case 'assist':career.settings.stability=!career.settings.stability;saveCareer(career);renderGarage();break;
    case 'start-tires':{const options=['auto','soft','medium','hard','intermediate','wet'];const idx=options.indexOf(career.settings?.startCompound||'auto');career.settings.startCompound=options[(idx+1)%options.length];saveCareer(career);renderGarage();break;}
    case 'start-stage':if(career.stage==='race-result'){advanceCareer(career);renderGarage()}else game.startSession(career.stage);break;
    case 'skip-practice':career.stage='qualifying';saveCareer(career);renderGarage();break;
    case 'skip-qual':career.qualifyingGrid=null;career.stage='race';saveCareer(career);renderGarage();break;
    case 'continue':if(career.stage==='race-result')advanceCareer(career);renderGarage();break;
    case 'return-garage':game.mode='garage';game.paused=false;renderGarage();break;
    case 'pause':game.togglePause();break;
    case 'resume':game.togglePause();break;
    case 'end-early':game.paused=false;game.endEarly();break;
    case 'exit-session':game.mode='garage';game.paused=false;renderGarage();break;
    case 'pit':game.requestPit();break;
    case 'mute':audio.toggle();break;
    case 'drs':drsToggle=!drsToggle;game.message(drsToggle?'DRS: uzbrajanie na prostych':'DRS wyłączony',1.5);break;
    case 'camera':game.cameraCycle();break;
    case 'help':renderHelp();break;
    case 'new-career':if(window.confirm('Usunąć obecną karierę i rozpocząć od nowa?')){deleteCareer();career=null;game.mode='garage';renderWelcome()}break;
    case 'transfer':renderTransfer();break;
    case 'champion':renderChampion();break;
    case 'new-season':if(startNextSeason(career,selectedTeam))renderGarage();break;
    case 'final-table':overlay.innerHTML=`<section class="menu-card"><span class="eyebrow">KLASYFIKACJA KOŃCOWA</span><h1>MISTRZOSTWA <em>ŚWIATA</em></h1><div class="standings-list">${standings(career).map((d,i)=>`<div class="standings-row ${d.isPlayer?'mine':''}"><span>${i+1}</span><i style="background:${color(TEAMS.find(t=>t.id===d.team))}"></i><b>${safe(d.name)}</b><strong>${d.pts}</strong></div>`).join('')}</div><div class="menu-actions"><button class="primary" data-action="return-garage">POWRÓT</button></div></section>`;break;
  }
});
world.build(ROUNDS[Math.min(career?.round||0,ROUNDS.length-1)]);
if(career?.seasonComplete)renderChampion();else launch();
requestAnimationFrame(animate);

if ('serviceWorker' in navigator) window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}));
