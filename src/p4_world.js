
/* =========================================================
   STATO DELLA MAPPA CORRENTE
   Una mappa può avere più strati (M.layers): griglie 100×80 sovrapposte, così un piano può stare sopra un altro
   (ballatoi sopra le celle, infermeria sopra la mensa, tetto sopra l'infermeria, gallerie sotto il cortile).
   Indice di cella: l*N2 + z*GW + x. In ogni colonna vale lo strato più alto che lì ha qualcosa e il cui pavimento
   non ti sta troppo sopra (layerAt): salendo una scala si passa da soli allo strato di sopra.
   Le mappe con un solo strato (M.ascii) funzionano come prima.
   ========================================================= */
const K={VOID:0,FLOOR:1,WALL:2,DOOR:3,WIN:4,PROP:5,BARS:6,WATER:7};
const PROP_H={'1':.8,'2':.7,'3':1.6,'4':3.6,'5':1.0,'6':.75,'7':1.0,'8':.45,'9':2.2,'0':2.0,'*':2.1};
const LOW_PROP=1.25; // su arredi più bassi di così si può salire con un salto
const SLAB=.3; // spessore dei solai tra uno strato e quello di sopra
const RKEYS='abcdefghijklmnopqrstuv',RKEYS_UP=RKEYS.toUpperCase();// lettere delle zone (maiuscole = scale/rampe); la W resta la finestra
let M=null,world=null,GW=100,GH=80,NL=1,N2=GW*GH,N=N2,kind,region,rampOf,propCh,cellH,cellB,upB,doorOf,wallTop,LBASE=[0];
let REG=[],REGL=[],RI={},RAMPS=[],DOORS=[],WINDOWS=[],RISERS=[],PERKS=[],WALLBUYS=[],BOX_SPOTS=[],RECS=[],VALVES=[],KEYOBJ=[];
let roomLights=[],search=null,beam=null,crane=null,boardIM=null,boardMats=[],flow,bfsQ;
let Box={},Power={},Forge={},Furn=null,cellTag=null,COLCELL=new Map();
const ix=(x,z,l=0)=>l*N2+z*GW+x, inb=(x,z)=>x>=0&&z>=0&&x<GW&&z<GH;
/*MESHY_OGGETTI*/
/* oggetti Meshy della mappa (modelli/meshy/*.glb, tools/meshy_assets.py oggetti): bibite, cassa e bancali, corrente, Forgia, porte blindate,
   cancelli, finestre e assi, ringhiere, banco dello scudo, scale della Rocca. Misure già in metri, davanti verso +z, base a y=0.
   Sono i modelli «image to 3D» alleggeriti da tools/semplifica.mjs. Opzione «Oggetti» (scn-ogg): Meshy o classici (quelli fatti a blocchi) */
const MOGG=typeof MESHY_OGG!=='undefined'&&MESHY_OGG?MESHY_OGG:{};
let OGG_ON=true;try{if(localStorage.getItem('scn-ogg')==='classici')OGG_ON=false;}catch(_){}
function ogg(name){const d=OGG_ON&&MOGG[name];if(!d)return null;
  if(!d.geo){d.geo={};for(const [pn,q] of Object.entries(d.parts)){const g=new THREE.BufferGeometry();
      g.setAttribute('position',new THREE.BufferAttribute(b64f(q.p,Int16Array,d.sc/32767),3));g.setAttribute('normal',new THREE.BufferAttribute(b64f(q.n,Int8Array,1/127),3));
      g.setAttribute('uv',new THREE.BufferAttribute(b64f(q.uv,Uint16Array,1/65535),2));g.setIndex(new THREE.BufferAttribute(q.i32?new Uint32Array(b64u8(q.i).buffer):new Uint16Array(b64u8(q.i).buffer),1));g.computeBoundingSphere();d.geo[pn]=g;}
    const t=new THREE.TextureLoader().load(d.tex);t.minFilter=THREE.LinearMipmapLinearFilter;t.anisotropy=4;d.mat=LM({map:t});}
  return d;}
function oggMesh(name,part,mat){const d=ogg(name);if(!d)return null;const m=new THREE.Mesh(d.geo[part||'main'],mat||d.mat);return m;}
const OGG_PERK={tempra:'bibita_tempra',manolesta:'bibita_manolesta',doppio:'bibita_doppio',occhio:'bibita_occhio'};
const OGG_BARS=!!(MOGG.sbarre_cella&&MOGG.sbarre_modulo)&&OGG_ON;
/* sbarre Meshy: le celle «|» in fila diventano fronti di cella da 2 m (con la porta scorrevole) e moduli da 1 m; nelle file lunghe (5+) solo moduli.
   Sul primo piano e più su le fronti alte. Alte quanto il vano (fino all'architrave), sottili al centro della cella. */
function buildBarsMeshy(){const done=new Uint8Array(N);
  for(let i=0;i<N;i++){if(kind[i]!==K.BARS||done[i])continue;const x=cX(i),z=cZ(i),l=cL(i);if(blockTier(x,z,l))continue;
    const sideK=(a,b)=>inb(a,b)&&[K.BARS,K.WALL,K.DOOR].includes(kind[ix(a,b,l)]);const ax=sideK(x-1,z)||sideK(x+1,z),h=cellH[i];
    const same=(a,b)=>inb(a,b)&&kind[ix(a,b,l)]===K.BARS&&!done[ix(a,b,l)]&&Math.abs(cellH[ix(a,b,l)]-h)<.05;
    let a0=ax?x:z;while(ax?same(a0-1,z):same(x,a0-1))a0--;let n=0;while(ax?same(a0+n,z):same(x,a0+n))n++;
    const cells=[];for(let k=0;k<n;k++){const c=ax?ix(a0+k,z,l):ix(x,a0+k,l);done[c]=1;cells.push(c);}
    const top=Math.min(h+2.9,ceilAt(i)),hh=top-h,long=n>=5;let k=0;
    while(k<n){const two=!long&&n-k>=2,nm=two?(l>0&&MOGG.sbarre_cella_alta?'sbarre_cella_alta':'sbarre_cella'):'sbarre_modulo',d=ogg(nm),w=two?2:1;
      const m=oggMesh(nm),c=a0+k+w/2;m.scale.set(1,hh/(d.box[4]-d.box[1]),1);m.position.set(ax?c:x+.5,h,ax?z+.5:c);if(!ax)m.rotation.y=Math.PI/2;world.add(m);k+=w;}}}
const cX=i=>i%GW,cZ=i=>((i/GW)|0)%GH,cL=i=>(i/N2)|0;
const D4=[[1,0],[-1,0],[0,1],[0,-1]];
// strato in cui sta chi è nella colonna x,z (interi) all'altezza y; senza y: lo strato più alto che lì ha qualcosa
function layerAt(x,z,y){if(NL===1)return 0;const c=z*GW+x;
  if(y===undefined){for(let l=NL-1;l>0;l--)if(kind[l*N2+c]!==K.VOID)return l;return 0;}
  for(let l=NL-1;l>0;l--){const i=l*N2+c;if(kind[i]!==K.VOID&&y>=cellB[i]-.75)return l;}return 0;}
function cellAt(x,z,y){return ix(x,z,layerAt(x,z,y));}
// cella vicina (dx,dz) di c, nello strato giusto per l'altezza del pavimento di c (serve a flusso, collisioni e percorsi)
function nbCell(c,dx,dz){const x=cX(c)+dx,z=cZ(c)+dz;if(!inb(x,z))return -1;if(NL===1)return z*GW+x;return ix(x,z,layerAt(x,z,cellH[c]));}
function rampH(r,x,z){const t=r.axis==='x'?(x-r.x0)/(r.x1+1-r.x0):(z-r.z0)/(r.z1+1-r.z0);return lerp(r.h0,r.h1,clamp(t,0,1));}
hAt=function(x,z,y){const cx=Math.floor(x),cz=Math.floor(z);if(!inb(cx,cz))return M&&M.outside==='ground'?0:M?M.liquidH:-2.6;const i=cellAt(cx,cz,y);return rampOf[i]>=0?rampH(RAMPS[rampOf[i]],x,z):cellH[i];};
function walkable(i){const k=kind[i];return k===K.FLOOR||(k===K.DOOR&&DOORS[doorOf[i]].open);}
function ceilAt(i){const k=kind[i];let c;if(k===K.DOOR)c=cellH[i]+2.5;else if(k===K.WIN)c=cellH[i]+2.3;else if(rampOf[i]>=0)c=RAMPS[rampOf[i]].ceil;
  else{const r=region[i];c=(r>=0&&!REG[r].out&&(k===K.FLOOR||k===K.PROP||k===K.BARS))?REG[r].h+REG[r].ceil:99;}
  return upB[i]<90?Math.min(c,upB[i]-SLAB):c;}/* sotto un altro strato il soffitto è il suo solaio */
function propTop(i){return cellH[i]+(PROP_H[propCh[i]]||1);}
function regionAt(x,z,y){const cx=Math.floor(x),cz=Math.floor(z);return inb(cx,cz)?region[cellAt(cx,cz,y)]:-1;}
function groups(test){const seen=new Uint8Array(N),out=[];
  for(let i=0;i<N;i++){if(seen[i]||!test(i))continue;const L=cL(i),base=L*N2;const cells=[];const q=[i];seen[i]=1;
    while(q.length){const c=q.pop();cells.push(c);const cx=cX(c),cz=cZ(c);for(const [dx,dz] of D4){const nx=cx+dx,nz=cz+dz;if(!inb(nx,nz))continue;const n=base+nz*GW+nx;if(!seen[n]&&test(n)){seen[n]=1;q.push(n);}}}
    let x0=1e9,x1=-1,z0=1e9,z1=-1;cells.forEach(c=>{const x=cX(c),z=cZ(c);x0=Math.min(x0,x);x1=Math.max(x1,x);z0=Math.min(z0,z);z1=Math.max(z1,z);});out.push({cells,x0,x1,z0,z1,l:L});}
  return out;}
function disposeTree(o){o.traverse(n=>{if(n.geometry&&n.geometry!==boardGeo)n.geometry.dispose();});}
const boardGeo=new THREE.BoxGeometry(1.85,.15,.05);
const flyBoards=[];for(let i=0;i<8;i++){const m=new THREE.Mesh(boardGeo,MAT.wood);m.visible=false;scene.add(m);flyBoards.push({m,t:0,v:new THREE.Vector3(),av:new THREE.Vector3()});}

/* =========================================================
   CARICAMENTO DI UNA MAPPA
   ========================================================= */
function loadMap(id){
  if(world){scene.remove(world);disposeTree(world);}
  world=new THREE.Group();scene.add(world);
  M=MAPS[id];const LAY=M.layers||[M.ascii];NL=LAY.length;GH=LAY[0].length;GW=LAY[0][0].length;N2=GW*GH;N=NL*N2;LBASE=M.layerBase||[0];
  const A=c=>LAY[cL(c)][cZ(c)][cX(c)];/* carattere della cella */
  kind=new Uint8Array(N);region=new Int8Array(N).fill(-1);rampOf=new Int8Array(N).fill(-1);propCh=new Array(N).fill('');cellH=new Float32Array(N);doorOf=new Int16Array(N).fill(-1);
  cellB=new Float32Array(N);upB=new Float32Array(N).fill(99);wallTop=new Float32Array(N);flow=new Uint16Array(N);bfsQ=new Int32Array(N);
  REG=M.regions;RI={};REG.forEach((r,i)=>RI[r.k]=i);
  scene.fog.color.setHex(M.fog);scene.background.setHex(M.fog);scene.fog.far=M.fogFar;
  for(let i=0;i<N;i++){const c=A(i);
    if(c===' ')kind[i]=K.VOID;else if(c==='#')kind[i]=K.WALL;else if(c==='|')kind[i]=K.BARS;else if(c==='+')kind[i]=K.DOOR;else if(c==='W')kind[i]=K.WIN;
    else if(c==='~'){kind[i]=K.WATER;cellH[i]=M.liquidH;}
    else if(RKEYS.includes(c)&&RI[c]!=null){kind[i]=K.FLOOR;region[i]=RI[c];cellH[i]=REG[RI[c]].h;}
    else if(RKEYS_UP.includes(c)&&RI[c.toLowerCase()]!=null){kind[i]=K.FLOOR;region[i]=RI[c.toLowerCase()];cellH[i]=REG[region[i]].h;}
    else if(c>='0'&&c<='9'){kind[i]=K.PROP;propCh[i]=c;}else kind[i]=K.VOID;}
  // una rampa appartiene alla zona in cui sbocca senza porta (non a quella dietro al cancello); vale anche lo sbocco su un altro strato
  groups(i=>{const c=A(i);return RKEYS_UP.includes(c)&&RI[c.toLowerCase()]!=null;}).forEach(g=>{const L=A(g.cells[0]).toLowerCase();const adj={};
    g.cells.forEach(c=>{const cx=cX(c),cz=cZ(c);for(const [dx,dz] of D4){if(!inb(cx+dx,cz+dz))continue;for(let l=0;l<NL;l++){if(l!==g.l&&!M.layers)continue;const q=LAY[l][cz+dz][cx+dx];if(RKEYS.includes(q)&&RI[q]!=null)adj[q]=(adj[q]||0)+1;}}});
    if(adj[L]||!Object.keys(adj).length)return;const best=Object.keys(adj).sort((a,b)=>adj[b]-adj[a])[0];g.cells.forEach(c=>{region[c]=RI[best];});});
  RAMPS=M.ramps.map(r=>{const l=r.l||0,r0=region[ix(r.x0,r.z0,l)];const out=r0<0||REG[r0].out;return {...r,l,ceil:out?99:Math.max(r.h0,r.h1)+3.4,dressed:!!(r.mesh&&ogg(r.mesh))};});
  RAMPS.forEach((r,ri)=>{for(let z=r.z0;z<=r.z1;z++)for(let x=r.x0;x<=r.x1;x++){const i=ix(x,z,r.l);if(kind[i]===K.FLOOR){rampOf[i]=ri;cellH[i]=rampH(r,x+.5,z+.5);}}});
  PERKS=M.perks.map(s=>{const [id,rest]=s.split('@');const [x,z,fx,fz,l]=rest.split(',').map(Number);return {id,...PERKDEF[id],cell:[x,z],l:l||0,face:[fx,fz]};});
  PERKS.forEach(p=>{const i=ix(p.cell[0],p.cell[1],p.l);kind[i]=K.PROP;propCh[i]='*';});
  const FL=M.forge.l||0;M.forge.cells.forEach(([x,z])=>{const i=ix(x,z,FL);kind[i]=K.PROP;propCh[i]='*';});
  cellTag=new Int8Array(N);M.forge.cells.forEach(([x,z])=>{cellTag[ix(x,z,FL)]=1;});
  if(M.egg3)M.egg3.altar.cells.forEach(([x,z])=>{const i=ix(x,z);kind[i]=K.PROP;propCh[i]='*';cellTag[i]=2;});
  if(M.benches)M.benches.forEach(b=>b.cells.forEach(([x,z])=>{const i=ix(x,z,b.l||0);kind[i]=K.PROP;propCh[i]='*';cellTag[i]=3;}));
  if(M.egg4)M.egg4.dogs.forEach(d=>{const i=ix(Math.floor(d.x),Math.floor(d.z),d.l);kind[i]=K.PROP;propCh[i]='*';cellTag[i]=4;});
  {const q=[];for(let i=0;i<N;i++)if(kind[i]===K.FLOOR)q.push(i);let h=0;
    while(h<q.length){const c=q[h++],cx=cX(c),cz=cZ(c),base=cL(c)*N2;for(const [dx,dz] of D4){const nx=cx+dx,nz=cz+dz;if(!inb(nx,nz))continue;const n=base+nz*GW+nx;
      if((kind[n]===K.PROP||kind[n]===K.BARS)&&region[n]<0){region[n]=region[c];cellH[n]=rampOf[c]>=0?REG[region[c]].h:cellH[c];q.push(n);}}}}
  // porte (con più strati: le due estremità possono stare su strati diversi, si cerca il pavimento all'altezza giusta)
  DOORS=[];
  groups(i=>kind[i]===K.DOOR).forEach(g=>{const l=g.l;
    const cfg=M.doors[g.x0+','+g.z0+(l?','+l:'')]||{to:'?',cost:1000,kind:'gate'};const zc=(g.z0+g.z1)>>1,xc=(g.x0+g.x1)>>1;const fl=i=>i>=0&&kind[i]===K.FLOOR;
    const alongX=(inb(g.x0-1,zc)&&fl(ix(g.x0-1,zc,l)))||(inb(g.x1+1,zc)&&fl(ix(g.x1+1,zc,l)));
    let ends=(alongX?[[g.x0-1,zc],[g.x1+1,zc]]:[[xc,g.z0-1],[xc,g.z1+1]]).filter(([a,b])=>inb(a,b)).map(([a,b])=>ix(a,b,l));
    const flat=ends.filter(e=>kind[e]===K.FLOOR&&rampOf[e]<0);const h=flat.length?cellH[flat[0]]:cellH[ends[0]];
    if(NL>1)ends=ends.map(e=>{if(kind[e]===K.FLOOR)return e;for(let l2=0;l2<NL;l2++){const e2=l2*N2+(e%N2);if(kind[e2]===K.FLOOR&&Math.abs(cellH[e2]-h)<1)return e2;}return e;});
    const regs=ends.map(e=>region[e]).filter(r=>r>=0);
    const d={...cfg,g,l,alongX,a:regs[0],b:regs[1]??regs[0],h,open:false,anim:0,cx:(g.x0+g.x1+1)/2,cz:(g.z0+g.z1+1)/2,w:alongX?(g.z1-g.z0+1):(g.x1-g.x0+1)};
    g.cells.forEach(c=>{doorOf[c]=DOORS.length;cellH[c]=h;});DOORS.push(d);});
  // finestre (gh = quota del terreno fuori, da dove arrivano gli zombie)
  WINDOWS=[];
  groups(i=>kind[i]===K.WIN).forEach(g=>{const l=g.l,c0=g.cells[0],x=cX(c0),z=cZ(c0);let nx=0,nz=0;
    for(const [dx,dz] of D4){const a=x+dx,b=z+dz;if(inb(a,b)&&kind[ix(a,b,l)]===K.VOID){nx=dx;nz=dz;}}
    const cx=(g.x0+g.x1+1)/2,cz=(g.z0+g.z1+1)/2;const inCell=ix(Math.floor(cx-nx*1.2),Math.floor(cz-nz*1.2),l);
    let out=0;for(let s=1;s<=7;s++){const a=Math.floor(cx+nx*(s+.5)),b=Math.floor(cz+nz*(s+.5));if(inb(a,b)&&kind[ix(a,b,l)]===K.VOID&&(l===0||kind[ix(a,b,0)]===K.VOID))out=s;else break;}
    const wh=region[inCell]>=0?REG[region[inCell]].h:0;g.cells.forEach(c=>{cellH[c]=wh;});
    const ox=Math.floor(cx+nx*1.5),oz=Math.floor(cz+nz*1.5),gh=inb(ox,oz)&&kind[ix(ox,oz,0)]===K.VOID?0:wh;
    WINDOWS.push({i:WINDOWS.length,l,cells:g.cells,cx,cz,nx,nz,h:wh,gh,region:region[inCell],boards:6,occupant:null,out:Math.max(1.6,out),base:{x:cx+nx*.85,z:cz+nz*.85},
      pos:{x:cx+nx*.15,z:cz+nz*.15},land:{x:cx-nx*1.35,z:cz-nz*1.35},inner:{x:cx-nx*1.1,z:cz-nz*1.1},w:g.cells.length});});
  // basi delle celle (dove comincia lo strato in quella colonna) e base dello strato di sopra
  for(let i=0;i<N;i++){const k=kind[i];if(k===K.VOID||k===K.WALL)continue;cellB[i]=rampOf[i]>=0?Math.min(RAMPS[rampOf[i]].h0,RAMPS[rampOf[i]].h1):cellH[i];}
  for(let i=0;i<N;i++){const k=kind[i];if(k===K.VOID){cellB[i]=cL(i)?99:0;continue;}if(k!==K.WALL)continue;const l=cL(i),x=cX(i),z=cZ(i);let b=1e9;
    for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){if(!inb(x+dx,z+dz))continue;const n=ix(x+dx,z+dz,l),nk=kind[n];if(nk!==K.VOID&&nk!==K.WALL)b=Math.min(b,cellB[n]);}
    cellB[i]=b<1e8?b:(LBASE[l]||0);if(NL>1)cellH[i]=cellB[i];}
  if(NL>1)for(let c=0;c<N2;c++){let up=99;for(let l=NL-1;l>=0;l--){const i=l*N2+c;upB[i]=up;if(kind[i]!==K.VOID)up=cellB[i];}}
  const RL=r=>r.length>2?r[2]:0;
  RISERS=M.risers.map(r=>({x:r[0],z:r[1],l:RL(r),water:false})).concat(M.waterRisers.map(r=>({x:r[0],z:r[1],l:RL(r),water:true})));
  RISERS.forEach(r=>{const i=ix(Math.floor(r.x),Math.floor(r.z),r.l);r.region=region[i];r.h=cellH[i];});
  WALLBUYS=M.wallbuys;BOX_SPOTS=M.boxSpots;
  // strato principale di ogni zona (per le scritte della planimetria)
  {const C=REG.map(()=>new Array(NL).fill(0));for(let i=0;i<N;i++)if(region[i]>=0&&kind[i]===K.FLOOR)C[region[i]][cL(i)]++;REGL=C.map(c=>c.indexOf(Math.max(...c)));}
  buildWorld();
}

