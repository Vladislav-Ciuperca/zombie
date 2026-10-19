
/* =========================================================
   PLANIMETRIA
   ========================================================= */
function mixHex(a,b,t){const A=parseInt(a.slice(1),16),B=parseInt(b.slice(1),16);const r=Math.round(lerp(A>>16,B>>16,t)),g=Math.round(lerp(A>>8&255,B>>8&255,t)),bl=Math.round(lerp(A&255,B&255,t));return `rgb(${r},${g},${bl})`;}
/* con più strati (La Rocca) la planimetria mostra un piano alla volta: in partita quello dove sei, nel menu quello scelto coi pulsanti;
   dove il piano è vuoto si vede, sbiadito, quello di sotto */
let PLAN_L=0;const lay=(x,z,y)=>NL>1?layerAt(clamp(Math.floor(x),0,GW-1),clamp(Math.floor(z),0,GH-1),y):0;
function drawMap(cv,th,dyn){
  const rc=cv.getBoundingClientRect(),dpr=Math.min(2,devicePixelRatio||1);const W=Math.max(10,Math.round(rc.width*dpr)),Hh=Math.max(10,Math.round(rc.height*dpr));if(cv.width!==W||cv.height!==Hh){cv.width=W;cv.height=Hh;}
  const g=cv.getContext('2d');g.clearRect(0,0,W,Hh);const pad=8*dpr,s=Math.min((W-pad*2)/GW,(Hh-pad*2)/GH),ox=(W-s*GW)/2,oy=(Hh-s*GH)/2,X=x=>ox+x*s,Y=z=>oy+z*s;
  if(!(s>0))return;/* tela nascosta (menu chiuso): niente da disegnare */
  const liquid=M.lava?th.lava:th.water,LV=NL>1?(dyn?lay(P.x,P.z,P.h):clamp(PLAN_L,0,NL-1)):0;
  for(let z=0;z<GH;z++)for(let x=0;x<GW;x++){let i=ix(x,z,LV),k=kind[i];let c=null;g.globalAlpha=1;
    if(LV>0&&k===K.VOID){for(let l=LV-1;l>=0;l--){const j=ix(x,z,l);if(kind[j]!==K.VOID||!l){i=j;k=kind[j];break;}}g.globalAlpha=.38;}
    if(k===K.WALL)c=th.wall;else if(k===K.WATER)c=liquid;else if(k===K.VOID)c=th.ground;
    else if(k===K.FLOOR||k===K.PROP||k===K.BARS){const r=region[i];c=(dyn&&r>=0&&!regionOpen[r])?th.locked:mixHex(th.floorLo,th.floorHi,clamp((cellH[i]+2)/12,0,1));}
    else if(k===K.DOOR)c=DOORS[doorOf[i]].open?th.floorLo:th.door;else if(k===K.WIN)c=th.win;
    if(c){g.fillStyle=c;g.fillRect(X(x)-.3,Y(z)-.3,s+.6,s+.6);}
    if(k===K.BARS){g.fillStyle=th.wall;for(let q=0;q<3;q++)g.fillRect(X(x)+q*s/3,Y(z),Math.max(1,s*.12),s);}
    if(k===K.PROP&&propCh[i]!=='*'){g.fillStyle=th.prop;g.fillRect(X(x)+s*.15,Y(z)+s*.15,s*.7,s*.7);}
    if(rampOf[i]>=0){g.strokeStyle=th.stairs;g.lineWidth=Math.max(1,s*.12);const r=RAMPS[rampOf[i]];g.beginPath();if(r.axis==='z'){g.moveTo(X(x),Y(z+.5));g.lineTo(X(x+1),Y(z+.5));}else{g.moveTo(X(x+.5),Y(z));g.lineTo(X(x+.5),Y(z+1));}g.stroke();}}
  g.globalAlpha=1;const fs=Math.max(9,s*1.2);g.textAlign='center';g.textBaseline='middle';
  const label=(txt,x,z,font,col)=>{g.font=font;g.fillStyle=col;const tw=g.measureText(txt).width;g.fillText(txt,clamp(X(x),X(0)+tw/2+2,X(GW)-tw/2-2),Y(z));};
  const onL=l=>NL===1||l===LV;
  REG.forEach((r,ri)=>{const p=M.labels[r.k];if(!p||!onL(REGL[ri]))return;label(r.name.toUpperCase()+` (${r.h>0?'+':''}${r.h} m)`,p[0],p[1],`${Math.round(fs)}px "Special Elite", monospace`,th.label);});
  DOORS.forEach(d=>{if(d.open||!onL(d.l))return;label(String(d.cost),d.cx,d.cz,`bold ${Math.round(fs*.95)}px "Barlow Condensed", sans-serif`,th.doorText);});
  const tag=(x,z,txt,col,dy=1.3)=>{g.fillStyle=col;g.beginPath();g.arc(X(x),Y(z),s*.55,0,7);g.fill();label(txt,x,z+dy,`${Math.round(fs*.85)}px "Barlow Condensed", sans-serif`,th.label);};
  WALLBUYS.forEach(b=>{if(onL(lay(b.x,b.z,b.y)))tag(b.x,b.z,WEAPONS[b.w].name.split(' ').pop()+' '+WEAPONS[b.w].cost,th.buy);});
  PERKS.forEach(p=>{if(onL(p.l))tag(p.cell[0]+.5,p.cell[1]+.5,p.name,p.css,p.face[1]>0?-1.3:1.3);});
  if(Box.spot>=0&&Box.g.visible&&onL(BOX_SPOTS[Box.spot].l||0))tag(Box.cx,Box.cz,'Cassa ?',th.box);
  if(onL(lay(Power.x,Power.z,Power.h)))tag(Power.x,Power.z,Power.on?'Corrente ON':'Corrente',Power.on?'#6fae5a':th.power);
  if((!dyn||Forge.unlocked)&&onL(M.forge.l||0))tag(Forge.x,Forge.z,'Forgia',th.forge,-1.3);
  if(!dyn&&onL(lay(M.start.x,M.start.z,M.start.y)))tag(M.start.x,M.start.z,'Inizio',th.start,-1.3);
  if(Q4)egg4MapTags(tag,onL,dyn,th);
  g.strokeStyle=th.label;g.lineWidth=2*dpr;const sx=X(2),sy=Y(GH-1.2);g.beginPath();g.moveTo(sx,sy);g.lineTo(sx+10*s,sy);g.stroke();
  g.font=`${Math.round(fs*.85)}px "Barlow Condensed", sans-serif`;g.textAlign='left';g.fillStyle=th.label;g.fillText('10 m'+(NL>1?' · '+(M.layerNames||[])[LV]:''),sx+10*s+6*dpr,sy);
  if(dyn){zombies.forEach(z=>{if(z.active&&z.state!=='dying'){g.globalAlpha=onL(lay(z.x,z.z,z.h))?1:.3;g.fillStyle='#ff5a4a';g.beginPath();g.arc(X(z.x),Y(z.z),s*.45,0,7);g.fill();}});g.globalAlpha=1;
    if(NET.on)NET.peers.forEach(p=>{const q=p.s;if(!q||q.dn===2)return;g.globalAlpha=onL(lay(q.x,q.z,q.h))?1:.35;g.fillStyle=AV_CSS[q.sl&3];g.beginPath();g.arc(X(q.x),Y(q.z),s*.8,0,7);g.fill();});g.globalAlpha=1;
    g.save();g.translate(X(P.x),Y(P.z));g.rotate(-P.yaw);g.fillStyle='#ffd27a';g.beginPath();g.moveTo(0,-s*1.2);g.lineTo(s*.8,s*.9);g.lineTo(-s*.8,s*.9);g.closePath();g.fill();g.restore();}
}
const PAPER={wall:'#2b261e',floorLo:'#ece4cf',floorHi:'#b9ab86',locked:'#e6ddc6',ground:'#efe8d6',water:'#5f7f93',lava:'#d8662a',door:'#a8261c',doorText:'#fff2e6',win:'#8a6a3a',prop:'#9b9a86',stairs:'#8f8466',label:'#2b261e',buy:'#5e5646',box:'#4a6ea8',power:'#a8261c',start:'#2b261e',forge:'#c86a1a'};
const NIGHT={wall:'#6f6b5e',floorLo:'#1b1f1d',floorHi:'#3a3f39',locked:'#0f1110',ground:'#0b0c0b',water:'#0d2227',lava:'#8a3010',door:'#a8261c',doorText:'#fff2e6',win:'#8a6a3a',prop:'#3a3e3b',stairs:'#5a5d55',label:'#e9e3d1',buy:'#a39f90',box:'#6d9bef',power:'#c42a1f',start:'#e9e3d1',forge:'#ff8a3a'};

/* =========================================================
   COMANDI RIMAPPABILI, OPZIONI, MODALITÀ SVILUPPATORE
   ========================================================= */
const ACTIONS=[['forward','Avanti','KeyW'],['back','Indietro','KeyS'],['left','Sinistra','KeyA'],['right','Destra','KeyD'],['jump','Salta','Space'],['sprint','Scatto','ShiftLeft'],
  ['use','Compra / usa / tieni premuto','KeyE'],['talk','Chat vocale: tieni premuto per parlare','KeyT'],['reload','Ricarica','KeyR'],['knife','Coltello','KeyV'],['nade','Granata (o tomahawk)','KeyG'],['lure','Carillon','KeyF'],['shield','Scudo: alza / abbassa','KeyC'],
  ['w1','Arma 1','Digit1'],['w2','Arma 2','Digit2'],['w3','Arma 3','Digit3'],['swap','Cambia arma','KeyQ'],['map','Mappa (tieni premuto)','Tab'],['pause','Pausa','KeyP'],['fps','Contatore FPS','F3'],
  ['devNext','Sviluppatore: round successivo','KeyN'],['devEgg','Sviluppatore: avanza il 2º easter egg','KeyH'],['devEgg3','Sviluppatore: avanza il 3º easter egg','KeyU'],['devGun','Sviluppatore: arma casuale','KeyK'],['devForge','Sviluppatore: sblocca la Forgia','KeyJ'],
  ['devFly','Sviluppatore: volo attraverso i muri','KeyO'],['flyDown','Sviluppatore: scendi in volo','KeyX']];
let BIND={};const ALABEL={};ACTIONS.forEach(([a,l,k])=>{BIND[a]=k;ALABEL[a]=l;});
let SENS=1.5,INVERT=false;const DEV={on:false,god:true,money:true,ammo:true};
let devFly=false;/* volo dello sviluppatore (non si salva: ogni partita parte a piedi) */
try{const b=JSON.parse(localStorage.getItem('scn-keys')||'null');if(b)Object.assign(BIND,b);const o=JSON.parse(localStorage.getItem('scn-opts')||'null');if(o){SENS=o.sens||1.5;INVERT=!!o.inv;if(o.voice===false)VOICE_ON=false;Object.assign(DEV,o.dev||{});}}catch(_){}
function saveOpts(){try{localStorage.setItem('scn-keys',JSON.stringify(BIND));localStorage.setItem('scn-opts',JSON.stringify({sens:SENS,inv:INVERT,voice:VOICE_ON,dev:DEV}));}catch(_){}}
const kd=a=>!!keys[BIND[a]];
function keyName(c){if(!c)return '—';const MN={Mouse3:'Clic rotella',Mouse4:'Mouse laterale 1',Mouse5:'Mouse laterale 2',WheelUp:'Rotella su',WheelDown:'Rotella giù'};if(MN[c])return MN[c];if(c.startsWith('Key'))return c.slice(3);if(c.startsWith('Digit'))return c.slice(5);if(c.startsWith('Numpad'))return 'Num '+c.slice(6);
  const Mn={ShiftLeft:'Shift',ShiftRight:'Shift dx',ControlLeft:'Ctrl',ControlRight:'Ctrl dx',AltLeft:'Alt',AltRight:'Alt Gr',Space:'Spazio',Tab:'Tab',Enter:'Invio',Backspace:'Canc',CapsLock:'Bloc Maiusc',
    ArrowUp:'↑',ArrowDown:'↓',ArrowLeft:'←',ArrowRight:'→',Backquote:'\\',Minus:"'",Equal:'ì',BracketLeft:'è',BracketRight:'+',Semicolon:'ò',Quote:'à',Backslash:'ù',Comma:',',Period:'.',Slash:'-'};return Mn[c]||c;}
let capturing=null,optsFrom=null;
function renderBinds(){
  $('bindTable').innerHTML=ACTIONS.map(([a])=>`<tr><td>${ALABEL[a]}</td><td><button type="button" id="bind-${a}" data-a="${a}" class="${capturing===a?'wait':''}">${capturing===a?'Premi un tasto o un tasto del mouse…':keyName(BIND[a])}</button></td></tr>`).join('');
  $('bindTable').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{capturing=b.dataset.a;renderBinds();}));
  const K2=a=>`<kbd>${keyName(BIND[a])}</kbd>`;
  $('keysList').innerHTML=`<dt>${K2('forward')}${K2('left')}${K2('back')}${K2('right')}</dt><dd>Muoviti · ${K2('sprint')} scatto · ${K2('jump')} salto</dd>
    <dt>Mouse</dt><dd>Mira · sinistro spara · destro mirino (con le Vipere Gemelle: sinistro pistola destra, destro pistola sinistra) · rotella cambia arma</dd><dt>${K2('use')}</dt><dd>Compra, apri, usa · tieni premuto su finestre e valvole</dd>
    <dt>${K2('reload')} ${K2('knife')}</dt><dd>Ricarica · coltello</dd><dt>${K2('nade')} ${K2('lure')}</dt><dd>Granata · carillon (dalla cassa)</dd>
    <dt>${K2('w1')} ${K2('w2')} ${K2('swap')}</dt><dd>Cambia arma (anche rotella)</dd><dt>${K2('map')} ${K2('fps')}</dt><dd>Mappa · contatore FPS</dd>`;
  $('devNextKey').textContent=keyName(BIND.devNext);if($('devEggKey'))$('devEggKey').textContent=keyName(BIND.devEgg);if($('devEgg3Key'))$('devEgg3Key').textContent=keyName(BIND.devEgg3);$('devGunKey').textContent=keyName(BIND.devGun);$('devForgeKey').textContent=keyName(BIND.devForge);
}
function syncOptsUI(){$('sens').value=SENS;$('sensOut').textContent=SENS.toFixed(1);$('invY').checked=INVERT;$('voiceOn').checked=VOICE_ON;$('devOn').checked=DEV.on;$('devGod').checked=DEV.god;$('devMoney').checked=DEV.money;$('devAmmo').checked=DEV.ammo;
  $('devSub').setAttribute('aria-disabled',String(!DEV.on));H.devbadge.hidden=!DEV.on;}
