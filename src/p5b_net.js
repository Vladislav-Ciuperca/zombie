
/* =========================================================
   ONLINE: fino a 4 giocatori nella stessa lobby
   Nessun server nostro: i messaggi passano da un broker MQTT pubblico e gratuito (HiveMQ, riserva EMQX) via WebSocket.
   Chi crea la lobby è l'host: fa girare zombie, round, porte, corrente e cassa e manda lo stato agli altri 10 volte al secondo.
   Ognuno muove il proprio personaggio e spara in locale; i colpi vanno all'host, che toglie vita agli zombie e rimanda i punti.
   Ogni lobby è un messaggio "conservato" sul broker: chi apre il link la vede subito, e sparisce quando l'host esce
   (anche se chiude la pagina all'improvviso, grazie al "testamento" MQTT).
   ========================================================= */
const NETV=1,NET_MAX=4;
const BROKERS=['wss://broker.hivemq.com:8884/mqtt','wss://broker.emqx.io:8084/mqtt'];
// ogni sito (il link di Netlify) ha le sue lobby: chi apre lo stesso link si ritrova nello stesso spazio
const NET_SITE=(()=>{const s=location.host||'locale';let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(36);})();
const NB=`scn/${NETV}/${NET_SITE}`;
const BROKER_NAME=['HiveMQ','EMQX'];
// codice lobby: 6 caratteri senza quelli che si confondono (0/O, 1/I/L)
const CODE_ABC='abcdefghjkmnpqrstuvwxyz23456789';
const netCode=()=>{let s='';for(let i=0;i<6;i++)s+=CODE_ABC[(Math.random()*CODE_ABC.length)|0];return s;};
const NET={on:false,host:false,client:false,started:false,welcomed:false,me:netCode(),name:'',lid:null,hostName:'',slot:0,
  conns:BROKERS.map(()=>null),connP:BROKERS.map(()=>null),retryB:BROKERS.map(()=>3000),gb:0,replyB:new Set(),
  status:'off',err:'',lobbies:new Map(),peers:new Map(),roster:[],ev:[],q:[],shots:0,puId:0,credit:null,invite:'',inviteT:0,
  lastHost:0,joinT:0,infoT:0,snapN:0,evc:{},boxPend:0,reviveT:0,frameT:0,notice:'',teamK:''};