/* ---------- geometria del mondo ---------- */
const GEO={};const geo=k=>GEO[k]||(GEO[k]=new Geo());
// la geometria unita del mondo usa i colori per vertice (ombre negli angoli): ogni materiale ha la sua copia che li legge
const VMAT={};function vmat(k){const m0=MAT[k]||MAT.metal;if(m0.isMeshBasicMaterial||!PIXL)return m0;/* ombre negli angoli solo con le luci per pixel */return VMAT[k]||(VMAT[k]=(()=>{const m=m0.clone();m.vertexColors=true;return m;})());}
function flushGeo(){Object.entries(GEO).forEach(([k,g])=>{if(g.p.length)world.add(g.mesh(vmat(k)));delete GEO[k];});}
// superficie della cella x,z dello strato l nel punto px,pz; NaN = vuoto in uno strato alto (lì non c'è niente)
function surfAt(x,z,px,pz,l=0){if(!inb(x,z))return l?NaN:(M.outside==='ground'?0:M.liquidH-.8);const i=ix(x,z,l),k=kind[i];if(k===K.WATER)return M.lava?M.liquidH-.6:M.liquidH-.8;if(l&&k===K.VOID)return NaN;return rampOf[i]>=0?rampH(RAMPS[rampOf[i]],px,pz):cellH[i];}
function surfOf(i,px,pz){const k=kind[i];if(k===K.WATER)return M.lava?M.liquidH-.6:M.liquidH-.8;return rampOf[i]>=0?rampH(RAMPS[rampOf[i]],px,pz):cellH[i];}
function topFor(i){const k=kind[i],r=region[i];let t;if(k===K.VOID||k===K.WATER)t=cL(i)?0:3.4;
  else if(r>=0){const R=REG[r];/* wallH: altezza dei muri delle zone all'aperto (parapetti del tetto, banchina del molo) */
    if(rampOf[i]>=0)t=RAMPS[rampOf[i]].ceil<99?RAMPS[rampOf[i]].ceil:(R.wallH!=null?R.h+R.wallH:cellH[i]+4.2);else t=R.out?R.h+(R.wallH??4.2):R.h+R.ceil;}else t=cellH[i]+3.4;
  return upB[i]<90?Math.min(t,upB[i]-SLAB):t;}
function blockTier(x,z,l){return M.id==='prigione'&&!l&&(z===50||z===56)&&x>=31&&x<=69&&M.ascii[z][x]!=='#';}
/* ombre negli angoli (occlusione ambientale nei colori dei vertici): muri, arredi alti e gradini più alti scuriscono pavimenti e soffitti vicini */
const AOF=[1,.8,.67,.55],AOC=[1,.86,.76,.66];
function occAt(x,z,l,h){if(!inb(x,z))return 0;const i=ix(x,z,l),k=kind[i];if(k===K.WALL)return 1;if(h===Infinity)return 0;/* soffitti: solo i muri */
  if(k===K.PROP)return (PROP_H[propCh[i]]||1)>=1.5?1:0;if(k===K.VOID||k===K.WATER)return 0;return cellH[i]>h+.5?1:0;}
function cornerAO(x,z,l,h,vx,vz,T){const dx=vx===x?-1:1,dz=vz===z?-1:1;const s1=occAt(x+dx,z,l,h),s2=occAt(x,z+dz,l,h),c=occAt(x+dx,z+dz,l,h);return T[s1&&s2?3:s1+s2+c];}
const wallAt=(x,z,l)=>inb(x,z)&&kind[ix(x,z,l)]===K.WALL;
/* mare: con la grafica media/alta increspature (mappa delle normali che scorre) e riflessi della luna */
const waterNrm=(()=>{const S=128,c=document.createElement('canvas');c.width=c.height=S;const g=c.getContext('2d'),im=g.createImageData(S,S),r=mulberry32(55);
  const hgt=new Float32Array(S*S);for(let k=0;k<26;k++){const fx=1+((r()*5)|0),fz=1+((r()*5)|0),ph=r()*6.28,a=.4+r()*.8;for(let y=0;y<S;y++)for(let x=0;x<S;x++)hgt[y*S+x]+=a*Math.sin((x*fx+y*fz)/S*Math.PI*2+ph)/(fx+fz);}
  for(let y=0;y<S;y++)for(let x=0;x<S;x++){const hx=hgt[y*S+(x+1)%S]-hgt[y*S+(x+S-1)%S],hy=hgt[((y+1)%S)*S+x]-hgt[((y+S-1)%S)*S+x];let nx=-hx*2.2,ny=-hy*2.2,nz=1;const l=Math.hypot(nx,ny,nz);
    const o=(y*S+x)*4;im.data[o]=(nx/l*.5+.5)*255;im.data[o+1]=(ny/l*.5+.5)*255;im.data[o+2]=(nz/l*.5+.5)*255;im.data[o+3]=255;}
  g.putImageData(im,0,0);const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(70,70);return t;})();
function seaMesh(){TX.water.repeat.set(60,60);const m=PIXL?LM({map:TX.water,normalMap:waterNrm,normalScale:new THREE.Vector2(.6,.6),specular:0x5a6878,shininess:70}):LM({map:TX.water});
  const w=new THREE.Mesh(new THREE.PlaneGeometry(420,420),m);w.rotation.x=-Math.PI/2;w.position.set(GW/2,M.liquidH,GH/2);return w;}

function buildWorld(){
  const wallIn=M.id==='acciaieria'?'brick':M.wallIn||'wall';
  for(let i=0;i<N;i++){const k=kind[i];if(k!==K.WALL&&k!==K.DOOR&&k!==K.WIN&&k!==K.BARS)continue;const x=cX(i),z=cZ(i),l=cL(i);
    let t=0,under=false;for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){const a=x+dx,b=z+dz;if(!inb(a,b))continue;const n=ix(a,b,l);if(region[n]>=0&&REG[region[n]].under)under=true;if(kind[n]===K.WALL)continue;t=Math.max(t,topFor(n));}
    wallTop[i]=under?0:(t||cellB[i]+3.4);if(upB[i]<90)wallTop[i]=upB[i]-SLAB;}/* sotto un altro strato il muro arriva fino al solaio */
  // pavimenti
  const floorMat=i=>{const k=kind[i];if(k===K.VOID||k===K.WIN)return 'ground';if(k===K.DOOR)return 'concrete';if(rampOf[i]>=0)return 'stairs';const r=region[i];return r>=0?REG[r].floor:'ground';};
  for(let l=0;l<NL;l++)for(let z=0;z<GH;z++){let run=-1;
    for(let x=0;x<=GW;x++){const i=x<GW?ix(x,z,l):-1;const isVoid=i>=0&&kind[i]===K.VOID;
      if(isVoid&&run<0&&!l)run=x;
      if(!isVoid&&run>=0){geo('ground').quad([run,0,z],[run,0,z+1],[x,0,z+1],[x,0,z],[[run/2,z/2],[run/2,(z+1)/2],[x/2,(z+1)/2],[x/2,z/2]]);run=-1;}
      if(i<0||isVoid)continue;const k=kind[i];if(k===K.WALL)continue;
      if(k===K.WATER){const y=M.liquidH;if(M.lava)geo('lava').quad([x,y,z],[x,y,z+1],[x+1,y,z+1],[x+1,y,z],[[x/3,z/3],[x/3,(z+1)/3],[(x+1)/3,(z+1)/3],[(x+1)/3,z/3]]);continue;}
      if(rampOf[i]>=0&&RAMPS[rampOf[i]].dressed){const r=RAMPS[rampOf[i]],y=Math.min(r.h0,r.h1);geo('concrete').quad([x,y,z],[x,y,z+1],[x+1,y,z+1],[x+1,y,z],[[x/2,z/2],[x/2,(z+1)/2],[(x+1)/2,(z+1)/2],[(x+1)/2,z/2]]);continue;}/* scala Meshy sopra */
      const H=(px,pz)=>surfAt(x,z,px,pz,l);const r=rampOf[i]>=0?RAMPS[rampOf[i]]:null,h=cellH[i];
      const uv=r?(r.axis==='x'?[[x,z],[x,z+1],[x+1,z+1],[x+1,z]].map(([a,b])=>[b/2,a*1.5]):[[x,z],[x,z+1],[x+1,z+1],[x+1,z]].map(([a,b])=>[a/2,b*1.5])):[[x/2,z/2],[x/2,(z+1)/2],[(x+1)/2,(z+1)/2],[(x+1)/2,z/2]];
      const ao=r?[1,1,1,1]:[cornerAO(x,z,l,h,x,z,AOF),cornerAO(x,z,l,h,x,z+1,AOF),cornerAO(x,z,l,h,x+1,z+1,AOF),cornerAO(x,z,l,h,x+1,z,AOF)];
      geo(floorMat(i)).quad([x,H(x,z),z],[x,H(x,z+1),z+1],[x+1,H(x+1,z+1),z+1],[x+1,H(x+1,z),z],uv,ao);}}
  // dislivelli (e, negli strati alti, il bordo dei solai sul vuoto)
  for(let l=0;l<NL;l++){const surfCell=(x,z)=>!inb(x,z)||kind[ix(x,z,l)]!==K.WALL;
    for(let z=-1;z<GH;z++)for(let x=-1;x<GW;x++)for(const [dx,dz] of [[1,0],[0,1]]){const x2=x+dx,z2=z+dz;if(z<0&&dx)continue;if(x<0&&dz)continue;
      if(!inb(x,z)&&!inb(x2,z2))continue;if(!surfCell(x,z)||!surfCell(x2,z2))continue;
      const ex0=dx?x+1:x,ez0=dx?z:z+1,ex1=dx?x+1:x+1,ez1=dx?z+1:z+1;
      let a0=surfAt(x,z,ex0,ez0,l),a1=surfAt(x,z,ex1,ez1,l),b0=surfAt(x2,z2,ex0,ez0,l),b1=surfAt(x2,z2,ex1,ez1,l);
      if(l){const na=Number.isNaN(a0),nb=Number.isNaN(b0);if(na&&nb)continue;if(na){a0=b0-SLAB;a1=b1-SLAB;}else if(nb){b0=a0-SLAB;b1=a1-SLAB;}}
      if(Math.abs(a0-b0)<.03&&Math.abs(a1-b1)<.03)continue;const aHigh=(a0+a1)>(b0+b1);
      geo('ledge').vwall(ex0,ez0,ex1,ez1,Math.min(a0,b0),Math.min(a1,b1),Math.max(a0,b0),Math.max(a1,b1),dx*(aHigh?1:-1),dz*(aHigh?1:-1),Math.min(a0,b0,a1,b1),[.62,.62,1,1]);}}
  // muri: tre fasce per faccia, più scure in basso (contatto col pavimento), in alto sotto i soffitti e negli angoli rientranti
  for(let i=0;i<N;i++){if(kind[i]!==K.WALL)continue;const x=cX(i),z=cZ(i),l=cL(i),top=wallTop[i];let exposed=false;
    for(const [dx,dz] of D4){const a=x+dx,b=z+dz;if(inb(a,b)&&kind[ix(a,b,l)]===K.WALL)continue;exposed=true;
      const ex0=dx===1?x+1:x,ez0=dz===1?z+1:z,ex1=dx?ex0:x+1,ez1=dz?ez0:z+1;let b0=surfAt(a,b,ex0,ez0,l),b1=surfAt(a,b,ex1,ez1,l);
      if(Number.isNaN(b0)){b0=b1=cellB[i]-SLAB;}
      const ni=inb(a,b)?ix(a,b,l):-1,nr=ni>=0?region[ni]:-1;const out=nr<0||REG[nr].out||(ni>=0&&kind[ni]===K.VOID);const bot=Math.min(b0,b1);if(top<=bot+.01)continue;
      const fac=out&&M.facades?facadeOf(x,z):null;
      const G=geo(fac||(out?(nr>=0&&REG[nr].wall||'wallOut'):(nr>=0&&(REG[nr].wall||(REG[nr].under?'rock':''))||wallIn)));
      const k0=(dx?wallAt(a,b-1,l):wallAt(a-1,b,l))?.74:1,k1=(dx?wallAt(a,b+1,l):wallAt(a+1,b,l))?.74:1;/* angoli rientranti */
      const ceilDark=!out&&ni>=0&&ceilAt(ni)<90&&Math.abs(ceilAt(ni)-top)<.4?.8:1;
      const s0=Math.min(b0+.7,top),s1=Math.min(b1+.7,top),m0=Math.max(s0,top-.6),m1=Math.max(s1,top-.6);
      G.vwall(ex0,ez0,ex1,ez1,b0,b1,s0,s1,dx,dz,bot,[.6*k0,.6*k1,k1,k0]);
      if(m0>s0+.01||m1>s1+.01)G.vwall(ex0,ez0,ex1,ez1,s0,s1,m0,m1,dx,dz,bot,[k0,k1,k1,k0]);
      if(top>m0+.01)G.vwall(ex0,ez0,ex1,ez1,m0,m1,top,top,dx,dz,bot,[k0,k1,k1*ceilDark,k0*ceilDark]);}
    if(exposed&&!(upB[i]<90))geo(top<=.05?'ground':'wallTop').quad([x,top,z],[x,top,z+1],[x+1,top,z+1],[x+1,top,z],[[x/2,z/2],[x/2,(z+1)/2],[(x+1)/2,(z+1)/2],[(x+1)/2,z/2]]);}
  // coperchio di terra sopra i sotterranei
  for(let i=0;i<N2;i++){const x=cX(i),z=cZ(i);const r=region[i];const k=kind[i];if(!((r>=0&&REG[r].under)||(k===K.WIN&&wallTop[i]===0)))continue;
    geo('ground').quad([x,0,z],[x,0,z+1],[x+1,0,z+1],[x+1,0,z],[[x/2,z/2],[x/2,(z+1)/2],[(x+1)/2,(z+1)/2],[(x+1)/2,z/2]]);}
  // soffitti
  for(let i=0;i<N;i++){const c=ceilAt(i);if(c>=90)continue;const k=kind[i];if(k===K.DOOR||k===K.WIN||k===K.WALL||k===K.VOID||k===K.WATER)continue;const x=cX(i),z=cZ(i),l=cL(i);
    const ao=[cornerAO(x,z,l,Infinity,x,z,AOC),cornerAO(x,z,l,Infinity,x+1,z,AOC),cornerAO(x,z,l,Infinity,x+1,z+1,AOC),cornerAO(x,z,l,Infinity,x,z+1,AOC)];
    geo('ceil').quad([x,c,z],[x+1,c,z],[x+1,c,z+1],[x,c,z+1],[[x/2,z/2],[(x+1)/2,z/2],[(x+1)/2,(z+1)/2],[x/2,(z+1)/2]],ao);}
  // gradini tra soffitti di altezza diversa (prima lì restava un buco: es. sopra la rampa che dalla cucina sale all'ufficio si vedeva il cielo)
  const ceilCell=i=>{const k=kind[i];return k===K.FLOOR||k===K.PROP||k===K.BARS;};
  for(let i=0;i<N;i++){if(!ceilCell(i))continue;const x=cX(i),z=cZ(i),l=cL(i),ci=ceilAt(i);if(ci>=90)continue;
    for(const [dx,dz] of [[1,0],[0,1],[-1,0],[0,-1]]){if(!inb(x+dx,z+dz))continue;const n=ix(x+dx,z+dz,l);if(!ceilCell(n))continue;const cn=ceilAt(n);if(cn>=90||cn<=ci+.02)continue;
      if(upB[i]<90&&Math.abs(ci-(upB[i]-SLAB))<.03)continue;/* il soffitto basso è il solaio di uno strato sopra: il bordo lo disegna quello strato */
      const hi=upB[i]<90?Math.min(cn,upB[i]-SLAB):cn;if(hi<=ci+.02)continue;
      const ex0=dx===1?x+1:x,ez0=dz===1?z+1:z,ex1=dx?ex0:x+1,ez1=dz?ez0:z+1;
      geo('plaster').vwall(ex0,ez0,ex1,ez1,ci,ci,hi,hi,dx,dz,ci,[.8,.8,1,1]);}}
  // sotto gli strati alti, dove sotto non c'è niente (terra o mare): la faccia di sotto del solaio
  for(let i=N2;i<N;i++){const k=kind[i];if(k===K.VOID)continue;const c=i%N2;let lo=-1;for(let l2=cL(i)-1;l2>=0;l2--){if(kind[l2*N2+c]!==K.VOID){lo=l2*N2+c;break;}}
    if(!(lo<0||kind[lo]===K.WATER||(lo<N2&&kind[lo]===K.VOID)))continue;const x=cX(i),z=cZ(i);
    const S=(px,pz)=>(k===K.WALL||rampOf[i]<0?cellB[i]:surfOf(i,px,pz))-SLAB;
    geo('ceil').quad([x,S(x,z),z],[x+1,S(x+1,z),z],[x+1,S(x+1,z+1),z+1],[x,S(x,z+1),z+1],[[x/2,z/2],[(x+1)/2,z/2],[(x+1)/2,(z+1)/2],[x/2,(z+1)/2]]);}
  // architravi
  for(let i=0;i<N;i++){const k=kind[i],x=cX(i),z=cZ(i),l=cL(i);if(k!==K.DOOR&&k!==K.WIN&&k!==K.BARS&&!(k===K.FLOOR&&blockTier(x,z,l)))continue;const h=cellH[i];
    if(blockTier(x,z,l)){if(k===K.DOOR)geo('plaster').box(x+.5,h+2.85,z+.5,1,.7,1);geo('plaster').box(x+.5,6.72,z+.5,1,.56,1);continue;}
    if(k===K.FLOOR)continue;if(k===K.DOOR&&DOORS[doorOf[i]]&&DOORS[doorOf[i]].kind==='debris')continue;const open=k===K.DOOR?2.5:k===K.WIN?2.3:2.9;const top=wallTop[i];if(top>h+open+.01)geo('plaster').box(x+.5,(h+open+top)/2,z+.5,1,top-h-open,1);}
  // sbarre
  const barsG=geo('bars');
  const rodRow=(x,z,y0,y1,alongX)=>{for(let k=0;k<4;k++){const o=.125+k*.25;barsG.cyl(alongX?x+o:x+.5,(y0+y1)/2,alongX?z+.5:z+o,.022,y1-y0,'y',5);}
    for(const yy of [y0+.06,y0+1.05,y1-.05])barsG.box(x+.5,yy,z+.5,alongX?1:.05,.05,alongX?.05:1);};
  for(let i=0;i<N;i++){const x=cX(i),z=cZ(i),l=cL(i);const tier=blockTier(x,z,l);if(kind[i]!==K.BARS&&!tier)continue;
    const sideK=(a,b)=>inb(a,b)&&[K.BARS,K.WALL,K.DOOR].includes(kind[ix(a,b,l)]);const alongX=sideK(x-1,z)||sideK(x+1,z);
    if(kind[i]===K.BARS&&!(OGG_BARS&&!tier))rodRow(x,z,cellH[i],tier?3.2:Math.min(cellH[i]+2.9,ceilAt(i)),alongX);if(tier)rodRow(x,z,3.45,6.44,true);}
  if(OGG_BARS)buildBarsMeshy();
  // parapetti sui bordi alti (anche sul bordo dei ballatoi e delle botole: conta dove cadresti)
  const rail=geo('metalDark');
  for(let i=0;i<N;i++){if(kind[i]!==K.FLOOR)continue;const x=cX(i),z=cZ(i),l=cL(i);
    for(const [dx,dz] of D4){const a=x+dx,b=z+dz;if(!inb(a,b))continue;const ex=x+.5+dx*.47,ez=z+.5+dz*.47;const hh=surfAt(x,z,ex,ez,l);
      const n=NL>1?cellAt(a,b,hh+.2):ix(a,b);const nk=kind[n];if(nk===K.WALL||nk===K.DOOR)continue;if(nk===K.WATER&&!M.lava)continue;
      const hn=surfOf(n,x+.5+dx*.53,z+.5+dz*.53);if(hh-hn<.7)continue;
      rail.box(ex,hh+1,ez,dx?.05:1,.06,dz?.05:1);rail.box(ex,hh+.55,ez,dx?.04:1,.04,dz?.04:1);rail.box(ex-(dz?.45:0),hh+.5,ez-(dx?.45:0),.05,1,.05);}}
  // extra di mappa
  search=null;beam=null;crane=null;
  if(M.id==='prigione'){
    const pl=geo('concrete');const r2=geo('metalDark');pl.box(50.5,3.33,48.6,39,.25,7.2);pl.box(50.5,3.33,58.4,39,.25,7.2);
    for(const zz of [52.2,54.8]){r2.box(50.5,4.35,zz,39,.06,.06);r2.box(50.5,3.9,zz,39,.04,.04);for(let xx=31;xx<=70;xx+=1.5)r2.box(xx,3.9,zz,.05,.95,.05);}
    search=new THREE.SpotLight(0xdfe8ff,2.2,70,.2,.45,1);search.position.set(92.5,7.6,17.5);world.add(search);world.add(search.target);
    beam=new THREE.Mesh(new THREE.CylinderGeometry(.25,7,40,14,1,true),new THREE.MeshBasicMaterial({color:0xcfe0ff,transparent:true,opacity:.03,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide,fog:false}));
    beam.geometry.translate(0,-20,0);beam.geometry.rotateX(-Math.PI/2);world.add(beam);
    geo('metalDark').cyl(92.5,4.5,17.5,.12,2.6,'y',6);geo('metalDark').box(92.5,7.3,17.5,.9,.6,.9);
    world.add(seaMesh());
  }else if(M.id==='rocca'){buildRoccaExtras();world.add(seaMesh());}
  else if(M.id==='cascate'){buildTownExtras();}
  else{
    // terreno attorno allo stabilimento
    const gm=LM({map:TX.ground});TX.ground.repeat.set(1,1);
    for(const [x,z,w,d] of [[GW/2,-100,440,200],[GW/2,GH+100,440,200],[-100,GH/2,200,GH],[GW+100,GH/2,200,GH]]){const p=new THREE.Mesh(new THREE.PlaneGeometry(w,d),gm);p.rotation.x=-Math.PI/2;p.position.set(x,-.01,z);world.add(p);}
    // carroponte sopra il laminatoio
    const cg=geo('yellow');cg.box(83,10.3,30.5,28,.5,.5);cg.box(83,10.3,57.5,28,.5,.5);
    crane=new THREE.Group();const beamG=new THREE.Mesh(new THREE.BoxGeometry(1,.7,28),MAT.yellow);beamG.position.y=10.2;crane.add(beamG);
    const trolley=new THREE.Mesh(new THREE.BoxGeometry(1.4,.8,1.4),MAT.metalDark);trolley.position.y=9.6;crane.add(trolley);crane.trolley=trolley;
    const cable=new THREE.Mesh(new THREE.BoxGeometry(.05,4,.05),MAT.metalDark);cable.position.y=7.4;trolley.add(cable);cable.position.set(0,-2.2,0);
    const hook=new THREE.Mesh(new THREE.TorusGeometry(.3,.07,6,12,Math.PI*1.4),MAT.metal);hook.position.set(0,-4.4,0);trolley.add(hook);
    crane.position.set(80,0,44);world.add(crane);
    // tubi del vapore lungo i muri
    const pg=geo('rust');pg.cyl(83,9,26.6,.22,28,'x',8);pg.cyl(49.5,11.8,25.5,.18,14,'z',8);pg.cyl(29.6,6.5,60,.2,20,'z',8);
    const lg=new THREE.Mesh(new THREE.PlaneGeometry(1,1),MAT.lava);lg.visible=false;world.add(lg);
  }
  buildProps();
  // luci delle zone (con un alone attorno alla lampadina: col bagliore della grafica alta sembrano accese davvero)
  roomLights=[];
  REG.forEach((r,ri)=>{(r.lights||[]).forEach(([x,z],li)=>{const lc=r.lcs?r.lcs[li]:r.lc;
    const y=r.h+(r.ly||r.ceil-.45),base=1.25*(PIXL&&r.li||1);const L=new THREE.PointLight(lc,base,r.lr||(r.ly?34:24),1);/* lr: raggio della luce (corto dove la luce passerebbe dai muri a un altro piano) */L.position.set(x,y,z);world.add(L);
    const top=r.h+(r.ceil||4);geo('metalDark').box(x,(y+top)/2+.1,z,.03,Math.max(.1,top-y-.2),.03);
    const shade=new THREE.Mesh(new THREE.ConeGeometry(.38,.26,10,1,true),MAT.metalDark);shade.position.set(x,y+.12,z);world.add(shade);
    const bulbMat=new THREE.MeshBasicMaterial({color:lc});const bulb=new THREE.Mesh(new THREE.SphereGeometry(.09,8,6),bulbMat);bulb.position.set(x,y,z);world.add(bulb);
    let halo=null;if(PIXL){halo=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex,color:lc,transparent:true,opacity:.55,depthWrite:false,blending:THREE.AdditiveBlending}));halo.scale.setScalar(1.1);halo.position.set(x,y-.05,z);world.add(halo);}
    roomLights.push({L,bulbMat,halo,base,col:new THREE.Color(lc),f:1,t:0,ri});});});
  const hemi=new THREE.HemisphereLight(0x56627e,0x15110c,M.hemi||(M.id==='acciaieria'?.42:.5));world.add(hemi);
  const moon=new THREE.DirectionalLight(M.id==='acciaieria'?0x9a8a7a:0x8095c8,M.moon||(M.id==='acciaieria'?.25:.34));moon.position.set(-40,70,-30);world.add(moon);
  // cielo
  const sp=new Float32Array(1200);for(let i=0;i<400;i++){const a=Math.random()*Math.PI*2,e=rand(.12,1.4),R=130;sp[i*3]=GW/2+Math.cos(a)*Math.cos(e)*R;sp[i*3+1]=Math.sin(e)*R;sp[i*3+2]=GH/2+Math.sin(a)*Math.cos(e)*R;}
  const sg=new THREE.BufferGeometry();sg.setAttribute('position',new THREE.BufferAttribute(sp,3));world.add(new THREE.Points(sg,new THREE.PointsMaterial({color:0xc9d3ff,size:1.6,sizeAttenuation:false,fog:false})));
  const mn=new THREE.Mesh(new THREE.CircleGeometry(5,24),new THREE.MeshBasicMaterial({color:0xdfe3d2,fog:false}));mn.position.set(GW/2-60,75,GH/2-75);mn.lookAt(GW/2,0,GH/2);world.add(mn);
  buildRails();buildStairs();buildDecor();buildDoors();buildTraps();buildWindows();buildWallbuys();buildPerks();buildBox();buildPower();buildForge();buildQuest();buildRecorders();buildWritings();buildEgg3();buildEgg4();
  // collisioni degli arredi per i proiettili, per cella (nello strato in cui sta la loro base)
  COLCELL=new Map();PROPCOL.forEach((c,k)=>{const x0=Math.floor(c.t==='b'?c.x0:c.x-c.r),x1=Math.floor(c.t==='b'?c.x1:c.x+c.r),z0=Math.floor(c.t==='b'?c.z0:c.z-c.r),z1=Math.floor(c.t==='b'?c.z1:c.z+c.r);
    for(let z=z0;z<=z1;z++)for(let x=x0;x<=x1;x++){if(!inb(x,z))continue;const i=NL>1?cellAt(x,z,c.y0+.05):ix(x,z);if(!COLCELL.has(i))COLCELL.set(i,[]);COLCELL.get(i).push(k);}});
  flushGeo();
  // tutto il mondo visibile da entrambi i lati (pavimenti delle passerelle visti da sotto, soffitti visti da sopra, pannelli)
  world.traverse(o=>{if(o.isMesh&&o.material&&!Array.isArray(o.material)&&!o.material.transparent)o.material.side=THREE.DoubleSide;});
}