/* volo (noclip): si va dove si guarda attraverso muri, pavimenti e soffitti; salto = su, X = giù, scatto = più veloce */
function setDevFly(on){devFly=on;if(!on){P.flyOff=true;P.vy=0;}else{P.vy=0;P.grounded=false;}const fb=document.querySelector('#devBar [data-dev="devFly"]');if(fb)fb.classList.toggle('on',on);
  showMsg(on?`Volo attivo<small>vai dove guardi, attraverso i muri · ${keyName(BIND.jump)} su · ${keyName(BIND.flyDown)} giù · ${keyName(BIND.devFly)} per scendere a terra</small>`:'Volo spento<small>torni a camminare</small>',2.2);}
document.querySelectorAll('#devBar button').forEach(b=>{const go=e=>{e.preventDefault();e.stopPropagation();if(DEV.on&&state==='playing')pressCode(BIND[b.dataset.dev]);};b.addEventListener('click',go);b.addEventListener('touchstart',go,{passive:false});});
function openOpts(from){optsFrom=from;$(from).hidden=true;$('opts').hidden=false;capturing=null;renderBinds();syncOptsUI();}
function closeOpts(){capturing=null;$('opts').hidden=true;if(optsFrom)$(optsFrom).hidden=false;renderBinds();}
$('optsBtn').addEventListener('click',()=>openOpts('menu'));$('optsBtn2').addEventListener('click',()=>openOpts('pause'));$('optsClose').addEventListener('click',closeOpts);
$('bindReset').addEventListener('click',()=>{ACTIONS.forEach(([a,,k])=>BIND[a]=k);saveOpts();renderBinds();});
$('sens').addEventListener('input',e=>{SENS=parseFloat(e.target.value)||1.5;$('sensOut').textContent=SENS.toFixed(1);saveOpts();});
$('invY').addEventListener('change',e=>{INVERT=e.target.checked;saveOpts();});
$('voiceOn').addEventListener('change',e=>{VOICE_ON=e.target.checked;saveOpts();});
[['devOn','on'],['devGod','god'],['devMoney','money'],['devAmmo','ammo']].forEach(([id,k])=>$(id).addEventListener('change',e=>{DEV[k]=e.target.checked;saveOpts();syncOptsUI();}));
addEventListener('keydown',e=>{if(!capturing)return;e.preventDefault();e.stopImmediatePropagation();
  if(e.code!=='Escape'){const old=BIND[capturing];const other=Object.keys(BIND).find(a=>a!==capturing&&BIND[a]===e.code);if(other)BIND[other]=old;BIND[capturing]=e.code;saveOpts();}
  const was=capturing;capturing=null;renderBinds();const b=$('bind-'+was);if(b)b.focus();},true);
function bindCaptured(code){const old=BIND[capturing];const other=Object.keys(BIND).find(a=>a!==capturing&&BIND[a]===code);if(other)BIND[other]=old;BIND[capturing]=code;saveOpts();const was=capturing;capturing=null;renderBinds();const b=$('bind-'+was);if(b)b.focus();}
addEventListener('mousedown',e=>{if(!capturing)return;const c=MOUSE_CODE[e.button];if(!c)return;e.preventDefault();e.stopImmediatePropagation();bindCaptured(c);},true);
addEventListener('wheel',e=>{if(!capturing)return;e.preventDefault();e.stopImmediatePropagation();bindCaptured(e.deltaY<0?'WheelUp':'WheelDown');},{capture:true,passive:false});
let skipMouse=0;

/* ---------- input ---------- */
// cattura del mouse: se il browser rifiuta (succede subito dopo aver premuto Esc o cambiato finestra) il gioco resta fermo finché non clicchi nella finestra
const canLock=!!canvas.requestPointerLock;let needLock=false,NOLOCK=false;
function requestLock(){if(TOUCH.on){askMotion();if(!NOLOCK)goFull();}if(NOLOCK)return;if(TOUCH.on){lockMode='touch';needLock=false;H.lockhint.hidden=true;return;}
  if(GP.on){needLock=false;H.lockhint.hidden=true;try{const p=canvas.requestPointerLock();if(p&&p.catch)p.catch(()=>{});}catch(_){}return;}/* col controller il mouse non serve */if(!canLock){lockMode='free';H.lockhint.textContent='Puntatore libero: muovi il mouse nella finestra per mirare, frecce per girarti, P per la pausa';H.lockhint.hidden=false;return;}
  if(document.pointerLockElement===canvas)return;needLock=true;H.lockhint.textContent='Clicca nella finestra per catturare il mouse e continuare';H.lockhint.hidden=false;
  try{const p=canvas.requestPointerLock();if(p&&p.catch)p.catch(()=>{});}catch(e){}}
document.addEventListener('pointerlockchange',()=>{if(document.pointerLockElement===canvas){lockMode='locked';needLock=false;skipMouse=3;H.lockhint.hidden=true;}
  else{const was=lockMode==='locked';if(lockMode!=='free')lockMode='none';if(state==='playing'&&was)pauseGame();}});
document.addEventListener('pointerlockerror',()=>{if(state==='playing'&&canLock&&!NOLOCK&&!GP.on){needLock=true;H.lockhint.textContent='Clicca nella finestra per catturare il mouse e continuare';H.lockhint.hidden=false;}});
addEventListener('blur',()=>{if(state==='playing'&&!TOUCH.on&&!GP.on&&document.pointerLockElement!==canvas&&canLock&&!NOLOCK){needLock=true;H.lockhint.hidden=false;}});
addEventListener('keydown',e=>{
  if(state!=='playing')return;keys[e.code]=true;
  if(['Tab','Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','F3',BIND.map,BIND.fps,BIND.jump].includes(e.code))e.preventDefault();
  if(e.repeat)return;
  if(e.code==='Escape'){if(lockMode!=='locked')pauseGame();return;}
  pressCode(e.code);
});
// tasti del mouse (rotellina cliccata, tasti laterali) e rotella usabili come comandi
const MOUSE_CODE={1:'Mouse3',3:'Mouse4',4:'Mouse5'};
function pressCode(code){
  for(const a of Object.keys(BIND).filter(a=>BIND[a]===code))switch(a){
    case 'jump':jumpQueued=true;break;
    case 'reload':startReload();break;case 'knife':knife();break;case 'nade':if(P.toma)throwToma();else throwItem('nade');break;case 'lure':throwItem('carillon');break;case 'shield':toggleShield();break;
    case 'w1':switchTo(0);break;case 'w2':switchTo(1);break;case 'w3':switchTo(2);break;case 'swap':if(inv.length>1)switchTo((cur+1)%inv.length);break;
    case 'map':showMap=true;H.mapwrap.hidden=false;break;case 'fps':showDebug=!showDebug;H.debug.hidden=!showDebug;break;
    case 'pause':if(document.pointerLockElement)document.exitPointerLock();pauseGame();break;
    case 'use':{if(P.downT>0||P.dead)break;const it=findInteract();if(it&&it.t!=='repair'&&it.t!=='valve'&&!(it.t==='r4'&&it.a==='build'))useInteract(it);}break;
    case 'devNext':if(DEV.on){toSpawn=0;for(const z of zombies)if(z.active&&z.state!=='dying')killZombie(z,false,'bomb');showMsg('Round saltato',1.2);}break;
    case 'devGun':if(DEV.on){giveWeapon(pick(BOX_POOL.filter(k=>!inv.some(w=>w.id===k))));}break;
    case 'devFly':if(DEV.on)setDevFly(!devFly);break;
    case 'devEgg':if(DEV.on&&Q2){if(!Forge.unlocked){if(!Power.on)useInteract({t:'power'});Q.valves=3;VALVES.forEach(v=>v.done=true);Q.lit=true;unlockForge();}
      else if(Q2.step===1){Q2.lamps.forEach(l=>{if(!l.shot){l.shot=true;l.mat.color.set(0x3cff6a);}});egg2Lamp();}
      else if(Q2.step===2||Q2.step===3){Q2.held=3-Q2.deposited;Q2.step=3;showMsg('Nuclei 3/3 (sviluppatore)',1.5);}
      else if(Q2.step===4&&!Q2.event){egg2Use();}else if(Q2.event){Q2.eventT=0;Q2.eventKills=M.egg2.need;}showMsg('Easter egg: passo '+Q2.step,1.2);}break;
    case 'devEgg3':if(DEV.on&&Q3){devEgg3();}else if(DEV.on&&Q4){devEgg4();showMsg('Rocca: passo successivo (sviluppatore)',1.2);}break;
    case 'devForge':if(DEV.on){if(!Power.on)useInteract({t:'power'});Q.keys=3;Q.valves=3;VALVES.forEach(v=>v.done=true);Q.lit=true;KEYOBJ.forEach(k=>{k.got=true;k.g.visible=false;});unlockForge();}break;
  }
}
function releaseCode(code){keys[code]=false;if(code===BIND.map){showMap=false;H.mapwrap.hidden=true;}}
addEventListener('mousedown',e=>{const c=MOUSE_CODE[e.button];if(!c)return;e.preventDefault();if(capturing)return;if(state!=='playing')return;keys[c]=true;pressCode(c);},true);
addEventListener('mouseup',e=>{const c=MOUSE_CODE[e.button];if(!c)return;e.preventDefault();releaseCode(c);},true);
addEventListener('auxclick',e=>{if(MOUSE_CODE[e.button])e.preventDefault();});
addEventListener('pointerup',e=>{if(e.button===3||e.button===4)e.preventDefault();},true);
addEventListener('keyup',e=>{releaseCode(e.code);});
addEventListener('blur',()=>{for(const k in keys)keys[k]=false;trigger=false;});
canvas.addEventListener('mousedown',e=>{if(state!=='playing')return;if(needLock&&canLock&&!NOLOCK){requestLock();return;}if(lockMode!=='locked'&&lockMode!=='free'&&canLock&&!NOLOCK)requestLock();if(e.button===0)trigger=true;else if(e.button===2)ads=true;});
addEventListener('mouseup',e=>{if(e.button===0)trigger=false;else if(e.button===2)ads=false;});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
let wheelT=0;addEventListener('wheel',e=>{if(capturing)return;if(state!=='playing')return;e.preventDefault();const now=performance.now();if(now-wheelT<140||Math.abs(e.deltaY)<1)return;wheelT=now;
  const c=e.deltaY<0?'WheelUp':'WheelDown';if(Object.values(BIND).includes(c)){keys[c]=true;pressCode(c);setTimeout(()=>releaseCode(c),120);return;}
  if(inv.length>1)switchTo((cur+(e.deltaY>0?1:inv.length-1))%inv.length);},{passive:false});
addEventListener('mousemove',e=>{if(state!=='playing')return;if(lockMode!=='locked'&&lockMode!=='free')return;
  let mx=e.movementX||0,my=e.movementY||0;if(skipMouse>0){skipMouse--;return;}if(Math.abs(mx)>280||Math.abs(my)>280)return;mx=clamp(mx,-110,110);my=clamp(my,-110,110);if(INVERT)my=-my;
  const scoped=adsT>.5&&wd(inv[cur]).scope;const s=.0022*SENS*(adsT>.5?(scoped?.3:.6):1);P.yaw-=mx*s;P.pitch=clamp(P.pitch-my*s,-1.45,1.45);swayX=clamp(swayX-mx*.00025,-.04,.04);swayY=clamp(swayY+my*.00025,-.04,.04);});
$('start').addEventListener('click',startGame);$('resume').addEventListener('click',resumeGame);$('again').addEventListener('click',startGame);
$('quit').addEventListener('click',toMenu);$('toMenu').addEventListener('click',toMenu);
$('quality').addEventListener('change',e=>{renderScale=parseFloat(e.target.value)||.75;resize();try{localStorage.setItem('scn-q',e.target.value);}catch(_){}});
try{const q=localStorage.getItem('scn-q');if(q){$('quality').value=q;renderScale=parseFloat(q)||.75;}}catch(_){}
// la qualità grafica cambia i materiali: si applica ricaricando la pagina (solo dal menu)
$('zstyle').value=ZSTYLE;$('zstyle').addEventListener('change',e=>{try{localStorage.setItem('scn-zstyle',e.target.value);}catch(_){}if(state==='menu'&&!NET.on)location.reload();else showMsg('I nuovi zombie arrivano al prossimo avvio',2.5);});
$('ostyle').value=OGG_ON?'meshy':'classici';$('ostyle').addEventListener('change',e=>{try{localStorage.setItem('scn-ogg',e.target.value);}catch(_){}if(state==='menu'&&!NET.on)location.reload();else showMsg('Gli oggetti nuovi arrivano al prossimo avvio',2.5);});
$('astyle').value=ARMI_ON?'meshy':'classiche';$('astyle').addEventListener('change',e=>{try{localStorage.setItem('scn-armi',e.target.value);}catch(_){}if(state==='menu'&&!NET.on)location.reload();else showMsg('Le armi nuove arrivano al prossimo avvio',2.5);});
$('gfx').value=GFX;$('gfx').addEventListener('change',e=>{try{localStorage.setItem('scn-luci',e.target.value);}catch(_){}if(state==='menu'&&!NET.on)location.reload();else showMsg('Le nuove luci si applicano al prossimo avvio',2.5);});
/* ---------- schermo intero: Android (e iPad) con la Fullscreen API, chiesta toccando Entra o Riprendi.
   Safari su iPhone non la dà alle pagine: lì si aggiunge il gioco alla schermata Home e si apre come app, senza barre ---------- */