// link di invito: ...#lobby=CODICE porta dritto nella lobby
{const m=/(?:^#|&)lobby=([a-z0-9]{6})/i.exec(location.hash||'');if(m){NET.invite=m[1].toLowerCase();NET.inviteT=performance.now();}}
const AV_COL=[0xe8c46a,0x6fb3e0,0x8fd06a,0xe07a6f],AV_CSS=['#e8c46a','#6fb3e0','#8fd06a','#e07a6f'];
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fin=(v,d)=>{const n=+v;return v!=null&&v!==''&&Number.isFinite(n)?n:d;};
const r2=v=>Math.round(v*100)/100;
function cleanName(s){return String(s||'').replace(/[^\p{L}\p{N} _.'-]/gu,'').replace(/\s+/g,' ').trim().slice(0,16);}
try{NET.name=cleanName(localStorage.getItem('scn-name'));}catch(_){}
if(!NET.name)NET.name='Giocatore '+(100+Math.random()*900|0);

/* ---------- client MQTT 3.1.1 minimo su WebSocket (solo QoS 0) ---------- */
function mqttOpen(url,cid,willTopic,onMsg,onClose){
  const enc=new TextEncoder(),dec=new TextDecoder();
  const cat=(...a)=>{let n=0;for(const x of a)n+=x.length;const o=new Uint8Array(n);let i=0;for(const x of a){o.set(x,i);i+=x.length;}return o;};
  const str=s=>{const b=enc.encode(s);return cat(Uint8Array.of(b.length>>8,b.length&255),b);};
  const vlen=n=>{const o=[];do{let d=n%128;n=Math.floor(n/128);if(n>0)d|=128;o.push(d);}while(n>0);return Uint8Array.from(o);};
  const pkt=(h,body)=>cat(Uint8Array.of(h),vlen(body.length),body);
  return new Promise((res,rej)=>{
    let ws,buf=new Uint8Array(0),pid=1,alive=false,ping=0,lastIn=performance.now();
    try{ws=new WebSocket(url,['mqtt']);}catch(e){rej(e);return;}
    ws.binaryType='arraybuffer';
    const to=setTimeout(()=>{rej(new Error('il server non risponde'));try{ws.close();}catch(_){}},7000);
    const send=b=>{try{ws.send(b);return true;}catch(_){return false;}};
    const api={
      get ok(){return alive&&ws.readyState===1;},
      pub(t,s,retain){if(!api.ok||ws.bufferedAmount>4e5)return false;return send(pkt(0x30|(retain?1:0),cat(str(t),enc.encode(s))));},
      sub(...ts){if(!api.ok)return;const parts=[Uint8Array.of(pid>>8,pid&255)];pid=pid%65535+1;ts.forEach(t=>parts.push(str(t),Uint8Array.of(0)));send(pkt(0x82,cat(...parts)));},
      unsub(...ts){if(!api.ok)return;const parts=[Uint8Array.of(pid>>8,pid&255)];pid=pid%65535+1;ts.forEach(t=>parts.push(str(t)));send(pkt(0xA2,cat(...parts)));},
      close(){if(api.ok)send(Uint8Array.of(0xE0,0));alive=false;clearInterval(ping);try{ws.close();}catch(_){}}};
    // sessione pulita + testamento conservato e vuoto: se la connessione cade, il broker cancella la lobby di questo giocatore
    ws.onopen=()=>send(pkt(0x10,cat(Uint8Array.of(0,4,77,81,84,84,4,0x26,0,30),str(cid),str(willTopic),Uint8Array.of(0,0))));
    ws.onmessage=e=>{lastIn=performance.now();const d=new Uint8Array(e.data);buf=buf.length?cat(buf,d):d;
      for(;;){if(buf.length<2)return;let m=1,v=0,j=1,c;do{if(j>=buf.length)return;c=buf[j++];v+=(c&127)*m;m*=128;}while((c&128)&&j<5);
        if(buf.length<j+v)return;const h=buf[0],body=buf.subarray(j,j+v);buf=buf.subarray(j+v);const ty=h>>4;
        if(ty===2){clearTimeout(to);if(body[1]!==0){rej(new Error('rifiutato ('+body[1]+')'));try{ws.close();}catch(_){}return;}alive=true;
          ping=setInterval(()=>{if(performance.now()-lastIn>50000){api.close();onClose();return;}send(Uint8Array.of(0xC0,0));},15000);res(api);}
        else if(ty===3){const tl=(body[0]<<8)|body[1],q=(h>>1)&3;const t=dec.decode(body.subarray(2,2+tl));try{onMsg(t,dec.decode(body.subarray(2+tl+(q?2:0))),!!(h&1));}catch(err){console.warn(err);}}}};
    ws.onerror=()=>{};
    ws.onclose=()=>{clearTimeout(to);clearInterval(ping);const was=alive;alive=false;if(was)onClose();else rej(new Error('connessione chiusa'));};
  });
}

/* ---------- connessione e lobby ----------
   Ogni pagina si collega a TUTTI i server: se un telefono non ne raggiunge uno (rete diversa, porta bloccata)
   i due si trovano comunque sull'altro. L'host annuncia la lobby e ascolta i giocatori su tutti i server;
   ogni giocatore gioca su un server che ha in comune con l'host. */
const okConns=()=>NET.conns.map((c,i)=>c&&c.ok?i:-1).filter(i=>i>=0);
function netConnOne(i){if(NET.conns[i]&&NET.conns[i].ok)return Promise.resolve(true);if(NET.connP[i])return NET.connP[i];
  NET.connP[i]=mqttOpen(BROKERS[i],'scn'+NET.me,`${NB}/l/${NET.me}`,(t,s,r)=>netOnMsg(t,s,r,i),()=>netOnClose(i)).then(mq=>{
      NET.conns[i]=mq;NET.connP[i]=null;NET.retryB[i]=3000;mq.sub(`${NB}/l/+`,`${NB}/v/${NET.me}`);if(NET.host&&NET.on){mq.sub(`${NB}/c/${NET.lid}`);netLobbyInfo();}netStatus();return true;},
    e=>{NET.connP[i]=null;NET.err=String(e&&e.message||e);netStatus();netRetry(i);return false;});
  return NET.connP[i];}
function netRetry(i){setTimeout(()=>{if(!(NET.conns[i]&&NET.conns[i].ok))netConnOne(i);},NET.retryB[i]);NET.retryB[i]=Math.min(60000,NET.retryB[i]*2);}
function netStatus(){NET.status=okConns().length?'ok':NET.connP.some(Boolean)?'conn':'fail';netUI();}
// basta il primo server che risponde; gli altri continuano a collegarsi in sottofondo
function netConnect(){if(okConns().length)return Promise.resolve(true);if(!NET.connP.some(Boolean)){NET.status='conn';netUI();}
  const ps=BROKERS.map((_,i)=>netConnOne(i));return new Promise(res=>{let left=ps.length;ps.forEach(p=>p.then(ok=>{if(ok)res(true);else if(--left===0)res(false);}));});}
function netOnClose(i){NET.conns[i]=null;NET.err='connessione persa';
  if(NET.on&&((NET.client&&i===NET.gb)||(NET.host&&!okConns().length))){netLeave(true);netBackToMenu();netNotice('Connessione al server online persa');}
  netStatus();netRetry(i);}
const jparse=s=>{try{const o=JSON.parse(s);return o&&typeof o==='object'?o:null;}catch(_){return null;}};
function netOnMsg(topic,s,retained,bi){
  if(!topic.startsWith(NB+'/'))return;const k=topic.slice(NB.length+1),ty=k[0],id=k.slice(2);
  if(ty==='l'){if(!s){NET.lobbies.delete(id);
      // messaggio vuoto = il "testamento" di qualcuno che è caduto: se è l'host o un mio giocatore me ne accorgo subito
      if(NET.client&&id===NET.lid&&bi===NET.gb&&!NET.migr){netHostLost("L'host si è scollegato");return;}
      const p=NET.host&&NET.on?NET.peers.get(id):null;if(p&&p.bi===bi)netRemovePeer(p,'ha perso la connessione');
      netUI();return;}
    const o=jparse(s);if(!o||o.v!==NETV)return;
    const bs=Array.isArray(o.bs)?o.bs.filter(b=>Number.isInteger(b)&&b>=0&&b<BROKERS.length):[];if(!bs.includes(bi))bs.push(bi);
    NET.lobbies.set(id,{id,n:cleanName(o.n)||'?',m:MAPS[o.m]?o.m:'prigione',p:clamp(o.p|0,1,NET_MAX),s:o.s==='play'?'play':'wait',r:clamp(o.r|0,0,999),t:fin(o.t,0),bs,live:!retained,seen:performance.now()});netUI();return;}
  if(ty==='v'){if(id===NET.me&&NET.on)vMsg(jparse(s));return;}/* chat vocale: messaggi per me */
  if(!NET.on||id!==NET.lid)return;const o=jparse(s);if(!o)return;
  if(ty==='h'&&NET.client&&(bi===NET.gb||NET.migr))netFromHost(o,bi);else if(ty==='c'&&NET.host)netFromClient(o,bi);}
function netLobbyInfo(){if(!NET.host||!NET.on)return;NET.infoT=performance.now();const bs=okConns();
  const s=JSON.stringify({v:NETV,n:NET.name,m:M.id,p:1+NET.peers.size,s:NET.started&&state!=='dead'?'play':'wait',r:round,t:Date.now(),bs});
  bs.forEach(i=>NET.conns[i].pub(`${NB}/l/${NET.lid}`,s,true));}
function netLobbyList(){const now=Date.now(),pn=performance.now();
  return [...NET.lobbies.values()].filter(L=>L.id!==NET.me&&L.id!==NET.lid&&(L.live?pn-L.seen<45000:now-L.t<90000)).sort((a,b)=>b.t-a.t);}
// tocco su Entra / Crea / Inizia: è il momento giusto per audio, giroscopio e schermo intero (vogliono un gesto)
function netGesture(){Sfx.init();if(TOUCH.on){askMotion();goFull();}}
async function netCreate(){netGesture();if(!await netConnect()){netNotice('Server online non raggiungibile: riprova tra poco');return;}
  netLeave(true);Object.assign(NET,{on:true,host:true,client:false,started:false,welcomed:true,lid:NET.me,slot:0,hostName:NET.name,ev:[],q:[]});NET.peers.clear();NET.replyB.clear();
  okConns().forEach(i=>NET.conns[i].sub(`${NB}/c/${NET.lid}`));netLobbyInfo();netWake(true);showRoom();}
async function netJoin(lid){netGesture();if(!await netConnect())return;const L=NET.lobbies.get(lid);if(!L){netNotice('Nessuna lobby attiva con questo codice');return;}
  if(L.p>=NET_MAX){netNotice('La lobby è piena');return;}
  // un server che abbiamo in comune con l'host (prima HiveMQ); se non c'è ancora, provo a collegarmi a quelli dell'host
  let b=L.bs.find(i=>NET.conns[i]&&NET.conns[i].ok);
  if(b==null){await Promise.all(L.bs.map(netConnOne));b=L.bs.find(i=>NET.conns[i]&&NET.conns[i].ok);}
  if(b==null){netNotice('Non riesco a raggiungere il server della lobby: provate a collegarvi alla stessa rete Wi-Fi');return;}
  netLeave(true);Object.assign(NET,{on:true,host:false,client:true,started:false,welcomed:false,lid,gb:b,hostName:L.n,joinT:performance.now(),lastHost:performance.now(),ev:[],q:[],roster:[]});NET.peers.clear();
  if(NET.invite===lid){NET.invite='';try{history.replaceState(null,'',location.pathname+location.search);}catch(_){}}
  NET.conns[b].sub(`${NB}/h/${lid}`);netPub({t:'join',n:NET.name});netWake(true);showRoom();}
function netJoinCode(raw){const c=String(raw||'').toLowerCase().replace(/[^a-z0-9]/g,'');if(c.length!==6){netNotice('Il codice della lobby ha 6 caratteri');return;}
  if(c===NET.me){netNotice('Questa è la tua lobby');return;}$('net').hidden=true;netJoin(c);}
function netPub(o){const c=NET.conns[NET.gb];if(!c||!NET.lid)return;o.id=NET.me;c.pub(`${NB}/c/${NET.lid}`,JSON.stringify(o));}
function netLeave(silent){if(!NET.on)return;const lid=NET.lid;vStopAll();
  // se resta qualcuno, l'host passa la mano invece di chiudere la partita (mig)
  if(NET.host){const end=JSON.stringify({e:[{t:'end',mig:NET.peers.size?1:0}]});okConns().forEach(i=>{const c=NET.conns[i];c.pub(`${NB}/h/${lid}`,end);c.pub(`${NB}/l/${lid}`,'',true);c.unsub(`${NB}/c/${lid}`);});}
  else{const c=NET.conns[NET.gb];if(c&&c.ok){netPub({t:'leave'});c.unsub(`${NB}/h/${lid}`);}}
  NET.peers.forEach(p=>netDropAvatar(p));NET.peers.clear();NET.replyB.clear();
  Object.assign(NET,{on:false,host:false,client:false,started:false,welcomed:false,lid:null,ev:[],q:[],roster:[],credit:null,boxPend:0,reviveT:0,wakeWarned:false,migr:null});
  P.bleed=false;P.dead=false;Box.owner=null;$('room').hidden=true;$('team').hidden=true;NET.teamK='';netWake(false);if(!silent)netNotice('Sei uscito dalla partita online');netUI();}
addEventListener('pagehide',()=>{if(NET.on)netLeave(true);NET.conns.forEach(c=>c&&c.close());});
/* schermo sempre acceso mentre il gioco è attivo (da soli, in lobby, in partita online), su tutti i telefoni:
   se un telefono va in standby Safari sospende la pagina, e se è l'host scollega tutti gli altri.
   Usa la Screen Wake Lock API; il sistema la toglie quando la pagina va in secondo piano, quindi la richiedo di nuovo
   appena torna visibile, ogni 2 secondi se manca e a ogni tocco (alcuni browser la danno solo dopo un gesto). */
let wakeLock=null,wakeBusy=false,wakeFail=false;
function wakeWanted(){return document.visibilityState==='visible'&&(NET.on||state==='playing'||state==='paused');}
async function wakeSync(){if(wakeBusy)return;const want=wakeWanted();
  if(want&&!wakeLock){if(!navigator.wakeLock){wakeFail=true;return;}wakeBusy=true;
    try{const l=await navigator.wakeLock.request('screen');wakeLock=l;wakeFail=false;l.addEventListener('release',()=>{if(wakeLock===l)wakeLock=null;});}catch(_){wakeFail=true;}wakeBusy=false;}
  else if(!want&&wakeLock){const l=wakeLock;wakeLock=null;try{await l.release();}catch(_){}}
  if(NET.on&&!NET.started)roomUI();}
function netWake(){wakeSync();}
setInterval(wakeSync,2000);document.addEventListener('visibilitychange',wakeSync);
['touchend','click','keydown'].forEach(n=>addEventListener(n,()=>{if(!wakeLock&&wakeWanted())wakeSync();},{passive:true,capture:true}));
const wakeHelp=()=>IOS?'Impostazioni › Schermo e luminosità › Blocco automatico › Mai':'Impostazioni › Display › Spegnimento schermo: il tempo più lungo';
// invito da link: appena la lobby compare la mostro in cima; se dopo un po' non c'è, lo dico
function netInviteCheck(){if(!NET.invite||NET.on)return;if(NET.lobbies.has(NET.invite))return;
  if(NET.status==='ok'&&performance.now()-NET.inviteT>8000){NET.notice=`La lobby ${NET.invite.toUpperCase()} non è attiva: chiedi un nuovo invito`;NET.invite='';netUI();}}
function netInviteURL(){return location.origin+location.pathname+'#lobby='+NET.lid;}
async function netShare(){if(!NET.on)return;const url=netInviteURL(),text=`Giochiamo a Scoglio Nero: entra nella mia lobby (codice ${NET.lid.toUpperCase()})`;
  try{if(navigator.share){await navigator.share({title:'Penitenziario Scoglio Nero',text,url});return;}}catch(e){if(e&&e.name==='AbortError')return;}
  try{await navigator.clipboard.writeText(url);$('roomShareOut').textContent='Link copiato: incollalo nella chat con i tuoi amici';}catch(_){$('roomShareOut').textContent=url;}}
// uscita dalla lobby: torna sempre al menu, sia da una partita in corso sia dalla sala d'attesa
function netBackToMenu(){if(state!=='menu')toMenu();else{$('net').hidden=true;$('room').hidden=true;$('menu').hidden=false;netUI();}}
function netNotice(m){NET.notice=m;netUI();if(state==='playing')showMsg(esc(m),3);}
function netEv(e){if(NET.on&&NET.host)NET.ev.push(e);}
function netReq(a){if(NET.client&&NET.q.length<80)NET.q.push(a);}

/* ---------- stato del mondo (per chi entra e a ogni nuova partita) ---------- */
function netWorld(){return {m:M.id,r:round,ro:regionOpen.map(b=>b?1:0).join(''),d:DOORS.map(d=>d.open?1:0).join(''),pw:Power.on?1:0,fg:Forge.unlocked?1:0,
  bx:{s:Box.state,sp:Box.spot,w:Box.weapon||null,o:Box.owner||null,v:Box.g.visible?1:0},wb:WINDOWS.map(w=>w.boards).join(''),it:Math.ceil(instaT),dp:Math.ceil(doubleT),
  pu:powerups.filter(p=>p.k!=='core').map(p=>[p.id,p.k,r2(p.x),r2(p.z),r2(p.h),Math.ceil(p.t)]),co:powerups.filter(p=>p.k==='core').map(p=>[p.id,r2(p.x),r2(p.z),r2(p.h)]),q:netQuest()};}
function netStartLocal(W){if(!W||!MAPS[W.m])return;if(M.id!==W.m)selectMap(W.m);$('room').hidden=true;startGame();netApplyWorld(W);}
function netApplyWorld(W){round=W.r|0;H.round.textContent=round||'';netRegions(W.ro);netDoors(W.d);if(W.pw&&!Power.on)powerOn(true);if(W.fg)unlockForge(true);
  if(W.bx)netBoxApply(W.bx,true);if(typeof W.wb==='string')netBoards(W.wb,true);
  if(Array.isArray(W.pu))W.pu.forEach(a=>Array.isArray(a)&&netPuAdd({id:a[0],k:a[1],x:a[2],z:a[3],h:a[4],tt:a[5]}));instaT=fin(W.it,0);doubleT=fin(W.dp,0);
  if(Array.isArray(W.co))W.co.forEach(a=>Array.isArray(a)&&netCoreAdd({id:a[0],x:a[1],z:a[2],h:a[3]}));if(W.q)netQuestApply(W.q);}

/* ---------- missioni (easter egg) condivise ----------
   Le porta avanti l'host; agli altri manda lo stato (netQuest) dentro le istantanee quando cambia, e loro lo applicano
   agli oggetti del mondo. Le azioni dei giocatori (manopole, chiavi, colpi, ossario, crogiolo…) arrivano come {t:'q'}. */
const SK_ST=['wall','fall','ground','held'];
function netQuest(){const o={k:Q.keys|0,kg:KEYOBJ.map(k=>k.got?1:0).join(''),v:Q.valves|0,vd:VALVES.map(v=>v.done?1:0).join(''),f:Q.feed|0,l:Q.lit?1:0};
  if(Q2)o.q2=[Q2.step,Q2.lamps.map(l=>l.shot?1:0).join(''),Q2.held|0,Q2.dropped|0,Q2.deposited|0,Q2.event?1:0,Math.ceil(Q2.eventT||0),Q2.eventKills|0,Q2.done?1:0,Q2.elixir.visible?1:0];
  if(Q3)o.q3={s:Q3.step,b:Q3.bells.map(b=>b.rung?1:0).join(''),rt:Math.ceil(Q3.ringT||0),sk:Q3.skulls.map(s=>[SK_ST.indexOf(s.st),r2(s.x),r2(s.y),r2(s.z)]),h:Q3.held|0,
    pl:Q3.placed?1:0,fd:Q3.fed|0,hk:Q3.hasKey?1:0,kv:Q3.altar.key.visible?1:0,lo:Q3.liftOn?1:0,o:Q3.order.join(''),li:Q3.braziers.map(b=>b.lit?1:0).join(''),
    lio:Q3.lit.map(b=>Q3.braziers.indexOf(b)).join(','),bh:r2(Q3.bossHp||0),hh:Q3.heartHeld?1:0,hp:Q3.heartPos?[r2(Q3.heartPos.x),r2(Q3.heartPos.z),r2(Q3.heartPos.h)]:null,
    hv:Q3.heart.visible?1:0,rv:Q3.reward.visible?1:0,dn:Q3.done?1:0,au:Q3.aurora?[Q3.aurora.mag|0,Q3.aurora.reserve|0,Q3.aurora.pap?1:0]:null};
  if(Q4)o.q4=[Q4.sp.join(''),Q4.sb?1:0,Q4.pp.join(''),Q4.pb?1:0,Q4.sk.join(''),Q4.kb?1:0,Q4.dogs.map(d=>d.fed).join(','),Q4.tomaOn?1:0];
  return o;}
function netQuestApply(o){if(!o||typeof o!=='object')return;
  Q.keys=o.k|0;if(typeof o.kg==='string')KEYOBJ.forEach((k,i)=>{const g=o.kg[i]==='1';k.got=g;k.g.visible=!g;});
  Q.valves=o.v|0;if(typeof o.vd==='string')VALVES.forEach((v,i)=>{v.done=o.vd[i]==='1';});Q.feed=o.f|0;Q.lit=!!o.l;
  if(Q2&&Array.isArray(o.q2)){const a=o.q2;Q2.step=a[0]|0;const ls=String(a[1]||'');
    Q2.lamps.forEach((l,i)=>{const s=ls[i]==='1';if(s!==l.shot||Q2.step!==1){l.shot=s;l.mat.color.set(s?0x3cff6a:Q2.step===0?0x2a0808:0xff1a0a);}});
    Q2.held=a[2]|0;Q2.dropped=a[3]|0;Q2.deposited=a[4]|0;Q2.event=!!a[5];Q2.eventT=fin(a[6],0);Q2.eventKills=a[7]|0;Q2.done=!!a[8];Q2.elixir.visible=!!a[9];Q2.lever.rotation.x=(Q2.event||Q2.step>=5)?.9:0;}
  if(Q3&&o.q3&&typeof o.q3==='object'){const q=o.q3,prev=Q3.step;Q3.step=q.s|0;if(Q3.step===8&&prev!==8)Q3.rewardT=0;if(Q3.step>=6&&prev<6)Q3.lidT=0;
    const br=String(q.b||'');Q3.bells.forEach((b,i)=>b.rung=br[i]==='1');Q3.ringT=fin(q.rt,0);
    if(Array.isArray(q.sk))Q3.skulls.forEach((s,i)=>{const e=q.sk[i];if(!Array.isArray(e))return;const st=SK_ST[e[0]]||'wall';
      if(st==='fall'&&s.st==='wall'){s.st='fall';s.vy=1.5;}
      else if(st==='ground'&&s.st==='wall'){/* chi entra dopo: il teschio è già a terra (se sta cadendo, atterra da solo) */s.st='ground';s.x=fin(e[1],s.x);s.z=fin(e[3],s.z);s.h=hAt(s.x,s.z);s.y=s.h+.2;s.g.position.set(s.x,s.y,s.z);s.g.visible=true;}
      else if(st==='held'&&s.st!=='held'){s.st='held';s.g.visible=false;}});
    Q3.held=q.h|0;if(!!q.pl!==Q3.placed){Q3.placed=!!q.pl;Q3.altar.spikes.forEach(s=>s.visible=Q3.placed);}Q3.fed=q.fd|0;Q3.hasKey=!!q.hk;Q3.altar.key.visible=!!q.kv;Q3.liftOn=!!q.lo;
    if(typeof q.o==='string'&&q.o.length===Q3.order.length&&q.o!==Q3.order.join('')){Q3.order=[...q.o].map(Number);redrawSymbols(Q3.order);}
    const li=String(q.li||'');Q3.braziers.forEach((b,i)=>b.lit=li[i]==='1');Q3.lit=String(q.lio||'').split(',').filter(Boolean).map(Number).map(i=>Q3.braziers[i]).filter(Boolean);
    Q3.bossHp=fin(q.bh,0);Q3.heartHeld=!!q.hh;if(Array.isArray(q.hp))Q3.heartPos={x:fin(q.hp[0],0),z:fin(q.hp[1],0),h:fin(q.hp[2],0)};if(Q3.step!==8)Q3.heart.visible=!!q.hv;
    const rv=!!q.rv;if(rv!==Q3.reward.visible){Q3.reward.visible=rv;if(!rv)Q3.rewardLight.intensity=0;}
    Q3.done=!!q.dn;Q3.aurora=Array.isArray(q.au)?{mag:q.au[0]|0,reserve:q.au[1]|0,pap:!!q.au[2]}:null;}
  if(Q4&&Array.isArray(o.q4)){const a=o.q4,bits=(s,n)=>Array.from({length:n},(_,i)=>String(s||'')[i]==='1'?1:0);
    Q4.sp=bits(a[0],3);Q4.sb=!!a[1];Q4.pp=bits(a[2],5);Q4.pb=!!a[3];Q4.sk=bits(a[4],3);Q4.kb=!!a[5];
    String(a[6]||'').split(',').forEach((f,i)=>{const d=Q4.dogs[i];if(d){d.fed=clamp(f|0,0,99);d.done=d.fed>=M.egg4.dogNeed;}});Q4.tomaOn=!!a[7];egg4Sync();}}
function netCoreAdd(e){if(powerups.some(p=>p.id===e.id))return;const x=fin(e.x,0),z=fin(e.z,0),h=fin(e.h,0);powerups.push({k:'core',s:coreMesh(x,h,z),t:40,x,z,h,id:e.id});}
function netCoreDel(id){const i=powerups.findIndex(p=>p.k==='core'&&p.id===id);if(i>=0){scene.remove(powerups[i].s);powerups.splice(i,1);}}
function netQuestAction(p,a){const n=esc(p.n);switch(a.a){
  case 'key':{const k=KEYOBJ[a.i|0];if(k&&!k.got)useInteract({t:'key',k});break;}
  case 'valve':{const v=VALVES[a.i|0];if(v&&!v.done&&Power.on)valveDone(v);break;}
  case 'hit':{const i=a.i|0;
    if(a.k==='lamp'&&Q2&&Q2.step===1){const L=Q2.lamps[i];if(L&&!L.shot){L.shot=true;L.mat.color.set(0x3cff6a);egg2Lamp();}}
    else if(a.k==='bell'&&Q3&&Q3.bells[i])egg3Bell(Q3.bells[i]);else if(a.k==='skull'&&Q3&&Q3.skulls[i])egg3Skull(Q3.skulls[i],false);
    else if(a.k==='brazier'&&Q3&&Q3.braziers[i])egg3Brazier(Q3.braziers[i]);break;}
  case 'bowpick':if(Q3&&Q3.step===1){Q3.step=2;qSfx('power');qMsg(`${n} ha preso l'Arco di Brace`,2.4);}break;
  case 'ossario':if(Q3&&Q3.step===3&&!Q3.placed&&Q3.held>=5)useInteract({t:'ossario'});break;
  case 'bonekey':if(Q3&&Q3.step===4&&!Q3.hasKey&&Q3.altar.key.visible)useInteract({t:'bonekey'});break;
  case 'lift':if(Q3&&!Q3.liftOn&&Q3.hasKey)useInteract({t:'lift'});break;
  case 'heart':if(Q3&&Q3.step===7&&Q3.heartHeld)useInteract({t:'heart'});break;
  case 'reward':if(Q3&&Q3.step===8&&Q3.reward.visible){Q3.reward.visible=false;Q3.done=true;Q3.step=9;qSfx('power');qMsg(`${n} ha preso l'Aurora`,3);}break;
  case 'takeAur':if(Q3&&Q3.aurora){Q3.aurora=null;Q3.reward.visible=false;Q3.rewardLight.intensity=0;}break;
  case 'storeAur':if(Q3&&Q3.done&&!Q3.aurora)storeAurora({mag:clamp(a.m|0,0,999),reserve:clamp(a.r|0,0,9999),pap:!!a.pp});break;
  case 'crucible':if(Q2&&Q2.step>=3&&!Q2.done)egg2Use();break;
  case 'r_part':{const i=a.i|0;if(Q4&&P4K[a.k]&&i>=0&&i<P4MAX[a.k])egg4Part(a.k,i,p.n);break;}
  case 'r_build':if(Q4&&['scudo','acido','aereo'].includes(a.w))egg4Build(a.w,p.n);break;
  case 'r_open':{const r=a.r|0;if(r>=0&&r<REG.length&&!regionOpen[r]){openRegion(r);computeFlow();}break;}
  case 'elixir':if(Q2&&Q2.elixir.visible){Q2.done=true;Q2.elixir.visible=false;qSfx('drink');qMsg(`${n} ha bevuto l'elisir d'acciaio<small>nessun limite alle bevande, per tutta la partita</small>`,3.5);}break;
}}
// messaggi delle missioni ricevuti dalla rete: solo testo, tranne <small>
const qClean=m=>String(m).slice(0,240).replace(/<(?!\/?small>)[^>]*>?/g,'');
const SFX_OK=new Set(['soul','ossa','power','bell','pup','roundStart','door','hiss','arrowHit','zap','drink','buy','lift']);
function netRegions(s){if(typeof s!=='string')return;for(let i=0;i<regionOpen.length&&i<s.length;i++)regionOpen[i]=s[i]==='1';}
function netDoors(s){if(typeof s!=='string')return;DOORS.forEach((d,i)=>{const o=s[i]==='1';if(o&&!d.open){d.open=true;d.anim=1;doorPose(d);}
  else if(!o&&d.open){d.open=false;d.anim=0;doorPose(d);}});}
function netBoards(s,silent){const now=performance.now();WINDOWS.forEach((w,i)=>{const n=clamp(+s[i]|0,0,6);if(w.repT&&now-w.repT<800)return;
  while(w.boards>n){w.boards--;setBoard(w,w.boards,false);if(!silent){flyBoard(w,w.boards);if(Math.hypot(w.cx-P.x,w.cz-P.z)<30)Sfx.board(clamp(((w.cx-P.x)*Math.cos(P.yaw)-(w.cz-P.z)*Math.sin(P.yaw))/10,-1,1));}}
  while(w.boards<n){setBoard(w,w.boards,true);w.boards++;}});}

/* ---------- host: messaggi dei giocatori ---------- */
function netFromClient(o,bi){const id=typeof o.id==='string'?o.id.slice(0,12):'';if(!id||id===NET.me)return;const now=performance.now();let p=NET.peers.get(id);
  if(p)p.bi=bi;/* gli rispondo sul server da cui scrive */
  if(o.t==='join'){if(!p){if(NET.peers.size>=NET_MAX-1){NET.replyB.add(bi);netEv({t:'full',to:id});return;}const used=new Set([0,...[...NET.peers.values()].map(q=>q.slot)]);
      let sl=o.sl|0;if(!(sl>=1&&sl<=3)||used.has(sl)){sl=1;while(used.has(sl))sl++;}/* dopo un cambio di host ognuno tiene il suo posto (e il suo colore) */
      p={id,n:cleanName(o.n)||'Giocatore',slot:sl,last:now,s:null,pend:0,pk:0,ph:0,bi};NET.peers.set(id,p);netEv({t:'note',m:`${p.n} è entrato`});if(state==='playing')showMsg(`${esc(p.n)} è entrato nella partita`,2.4);}
    p.last=now;netEv({t:'welcome',to:id,sl:p.slot,hn:NET.name,st:NET.started&&state!=='dead'?1:0,w:netWorld()});netLobbyInfo();roomUI();return;}
  if(!p)return;p.last=now;
  if(o.t==='leave'){netRemovePeer(p,'è uscito');return;}
  if(o.t==='s'){p.s=netCleanState(o,p);if(Array.isArray(o.q))o.q.slice(0,80).forEach(a=>netAction(p,a));}}
function netCleanState(o,p){const s=p.s||{};return {id:p.id,n:p.n,sl:p.slot,x:clamp(fin(o.x,s.x||0),0,GW),z:clamp(fin(o.z,s.z||0),0,GH),h:clamp(fin(o.h,s.h||0),-10,80),y:fin(o.y,s.y||0),
  p:clamp(fin(o.p,0),-1.6,1.6),w:WEAPONS[o.w]?o.w:'serpe',pp:o.pp?1:0,dn:o.dn===1||o.dn===2?o.dn:0,pt:fin(o.pt,0)|0,sh:fin(o.sh,0)|0};}
function netRemovePeer(p,why){netDropAvatar(p);NET.peers.delete(p.id);netEv({t:'note',m:`${p.n} ${why}`});if(state==='playing')showMsg(`${esc(p.n)} ${why}`,2.4);
  if(Box.owner===p.id&&Box.state==='ready'){Box.state='closing';Box.t=0;netBox();}netLobbyInfo();roomUI();}
const NET_SRC=new Set(['gun','knife','arrow','nade','zap','web','vortex','toma','acid']);
function netAction(p,a){if(!a||typeof a!=='object')return;switch(a.t){
  case 'hit':{const z=zombies[a.z|0];if(!z||!z.active||z.state==='dying')return;NET.credit=p;
    try{damageZombie(z,clamp(fin(a.d,0),0,2e5),a.p==='head'?'head':'body',NET_SRC.has(a.s)?a.s:'gun',{leg:clamp(fin(a.l,0),0,2e5),splash:!!a.sp,fx:p.s?p.s.x:undefined,fz:p.s?p.s.z:undefined});}finally{NET.credit=null;}break;}
  case 'door':{const d=DOORS[a.d|0];if(d&&!d.open)openDoor(d);break;}
  case 'trap':{const T=TRAPS[a.i|0];if(T&&T.cd<=0&&T.d.open&&Power.on)trapActivate(T,p);break;}
  case 'power':if(!Power.on)powerOn();break;
  case 'rep':{const w=WINDOWS[a.w|0];if(w&&w.boards<6){setBoard(w,w.boards,true);w.boards++;}break;}
  case 'boxroll':if(Box.state==='idle'&&Box.g.visible)boxRoll(p.id);else p.pend+=BOX_COST;break;
  case 'boxtake':if(Box.state==='ready'&&Box.owner===p.id){Box.state='closing';Box.t=0;netBox();}break;
  case 'lure':{const x=fin(a.x,NaN),z=fin(a.z,NaN);if(Number.isFinite(x)&&Number.isFinite(z)){lure={x,z,h:fin(a.h,0),t:7,remote:true};computeFlow();}break;}
  case 'vortex':{const d=wd({id:WEAPONS[a.w]?a.w:'vortice',pap:!!a.pp});if(d.special!=='vortex')return;spawnVortex(new THREE.Vector3(fin(a.x,0),fin(a.y,0),fin(a.z,0)),d);vortexes[vortexes.length-1].owner=p;break;}
  case 'revive':netRevive(String(a.who||''),p.n);break;
  case 'q':netQuestAction(p,a);break;
  case 'putake':{const q=powerups.find(o=>o.id===a.id&&o.k!=='core'&&o.t>0);if(q){applyPowerup(q.k);q.t=0;netEv({t:'pu',id:q.id,k:q.k,by:p.n});}break;}/* il tomahawk di un compagno ha preso un power-up */
  case 'fx':{const e={t:'fx',x:fin(a.x,0),y:fin(a.y,0),z:fin(a.z,0),s:clamp(fin(a.s,1),.2,3),from:p.id};netEv(e);netFxLocal(e);break;}
}}
/* ---------- passaggio dell'host ----------
   Se l'host esce (o cade), chi resta continua la partita. Tutti calcolano lo stesso elenco: i giocatori rimasti in ordine
   di posto; il primo diventa host e trasforma le sue copie del mondo in mondo vero (netAdoptWorld), gli altri rientrano da lui
   senza ricominciare. Se il primo non risponde entro 8 s si passa al secondo, e così via. */
function netSuccessors(){const L=[{id:NET.me,sl:NET.slot,n:NET.name}];
  if(NET.started)NET.peers.forEach(p=>{if(p.id!==NET.lid)L.push({id:p.id,sl:p.slot,n:p.n});});
  else(NET.roster||[]).forEach(o=>{if(o.id&&o.id!==NET.lid&&o.id!==NET.me)L.push({id:o.id,sl:o.sl,n:o.n});});
  return L.sort((a,b)=>a.sl-b.sl||(a.id<b.id?-1:1));}
function netHostLost(why){if(!NET.client||NET.migr)return;NET.migr={list:netSuccessors(),i:0,old:NET.hostName,why,t:0};netMigrateNext();}
function netMigrateNext(){const m=NET.migr;if(!m)return;
  // se un candidato prima di questo ha già aperto la sua lobby, vado da lui (evita due host contemporanei)
  for(let j=0;j<m.i;j++){const c=m.list[j];if(c.id!==NET.me&&NET.lobbies.has(c.id)){m.i=j;break;}}
  const c=m.list[m.i];
  if(!c){netLeave(true);netBackToMenu();netNotice(`${m.why}: nessuno può prendere il suo posto`);return;}
  if(c.id===NET.me){netBecomeHost();return;}
  okConns().forEach(i=>NET.conns[i].unsub(`${NB}/h/${NET.lid}`));
  NET.lid=c.id;NET.hostName=c.n;NET.welcomed=false;m.t=performance.now();NET.lastHost=m.t;NET.q=[];
  okConns().forEach(i=>NET.conns[i].sub(`${NB}/h/${c.id}`));netMigJoin();
  if(state==='playing'||state==='paused')showMsg(`${esc(m.old)} è uscito<small>${esc(c.n)} prende il suo posto…</small>`,3);else roomUI();}
// la richiesta va ripetuta: il nuovo host può non essere ancora in ascolto quando arriva la prima
function netMigJoin(){const m=NET.migr;if(!m)return;m.rt=performance.now();const j=JSON.stringify({t:'join',n:NET.name,sl:NET.slot,mig:1,id:NET.me});
  okConns().forEach(i=>NET.conns[i].pub(`${NB}/c/${NET.lid}`,j));}
function netBecomeHost(){const m=NET.migr;NET.migr=null;okConns().forEach(i=>NET.conns[i].unsub(`${NB}/h/${NET.lid}`));
  NET.peers.forEach(p=>netDropAvatar(p));NET.peers.clear();
  Object.assign(NET,{host:true,client:false,welcomed:true,lid:NET.me,slot:0,hostName:NET.name,ev:[],q:[],grace:performance.now()+9000});NET.replyB.clear();
  okConns().forEach(i=>NET.conns[i].sub(`${NB}/c/${NET.lid}`));
  if(NET.started)netAdoptWorld();netLobbyInfo();roomUI();
  if(state==='dead'){$('again').hidden=false;$('again').textContent='Nuova partita per tutti';$('overNote').hidden=true;}
  if(state==='playing'||state==='paused')showMsg(`Sei il nuovo host<small>${esc(m?m.old:'')} è uscito: la partita continua da te</small>`,3.5);}
// le copie degli zombie diventano zombie veri; quelli ancora fuori dalle finestre tornano in coda e rientrano
function netAdoptWorld(){let back=0;alive=0;
  zombies.forEach(z=>{if(!z.active||z.state==='dying')return;
    if(['approach','window','scale','climb'].includes(z.state)){z.active=false;z.g.visible=false;back++;return;}
    if(z.nx!=null){z.x=z.nx;z.z=z.nz;z.h=z.nh;}if(z.state==='rise'){z.state='chase';z.h=hAt(z.x,z.z,z.h+1.9);}
    const mh=z.boss?20000+round*1100:z.fond?Math.round((hpFor(round)*3+1500)*.65):hpFor(round);
    Object.assign(z,{hp:Math.min(z.nhp||mh,mh*3),maxHp:mh,speed:z.nspd||(z.type==='sprint'?3.8:z.type==='run'?2.4:1.1),attDmgMul:1,cd:0,attackT:0,stagger:0,flinch:0,win:null,lane:null,
      avoid:[],navC:-1,navT:0,stuckT:0,lostT:0,orbit:null,orbitN:0,freeT:0,knock:null,stunT:0,slamCD:4,slam:false,scaled:false,stepU:0,climbRX:0,vel:0});alive++;});
  toSpawn=(NET.lastTs|0)+back;spawnT=1;pupDrops=0;if(toSpawn===0&&alive===0)betweenT=6;
  if(Q3)Q3.boss=zombies.find(z=>z.active&&z.boss&&z.state!=='dying')||null;
  if(Q2){fondRound=Q2.step>=2?1:0;if(Q2.event){Q2.closed=DOORS.filter(d=>(REG[d.a]&&REG[d.a].k==='e')||(REG[d.b]&&REG[d.b].k==='e'));Q2.closed.forEach(d=>d.wasOpen=true);}}
  NET.puId=powerups.reduce((a,p)=>Math.max(a,p.id|0),NET.puId)+1;lure=null;Box.willMove=false;computeFlow();lastPCell=-1;}
function netRevive(who,by){if(who===NET.me){riseUp(by);return;}if(NET.host&&NET.peers.has(who))netEv({t:'revived',to:who,by});}

/* ---------- host: bersagli degli zombie (tutti i giocatori in piedi) e colpi ai giocatori lontani ---------- */
function netTargets(){const T=[];if(!P.bleed&&!P.dead)T.push(P);
  if(NET.on&&NET.host&&NET.started)NET.peers.forEach(p=>{const s=p.s;if(s&&s.dn===0)T.push(s);});
  if(!T.length)T.push(P);return T;}
function netNearDist(x,z){let d=1e9;for(const t of netTargets())d=Math.min(d,Math.hypot(t.x-x,t.z-z));return d;}
function netHurtNear(x,z,h,r,dmg,ex,knock){if(!NET.on||!NET.host)return;NET.peers.forEach(p=>{const s=p.s;if(!s||s.dn!==0)return;const d=Math.hypot(s.x-x,s.z-z);if(d>=r||Math.abs(s.h-h)>=(ex?2:1.3))return;
  const e={t:'hurt',to:p.id,d:Math.round(typeof dmg==='function'?dmg(d):dmg),x:r2(x),z:r2(z),ex:ex?1:0};if(knock){const l=d||1;e.kx=r2((s.x-x)/l*knock);e.kz=r2((s.z-z)/l*knock);}netEv(e);});}
// colpo a un solo compagno (zombie aggressivo che gli passa addosso)
function netHurtOne(s,dmg,x,z){if(!NET.on||!NET.host||!s||!s.id||s.dn!==0)return;netEv({t:'hurt',to:s.id,d:Math.round(dmg),x:r2(x),z:r2(z),ex:0});}
function netCheckWipe(){if(!(P.bleed||P.dead)||performance.now()<(NET.grace||0))return;/* subito dopo un cambio di host i compagni stanno ancora rientrando */for(const p of NET.peers.values())if(!p.s||p.s.dn===0)return;netEv({t:'over',r:round});gameOver();netLobbyInfo();}

/* ---------- a terra in coop: un compagno ti rialza, se nessuno arriva in 30 s sei fuori fino al prossimo round ---------- */
function netGoDown(){P.bleed=true;P.downT=30;downWeapon();P.hp=1;invulnT=1;perks.clear();applyPerks();P.hp=1;updatePerkIcons();trigger=false;ads=false;Sfx.down();
  showMsg('Sei a terra<small>un compagno può rialzarti tenendo premuto USA vicino a te</small>',4);canvas.style.filter='grayscale(.85) brightness(.75)';}
function netBleedOut(){P.bleed=false;P.dead=true;P.downT=0;trigger=false;ads=false;canvas.style.filter='grayscale(1) brightness(.5)';Sfx.roar(.4);
  showMsg('Sei morto<small>rientri in gioco al prossimo round</small>',4);}
function netRespawn(){if(!P.dead)return;P.dead=false;P.bleed=false;P.downT=0;P.x=START.x;P.z=START.z;P.h=hAt(P.x,P.z,START.y);P.eyeH=P.h+1.62;P.vx=P.vz=P.vy=0;P.grounded=true;
  P.hp=P.maxHp;invulnT=2;canvas.style.filter='';inv=[{id:'serpe',mag:8,reserve:80}];cur=0;reloadT=0;equipModel();showMsg('Sei di nuovo in gioco',2.4);}
function netDoRevive(p){if(NET.host)netRevive(p.id,NET.name);else netReq({t:'revive',who:p.id});Sfx.buy();showMsg(`Hai rialzato ${esc(p.n)}`,2);}

/* ---------- host: cassa misteriosa condivisa ---------- */
function boxRoll(owner){Box.state='rolling';Box.t=0;Box.swapT=0;Box.uses++;Box.willMove=Box.uses>=Box.moveAfter&&(Math.random()<.45||Box.uses>=Box.moveAfter+3);Box.owner=owner;Sfx.jingle();netBox();}
function netBox(){netEv({t:'box',s:Box.state,sp:Box.spot,w:Box.weapon||null,o:Box.owner||null,v:Box.g.visible?1:0});}
function netBoxRefund(){if(NET.on&&Box.owner&&Box.owner!==NET.me){const p=NET.peers.get(Box.owner);if(p)p.pend+=BOX_COST;}else{points+=BOX_COST;popup('+'+BOX_COST);}}
const BOX_ST=['idle','rolling','ready','closing','leaving','gone'];
function netBoxApply(e,silent){const sp=e.sp|0;if(BOX_SPOTS[sp]&&sp!==Box.spot)placeBox(sp);
  const prev=Box.state;Box.owner=typeof e.o==='string'?e.o:null;Box.weapon=e.w&&Box.models[e.w]?e.w:null;Box.state=BOX_ST.includes(e.s)?e.s:'idle';if(prev!==Box.state)Box.t=0;
  Box.g.visible=e.v!==0;Object.keys(Box.models).forEach(n=>Box.models[n].visible=false);Box.doll.visible=Box.state==='leaving';
  if(Box.state==='ready'&&Box.weapon){Box.models[Box.weapon].visible=true;Box.models[Box.weapon].position.y=1.55;}
  if(Box.state==='idle'||Box.state==='gone')Box.g.position.y=Box.y0;
  if(silent||prev===Box.state)return;
  if(Box.state==='rolling'){Box.swapT=0;NET.boxPend=0;if(Math.hypot(P.x-Box.cx,P.z-Box.cz)<25)Sfx.jingle();}
  else if(Box.state==='leaving'){Box.doll.position.y=1.35;Sfx.laugh();showMsg('La cassa se ne va…'+(Box.owner===NET.me?'<small>punti restituiti</small>':''),2.5);}
  else if(Box.state==='idle'&&prev==='gone')showMsg(`La cassa è ricomparsa<small>${BOX_SPOTS[Box.spot].name}</small>`,2.5);}

/* ---------- power-up condivisi: li prende uno, valgono per tutti ---------- */
function puSprite(k,x,z,h){const s=new THREE.Sprite(new THREE.SpriteMaterial({map:puTex[k],transparent:true}));s.scale.setScalar(.75);s.position.set(x,h+1,z);scene.add(s);return s;}
function netPuAdd(e){if(!PU[e.k]||powerups.some(p=>p.id===e.id))return;const x=fin(e.x,0),z=fin(e.z,0),h=fin(e.h,0);powerups.push({k:e.k,s:puSprite(e.k,x,z,h),t:clamp(fin(e.tt,25),1,30),x,z,h,id:e.id});}
function netPuTake(e){const p=powerups.find(q=>q.id===e.id);if(p)p.t=0;if(PU[e.k]){applyPowerup(e.k);if(e.by&&e.by!==NET.name)H.top.insertAdjacentHTML('beforeend',`<small>preso da ${esc(cleanName(e.by))}</small>`);}}

/* ---------- effetti visti da tutti ---------- */
function netFx(x,y,z,s){const e={t:'fx',x:r2(x),y:r2(y),z:r2(z),s:r2(s||1)};if(NET.host)netEv({...e,from:NET.me});else netReq(e);}
function netFxLocal(e){fxExplosion(e.x,e.y,e.z,e.s);Sfx.boom(Math.hypot(P.x-e.x,P.z-e.z));}

/* ---------- istantanea dell'host, 10 volte al secondo ---------- */
const ZST={approach:0,window:1,scale:2,climb:3,rise:4,chase:5,dying:6},ZST_N=['approach','window','scale','climb','rise','chase','dying'],ATT_N=['double','swipe','frenzy','grab'];
const ATT_OF={double:'walk',swipe:'run',frenzy:'sprint',grab:'grab'};
function netMe(){const w=inv[cur];return {id:NET.me,n:NET.name,sl:NET.slot,x:r2(P.x),z:r2(P.z),h:r2(P.h),y:r2(P.yaw),p:r2(P.pitch),w:w?w.id:'serpe',pp:w&&w.pap?1:0,dn:P.dead?2:P.bleed?1:0,pt:points,sh:NET.shots};}
function netSnap(){const Z=[];
  for(let i=0;i<zombies.length;i++){const z=zombies[i];if(!z.active)continue;const st=ZST[z.state]??5;
    const f=(z.crawl?1:0)|(z.fond?2:0)|(z.boss?4:0)|(z.moving?8:0)|(z.B.head.scale.x<.01?16:0)|(z.webT>0?32:0)|(z.vanish?64:0)|(z.fall>0?128:0)|((z.type==='run'?1:z.type==='sprint'?2:0)<<8)|(z.enraged?1024:0)|(z.stumT>0?2048:0);
    const aux=st===3?Math.round((z.climbU||0)*1000):st===4?Math.round((z.riseT||0)*100):st===6?Math.round((z.deathT||0)*100):0;
    const att=z.attackT>0?(Math.max(0,ATT_N.indexOf(z.attStyle))+1)*10000+Math.round(clamp(1-z.attackT/z.attDur,0,1)*1000)*2+(z.swipeSide>0?1:0):0;
    // vita e velocità servono a chi diventa host se l'host esce
    Z.push([i,r2(z.x),r2(z.z),r2(z.h+(z.knock?z.knock.y:0)),r2(z.yaw),st,f,aux,Math.round(z.g.scale.x*100),att,Math.max(1,Math.round(z.hp)),Math.round((z.speed||1)*100)]);}
  const S={z:Z,p:[netMe()],wb:WINDOWS.map(w=>w.boards).join(''),n:toSpawn+alive,ts:toSpawn};NET.peers.forEach(p=>{if(p.s)S.p.push(p.s);});
  if(++NET.snapN%10===0){S.ro=regionOpen.map(b=>b?1:0).join('');S.d=DOORS.map(d=>d.open?1:0).join('');S.r=round;}
  const qo=netQuest(),qs=JSON.stringify(qo);if(qs!==NET.qsLast||NET.snapN%30===0){S.q=qo;NET.qsLast=qs;}/* missioni: solo quando cambiano (e ogni 3 s) */
  return S;}
function netRoster(){return {m:M.id,p:[{n:NET.name,sl:0,id:NET.me}].concat([...NET.peers.values()].map(p=>({n:p.n,sl:p.slot,id:p.id})))};}

/* ---------- giocatore: messaggi dell'host ---------- */
function netFromHost(o,bi){
  if(NET.migr){/* aspetto il nuovo host: accetto solo il suo benvenuto, da qualunque server arrivi */
    const w=Array.isArray(o.e)&&o.e.find(e=>e&&e.t==='welcome'&&e.to===NET.me);if(!w)return;
    NET.gb=bi;okConns().forEach(i=>{if(i!==bi)NET.conns[i].unsub(`${NB}/h/${NET.lid}`);});}
  NET.lastHost=performance.now();
  if(Array.isArray(o.e))for(const e of o.e){if(!e||typeof e!=='object'||(e.to&&e.to!==NET.me)||(e.from&&e.from===NET.me))continue;netEvent(e);if(!NET.on)return;}
  if(o.R&&!NET.started)netRosterApply(o.R);
  if(o.S&&NET.welcomed&&NET.started)netApplySnap(o.S);}
function netEvent(e){NET.evc[e.t]=(NET.evc[e.t]||0)+1;/* contatore per i test */switch(e.t){
  case 'welcome':{if(NET.welcomed&&!NET.migr)break;/* doppione (la richiesta di rientro viene ripetuta): già dentro */
    const mig=NET.migr;NET.migr=null;NET.welcomed=true;NET.slot=clamp(e.sl|0,1,3);NET.hostName=cleanName(e.hn)||NET.hostName;
    if(e.st&&e.w){if(mig&&NET.started&&state!=='menu'){netApplyWorld(e.w);NET.lastHost=performance.now();showMsg(`${esc(NET.hostName)} è il nuovo host<small>la partita continua</small>`,2.6);}/* cambio di host: niente ripartenza */
      else{NET.started=true;netStartLocal(e.w);}}
    else if(state!=='dead'){NET.started=false;if(e.w&&MAPS[e.w.m]&&M.id!==e.w.m)selectMap(e.w.m);roomUI();}break;}
  case 'full':netLeave(true);netBackToMenu();netNotice('La lobby è piena: massimo 4 giocatori');break;
  case 'start':if(!e.w)return;NET.started=true;netStartLocal(e.w);break;
  case 'map':if(MAPS[e.m]&&M.id!==e.m&&!NET.started)selectMap(e.m);roomUI();break;
  case 'end':if(e.mig){netHostLost("L'host è uscito");break;}netLeave(true);netBackToMenu();netNotice("L'host ha chiuso la partita");break;
  case 'qm':showMsg(qClean(e.m),clamp(fin(e.d,2.5),.5,6));break;
  case 'sfx':if(SFX_OK.has(e.n))Sfx[e.n]();break;
  case 'soul':soulFx(fin(e.x,0),fin(e.y,0),fin(e.z,0),fin(e.tx,0),fin(e.tz,0),e.c===1?1:0);break;
  case 'bell':{const b=Q3&&Q3.bells[e.i|0];if(b){b.swing=1;Sfx.bell();}break;}
  case 'core+':netCoreAdd(e);break;
  case 'core-':netCoreDel(e.id);break;
  case 'note':if(state==='playing')showMsg(esc(String(e.m).slice(0,60)),2.4);break;
  case 'round':roundLocal(clamp(e.r|0,1,999),clamp(e.n|0,0,999));break;
  case 'rend':roundEndLocal(clamp(e.r|0,0,999));break;
  case 'door':{const d=DOORS[e.d|0];if(d&&!d.open)openDoor(d);break;}
  case 'trap':{const T=TRAPS[e.i|0];if(T&&!(T.t>0)){T.t=TRAP_ON;T.cd=TRAP_ON+TRAP_CD;Sfx.power();}break;}
  case 'power':if(!Power.on)powerOn();break;
  case 'forge':unlockForge();break;
  case 'box':netBoxApply(e,false);break;
  case 'pu+':netPuAdd(e);break;
  case 'pu':netPuTake(e);break;
  case 'pts':{const v=fin(e.v,0)|0;points+=v;earned+=v;if(v)popup((v>0?'+':'')+v,v<0);kills+=clamp(e.k|0,0,99);heads+=clamp(e.h|0,0,99);break;}
  case 'hurt':hurtPlayer(clamp(fin(e.d,0),0,300),e.x==null?null:fin(e.x,null),e.z==null?null:fin(e.z,null),!!e.ex);
    if(e.kx!=null&&!P.dead){P.vx+=clamp(fin(e.kx,0),-9,9);P.vz+=clamp(fin(e.kz,0),-9,9);if(P.grounded){P.vy=4;P.grounded=false;P.airMax=P.h;}}break;
  case 'revived':if(P.bleed)riseUp(cleanName(e.by));break;
  case 'over':gameOver();break;
  case 'fx':netFxLocal({x:fin(e.x,0),y:fin(e.y,0),z:fin(e.z,0),s:clamp(fin(e.s,1),.2,3)});break;
}}
function netRosterApply(R){if(MAPS[R.m]&&M.id!==R.m)selectMap(R.m);
  NET.roster=Array.isArray(R.p)?R.p.slice(0,NET_MAX).map(o=>({n:cleanName(o&&o.n)||'?',sl:clamp(o&&o.sl|0,0,3),id:o&&typeof o.id==='string'?o.id.slice(0,12):''})):[];roomUI();}
function netApplySnap(S){const seen=new Uint8Array(zombies.length);
  if(Array.isArray(S.z))for(const a of S.z){if(!Array.isArray(a))continue;const i=a[0]|0,z=zombies[i];if(!z)continue;seen[i]=1;netZombie(z,a);}
  zombies.forEach((z,i)=>{if(z.active&&!seen[i]&&z.state!=='dying'){z.active=false;z.g.visible=false;}});
  if(typeof S.wb==='string')netBoards(S.wb,false);if(S.ro)netRegions(S.ro);if(S.d)netDoors(S.d);
  if(S.r!=null&&(S.r|0)!==round&&(S.r|0)>0){round=S.r|0;H.round.textContent=round;}
  NET.lastTs=clamp(S.ts|0,0,999);if(S.q)netQuestApply(S.q);
  if(Array.isArray(S.p))netPlayers(S.p);}
function netZombie(z,a){const x=+a[1],zz=+a[2],h=+a[3],yaw=+a[4],st=a[5]|0,f=a[6]|0,aux=a[7]|0,sc=a[8]|0,att=a[9]|0;if(![x,zz,h,yaw].every(Number.isFinite))return;
  const state=ZST_N[st]||'chase';z.nhp=clamp(a[10]|0,1,1e6);z.nspd=clamp((a[11]|0)/100,.2,9);z.enraged=!!(f&1024);if((f&2048)&&!(z.stumT>0))z.stumT=.55;
  if(!z.active||(z.state==='dying'&&state!=='dying')){/* nuovo zombie (o lo stesso posto riusato per uno nuovo) */z.active=true;z.g.visible=true;z.x=x;z.z=zz;z.h=h;z.yaw=yaw;z.t=Math.random()*10;z.phase=Math.random()*6;z.deathT=0;z.flinch=0;z.twitch=0;z.knock=null;z.attackT=0;z.gaitAmp=0;
    z.style={hunch:rand(.18,.45),tilt:rand(-.35,.35),limp:pick([-1,0,1,1,-1]),arms:pick([0,0,1,1,2]),seed:rand(0,10),twitchRate:rand(.05,.35)};z.bones.forEach(b=>b.scale.setScalar(1));
    z.body.rotation.set(0,0,0);z.crawl=false;z.vanish=false;z.groanT=rand(1,5);z.dressed=null;z.state=state==='dying'?'chase':state;z.g.position.set(x,h,zz);z.g.rotation.y=yaw;}/* subito al suo posto, non dove era morto */
  z.fond=!!(f&2);z.boss=!!(f&4);if(z.dressed!==(z.fond||z.boss)){z.dressed=z.fond||z.boss;dressZombie(z);}
  if(z.state!=='dying'){const s=clamp(sc/100,.5,3);if(Math.abs(z.g.scale.x-s)>.01)z.g.scale.setScalar(s);if(z.boss)z.B.head.scale.setScalar(1.5);else if(z.fond)z.B.head.scale.setScalar(1.4);}
  if((f&1)&&!z.crawl){z.crawl=true;z.B.knL.scale.setScalar(.001);z.B.knR.scale.setScalar(.001);z.B.hipL.scale.set(1,.42,1);z.B.hipR.scale.set(1,.42,1);}
  const ty=(f>>8)&3;z.type=ty===1?'run':ty===2?'sprint':'walk';z.webT=(f&32)?1:0;z.webS.visible=!!(f&32);
  if(state==='dying'){if(z.state!=='dying'){z.state='dying';z.deathT=aux/100;z.attackT=0;z.fall=(f&128)?1:-1;z.vanish=!!(f&64);
      if(f&16){z.B.head.scale.setScalar(.001);emit({x:z.x,y:z.h+1.7,z:z.z},24,.55,.03,.02,2.2,1.4);}else if(!z.vanish&&Math.hypot(z.x-P.x,z.z-P.z)<30){const a=sndAt(z.x,z.h+1,z.z);Sfx.die(a.d,a.pan,a.oc);}}return;}
  // scavalcamento: lo calcolo qui con lo stesso percorso dell'host (climbPose), andando avanti da solo tra un'istantanea e l'altra;
  // dall'host prendo solo la finestra e l'avanzamento, e correggo se mi discosto troppo (prima la posa saltava 10 volte al secondo)
  if(state==='climb'){const hu=aux/1000;if(z.state!=='climb'||!z.cw){let bw=null,bd=1e9;for(const w of WINDOWS){const d=Math.hypot(w.cx-x,w.cz-zz);if(d<bd){bd=d;bw=w;}}
      z.cw=bw;z.clo=bw?(x-bw.cx)*(bw.nz?1:0)+(zz-bw.cz)*(bw.nx?1:0):0;z.climbU=hu;}
    else if(Math.abs(hu-z.climbU)>.18)z.climbU=hu;}
  else z.cw=null;
  if(state==='rise'&&(z.state!=='rise'||Math.abs(aux/100-(z.riseT||0))>.25))z.riseT=aux/100;
  z.state=state;z.nx=x;z.nz=zz;z.nh=h;z.nyaw=yaw;
  if(att){const sty=ATT_N[((att/10000)|0)-1]||'double',k=((att%10000)>>1)/1000,A=ATTACKS[ATT_OF[sty]];
    if(!(z.attackT>0)||z.attStyle!==sty||Math.abs((1-z.attackT/z.attDur)-k)>.25){z.attStyle=sty;z.attDur=A.dur;z.attStrike=A.strike;z.attackT=A.dur*(1-k);z.swipeSide=(att&1)?1:-1;}}}
// zombie dei giocatori: seguono l'istantanea con un po' di morbidezza e si animano da soli
function netClientZombies(dt){const k=1-Math.exp(-dt*12);
  for(const z of zombies){if(!z.active)continue;z.t+=dt;
    if(z.state==='dying'){z.deathT+=dt;if(z.vanish){z.g.scale.setScalar(Math.max(.01,1-z.deathT*2.5));if(z.deathT>.4){z.active=false;z.g.visible=false;}continue;}
      z.g.position.set(z.x,z.deathT>2.2?z.h-(z.deathT-2.2)*.6:z.h,z.z);if(z.deathT>3.4){z.active=false;z.g.visible=false;}poseZombie(z,dt);continue;}
    const ox=z.x,oz=z.z;
    if(z.state==='climb'&&z.cw){const w=z.cw;z.climbU=Math.min(1,(z.climbU||0)+dt/CLIMB_DUR(z));const c=climbPose(w,z.climbU,z.clo||0,0,z.crawl);
      z.x=c[0];z.z=c[1];z.h=c[2];z.climbRX=c[3];z.yaw=Math.atan2(-w.nx,-w.nz);}
    else if(z.nx!=null){const dx=z.nx-z.x,dz=z.nz-z.z;if(dx*dx+dz*dz>9){z.x=z.nx;z.z=z.nz;z.h=z.nh;}else{z.x+=dx*k;z.z+=dz*k;z.h+=(z.nh-z.h)*k;}z.yaw=turn(z.yaw,z.nyaw,k*1.5);}
    if(z.attackT>0)z.attackT-=dt;if(z.stumT>0)z.stumT-=dt;if(z.state==='rise')z.riseT=(z.riseT||0)+dt;
    const mv=Math.hypot(z.x-ox,z.z-oz);if(z.state==='chase'||z.state==='approach'){z.moving=mv>dt*.15;z.phase+=mv*Math.PI*2/(z.crawl?.9:GAIT[z.type].D*z.g.scale.x);}
    z.g.position.set(z.x,z.h,z.z);z.g.rotation.y=z.yaw;poseZombie(z,dt);
    z.groanT-=dt;if(z.groanT<=0){z.groanT=rand(3,7);const rx=(z.x-P.x)*Math.cos(P.yaw)-(z.z-P.z)*Math.sin(P.yaw),dd=Math.hypot(z.x-P.x,z.z-P.z);if(z.type==='sprint'&&Math.random()<.45)Sfx.scream(dd,clamp(rx/8,-1,1),sndOcc(z.x,z.h+1.5,z.z));else Sfx.groan(dd,clamp(rx/8,-1,1),z.type==='sprint'||z.boss,sndOcc(z.x,z.h+1.5,z.z));}}}
function netPlayers(list){const now=performance.now(),seen=new Set();
  for(const o of list.slice(0,NET_MAX)){if(!o||typeof o.id!=='string'||o.id===NET.me)continue;const id=o.id.slice(0,12);seen.add(id);let p=NET.peers.get(id);
    if(!p){p={id,n:'',slot:0,s:null};NET.peers.set(id,p);}p.n=cleanName(o.n)||p.n||'Giocatore';p.slot=clamp(o.sl|0,0,3);p.s=netCleanState(o,p);p.last=now;}
  NET.peers.forEach((p,id)=>{if(!seen.has(id)){netDropAvatar(p);NET.peers.delete(id);}});}

/* ---------- invio periodico ---------- */
let netAcc=0,netSlow=0;
function netTick(dt,fromFrame){if(fromFrame)NET.frameT=performance.now();if(!NET.conns.some(c=>c&&c.ok))return;const now=performance.now();netAcc+=dt;netSlow+=dt;
  if(NET.host&&NET.on&&NET.started&&lure&&lure.remote){lure.t-=dt;if(lure.t<=0){lure=null;computeFlow();}}
  if(netAcc<.1)return;netAcc=0;const slow=netSlow>=1;if(slow)netSlow=0;
  // 25 s di tolleranza: un blocco schermo o una notifica di pochi secondi non chiude la partita
  if(NET.host&&NET.on){NET.peers.forEach(p=>{if(now-p.last>25000)netRemovePeer(p,'ha perso la connessione');else if(p.pend||p.pk){netEv({t:'pts',to:p.id,v:p.pend,k:p.pk,h:p.ph});p.pend=p.pk=p.ph=0;}});
    if(NET.started&&state==='playing')netCheckWipe();
    // a partita finita (schermata di fine) chi entra aspetta nella lobby: niente istantanee, solo l'elenco dei giocatori
    const playing=NET.started&&state!=='dead',msg={e:NET.ev};NET.ev=[];if(playing)msg.S=netSnap();else msg.R=netRoster();
    // solo sui server dove c'è qualcuno che ascolta (di solito uno)
    const to=new Set(NET.replyB);NET.replyB.clear();NET.peers.forEach(p=>{if(p.bi!=null)to.add(p.bi);});
    if(to.size&&(playing||msg.e.length||slow)){const s=JSON.stringify(msg);to.forEach(i=>{const c=NET.conns[i];if(c&&c.ok)c.pub(`${NB}/h/${NET.lid}`,s);});}
    if(now-NET.infoT>15000)netLobbyInfo();}
  else if(NET.client&&NET.on){if(NET.welcomed){netPub({t:'s',...netMe(),q:NET.q});NET.q=[];}
    if(NET.migr){if(now-NET.migr.t>10000){NET.migr.i++;netMigrateNext();}else if(now-NET.migr.rt>1500)netMigJoin();}/* ripeto la richiesta; dopo 10 s tocca al prossimo */
    else if(now-NET.lastHost>25000)netHostLost("L'host non risponde più");
    else if(!NET.welcomed&&now-NET.joinT>7000){netLeave(true);netBackToMenu();netNotice('La lobby non risponde');}}
  if(slow&&NET.on&&NET.started&&wakeFail&&!NET.wakeWarned&&state==='playing'){NET.wakeWarned=true;showMsg(`Lo schermo potrebbe spegnersi<small>metti ${esc(wakeHelp())}</small>`,5);}
  if(slow){netInviteCheck();let ch=false;const vis=new Set(netLobbyList().map(L=>L.id));NET.lobbies.forEach((L,id)=>{if(!vis.has(id)&&id!==NET.lid&&id!==NET.me){NET.lobbies.delete(id);ch=true;}});if(ch)netUI();}
  if(NET.on&&NET.started)teamUI();}
// con la pagina in secondo piano i frame si fermano: l'host continua almeno a dare segni di vita
setInterval(()=>{if(NET.on&&performance.now()-NET.frameT>800)netTick(1,false);},1000);

/* ---------- compagni di squadra visti in partita ---------- */
/* i compagni sono i sopravvissuti Meshy (atleta, businessman, punk, meccanico: uno per posto) con lo scheletro degli zombie,
   messi in posa qui sotto; senza modelli restano gli omini a blocchi */
const SURV=MESHY.filter(d=>d.uso==='giocatore');
function makeSurvivor(sl,body){const MD=SURV[(sl&3)%SURV.length];if(!MD.geo){MD.geo=meshyGeo(MD);MD.mat=new THREE.MeshLambertMaterial({map:meshyTex(MD),skinning:true});}
  const bones=BONES.map(([nm],i)=>{const b=new THREE.Bone();b.name=nm;b.position.fromArray(MD.bones[i]);return b;});BONES.forEach(([,p],i)=>{if(p>=0)bones[p].add(bones[i]);});
  const mesh=new THREE.SkinnedMesh(MD.geo,MD.mat);mesh.add(bones[0]);mesh.updateMatrixWorld(true);mesh.bind(new THREE.Skeleton(bones));mesh.frustumCulled=false;
  const hold=new THREE.Group();hold.rotation.y=Math.PI;hold.add(mesh);body.add(hold);/* il modello guarda verso +z, il giocatore verso -z */
  const B={};bones.forEach(b=>B[b.name]=b);return {B,K:{L1:MD.sk.L1,L2:MD.sk.L2,ay:MD.sk.ay,hd:MD.sk.hd,hy:MD.sk.hy},top:MD.h};}
/* braccio a due ossa (IK): il polso va su T, il gomito verso pole (coordinate del mondo). La spalla gira in modo che il gomito,
   che si piega solo attorno al suo asse x, pieghi l'avambraccio proprio verso la mano */
const _ik={S:new THREE.Vector3(),T:new THREE.Vector3(),P:new THREE.Vector3(),v:new THREE.Vector3(),w:new THREE.Vector3(),U:new THREE.Vector3(),F:new THREE.Vector3(),
  a:new THREE.Vector3(),x:new THREE.Vector3(),r:new THREE.Vector3(),q:new THREE.Quaternion(),q2:new THREE.Quaternion()};
function armIK(sh,el,ha,T,pole){const k=_ik,par=sh.parent;par.updateMatrixWorld(true);const Lu=el.position.length(),Lf=ha.position.length();
  k.T.copy(T);par.worldToLocal(k.T);k.P.copy(pole);par.worldToLocal(k.P);k.S.copy(sh.position);
  k.v.subVectors(k.T,k.S);const d=clamp(k.v.length(),Math.abs(Lu-Lf)+.02,Lu+Lf-.002);k.v.normalize();
  const a=(Lu*Lu-Lf*Lf+d*d)/(2*d),h=Math.sqrt(Math.max(0,Lu*Lu-a*a));
  k.w.subVectors(k.P,k.S);k.w.addScaledVector(k.v,-k.w.dot(k.v));if(k.w.lengthSq()<1e-6)k.w.set(0,-1,0);k.w.normalize();
  k.U.copy(k.v).multiplyScalar(a).addScaledVector(k.w,h).divideScalar(Lu);/* direzione del braccio */
  k.F.copy(k.v).multiplyScalar(d).addScaledVector(k.U,-Lu).divideScalar(Lf);/* direzione dell'avambraccio */
  k.r.copy(k.F).addScaledVector(k.U,-k.F.dot(k.U));if(k.r.lengthSq()<1e-6)k.r.copy(k.w);k.r.normalize();k.a.crossVectors(k.r,k.U).normalize();/* asse del gomito */
  k.q.setFromUnitVectors(k.x.copy(el.position).normalize(),k.U);k.x.set(1,0,0).applyQuaternion(k.q);
  const tw=Math.atan2(k.r.crossVectors(k.x,k.a).dot(k.U),k.x.dot(k.a));k.q2.setFromAxisAngle(k.U,tw);sh.quaternion.copy(k.q2.multiply(k.q));
  el.rotation.set(-Math.acos(clamp(k.U.dot(k.F),-1,1)),0,0);}
// posa del sopravvissuto (ossa nello spazio del modello: x positivo = piegarsi in avanti; vedi poseZombie). Il modello è girato di 180°:
// le ossa «L» sono il suo braccio destro (quello dell'arma, a x positivo nel corpo), le «R» il sinistro
const _avT=new THREE.Vector3(),_avP=new THREE.Vector3();
function poseSurvivor(a,s,sw,amp){const B=a.B,K=a.K,pt=s.p||0,cw=Math.cos(a.ph);
  if(s.dn===1){B.hips.position.y=K.hy;B.hips.rotation.set(0,0,0);B.spine.rotation.set(.1,0,0);B.chest.rotation.set(.1,0,0);B.neck.rotation.set(-.6,0,0);B.head.rotation.set(-.2,0,0);
    B.shL.rotation.set(-2.5,0,-.2);B.shR.rotation.set(-2.2,0,.3);B.elL.rotation.x=-.3;B.elR.rotation.x=-.5;B.hipL.rotation.set(-.15,0,0);B.hipR.rotation.set(.1,0,0);B.knL.rotation.x=.4;B.knR.rotation.x=.15;B.ftL.rotation.x=B.ftR.rotation.x=.3;return;}
  const hp=-sw*.85,kn=.08+Math.max(0,cw)*.75*amp,kn2=.08+Math.max(0,-cw)*.75*amp;
  B.hips.position.y=K.hy-.02*amp-Math.abs(Math.sin(a.ph))*.03*amp;B.hips.rotation.set(0,Math.sin(a.ph)*.12*amp,0);
  B.spine.rotation.set(.06*amp,-.12,0);B.chest.rotation.set(-pt*.25,-.2,0);B.neck.rotation.set(-pt*.3,.16,0);B.head.rotation.set(-pt*.35,.14,0);/* spalla sinistra avanti, testa dritta */
  B.hipL.rotation.set(hp,0,-.03);B.hipR.rotation.set(-hp,0,.03);B.knL.rotation.x=kn;B.knR.rotation.x=kn2;B.ftL.rotation.x=-(hp+kn);B.ftR.rotation.x=-(-hp+kn2);
  a.g.updateMatrixWorld(true);const ud=a.gunM?a.gunM.userData:{},gr=ud.grip||[0,-.06,.1],fo=ud.fore;/* impugnature vere dell'arma (gunModel) */
  armIK(B.shL,B.elL,B.haL,a.gunM?a.gunM.localToWorld(_avT.set(gr[0]+.01,gr[1]+.02,gr[2])):a.gun.localToWorld(_avT.set(0,-.06,.1)),a.body.localToWorld(_avP.set(.6,.5,.2)));/* mano destra sull'impugnatura */
  armIK(B.shR,B.elR,B.haR,a.gunM?(fo?a.gunM.localToWorld(_avT.set(fo[0]-.01,fo[1]-.01,fo[2])):a.gunM.localToWorld(_avT.set(gr[0]-.035,gr[1],gr[2]+.01))):a.gun.localToWorld(_avT.set(-.02,-.06,-.16)),
    a.body.localToWorld(_avP.set(-.5,.6,0)));/* sinistra sotto la canna, o sull'altra mano con la pistola */
  B.haL.rotation.set(.15,0,0);B.haR.rotation.set(.2,0,0);}
function makeAvatar(sl){const g=new THREE.Group(),body=new THREE.Group();g.add(body);
  if(SURV.length){const sv=makeSurvivor(sl,body);const gun=new THREE.Group();gun.position.set(.12,1.3,-.34);body.add(gun);
    const fl=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex,color:0xffd08a,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));fl.scale.setScalar(.4);fl.position.set(0,.03,-.6);fl.visible=false;gun.add(fl);
    const tagC=document.createElement('canvas');tagC.width=512;tagC.height=176;const tagT=new THREE.CanvasTexture(tagC);tagT.minFilter=THREE.LinearFilter;tagT.generateMipmaps=false;
    const tag=new THREE.Sprite(new THREE.SpriteMaterial({map:tagT,transparent:true,depthTest:false,depthWrite:false,fog:false}));tag.scale.set(1.3,.45,1);tag.position.y=2.2;tag.renderOrder=10;g.add(tag);
    scene.add(g);return {g,body,B:sv.B,K:sv.K,gun,gunM:null,gunK:'',fl,flT:0,tag,tagC,tagT,tagK:'',ph:0,x:null,z:0,h:0,y:0,sl};}
  const cloth=new THREE.MeshLambertMaterial({color:AV_COL[sl&3]}),dark=new THREE.MeshLambertMaterial({color:0x2a2e31}),skin=new THREE.MeshLambertMaterial({color:0xc9a27e});
  const box=(w,h,d,m,x,y,z)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(x,y,z);body.add(o);return o;};
  box(.44,.58,.26,cloth,0,1.2,0);box(.38,.18,.24,dark,0,.86,0);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.13,12,10),skin);head.position.set(0,1.64,0);body.add(head);
  const cap=new THREE.Mesh(new THREE.SphereGeometry(.142,12,8,0,Math.PI*2,0,1.25),dark);cap.position.set(0,1.67,0);body.add(cap);
  const limb=(x,y,w,h,m)=>{const p=new THREE.Group();p.position.set(x,y,0);body.add(p);const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,w),m);o.position.y=-h/2;p.add(o);return p;};
  const legL=limb(-.11,.86,.16,.84,dark),legR=limb(.11,.86,.16,.84,dark),armL=limb(-.27,1.45,.12,.56,cloth),armR=limb(.27,1.45,.12,.56,cloth);
  const gun=new THREE.Group();gun.position.set(.08,1.32,-.3);body.add(gun);
  const fl=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex,color:0xffd08a,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));fl.scale.setScalar(.4);fl.position.set(0,.03,-.6);fl.visible=false;gun.add(fl);
  /* nome sopra la testa: niente nebbia (prima da lontano spariva), si vede attraverso i muri, grandezza costante sullo schermo */
  const tagC=document.createElement('canvas');tagC.width=512;tagC.height=176;const tagT=new THREE.CanvasTexture(tagC);tagT.minFilter=THREE.LinearFilter;tagT.generateMipmaps=false;
  const tag=new THREE.Sprite(new THREE.SpriteMaterial({map:tagT,transparent:true,depthTest:false,depthWrite:false,fog:false}));tag.scale.set(1.3,.45,1);tag.position.y=2.2;tag.renderOrder=10;g.add(tag);
  scene.add(g);return {g,body,legL,legR,armL,armR,gun,gunM:null,gunK:'',fl,flT:0,tag,tagC,tagT,tagK:'',ph:0,x:null,z:0,h:0,y:0,sl};}