/* ---------- dettagli che danno vita a muri, angoli e pavimenti ----------
   Battiscopa, paraspigoli sugli angoli sporgenti, sporco e ragnatele negli angoli, tubi sotto il soffitto, estintori, quadri elettrici
   col tubo che sale, avvisi appesi, griglie d'aerazione; per terra fogli, calcinacci, bottiglie, lattine e macchie di sangue.
   Solo da vedere: sono piatti, bassi o attaccati al muro, così non creano muri invisibili. Stessi dettagli a ogni partita (seme fisso) */
let decorReady=false;
function decorMaterials(){if(decorReady)return;decorReady=true;
  const paper=textTex(128,128,(c,w,h)=>{const r=mulberry32(3);c.fillStyle='#d9d2bc';c.fillRect(0,0,w,h);for(let k=0;k<300;k++){c.fillStyle=`rgba(90,70,40,${r()*.08})`;c.fillRect(r()*w,r()*h,2+r()*6,2+r()*6);}
    c.fillStyle='rgba(40,34,28,.85)';c.fillRect(14,12,w-28,9);for(let y=32;y<h-12;y+=8){c.fillStyle=`rgba(40,34,28,${.35+r()*.3})`;c.fillRect(14,y,(w-28)*(.5+r()*.5),3);}
    const g=c.createLinearGradient(0,0,w,h);g.addColorStop(0,'rgba(120,90,40,0)');g.addColorStop(1,'rgba(120,90,40,.25)');c.fillStyle=g;c.fillRect(0,0,w,h);});
  const web=textTex(128,128,(c,w,h)=>{c.clearRect(0,0,w,h);c.strokeStyle='rgba(225,225,220,.9)';c.lineWidth=1.1;
    for(let k=0;k<9;k++){const a=k/8*Math.PI/2;c.beginPath();c.moveTo(0,0);c.lineTo(Math.cos(a)*w*1.45,Math.sin(a)*h*1.45);c.stroke();}
    for(let rr=9;rr<w*1.45;rr+=8+rr*.09){c.beginPath();for(let k=0;k<=8;k++){const a=k/8*Math.PI/2,q=rr*(.9+.1*Math.sin(k*2.3+rr));k?c.lineTo(Math.cos(a)*q,Math.sin(a)*q):c.moveTo(Math.cos(a)*q,Math.sin(a)*q);}c.stroke();}});
  const grime=textTex(128,128,(c,w,h)=>{const g=c.createRadialGradient(0,0,0,0,0,w);g.addColorStop(0,'rgba(14,11,8,.78)');g.addColorStop(.5,'rgba(14,11,8,.32)');g.addColorStop(1,'rgba(14,11,8,0)');c.fillStyle=g;c.fillRect(0,0,w,h);
    const r=mulberry32(9);for(let k=0;k<60;k++){const x=r()*w*.7,y=r()*h*.7;c.fillStyle=`rgba(14,11,8,${r()*.25})`;c.fillRect(x,y,1+r()*3,1+r()*3);}});
  const blood=textTex(128,128,(c,w,h)=>{const r=mulberry32(11);c.clearRect(0,0,w,h);c.fillStyle='rgba(70,5,3,.92)';for(let k=0;k<16;k++){c.beginPath();c.ellipse(64+(r()-.5)*44,64+(r()-.5)*44,6+r()*20,5+r()*15,r()*3,0,7);c.fill();}
    c.fillStyle='rgba(105,9,5,.85)';for(let k=0;k<44;k++){const a=r()*7,d=30+r()*34;c.beginPath();c.arc(64+Math.cos(a)*d,64+Math.sin(a)*d,.8+r()*2.6,0,7);c.fill();}});
  const dec=o=>({transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2,...o});
  MAT.paper=LM({map:paper});MAT.web=new THREE.MeshBasicMaterial({map:web,transparent:true,opacity:.5,depthWrite:false,side:THREE.DoubleSide});
  MAT.grime=new THREE.MeshBasicMaterial(dec({map:grime,side:THREE.DoubleSide}));MAT.bloodPool=LM(dec({map:blood,side:THREE.DoubleSide}));MAT.glass=SHINY(0x2f4d33,.85,90);}
function buildDecor(){decorMaterials();const r=mulberry32([...M.id].reduce((a,ch)=>(a*31+ch.charCodeAt(0))|0,7));
  const pts=[],add=(x,z)=>{if(Number.isFinite(x)&&Number.isFinite(z))pts.push([x,z]);},P0=o=>o?(o.cell?[o.cell[0]+.5,o.cell[1]+.5]:[o.cx??o.x,o.cz??o.z]):[NaN,NaN];
  [DOORS,WINDOWS,PERKS,WALLBUYS,BOX_SPOTS||[],RISERS,M.recorders||[],[M.power],[M.forge]].forEach(L=>(L||[]).forEach(o=>add(...P0(o))));(M.writings||[]).forEach(w=>add(w.c[0]+.5,w.c[1]+.5));
  const busy=(x,z,R)=>pts.some(p=>Math.abs(p[0]-x)<R&&Math.abs(p[1]-z)<R),isW=(x,z,l)=>inb(x,z)&&kind[ix(x,z,l)]===K.WALL;
  const hsh=s=>{let a=7;for(let k=0;k<s.length;k++)a=Math.imul(a^s.charCodeAt(k),2654435761);return ((a>>>0)%1000)/1000;},guards=new Set();
  for(let i=0;i<N;i++){if(kind[i]!==K.FLOOR||rampOf[i]>=0||region[i]<0)continue;const x=cX(i),z=cZ(i),l=cL(i),h=cellH[i],RG=REG[region[i]],c=ceilAt(i),inside=!RG.out&&c<90,tall=inside&&c-h>=2.8;
    const nearBusy=busy(x+.5,z+.5,1.6);let walls=0;
    for(const [dx,dz] of D4){if(!isW(x+dx,z+dz,l))continue;walls++;
      const bx=dx===1?x+1:dx===-1?x:x+.5,bz=dz===1?z+1:dz===-1?z:z+.5,nx=-dx,nz=-dz,tx=dx?0:1,tz=dx?1:0;
      const Pt=(o,y,t)=>[bx+nx*o+tx*t,y,bz+nz*o+tz*t];
      const wbox=(m,o,y,t,len,hg,th)=>{const p=Pt(o,y,t);geo(m).box(p[0],p[1],p[2],dx?th:len,hg,dx?len:th);};
      const wquad=(m,o,y0,y1,t0,t1,uv)=>geo(m).quad(Pt(o,y0,t0),Pt(o,y0,t1),Pt(o,y1,t1),Pt(o,y1,t0),uv||[[0,0],[1,0],[1,1],[0,1]]);
      if(inside){wquad('metalDark',.022,h,h+.12,-.5,.5);geo('metalDark').quad(Pt(0,h+.12,-.5),Pt(0,h+.12,.5),Pt(.022,h+.12,.5),Pt(.022,h+.12,-.5),[[0,0],[1,0],[1,1],[0,1]]);}/* battiscopa */
      // tubi: su certe pareti (scelte col numero della parete, così il tubo continua di cella in cella)
      const line=(dx?'x'+(x+dx):'z'+(z+dz))+'/'+dx+dz+'/'+l,pq=hsh(line+M.id);
      if(tall&&pq<.3){const p=Pt(.14,c-.2,0);geo(pq<.12?'rust':'metal').cyl(p[0],p[1],p[2],.065,1.001,dx?'z':'x',8);if(((dx?z:x)&1)===0)wbox('metalDark',.07,c-.2,0,.06,.05,.14);
        if(pq<.18){const q=Pt(.08,c-.38,0);geo('metalDark').cyl(q[0],q[1],q[2],.025,1.001,dx?'z':'x',6);}}
      if(nearBusy)continue;const q=r(),t=(r()-.5)*.5;
      if(inside&&q<.016){const p=Pt(.11,h+1.05,t);geo('redPaint').cyl(p[0],p[1],p[2],.075,.46,'y',10,true);geo('metalDark').cyl(p[0],p[1]+.27,p[2],.032,.09,'y',6);
        wbox('metalDark',.03,h+1.0,t,.12,.36,.04);const hp=Pt(.19,h+1.2,t+.06);geo('metalDark').cyl(hp[0],hp[1],hp[2],.012,.3,'y',4);}/* estintore */
      else if(inside&&q<.04){wbox('metalDark',.065,h+1.45,t,.32,.42,.12);wbox('metal',.13,h+1.45,t,.26,.34,.01);if(tall){const p=Pt(.05,(h+1.66+c)/2,t);geo('metalDark').cyl(p[0],p[1],p[2],.022,c-h-1.66,'y',6);}}/* quadro elettrico */
      else if(q<.085&&(inside||r()<.5)){const a=(r()-.5)*.25,cy=h+1.35+r()*.35,W=.15,H=.21,ca=Math.cos(a),sa=Math.sin(a);
        const C=(u,v)=>Pt(.012,cy+u*sa+v*ca,t+u*ca-v*sa);geo('paper').quad(C(-W,-H),C(W,-H),C(W,H),C(-W,H),[[0,0],[1,0],[1,1],[0,1]]);}/* avviso appeso */
      else if(tall&&q<.11){wbox('metal',.025,c-.4,t,.5,.3,.05);for(let k=0;k<4;k++)wbox('metalDark',.055,c-.51+k*.075,t,.46,.022,.02);}}/* griglia d'aerazione */
    // angoli rientranti: sporco per terra e ragnatele in alto
    for(const [dx,dz] of [[1,1],[1,-1],[-1,1],[-1,-1]]){if(!isW(x+dx,z,l)||!isW(x,z+dz,l))continue;const X=dx===1?x+1:x,Z=dz===1?z+1:z;
      if(r()<.8){const s=.6+r()*.4;geo('grime').quad([X,h+.006,Z],[X-dx*s,h+.006,Z],[X-dx*s,h+.006,Z-dz*s],[X,h+.006,Z-dz*s],[[0,0],[1,0],[1,1],[0,1]]);}
      if(inside&&r()<.35){const s=.35+r()*.45;geo('web').quad([X-dx*.01,c-.01,Z-dz*.01],[X-dx*s,c-.01,Z-dz*.01],[X-dx*s*.45,c-s*.7,Z-dz*s*.45],[X-dx*.01,c-.01,Z-dz*s],[[0,0],[1,0],[.7,.7],[0,1]]);}}
    // angoli sporgenti dei muri (spigoli): paraspigolo di ferro fino a 1,3 m
    if(inside)for(const [dx,dz] of [[1,1],[1,-1],[-1,1],[-1,-1]]){if(!isW(x+dx,z,l)||isW(x,z+dz,l)||isW(x+dx,z+dz,l))continue;
      const X=dx===1?x+1:x,Z=dz===1?z+1:z,key=X+','+Z+','+l+','+(x+dx)+','+z;if(guards.has(key))continue;guards.add(key);
      geo('metal').box(X-dx*.011,h+.66,Z-dz*.04,.022,1.3,.08);geo('metal').box(X+dx*.04,h+.66,Z+dz*.011,.08,1.3,.022);}
    // per terra
    const q=r();
    if(q<.025&&!nearBusy){const s=.7+r()*.9,a=r()*6,ca=Math.cos(a)*s/2,sa=Math.sin(a)*s/2,cx=x+.5,cz=z+.5;geo('bloodPool').quad([cx-ca+sa,h+.009,cz-sa-ca],[cx+ca+sa,h+.009,cz+sa-ca],[cx+ca-sa,h+.009,cz+sa+ca],[cx-ca-sa,h+.009,cz-sa+ca],[[0,0],[1,0],[1,1],[0,1]]);}
    else if(q<.09){const a=r()*6,ca=Math.cos(a),sa=Math.sin(a),cx=x+.2+r()*.6,cz=z+.2+r()*.6,W=.105,H=.15;const C=(u,v)=>[cx+u*ca-v*sa,h+.007+r()*.004,cz+u*sa+v*ca];
      geo('paper').quad(C(-W,-H),C(W,-H),C(W,H),C(-W,H),[[0,0],[1,0],[1,1],[0,1]]);}/* foglio per terra */
    else if(q<.16&&walls){const n=3+Math.floor(r()*4);for(let k=0;k<n;k++){const s=.04+r()*.1;geo(r()<.7?'stone':'rock').box(x+.15+r()*.7,h+s/2,z+.15+r()*.7,s*(1+r()),s,s*(1+r()*.6),r()*3);}}/* calcinacci */
    else if(q<.168&&!nearBusy){const lie=r()<.6,ax=r()<.5?'x':'z';geo('glass').cyl(x+.2+r()*.6,h+(lie?.036:.13),z+.2+r()*.6,.035,lie?.24:.26,lie?ax:'y',8,true);}/* bottiglia */
    else if(q<.175&&!nearBusy){geo('metal').cyl(x+.2+r()*.6,h+.034,z+.2+r()*.6,.033,.12,r()<.5?'x':'z',8,true);}}}/* lattina schiacciata */

/* ---------- parapetti sul bordo dell'acqua ----------
   Il giocatore non può scendere in acqua: prima il bordo del molo era un muro invisibile. Ora c'è una ringhiera
   (legno sui moli, ferro sulla lava), tranne dove gli zombie salgono dall'acqua */
/* scale Meshy sulle rampe che lo chiedono (ramps[].mesh in p2_data.js): parte bassa all'inizio della salita, larghe quanto la rampa */
function buildStairs(){RAMPS.forEach(r=>{if(!r.dressed)return;const m=oggMesh(r.mesh);const up=r.h1>r.h0;
  const len=(r.axis==='x'?r.x1-r.x0:r.z1-r.z0)+1,wid=(r.axis==='x'?r.z1-r.z0:r.x1-r.x0)+1,d=ogg(r.mesh),L0=d.box[3]-d.box[0],W0=d.box[5]-d.box[2],R0=Math.abs(r.h1-r.h0);
  m.scale.set(len/L0,1,wid/W0);/* la salita è già quella giusta (lo script la scala sull'ultimo gradino) */
  const dir=r.axis==='x'?[up?1:-1,0]:[0,up?1:-1],x=r.axis==='x'?(up?r.x0:r.x1+1):(r.x0+r.x1+1)/2,z=r.axis==='x'?(r.z0+r.z1+1)/2:(up?r.z0:r.z1+1);
  m.position.set(x,Math.min(r.h0,r.h1),z);m.rotation.y=Math.atan2(-dir[1],dir[0]);if(Math.abs(R0-(d.rise||R0))>.05)m.scale.y=R0/d.rise;world.add(m);});}