const IN_FRAME=(()=>{try{return window.self!==window.top;}catch(_){return true;}})();
const IOS=/iP(hone|od|ad)/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
const STANDALONE=navigator.standalone===true||matchMedia('(display-mode: standalone)').matches||matchMedia('(display-mode: fullscreen)').matches;
function fsOn(){return !!(document.fullscreenElement||document.webkitFullscreenElement);}
function fsCan(){const d=document.documentElement;return !IN_FRAME&&!!((d.requestFullscreen&&document.fullscreenEnabled)||(d.webkitRequestFullscreen&&document.webkitFullscreenEnabled));}
function goFull(){if(STANDALONE||fsOn()||!fsCan())return false;const d=document.documentElement;
  const lock=()=>{try{const l=screen.orientation&&screen.orientation.lock&&screen.orientation.lock('landscape');if(l&&l.catch)l.catch(()=>{});}catch(_){}};
  try{const p=d.requestFullscreen?d.requestFullscreen({navigationUI:'hide'}):d.webkitRequestFullscreen();if(p&&p.then)p.then(lock).catch(()=>{});else lock();}catch(_){return false;}return true;}
function fsSync(){$('fsBtn').hidden=!TOUCH.on||STANDALONE;$('fsBtn').textContent=fsOn()?'Esci dallo schermo intero':'Schermo intero';$('fsHint').hidden=!TOUCH.on||STANDALONE||fsCan();}
$('fsBtn').addEventListener('click',()=>{if(fsOn()){try{(document.exitFullscreen||document.webkitExitFullscreen).call(document);}catch(_){}return;}
  if(!goFull()){const h=$('fsHint');h.hidden=false;h.classList.remove('flash');void h.offsetWidth;h.classList.add('flash');}});
['fullscreenchange','webkitfullscreenchange'].forEach(n=>document.addEventListener(n,()=>{fsSync();resize();}));
try{const c=document.createElement('canvas');c.width=c.height=180;const g=c.getContext('2d');g.fillStyle='#07090a';g.fillRect(0,0,180,180);/* icona per la schermata Home */
  g.strokeStyle='#c42a1f';g.lineWidth=12;g.beginPath();g.arc(90,90,50,0,7);g.stroke();g.fillStyle='#e9e3d1';[[84,16,12,44],[84,120,12,44],[16,84,44,12],[120,84,44,12]].forEach(r=>g.fillRect(...r));
  const l=document.createElement('link');l.rel='apple-touch-icon';l.href=c.toDataURL('image/png');document.head.appendChild(l);}catch(_){}
/* ---------- controller (Gamepad API, mappatura standard Xbox / PlayStation) ----------
   levetta sinistra muovi (clic L3 = corsa), levetta destra guarda, RT/R2 spara, LT/L2 mira, A/✕ salta, X/□ usa (tenuto) o ricarica,
   Y/△ cambia arma, B/○ e R3 coltello, RB/R1 granata, LB/L1 carillon, Start pausa, Back/Share mappa (tenuto). Fuori dal gioco A o Start
   premono il pulsante principale (Entra, Riprendi, Riprova, Inizia la partita). */
/* ---------- aim assist (telefono e controller; col mouse no) ----------
   Solo rallentamento: quando il mirino passa sopra la testa di uno zombie visibile la mira rallenta (AA.slowF moltiplica
   controller, dito e giroscopio), così ti fermi sulla testa. Il mirino non viene mai tirato verso il bersaglio.
   La testa è la sua hitbox vera (segue camminata, strisciata e scavalcamento); il margine attorno cresce col livello.
   Col mirino libero conta dove sta il mirino (aimQuat). */
/* Col controller (PC o console) in più c'è l'aiuto "rotazionale" di COD: se il mirino è vicino alla testa e tu ti muovi o giri,
   la visuale segue lo spostamento dello zombie (o il tuo) di una parte, così il mirino resta dov'era rispetto a lui.
   Non sposta mai il mirino verso la testa: mantiene solo la distanza che hai già. Da fermo (levette ferme) non fa niente. */
const AA={lv:'normale',slowF:1,tgt:null,last:null};const AA_LV={spento:0,leggero:.6,normale:1,forte:1.5};
try{const v=localStorage.getItem('scn-aa');if(AA_LV[v]!=null)AA.lv=v;}catch(_){}
const _ae=new THREE.Vector3(),_ad=new THREE.Vector3(),_ah=new THREE.Vector3();
function aaOn(){return AA_LV[AA.lv]>0&&state==='playing'&&!P.dead&&(GP.on||TOUCH.on);}
function aaHead(s,pad){camera.getWorldPosition(_ae);_ad.set(0,0,-1).applyQuaternion(aimQuat());const D=Math.PI/180,cone=(.6+(pad?2.4:0))*s;let best=null;
  for(const z of zombies){if(!z.active||z.state==='dying'||!z.hits)continue;const h=z.hits.find(m=>m.userData.part==='head');if(!h)continue;
    h.getWorldPosition(_ah).sub(_ae);const along=_ah.dot(_ad);if(along<.4||along>45)continue;
    const perp=Math.sqrt(Math.max(0,_ah.lengthSq()-along*along)),R=.15*z.g.scale.x*(1+.4*s)+along*Math.tan(cone*D),k=perp/R;
    if(k<1&&(!best||k<best.k))best={z,k,L:_ah.length(),v:_ah.clone()};}
  if(!best)return null;best.v.multiplyScalar(1/best.L);return shotDist(_ae,best.v,best.L)>=best.L-.35?best:null;}/* niente attraverso i muri */
function aimAssistTick(dt){AA.slowF=1;AA.tgt=null;if(!aaOn()){AA.last=null;return;}const s=AA_LV[AA.lv],pad=GP.on&&!TOUCH.on,t=aaHead(s,pad);if(!t){AA.last=null;return;}
  AA.tgt=t.z;AA.slowF=1-Math.min(.7,(pad?.55:.45)*s*((ads||adsT>.5)?1.15:1))*(1-.4*t.k);/* più forte al centro della testa */
  if(!pad)return;const v=t.v,ty=Math.atan2(-v.x,-v.z),tp=Math.asin(clamp(v.y,-1,1)),L=AA.last;AA.last={z:t.z,y:ty,p:tp};
  const input=Math.abs(GP.mx)+Math.abs(GP.my)+Math.abs(GP.rx||0)+Math.abs(GP.ry||0)>.08;if(!L||L.z!==t.z||!input||dt<=0)return;
  let dy=ty-L.y;dy=Math.atan2(Math.sin(dy),Math.cos(dy));const dp=tp-L.p,mx=2.2*dt;/* al massimo ~125°/s: niente scatti se lo zombie salta */
  const f=Math.min(.9,.62*s*((ads||adsT>.5)?1.2:1))*(1-.4*t.k);P.yaw+=clamp(dy,-mx,mx)*f;P.pitch=clamp(P.pitch+clamp(dp,-mx,mx)*f*.6,-1.45,1.45);}
$('aaLv').value=AA.lv;$('aaLv').addEventListener('change',e=>{AA.lv=AA_LV[e.target.value]!=null?e.target.value:'normale';try{localStorage.setItem('scn-aa',AA.lv);}catch(_){}});
const GP={on:false,mx:0,my:0,sprint:false,prev:[],useHeld:false};
function padGet(){const L=navigator.getGamepads?[...navigator.getGamepads()].filter(g=>g&&g.connected):[];return L.find(g=>g.mapping==='standard')||L[0]||null;}
function padHint(txt,s){const h=$('padHint');h.textContent=txt;h.hidden=false;clearTimeout(padHint.t);padHint.t=setTimeout(()=>h.hidden=true,(s||4)*1000);}
function padRumble(strong,weak,ms){try{const g=padGet();const v=g&&g.vibrationActuator;if(v&&v.playEffect)v.playEffect('dual-rumble',{duration:ms,strongMagnitude:strong,weakMagnitude:weak}).catch(()=>{});}catch(_){}}
addEventListener('gamepadconnected',e=>{GP.on=true;needLock=false;H.lockhint.hidden=true;
  padHint(state==='playing'?'Controller collegato · RT spara · LT mira · A salta · X ricarica (tieni: usa/compra) · Y cambia arma · B coltello · RB granata · LB carillon · Start pausa'
    :'Controller collegato · croce o levetta per scegliere · A conferma · B indietro · ←/→ cambiano i valori',6);$('padState').textContent='Controller collegato: '+String(e.gamepad.id||'').slice(0,40);});
addEventListener('gamepaddisconnected',()=>{if(!padGet()){GP.on=false;GP.mx=GP.my=0;GP.sprint=false;trigger=false;$('padState').textContent='Nessun controller collegato';}});
const padDz=(v,d)=>Math.abs(v)<d?0:(v-Math.sign(v)*d)/(1-d);
/* menu col controller: croce o levetta sinistra spostano la selezione verso il controllo più vicino in quella direzione,
   A preme (le tendine passano alla voce dopo), B torna indietro, sinistra/destra cambiano cursori e tendine, Start preme il pulsante principale */
const PADNAV={ov:null,el:null,mk:null,idx:0,dir:null,t:0,last:new Map()};
const OV_ORDER=['gyroTest','opts','room','net','pause','over','menu'],OV_BACK={gyroTest:'gtClose',opts:'optsClose',net:'netClose',pause:'resume'};
const padVis=e=>!!e&&!e.hidden&&e.getClientRects().length>0;
function padOverlay(){for(const id of OV_ORDER){const o=$(id);if(padVis(o))return o;}return null;}
function padItems(ov){return [...ov.querySelectorAll('button,select,input,a[href]')].filter(e=>!e.disabled&&padVis(e)&&getComputedStyle(e).visibility!=='hidden');}
const padBox=e=>(e.closest('label.q')||e).getBoundingClientRect();
function padFocus(e,L){if(PADNAV.mk)PADNAV.mk.classList.remove('padf');PADNAV.el=e;PADNAV.mk=null;if(!e)return;
  const mk=e.closest('label.q')||e;mk.classList.add('padf');PADNAV.mk=mk;if(L)PADNAV.idx=L.indexOf(e);if(PADNAV.ov)PADNAV.last.set(PADNAV.ov.id,e);
  try{e.focus({preventScroll:true});}catch(_){}mk.scrollIntoView({block:'nearest',inline:'nearest'});}
function padDefault(ov,L){if(ov.id==='opts')return L[0];return L.find(e=>e.classList.contains('go'))||L[0];}
function padMove(dx,dy,L){const c=PADNAV.el,r=padBox(c),cx=r.left+r.width/2,cy=r.top+r.height/2;let best=null,bs=1e9;
  for(const e of L){if(e===c)continue;const q=padBox(e),ex=q.left+q.width/2,ey=q.top+q.height/2,along=dx?(ex-cx)*dx:(ey-cy)*dy,side=dx?Math.abs(ey-cy):Math.abs(ex-cx);
    if(along<=4)continue;const s=along+side*2.5;if(s<bs){bs=s;best=e;}}
  if(!best&&dy)best=dy>0?L[0]:L[L.length-1];/* in fondo si riparte dall'altro capo */
  if(best)padFocus(best,L);return !!best;}
function padAdjust(d,wrap){const e=PADNAV.el;if(!e)return false;
  if(e.tagName==='SELECT'){const n=e.options.length;let i=e.selectedIndex+d;i=wrap?(i+n)%n:clamp(i,0,n-1);if(i!==e.selectedIndex){e.selectedIndex=i;e.dispatchEvent(new Event('change',{bubbles:true}));}return true;}
  if(e.type==='range'){const st=parseFloat(e.step)||1,v=clamp(+(parseFloat(e.value)+d*st).toFixed(4),parseFloat(e.min),parseFloat(e.max));
    if(v!==parseFloat(e.value)){e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));}return true;}
  return false;}
function padMenu(dt,g,b,down){const ov=padOverlay();if(!ov){padFocus(null);return;}
  const L=padItems(ov);if(!L.length)return;
  if(ov!==PADNAV.ov){PADNAV.ov=ov;const r=(ov.id==='menu'||ov.id==='opts')&&PADNAV.last.get(ov.id);/* menu e opzioni: torni dove eri */
    padFocus(r&&L.includes(r)?r:padDefault(ov,L),L);}
  else if(!PADNAV.el||!L.includes(PADNAV.el))padFocus(L[Math.min(Math.max(0,PADNAV.idx),L.length-1)],L);/* la lista è cambiata (es. lobby) */
  const lx=g.axes[0]||0,ly=g.axes[1]||0;
  const dir=(b(12)||ly<-.55)?'u':(b(13)||ly>.55)?'d':(b(14)||lx<-.55)?'l':(b(15)||lx>.55)?'r':null;
  let go=false;if(dir!==PADNAV.dir){PADNAV.dir=dir;PADNAV.t=.38;go=!!dir;}else if(dir){PADNAV.t-=dt;if(PADNAV.t<=0){PADNAV.t=.11;go=true;}}/* tenuto: ripete */
  /* sinistra/destra: i cursori cambiano valore; le tendine si spostano se di lato c'è un altro controllo, altrimenti cambiano voce */
  if(go){const h=dir==='l'||dir==='r',s=dir==='r'?1:-1,el=PADNAV.el;
    if(h&&el.type==='range')padAdjust(s,false);
    else if(!padMove(h?s:0,dir==='u'?-1:dir==='d'?1:0,L)&&h&&el.tagName==='SELECT')padAdjust(s,false);}
  const e=PADNAV.el;
  if(down(0)&&e){if(e.tagName==='SELECT')padAdjust(1,true);else if(e.type!=='range'&&e.type!=='text')e.click();}
  if(down(1)){const k=$(OV_BACK[ov.id]);if(padVis(k))k.click();}
  if(down(9)){const t=['resume','again','roomStart','start','optsClose','gtClose'].map(id=>$(id)).find(el=>padVis(el)&&ov.contains(el));if(t)t.click();}}