function rrect(c,x,y,w,h,r){c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath();}
// targhetta: riquadro scuro col bordo del colore del giocatore, nome grande, sotto la distanza (o A TERRA in rosso) e una freccia verso di lui
function avTag(a,name,sl,dn,dm,sp){const k=name+'|'+dn+'|'+dm+'|'+(sp?1:0);if(a.tagK===k)return;a.tagK=k;const c=a.tagC.getContext('2d'),W=512;c.clearRect(0,0,W,176);
  const col=dn===1?'#ff5a4a':AV_CSS[sl&3];c.font='bold 60px "Barlow Condensed", sans-serif';const tw=Math.min(W-60,c.measureText(name).width),bw=Math.max(tw+60,200),bx=(W-bw)/2;
  c.fillStyle='rgba(8,10,14,.68)';rrect(c,bx,4,bw,114,24);c.fill();c.lineWidth=6;c.strokeStyle=col;c.stroke();
  c.textAlign='center';c.textBaseline='middle';c.lineJoin='round';c.lineWidth=9;c.strokeStyle='rgba(0,0,0,.92)';c.strokeText(name,W/2,46,W-60);c.fillStyle=col;c.fillText(name,W/2,46,W-60);
  const sub=(dn===1?'A TERRA · ':'')+dm+' m';c.font='bold 36px "Barlow Condensed", sans-serif';c.lineWidth=7;c.strokeText(sub,W/2,94);c.fillStyle=dn===1?'#ffb4ac':'#f0f0f0';c.fillText(sub,W/2,94);
  c.beginPath();c.moveTo(W/2-24,124);c.lineTo(W/2+24,124);c.lineTo(W/2,156);c.closePath();c.fillStyle=col;c.fill();c.lineWidth=4;c.strokeStyle='rgba(0,0,0,.85)';c.stroke();
  if(sp){const x=bx-46,y=46;c.fillStyle='#f0f0f0';c.beginPath();c.moveTo(x-14,y-9);c.lineTo(x-4,y-9);c.lineTo(x+8,y-20);c.lineTo(x+8,y+20);c.lineTo(x-4,y+9);c.lineTo(x-14,y+9);c.closePath();c.fill();
    c.strokeStyle='#f0f0f0';c.lineWidth=5;for(const r of [16,28]){c.beginPath();c.arc(x+8,y,r,-.8,.8);c.stroke();}}/* sta parlando */
  a.tagT.needsUpdate=true;}