function buildRails(){const posts=new Set(),wood=!M.lava,gp=wood?'woodDark':'metalDark',gr=wood?'wood':'metal';
  const RM=ogg('ringhiera'),RS=[];/* ringhiera Meshy: un pezzo da 1 m per lato (InstancedMesh) */
  const seg=(x0,z0,x1,z1,y)=>{const m=new THREE.Matrix4(),q=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),Math.abs(x1-x0)>Math.abs(z1-z0)?0:Math.PI/2);
    m.compose(new THREE.Vector3((x0+x1)/2,y,(z0+z1)/2),q,new THREE.Vector3(Math.hypot(x1-x0,z1-z0),1,1));RS.push(m);};
  const riser=(x,z)=>RISERS.some(r=>r.water&&Math.hypot(r.x-x,r.z-z)<1.9);
  for(let i=0;i<N;i++){if(!walkable(i)||kind[i]===K.DOOR)continue;const x=cX(i),z=cZ(i),l=cL(i);
    for(const [dx,dz] of D4){const a=x+dx,b=z+dz;if(!inb(a,b)||kind[ix(a,b,l)]!==K.WATER)continue;
      const ex0=dx===1?x+1:x,ez0=dz===1?z+1:z,ex1=dx?ex0:x+1,ez1=dz?ez0:z+1;if(riser((ex0+ex1)/2,(ez0+ez1)/2))continue;
      const ix0=ex0-dx*.07,iz0=ez0-dz*.07,ix1=ex1-dx*.07,iz1=ez1-dz*.07,h0=surfAt(x,z,ex0,ez0,l),h1=surfAt(x,z,ex1,ez1,l),hm=(h0+h1)/2,mx=(ix0+ix1)/2,mz=(iz0+iz1)/2;
      if(RM){seg(ix0,iz0,ix1,iz1,Math.min(h0,h1));continue;}
      for(const [px,pz,ph] of [[ix0,iz0,h0],[ix1,iz1,h1]]){const k=px.toFixed(2)+','+pz.toFixed(2);if(posts.has(k))continue;posts.add(k);geo(gp).box(px,ph+.55,pz,.11,1.1,.11);}
      for(const y of [.5,1.02])geo(gr).box(mx,hm+y,mz,dx?.06:1,.07,dz?.06:1);
      if(wood)geo('cable').cyl(mx,hm+.78,mz,.02,1,dx?'z':'x',5);}
    /* ballatoi che finiscono contro la cima di un muro più bassa di loro: ringhiera di ferro (prima si sbatteva contro il nulla) */
    const hh=cellH[i];if(rampOf[i]>=0)continue;for(const [dx,dz] of D4){const a=x+dx,b=z+dz;if(!inb(a,b))continue;const j=cellAt(a,b,hh+.05);if(kind[j]!==K.WALL||wallTop[j]>hh+.9||upB[j]<hh+2)continue;
      const ex0=dx===1?x+1:x,ez0=dz===1?z+1:z,ex1=dx?ex0:x+1,ez1=dz?ez0:z+1,ix0=ex0-dx*.05,iz0=ez0-dz*.05,ix1=ex1-dx*.05,iz1=ez1-dz*.05;
      if(RM){seg(ix0,iz0,ix1,iz1,hh);continue;}
      for(const [px,pz] of [[ix0,iz0],[ix1,iz1]]){const k=px.toFixed(2)+','+pz.toFixed(2);if(posts.has(k))continue;posts.add(k);geo('metalDark').box(px,hh+.55,pz,.07,1.1,.07);}
      for(const y of [.55,1.06])geo('metalDark').box((ix0+ix1)/2,hh+y,(iz0+iz1)/2,dx?.05:1,.05,dz?.05:1);}}
  if(RS.length){const im=new THREE.InstancedMesh(RM.geo.main,RM.mat,RS.length);RS.forEach((m,k)=>im.setMatrixAt(k,m));im.frustumCulled=false;world.add(im);}}

/* ---------- arredi ---------- */
function buildProps(){
  Furn=null;PROPCOL.length=0;COLREC=true;
  const pg=groups(i=>kind[i]===K.PROP&&propCh[i]!=='*');const comps=[];
  pg.forEach(g=>{const byCh={};g.cells.forEach(c=>{(byCh[propCh[c]]=byCh[propCh[c]]||[]).push(c);});
    Object.entries(byCh).forEach(([ch,cells])=>{let x0=1e9,x1=-1,z0=1e9,z1=-1;cells.forEach(c=>{const x=cX(c),z=cZ(c);x0=Math.min(x0,x);x1=Math.max(x1,x);z0=Math.min(z0,z);z1=Math.max(z1,z);});
      comps.push({ch,x0,x1,z0,z1,r:region[cells[0]],h:cellH[cells[0]]});});});
  const r=mulberry32(77);const lamps=[];
  comps.forEach(p=>{const w=p.x1-p.x0+1,d=p.z1-p.z0+1,cx=p.x0+w/2,cz=p.z0+d/2,h=p.h,long=w>=d;const rk=p.r>=0?REG[p.r].k:'';const steel=M.id==='acciaieria';
    if(M.id==='cascate'&&townProp(p,w,d,cx,cz,h,long,rk,r))return;
    if(rk==='k'&&steel){
      if(p.ch==='4'){geo('rock').cyl(cx,h+2.2,cz,.28,4.4,'y',8);geo('stone').box(cx,h+.12,cz,.8,.24,.8);geo('stone').box(cx,h+4.25,cz,.8,.3,.8);}
      else if(p.ch==='5'){geo('stone').cyl(cx,h+.45,cz,.18,.9,'y',8);geo('metalDark').cyl(cx,h+.95,cz,.42,.18,'y',12);geo('stone').box(cx,h+.05,cz,.6,.1,.6);}
      else if(p.ch==='7'){geo('stone').box(cx,h+.4,cz,w-.08,.8,d-.08);for(let k=0;k<w;k++)geo('rock').box(p.x0+k+.5,h+.4,cz+d/2-.02,.5,.4,.04);}
      return;}
    switch(p.ch){
      case '1':{geo('wood').box(cx,h+.76,cz,w-.08,.07,d-.08);const lx=w/2-.12,lz=d/2-.12;for(const [ox,oz] of [[-1,-1],[1,-1],[-1,1],[1,1]])geo('metalDark').box(cx+ox*lx,h+.36,cz+oz*lz,.07,.72,.07);
        if(long)geo('metalDark').box(cx,h+.2,cz,w-.3,.05,.06);else geo('metalDark').box(cx,h+.2,cz,.06,.05,d-.3);/* traversa bassa */
        for(let k=0;k<Math.max(2,Math.round(w*d/2));k++)geo('metal').box(cx+rand(-w/2+.25,w/2-.25),h+.81,cz+rand(-d/2+.2,d/2-.2),.3,.03,.22,rand(-.3,.3));break;}
      case '2':geo('white').box(cx,h+.45,cz,w-.1,.08,d-.1);geo('white').box(cx,h+.72,p.z0+.05,w-.1,.6,.05);geo('mattress').box(cx,h+.56,cz,w-.2,.14,d-.2);geo('white').box(cx,h+.66,p.z0+.35,w-.35,.08,.3);
        for(const [ox,oz] of [[-1,-1],[1,-1],[-1,1],[1,1]])geo('white').box(cx+ox*(w/2-.1),h+.22,cz+oz*(d/2-.1),.04,.44,.04);break;
      case '3':if(steel&&rk==='f'){const inF=(c,hw,x0,W)=>c<x0+hw?x0+hw:c>x0+W-hw?x0+W-hw:c;
          for(let k=0;k<w*d*2;k++){const g=r()<.5?'rust':'metalDark';if(r()<.4){const rad=.15+r()*.3,ax=r()<.5?'x':'z',L=Math.min(.8+r()*1.2,(ax==='x'?w:d)-.1),hx=ax==='x'?L/2:rad,hz=ax==='x'?rad:L/2;
              geo(g).cyl(inF(p.x0+r()*w,hx,p.x0,w),h+rad+r()*.9,inF(p.z0+r()*d,hz,p.z0,d),rad,L,ax,8,true);}
            else{const sx=Math.min(.4+r()*.9,w-.1),sy=.3+r()*.6,sz=Math.min(.4+r()*.9,d-.1),a=r()*3,c=Math.abs(Math.cos(a)),s=Math.abs(Math.sin(a)),hx=sx/2*c+sz/2*s,hz=sx/2*s+sz/2*c;
              geo(g).box(hx*2<w?inF(p.x0+r()*w,hx,p.x0,w):cx,h+sy/2+r()*1.1,hz*2<d?inF(p.z0+r()*d,hz,p.z0,d):cz,sx,sy,sz,hx*2<w&&hz*2<d?a:0);}}}
        else{for(let xx=p.x0;xx<=p.x1;xx++)for(let zz=p.z0;zz<=p.z1;zz++){{const ci=cellAt(xx,zz,h+.1);if(kind[ci]!==K.PROP||propCh[ci]!=='3')continue;}const ch2=r()<.5?.95:1.15,a=(r()-.5)*.12;
            if(r()<.22){geo('rust').cyl(xx+.5,h+.5,zz+.5,.42,1,'y',12);geo('metalDark').cyl(xx+.5,h+.3,zz+.5,.435,.05,'y',12);geo('metalDark').cyl(xx+.5,h+.72,zz+.5,.435,.05,'y',12);}/* barile */
            else{geo(r()<.6?'wood':'woodDark').box(xx+.5,h+ch2/2,zz+.5,.94,ch2,.94,a);geo('woodDark').box(xx+.5,h+ch2/2,zz+.5+.475,.96,.08,.02,a);geo('woodDark').box(xx+.5,h+ch2/2,zz+.5-.475,.96,.08,.02,a);}
            if(r()<.55)geo(r()<.5?'wood':'woodDark').box(xx+.5+(r()-.5)*.2,h+ch2+.31,zz+.5+(r()-.5)*.2,.62,.62,.62,r()*1.2);}}break;
      case '4':if(rk==='i'){geo('metalDark').cyl(cx,h+.3,cz,.18,.6,'y',8);geo('metalDark').cyl(cx,h+.62,cz,.24,.08,'y',8);}
        else{geo('metalDark').cyl(cx,h+2,cz,.07,4,'y',6);geo('metalDark').box(cx,h+4,cz,.5,.12,.3);lamps.push([cx,h+3.9,cz]);}break;
      case '5':{const g=rk==='h'?'wood':'metal';geo(g).box(cx,h+.5,cz,w-.1,1,d-.15);geo(rk==='h'?'woodDark':'white').box(cx,h+1.02,cz,w,.05,d);break;}
      case '7':for(let x7=p.x0;x7<=p.x1;x7++)for(let z7=p.z0;z7<=p.z1;z7++){{const ci=cellAt(x7,z7,h+.1);if(kind[ci]!==K.PROP||propCh[ci]!=='7')continue;}const xx=x7+.5,zz=z7+.5;
          if(rk==='e'){geo('metal').box(xx,h+.45,zz,.94,.9,.94);geo('metalDark').box(xx,h+.92,zz,.94,.04,.94);}else{geo('white').box(xx,h+.55,zz,.94,1.1,.92);const fx=long?0:-1,fz=long?(z7+.5<cz?-1:1):0;geo('metalDark').cyl(xx+(fx?-.47:0),h+.6,zz+fz*.47,.25,.04,fx?'x':'z',10);}}break;
      case '8':geo('wood').box(cx,h+.45,cz,long?w-.1:.4,.06,long?.4:d-.1);geo('metalDark').box(p.x0+.3,h+.21,cz,.06,.42,.3);geo('metalDark').box(p.x1+.7,h+.21,cz,.06,.42,.3);break;
      case '9':{
        if(steel&&rk==='g'){const R=Math.min(w,d)*.46;geo('rust').cyl(cx,h+6,cz,R,12,'y',16);geo('metalDark').cyl(cx,h+1.2,cz,R+.25,.5,'y',16);geo('metalDark').cyl(cx,h+8,cz,R+.2,.4,'y',16);
          for(const a of [0,1.6,3.2,4.7])geo('rust').cyl(cx+Math.cos(a)*(R+.6),h+6,cz+Math.sin(a)*(R+.6),.25,12,'y',6);
          const ring=new THREE.Mesh(new THREE.CylinderGeometry(R+.05,R+.05,.6,20,1,true),new THREE.MeshBasicMaterial({color:0x331408,side:THREE.DoubleSide}));ring.position.set(cx,h+2.4,cz);world.add(ring);
          Furn={ring,x:cx,z:cz,h};}
        else if(steel&&rk==='h'){const m=Math.min(w,d),n=Math.max(1,Math.round((long?w:d)/m)),R=m*.5;for(let k=0;k<n;k++){const qx=long?p.x0+(k+.5)*w/n:cx,qz=long?cz:p.z0+(k+.5)*d/n;
          geo('rust').cyl(qx,h+.45,qz,R,.9,'y',16);const lv=new THREE.Mesh(new THREE.CircleGeometry(R-.15,20),MAT.lava);lv.rotation.x=-Math.PI/2;lv.position.set(qx,h+.8,qz);world.add(lv);}}
        else if(steel&&rk==='d'){for(let k=0;k<3;k++)geo('metal').cyl(cx,h+.7,p.z0+.35+k*(d-.7)/2,.32,w-.4,'x',10,true);geo('metalDark').box(p.x0+.15,h+.5,cz,.3,1,d);geo('metalDark').box(p.x1+.85,h+.5,cz,.3,1,d);}
        else if(steel&&rk==='e'){const m=Math.min(w,d),n=Math.max(1,Math.round((long?w:d)/m)),R=m*.48;for(let k=0;k<n;k++){const qx=long?p.x0+(k+.5)*w/n:cx,qz=long?cz:p.z0+(k+.5)*d/n;
          geo('rust').cyl(qx,h+.9,qz,R,1.8,'y',14);geo('metalDark').cyl(qx,h+.12,qz,R+.03,.24,'y',14);const t=new THREE.Mesh(new THREE.CircleGeometry(R-.12,16),MAT.lava);t.rotation.x=-Math.PI/2;t.position.set(qx,h+1.75,qz);world.add(t);}}
        else{const R=Math.min(w,d)*.47;geo(rk==='j'&&w>=3?'green':'rust').cyl(cx,h+R+.05,cz,R,(long?w:d)-.1,long?'x':'z',12,true);geo('metalDark').cyl(cx,h+R*2+.6,cz,.12,1.2,'y',6);}
        break;}
      case '0':geo('woodDark').box(cx,h+1,cz,w-.05,2,d-.05);for(let k=0;k<3;k++)geo('wood').box(cx,h+.45+k*.6,cz,w-.1,.04,d-.02);break;
    }});
  lamps.forEach(([x,y,z])=>geo('lampGlow').box(x,y,z,.4,.06,.22));
  COLREC=false;
}

/* ---------- porte, finestre, armi a muro, distributori ---------- */
/* porte vere: telaio di ferro, uno o due battenti di lamiera verniciata (pannello, oblò col vetro retinato, piastra in basso,
   maniglione, cerniere). Quando si comprano si aprono girando sui cardini verso la zona nuova e restano aperte.
   Prima erano una lastra arrugginita (sembrava terra) che spariva nel soffitto. I cancelli a sbarre scorrono ancora di lato. */
const DOOR_PAINT={prigione:0x52645b,acciaieria:0x3f4d58,rocca:0x46605f};
let doorPaintMat=null;
function doorPaint(){if(doorPaintMat)return doorPaintMat;const col=new THREE.Color(DOOR_PAINT[M.id]||0x52645b);
  const t=textTex(256,256,(c,w,h)=>{const r=mulberry32(5);c.fillStyle='#'+col.getHexString();c.fillRect(0,0,w,h);
    for(let k=0;k<1400;k++){const v=r();c.fillStyle=v<.5?`rgba(0,0,0,${.03+r()*.05})`:`rgba(255,255,255,${.02+r()*.04})`;c.fillRect(r()*w,r()*h,1+r()*3,1+r()*3);}/* vernice a buccia d'arancia */
    for(let k=0;k<26;k++){c.strokeStyle=`rgba(${200+r()*40},${190+r()*40},${170+r()*40},${.12+r()*.2})`;c.lineWidth=.6+r();c.beginPath();const x=r()*w,y=r()*h;c.moveTo(x,y);c.lineTo(x+(r()-.5)*40,y+(r()-.5)*14);c.stroke();}/* graffi */
    for(let k=0;k<7;k++){const x=r()*w,y=r()*h,R=3+r()*9,g=c.createRadialGradient(x,y,0,x,y,R);g.addColorStop(0,'rgba(92,48,22,.55)');g.addColorStop(1,'rgba(92,48,22,0)');c.fillStyle=g;c.fillRect(x-R,y-R,R*2,R*2);}/* puntini di ruggine */
    for(let k=0;k<5;k++){const x=r()*w,g=c.createLinearGradient(0,0,0,h);g.addColorStop(0,'rgba(40,30,20,0)');g.addColorStop(1,`rgba(40,30,20,${.1+r()*.12})`);c.fillStyle=g;c.fillRect(x,0,2+r()*5,h);}});/* colature */
  t.wrapS=t.wrapT=THREE.RepeatWrapping;doorPaintMat=SHINY(0xffffff,.22,26,t);return doorPaintMat;}
function doorLeaf(lw,dir,win,bar){const P=new Geo(),D=new Geo(),x=v=>dir*v,cx=x(lw/2);
  P.box(cx,1.22,0,lw-.02,2.38,.055);/* lamiera */
  for(const f of [-1,1]){const z=f*.033;
    P.box(cx,.78,z,lw-.26,.82,.012);D.box(cx,.37,z*1.02,lw-.26,.03,.006);D.box(cx,1.19,z*1.02,lw-.26,.03,.006);/* pannello basso con le battute */
    D.box(cx,.15,z,lw-.04,.26,.01);/* piastra contro i calci */
    if(win){const ww=Math.min(.5,lw*.55);D.box(cx,1.72,z,ww+.08,.66,.012);D.box(cx,1.72,f*.036,ww,.56,.006);}/* oblò: cornice e vetro retinato scuro */
    else P.box(cx,1.75,z,lw-.26,.7,.012);
    if(bar){D.box(x(lw*.55),1.02,f*.09,lw*.75,.045,.045);for(const k of [.2,.9])D.box(x(lw*k),1.02,f*.06,.04,.04,.06);}/* maniglione antipanico */
    else{D.box(x(lw-.12),1.04,f*.07,.04,.04,.08);D.box(x(lw-.18),1.04,f*.1,.14,.035,.035);D.box(x(lw-.12),1.04,f*.04,.07,.16,.012);}}/* maniglia a leva con placca */
  for(const y of [.3,1.2,2.1])D.cyl(0,y,0,.028,.14,'y',6);/* cerniere */
  const p=new THREE.Group();p.add(P.mesh(doorPaint()));p.add(D.mesh(MAT.metalDark));p.children.forEach(m=>m.matrixAutoUpdate=true);return p;}
