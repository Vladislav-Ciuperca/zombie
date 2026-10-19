
/* =========================================================
   STATO DI GIOCO
   ========================================================= */
let START={x:0,z:0,yaw:0};
const TOUCH={on:false,mv:{x:0,y:0,active:false,id:null,ox:0,oy:0},look:{id:null,x:0,y:0},fire:{id:null,x:0,y:0},sprint:false,btn:new Map()};
const P={x:0,z:0,yaw:0,pitch:0,vx:0,vz:0,h:0,vy:0,grounded:true,airMax:0,hp:150,maxHp:150,hurtT:9,stamina:1,bob:0,eyeH:1.62,sprintK:0,tired:false};
let state='menu',round=0,toSpawn=0,alive=0,spawnT=0,betweenT=0,points=500,earned=0,kills=0,heads=0,doorsOpened=0;
let inv=[],cur=0,fireCD=0,reloadT=0,reloadDur=1,switchT=0,knifeT=0,knifeCD=0,throwT=0,trigger=false,triggerEdge=false,ads=false,adsT=0,bloom=0;
let perks=new Set(),instaT=0,doubleT=0,repairT=0,repairPts=0,pupDrops=0,hurtFlash=0,shakeT=0,recoilP=0,vmKick=0,swayX=0,swayY=0,grabT=0,invulnT=0;
let grenades=2,carillons=0,webCD=0,zapCD=0,reviveBuys=0;
let lockMode='none',showMap=false,showDebug=true,flowT=0,lastPCell=-1,zoneShown=-1,zoneT=0,seenMolo=false;
let regionOpen=[];const keys={};const powerups=[];const projectiles=[];const vortexes=[];let lure=null;
function openRegion(r){if(r==null||r<0)return;regionOpen[r]=true;const k=REG[r].k;(M.links&&M.links[k]||[]).forEach(l=>{if(RI[l]!=null)regionOpen[RI[l]]=true;});}
function zombiesFor(r){return r===1?6:r===2?8:r===3?13:r===4?18:r===5?24:Math.floor(24+(r-5)*4.5+Math.pow(r-5,1.6));}
function hpFor(r){return r<10?150+100*(r-1):Math.floor(950*Math.pow(1.1,r-9));}
function typeFor(r){const u=Math.random(),sp=r>=8?Math.min(.7,(r-7)*.1):0,rn=Math.min(1-sp,Math.max(0,(r-2)*.15));if(u<sp)return ['sprint',rand(3.6,4.1)];if(u<sp+rn)return ['run',rand(2.2,2.6)];return ['walk',rand(.95,1.3)];}
const maxSlots=()=>perks.has('terzamano')?3:2;

/* =========================================================
   FLOW FIELD + COLLISIONI + PROIETTILI
   ========================================================= */
const DIR8=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
const STEP=.6;
function stepOK(a,b){return Math.abs(cellH[a]-cellH[b])<=STEP;}
// diagonale ammessa solo se entrambe le celle d'angolo sono percorribili da ENTRAMBI i lati (regola simmetrica: niente minimi locali nel flusso)
function diagOK(c,n,cx,cz,dx,dz){const a=nbCell(c,dx,0),b=nbCell(c,0,dz);return a>=0&&b>=0&&walkable(a)&&walkable(b)&&stepOK(c,a)&&stepOK(c,b)&&stepOK(a,n)&&stepOK(b,n);}
function computeFlow(){
  // più sorgenti: la distanza è quella dal giocatore più vicino (online ci sono fino a 4 giocatori)
  flow.fill(65535);let h=0,t=0;for(const S of (lure?[lure]:netTargets())){const s=cellAt(clamp(Math.floor(S.x),0,GW-1),clamp(Math.floor(S.z),0,GH-1),S.h);if(flow[s]!==0){flow[s]=0;bfsQ[t++]=s;}}
  while(h<t){const c=bfsQ[h++],cx=cX(c),cz=cZ(c),d=flow[c]+1;
    for(const [dx,dz] of DIR8){const ni=nbCell(c,dx,dz);if(ni<0)continue;if(flow[ni]!==65535||!walkable(ni)||!stepOK(c,ni))continue;
      if(dx&&dz&&!diagOK(c,ni,cx,cz,dx,dz))continue;flow[ni]=d;bfsQ[t++]=ni;}}
}
function walkAt(x,z,y){const cx=Math.floor(x),cz=Math.floor(z);return inb(cx,cz)&&walkable(cellAt(cx,cz,y));}
// linea di vista a piedi (stesso piano, senza gradini): ay è la quota di partenza
function los(ax,az,bx,bz,ay){const dx=bx-ax,dz=bz-az,d=Math.hypot(dx,dz);if(d<.01)return true;const px=-dz/d*.28,pz=dx/d*.28,st=Math.ceil(d/.4);let ph=hAt(ax,az,ay);
  for(let s=1;s<=st;s++){const t=s/st,x=ax+dx*t,z=az+dz*t;if(!walkAt(x+px,z+pz,ph)||!walkAt(x-px,z-pz,ph))return false;const h=hAt(x,z,ph);if(Math.abs(h-ph)>.35)return false;ph=h;}return true;}
// collisioni degli zombie (restano sui percorsi, non saltano)
function collide(o,r,curH){
  const cx0=Math.floor(o.x),cz0=Math.floor(o.z);
  for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){const cx=cx0+dx,cz=cz0+dz;let hx=.5,hz=.5,solid=true;
    if(inb(cx,cz)){const i=cellAt(cx,cz,curH);if(walkable(i)){if(dx===0&&dz===0)solid=false;else{const ci=inb(cx0,cz0)?cellAt(cx0,cz0,curH):-1,qx=clamp(o.x,cx,cx+1),qz=clamp(o.z,cz,cz+1),dh=Math.abs(hAt(qx,qz,curH)-curH);
        solid=(ci>=0&&walkable(ci))?(!stepOK(ci,i)||dh>1.05):dh>.55;}}
      else if(kind[i]===K.PROP&&propCh[i]==='4'){hx=hz=.2;}}
    if(!solid)continue;pushOut(o,r,cx+.5,cz+.5,hx,hz);}
}
function pushOut(o,r,mx,mz,hx,hz){const nx=clamp(o.x,mx-hx,mx+hx),nz=clamp(o.z,mz-hz,mz+hz),ddx=o.x-nx,ddz=o.z-nz,d2=ddx*ddx+ddz*ddz;
  if(d2<r*r){if(d2>1e-8){const d=Math.sqrt(d2),k=(r-d)/d;o.x+=ddx*k;o.z+=ddz*k;}else{const px=hx+r-Math.abs(o.x-mx),pz=hz+r-Math.abs(o.z-mz);if(px<pz)o.x+=Math.sign(o.x-mx||1)*px;else o.z+=Math.sign(o.z-mz||1)*pz;}}}
// superficie su cui si può stare (pavimento, rampa o arredo basso)
function standTop(i,px,pz){const k=kind[i];if(k===K.FLOOR||(k===K.DOOR&&DOORS[doorOf[i]].open))return rampOf[i]>=0?rampH(RAMPS[rampOf[i]],px,pz):cellH[i];
  if(k===K.PROP&&(PROP_H[propCh[i]]||1)<=LOW_PROP)return propTop(i);return Infinity;}
function groundAt(x,z,y){const cx=Math.floor(x),cz=Math.floor(z);if(!inb(cx,cz))return P.h;const t=standTop(cellAt(cx,cz,y),x,z);return t===Infinity?P.h:t;}
function playerCollide(o,r){
  const cx0=Math.floor(o.x),cz0=Math.floor(o.z);
  for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){const cx=cx0+dx,cz=cz0+dz;let hx=.5,hz=.5,solid=true;
    if(inb(cx,cz)){const i=cellAt(cx,cz,o.h);
      if(region[i]>=0&&!regionOpen[region[i]]&&!(dx===0&&dz===0)){solid=true;}
      else if(kind[i]===K.PROP&&propCh[i]==='4'){hx=hz=.2;}
      else if(kind[i]===K.DOOR&&!DOORS[doorOf[i]].open&&DOORS[doorOf[i]].kind!=='debris'){if(DOORS[doorOf[i]].alongX)hx=.14;else hz=.14;}
      else if(kind[i]===K.PROP&&(PROP_H[propCh[i]]||1)>LOW_PROP&&COLCELL&&COLCELL.has(i)){for(const n of COLCELL.get(i)){const c=PROPCOL[n];if(c.y1<o.h+.45||c.y0>o.h+1.8)continue;
          if(c.t==='b')pushOut(o,r,(c.x0+c.x1)/2,(c.z0+c.z1)/2,(c.x1-c.x0)/2,(c.z1-c.z0)/2);else{const ddx=o.x-c.x,ddz=o.z-c.z,dd=Math.hypot(ddx,ddz),R=c.r+r;if(dd<R){if(dd>1e-6){o.x=c.x+ddx/dd*R;o.z=c.z+ddz/dd*R;}else o.x+=R;}}}continue;}
      else{const qx=clamp(o.x,cx,cx+1),qz=clamp(o.z,cz,cz+1);const top=standTop(i,qx,qz);
        if(top===Infinity)solid=true;else if(top>o.h+STEP+.02)solid=true;else if(top<o.h-1.2&&o.grounded)solid=true;else solid=false;
        if(solid&&dx===0&&dz===0&&top!==Infinity)solid=false;}}
    if(!solid)continue;pushOut(o,r,cx+.5,cz+.5,hx,hz);}
}
// forma vera degli arredi per i proiettili (non più tutta la cella fino in cima)
function propShape(i,cx,cz){const ch=propCh[i],h=cellH[i],rk=region[i]>=0?REG[region[i]].k:'';
  if(ch==='4')return M.id==='acciaieria'&&rk==='k'?{m:.2,top:h+4.4}:rk==='i'&&M.id==='acciaieria'?{m:.3,top:h+.7}:{m:.42,top:h+4.1};
  if(ch==='5')return rk==='k'?{m:.08,top:h+1.05}:{m:.04,top:h+1.05};
  if(ch==='*'){if(cellTag&&cellTag[i]===1)return {m:.04,top:h+1.3};if(cellTag&&cellTag[i]===2)return {m:.04,top:h+1.15};if(cellTag&&cellTag[i]===3)return {m:.04,top:h+1};if(cellTag&&cellTag[i]===4)return {m:.12,top:h+1.5};
    if(Box.spot>=0&&BOX_SPOTS[Box.spot].cells.some(([x,z])=>x===cx&&z===cz))return {m:.05,top:h+.95};return {m:.05,top:h+2.05};}
  return {m:.03,top:propTop(i)};}
function rayCyl(o,d,c,s0,s1){const ox=o.x-c.x,oz=o.z-c.z,a=d.x*d.x+d.z*d.z;let best=-1;
  if(a>1e-9){const b=2*(ox*d.x+oz*d.z),cc=ox*ox+oz*oz-c.r*c.r,D=b*b-4*a*cc;if(D>=0){const q=Math.sqrt(D);for(const t of[(-b-q)/(2*a),(-b+q)/(2*a)]){if(t<s0||t>s1)continue;const y=o.y+d.y*t;if(y>=c.y0&&y<=c.y1){best=t;break;}}}}
  if(Math.abs(d.y)>1e-9)for(const y of[c.y1,c.y0]){const t=(y-o.y)/d.y;if(t<s0||t>s1)continue;const x=ox+d.x*t,z=oz+d.z*t;if(x*x+z*z<=c.r*c.r&&(best<0||t<best))best=t;}
  if(best<0&&ox*ox+oz*oz<c.r*c.r){const y=o.y+d.y*s0;if(y>=c.y0&&y<=c.y1)best=s0;}return best;}
function rayBox(o,d,x0,x1,y0,y1,z0,z1,s0,s1){let a=s0,b=s1;const A=[[o.x,d.x,x0,x1],[o.y,d.y,y0,y1],[o.z,d.z,z0,z1]];
  for(const [oo,dd,mn,mx] of A){if(Math.abs(dd)<1e-9){if(oo<mn||oo>mx)return -1;continue;}let t1=(mn-oo)/dd,t2=(mx-oo)/dd;if(t1>t2){const q=t1;t1=t2;t2=q;}if(t1>a)a=t1;if(t2<b)b=t2;if(a>b)return -1;}return a;}
function propHit(i,cx,cz,o,d,s0,s1){let best=-1;const L=COLCELL.get(i);if(L)for(const n of L){const c=PROPCOL[n];const t=c.t==='b'?rayBox(o,d,c.x0,c.x1,c.y0,c.y1,c.z0,c.z1,s0,s1):rayCyl(o,d,c,s0,s1);if(t>=0&&(best<0||t<best))best=t;}
  const S=Box.spot>=0?BOX_SPOTS[Box.spot]:null;if(S&&Box.g.visible&&(S.l||0)===cL(i)&&S.cells.some(([x,z])=>x===cx&&z===cz)){const ry=Box.g.rotation.y,c=Math.abs(Math.cos(ry)),s=Math.abs(Math.sin(ry)),hw=.92*c+.42*s,hd=.92*s+.42*c;
    const t=rayBox(o,d,Box.cx-hw,Box.cx+hw,Box.h-1,Box.h+.9,Box.cz-hd,Box.cz+hd,s0,s1);if(t>=0&&(best<0||t<best))best=t;}return best;}
// più strati: in ogni colonna ci sono pavimenti con il loro solaio, muri e soffitti; conta il primo solido che il raggio incontra
function cellBlockL(cx,cz,o,d,s0,s1){const y0=o.y+d.y*s0,y1=o.y+d.y*s1;let best=-1;
  const hit=(a,b)=>{if(b<=a)return;if(y0>=a&&y0<=b){best=s0;return;}let t=-1;if(d.y>0&&y0<a&&y1>=a)t=(a-o.y)/d.y;else if(d.y<0&&y0>b&&y1<=b)t=(b-o.y)/d.y;if(t>=0&&(best<0||t<best))best=t;};
  for(let l=0;l<NL&&best!==s0;l++){const i=ix(cx,cz,l),k=kind[i];if(k===K.VOID){if(!l)hit(-99,0);continue;}const lo=l?cellB[i]-SLAB:-99;
    if(k===K.WALL||(k===K.DOOR&&!DOORS[doorOf[i]].open)){hit(lo,wallTop[i]);continue;}
    hit(lo,k===K.WATER?M.liquidH:cellH[i]);if(k===K.PROP){const t=propHit(i,cx,cz,o,d,s0,s1);if(t>=0&&(best<0||t<best))best=t;}
    const c=ceilAt(i);if(c<90)hit(c,upB[i]<90?upB[i]:99);}
  return best;}
function cellBlock(cx,cz,o,d,s0,s1){
  if(!inb(cx,cz)){const y1=o.y+d.y*s1;const fl=M.outside==='ground'?0:M.liquidH;if(y1<fl)return d.y<0?(fl-o.y)/d.y:s0;return -1;}
  if(NL>1)return cellBlockL(cx,cz,o,d,s0,s1);
  const i=ix(cx,cz),k=kind[i];if(k===K.WALL)return s0;if(k===K.DOOR&&!DOORS[doorOf[i]].open)return s0;
  const y0=o.y+d.y*s0,y1=o.y+d.y*s1,lo=Math.min(y0,y1),hi=Math.max(y0,y1);
  let fh=k===K.WATER?M.liquidH:cellH[i];
  if(k===K.PROP){let best=-1;const L=COLCELL.get(i);if(L)for(const n of L){const c=PROPCOL[n];const t=c.t==='b'?rayBox(o,d,c.x0,c.x1,c.y0,c.y1,c.z0,c.z1,s0,s1):rayCyl(o,d,c,s0,s1);if(t>=0&&(best<0||t<best))best=t;}
    if(Box.spot>=0&&Box.g.visible&&BOX_SPOTS[Box.spot].cells.some(([x,z])=>x===cx&&z===cz)){const ry=Box.g.rotation.y,c=Math.abs(Math.cos(ry)),s=Math.abs(Math.sin(ry)),hw=.92*c+.42*s,hd=.92*s+.42*c;
      const t=rayBox(o,d,Box.cx-hw,Box.cx+hw,Box.h-1,Box.h+.9,Box.cz-hd,Box.cz+hd,s0,s1);if(t>=0&&(best<0||t<best))best=t;}
    if(best>=0)return best;}
  if(lo<fh){if(y0<fh)return s0;return (fh-o.y)/d.y;}const c=ceilAt(i);if(hi>c){if(y0>c)return s0;return (c-o.y)/d.y;}return -1;
}
function shotDist(o,d,maxS){
  let cx=Math.floor(o.x),cz=Math.floor(o.z);const sx=d.x>0?1:-1,sz=d.z>0?1:-1;
  const tdx=Math.abs(d.x)>1e-6?Math.abs(1/d.x):1e9,tdz=Math.abs(d.z)>1e-6?Math.abs(1/d.z):1e9;
  let tmx=Math.abs(d.x)>1e-6?(d.x>0?cx+1-o.x:o.x-cx)/Math.abs(d.x):1e9,tmz=Math.abs(d.z)>1e-6?(d.z>0?cz+1-o.z:o.z-cz)/Math.abs(d.z):1e9,s0=0;
  for(let it=0;it<500;it++){const s1=Math.min(tmx,tmz,maxS);const r=cellBlock(cx,cz,o,d,s0,s1);if(r>=0)return Math.max(0,r);if(s1>=maxS)return maxS;if(tmx<tmz){cx+=sx;s0=tmx;tmx+=tdx;}else{cz+=sz;s0=tmz;tmz+=tdz;}}
  return maxS;
}

/* =========================================================
   HUD
   ========================================================= */
const H={hud:$('hud'),hurt:$('hurt'),lowhp:$('lowhp'),scope:$('scope'),xhair:$('xhair'),hitm:$('hitm'),dmgi:$('dmgi'),top:$('topmsg'),pups:$('pups'),prompt:$('prompt'),perks:$('perks'),zone:$('zone'),
  devbadge:$('devbadge'),keysHud:$('keysHud'),round:$('roundnum'),points:$('points'),popups:$('popups'),wname:$('wname'),ammo:$('ammo'),nades:$('nades'),debug:$('debug'),mapwrap:$('mapwrap'),mapcv:$('mapcv'),lockhint:$('lockhint')};
const last={};
function setText(el,key,v){if(last[key]!==v){last[key]=v;el.textContent=v;}}
function setHTML(el,key,v){if(last[key]!==v){last[key]=v;el.innerHTML=v;}}
let msgTimer=0;
function showMsg(html,dur=2.2){H.top.innerHTML=html;H.top.classList.add('show');msgTimer=dur;}
function popup(txt,neg){const s=document.createElement('span');s.textContent=txt;if(neg)s.className='neg';s.style.setProperty('--dy',(-20-Math.random()*40)+'px');s.style.top=(Math.random()*16-8)+'px';H.popups.appendChild(s);setTimeout(()=>s.remove(),950);}
function addPoints(n){const v=n*(doubleT>0?2:1);if(NET.credit){NET.credit.pend+=v;return;}/* colpo di un compagno: i punti vanno a lui */points+=v;earned+=v;popup('+'+v);}
function spend(n){if(DEV.on&&DEV.money){popup('-'+n,true);Sfx.buy();return true;}if(points<n){Sfx.deny();showMsg('Punti insufficienti',1.2);return false;}points-=n;popup('-'+n,true);Sfx.buy();return true;}
let hitmT=0;
function hitMarker(head){H.hitm.classList.toggle('head',!!head);H.hitm.classList.add('show');hitmT=head?.2:.12;}
function updatePerkIcons(){H.perks.innerHTML=[...perks].map(id=>PERKDEF[id]).filter(Boolean).map(p=>`<div class="perk" style="background:${p.css}" title="${p.name}">${p.letter}</div>`).join('');}
function dmgIndicator(fx,fz){if(fx==null)return;const dx=fx-P.x,dz=fz-P.z;const sy=Math.sin(P.yaw),cy=Math.cos(P.yaw);const lf=dx*-sy+dz*-cy,lr=dx*cy+dz*-sy;
  const a=Math.atan2(lr,lf);const el=document.createElement('div');el.className='dmgi';el.style.transform=`rotate(${a}rad)`;H.dmgi.appendChild(el);setTimeout(()=>el.remove(),1250);}

/* =========================================================
   ARMI
   ========================================================= */
const W_HIP=new THREE.Vector3(.2,-.22,-.5),W_ADS=new THREE.Vector3(0,-.118,-.34);
let vmDual=false,vmSide=0,fireCD2=0,triggerEdge2=true,rlEvI=0,rlKind='mag',bowDraw=0,bowCD=0,bowSnd=false;const ADS_POS=new THREE.Vector3();
const arrows=[];
function equipModel(){if(vmGun)vmRoot.remove(vmGun);const w=inv[cur];vmDual=!!wd(w).dual;
  if(vmDual){const g=new THREE.Group();const a=gunModel('pistol',true,true),b=gunModel('pistol',true,true);a.position.x=.165;b.position.x=-.165;b.scale.x=-1;a.rotation.y=.07;b.rotation.y=-.07;g.add(a);g.add(b);
    g.userData.muzzles=[a.userData.muzzle,b.userData.muzzle];g.userData.muzzle=a.userData.muzzle;g.userData.guns=[a,b];g.userData.parts={};g.userData.sight={y:.05,rz:.05,fz:-.3};vmGun=g;}
  else vmGun=gunModel(WEAPONS[w.id].model,true,w.pap);vmRoot.add(vmGun);
  const s=vmGun.userData.sight;ADS_POS.set(0,-s.y,-(s.rz+(vmGun.userData.optic?.2:.22)));if(WEAPONS[w.id].model==='bow')ADS_POS.set(-.016,-.058,-.54);
  rlKind=RELOAD_KIND[WEAPONS[w.id].model]||'mag';bowDraw=0;}
function switchTo(i,force){if(i<0||i>=inv.length||(i===cur&&!force))return;if(P.downT>0&&!force&&!LIGHT[inv[i].id])return;cur=i;reloadT=0;dRl.mL=dRl.mR=0;switchT=.42;equipModel();}
// quanto vale un'arma (per decidere quali tenere quando si perde Terza Mano)
const WSCORE={acida:88,spingarda:46,aurora:100,vortice:95,fulminatore:90,arco:80,orso:42,mastino:41,bisonte:43,aquila:38,falco:35,lupo:36,cervo:34,tuono:33,cinghiale:31,doppietta:29,vespa:28,faina:28,lince:25,toro:22,serpe:10,mani:-5};
function wScore(w){const b=WSCORE[w.id]??20;return b+(w.pap&&b<80?30:w.pap?5:0)-(w.temp?100:0);}
// l'Aurora non sparisce mai: se la lasci, torna nel suo sarcofago con le munizioni che aveva
function storeAurora(w){if(!Q3)return;Q3.aurora={mag:w.mag,reserve:w.reserve,pap:!!w.pap};Q3.reward.visible=true;Q3.rewardLight.intensity=2;showMsg("L'Aurora è tornata nel suo sarcofago<small>si ricarica di 5 colpi per ogni zombie ucciso</small>",3);}
function dropWeapon(w){if(w&&w.id==='aurora')storeAurora(w);}
function receiveWeapon(w){const mi=inv.findIndex(x=>x.id==='mani');if(mi>=0){inv[mi]=w;switchTo(mi,true);}else if(inv.length<maxSlots()){inv.push(w);switchTo(inv.length-1,true);}else{const old=inv[cur];inv[cur]=w;dropWeapon(old);switchTo(cur,true);}}
function trimInventory(){if(P.downT>0)return;const keep=inv[cur];let changed=false;
  while(inv.length>maxSlots()){let lo=0;for(let i=1;i<inv.length;i++)if(wScore(inv[i])<wScore(inv[lo]))lo=i;const [gone]=inv.splice(lo,1);dropWeapon(gone);changed=true;
    if(gone.id!=='mani'&&!gone.temp)showMsg(`Hai lasciato ${wd(gone).name}<small>senza Terza Mano porti solo due armi</small>`,2.6);}
  if(changed){const i=inv.indexOf(keep);switchTo(i>=0?i:0,true);}}
let carUnlocked=false;const CAR_CAP=4;
function giveWeapon(id){if(id==='carillon'){carUnlocked=true;carillons=Math.max(carillons,3);showMsg('Carillon ×3<small>lancialo per attirare gli zombie</small>',2);return;}
  if(M.id==='prigione'&&(id==='arco'||id==='aurora'))return;
  const d=WEAPONS[id],ex=inv.findIndex(w=>w.id===id);
  if(ex>=0){const e=wd(inv[ex]);inv[ex].mag=e.mag;inv[ex].reserve=e.reserve;switchTo(ex,true);return;}
  const nw={id,mag:d.mag,reserve:d.reserve};const mi=inv.findIndex(x=>x.id==='mani');if(mi>=0){inv[mi]=nw;switchTo(mi,true);return;}if(inv.length<maxSlots()){inv.push(nw);switchTo(inv.length-1,true);}else{const old=inv[cur];inv[cur]=nw;dropWeapon(old);switchTo(cur,true);}}
const DUAL_MAG=8;
function dualFix(w){if(w.mL==null||w.mR==null||w.mL+w.mR!==w.mag){w.mR=Math.min(DUAL_MAG,Math.ceil(w.mag/2));w.mL=Math.min(DUAL_MAG,w.mag-w.mR);w.mag=w.mL+w.mR;}}
const dRl={mL:0,mR:0},dDur={mL:1,mR:1};
function startReload(only){const w=inv[cur],d=wd(w);if(!w)return;if(d.infinite||w.forging||reloadT>0||switchT>0||w.mag>=d.mag||w.reserve<=0)return;
  if(d.dual){dualFix(w);const sides=(only||['mL','mR']).filter(k=>w[k]<DUAL_MAG&&dRl[k]<=0);if(!sides.length)return;const dur=d.reload*(perks.has('manolesta')?.5:1);sides.forEach(k=>{dRl[k]=dDur[k]=dur;});Sfx.rl('magOut');tryScossa(w,d);return;}
  reloadT=reloadDur=d.reload*(perks.has('manolesta')?.5:1);rlEvI=0;
  tryScossa(w,d);}
let zapQ=[],zapRegen=0;
// Scossa come la Electric Cherry: UNA scarica per ricarica, danno e raggio in base ai colpi sparati; 3 cariche che si ricaricano da sole (una ogni 5 s)
let zapCharges=3;
function tryScossa(w,d){if(!perks.has('scossa')||zapCD>0||zapCharges<1)return;const f=1-w.mag/d.mag;if(f<.25)return;zapCharges--;zapCD=1;const dmg=(250+round*35)*(.35+.65*f),R=3+4*f;zapQ=[{t:0,dmg,R,first:true}];}
function updateZap(dt){if(zapCharges<3){zapRegen=(zapRegen||0)+dt;if(zapRegen>=5){zapRegen=0;zapCharges++;}}else zapRegen=0;for(let i=zapQ.length-1;i>=0;i--){zapQ[i].t-=dt;if(zapQ[i].t<=0){const q=zapQ[i];zapQ.splice(i,1);scossa(q.dmg,q.R,q.first);}}}
const CHEST=new THREE.Vector3(),ZP=new THREE.Vector3();
function scossa(dmg,R,first){R=R||7;Sfx.zap();Sfx.thunder();CHEST.set(P.x-Math.sin(P.yaw)*.7,P.h+1.05,P.z-Math.cos(P.yaw)*.7);boomLight.color.set(0x7ab8ff);boomLight.position.set(P.x,P.h+1.5,P.z);boomLight.intensity=4;
  let n=0;for(const z of zombies){if(!z.active||z.state==='dying')continue;const dd=Math.hypot(z.x-P.x,z.z-P.z);if(dd<R&&Math.abs(z.h-P.h)<2.5){z.stagger=.8;z.twitch=.5;if(first)z.stunT=z.boss?1:3.2;z.attackT=0;
      if(n<8){ZP.set(z.x,z.h+1.1*(z.g.scale.x),z.z);bolt(CHEST,ZP,.35);n++;}emit({x:z.x,y:z.h+1.2,z:z.z},8,.6,.8,1,2.5,1);damageZombie(z,dmg,'body','zap',{});}}
  for(let k=n;k<Math.max(6,n+2);k++){const a=Math.random()*Math.PI*2,r=rand(1.5,R-.5);ZP.set(P.x+Math.cos(a)*r,hAt(P.x+Math.cos(a)*r,P.z+Math.sin(a)*r,P.h),P.z+Math.sin(a)*r);bolt(CHEST,ZP,.25);}
  emit({x:P.x,y:P.h+1,z:P.z},30,.55,.75,1,4,1.2,2);}