// fuori dallo schermo (dietro di te o di lato): una freccia del suo colore sul bordo dello schermo, col nome
const _mk=new THREE.Vector3();
function mateMark(p,a,s){let el=p.mk;if(!el){el=p.mk=document.createElement('div');el.className='mate';el.innerHTML='<b></b><span></span>';$('hud').appendChild(el);}
  _mk.set(a.x,a.h+1.9,a.z).project(camera);const behind=_mk.z>1;let x=_mk.x,y=_mk.y;
  if(!behind&&Math.abs(x)<.94&&Math.abs(y)<.9){el.style.display='none';return;}
  if(behind){x=-x;y=-1;}/* alle spalle: sul bordo in basso */const m=Math.max(Math.abs(x)/.9,Math.abs(y)/.8)||1;x/=m;y/=m;
  el.style.display='';el.style.left=((x+1)*50)+'%';el.style.top=((1-y)*50)+'%';el.style.setProperty('--c',s.dn===1?'#ff5a4a':AV_CSS[s.sl&3]);
  el.firstChild.style.transform=`rotate(${Math.atan2(-y,x)}rad)`;const t=s.dn===1?p.n+' · A TERRA':p.n;if(el.lastChild.textContent!==t)el.lastChild.textContent=t;}
function netDropAvatar(p){if(p.av){scene.remove(p.av.g);p.av=null;}if(p.mk){p.mk.remove();p.mk=null;}}
function netAvatars(dt){if(!NET.on)return;const k=1-Math.exp(-dt*12);
  NET.peers.forEach(p=>{const s=p.s;if(!s||!NET.started||state==='menu'){if(p.av)p.av.g.visible=false;if(p.mk)p.mk.style.display='none';return;}
    if(p.av&&p.av.sl!==s.sl)netDropAvatar(p);/* cambio di posto (es. nuovo host): nuovo colore */const a=p.av||(p.av=makeAvatar(s.sl));a.g.visible=s.dn!==2;if(a.x===null){a.x=s.x;a.z=s.z;a.h=s.h;a.y=s.y;}
    const ox=a.x,oz=a.z,dx=s.x-a.x,dz=s.z-a.z;if(dx*dx+dz*dz>36){a.x=s.x;a.z=s.z;a.h=s.h;}else{a.x+=dx*k;a.z+=dz*k;a.h+=(s.h-a.h)*k;}a.y=turn(a.y,s.y,k*1.5);
    const mv=Math.hypot(a.x-ox,a.z-oz),sp=dt>0?mv/dt:0;a.ph+=mv*3.4;const sw=Math.sin(a.ph)*Math.min(1,sp/3)*.75;
    a.g.position.set(a.x,a.h,a.z);a.g.rotation.y=a.y;
    if(a.B){if(s.dn===1){a.body.rotation.x=-1.4;a.body.position.set(0,.2,.8);}else{a.body.rotation.x=0;a.body.position.set(0,0,0);}a.gun.rotation.x=s.p;poseSurvivor(a,s,sw,Math.min(1,sp/3));}
    else if(s.dn===1){a.body.rotation.x=-1.4;a.body.position.set(0,.22,.75);a.legL.rotation.x=a.legR.rotation.x=0;a.armL.rotation.x=a.armR.rotation.x=2.4;}
    else{a.body.rotation.x=0;a.body.position.set(0,0,0);a.legL.rotation.x=sw;a.legR.rotation.x=-sw;a.armR.rotation.x=1.35+s.p*.8;a.armL.rotation.x=1.2+s.p*.8;a.armL.rotation.z=-.45;}
    const gk=s.w+s.pp;if(a.gunK!==gk){if(a.gunM)a.gun.remove(a.gunM);const W=WEAPONS[s.w];a.gunM=W&&s.w!=='mani'?gunModel(W.model,false,!!s.pp):null;if(a.gunM)a.gun.add(a.gunM);a.gunK=gk;}
    a.gun.rotation.x=s.p;a.gun.visible=s.dn===0;
    if(p.sh0==null)p.sh0=s.sh;else if(s.sh!==p.sh0){p.sh0=s.sh;a.fl.visible=true;a.flT=.06;const d=Math.hypot(P.x-a.x,P.z-a.z),v=Math.min(.32,3/(1+d*d*.08));
      if(v>.02){const W=WEAPONS[s.w];Sfx.shot(W&&W.snd||'smg',clamp(((a.x-P.x)*Math.cos(P.yaw)-(a.z-P.z)*Math.sin(P.yaw))/10,-1,1),Math.max(2,d),sndOcc(a.x,a.h+1.4,a.z));}}/* lo sparo vero della sua arma, da dove sta */
    if(a.flT>0){a.flT-=dt;if(a.flT<=0)a.fl.visible=false;}
    const cd=Math.hypot(P.x-a.x,P.eyeH-(a.h+2.2),P.z-a.z),th=Math.max(.5,cd*.085);a.tag.scale.set(th*512/176,th,1);a.tag.position.y=2.05+th*.5;
    avTag(a,p.n,s.sl,s.dn,Math.round(Math.hypot(P.x-a.x,P.z-a.z)),vSpeaking(p.id));if(s.dn!==2)mateMark(p,a,s);else if(p.mk)p.mk.style.display='none';});}