function buildDoors(){
  DOORS.forEach(d=>{const W=d.w;const g=new THREE.Group();g.position.set(d.cx,d.h,d.cz);if(d.alongX)g.rotation.y=Math.PI/2;world.add(g);d.gr=g;d.leaves=[];
    if(d.kind==='debris'){const r=mulberry32(d.cx*31+d.cz*7|0),G=new Geo(),D=new Geo(),T=new Geo();
      for(let k=0;k<W*3.2;k++){const x=(r()-.5)*(W-.4),y=r()*1.6,s=.35+r()*.5,a=r()*3;if(r()<.55)(r()<.5?G:D).box(x,y+s/2,(r()-.5)*.6,s*1.4,s,s,a);else T.cyl(x,y+.25,(r()-.5)*.5,.28,.5,'y',8,true);}
      for(let k=0;k<W;k++){const x=(r()-.5)*W,y=.3+r()*1.8;D.box(x,y,(r()-.5)*.5,2.4+r(),.06,.25,r()*3);}/* assi messe di traverso */
      const g0=new THREE.Group();g0.add(G.mesh(MAT.wood));g0.add(D.mesh(MAT.woodDark));g0.add(T.mesh(MAT.rust));g0.children.forEach(m=>m.matrixAutoUpdate=true);g.add(g0);d.mesh=g0;}
    else if(d.kind==='gate'&&ogg(W>2.4?'cancello3':'cancello2')){const mg=oggMesh(W>2.4?'cancello3':'cancello2');mg.scale.x=W/(W>2.4?3:2);mg.matrixAutoUpdate=true;g.add(mg);d.mesh=mg;}/* cancello Meshy: scorre intero */
    else if(d.kind==='gate'){const G=new Geo();G.box(0,1.22,0,W,.08,.08);G.box(0,2.4,0,W,.1,.1);G.box(0,.08,0,W,.08,.08);for(let x=-W/2+.1;x<=W/2-.05;x+=.16)G.cyl(x,1.24,0,.022,2.34,'y',5);G.box(-W/2+.04,1.24,0,.08,2.4,.1);G.box(W/2-.04,1.24,0,.08,2.4,.1);
      const m=G.mesh(MAT.bars);m.matrixAutoUpdate=true;g.add(m);d.mesh=m;}
    else{const F=new Geo();for(const s of [-1,1])F.box(s*(W/2-.03),1.25,0,.06,2.5,1);F.box(0,2.46,0,W,.08,1);/* telaio */
      g.add(F.mesh(MAT.metalDark));
      // verso dove si apre: verso la zona che viene dopo (lettera più avanti), uguale per tutti online
      const side=s=>{const wx=d.cx+(d.alongX?s*1.1:0),wz=d.cz+(d.alongX?0:s*1.1);if(!inb(Math.floor(wx),Math.floor(wz)))return -1;return region[cellAt(Math.floor(wx),Math.floor(wz),d.h+.1)];};
      const sw=side(1)>side(-1)?1:-1,two=W>=1.6,lw=two?(W-.12)/2:W-.12;
      const DM=ogg(W>2.4?'porta3':'porta2');
      if(DM){/* porta blindata Meshy: telaio fermo, due battenti che girano sui cardini (stessa posa di prima) */
        const sx=(W/2)/DM.hingeR,fr=oggMesh(W>2.4?'porta3':'porta2');fr.scale.x=sx;g.add(fr);
        for(const [part,hx,s] of [['leafL',DM.hingeL,-sw],['leafR',DM.hingeR,sw]]){const pv=new THREE.Group();pv.position.x=hx*sx;const lf=oggMesh(W>2.4?'porta3':'porta2',part);lf.scale.x=sx;lf.position.x=-hx*sx;pv.add(lf);g.add(pv);d.leaves.push({p:pv,s});}
        d.mesh=d.leaves[0].p;}
      else{
      const L=doorLeaf(lw,1,true,two);L.position.x=-W/2+.06;g.add(L);d.leaves.push({p:L,s:-sw});
      if(two){const R=doorLeaf(lw,-1,true,true);R.position.x=W/2-.06;g.add(R);d.leaves.push({p:R,s:sw});}
      d.mesh=L;}}
    const sign=textTex(128,64,(c,w,h)=>{c.fillStyle='rgba(18,16,14,.9)';c.fillRect(6,8,w-12,h-16);c.strokeStyle='rgba(233,227,209,.5)';c.lineWidth=2;c.strokeRect(10,12,w-20,h-24);
      c.fillStyle='#e9e3d1';c.font='bold 30px "Barlow Condensed", sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText(String(d.cost),w/2,h/2+1);});
    const S=new Geo();S.quad([-.28,1.1,.1],[.28,1.1,.1],[.28,1.34,.1],[-.28,1.34,.1],[[0,0],[1,0],[1,1],[0,1]]);S.quad([.28,1.1,-.1],[-.28,1.1,-.1],[-.28,1.34,-.1],[.28,1.34,-.1],[[0,0],[1,0],[1,1],[0,1]]);
    const sp=S.mesh(new THREE.MeshBasicMaterial({map:sign,transparent:true}));sp.matrixAutoUpdate=true;if(d.kind==='debris'){sp.scale.z=6.6;sp.position.y=.35;}g.add(sp);d.sign=sp;/* sui rottami: cartello davanti al cumulo */doorPose(d);});
}
// aspetto della porta secondo d.open e d.anim (0 chiusa → 1 aperta): la usano apertura, ripartenza, eventi e online
function doorPose(d){const a=d.open?d.anim:0;if(d.sign)d.sign.visible=!d.open;
  if(d.kind==='gate'){d.gr.visible=!(d.open&&d.anim>=1);d.mesh.position.x=a*(d.w+.1);return;}
  if(d.kind==='debris'){d.gr.visible=!(d.open&&d.anim>=1);d.mesh.position.y=-a*a*2.8;d.mesh.rotation.z=a*.15;return;}/* crolla e affonda */
  d.gr.visible=true;const e=1-Math.pow(1-a,3);d.leaves.forEach(L=>L.p.rotation.y=L.s*e*1.62);}
const BOARD_Y=[1.02,1.24,1.46,1.68,1.9,2.12];
const ZERO_M=new THREE.Matrix4().makeScale(0,0,0);
function buildWindows(){
  const AS=ogg('asse'),FW=ogg('finestra');let bg=boardGeo;
  if(AS){if(!AS.geoC){AS.geoC=AS.geo.main.clone();AS.geoC.translate(0,-(AS.box[1]+AS.box[4])/2,0);}bg=AS.geoC;}/* asse Meshy centrata come quella di prima */
  boardIM=new THREE.InstancedMesh(bg,AS?AS.mat:MAT.wood,Math.max(1,WINDOWS.length*6));boardMats=[];
  if(FW)WINDOWS.forEach(w=>{const f=oggMesh('finestra');f.scale.x=w.w/2;f.position.set(w.cx,w.h+.77,w.cz);f.rotation.y=w.nx?Math.PI/2:0;world.add(f);});/* telaio rotto nel vano */
  const e=new THREE.Euler(),q=new THREE.Quaternion(),s=new THREE.Vector3(1,1,1),p=new THREE.Vector3();
  WINDOWS.forEach(w=>{geo('tiles2').box(w.cx-w.nx*.36,w.h+.45,w.cz-w.nz*.36,w.nx?.28:w.w,.9,w.nz?.28:w.w);
    for(let k=0;k<6;k++){e.set(0,w.nx?Math.PI/2:0,rand(-.13,.13),'YXZ');q.setFromEuler(e);p.set(w.cx-w.nx*.53+(w.nz?rand(-.08,.08):0),w.h+BOARD_Y[k],w.cz-w.nz*.53+(w.nx?rand(-.08,.08):0));
      const M4=new THREE.Matrix4().compose(p,q,s);boardMats.push(M4);boardIM.setMatrixAt(w.i*6+k,M4);}});
  boardIM.frustumCulled=false;world.add(boardIM);
}
function setBoard(w,k,on){boardIM.setMatrixAt(w.i*6+k,on?boardMats[w.i*6+k]:ZERO_M);boardIM.instanceMatrix.needsUpdate=true;}
function buildWallbuys(){
  WALLBUYS.forEach(b=>{const d=WEAPONS[b.w];
    const t=textTex(256,128,(c,w,h)=>{c.strokeStyle='rgba(233,227,209,.9)';c.lineWidth=3;c.lineJoin='round';
      c.beginPath();c.moveTo(40,52);c.lineTo(200,52);c.lineTo(214,58);c.lineTo(200,64);c.lineTo(120,64);c.lineTo(112,84);c.lineTo(98,84);c.lineTo(100,64);c.lineTo(66,66);c.lineTo(40,78);c.closePath();c.stroke();
      c.fillStyle='rgba(233,227,209,.95)';c.font='26px "Special Elite", monospace';c.textAlign='center';c.fillText(d.name,w/2,28);c.font='bold 26px "Barlow Condensed", sans-serif';c.fillText(`${d.cost} · munizioni ${d.ammo}`,w/2,114);});
    const h=hAt(b.x,b.z,b.y);const p=new THREE.Mesh(new THREE.PlaneGeometry(1.9,.95),new THREE.MeshBasicMaterial({map:t,transparent:true}));
    p.position.set(b.x+b.face[0]*.48,h+1.6,b.z+b.face[1]*.48);p.rotation.y=yawFromFace(b.face);world.add(p);});
}
function buildPerks(){
  PERKS.forEach(pk=>{const cx=pk.cell[0]+.5,cz=pk.cell[1]+.5,h=cellH[ix(pk.cell[0],pk.cell[1],pk.l)];
    const g=new THREE.Group();g.position.set(cx+pk.face[0]*.15,h,cz+pk.face[1]*.15);g.rotation.y=yawFromFace(pk.face);world.add(g);
    const MP=ogg(OGG_PERK[pk.id]);
    if(MP){g.add(oggMesh(OGG_PERK[pk.id]));/* bibita Meshy: sopra un'insegna col nome che si accende con la corrente */
      const t=textTex(256,80,(c,w,hh)=>{c.fillStyle='#120e0a';c.fillRect(0,0,w,hh);c.strokeStyle=pk.css;c.lineWidth=6;c.strokeRect(4,4,w-8,hh-8);c.fillStyle=pk.css;c.font='34px "Special Elite", monospace';c.textAlign='center';c.textBaseline='middle';
        c.fillText(pk.name.toUpperCase(),w/2,30,w-20);c.fillStyle='#f1ead8';c.font='bold 26px "Barlow Condensed", sans-serif';c.fillText(String(pk.cost),w/2,62);});
      pk.onMat=new THREE.MeshBasicMaterial({map:t});pk.offMat=LM({map:t,color:0x4a4a4a});const fz=MP.box[5];
      pk.panel=new THREE.Mesh(new THREE.PlaneGeometry(.9,.28),pk.offMat);pk.panel.position.set(0,2.22,fz*.6);g.add(pk.panel);
      const bk=new THREE.Mesh(new THREE.BoxGeometry(.94,.32,.06),MAT.metalDark);bk.position.set(0,2.22,fz*.6-.035);g.add(bk);
      pk.bulbMat=new THREE.MeshBasicMaterial({color:0x222222});const lb=new THREE.Mesh(new THREE.BoxGeometry(.86,.035,.04),pk.bulbMat);lb.position.set(0,2.06,fz*.6+.01);g.add(lb);
      colBox(cx+pk.face[0]*.15,h+1.025,cz+pk.face[1]*.15,.95,2.05,.75,yawFromFace(pk.face));pk.x=cx-pk.face[0]*.9;pk.z=cz-pk.face[1]*.9;pk.h=h;return;}
    const body=new THREE.Mesh(new THREE.BoxGeometry(.95,2.05,.75),LM({color:new THREE.Color(pk.color).multiplyScalar(.42)}));body.position.y=1.025;g.add(body);
    const t=textTex(128,192,(c,w,hh)=>{c.fillStyle=pk.css;c.fillRect(0,0,w,hh);c.fillStyle='rgba(0,0,0,.25)';for(let y=0;y<hh;y+=12)c.fillRect(0,y,w,5);
      c.fillStyle='#120e0a';c.fillRect(8,40,w-16,70);c.fillStyle='#f1ead8';c.font='24px "Special Elite", monospace';c.textAlign='center';
      const words=pk.name.split(' ');words.forEach((s,i)=>c.fillText(s,w/2,72+i*26-(words.length-1)*13));c.font='bold 30px "Barlow Condensed", sans-serif';c.fillStyle='#120e0a';c.fillText(String(pk.cost),w/2,160);});
    pk.onMat=new THREE.MeshBasicMaterial({map:t});pk.offMat=LM({map:t,color:0x3a3a3a});
    pk.panel=new THREE.Mesh(new THREE.PlaneGeometry(.8,1.5),pk.offMat);pk.panel.position.set(0,1.15,.38);g.add(pk.panel);
    pk.bulbMat=new THREE.MeshBasicMaterial({color:0x222222});const lb=new THREE.Mesh(new THREE.BoxGeometry(.7,.1,.1),pk.bulbMat);lb.position.set(0,1.98,.36);g.add(lb);
    colBox(cx+pk.face[0]*.15,h+1.025,cz+pk.face[1]*.15,.95,2.05,.75,yawFromFace(pk.face));pk.x=cx-pk.face[0]*.9;pk.z=cz-pk.face[1]*.9;pk.h=h;});
}

/* ---------- cassa misteriosa ---------- */
const BOX_COST=950;
function buildBox(){
  Box={state:'idle',t:0,weapon:null,show:null,swapT:0,spot:-1,uses:0,moveAfter:5,y0:0};
  const g=new THREE.Group();world.add(g);
  const q=textTex(64,64,(c,w,hh)=>{c.fillStyle='#5d4128';c.fillRect(0,0,w,hh);c.fillStyle='#d8cfb4';c.font='bold 46px "Special Elite", monospace';c.textAlign='center';c.textBaseline='middle';c.fillText('?',w/2,hh/2+2);});
  const CM=ogg('cassa');const pivot=new THREE.Group();g.add(pivot);
  if(CM){g.add(oggMesh('cassa'));const H=CM.hinge;pivot.position.set(0,H[1],H[2]);const lid=oggMesh('cassa','lid');lid.position.set(0,-H[1],-H[2]);pivot.add(lid);}/* cassa Meshy col suo coperchio */
  else{const b=new THREE.Mesh(new THREE.BoxGeometry(1.8,.78,.82),LM({map:q}));b.position.y=.39;g.add(b);
    pivot.position.set(0,.78,-.41);const lid=new THREE.Mesh(new THREE.BoxGeometry(1.84,.12,.84),MAT.woodDark);lid.position.set(0,.06,.42);pivot.add(lid);}
  const bm=new THREE.Mesh(new THREE.CylinderGeometry(.55,1.2,70,12,1,true),new THREE.MeshBasicMaterial({color:0xa8c8ff,transparent:true,opacity:.3,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide,fog:false}));bm.position.set(0,35.8,0);g.add(bm);
  const doll=new THREE.Group();const dm=LM({color:0x7a5a3a}),dd=LM({color:0x2a1d12});
  const db=new THREE.Mesh(new THREE.BoxGeometry(.22,.3,.14),dm);doll.add(db);const dh=new THREE.Mesh(new THREE.SphereGeometry(.12,10,8),dm);dh.position.y=.26;doll.add(dh);
  for(const s of[-1,1]){const a=new THREE.Mesh(new THREE.BoxGeometry(.07,.24,.07),dm);a.position.set(s*.16,.02,0);a.rotation.z=s*.5;doll.add(a);const l=new THREE.Mesh(new THREE.BoxGeometry(.08,.22,.08),dm);l.position.set(s*.06,-.24,0);doll.add(l);
    const e=new THREE.Mesh(new THREE.BoxGeometry(.035,.035,.02),dd);e.position.set(s*.045,.29,.11);doll.add(e);}
  doll.scale.setScalar(1.6);doll.visible=false;g.add(doll);
  Box.g=g;Box.lid=pivot;Box.beam=bm;Box.doll=doll;Box.models={};
  // segnaposti delle altre posizioni della cassa: un bancale con un punto interrogativo sbiadito
  const qm=textTex(64,64,(c,w,hh)=>{c.clearRect(0,0,w,hh);c.fillStyle='rgba(216,207,180,.55)';c.font='bold 50px "Special Elite", monospace';c.textAlign='center';c.textBaseline='middle';c.fillText('?',w/2,hh/2+2);});
  Box.markers=BOX_SPOTS.map(s=>{const mg=new THREE.Group();const cx=s.cells.reduce((a,c)=>a+c[0]+.5,0)/2,cz=s.cells.reduce((a,c)=>a+c[1]+.5,0)/2,h=cellH[ix(s.cells[0][0],s.cells[0][1],s.l||0)];
    mg.position.set(cx+s.face[0]*.12,h,cz+s.face[1]*.12);mg.rotation.y=yawFromFace(s.face);
    if(ogg('bancale'))mg.add(oggMesh('bancale'));
    else{for(let k=0;k<3;k++){const pl=new THREE.Mesh(new THREE.BoxGeometry(1.8,.05,.18),MAT.wood);pl.position.set(0,.13,-.3+k*.3);mg.add(pl);}
      for(const sx of[-.8,0,.8]){const bl=new THREE.Mesh(new THREE.BoxGeometry(.14,.1,.8),MAT.woodDark);bl.position.set(sx,.05,0);mg.add(bl);}}
    const sg=new THREE.Mesh(new THREE.PlaneGeometry(.5,.5),new THREE.MeshBasicMaterial({map:qm,transparent:true,depthWrite:false}));sg.position.set(0,1.4,-.4);mg.add(sg);world.add(mg);return mg;});
  Object.keys(WEAPONS).concat(['carillon']).forEach(k=>{const m=gunModel(k==='carillon'?'carillon':WEAPONS[k].model,false);m.scale.setScalar(1.7);m.rotation.y=Math.PI/2;m.visible=false;g.add(m);m.position.set(0,.9,0);Box.models[k]=m;});
}
function placeBox(si){
  if(Box.spot>=0){const o=BOX_SPOTS[Box.spot];o.cells.forEach(([x,z])=>{const i=ix(x,z,o.l||0);kind[i]=K.FLOOR;propCh[i]='';});}
  Box.spot=si;if(Box.markers)Box.markers.forEach((m,i)=>m.visible=i!==si);const s=BOX_SPOTS[si];s.cells.forEach(([x,z])=>{const i=ix(x,z,s.l||0);kind[i]=K.PROP;propCh[i]='*';});
  const cx=s.cells.reduce((a,c)=>a+c[0]+.5,0)/2,cz=s.cells.reduce((a,c)=>a+c[1]+.5,0)/2,h=cellH[ix(s.cells[0][0],s.cells[0][1],s.l||0)];
  Box.cx=cx+s.face[0]*.12;Box.cz=cz+s.face[1]*.12;Box.h=h;Box.y0=h;Box.g.position.set(Box.cx,h,Box.cz);Box.g.rotation.y=yawFromFace(s.face);
  Box.ix=cx-s.face[0]*1.25;Box.iz=cz-s.face[1]*1.25;Box.uses=0;Box.moveAfter=4+((Math.random()*4)|0);Box.g.visible=true;
}

/* ---------- corrente, Forgia, missione, nastri ---------- */
function buildPower(){
  const P0=M.power;const h=hAt(P0.x,P0.z,P0.y);Power={on:false};
  const g=new THREE.Group();g.position.set(P0.x+P0.face[0]*.47,h+1.35,P0.z+P0.face[1]*.47);g.rotation.y=yawFromFace(P0.face);world.add(g);
  const PM=ogg('corrente');
  if(PM){/* quadro Meshy appoggiato al muro, con la sua leva che scatta in su */
    const b=oggMesh('corrente');b.position.set(0,-.5,-.03);g.add(b);const H=PM.hinge;const lp=new THREE.Group();lp.position.set(0,-.5+H[1],-.03+H[2]);g.add(lp);
    const lv=oggMesh('corrente','lever');lv.position.set(0,-H[1],-H[2]);lp.add(lv);
    Power.lamp=new THREE.MeshBasicMaterial({color:0xa8261c});const lm=new THREE.Mesh(new THREE.BoxGeometry(.1,.1,.03),Power.lamp);lm.position.set(0,-.5+1.06,-.03+PM.front+.01);g.add(lm);
    Power.lever=lp;Power.lvOff=0;Power.lvOn=-2.3;Power.x=P0.x-P0.face[0]*.6;Power.z=P0.z-P0.face[1]*.6;Power.h=h;return;}
  g.add(new THREE.Mesh(new THREE.BoxGeometry(.7,.95,.12),MAT.metal));
  Power.lamp=new THREE.MeshBasicMaterial({color:0xa8261c});const lm=new THREE.Mesh(new THREE.BoxGeometry(.12,.12,.06),Power.lamp);lm.position.set(.22,.36,.08);g.add(lm);
  const lp=new THREE.Group();lp.position.set(0,0,.08);g.add(lp);const s1=new THREE.Mesh(new THREE.BoxGeometry(.07,.5,.07),MAT.metalDark);s1.position.set(0,.22,.04);lp.add(s1);
  const s2=new THREE.Mesh(new THREE.BoxGeometry(.14,.1,.14),MAT.rayBody);s2.position.set(0,.48,.04);lp.add(s2);lp.rotation.x=-.5;
  Power.lever=lp;Power.x=P0.x-P0.face[0]*.6;Power.z=P0.z-P0.face[1]*.6;Power.h=h;
}
function buildForge(){
  const F=M.forge;const cx=F.cells.reduce((a,c)=>a+c[0]+.5,0)/2+F.face[0]*.12,cz=F.cells.reduce((a,c)=>a+c[1]+.5,0)/2+F.face[1]*.12,h=cellH[ix(F.cells[0][0],F.cells[0][1],F.l||0)];
  Forge={unlocked:false,t:0,w:null};const g=new THREE.Group();g.position.set(cx,h,cz);g.rotation.y=yawFromFace(F.face);world.add(g);const iron=LM({color:0x2a2724});
  const FM=ogg('forgia');
  if(FM){g.add(oggMesh('forgia'));const fz=FM.box[5];/* Forgia Meshy: la bocca si accende (bagliore che si somma), catene finché è chiusa */
    Forge.glowMat=new THREE.MeshBasicMaterial({color:0x2a1408,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false});const mouth=new THREE.Mesh(new THREE.PlaneGeometry(.8,.45),Forge.glowMat);mouth.position.set(0,.5,fz+.01);g.add(mouth);
    const chains=new THREE.Group();for(const s of[-1,1])for(let k=0;k<9;k++){const l=new THREE.Mesh(new THREE.TorusGeometry(.05,.013,4,8),MAT.metalDark);l.position.set(s*.9-s*k*.2,.15+k*.12,fz+.03);l.rotation.y=k%2?Math.PI/2:0;l.rotation.z=s*.9;chains.add(l);}
    {const ry=yawFromFace(F.face),f=FM.foot,ox=(f[0]+f[2])/2,oz=(f[1]+f[3])/2,c=Math.cos(ry),s=Math.sin(ry);/* sagoma = base vera del modello */
      colBox(cx+ox*c+oz*s,h+.6,cz-ox*s+oz*c,f[2]-f[0],1.2,f[3]-f[1],ry);}
    g.add(chains);Forge.chains=chains;Forge.g=g;Forge.x=cx-F.face[0]*1.3;Forge.z=cz-F.face[1]*1.3;Forge.h=h;return;}
  const base=new THREE.Mesh(new THREE.BoxGeometry(1.9,1.05,.95),iron);base.position.y=.52;g.add(base);const top=new THREE.Mesh(new THREE.BoxGeometry(1.5,.22,.7),MAT.metal);top.position.y=1.16;g.add(top);
  const horn=new THREE.Mesh(new THREE.ConeGeometry(.16,.55,8),MAT.metal);horn.rotation.z=Math.PI/2;horn.position.set(-1,1.16,0);g.add(horn);
  const chim=new THREE.Mesh(new THREE.CylinderGeometry(.14,.18,1.3,8),iron);chim.position.set(.62,1.7,-.2);g.add(chim);
  Forge.glowMat=new THREE.MeshBasicMaterial({color:0x2a1408});const mouth=new THREE.Mesh(new THREE.PlaneGeometry(.9,.42),Forge.glowMat);mouth.position.set(0,.55,.48);g.add(mouth);
  const sign=textTex(256,64,(c,w,hh)=>{c.fillStyle='#16110c';c.fillRect(0,0,w,hh);c.fillStyle='#d8a050';c.font='34px "Special Elite", monospace';c.textAlign='center';c.textBaseline='middle';c.fillText('LA FORGIA',w/2,hh/2+2);});
  const sg=new THREE.Mesh(new THREE.PlaneGeometry(1.2,.3),new THREE.MeshBasicMaterial({map:sign}));sg.position.set(0,.93,.48);g.add(sg);
  const chains=new THREE.Group();for(const s of[-1,1])for(let k=0;k<9;k++){const l=new THREE.Mesh(new THREE.TorusGeometry(.05,.013,4,8),MAT.metalDark);l.position.set(s*.9-s*k*.2,.15+k*.12,.5);l.rotation.y=k%2?Math.PI/2:0;l.rotation.z=s*.9;chains.add(l);}
  {const ry=yawFromFace(F.face);colBox(cx,h+.52,cz,1.9,1.05,.95,ry);colBox(cx,h+1.16,cz,1.5,.22,.7,ry);}
  g.add(chains);Forge.chains=chains;Forge.g=g;Forge.x=cx-F.face[0]*1.3;Forge.z=cz-F.face[1]*1.3;Forge.h=h;
}
let Q={},Q2=null;
function buildQuest(){
  Q2=null;
  Q={keys:0,valves:0,feed:0,lit:false,valveHold:0};KEYOBJ=[];VALVES=[];Furn=Furn&&M.id==='acciaieria'?Furn:null;
  if(M.quest==='keys'&&M.keyItem){/* fusibili: cilindro di vetro acceso con i cappucci di metallo */
    M.keys.forEach(k0=>{const k={...k0,got:false};const g=new THREE.Group();const core=new THREE.Mesh(new THREE.CylinderGeometry(.045,.045,.2,10),new THREE.MeshBasicMaterial({color:0xffb24a}));core.rotation.z=Math.PI/2;g.add(core);
      for(const s of[-1,1]){const cap=new THREE.Mesh(new THREE.CylinderGeometry(.055,.055,.05,10),MAT.metal);cap.rotation.z=Math.PI/2;cap.position.x=s*.12;g.add(cap);}
      const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex,color:0xffb050,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false}));sp.scale.setScalar(.5);g.add(sp);
      k.h=hAt(k.x,k.z,9);g.position.set(k.x,k.h+k.dy,k.z);world.add(g);k.g=g;KEYOBJ.push(k);});
  }else if(M.quest==='keys'){
    const km=new THREE.MeshBasicMaterial({color:0xffc857});
    const halo=textTex(64,64,(c)=>{const gr=c.createRadialGradient(32,32,0,32,32,32);gr.addColorStop(0,'rgba(255,200,90,.8)');gr.addColorStop(1,'rgba(255,160,40,0)');c.fillStyle=gr;c.fillRect(0,0,64,64);});
    M.keys.forEach(k0=>{const k={...k0,got:false};const g=new THREE.Group();const ring=new THREE.Mesh(new THREE.TorusGeometry(.055,.014,6,14),km);ring.position.x=-.1;g.add(ring);
      const sh=new THREE.Mesh(new THREE.BoxGeometry(.18,.022,.022),km);sh.position.x=.03;g.add(sh);for(const o of[.07,.11]){const tth=new THREE.Mesh(new THREE.BoxGeometry(.02,.045,.02),km);tth.position.set(o,-.03,0);g.add(tth);}
      const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:halo,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false}));sp.scale.setScalar(.6);g.add(sp);
      k.h=hAt(k.x,k.z);g.position.set(k.x,k.h+k.dy,k.z);world.add(g);k.g=g;KEYOBJ.push(k);});
  }else if(M.valves){
    M.valves.forEach(v0=>{const v={...v0,done:false,t:0};const h=hAt(v.x,v.z);v.h=h;const g=new THREE.Group();g.position.set(v.x+v.face[0]*.44,h+1.3,v.z+v.face[1]*.44);g.rotation.y=yawFromFace(v.face);world.add(g);
      const pipe=new THREE.Mesh(new THREE.CylinderGeometry(.09,.09,2.6,8),MAT.rust);pipe.position.y=-.1;g.add(pipe);
      const wheel=new THREE.Group();wheel.position.z=.18;g.add(wheel);const rim=new THREE.Mesh(new THREE.TorusGeometry(.22,.03,6,16),LM({color:0x9a2a1a}));wheel.add(rim);
      for(let k=0;k<3;k++){const sp=new THREE.Mesh(new THREE.BoxGeometry(.42,.03,.03),rim.material);sp.rotation.z=k*Math.PI/3;wheel.add(sp);}
      const stem=new THREE.Mesh(new THREE.CylinderGeometry(.03,.03,.2,6),MAT.metal);stem.rotation.x=Math.PI/2;stem.position.z=.09;g.add(stem);
      v.wheel=wheel;v.g=g;VALVES.push(v);});
  }
  if(M.egg2){const E2=M.egg2;Q2={step:0,lamps:[],held:0,dropped:0,deposited:0,event:false,eventT:0,eventKills:0,done:false,elixir:null};
    E2.lamps.forEach(([x,y,z,fx,fz])=>{const g=new THREE.Group();g.position.set(x,y,z);g.rotation.y=yawFromFace([-fx,-fz]);world.add(g);
      const br=new THREE.Mesh(new THREE.BoxGeometry(.3,.3,.12),MAT.metalDark);br.position.z=-.04;g.add(br);
      const mat=new THREE.MeshBasicMaterial({color:0x2a0808});const s=new THREE.Mesh(new THREE.SphereGeometry(.17,10,8),mat);s.position.z=.1;g.add(s);Q2.lamps.push({g,s,mat,shot:false});});
    const C=E2.crucible;const lv=new THREE.Mesh(new THREE.BoxGeometry(.18,.9,.18),LM({color:0x9a2a1a}));lv.position.set(C.ix+1.2,hAt(C.ix,C.iz)+.45,C.iz-.3);world.add(lv);Q2.lever=lv;
    const el=new THREE.Group();const b=new THREE.Mesh(new THREE.CylinderGeometry(.09,.11,.3,10),new THREE.MeshBasicMaterial({color:0xff7a2a}));el.add(b);
    const nk=new THREE.Mesh(new THREE.CylinderGeometry(.035,.05,.12,8),MAT.metal);nk.position.y=.2;el.add(nk);el.position.set(C.ix,hAt(C.ix,C.iz)+1.1,C.iz-.4);el.visible=false;world.add(el);Q2.elixir=el;}
}
function buildRecorders(){
  RECS=[];(M.recorders||[]).forEach(r0=>{const r={...r0};r.h=hAt(r.x,r.z);const g=new THREE.Group();g.position.set(r.x,r.h+r.dy,r.z);g.rotation.y=rand(0,6);world.add(g);
    const b=new THREE.Mesh(new THREE.BoxGeometry(.34,.12,.24),LM({color:0x4a4034}));b.position.y=.06;g.add(b);
    for(const s of[-1,1]){const reel=new THREE.Mesh(new THREE.CylinderGeometry(.06,.06,.02,12),MAT.metalDark);reel.position.set(s*.08,.13,0);g.add(reel);}
    r.led=new THREE.MeshBasicMaterial({color:0xff2a1a});const l=new THREE.Mesh(new THREE.BoxGeometry(.025,.025,.01),r.led);l.position.set(.13,.09,.125);g.add(l);r.g=g;RECS.push(r);});
}