const ray=new THREE.Raycaster(),vO=new THREE.Vector3(),vD=new THREE.Vector3(),vT=new THREE.Vector3(),hitList=[];
function buildHitList(){hitList.length=0;for(const z of zombies)if(z.active&&z.state!=='dying'){z.g.updateMatrixWorld(true);for(const m of z.hits)hitList.push(m);}}
function currentSpread(){const d=wd(inv[cur]),mv=Math.min(1,Math.hypot(P.vx,P.vz)/4.5);return (d.spread+mv*.03+bloom+(P.grounded?0:.04))*(adsT>.5?(d.scope?.05:.22):(vmGun&&vmGun.userData.laser?.6:1));}
// bersagli speciali degli easter egg (campane, teschi, bracieri, occhi rossi)
function eggTargets(src){const t=[];if(M.id==='cascate'&&TOWN&&TOWN.pumpkins)TOWN.pumpkins.forEach(p=>{if(!p.hit)t.push(p.m);});if(Q2&&Q2.step===1&&src!=='arrow')Q2.lamps.forEach(l=>{if(!l.shot)t.push(l.s);});
  if(Q3){Q3.bells.forEach(b=>t.push(b.hit));if(src==='arrow'){Q3.skulls.forEach(s=>{if(s.st==='wall')t.push(s.hit);});Q3.braziers.forEach(b=>t.push(b.hit));}}t.forEach(o=>o.updateWorldMatrix(true,false));return t;}
function eggHit(obj,src,pt){
  if(M.id==='cascate'&&TOWN&&TOWN.pumpkins){const pk=TOWN.pumpkins.find(p=>p.m===obj);if(pk){pumpkinHit(pk,pt);return;}}/* zucche: easter egg personale, anche online */
  if(NET.client){/* online decide l'host: gli dico cosa ho colpito e intanto faccio vedere e sentire il colpo */
    let k=null,i=-1;if(Q2){i=Q2.lamps.findIndex(l=>l.s===obj);if(i>=0)k='lamp';}
    if(!k&&Q3)for(const [kk,arr] of [['bell',Q3.bells],['skull',Q3.skulls],['brazier',Q3.braziers]]){i=arr.findIndex(o=>o.hit===obj);if(i>=0){k=kk;break;}}
    if(!k)return;netReq({t:'q',a:'hit',k,i});
    if(k==='lamp'){Sfx.zap();emit(pt,16,.3,1,.4,2,1);}else if(k==='bell'){Q3.bells[i].swing=1;Sfx.bell();}
    else if(k==='skull'&&Q3.step>=2&&Q3.skulls[i].st==='wall'){const w=inv.find(x=>x.id==='arco');if(w)w.reserve++;}else if(k==='brazier')Sfx.arrowHit();return;}
  if(Q2&&Q2.step===1){const L=Q2.lamps.find(l=>l.s===obj);if(L){L.shot=true;L.mat.color.set(0x3cff6a);Sfx.zap();emit(pt,16,.3,1,.4,2,1);egg2Lamp();return;}}
  if(!Q3)return;const b=Q3.bells.find(b=>b.hit===obj);if(b){egg3Bell(b);return;}
  const s=Q3.skulls.find(s=>s.hit===obj);if(s){egg3Skull(s);return;}const br=Q3.braziers.find(b=>b.hit===obj);if(br)egg3Brazier(br);}
function fire(side){
  const w=inv[cur],d=wd(w);if(w.forging||shieldUp)return;
  if(d.special==='bow'||d.special==='none')return;
  let dk=null;if(vmDual){dualFix(w);dk=side===1?'mL':'mR';if(dRl[dk]>0)return;if(w[dk]<=0){if(w.reserve>0)startReload([dk]);else Sfx.empty();if(side===1)fireCD2=.25;else fireCD=.25;return;}}
  else if(w.mag<=0){if(w.reserve>0)startReload();else{Sfx.empty();fireCD=.25;}return;}
  const dt2=perks.has('doppio');if(!(DEV.on&&DEV.ammo)){if(dk){w[dk]--;w.mag=w.mL+w.mR;}else w.mag--;}const cd=60/d.rpm*(dt2?.75:1);if(side===1)fireCD2=Math.max(cd,.09);else fireCD=vmDual?Math.max(cd,.09):cd;bloom=Math.min(bloom+d.bloom,.08);
  Sfx.shot(d.snd);NET.shots++;recoilP+=d.kick*(adsT>.5?.55:1);vmKick=1;
  if(vmDual){vmSide=side?1:0;vmGun.userData.muzzle=vmGun.userData.muzzles[vmSide];vmGun.userData.guns[vmSide].position.z=.05;}
  flash.visible=true;flash.material.rotation=Math.random()*6;flash.scale.setScalar(d.wonder?.22:.16);flashMat.color.set(d.special==='vortex'?0xb77dff:d.model==='ray'?0x7dff9a:d.beam?d.beam:d.pap?0xffa060:0xffffff);
  muzzleLight.color.set(d.special==='vortex'?0xb77dff:d.model==='ray'?0x7dff9a:d.beam?d.beam:0xffc27a);muzzleLight.intensity=2.2;
  camera.updateMatrixWorld();camera.getWorldPosition(vO);buildHitList();
  const spread=currentSpread(),acc=new Map();let any=false,anyHead=false;const ET=eggTargets('gun');
  for(let p=0;p<d.pellets;p++){
    const a=Math.random()*Math.PI*2,r=Math.sqrt(Math.random())*spread;vD.set(Math.cos(a)*r,Math.sin(a)*r,-1).normalize().applyQuaternion(aimQuat());
    const tw=shotDist(vO,vD,90);ray.set(vO,vD);ray.near=0;ray.far=tw+.4;
    if(ET.length){const eh=ray.intersectObjects(ET,false);if(eh.length)eggHit(eh[0].object,'gun',eh[0].point);}
    ray.far=tw;const hits=ray.intersectObjects(hitList,false);let pt;
    if(d.special==='vortex'){const hd=hits.length?hits[0].distance:1e9;placeVortex(vO,vD,Math.min(hd,tw-.9,9.5),d);continue;}
    if(d.special==='acid'){const h0=hits[0],zb=h0?h0.object.userData.z:null;addAcid(h0?h0.point:vT.copy(vO).addScaledVector(vD,Math.max(.2,tw-.05)),zb,!!w.pap);
      if(zb){const e=acc.get(zb)||{dmg:0,head:false,leg:0,legSide:null,fx:P.x,fz:P.z};e.dmg+=d.dmg;acc.set(zb,e);any=true;}continue;}
    const seen=new Set();let n=0;
    for(const h0 of hits){const z=h0.object.userData.z;if(seen.has(z))continue;seen.add(z);const part=h0.object.userData.part;pt=h0.point;
      const hsm=d.hs*(perks.has('occhio')?2:1);let dmg=d.dmg*(dt2?1.5:1)*(part==='head'?hsm:(part==='arm'||part==='legL'||part==='legR')?.85:1);
      if((z.fond||z.boss)&&part!=='head'){dmg=0;emit(pt,5,1,.8,.4,2.2,.6);Sfx.empty();}
      const e=acc.get(z)||{dmg:0,head:false,leg:0,legSide:null,fx:P.x,fz:P.z};e.dmg+=dmg;e.head=e.head||part==='head';if(part==='legL'||part==='legR'){e.leg+=dmg;e.legSide=part;}acc.set(z,e);any=true;anyHead=anyHead||part==='head';
      if(dmg>0)emit(pt,part==='head'?10:6,.5,.04,.03,1.6,.8);n++;if(n>=(d.pen||1))break;}
    if(!pt){pt=vT.copy(vO).addScaledVector(vD,tw);emit(pt,4,.55,.53,.47,1.1,.6);}
    if(d.beam){const arr=tracer.geometry.attributes.position.array;vmGun.userData.muzzle.getWorldPosition(vT);arr[0]=vO.x+vD.x*.6;arr[1]=vO.y-.1;arr[2]=vO.z+vD.z*.6;arr[3]=pt.x;arr[4]=pt.y;arr[5]=pt.z;tracer.material.color.set(d.beam);tracer.geometry.attributes.position.needsUpdate=true;tracer.visible=true;tracerT=.05;
      emit(pt,3,1,.35,.2,1.2,.4);}
    if(d.splash){fxExplosion(pt.x,pt.y,pt.z,d.model==='ray'?.45:.5,d.model==='ray'?0x7dff9a:null);boomLight.color.set(d.model==='ray'?0x7dff9a:0xff9a40);boomLight.position.copy(pt);boomLight.intensity=2.5;
      if(d.model!=='ray')Sfx.boom(Math.hypot(P.x-pt.x,P.z-pt.z)+6);{const sd=Math.hypot(P.x-pt.x,P.z-pt.z,P.h+1-pt.y),rr=d.splash.r*.85;if(!perks.has('cadutalibera')&&sd<rr)hurtPlayer(Math.round((d.model==='ray'?60:40)*(1-sd/rr))+5,pt.x,pt.z,true);}for(const z of zombies){if(!z.active||z.state==='dying')continue;const dd=Math.hypot(z.x-pt.x,z.z-pt.z);
      if(dd<d.splash.r&&Math.abs(z.h+.5-pt.y)<2.2){const e=acc.get(z)||{dmg:0,head:false,leg:0,legSide:null,fx:P.x,fz:P.z};const sd=d.splash.dmg*(1-dd/d.splash.r*.7)*((z.fond||z.boss)?.15:1);e.dmg+=sd;e.splash=true;acc.set(z,e);any=true;}}
      if(!d.beam){const arr=tracer.geometry.attributes.position.array;arr[0]=vO.x+vD.x*.6;arr[1]=vO.y-.12;arr[2]=vO.z+vD.z*.6;arr[3]=pt.x;arr[4]=pt.y;arr[5]=pt.z;tracer.material.color.set(d.pap?0xff7a2a:0x7dff9a);tracer.geometry.attributes.position.needsUpdate=true;tracer.visible=true;tracerT=.1;}}
  }
  for(const [z,e] of acc)if(e.dmg>0)damageZombie(z,e.dmg,e.head?'head':'body','gun',e);if(any){hitMarker(anyHead);if(!anyHead)Sfx.hit();}/* in testa: solo la X sul mirino, niente suono (come in COD Zombies) */
}
// buco nero: nasce vicino all'arma, prima di muri e soffitti
function placeVortex(o,dir0,dist,d){const hl=Math.hypot(dir0.x,dir0.z);const dir=hl>.25?dir0:new THREE.Vector3(-Math.sin(P.yaw)*.9,dir0.y,-Math.cos(P.yaw)*.9);dist=Math.max(2.2/Math.max(.35,Math.hypot(dir.x,dir.z)),dist);let x=o.x+dir.x*dist,z=o.z+dir.z*dist;
  for(let k=0;k<14;k++){const cx=Math.floor(x),cz=Math.floor(z);if(inb(cx,cz)&&walkable(cellAt(cx,cz,P.h))&&Math.abs(hAt(x,z,P.h)-P.h)<3.5)break;dist-=.5;x=o.x+dir.x*dist;z=o.z+dir.z*dist;if(dist<1.2){x=P.x+dir.x*1.4;z=P.z+dir.z*1.4;break;}}
  const fl=hAt(x,z,P.h),ci=inb(Math.floor(x),Math.floor(z))?cellAt(Math.floor(x),Math.floor(z),P.h):-1,cl=ci>=0?ceilAt(ci):99;const y=clamp(o.y+dir.y*dist,fl+.7,Math.min(fl+1.7,cl-.6));
  const pt=new THREE.Vector3(x,y,z);spawnVortex(pt,d);if(NET.client)netReq({t:'vortex',x:r2(x),y:r2(y),z:r2(z),w:inv[cur].id,pp:inv[cur].pap?1:0});
  const arr=tracer.geometry.attributes.position.array;arr[0]=o.x+dir.x*.6;arr[1]=o.y-.12;arr[2]=o.z+dir.z*.6;arr[3]=pt.x;arr[4]=pt.y;arr[5]=pt.z;tracer.material.color.set(0xb77dff);tracer.geometry.attributes.position.needsUpdate=true;tracer.visible=true;tracerT=.15;}