// compagni a terra da rialzare
function netReviveTarget(){if(!NET.on||P.downT>0||P.dead)return null;let best=null,bd=1.8;
  NET.peers.forEach(p=>{const s=p.s;if(!s||s.dn!==1)return;const d=Math.hypot(P.x-s.x,P.z-s.z);if(d<bd&&Math.abs(P.h-s.h)<1.3){bd=d;best=p;}});return best;}

/* ---------- interfaccia: avviso nel menu, finestra online, lobby, squadra ---------- */
function lobRow(L){const d=document.createElement('div');d.className='lob';const t=document.createElement('span');
  t.textContent=`${L.n} · ${MAPS[L.m].name} · ${L.p}/${NET_MAX} giocatori · ${L.s==='play'?'round '+(L.r||1):'in attesa'} · codice ${L.id.toUpperCase()}`;
  const b=document.createElement('button');b.type='button';b.className='go';b.textContent=L.p>=NET_MAX?'Piena':'Entra';b.disabled=L.p>=NET_MAX;b.dataset.join=L.id;d.append(t,b);return d;}
function netUI(){let lobs=netLobbyList();const inv=NET.invite&&!NET.on?lobs.find(L=>L.id===NET.invite):null;if(inv)lobs=[inv,...lobs.filter(L=>L!==inv)];
  const ban=$('netBanner');ban.hidden=NET.on||!(lobs.length||NET.invite);
  if(!ban.hidden){const h=document.createElement('b');
    h.textContent=inv?`${inv.n} ti ha invitato nella sua lobby`:NET.invite?`Cerco la lobby ${NET.invite.toUpperCase()} a cui sei stato invitato…`:lobs.length===1?'C\'è una partita online attiva':`Ci sono ${lobs.length} partite online attive`;
    ban.replaceChildren(h,...lobs.slice(0,3).map(lobRow));}
  const st=NET.notice||(NET.status==='conn'?'Cerco partite online…':NET.status==='fail'?'Server online non raggiungibile':NET.status==='ok'?(lobs.length?'':'Nessuna partita online in corso: creane una e invita i tuoi amici'):'');
  $('netState').textContent=NET.on?'':st;
  if(!$('net').hidden){const ok=okConns().map(i=>BROKER_NAME[i]).join(' e ');
    $('netStatus').textContent=(NET.notice?NET.notice+' · ':'')+(NET.status==='ok'?`Collegato (${ok}) · ${lobs.length?(lobs.length===1?'una lobby attiva':lobs.length+' lobby attive'):'nessuna lobby attiva per ora'}`:
      NET.status==='conn'?'Mi collego ai server…':`Server non raggiungibili${NET.err?' ('+NET.err+')':''}. Riprovo da solo.`);
    $('netList').replaceChildren(...lobs.map(lobRow));$('netCreate').textContent=`Crea una lobby · ${M.name}`;$('netCreate').disabled=NET.status!=='ok';}
  roomUI();}