/* ---------- scritte col sangue ---------- */
let WRIT=[];const FACEV={N:[0,-1],S:[0,1],E:[1,0],W:[-1,0]};
function buildWritings(){
  WRIT=[];(M.writings||[]).forEach(w=>{const [x,z,d]=w.c;const f=FACEV[d];let lines=w.t?w.t.split('|'):null;
    /* la scritta sta sul muro vero: si misura quanto è largo (celle di fila con il muro davanti) e se è stretto si va a capo.
       Prima era sempre larga 2,6 m e sui pilastri finiva in aria davanti alle sbarre */
    const l=w.c[3]||0,tx=f[1]?1:0,tz=f[0]?1:0,face=(a,b)=>inb(a,b)&&inb(a+f[0],b+f[1])&&kind[ix(a,b,l)]!==K.WALL&&kind[ix(a+f[0],b+f[1],l)]===K.WALL;/* (x,z) è la cella davanti al muro, f punta verso il muro */
    let lo=0,hi=0;while(lo<3&&face(x-tx*(lo+1),z-tz*(lo+1)))lo++;while(hi<3&&face(x+tx*(hi+1),z+tz*(hi+1)))hi++;
    const span=lo+hi+1,full=lines?2.6:1.6,pw=Math.min(full,span-.12);const off=clamp(0,-lo-.44+pw/2,hi+.44-pw/2);/* il più vicino possibile a dove era, ma dentro il muro */
    if(lines&&pw<full-.3){const per=Math.max(7,Math.floor(pw*8.5)),words=lines.join(' ').split(' '),out=[];let cur='';
      for(const wd of words){if(cur&&(cur+' '+wd).length>per){out.push(cur);cur=wd;}else cur=cur?cur+' '+wd:wd;}if(cur)out.push(cur);lines=out;}
    const ph=lines?Math.min(1.7,Math.max(1.3,lines.length*.36)):.8;
    const cv=document.createElement('canvas');cv.width=Math.round(256*pw/ph);cv.height=256;const tex=new THREE.CanvasTexture(cv);tex.magFilter=THREE.LinearFilter;
    const o={w,cv,tex,lines,sym:w.sym};o.draw=(order)=>{const g=cv.getContext('2d');bloodDraw(lines,lines?0:order[w.sym],['I','II','III','IV','V','VI'][w.sym])(g,cv.width,cv.height);tex.needsUpdate=true;};
    if(lines)texRegistry.push({c:cv,draw:bloodDraw(lines,0,''),t:tex});o.draw([0,1,2,3,4,5]);
    const mat=new THREE.MeshLambertMaterial({map:tex,transparent:true,depthWrite:false,emissive:0x7a0e08,emissiveMap:tex,polygonOffset:true,polygonOffsetFactor:-2});
    const m=new THREE.Mesh(new THREE.PlaneGeometry(pw,ph),mat);m.position.set(x+.5+f[0]*.485+tx*off,w.y,z+.5+f[1]*.485+tz*off);m.rotation.y=yawFromFace(f);m.rotation.z=rand(-.04,.04);world.add(m);WRIT.push(o);});
}
function redrawSymbols(order){WRIT.forEach(o=>{if(!o.lines)o.draw(order);});}

/* ---------- terzo easter egg: l'Arco di Brace e le Fondamenta ---------- */
let Q3=null;
const skullGeo=(()=>{const g=new THREE.SphereGeometry(.16,10,8);g.scale(1,.95,1.1);return g;})();
function skullMesh(glow){const g=new THREE.Group();const bone=LM({color:0xd8cfb4,emissive:0x100a04});const s=new THREE.Mesh(skullGeo,bone);g.add(s);
  const j=new THREE.Mesh(new THREE.BoxGeometry(.18,.08,.14),bone);j.position.set(0,-.14,.05);g.add(j);
  const em=new THREE.MeshBasicMaterial({color:glow?0xff3a12:0x120806});for(const sx of[-1,1]){const e=new THREE.Mesh(new THREE.SphereGeometry(.04,6,4),em);e.position.set(sx*.06,.01,.14);e.scale.z=.5;g.add(e);}
  const n=new THREE.Mesh(new THREE.ConeGeometry(.025,.05,3),new THREE.MeshBasicMaterial({color:0x120806}));n.rotation.x=Math.PI;n.position.set(0,-.06,.16);g.add(n);g.userData.eye=em;return g;}
function liftDoor(L,label){const h=hAt(L.x-L.face[0]*.5,L.z-L.face[1]*.5);const g=new THREE.Group();g.position.set(L.x,h,L.z);g.rotation.y=yawFromFace(L.face);world.add(g);
  const fr=LM({color:0x2a2724});for(const sx of[-1,1]){const p=new THREE.Mesh(new THREE.BoxGeometry(.18,2.7,.2),fr);p.position.set(sx*1.1,1.35,.02);g.add(p);}const tp=new THREE.Mesh(new THREE.BoxGeometry(2.4,.25,.22),fr);tp.position.set(0,2.75,.02);g.add(tp);
  const sh=new THREE.Group();g.add(sh);for(let k=0;k<11;k++){const sl=new THREE.Mesh(new THREE.BoxGeometry(2,.23,.05),MAT.rust);sl.position.set(0,.13+k*.235,.04);sh.add(sl);}
  const lampM=new THREE.MeshBasicMaterial({color:0x5a1a10});const lm=new THREE.Mesh(new THREE.SphereGeometry(.07,8,6),lampM);lm.position.set(1.35,1.5,.12);g.add(lm);
  const pan=new THREE.Mesh(new THREE.BoxGeometry(.3,.45,.08),MAT.metalDark);pan.position.set(1.35,1.2,.08);g.add(pan);
  const sign=textTex(256,64,(c,w,hh)=>{c.fillStyle='#16110c';c.fillRect(0,0,w,hh);c.fillStyle='#d8a050';c.font='26px "Special Elite", monospace';c.textAlign='center';c.textBaseline='middle';c.fillText(label,w/2,hh/2+2);});
  const sg=new THREE.Mesh(new THREE.PlaneGeometry(1.6,.4),new THREE.MeshBasicMaterial({map:sign}));sg.position.set(0,3.1,.14);g.add(sg);
  return {g,sh,lampM,x:L.x-L.face[0]*.8,z:L.z-L.face[1]*.8,h,face:L.face};}
function buildEgg3(){
  Q3=null;if(!M.egg3)return;const E=M.egg3;
  Q3={step:0,bells:[],ringT:0,skulls:[],held:0,placed:false,fed:0,liftOn:false,braziers:[],order:[0,1,2,3],lit:[],boss:null,heart:null,heartHeld:false,done:false,reward:null,rewardTaken:false,fadeT:0,liftCD:0,bossHp:0};
  E.bells.forEach(([x,y,z])=>{const g=new THREE.Group();g.position.set(x,y,z);world.add(g);const bm=LM({color:0x9a7a32,emissive:0x1a1206});
    const bell=new THREE.Mesh(new THREE.CylinderGeometry(.07,.19,.26,12,1,true),bm);bell.material.side=THREE.DoubleSide;bell.position.y=-.2;const top=new THREE.Mesh(new THREE.SphereGeometry(.075,8,6),bm);top.position.y=-.07;
    const sw=new THREE.Group();sw.add(bell);sw.add(top);const cl=new THREE.Mesh(new THREE.SphereGeometry(.035,6,4),MAT.metalDark);cl.position.y=-.3;sw.add(cl);g.add(sw);
    const rod=new THREE.Mesh(new THREE.BoxGeometry(.04,.04,.5),MAT.metalDark);rod.position.set(0,0,0);g.add(rod);
    const hit=new THREE.Mesh(new THREE.SphereGeometry(.3,6,4),hitMat);hit.visible=false;hit.position.y=-.18;g.add(hit);
    Q3.bells.push({g,sw,hit,rung:false,swing:0});});
  // ossario con l'arco
  const A=E.altar;const ah=hAt(A.x,A.z);const ag=new THREE.Group();ag.position.set(A.x,ah,A.z);world.add(ag);
  const st=new THREE.Mesh(new THREE.BoxGeometry(1.9,.85,.9),MAT.stone);st.position.y=.42;ag.add(st);const top=new THREE.Mesh(new THREE.BoxGeometry(2.05,.12,1.02),MAT.rock);top.position.y=.9;ag.add(top);
  for(let k=0;k<6;k++){const bn=new THREE.Mesh(new THREE.CylinderGeometry(.03,.04,.5,5),LM({color:0xcfc6aa}));bn.rotation.z=Math.PI/2;bn.rotation.y=rand(-.5,.5);bn.position.set(rand(-.8,.8),.1+rand(0,.2),rand(-.55,.55));ag.add(bn);}
  const spikes=[];for(let k=0;k<5;k++){const sp=new THREE.Mesh(new THREE.ConeGeometry(.035,.35,5),MAT.metalDark);sp.position.set(-.76+k*.38,1.13,-.25);ag.add(sp);
    const sk=skullMesh(true);sk.position.set(-.76+k*.38,1.22,-.25);sk.scale.setScalar(.85);sk.visible=false;ag.add(sk);spikes.push(sk);}
  const bow=bowModel(false);bow.rotation.set(Math.PI/2,0,Math.PI/2);bow.scale.setScalar(1.5);bow.position.set(0,1.0,.2);ag.add(bow);
  const bowGlow=new THREE.PointLight(0xff6a20,0,4,2);bowGlow.position.set(0,1.4,.2);ag.add(bowGlow);
  const bkey=new THREE.Group();const kb=LM({color:0xe8e0c8,emissive:0x221a08});const r=new THREE.Mesh(new THREE.TorusGeometry(.07,.02,6,12),kb);r.position.x=-.12;bkey.add(r);const shf=new THREE.Mesh(new THREE.CylinderGeometry(.02,.02,.24,6),kb);shf.rotation.z=Math.PI/2;shf.position.x=.05;bkey.add(shf);
  const tt=new THREE.Mesh(new THREE.BoxGeometry(.03,.06,.03),kb);tt.position.set(.14,-.04,0);bkey.add(tt);bkey.position.set(0,1.35,.2);bkey.visible=false;ag.add(bkey);
  colBox(A.x,ah+.48,A.z,2.05,.96,1.02);
  Q3.altar={g:ag,x:A.x,z:A.z,h:ah,spikes,bow,bowGlow,key:bkey};
  // teschi
  E.skulls.forEach(([x,y,z,fx,fz])=>{const g=skullMesh(true);g.position.set(x-fx*.1,y,z-fz*.1);g.rotation.y=yawFromFace([fx,fz]);world.add(g);
    const hit=new THREE.Mesh(new THREE.SphereGeometry(.3,6,4),hitMat);hit.visible=false;g.add(hit);Q3.skulls.push({g,hit,st:'wall',x:x-fx*.1,y,z:z-fz*.1,vy:0,fx,fz});});
  // montacarichi
  Q3.up=liftDoor(E.liftUp,'MONTACARICHI');Q3.down=liftDoor(E.liftDown,'MONTACARICHI');
  // bracieri (gli arredi '5' delle Fondamenta)
  const bz=[];for(let i=0;i<N;i++)if(kind[i]===K.PROP&&propCh[i]==='5'&&region[i]>=0&&REG[region[i]].k==='k')bz.push(i);
  bz.sort((a,b)=>(a%GW)-(b%GW)||a-b);
  bz.forEach((i,j)=>{const x=i%GW+.5,z=((i/GW)|0)+.5,h=cellH[i];const fire=new THREE.Sprite(new THREE.SpriteMaterial({map:fireTex,color:0xff7a2a,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));
    fire.position.set(x,h+1.35,z);fire.scale.setScalar(.01);world.add(fire);const L=new THREE.PointLight(0xff6a20,0,9,2);L.position.set(x,h+1.6,z);world.add(L);
    const pl=textTex(128,128,(c,w,hh)=>{c.fillStyle='#2a2622';c.fillRect(0,0,w,hh);c.strokeStyle='#8a1a10';c.fillStyle='#8a1a10';drawSym(c,j,w/2,hh/2,44);});
    for(const [dx,dz,ry] of [[0,.2,0],[0,-.2,Math.PI],[.2,0,Math.PI/2],[-.2,0,-Math.PI/2]]){const m=new THREE.Mesh(new THREE.PlaneGeometry(.3,.3),new THREE.MeshLambertMaterial({map:pl,emissive:0x1a0806}));m.position.set(x+dx,h+.5,z+dz);m.rotation.y=ry;world.add(m);}
    const hit=new THREE.Mesh(new THREE.SphereGeometry(.45,6,4),hitMat);hit.visible=false;hit.position.set(x,h+1.1,z);world.add(hit);
    Q3.braziers.push({x,z,h,sym:j,fire,L,hit,lit:false});});
  // santuario: coperchio del sarcofago, cuore, ricompensa
  const S=E.shrine;const sh=hAt(S.x-1.8,S.z);const lid=new THREE.Mesh(new THREE.BoxGeometry(2.9,.18,1.9),MAT.stone);lid.position.set(S.x,sh+.9,S.z);world.add(lid);Q3.lid=lid;Q3.shrineH=sh;
  const heart=new THREE.Mesh(new THREE.SphereGeometry(.16,10,8),new THREE.MeshBasicMaterial({color:0xff5a1a}));heart.scale.set(1,1.2,.9);heart.visible=false;world.add(heart);Q3.heart=heart;
  const rw=gunModel('laser',false,false);rw.scale.setScalar(2.2);rw.position.set(S.x,sh+1.9,S.z);rw.visible=false;world.add(rw);Q3.reward=rw;
  const rl=new THREE.PointLight(0xff4a2a,0,8,2);rl.position.set(S.x,sh+2.4,S.z);world.add(rl);Q3.rewardLight=rl;
}

/* ---------- La Rocca: ponte sospeso, funivia, torre dell'acqua ---------- */
let Q4=null;
// quota del pavimento di una cella di uno strato preciso (per gli oggetti messi dai dati)
function hL(x,z,l){const i=ix(Math.floor(x),Math.floor(z),l||0);return rampOf[i]>=0?rampH(RAMPS[rampOf[i]],x,z):cellH[i];}
function tubeAlong(pts,r,mat){const c=new THREE.CatmullRomCurve3(pts.map(p=>new THREE.Vector3(...p)));const m=new THREE.Mesh(new THREE.TubeGeometry(c,Math.max(8,pts.length*3),r,5,false),mat);world.add(m);return c;}
function catenary(x0,y0,z0,x1,y1,z1,sag,n=16){const P0=[];for(let k=0;k<=n;k++){const t=k/n;P0.push([lerp(x0,x1,t),lerp(y0,y1,t)-sag*4*t*(1-t),lerp(z0,z1,t)]);}return P0;}
function buildRoccaExtras(){
  const red=geo('redPaint'),dk=geo('metalDark'),sea=M.liquidH;
  // ponte sospeso (omaggio al Golden Gate): due torri rosse a x 30 e 69 che escono dal mare, traversi, travi laterali sotto il piano stradale
  const top=36;
  for(const tx of [30.5,69.5]){for(const tz of [2.6,7.4])red.box(tx,(sea+top)/2,tz,1.5,top-sea,1.1);
    for(const y of [14,21,28,35])red.box(tx,y,5,1.2,y===35?1.4:.9,5.8);red.box(tx,9.1,5,1.6,1.2,6);}
  for(const z of [2.85,7.15])red.box(49.5,9.25,z,88,.8,.3);for(let x=8;x<93;x+=4)red.box(x,9.25,5,.25,.5,4.6);
  // cavi portanti (catenarie) e pendini verticali fino alla trave
  const cab=MAT.redPaint;for(const z of [2.6,7.4]){
    const spans=[[ -8,14,30.5,top-.5,10],[30.5,top-.5,69.5,top-.5,13],[69.5,top-.5,108,14,10]];
    spans.forEach(([x0,y0,x1,y1,sag])=>{const pts=catenary(x0,y0,z,x1,y1,z,sag,20);tubeAlong(pts,.13,cab);
      for(let x=Math.ceil(Math.max(6,x0)/3)*3;x<Math.min(93,x1);x+=3){const t=(x-x0)/(x1-x0);const cy=lerp(y0,y1,t)-sag*4*t*(1-t);if(cy>10.6)dk.box(x,(cy+10.4)/2,z,.05,cy-10.4,.05);}});}
  // lampioni lungo il ponte
  for(let x=10;x<92;x+=10){if(Math.abs(x-30.5)<3||Math.abs(x-69.5)<3)continue;for(const z of [3.05,6.95]){dk.box(x,11.6,z,.09,3.2,.09);geo('lampGlow').box(x,13.25,z+(z<5?.15:-.15),.3,.08,.3);}}
  // funivia: torre sul molo, torre sul tetto, cavo tra le due e una cabina ferma a ogni capo
  const G=M.egg4.gondola,tops=G.map(s=>{const h=hL(s.x,s.z,s.l),H=s.l===0?13:4.6;
    for(const [ox,oz] of [[-.9,-.9],[.9,-.9],[-.9,.9],[.9,.9]])dk.box(s.x+ox,h+H/2,s.z+oz,.18,H,.18);dk.box(s.x,h+H,s.z,2.2,.3,2.2);
    for(let y=2;y<H-.5;y+=2.5){dk.box(s.x,h+y,s.z-.9,1.8,.1,.1);dk.box(s.x,h+y,s.z+.9,1.8,.1,.1);}return [s.x,h+H+.2,s.z];});
  tubeAlong(catenary(...tops[0],...tops[1],1.4,24),.05,MAT.cable);
  const ca=tubeAlong(catenary(tops[0][0],tops[0][1],tops[0][2]+.5,tops[1][0],tops[1][1],tops[1][2]+.5,1.4,24),.05,MAT.cable);
  Q4C.cabins=G.map((s,i)=>{const c=new THREE.Group();const body=new THREE.Mesh(new THREE.BoxGeometry(1.8,1.7,1.4),MAT.yellow);body.position.y=-1.5;c.add(body);
    const win=new THREE.Mesh(new THREE.BoxGeometry(1.84,.6,1.2),MAT.metalDark);win.position.y=-1.2;c.add(win);const arm=new THREE.Mesh(new THREE.BoxGeometry(.08,.9,.08),MAT.metalDark);arm.position.y=-.4;c.add(arm);
    const t=tops[i];c.position.set(t[0]+(i?2.2:-2.2),t[1]-.3,t[2]+.25);world.add(c);return c;});
  // torre dell'acqua dell'isola (come ad Alcatraz)
  {const x=14,z=40;for(const [ox,oz] of [[-1.6,-1.6],[1.6,-1.6],[-1.6,1.6],[1.6,1.6]])dk.box(x+ox,4.5,z+oz,.25,9,.25);dk.box(x,4.5,z,3.4,.15,.15);dk.box(x,4.5,z,.15,.15,3.4);
    geo('rust').cyl(x,10.6,z,2.3,3.2,'y',16,true);const cone=new THREE.Mesh(new THREE.ConeGeometry(2.5,1.2,16),MAT.metalDark);cone.position.set(x,12.8,z);world.add(cone);}
}
const Q4C={cabins:[]};

/* ---------- La Rocca: oggetti degli easter egg ---------- */
let partHaloTex=null;
function partHalo(col){if(!partHaloTex)partHaloTex=textTex(64,64,c=>{const g=c.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,'rgba(255,255,255,.85)');g.addColorStop(1,'rgba(255,255,255,0)');c.fillStyle=g;c.fillRect(0,0,64,64);});
  const s=new THREE.Sprite(new THREE.SpriteMaterial({map:partHaloTex,color:col,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false}));s.scale.setScalar(.8);return s;}
