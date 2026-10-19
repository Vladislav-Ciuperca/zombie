// Prova della mira col giroscopio: simula un telefono in orizzontale con eventi deviceorientation/devicemotion.
// Si esegue dentro dist/test.html a partita avviata (comandi touch attivi): touch.py lo carica e lo valuta.
// Restituisce {ok, righe}: ogni riga è un controllo con il valore misurato.
async()=>{
  const T=window.__t,G=T.GYRO,D=Math.PI/180,S=G.sens,wait=ms=>new Promise(r=>setTimeout(r,ms)),out=[];let ok=true;
  const chk=(nome,v,att,tol)=>{const b=Math.abs(v-att)<=tol;ok=ok&&b;out.push((b?'ok   ':'NO   ')+nome+': '+v.toFixed(3)+' (atteso '+att.toFixed(3)+')');};
  const Rz=a=>{const c=Math.cos(a),s=Math.sin(a);return [[c,-s,0],[s,c,0],[0,0,1]];};
  const Rx=a=>{const c=Math.cos(a),s=Math.sin(a);return [[1,0,0],[0,c,-s],[0,s,c]];};
  const Ry=a=>{const c=Math.cos(a),s=Math.sin(a);return [[c,0,s],[0,1,0],[-s,0,c]];};
  const mul=(A,B)=>A.map(r=>[0,1,2].map(j=>r[0]*B[0][j]+r[1]*B[1][j]+r[2]*B[2][j]));
  // matrice telefono→mondo → alpha/beta/gamma con gli stessi intervalli dei browser (beta ±180, gamma ±90)
  const ori=R=>{let b=Math.asin(Math.max(-1,Math.min(1,R[2][1]))),g=Math.atan2(-R[2][0],R[2][2]),a=Math.atan2(-R[0][1],R[1][1]);
    if(g<-Math.PI/2||g>=Math.PI/2){g+=g<0?Math.PI:-Math.PI;b=Math.PI-b;if(b>=Math.PI)b-=2*Math.PI;a+=Math.PI;}
    return [((a/D)%360+360)%360,b/D,g/D];};
  let R=Ry(-70*D);
  const send=()=>{const [a,b,g]=ori(R);dispatchEvent(new DeviceOrientationEvent('deviceorientation',{alpha:a,beta:b,gamma:g}));};
  const motion=v=>dispatchEvent(new DeviceMotionEvent('devicemotion',{rotationRate:{alpha:v[0],beta:v[1],gamma:v[2]},interval:16}));
  const body=(M,n,rate)=>run(()=>{if(rate)motion(rate);R=mul(R,M);},n);   // rotazione sugli assi del telefono
  const world=(M,n)=>run(()=>{R=mul(M,R);},n);                         // rotazione attorno alla verticale del mondo
  const quiet=()=>{T.toSpawn=0;T.zombies.forEach(z=>{if(z.active){z.active=false;z.g.visible=false;}});T.alive=0;};/* anche se nel frattempo parte un altro round */
  async function run(f,n){for(let k=0;k<n;k++){quiet();f();send();await wait(16);}}
  const pos=()=>[T.P.yaw,T.P.pitch];
  async function mossa(nome,fn,dy,dp){await run(()=>{},4);const a=pos();await fn();await run(()=>{},24);const b=pos();/* attesa lunga: con fotogrammi lenti l'ultima parte è ancora nell'ammorbidimento */
    chk(nome+' · girata',b[0]-a[0],dy*D*S,.06+Math.abs(dy)*D*S*.08);chk(nome+' · su/giù',b[1]-a[1],dp*D*S,.06+Math.abs(dp)*D*S*.08);}
  // i controlli 1:1 vanno fatti senza bordo (oltre 23° la visuale continua a girare) e senza accelerazione; alla fine si rimette tutto com'era
  const prima={mode:G.mode,wheel:G.wheel,invY:G.invY,map:G.map,edge:G.edge,edgeDeg:G.edgeDeg,accel:G.accel,aimMode:G.aimMode};
  // niente zombie durante la prova: l'aim assist rallenterebbe la visuale sulle teste, e un colpo potrebbe mandarti a terra
  // niente disegno durante la prova: nel browser dei test (senza scheda video) un fotogramma può durare più di mezzo secondo, e un evento
  // finto che arriva dopo un blocco così vale 1° in 0,7 s, cioè "tremolio" per il filtro (sul telefono ogni evento ha il suo orario e non succede)
  const primaNR=window.__norender;window.__norender=true;
  const primaAA=T.AA.lv,primaDev={...T.DEV};T.AA.lv='spento';T.DEV.on=true;T.DEV.god=true;T.toSpawn=0;T.zombies.forEach(z=>{z.active=false;z.g.visible=false;});T.alive=0;
  G.mode='sempre';G.wheel=true;G.invY=false;G.map=null;G.L=null;G.edge=false;G.accel=0;G.aimMode='visuale';T.P.pitch=0;
  // lato 90: alto dello schermo = fianco sinistro del telefono, telefono inclinato indietro di 20°
  await run(()=>{},8);chk('lato schermo 90',T.scrAngle(),90,0);
  await mossa('inclina in su 20°',()=>body(Ry(-D),20),0,20);await body(Ry(D),20);
  await mossa('girati a destra 30°',()=>world(Rz(-D),30),-30,0);
  await mossa('volante a destra 20°',()=>body(Rz(-D),20),-20,0);await mossa('volante a sinistra 20°',()=>body(Rz(D),20),20,0);
  await mossa('inclina in su 30° oltre la verticale',()=>body(Ry(-D),30),0,30);await body(Ry(D),30);
  // bordo: girato oltre la soglia la visuale continua a girare da sola (verso destra = yaw che scende); tornato al centro si ferma
  G.edge=true;G.edgeDeg=23;G.c=0;G.stillT=0;await run(()=>{},4);
  let e0=pos();await world(Rz(-D),30);await run(()=>{},30);let e1=pos();const oltre=e1[0]-e0[0]+30*D*S;/* in headless i frame sono lenti: basta che giri */
  out.push((oltre<-.15?'ok   ':'NO   ')+'bordo · oltre 23° continua a girare: '+oltre.toFixed(3)+' in più (atteso < -0.150)');ok=ok&&oltre<-.15;
  await world(Rz(D),30);await run(()=>{},4);e0=pos();await run(()=>{},20);e1=pos();
  chk('bordo · tornato al centro si ferma',e1[0]-e0[0],0,.02);G.edge=false;
  // lato 270: telefono girato dall'altra parte
  R=Ry(70*D);await run(()=>{},10);chk('lato schermo 270',T.scrAngle(),270,0);
  await mossa('270 · girati a destra 30°',()=>world(Rz(-D),30),-30,0);
  await mossa('270 · inclina in su 20°',()=>body(Ry(D),20),0,20);await body(Ry(-D),20);
  await mossa('270 · volante a destra 20°',()=>body(Rz(-D),20),-20,0);
  // rotationRate con gli assi come su iPhone (alpha=X, beta=Y, gamma=Z): li deve riconoscere confrontandoli con l'orientamento
  R=Ry(-70*D);await run(()=>{},10);const v=1.2/.016;
  for(const [M,M2,r] of [[Rx(1.2*D),Rx(-1.2*D),[v,0,0]],[Ry(1.2*D),Ry(-1.2*D),[0,v,0]],[Rz(1.2*D),Rz(-1.2*D),[0,0,v]]])
    for(let k=0;k<3;k++){await body(M,10,r);await body(M2,10,r.map(x=>-x));}
  const m=G.map;out.push((m&&m.o+''==='0,1,2'&&m.s+''==='1,1,1'&&m.deg?'ok   ':'NO   ')+'assi rotationRate rilevati: '+JSON.stringify(m));ok=ok&&!!m&&m.o+''==='0,1,2';
  // senza orientamento si usa rotationRate con gli assi rilevati: inclinare in su deve guardare in su (prima girava a destra)
  await wait(400);let a=pos();for(let k=0;k<20;k++){motion([0,-60,0]);await wait(16);}let b=pos();
  chk('solo rotationRate · inclina in su · su/giù',b[1]-a[1],19.2*D*S,.12);chk('solo rotationRate · inclina in su · girata',b[0]-a[0],0,.04);
  a=pos();for(let k=0;k<20;k++){motion([0,0,-60]);await wait(16);}b=pos();
  chk('solo rotationRate · volante a destra · girata',b[0]-a[0],-19.2*D*S,.12);
  // spento: niente movimento
  G.mode='spento';await run(()=>{},3);a=pos();await body(Ry(-D),15);b=pos();chk('spento',Math.abs(b[0]-a[0])+Math.abs(b[1]-a[1]),0,.001);
  Object.assign(G,prima);G.c=0;G.stillT=0;T.P.pitch=0;T.AA.lv=primaAA;Object.assign(T.DEV,primaDev);window.__norender=primaNR;
  return {ok,righe:out};
}