function showRoom(){$('menu').hidden=true;$('net').hidden=true;$('roomShareOut').textContent='';roomUI();}
function roomUI(){const r=$('room');if(!NET.on||NET.started){r.hidden=true;return;}r.hidden=false;
  $('roomTitle').textContent=NET.host?'La tua lobby':`Lobby di ${NET.hostName}`;$('roomMeta').textContent=`${M.name} · fino a ${NET_MAX} giocatori`;
  $('roomMaps').hidden=!NET.host;$('roomMaps').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.rm===M.id)));
  const list=NET.host?netRoster().p:NET.roster;
  $('roomList').replaceChildren(...list.slice().sort((a,b)=>a.sl-b.sl).map(o=>{const li=document.createElement('li');const i=document.createElement('i');i.style.background=AV_CSS[o.sl&3];
    const t=document.createElement('span');t.textContent=o.n+(o.sl===0?' · host':'')+(o.n===NET.name&&(NET.host?o.sl===0:o.sl===NET.slot)?' (tu)':'');li.append(i,t);return li;}));
  $('roomStart').hidden=!NET.host;$('roomCode').textContent=NET.lid?NET.lid.toUpperCase():'';
  $('roomNote').textContent=NET.host?(NET.peers.size?'Quando siete pronti, inizia la partita. Chi arriva dopo entra lo stesso, anche a partita in corso.':'Tocca «Invita amici» e manda il link: chi lo apre entra qui con un tocco. Oppure sull\'altro telefono apri il gioco: questa lobby compare in cima al menu. Puoi anche iniziare subito.')
    :NET.welcomed?`Aspetta che ${NET.hostName} inizi la partita`:'Mi collego alla lobby…';
  const rw=$('roomWarn');rw.hidden=!(NET.host||wakeFail);
  rw.textContent=(wakeFail?`Questo telefono non lascia al gioco tenere acceso lo schermo: mentre giocate metti ${wakeHelp()}, altrimenti quando si spegne vieni scollegato${NET.host?' (e con te tutta la lobby)':''}. `:'Lo schermo resta acceso da solo. ')
    +(NET.host?'Resta su questa pagina: se passi a un\'altra app la lobby si chiude per tutti. Per l\'invito usa «Invita amici» e torna subito qui.':'');}