function padTick(dt){const g=padGet();if(!g){if(GP.on){GP.on=false;GP.mx=GP.my=0;GP.sprint=false;padFocus(null);PADNAV.ov=null;}return;}GP.on=true;
  const b=i=>{const x=g.buttons[i];return !!x&&(x.pressed||x.value>.4);},was=i=>!!GP.prev[i],down=i=>b(i)&&!was(i),up=i=>!b(i)&&was(i);
  const save=()=>{GP.prev=g.buttons.map((_,i)=>b(i));};
  if(state!=='playing'){padMenu(dt,g,b,down);GP.mx=GP.my=0;save();return;}
  if(PADNAV.el){const e=PADNAV.el;padFocus(null);PADNAV.ov=null;try{e.blur();}catch(_){}}
  const ax=g.axes;GP.mx=padDz(ax[0]||0,.18);GP.my=padDz(ax[1]||0,.18);
  if(down(10))GP.sprint=true;if(GP.my>-.35)GP.sprint=false;/* L3: corri finché spingi avanti */
  const rx=padDz(ax[2]||0,.14),ry=padDz(ax[3]||0,.14);GP.rx=rx;GP.ry=ry;
  if(rx||ry){const scoped=adsT>.5&&inv.length&&wd(inv[cur]).scope,k=SENS*(adsT>.5?(scoped?.35:.55):1);/* curva: preciso al centro, veloce in fondo */
    const cx=Math.sign(rx)*Math.pow(Math.abs(rx),1.8)*3.4*k*AA.slowF,cy=Math.sign(ry)*Math.pow(Math.abs(ry),1.8)*2.2*k*AA.slowF;/* aim assist: rallenta sul bersaglio */
    P.yaw-=cx*dt;P.pitch=clamp(P.pitch-(INVERT?-cy:cy)*dt,-1.45,1.45);swayX=clamp(swayX-cx*dt*.02,-.04,.04);swayY=clamp(swayY+cy*dt*.02,-.04,.04);}
  if(down(7))trigger=true;if(up(7))trigger=false;if(down(6))ads=true;if(up(6))ads=false;
  if(down(0))jumpQueued=true;GP.up=b(0);/* A tenuto: in volo sale */
  {const tk=b(13);if(tk!==!!GP.talk){GP.talk=tk;VOICE.talk=tk;vTalkApply();}}/* croce in basso tenuta: chat vocale */
  // X come in COD: tocco breve = ricarica, tenuto premuto = usa / compra (e tieni per assi, valvole, rianimare)
  if(down(2))GP.xT=performance.now();
  if(b(2)&&!GP.useHeld&&performance.now()-GP.xT>300){const it=P.downT>0||P.dead?null:findInteract();if(it){keys[BIND.use]=true;pressCode(BIND.use);GP.useHeld=true;}}
  if(up(2)){if(GP.useHeld){releaseCode(BIND.use);GP.useHeld=false;}else if(performance.now()-GP.xT<=300)startReload();}
  if(down(3)&&inv.length>1)switchTo((cur+1)%inv.length);
  if(down(1)||down(11))knife();if(down(5)){if(P.toma)throwToma();else throwItem('nade');}if(down(4))throwItem('carillon');if(down(14))toggleShield();/* croce a sinistra: scudo */
  if(down(8)){showMap=true;H.mapwrap.hidden=false;}if(up(8)){showMap=false;H.mapwrap.hidden=true;}
  if(down(9)){trigger=false;ads=false;pauseGame();}
  save();}
/* ---------- comandi touch: joystick a sinistra, visuale trascinando a destra, pulsanti ---------- */
const tEl=$('touch'),tStick=$('tStick');
function enableTouch(){if(TOUCH.on)return;TOUCH.on=true;document.body.classList.add('touch');$('touchwarn').hidden=false;lockMode='touch';needLock=false;H.lockhint.hidden=true;fsSync();}
if(navigator.maxTouchPoints>0&&matchMedia('(pointer: coarse)').matches)enableTouch();
addEventListener('touchstart',()=>enableTouch(),{passive:true,capture:true});
function tLook(dx,dy){const scoped=adsT>.5&&wd(inv[cur]).scope;const s=.0052*SENS*(adsT>.5?(scoped?.3:.55):1)*AA.slowF;P.yaw-=dx*s;P.pitch=clamp(P.pitch-(INVERT?-dy:dy)*s,-1.45,1.45);swayX=clamp(swayX-dx*.0004,-.04,.04);swayY=clamp(swayY+dy*.0004,-.04,.04);}
function tBtnDown(n,el){if(n!=='swap'&&n!=='map'&&n!=='gyro'&&n!=='shield')el.classList.add('on');switch(n){
  case 'fire':trigger=true;break;case 'ads':if(vmDual||wd(inv[cur]).special==='bow')ads=true;else ads=!ads;break;case 'jump':jumpQueued=true;break;case 'reload':startReload();break;
  case 'knife':knife();break;case 'nade':if(P.toma)throwToma();else throwItem('nade');break;case 'lure':throwItem('carillon');break;case 'shield':toggleShield();break;case 'swap':if(inv.length>1)switchTo((cur+1)%inv.length);break;
  case 'use':keys[BIND.use]=true;pressCode(BIND.use);break;case 'talk':VOICE.talk=true;vTalkApply();break;case 'pause':pauseGame();break;case 'map':showMap=!showMap;H.mapwrap.hidden=!showMap;break;case 'gyro':gyroCycle();break;}}
function tBtnUp(n,el){el.classList.remove('on');switch(n){case 'fire':trigger=false;break;case 'ads':if(vmDual||wd(inv[cur]).special==='bow')ads=false;break;
  case 'use':releaseCode(BIND.use);break;case 'talk':VOICE.talk=false;vTalkApply();break;}if(n==='ads'&&ads&&!vmDual)el.classList.add('on');}
/* giroscopio per mirare, come il Pro Controller in Zelda BotW: inclini su/giù = guardi su/giù, ti giri o ruoti il telefono a volante = giri la visuale.
   Fonte principale: deviceorientation (alpha/beta/gamma), che ha lo stesso significato su iPhone e Android. Da due letture di fila si ricava
   la rotazione fatta dal telefono (quaternioni: angoli esatti, niente dt). Gli assi di rotationRate invece su iPhone non seguono la specifica,
   quindi si usa solo se manca l'orientamento, con gli assi rilevati confrontando le due fonti mentre il telefono si muove. */
const SHAKE_LV=['leggera','normale','decisa'];
const GYRO={mode:'sempre',sens:1.8,invY:false,wheel:true,map:null,asked:false,ok:false,status:'',src:'',side:0,sideG:false,sideT:0,up:null,q0:null,lastO:0,lastM:0,
  sm:[0,0],raw:{o:null,r:null,rt:0,iv:0},rate:[0,0,0],hz:0,hzN:0,hzT:0,test:{x:0,y:0},L:null,
  edge:true,edgeDeg:23,c:0,hist:[],shake:true,shakeLv:'normale',pk:null,shakeT:0,shakes:0,aimMode:'visuale',accel:.6,ax:0,ay:0,wall:50,ox:0,oy:0,rec:1.5,vs:0,stillT:0,recN:0};
try{const o=JSON.parse(localStorage.getItem('scn-gyro')||'null');if(o){GYRO.mode=o.mode||'sempre';GYRO.sens=o.sens||1.8;GYRO.invY=!!o.invY;GYRO.wheel=o.wheel!==false;if(o.map&&o.map.o&&o.map.o.length===3)GYRO.map=o.map;
  GYRO.edge=o.edge!==false;GYRO.shake=o.shake!==false;if(o.edgeDeg>=5&&o.edgeDeg<=60)GYRO.edgeDeg=o.edgeDeg;if(SHAKE_LV.includes(o.shakeLv))GYRO.shakeLv=o.shakeLv;if(o.aimMode==='puntatore')GYRO.aimMode='puntatore';if(o.accel>=0&&o.accel<=4)GYRO.accel=o.accel;if(o.wall>=20&&o.wall<=90)GYRO.wall=o.wall;if(o.rec>=0&&o.rec<=5)GYRO.rec=o.rec;}}catch(_){}
function saveGyro(){try{localStorage.setItem('scn-gyro',JSON.stringify({mode:GYRO.mode,sens:GYRO.sens,invY:GYRO.invY,wheel:GYRO.wheel,map:GYRO.map,edge:GYRO.edge,edgeDeg:GYRO.edgeDeg,shake:GYRO.shake,shakeLv:GYRO.shakeLv,aimMode:GYRO.aimMode,accel:GYRO.accel,wall:GYRO.wall,rec:GYRO.rec}));}catch(_){}}
/* valori di serie scelti dall'utente (mouse 1,5 · giroscopio 1,8 · accelerazione 0,6 · bordo 23°): chi aveva già salvato le impostazioni
   li riceve una volta sola (scn-def), poi restano modificabili come sempre */
try{if(localStorage.getItem('scn-def')!=='2'){SENS=1.5;GYRO.sens=1.8;GYRO.accel=.6;GYRO.edgeDeg=23;localStorage.setItem('scn-def','2');saveOpts();saveGyro();}}catch(_){}
const W3C_MAP={o:[1,2,0],s:[1,1,1],deg:true};/* per la specifica: asse x del telefono = beta, y = gamma, z = alpha, in gradi/s */
const _gq=new THREE.Quaternion(),_gd=new THREE.Quaternion(),_ge=new THREE.Euler();
function apiAngle(){const a=typeof window.orientation==='number'?window.orientation:(screen.orientation&&typeof screen.orientation.angle==='number')?screen.orientation.angle:90;return ((a%360)+360)%360;}
function scrAngle(){if(innerHeight>innerWidth)return 0;
  /* in orizzontale l'alto dello schermo è il fianco sinistro (90) o destro (270) del telefono: lo dice la gravità.
     Il valore del sistema serve solo finché il telefono non si è mai inclinato di lato, perché su iPhone non è affidabile */
  const u=GYRO.up,thr=(!GYRO.sideG||performance.now()-GYRO.sideT<1500)?.25:.6;
  if(u&&Math.abs(u[0])>thr){GYRO.side=u[0]>0?90:270;GYRO.sideG=true;}
  if(!GYRO.sideG)GYRO.side=apiAngle()===270?270:90;
  return GYRO.side;}
['orientationchange','resize'].forEach(n=>addEventListener(n,()=>{GYRO.sideT=performance.now();}));
try{screen.orientation.addEventListener('change',()=>{GYRO.sideT=performance.now();});}catch(_){}
function gyroActive(){return TOUCH.on&&state==='playing'&&(GYRO.mode==='sempre'||(GYRO.mode==='mira'&&ads));}
function gyroDev(x,y,z,dt){/* x,y,z: radianti girati attorno agli assi del telefono (x destra, y alto, z verso di te, tenuto in verticale) */
  const a=scrAngle();let p,t;/* p: attorno all'asse destro dello schermo (+ = guardi su); t: attorno all'asse alto (+ = giri a sinistra) */
  if(a===90){p=-y;t=x;}else if(a===270){p=y;t=-x;}else if(a===180){p=-x;t=-y;}else{p=x;t=y;}
  GYRO.rate=[p/dt,t/dt,z/dt];let yw;
  if(GYRO.wheel){const s=t+z,m=Math.hypot(t,z);yw=Math.sign(s)*Math.min(Math.abs(s),m);}/* girarsi e volante (orario = destra) si sommano senza superare la rotazione vera */
  else{const u=GYRO.up;let uy=1,uz=0;if(u){uz=u[2];uy=a===90?u[0]:a===270?-u[0]:a===180?-u[1]:u[1];}/* solo il giro attorno alla verticale del mondo */
    const w=t*uy+z*uz;yw=Math.sign(w)*Math.min(Math.abs(w)*1.41,Math.hypot(t,z));}
  /* sotto 1.5°/s è il tremolio della mano: si attenua; fino a 9°/s si liscia un poco; sopra passa diretto */
  const D=Math.PI/180,sp=Math.hypot(p,yw)/dt;if(sp<1.5*D){const f=sp/(1.5*D);p*=f;yw*=f;}
  const w=clamp((sp-3*D)/(6*D),0,1),al=1-Math.exp(-dt/.06);
  GYRO.sm[0]+=(p*(1-w)-GYRO.sm[0])*al;GYRO.sm[1]+=(yw*(1-w)-GYRO.sm[1])*al;p=p*w+GYRO.sm[0];yw=yw*w+GYRO.sm[1];
  // accelerazione: oltre 25°/s i movimenti contano di più (fino a ×(1+accel) sopra 160°/s); quelli lenti restano 1:1 e precisi
  const yw0=yw,p0=GYRO.invY?-p:p;/* rotazione vera del telefono: serve al centro del bordo e alle pareti del mirino libero */{const s2=Math.hypot(p,yw)/dt,a=1+GYRO.accel*clamp((s2-25*D)/(135*D),0,1);p*=a;yw*=a;}
  const scoped=adsT>.5&&inv.length&&wd(inv[cur]).scope,k=GYRO.sens*(scoped?.6:1)*AA.slowF;if(GYRO.invY)p=-p;
  GYRO.test.x=clamp(GYRO.test.x-yw*k,-.6,.6);GYRO.test.y=clamp(GYRO.test.y+p*k,-.4,.4);
  if(!gyroActive()){GYRO.c=0;GYRO.ax=GYRO.ay=GYRO.ox=GYRO.oy=0;return;}
  if(gyroPtrOn()){/* mirino libero (stile Wii): il giroscopio muove il mirino dentro le pareti virtuali, la visuale resta ferma */
    const a0=GYRO.ax,b0=GYRO.ay,o0=GYRO.ox,q0=GYRO.oy,{wx,wy}=gyroWalls();
    [GYRO.ax,GYRO.ox]=ptrAxis(GYRO.ax,GYRO.ox,-yw*k,-yw0,wx);[GYRO.ay,GYRO.oy]=ptrAxis(GYRO.ay,GYRO.oy,p*k,p0,wy);
    GYRO.hist.push([performance.now(),0,0,0,GYRO.ax-a0,GYRO.ay-b0,GYRO.ox-o0,GYRO.oy-q0]);if(GYRO.hist.length>90)GYRO.hist.shift();return;}
  // il centro è dove tenevi il telefono quando è partita la mira (serve al "bordo" che continua a girare)
  GYRO.c+=yw0;const T=GYRO.edgeDeg*D;GYRO.c=clamp(GYRO.c,-T-.8,T+.8);
  /* fermo per GYRO.rec secondi (e il bordo non sta girando): il centro diventa la posizione attuale, così se ti giri tu col corpo
     o il telefono resta un po' storto non parte di colpo la rotazione del bordo. Si muove di nuovo solo ricominciando a girare */
  GYRO.vs+=(Math.hypot(yw0,p0)/dt-GYRO.vs)*(1-Math.exp(-dt/.1));
  if(GYRO.rec>0&&GYRO.vs<3*D&&Math.abs(GYRO.c)<=T){GYRO.stillT+=dt;if(GYRO.stillT>=GYRO.rec&&GYRO.c){if(Math.abs(GYRO.c)>.5*D)GYRO.recN++;GYRO.c=0;}}else GYRO.stillT=0;
  const pc=clamp(P.pitch+p*k,-1.45,1.45);GYRO.hist.push([performance.now(),yw*k,pc-P.pitch,yw0,0,0]);if(GYRO.hist.length>90)GYRO.hist.shift();/* per annullare il colpo per il mirino */
  P.yaw+=yw*k;P.pitch=pc;
  swayX=clamp(swayX+yw*k*.08,-.04,.04);swayY=clamp(swayY-p*k*.08,-.04,.04);}