function partMesh(k,i){const g=new THREE.Group();const B=(w,h,d,m,x,y,z,r)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(x,y,z);if(r)o.rotation.z=r;g.add(o);return o;},
  C=(r,l,m,x,y,z,ax,r2)=>{const o=new THREE.Mesh(new THREE.CylinderGeometry(r,r2??r,l,10),m);o.position.set(x,y,z);if(ax==='x')o.rotation.z=Math.PI/2;if(ax==='z')o.rotation.x=Math.PI/2;g.add(o);return o;};
  if(k==='s'){if(i===0){B(.5,.05,.35,MAT.metal,0,0,0);for(const s of[-1,1])C(.07,.04,MAT.metalDark,s*.2,-.06,.15,'x');B(.04,.45,.04,MAT.metal,-.22,.22,-.15);}
    else if(i===1){B(.42,.6,.04,MAT.rust,0,.1,0);for(let q=0;q<4;q++)C(.012,.58,MAT.bars,-.15+q*.1,.1,-.03);}
    else{B(.06,.3,.08,MAT.metalDark,-.12,0,0);B(.25,.06,.08,MAT.metalDark,0,.13,0);B(.25,.06,.08,MAT.metalDark,0,-.13,0);C(.015,.3,MAT.metal,.05,0,0,'x');}}
  else if(k==='p'){if(i===0){C(.14,.5,MAT.redPaint,0,0,0,'x');C(.03,.08,MAT.metalDark,.0,.16,0);}
    else if(i===1){const t=new THREE.Mesh(new THREE.TorusGeometry(.16,.04,6,14),LM({color:0x8a7a5a}));t.rotation.x=Math.PI/2;g.add(t);const t2=t.clone();t2.position.y=.07;t2.scale.setScalar(.8);g.add(t2);}
    else if(i===2){const w=new THREE.Mesh(new THREE.TorusGeometry(.14,.025,6,14),MAT.redPaint);g.add(w);for(let q=0;q<3;q++)B(.26,.02,.02,MAT.redPaint,0,0,0,q*Math.PI/3);C(.04,.3,MAT.metal,0,0,-.12,'z');}
    else if(i===3){B(.4,.3,.3,MAT.gunDark,0,0,0);for(let q=0;q<3;q++)C(.05,.14,MAT.metal,-.12+q*.12,.2,0);C(.06,.2,MAT.metal,.26,0,0,'x');}
    else{C(.05,.1,MAT.metalDark,0,0,0,'z');B(.08,.7,.03,MAT.wood,0,0,.04);}}
  return g;}
function benchMesh(b){const g=new THREE.Group();const cx=b.cells.reduce((a,c)=>a+c[0]+.5,0)/2,cz=b.cells.reduce((a,c)=>a+c[1]+.5,0)/2,h=hL(cx,cz,b.l);
  g.position.set(cx+b.face[0]*.1,h,cz+b.face[1]*.1);g.rotation.y=yawFromFace(b.face);world.add(g);
  const bn=b.id==='scudo'?'banco_scudo':'banco_acido',BM=ogg(bn);
  const bz=BM?-.38-BM.box[2]:0;if(BM){const bm=oggMesh(bn);bm.position.z=bz;g.add(bm);}/* banco Meshy con attrezzi e morsa: il pannello appoggiato al muro */
  else{const top=new THREE.Mesh(new THREE.BoxGeometry(1.9,.1,.8),MAT.wood);top.position.y=.92;g.add(top);
  for(const [sx,sz] of [[-.85,-.32],[.85,-.32],[-.85,.32],[.85,.32]]){const l=new THREE.Mesh(new THREE.BoxGeometry(.08,.9,.08),MAT.woodDark);l.position.set(sx,.45,sz);g.add(l);}
  const v=new THREE.Mesh(new THREE.BoxGeometry(.2,.18,.2),MAT.metalDark);v.position.set(.7,1.06,.2);g.add(v);
  const pan=new THREE.Mesh(new THREE.BoxGeometry(1.8,1.1,.05),MAT.woodDark);pan.position.set(0,1.55,-.38);g.add(pan);
  for(let k=0;k<4;k++){const t=new THREE.Mesh(new THREE.BoxGeometry(.04,.3,.02),MAT.metal);t.position.set(-.6+k*.3,1.6,-.34);t.rotation.z=(k-1.5)*.2;g.add(t);}}
  const sign=textTex(256,64,(c,w,hh)=>{c.fillStyle='#16110c';c.fillRect(0,0,w,hh);c.fillStyle='#d8a050';c.font='28px "Special Elite", monospace';c.textAlign='center';c.textBaseline='middle';c.fillText(b.id==='scudo'?'BANCO · SCUDO':'BANCO · ACIDO',w/2,hh/2+2);});
  const sg=new THREE.Mesh(new THREE.PlaneGeometry(1.2,.3),new THREE.MeshBasicMaterial({map:sign}));sg.position.set(0,BM?BM.box[4]+.2:1.95,BM?BM.box[2]+bz+.06:-.35);g.add(sg);
  colBox(cx+b.face[0]*.1,h+.5,cz+b.face[1]*.1,1.9,1,.8,yawFromFace(b.face));
  let item;if(b.id==='scudo'){item=shieldModel();item.rotation.x=-Math.PI/2+.2;item.position.set(0,1.05,.05);item.scale.setScalar(.85);}
  else{item=new THREE.Group();for(let k=0;k<3;k++){const c=new THREE.Mesh(new THREE.CylinderGeometry(.07,.07,.32,10),acidGlow);c.position.set(-.25+k*.25,1.14,.05);item.add(c);}}
  item.visible=false;g.add(item);return {g,item,x:cx-b.face[0]*1.1,z:cz-b.face[1]*1.1,h,id:b.id};}