function teamUI(){const el=$('team');if(!NET.on||!NET.started||state==='menu'){el.hidden=true;NET.teamK='';return;}
  const rows=[{n:NET.name,sl:NET.slot,pt:points,dn:P.dead?2:P.bleed?1:0,sp:VOICE.lvl>.025}];NET.peers.forEach((p,id)=>{if(p.s)rows.push({n:p.n,sl:p.s.sl,pt:p.s.pt,dn:p.s.dn,sp:vSpeaking(id)});});
  const key=JSON.stringify(rows);if(key===NET.teamK)return;NET.teamK=key;el.hidden=false;
  el.replaceChildren(...rows.map((o,i)=>{const d=document.createElement('div');if(i===0)d.className='me';const c=document.createElement('i');c.style.background=AV_CSS[o.sl&3];
    const n=document.createElement('span');n.textContent=o.n;if(o.sp)n.className='spk';const b=document.createElement('b');b.textContent=o.pt;d.append(c,n,b);
    if(o.dn){const e=document.createElement('em');e.textContent=o.dn===1?'a terra':'morto';d.append(e);}return d;}));}
$('netOpen').addEventListener('click',()=>{$('menu').hidden=true;$('net').hidden=false;$('netName').value=NET.name;NET.notice='';netConnect();netUI();});
$('netClose').addEventListener('click',()=>{$('net').hidden=true;$('menu').hidden=false;netUI();});
$('netCreate').addEventListener('click',netCreate);
$('netName').addEventListener('change',e=>{const n=cleanName(e.target.value);if(n){NET.name=n;try{localStorage.setItem('scn-name',n);}catch(_){}}e.target.value=NET.name;});
document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('[data-join]');if(b&&!b.disabled){$('net').hidden=true;$('menu').hidden=false;NET.notice='';netJoin(b.dataset.join);}});
$('netCodeGo').addEventListener('click',()=>{NET.notice='';$('menu').hidden=false;netJoinCode($('netCode').value);});
$('netCode').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();$('netCodeGo').click();}});
$('roomShare').addEventListener('click',netShare);
$('roomLeave').addEventListener('click',()=>{netLeave(true);$('menu').hidden=false;netUI();});
$('roomStart').addEventListener('click',()=>{if(!NET.host)return;netGesture();startGame();});
$('roomMaps').addEventListener('click',e=>{const b=e.target.closest('[data-rm]');if(!b||!NET.host||NET.started)return;selectMap(b.dataset.rm);netEv({t:'map',m:M.id});netLobbyInfo();roomUI();});
function netBoot(){if(location.protocol==='https:'||location.protocol==='http:')netConnect();netUI();}