/* ---------- mirino libero col giroscopio (come Call of Duty sul Wii col Wiimote) ----------
   GYRO.ax / GYRO.ay = angolo del mirino rispetto al centro (destra / su). Il mirino si muove dentro pareti virtuali (GYRO.wall = % dello
   schermo, di serie metà): contro una parete si ferma e quanto giri il telefono oltre si accumula in GYRO.ox / GYRO.oy (gradi veri).
   Finché spingi la visuale gira da quella parte; tornando indietro prima ti stacchi dalla parete, poi il mirino si muove.
   Si spara dove sta il mirino (aimQuat). Mirando, il mirino torna al centro portandosi dietro la visuale. */
function gyroPtrOn(){return GYRO.aimMode==='puntatore'&&TOUCH.on&&!ads&&state==='playing';}
function gyroFov(){const hy=camera.fov*Math.PI/360,hx=Math.atan(Math.tan(hy)*camera.aspect);return {hx,hy};}
function gyroWalls(){const {hx,hy}=gyroFov(),f=GYRO.wall/100;return {wx:Math.atan(f*Math.tan(hx)),wy:Math.atan(f*Math.tan(hy))};}
const PTR_OMAX=20*Math.PI/180;/* oltre la parete si contano al massimo 20°, così per staccarsi basta poco */
function ptrAxis(a,o,dP,dR,lim){/* a: mirino, o: spinta oltre la parete, dP: spostamento del mirino, dR: lo stesso in rotazione vera del telefono */
  a=clamp(a,-lim,lim);if(!dP||!dR)return [a,o];
  if(o&&Math.sign(dR)===Math.sign(o))return [a,clamp(o+dR,-PTR_OMAX,PTR_OMAX)];
  if(o){const n=o+dR;if(Math.sign(n)!==-Math.sign(o))return [a,n];dP*=n/dR;dR=n;o=0;}/* tornando indietro prima si stacca dalla parete, il resto muove il mirino */
  const na=a+dP;if(Math.abs(na)<=lim)return [na,0];
  const s=Math.sign(na);return [s*lim,clamp(s*(Math.abs(na)-lim)*Math.abs(dR/dP),-PTR_OMAX,PTR_OMAX)];}
function gyroPtr(){const {hx,hy}=gyroFov();return {x:Math.tan(GYRO.ax||0)/Math.tan(hx),y:Math.tan(GYRO.ay||0)/Math.tan(hy)};}
const _aq=new THREE.Quaternion(),_ao=new THREE.Quaternion(),_av=new THREE.Vector3(),_az=new THREE.Vector3(0,0,-1);
function aimQuat(){if(!GYRO.ax&&!GYRO.ay)return camera.quaternion;_av.set(Math.tan(GYRO.ax),Math.tan(GYRO.ay),-1).normalize();_ao.setFromUnitVectors(_az,_av);return _aq.copy(camera.quaternion).multiply(_ao);}
/* bordi: nel modo classico, girato il telefono oltre la soglia la visuale continua a girare, e parte subito veloce;
   nel mirino libero gira finché il mirino spinge contro una parete virtuale, subito veloce e di più quanto più spingi */
/* azzera il giroscopio e lo mette in pausa per ms millisecondi: a inizio partita e alla ripresa (schermo intero che cambia
   orientamento, primo fotogramma lento), così la visuale non parte a girare da sola */
function gyroReset(ms){GYRO.c=0;GYRO.sm=[0,0];GYRO.hist=[];GYRO.stillT=0;GYRO.vs=0;GYRO.ax=GYRO.ay=GYRO.ox=GYRO.oy=0;GYRO.pk=null;GYRO.q0=null;GYRO.holdUntil=performance.now()+(ms||0);}
function gyroEdgeTick(dt){const el=$('gyroEdge');let r=0;const D=Math.PI/180;if(performance.now()<(GYRO.holdUntil||0)){GYRO.c=0;GYRO.ox=GYRO.oy=0;}
  if(gyroActive()&&GYRO.ok){
    if(GYRO.aimMode==='puntatore'&&!ads){const {wx,wy}=gyroWalls();GYRO.ax=clamp(GYRO.ax,-wx,wx);GYRO.ay=clamp(GYRO.ay,-wy,wy);let rv=0;
      if(Math.abs(GYRO.ox)>.4*D)r=-Math.sign(GYRO.ox)*(2+2.6*Math.min(1,Math.abs(GYRO.ox)/(8*D)));
      if(Math.abs(GYRO.oy)>.4*D)rv=Math.sign(GYRO.oy)*(1.2+1.6*Math.min(1,Math.abs(GYRO.oy)/(8*D)));
      P.yaw+=r*dt;P.pitch=clamp(P.pitch+rv*dt,-1.45,1.45);}
    else if(GYRO.aimMode!=='puntatore'&&GYRO.edge){const o=Math.abs(GYRO.c)-GYRO.edgeDeg*D;if(o>0)r=Math.sign(GYRO.c)*(2.4+2.3*Math.min(1,o/(8*D)));
      if(r){const scoped=adsT>.5&&inv.length&&wd(inv[cur]).scope;P.yaw+=r*(scoped?.5:1)*dt;}}}
  // mirando nel mirino libero: il mirino scivola al centro e la visuale lo segue (resti puntato sullo stesso bersaglio)
  if(ads&&(GYRO.ax||GYRO.ay)){const f=1-Math.exp(-dt*16),dx=GYRO.ax*f,dy=GYRO.ay*f;P.yaw-=dx;P.pitch=clamp(P.pitch+dy,-1.45,1.45);GYRO.ax-=dx;GYRO.ay-=dy;
    if(Math.abs(GYRO.ax)<.002&&Math.abs(GYRO.ay)<.002)GYRO.ax=GYRO.ay=0;}
  if(ads||!TOUCH.on||state!=='playing'||GYRO.aimMode!=='puntatore')GYRO.ox=GYRO.oy=0;
  if((!TOUCH.on||state!=='playing'||GYRO.aimMode!=='puntatore')&&(GYRO.ax||GYRO.ay))GYRO.ax=GYRO.ay=0;
  const v=r?Math.min(1,Math.abs(r)/2):0;el.style.opacity=v.toFixed(2);el.classList.toggle('l',r>0);}
/* colpo per il mirino: una spinta decisa avanti e indietro (o di lato) col telefono. Basta un picco di accelerazione in un verso
   seguito entro 0,45 s da uno nel verso opposto sullo stesso asse (la spinta e la frenata), oltre la soglia scelta nelle opzioni.
   La rotazione che il colpo stesso ha dato alla visuale viene tolta */
const SHAKE_TH={leggera:4,normale:5.5,decisa:8};
function gyroShakeSample(v,now){const th=SHAKE_TH[GYRO.shakeLv]||5.5,inGame=GYRO.shake&&TOUCH.on&&state==='playing',test=!$('gyroTest').hidden;/* nella prova conta soltanto */
  let ax=0;for(let i=1;i<3;i++)if(Math.abs(v[i])>Math.abs(v[ax]))ax=i;const a=v[ax],p=GYRO.pk;GYRO.accMax=Math.max(GYRO.accMax||0,Math.abs(a));
  if((!inGame&&!test)||Math.abs(a)<th)return;const s=Math.sign(a);
  if(p&&p.ax===ax&&p.s===-s&&now-p.t<450){GYRO.pk=null;if(now-GYRO.shakeT>700){GYRO.shakeT=now;if(inGame)gyroShake(p.t);else GYRO.shakes++;}return;}
  if(!p||p.ax!==ax||p.s!==s||now-p.t>450)GYRO.pk={ax,s,t:now};}
function gyroShake(t0){let dy=0,dp=0,dc=0,da=0,db=0,dox=0,doy=0;for(const h of GYRO.hist)if(h[0]>=t0-300){dy+=h[1];dp+=h[2];dc+=h[3];da+=h[4]||0;db+=h[5]||0;dox+=h[6]||0;doy+=h[7]||0;}
  P.yaw-=dy;P.pitch=clamp(P.pitch-dp,-1.45,1.45);GYRO.c-=dc;GYRO.ax-=da;GYRO.ay-=db;GYRO.ox-=dox;GYRO.oy-=doy;if(GYRO.ox*GYRO.ax<=0)GYRO.ox=0;if(GYRO.oy*GYRO.ay<=0)GYRO.oy=0;GYRO.hist=[];GYRO.shakes++;
  if(vmDual)return;ads=!ads;const b=$('tAds');if(b)b.classList.toggle('on',ads);try{navigator.vibrate&&navigator.vibrate(25);}catch(_){}}
function gyroSeen(now){GYRO.hzN++;if(now-GYRO.hzT>1000){GYRO.hz=Math.round(GYRO.hzN*1000/(now-GYRO.hzT));GYRO.hzN=0;GYRO.hzT=now;}if(!GYRO.ok){GYRO.ok=true;GYRO.status='ok';gyroLabel();}}
function onOrient(e){if(e.alpha==null&&e.beta==null&&e.gamma==null)return;
  const now=performance.now(),D=Math.PI/180,al=e.alpha||0,be=e.beta||0,ga=e.gamma||0;GYRO.raw.o=[al,be,ga];GYRO.src='orientamento';gyroSeen(now);
  GYRO.up=[-Math.cos(be*D)*Math.sin(ga*D),Math.sin(be*D),Math.cos(be*D)*Math.cos(ga*D)];/* "su" del mondo sugli assi del telefono */
  _gq.setFromEuler(_ge.set(be*D,ga*D,al*D,'ZXY'));/* telefono → mondo, ordine Z-X'-Y'' della specifica */
  const ts=e.timeStamp>0?e.timeStamp:now,q0=GYRO.q0,dt=(ts-(GYRO.lastOts||ts))/1000;GYRO.lastO=now;GYRO.lastOts=ts;if(!q0||now<GYRO.holdUntil){GYRO.q0=_gq.clone();return;}/* in pausa: si segue il telefono senza girare */
  _gd.copy(q0).conjugate().multiply(_gq);q0.copy(_gq);/* rotazione dall'ultima lettura, sugli assi del telefono */
  if(_gd.w<0)_gd.set(-_gd.x,-_gd.y,-_gd.z,-_gd.w);
  const s=Math.hypot(_gd.x,_gd.y,_gd.z),ang=2*Math.atan2(s,_gd.w);if(ang>.6||!(dt>0)||dt>.25)return;/* salto (pausa, bussola): si ignora */
  const f=s>1e-12?ang/s:2,h=Math.max(dt,.004),x=_gd.x*f,y=_gd.y*f,z=_gd.z*f;
  gyroLearn(x/h,y/h,z/h);gyroDev(x,y,z,h);}
function onMotion(e){const r=e.rotationRate;if(!r||(r.alpha==null&&r.beta==null&&r.gamma==null))return;
  const now=performance.now();let iv=e.interval>0?e.interval:0;if(iv>1)iv/=1000;/* la specifica dice ms, il vecchio Safari secondi */
  GYRO.raw.r=[r.alpha||0,r.beta||0,r.gamma||0];GYRO.raw.rt=now;GYRO.raw.iv=iv;const real=(now-GYRO.lastM)/1000;GYRO.lastM=now;
  {const A=e.acceleration;let v=null;/* accelerazione senza gravità; se manca la ricavo togliendo la gravità media */
    if(A&&A.x!=null)v=[A.x||0,A.y||0,A.z||0];
    else{const G=e.accelerationIncludingGravity;if(G&&G.x!=null){const gi=[G.x||0,G.y||0,G.z||0],g=GYRO.g||(GYRO.g=gi.slice());for(let i=0;i<3;i++)g[i]+=(gi[i]-g[i])*.1;v=gi.map((x,i)=>x-g[i]);}}
    if(v&&v.every(Number.isFinite)){GYRO.acc=Math.hypot(...v);gyroShakeSample(v,now);}}
  if(now-GYRO.lastO<300||now<GYRO.holdUntil)return;/* c'è l'orientamento: si usa quello (o il giroscopio è in pausa dopo un blocco) */
  GYRO.src='rotationRate';gyroSeen(now);const dt=iv>.003&&iv<.1?iv:real;if(!(dt>0)||dt>.1)return;
  const m=GYRO.map||W3C_MAP,v=GYRO.raw.r,k=(m.deg?Math.PI/180:1)*dt;
  gyroDev(v[m.o[0]]*m.s[0]*k,v[m.o[1]]*m.s[1]*k,v[m.o[2]]*m.s[2]*k,dt);}