function dogMesh(d){const g=new THREE.Group();const h=hL(d.x,d.z,d.l);g.position.set(d.x+d.face[0]*.1,h,d.z+d.face[1]*.1);g.rotation.y=yawFromFace(d.face);world.add(g);
  const ped=new THREE.Mesh(new THREE.BoxGeometry(.9,1.05,.9),MAT.stone);ped.position.y=.52;g.add(ped);const cap=new THREE.Mesh(new THREE.BoxGeometry(1,.08,1),MAT.rock);cap.position.y=1.08;g.add(cap);
  const hd=new THREE.Group();hd.position.set(0,1.42,.05);g.add(hd);const st=LM({color:0x3a3632});
  const cr=new THREE.Mesh(new THREE.SphereGeometry(.26,12,10),st);cr.scale.set(1,.9,1.1);hd.add(cr);
  const sn=new THREE.Mesh(new THREE.BoxGeometry(.2,.16,.34),st);sn.position.set(0,-.06,.3);hd.add(sn);const nose=new THREE.Mesh(new THREE.SphereGeometry(.05,8,6),MAT.gunDark);nose.position.set(0,0,.48);hd.add(nose);
  const jaw=new THREE.Mesh(new THREE.BoxGeometry(.18,.06,.3),st);jaw.position.set(0,-.18,.26);jaw.rotation.x=.35;hd.add(jaw);
  for(const s of[-1,1]){const e=new THREE.Mesh(new THREE.ConeGeometry(.08,.22,4),st);e.position.set(s*.15,.26,-.02);e.rotation.z=-s*.35;hd.add(e);}
  const eyeM=new THREE.MeshBasicMaterial({color:0x220806});for(const s of[-1,1]){const e=new THREE.Mesh(new THREE.SphereGeometry(.04,8,6),eyeM);e.position.set(s*.1,.07,.22);hd.add(e);}
  const fire=new THREE.Sprite(new THREE.SpriteMaterial({map:fireTex,color:0xff6a20,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));fire.position.set(0,-.12,.36);fire.scale.setScalar(.01);hd.add(fire);
  colBox(d.x+d.face[0]*.1,h+.7,d.z+d.face[1]*.1,.9,1.4,.9);
  return {g,hd,eyeM,fire,x:d.x,z:d.z,h,fed:0,done:false,mx:d.x-d.face[0]*.45,mz:d.z-d.face[1]*.45};}
function planeMesh(){const g=new THREE.Group();const body=new THREE.Mesh(new THREE.CylinderGeometry(.42,.28,4.2,12),LM({color:0x5a6a4a}));body.rotation.x=Math.PI/2;body.position.y=1;g.add(body);
  const nose=new THREE.Mesh(new THREE.CylinderGeometry(.44,.44,.4,12),MAT.metalDark);nose.rotation.x=Math.PI/2;nose.position.set(0,1,-2.2);g.add(nose);
  const wing=new THREE.Mesh(new THREE.BoxGeometry(6.4,.1,1.1),LM({color:0x6a7a5a}));wing.position.set(0,1.45,-.6);g.add(wing);const w2=wing.clone();w2.position.y=.55;w2.scale.set(.85,1,1);g.add(w2);
  for(const s of[-1,1])for(const z of[-1.05,-.15]){const st=new THREE.Mesh(new THREE.BoxGeometry(.05,.9,.05),MAT.wood);st.position.set(s*2.2,1,z);g.add(st);}
  const tail=new THREE.Mesh(new THREE.BoxGeometry(2,.08,.7),LM({color:0x6a7a5a}));tail.position.set(0,1.1,1.85);g.add(tail);const fin=new THREE.Mesh(new THREE.BoxGeometry(.08,.8,.7),MAT.redPaint);fin.position.set(0,1.5,1.9);g.add(fin);
  const prop=new THREE.Group();prop.position.set(0,1,-2.45);const bl=new THREE.Mesh(new THREE.BoxGeometry(.1,1.6,.04),MAT.wood);prop.add(bl);g.add(prop);
  for(const s of[-1,1]){const w=new THREE.Mesh(new THREE.CylinderGeometry(.22,.22,.1,12),MAT.gunDark);w.rotation.z=Math.PI/2;w.position.set(s*.7,.22,-1.2);g.add(w);}
  const pal=new THREE.Mesh(new THREE.BoxGeometry(5.6,.06,4.4),MAT.wood);pal.position.y=.03;g.add(pal);g.userData.prop=prop;return g;}
function chairMesh(c){const g=new THREE.Group();const h=hL(c.x,c.z,c.l);g.position.set(c.x,h,c.z);g.rotation.y=-Math.PI/2;world.add(g);const W=MAT.woodDark;
  const seat=new THREE.Mesh(new THREE.BoxGeometry(.7,.1,.65),W);seat.position.y=.55;g.add(seat);const back=new THREE.Mesh(new THREE.BoxGeometry(.7,1.1,.1),W);back.position.set(0,1.1,-.3);g.add(back);
  for(const s of[-1,1]){const a=new THREE.Mesh(new THREE.BoxGeometry(.08,.08,.6),W);a.position.set(s*.36,.85,0);g.add(a);for(const z of[-.25,.25]){const l=new THREE.Mesh(new THREE.BoxGeometry(.08,.55,.08),W);l.position.set(s*.3,.27,z);g.add(l);}}
  const helm=new THREE.Mesh(new THREE.SphereGeometry(.2,10,8,0,Math.PI*2,0,1.5),MAT.metal);helm.position.set(0,1.75,-.15);g.add(helm);
  const cab=new THREE.Mesh(new THREE.CylinderGeometry(.02,.02,1.4,5),MAT.cable);cab.position.set(.2,1.6,-.6);cab.rotation.z=.5;g.add(cab);
  colBox(c.x,h+.6,c.z,.8,1.2,.8);return {g,x:c.x+1,z:c.z,h};}
function buildEgg4(){Q4=null;if(!M.egg4)return;const E=M.egg4;
  Q4={sp:[0,0,0],sb:false,pp:[0,0,0,0,0],pb:false,sk:[0,0,0],kb:false,tomaOn:false,objs:{s:[],p:[],k:[]},dogs:[],benches:{},holdT:0,ride:null,gonCD:0};
  const add=(k,arr,col,mk)=>arr.forEach((o,i)=>{const g=mk(i);const h=hL(o.x,o.z,o.l);g.position.set(o.x,h+(o.dy??.55),o.z);g.add(partHalo(col));world.add(g);Q4.objs[k].push({g,x:o.x,z:o.z,h,dy:o.dy??.55,i});});
  add('s',E.shield,0x9fd0ff,i=>partMesh('s',i));add('p',E.plane,0xffc870,i=>partMesh('p',i));add('k',E.skulls,0x7dff5a,()=>{const s=skullMesh(true);s.scale.setScalar(.8);s.userData.eye.color.set(0x7dff5a);return s;});
  (M.benches||[]).forEach(b=>{Q4.benches[b.id]=benchMesh(b);});
  Q4.dogs=E.dogs.map(dogMesh);
  const d0=Q4.dogs[0];Q4.toma=tomaModel();Q4.toma.scale.setScalar(1.6);Q4.toma.position.set(d0.x-E.dogs[0].face[0]*.9,d0.h+1.3,d0.z-E.dogs[0].face[1]*.9);Q4.toma.visible=false;world.add(Q4.toma);
  Q4.tomaPos={x:Q4.toma.position.x,z:Q4.toma.position.z,h:d0.h};
  const S=E.planeSpot,sh=hL(S.x,S.z,S.l);Q4.plane=planeMesh();Q4.plane.position.set(S.x,sh,S.z);Q4.plane.visible=false;world.add(Q4.plane);Q4.planeH=sh;
  {const t=textTex(256,128,(c,w,hh)=>{c.clearRect(0,0,w,hh);c.strokeStyle='rgba(233,227,209,.8)';c.lineWidth=4;c.setLineDash([10,8]);c.beginPath();c.moveTo(128,8);c.lineTo(140,40);c.lineTo(250,52);c.lineTo(250,66);c.lineTo(140,72);c.lineTo(134,110);c.lineTo(170,118);c.lineTo(170,124);c.lineTo(86,124);c.lineTo(86,118);c.lineTo(122,110);c.lineTo(116,72);c.lineTo(6,66);c.lineTo(6,52);c.lineTo(116,40);c.closePath();c.stroke();});
    const m=new THREE.Mesh(new THREE.PlaneGeometry(6.4,4.6),new THREE.MeshBasicMaterial({map:t,transparent:true,depthWrite:false}));m.rotation.x=-Math.PI/2;m.position.set(S.x,sh+.03,S.z);world.add(m);Q4.outline=m;}
  Q4.chair=chairMesh(E.chair);
  Q4.gon=E.gondola.map(s=>({x:s.x,z:s.z,h:hL(s.x,s.z,s.l),l:s.l,yaw:s.yaw}));
}

/* =========================================================
   SILVER FALLS (M.id 'cascate'): arredi della cittadina e dettagli
   ========================================================= */
// facciata di un edificio: materiale della parete vista da fuori (M.facades: rettangoli con il materiale)
function facadeOf(x,z){for(const f of M.facades)if(x>=f.x0&&x<=f.x1&&z>=f.z0&&z<=f.z1)return f.m;return null;}
const CARS=['carRed','carBlue','carCream','carGreen','carBlack','carMustard'];
// pezzo orientato: (lx,lz) nel sistema dell'oggetto, girato di th
function rbox(m,cx,cz,th,lx,y,lz,sx,sy,sz){const c=Math.cos(th),s=Math.sin(th);geo(m).box(cx+lx*c+lz*s,y,cz-lx*s+lz*c,sx,sy,sz,th);}
function townCar(cx,cz,h,L,Wd,alongX,r){const th=(alongX?0:Math.PI/2)+(r()-.5)*.18,paint=CARS[(r()*CARS.length)|0],c=Math.cos(th),s=Math.sin(th);
  const B=(m,lx,y,lz,sx,sy,sz)=>rbox(m,cx,cz,th,lx,h+y,lz,sx,sy,sz);
  B(paint,0,.55,0,L-.2,.62,Wd-.3);B(paint,L*.33,.92,0,L*.3,.12,Wd-.34);B(paint,-L*.38,.9,0,L*.22,.1,Wd-.34);/* scocca, cofano, baule */
  B('glassDark',-.05*L,1.17,0,L*.42,.46,Wd-.4);B(paint,-.05*L,1.43,0,L*.4,.07,Wd-.42);/* abitacolo coi vetri scuri, tetto */
  B('metal',L/2-.06,.42,0,.1,.14,Wd-.26);B('metal',-L/2+.06,.42,0,.1,.14,Wd-.26);/* paraurti */
  B('lampGlow',L/2-.04,.62,(Wd/2-.38),.04,.1,.22);B('lampGlow',L/2-.04,.62,-(Wd/2-.38),.04,.1,.22);B('neon',-L/2+.04,.66,(Wd/2-.36),.04,.08,.2);B('neon',-L/2+.04,.66,-(Wd/2-.36),.04,.08,.2);
  for(const [lx,lz] of [[L*.31,Wd/2-.2],[L*.31,-(Wd/2-.2)],[-L*.31,Wd/2-.2],[-L*.31,-(Wd/2-.2)]])geo('tire').cyl(cx+lx*c+lz*s,h+.33,cz-lx*s+lz*c,.33,.24,alongX?'z':'x',10,true);}
function townProp(p,w,d,cx,cz,h,long,rk,r){const R=p.r>=0?REG[p.r]:null,out=!!(R&&R.out);
  switch(p.ch){
    case '0':if(out||rk==='i'){townCar(cx,cz,h,long?w:d,long?d:w,long,r);return true;}
      {/* scaffali con la merce */geo('woodDark').box(cx,h+1,cz,long?w-.1:.84,2,long?.84:d-.1);for(let k=0;k<4;k++)geo('wood').box(cx,h+.22+k*.52,cz,long?w-.04:.9,.04,long?.9:d-.04);
        const pc=['redPaint','white','yellow','green','metal','carBlue'],L=long?w:d;
        for(let k=0;k<L*7;k++){const t=(r()-.5)*(L-.3),y=h+.26+((r()*4)|0)*.52,sx=.12+r()*.18,sy=.14+r()*.2;geo(pc[(r()*pc.length)|0]).box(long?cx+t:cx+(r()<.5?-.22:.22),y+sy/2,long?cz+(r()<.5?-.22:.22):cz+t,sx,sy,.16);}}
      return true;
    case '9':
      if(rk==='p'){/* serbatoio dell'acqua: basamento di cemento, quattro gambe, serbatoio, tetto a cono, scala */
        geo('concrete').box(cx,h+.3,cz,w-.1,.6,d-.1);const lx=w/2-.45,lz=d/2-.45;for(const [a,b] of [[-1,-1],[1,-1],[-1,1],[1,1]])geo('metalDark').cyl(cx+a*lx,h+4.9,cz+b*lz,.13,8.6,'y',8);
        for(const y of [3.2,6.2]){geo('metalDark').box(cx,h+y,cz-lz,w-.9,.08,.08);geo('metalDark').box(cx,h+y,cz+lz,w-.9,.08,.08);geo('metalDark').box(cx-lx,h+y,cz,.08,.08,d-.9);geo('metalDark').box(cx+lx,h+y,cz,.08,.08,d-.9);}
        geo('metal').cyl(cx,h+10.6,cz,Math.min(w,d)*.55,3.4,'y',18,true);geo('metalDark').cyl(cx,h+9,cz,Math.min(w,d)*.57,.2,'y',18);
        const cone=new THREE.Mesh(new THREE.ConeGeometry(Math.min(w,d)*.6,1.6,18),MAT.metalDark);cone.position.set(cx,h+13.1,cz);world.add(cone);
        for(let y=1;y<9;y+=.35)geo('metalDark').box(cx+lx+.25,h+y,cz,.3,.03,.03);
        const t=textTex(256,64,(c,W,H)=>{c.fillStyle='rgba(0,0,0,0)';c.clearRect(0,0,W,H);c.fillStyle='#2b2f33';c.font='bold 40px "Barlow Condensed", sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText('SILVER FALLS',W/2,H/2);});
        const sg=new THREE.Mesh(new THREE.PlaneGeometry(3.2,.8),new THREE.MeshLambertMaterial({map:t,transparent:true}));sg.position.set(cx,h+10.9,cz+Math.min(w,d)*.56);world.add(sg);return true;}
      if(rk==='h'){/* isola delle pompe di benzina */geo('concrete').box(cx,h+.1,cz,w+.3,.2,d-.05);
        for(let k=0;k<(long?w:d);k++){const px=long?p.x0+k+.5:cx,pz=long?cz:p.z0+k+.5;geo('carRed').box(px,h+.95,pz,.62,1.5,.42);geo('white').box(px,h+1.82,pz,.64,.26,.44);
          geo('lampGlow').box(px,h+1.3,pz+.215,.4,.22,.02);geo('lampGlow').box(px,h+1.3,pz-.215,.4,.22,.02);geo('metalDark').cyl(px+.33,h+.9,pz,.04,.9,'y',6);}return true;}
      return false;
    case '4':
      if(rk==='e'){/* albero morto */const t=new THREE.Group();const bark=MAT.woodDark;const tr=new THREE.Mesh(new THREE.CylinderGeometry(.08,.22,4.2,7),bark);tr.position.y=2.1;t.add(tr);
        for(let k=0;k<6;k++){const L=.9+r()*1.4,b=new THREE.Mesh(new THREE.CylinderGeometry(.02,.07,L,5),bark);const a=r()*Math.PI*2,y=2.2+r()*1.8,tilt=.6+r()*.7;
          b.position.set(Math.cos(a)*Math.sin(tilt)*L/2,y+Math.cos(tilt)*L/2,Math.sin(a)*Math.sin(tilt)*L/2);b.rotation.set(Math.sin(a)*tilt,0,-Math.cos(a)*tilt);t.add(b);}
        t.position.set(cx,h,cz);world.add(t);geo('woodDark').cyl(cx,h+2,cz,.2,4,'y',6);/* (forma per i proiettili) */return true;}
      if(rk==='f'){/* candelabro */geo('metalDark').cyl(cx,h+.05,cz,.25,.1,'y',8);geo('metal').cyl(cx,h+.85,cz,.04,1.6,'y',6);geo('metal').box(cx,h+1.62,cz,.7,.04,.06);
        for(const o of [-.32,0,.32]){geo('white').cyl(cx+o,h+1.74,cz,.035,.2,'y',6);const f=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex,color:0xffb050,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));f.scale.setScalar(.22);f.position.set(cx+o,h+1.9,cz);world.add(f);}return true;}
      if(rk==='h'){geo('white').box(cx,h+2.2,cz,.36,4.4,.36);geo('redPaint').box(cx,h+.5,cz,.4,1,.4);return true;}/* colonna della pensilina */
      return false;/* lampione normale */
    case '2':if(rk!=='f')return false;/* panca della chiesa (guarda l'altare a nord: schienale a sud) */
      geo('wood').box(cx,h+.45,cz-.05,w-.1,.07,.42);geo('wood').box(cx,h+.78,cz+.2,w-.1,.55,.06);geo('woodDark').box(cx,h+.15,cz+.2,w-.1,.3,.04);
      for(const s of [-1,1])geo('woodDark').box(cx+s*(w/2-.08),h+.45,cz,.07,.9,.5);return true;
    case '6':geo('metalDark').cyl(cx,h+.02,cz,.22,.04,'y',10);geo('metal').cyl(cx,h+.38,cz,.04,.72,'y',6);geo('carRed').cyl(cx,h+.77,cz,.2,.09,'y',12,true);return true;/* sgabello */
    case '7':
      if(rk==='n'&&w*d===1){geo('metalDark').box(cx,h+.35,cz,.5,.7,.9);geo('carBlue').box(cx,h+.74,cz,.5,.1,.9);for(const o of [-.25,0,.25])geo(o?'carRed':'carBlack').cyl(cx,h+.86,cz+o,.11,.2,'y',10,true);return true;}/* ritorno delle palle */
      if(rk!=='c'){/* divanetto: occupa tutto il suo spazio, schienale sul lato lungo */const s0=long?-1:1;geo('carBlue').box(cx,h+.24,cz,w-.08,.48,d-.08);
        geo('carBlue').box(long?cx:cx+(d>1?0:0)+(-(w/2-.12)),h+.72,long?cz+(d/2-.12):cz,long?w-.08:.2,.6,long?.2:d-.08);for(const s of[-1,1])geo('carBlue').box(long?cx+s*(w/2-.1):cx,h+.5,long?cz:cz+s*(d/2-.1),long?.16:w-.08,.5,long?d-.08:.16);}
      else{/* separé: due panche alte alle estremità, tavolo che copre tutto lo spazio in mezzo */const L=long?w:d,Wd=long?d:w,ax=(a,b)=>long?[a,b]:[b,a];
        {const [sx,sz]=ax(Math.max(.3,L-1.2),Wd-.1);geo('white').box(cx,h+.74,cz,sx,.05,sz);geo('metal').box(cx,h+.37,cz,Math.min(sx,.12),.72,Math.min(sz,.12));}
        for(const s of [-1,1]){const [ox,oz]=ax(s*(L/2-.3),0),[bx,bz]=ax(.55,Wd-.1),[kx,kz]=ax(.12,Wd-.1),[o2x,o2z]=ax(s*(L/2-.08),0);
          geo('carRed').box(cx+ox,h+.24,cz+oz,bx,.48,bz);geo('carRed').box(cx+o2x,h+.75,cz+o2z,kx,.6,kz);}}
      return true;
    case '5':if(rk==='c'){geo('carRed').box(cx,h+.47,cz,w-.1,.94,d-.15);geo('metal').box(cx,h+.98,cz,w,.06,d);geo('metal').box(cx,h+.08,cz,w-.12,.16,d-.12);return true;}/* bancone della tavola calda */
      if('bsvtun'.includes(rk)){geo('woodDark').box(cx,h+.48,cz,w-.1,.96,d-.15);geo('wood').box(cx,h+.99,cz,w,.06,d);if(rk==='s')geo('glassDark').box(cx,h+1.45,cz,w-.1,.85,.04);return true;}/* banconi di legno (banca col vetro) */
      return false;
    case '3':if(rk==='e'){/* lapidi: lastra, croce o obelisco su uno zoccolo */for(let xx=p.x0;xx<=p.x1;xx++)for(let zz=p.z0;zz<=p.z1;zz++){const x=xx+.5,z=zz+.5,k=r(),a=(r()-.5)*.25;
          geo('stone').box(x,h+.1,z,.8,.2,.5,a);if(k<.55){geo('stone').box(x,h+.6,z,.6,.85,.14,a);geo('stone').cyl(x,h+1.02,z,.3,.14,'z',10,true);}
          else if(k<.8){geo('stone').box(x,h+.75,z,.14,1.3,.14,a);geo('stone').box(x,h+1.05,z,.6,.14,.14,a);}else geo('stone').box(x,h+.75,z,.3,1.3,.3,a);}return true;}
      if(rk==='p'){geo('green').box(cx,h+.65,cz,w-.15,1.3,d-.2);geo('metalDark').box(cx,h+1.32,cz,w-.1,.06,d-.15);return true;}/* cassonetto */
      return false;
  }return false;}
// dettagli: strade dipinte, marciapiedi, insegne, pensilina, campanile, cascata, fiume, alberi, zucche
let TOWN=null;
function townSign(text,x,y,z,face,w,col,sub){const H=w*.28,t=textTex(512,Math.round(512*H/w),(c,W,Hh)=>{c.fillStyle='rgba(14,12,16,.92)';c.fillRect(0,0,W,Hh);c.strokeStyle=col;c.lineWidth=8;c.strokeRect(10,10,W-20,Hh-20);
    c.shadowColor=col;c.shadowBlur=24;c.fillStyle='#fff';c.font=`bold ${Math.round(Hh*(sub?.42:.55))}px "Barlow Condensed", sans-serif`;c.textAlign='center';c.textBaseline='middle';c.fillText(text,W/2,Hh*(sub?.42:.53));
    c.shadowBlur=0;c.fillStyle=col;c.fillText(text,W/2,Hh*(sub?.42:.53));if(sub){c.font=`bold ${Math.round(Hh*.2)}px "Barlow Condensed", sans-serif`;c.fillStyle='#f2e6c8';c.fillText(sub,W/2,Hh*.78);}});
  const m=new THREE.Mesh(new THREE.PlaneGeometry(w,H),new THREE.MeshBasicMaterial({map:t}));m.position.set(x-face[0]*.06,y,z-face[1]*.06);m.rotation.y=Math.atan2(-face[0],-face[1]);world.add(m);return m;}
function buildTownExtras(){TOWN={signs:[],fall:null};
  // terreno attorno alla cittadina (fuori dalla griglia)
  const gm=LM({map:TX.ground});for(const [x,z,w,d] of [[GW/2,-100,440,200],[GW/2,GH+100,440,200],[-100,GH/2,200,GH],[GW+100,GH/2,200,GH]]){const p=new THREE.Mesh(new THREE.PlaneGeometry(w,d),gm);p.rotation.x=-Math.PI/2;p.position.set(x,-.01,z);world.add(p);}
  MAT.paintY=MAT.paintY||LM({color:0xb8952e,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});MAT.paintW=MAT.paintW||LM({color:0xbdbab0,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
  const Q=(m,x0,z0,x1,z1,y)=>geo(m).quad([x0,y,z0],[x0,y,z1],[x1,y,z1],[x1,y,z0],[[0,0],[0,1],[1,1],[1,0]]);
  const isA=(x,z)=>inb(x,z)&&kind[ix(x,z)]===K.FLOOR&&'agj'.includes(REG[region[ix(x,z)]].k);
  // linea gialla tratteggiata al centro delle strade e strisce pedonali davanti alla tavola calda
  for(let x=12;x<96;x+=3)if(isA(x,38)&&isA(x+1,38))Q('paintY',x,38.42,x+1.6,38.58,.012);
  for(let z=35;z<=41;z++)if(z!==38)for(const x0 of [50.6,51.4,52.2])Q('paintW',x0,z+.15,x0+.45,z+.85,.012);
  // marciapiedi: cemento con il cordolo verso la strada
  for(let x=12;x<96;x++)for(const [z,dz] of [[34,1],[42,-1]]){if(!isA(x,z))continue;Q('concrete',x,z,x+1,z+1,.02);const ze=dz>0?z+1:z;geo('concrete').box(x+.5,.06,ze,1,.12,.12);}
  // stalli del parcheggio e del motel
  for(let x=33;x<80;x+=2.6){Q('paintW',x,66.2,x+.1,69.4,.012);Q('paintW',x,74.6,x+.1,77.8,.012);}
  for(let z=46;z<77;z+=2.6)Q('paintW',26.6,z,29.8,z+.1,.012);
  // insegne al neon sopra le porte
  const S=[['EMPORIO',41.5,3.05,34,[0,-1],2.6,'#ffb347','Generi alimentari'],['TAVOLA CALDA',54.5,2.95,34,[0,-1],3.4,'#ff5a7a','APERTO 24 ORE'],['BANCA',65.5,3.3,34,[0,-1],2.4,'#e8e0c8','Silver Falls Savings'],
    ['SCERIFFO',74.5,2.95,34,[0,-1],2.2,'#6ad0ff'],['FERRAMENTA',88.5,3.05,34,[0,-1],2.8,'#9cff6a'],['UFFICIO POSTALE',21.5,3.05,34,[0,-1],3,'#e8e0c8'],
    ['SILVER LANES',50,3.7,43,[0,1],4.8,'#ff5ad0','BOWLING · 24 PISTE'],['FUMETTI',68.5,2.95,43,[0,1],2.2,'#ffd84a'],['OFFICINA',88,3.2,63,[0,1],2.6,'#6ad0ff'],
    ['MOTEL',16.8,1.55,43,[0,1],2.4,'#ff6a5a','CAMERE LIBERE']];
  for(const [t,x,y,z,f,w,c,sub] of S)TOWN.signs.push(townSign(t,x,y,z+(f[1]>0?-.01:.01),f,w,c,sub));
  // pensilina del distributore (le colonne sono gli arredi 4) con le luci sotto e l'insegna
  geo('white').box(86,4.55,49.5,15.6,.4,8.6);geo('redPaint').box(86,4.85,49.5,15.8,.25,8.8);for(const x of [81,86,91])geo('lampGlow').box(x,4.33,49.5,.25,.04,6);
  townSign('BENZINA · DIESEL',86,4.85,45.04,[0,1],5,'#ff3a3a');
  // chiesa: tetto a capanna sopra la navata e campanile con la guglia sopra il portone
  {const y0=10.05,y1=14.2,x0=34,x1=59,z0=1,z1=13,xm=(x0+x1)/2;geo('concrete2').quad([x0,y0,z0],[x0,y0,z1],[xm,y1,z1],[xm,y1,z0],[[0,0],[6,0],[6,3],[0,3]]);geo('concrete2').quad([x1,y0,z1],[x1,y0,z0],[xm,y1,z0],[xm,y1,z1],[[0,0],[6,0],[6,3],[0,3]]);
    for(const z of [z0,z1])geo('masonry').quad([x0,y0,z],[x1,y0,z],[xm,y1,z],[xm,y1,z],[[0,0],[6,0],[3,1.4],[3,1.4]]);
    geo('masonry').box(45.5,13.5,12.4,3.6,7,3);const sp=new THREE.Mesh(new THREE.ConeGeometry(2.4,5.5,4),MAT.concrete2);sp.rotation.y=Math.PI/4;sp.position.set(45.5,19.75,12.4);world.add(sp);
    geo('metalDark').box(45.5,23,12.4,.12,1.2,.12);geo('metalDark').box(45.5,23.2,12.4,.6,.12,.12);geo('yellow').cyl(45.5,14.8,12.4,.55,.9,'y',12);/* campana */
    const rose=new THREE.Mesh(new THREE.CircleGeometry(.85,16),new THREE.MeshBasicMaterial({color:0x8a5428}));rose.position.set(45.5,9.2,13.02);world.add(rose);}/* rosone acceso sopra il portone */
  // bowling: canalette tra le piste, linea di fallo, birilli in fondo
  for(let x=40;x<=60;x+=4)Q('metalDark',x+.35,52,x+.65,64,.01);Q('paintW',40,51.9,61,52.05,.012);
  for(let x=42;x<=58;x+=4)for(const [ox,oz] of [[0,0],[-.2,.3],[.2,.3],[-.4,.6],[0,.6],[.4,.6]])geo('white').cyl(x+.5+ox,.19,63.2+oz,.06,.38,'y',8);
  // il fiume (e sotto il ponte) e la cascata a nord, che scorrono
  const wt=TX.water.clone();wt.needsUpdate=true;wt.repeat.set(3,18);const wm=LM({map:wt,transparent:true,opacity:.92});const river=new THREE.Mesh(new THREE.PlaneGeometry(10,37),wm);river.rotation.x=-Math.PI/2;river.position.set(5,M.liquidH,31.5);world.add(river);
  const ft=textTex(64,256,(c,W,H)=>{c.fillStyle='#1d2b33';c.fillRect(0,0,W,H);for(let i=0;i<160;i++){c.fillStyle=`rgba(${120+Math.random()*80|0},${150+Math.random()*70|0},${170+Math.random()*60|0},${.15+Math.random()*.35})`;c.fillRect(Math.random()*W,Math.random()*H,1+Math.random()*2,14+Math.random()*50);}});/* acqua scura con le strisce chiare che scendono */
  ft.wrapS=ft.wrapT=THREE.RepeatWrapping;ft.repeat.set(2,2);const fall=new THREE.Mesh(new THREE.PlaneGeometry(6.2,10),new THREE.MeshLambertMaterial({map:ft,transparent:true,opacity:.8,side:THREE.DoubleSide,emissive:0x0a1418}));fall.position.set(7,M.liquidH+5,14.05);world.add(fall);
  geo('rock').box(6.5,3,11.6,13,10.4,3.2);for(let k=0;k<6;k++)geo('rock').box(rand(1,12),rand(4,8),rand(10,12.6),rand(1.5,3),rand(1,3),rand(1,2),rand(0,3));/* parete di roccia */
  {const fm=new THREE.SpriteMaterial({map:glowTex,color:0x9fb4c0,transparent:true,opacity:.35,depthWrite:false});for(let k=0;k<6;k++){const f=new THREE.Sprite(fm);f.scale.set(2.4,1.2,1);f.position.set(4.4+k,M.liquidH+.4,14.6);world.add(f);}}/* schiuma */
  TOWN.fall=ft;TOWN.river=wt;
  // bosco tutto intorno, fuori dalla città (due InstancedMesh: chioma e tronco)
  const pts=[];const r=mulberry32(91);const free=(x,z)=>{for(let dz=-3;dz<=3;dz++)for(let dx=-3;dx<=3;dx++){const a=Math.floor(x)+dx,b=Math.floor(z)+dz;if(inb(a,b)&&kind[ix(a,b)]!==K.VOID)return false;}return true;};
  for(let i=0;i<900&&pts.length<170;i++){const x=rand(-30,130),z=rand(-30,110);if(x>-2&&x<102&&z>-2&&z<82&&!free(x,z))continue;if(x>0&&x<12&&z>8&&z<52)continue;pts.push([x,z,.8+r()*.7]);}
  const crown=new THREE.InstancedMesh(new THREE.ConeGeometry(2.2,7,7),LM({color:0x1d2a1f}),pts.length),trunk=new THREE.InstancedMesh(new THREE.CylinderGeometry(.22,.3,2.4,6),MAT.woodDark,pts.length);
  const m4=new THREE.Matrix4(),q=new THREE.Quaternion(),sv=new THREE.Vector3(),pv=new THREE.Vector3();
  pts.forEach(([x,z,s],i)=>{sv.set(s,s*(.8+r()*.5),s);m4.compose(pv.set(x,1.2*s+3.5*sv.y,z),q,sv);crown.setMatrixAt(i,m4);m4.compose(pv.set(x,1.2*s,z),q,sv.set(s,s,s));trunk.setMatrixAt(i,m4);});world.add(crown);world.add(trunk);
  /* zucche di Halloween accese: 16 per la città e 5 nascoste in alto (serbatoio dell'acqua, pensilina, tetto della chiesa, mausoleo, ponte).
     Easter egg personale (online ognuno spegne le sue): colpite tutte con un'arma da fuoco → una risata e una bevanda gratis (pumpkinHit) */
  const pg=new THREE.SphereGeometry(.24,10,8);pg.scale(1,.78,1);TOWN.pumpkins=[];
  for(const [x,z,yy] of [[37.2,34.3],[46.4,34.3],[48.4,34.3],[60.6,34.3],[62.4,34.4],[71.4,42.6],[34.4,42.6],[47.6,42.6],[52.4,42.6],[14.6,34.3],[27.4,34.3],[91.4,34.3],[44,13.4],[47,13.4],[18.5,44.4],[13.6,45],
      [65.8,70.4,12.5],[86,52.5,4.95],[46.5,6.5,14.42],[86.5,6.5,6.42],[11.5,38.4,1.28]]){
    const h=yy!=null?yy-.19:hAt(x,z,5),pm=new THREE.Mesh(pg,MAT.orange);pm.position.set(x,h+.19,z);world.add(pm);const s=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex,color:0xff8a2a,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));s.scale.setScalar(.7);s.position.set(x,h+.25,z);world.add(s);
    TOWN.pumpkins.push({m:pm,s,hit:false});}
}
function townTick(dt,now){if(!TOWN)return;TOWN.fall.offset.y=(now/700)%1;TOWN.river.offset.y=(now/9000)%1;}
function townReset(){if(!TOWN)return;TOWN.pumpkins.forEach(p=>{p.hit=false;p.m.visible=true;p.s.visible=true;});}
function pumpkinHit(pk,pt){if(pk.hit)return;pk.hit=true;pk.m.visible=false;pk.s.visible=false;emit(pt||pk.m.position,22,1,.5,.1,2.2,1.4);Sfx.hit();Sfx.play&&Sfx.play('slime',{v:.4,rate:1.5});
  const n=TOWN.pumpkins.filter(p=>p.hit).length,N=TOWN.pumpkins.length;if(n<N){if(n===1||n%5===0)showMsg(`Una zucca si spegne<small>${n} su ${N}</small>`,1.6);return;}
  Sfx.laugh();setTimeout(()=>Sfx.jingle(),900);/* tutte: una bevanda gratis tra quelle della mappa (o punti se sei al limite) */
  const can=PERKS.filter(p=>!perks.has(p.id)&&!(p.id==='secondavita'&&reviveBuys>=3));
  if(can.length&&(noLimit()||perks.size<PERK_LIMIT)){const p=pick(can);perks.add(p.id);if(p.id==='secondavita')reviveBuys++;applyPerks();updatePerkIcons();Sfx.drink();showMsg(`Tutte le zucche spente<small>${p.name} in regalo</small>`,3.2);}
  else{addPoints(3000);showMsg('Tutte le zucche spente<small>3000 punti in regalo</small>',3.2);}}