/* =========================================================
   CHAT VOCALE (online, fino a 4): WebRTC da telefono a telefono. I server MQTT servono solo a presentarsi (topic v/<id>,
   offerta/risposta/candidati); l'audio va diretto tra i giocatori, nessun server nostro lo ascolta.
   Modi (opzioni, `scn-voice`): spenta (di serie: il microfono non viene chiesto), premi per parlare (T, croce in basso del controller,
   tasto microfono a schermo), sempre aperta. Ogni coppia con la voce accesa si collega: offre chi ha l'id minore.
   Solo server STUN pubblici (niente relay che passa l'audio): su certe reti mobili due telefoni potrebbero non sentirsi.
   ========================================================= */
const VOICE={mode:'spenta',vol:1,mic:null,pcs:new Map(),talk:false,hiT:0,an:null,lvl:0,seen:new Set(),asking:false,denied:false};
try{const m=localStorage.getItem('scn-voice');if(['spenta','ptt','sempre'].includes(m))VOICE.mode=m;const v=localStorage.getItem('scn-voicevol');if(v!=null)VOICE.vol=clamp(+v,0,1);}catch(_){}
const ICE=[{urls:['stun:stun.l.google.com:19302','stun:stun1.l.google.com:19302']}];
const vOn=()=>NET.on&&VOICE.mode!=='spenta'&&!!window.RTCPeerConnection;
function vSend(to,k,d){const s=JSON.stringify({f:NET.me,l:NET.lid,k,d,m:Math.random().toString(36).slice(2,10)});okConns().forEach(i=>NET.conns[i].pub(`${NB}/v/${to}`,s));}
function vPeers(){const ids=new Set();if(NET.host)NET.peers.forEach((p,id)=>ids.add(id));else{(NET.roster||[]).forEach(o=>{if(o.id)ids.add(o.id);});if(NET.lid)ids.add(NET.lid);}ids.delete(NET.me);return [...ids];}
async function vMic(){if(VOICE.mic||VOICE.denied)return VOICE.mic;if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){VOICE.denied=true;netNotice('Questo browser non permette il microfono');return null;}
  try{VOICE.mic=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});}
  catch(e){VOICE.denied=true;netNotice(location.protocol==='https:'?'Microfono non permesso: controlla i permessi del browser per questo sito':'Il microfono funziona solo da un indirizzo https');return null;}
  if(!vOn()){vStopAll();return null;}/* nel frattempo la voce è stata spenta */
  vTalkApply();try{Sfx.init();const c=Sfx.ctx,an=c.createAnalyser();an.fftSize=512;c.createMediaStreamSource(VOICE.mic).connect(an);VOICE.an=an;}catch(_){}
  VOICE.pcs.forEach(v=>{if(v.init)vAddTrack(v);});return VOICE.mic;}
function vTalkApply(){const on=VOICE.mode==='sempre'||(VOICE.mode==='ptt'&&VOICE.talk);if(VOICE.mic)VOICE.mic.getAudioTracks().forEach(t=>{t.enabled=on;});}
function vAddTrack(v){if(!VOICE.mic||v.sent)return;VOICE.mic.getAudioTracks().forEach(t=>v.pc.addTrack(t,VOICE.mic));v.sent=true;}
function vPC(id,init){const pc=new RTCPeerConnection({iceServers:ICE});const v={id,pc,init,el:null,an:null,lvl:0,sent:false,qi:[]};VOICE.pcs.set(id,v);
  pc.onicecandidate=e=>{if(e.candidate)vSend(id,'ice',e.candidate.toJSON());};
  pc.ontrack=e=>{const st=e.streams[0]||new MediaStream([e.track]);
    if(!v.el){v.el=document.createElement('audio');v.el.autoplay=true;v.el.playsInline=true;v.el.style.display='none';document.body.appendChild(v.el);}
    v.el.srcObject=st;v.el.volume=VOICE.vol;const p=v.el.play();if(p&&p.catch)p.catch(()=>{});
    try{const c=Sfx.ctx;if(c&&!v.an){const an=c.createAnalyser();an.fftSize=512;c.createMediaStreamSource(st).connect(an);v.an=an;}}catch(_){}};
  pc.onconnectionstatechange=()=>{if(pc.connectionState==='failed'||pc.connectionState==='closed')vClose(id);};
  pc.onnegotiationneeded=async()=>{if(!v.init)return;try{await pc.setLocalDescription(await pc.createOffer());vSend(id,'offer',pc.localDescription.toJSON());}catch(_){}};
  if(init)vAddTrack(v);return v;}
function vClose(id){const v=VOICE.pcs.get(id);if(!v)return;VOICE.pcs.delete(id);try{v.pc.close();}catch(_){}if(v.el){v.el.srcObject=null;v.el.remove();}}
function vStopAll(){if(NET.on)VOICE.pcs.forEach((_,id)=>vSend(id,'bye'));[...VOICE.pcs.keys()].forEach(vClose);
  if(VOICE.mic){VOICE.mic.getTracks().forEach(t=>t.stop());VOICE.mic=null;}VOICE.an=null;VOICE.talk=false;}
async function vMsg(o){if(!o||o.l!==NET.lid||typeof o.f!=='string'||o.f===NET.me||typeof o.m!=='string'||VOICE.seen.has(o.m))return;VOICE.seen.add(o.m);if(VOICE.seen.size>500)VOICE.seen.clear();
  const id=o.f.slice(0,12);if(o.k==='bye'){vClose(id);return;}if(!vOn()||!vPeers().includes(id))return;if(!await vMic())return;
  try{if(o.k==='hi'){if(!VOICE.pcs.has(id)){if(NET.me<id)vPC(id,true);else vSend(id,'hi');}}
    else if(o.k==='offer'){let v=VOICE.pcs.get(id);if(v&&v.init){if(NET.me<id)return;vClose(id);v=null;}/* offerte incrociate: vale quella di chi ha l'id minore */
      if(!v)v=vPC(id,false);await v.pc.setRemoteDescription(o.d);vAddTrack(v);await v.pc.setLocalDescription(await v.pc.createAnswer());vSend(id,'answer',v.pc.localDescription.toJSON());
      for(const c of v.qi.splice(0))try{await v.pc.addIceCandidate(c);}catch(_){}}
    else if(o.k==='answer'){const v=VOICE.pcs.get(id);if(v&&v.pc.signalingState==='have-local-offer'){await v.pc.setRemoteDescription(o.d);for(const c of v.qi.splice(0))try{await v.pc.addIceCandidate(c);}catch(_){}}}
    else if(o.k==='ice'){const v=VOICE.pcs.get(id);if(v){if(!v.pc.remoteDescription)v.qi.push(o.d);else try{await v.pc.addIceCandidate(o.d);}catch(_){}}}}
  catch(e){console.warn('chat vocale',e);}}
const vBuf=new Uint8Array(512);
function vLevel(an){if(!an)return 0;an.getByteTimeDomainData(vBuf);let s=0;for(let i=0;i<vBuf.length;i++){const x=(vBuf[i]-128)/128;s+=x*x;}return Math.sqrt(s/vBuf.length);}
function vSpeaking(id){const v=VOICE.pcs.get(id);return !!v&&v.lvl>.025;}
function vTick(dt){const tt=$('tTalk');if(tt)tt.hidden=!(vOn()&&VOICE.mode==='ptt'&&TOUCH.on&&state==='playing');
  const me=$('voiceMe');
  if(!vOn()){if(VOICE.mic||VOICE.pcs.size)vStopAll();if(me)me.hidden=true;return;}
  if(!VOICE.mic&&!VOICE.asking&&!VOICE.denied){VOICE.asking=true;vMic().finally(()=>{VOICE.asking=false;});}
  VOICE.hiT-=dt;if(VOICE.hiT<=0&&VOICE.mic){VOICE.hiT=3;const ids=vPeers();ids.forEach(id=>{const v=VOICE.pcs.get(id);if(!v||(v.pc.connectionState==='new'&&performance.now()-(v.t0||(v.t0=performance.now()))>15000)){if(v)vClose(id);vSend(id,'hi');}});
    [...VOICE.pcs.keys()].forEach(id=>{if(!ids.includes(id))vClose(id);});}
  VOICE.pcs.forEach(v=>{v.lvl=v.lvl*.6+vLevel(v.an)*.4;if(v.el)v.el.volume=VOICE.vol;});
  const tx=VOICE.mic&&(VOICE.mode==='sempre'||VOICE.talk);VOICE.lvl=VOICE.lvl*.6+(tx?vLevel(VOICE.an):0)*.4;
  if(me){me.hidden=!tx;me.classList.toggle('on',VOICE.lvl>.025);}}
addEventListener('keydown',e=>{if(e.code!==BIND.talk||e.repeat||(e.target&&/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)))return;VOICE.talk=true;vTalkApply();});
addEventListener('keyup',e=>{if(e.code!==BIND.talk)return;VOICE.talk=false;vTalkApply();});
addEventListener('pagehide',()=>vStopAll());
$('voiceMode').value=VOICE.mode;$('voiceMode').addEventListener('change',e=>{VOICE.mode=['spenta','ptt','sempre'].includes(e.target.value)?e.target.value:'spenta';VOICE.denied=false;
  try{localStorage.setItem('scn-voice',VOICE.mode);}catch(_){}if(VOICE.mode==='spenta')vStopAll();else{vTalkApply();if(NET.on)vMic();}});
$('voiceVol').value=VOICE.vol;$('voiceVolOut').textContent=Math.round(VOICE.vol*100)+'%';
$('voiceVol').addEventListener('input',e=>{VOICE.vol=clamp(+e.target.value,0,1);$('voiceVolOut').textContent=Math.round(VOICE.vol*100)+'%';try{localStorage.setItem('scn-voicevol',VOICE.vol);}catch(_){}});