/* ---------- arco: si tende tenendo premuto, la freccia infuocata parte al rilascio ---------- */
const arrowGeo=new THREE.CylinderGeometry(.012,.012,.75,5);arrowGeo.rotateX(Math.PI/2);
function shootArrow(k){camera.updateMatrixWorld();camera.getWorldPosition(vO);vD.set(0,0,-1).applyQuaternion(aimQuat());const sp=22+38*k;
  const g=new THREE.Group();const m=new THREE.Mesh(arrowGeo,MAT.wood);g.add(m);const f=new THREE.Sprite(new THREE.SpriteMaterial({map:fireTex,color:0xff8a3a,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));f.scale.setScalar(.35+k*.3);f.position.z=-.4;g.add(f);scene.add(g);
  arrows.push({g,x:vO.x+vD.x*.4,y:vO.y+vD.y*.4-.05,z:vO.z+vD.z*.4,vx:vD.x*sp,vy:vD.y*sp,vz:vD.z*sp,k,t:0,stuck:false});Sfx.bowShot(k);NET.shots++;vmKick=.6;}
const aO=new THREE.Vector3(),aD=new THREE.Vector3();
function updateArrows(dt){for(let i=arrows.length-1;i>=0;i--){const A=arrows[i];A.t+=dt;
  if(A.stuck){if(A.t>4){scene.remove(A.g);arrows.splice(i,1);}continue;}
  A.vy-=6*dt;const sp=Math.hypot(A.vx,A.vy,A.vz),step=sp*dt;aO.set(A.x,A.y,A.z);aD.set(A.vx/sp,A.vy/sp,A.vz/sp);
  const tw=shotDist(aO,aD,step+.05);buildHitList();ray.set(aO,aD);ray.near=0;ray.far=Math.min(tw,step)+.05;
  const ET=eggTargets('arrow');let done=false;
  if(ET.length){const eh=ray.intersectObjects(ET,false);if(eh.length){eggHit(eh[0].object,'arrow',eh[0].point);arrowBurst(eh[0].point,A.k,true);done=true;}}
  if(!done){const hz=ray.intersectObjects(hitList,false);if(hz.length){const z=hz[0].object.userData.z,part=hz[0].object.userData.part;const hsm=2*(perks.has('occhio')?2:1);
      const w=inv.find(x=>x.id==='arco');const mul=(w&&w.pap?2:1)*(.4+A.k*.6);let dmg=(650+round*60)*mul*(part==='head'?hsm:1);if((z.fond||z.boss)&&part!=='head')dmg*=.15;
      damageZombie(z,dmg,part==='head'?'head':'body','arrow',{});hitMarker(part==='head');arrowBurst(hz[0].point,A.k,false);done=true;}}
  if(!done&&tw<step){const pt=aO.clone().addScaledVector(aD,tw);arrowBurst(pt,A.k,false);A.x=pt.x;A.y=pt.y;A.z=pt.z;A.stuck=true;A.t=0;A.g.children[1].visible=false;A.g.position.set(A.x,A.y,A.z);continue;}
  if(done){scene.remove(A.g);arrows.splice(i,1);continue;}
  A.x+=A.vx*dt;A.y+=A.vy*dt;A.z+=A.vz*dt;A.g.position.set(A.x,A.y,A.z);A.g.lookAt(A.x+A.vx,A.y+A.vy,A.z+A.vz);A.g.rotateY(Math.PI);if(A.t>5){scene.remove(A.g);arrows.splice(i,1);}}}
function arrowBurst(pt,k,quiet){Sfx.arrowHit();fxExplosion(pt.x,pt.y,pt.z,.3+k*.25);if(quiet)return;const w=inv.find(x=>x.id==='arco');const r=2+k*1.2;
  for(const z of zombies){if(!z.active||z.state==='dying')continue;const dd=Math.hypot(z.x-pt.x,z.z-pt.z);if(dd<r&&Math.abs(z.h+.8-pt.y)<2)damageZombie(z,(200+round*25)*(1-dd/r)*((z.fond||z.boss)?.15:1)*(w&&w.pap?2:1),'body','arrow',{splash:true});}}
/* ---------- coltello: fendente orizzontale ---------- */
function knife(){if(knifeCD>0||switchT>0||P.dead)return;knifeCD=.55;knifeT=.32;reloadT=0;Sfx.swing();if(shieldUp){setTimeout(shieldBash,110);return;}
  const fx=-Math.sin(P.yaw),fz=-Math.cos(P.yaw);const hits=[];
  for(const z of zombies){if(!z.active||z.state==='dying'||z.state==='approach'||z.state==='scale')continue;const dx=z.x-P.x,dz=z.z-P.z,d=Math.hypot(dx,dz);if(d<2.1&&(dx*fx+dz*fz)/Math.max(d,.01)>.3&&Math.abs(z.h-P.h)<1.3)hits.push([d,z]);}
  hits.sort((a,b)=>a[0]-b[0]);const tg=hits.slice(0,2).map(h=>h[1]);
  if(tg.length)setTimeout(()=>{tg.forEach((best,i)=>{if(best.active&&best.state!=='dying'){emit({x:best.x,y:best.h+1.2,z:best.z},10,.5,.04,.03,1.8,.6);damageZombie(best,(i?90:150)*((best.fond||best.boss)?.15:1),'body','knife',{fx:P.x,fz:P.z});}});Sfx.hit();hitMarker(false);},110);}
function damageZombie(z,dmg,part,src,e){
  if(!z.active||z.state==='dying')return;
  if(NET.client){/* online gli zombie sono dell'host: gli mando il colpo */netReq({t:'hit',z:zombies.indexOf(z),d:Math.round(dmg),p:part,s:src,l:e&&e.leg?Math.round(e.leg):0,sp:e&&e.splash?1:0});
    if(!z.boss&&src!=='zap'&&src!=='web'){z.flinch=.28;z.fdir=Math.random()<.5?-1:1;}return;}
  if(instaT>0&&!z.fond&&!z.boss)dmg=z.hp+1;z.hp-=dmg;
  if(z.boss&&Q3)Q3.bossHp=Math.max(0,z.hp/z.maxHp);
  if(z.hp<=0){killZombie(z,part==='head',src);return;}
  // colpito: arretra un poco e perde slancio, come in COD (più forte il colpo, più arretra)
  if(!z.boss&&e&&e.fx!=null&&z.state==='chase'){const dx=z.x-e.fx,dz=z.z-e.fz,l=Math.hypot(dx,dz)||1,k=Math.min(.32,.05+dmg/z.maxHp*.45)*(z.fond?.4:1);
    z.x+=dx/l*k;z.z+=dz/l*k;collide(z,.3,z.h);z.vel=(z.vel||0)*.35;}
  if(src!=='zap'&&src!=='web'&&src!=='trap')addPoints(10);if(!z.boss){z.flinch=.28;z.fdir=Math.random()<.5?-1:1;z.stagger=Math.max(z.stagger||0,z.fond?.1:.3);}
  if(!z.crawl&&!z.fond&&!z.boss&&z.state==='chase'&&e&&((e.leg>z.maxHp*.35&&Math.random()<.5)||(e.splash&&Math.random()<.3))){makeCrawler(z);}
}
function makeCrawler(z){z.crawl=true;z.B.knL.scale.setScalar(.001);z.B.knR.scale.setScalar(.001);z.B.hipL.scale.set(1,.42,1);z.B.hipR.scale.set(1,.42,1);
  emit({x:z.x,y:z.h+.5,z:z.z},26,.5,.03,.02,1.6,.6);emit({x:z.x,y:z.h+.3,z:z.z},10,.6,.5,.45,1.4,.4);}
function killZombie(z,head,src){
  if(NET.client)return;const cr=NET.credit,st0=z.state;
  z.state='dying';z.deathT=head?-.25:0;z.fall=Math.random()<.6?1:-1;z.vanish=src==='vortex';alive--;if(cr)cr.pk++;else kills++;z.webT=0;z.webS.visible=false;z.orbit=null;
  if(z.win&&z.win.occupant===z)z.win.occupant=null;if(z.win&&z.win.climbers)z.win.climbers=z.win.climbers.filter(q=>q!==z);z.lane=null;
  if(head){if(cr)cr.ph++;else heads++;z.B.head.scale.setScalar(.001);emit({x:z.x,y:z.h+1.7,z:z.z},24,.55,.03,.02,2.2,1.4);}else if(!z.vanish){const a=sndAt(z.x,z.h+1,z.z);Sfx.die(a.d,a.pan,a.oc);}
  if(src==='knife')addPoints(130);else if(src!=='bomb'&&src!=='trap')addPoints(head?100:60);/* trappole: niente punti, come in COD */
  if(src!=='bomb'&&pupDrops<4&&!z.boss&&Math.random()<.035)dropPowerup(z.x,z.z,z.h,z,st0);
  if(z.fond||z.boss){fxExplosion(z.x,z.h+1,z.z,z.boss?1:.6);Sfx.boom(Math.hypot(P.x-z.x,P.z-z.z));const dd=Math.hypot(P.x-z.x,P.z-z.z);if(dd<2.4&&Math.abs(P.h-z.h)<2)hurtPlayer(30,z.x,z.z,true);netHurtNear(z.x,z.z,z.h,2.4,30,true);if(z.fond){addPoints(500);egg2OnFondKill(z);}}
  if(z.boss)egg3BossDead(z);
  questOnKill(z);egg3OnKill(z);egg4OnKill(z);
  if(Q3&&Q3.aurora){const a=Q3.aurora,d=a.pap?WPAP.aurora:WEAPONS.aurora;let n=5;const r=Math.min(n,d.reserve-a.reserve);a.reserve+=r;n-=r;a.mag=Math.min(d.mag,a.mag+n);}
}
function grenCap(){return perks.has('telanera')?6:4;}
/* colpi corpo a corpo: fino a 3 colpi (di zombie diversi) che arrivano insieme, entro MELEE_WIN, contano tutti;
   dopo il terzo, o finita la finestra, parte la pausa MELEE_CD prima del colpo successivo (così circondato vai giù) */
let meleeIT=0,meleeWinT=0,meleeN=0;const MELEE_WIN=.22,MELEE_CD=.32,MELEE_MAX=3;
function meleeTick(dt){if(meleeIT>0)meleeIT-=dt;if(meleeWinT>0){meleeWinT-=dt;if(meleeWinT<=0)meleeIT=MELEE_CD;}}
function hurtPlayer(d,fromX,fromZ,expl){
  if((state!=='playing'&&!(NET.on&&state==='paused'))||invulnT>0||P.bleed||P.dead)return;/* online la pausa non ferma gli zombie */
  if(!expl){if(meleeIT>0)return;if(meleeWinT<=0){meleeWinT=MELEE_WIN;meleeN=0;}if(++meleeN>=MELEE_MAX){meleeWinT=0;meleeIT=MELEE_CD;}}dmgIndicator(fromX,fromZ);
  if(!expl&&P.shield&&fromX!=null){const ax=fromX-P.x,az=fromZ-P.z,l=Math.hypot(ax,az)||1,dot=(-Math.sin(P.yaw)*ax-Math.cos(P.yaw)*az)/l;if((shieldUp&&dot>-.15)||(!shieldUp&&dot<-.3)){shieldBlock();return;}}
  if(!expl&&perks.has('telanera')&&webCD<=0&&grenades>0){grenades--;webCD=2.5;blackBurst();}
  if(DEV.on&&DEV.god){hurtFlash=.35;shakeT=.15;Sfx.hurt();return;}
  P.hp-=d;P.hurtT=0;hurtFlash=1;shakeT=.28;grabT=expl?0:.2;if(expl||meleeN<=1)Sfx.hurt();else Sfx.hit();/* più colpi insieme: un solo lamento, gli altri sono botte */padRumble(.7,.4,220);
  if(fromX!=null&&!expl){const dx=P.x-fromX,dz=P.z-fromZ,l=Math.hypot(dx,dz)||1;P.vx+=dx/l*1.6;P.vz+=dz/l*1.6;}
  if(P.hp<=0){if(perks.has('secondavita')){goDown();return;}
    if(NET.on){netGoDown();return;}/* in coop si va a terra e un compagno ti può rialzare */
    P.hp=0;gameOver();}
}
// Scoppio Nero: una granata brucia addosso a te e respinge tutto
// Seconda Vita: vai a terra, poi ti rialzi senza nessuna bevanda
const LIGHT={vortice:6,fulminatore:5,serpe:3,toro:2};
function downWeapon(){P.downPrev=inv[cur];const cand=inv.filter(w=>LIGHT[w.id]&&!w.forging).sort((a,b)=>(LIGHT[b.id]+(b.pap?.5:0))-(LIGHT[a.id]+(a.pap?.5:0)));
  let lw=cand[0];if(!lw){lw={id:'serpe',mag:8,reserve:40,temp:true};inv.push(lw);}reloadT=0;cur=inv.indexOf(lw);switchT=.3;equipModel();}
function goDown(){P.downT=4.2;downWeapon();
  P.hp=1;invulnT=4.6;perks.clear();applyPerks();P.hp=1;updatePerkIcons();reviveBuys=reviveBuys;trigger=false;ads=false;Sfx.down();/* il colpo l'ha già suonato hurtPlayer: due insieme saturavano */
  showMsg('Sei a terra<small>Seconda Vita ti sta rimettendo in piedi…</small>',4);canvas.style.filter='grayscale(.85) brightness(.8)';
  for(const z of zombies){if(!z.active||z.state==='dying')continue;const dd=Math.hypot(z.x-P.x,z.z-P.z);if(dd<4){z.stagger=2.5;const l=dd||1;z.x+=(z.x-P.x)/l*1.2;z.z+=(z.z-P.z)/l*1.2;}}}
function updateDown(dt){if(!(P.downT>0))return;P.downT-=dt;P.hp=Math.max(P.hp,1);
  if(P.bleed){if(P.downT<=0)netBleedOut();return;}/* a terra online: aspetta un compagno */
  if(P.downT<=0)riseUp();}
function riseUp(by){P.downT=0;P.bleed=false;P.hp=P.maxHp;invulnT=2.2;canvas.style.filter='';Sfx.power();
  for(let i=inv.length-1;i>=0;i--)if(inv[i].temp)inv.splice(i,1);if(!inv.length)inv.push({id:'serpe',mag:8,reserve:80});{const pi=inv.indexOf(P.downPrev);cur=pi>=0?pi:0;}trimInventory();switchTo(Math.min(cur,inv.length-1),true);
  showMsg(by?`${esc(by)} ti ha rialzato`:'Ti sei rialzato<small>hai perso tutte le bevande</small>',3);for(const z of zombies){if(!z.active||z.state==='dying')continue;const dd=Math.hypot(z.x-P.x,z.z-P.z);if(dd<4.5&&!z.boss){z.stagger=2;const l=dd||1;z.x+=(z.x-P.x)/l*1.5;z.z+=(z.z-P.z)/l*1.5;}}}
function blackBurst(){Sfx.boom(2);Sfx.web();fxRing(P.x,P.h,P.z,4.5,.45,0x2a2a38);fxPuff('smoke',P.x,P.h+1,P.z,.8,4,.9,0,.6,0,0x222230);emit({x:P.x,y:P.h+1,z:P.z},40,.2,.2,.25,5,1,1.5,[.4,.8]);shakeT=Math.max(shakeT,.3);
  for(const z of zombies){if(!z.active||z.state==='dying')continue;const dx=z.x-P.x,dz=z.z-P.z,dd=Math.hypot(dx,dz);if(dd<4.5&&Math.abs(z.h-P.h)<2){
    damageZombie(z,(300+round*40)*((z.fond||z.boss)?.15:1),'body','web',{});if(z.active&&z.state!=='dying'&&!z.boss&&z.state==='chase'){const f=1-dd/4.5,l=dd||1;z.knock={t:0,vx:dx/l*(3+4*f),vz:dz/l*(3+4*f),vy:2+2*f,y:0};z.attackT=0;}}}}
function webBurst(){blackBurst();}

/* ---------- esplosivi, carillon, vortice ---------- */
const nadeGeo=new THREE.SphereGeometry(.07,8,6),nadeMat=LM({color:0x3a4a2a});
function throwItem(type){
  if(throwT>0||knifeT>0||P.dead)return;if(type==='nade'){if(grenades<=0){Sfx.empty();return;}grenades--;}else{if(carillons<=0){Sfx.empty();return;}carillons--;}
  throwT=.35;Sfx.pin();camera.updateMatrixWorld();camera.getWorldPosition(vO);vD.set(0,0,-1).applyQuaternion(aimQuat());
  const mesh=type==='nade'?new THREE.Mesh(nadeGeo,nadeMat):gunModel('carillon',false);if(type==='carillon')mesh.scale.setScalar(1.3);scene.add(mesh);
  projectiles.push({type,mesh,x:vO.x+vD.x*.5,y:vO.y+vD.y*.5-.1,z:vO.z+vD.z*.5,vx:vD.x*13+P.vx*.5,vy:vD.y*13+3.2,vz:vD.z*13+P.vz*.5,t:type==='nade'?2.4:12,settled:false});
}
function projSolid(x,z,y){const cx=Math.floor(x),cz=Math.floor(z);if(!inb(cx,cz))return true;const i=cellAt(cx,cz,y),k=kind[i];
  if(k===K.WALL||k===K.BARS||k===K.WIN)return true;if(k===K.DOOR&&!DOORS[doorOf[i]].open)return true;if(k===K.PROP&&y<propTop(i))return true;if(k===K.VOID)return y<.1;return false;}
function projFloor(x,z,y){const cx=Math.floor(x),cz=Math.floor(z);if(!inb(cx,cz))return M.outside==='ground'?0:M.liquidH;const i=cellAt(cx,cz,y);if(kind[i]===K.WATER)return M.liquidH;if(kind[i]===K.PROP)return propTop(i);return hAt(x,z,y);}
function updateProjectiles(dt){
  for(let i=projectiles.length-1;i>=0;i--){const p=projectiles[i];
    if(!p.settled){for(let s=0;s<2;s++){const h=dt/2;p.vy-=18*h;let nx=p.x+p.vx*h,nz=p.z+p.vz*h,ny=p.y+p.vy*h;
        if(projSolid(nx,p.z,ny)){p.vx*=-.45;nx=p.x;}if(projSolid(nx,nz,ny)){p.vz*=-.45;nz=p.z;}
        const fl=projFloor(nx,nz,p.y);if(ny<fl){ny=fl;p.vy=-p.vy*.3;p.vx*=.6;p.vz*=.6;if(Math.abs(p.vy)<1)p.vy=0;}
        const ci=inb(Math.floor(nx),Math.floor(nz))?cellAt(Math.floor(nx),Math.floor(nz),p.y):-1;const c=ci>=0?ceilAt(ci):99;if(ny>c-.1){ny=c-.1;p.vy=-Math.abs(p.vy)*.3;}
        p.x=nx;p.y=ny;p.z=nz;}
      p.mesh.rotation.x+=dt*8;p.mesh.rotation.z+=dt*5;
      if(p.type==='carillon'&&Math.hypot(p.vx,p.vy,p.vz)<.9&&p.y<=projFloor(p.x,p.z,p.y)+.02){p.settled=true;p.mesh.rotation.set(0,rand(0,6),0);lure={x:p.x,z:p.z,h:p.y,t:7,noteT:0,note:0,p};computeFlow();showMsg('Il carillon suona…',1.4);if(NET.client)netReq({t:'lure',x:r2(p.x),z:r2(p.z),h:r2(p.y)});}}
    p.mesh.position.set(p.x,p.y+(p.type==='nade'?.07:.12),p.z);
    if(p.type==='nade'){p.t-=dt;if(p.t<=0){explode(p.x,p.y+.3,p.z,4.2,300+round*45,'nade',{});scene.remove(p.mesh);projectiles.splice(i,1);}}
    else if(p.settled&&lure&&lure.p===p){lure.t-=dt;lure.noteT-=dt;p.mesh.rotation.y+=dt*2;if(lure.noteT<=0){lure.noteT=.24;Sfx.carillonNote(lure.note++);}
      if(lure.t<=0){explode(p.x,p.y+.4,p.z,5.5,3000+round*200,'nade',{});scene.remove(p.mesh);projectiles.splice(i,1);lure=null;computeFlow();}}
    else{p.t-=dt;if(p.t<=0){scene.remove(p.mesh);projectiles.splice(i,1);}}
  }
}
function explode(x,y,z,r,dmg,src,opt){
  fxExplosion(x,y,z,opt.sc||r/4.2,opt.col);if(NET.on&&NET.started)netFx(x,y,z,opt.sc||r/4.2);
  boomLight.color.set(opt.col&&opt.col!==0xffffff?opt.col:0xff9a40);boomLight.position.set(x,y+1,z);boomLight.intensity=5*(opt.sc||1);const dist=Math.hypot(P.x-x,P.z-z,P.h+1-y);Sfx.boom(dist,sndOcc(x,y,z));shakeT=Math.max(shakeT,.55*clamp(1-dist/22,0,1));
  for(const zb of zombies){if(!zb.active||zb.state==='dying')continue;const d=Math.hypot(zb.x-x,zb.z-z);if(d<r&&Math.abs(zb.h+1-y)<r){damageZombie(zb,dmg*(1-d/r*.6)*((zb.fond||zb.boss)?.15:1),'body',src,{splash:true});}}
  if(!opt.noSelf&&!perks.has('cadutalibera')&&dist<r*.85)hurtPlayer(Math.round(90*(1-dist/(r*.85))),x,z,true);
}
const vortGeo=new THREE.SphereGeometry(.45,14,10),vortCore=new THREE.MeshBasicMaterial({color:0x14061e}),vortRing=new THREE.MeshBasicMaterial({color:0xb77dff,transparent:true,opacity:.75,blending:THREE.AdditiveBlending,depthWrite:false});
function spawnVortex(pt,d){const g=new THREE.Group();g.add(new THREE.Mesh(vortGeo,vortCore));for(let k=0;k<3;k++){const t=new THREE.Mesh(new THREE.TorusGeometry(.8+k*.35,.04,6,28),vortRing);t.rotation.set(rand(0,3),rand(0,3),0);g.add(t);}
  g.position.copy(pt);scene.add(g);vortexes.push({g,x:pt.x,y:pt.y,z:pt.z,t:d.vt,r:d.vr,max:d.vt});}
function updateVortexes(dt){
  for(let i=vortexes.length-1;i>=0;i--){const v=vortexes[i];v.t-=dt;const s=v.t>v.max-.3?(v.max-v.t)/.3:v.t<.4?v.t/.4:1;v.g.scale.setScalar(Math.max(.01,s));
    v.g.children.forEach((c,k)=>{c.rotation.x+=dt*(2+k);c.rotation.y+=dt*(3-k);});
    for(let k=0;k<4;k++){const a=Math.random()*Math.PI*2,rr=rand(1,v.r*.7);emit({x:v.x+Math.cos(a)*rr,y:v.y+rand(-.5,1),z:v.z+Math.sin(a)*rr},1,.6,.35,.95,.3,0,-.5,[.2,.4]);}
    // online il buco nero di un compagno lo fa girare anche l'host (con i punti a lui); quello del giocatore è solo da vedere
    if(!NET.client){NET.credit=v.owner||null;for(const z of zombies){if(!z.active||z.state==='dying'||z.state==='approach')continue;const dx=v.x-z.x,dz=v.z-z.z,d=Math.hypot(dx,dz);
      if(d<v.r&&Math.abs(z.h+1-v.y)<4){const pull=(2.5+7*(1-d/v.r))*dt;z.x+=dx/d*Math.min(pull,d);z.z+=dz/d*Math.min(pull,d);z.stagger=.3;z.twitch=.2;if(d<1.1){if(z.fond||z.boss){z.x-=dx/d*Math.min(pull,d);z.z-=dz/d*Math.min(pull,d);damageZombie(z,(z.boss?120:400)*dt*10,'body','vortex',{});}else killZombie(z,false,'vortex');}}}NET.credit=null;}
    if(v.t<=0){scene.remove(v.g);vortexes.splice(i,1);}}
}

/* ---------- power-up ---------- */
// carp = Carpentiere (il Carpenter di COD): rimette tutte le assi a tutte le finestre e dà 200 punti
const PU={ammo:{name:'Munizioni al massimo',col:'#6fcf5a',l:'M'},insta:{name:'Uccisione istantanea',col:'#e9e3d1',l:'U'},double:{name:'Punti doppi',col:'#ffc23a',l:'×2'},bomb:{name:'Bomba',col:'#ff6a3a',l:'B'},carp:{name:'Carpentiere',col:'#d9b072',l:''}};
const puTex={};Object.keys(PU).forEach(k=>{puTex[k]=textTex(64,64,(c)=>{c.fillStyle='rgba(0,0,0,.6)';c.beginPath();c.arc(32,32,29,0,7);c.fill();c.strokeStyle=PU[k].col;c.lineWidth=4;c.stroke();
  c.fillStyle=PU[k].col;if(k==='carp'){/* martello */c.save();c.translate(32,33);c.rotate(-.7);c.fillRect(-3,-6,6,24);c.fillRect(-12,-15,24,10);c.fillRect(10,-13,5,6);c.restore();return;}
  c.font='bold 30px "Barlow Condensed", sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText(PU[k].l,32,34);});});
/* un giocatore ci può arrivare? (cella calpestabile raggiunta dal flusso, cioè collegata a dove sono i giocatori) */
function puReach(x,z,h){const cx=Math.floor(x),cz=Math.floor(z);if(!inb(cx,cz))return false;const i=cellAt(cx,cz,h+.3);return walkable(i)&&flow[i]<65535&&Math.abs(cellH[i]-h)<1.2;}
function dropPowerup(x,z,h,zb,st){const outside=zombies.some(q=>q.active&&['approach','scale','window','climb','rise'].includes(q.state));
  const ks=Object.keys(PU).filter(k=>!(k==='bomb'&&(outside||toSpawn>0))&&!(k==='carp'&&!WINDOWS.some(w=>w.boards<6&&regionOpen[w.region])));pupDrops++;const k=pick(ks),id=++NET.puId;
  /* ucciso fuori dalla finestra (o dove non si arriva): il power-up lo prende subito chi l'ha ucciso, tranne la Bomba,
     che cade dentro davanti alla finestra (così si sceglie quando prenderla) */
  const w=zb&&zb.win&&['approach','scale','window','climb'].includes(st)?zb.win:null;let auto=false;
  if(w){if(k==='bomb'||(st==='climb'&&(zb.climbU||0)>=.6)){x=w.inner.x;z=w.inner.z;h=hAt(x,z,w.h);}else auto=true;}
  else if(!puReach(x,z,h)){if(st==='rise'&&zb.tx!=null&&puReach(zb.tx,zb.tz,zb.riseH??h)){x=zb.tx;z=zb.tz;h=zb.riseH??h;}else auto=true;}
  if(auto){const by=NET.credit?NET.credit.n:NET.name;applyPowerup(k);netEv({t:'pu',id,k,by});if(NET.on&&by!==NET.name)H.top.insertAdjacentHTML('beforeend',`<small>preso da ${esc(by)}</small>`);return;}
  powerups.push({k,s:puSprite(k,x,z,h),t:25,x,z,h,id});netEv({t:'pu+',id,k,x:r2(x),z:r2(z),h:r2(h)});}
function applyPowerup(k){Sfx.pup();showMsg(PU[k].name.toUpperCase()+(k==='carp'?'<small>tutte le finestre sono di nuovo sbarrate</small>':''),2);
  if(k==='ammo'){inv.forEach(w=>{const d=wd(w);w.mag=d.mag;w.reserve=d.reserve;});grenades=Math.max(grenades,grenCap());if(carUnlocked)carillons=Math.max(carillons,CAR_CAP);}else if(k==='insta')instaT=30;else if(k==='double')doubleT=30;
  else if(k==='bomb'){for(const z of zombies)if(z.active&&z.state!=='dying')killZombie(z,false,'bomb');addPoints(400);shakeT=.4;}
  else if(k==='carp'){WINDOWS.forEach(w=>{while(w.boards<6){setBoard(w,w.boards,true);w.boards++;}w.repT=performance.now();});addPoints(200);
    for(let i=0;i<7;i++)setTimeout(()=>{Sfx.repair();Sfx.board(rand(-.6,.6));},120+i*170);}}
function updatePowerups(dt){for(let i=powerups.length-1;i>=0;i--){const p=powerups[i];if(p.k==='core')continue;p.t-=dt;p.s.position.y=p.h+1+Math.sin(performance.now()/300)*.12;
  p.s.visible=p.t>6||Math.floor(p.t*6)%2===0;
  // online decide l'host: il primo che ci passa sopra lo prende, e vale per tutti
  if(!NET.client&&p.t>0){let by=null;if(!P.dead&&!P.bleed&&Math.hypot(P.x-p.x,P.z-p.z)<1.3&&Math.abs(P.h-p.h)<1.4)by=NET.name;
    else if(NET.on)NET.peers.forEach(q=>{const s=q.s;if(!by&&s&&s.dn===0&&Math.hypot(s.x-p.x,s.z-p.z)<1.3&&Math.abs(s.h-p.h)<1.4)by=q.n;});
    if(by){applyPowerup(p.k);p.t=0;netEv({t:'pu',id:p.id,k:p.k,by});if(by!==NET.name)H.top.insertAdjacentHTML('beforeend',`<small>preso da ${esc(by)}</small>`);}}
  if(p.t<=0){scene.remove(p.s);p.s.material.dispose();powerups.splice(i,1);}}}

/* =========================================================
   ROUND E COMPARSA
   ========================================================= */
function startRound(n){round=n;toSpawn=zombiesFor(n);fondRound=(Q2&&Q2.step>=2)?((Q2.step===2&&Q2.dropped<3)?1:((n-(Q2.fondFrom||n))%6===0?1:0)):0;spawnT=1.5;pupDrops=0;
  roundLocal(n,toSpawn);netEv({t:'round',r:n,n:toSpawn});netLobbyInfo();}
// la parte del round che riguarda il singolo giocatore (online la fa ognuno quando l'host annuncia il round)
function roundLocal(n,cnt){round=n;repairPts=0;if(n>1){grenades=Math.min(grenCap(),grenades+2);if(carUnlocked)carillons=Math.min(CAR_CAP,carillons+2);}Sfx.roundStart();
  H.round.textContent=n;H.round.classList.add('flash');setTimeout(()=>H.round.classList.remove('flash'),900);showMsg(`Round ${n}<small>${cnt} infetti in arrivo</small>`,2.6);if(NET.on)netRespawn();}
function roundEndLocal(n){Sfx.roundEnd();showMsg(`Round ${n} superato<small>prossima ondata tra pochi secondi</small>`,3);}
function spawnCandidates(){const c=[];
  WINDOWS.forEach(w=>{if(!regionOpen[w.region])return;if(Q2&&Q2.event&&REG[w.region].k!=='e')return;const f=flow[ix(Math.floor(w.land.x),Math.floor(w.land.z),w.l)];if(f<65535)c.push({t:'win',w,f});});
  RISERS.forEach(r=>{if(r.region<0||!regionOpen[r.region])return;const f=flow[ix(Math.floor(r.x),Math.floor(r.z),r.l)];const d=netNearDist(r.x,r.z);if(f<65535&&d>5&&f>3)c.push({t:'rise',r,f});});
  c.sort((a,b)=>a.f-b.f);return c.slice(0,6);}
let fondRound=0;
function fondAlive(){return zombies.filter(z=>z.active&&z.fond&&z.state!=='dying').length;}
function fondWanted(){const n=fondAlive();if(Q3&&Q3.step===6)return n<2&&Math.random()<.3;if(!Q2||Q2.step<2)return false;
  if(Q2.event)return n<5&&Math.random()<.5;
  return fondRound>0&&n<1&&toSpawn<=Math.ceil(zombiesFor(round)*.6)&&Math.random()<.35;}
function dressZombie(z){const hot=z.fond||z.boss;z.mesh.material=hot?z.matF:z.matN;z.glow.forEach(s=>s.material=hot?eyeGlowFond:eyeGlowMat);}
// memoria dei punti in cui ci si è incastrati: ogni zombie evita le celle dove si è bloccato, e tutti evitano un po' i punti "maledetti"
let stuckMem=null,memT=0;
function avoidCost(z,i){let s=stuckMem?stuckMem[i]*2:0;if(z&&z.avoid)for(const a of z.avoid)if(a.i===i)s+=a.w;return s;}
function markStuck(z,ci){if(!stuckMem||stuckMem.length!==N)stuckMem=new Float32Array(N);z.avoid=z.avoid||[];
  const tgt=z.navC>=0?z.navC:-1;if(tgt>=0){z.avoid.push({i:tgt,w:9,t:14});stuckMem[tgt]=Math.min(4,stuckMem[tgt]+1);}z.avoid.push({i:ci,w:3,t:14});stuckMem[ci]=Math.min(4,stuckMem[ci]+.5);if(z.avoid.length>8)z.avoid.splice(0,z.avoid.length-8);z.navT=0;}
function nextCell(c,z){const cx=cX(c),cz=cZ(c);let best=-1,bs=1e9;const base=flow[c];
  for(const [dx,dz] of DIR8){const ni=nbCell(c,dx,dz);if(ni<0)continue;if(!walkable(ni)||!stepOK(c,ni))continue;if(dx&&dz&&!diagOK(c,ni,cx,cz,dx,dz))continue;if(flow[ni]>=65535)continue;
    const s=flow[ni]+avoidCost(z,ni)+(dx&&dz?.01:0);if(s<bs){bs=s;best=ni;}}
  if(best<0)return -1;if(flow[best]<base)return best;return (z&&z.avoid&&z.avoid.length&&bs<base+3)?best:-1;}
function winCap(w){const q=zombies.filter(q=>q.active&&q.win===w&&q.state==='approach').length;return q>=2?(round>=10?3:2):1;}
function freeLane(w){const used=(w.climbers||[]).map(q=>q.lane);for(let l=0;l<3;l++)if(!used.includes(l))return l;return -1;}
function relocate(z){if(z.win&&z.win.climbers)z.win.climbers=z.win.climbers.filter(q=>q!==z);z.lane=null;z.active=false;z.g.visible=false;alive--;toSpawn++;if(z.win&&z.win.occupant===z)z.win.occupant=null;if(z.fond&&!(Q2&&Q2.event))fondRound++;z.orbit=null;}
function bossSlam(z){fxRing(z.x,z.h,z.z,7,.55,0xff7a3a);fxRing(z.x,z.h,z.z,4.5,.4,0xffd0a0);fxExplosion(z.x,z.h+.3,z.z,.7);Sfx.boom(Math.hypot(P.x-z.x,P.z-z.z));
  const d=Math.hypot(P.x-z.x,P.z-z.z);shakeT=Math.max(shakeT,.7*clamp(1-d/16,0,1));if(d<6.5&&Math.abs(P.h-z.h)<2){hurtPlayer(Math.round(20+55*(1-d/6.5)),z.x,z.z,true);const l=d||1;P.vx+=(P.x-z.x)/l*7;P.vz+=(P.z-z.z)/l*7;if(P.grounded){P.vy=4;P.grounded=false;P.airMax=P.h;}}
  netHurtNear(z.x,z.z,z.h,6.5,dd=>20+55*(1-dd/6.5),true,7);}
function footstep(z){const d=Math.hypot(z.x-P.x,z.z-P.z);if(d<22&&Math.abs(z.h-P.h)<7){shakeT=Math.max(shakeT,(z.boss?.32:.17)*(1-d/22));Sfx.thud(d);}
  emit({x:z.x+rand(-.3,.3),y:z.h+.05,z:z.z+rand(-.3,.3)},z.boss?10:5,.35,.3,.26,1.6,.8);}
function spawnBoss(x,zz,h){const z=zombies.find(q=>!q.active);if(!z)return null;
  z.type='run';z.speed=3.1;z.crawl=false;z.slamCD=4;z.slam=false;z.attDmgMul=1;z.phase=0;z.t=0;z.attackT=0;z.cd=1;z.groanT=1;z.deathT=0;z.flinch=0;z.twitch=0;z.stagger=0;z.win=null;z.moving=false;z.enraged=false;z.gaitAmp=0;z.webT=0;z.webS.visible=false;z.vanish=false;
  z.enraged=true;z.style={hunch:.35,tilt:.1,limp:0,arms:0,seed:3,twitchRate:.05};z.bones.forEach(b=>b.scale.setScalar(1));z.body.rotation.set(0,0,0);z.knock=null;z.stuckT=0;z.lostT=0;z.orbit=null;z.stepU=0;
  z.boss=true;z.fond=false;dressZombie(z);z.g.scale.setScalar(2.05);z.B.head.scale.setScalar(1.5);z.hp=z.maxHp=20000+round*1100;
  z.state='rise';z.riseT=0;z.water=false;z.x=x;z.z=zz;z.tx=x;z.tz=zz;z.riseH=h;z.h=h-1.9;z.yaw=Math.atan2(P.x-x,P.z-zz);z.active=true;placeZombie(z);alive++;return z;}
/* il modello va messo subito al suo posto: altrimenti per un fotogramma si vedeva dove era morto lo zombie di prima (o in piedi sopra la buca) */
function placeZombie(z){z.g.position.set(z.x,z.h,z.z);z.g.rotation.y=z.yaw;poseZombie(z,0);z.g.visible=true;}
function spawnZombie(){
  const z=zombies.find(z=>!z.active);if(!z)return false;const cand=spawnCandidates();if(!cand.length)return false;const sp=pick(cand);
  const [type,spd]=typeFor(round);z.type=type;z.speed=spd;z.crawl=false;z.hp=z.maxHp=hpFor(round);z.attDmgMul=1;z.phase=Math.random()*6;z.t=Math.random()*10;
  z.attackT=0;z.cd=0;z.groanT=rand(.5,4);z.deathT=0;z.flinch=0;z.twitch=0;z.stagger=0;z.win=null;z.moving=false;z.enraged=false;z.gaitAmp=0;z.webT=0;z.webS.visible=false;z.vanish=false;
  z.style={hunch:rand(.18,.45),tilt:rand(-.35,.35),limp:pick([-1,0,1,1,-1]),arms:pick([0,0,0,1,2]),seed:rand(0,10),twitchRate:rand(.05,.35)};/* come in COD: quasi tutti a braccia tese */
  z.bones.forEach(b=>b.scale.setScalar(1));z.g.scale.setScalar(rand(.93,1.07));z.body.rotation.set(0,0,0);z.knock=null;z.scaled=false;z.stuckT=0;z.lostT=0;z.orbit=null;z.boss=false;z.stepU=0;z.avoid=[];z.lane=null;z.climbRX=0;z.navC=-1;z.orbitN=0;
  z.vel=0;z.wv=rand(0,6.3);z.wf=rand(.85,1.15);
  z.fond=fondWanted();if(z.fond&&!(Q2&&Q2.event)&&!(Q3&&Q3.step===6))fondRound--;dressZombie(z);
  if(z.fond){z.hp=z.maxHp=Math.round((hpFor(round)*3+1500)*.65);z.type='sprint';z.speed=rand(3.5,3.9);z.enraged=true;z.g.scale.setScalar(1.45);z.B.head.scale.setScalar(1.4);}
  if(sp.t==='win'){const w=sp.w,lat=rand(-1.6,1.6);z.win=w;z.state='approach';z.qo=rand(-1,1);z.x=w.cx+w.nx*w.out+(w.nz?lat:0);z.z=w.cz+w.nz*w.out+(w.nx?lat:0);z.h=w.gh;z.yaw=Math.atan2(-w.nx,-w.nz);}
  else{const r=sp.r;z.state='rise';z.riseT=0;z.water=r.water;z.x=r.x+rand(-.3,.3);z.z=r.z+(r.water?1.4:rand(-.3,.3));z.tx=r.x;z.tz=r.z-(r.water?.6:0);z.riseH=r.h;z.h=r.water?-4.4:r.h-1.9;/* parte sotto terra (o sott'acqua) */
    z.yaw=Math.atan2(P.x-z.x,P.z-z.z);const pan=clamp(((z.x-P.x)*Math.cos(P.yaw)-(z.z-P.z)*Math.sin(P.yaw))/10,-1,1);if(Math.hypot(z.x-P.x,z.z-P.z)<30){if(r.water)Sfx.splash(pan);else Sfx.dirt(pan);}}
  z.active=true;placeZombie(z);alive++;return true;
}

/* =========================================================
   ZOMBIE: animazione e movimento
   ========================================================= */
const GAIT={walk:{D:1.0,duty:.6,lift:.1,bob:.03,drop:.065},run:{D:1.6,duty:.46,lift:.17,bob:.05,drop:.09},sprint:{D:2.1,duty:.38,lift:.23,bob:.065,drop:.11}};
/* coscia e stinco (K.L1, K.L2) sono quelli del modello: ogni modello Meshy ha il suo scheletro (z.K in makeZombie) */
function legIK(fz,fy,hipY,K){const L1=K.L1,L2=K.L2,dy=Math.max(.25,hipY-fy),d=Math.min(L1+L2-.004,Math.hypot(fz,dy));const ph=Math.atan2(fz,dy);
  const be=Math.acos(clamp((L1*L1+d*d-L2*L2)/(2*L1*d),-1,1)),kn=Math.PI-Math.acos(clamp((L1*L1+L2*L2-d*d)/(2*L1*L2),-1,1));return [-(ph+be),kn];}
function footPos(u,S,duty,lift){if(u<duty)return [S*(.5-u/duty),0];const k=(u-duty)/(1-duty),e=k*k*(3-2*k);return [S*(-.5+e),lift*Math.sin(k*Math.PI)];}
// ritmo degli attacchi come in COD: un colpo ogni ~1,4-1,8 s per zombie, con pausa dopo ogni attacco
const ATTACKS={walk:{style:'double',dur:.85,strike:.3,dmg:50,cd:.95,pitch:.8},run:{style:'swipe',dur:.7,strike:.26,dmg:50,cd:.8,pitch:1},
  sprint:{style:'frenzy',dur:.6,strike:.2,dmg:50,cd:.75,pitch:1.35},grab:{style:'grab',dur:.85,strike:.3,dmg:35,cd:1.1,pitch:.7}};
const CONTACT=.85;
function poseZombie(z,dt){
  const B=z.B,S=z.style,t=z.t,ph=z.phase;
  let hipsY=.95,hipsX=0,hipsZ=0,spX=S.hunch,spY=0,spZ=0,nkX=-S.hunch*.55,nkZ=S.tilt,hdX=0,hdY=0,jaw=.12+Math.abs(Math.sin(t*1.7+S.seed))*.18;
  let shLx=0,shLz=-.08,shRx=0,shRz=.08,elL=-.1,elR=-.1,hpL=0,hpR=0,knL=.05,knR=.05,rootX=0,hipsYaw=0,wrL=.35,wrR=.35,ftL=null,ftR=null,gaitU=-1;const moving=z.moving;
  const osc=(f,o)=>.5+.5*Math.sin(f+o);/* 0..1 */
  if(z.crawl){const a=Math.sin(ph),b=Math.sin(ph+Math.PI),mv=moving?1:.2;hipsY=.27+Math.abs(Math.cos(ph))*.05*mv;hipsX=.38;spX=.28;const lean=hipsX+spX;nkX=-.6;nkZ=S.tilt*.4;
    shLx=-lean-.3+a*.55*mv;shRx=-lean-.3+b*.55*mv;shLz=-.16;shRz=.16;elL=-.08-Math.max(0,a)*.5*mv;elR=-.08-Math.max(0,b)*.5*mv;hpL=hpR=-1.25;knL=knR=.08+Math.max(0,-a)*.25*mv;spZ=a*.12*mv;hipsZ=-a*.07*mv;spY=a*.12*mv;hipsYaw=-a*.1*mv;wrL=.15+Math.max(0,a)*.4*mv;wrR=.15+Math.max(0,b)*.4*mv;ftL=ftR=1.1;}
  else if(z.type==='sprint'&&moving){const a=Math.sin(ph),b=Math.sin(ph+Math.PI);spX=S.hunch+.42;nkX=-(S.hunch+.42)*.8;hipsZ=a*.05;spY=a*.25;
    shLx=b*1.1-.5;shRx=a*1.1-.5;shLz=-.35;shRz=.35;elL=-1.1+.32*b;elR=-1.1+.32*a;wrL=wrR=.15;hdY=Math.sin(t*23+S.seed)*.08;nkZ+=Math.sin(t*17)*.08;hipsX=.06;}
  else if(z.type==='run'&&moving){const a=Math.sin(ph);spX=S.hunch+.32;nkX=-(S.hunch+.32)*.7;hipsZ=a*.07+S.limp*.05;spY=a*.18;
    shLx=-1.45+Math.sin(ph*1.1+1)*.8;shRx=-1.5+Math.sin(ph*1.1)*.8;shLz=-.25;shRz=.25;elL=-.28-.42*osc(ph*1.1,2.6);elR=-.32-.42*osc(ph*1.1,1.6);
    wrL=.42+.2*osc(ph*1.1,1);wrR=.45+.2*osc(ph*1.1,0);hipsX=.04;}
  else if(moving){const a=Math.sin(ph),b=Math.sin(ph+Math.PI);spZ=-a*.14-S.limp*.06;spY=a*.18;nkZ+=a*.1;
    if(S.arms===0){shLx=-1.25+Math.sin(ph*.5+1)*.1;shRx=-1.35+Math.sin(ph*.5)*.1;shLz=-.14;shRz=.14;elL=-.26-.24*osc(ph,1.2);elR=-.34-.24*osc(ph,.3);wrL=.55+.18*osc(ph*.5,2);wrR=.6+.18*osc(ph*.5,0);}
    else if(S.arms===1){shLx=-1.3+Math.sin(ph*.5)*.08;shLz=-.12;elL=-.22-.2*osc(ph,1);wrL=.6;shRx=b*.38;shRz=.1;elR=-.14-Math.max(0,-shRx)*1.15;wrR=.2+.15*osc(ph,2);}
    else{shLx=-b*.32;shRx=-a*.32;shLz=-.1;shRz=.12;elL=-.12-Math.max(0,-shLx)*1.1;elR=-.18-Math.max(0,-shRx)*1.1;wrL=.22+.12*osc(ph,1);wrR=.25+.12*osc(ph,0);}}
  else{const sw=Math.sin(t*1.3+S.seed);hipsZ=sw*.05;spZ=-sw*.05;spY=Math.sin(t*.7)*.1;hipsYaw=Math.sin(t*.6+S.seed)*.06;
    if(S.arms!==2){shLx=-1.1+sw*.08;shRx=-1.2-sw*.08;elL=-.3-.16*osc(t*1.1,S.seed);elR=-.35-.16*osc(t*.9,S.seed+2);shLz=-.14;shRz=.14;wrL=.5+.15*osc(t*1.4,1);wrR=.55+.15*osc(t*1.2,3);}
    else{shLx=sw*.12;shRx=-sw*.12;elL=-.15-.1*osc(t,1);elR=-.15-.1*osc(t,3);wrL=wrR=.25;}}
  if(!z.crawl&&(z.state==='chase'||z.state==='approach'||z.state==='window')){
    const G=GAIT[z.type]||GAIT.walk;z.gaitAmp=lerp(z.gaitAmp||0,moving?1:0,Math.min(1,dt*5));const A=z.gaitAmp;
    const u=((ph/(Math.PI*2))%1+1)%1,Sd=G.D*G.duty*A,lim=z.type==='walk'?S.limp:0;
    const fL=footPos(u,Sd,G.duty,G.lift*A*(lim<0?.25:1)),fR=footPos((u+.5)%1,Sd,G.duty,G.lift*A*(lim>0?.25:1));
    hipsY=.95-G.drop*A-G.bob*A*(.5+.5*Math.cos(u*Math.PI*4));if(lim!==0){const bu=lim<0?u:(u+.5)%1;if(bu<G.duty)hipsY-=.035*A*Math.sin(bu/G.duty*Math.PI);}
    const K=z.K,hs=K.hs,hy=hipsY*hs-K.hd;[hpL,knL]=legIK(fL[0]*hs,K.ay+.01+fL[1]*hs,hy,K);[hpR,knR]=legIK(fR[0]*hs,K.ay+.01+fR[1]*hs,hy,K);hipsZ=Math.sin(u*Math.PI*2)*.06*A+lim*.05;
    hipsYaw=Math.cos(u*Math.PI*2)*.11*A;spY-=Math.cos(u*Math.PI*2)*.05*A;gaitU=u;z.gDuty=G.duty;/* il bacino gira con la gamba che avanza, le spalle al contrario */
    const idle=1-A;if(idle>.01){const sw=Math.sin(t*1.3+S.seed);knL+=idle*(.1+.08*sw);hpL-=idle*(.05+.04*sw);knR+=idle*(.1-.08*sw);hpR-=idle*(.05-.04*sw);hipsY-=idle*.02;}}
  nkZ+=Math.sin(t*.9+S.seed)*.12;hdX+=Math.sin(t*1.3+S.seed*2)*.08;
  if(z.twitch>0){z.twitch-=dt;const k=z.twitch*6;nkZ+=Math.sin(t*60)*.25*k;hdY+=Math.sin(t*47)*.3*k;shRz+=Math.sin(t*55)*.25*k;}else if(Math.random()<dt*S.twitchRate)z.twitch=.18;
  if(z.webT>0){shLx=-.4+Math.sin(t*9)*.15;shRx=-.3+Math.cos(t*8)*.15;spX=S.hunch+.1+Math.sin(t*6)*.08;}
  if(z.state==='rise'){const k=Math.min(1,z.riseT/1.9);shLx=-2.6+Math.sin(t*9)*.35;shRx=-2.6+Math.cos(t*8)*.35;elL=-.4;elR=-.5;spX=.5-k*.2;nkX=-.3;jaw=.5;knL=knR=.9*(1-k);hpL=hpR=-.6*(1-k);}
  if(z.state==='scale'){const c=Math.sin(t*9);shLx=-2.9+c*.35;shRx=-2.9-c*.35;elL=-.6;elR=-.6;hpL=-.9+c*.4;hpR=-.9-c*.4;knL=1.2;knR=1.2;spX=.15;nkX=-.6;}
  if(z.state==='climb'&&z.crawl){const u=z.climbU||0,a=Math.sin(z.t*9);rootX=z.climbRX||0;nkX=-.75;spX=.12;spY=0;hipsZ=0;/* chi striscia passa carponi */
    if(u<.28){const k=u/.28;shLx=shRx=-2.7;elL=elR=-.25;hpL=-1.1*k;hpR=-.3*k;knL=1.1*k;knR=.4;jaw=.5;}
    else if(u<.72){shLx=-1.9+a*.6;shRx=-1.9-a*.6;elL=-.35-Math.max(0,a)*.5;elR=-.35-Math.max(0,-a)*.5;hpL=.05+a*.08;hpR=.05-a*.08;knL=knR=.12;}
    else{const k=(u-.72)/.28;shLx=shRx=-1.5+k*.8;elL=elR=-.3;hpL=hpR=-1.1*Math.sin(k*Math.PI);knL=knR=1.3*Math.sin(k*Math.PI);}}
  else if(z.state==='climb'){const u=z.climbU||0;spY=0;hipsZ=0;jaw=.55;/* scavalcamento come in BO1: mani sul davanzale, ginocchio su, accovacciato, salto dentro */
    if(u<.32){const k=ease(u/.32);shLx=shRx=lerp(-1.6,-1.0,k);elL=elR=-.75;spX=.35+.2*k;nkX=-.4;hipsY=.95-.28*k;
      hpL=lerp(0,-1.5,k);knL=lerp(.1,1.9,k);hpR=lerp(0,.3,k);knR=lerp(.1,.35,k);}
    else if(u<.52){const k=(u-.32)/.2;shLx=shRx=-1.15-.15*k;elL=elR=-.45;spX=.55;nkX=-.5;hipsY=.6;hpL=lerp(-1.5,-1.35,k);knL=lerp(1.9,2.0,k);hpR=lerp(.3,-1.35,k);knR=lerp(.35,2.0,k);}
    else{const k=(u-.52)/.48,e=Math.min(1,k*2);shLx=lerp(-1.3,-2.3,e);shRx=lerp(-1.3,-2.1,e);shLz=-.45;shRz=.45;elL=elR=-.25;spX=lerp(.55,.2,e);nkX=-.35;
      hipsY=lerp(.6,.92,e);hpL=hpR=lerp(-1.35,-.35,e);knL=knR=lerp(2.0,.5,e);
      if(k>.75){const s=Math.sin((k-.75)/.25*Math.PI);hpL=hpR=-.75*s-.1;knL=knR=1.35*s+.15;hipsY=.92-.22*s;spX=.2+.35*s;}}}
  if(z.state==='window'){shLx=-1.6+Math.sin(t*7)*.25;shRx=-1.6+Math.cos(t*6.5)*.25;elL=-.3;elR=-.35;spX=S.hunch+.1;jaw=.45;}
  if(z.attackT>0){const k=1-z.attackT/z.attDur,ks=1-z.attStrike/z.attDur,pre=k<ks,w=pre?k/ks:(k-ks)/(1-ks),ws=Math.sqrt(w);
    switch(z.attStyle){
      case 'double':if(pre){shLx=lerp(shLx,-2.9,w);shRx=lerp(shRx,-2.9,w);shLz=-.25;shRz=.25;elL=elR=-.75*w-.1;spX=lerp(spX,-.15,w);nkX-=.25*w;jaw=.2+.5*w;wrL=wrR=lerp(.5,.9,w);}
        else{shLx=shRx=lerp(-2.9,-.55,ws);shLz=-.12;shRz=.12;elL=elR=lerp(-.85,-.2,ws);spX=lerp(-.15,S.hunch+.65,ws);nkX+=.15;hdX+=.35*ws;jaw=.8;hipsY-=.05*ws;wrL=wrR=lerp(-.3,.3,ws);knL+=.2*ws;knR+=.2*ws;}break;
      case 'swipe':{const sd=z.swipeSide;
        if(pre){if(sd>0){shRx=lerp(shRx,-1.9,w);shRz=lerp(shRz,1.1,w);elR=-.9*w;}else{shLx=lerp(shLx,-1.9,w);shLz=lerp(shLz,-1.1,w);elL=-.9*w;}spY=lerp(spY,-sd*.55,w);spX-=.1*w;jaw=.3+.3*w;}
        else{if(sd>0){shRx=lerp(-1.9,-1.25,ws);shRz=lerp(1.1,-.55,ws);elR=lerp(-.9,-.15,ws);}else{shLx=lerp(-1.9,-1.25,ws);shLz=lerp(-1.1,.55,ws);elL=lerp(-.9,-.15,ws);}spY=lerp(-sd*.55,sd*.45,ws);spX+=.3*ws;jaw=.7;}
        if(sd>0){shLx=-1.25;shLz=-.2;elL=-.3;wrR=pre?.8:-.25;}else{shRx=-1.25;shRz=.2;elR=-.3;wrL=pre?.8:-.25;}hipsYaw=spY*.35;break;}
      case 'frenzy':{const c=Math.sin(k*Math.PI*5);shLx=-1.7+c*.75;shRx=-1.7-c*.75;shLz=-.3+c*.2;shRz=.3+c*.2;elL=-.5-Math.max(0,c)*.6;elR=-.5-Math.max(0,-c)*.6;
        spX=S.hunch+.35+(pre?-.2*w:.5*ws);hipsY-=.08;nkX=-(S.hunch+.2);hdY=Math.sin(t*31)*.15;jaw=.85;knL=knR=.5;hpL=-.5;hpR=-.2;wrL=.3+.4*c;wrR=.3-.4*c;hipsYaw=c*.12;break;}
      case 'grab':if(pre){shLx=shRx=lerp(shLx,-2.95,w);elL=elR=-.2;nkX=lerp(nkX,-1.45,w);jaw=.25+.55*w;wrL=wrR=-.3;}else{shLx=shRx=lerp(-2.95,-2.1,ws);elL=elR=-.7*ws;nkX=-1.45+.5*ws;jaw=lerp(.8,.05,ws);wrL=wrR=lerp(-.3,.9,ws);}break;
    }}
  if(z.stumT>0&&z.state==='chase'){const k=Math.sin((1-z.stumT/.55)*Math.PI);spX+=.6*k;nkX-=.35*k;shLx-=.5*k;shRx-=.4*k;hipsY-=.07*k;spZ+=.25*k*(z.fdir||1);}/* inciampo */
  if(z.flinch>0){z.flinch-=dt;const k=z.flinch/.28;spX-=.55*k;nkX-=.4*k;spY+=z.fdir*.35*k;shLx+=.4*k;shRx+=.4*k;}
  if(z.knock){const kt=z.knock.t,air=clamp(kt/.45,0,1),lie=kt<1.3?1:clamp(1-(kt-1.3)/.6,0,1);
    rootX=-1.45*lie*air;shLx=-2.2+Math.sin(t*14)*.4;shRx=-2.4+Math.cos(t*13)*.4;elL=-.6+Math.sin(t*11)*.3;elR=-.5+Math.cos(t*12)*.3;hpL=-.8;hpR=-.4;knL=knR=.9;jaw=.7;ftL=ftR=.35;if(kt>1.3){shLx=lerp(0,shLx,lie);shRx=lerp(0,shRx,lie);}}
  if(z.state==='dying'){const t1=z.deathT;const k=clamp(t1/.45,0,1),k2=clamp((t1-.35)/.5,0,1);
    hipsY=lerp(z.crawl?.3:.95,.45,k)-k2*.2;knL=knR=lerp(knL,1.7,k);hpL=hpR=lerp(hpL,-1.2,k)*(1-k2*.6);spX=lerp(spX,.8,k)*(1-k2)+k2*.1;
    shLx=lerp(shLx,.2,k);shRx=lerp(shRx,-.1,k);elL=lerp(elL,-.5,k);elR=lerp(elR,-.15,k);wrL=wrR=lerp(.35,.7,k);nkX=lerp(nkX,.6,k);jaw=.6;rootX=z.fall*1.45*k2*k2;ftL=ftR=.45*k;hipsYaw*=1-k;}
  // schiena in due pezzi (curva morbida), bacino che ruota, polsi e caviglie: i piedi restano paralleli al pavimento
  B.hips.position.y=hipsY*z.K.hs;B.hips.rotation.set(hipsX,hipsYaw,hipsZ);/* le quote del bacino sono pensate per lo scheletro di serie (0,95 m) */const spYr=spY-hipsYaw;B.spine.rotation.set(spX*.55,spYr*.5,spZ*.55);B.chest.rotation.set(spX*.45,spYr*.5,spZ*.45);
  B.neck.rotation.set(nkX,0,nkZ);B.head.rotation.set(hdX,hdY,0);B.jaw.rotation.x=jaw;
  B.shL.rotation.set(shLx,0,shLz);B.shR.rotation.set(shRx,0,shRz);B.elL.rotation.x=Math.min(0,elL);B.elR.rotation.x=Math.min(0,elR);B.haL.rotation.x=wrL;B.haR.rotation.x=wrR;
  B.hipL.rotation.set(hpL,0,-.03);B.hipR.rotation.set(hpR,0,.03);B.knL.rotation.x=Math.max(0,knL);B.knR.rotation.x=Math.max(0,knR);
  const ankle=(hp,kn,uu)=>{let a=-(hp+kn)-hipsX;if(uu>=0){const D=z.gDuty||.6;if(uu<D){const k=uu/D;a+=lerp(-.18,.32,k*k);}else{const k=(uu-D)/(1-D);a+=.32*(1-k)-.12*k;}}else a*=.7;return a;};
  B.ftL.rotation.x=ftL!=null?ftL:ankle(hpL,knL,gaitU);B.ftR.rotation.x=ftR!=null?ftR:ankle(hpR,knR,gaitU<0?-1:(gaitU+.5)%1);
  if(z.state==='climb')rootX=z.climbRX||0;else if(z.fond&&z.state==='window')rootX=.5;z.body.rotation.x=rootX;
  if(z.shadow){z.shadow.visible=z.state==='chase'||z.state==='approach'||z.state==='window'||(z.state==='dying'&&!z.vanish);z.shadow.position.y=.03-(z.knock?z.knock.y:0);}
}
// percorso dello scavalcamento: posizione, altezza dei piedi e inclinazione del corpo in funzione dell'avanzamento u (0..1).
// La usano sia l'host sia gli altri giocatori online, così lo zombie esce dalla finestra nello stesso modo per tutti.
const CLIMB_DUR=z=>z.crawl?2:z.fond?2:z.type==='sprint'?.85:z.type==='run'?1.05:1.45;
function climbPose(w,u,lo,ho,crawl){const dx=-w.nx,dz=-w.nz,lx=w.nz?1:0,lz=w.nx?1:0,Y=w.h+.9,LH=hAt(w.land.x,w.land.z,w.h);let f,h,rx;
  if(crawl){if(u<.28){const k=ease(u/.28);f=lerp(-.15,-.1,k);h=lerp(w.h,Y,k)+ho*k;rx=.5+.8*k;}
    else if(u<.72){const k=(u-.28)/.44;f=lerp(-.1,.55,k);h=Y+.1+ho*(1-k);rx=1.3+(Math.PI/2-1.3)*Math.min(1,k*3);}
    else{const k=ease((u-.72)/.28);f=lerp(.55,1.35,k);h=lerp(Y+.1,LH,k);rx=Math.PI/2*(1-k);}}
  else if(u<.32){const k=ease(u/.32);f=lerp(-.15,.05,k);h=lerp(w.h,Y,k)+ho*k;rx=.15*k;}
  else if(u<.52){const k=(u-.32)/.2;f=lerp(.05,.35,k);h=Y+ho;rx=.25;}
  else{const k=(u-.52)/.48;f=lerp(.35,1.35,k);h=lerp(Y+ho,LH,ease(k))+.32*Math.sin(Math.PI*Math.min(1,k*1.2));rx=.25*(1-k);}
  return [w.cx+dx*f+lx*lo,w.cz+dz*f+lz*lo,h,rx];}
function moveToward(z,tx,tz,spd,dt,tr){const dx=tx-z.x,dz=tz-z.z,d=Math.hypot(dx,dz);if(d<1e-4)return 0;const s=Math.min(d,spd*dt);z.x+=dx/d*s;z.z+=dz/d*s;z.yaw=turn(z.yaw,Math.atan2(dx,dz),dt*(tr||6));return d;}
function turn(a,b,k){if(!isFinite(a))return b;let d=b-a;while(d>Math.PI)d-=Math.PI*2;while(d<-Math.PI)d+=Math.PI*2;return a+d*Math.min(1,k);}
function updateZombies(dt){
  if(stuckMem){memT=(memT||0)+dt;if(memT>1){memT=0;for(let i=0;i<stuckMem.length;i++)if(stuckMem[i]>0)stuckMem[i]=Math.max(0,stuckMem[i]-.02);}}
  // bersagli: il carillon, oppure tutti i giocatori in piedi (online fino a 4); ogni zombie insegue il più vicino
  flowT-=dt;const TG=lure?[lure]:netTargets();const pc=TG.map(t=>cellAt(clamp(Math.floor(t.x),0,GW-1),clamp(Math.floor(t.z),0,GH-1),t.h)).join(',');
  if(flowT<=0||pc!==lastPCell){computeFlow();flowT=.25;lastPCell=pc;}
  for(const z of zombies){
    if(!z.active)continue;z.t+=dt;const ox=z.x,oz=z.z;
    if(z.state==='dying'){z.deathT+=dt;if(z.vanish){const s=Math.max(.01,1-z.deathT*2.5);z.g.scale.setScalar(s);if(z.deathT>.4){z.active=false;z.g.visible=false;}continue;}
      if(z.deathT>2.2)z.g.position.y=z.h-(z.deathT-2.2)*.6;if(z.deathT>3.4){z.active=false;z.g.visible=false;}poseZombie(z,dt);continue;}
    let T0=TG[0];if(TG.length>1){let bd=1e18;for(const t of TG){const q=(t.x-z.x)**2+(t.z-z.z)**2+((t.h-z.h)*2)**2;if(q<bd){bd=q;T0=t;}}}
    const tgtX=T0.x,tgtZ=T0.z,tgtH=T0.h;
    const dxp=tgtX-z.x,dzp=tgtZ-z.z,dp=Math.hypot(dxp,dzp),sameLevel=Math.abs(tgtH-z.h)<1.3;
    const lurch=z.crawl?.45+Math.max(0,Math.sin(z.t*4.5))*1.3:z.type==='walk'?.7+Math.max(0,Math.sin(z.phase*2))*.6:1;
    if(z.webT>0){z.webT-=dt;if(z.webT<=0)z.webS.visible=false;}
    const reach=z.boss?1.55:z.fond?1.05:CONTACT;
    let spd=(z.crawl?(z.enraged?1.4:.65):z.speed)*lurch*(z.attackT>0?.25:1)*(z.stagger>0?.35:1)*(z.webT>0?.15:1)*(z.stunT>0?.06:1);if(z.stagger>0)z.stagger-=dt;
    if(z.stunT>0){z.stunT-=dt;if(z.twitch<.15)z.twitch=.3;if(Math.random()<dt*8)emit({x:z.x+rand(-.3,.3),y:z.h+rand(.4,1.7)*z.g.scale.x,z:z.z+rand(-.3,.3)},2,.6,.8,1,1.5,.5);}
    if(z.attackT>0){const prev=z.attackT;z.attackT-=dt;
      // l'attacco ha slancio: prima del colpo fa un passo verso di te (in BO1 non restano piantati sul posto)
      if(z.state==='chase'&&z.attackT>z.attStrike&&dp>.62)moveToward(z,tgtX,tgtZ,z.attStyle==='frenzy'?3.2:1.7,dt,10);
      if(prev>z.attStrike&&z.attackT<=z.attStrike){if(z.slam){z.slam=false;bossSlam(z);}
        else if(!lure&&z.state==='window'&&z.win){const wi=z.win.inner;/* colpo attraverso la finestra */
          if(Math.hypot(P.x-wi.x,P.z-wi.z)<1.45&&Math.abs(P.h-z.win.h)<1.3)hurtPlayer(z.attDmg,z.x,z.z);netHurtNear(wi.x,wi.z,z.win.h,1.45,z.attDmg,false);}
        else if(!lure){if(Math.hypot(P.x-z.x,P.z-z.z)<reach+.22&&Math.abs(P.h-z.h)<1.3)hurtPlayer(z.attDmg,z.x,z.z);netHurtNear(z.x,z.z,z.h,reach+.22,z.attDmg,false);}}}
    else if(z.cd>0)z.cd-=dt;
    if(z.boss&&z.state==='chase'){if(z.hp<z.maxHp*.5&&!z.rage){z.rage=true;z.speed=3.7;Sfx.roar(.55);Sfx.scream(dp,0);showMsg('Il Capomastro è infuriato',2);}
      z.slamCD-=dt;if(z.slamCD<=0&&z.attackT<=0&&dp<7.5&&sameLevel&&!(z.stunT>0)){z.slamCD=z.rage?rand(3.2,4.5):rand(5,7);z.slam=true;z.attStyle='double';z.attDur=1;z.attStrike=.25;z.attackT=1;z.attDmg=0;z.cd=.6;Sfx.roar(.6);}}
    if(z.state==='chase'&&dp<reach&&sameLevel&&z.attackT<=0&&z.cd<=0&&z.webT<=0&&!(z.stunT>0)){const A=z.crawl?ATTACKS.grab:z.boss?ATTACKS.run:z.fond?ATTACKS.sprint:ATTACKS[z.type];z.attStyle=A.style;z.attDur=A.dur;z.attStrike=A.strike;z.attDmg=z.boss?90:z.fond?60:A.dmg;z.attackT=A.dur;z.cd=A.cd;z.swipeSide=-(z.swipeSide||1);if(!lure)Sfx.snarl(A.pitch);}
    /* zombie aggressivi (corridori e scattisti, dal 3º round in poi): se gli passi addosso o gli sfili accanto ti colpiscono subito, senza caricare il colpo.
       Il movimento resta quello di prima (li sposti ancora passando), ma il colpo lo prendi */
    if(z.contactCD>0)z.contactCD-=dt;
    if(z.state==='chase'&&!lure&&!z.crawl&&(z.type!=='walk'||z.fond||z.boss)&&!(z.contactCD>0)&&!(z.stunT>0)&&z.webT<=0&&!z.knock&&!(z.stagger>.5)&&!(z.attackT>0&&z.attackT<=z.attStrike)){
      const cr=(z.boss?1.05:z.fond?.8:.68)+.24;
      for(const t of TG){if(Math.hypot(t.x-z.x,t.z-z.z)>=cr||Math.abs(t.h-z.h)>=1)continue;
        const A=z.boss?ATTACKS.run:z.fond?ATTACKS.sprint:ATTACKS[z.type];z.attStyle=(z.type==='sprint'||z.fond)?'frenzy':'swipe';z.attDur=A.dur;z.attStrike=A.strike;z.attackT=A.strike-.001;/* animazione già dopo il colpo */
        z.cd=Math.max(z.cd,A.cd);z.swipeSide=-(z.swipeSide||1);z.attDmg=z.boss?90:z.fond?60:A.dmg;z.contactCD=1.1;z.yaw=Math.atan2(t.x-z.x,t.z-z.z);
        if(t===P)hurtPlayer(z.attDmg,z.x,z.z);else netHurtOne(t,z.attDmg,z.x,z.z);Sfx.snarl(A.pitch);break;}}
    const w=z.win;
    if(z.knock){const kn=z.knock;kn.t+=dt;if(kn.t<.45){z.x+=kn.vx*dt;z.z+=kn.vz*dt;kn.vx*=.9;kn.vz*=.9;kn.vy-=14*dt;kn.y=Math.max(0,kn.y+kn.vy*dt);collide(z,.3,z.h);z.h=hAt(z.x,z.z,z.h);}
      else kn.y=Math.max(0,kn.y-dt*4);z.g.position.set(z.x,z.h+kn.y,z.z);poseZombie(z,dt);if(kn.t>1.9)z.knock=null;continue;}
    if(z.state==='approach'){if(flow[ix(Math.floor(w.land.x),Math.floor(w.land.z),w.l)]===65535){z.lostT=(z.lostT||0)+dt;if(z.lostT>3){relocate(z);continue;}}else z.lostT=0;
      const high=Math.abs(w.h-w.gh)>.3&&!z.scaled;w.climbers=w.climbers||[];const free=(!w.occupant||w.occupant===z)&&!(w.boards===0&&w.climbers.length>0&&z.lane==null);
      if(z.lane!=null&&w.boards>0){w.climbers=w.climbers.filter(q=>q!==z);z.lane=null;}
      if(w.boards===0&&z.lane==null&&(!w.occupant||w.occupant===z)){const cap=winCap(w);if(w.climbers.length<cap){const l=freeLane(w);if(l>=0&&l<cap){z.lane=l;z.laneOff=cap===1?0:[-.42,.42,0][l];w.climbers.push(z);if(w.occupant===z)w.occupant=null;}}}
      if(z.lane!=null){const lx=w.nz?1:0,lz=w.nx?1:0,B=high?w.base:w.pos;const d=moveToward(z,B.x+lx*z.laneOff,B.z+lz*z.laneOff,spd,dt);z.h=z.scaled?w.h:w.gh;if(d<.12){if(high){z.state='scale';z.scaleT=0;}else{z.state='climb';z.climbT=0;}}}
      else{
      const qx=w.cx+w.nx*1.3+(w.nz?z.qo*.8:0),qz=w.cz+w.nz*1.3+(w.nx?z.qo*.8:0);
      const tx=high?(free?w.base.x:qx):(free?w.pos.x:qx),tz=high?(free?w.base.z:qz):(free?w.pos.z:qz);
      const d=moveToward(z,tx,tz,spd,dt);z.h=z.scaled?w.h:w.gh;
      if(free&&d<.12){if(high){w.occupant=z;z.state='scale';z.scaleT=0;}else{w.occupant=z;z.state='window';z.tearT=Math.max(.6,1.2-round*.03);}}}}
    else if(z.state==='scale'){z.scaleT+=dt;z.yaw=turn(z.yaw,Math.atan2(-w.nx,-w.nz),dt*8);const dur=Math.max(.8,Math.abs(w.h-w.gh)/1.7),k=Math.min(1,z.scaleT/dur);
      const lo=z.lane!=null?z.laneOff:0,lx=(w.nz?1:0)*lo,lz=(w.nx?1:0)*lo;z.h=lerp(w.gh,w.h,k)+(z.lane===2?.4*k:0);if(k>.8){const k2=(k-.8)/.2;z.x=lerp(w.base.x,w.pos.x,k2)+lx;z.z=lerp(w.base.z,w.pos.z,k2)+lz;}
      if(Math.random()<dt*6)emit({x:z.x,y:z.h+.3,z:z.z},1,.3,.28,.25,.4,-.5);if(k>=1){z.scaled=true;z.x=w.pos.x+lx;z.z=w.pos.z+lz;z.h=w.h;z.state=z.lane!=null&&w.boards===0?'climb':'window';z.climbT=0;z.tearT=Math.max(.6,1.2-round*.03);}}
    else if(z.state==='window'){z.yaw=turn(z.yaw,Math.atan2(-w.nx,-w.nz),dt*8);
      // come in BO1: se sei lì dietro mentre strappa le assi, allunga il braccio attraverso la finestra e ti colpisce
      if(w.boards>0&&!lure&&z.attackT<=0&&z.cd<=0&&!(z.stunT>0)&&TG.some(t=>Math.hypot(t.x-w.inner.x,t.z-w.inner.z)<1.35&&Math.abs(t.h-w.h)<1.3)){
        const A=ATTACKS.run;z.attStyle='swipe';z.attDur=A.dur;z.attStrike=A.strike;z.attDmg=z.fond?60:A.dmg;z.attackT=A.dur;z.cd=1.3;z.swipeSide=-(z.swipeSide||1);Sfx.snarl(1.1);}
      if(w.boards>0){if(z.attackT<=0)z.tearT-=dt;/* mentre colpisce attraverso la finestra non strappa */if(z.tearT<=0){w.boards--;setBoard(w,w.boards,false);flyBoard(w,w.boards);if(Math.hypot(w.cx-P.x,w.cz-P.z)<30)Sfx.board(clamp(((w.cx-P.x)*Math.cos(P.yaw)-(w.cz-P.z)*Math.sin(P.yaw))/10,-1,1));z.tearT=Math.max(.6,1.2-round*.03);}}
      else{w.climbers=w.climbers||[];if(z.lane==null){const l=freeLane(w);if(l<0)continue;z.lane=l;z.laneOff=w.climbers.length?[-.42,.42,0][l]:0;w.climbers.push(z);}z.state='climb';z.climbT=0;w.occupant=null;}}
    else if(z.state==='climb'){z.climbT+=dt/CLIMB_DUR(z);const u=Math.min(1,z.climbT);
      // come in BO1: mani sul davanzale e ginocchio su, accovacciato sul davanzale, salto giù dentro (chi striscia passa carponi)
      const [x,zz,h,rx]=climbPose(w,u,z.laneOff||0,z.lane===2?.55:0,z.crawl);z.x=x;z.z=zz;z.h=h;z.climbRX=rx;z.climbU=u;z.yaw=Math.atan2(-w.nx,-w.nz);
      if(u>=1){z.state='chase';z.h=hAt(z.x,z.z,w.h);z.climbRX=0;z.vel=z.speed*.6;w.climbers=(w.climbers||[]).filter(q=>q!==z);z.lane=null;if(Math.hypot(z.x-P.x,z.z-P.z)<20)Sfx.thud(Math.hypot(z.x-P.x,z.z-P.z));}}
    else if(z.state==='rise'){z.riseT+=dt;const k=Math.min(1,z.riseT/1.9);
      const rh=z.riseH??hAt(z.x,z.z);/* quota del pavimento da cui esce (con più strati non si può chiedere "sotto i piedi") */
      if(z.water){z.x=lerp(z.x,z.tx,Math.min(1,dt*1.4));z.z=lerp(z.z,z.tz,Math.min(1,dt*1.4));z.h=lerp(-4.4,rh,Math.min(1,k*1.1));}
      else{z.h=rh-1.9*(1-k*k*(3-2*k));if(Math.random()<dt*14)emit({x:z.x+rand(-.3,.3),y:rh+.05,z:z.z+rand(-.3,.3)},2,.23,.2,.15,1,1.2);}
      z.yaw=turn(z.yaw,Math.atan2(dxp,dzp),dt*2);if(z.riseT>=1.9){z.state='chase';z.h=hAt(z.x,z.z,rh);}}
    else{let tx,tz;const cx=Math.floor(z.x),cz=Math.floor(z.z),ci=inb(cx,cz)?cellAt(cx,cz,z.h):0;
      if(flow[ci]===65535&&!z.boss&&!lure){z.lostT=(z.lostT||0)+dt;if(z.lostT>4&&dp>8){relocate(z);continue;}}else z.lostT=0;
      if(z.orbit){const O=z.orbit;O.t-=dt;O.a+=O.dir*Math.max(spd,.9)/O.r*dt;tx=O.cx+Math.cos(O.a)*O.r;tz=O.cz+Math.sin(O.a)*O.r;if(O.t<=0||dp<1.2){z.orbit=null;z.stuckT=0;}}
      else if(dp<16&&sameLevel&&los(z.x,z.z,tgtX,tgtZ,z.h)){tx=tgtX;tz=tgtZ;}/* dritti verso di te solo se sei sul loro piano: se stai sul ballatoio vanno alle scale */
      else{z.navT=(z.navT||0)-dt;
        if(z.navT<=0||z.navFrom!==ci){z.navT=.15;z.navFrom=ci;let c=ci,t=-1;for(let s=0;s<4;s++){const n=nextCell(c,z);if(n<0)break;c=n;if(s===0){t=n;continue;}if(los(z.x,z.z,cX(c)+.5,cZ(c)+.5,z.h))t=c;else break;}z.navC=t;}
        if(z.navC>=0){tx=cX(z.navC)+.5;tz=cZ(z.navC)+.5;}else{tx=cx+.5;tz=cz+.5;if(dp>1.5)z.stuckT=(z.stuckT||0)+dt;}}
      if(z.avoid&&z.avoid.length){for(let k=z.avoid.length-1;k>=0;k--){z.avoid[k].t-=dt;if(z.avoid[k].t<=0)z.avoid.splice(k,1);}}
      if(!z.orbit&&z.stuckT>1.1){z.orbitN=(z.orbitN||0)+1;markStuck(z,ci);
        if(z.orbitN>=3){z.orbitN=0;if(dp>7&&!(sameLevel&&los(z.x,z.z,tgtX,tgtZ,z.h))){relocate(z);continue;}const n=nextCell(ci,z);if(n>=0){z.x=cX(n)+.5;z.z=cZ(n)+.5;z.h=hAt(z.x,z.z,cellH[n]);}z.stuckT=0;}
        else{const side=Math.random()<.5?1:-1,r=.95,px=Math.cos(z.yaw)*side,pz=-Math.sin(z.yaw)*side,ocx=z.x+px*r,ocz=z.z+pz*r;
        z.orbit={cx:ocx,cz:ocz,a:Math.atan2(z.z-ocz,z.x-ocx),r,dir:side,t:1.5};z.stuckT=0;}}
      if(z.stuckT===0&&!z.orbit){z.freeT=(z.freeT||0)+dt;if(z.freeT>3){z.orbitN=0;z.freeT=0;}}else z.freeT=0;
      /* movimento in stile COD Zombies:
         - accelerazione morbida (ripartono dopo un colpo o un attacco invece di scattare a velocità piena)
         - quando ti vedono e sono vicini fanno uno scatto finale verso di te
         - corridori e scattisti ondeggiano a zig-zag mentre arrivano (più difficili da colpire in testa), i lenti barcollano appena
         - si girano di scatto verso di te */
      const chase=tx===tgtX&&tz===tgtZ&&sameLevel;let want=spd;
      // ogni tanto inciampa e si riprende, come gli zombie di BO1 (non gli scattisti, non vicino a te)
      if(!z.boss&&!z.crawl&&z.type!=='sprint'){z.stumN=(z.stumN??rand(4,10))-dt;if(z.stumN<=0&&dp>3.5&&z.attackT<=0){z.stumN=rand(5,11);z.stumT=.55;z.fdir=Math.random()<.5?-1:1;}}
      if(z.stumT>0){z.stumT-=dt;want*=.3;}
      if(chase&&!z.boss&&!z.crawl&&z.attackT<=0&&dp<5&&dp>reach)want*=z.type==='walk'?1.15:1.28;
      z.vel=lerp(z.vel||0,want,Math.min(1,dt*(want>(z.vel||0)?2.6:8)));
      if(chase&&!z.boss&&!z.crawl&&dp>2.2&&dp<16){const W=z.type==='sprint'?.85:z.type==='run'?.6:.2,F=(z.type==='sprint'?3.1:z.type==='run'?2.3:1.1)*(z.wf||1);
        const a=W*clamp((dp-2.2)/5,0,1)*Math.sin(z.t*F+(z.wv||0));tx+=-dzp/dp*a;tz+=dxp/dp*a;}
      const bx=z.x,bz=z.z;if(dp>reach-.13||!sameLevel)moveToward(z,tx,tz,z.vel,dt,z.type==='walk'?6:10);else z.yaw=turn(z.yaw,Math.atan2(dxp,dzp),dt*10);collide(z,z.boss?.45:.3,z.h);z.h=hAt(z.x,z.z,z.h);
      const pr=Math.hypot(z.x-bx,z.z-bz);if(dp>1.5&&z.vel>.3&&z.attackT<=0&&!z.orbit&&pr<z.vel*dt*.25)z.stuckT=(z.stuckT||0)+dt;else z.stuckT=Math.max(0,(z.stuckT||0)-dt*2);
      if((z.fond||z.boss)&&Math.random()<dt*5)emit({x:z.x+rand(-.2,.2),y:z.h+rand(.6,1.6),z:z.z+rand(-.2,.2)},1,1,.5,.1,.3,.8,-1,[.3,.6]);}
    {const mv=Math.hypot(z.x-ox,z.z-oz);if(z.state==='chase'||z.state==='approach'){z.moving=mv>dt*.15;z.phase+=mv*Math.PI*2/(z.crawl?.9:GAIT[z.type].D*z.g.scale.x);}
      if((z.fond||z.boss)&&z.moving&&z.state==='chase'){const u=((z.phase/(Math.PI*2))%1+1)%1,pu=z.stepU||0;if((pu<.5&&u>=.5)||u<pu)footstep(z);z.stepU=u;}}
    z.g.position.set(z.x,z.h,z.z);z.g.rotation.y=z.yaw;poseZombie(z,dt);
    z.groanT-=dt;if(z.groanT<=0){z.groanT=rand(3,7);const rx=(z.x-P.x)*Math.cos(P.yaw)-(z.z-P.z)*Math.sin(P.yaw),dd=Math.hypot(z.x-P.x,z.z-P.z);if(z.type==='sprint'&&Math.random()<.45)Sfx.scream(dd,clamp(rx/8,-1,1),sndOcc(z.x,z.h+1.5,z.z));else Sfx.groan(dd,clamp(rx/8,-1,1),z.type==='sprint'||z.boss,sndOcc(z.x,z.h+1.5,z.z));}
  }
  for(let i=0;i<zombies.length;i++){const a=zombies[i];if(!a.active||a.state!=='chase')continue;
    for(let j=i+1;j<zombies.length;j++){const b=zombies[j];if(!b.active||b.state!=='chase')continue;const dx=b.x-a.x,dz=b.z-a.z,d2=dx*dx+dz*dz;if(d2<.36&&d2>1e-6&&Math.abs(a.h-b.h)<.8){const d=Math.sqrt(d2),k=(.6-d)/d*.5;a.x-=dx*k;a.z-=dz*k;b.x+=dx*k;b.z+=dz*k;}}
    const dx=a.x-P.x,dz=a.z-P.z,d=Math.hypot(dx,dz),rr=a.boss?1.05:a.fond?.8:.68;if(d<rr&&d>1e-4&&Math.abs(a.h-P.h)<.9){const k=(rr-d)/d;a.x+=dx*k*.85;a.z+=dz*k*.85;P.x-=dx*k*.15;P.z-=dz*k*.15;}}
}
let flyNext=0;
function flyBoard(w,k){const f=flyBoards[flyNext++%flyBoards.length];f.m.visible=true;f.t=1.2;boardMats[w.i*6+k].decompose(f.m.position,f.m.quaternion,f.m.scale);
  f.v.set(-w.nx*rand(2,3.5)+rand(-.6,.6),rand(1,2.5),-w.nz*rand(2,3.5)+rand(-.6,.6));f.av.set(rand(-6,6),rand(-6,6),rand(-6,6));}
function updateFly(dt){flyBoards.forEach(f=>{if(f.t<=0)return;f.t-=dt;f.v.y-=9.8*dt;f.m.position.addScaledVector(f.v,dt);const fl=hAt(f.m.position.x,f.m.position.z,f.m.position.y)+.05;
  if(f.m.position.y<fl){f.m.position.y=fl;f.v.multiplyScalar(.4);}f.m.rotation.x+=f.av.x*dt;f.m.rotation.y+=f.av.y*dt;if(f.t<=0)f.m.visible=false;});}

/* =========================================================
   MISSIONI DELLA FORGIA
   ========================================================= */
function unlockForge(quiet){if(Forge.unlocked)return;Forge.unlocked=true;Forge.chains.visible=false;Forge.glowMat.color.set(0xff6a1a);netEv({t:'forge'});if(quiet)return;Sfx.door();
  setTimeout(()=>showMsg('La Forgia si è accesa<small>'+(M.forgeWhere||(M.id==='prigione'?'in fondo al pontile del molo':"sulla bocca dell'altoforno"))+'</small>',3),1200);}
function questOnKill(z){
  if(M.quest!=='furnace'||!Furn||Q.valves<3||Q.lit)return;
  if(Math.hypot(z.x-Furn.x,z.z-Furn.z)<M.furnace.r&&Math.abs(z.h-Furn.h)<3){Q.feed++;qSfx('soul');
    soulFx(z.x,z.h+1.2,z.z,Furn.x,Furn.z,0);/* le scie rosse verso l'altoforno, viste da tutti */
    if(Q.feed>=M.furnace.need){Q.lit=true;qSfx('power');qMsg("L'altoforno ruggisce",2.5);unlockForge();}}
}
function forgeShow(w,pap){if(Forge.disp){Forge.g.parent.remove(Forge.disp);Forge.disp=null;}if(!w)return;const m=gunModel(WEAPONS[w.id].model,false,pap);m.scale.setScalar(1.6);
  m.position.set(Forge.g.position.x,Forge.h+1.35,Forge.g.position.z);Forge.g.parent.add(m);Forge.disp=m;}
function forgeGiveBack(){const w=Forge.w;Forge.w=null;Forge.ready=false;forgeShow(null);receiveWeapon(w);Sfx.buy();}
function updateForge(dt){
  if(Forge.unlocked)Forge.glowMat.color.setRGB(1,.35+Math.sin(performance.now()/180)*.08,.08);
  KEYOBJ.forEach((k,i)=>{if(k.got)return;k.g.rotation.y+=dt*1.6;k.g.position.y=k.h+k.dy+Math.sin(performance.now()/400+i)*.04;});
  RECS.forEach(r=>{r.led.color.setHex(r.heard?0x3a1a18:(Math.floor(performance.now()/500)%2?0xff2a1a:0x4a0a06));});
  VALVES.forEach(v=>{if(v.done&&Math.random()<dt*12){const p=v.g.position;emit({x:p.x,y:p.y+1.2,z:p.z},1,.8,.8,.8,.6,2.4,-2,[.6,1.2]);}});
  if(Furn){const k=Q.lit?1:Q.valves>=3?.25+.6*Q.feed/M.furnace.need:Q.valves*.06;Furn.ring.material.color.setRGB(.2+.8*k,.08+.4*k,.03+.05*k);}
  if(Forge.t>0){Forge.t-=dt;if(Math.random()<dt*10)emit({x:Forge.g.position.x+rand(-.4,.4),y:Forge.h+1.2,z:Forge.g.position.z},3,1,.55,.15,1.2,1.5);
    if(Forge.t<=0&&Forge.w){const w=Forge.w;w.forging=false;w.pap=true;const e=wd(w);w.mag=e.mag;w.reserve=e.reserve;w.mL=w.mR=undefined;Forge.ready=true;forgeShow(w,true);Sfx.buy();Sfx.pup();showMsg(`${e.name}<small>è pronta: riprendila dalla Forgia</small>`,2.8);}}
  if(Forge.disp){Forge.disp.rotation.y+=dt*(Forge.ready?1.4:.3);Forge.disp.position.y=Forge.h+(Forge.ready?1.75+Math.sin(performance.now()/300)*.05:1.35);}
}

/* =========================================================
   INTERAZIONI
   ========================================================= */
function near(x,z,h,r){return Math.hypot(P.x-x,P.z-z)<r&&Math.abs(P.h-h)<1.3;}
function findInteract(){
  if(P.dead)return null;let best=null,bd=1e9;const cand=(d,o)=>{if(d<bd){bd=d;best=o;}};
  DOORS.forEach(d=>{if(d.open)return;const dd=Math.hypot(P.x-d.cx,P.z-d.cz);if(dd<2.6&&Math.abs(P.h-d.h)<1.3)cand(dd,{t:'door',d});});
  TRAPS.forEach(T=>{const dd=Math.hypot(P.x-T.sx,P.z-T.sz);if(dd<1.5&&Math.abs(P.h-T.h)<1.3)cand(dd-.3,{t:'trap',T});});
  WALLBUYS.forEach(b=>{const dd=Math.hypot(P.x-b.x,P.z-b.z);if(dd<1.5&&Math.abs(P.h-hAt(b.x,b.z,b.y))<1.3)cand(dd,{t:'wall',b});});
  PERKS.forEach(p=>{if(near(p.x,p.z,p.h,1.6))cand(Math.hypot(P.x-p.x,P.z-p.z),{t:'perk',p});});
  if((Box.state==='idle'||(Box.state==='ready'&&(!NET.on||Box.owner===NET.me)))&&Box.g.visible&&near(Box.ix,Box.iz,Box.h,2))cand(Math.hypot(P.x-Box.ix,P.z-Box.iz),{t:'box'});
  {const rp=netReviveTarget();if(rp)cand(.01,{t:'revive',p:rp});}
  if(!Power.on&&near(Power.x,Power.z,Power.h,1.6))cand(0,{t:'power'});
  WINDOWS.forEach(w=>{if(w.boards>=6||!regionOpen[w.region])return;const dd=Math.hypot(P.x-w.inner.x,P.z-w.inner.z);if(dd<1.6&&Math.abs(P.h-w.h)<1.3)cand(dd+.4,{t:'repair',w});});
  if(near(Forge.x,Forge.z,Forge.h,1.8))cand(Math.hypot(P.x-Forge.x,P.z-Forge.z),{t:'forge'});
  RECS.forEach(r=>{if(near(r.x,r.z,r.h,1.5))cand(.3,{t:'rec',r});});
  KEYOBJ.forEach(k=>{if(!k.got&&near(k.x,k.z,k.h,1.5))cand(.1,{t:'key',k});});
  VALVES.forEach(v=>{if(!v.done&&near(v.x,v.z,v.h,1.5))cand(.2,{t:'valve',v});});
  if(Q3){const A=Q3.altar;
    if(Q3.step>=2&&inv.some(w=>w.id==='arco')&&near(A.x,A.z,A.h,2.3)&&!(Q3.step===3&&!Q3.placed)&&!(Q3.step===4&&!Q3.hasKey))cand(.6,{t:'quiver'});
    if(Q3.step===1&&near(A.x,A.z,A.h,2.3))cand(.05,{t:'bowpick'});else if(Q3.step===3&&!Q3.placed&&near(A.x,A.z,A.h,2.3))cand(.05,{t:'ossario'});else if(Q3.step===4&&!Q3.hasKey&&near(A.x,A.z,A.h,2.3))cand(.05,{t:'bonekey'});
    for(const [L,to] of [[Q3.up,Q3.down],[Q3.down,Q3.up]])if(near(L.x,L.z,L.h,1.7))cand(.1,{t:'lift',L,to});
    const S=M.egg3.shrine;if(near(S.x,S.z,Q3.shrineH,2.7)){if(Q3.step===7&&Q3.heartHeld)cand(.05,{t:'heart'});else if(Q3.step===8&&Q3.reward.visible)cand(.05,{t:'reward'});else if(Q3.done&&Q3.aurora)cand(.05,{t:'takeAur'});else if(Q3.done&&inv[cur]&&inv[cur].id==='aurora')cand(.5,{t:'storeAur'});}}
  if(Q2){const C=M.egg2.crucible;const ch=hAt(C.ix,C.iz);if(Q2.elixir.visible&&near(C.ix,C.iz,ch,1.8))cand(.05,{t:'elixir'});else if(Q2.step>=3&&!Q2.done&&near(C.ix,C.iz,ch,2.2))cand(.4,{t:'crucible'});}
  if(Q4)egg4Cands(cand);
  return best;
}
function promptFor(it){
  const cost=n=>(points>=n||(DEV.on&&DEV.money))?`<b>${n}</b>`:`<span class="no">${n}</span>`;const E=TOUCH.on?'<b>USA</b>':`<b>${keyName(BIND.use)}</b>`;
  switch(it.t){
    case 'door':return `${E} · ${it.d.kind==='debris'?'Sgombra i rottami verso':'Apri verso'} ${it.d.to} · ${cost(it.d.cost)}`;
    case 'trap':return trapPrompt(it.T,E,cost);
    case 'wall':{const d=WEAPONS[it.b.w],ow=inv.find(w=>w.id===it.b.w);return ow?`${E} · Munizioni ${wd(ow).name} · ${cost(wd(ow).ammo)}`:`${E} · Compra ${d.name} · ${cost(d.cost)}`;}
    case 'perk':{const p=it.p;if(perks.has(p.id))return (noLimit()||M.id==='prigione')?`${p.name} già attiva`:`${E} · Disattiva ${p.name} (ti restituisco ${p.cost})`;if(!Power.on)return `${p.name}: serve la corrente`;
      if(!noLimit()&&perks.size>=PERK_LIMIT)return `Hai già ${PERK_LIMIT} bevande: disattivane una alla sua macchinetta`;return `${E} · Bevi ${p.name}, ${p.desc} · ${cost(p.cost)}`;}
    case 'bowpick':return `${E} · Prendi l'Arco di Brace`;
    case 'quiver':return `${E} · Riempi la faretra · ${cost(1000)}`;
    case 'ossario':return Q3.held>=5?`${E} · Infilza i cinque teschi sull'ossario`:`L'ossario vuole cinque teschi (${Q3.held}/5)`;
    case 'bonekey':return `${E} · Prendi la chiave d'ossa`;
    case 'lift':if(!Q3.liftOn)return Q3.hasKey?`${E} · Infila la chiave d'ossa nel montacarichi`:"Il montacarichi è fermo. Nella serratura c'è un foro a forma di osso";
      if(Q3.step===6)return 'Il montacarichi non risponde';return `${E} · Montacarichi · ${it.L===Q3.up?'scendi alle Fondamenta':'risali al piano di colata'}`;
    case 'heart':return `${E} · Rendi il cuore al sarcofago`;
    case 'reward':return `${E} · Prendi l'Aurora`;
    case 'takeAur':return `${E} · Prendi l'Aurora · ${Q3.aurora.mag} / ${Q3.aurora.reserve}`;
    case 'storeAur':return `${E} · Lascia l'Aurora nel sarcofago: si ricarica di 5 colpi per ogni zombie ucciso`;
    case 'crucible':return egg2Prompt(E);case 'elixir':return `${E} · Bevi l'elisir d'acciaio`;
    case 'r4':return egg4Prompt(it,E);
    case 'box':if(Box.state==='ready')return `${E} · Prendi ${Box.weapon==='carillon'?'Carillon ×3':WEAPONS[Box.weapon].name}`;return `${E} · Cassa misteriosa · ${cost(BOX_COST)}`;
    case 'power':return `${E} · Attiva la corrente`;
    case 'repair':return `Tieni premuto ${E} per rimettere le assi`;
    case 'revive':return `Tieni premuto ${E} per rialzare ${esc(it.p.n)}${NET.reviveT>0?` · ${Math.min(100,Math.round(NET.reviveT/3*100))}%`:''}`;
    case 'key':return `${E} · Raccogli ${M.keyItem?M.keyItem.one:'la chiave'}`;
    case 'rec':return `${E} · Ascolta il nastro`;
    case 'valve':if(!Power.on)return 'La valvola non gira: le pompe sono ferme';return `Tieni premuto ${E} per girare la valvola${Q.valveHold>0?` · ${Math.round(Q.valveHold/3*100)}%`:''}`;
    case 'forge':{const w=inv[cur];if(!Forge.unlocked)return M.quest==='keys'?(M.keyItem?`La Forgia è spenta. Servono tre ${M.keyItem.many} (${Q.keys}/3)`:`Una forgia incatenata. Servono tre chiavi (${Q.keys}/3)`):'La bocca del forno è fredda e incatenata';
      if(!Power.on)return 'La Forgia è fredda: serve la corrente';if(Forge.ready&&Forge.w)return `${E} · Riprendi ${wd(Forge.w).name}`;if(Forge.w)return 'Forgiatura in corso…';if(w.id==='mani')return 'Non hai niente da forgiare';if(w.id==='arco')return "L'arco non entra nella Forgia";if(w.pap)return `${wd(w).name} è già forgiata`;return `${E} · Forgia ${WEAPONS[w.id].name} · ${cost(5000)}`;}
  }return '';
}
function useInteract(it){
  switch(it.t){
    case 'door':if(spend(it.d.cost)){openDoor(it.d);netReq({t:'door',d:DOORS.indexOf(it.d)});}break;
    case 'trap':trapUse(it.T);break;
    case 'wall':{const d=WEAPONS[it.b.w],own=inv.find(w=>w.id===it.b.w);
      if(own){const e=wd(own);if(own.reserve>=e.reserve&&own.mag>=e.mag){showMsg('Munizioni già piene',1);return;}if(spend(e.ammo)){own.mag=e.mag;own.reserve=e.reserve;}}else if(spend(d.cost))giveWeapon(it.b.w);break;}
    case 'quiver':{const w=inv.find(x=>x.id==='arco');if(!w)return;const e=wd(w);if(w.mag>=e.mag&&w.reserve>=e.reserve){showMsg('Faretra già piena',1);return;}if(spend(1000)){w.mag=e.mag;w.reserve=e.reserve;}break;}
    // missioni: online chi non è host fa la parte sua (arma, munizioni) e manda il resto all'host, che avvisa tutti
    case 'bowpick':if(NET.client)netReq({t:'q',a:'bowpick'});else{Q3.step=2;qSfx('power');}giveWeapon('arco');Sfx.power();showMsg("L'Arco di Brace<small>tieni premuto per tendere, rilascia per scoccare</small>",3.4);break;
    case 'ossario':if(Q3.held<5)return;if(NET.client){netReq({t:'q',a:'ossario'});break;}Q3.placed=true;Q3.held=0;Q3.altar.spikes.forEach(s=>s.visible=true);qSfx('ossa');qMsg("L'ossario ha fame<small>uccidi gli zombie qui intorno</small>",3.2);break;
    case 'bonekey':if(NET.client){netReq({t:'q',a:'bonekey'});break;}Q3.hasKey=true;Q3.altar.key.visible=false;Q3.step=4;qSfx('pup');qMsg("Chiave d'ossa<small>apre qualcosa che scende molto in basso</small>",3);break;
    case 'lift':if(!Q3.liftOn){if(!Q3.hasKey)return;if(NET.client){netReq({t:'q',a:'lift'});break;}Q3.liftOn=true;Q3.step=5;openRegion(RI.k);computeFlow();qSfx('power');qSfx('door');qMsg('Il montacarichi si è acceso<small>porta alle Fondamenta</small>',3);break;}
      if(Q3.step===6)return;startRide(it.to);break;
    case 'heart':if(NET.client){netReq({t:'q',a:'heart'});break;}Q3.heartHeld=false;Q3.step=8;Q3.rewardT=0;Q3.heart.visible=true;Q3.heart.scale.setScalar(1);qSfx('soul');qSfx('ossa');break;
    case 'reward':if(NET.client)netReq({t:'q',a:'reward'});else{Q3.done=true;Q3.step=9;netEv({t:'qm',m:`${NET.name} ha preso l'Aurora`,d:2.5});}Q3.reward.visible=false;giveWeapon('aurora');Sfx.buy();Sfx.power();showMsg('AURORA<small>mitragliatore laser · 500 colpi nel caricatore</small>',3.6);break;
    case 'takeAur':{const a=Q3.aurora;Q3.aurora=null;Q3.reward.visible=false;Q3.rewardLight.intensity=0;netReq({t:'q',a:'takeAur'});receiveWeapon({id:'aurora',mag:a.mag,reserve:a.reserve,pap:a.pap});Sfx.buy();break;}
    case 'storeAur':{const w=inv[cur];inv.splice(cur,1);if(!inv.length)inv.push({id:'mani',mag:0,reserve:0});switchTo(Math.min(cur,inv.length-1),true);
      if(NET.client){netReq({t:'q',a:'storeAur',m:w.mag,r:w.reserve,pp:w.pap?1:0});showMsg("L'Aurora è tornata nel suo sarcofago",2.4);}else storeAurora(w);Sfx.soul();break;}
    case 'crucible':if(NET.client){netReq({t:'q',a:'crucible'});break;}egg2Use();break;
    case 'r4':egg4Use(it);break;
    case 'elixir':if(NET.client)netReq({t:'q',a:'elixir'});else{Q2.done=true;netEv({t:'qm',m:"Elisir d'acciaio<small>nessun limite alle bevande, per tutta la partita</small>",d:3.5});}
      Q2.elixir.visible=false;Sfx.drink();Sfx.power();showMsg("Elisir d'acciaio<small>nessun limite alle bevande, per tutta la partita</small>",3.5);inv.forEach(w=>{const d=wd(w);w.mag=d.mag;w.reserve=d.reserve;});break;
    case 'perk':{const p=it.p;if(!Power.on)return;
      if(perks.has(p.id)){if(noLimit()||M.id==='prigione')return;perks.delete(p.id);if(p.id==='secondavita')reviveBuys=Math.max(0,reviveBuys-1);points+=p.cost;popup('+'+p.cost);applyPerks();updatePerkIcons();Sfx.deny();showMsg(`${p.name} disattivata<small>ti ho restituito ${p.cost} punti</small>`,1.8);return;}
      if(!noLimit()&&perks.size>=PERK_LIMIT){Sfx.deny();showMsg(`Massimo ${PERK_LIMIT} bevande<small>disattivane una tornando alla sua macchinetta</small>`,2.2);return;}
      if(p.id==='secondavita'&&reviveBuys>=3){showMsg('Il distributore è vuoto',1.4);return;}
      if(spend(p.cost)){perks.add(p.id);if(p.id==='secondavita')reviveBuys++;Sfx.drink();applyPerks();updatePerkIcons();showMsg(p.name.toUpperCase()+`<small>${p.desc}</small>`,2.4);}break;}
    case 'box':if(Box.state==='idle'){
        if(NET.client){if(NET.boxPend>performance.now())return;if(spend(BOX_COST)){NET.boxPend=performance.now()+2500;netReq({t:'boxroll'});}break;}/* la cassa la fa girare l'host */
        if(spend(BOX_COST))boxRoll(NET.on?NET.me:null);}
      else if(Box.state==='ready'){giveWeapon(Box.weapon);Box.state='closing';Box.t=0;Sfx.buy();if(NET.client)netReq({t:'boxtake'});else netBox();}break;
    case 'power':powerOn();netReq({t:'power'});break;
    case 'key':{const k=it.k;if(NET.client){netReq({t:'q',a:'key',i:KEYOBJ.indexOf(k)});k.got=true;k.g.visible=false;break;}
      k.got=true;k.g.visible=false;Q.keys++;qSfx('pup');qMsg(M.keyItem?`Fusibile ${Q.keys}/3<small>${Q.keys<3?'ne mancano ancora':(Power.on?'la Forgia si accende':'serve ancora la corrente')}</small>`:`Chiave della Forgia ${Q.keys}/3<small>${Q.keys<3?'ne mancano ancora':'la Forgia al molo ora si può aprire'}</small>`,2.6);if(Q.keys===3&&Power.on)unlockForge();break;}
    case 'rec':it.r.heard=true;Voice.play(it.r.title,it.r.lines);break;
    case 'forge':{if(Forge.ready&&Forge.w){forgeGiveBack();break;}const w=inv[cur];if(!Forge.unlocked||!Power.on||Forge.w||w.pap||w.id==='arco'||w.id==='mani')return;
      if(spend(5000)){w.forging=true;Forge.t=3.2;Forge.w=w;Forge.ready=false;reloadT=0;inv.splice(cur,1);if(!inv.length)inv.push({id:'mani',mag:0,reserve:0});switchTo(Math.min(cur,inv.length-1),true);
        forgeShow(w,false);Sfx.forge();showMsg('La Forgia si prende la tua arma…',2.2);}break;}
  }
}
function powerOn(quiet){if(Power.on)return;Power.on=true;PERKS.forEach(p=>{p.panel.material=p.onMat;p.bulbMat.color.set(p.color);});Power.lamp.color.set(0x9cc26b);netEv({t:'power'});
  if(!quiet){Sfx.power();showMsg('Corrente attivata<small>i distributori ora funzionano</small>',2.5);}
  if(M.quest==='keys'&&Q.keys>=3)unlockForge();}
/* ---------- easter egg 2: l'anima dell'acciaio ---------- */
function wantFond(){if(Q2.event)return zombies.filter(z=>z.active&&z.fond&&z.state!=='dying').length<5&&Math.random()<.5;
  return zombies.filter(z=>z.active&&z.fond&&z.state!=='dying').length<2&&Math.random()<.18;}
/* online le missioni le porta avanti l'host: i giocatori gli mandano le loro azioni (netQuestAction in p5b_net.js)
   e ricevono stato (netQuest), messaggi (qMsg), suoni (qSfx) e scie delle anime (soulFx) */
function qMsg(html,dur){showMsg(html,dur);netEv({t:'qm',m:html,d:dur});}
function qSfx(n){if(Sfx[n])Sfx[n]();netEv({t:'sfx',n});}
function soulFx(x,y,z,tx,tz,c){const oss=c===1,col=oss?[.9,.9,1]:[1,.55,.15],sp=oss?[3,5]:[4,6],up=oss?[.5,2]:[1,2.5];
  for(let k=0;k<(oss?12:14);k++){const i=pNext++%PMAX;pPos[i*3]=x;pPos[i*3+1]=y;pPos[i*3+2]=z;pGrav[i]=-1;pFloor[i]=-99;const l=Math.hypot(tx-x,tz-z)||1;
    pVel[i*3]=(tx-x)/l*rand(sp[0],sp[1]);pVel[i*3+1]=rand(up[0],up[1]);pVel[i*3+2]=(tz-z)/l*rand(sp[0],sp[1]);pLife[i]=rand(.5,.9);pCol[i*3]=col[0];pCol[i*3+1]=col[1];pCol[i*3+2]=col[2];}
  netEv({t:'soul',x:r2(x),y:r2(y),z:r2(z),tx:r2(tx),tz:r2(tz),c:oss?1:0});}
// qualcuno (io o un compagno) abbastanza vicino da raccogliere un oggetto della missione
function anyNear(x,z,h,r,dh){if(!P.dead&&!P.bleed&&Math.hypot(P.x-x,P.z-z)<r&&Math.abs(P.h-h)<dh)return NET.name;
  if(NET.on&&NET.host)for(const p of NET.peers.values()){const s=p.s;if(s&&s.dn===0&&Math.hypot(s.x-x,s.z-z)<r&&Math.abs(s.h-h)<dh)return p.n;}return null;}
const byWho=n=>NET.on&&n&&n!==NET.name?` · ${esc(n)}`:'';
function valveDone(v){v.done=true;Q.valveHold=0;Q.valves++;qSfx('hiss');
  qMsg(Q.valves<3?`Il vapore fischia nei tubi<small>valvola ${Q.valves} di 3</small>`:"Da qualche parte, l'altoforno si scalda<small>tre valvole aperte</small>",2.8);}
function coreMesh(x,h,z){const g=new THREE.Mesh(new THREE.SphereGeometry(.16,10,8),new THREE.MeshBasicMaterial({color:0xffa030}));g.position.set(x,h+.4,z);scene.add(g);return g;}
function egg2Lamp(){const n=Q2.lamps.filter(l=>l.shot).length;if(n<4){qMsg('Un occhio rosso si spegne',1.4);return;}
  Q2.step=2;Q2.fondFrom=round;fondRound=1;qSfx('roundStart');setTimeout(()=>{Sfx.snarl(.6);qMsg('Qualcosa di rovente si è svegliato<small>i figli di ferro fuso ti cercano</small>',3.4);},900);}
function egg2OnFondKill(z){if(!Q2)return;if(Q2.event){Q2.eventKills++;return;}
  if(Q2.step===2&&Q2.dropped<3){Q2.dropped++;let x=z.x,zz=z.z;const cx=Math.floor(x),cz=Math.floor(zz),zi=inb(cx,cz)?cellAt(cx,cz,z.h):-1,ok=zi>=0&&walkable(zi)&&region[zi]>=0&&regionOpen[region[zi]];
    if(!ok){if(z.win){x=z.win.land.x;zz=z.win.land.z;}else{x=P.x;zz=P.z;}}const h=hAt(x,zz,z.h),id=++NET.puId;
    powerups.push({k:'core',s:coreMesh(x,h,zz),t:40,x,z:zz,h,id});netEv({t:'core+',id,x:r2(x),z:r2(zz),h:r2(h)});qMsg('Il ferro fuso ha lasciato un nucleo incandescente',2);}}
function egg2Prompt(E){if(Q2.event)return `Resisti · ${Math.ceil(Q2.eventT)} s · ferro fuso abbattuto ${Math.min(Q2.eventKills,M.egg2.need)}/${M.egg2.need}`;
  if(Q2.deposited<3)return Q2.held?`${E} · Versa ${Q2.held===1?'il nucleo':'i nuclei'} nel crogiolo (${Q2.deposited+Q2.held}/3)`:`Il crogiolo è freddo (${Q2.deposited}/3)`;
  return `${E} · Tira la leva: l'ultima colata`;}
function egg2Use(){if(Q2.event)return;if(Q2.deposited<3){if(!Q2.held)return;Q2.deposited+=Q2.held;Q2.held=0;qSfx('soul');emit({x:M.egg2.crucible.x,y:1.8,z:M.egg2.crucible.z},30,1,.6,.15,2,2);
    qMsg(Q2.deposited<3?'Il crogiolo si scalda':'Il crogiolo ribolle<small>la leva è pronta</small>',2.2);if(Q2.deposited>=3)Q2.step=4;return;}
  Q2.event=true;Q2.eventT=M.egg2.time;Q2.eventKills=0;Q2.lever.rotation.x=.9;qSfx('power');qSfx('roundStart');qMsg("L'ultima colata<small>resisti finché l'acciaio non si raffredda</small>",3.2);
  Q2.closed=DOORS.filter(d=>(REG[d.a]&&REG[d.a].k==='e')||(REG[d.b]&&REG[d.b].k==='e'));Q2.closed.forEach(d=>{d.wasOpen=d.open;d.open=false;d.anim=0;doorPose(d);});
  if(toSpawn<12)toSpawn=12;computeFlow();}
function updateEgg2(dt){if(!Q2)return;const C=NET.client;/* online i giocatori qui animano soltanto: le decisioni le prende l'host */
  if(!C&&Q2.step===0&&Forge.unlocked)Q2.step=1;
  if(Q2.step===1)Q2.lamps.forEach((l,i)=>{if(!l.shot)l.mat.color.setRGB(.7+.3*Math.sin(performance.now()/300+i),.05,.03);});
  for(let i=powerups.length-1;i>=0;i--){const p=powerups[i];if(p.k!=='core')continue;p.s.position.y=p.h+.4+Math.sin(performance.now()/250)*.08;if(C)continue;
    const by=anyNear(p.x,p.z,p.h,1.4,1.5);if(by){Q2.held++;qSfx('pup');qMsg(`Nucleo incandescente<small>${Q2.held+Q2.deposited} di 3${byWho(by)}</small>`,2);scene.remove(p.s);powerups.splice(i,1);netEv({t:'core-',id:p.id});
      if(Q2.held+Q2.deposited>=3)Q2.step=Math.max(Q2.step,3);}}
  if(Q2.event){Q2.eventT=Math.max(0,Q2.eventT-dt);if(!C){if(toSpawn<4)toSpawn=4;
    if(Q2.eventT<=0&&Q2.eventKills>=M.egg2.need){Q2.event=false;Q2.step=5;Q2.closed.forEach(d=>{if(d.wasOpen){d.open=true;d.anim=0;}});computeFlow();toSpawn=0;
      for(const z of zombies)if(z.active&&z.state!=='dying')killZombie(z,false,'bomb');Q2.elixir.visible=true;qSfx('pup');qMsg("L'acciaio si è raffreddato<small>sul crogiolo è rimasto qualcosa da bere</small>",3.5);}}}
  if(Q2.elixir&&Q2.elixir.visible)Q2.elixir.rotation.y+=dt*1.5;
}
/* ---------- easter egg 3: l'Arco di Brace e le Fondamenta ---------- */
function egg3Bell(b){b.swing=1;Sfx.bell();netEv({t:'bell',i:Q3.bells.indexOf(b)});if(!Q3||Q3.step!==0||b.rung)return;b.rung=true;if(Q3.ringT<=0)Q3.ringT=30;const n=Q3.bells.filter(x=>x.rung).length;
  if(n<3)qMsg(`Un rintocco nell'acciaieria<small>${n} di 3</small>`,1.8);else{Q3.step=1;Q3.ringT=0;qSfx('ossa');qMsg("Tre rintocchi<small>qualcosa si è svegliato tra i rottami</small>",3.4);}}
// self=false: l'ha colpito un compagno, la freccia in più se la dà lui
function egg3Skull(s,self){if(Q3.step<2||s.st!=='wall')return;s.st='fall';s.vy=1.5;qSfx('bell');if(self!==false){const w=inv.find(x=>x.id==='arco');if(w)w.reserve++;}qMsg('Un teschio precipita<small>+1 freccia a chi l\'ha colpito</small>',1.6);}
function egg3Brazier(b){if(Q3.step!==5||b.lit)return;const need=Q3.order[Q3.lit.length];
  if(b.sym===need){b.lit=true;Q3.lit.push(b);qSfx('soul');qSfx('arrowHit');qMsg(`Il braciere ${SYM_DEL[b.sym]} arde<small>${Q3.lit.length} di ${Q3.braziers.length}</small>`,2);
    if(Q3.lit.length===Q3.braziers.length){Q3.bossT=2.5;qMsg('Le Fondamenta tremano',2.5);shakeT=.8;qSfx('ossa');}}
  else{Q3.braziers.forEach(x=>x.lit=false);Q3.lit=[];qSfx('ossa');Sfx.scream(3,0);qMsg("Il fuoco muore<small>l'ordine era sbagliato</small>",2.6);toSpawn+=3;}}
function egg3OnKill(z){if(!Q3||Q3.step!==3||!Q3.placed||z.boss)return;const A=Q3.altar;if(Math.hypot(z.x-A.x,z.z-A.z)<M.egg3.feedR&&Math.abs(z.h-A.h)<3){Q3.fed++;qSfx('soul');
    soulFx(z.x,z.h+1.2,z.z,A.x,A.z,1);
    if(Q3.fed>=M.egg3.feed){Q3.step=4;A.key.visible=true;qSfx('power');qMsg("L'ossario è sazio<small>tra le ossa è comparsa una chiave</small>",3.2);}}}
function startBoss(){Q3.step=6;Q3.lidT=0;qSfx('roundStart');qSfx('ossa');shakeT=.9;qMsg('Il Capomastro si è svegliato<small>solo la testa gli fa male</small>',3.6);const S=M.egg3.shrine;Q3.boss=spawnBoss(S.x,S.z+.1,Q3.shrineH);Q3.bossHp=1;if(toSpawn<6)toSpawn=6;}
function egg3BossDead(z){Q3.boss=null;Q3.step=7;Q3.heartPos={x:z.x,z:z.z,h:z.h};Q3.heart.visible=true;qSfx('power');shakeT=.8;qMsg("Il Capomastro è crollato<small>raccogli il cuore dell'altoforno</small>",3.6);
  for(const q of zombies)if(q.active&&q.state!=='dying'&&q!==z)killZombie(q,false,'bomb');toSpawn=0;}
function startRide(to){if(Q3.ride)return;Q3.ride={t:0,to,done:false};Sfx.lift();}
function updateEgg3(dt){if(!Q3)return;const now=performance.now(),C=NET.client;
  Q3.bells.forEach((b,i)=>{b.sw.rotation.z=Math.sin(now/110+i)*.55*b.swing;b.swing*=Math.pow(.25,dt);});
  if(!C&&Q3.step===0&&Q3.ringT>0){Q3.ringT-=dt;if(Q3.ringT<=0){Q3.bells.forEach(b=>b.rung=false);qMsg('Le campane tacciono<small>troppo lente</small>',1.8);}}
  const A=Q3.altar;A.bow.visible=Q3.step<=1;A.bowGlow.intensity=Q3.step===1?1.6+Math.sin(now/200)*.5:0;
  if(A.key.visible){A.key.rotation.y+=dt*1.5;A.key.position.y=1.35+Math.sin(now/300)*.05;}
  A.spikes.forEach(s=>{if(s.visible)s.userData.eye.color.setRGB(.3+.7*Math.min(1,Q3.fed/M.egg3.feed),.12,.05);});
  Q3.skulls.forEach((s,i)=>{if(s.st==='wall'){s.g.userData.eye.color.setRGB(.8+.2*Math.sin(now/250+i),.15,.05);return;}
    if(s.st==='fall'){s.vy-=12*dt;s.y+=s.vy*dt;s.x-=s.fx*dt*.6;s.z-=s.fz*dt*.6;const fl=hAt(s.x,s.z);if(s.y<=fl+.2){s.y=fl+.2;s.st='ground';s.h=fl;emit({x:s.x,y:fl+.1,z:s.z},14,.5,.45,.4,2,1);Sfx.thud(Math.hypot(P.x-s.x,P.z-s.z));}
      s.g.position.set(s.x,s.y,s.z);s.g.rotation.x+=dt*6;return;}
    if(s.st==='ground'){s.g.position.y=s.h+.35+Math.sin(now/300+i)*.05;s.g.rotation.y+=dt;if(C)return;const by=anyNear(s.x,s.z,s.h,1.4,1.5);if(by){s.st='held';s.g.visible=false;Q3.held++;qSfx('pup');
        qMsg(`Teschio ${Q3.held} di 5<small>${Q3.held<5?'ne restano lassù':"portali all'ossario del deposito rottami"}${byWho(by)}</small>`,2.4);if(Q3.held>=5&&Q3.step===2)Q3.step=3;}}});
  const lampOn=Q3.liftOn?(Q3.step===6?0xff2a10:0x6ad04a):0x5a1a10;Q3.up.lampM.color.setHex(lampOn);Q3.down.lampM.color.setHex(lampOn);
  if(Q3.ride){const R=Q3.ride;R.t+=dt;const f=R.t<.8?R.t/.8:R.t<1.1?1:Math.max(0,1-(R.t-1.1)/.6);$('fade').style.opacity=f.toFixed(2);shakeT=Math.max(shakeT,.08);
    if(!R.done&&R.t>=.85){R.done=true;const L=R.to;P.x=L.x;P.z=L.z;P.h=hAt(L.x,L.z);P.yaw=Math.atan2(L.face[0],L.face[1]);P.pitch=0;P.vx=P.vz=P.vy=0;P.grounded=true;P.eyeH=P.h+1.62;computeFlow();lastPCell=-1;}
    if(R.t>1.8){Q3.ride=null;$('fade').style.opacity=0;}}
  Q3.braziers.forEach((b,i)=>{const t=b.lit||Q3.step>6;b.fire.scale.setScalar(t?1.3+Math.sin(now/90+i)*.15:.01);b.L.intensity=t?2+Math.sin(now/70+i)*.4:0;});
  if(!C&&Q3.bossT>0){Q3.bossT-=dt;if(Q3.bossT<=0)startBoss();}
  if(Q3.step>=6){Q3.lidT=Math.min(1,(Q3.lidT||0)+dt/1.5);Q3.lid.position.x=M.egg3.shrine.x+Q3.lidT*1.9;Q3.lid.rotation.z=-Q3.lidT*.25;}
  if(Q3.step===7&&Q3.heart.visible&&!Q3.heartHeld&&Q3.heartPos){const H0=Q3.heartPos;Q3.heart.position.set(H0.x,H0.h+.6+Math.sin(now/250)*.08,H0.z);
    const by=C?null:anyNear(H0.x,H0.z,H0.h,1.4,1.5);if(by){Q3.heartHeld=true;Q3.heart.visible=false;qSfx('pup');qMsg(`Cuore dell'altoforno<small>rendilo al sarcofago${byWho(by)}</small>`,2.6);}}
  if(Q3.step===8){Q3.rewardT=(Q3.rewardT||0)+dt;const S=M.egg3.shrine;Q3.heart.visible=Q3.rewardT<1.6;Q3.heart.position.set(S.x,Q3.shrineH+1.2+Q3.rewardT*.5,S.z);Q3.heart.scale.setScalar(1+Q3.rewardT);
    if(!C&&Q3.rewardT>1.6&&!Q3.reward.visible){Q3.reward.visible=true;qSfx('power');qSfx('pup');qMsg("Dal cuore è nata un'arma<small>prendila</small>",2.6);}}
  if(Q3.reward.visible){Q3.reward.rotation.y+=dt*.8;Q3.reward.position.y=Q3.shrineH+1.9+Math.sin(now/400)*.06;Q3.rewardLight.intensity=2+Math.sin(now/150)*.5;}
}
function applyPerks(){const m=perks.has('tempra')?250:150;/* un colpo normale toglie 50: 3 colpi per andare a terra, 5 con Tempra */if(P.maxHp!==m){P.maxHp=m;P.hp=Math.min(P.hp>0?Math.max(P.hp,m===250?m:0):m,m)||m;}trimInventory();}
function noLimit(){return !!(Q2&&Q2.done);}
function openDoor(d){d.open=true;d.anim=0;openRegion(d.a);openRegion(d.b);doorsOpened++;if(d.kind==='debris'){Sfx.board(0);Sfx.thud(3);Sfx.board(.3);}else Sfx.door();computeFlow();netEv({t:'door',d:DOORS.indexOf(d)});}
function updateDoors(dt){updateTraps(dt);DOORS.forEach(d=>{if(!d.open||d.anim>=1)return;d.anim=Math.min(1,d.anim+dt/(d.kind==='gate'?.9:1.15));doorPose(d);});}
function updateBox(dt){
  Box.t+=dt;const lidOpen=Box.state==='rolling'||Box.state==='ready';Box.lid.rotation.x=lerp(Box.lid.rotation.x,lidOpen?-1.2:0,Math.min(1,dt*8));
  if(Box.state!=='leaving')Box.beam.material.opacity=.3+Math.sin(performance.now()/500)*.06;const models=Box.models;
  const showModel=k=>{Object.keys(models).forEach(n=>models[n].visible=n===k);};
  if(Box.state==='rolling'){Box.swapT-=dt;if(Box.swapT<=0){Box.swapT=.08+Box.t*.06;Box.show=pick(Object.keys(models).filter(k=>k!=='serpe'));showModel(Box.show);}
    const m=models[Box.show];if(m)m.position.y=.9+Math.min(1,Box.t/3)*.65;
    // online: le decisioni (arma, spostamento, tempi) le prende l'host e le manda a tutti; gli altri animano soltanto
    if(Box.t>=3.2&&!NET.client){if(Box.willMove){showModel(null);Box.doll.visible=true;Box.doll.position.y=1.35;Box.state='leaving';Box.t=0;netBoxRefund();Sfx.laugh();showMsg('La cassa se ne va…'+(!NET.on||!Box.owner||Box.owner===NET.me?'<small>punti restituiti</small>':''),2.5);netBox();}
      else{const pool=BOX_POOL.concat(M.boxExtra||[]),opts=pool.filter(k=>!inv.some(w=>w.id===k||(k==='spingarda'&&w.id==='acida')));Box.weapon=pick(opts.length?opts:pool);showModel(Box.weapon);Box.state='ready';Box.t=0;models[Box.weapon].position.y=1.55;netBox();}}}
  else if(Box.state==='ready'){if(models[Box.weapon])models[Box.weapon].position.y=1.55-Math.min(1,Box.t/8)*.65;if(Box.t>=8&&!NET.client){Box.state='closing';Box.t=0;netBox();}}
  else if(Box.state==='closing'){showModel(null);if(Box.t>.5&&!NET.client){Box.state='idle';Box.owner=null;netBox();}}
  else if(Box.state==='leaving'){Box.doll.rotation.y+=dt*3;if(Box.t>1.4){Box.g.position.y=Box.y0+(Box.t-1.4)*(Box.t-1.4)*6;Box.beam.material.opacity=.4;}
    if(Box.t>3&&NET.client){Box.doll.visible=false;Box.g.visible=false;}
    else if(Box.t>3){Box.doll.visible=false;Box.g.visible=false;Box.state='gone';Box.t=0;const c0=Box.spot;placeBox(pick(BOX_SPOTS.map((_,i)=>i).filter(i=>i!==c0)));Box.g.visible=false;Box.owner=null;computeFlow();netBox();}}
  else if(Box.state==='gone'){if(Box.t>2&&!NET.client){Box.g.visible=true;Box.state='idle';showMsg(`La cassa è ricomparsa<small>${BOX_SPOTS[Box.spot].name}</small>`,2.5);netBox();}}
}

/* =========================================================
   GIOCATORE: movimento, salto, cadute
   ========================================================= */
const GRAV=22,JUMP_V=6.3;let jumpQueued=false;
/* quanto è coperto un suono da muri e pavimenti tra lui e le tue orecchie (0 libero, 1 dietro un muro spesso): lo rende cupo e più basso */
function sndAt(x,y,z){return {d:Math.hypot(x-P.x,z-P.z),pan:clamp(((x-P.x)*Math.cos(P.yaw)-(z-P.z)*Math.sin(P.yaw))/10,-1,1),oc:sndOcc(x,y,z)};}
function sndOcc(x,y,z){const ex=P.x,ey=P.eyeH||P.h+1.6,ez=P.z,d=Math.hypot(x-ex,y-ey,z-ez);if(d<1.5)return 0;const n=Math.min(24,Math.ceil(d/.7));let s=0;
  for(let k=1;k<n;k++){const t=k/n;if(projSolid(ex+(x-ex)*t,ez+(z-ez)*t,ey+(y-ey)*t))s++;}return Math.min(1,s*.45);}
// superficie sotto i piedi per i passi
const STEP_KIND={grate:'metal',planks:'wood',parquet:'wood',dirt:'soft',ground:'soft',rock:'soft'};
function stepKind(){const cx=Math.floor(P.x),cz=Math.floor(P.z);if(!inb(cx,cz))return 'soft';const i=cellAt(cx,cz,P.h+.1);if(kind[i]===K.WATER)return 'water';if(kind[i]===K.DOOR)return 'hard';
  if(P.h<M.liquidH+.25)return 'water';const r=region[i];return r>=0?(STEP_KIND[REG[r].floor]||(REG[r].out&&!REG[r].floor?'soft':'hard')):'soft';}
function updatePlayer(dt){
  updateDown(dt);const dn=P.downT>0;let fwd=dn?0:(kd('forward')?1:0)-(kd('back')?1:0),str=dn?0:(kd('right')?1:0)-(kd('left')?1:0),amag=1;
  if(TOUCH.mv.active&&!dn){fwd=-TOUCH.mv.y;str=TOUCH.mv.x;amag=Math.min(1,Math.hypot(fwd,str));if(amag<.12){fwd=str=0;}}
  else if(GP.on&&!dn&&(GP.mx||GP.my)){fwd=-GP.my;str=GP.mx;amag=Math.min(1,Math.hypot(fwd,str));}/* levetta del controller */
  if(keys.ArrowLeft)P.yaw+=dt*2.2;if(keys.ArrowRight)P.yaw-=dt*2.2;if(keys.ArrowUp)P.pitch=Math.min(1.45,P.pitch+dt*1.6);if(keys.ArrowDown)P.pitch=Math.max(-1.45,P.pitch-dt*1.6);
  if(devFly&&DEV.on&&!dn){devFlyMove(dt,fwd,str,amag);return;}else if(devFly&&!DEV.on)setDevFly(false);
  const fast=perks.has('passosvelto');if(P.stamina<=0)P.tired=true;else if(P.stamina>.35)P.tired=false;
  let sprint=(kd('sprint')||TOUCH.sprint||GP.sprint)&&fwd>0&&!(ads&&!vmDual)&&!trigger&&(fast||!P.tired)&&(reloadT<=0||fast);
  if(sprint&&!fast)P.stamina=Math.max(0,P.stamina-dt/3.5);else if(!sprint)P.stamina=Math.min(1,P.stamina+dt/2.5);
  let spd=sprint?(fast?7.6:6.6):4.4;if(adsT>.5)spd*=.6;if(shieldUp)spd*=.85;if(inv[cur]&&wd(inv[cur]).heavy)spd*=.9;if(grabT>0){grabT-=dt;spd*=.45;}if((TOUCH.mv.active||(GP.on&&(GP.mx||GP.my)))&&!sprint)spd*=Math.max(.35,amag);
  const sy=Math.sin(P.yaw),cy=Math.cos(P.yaw);let wx=-sy*fwd+cy*str,wz=-cy*fwd-sy*str;const wl=Math.hypot(wx,wz);if(wl>0){wx/=wl;wz/=wl;}
  const k=Math.min(1,dt*(P.grounded?12:2.5));P.vx=lerp(P.vx,wx*spd,k);P.vz=lerp(P.vz,wz*spd,k);
  P.x+=P.vx*dt;P.z+=P.vz*dt;playerCollide(P,.34);playerCollide(P,.34);
  // salto e gravità
  if(P.downT>0)jumpQueued=false;
  if(jumpQueued&&P.grounded){P.vy=JUMP_V;P.grounded=false;P.airMax=P.h;Sfx.jump();}jumpQueued=false;
  const g=groundAt(P.x,P.z,P.h);
  if(P.grounded){if(g<P.h-.5){P.grounded=false;P.vy=0;P.airMax=P.h;}else P.h=g;}
  if(!P.grounded){P.vy-=GRAV*dt;P.h+=P.vy*dt;P.airMax=Math.max(P.airMax,P.h);
    const ci=inb(Math.floor(P.x),Math.floor(P.z))?cellAt(Math.floor(P.x),Math.floor(P.z),P.h):-1;if(ci>=0&&P.h+1.8>ceilAt(ci)&&P.vy>0){P.vy=0;}
    if(P.h<=g){const fall=P.flyOff?0:P.airMax-g;P.flyOff=false;P.h=g;P.vy=0;P.grounded=true;land(fall);}}/* dopo il volo niente danno da caduta */
  P.eyeH=P.grounded?lerp(P.eyeH,P.h+(P.downT>0?.45:1.62),Math.min(1,dt*(P.downT>0?6:14))):P.h+1.62;
  P.sprinting=sprint&&wl>0;P.sprintK=lerp(P.sprintK||0,P.sprinting?1:0,Math.min(1,dt*7));const sp=Math.hypot(P.vx,P.vz);if(P.grounded)P.bob+=dt*sp*1.9;
  {const ph=Math.floor(P.bob/Math.PI);if(ph!==P.stepPh){if(P.stepPh!=null&&P.grounded&&sp>1.2&&!(P.downT>0))Sfx.step(stepKind(),P.sprinting);P.stepPh=ph;}}/* un passo ogni mezzo dondolio */
  P.hurtT+=dt;meleeTick(dt);if(P.hurtT>2.6&&P.hp<P.maxHp)P.hp=Math.min(P.maxHp,P.hp+dt*70);if(invulnT>0)invulnT-=dt;
  const r=regionAt(P.x,P.z,P.h);if(M.id==='prigione'&&r===RI.i&&!seenMolo){seenMolo=true;if(!Forge.unlocked)showMsg("In fondo al pontile c'è una forgia incatenata<small>servono tre chiavi</small>",3.2);}
  {const ci=inb(Math.floor(P.x),Math.floor(P.z))?cellAt(Math.floor(P.x),Math.floor(P.z),P.h+.1):-1;const ins=r>=0&&!REG[r].out&&ci>=0&&ceilAt(ci)<90;Sfx.room(ins);Sfx.ambTick(dt,ins);}/* eco al chiuso, vento fuori */
  if(r>=0&&r!==zoneShown){zoneShown=r;H.zone.textContent=REG[r].name;H.zone.style.opacity=1;zoneT=3;}if(zoneT>0){zoneT-=dt;if(zoneT<=0)H.zone.style.opacity=0;}
}
/* volo dello sviluppatore: la direzione è quella della visuale (anche su e giù), niente collisioni né gravità; resto della partita normale */
function devFlyMove(dt,fwd,str,amag){const fast=kd('sprint')||TOUCH.sprint||GP.sprint,sp=fast?18:8;
  const tUp=[...TOUCH.btn.values()].some(b=>b&&b.id==='tJump'),up=(kd('jump')||tUp||GP.up?1:0)-(kd('flyDown')?1:0);
  const cp=Math.cos(P.pitch),sp2=Math.sin(P.pitch),sy=Math.sin(P.yaw),cy=Math.cos(P.yaw),m=(TOUCH.mv.active||GP.on)?amag:1;
  let vx=(-sy*cp*fwd+cy*str)*m,vy=sp2*fwd*m+up,vz=(-cy*cp*fwd-sy*str)*m;const l=Math.hypot(vx,vy,vz);if(l>1){vx/=l;vy/=l;vz/=l;}
  const k=Math.min(1,dt*8);P.vx=lerp(P.vx,vx*sp,k);P.vz=lerp(P.vz,vz*sp,k);P.vy=lerp(P.vy||0,vy*sp,k);
  P.x=clamp(P.x+P.vx*dt,.3,GW-.3);P.z=clamp(P.z+P.vz*dt,.3,GH-.3);P.h=clamp(P.h+P.vy*dt,-40,90);
  P.grounded=false;P.airMax=P.h;P.eyeH=P.h+1.62;P.sprinting=false;P.sprintK=lerp(P.sprintK||0,0,Math.min(1,dt*7));jumpQueued=false;
  P.hurtT+=dt;meleeTick(dt);if(P.hurtT>2.6&&P.hp<P.maxHp)P.hp=Math.min(P.maxHp,P.hp+dt*70);if(invulnT>0)invulnT-=dt;
  const r=regionAt(P.x,P.z,P.h);if(r>=0&&r!==zoneShown){zoneShown=r;H.zone.textContent=REG[r].name;H.zone.style.opacity=1;zoneT=3;}if(zoneT>0){zoneT-=dt;if(zoneT<=0)H.zone.style.opacity=0;}
  Sfx.ambTick(dt,false);}
function shockwave(){fxRing(P.x,P.h,P.z,5.5,.5,0xdcd2c0);fxRing(P.x,P.h,P.z,3.5,.35,0xffffff);Sfx.boom(8);shakeT=Math.max(shakeT,.35);emit({x:P.x,y:P.h+.1,z:P.z},40,.45,.42,.38,5,.6,9,[.3,.6]);
  invulnT=Math.max(invulnT,1.3);
  for(const z of zombies){if(!z.active||z.boss||z.state==='dying'||z.state==='approach'||z.state==='window'||z.state==='scale'||z.state==='climb'||z.state==='rise')continue;const dx=z.x-P.x,dz=z.z-P.z,d=Math.hypot(dx,dz);
    if(d<5.5&&Math.abs(z.h-P.h)<2.5){const f=1-d/5.5,l=d||1;z.knock={t:0,vx:dx/l*(3+5*f),vz:dz/l*(3+5*f),vy:2+3*f,y:0};z.attackT=0;z.fall=-1;}}}
function land(fall){Sfx.land(fall);if(fall>2.2&&perks.has('cadutalibera')){shockwave();return;}
  if(fall>3&&!perks.has('cadutalibera'))hurtPlayer(Math.round((fall-3)*22),null,null,true);if(fall>1.5)shakeT=Math.max(shakeT,Math.min(.4,fall*.06));}
function updateWeapon(dt){
  const w=inv[cur],d=wd(w);fireCD-=dt;fireCD2-=dt;knifeCD-=dt;bowCD-=dt;bloom=Math.max(0,bloom-dt*.12);if(switchT>0)switchT-=dt;if(knifeT>0)knifeT-=dt;if(throwT>0)throwT-=dt;if(webCD>0)webCD-=dt;if(zapCD>0)zapCD-=dt;
  if(reloadT>0){reloadT-=dt;const ev=RELOAD_EV[rlKind]||[];const pr=1-reloadT/reloadDur;while(rlEvI<ev.length&&pr>=ev[rlEvI][0]){Sfx.rl(ev[rlEvI][1]);rlEvI++;}
    if(reloadT<=0){if(d.dual){dualFix(w);(w.rlSides||['mL','mR']).forEach(k=>{const t=Math.min(DUAL_MAG-w[k],w.reserve);w[k]+=t;w.reserve-=t;});w.mag=w.mL+w.mR;w.rlSides=null;}else{const need=d.mag-w.mag,take=Math.min(need,w.reserve);w.mag+=take;w.reserve-=take;}}}
  const busy=reloadT>0||switchT>0||knifeT>0||throwT>0||P.sprinting||shieldUp;if(shieldUp)ads=false;
  if(vmDual){adsT=Math.max(0,adsT-dt*6);
    if(trigger&&fireCD<=0&&!busy&&triggerEdge){fire(0);triggerEdge=false;}if(!trigger)triggerEdge=true;
    if(ads&&fireCD2<=0&&!busy&&triggerEdge2){fire(1);triggerEdge2=false;}if(!ads)triggerEdge2=true;}
  else if(d.special==='bow'){adsT=clamp(adsT+(ads&&!P.sprinting&&knifeT<=0?dt:-dt)*6,0,1);
    if(trigger&&!busy&&bowCD<=0&&w.mag>0){if(bowDraw===0)Sfx.bowDraw();bowDraw=Math.min(1,bowDraw+dt/.75);}
    else if(trigger&&w.mag<=0&&w.reserve<=0&&triggerEdge){Sfx.empty();triggerEdge=false;}
    else if(bowDraw>0){if(bowDraw>.12&&!busy&&w.mag>0){shootArrow(bowDraw);if(!(DEV.on&&DEV.ammo))w.mag--;}bowDraw=0;bowCD=.35;}
    if(!trigger)triggerEdge=true;}
  else{adsT=clamp(adsT+(ads&&!P.sprinting&&knifeT<=0?dt:-dt)*6,0,1);
    if(trigger&&fireCD<=0&&!busy&&(d.auto||triggerEdge)){fire(0);triggerEdge=false;}if(!trigger)triggerEdge=true;}
  if(vmDual){dualFix(w);for(const k of['mL','mR']){if(dRl[k]>0){dRl[k]-=dt;if(dRl[k]<=0){dRl[k]=0;const t=Math.min(DUAL_MAG-w[k],w.reserve);w[k]+=t;w.reserve-=t;w.mag=w.mL+w.mR;Sfx.rl('magIn');}}}
    if(w.mL===0&&w.reserve>0&&dRl.mL<=0&&switchT<=0&&!ads)startReload(['mL']);if(w.mR===0&&w.reserve>0&&dRl.mR<=0&&switchT<=0&&!trigger)startReload(['mR']);}
  else if(!d.infinite&&w.mag===0&&w.reserve>0&&reloadT<=0&&switchT<=0&&fireCD<=0&&!trigger)startReload();
  recoilP=Math.max(0,recoilP-dt*(recoilP*9+.02));
  updateArrows(dt);updateZap(dt);
}

/* =========================================================
   FLUSSO DI GIOCO
   ========================================================= */
function resetGame(){devFly=false;P.flyOff=false;{const fb=document.querySelector('#devBar [data-dev="devFly"]');if(fb)fb.classList.remove('on');}/* si riparte a piedi */

  zombies.forEach(z=>{z.active=false;z.g.visible=false;});alive=0;
  DOORS.forEach(d=>{d.open=false;d.anim=0;doorPose(d);});trapReset();if(M.id==='cascate')townReset();
  regionOpen=new Array(REG.length).fill(false);openRegion(RI.a);
  WINDOWS.forEach(w=>{w.boards=6;w.occupant=null;w.climbers=[];for(let k=0;k<6;k++)setBoard(w,k,true);});
  powerups.forEach(p=>scene.remove(p.s));powerups.length=0;zombies.forEach(z=>{z.knock=null;});projectiles.forEach(p=>scene.remove(p.mesh));projectiles.length=0;vortexes.forEach(v=>scene.remove(v.g));vortexes.length=0;lure=null;
  Power.on=false;Power.lamp.color.set(0xa8261c);Power.lever.rotation.x=Power.lvOff??-.5;PERKS.forEach(p=>{p.panel.material=p.offMat;p.bulbMat.color.set(0x222222);});
  Box.state='idle';Box.t=0;Object.values(Box.models).forEach(m=>m.visible=false);Box.doll.visible=false;Box.spot=Box.spot;placeBox(pick(M.boxStart));
  Q.keys=0;Q.valves=0;Q.feed=0;Q.lit=false;Q.valveHold=0;KEYOBJ.forEach(k=>{k.got=false;k.g.visible=true;});VALVES.forEach(v=>{v.done=false;v.wheel.rotation.z=0;});RECS.forEach(r=>r.heard=false);
  if(Q2){Q2.step=0;Q2.held=0;Q2.dropped=0;Q2.deposited=0;Q2.event=false;Q2.done=false;Q2.elixir.visible=false;Q2.lever.rotation.x=0;Q2.lamps.forEach(l=>{l.shot=false;l.mat.color.set(0x2a0808);});}
  arrows.forEach(a=>scene.remove(a.g));arrows.length=0;stuckMem=null;bowDraw=0;fondRound=0;$('fade').style.opacity=0;
  P.shield=null;shieldUp=false;shieldCD=0;P.toma=false;TOMA.on=false;if(TOMA.mesh)TOMA.mesh.visible=false;acids.forEach(a=>scene.remove(a.s));acids.length=0;egg4Reset();
  if(Q3){Object.assign(Q3,{step:0,ringT:0,held:0,placed:false,fed:0,liftOn:false,hasKey:false,lit:[],boss:null,heartHeld:false,done:false,ride:null,bossT:0,lidT:0,rewardT:0,bossHp:0});
    Q3.bells.forEach(b=>{b.rung=false;b.swing=0;});Q3.altar.spikes.forEach(s=>s.visible=false);Q3.altar.key.visible=false;Q3.braziers.forEach(b=>b.lit=false);Q3.heart.visible=false;Q3.reward.visible=false;Q3.rewardLight.intensity=0;
    Q3.lid.position.x=M.egg3.shrine.x;Q3.lid.rotation.z=0;Q3.skulls.forEach(s=>{s.st='wall';const [x,y,z,fx,fz]=M.egg3.skulls[Q3.skulls.indexOf(s)];s.x=x-fx*.1;s.y=y;s.z=z-fz*.1;s.g.position.set(s.x,s.y,s.z);s.g.rotation.set(0,yawFromFace([fx,fz]),0);s.g.visible=true;});
    const o=Q3.braziers.map((_,i)=>i);for(let i=o.length-1;i>0;i--){const j=(Math.random()*(i+1))|0;[o[i],o[j]]=[o[j],o[i]];}Q3.order=o;redrawSymbols(o);}
  Forge.unlocked=false;Forge.chains.visible=true;Forge.glowMat.color.set(0x2a1408);Forge.t=0;Forge.w=null;Forge.ready=false;forgeShow(null);if(M.id==='rocca')unlockForge(true);/* sulla Rocca la Forgia è sul ponte: la fatica è arrivarci */zapQ.length=0;zapCharges=3;dRl.mL=dRl.mR=0;seenMolo=false;Voice.stop();
  perks.clear();updatePerkIcons();P.maxHp=150;P.hp=150;P.downT=0;P.bleed=false;P.dead=false;Box.owner=null;canvas.style.filter='';P.hurtT=9;P.stamina=1;P.tired=false;reviveBuys=0;invulnT=0;
  START=M.start;P.x=START.x;P.z=START.z;P.yaw=START.yaw;P.pitch=0;P.vx=P.vz=0;P.vy=0;P.grounded=true;P.h=hAt(P.x,P.z,START.y);P.eyeH=P.h+1.62;zoneShown=-1;
  points=500;earned=0;kills=0;heads=0;doorsOpened=0;instaT=doubleT=0;hurtFlash=0;grenades=2;carillons=0;carUnlocked=false;webCD=0;zapCD=0;
  inv=[{id:'serpe',mag:8,reserve:80}];cur=0;reloadT=0;fireCD=0;switchT=0;knifeT=0;throwT=0;equipModel();
  round=0;toSpawn=0;betweenT=2.5;computeFlow();
}
function startGame(){Sfx.init();Sfx.ambMap(M.id);resetGame();gyroReset(700);state='playing';$('menu').hidden=true;$('over').hidden=true;$('pause').hidden=true;H.hud.hidden=false;requestLock();
  if(NET.on&&NET.host){NET.started=true;netEv({t:'start',w:netWorld()});netLobbyInfo();roomUI();}}
function pauseGame(){if(state!=='playing')return;state='paused';$('pauseMeta').textContent=`${M.name} · round ${round} · ${points} punti`;$('pauseNote').hidden=!NET.on;$('pause').hidden=false;trigger=false;ads=false;for(const k in keys)keys[k]=false;}
function resumeGame(){$('pause').hidden=true;Sfx.init();gyroReset(500);state='playing';requestLock();}
function toMenu(){if(NET.on)netLeave(true);state='menu';H.hud.hidden=true;Voice.stop();$('pause').hidden=true;$('over').hidden=true;$('menu').hidden=false;if(document.pointerLockElement)document.exitPointerLock();drawPlan();netUI();}
function gameOver(){state='dead';trigger=false;ads=false;Voice.stop();
  $('overTitle').textContent=NET.on?`La squadra è caduta al round ${round}`:`Sei caduto al round ${round}`;$('stKills').textContent=kills;$('stHeads').textContent=heads;$('stPoints').textContent=earned;$('stDoors').textContent=doorsOpened;
  $('again').hidden=NET.client;$('again').textContent=NET.host?'Nuova partita per tutti':'Riprova';$('overNote').hidden=!NET.client;
  $('over').hidden=false;if(document.pointerLockElement)document.exitPointerLock();}
function updateRound(dt){
  if(round===0||(toSpawn===0&&alive===0&&betweenT>0)){betweenT-=dt;if(betweenT<=0)startRound(round+1);return;}
  if(toSpawn>0&&alive<MAX_ALIVE){spawnT-=dt;if(spawnT<=0){if(spawnZombie())toSpawn--;spawnT=Math.max(.35,2-round*.1);}}
  if(toSpawn===0&&alive===1){const z=zombies.find(z=>z.active&&z.state!=='dying');if(z&&!z.enraged){z.enraged=true;if(!z.crawl&&!z.fond&&!z.boss&&z.type!=='sprint'){z.type='sprint';z.speed=rand(3.8,4.2);}Sfx.snarl(1.5);}}
  if((Q2&&Q2.event)||(Q3&&Q3.step===6)){if(toSpawn<3)toSpawn=3;}
  if(toSpawn===0&&alive===0){betweenT=9;roundEndLocal(round);netEv({t:'rend',r:round});}
}

/* =========================================================
   LA ROCCA (omaggio a Mob of the Dead): scudo, tomahawk infernale, spingarda acida, aereo, sedia elettrica, funivia
   - Scudo: tre pezzi (carrello, anta di cella, morsa) → banco di Broadway (tieni premuto USA) → ognuno ne prende uno.
     Sulla schiena para i colpi da dietro; alzato (tasto Scudo) para quelli davanti ma non si spara; il coltello diventa una spallata.
   - Tomahawk: tre teste del cane infernale (cortile, molo, tetto) si sfamano con le anime degli zombie uccisi vicino;
     sazie tutte e tre, nel cortile compare il tomahawk: prende il posto delle granate, colpisce fino a 6 zombie e torna in mano
     (raccoglie anche i power-up che tocca).
   - Spingarda acida: tre teschi → banco dell'infermeria (kit acido); poi con la Spingarda in mano la trasformi.
     Spara dardi che si attaccano e dopo un attimo scoppiano.
   - Aereo: cinque pezzi → sul tetto, tieni premuto USA; poi si vola sul ponte (dove c'è la Forgia). Dal ponte si torna con la sedia elettrica.
   - Funivia: tra il molo e il tetto, gratis (apre la zona di arrivo).
   Online i pezzi e le costruzioni sono di squadra (li decide l'host, netQuest q4); scudo, tomahawk e voli sono di ognuno.
   ========================================================= */
const SHIELD_HP=12;let shieldUp=false,shieldCD=0;const TOMA={on:false,mesh:null};const acids=[];
const P4N={s:'Scudo',p:'Aereo',k:'Teschi'},P4K={s:'sp',p:'pp',k:'sk'},P4MAX={s:3,p:5,k:3};
const cnt=a=>a.reduce((x,y)=>x+(y?1:0),0);
function egg4Reset(){if(!Q4)return;Object.assign(Q4,{sp:[0,0,0],sb:false,pp:[0,0,0,0,0],pb:false,sk:[0,0,0],kb:false,tomaOn:false,holdT:0,ride:null,gonCD:0});
  Q4.dogs.forEach(d=>{d.fed=0;d.done=false;});egg4Sync();}
// stato → oggetti nel mondo (serve anche quando arriva lo stato dall'host)
function egg4Sync(){if(!Q4)return;for(const k of['s','p','k'])Q4.objs[k].forEach((o,i)=>{o.g.visible=!Q4[P4K[k]][i];});
  Q4.benches.scudo&&(Q4.benches.scudo.item.visible=Q4.sb);Q4.benches.acido&&(Q4.benches.acido.item.visible=Q4.kb);
  Q4.plane.visible=Q4.pb;Q4.outline.visible=!Q4.pb;Q4.toma.visible=Q4.tomaOn&&!P.toma;}
function egg4PartName(k,i){const E=M.egg4;return k==='k'?'Un teschio':(k==='s'?E.shield:E.plane)[i].n.replace(/^./,c=>c.toUpperCase());}
// raccolta di un pezzo (host o da soli); online il giocatore lo fa sparire subito e lo chiede all'host
function egg4Part(k,i,by){const A=Q4[P4K[k]];if(!A||A[i])return;A[i]=1;egg4Sync();qSfx('pup');const n=cnt(A),N=P4MAX[k];
  const what=k==='s'?(n<N?'pezzi dello scudo':'lo scudo si costruisce al banco di Broadway'):k==='p'?(n<N?"pezzi dell'aereo":"l'aereo si monta sul tetto"):(n<N?'teschi':"il kit acido si fa al banco dell'infermeria");
  qMsg(`${egg4PartName(k,i)}<small>${n<N?`${n} di ${N} ${what}`:what}${byWho(by)}</small>`,2.8);}
function egg4PartReq(k,i){if(NET.client){Q4[P4K[k]][i]=1;egg4Sync();Sfx.pup();netReq({t:'q',a:'r_part',k,i});return;}egg4Part(k,i,NET.name);}
function egg4Build(w,by){if(w==='scudo'){if(Q4.sb||cnt(Q4.sp)<3)return;Q4.sb=true;}else if(w==='acido'){if(Q4.kb||cnt(Q4.sk)<3)return;Q4.kb=true;}else if(w==='aereo'){if(Q4.pb||cnt(Q4.pp)<5)return;Q4.pb=true;}else return;
  egg4Sync();qSfx('build');qSfx('power');qMsg(w==='scudo'?`Scudo costruito<small>al banco di Broadway ognuno può prenderne uno${byWho(by)}</small>`:w==='acido'?`Kit acido pronto<small>porta la Spingarda al banco dell'infermeria${byWho(by)}</small>`:`L'aereo è pronto<small>sul tetto: si vola fino al ponte${byWho(by)}</small>`,3.2);}
function egg4BuildReq(w){if(NET.client){netReq({t:'q',a:'r_build',w});if(w==='scudo')Q4.sb=true;else if(w==='acido')Q4.kb=true;else Q4.pb=true;egg4Sync();Sfx.build();return;}egg4Build(w,NET.name);}
// anime per le teste del cane: ogni zombie ucciso vicino a una testa ancora affamata la sfama (decide l'host)
function egg4OnKill(z){if(!Q4||z.boss)return;const E=M.egg4;let best=null,bd=E.dogR;
  for(const d of Q4.dogs){if(d.done)continue;const dd=Math.hypot(z.x-d.x,z.z-d.z);if(dd<bd&&Math.abs(z.h-d.h)<3.5){bd=dd;best=d;}}
  if(!best)return;best.fed++;qSfx('soul');soulFx(z.x,z.h+1.2,z.z,best.x,best.z,0);
  if(best.fed>=E.dogNeed){best.done=true;qSfx('ossa');const n=Q4.dogs.filter(d=>d.done).length;
    if(n<3)qMsg(`Una testa del cane infernale è sazia<small>${n} di 3</small>`,2.6);else{Q4.tomaOn=true;egg4Sync();qSfx('power');qMsg('Il cane infernale è sazio<small>nel cortile è comparso il tomahawk</small>',3.4);}}}
function egg4Ride(to,snd,msg){if(Q4.ride)return;Q4.ride={t:0,to,done:false,msg};if(snd&&Sfx[snd])Sfx[snd]();}
function egg4Arrive(to){const y=to.y;P.x=to.x;P.z=to.z;P.h=hAt(to.x,to.z,y);P.yaw=to.yaw||0;P.pitch=0;P.vx=P.vz=P.vy=0;P.grounded=true;P.eyeH=P.h+1.62;
  const r=regionAt(P.x,P.z,P.h);if(r>=0&&!regionOpen[r]){openRegion(r);if(NET.client)netReq({t:'q',a:'r_open',r});}computeFlow();lastPCell=-1;}
function egg4Cands(cand){const E=M.egg4;
  for(const k of['s','p','k'])Q4.objs[k].forEach((o,i)=>{if(!Q4[P4K[k]][i]&&near(o.x,o.z,o.h,1.6))cand(.1,{t:'r4',a:'part',k,i});});
  const sb=Q4.benches.scudo;if(sb&&near(sb.x,sb.z,sb.h,1.7))cand(.2,{t:'r4',a:Q4.sb?'shield':'build',w:'scudo',dur:2});
  const ab=Q4.benches.acido;if(ab&&near(ab.x,ab.z,ab.h,1.7))cand(.2,{t:'r4',a:Q4.kb?'acid':'build',w:'acido',dur:2});
  const S=E.planeSpot;if(near(S.x,S.z+2.4,Q4.planeH,3.2))cand(.3,{t:'r4',a:Q4.pb?'fly':'build',w:'aereo',dur:3});
  const C=Q4.chair;if(near(C.x,C.z,C.h,1.8))cand(.2,{t:'r4',a:'chair'});
  Q4.gon.forEach((g,i)=>{if(near(g.x,g.z,g.h,2.2))cand(.25,{t:'r4',a:'gondola',i});});
  if(Q4.tomaOn&&!P.toma&&near(Q4.tomaPos.x,Q4.tomaPos.z,Q4.tomaPos.h,1.8))cand(.05,{t:'r4',a:'toma'});}
function egg4Prompt(it,E){const w=inv[cur];switch(it.a){
  case 'part':return `${E} · Raccogli ${it.k==='k'?'il teschio':(it.k==='s'?M.egg4.shield:M.egg4.plane)[it.i].n}`;
  case 'build':{const k=it.w==='scudo'?'s':it.w==='acido'?'k':'p',n=cnt(Q4[P4K[k]]),N=P4MAX[k];
    if(n<N)return it.w==='scudo'?`Banco da lavoro: mancano pezzi dello scudo (${n}/${N})`:it.w==='acido'?`Banco dell'infermeria: servono tre teschi (${n}/${N})`:`Qui si monta l'aereo: mancano pezzi (${n}/${N})`;
    return `Tieni premuto ${E} per ${it.w==='scudo'?'costruire lo scudo':it.w==='acido'?'preparare il kit acido':"montare l'aereo"}${Q4.holdT>0?` · ${Math.min(100,Math.round(Q4.holdT/it.dur*100))}%`:''}`;}
  case 'shield':if(P.shield)return `Hai già lo scudo (${P.shield.hp}/${SHIELD_HP})`;if(shieldCD>0)return `Il prossimo scudo è pronto tra ${Math.ceil(shieldCD)} s`;return `${E} · Prendi lo scudo`;
  case 'acid':if(w&&w.id==='spingarda')return `${E} · Trasforma la ${wd(w).name} in Spingarda Acida`;if(w&&w.id==='acida')return 'La Spingarda Acida è già pronta';return 'Kit acido pronto: porta qui la Spingarda (dalla cassa)';
  case 'fly':return `${E} · Vola sul ponte con l'aereo`;
  case 'chair':return `${E} · Siediti sulla sedia elettrica: torni sul tetto della prigione`;
  case 'gondola':return Q4.gonCD>0?`La funivia riparte tra ${Math.ceil(Q4.gonCD)} s`:`${E} · Prendi la funivia (${it.i===0?'sale sul tetto':'scende al molo'})`;
  case 'toma':return `${E} · Prendi il tomahawk infernale`;}return '';}
function egg4Use(it){const E=M.egg4;switch(it.a){
  case 'part':egg4PartReq(it.k,it.i);break;
  case 'shield':if(P.shield||shieldCD>0)return;P.shield={hp:SHIELD_HP};shieldUp=false;Sfx.buy();showMsg(`Scudo<small>sulla schiena para i colpi da dietro · tasto ${TOUCH.on?'SCUDO':keyName(BIND.shield)} per alzarlo davanti</small>`,3.2);break;
  case 'acid':{const w=inv[cur];if(!w||w.id!=='spingarda')return;w.id='acida';const e=wd(w);w.mag=e.mag;w.reserve=e.reserve;equipModel();Sfx.build();Sfx.zap();showMsg(`${e.name}<small>dardi che si attaccano e scoppiano</small>`,2.8);break;}
  case 'fly':if(!Q4.pb)return;egg4Ride({x:E.bridgeIn.x,z:E.bridgeIn.z,y:10,yaw:E.bridgeIn.yaw},'plane',"Il ponte<small>la Forgia è in fondo, la sedia elettrica ti riporta indietro</small>");break;
  case 'chair':egg4Ride({x:E.roofIn.x,z:E.roofIn.z,y:7.6,yaw:E.roofIn.yaw},'chair','Sei tornato sul tetto');break;
  case 'gondola':{if(Q4.gonCD>0)return;const to=Q4.gon[1-it.i];Q4.gonCD=12;egg4Ride({x:to.x+(to.l?1.8:-2),z:to.z,y:to.h,yaw:to.yaw},'lift',it.i===0?'La funivia ti ha portato sul tetto':'La funivia ti ha portato al molo');break;}
  case 'toma':if(!Q4.tomaOn||P.toma)return;P.toma=true;egg4Sync();Sfx.power();Sfx.pup();showMsg(`Tomahawk infernale<small>prende il posto delle granate: tasto ${TOUCH.on?'granata':keyName(BIND.nade)} per lanciarlo, torna da solo</small>`,3.4);break;}}
// tenuto premuto per costruire (come le assi alle finestre)
function egg4Hold(it,dt){if(!it||it.t!=='r4'||it.a!=='build'||!kd('use')){Q4.holdT=0;return;}const k=it.w==='scudo'?'s':it.w==='acido'?'k':'p';if(cnt(Q4[P4K[k]])<P4MAX[k]){Q4.holdT=0;return;}
  Q4.holdT+=dt;if(Math.random()<dt*6)Sfx.repair();if(Q4.holdT>=it.dur){Q4.holdT=0;egg4BuildReq(it.w);}}
function updateEgg4(dt){if(!Q4)return;const now=performance.now();if(shieldCD>0)shieldCD-=dt;if(Q4.gonCD>0)Q4.gonCD-=dt;
  for(const k of['s','p','k'])Q4.objs[k].forEach((o,i)=>{if(!o.g.visible)return;o.g.rotation.y+=dt*1.2;o.g.position.y=o.h+o.dy+Math.sin(now/420+i)*.05;});
  Q4.dogs.forEach((d,i)=>{const f=d.done?1:d.fed/M.egg4.dogNeed;d.eyeM.color.setRGB(.15+.85*f,.05+.25*f,.02);d.fire.scale.setScalar(d.done?.5+Math.sin(now/90+i)*.08:.01);d.hd.rotation.y=Math.sin(now/1500+i)*.15;});
  if(Q4.toma.visible){Q4.toma.rotation.y+=dt*1.6;Q4.toma.position.y=Q4.tomaPos.h+1.3+Math.sin(now/300)*.06;}
  if(Q4.plane.visible)Q4.plane.userData.prop.rotation.z+=dt*(Q4.ride&&Q4.ride.msg&&Q4.ride.msg.startsWith('Il ponte')?40:1.5);
  if(Q4.ride){const R=Q4.ride;R.t+=dt;const f=R.t<.8?R.t/.8:R.t<1.4?1:Math.max(0,1-(R.t-1.4)/.6);$('fade').style.opacity=f.toFixed(2);shakeT=Math.max(shakeT,.08);
    if(!R.done&&R.t>=.85){R.done=true;egg4Arrive(R.to);}if(R.t>2.1){Q4.ride=null;$('fade').style.opacity=0;if(R.msg)showMsg(R.msg,3);}}
  updateToma(dt);updateAcids(dt);}
/* ---------- tomahawk infernale ---------- */
function throwToma(){if(TOMA.on||!P.toma||P.dead||throwT>0)return;camera.updateMatrixWorld();camera.getWorldPosition(vO);vD.set(0,0,-1).applyQuaternion(aimQuat());
  Object.assign(TOMA,{on:true,phase:'out',d:0,t:0,n:0,hit:new Set(),x:vO.x+vD.x*.6,y:vO.y+vD.y*.6-.1,z:vO.z+vD.z*.6,dx:vD.x,dy:vD.y,dz:vD.z});
  if(!TOMA.mesh){TOMA.mesh=tomaModel();scene.add(TOMA.mesh);}TOMA.mesh.visible=true;throwT=.35;Sfx.toma();}
function updateToma(dt){if(!TOMA.on)return;TOMA.t+=dt;let step=(TOMA.phase==='out'?24:28)*dt;
  if(TOMA.phase==='out'){vO.set(TOMA.x,TOMA.y,TOMA.z);vD.set(TOMA.dx,TOMA.dy,TOMA.dz);const free=shotDist(vO,vD,step+.25);if(free<step+.25){step=Math.max(0,free-.25);TOMA.phase='back';Sfx.hit();}
    TOMA.x+=TOMA.dx*step;TOMA.y+=TOMA.dy*step;TOMA.z+=TOMA.dz*step;TOMA.d+=step;if(TOMA.d>18||TOMA.t>1.2)TOMA.phase='back';}
  else{const tx=P.x,ty=P.eyeH-.35,tz=P.z,dx=tx-TOMA.x,dy=ty-TOMA.y,dz=tz-TOMA.z,d=Math.hypot(dx,dy,dz);
    if(d<.9||TOMA.t>6||P.dead){TOMA.on=false;TOMA.mesh.visible=false;Sfx.pin();return;}const s=Math.min(d,step);TOMA.x+=dx/d*s;TOMA.y+=dy/d*s;TOMA.z+=dz/d*s;TOMA.dx=dx/d;TOMA.dz=dz/d;}
  for(const z of zombies){if(!z.active||z.state==='dying'||TOMA.hit.has(z)||TOMA.n>=6)continue;const sc=z.g.scale.x;
    if(Math.hypot(z.x-TOMA.x,z.z-TOMA.z)<.8*sc&&TOMA.y>z.h+.15&&TOMA.y<z.h+2.05*sc){TOMA.hit.add(z);TOMA.n++;const head=TOMA.y>z.h+1.45*sc;
      damageZombie(z,(2000+round*150)*((z.fond||z.boss)?.15:1)*(head?1.5:1),head?'head':'body','toma',{fx:TOMA.x,fz:TOMA.z});emit({x:TOMA.x,y:TOMA.y,z:TOMA.z},10,.5,.04,.03,2,.8);Sfx.hit();hitMarker(head);}}
  for(const p of powerups){if(p.k==='core'||p.t<=0)continue;if(Math.hypot(p.x-TOMA.x,p.z-TOMA.z)<1.4&&Math.abs(p.h+1-TOMA.y)<1.6){
    if(NET.client){if(!p.req){p.req=1;netReq({t:'putake',id:p.id});}}else{applyPowerup(p.k);p.t=0;netEv({t:'pu',id:p.id,k:p.k,by:NET.name});}}}/* come in MotD: il tomahawk raccoglie i power-up */
  TOMA.mesh.position.set(TOMA.x,TOMA.y,TOMA.z);TOMA.mesh.rotation.set(-TOMA.t*20,Math.atan2(TOMA.dx,TOMA.dz),0,'YXZ');
  if(Math.random()<dt*35)emit({x:TOMA.x,y:TOMA.y,z:TOMA.z},1,1,.3,.1,.4,0,0,[.15,.3]);}
/* ---------- dardi della spingarda acida ---------- */
const acidSprMat=new THREE.SpriteMaterial({map:glowTex,color:0x7dff5a,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending});
function addAcid(pt,zb,pap){const s=new THREE.Sprite(acidSprMat);s.scale.setScalar(.35);s.position.copy(pt);scene.add(s);
  acids.push({x:pt.x,y:pt.y,z:pt.z,zb,ox:zb?pt.x-zb.x:0,oy:zb?pt.y-zb.h:0,oz:zb?pt.z-zb.z:0,t:1.1,pap,s});}
function updateAcids(dt){for(let i=acids.length-1;i>=0;i--){const a=acids[i];if(a.zb&&a.zb.active&&a.zb.state!=='dying'){a.x=a.zb.x+a.ox;a.y=a.zb.h+a.oy;a.z=a.zb.z+a.oz;}
  a.t-=dt;a.s.position.set(a.x,a.y,a.z);a.s.scale.setScalar(.3+Math.sin(a.t*30)*.06);if(Math.random()<dt*20)emit({x:a.x,y:a.y,z:a.z},1,.4,1,.3,.6,.4,2,[.2,.4]);
  if(a.t<=0){scene.remove(a.s);acids.splice(i,1);explode(a.x,a.y,a.z,a.pap?4.2:3.2,(850+round*85)*(a.pap?2:1),'acid',{col:0x7dff5a,noSelf:true,sc:.6});Sfx.acidPop(Math.hypot(P.x-a.x,P.z-a.z));}}}
/* ---------- scudo ---------- */
function toggleShield(){if(!P.shield||P.dead||P.downT>0)return;shieldUp=!shieldUp;Sfx.rl(shieldUp?'lidClose':'lidOpen');if(shieldUp){ads=false;reloadT=0;}}
function shieldBlock(){P.shield.hp--;Sfx.shieldHit();shakeT=Math.max(shakeT,.12);hurtFlash=Math.max(hurtFlash,.15);padRumble(.4,.2,120);
  if(P.shield.hp<=0){P.shield=null;shieldUp=false;shieldCD=25;Sfx.shieldBreak();showMsg('Lo scudo si è rotto<small>al banco di Broadway ne prendi un altro tra 25 s</small>',3);}}
function shieldBash(){/* coltello con lo scudo alzato: spallata che fa male e respinge */
  const fx=-Math.sin(P.yaw),fz=-Math.cos(P.yaw);let n=0;for(const z of zombies){if(!z.active||z.state!=='chase'||n>=3)continue;const dx=z.x-P.x,dz=z.z-P.z,d=Math.hypot(dx,dz);
    if(d<2.2&&(dx*fx+dz*fz)/Math.max(d,.01)>.35&&Math.abs(z.h-P.h)<1.3){n++;damageZombie(z,(400+round*40)*((z.fond||z.boss)?.15:1),'body','knife',{fx:P.x,fz:P.z});
      if(z.active&&z.state!=='dying'&&!z.boss){const l=d||1;z.knock={t:0,vx:dx/l*4,vz:dz/l*4,vy:2,y:0};z.attackT=0;}}}
  Sfx.shieldHit();if(n)hitMarker(false);}
function egg4MapTags(tag,onL,dyn,th){const E=M.egg4,lt=(x,z,l)=>onL(l);
  (M.benches||[]).forEach(b=>{const B=Q4.benches[b.id];if(B&&onL(b.l||0))tag(B.x,B.z,b.id==='scudo'?'Banco scudo':'Banco acido',th.forge,-1.3);});
  if(onL(E.planeSpot.l))tag(E.planeSpot.x,E.planeSpot.z,Q4.pb?'Aereo':'Aereo (da montare)',th.box,1.6);
  Q4.gon.forEach(g=>{if(onL(g.l))tag(g.x,g.z,'Funivia',th.power,1.4);});if(onL(E.chair.l))tag(E.chair.x,E.chair.z,'Sedia elettrica',th.power,-1.3);
  E.dogs.forEach((d,i)=>{if(onL(d.l))tag(d.x,d.z,`Testa del cane${dyn?` ${Q4.dogs[i].done?'✓':Q4.dogs[i].fed+'/'+E.dogNeed}`:''}`,'#c42a1f',1.4);});}
function devEgg4(){const E=M.egg4;if(!Power.on)useInteract({t:'power'});
  if(cnt(Q4.sp)<3){Q4.sp=[1,1,1];egg4Sync();showMsg('Pezzi dello scudo 3/3',1.4);}else if(!Q4.sb)egg4Build('scudo',NET.name);
  else if(!P.shield)egg4Use({a:'shield'});else if(!Q4.tomaOn){Q4.dogs.forEach(d=>{d.fed=E.dogNeed;d.done=true;});Q4.tomaOn=true;egg4Sync();showMsg('Teste del cane sazie',1.4);}
  else if(!P.toma)egg4Use({a:'toma'});else if(cnt(Q4.sk)<3){Q4.sk=[1,1,1];egg4Sync();}else if(!Q4.kb)egg4Build('acido',NET.name);
  else if(!inv.some(w=>w.id==='spingarda'||w.id==='acida'))giveWeapon('spingarda');else if(cnt(Q4.pp)<5){Q4.pp=[1,1,1,1,1];egg4Sync();}else if(!Q4.pb)egg4Build('aereo',NET.name);
  else egg4Use({a:'fly'});}

/* =========================================================
   TRAPPOLE SULLE PORTE (come in COD)
   Una leva sul muro accanto ad alcune porte (fino a 3 per mappa, lontane tra loro). Con la corrente e la porta aperta,
   1000 punti: per 25 s il vano della porta uccide gli zombie che ci passano (niente punti, come in COD; i boss perdono vita)
   e fa male anche a te (50 ogni 0,8 s, e ti rallenta). Poi 45 s di ricarica. La spia della leva: verde pronta, rossa in uso
   o in ricarica, spenta senza corrente o con la porta chiusa.
   Stile per mappa: scarica elettrica (prigione), getti di fuoco (acciaieria), acido (Rocca).
   Online: la attiva chiunque (richiesta all'host); gli zombie li uccide l'host, il danno lo calcola ogni giocatore per sé.
   ========================================================= */
const TRAP_COST=1000,TRAP_ON=25,TRAP_CD=45;
const TRAP_STYLE={cascate:{k:'fire',name:'di fuoco',col:0xff7a2a},prigione:{k:'elec',name:'elettrica',col:0x9fd8ff},acciaieria:{k:'fire',name:'di fuoco',col:0xff7a2a},rocca:{k:'acid',name:"d'acido",col:0x86ff5a}};
let TRAPS=[],trapLight=null,trapHurtCD=0;
const trapSt=()=>TRAP_STYLE[M.id]||TRAP_STYLE.prigione;
// coordinate della porta: lx lungo la larghezza, lz nel verso del passaggio (come i battenti in buildDoors)
function trapW(d,lx,lz){return d.alongX?[d.cx+lz,d.cz-lx]:[d.cx+lx,d.cz+lz];}
function trapL(d,x,z){const dx=x-d.cx,dz=z-d.cz;return d.alongX?[-dz,dx]:[dx,dz];}
function trapInside(T,x,z,h){const [lx,lz]=trapL(T.d,x,z);return Math.abs(lx)<T.d.w/2+.1&&Math.abs(lz)<.9&&Math.abs(h-T.d.h)<1.5;}
function buildTraps(){TRAPS=[];const st=trapSt();
  if(!trapLight){trapLight=new THREE.PointLight(st.col,0,10,1.6);scene.add(trapLight);}trapLight.color.set(st.col);trapLight.intensity=0;
  const cellOf=(x,z,h)=>inb(Math.floor(x),Math.floor(z))?cellAt(Math.floor(x),Math.floor(z),h):-1,cands=[];
  DOORS.forEach(d=>{const reg=s=>{const [x,z]=trapW(d,0,s*1.1),i=cellOf(x,z,d.h+.5);return i>=0?region[i]:99;};
    const sides=reg(-1)<=reg(1)?[-1,1]:[1,-1];/* la leva dal lato da cui si arriva (zona con la lettera più bassa) */
    for(const s of sides){let ok=null;for(const sx of [1,-1]){const [wx,wz]=trapW(d,sx*(d.w/2+.5),0),wi=cellOf(wx,wz,d.h+.5);if(wi<0||kind[wi]!==K.WALL)continue;
        const [fx,fz]=trapW(d,sx*(d.w/2+.5),s*1.1),fi=cellOf(fx,fz,d.h+.5);if(fi<0||kind[fi]!==K.FLOOR||Math.abs(cellH[fi]-d.h)>.3)continue;ok=sx;break;}
      if(ok!=null){cands.push({d,s,sx:ok});break;}}});
  cands.sort((a,b)=>(b.d.cost-a.d.cost)||((a.d.kind==='gate')-(b.d.kind==='gate')));
  for(const c of cands){if(TRAPS.length>=3)break;if(TRAPS.some(T=>Math.hypot(T.d.cx-c.d.cx,T.d.cz-c.d.cz)<16))continue;
    const d=c.d,W=d.w,h=d.h,[sx,sz]=trapW(d,c.sx*(W/2+.5),c.s*.5),n=trapW(d,0,c.s),yaw=Math.atan2(n[0]-d.cx,n[1]-d.cz);
    // leva sul muro: piastra, scatola gialla e nera, maniglia, spia e cartello col prezzo
    const g=new THREE.Group();g.position.set(sx,h+1.3,sz);g.rotation.y=yaw;world.add(g);const G=new Geo(),Y=new Geo();
    G.box(0,0,.02,.3,.46,.04);Y.box(0,.02,.08,.22,.3,.1);G.box(0,.02,.135,.16,.22,.01);G.box(.13,0,.11,.04,.12,.06);G.cyl(.17,.07,.11,.022,.2,'y',6);G.box(.17,.18,.11,.07,.05,.05);
    g.add(G.mesh(MAT.metalDark));g.add(Y.mesh(MAT.yellow));
    const lamp=new THREE.Mesh(new THREE.SphereGeometry(.035,8,6),new THREE.MeshBasicMaterial({color:0x221a1a}));lamp.position.set(-.07,.2,.12);g.add(lamp);
    const sign=textTex(128,48,(cc,w,hh)=>{cc.fillStyle='#d9b23a';cc.fillRect(0,0,w,hh);cc.fillStyle='#1a1612';for(let k=-2;k<9;k++){cc.beginPath();cc.moveTo(k*16,0);cc.lineTo(k*16+8,0);cc.lineTo(k*16-4,hh);cc.lineTo(k*16-12,hh);cc.fill();}
      cc.fillStyle='rgba(20,18,14,.92)';cc.fillRect(8,8,w-16,hh-16);cc.fillStyle='#f0e6c8';cc.font='bold 22px "Barlow Condensed", sans-serif';cc.textAlign='center';cc.textBaseline='middle';cc.fillText('TRAPPOLA '+TRAP_COST,w/2,hh/2+1);});
    const sp=new THREE.Mesh(new THREE.PlaneGeometry(.42,.16),new THREE.MeshBasicMaterial({map:sign}));sp.position.set(0,-.36,.012);g.add(sp);
    // apparati ai lati del vano: isolatori e bobine (elettrica), ugelli a terra (fuoco), tubi con spruzzatori in alto (acido)
    const A=new Geo(),B=new Geo(),pt=(lx,y,lz)=>{const [x,z]=trapW(d,lx,lz);return [x,h+y,z];};
    for(const j of [-1,1]){const lx=j*(W/2-.09);
      if(st.k==='elec')for(const y of [.45,1.25,2.05]){const p=pt(lx,y,0);A.cyl(p[0],p[1],p[2],.07,.22,'y',8,true);B.cyl(p[0],p[1]+.14,p[2],.045,.06,'y',8,true);}
      else if(st.k==='fire')for(const lz of [-.3,.3]){const p=pt(lx,.08,lz);B.cyl(p[0],p[1],p[2],.07,.16,'y',8,true);const q=pt(lx-j*.06,.12,lz);A.box(q[0],q[1],q[2],.12,.08,.12);}
      else{const p=pt(lx,2.3,0);B.cyl(p[0],p[1],p[2],.05,.5,d.alongX?'x':'z',8,true);for(const lz of [-.2,.2]){const q=pt(lx-j*.05,2.22,lz);A.cyl(q[0],q[1],q[2],.035,.1,'y',6,true);}}}
    world.add(A.mesh(st.k==='elec'?MAT.white:MAT.metal));world.add(B.mesh(st.k==='elec'?MAT.rust:MAT.metalDark));
    // archi elettrici (linee spezzate rifatte di continuo)
    const arcs=[];if(st.k==='elec'){const mat=new THREE.LineBasicMaterial({color:0xcff0ff,transparent:true,opacity:.95,blending:THREE.AdditiveBlending,depthWrite:false,fog:false});
      for(let k=0;k<6;k++){const gm=new THREE.BufferGeometry();gm.setAttribute('position',new THREE.BufferAttribute(new Float32Array(14*3),3));const L=new THREE.Line(gm,mat);L.frustumCulled=false;L.visible=false;world.add(L);arcs.push(L);}}
    // fiamme / nuvola / bagliori: sprite luminosi che tremolano nel vano (si vedono solo mentre la trappola va)
    const glows=[];for(let k=0;k<(st.k==='elec'?6:Math.ceil(W*3));k++){const sm=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex,color:st.k==='fire'?(k%3?0xff6a1a:0xffc040):st.k==='acid'?0x7dff4a:0x9fd8ff,transparent:true,opacity:.8,depthWrite:false,blending:THREE.AdditiveBlending}));
      const lx=st.k==='elec'?(k%2?1:-1)*(W/2-.09):-W/2+(k+.5)*W/Math.ceil(W*3),ly=st.k==='elec'?[.45,1.25,2.05][k>>1]:st.k==='fire'?.5:1.2,[x,z]=trapW(d,lx,0);sm.position.set(x,h+ly,z);sm.userData={lx,ly,ph:Math.random()*6};sm.visible=false;world.add(sm);glows.push(sm);}
    TRAPS.push({d,sx,sz,h,g,lamp,arcs,glows,t:0,cd:0,owner:null,fxT:0,sndT:0});}}
function trapReset(){TRAPS.forEach(T=>{T.t=0;T.cd=0;T.owner=null;T.arcs.forEach(L=>L.visible=false);T.glows.forEach(s=>s.visible=false);});if(trapLight)trapLight.intensity=0;}
function trapActivate(T,by){T.t=TRAP_ON;T.cd=TRAP_ON+TRAP_CD;T.owner=by||null;Sfx.power();Sfx.door();if(NET.on&&NET.host)netEv({t:'trap',i:TRAPS.indexOf(T)});}
function trapUse(T){if(T.cd>0||!T.d.open||!Power.on)return;if(!spend(TRAP_COST))return;
  if(NET.client){netReq({t:'trap',i:TRAPS.indexOf(T)});T.t=TRAP_ON;T.cd=TRAP_ON+TRAP_CD;Sfx.power();}else trapActivate(T,null);showMsg('Trappola '+trapSt().name+' attivata',1.6);}
function trapPrompt(T,E,cost){const nm='Trappola '+trapSt().name;if(!Power.on)return nm+': serve la corrente';if(!T.d.open)return nm+': prima apri la porta';
  if(T.t>0)return nm+' in funzione';if(T.cd>0)return nm+`: si ricarica (${Math.ceil(T.cd)} s)`;return `${E} · Attiva la ${nm.toLowerCase()} · ${cost(TRAP_COST)}`;}
function updateTraps(dt){if(!TRAPS.length)return;const st=trapSt(),now=performance.now();let best=null,bd=1e9;if(trapHurtCD>0)trapHurtCD-=dt;
  for(const T of TRAPS){if(T.cd>0)T.cd=Math.max(0,T.cd-dt);const on=T.t>0;if(on)T.t=Math.max(0,T.t-dt);
    T.lamp.material.color.setHex(!Power.on||!T.d.open?0x221a1a:on?((now/180|0)%2?0xff2a1a:0x601008):T.cd>0?0xb0200f:0x4dff5a);
    if(!on){if(T.glows[0]&&T.glows[0].visible){T.arcs.forEach(L=>L.visible=false);T.glows.forEach(s=>s.visible=false);}continue;}
    T.glows.forEach(sp=>{const u=sp.userData,f=Math.sin(now/70+u.ph)*.5+.5;sp.visible=true;
      if(st.k==='fire'){const k=(now/420+u.ph)%1;sp.position.y=T.h+.25+k*2.1;sp.scale.setScalar((1.5-k*.9)*(.8+f*.4));sp.material.opacity=(1-k)*.9;}
      else if(st.k==='acid'){const k=(now/900+u.ph)%1;sp.position.y=T.h+2.2-k*2;sp.scale.setScalar(.9+k*1.1);sp.material.opacity=.55*(1-k*.6);}
      else{sp.scale.setScalar(.35+f*.5);sp.material.opacity=.5+f*.5;}});
    const d=T.d,W=d.w,h=d.h,dist=Math.hypot(P.x-d.cx,P.z-d.cz);if(dist<bd){bd=dist;best=T;}
    // effetti
    T.fxT-=dt;if(T.fxT<=0){T.fxT=st.k==='elec'?.05:.04;
      if(st.k==='elec'){T.arcs.forEach((L,k)=>{const show=Math.random()<.8;L.visible=show;if(!show)return;const a=L.geometry.attributes.position,y0=.35+Math.random()*1.85,y1=.35+Math.random()*1.85;
          for(let q=0;q<14;q++){const u=q/13,lx=-W/2+.1+u*(W-.2),y=y0+(y1-y0)*u+(q&&q<13?(Math.random()-.5)*.3:0),lz=q&&q<13?(Math.random()-.5)*.22:0,[x,z]=trapW(d,lx,lz);a.setXYZ(q,x,h+y,z);}a.needsUpdate=true;});
        const [x,z]=trapW(d,(Math.random()<.5?-1:1)*(W/2-.1),0);emit({x,y:h+.4+Math.random()*1.8,z},3,.75,.9,1,1.6,.6,9.8,[.12,.3]);}
      else if(st.k==='fire'){for(let k=0;k<Math.ceil(W*2);k++){const [x,z]=trapW(d,(Math.random()-.5)*W,(Math.random()-.5)*.8);emit({x,y:h+.15,z},1,1,.45+Math.random()*.3,.1,.35,3.2+Math.random()*1.5,-1.5,[.25,.55]);}
        if(Math.random()<.5){const [x,z]=trapW(d,(Math.random()-.5)*W,0);emit({x,y:h+1.6,z},1,.25,.22,.2,.3,1.2,-.5,[.6,1.1]);}}
      else{for(let k=0;k<Math.ceil(W*1.5);k++){const [x,z]=trapW(d,(Math.random()-.5)*W,(Math.random()-.5)*.6);emit({x,y:h+2.2,z},1,.45,1,.3,.25,-1.5,6,[.35,.6]);}
        const [x,z]=trapW(d,(Math.random()-.5)*W,(Math.random()-.5)*.8);emit({x,y:h+.2,z},2,.4,.9,.25,.4,.7,-.4,[.6,1.2]);}}
    // suono (più forte da vicino)
    T.sndT-=dt;if(T.sndT<=0&&dist<24){const v=Math.max(0,1-dist/24)*.32,pan=clamp(((d.cx-P.x)*Math.cos(P.yaw)-(d.cz-P.z)*Math.sin(P.yaw))/10,-1,1);
      if(st.k==='elec'){T.sndT=.06+Math.random()*.08;Sfx.noise({dur:.05+Math.random()*.06,type:'highpass',f:2200+Math.random()*2500,v:v*(.5+Math.random()*.6),pan});}
      else if(st.k==='fire'){T.sndT=.18;Sfx.noise({dur:.32,type:'lowpass',f:420+Math.random()*300,v:v*1.1,pan});}
      else{T.sndT=.16;Sfx.noise({dur:.28,type:'bandpass',f:2400+Math.random()*1200,q:.7,v:v*.55,pan});}}
    // gli zombie nel vano muoiono (sull'host); i boss perdono vita
    if(!NET.client){NET.credit=T.owner;for(const z of zombies){if(!z.active||z.state==='dying'||!trapInside(T,z.x,z.z,z.h))continue;
        if(z.boss||z.fond){damageZombie(z,(z.boss?260:1400)*dt,'body','trap',{});z.twitch=.3;}else{if(st.k==='elec')emit({x:z.x,y:z.h+1.2,z:z.z},14,.7,.9,1,2.4,1,9.8,[.15,.4]);killZombie(z,false,'trap');}}NET.credit=null;}
    // e fa male anche a te
    if(trapHurtCD<=0&&!P.dead&&!(P.downT>0)&&trapInside(T,P.x,P.z,P.h)){trapHurtCD=.8;hurtPlayer(50,d.cx,d.cz,true);grabT=.45;}}
  if(trapLight){if(best){const [x,z]=trapW(best.d,0,0);trapLight.position.set(x,best.d.h+1.4,z);trapLight.intensity=(st.k==='elec'?2.2:2.6)*(.55+Math.random()*.6);}else trapLight.intensity=0;}}