function gyroLearn(wx,wy,wz){/* confronta la rotazione vera (dall'orientamento, rad/s) con l'ultimo rotationRate grezzo per scoprirne assi, segni e unità */
  const r=GYRO.raw.r;if(!r||performance.now()-GYRO.raw.rt>80||wx*wx+wy*wy+wz*wz<.04)return;const w=[wx,wy,wz];
  const L=GYRO.L||(GYRO.L={c:new Float64Array(9),e:new Float64Array(3),f:new Float64Array(3),n:0});
  for(let i=0;i<3;i++){L.e[i]=L.e[i]*.995+w[i]*w[i];L.f[i]=L.f[i]*.995+r[i]*r[i];for(let j=0;j<3;j++)L.c[i*3+j]=L.c[i*3+j]*.995+w[i]*r[j];}
  if(++L.n%10)return;const o=[],s=[];let sc=0;
  for(let i=0;i<3;i++){if(L.e[i]<8)return;let bj=0,b=0,b2=0;
    for(let j=0;j<3;j++){const c=Math.abs(L.c[i*3+j])/Math.sqrt(L.e[i]*L.f[j]+1e-12);if(c>b){b2=b;b=c;bj=j;}else if(c>b2)b2=c;}
    if(b<.7||b2>b*.6)return;o.push(bj);s.push(Math.sign(L.c[i*3+bj]));sc+=Math.abs(L.c[i*3+bj])/L.e[i];}
  if(new Set(o).size<3)return;const deg=sc/3>8,m=GYRO.map;
  if(!m||m.o+''!==o+''||m.s+''!==s+''||m.deg!==deg){GYRO.map={o,s,deg};saveGyro();}}
function gyroWhy(){if(GYRO.status==='blocked')return 'Giroscopio bloccato: dentro l\'app Claude il telefono non dà i sensori al gioco. Apri il gioco direttamente in Safari.';
  if(GYRO.status==='denied')return 'Giroscopio negato da Safari: chiudi la scheda, riaprila e alla domanda tocca <b>Consenti</b>.';
  if(GYRO.status==='nodata')return 'Nessun dato dal giroscopio: qui il browser non passa i sensori. Apri il gioco direttamente in Safari.';return '';}
function askMotion(){if(GYRO.asked)return;GYRO.asked=true;
  const add=()=>{if(!GYRO.listening){addEventListener('deviceorientation',onOrient);addEventListener('devicemotion',onMotion);GYRO.listening=true;}GYRO.status='ok';gyroLabel();
    setTimeout(()=>{if(!GYRO.ok){GYRO.status='nodata';gyroLabel();if(state==='playing'&&GYRO.mode!=='spento')showMsg(gyroWhy(),5);}},2500);};
  const no=()=>{GYRO.status=IN_FRAME?'blocked':'denied';GYRO.asked=false;gyroLabel();if(state==='playing'&&GYRO.mode!=='spento')showMsg(gyroWhy(),5);};
  try{const DO=window.DeviceOrientationEvent,DM=window.DeviceMotionEvent;if(!DO&&!DM){GYRO.status='nodata';gyroLabel();return;}
    /* su iPhone il permesso va chiesto toccando lo schermo; è uno solo per orientamento e movimento */
    const askO=!!DO&&typeof DO.requestPermission==='function',askM=!!DM&&typeof DM.requestPermission==='function';
    if(askO||askM)(askO?DO:DM).requestPermission().then(r=>{if(r!=='granted')return no();add();if(askO&&askM)DM.requestPermission().catch(()=>{});}).catch(()=>no());else add();}catch(_){no();}}
function gyroLabel(){const b=$('tGyro');if(!b)return;const bad=GYRO.status&&GYRO.status!=='ok';b.classList.toggle('off',GYRO.mode==='spento'||bad);
  b.querySelector('span').textContent=GYRO.status==='blocked'?'GIRO BLOCCATO':GYRO.status==='denied'?'GIRO NEGATO':GYRO.status==='nodata'?'GIRO NON DISP.':GYRO.mode==='sempre'?'GIRO':GYRO.mode==='mira'?'GIRO·MIRA':'GIRO OFF';}
function gyroCycle(){if(GYRO.status&&GYRO.status!=='ok'&&!GYRO.ok){GYRO.asked=false;askMotion();if(GYRO.status!=='ok')showMsg(gyroWhy(),5);return;}
  GYRO.mode=GYRO.mode==='sempre'?'mira':GYRO.mode==='mira'?'spento':'sempre';saveGyro();syncGyroUI();askMotion();}
function syncGyroUI(){$('gyroMode').value=GYRO.mode;$('gyroSens').value=GYRO.sens;$('gyroOut').textContent=GYRO.sens.toFixed(1);$('gyroInv').checked=GYRO.invY;$('gyroWheel').checked=GYRO.wheel;
  $('gyroEdgeOn').checked=GYRO.edge;$('gyroShakeOn').checked=GYRO.shake;$('gyroEdgeDeg').value=GYRO.edgeDeg;$('gyroShakeLv').value=GYRO.shakeLv;$('gyroAim').value=GYRO.aimMode;$('gyroAcc').value=GYRO.accel;$('gyroAccOut').textContent=GYRO.accel.toFixed(1);$('gyroEdgeOn').disabled=$('gyroEdgeDeg').disabled=GYRO.aimMode==='puntatore';$('gyroShakeLv').disabled=!GYRO.shake;
  $('gyroWall').value=GYRO.wall;$('gyroWallOut').textContent=GYRO.wall+'%';$('gyroWall').disabled=GYRO.aimMode!=='puntatore';edgeLabel();gyroLabel();}
function edgeLabel(){$('gyroEdgeOut').textContent=GYRO.edgeDeg+'°';$('gyroEdgeTxt').textContent=GYRO.edgeDeg;$('gyroEdgeDeg').disabled=$('gyroRec').disabled=!GYRO.edge||GYRO.aimMode==='puntatore';
  $('gyroRec').value=GYRO.rec;$('gyroRecOut').textContent=GYRO.rec>0?String(GYRO.rec).replace('.',',')+' s':'mai';}
$('gyroRec').addEventListener('input',e=>{GYRO.rec=clamp(parseFloat(e.target.value)||0,0,5);GYRO.stillT=0;edgeLabel();saveGyro();});
$('gyroEdgeOn').addEventListener('change',e=>{GYRO.edge=e.target.checked;GYRO.c=0;edgeLabel();saveGyro();});
$('gyroEdgeDeg').addEventListener('input',e=>{GYRO.edgeDeg=clamp(parseInt(e.target.value,10)||23,5,60);edgeLabel();saveGyro();});
$('gyroShakeOn').addEventListener('change',e=>{GYRO.shake=e.target.checked;$('gyroShakeLv').disabled=!GYRO.shake;saveGyro();});
$('gyroAim').addEventListener('change',e=>{GYRO.aimMode=e.target.value==='puntatore'?'puntatore':'visuale';GYRO.ax=GYRO.ay=GYRO.ox=GYRO.oy=0;GYRO.c=0;saveGyro();syncGyroUI();});
$('gyroWall').addEventListener('input',e=>{GYRO.wall=clamp(parseInt(e.target.value,10)||50,20,90);GYRO.ox=GYRO.oy=0;$('gyroWallOut').textContent=GYRO.wall+'%';saveGyro();});
$('gyroAcc').addEventListener('input',e=>{GYRO.accel=clamp(parseFloat(e.target.value)||0,0,3);$('gyroAccOut').textContent=GYRO.accel.toFixed(1);saveGyro();});
$('gyroShakeLv').addEventListener('change',e=>{GYRO.shakeLv=SHAKE_LV.includes(e.target.value)?e.target.value:'normale';saveGyro();});
$('gyroMode').addEventListener('change',e=>{GYRO.mode=e.target.value;saveGyro();gyroLabel();askMotion();});
$('gyroSens').addEventListener('input',e=>{GYRO.sens=parseFloat(e.target.value)||1.8;$('gyroOut').textContent=GYRO.sens.toFixed(1);saveGyro();});
$('gyroInv').addEventListener('change',e=>{GYRO.invY=e.target.checked;saveGyro();});
$('gyroWheel').addEventListener('change',e=>{GYRO.wheel=e.target.checked;saveGyro();});
syncGyroUI();
/* prova del giroscopio: valori grezzi dei sensori e risultato, per vedere subito se un asse va al contrario */
let gtTimer=0;
function gtOpen(){if(GYRO.status&&GYRO.status!=='ok'&&!GYRO.ok)GYRO.asked=false;askMotion();$('opts').hidden=true;$('gyroTest').hidden=false;GYRO.test.x=GYRO.test.y=0;clearInterval(gtTimer);gtTimer=setInterval(gtDraw,80);gtDraw();}
function gtClose(){clearInterval(gtTimer);$('gyroTest').hidden=true;$('opts').hidden=false;}
function gtDraw(){const f=(v,d=1)=>(v>=0?'+':'−')+Math.abs(v).toFixed(d),R=180/Math.PI,o=GYRO.raw.o,r=GYRO.raw.r,a=scrAngle(),m=GYRO.map,ax=['X','Y','Z'];
  const stale=performance.now()-Math.max(GYRO.lastO,GYRO.lastM)>500,v=stale?[0,0,0]:GYRO.rate;
  const mapS=m?['alpha','beta','gamma'].map((n,j)=>{const i=m.o.indexOf(j);return n+'='+(m.s[i]<0?'−':'')+ax[i];}).join(' ')+(m.deg?' in gradi/s':' in radianti/s'):'non ancora rilevati (muovi il telefono in tutte le direzioni)';
  $('gtOut').textContent=['Stato: '+(GYRO.ok&&!stale?'dati in arrivo':(gyroWhy().replace(/<[^>]+>/g,'')||'in attesa dei sensori…')),
    'Fonte: '+(GYRO.src||'—')+(GYRO.hz&&!stale?' · '+GYRO.hz+' letture/s':''),
    'Schermo: '+(a===0?'verticale':a===90?'orizzontale, in alto il fianco sinistro (90°)':a===270?'orizzontale, in alto il fianco destro (270°)':'capovolto')+(a&&GYRO.sideG?' · dalla gravità':a?' · dal sistema':''),
    'Sistema: window.orientation '+(typeof window.orientation==='number'?window.orientation:'—')+' · screen.orientation '+(screen.orientation&&typeof screen.orientation.angle==='number'?screen.orientation.angle:'—'),
    'Orientamento: '+(o?'α '+f(o[0])+'  β '+f(o[1])+'  γ '+f(o[2]):'—'),
    'rotationRate: '+(r?'α '+f(r[0])+'  β '+f(r[1])+'  γ '+f(r[2])+(GYRO.raw.iv?' · ogni '+(GYRO.raw.iv*1000).toFixed(0)+' ms':''):'—'),
    'Assi di rotationRate: '+mapS,
    'Adesso (°/s): su '+f(v[0]*R,0)+' · girarsi a destra '+f(-v[1]*R,0)+' · volante a destra '+f(-v[2]*R,0),
    `Colpo per il mirino: picco ${(GYRO.accMax||0).toFixed(1)} m/s² · serve ${SHAKE_TH[GYRO.shakeLv]||5.5} avanti e poi indietro · colpi riconosciuti ${GYRO.shakes}`,
    `Bordo: telefono girato di ${f(-GYRO.c*R,0)}° dal centro · soglia ${GYRO.edgeDeg}°`,
    `Ricentra da fermo: ${GYRO.rec>0?`fermo da ${GYRO.stillT.toFixed(1)} s su ${GYRO.rec} s · ricentrato ${GYRO.recN} volte`:'mai'}`].join('\n');GYRO.accMax=(GYRO.accMax||0)*.8;
  const d=$('gtDot');d.style.left=(50+GYRO.test.x/.6*46)+'%';d.style.top=(50-GYRO.test.y/.4*44)+'%';}
$('gyroTestBtn').addEventListener('click',gtOpen);$('gtClose').addEventListener('click',gtClose);
$('gtBox').addEventListener('click',()=>{GYRO.test.x=GYRO.test.y=0;gtDraw();});
tEl.addEventListener('touchstart',e=>{e.preventDefault();if(state!=='playing')return;for(const t of e.changedTouches){const b=t.target&&t.target.closest?t.target.closest('[data-t]'):null;
    if(b){TOUCH.btn.set(t.identifier,b);tBtnDown(b.dataset.t,b);if(b.dataset.t==='fire'){TOUCH.fire={id:t.identifier,x:t.clientX,y:t.clientY};}continue;}
    if(t.clientX<innerWidth*.45&&TOUCH.mv.id==null){TOUCH.mv={id:t.identifier,ox:t.clientX,oy:t.clientY,x:0,y:0,active:true};tStick.style.left=t.clientX+'px';tStick.style.top=t.clientY+'px';tStick.classList.add('on');tStick.firstElementChild.style.transform='';}
    else if(TOUCH.look.id==null)TOUCH.look={id:t.identifier,x:t.clientX,y:t.clientY};}},{passive:false});
tEl.addEventListener('touchmove',e=>{e.preventDefault();for(const t of e.changedTouches){
    if(t.identifier===TOUCH.mv.id){const R=52;let dx=(t.clientX-TOUCH.mv.ox)/R,dy=(t.clientY-TOUCH.mv.oy)/R;const m=Math.hypot(dx,dy);if(m>1){dx/=m;dy/=m;}TOUCH.mv.x=dx;TOUCH.mv.y=dy;
      TOUCH.sprint=m>1.25&&dy<-.6;tStick.firstElementChild.style.transform=`translate(${dx*R}px,${dy*R}px)`;}
    else if(t.identifier===TOUCH.look.id){tLook(t.clientX-TOUCH.look.x,t.clientY-TOUCH.look.y);TOUCH.look.x=t.clientX;TOUCH.look.y=t.clientY;}
    else if(t.identifier===TOUCH.fire.id){tLook(t.clientX-TOUCH.fire.x,t.clientY-TOUCH.fire.y);TOUCH.fire.x=t.clientX;TOUCH.fire.y=t.clientY;}}},{passive:false});
function tEnd(e){for(const t of e.changedTouches){const b=TOUCH.btn.get(t.identifier);if(b){TOUCH.btn.delete(t.identifier);tBtnUp(b.dataset.t,b);}
    if(t.identifier===TOUCH.mv.id){TOUCH.mv={x:0,y:0,active:false,id:null,ox:0,oy:0};TOUCH.sprint=false;tStick.classList.remove('on');}
    if(t.identifier===TOUCH.look.id)TOUCH.look.id=null;if(t.identifier===TOUCH.fire.id)TOUCH.fire.id=null;}}
tEl.addEventListener('touchend',e=>{e.preventDefault();tEnd(e);},{passive:false});tEl.addEventListener('touchcancel',tEnd);
document.addEventListener('gesturestart',e=>e.preventDefault());

function devEgg3(){const E=M.egg3;if(!Power.on)useInteract({t:'power'});
  switch(Q3.step){case 0:Q3.bells.forEach(b=>egg3Bell(b));break;case 1:useInteract({t:'bowpick'});break;
    case 2:Q3.skulls.forEach(s=>{if(s.st!=='held'){s.st='held';s.g.visible=false;Q3.held++;}});Q3.step=3;showMsg('Teschi 5/5 (sviluppatore)',1.5);break;
    case 3:if(!Q3.placed){Q3.held=5;useInteract({t:'ossario'});}Q3.fed=E.feed-1;egg3OnKill({x:Q3.altar.x,z:Q3.altar.z,h:Q3.altar.h});break;
    case 4:if(!Q3.hasKey)useInteract({t:'bonekey'});useInteract({t:'lift',L:Q3.up,to:Q3.down});startRide(Q3.down);break;
    case 5:{const o=Q3.order.slice(Q3.lit.length);o.forEach(s=>egg3Brazier(Q3.braziers.find(b=>b.sym===s)));break;}
    case 6:if(Q3.boss)killZombie(Q3.boss,true,'gun');else if(Q3.bossT>0)Q3.bossT=.01;break;
    case 7:Q3.heartHeld=true;Q3.heart.visible=false;if(!near(E.shrine.x,E.shrine.z,Q3.shrineH,2.7)){P.x=E.shrine.x-2.2;P.z=E.shrine.z;P.h=hAt(P.x,P.z);P.eyeH=P.h+1.62;}useInteract({t:'heart'});break;
    case 8:if(Q3.reward.visible)useInteract({t:'reward'});else Q3.rewardT=1.59;break;}
  showMsg('Terzo easter egg: passo '+Q3.step,1.2);}
/* ---------- scelta della mappa ---------- */
function selectMap(id){
  if(!MAPS[id])id='prigione';loadMap(id);placeBox(M.boxStart[0]);regionOpen=new Array(REG.length).fill(true);Q.keys=0;
  document.title=M.id==='prigione'?'Penitenziario Scoglio Nero':'Penitenziario Scoglio Nero · '+M.name;PLAN_L=0;
  {const pl=$('planLayers');pl.hidden=NL<2;pl.replaceChildren(...(NL>1?(M.layerNames||[]).map((n,l)=>{const b=document.createElement('button');b.type='button';b.textContent=n;b.dataset.pl=l;b.setAttribute('aria-pressed',String(l===0));return b;}):[]));}
  $('menuFolder').dataset.tab=M.tab;$('mapMeta').textContent=M.meta;$('mapTitle').textContent=M.name;$('mapDesc').textContent=M.desc;$('start').textContent=M.startLabel;
  document.querySelectorAll('#mapPick button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.map===id)));
  $('legend').innerHTML=`<span><i style="background:#a8261c"></i>Porta (costo)</span><span><i style="background:#8a6a3a"></i>Finestra con assi</span>`+
    (M.id!=='acciaieria'?`<span><i style="background:repeating-linear-gradient(90deg,#2b261e 0 2px,#e6ddc6 2px 4px)"></i>Sbarre</span><span><i style="background:#5f7f93"></i>Mare</span>`:`<span><i style="background:#d8662a"></i>Acciaio fuso</span>`)+(NL>1?`<span><i style="background:#e6ddc6;opacity:.45"></i>Piano di sotto</span>`:'')+
    `<span><i style="background:repeating-linear-gradient(0deg,#8f8466 0 2px,#e6ddc6 2px 4px)"></i>Scale</span><span><i style="background:linear-gradient(90deg,#ece4cf,#b9ab86)"></i>Più scuro = più alto</span>`;
  try{localStorage.setItem('scn-map',id);}catch(_){}drawPlan();
}
document.querySelectorAll('#mapPick button').forEach(b=>b.addEventListener('click',()=>{if(state==='menu')selectMap(b.dataset.map);}));
$('planLayers').addEventListener('click',e=>{const b=e.target.closest('[data-pl]');if(!b)return;PLAN_L=+b.dataset.pl;$('planLayers').querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));drawPlan();});
function drawPlan(){drawMap($('plancv'),PAPER,false);}
if(document.fonts&&document.fonts.ready)document.fonts.ready.then(()=>{drawPlan();redrawTextTextures();});
addEventListener('resize',()=>{if(state==='menu')drawPlan();});

/* =========================================================
   HUD E LOOP
   ========================================================= */
let lastT=performance.now(),fpsN=0,fpsT=0,fps=0;
function updateLights(dt,now){
  roomLights.forEach(r=>{if(Power.on)r.f=lerp(r.f,1.25,Math.min(1,dt*3));
    else{r.t-=dt;if(r.t<=0){r.t=rand(.04,.25);r.target=Math.random()<.08?rand(.05,.3):rand(.55,.85);}r.f=lerp(r.f,r.target||.7,Math.min(1,dt*18));}
    r.L.intensity=r.base*r.f;r.bulbMat.color.copy(r.col).multiplyScalar(clamp(r.f,.15,1.2));if(r.halo)r.halo.material.opacity=.5*clamp(r.f,0,1.1);});
  if(PIXL)TX.water.offset.set((now/60000)%1,(now/95000)%1);/* il mare scorre piano (normal map e colore usano le stesse coordinate) */
  if(Power.lever)Power.lever.rotation.x=lerp(Power.lever.rotation.x,Power.on?(Power.lvOn??.9):(Power.lvOff??-.5),Math.min(1,dt*6));/* la leva Meshy scatta in su */
  if(search){const a=now/5200;search.target.position.set(84+Math.cos(a)*9,0,38+Math.sin(a*1.3)*18);search.target.updateMatrixWorld();beam.position.copy(search.position);beam.lookAt(search.target.position);}
  if(crane){const a=now/9000;crane.position.x=83+Math.sin(a)*10;crane.trolley.position.z=Math.sin(a*1.7)*10;}
  if(M&&M.lava){TX.lava.offset.x=(now/40000)%1;TX.lava.offset.y=(now/65000)%1;}
  boomLight.intensity=Math.max(0,boomLight.intensity-dt*9);
}
const bump=(k,a,b)=>{if(k<=a||k>=b)return 0;const u=(k-a)/(b-a);return Math.min(1,u/.2,(1-u)/.2);};
const seg=(k,a,b)=>clamp((k-a)/(b-a),0,1),ease=t=>t*t*(3-2*t);
const BOW_HIP=new THREE.Vector3(-.11,-.08,-.5),laserDot=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex,color:0xff2a1a,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));laserDot.scale.setScalar(.07);laserDot.visible=false;scene.add(laserDot);
function animParts(U,k,kind){const Pp=U.parts||{};
  for(const n in Pp){const o=Pp[n];if(o.userData.base)o.position.copy(o.userData.base);o.rotation.set(0,0,0);o.visible=true;o.scale.setScalar(1);}
  if(k<0)return;const e=bump(k,0,1);let rx=.2*e,rz=.35*e,dy=-.04*e;
  const magT=()=>{const m=Pp.mag;if(!m)return;const b=m.userData.base;if(k<.3)m.position.y=b.y-.3*ease(seg(k,.1,.3));else if(k<.42)m.visible=false;else m.position.y=b.y-.3*(1-ease(seg(k,.42,.56)));};
  const foreTo=(t)=>{const f=Pp.foreArm,m=Pp.mag;if(!f||!m||t<=0)return;const b=f.userData.base,mb=m.userData.base;f.position.set(lerp(b.x,mb.x-.02,t),lerp(b.y,mb.y-.16,t),lerp(b.z,mb.z+.02,t));};
  switch(kind){
    case 'mag':case 'drum':magT();foreTo(bump(k,.12,.62)*.85);if(Pp.slide)Pp.slide.position.z+=.035*bump(k,.74,.88);break;
    case 'bolt':if(Pp.bolt){Pp.bolt.rotation.z=.9*bump(k,.05,.92);Pp.bolt.position.z+=.06*bump(k,.12,.86);}magT();foreTo(bump(k,.2,.66)*.8);rz=.25*e;break;
    case 'belt':if(Pp.lid)Pp.lid.rotation.x=-1.05*bump(k,.05,.9);magT();foreTo(bump(k,.2,.66)*.8);rz=.2*e;rx=.12*e;break;
    case 'cyl':if(Pp.cyl){const t=bump(k,.05,.85);Pp.cyl.position.x-=.05*t;Pp.cyl.rotation.z=.9*t;}rz=.55*e;rx=.3*e;break;
    case 'break':if(Pp.brl)Pp.brl.rotation.x=.62*bump(k,.05,.88);rx=-.1*e;rz=.2*e;foreTo(0);break;
    case 'shells':if(Pp.pump)Pp.pump.position.z+=.09*bump(k,.8,.93);rz=-.55*e;rx=.1*e;break;
    case 'cell':if(Pp.cell){const t=bump(k,.08,.62);Pp.cell.position.y-=.1*t;Pp.cell.scale.setScalar(1-.6*t);}rz=.3*e;break;}
  return {rx,rz,dy};}
function updateViewmodel(dt){
  const w=inv[cur],d=wd(w),U=vmGun.userData;const isBow=d.special==='bow';
  const base=vT.copy(isBow?BOW_HIP:W_HIP).lerp(ADS_POS,adsT);if(vmDual){base.set(0,-.2,-.47);U.guns.forEach((g,gi)=>{g.position.z=Math.max(0,g.position.z-dt*.5);const k=gi?'mL':'mR';const rk=dRl[k]>0?1-dRl[k]/dDur[k]:-1;const e=rk>=0?bump(rk,0,1):0;g.position.y=-.2*e;g.rotation.x=.9*e;g.rotation.z=(gi?-1:1)*.4*e;});}
  const sp=Math.hypot(P.vx,P.vz)/4.4,bobA=(1-adsT*.9)*Math.min(1,sp)*(P.grounded?1:.2);
  const st=1-adsT;let px=base.x+Math.cos(P.bob*.5)*.012*bobA*st+swayX*st,py=base.y+Math.abs(Math.sin(P.bob*.5))*.014*bobA*st+swayY*st,pz=base.z,rx=0,ry=0,rz=0;
  vmKick=Math.max(0,vmKick-dt*10);pz+=vmKick*.06*(1-adsT*.5);rx+=vmKick*.12*(1-adsT*.6);const sk=P.sprintK||0;py-=.05*sk;rx-=.25*sk;ry+=.5*sk;px-=.03*sk;
  if(!P.grounded){py+=clamp(-P.vy*.006,-.04,.04);}
  if(!vmDual){const r=animParts(U,reloadT>0?1-reloadT/reloadDur:-1,rlKind);if(r){rx+=r.rx;rz+=r.rz;py+=r.dy;}}
  if(isBow){setBowDraw(vmGun,bowDraw,w.mag>0&&reloadT<=0);pz+=bowDraw*.02*st;vmGun.rotation.z=.5*st;}
  if(switchT>0){const k=switchT/.42;py-=.25*k;rx+=.4*k;}if(knifeT>0||throwT>0){py-=.2;rx+=.35;}
  if(GYRO.ax||GYRO.ay){ry-=GYRO.ax*.55;rx+=GYRO.ay*.55;px+=Math.sin(GYRO.ax)*.07;py+=Math.sin(GYRO.ay)*.05;}/* l'arma punta verso il mirino libero */
  swayX*=Math.pow(.02,dt);swayY*=Math.pow(.02,dt);vmRoot.position.set(px,py,pz);vmRoot.rotation.set(rx,ry,rz);
  knifeM.visible=knifeT>0;swoosh.visible=knifeT>0;if(knifeT>0){const k=1-knifeT/.32,s=ease(Math.min(1,k/.75));knifeM.position.set(.36-.66*s,-.2+.06*Math.sin(k*Math.PI),-.42);knifeM.rotation.set(-.15,.75+.6*s,.35);
    swoosh.position.set(.02,-.1,-.4);swoosh.rotation.set(-.45,0,-.15);swoosh.material.opacity=.45*Math.sin(Math.min(1,k/.8)*Math.PI);}
  throwM.visible=throwT>0&&!P.toma;tomaVM.visible=throwT>0&&P.toma;if(throwT>0){const k=1-throwT/.35;throwM.position.set(.15-.1*k,-.15+.2*Math.sin(k*Math.PI),-.35-.3*k);tomaVM.position.set(.2-.15*k,-.1+.25*Math.sin(k*Math.PI),-.4-.3*k);tomaVM.rotation.set(-1.2+2.8*k,.3,0);}
  shieldVM.visible=shieldUp;vmRoot.visible=!shieldUp;if(shieldUp){const b=Math.sin(P.bob*.5)*.01;shieldVM.position.set(-.02+swayX,-.32+b+swayY,-.48);}
  if(flash.visible){U.muzzle.getWorldPosition(vT);flash.position.copy(vT);}
  const rb=regionAt(P.x,P.z,P.h);const rl=roomLights.find(r=>r.ri===rb);vmAmb.intensity=.28+(rl?.32*rl.f:REG[rb]?.out?.22:.18);
  vmCam.fov=55-adsT*6;vmCam.updateProjectionMatrix();
  if(U.laser&&!P.sprinting&&reloadT<=0){camera.getWorldPosition(vO);vD.set(.012,-.01,-1).normalize().applyQuaternion(aimQuat());const t=shotDist(vO,vD,40);laserDot.position.copy(vO).addScaledVector(vD,Math.max(.3,t-.03));laserDot.visible=true;}else laserDot.visible=false;
}
function updateHUD(dt){
  const w=inv[cur],d=wd(w);
  setText(H.points,'pts',DEV.on&&DEV.money?'∞':String(points));setText(H.wname,'wn',d.name);
  if(vmDual)dualFix(w);setHTML(H.ammo,'am',d.special==='none'?'—':w.forging?'<small>nella Forgia…</small>':DEV.on&&DEV.ammo?'∞':vmDual?`${w.mL} <small>sx</small> · ${w.mR} <small>dx / ${w.reserve}</small>`:`${w.mag} <small>/ ${w.reserve}</small>`);H.ammo.classList.toggle('low',w.mag<=Math.ceil(d.mag*.25));
  setHTML(H.nades,'nd',(P.toma?`<div>Tomahawk${TOMA.on?' · in volo':''}</div>`:`<div>Granate ${grenades}</div>`)+(carillons?`<div>Carillon ${carillons}</div>`:'')+(P.shield?`<div>Scudo ${'▮'.repeat(Math.ceil(P.shield.hp/2))}${'▯'.repeat(Math.ceil((SHIELD_HP-P.shield.hp)/2))}${shieldUp?' · alzato':''}</div>`:''));
  const scoped=d.scope&&adsT>.85;H.scope.style.opacity=scoped?1:0;
  H.xhair.style.setProperty('--g',Math.round(7+currentSpread()*420)+'px');{const q=(GYRO.ax||GYRO.ay)?gyroPtr():null,L=q?(50+q.x*50).toFixed(2)+'%':'50%',Tp=q?(50-q.y*50).toFixed(2)+'%':'50%';/* mirino libero */if(H.xhair.style.left!==L||H.xhair.style.top!==Tp){H.xhair.style.left=H.hitm.style.left=L;H.xhair.style.top=H.hitm.style.top=Tp;}}const adsOn=adsT>.35&&!scoped;H.xhair.classList.toggle('ads',adsOn);H.xhair.style.opacity=adsOn?1:(1-(P.sprintK||0)).toFixed(2);
  hurtFlash=Math.max(0,hurtFlash-dt*1.8);H.hurt.style.opacity=hurtFlash.toFixed(2);H.lowhp.style.opacity=(P.hp<P.maxHp*.55?(1-P.hp/P.maxHp):0).toFixed(2);
  if(hitmT>0){hitmT-=dt;if(hitmT<=0)H.hitm.classList.remove('show');}if(msgTimer>0){msgTimer-=dt;if(msgTimer<=0)H.top.classList.remove('show');}
  let pu='';if(instaT>0)pu+=`<div class="pup" style="color:#e9e3d1">Uccisione istantanea ${Math.ceil(instaT)}</div>`;if(doubleT>0)pu+=`<div class="pup" style="color:#ffc23a">Punti doppi ${Math.ceil(doubleT)}</div>`;setHTML(H.pups,'pu',pu);
  const it=findInteract();let pr=it?promptFor(it):'';if(Box.state==='rolling'&&near(Box.ix,Box.iz,Box.h,3))pr='La cassa sta scegliendo…';setHTML(H.prompt,'pr',pr);H.prompt.classList.toggle('show',!!pr);
  if(it&&it.t==='repair'&&kd('use')&&Math.abs(P.h-it.w.h)<1.3){repairT-=dt;if(repairT<=0){repairT=.5;const wd2=it.w;if(wd2.boards<6){setBoard(wd2,wd2.boards,true);wd2.boards++;wd2.repT=performance.now();netReq({t:'rep',w:wd2.i});Sfx.repair();if(repairPts<500){repairPts+=10;addPoints(10);}}}}else repairT=0;
  if(it&&it.t==='revive'&&kd('use')){NET.reviveT+=dt;if(NET.reviveT>=3){NET.reviveT=0;netDoRevive(it.p);}}else NET.reviveT=0;
  if(Q4)egg4Hold(it,dt);
  if(it&&it.t==='valve'&&kd('use')&&Power.on){Q.valveHold+=dt;it.v.wheel.rotation.z-=dt*3;if(Q.valveHold>=3){
      if(NET.client){it.v.done=true;Q.valveHold=0;netReq({t:'q',a:'valve',i:VALVES.indexOf(it.v)});}else valveDone(it.v);}}else Q.valveHold=0;/* online: la manopola girata la conferma l'host a tutti */
  let kh='';if(M.quest==='keys'&&Q.keys>0&&!Forge.unlocked)kh=`Chiavi della Forgia ${Q.keys}/3`;
  if(Q2&&Q2.held)kh=`Nuclei incandescenti ${Q2.held}`;if(Q2&&Q2.event)kh=`Ultima colata · ${Math.ceil(Q2.eventT)} s · ferro fuso ${Math.min(Q2.eventKills,M.egg2.need)}/${M.egg2.need}`;
  if(Q4){const L=[];if(!Q4.sb&&cnt(Q4.sp))L.push(`Scudo ${cnt(Q4.sp)}/3`);if(!Q4.pb&&cnt(Q4.pp))L.push(`Aereo ${cnt(Q4.pp)}/5`);if(!Q4.kb&&cnt(Q4.sk))L.push(`Teschi ${cnt(Q4.sk)}/3`);
    const fed=Q4.dogs.filter(d=>d.done).length;if(!Q4.tomaOn&&Q4.dogs.some(d=>d.fed))L.push(`Teste sazie ${fed}/3`);kh=L.join(' · ');}
  if(Q3){if(Q3.step===2)kh=`Teschi ${Q3.held}/5`;else if(Q3.step===3)kh=Q3.placed?`Anime all'ossario ${Q3.fed}/${M.egg3.feed}`:`Teschi 5/5 · portali all'ossario`;else if(Q3.step===6)kh=`Il Capomastro ${'█'.repeat(Math.ceil(Q3.bossHp*12))}${'░'.repeat(12-Math.ceil(Q3.bossHp*12))}`;else if(Q3.step===7&&Q3.heartHeld)kh="Cuore dell'altoforno";}
  if(P.bleed)kh=`A terra · ${Math.ceil(P.downT)} s · un compagno ti deve rialzare`;else if(P.dead)kh='Sei morto · rientri al prossimo round';
  H.keysHud.hidden=!kh;setText(H.keysHud,'kh',kh);
  const rbar=$('rbar');let rp=-1;if(reloadT>0&&reloadDur>0)rp=1-reloadT/reloadDur;else if(vmDual&&(dRl.mL>0||dRl.mR>0))rp=Math.min(dRl.mL>0?1-dRl.mL/dDur.mL:1,dRl.mR>0?1-dRl.mR/dDur.mR:1);
  if(rp>=0){rbar.hidden=false;rbar.firstElementChild.style.width=(100*rp).toFixed(1)+'%';}else if(!rbar.hidden)rbar.hidden=true;
  if(showDebug)setText(H.debug,'dbg',`${fps} fps · risoluzione ${Math.round(renderScale*100)}% · zombie vivi ${alive} · in arrivo ${toSpawn} · quota ${P.h.toFixed(1)} m`);
  if(showMap)drawMap(H.mapcv,NIGHT,true);
}
let rafId=0,errShown=false;
function showError(msg){const b=$('errbox');b.innerHTML=`<b>Qualcosa si è bloccato.</b><br>${msg}<br><small style="color:#a39f90">Ricarica la pagina. Se succede ancora, mandami questo messaggio.</small>`;b.hidden=false;H.hud.hidden=false;if(document.pointerLockElement)document.exitPointerLock();}
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();showError('La scheda grafica ha perso il contesto 3D.');});
function frame(now){rafId=requestAnimationFrame(frame);try{step(now);}catch(e){if(!errShown){errShown=true;console.error(e);showError(String(e&&e.message||e).replace(/[<>&]/g,''));}}}
function step(now){
  let dt=(now-lastT)/1000;lastT=now;if(dt<0)dt=0;fpsN++;fpsT+=dt;if(fpsT>=.5){fps=Math.round(fpsN/fpsT);fpsN=0;fpsT=0;}if(dt>.05)dt=.05;
  updateLights(dt,now);updateBox(dt);updateFly(dt);updateParticles(dt);updateFX(dt);updateBolts(dt);
  padTick(dt);const frozen=needLock&&canLock&&!NOLOCK&&!TOUCH.on&&!GP.on;/* col controller non serve catturare il mouse */if(TOUCH.on){const show=state==='playing'&&!GP.on;/* col controller collegato i comandi a schermo spariscono */if(tEl.hidden===show){tEl.hidden=!show;if(!show){TOUCH.mv={x:0,y:0,active:false,id:null,ox:0,oy:0};TOUCH.sprint=false;TOUCH.look.id=null;TOUCH.fire.id=null;TOUCH.btn.forEach(b=>b.classList.remove('on'));TOUCH.btn.clear();showMap=false;H.mapwrap.hidden=true;tStick.classList.remove('on');}}document.body.classList.toggle('playing',show);if(show){$('tLure').hidden=carillons<=0;{const sh=GYRO.shake&&performance.now()-GYRO.lastM<1500&&!vmDual,ta=$('tAds');/* col colpo per il mirino il tasto mira non serve (con le Vipere Gemelle sì: è la seconda pistola) */if(ta.hidden!==sh){ta.hidden=sh;if(sh)TOUCH.btn.forEach((b,id)=>{if(b===ta){tBtnUp('ads',ta);TOUCH.btn.delete(id);}});}}$('tLureN').textContent=carillons;$('tNadeN').textContent=P.toma?'∞':grenades;$('tNade').style.opacity=(P.toma?!TOMA.on:grenades>0)?1:.45;{const ts=$('tShield'),sv=!P.shield;if(ts.hidden!==sv)ts.hidden=sv;ts.classList.toggle('on',shieldUp);}const pu=!!H.prompt.classList.contains('show');if($('tUse').hidden===pu){$('tUse').hidden=!pu;if(!pu){$('tUse').classList.remove('on');TOUCH.btn.forEach((b,id)=>{if(b.id==='tUse'){releaseCode(BIND.use);TOUCH.btn.delete(id);}});}}}}if(frozen){trigger=false;ads=false;}
  // da soli tutto si ferma in pausa; online il mondo va avanti (lo fa girare l'host, gli altri seguono le sue istantanee)
  const live=state==='playing'&&!frozen,runWorld=NET.on?NET.started&&(state==='playing'||state==='paused'):live;
  if(live&&!P.dead){updatePlayer(dt);updateWeapon(dt);}gyroEdgeTick(dt);aimAssistTick(dt);
  if(runWorld){if(NET.client)netClientZombies(dt);else{updateZombies(dt);updateRound(dt);}updateDoors(dt);updatePowerups(dt);updateProjectiles(dt);updateVortexes(dt);updateForge(dt);
    updateEgg2(dt);updateEgg3(dt);updateEgg4(dt);if(instaT>0)instaT-=dt;if(doubleT>0)doubleT-=dt;}
  if(live){if(DEV.on&&DEV.god)P.hp=P.maxHp;updateHUD(dt);}
  netTick(dt,true);netAvatars(dt);vTick(dt);if(M.id==='cascate')townTick(dt,now);{const db=$('devBar'),sh=DEV.on&&state==='playing';if(db.hidden===sh)db.hidden=!sh;}
  if(![P.x,P.z,P.h,P.yaw,P.pitch,P.eyeH,P.vx,P.vz,P.vy].every(Number.isFinite)){P.x=START.x;P.z=START.z;P.h=hAt(P.x,P.z,START.y);P.eyeH=P.h+1.62;P.yaw=START.yaw;P.pitch=0;P.vx=P.vz=P.vy=0;P.grounded=true;}
  if(!Number.isFinite(recoilP))recoilP=0;
  const scoped=inv.length&&wd(inv[cur]).scope&&adsT>.85;
  if(state==='menu'){const c=M.menuCam,a=now/11000;camera.position.set(c.x+Math.sin(a)*c.swing,c.y,c.z);camera.rotation.set(.05,c.yaw+Math.sin(a*.7)*.9,0);}
  else{shakeT=Math.max(0,shakeT-dt);const sh=shakeT*.06;camera.position.set(P.x,P.eyeH+Math.sin(P.bob)*.035*Math.min(1,Math.hypot(P.vx,P.vz)/4.4)*(1-adsT*.7),P.z);
    camera.rotation.set(clamp(P.pitch+recoilP,-1.5,1.5)+rand(-sh,sh),P.yaw+rand(-sh,sh),P.downT>0?.35:0);const tf=scoped?24:72-adsT*20;if(Math.abs(camera.fov-tf)>.01){camera.fov=tf;camera.updateProjectionMatrix();}}
  if(inv.length)updateViewmodel(dt);
  muzzleLight.intensity=Math.max(0,muzzleLight.intensity-dt*40);muzzleLight.position.copy(camera.position);if(flash.visible&&muzzleLight.intensity<1.2)flash.visible=false;
  if(tracerT>0){tracerT-=dt;if(tracerT<=0)tracer.visible=false;}
  if(!window.__norender)renderFrame(state!=='menu'&&inv.length&&!scoped,now);
}
/*TESTHOOK*/
window.__scnStop=()=>{cancelAnimationFrame(rafId);try{renderer.dispose();}catch(_){}};
function boot(){resize();let id='prigione';try{id=localStorage.getItem('scn-map')||'prigione';}catch(_){}selectMap(id);inv=[{id:'serpe',mag:8,reserve:80}];equipModel();renderBinds();syncOptsUI();rafId=requestAnimationFrame(frame);netBoot();}
window.claude&&window.claude.hot&&window.claude.hot.ready?window.claude.hot.ready(boot):boot();
})();
