
/* =========================================================
   RENDERER E SCENA (condivisi tra le mappe)
   ========================================================= */
const canvas=$('view');
if(window.__scnStop){try{window.__scnStop();}catch(_){}}
/* luci (menu → Luci, si applica ricaricando):
   classiche (di serie) = quelle di sempre: luce per vertice (Lambert), niente effetti. L'utente le preferisce: non cambiarle.
   pixel = prova: luce per pixel con rilievo e riflessi, ombre negli angoli, aloni e post-produzione (bagliore, FXAA, vignetta, grana).
   È più pesante: sui telefoni rallentava, e con i fotogrammi lenti arrivavano in ritardo anche suoni e giroscopio.
   Chiave nuova (scn-luci): chi aveva la vecchia grafica "alta" salvata torna alle luci classiche */
let GFX='classiche';try{if(localStorage.getItem('scn-luci')==='pixel')GFX='pixel';}catch(_){}
const PIXL=GFX==='pixel';
let renderer;
try{renderer=new THREE.WebGLRenderer({canvas,antialias:false,powerPreference:'high-performance'});}
catch(e){$('loadErr').textContent="La grafica 3D (WebGL) non è disponibile in questo browser. Prova con Chrome o Edge aggiornati, con l'accelerazione hardware attiva.";$('loadErr').hidden=false;$('start').disabled=true;return;}
renderer.autoClear=false;
const scene=new THREE.Scene();
scene.background=new THREE.Color(0x070a0d);scene.fog=new THREE.Fog(0x070a0d,6,42);
const camera=new THREE.PerspectiveCamera(72,1,0.05,180);camera.rotation.order='YXZ';
const vmScene=new THREE.Scene();const vmCam=new THREE.PerspectiveCamera(55,1,0.01,10);
let renderScale=0.75;
function resize(){const w=innerWidth,h=innerHeight;renderer.setPixelRatio(renderScale);renderer.setSize(w,h,false);camera.aspect=vmCam.aspect=w/h;camera.updateProjectionMatrix();vmCam.updateProjectionMatrix();}
addEventListener('resize',resize);

/* ---------- post-produzione (grafica alta) ----------
   la scena e l'arma vanno in una texture; da lì: bagliore delle parti luminose (lampadine, fuoco, lampi, occhi) a un quarto della
   risoluzione con sfocatura in due passate, poi sullo schermo FXAA (bordi lisci), curva di tono morbida sulle alte luci,
   un filo di contrasto e saturazione, vignetta e grana leggera */
const POST={on:PIXL,rt:null,ra:null,rb:null,w:0,h:0,bloom:.75};
const fsCam=new THREE.OrthographicCamera(-1,1,1,-1,0,1),fsScene=new THREE.Scene(),fsQuad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),null);fsQuad.frustumCulled=false;fsScene.add(fsQuad);
const FS_VS='varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}';
const fsMat=(u,fs)=>new THREE.ShaderMaterial({uniforms:u,vertexShader:FS_VS,fragmentShader:fs,depthTest:false,depthWrite:false});
const brightMat=fsMat({t:{value:null},px:{value:new THREE.Vector2()}},`uniform sampler2D t;uniform vec2 px;varying vec2 vUv;
  vec3 bp(vec2 o){vec3 c=texture2D(t,vUv+o).rgb;float l=max(c.r,max(c.g,c.b));return c*smoothstep(.8,1.,l);}
  void main(){gl_FragColor=vec4((bp(-px)+bp(vec2(px.x,-px.y))+bp(vec2(-px.x,px.y))+bp(px))*.25,1.);}`);
const blurMat=fsMat({t:{value:null},d:{value:new THREE.Vector2()}},`uniform sampler2D t;uniform vec2 d;varying vec2 vUv;
  void main(){vec3 c=texture2D(t,vUv).rgb*.227027;c+=(texture2D(t,vUv+d*1.384615).rgb+texture2D(t,vUv-d*1.384615).rgb)*.316216;
  c+=(texture2D(t,vUv+d*3.230769).rgb+texture2D(t,vUv-d*3.230769).rgb)*.07027;gl_FragColor=vec4(c,1.);}`);
const compMat=fsMat({t:{value:null},bl:{value:null},px:{value:new THREE.Vector2()},time:{value:0},bloom:{value:.85}},`uniform sampler2D t,bl;uniform vec2 px;uniform float time,bloom;varying vec2 vUv;
  const vec3 LU=vec3(.299,.587,.114);
  vec3 fxaa(vec2 uv){vec3 nw=texture2D(t,uv-px).rgb,ne=texture2D(t,uv+vec2(px.x,-px.y)).rgb,sw=texture2D(t,uv+vec2(-px.x,px.y)).rgb,se=texture2D(t,uv+px).rgb,m=texture2D(t,uv).rgb;
    float a=dot(nw,LU),b=dot(ne,LU),c=dot(sw,LU),d=dot(se,LU),e=dot(m,LU),lo=min(e,min(min(a,b),min(c,d))),hi=max(e,max(max(a,b),max(c,d)));
    if(hi-lo<max(.04,hi*.12))return m;
    vec2 dir=vec2(-((a+b)-(c+d)),(a+c)-(b+d));float red=max((a+b+c+d)*.03125,1./128.);dir=clamp(dir/(min(abs(dir.x),abs(dir.y))+red),-8.,8.)*px;
    vec3 A=.5*(texture2D(t,uv-dir*.1667).rgb+texture2D(t,uv+dir*.1667).rgb),B=A*.5+.25*(texture2D(t,uv-dir*.5).rgb+texture2D(t,uv+dir*.5).rgb);
    float lb=dot(B,LU);return (lb<lo||lb>hi)?A:B;}
  void main(){vec3 c=fxaa(vUv)+texture2D(bl,vUv).rgb*bloom;
    c=c*(1.+c*.51)/(1.+c)*1.3;/* le alte luci si ammorbidiscono invece di bruciare */
    float l=dot(c,LU);c=mix(vec3(l),c,1.1);c=max(vec3(0.),(c-.5)*1.03+.5);
    vec2 q=vUv-.5;c*=mix(.74,1.,1.-smoothstep(.42,.95,length(q*vec2(1.15,1.))));
    c+=(fract(sin(dot(vUv*1000.+time,vec2(12.9898,78.233)))*43758.5453)-.5)*.028;
    gl_FragColor=vec4(c,1.);}`);
const _ds=new THREE.Vector2();
function postSize(){renderer.getDrawingBufferSize(_ds);const w=Math.max(2,_ds.x|0),h=Math.max(2,_ds.y|0);if(POST.rt&&POST.w===w&&POST.h===h)return;
  [POST.rt,POST.ra,POST.rb].forEach(r=>r&&r.dispose());POST.w=w;POST.h=h;const o={minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,format:THREE.RGBAFormat,generateMipmaps:false};
  POST.rt=new THREE.WebGLRenderTarget(w,h,{...o,depthBuffer:true,stencilBuffer:false});const bw=Math.max(2,w>>2),bh=Math.max(2,h>>2);
  POST.ra=new THREE.WebGLRenderTarget(bw,bh,{...o,depthBuffer:false});POST.rb=new THREE.WebGLRenderTarget(bw,bh,{...o,depthBuffer:false});}
function fsPass(mat,to){fsQuad.material=mat;renderer.setRenderTarget(to);renderer.render(fsScene,fsCam);}
// disegna il fotogramma: il mondo e, se vm, l'arma in mano sopra a tutto
function renderFrame(vm,now){
  if(!POST.on){renderer.setRenderTarget(null);renderer.clear();renderer.render(scene,camera);if(vm){renderer.clearDepth();renderer.render(vmScene,vmCam);}return;}
  postSize();renderer.setRenderTarget(POST.rt);renderer.clear();renderer.render(scene,camera);if(vm){renderer.clearDepth();renderer.render(vmScene,vmCam);}
  brightMat.uniforms.t.value=POST.rt.texture;brightMat.uniforms.px.value.set(1/POST.w,1/POST.h);fsPass(brightMat,POST.ra);
  const bw=POST.ra.width,bh=POST.ra.height;
  for(const s of [1,2]){blurMat.uniforms.t.value=POST.ra.texture;blurMat.uniforms.d.value.set(s/bw,0);fsPass(blurMat,POST.rb);
    blurMat.uniforms.t.value=POST.rb.texture;blurMat.uniforms.d.value.set(0,s/bh);fsPass(blurMat,POST.ra);}
  compMat.uniforms.t.value=POST.rt.texture;compMat.uniforms.bl.value=POST.ra.texture;compMat.uniforms.px.value.set(1/POST.w,1/POST.h);compMat.uniforms.time.value=(now||0)%1000/1000;compMat.uniforms.bloom.value=POST.bloom;
  fsPass(compMat,null);}

/* ---------- texture procedurali ----------
   Stessi colori e stessa disposizione delle prime versioni, ma disegnate a risoluzione 4 volte più alta con rumore frattale:
   crepe, macchie, colature, fughe, venature, ruggine, sporco in basso. Il rumore ha lo stesso periodo della texture,
   quindi si ripetono senza cuciture; si filtrano morbide (mipmap + anisotropico) invece che a quadretti */
const ANISO=Math.min(8,renderer.capabilities.getMaxAnisotropy()||1);
function makeTex(w,h,seed,draw,nearest){const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');draw(g,w,h,mulberry32(seed));
  const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;if(nearest)t.magFilter=THREE.NearestFilter;t.anisotropy=ANISO;return t;}
// rilievo (solo luci per pixel): la stessa immagine della texture
const BUMPS=new Map();function bumpTex(t){if(BUMPS.has(t))return BUMPS.get(t);const b=new THREE.CanvasTexture(t.image);b.wrapS=b.wrapT=THREE.RepeatWrapping;b.anisotropy=ANISO;BUMPS.set(t,b);return b;}
function speckle(g,x0,y0,w,h,r,n,cols,s=1){for(let i=0;i<n;i++){g.fillStyle=cols[(r()*cols.length)|0];g.fillRect(x0+((r()*w)|0),y0+((r()*h)|0),s,s);}}
// rumore a valori ripetibile con periodo px×py, e la sua somma su più ottave (u,v in 0..1)
function tNoise(seed,px,py){const r=mulberry32(seed),v=new Float32Array(px*py);for(let i=0;i<v.length;i++)v[i]=r();
  return (x,y)=>{const xi=Math.floor(x),yi=Math.floor(y),xf=x-xi,yf=y-yi,x0=((xi%px)+px)%px,x1=(x0+1)%px,y0=((yi%py)+py)%py,y1=(y0+1)%py,u=xf*xf*(3-2*xf),w=yf*yf*(3-2*yf);
    const a=v[y0*px+x0],b=v[y0*px+x1],c=v[y1*px+x0],d=v[y1*px+x1];return a+(b-a)*u+(c-a)*w+(a-b-c+d)*u*w;};}
function fbm(seed,fx,fy,oct=4){const L=[];for(let o=0;o<oct;o++)L.push([tNoise(seed+o*977,fx<<o,fy<<o),fx<<o,fy<<o]);
  return (u,v)=>{let s=0,a=1,t=0;for(const [n,px,py] of L){s+=a*n(u*px,v*py);t+=a;a*=.5;}return s/t;};}
// riempie la tela pixel per pixel: fn(u,v,x,y) → [r,g,b]
function pix(g,w,h,fn){const im=g.createImageData(w,h),d=im.data;for(let y=0;y<h;y++)for(let x=0;x<w;x++){const c=fn(x/w,y/h,x,y),o=(y*w+x)*4;d[o]=c[0];d[o+1]=c[1];d[o+2]=c[2];d[o+3]=255;}g.putImageData(im,0,0);}
const hexRGB=h=>[(h>>16)&255,(h>>8)&255,h&255],mixC=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t],mulC=(a,k)=>[a[0]*k,a[1]*k,a[2]*k];
// disegna anche le copie spostate di una texture intera, così quello che esce da un bordo rientra dall'altro
function wrapDo(w,h,fn){for(const ox of[-w,0,w])for(const oy of[-h,0,h])fn(ox,oy);}
function crackLine(g,r,x,y,len,w,h){const pts=[[x,y]];let a=r()*Math.PI*2;for(let s=0;s<len;s+=4){a+=(r()-.5)*.9;x+=Math.cos(a)*4;y+=Math.sin(a)*4;pts.push([x,y]);}
  wrapDo(w,h,(ox,oy)=>{g.beginPath();pts.forEach(([px,py],i)=>i?g.lineTo(px+ox,py+oy):g.moveTo(px+ox,py+oy));g.stroke();});}
function stainW(g,w,h,x,y,rx,ry,col){wrapDo(w,h,(ox,oy)=>{const gr=g.createRadialGradient(x+ox,y+oy,0,x+ox,y+oy,rx);gr.addColorStop(0,col);gr.addColorStop(1,'rgba(0,0,0,0)');
  g.save();g.translate(x+ox,y+oy);g.scale(1,ry/rx);g.translate(-x-ox,-y-oy);g.fillStyle=gr;g.fillRect(x+ox-rx,y+oy-rx,rx*2,rx*2);g.restore();});}
// piastrelle: lato del quadrato in pixel, fuga, due colori a scacchi (o uno solo), variazione per piastrella
function tileTex(w,h,seed,side,grout,cA,cB,gcol,extra){return makeTex(w,h,seed,(g,W,H,r)=>{const n=fbm(seed*7+1,4,4,5),m=fbm(seed*7+2,16,16,2),tv=[];for(let i=0;i<256;i++)tv.push(.9+r()*.16);const nx=W/side;
  pix(g,W,H,(u,v,x,y)=>{const tx=(x/side)|0,ty=(y/side)|0,xx=x%side,yy=y%side,a=n(u,v),b=m(u,v);
    if(xx<grout||yy<grout)return mulC(gcol,.75+a*.4);let c=mulC(((tx+ty)%2&&cB)?cB:cA,tv[(ty*nx+tx)&255]*(.88+a*.2)+(b-.5)*.1+(r()-.5)*.045);
    if(xx<grout+2||yy<grout+2)c=mulC(c,.86);else if(xx>side-3||yy>side-3)c=mulC(c,1.05);/* bordo smussato */
    return mixC(c,[85,80,64],Math.max(0,a-.6)*1.1);});/* sporco dove si cammina di più */
  if(extra)extra(g,W,H,r);});}
const TX={
  wall:makeTex(256,408,7,(g,w,h,r)=>{const n=fbm(71,4,6,5),m=fbm(72,8,12,3),f=fbm(73,32,48,2),ty=Math.round(h*.64);const P=hexRGB(0x9a9684),G=hexRGB(0x46584f),C=[118,114,100];
    pix(g,w,h,(u,v,x,y)=>{const a=n(u,v),b=m(u,v),gr=(f(u,v)-.5)*.12+(r()-.5)*.05;let c;
      if(y<ty){c=mulC(P,.84+a*.3+gr);if(b>.68)c=mixC(c,mulC(C,.9+a*.2),Math.min(1,(b-.68)*9));}/* intonaco scrostato */
      else{c=mulC(G,.8+a*.35+gr);if(b>.72)c=mixC(c,[92,96,86],Math.min(1,(b-.72)*8));}/* vernice verde graffiata */
      const k=Math.max(0,(v-.84)/.16);return mulC(c,1-.55*k*k);});
    for(let i=0;i<14;i++){const x=r()*w,y0=r()*ty*.6,L=30+r()*170,wd=2+r()*6,gr=g.createLinearGradient(0,y0,0,y0+L);gr.addColorStop(0,'rgba(60,52,34,0)');gr.addColorStop(.2,'rgba(60,52,34,.28)');gr.addColorStop(1,'rgba(60,52,34,0)');g.fillStyle=gr;for(const o of[-w,0,w])g.fillRect(x+o,y0,wd,L);}
    g.strokeStyle='rgba(40,36,26,.5)';g.lineWidth=1;for(let i=0;i<5;i++)crackLine(g,r,r()*w,r()*ty*.9,40+r()*90,w,h);
    g.fillStyle='#262f2a';g.fillRect(0,ty-6,w,8);g.fillStyle='rgba(255,255,240,.12)';g.fillRect(0,ty+2,w,2);g.fillStyle='rgba(15,18,15,.5)';g.fillRect(0,h-14,w,14);}),
  wallOut:makeTex(256,408,8,(g,w,h,r)=>{const n=fbm(81,4,6,5),f=fbm(82,32,48,2),RH=51,BW=128,base=hexRGB(0x6f6d64),tone=[];for(let i=0;i<64;i++)tone.push(.86+r()*.22);
    pix(g,w,h,(u,v,x,y)=>{const row=(y/RH)|0,yy=y-row*RH,off=row%2?BW/2:0,xr=(x+off)%w,col=(xr/BW)|0,xx=xr%BW,mm=Math.min(yy,RH-1-yy,xx,BW-1-xx),a=n(u,v),gr=(f(u,v)-.5)*.14+(r()-.5)*.05;
      let c=mulC(base,tone[(row*7+col)%64]*(.86+a*.28)+gr);if(mm<3)c=mulC([77,75,68],.78+a*.3);else if(mm<5)c=mulC(c,(yy<5||xx<5)?1.12:.8);
      return mixC(c,[38,46,28],Math.max(0,(v-.78)/.22)*.55);});/* muschio e sporco in basso */
    g.strokeStyle='rgba(35,34,30,.5)';for(let i=0;i<4;i++)crackLine(g,r,r()*w,r()*h,30+r()*60,w,h);}),
  brick:makeTex(256,408,31,(g,w,h,r)=>{const n=fbm(91,8,12,4),f=fbm(92,32,48,2),RH=24,BW=64,cols=[];for(let i=0;i<300;i++)cols.push([90+r()*40,45+r()*20,32+r()*14]);
    pix(g,w,h,(u,v,x,y)=>{const row=(y/RH)|0,yy=y-row*RH,off=row%2?32:0,xr=(x+off)%w,col=(xr/BW)|0,xx=xr%BW,a=n(u,v),gr=(f(u,v)-.5)*.16+(r()-.5)*.06;
      let c;if(yy<3||xx<3)c=mulC([70,62,55],.75+a*.4);else{c=mulC(cols[(row*5+col)%300],.85+a*.3+gr);if(yy<5||xx<5)c=mulC(c,.82);if(a>.7)c=mixC(c,[60,50,44],(a-.7)*2);}
      const s=Math.abs(v-.5)*2;return mulC(c,1-.5*s*s*s);});}),/* fuliggine in alto e in basso */
  plaster:makeTex(128,128,11,(g,w,h,r)=>{const n=fbm(111,4,4,5),f=fbm(112,24,24,2),B=hexRGB(0x8c8876);
    pix(g,w,h,(u,v)=>mulC(B,.86+n(u,v)*.24+(f(u,v)-.5)*.1+(r()-.5)*.04));g.strokeStyle='rgba(60,56,44,.4)';for(let i=0;i<3;i++)crackLine(g,r,r()*w,r()*h,30+r()*40,w,h);}),
  concrete:makeTex(128,128,13,(g,w,h,r)=>{const n=fbm(131,4,4,5),m=fbm(132,16,16,2),B=hexRGB(0x5f5e58);
    pix(g,w,h,(u,v)=>{let c=mulC(B,.82+n(u,v)*.34+(m(u,v)-.5)*.12+(r()-.5)*.08);if(r()<.012)c=mulC(c,r()<.5?1.25:.7);return c;});
    stainW(g,w,h,80,48,26,14,'rgba(25,22,18,.32)');stainW(g,w,h,r()*w,r()*h,18,18,'rgba(30,26,20,.2)');g.strokeStyle='rgba(30,28,24,.5)';for(let i=0;i<2;i++)crackLine(g,r,r()*w,r()*h,40+r()*50,w,h);
    g.fillStyle='#46453f';g.fillRect(0,h-3,w,3);g.fillRect(w-3,0,3,h);g.fillStyle='rgba(255,255,255,.07)';g.fillRect(0,0,w,1);g.fillRect(0,0,1,h);}),
  concrete2:makeTex(128,128,14,(g,w,h,r)=>{const n=fbm(141,4,4,5),m=fbm(142,20,20,2),B=hexRGB(0x4b4c4a);
    pix(g,w,h,(u,v)=>mulC(B,.84+n(u,v)*.3+(m(u,v)-.5)*.1+(r()-.5)*.07));stainW(g,w,h,r()*w,r()*h,24,16,'rgba(20,20,18,.3)');g.fillStyle='#383937';g.fillRect(0,h-3,w,3);}),
  checker:tileTex(128,128,3,32,2,hexRGB(0xaaa38c),hexRGB(0x3a3c36),[45,44,38]),
  checker2:tileTex(128,128,4,64,2,hexRGB(0xc1c3b6),hexRGB(0x8c948f),[70,72,66]),
  tiles:tileTex(128,128,5,32,2,hexRGB(0xb8bdb4),null,hexRGB(0x5f6660),(g,w,h,r)=>{stainW(g,w,h,84,48,22,30,'rgba(70,90,60,.35)');/* muffa */
    g.strokeStyle='rgba(60,64,58,.7)';for(let i=0;i<3;i++){const tx=(r()*4|0)*32+4,ty=(r()*4|0)*32+4;g.beginPath();g.moveTo(tx+r()*24,ty);g.lineTo(tx+r()*24,ty+12+r()*12);g.lineTo(tx+r()*24,ty+24);g.stroke();}}),
  tiles2:tileTex(128,128,6,64,2,hexRGB(0x8a4d38),null,hexRGB(0x3d2219)),
  dirt:makeTex(128,128,9,(g,w,h,r)=>{const n=fbm(191,4,4,5),m=fbm(192,8,8,3),B=hexRGB(0x3d3829);
    pix(g,w,h,(u,v)=>{const a=n(u,v),b=m(u,v);let c=mulC(B,.72+a*.5+(r()-.5)*.14);if(b>.6)c=mixC(c,[62,74,42],Math.min(1,(b-.6)*3));return c;});
    for(let i=0;i<45;i++){const x=r()*w,y=r()*h,s=1+r()*3;wrapDo(w,h,(ox,oy)=>{g.fillStyle=`rgba(${80+r()*40|0},${74+r()*30|0},${60+r()*20|0},.9)`;g.beginPath();g.ellipse(x+ox,y+oy,s,s*.7,r()*3,0,7);g.fill();g.fillStyle='rgba(15,12,8,.5)';g.fillRect(x+ox-s,y+oy+s*.6,s*2,1);});}}),
  parquet:makeTex(128,128,15,(g,w,h,r)=>{const gn=fbm(151,2,24,4),st=[];for(let s=0;s<8;s++)st.push({t:.82+r()*.3,c:(r()*w)|0});
    pix(g,w,h,(u,v,x,y)=>{const s=(y/16)|0,yy=y%16,S=st[s],a=gn(u,v);if(yy<1||((x-S.c+w)%w)<1)return [43,28,16];return mulC([90,59,36],S.t*(.78+a*.44)+(r()-.5)*.05);});}),
  planks:makeTex(128,128,16,(g,w,h,r)=>{const gn=fbm(161,24,2,4),pt=[];for(let i=0;i<4;i++)pt.push(.82+r()*.3);
    pix(g,w,h,(u,v,x,y)=>{const p=(x/32)|0,xx=x%32;if(xx>=29)return [26,22,17];return mulC([74,61,46],pt[p]*(.75+gn(u,v)*.5)+(r()-.5)*.06);});
    g.fillStyle='#1c1814';for(let p=0;p<4;p++)for(const y of[6,121]){g.beginPath();g.arc(p*32+9,y,1.6,0,7);g.arc(p*32+21,y,1.6,0,7);g.fill();}}),
  grate:makeTex(128,128,18,(g,w,h,r)=>{const n=fbm(181,8,8,3);
    pix(g,w,h,(u,v,x,y)=>{const xx=x%16,yy=y%16,a=n(u,v);if(xx>=4&&yy>=4)return mulC([24,26,26],.7+a*.5);
      let c=mulC([90,95,92],.75+a*.4+(r()-.5)*.08);if(a>.62)c=mixC(c,[110,74,42],Math.min(1,(a-.62)*4));if(xx===0||yy===0)c=mulC(c,1.25);if(xx===3||yy===3)c=mulC(c,.6);return c;});}),
  ground:makeTex(128,128,21,(g,w,h,r)=>{const n=fbm(211,4,4,5),B=hexRGB(0x24211a);
    pix(g,w,h,(u,v)=>{const a=n(u,v);let c=mulC(B,.7+a*.6+(r()-.5)*.16);if(a>.66)c=mixC(c,[40,48,31],(a-.66)*2.5);return c;});
    for(let i=0;i<30;i++){const x=r()*w,y=r()*h,s=1+r()*2.5;wrapDo(w,h,(ox,oy)=>{g.fillStyle='rgba(70,66,56,.8)';g.beginPath();g.ellipse(x+ox,y+oy,s,s*.6,r()*3,0,7);g.fill();});}}),
  rock:makeTex(128,128,22,(g,w,h,r)=>{const n=fbm(221,4,4,5),m=fbm(222,8,8,4),B=hexRGB(0x35332d);
    pix(g,w,h,(u,v)=>{const a=n(u,v),b=1-Math.abs(m(u,v)*2-1);return mulC(B,.62+a*.5+b*b*.35+(r()-.5)*.1);});/* creste */
    g.strokeStyle='rgba(15,14,12,.65)';g.lineWidth=1.5;for(let i=0;i<6;i++)crackLine(g,r,r()*w,r()*h,30+r()*60,w,h);}),
  stairs:makeTex(128,128,23,(g,w,h,r)=>{const n=fbm(231,4,4,4),B=hexRGB(0x63625b);
    pix(g,w,h,(u,v,x,y)=>{const yy=y%32,a=n(u,v);let c=mulC(B,.82+a*.3+(r()-.5)*.08);if(yy<6)c=mulC(c,.5);else if(yy<9)c=mulC(c,1.25);else if(yy>27)c=mulC(c,.9);return c;});}),
  wood:makeTex(128,128,17,(g,w,h,r)=>{const gn=fbm(171,2,20,4),k=fbm(172,4,4,2);
    pix(g,w,h,(u,v)=>{const a=gn(u,v),b=k(u,v),rings=.5+.5*Math.sin((v*12+a*3)*Math.PI*2);return mulC([93,65,40],.7+a*.35+rings*.12-(b>.7?(b-.7)*.8:0)+(r()-.5)*.05);});}),
  ceil:makeTex(128,128,24,(g,w,h,r)=>{const n=fbm(241,4,4,5),B=hexRGB(0x2f302b);
    pix(g,w,h,(u,v,x,y)=>{let c=mulC(B,.85+n(u,v)*.3+(r()-.5)*.07);if(x<2||y<2)c=[30,31,27];return c;});
    for(let i=0;i<2;i++){const x=r()*w,y=r()*h,rr=10+r()*14;wrapDo(w,h,(ox,oy)=>{g.strokeStyle='rgba(70,56,34,.35)';g.lineWidth=2;g.beginPath();g.ellipse(x+ox,y+oy,rr,rr*.7,r(),0,7);g.stroke();});stainW(g,w,h,x,y,rr,rr*.7,'rgba(60,48,30,.25)');}}),
  water:makeTex(128,128,25,(g,w,h,r)=>{const n=fbm(251,4,4,4),m=fbm(252,2,16,3);
    pix(g,w,h,(u,v)=>{const a=n(u,v),b=m(u,v);return mixC([12,32,37],[58,96,106],Math.max(0,a-.45)*.9+Math.max(0,b-.6)*.6);});}),
  lava:makeTex(64,64,26,(g,w,h,r)=>{g.fillStyle='#ff6a12';g.fillRect(0,0,w,h);for(let i=0;i<140;i++){g.fillStyle=pick(['#ffb030','#ff8a1a','#c83a08','#ffd060','#8a2004']);g.beginPath();g.ellipse(r()*w,r()*h,2+r()*7,1+r()*3,r()*3,0,7);g.fill();}}),
  rust:makeTex(128,128,27,(g,w,h,r)=>{const n=fbm(271,4,4,5),m=fbm(272,16,16,2);
    pix(g,w,h,(u,v)=>{const a=n(u,v),b=m(u,v);let c=mixC([74,46,30],[128,78,44],a);c=mulC(c,.8+b*.35+(r()-.5)*.12);if(b<.3)c=mulC(c,.6);return c;});}),
  // grana chiara per gli arredi in tinta unita (metallo, pietra, smalto): moltiplica il loro colore, quasi bianca
  grime:makeTex(128,128,28,(g,w,h,r)=>{const n=fbm(281,4,4,5),m=fbm(282,16,16,2);
    pix(g,w,h,(u,v)=>{const k=225+n(u,v)*35+(m(u,v)-.5)*20+(r()-.5)*10,c=Math.min(255,k);return [c,c*.98,c*.95];});stainW(g,w,h,r()*w,r()*h,20,14,'rgba(60,50,40,.25)');}),
};
TX.grime.repeat.set(.5,.5);
// materiali: con le luci classiche quelli di sempre (Lambert, luce per vertice); con le luci per pixel Phong con un filo di riflesso
const LM=o=>{if(PIXL)return new THREE.MeshPhongMaterial({side:THREE.DoubleSide,shininess:8,specular:0x0b0b0b,...o});
  const {bumpMap,bumpScale,shininess,specular,...r}=o;return new THREE.MeshLambertMaterial({side:THREE.DoubleSide,...r});};
/* texture della cittadina (Silver Falls): asfalto, erba di notte, muratura di pietra, assi di legno dipinte in cinque colori */
Object.assign(TX,{
  asphalt:makeTex(128,128,41,(g,w,h,r)=>{const n=fbm(411,4,4,5),m=fbm(412,16,16,3),B=hexRGB(0x2c2d2e);
    pix(g,w,h,(u,v)=>{const a=n(u,v),b=m(u,v);let c=mulC(B,.78+a*.36+(r()-.5)*.22);if(r()<.05)c=mulC(c,r()<.5?1.45:.6);if(b>.7)c=mixC(c,[22,22,23],(b-.7)*2.2);return c;});/* ghiaia, toppe */
    g.strokeStyle='rgba(12,12,12,.7)';g.lineWidth=1.2;for(let i=0;i<4;i++)crackLine(g,r,r()*w,r()*h,30+r()*60,w,h);stainW(g,w,h,r()*w,r()*h,16,10,'rgba(10,10,14,.35)');}),/* crepe e macchie d'olio */
  grass:makeTex(128,128,42,(g,w,h,r)=>{const n=fbm(421,4,4,5),m=fbm(422,8,8,3),B=hexRGB(0x2a3a22);
    pix(g,w,h,(u,v)=>{const a=n(u,v),b=m(u,v);let c=mulC(B,.7+a*.5+(r()-.5)*.25);if(b>.62)c=mixC(c,[58,48,30],Math.min(1,(b-.62)*2.5));return c;});
    for(let i=0;i<500;i++){const x=r()*w,y=r()*h;g.strokeStyle=`rgba(${60+r()*40|0},${80+r()*40|0},${40+r()*20|0},.6)`;g.beginPath();g.moveTo(x,y);g.lineTo(x+(r()-.5)*3,y-2-r()*4);g.stroke();}}),
  masonry:makeTex(256,408,43,(g,w,h,r)=>{const n=fbm(431,4,6,5),f=fbm(432,32,48,2),rows=[];let y=0;while(y<h){const rh=30+((r()*14)|0);rows.push([y,Math.min(h,y+rh)]);y+=rh;}
    const blocks=rows.map(([y0])=>{const L=[];let x=r()*40|0;while(x<w+60){const bw=40+(r()*50|0);L.push([x,bw,.8+r()*.3,r()]);x+=bw;}return L;});
    pix(g,w,h,(u,v,x,y)=>{let ri=0;while(ri<rows.length-1&&y>=rows[ri][1])ri++;const [y0,y1]=rows[ri],bl=blocks[ri];let b=bl[0];for(const q of bl){const xs=((x-q[0])%w+w)%w;if(xs<q[1]){b=q;break;}}
      const xx=((x-b[0])%w+w)%w,yy=y-y0,mm=Math.min(xx,b[1]-xx,yy,y1-y0-yy),a=n(u,v),gr=(f(u,v)-.5)*.16;
      if(mm<2)return mulC([58,56,50],.7+a*.4);let c=mulC([112+b[3]*20,108+b[3]*14,98],b[2]*(.8+a*.3)+gr+(r()-.5)*.05);if(mm<4)c=mulC(c,.82);
      return mixC(c,[40,52,32],Math.max(0,(v-.8)/.2)*.5);});}),/* muschio in basso */
});
function sidingTex(seed,col){return makeTex(256,408,seed,(g,w,h,r)=>{const n=fbm(seed*3+1,2,24,4),m=fbm(seed*3+2,8,12,3),B=hexRGB(col),BH=24;
  pix(g,w,h,(u,v,x,y)=>{const yy=y%BH,a=n(u,v),b=m(u,v);let c=mulC(B,.82+a*.22+(r()-.5)*.05);
    if(yy<2)c=mulC(c,.45);else if(yy<5)c=mulC(c,.78);else if(yy>BH-3)c=mulC(c,1.08);/* ombra sotto ogni asse */
    if(b>.66)c=mixC(c,[96,82,64],Math.min(1,(b-.66)*3));/* vernice scrostata: legno grigio sotto */
    return mixC(c,[30,28,22],Math.max(0,(v-.8)/.2)*.5);});/* sporco in basso */
  for(let i=0;i<8;i++){const x=r()*w,y0=r()*h*.5,L=40+r()*120,gr=g.createLinearGradient(0,y0,0,y0+L);gr.addColorStop(0,'rgba(40,30,20,0)');gr.addColorStop(.3,'rgba(40,30,20,.25)');gr.addColorStop(1,'rgba(40,30,20,0)');g.fillStyle=gr;g.fillRect(x,y0,3+r()*4,L);}});}
Object.assign(TX,{sidingW:sidingTex(51,0xcfc6a8),sidingG:sidingTex(52,0x5d7a5a),sidingR:sidingTex(53,0x8a3a2e),sidingB:sidingTex(54,0x5a6f80),sidingY:sidingTex(55,0xb89a52)});
// per superficie: forza del rilievo e riflesso [intensità, lucentezza]
const SURF={wall:{b:.035},wallOut:{b:.04},brick:{b:.06,s:[.05,8]},plaster:{b:.02},concrete:{b:.045,s:[.07,14]},concrete2:{b:.045,s:[.07,14]},checker:{b:.015,s:[.24,42]},
  checker2:{b:.015,s:[.26,46]},tiles:{b:.03,s:[.32,56]},tiles2:{b:.03,s:[.2,34]},dirt:{b:.06},parquet:{b:.03,s:[.13,26]},planks:{b:.05,s:[.06,12]},grate:{b:.07,s:[.3,30]},
  ground:{b:.05},rock:{b:.08,s:[.05,8]},stairs:{b:.05,s:[.09,16]},wood:{b:.03,s:[.07,16]},ceil:{b:.03},rust:{b:.06,s:[.14,18]},
  asphalt:{b:.05,s:[.05,10]},grass:{b:.06},masonry:{b:.08,s:[.04,8]},sidingW:{b:.04},sidingG:{b:.04},sidingR:{b:.04},sidingB:{b:.04},sidingY:{b:.04}};
function SM(k,extra){const t=TX[k],S=SURF[k]||{},o={map:t,...extra};if(PIXL){if(S.b)o.bumpMap=bumpTex(t),o.bumpScale=S.b;const s=S.s||[.03,6];o.specular=new THREE.Color(s[0],s[0],s[0]);o.shininess=s[1];}return LM(o);}
const SHINY=(c,s,sh,map)=>LM({color:c,specular:new THREE.Color(s,s,s),shininess:sh,...(map?{map}:{})}),GR=c=>LM({color:c,map:TX.grime});/* GR: tinta unita con un po' di grana */
const MAT={
  wall:SM('wall'),wallOut:SM('wallOut'),brick:SM('brick'),wallTop:GR(0x3a3934),plaster:SM('plaster'),ledge:SM('rock'),
  ceil:SM('ceil'),stairs:SM('stairs'),ground:SM('ground'),rock:SM('rock'),grate:SM('grate'),
  concrete:SM('concrete'),concrete2:SM('concrete2'),checker:SM('checker'),checker2:SM('checker2'),
  tiles:SM('tiles'),tiles2:SM('tiles2'),dirt:SM('dirt'),parquet:SM('parquet'),planks:SM('planks'),
  wood:SM('wood'),woodDark:GR(0x3b2a1a),metal:SHINY(0x5b625f,.4,40,TX.grime),metalDark:SHINY(0x2a2e2d,.32,34,TX.grime),bars:SHINY(0x33383a,.42,44),
  white:GR(0xb4b0a0),mattress:GR(0x8a846c),stone:GR(0x6e6c62),rust:SM('rust'),green:GR(0x3f4a3f),yellow:SHINY(0xb08a2a,.25,30,TX.grime),
  gunMetal:SHINY(0x2c3032,.5,50),gunDark:SHINY(0x17191a,.4,40),gunWood:SHINY(0x6a4327,.12,20),rayBody:SHINY(0x3c4c40,.3,30),
  redPaint:SHINY(0x8a2a1c,.18,20,TX.grime),cable:SHINY(0x3a2a24,.2,20),
  rayGlow:new THREE.MeshBasicMaterial({color:0x7dff9a}),vortGlow:new THREE.MeshBasicMaterial({color:0xb77dff}),lampGlow:new THREE.MeshBasicMaterial({color:0xffe6b0}),
  lava:new THREE.MeshBasicMaterial({map:TX.lava}),hot:new THREE.MeshBasicMaterial({color:0xff7a22}),
  skin:LM({color:0x9d8a76}),sleeve:LM({color:0x3d4a57}),
  asphalt:SM('asphalt'),grass:SM('grass'),masonry:SM('masonry'),sidingW:SM('sidingW'),sidingG:SM('sidingG'),sidingR:SM('sidingR'),sidingB:SM('sidingB'),sidingY:SM('sidingY'),
  carRed:SHINY(0x7a2420,.35,40,TX.grime),carBlue:SHINY(0x2b4a6a,.35,40,TX.grime),carCream:SHINY(0xcfc4a4,.35,40,TX.grime),carGreen:SHINY(0x34503a,.35,40,TX.grime),
  carBlack:SHINY(0x1c1d20,.4,50,TX.grime),carMustard:SHINY(0x9a7a34,.35,40,TX.grime),glassDark:SHINY(0x161c22,.8,90),tire:GR(0x161616),orange:LM({color:0xd06a1a,emissive:0x3a1400}),
  neon:new THREE.MeshBasicMaterial({color:0xff5a7a}),neonB:new THREE.MeshBasicMaterial({color:0x6ad0ff}),
};

/* ---------- geometrie unite ---------- */
// forme di collisione degli arredi per i proiettili: registrate mentre si costruiscono gli arredi, esattamente come si vedono
let COLREC=false;const PROPCOL=[];
function colBox(cx,cy,cz,w,h,d,ry=0){const c=Math.abs(Math.cos(ry)),s=Math.abs(Math.sin(ry));const hw=w/2*c+d/2*s,hd=w/2*s+d/2*c;PROPCOL.push({t:'b',x0:cx-hw,x1:cx+hw,y0:cy-h/2,y1:cy+h/2,z0:cz-hd,z1:cz+hd});}
// geometria unita: quad con colore per vertice (grigio, 1 = pieno) per le ombre negli angoli e alla base degli arredi
const BOX_AO=.72;
class Geo{
  constructor(){this.p=[];this.n=[];this.u=[];this.i=[];this.c=[];}
  quad(v0,v1,v2,v3,uv,cols){const b=this.p.length/3;const ax=v1[0]-v0[0],ay=v1[1]-v0[1],az=v1[2]-v0[2],bx=v2[0]-v0[0],by=v2[1]-v0[1],bz=v2[2]-v0[2];
    let nx=ay*bz-az*by,ny=az*bx-ax*bz,nz=ax*by-ay*bx;const l=Math.hypot(nx,ny,nz)||1;nx/=l;ny/=l;nz/=l;
    for(const v of [v0,v1,v2,v3]){this.p.push(v[0],v[1],v[2]);this.n.push(nx,ny,nz);}for(const t of uv)this.u.push(t[0],t[1]);this.i.push(b,b+1,b+2,b,b+2,b+3);
    if(cols)this.c.push(cols[0],cols[1],cols[2],cols[3]);else this.c.push(1,1,1,1);}
  vwall(ax,az,bx,bz,ya0,yb0,ya1,yb1,nx,nz,vb,cols){
    if((-(bz-az))*nx+(bx-ax)*nz<0){[ax,bx]=[bx,ax];[az,bz]=[bz,az];[ya0,yb0]=[yb0,ya0];[ya1,yb1]=[yb1,ya1];if(cols)cols=[cols[1],cols[0],cols[3],cols[2]];}
    const ua=(ax+az)/2,ub=(bx+bz)/2;const v0=vb??Math.min(ya0,yb0);
    this.quad([ax,ya0,az],[bx,yb0,bz],[bx,yb1,bz],[ax,ya1,az],[[ua,(ya0-v0)/3.2],[ub,(yb0-v0)/3.2],[ub,(yb1-v0)/3.2],[ua,(ya1-v0)/3.2]],cols);}
  box(cx,cy,cz,w,h,d,ry=0){if(COLREC)colBox(cx,cy,cz,w,h,d,ry);const x0=-w/2,x1=w/2,y0=cy-h/2,y1=cy+h/2,z0=-d/2,z1=d/2,c=Math.cos(ry),s=Math.sin(ry);const T=(x,y,z)=>[cx+x*c+z*s,y,cz-x*s+z*c];
    const ao=h>.2?BOX_AO:1;/* la base delle scatole un po' più scura: sembra appoggiata */
    const F=(a,b,cc,dd,uw,vh)=>this.quad(T(...a),T(...b),T(...cc),T(...dd),[[0,0],[uw,0],[uw,vh],[0,vh]],[a,b,cc,dd].map(v=>v[1]<=y0+1e-6?ao:1));
    F([x1,y0,z1],[x1,y0,z0],[x1,y1,z0],[x1,y1,z1],d,h);F([x0,y0,z0],[x0,y0,z1],[x0,y1,z1],[x0,y1,z0],d,h);
    F([x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1],w,h);F([x1,y0,z0],[x0,y0,z0],[x0,y1,z0],[x1,y1,z0],w,h);
    F([x0,y1,z0],[x0,y1,z1],[x1,y1,z1],[x1,y1,z0],w,d);F([x0,y0,z0],[x1,y0,z0],[x1,y0,z1],[x0,y0,z1],w,d);}
  cyl(cx,cy,cz,r,len,axis,seg=8,caps=false){
    if(COLREC){if(axis==='y')PROPCOL.push({t:'c',x:cx,z:cz,r,y0:cy-len/2,y1:cy+len/2});else colBox(cx,cy,cz,axis==='x'?len:r*2,r*2,axis==='z'?len:r*2);}
    const P=(a,t)=>{const u=Math.cos(a)*r,v=Math.sin(a)*r;return axis==='y'?[cx+u,cy+t,cz+v]:axis==='x'?[cx+t,cy+u,cz+v]:[cx+u,cy+v,cz+t];};
    for(let k=0;k<seg;k++){const a0=k/seg*Math.PI*2,a1=(k+1)/seg*Math.PI*2;let q=[P(a0,-len/2),P(a1,-len/2),P(a1,len/2),P(a0,len/2)];
      const mx=(q[0][0]+q[1][0])/2-cx,my=(q[0][1]+q[1][1])/2-cy,mz=(q[0][2]+q[1][2])/2-cz;
      const ax=q[1][0]-q[0][0],ay=q[1][1]-q[0][1],az=q[1][2]-q[0][2],bx=q[2][0]-q[0][0],by=q[2][1]-q[0][1],bz=q[2][2]-q[0][2];
      if((ay*bz-az*by)*mx+(az*bx-ax*bz)*my+(ax*by-ay*bx)*mz<0)q=[q[1],q[0],q[3],q[2]];
      this.quad(q[0],q[1],q[2],q[3],[[k/seg*2,0],[(k+1)/seg*2,0],[(k+1)/seg*2,len],[k/seg*2,len]],axis==='y'&&len>.3?[BOX_AO,BOX_AO,1,1]:null);
      if(caps){const c1=axis==='y'?[cx,cy+len/2,cz]:axis==='x'?[cx+len/2,cy,cz]:[cx,cy,cz+len/2];const a=P(a0,len/2),b=P(a1,len/2);
        let tri=[c1,a,b];const n1=(a[1]-c1[1])*(b[2]-c1[2])-(a[2]-c1[2])*(b[1]-c1[1]);const up=axis==='y'?1:0;if(up&&((a[2]-c1[2])*(b[0]-c1[0])-(a[0]-c1[0])*(b[2]-c1[2]))<0)tri=[c1,b,a];
        this.quad(tri[0],tri[1],tri[2],tri[2],[[0,0],[1,0],[1,1],[1,1]]);
        if(axis!=='y'){const c0=axis==='x'?[cx-len/2,cy,cz]:[cx,cy,cz-len/2];const a2=P(a0,-len/2),b2=P(a1,-len/2);this.quad(c0,b2,a2,a2,[[0,0],[1,0],[1,1],[1,1]]);}}}}
  mesh(mat){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(this.p,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(this.n,3));
    g.setAttribute('uv',new THREE.Float32BufferAttribute(this.u,2));
    {const C=new Float32Array(this.c.length*3);for(let k=0;k<this.c.length;k++)C[k*3]=C[k*3+1]=C[k*3+2]=this.c[k];g.setAttribute('color',new THREE.BufferAttribute(C,3));}g.setIndex(this.p.length/3>65000?new THREE.Uint32BufferAttribute(this.i,1):new THREE.Uint16BufferAttribute(this.i,1));g.computeBoundingSphere();
    const m=new THREE.Mesh(g,mat);m.matrixAutoUpdate=false;return m;}
}
const texRegistry=[];
function textTex(w,h,draw){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new THREE.CanvasTexture(c);t.magFilter=THREE.LinearFilter;texRegistry.push({c,draw,t});return t;}
function redrawTextTextures(){texRegistry.forEach(({c,draw,t})=>{const g=c.getContext('2d');g.clearRect(0,0,c.width,c.height);draw(g,c.width,c.height);t.needsUpdate=true;});}
function yawFromFace(f){return Math.atan2(-f[0],-f[1]);}

/* =========================================================
   AUDIO SINTETIZZATO + VOCE DEI NASTRI
   ========================================================= */
const SHOTS={
  pistol:{c:.5,b:.55,bf:2600,bd:.13,t:.45,tf:170,td:.11,m:.14,mf:2700,l:.16,ld:.45,rv:.4},
  revolver:{c:.6,b:.8,bf:2300,bd:.26,t:.7,tf:120,td:.2,m:.08,mf:1600,mt:.06,l:.3,ld:.9,rv:.6},
  rifle:{c:.6,b:.7,bf:3000,bd:.22,t:.55,tf:125,td:.17,m:.18,mf:2200,mt:.05,l:.28,ld:.8,rv:.6},
  sniper:{c:.75,b:.9,bf:3300,bd:.4,t:.8,tf:95,td:.32,m:.2,mf:1500,mt:.12,l:.45,ld:1.4,rv:.8},
  smg:{c:.4,b:.42,bf:2900,bd:.09,t:.32,tf:180,td:.07,m:.1,mf:3000,l:.1,ld:.32,rv:.3},
  shotgun:{c:.6,b:.95,bf:1800,bd:.38,t:.8,tf:90,td:.25,m:.12,mf:1100,mt:.08,l:.4,ld:1.1,rv:.7},
  ar:{c:.48,b:.55,bf:2700,bd:.14,t:.42,tf:140,td:.1,m:.12,mf:2600,l:.15,ld:.5,rv:.45},
  mg:{c:.5,b:.65,bf:2200,bd:.17,t:.55,tf:105,td:.13,m:.1,mf:1900,l:.2,ld:.6,rv:.5},
  hmg:{c:.55,b:.8,bf:1800,bd:.24,t:.75,tf:80,td:.2,m:.12,mf:1500,l:.3,ld:.85,rv:.6},
};
const Sfx={ctx:null,master:null,nb:null,groans:0,
  wake(){const c=this.ctx;if(c&&c.state!=='running'){try{const p=c.resume();if(p&&p.catch)p.catch(()=>{});}catch(_){}}},
  init(){if(this.ctx){this.wake();return;}
    try{const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;let c;try{c=new AC({latencyHint:'interactive'});}catch(_){c=new AC();}this.ctx=c;this.master=c.createGain();this.master.gain.value=.55;this.live=0;
      /* eco dell'ambiente: un solo riverbero (risposta all'impulso generata qui) a cui ogni suono manda una parte; al chiuso è più forte */
      try{this.rev=c.createConvolver();this.rev.buffer=this.ir(1.9,2.4);this.wet=c.createGain();this.wet.gain.value=.3;this.rev.connect(this.wet);this.wet.connect(this.master);}catch(_){this.rev=null;}
      /* limitatore: quando si sommano tanti suoni (andare a terra, esplosioni, orde) l'audio non satura e non gracchia */
      try{const L=c.createDynamicsCompressor();L.threshold.value=-10;L.knee.value=6;L.ratio.value=12;L.attack.value=.003;L.release.value=.2;this.master.connect(L);L.connect(c.destination);}catch(_){this.master.connect(c.destination);}
      const len=c.sampleRate*1.5|0;this.nb=c.createBuffer(1,len,c.sampleRate);const d=this.nb.getChannelData(0);for(let i=0;i<len;i++)d[i]=Math.random()*2-1;this.ambient();}catch(e){this.ctx=null;}},
  // risposta all'impulso: prime riflessioni sparse, poi coda di rumore che si spegne e diventa più scura (l'aria assorbe gli acuti)
  ir(sec,dec){const c=this.ctx,sr=c.sampleRate,n=sr*sec|0,b=c.createBuffer(2,n,sr);for(let ch=0;ch<2;ch++){const d=b.getChannelData(ch);let y=0;
      for(let i=0;i<n;i++){const t=i/n,a=.6-.55*t;y+=a*((Math.random()*2-1)-y);d[i]=y*Math.pow(1-t,dec)*(i<sr*.012?i/(sr*.012):1);}
      for(let k=0;k<9;k++){const i=(sr*(.007+Math.random()*.06))|0;if(i<n)d[i]+=(Math.random()<.5?-1:1)*(.5-k*.04);}}return b;},
  room(inside){if(!this.wet||this._in===inside)return;this._in=inside;this.wet.gain.setTargetAtTime(inside?.34:.11,this.ctx.currentTime,.6);},
  /* uscita di un suono: panorama, mandata al riverbero (rv), e dietro i muri (oc 0..1) più cupo e più basso */
  out(node,pan,rv=.12,oc=0){const c=this.ctx;let n=node;
    if(oc>.05){const f=c.createBiquadFilter();f.type='lowpass';f.frequency.value=8000*Math.pow(.07,Math.min(1,oc));const g=c.createGain();g.gain.value=1-.5*Math.min(1,oc);n.connect(f);f.connect(g);n=g;rv*=1+oc;}
    if(pan&&c.createStereoPanner){const p=c.createStereoPanner();p.pan.value=clamp(pan,-1,1);n.connect(p);p.connect(this.master);}else n.connect(this.master);
    if(this.rev&&rv>0){const s=c.createGain();s.gain.value=Math.min(1,rv);n.connect(s);s.connect(this.rev);}},
  // al massimo ~70 suoni insieme: oltre si saltano quelli poco importanti (i telefoni non reggono di più)
  slot(src,imp){if(!imp&&(this.live|0)>70)return false;this.live=(this.live|0)+1;src.onended=()=>{this.live--;};return true;},
  env(g,t0,a,v,dur){if(!Number.isFinite(v)||!Number.isFinite(dur)||!Number.isFinite(a)||!Number.isFinite(t0)){g.gain.value=0;return;}g.gain.setValueAtTime(.0001,t0);g.gain.exponentialRampToValueAtTime(Math.max(v,.0002),t0+a);g.gain.exponentialRampToValueAtTime(.0001,t0+dur);},
  noise({dur=.2,type='lowpass',f=1000,fe=0,q=1,v=.4,a=.003,t=0,pan=0,rv,oc=0,imp=false,to=null}={}){const c=this.ctx;if(!c)return;const t0=c.currentTime+t;const s=c.createBufferSource();if(!this.slot(s,imp))return;s.buffer=this.nb;const fl=c.createBiquadFilter();fl.type=type;fl.frequency.setValueAtTime(f,t0);if(fe)fl.frequency.exponentialRampToValueAtTime(fe,t0+dur);fl.Q.value=q;
    const g=c.createGain();this.env(g,t0,a,v,dur);s.connect(fl);fl.connect(g);if(to)g.connect(to);else this.out(g,pan,rv,oc);s.start(t0,Math.random()*.8);s.stop(t0+dur+.05);},
  tone({f=440,fe=0,dur=.2,type='sine',v=.25,a=.005,t=0,pan=0,rv,oc=0,imp=false,to=null}={}){const c=this.ctx;if(!c)return;const t0=c.currentTime+t;const o=c.createOscillator();if(!this.slot(o,imp))return;o.type=type;o.frequency.setValueAtTime(f,t0);if(fe)o.frequency.exponentialRampToValueAtTime(fe,t0+dur);
    const g=c.createGain();this.env(g,t0,a,v,dur);o.connect(g);if(to)g.connect(to);else this.out(g,pan,rv,oc);o.start(t0);o.stop(t0+dur+.05);},
  /* spari come nei giochi veri: cinque strati che passano da un saturatore — schiocco (acuti brevissimi), corpo (rumore che si scurisce),
     colpo basso (sinusoide che scende), meccanica (carrello/otturatore) e coda che rimbomba nella stanza. Ogni colpo un po' diverso */
  shot(k,pan=0,dist=0,oc=0){const S=SHOTS[k];if(!S||!this.ctx)return this.shotFx(k);const c=this.ctx,pv=rand(.93,1.07),far=Math.min(1,dist/40),vv=dist?Math.min(1,5/(1+dist*.35)):1;
    const bus=c.createGain();bus.gain.value=vv;const ws=c.createWaveShaper();ws.curve=this.sat();bus.connect(ws);this.out(ws,pan,.18+S.rv*(.4+far),oc);
    const air=1-far*.8;/* da lontano gli acuti si perdono */
    this.noise({to:bus,dur:.035,type:'highpass',f:3800*pv,v:S.c*air,imp:true});
    this.noise({to:bus,dur:S.bd,f:S.bf*pv*air+300,fe:S.bf*pv*.18+80,v:S.b,imp:true});
    this.tone({to:bus,f:S.tf*pv,fe:S.tf*pv*.3,dur:S.td,v:S.t,imp:true});
    if(S.m)this.noise({to:bus,dur:.045,type:'bandpass',f:S.mf*pv,q:4,v:S.m*air,t:S.mt||.03});
    this.noise({to:bus,dur:S.ld,f:900*pv,fe:160,v:S.l*(1+far),a:.01,t:.012});},
  sat(){if(this._sat)return this._sat;const n=1024,cv=new Float32Array(n);for(let i=0;i<n;i++){const x=i/n*2-1;cv[i]=Math.tanh(x*2.2)/Math.tanh(2.2);}return this._sat=cv;},
  shotFx(k){switch(k){
    case 'pistol':this.noise({dur:.18,f:2600,fe:500,v:.5});this.tone({f:150,fe:50,dur:.12,v:.4});break;
    case 'revolver':this.noise({dur:.4,f:2400,fe:260,v:.7});this.tone({f:110,fe:35,dur:.25,v:.6});break;
    case 'rifle':this.noise({dur:.32,f:3200,fe:380,v:.62});this.tone({f:120,fe:40,dur:.2,v:.5});break;
    case 'sniper':this.noise({dur:.7,f:3600,fe:200,v:.8});this.tone({f:90,fe:28,dur:.4,v:.7});this.noise({dur:.5,type:'bandpass',f:500,v:.2,t:.12});break;
    case 'smg':this.noise({dur:.12,f:3000,fe:700,v:.38});this.tone({f:170,fe:60,dur:.08,v:.3});break;
    case 'shotgun':this.noise({dur:.5,f:1800,fe:180,v:.85});this.tone({f:90,fe:30,dur:.28,v:.6});break;
    case 'ar':this.noise({dur:.18,f:2800,fe:500,v:.48});this.tone({f:130,fe:45,dur:.1,v:.4});break;
    case 'mg':this.noise({dur:.2,f:2200,fe:350,v:.55});this.tone({f:100,fe:40,dur:.14,v:.5});break;
    case 'ray':this.tone({f:1500,fe:170,dur:.38,type:'square',v:.14});this.tone({f:760,fe:90,dur:.38,type:'sawtooth',v:.1});this.noise({dur:.2,type:'bandpass',f:4000,v:.12});break;
    case 'hmg':this.noise({dur:.3,f:1800,fe:220,v:.7});this.tone({f:80,fe:30,dur:.2,v:.6});break;
    case 'laser':this.tone({f:2200,fe:600,dur:.09,type:'sawtooth',v:.1});this.tone({f:1100,fe:300,dur:.1,type:'square',v:.06});this.noise({dur:.06,type:'highpass',f:4000,v:.1});break;
    case 'blunder':this.noise({dur:.6,f:1500,fe:150,v:.9});this.tone({f:70,fe:26,dur:.4,v:.7});this.noise({dur:.25,type:'bandpass',f:600,v:.3,t:.05});break;
    case 'acid':this.noise({dur:.25,type:'bandpass',f:1400,fe:500,q:2,v:.45});this.tone({f:300,fe:90,dur:.2,type:'square',v:.1});this.noise({dur:.5,type:'highpass',f:3000,fe:1500,v:.12,t:.08});break;
    case 'vortex':this.tone({f:90,fe:30,dur:1.2,type:'sawtooth',v:.2});this.tone({f:600,fe:60,dur:.6,type:'sine',v:.2});this.noise({dur:.9,type:'bandpass',f:300,fe:2000,v:.2});break;}},
  shaper(){if(this._ws)return this._ws;const n=1024,cv=new Float32Array(n);for(let i=0;i<n;i++){const x=i/n*2-1;cv[i]=Math.tanh(x*6)*.9;}this._ws=cv;return cv;},
  // voce da zombie: due oscillatori stonati, distorsione, formanti e raschio (vocal fry)
  voice({f0=90,f1=70,dur=1.2,v=.25,pan=0,f1a=500,f2a=1300,fry=32,t=0,harsh=1,oc=0}={}){const c=this.ctx;if(!c||(this.vox|0)>=6)return null;this.vox=(this.vox|0)+1;setTimeout(()=>{this.vox--;},(dur+t)*1000+80);const t0=c.currentTime+t;const g=c.createGain();this.env(g,t0,Math.min(.12,dur*.2),v,dur);
    const ws=c.createWaveShaper();ws.curve=this.shaper();const pre=c.createGain();pre.gain.value=harsh;
    const am=c.createGain();am.gain.value=.55;const fr=c.createOscillator();fr.type='square';fr.frequency.value=fry;const frg=c.createGain();frg.gain.value=.45;fr.connect(frg);frg.connect(am.gain);
    const oscs=[];for(const d of[1,1.013,.497]){const o=c.createOscillator();o.type='sawtooth';o.frequency.setValueAtTime(f0*d,t0);o.frequency.linearRampToValueAtTime(f1*d,t0+dur);o.connect(pre);oscs.push(o);}
    const n=c.createBufferSource();n.buffer=this.nb;const ng=c.createGain();ng.gain.value=.35;n.connect(ng);ng.connect(pre);
    pre.connect(ws);ws.connect(am);const b1=c.createBiquadFilter();b1.type='bandpass';b1.frequency.value=f1a;b1.Q.value=3;const b2=c.createBiquadFilter();b2.type='bandpass';b2.frequency.value=f2a;b2.Q.value=4;
    const mx=c.createGain();am.connect(b1);am.connect(b2);b1.connect(mx);const b2g=c.createGain();b2g.gain.value=.6;b2.connect(b2g);b2g.connect(mx);mx.connect(g);this.out(g,pan,.25,oc);
    {const vb=c.createOscillator();vb.frequency.value=rand(4.5,7);const vg=c.createGain();vg.gain.value=f0*.025;vb.connect(vg);oscs.forEach(o=>vg.connect(o.frequency));vb.start(t0);vb.stop(t0+dur+.05);}/* tremolio della voce */
    oscs.forEach(o=>{o.start(t0);o.stop(t0+dur+.05);});fr.start(t0);fr.stop(t0+dur+.05);n.start(t0,Math.random()*.8);n.stop(t0+dur+.05);return oscs[0];},
  groan(dist,pan,hi,oc=0){if(!this.ctx||this.groans>3)return;const v=Math.min(.34,2.6/(1+dist*dist*.12));if(v<.012)return;this.groans++;
    const dur=hi?rand(.5,.9):rand(.9,1.7),f0=hi?rand(150,230):rand(70,115);
    const o=this.voice({f0,f1:f0*rand(.6,1.3),dur,v,pan,f1a:rand(420,720),f2a:rand(1100,1700),fry:rand(24,45),harsh:hi?2.2:1.4,oc});if(o)o.onended=()=>{this.groans--;};else this.groans--;},
  scream(dist,pan,oc=0){const v=Math.min(.36,3/(1+dist*dist*.08));if(v<.015)return;const f=rand(260,340);this.voice({f0:f,f1:f*rand(1.4,1.9),dur:.35,v,pan,f1a:900,f2a:2300,fry:rand(50,70),harsh:3,oc});
    this.voice({f0:f*1.7,f1:f*.8,dur:.7,v:v*.9,pan,f1a:1000,f2a:2500,fry:rand(40,60),harsh:3,t:.3,oc});},
  roar(p=1){this.voice({f0:120*p,f1:75*p,dur:.45/p+.1,v:.28,f1a:650*p,f2a:1500*p,fry:38,harsh:2.6});this.noise({dur:.3,type:'bandpass',f:900*p,q:2,v:.18});},
  thud(dist){const v=Math.min(.7,5/(1+dist*.5));if(v<.02)return;this.tone({f:55,fe:28,dur:.35,v});this.noise({dur:.22,f:220,fe:60,v:v*.6});},
  rl(ev){switch(ev){
    case 'magOut':this.noise({dur:.05,type:'highpass',f:2200,v:.32});this.noise({dur:.12,type:'bandpass',f:900,fe:500,q:2,v:.18,t:.03});break;
    case 'magIn':case 'drumIn':this.noise({dur:.04,type:'highpass',f:1800,v:.45});this.tone({f:ev==='drumIn'?180:320,fe:120,dur:.06,type:'square',v:.1});this.noise({dur:.03,type:'highpass',f:3000,v:.3,t:.05});break;
    case 'rack':this.noise({dur:.05,type:'bandpass',f:2600,q:3,v:.4});this.noise({dur:.06,type:'bandpass',f:1900,q:3,v:.45,t:.09});this.tone({f:420,dur:.04,type:'square',v:.06,t:.1});break;
    case 'boltUp':case 'boltFwd':this.noise({dur:.07,type:'bandpass',f:ev==='boltUp'?1500:2200,q:2.5,v:.4});this.noise({dur:.06,type:'bandpass',f:2600,q:3,v:.35,t:.08});break;
    case 'cylOpen':case 'cylClose':this.noise({dur:.06,type:'bandpass',f:ev==='cylOpen'?1800:2600,q:4,v:.4});this.tone({f:900,dur:.03,type:'triangle',v:.06});break;
    case 'eject':for(let i=0;i<4;i++)this.tone({f:rand(2600,4200),fe:rand(1800,2400),dur:.12,type:'triangle',v:.06,t:.05+i*.05});break;
    case 'shell':this.noise({dur:.05,type:'bandpass',f:1300,q:3,v:.35});this.tone({f:250,dur:.04,type:'square',v:.06});break;
    case 'pump':this.noise({dur:.08,type:'bandpass',f:1100,q:2,v:.5});this.noise({dur:.08,type:'bandpass',f:1600,q:2,v:.5,t:.14});break;
    case 'breakOpen':case 'breakClose':this.noise({dur:.08,type:'bandpass',f:ev==='breakOpen'?800:1400,q:3,v:.5});this.tone({f:160,dur:.06,type:'square',v:.08});break;
    case 'lidOpen':case 'lidClose':this.noise({dur:.09,type:'bandpass',f:ev==='lidOpen'?1000:1500,q:2,v:.45});this.tone({f:110,dur:.08,type:'square',v:.08});break;
    case 'belt':for(let i=0;i<5;i++)this.noise({dur:.03,type:'highpass',f:3000,v:.18,t:i*.04});break;
    case 'cellOut':this.noise({dur:.4,type:'highpass',f:3000,fe:1200,v:.25});this.tone({f:600,fe:120,dur:.35,type:'sine',v:.08});break;
    case 'cellIn':this.noise({dur:.05,type:'highpass',f:2000,v:.4});this.tone({f:140,fe:700,dur:.5,type:'sawtooth',v:.07});break;
    case 'charge':this.tone({f:300,fe:1600,dur:.4,type:'sine',v:.09});break;
    case 'nock':this.noise({dur:.12,type:'bandpass',f:700,q:3,v:.3});this.noise({dur:.05,type:'bandpass',f:2400,q:4,v:.2,t:.08});break;}},
  bowDraw(){this.noise({dur:.6,type:'bandpass',f:500,fe:900,q:6,v:.12});this.tone({f:90,fe:130,dur:.6,type:'triangle',v:.05});},
  bowShot(k){this.noise({dur:.15,type:'bandpass',f:300,q:2,v:.35});this.tone({f:140,fe:70,dur:.12,type:'triangle',v:.2});this.noise({dur:.4,type:'bandpass',f:1500,fe:600,q:1,v:.12*k,t:.03});},
  arrowHit(){this.noise({dur:.08,type:'bandpass',f:700,q:2,v:.4});this.noise({dur:.5,f:1200,fe:200,v:.25,t:.03});},
  bell(){[523,1046,1568,2093].forEach((f,i)=>this.tone({f:f*1.003,dur:2.6-i*.4,type:'sine',v:.14/(i+1)}));this.tone({f:524.5,dur:2.4,type:'sine',v:.08});},
  thunder(){this.noise({dur:.08,type:'highpass',f:2000,v:.6});this.noise({dur:.9,f:1500,fe:120,v:.45,t:.02});this.tone({f:1900,fe:200,dur:.2,type:'sawtooth',v:.08});},
  lift(){this.tone({f:48,fe:52,dur:2.2,type:'sawtooth',v:.18,a:.3});this.noise({dur:2.2,type:'bandpass',f:180,q:1,v:.25,a:.3});for(let i=0;i<5;i++)this.noise({dur:.06,type:'bandpass',f:900,q:4,v:.2,t:.3+i*.4});},
  ossa(){this.tone({f:80,fe:40,dur:1.6,type:'sawtooth',v:.12});this.voice({f0:60,f1:45,dur:1.6,v:.2,f1a:350,f2a:900,fry:20,harsh:2});},
  hit(){this.tone({f:190,fe:70,dur:.07,v:.26});this.noise({dur:.06,type:'bandpass',f:900,q:1.2,v:.3,rv:.05});this.noise({dur:.1,type:'bandpass',f:2300,fe:1200,q:1.5,v:.1,t:.01,rv:.05});},/* botta sorda + schizzo */
  head(){this.noise({dur:.04,type:'highpass',f:3200,v:.35,imp:true});this.tone({f:430,fe:130,dur:.09,v:.22});this.noise({dur:.28,f:1300,fe:300,v:.3,t:.015});
    this.tone({f:2650,dur:.16,v:.045,t:.02,rv:.2});},/* crac, schiocco umido e un "din" leggero come in COD */
  die(){this.noise({dur:.3,f:340,fe:110,v:.28});this.tone({f:72,fe:34,dur:.3,v:.28,t:.22});this.noise({dur:.25,f:420,fe:120,v:.22,t:.24});},/* lamento e corpo che cade */hurt(){this.tone({f:95,fe:45,dur:.35,v:.5});this.noise({dur:.2,f:900,v:.3});},
  snarl(p=1){this.roar(p);},
  dirt(pan){this.noise({dur:.6,f:260,fe:120,v:.25,pan});},splash(pan){this.noise({dur:.7,type:'bandpass',f:900,fe:300,v:.3,pan});},
  board(pan){this.noise({dur:.14,type:'bandpass',f:1500,q:2,v:.4,pan});this.noise({dur:.1,type:'bandpass',f:900,q:3,v:.3,t:.06,pan});},
  repair(){this.noise({dur:.05,type:'highpass',f:2500,v:.3});this.tone({f:260,dur:.06,type:'square',v:.07});},
  buy(){this.tone({f:880,dur:.09,v:.18});this.tone({f:1320,dur:.16,v:.16,t:.08});},deny(){this.tone({f:140,dur:.22,type:'square',v:.12});},
  reload(){this.noise({dur:.04,type:'highpass',f:2000,v:.3});this.noise({dur:.05,type:'highpass',f:1500,v:.3,t:.35});},empty(){this.tone({f:1800,dur:.03,type:'square',v:.06});},
  swing(){this.noise({dur:.16,type:'bandpass',f:900,fe:300,q:1.5,v:.3});},door(){this.noise({dur:1.1,f:380,fe:120,v:.45});this.tone({f:62,fe:40,dur:1,v:.3});},
  power(){this.tone({f:45,fe:220,dur:1.8,type:'sawtooth',v:.15});this.noise({dur:1.8,type:'bandpass',f:120,fe:900,v:.2});},
  down(){/* vai a terra: botta sorda doppia come un battito, fruscio ovattato e un fischio leggero nelle orecchie.
    Prima c'era la voce da zombie abbassata di tono (roar .6): con la distorsione e il ronzio sembrava audio rotto */
    this.tone({f:80,fe:38,dur:.6,v:.4});this.tone({f:70,fe:40,dur:.5,v:.25,t:.55});
    this.noise({dur:1.2,f:420,fe:120,v:.12,a:.05});this.tone({f:3100,dur:2.2,v:.025,a:.3});},
  drink(){for(let i=0;i<4;i++)this.tone({f:rand(300,500),fe:rand(600,900),dur:.08,v:.1,t:i*.1});},
  pup(){[523,659,784,1046].forEach((f,i)=>this.tone({f,dur:.14,v:.16,t:i*.07,type:'triangle'}));},
  roundStart(){[55,58.3,82.4].forEach(f=>this.tone({f,dur:3.6,type:'sawtooth',v:.07,a:.6}));this.noise({dur:3,f:200,v:.12,a:.8});},
  roundEnd(){[196,174.6,146.8,110].forEach((f,i)=>this.tone({f,dur:.9,type:'triangle',v:.12,t:i*.35}));},
  jingle(){const sc=[523,587,659,784,880,988,1046];for(let i=0;i<14;i++)this.tone({f:pick(sc),dur:.18,type:'triangle',v:.08,t:i*.22});},
  laugh(){for(let i=0;i<6;i++)this.tone({f:320-i*25,fe:260-i*25,dur:.12,type:'triangle',v:.12,t:i*.14});},
  forge(){for(let i=0;i<5;i++){this.tone({f:1800+rand(-200,200),fe:900,dur:.25,type:'triangle',v:.12,t:i*.45});this.noise({dur:.12,type:'highpass',f:3000,v:.25,t:i*.45});}},
  boom(dist,oc=0){const v=Math.min(1,6/(1+dist*.4)),air=Math.max(.25,1-dist/45);/* schiocco, rombo lungo, botta nello stomaco, detriti che ricadono */
    this.noise({dur:.07,type:'highpass',f:2500*air,v:.7*v,oc,imp:true,rv:.4});this.noise({dur:1.7,f:1400*air,fe:70,v:.95*v,oc,imp:true,rv:.7});this.tone({f:58,fe:22,dur:.95,v:.8*v,oc,imp:true});
    for(let i=0;i<6;i++)this.noise({dur:.05+Math.random()*.06,type:'bandpass',f:rand(1400,3200)*air,q:3,v:.12*v,t:.25+i*rand(.08,.16),oc,rv:.3});},
  zap(){this.noise({dur:.35,type:'highpass',f:3000,v:.35});this.tone({f:2400,fe:300,dur:.3,type:'square',v:.08});},
  shieldHit(){this.noise({dur:.18,type:'bandpass',f:2600,q:6,v:.5});this.tone({f:420,fe:380,dur:.5,type:'triangle',v:.1});this.tone({f:1270,dur:.35,type:'sine',v:.05});},
  shieldBreak(){this.noise({dur:.5,f:2000,fe:300,v:.6});for(let i=0;i<4;i++)this.tone({f:rand(600,1600),dur:.2,type:'triangle',v:.06,t:i*.05});},
  toma(){this.noise({dur:.4,type:'bandpass',f:500,fe:1600,q:3,v:.25});this.tone({f:180,fe:90,dur:.3,type:'sawtooth',v:.05});},
  acidPop(dist){const v=Math.min(.6,5/(1+dist*.5));this.noise({dur:.5,type:'bandpass',f:900,fe:250,q:1.5,v});this.noise({dur:.9,type:'highpass',f:2500,fe:900,v:v*.3,t:.05});this.tone({f:160,fe:50,dur:.3,v:v*.5});},
  plane(){this.tone({f:62,fe:90,dur:2.4,type:'sawtooth',v:.16,a:.3});this.noise({dur:2.4,type:'bandpass',f:300,fe:700,q:1,v:.25,a:.4});this.tone({f:124,fe:180,dur:2.4,type:'square',v:.04,a:.4});},
  chair(){this.noise({dur:1.2,type:'highpass',f:2500,v:.35,a:.05});this.tone({f:60,dur:1.2,type:'sawtooth',v:.15});this.thunder();},
  build(){for(let i=0;i<4;i++){this.noise({dur:.06,type:'bandpass',f:rand(1500,3000),q:4,v:.35,t:i*.18});this.tone({f:rand(200,320),dur:.05,type:'square',v:.06,t:i*.18});}},
  web(){this.noise({dur:.5,type:'bandpass',f:2200,fe:600,q:4,v:.3});this.tone({f:180,fe:90,dur:.4,type:'triangle',v:.15});},
  hiss(){this.noise({dur:1.4,type:'highpass',f:2500,v:.28,a:.1});},
  soul(){this.tone({f:300,fe:900,dur:.5,type:'sine',v:.1});this.noise({dur:.4,type:'bandpass',f:1200,fe:400,v:.12});},
  land(v){this.noise({dur:.12,f:300,v:Math.min(.5,.1+v*.05)});this.tone({f:90,fe:45,dur:.12,v:Math.min(.3,.05+v*.04)});},
  /* passi: diversi per superficie (cemento, grata di metallo, legno, terra, acqua); corsa più forte */
  step(k,run){const v=run?1.35:1,p=rand(.9,1.1);switch(k){
    case 'metal':this.noise({dur:.06,type:'bandpass',f:2400*p,q:3,v:.07*v,rv:.2});this.tone({f:520*p,fe:470*p,dur:.18,type:'triangle',v:.018*v,rv:.3});this.noise({dur:.05,f:500,v:.06*v});break;
    case 'wood':this.noise({dur:.07,f:700*p,fe:200,v:.09*v});this.tone({f:150*p,fe:110,dur:.07,v:.05*v});break;
    case 'soft':this.noise({dur:.11,type:'bandpass',f:900*p,q:.8,v:.06*v,rv:.05});this.noise({dur:.06,type:'highpass',f:3000,v:.02*v,t:.02,rv:.02});break;
    case 'water':this.noise({dur:.22,type:'bandpass',f:1100*p,fe:500,q:1,v:.08*v});break;
    default:this.noise({dur:.05,f:1200*p,fe:250,v:.08*v});this.noise({dur:.025,type:'highpass',f:3500,v:.03*v,t:.008});this.tone({f:110*p,fe:70,dur:.05,v:.03*v});}},
  jump(){this.noise({dur:.08,f:600,v:.12});},
  pin(){this.tone({f:2200,dur:.04,type:'square',v:.06});this.tone({f:1700,dur:.05,type:'square',v:.05,t:.06});},
  carillonNote(i){const sc=[784,988,1175,1319,1175,988];this.tone({f:sc[i%sc.length],dur:.22,type:'triangle',v:.12});this.tone({f:sc[i%sc.length]*2,dur:.1,type:'sine',v:.04});},
  radio(dur){this.noise({dur,type:'bandpass',f:1800,q:.8,v:.05,a:.2});},
  /* rumori di fondo: mare e vento (prigione, Rocca), macchinari (acciaieria); ogni tanto qualcosa di lontano: cigolio, gocce, urlo, tuono, vapore */
  ambMap(id){this.amb=id;if(!this.ctx||!this.ab)return;const t=this.ctx.currentTime,sea=id!=='acciaieria';this.ab.sea.gain.setTargetAtTime(sea?.05:0,t,1);this.ab.mach.gain.setTargetAtTime(sea?0:.035,t,1);this.ab.wind.gain.setTargetAtTime(.02,t,1);},
  ambTick(dt,inside){const c=this.ctx;if(!c||!this.ab)return;this.gT=(this.gT||3)-dt;this.eT=(this.eT||8)-dt;
    if(this.gT<=0){this.gT=rand(2,6);const t=c.currentTime;this.ab.wind.gain.setTargetAtTime((inside?.008:.03)*rand(.4,1.6),t,1.2);this.ab.wf.frequency.setTargetAtTime(rand(380,900),t,1.5);}
    if(this.eT<=0){this.eT=rand(9,22);const pan=rand(-.9,.9),r=Math.random(),steel=this.amb==='acciaieria';
      if(r<.25){this.tone({f:rand(260,420),fe:rand(200,380),dur:1.3,type:'sawtooth',v:.012,a:.3,pan,rv:.9});this.noise({dur:1.2,type:'bandpass',f:900,q:8,v:.02,a:.3,pan,rv:.9});}/* cigolio di metallo */
      else if(r<.45){for(let i=0;i<3;i++)this.tone({f:rand(1500,2200),fe:900,dur:.05,v:.03,t:i*rand(.5,1.1),pan,rv:.8});}/* gocce */
      else if(r<.62&&this.voice)this.voice({f0:rand(240,320),f1:rand(380,480),dur:.6,v:.03,pan,f1a:900,f2a:2300,fry:50,harsh:2.5});/* urlo lontano */
      else if(r<.8){if(steel)this.noise({dur:1.4,type:'highpass',f:2200,v:.05,a:.05,pan,rv:.5});else this.noise({dur:2.6,f:260,fe:60,v:.08,a:.3,pan,rv:.6});}/* vapore / tuono lontano */
      else{this.noise({dur:.08,type:'bandpass',f:rand(900,1600),q:9,v:.06,pan,rv:.9});this.tone({f:rand(500,900),dur:.9,type:'triangle',v:.012,pan,rv:.9});}}},/* colpo di metallo che risuona */
  ambient(){const c=this.ctx;
    {const mk=(type,f,q)=>{const s=c.createBufferSource();s.buffer=this.nb;s.loop=true;const fl=c.createBiquadFilter();fl.type=type;fl.frequency.value=f;fl.Q.value=q;const g=c.createGain();g.gain.value=0;s.connect(fl);fl.connect(g);g.connect(this.master);s.start();return [g,fl];};
      const [sea]=mk('lowpass',480,.7),[wind,wf]=mk('bandpass',600,.8);const sw=c.createOscillator();sw.frequency.value=.09;const swg=c.createGain();swg.gain.value=.03;sw.connect(swg);swg.connect(sea.gain);sw.start();/* onde */
      const mach=c.createGain();mach.gain.value=0;const ml=c.createBiquadFilter();ml.type='lowpass';ml.frequency.value=260;ml.connect(mach);mach.connect(this.master);[50,100.4,150.2].forEach((f,i)=>{const o=c.createOscillator();o.type='sawtooth';o.frequency.value=f;const og=c.createGain();og.gain.value=.5/(i+1);o.connect(og);og.connect(ml);o.start();});
      this.ab={sea,wind,wf,mach};if(this.amb)this.ambMap(this.amb);}
    const s=c.createBufferSource();s.buffer=this.nb;s.loop=true;const f=c.createBiquadFilter();f.type='lowpass';f.frequency.value=380;
    const g=c.createGain();g.gain.value=.06;const l=c.createOscillator();l.frequency.value=.07;const lg=c.createGain();lg.gain.value=.035;l.connect(lg);lg.connect(g.gain);
    s.connect(f);f.connect(g);g.connect(this.master);s.start();l.start();
    [41.2,61.7].forEach(fr=>{const o=c.createOscillator();o.type='triangle';o.frequency.value=fr;const og=c.createGain();og.gain.value=.022;o.connect(og);og.connect(this.master);o.start();});},
};
/* ---------- suoni registrati (CC0: Free Firearm Sound Library, zombie di artisticdude e Darsycho, Kenney) ----------
   tools/suoni.py li ha ripuliti e compressi in IMA ADPCM (modelli/suoni.json, messo nel file da build.py al posto di SUONI).
   Si decodificano la prima volta che servono (niente decodeAudioData: va uguale su Safari) e passano dal riverbero e dal filtro
   dei muri come gli altri. Dove non c'è una registrazione adatta resta il suono sintetizzato (syn) */
/*SUONI*/
const ADPCM_S=[7,8,9,10,11,12,13,14,16,17,19,21,23,25,28,31,34,37,41,45,50,55,60,66,73,80,88,97,107,118,130,143,157,173,190,209,230,253,279,307,337,371,408,449,494,544,598,658,724,796,876,963,1060,1166,1282,1411,1552,1707,1878,2066,2272,2499,2749,3024,3327,3660,4026,4428,4871,5358,5894,6484,7132,7845,8630,9493,10442,11487,12635,13899,15289,16818,18500,20350,22385,24623,27086,29794,32767],ADPCM_I=[-1,-1,-1,-1,2,4,6,8];
function sndDecode(b64,n){const bin=atob(b64),out=new Float32Array(n);let pred=0,ix=0;
  for(let i=0;i<n;i++){const by=bin.charCodeAt(i>>1),code=(i&1)?by>>4:by&15,st=ADPCM_S[ix];let diff=st>>3;if(code&4)diff+=st;if(code&2)diff+=st>>1;if(code&1)diff+=st>>2;
    pred+=code&8?-diff:diff;if(pred>32767)pred=32767;else if(pred<-32768)pred=-32768;ix+=ADPCM_I[code&7];if(ix<0)ix=0;else if(ix>88)ix=88;out[i]=pred/32768;}return out;}
if(typeof SND_DATA!=='undefined'){const syn={...Sfx};
  Object.assign(Sfx,{
    bufs(name){const c=this.ctx;if(!c)return null;this._b=this._b||{};if(!this._b[name]){const L=SND_DATA[name];if(!L)return null;
      this._b[name]=L.map(v=>{const b=c.createBuffer(1,v.n,22050);b.getChannelData(0).set(sndDecode(v.d,v.n));return b;});}return this._b[name];},
    // una variante a caso (mai la stessa due volte di fila), un filo di tono diverso ogni volta
    play(name,{v=1,pan=0,rate=1,rv=.15,oc=0,t=0,imp=false}={}){const c=this.ctx;if(!c)return null;const L=this.bufs(name);if(!L||!L.length)return null;this._last=this._last||{};
      let k=Math.floor(Math.random()*L.length);if(L.length>1&&k===this._last[name])k=(k+1)%L.length;this._last[name]=k;
      const s=c.createBufferSource();if(!this.slot(s,imp))return null;s.buffer=L[k];s.playbackRate.value=rate*rand(.97,1.03);const g=c.createGain();g.gain.value=v;s.connect(g);this.out(g,pan,rv,oc);s.start(c.currentTime+t);return s;},
    // spari veri; da lontano (compagni) la registrazione a media distanza
    shot(k,pan=0,dist=0,oc=0){const m={pistol:['pistol',1],revolver:['revolver',.95],smg:['smg',1],ar:['ar',1],rifle:['rifle',1],sniper:['sniper',1],shotgun:['shotgun',1],mg:['ar',.9],hmg:['hmg',1],blunder:['shotgun',.8]}[k];
      if(!m){if(k==='ray')this.play('ray',{v:.75,pan,rv:.3,oc});else if(k==='laser')this.play('laser',{v:.6,pan,rv:.25,oc});else{if(k==='acid')this.play('slime',{v:.55,pan,rate:1.4,oc});syn.shot.call(this,k,pan,dist,oc);}return;}
      const far=dist>16&&SND_DATA['gf_'+m[0]],vv=dist?Math.min(1,6/(1+dist*.3)):1;
      this.play((far?'gf_':'g_')+m[0],{v:.9*vv,pan,rate:m[1],rv:.2+(dist?Math.min(.5,dist/40):0),oc,imp:true});
      if(!dist)this.tone({f:120*m[1],fe:42,dur:.11,v:.26,imp:true});},/* un filo di colpo basso sotto: si sente nello stomaco */
    hit(){this.play('hit_flesh',{v:.55,rv:.05});},
    head(){this.play('hit_heavy',{v:.75,rv:.08,imp:true});this.tone({f:2650,dur:.16,v:.04,t:.02,rv:.2});},/* colpo pieno e un "din" leggero come in COD */
    die(dist=4,pan=0,oc=0){const v=Math.min(.6,4/(1+dist*dist*.06));if(v<.02)return;this.play('z_die',{v,pan,rate:rand(.85,1.08),rv:.25,oc});this.play('soft_heavy',{v:v*.7,pan,t:.35,oc});},
    groan(dist,pan,hi,oc=0){if(!this.ctx||this.groans>3)return;const v=Math.min(.55,3.2/(1+dist*dist*.1));if(v<.015)return;
      const s=this.play(hi?'z_scream':'z_groan',{v,pan,rate:hi?rand(.95,1.12):rand(.8,1.02),rv:.3,oc});if(s){this.groans++;s.addEventListener('ended',()=>{this.groans--;});}},
    scream(dist,pan,oc=0){const v=Math.min(.6,3.6/(1+dist*dist*.07));if(v<.015)return;this.play('z_scream',{v,pan,rate:rand(1,1.15),rv:.3,oc});},
    roar(p=1){this.play('z_attack',{v:.55,rate:p*rand(.9,1.05),rv:.2});},snarl(p=1){this.roar(p);},
    thud(dist){const v=Math.min(.8,5/(1+dist*.5));if(v<.02)return;this.play('soft_heavy',{v,rate:.75,rv:.3});this.tone({f:55,fe:28,dur:.3,v:v*.6});},
    board(pan){this.play('board_tear',{v:.75,pan,rv:.25});},repair(){this.play('board_put',{v:.6,rv:.15});},
    buy(){this.play('coins',{v:.6,rv:.1});},
    door(){this.play('door_open',{v:.6,rate:.8,rv:.4});this.play('metal_heavy',{v:.5,t:.55,rate:.8,rv:.4});},
    swing(){this.play('knife',{v:.6,rv:.1});},
    boom(dist,oc=0){const v=Math.min(1,7/(1+dist*.35));this.play('boom',{v,rv:.6,oc,imp:true,rate:rand(.85,1)});this.play('boom_low',{v:v*.9,rv:.4,oc,imp:true});this.tone({f:55,fe:22,dur:.8,v:.6*v,oc,imp:true});},
    land(v){this.play('soft_heavy',{v:Math.min(.6,.15+v*.06),rv:.1});},jump(){this.play('cloth',{v:.25,rv:.05});},
    step(k,run){const n={hard:'st_hard',wood:'st_wood',soft:'st_soft',metal:'st_metal'}[k];if(!n)return syn.step.call(this,k,run);this.play(n,{v:(run?.42:.3)*(k==='metal'?.8:1),rate:rand(.92,1.08),rv:.12});},
    shieldHit(){this.play('metal_heavy',{v:.7,rv:.3});syn.shieldHit.call(this);},
    bell(){this.play('bell',{v:.7,rv:.5});},
    zap(){this.play('field',{v:.5,rate:1.5,rv:.2});syn.zap.call(this);},
    pin(){this.play('click',{v:.5,rate:1.5});},empty(){this.play('click',{v:.4,rate:2});},
    hurt(){this.play('hit_heavy',{v:.7,rate:.85,imp:true});this.tone({f:95,fe:45,dur:.3,v:.35});},
    rl(ev){const r={magOut:['click',.75],magIn:['click',1],drumIn:['click',.8],rack:['latch',1],boltUp:['latch',.9],boltFwd:['latch',1.1],cylOpen:['click',1.3],cylClose:['click',1.2],shell:['click',1.5],
        breakOpen:['latch',.7],breakClose:['latch',.8],lidOpen:['latch',.9],lidClose:['latch',.85],pump:['latch',.75],belt:['belt',1]}[ev];
      if(!r)return syn.rl.call(this,ev);this.play(r[0],{v:.55,rate:r[1],rv:.08});if(ev==='pump')this.play('latch',{v:.5,rate:.8,t:.14});},
  });}
['pointerdown','touchend','keydown'].forEach(n=>addEventListener(n,()=>Sfx.wake(),{passive:true,capture:true}));
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')Sfx.wake();});
let VOICE_ON=true;
const Voice={busy:false,queue:[],cur:null,
  pickVoice(){try{const vs=speechSynthesis.getVoices();return vs.find(v=>/^it/i.test(v.lang)&&/male|uomo|luca|cosimo|diego|giorgio/i.test(v.name))||vs.find(v=>/^it/i.test(v.lang))||null;}catch(_){return null;}},
  play(title,lines){this.stop();this.queue=lines.slice();this.title=title;this.next();},
  next(){const H2=$('subs');if(!this.queue.length){this.cur=null;setTimeout(()=>{if(!this.cur)H2.hidden=true;},1400);return;}
    const line=this.queue.shift();this.cur=line;H2.innerHTML=`<b>${this.title}</b>${line}`;H2.hidden=false;
    const est=Math.max(2.5,line.length*.07);Sfx.radio(est);
    let spoke=false;
    if(VOICE_ON&&'speechSynthesis' in window){try{const u=new SpeechSynthesisUtterance(line);u.lang='it-IT';const v=this.pickVoice();if(v)u.voice=v;u.rate=.86;u.pitch=.55;u.volume=.95;
      u.onend=()=>{if(this.cur===line)setTimeout(()=>this.next(),350);};u.onerror=()=>{if(this.cur===line)setTimeout(()=>this.next(),est*1000);};speechSynthesis.speak(u);spoke=true;}catch(_){spoke=false;}}
    if(!spoke)setTimeout(()=>{if(this.cur===line)this.next();},est*1000);},
  stop(){this.queue=[];this.cur=null;try{speechSynthesis.cancel();}catch(_){}const b=$('subs');if(b)b.hidden=true;},
};
try{speechSynthesis.getVoices();}catch(_){}

/* =========================================================
   PARTICELLE E LUCI D'ESPLOSIONE (condivise)
   ========================================================= */
const PMAX=900,pPos=new Float32Array(PMAX*3),pCol=new Float32Array(PMAX*3),pVel=new Float32Array(PMAX*3),pLife=new Float32Array(PMAX),pFloor=new Float32Array(PMAX),pGrav=new Float32Array(PMAX);let pNext=0;
for(let i=0;i<PMAX;i++)pPos[i*3+1]=-999;
const pGeo=new THREE.BufferGeometry();pGeo.setAttribute('position',new THREE.BufferAttribute(pPos,3));pGeo.setAttribute('color',new THREE.BufferAttribute(pCol,3));
const pts=new THREE.Points(pGeo,new THREE.PointsMaterial({size:.1,vertexColors:true}));pts.frustumCulled=false;scene.add(pts);
let hAt=()=>0;
function emit(p,n,r,g,b,spd,up,grav=9.8,life=[.35,.8]){const fl=hAt(p.x,p.z,p.y);for(let k=0;k<n;k++){const i=pNext++%PMAX;pPos[i*3]=p.x;pPos[i*3+1]=p.y;pPos[i*3+2]=p.z;pFloor[i]=fl+.02;pGrav[i]=grav;
  pVel[i*3]=rand(-1,1)*spd;pVel[i*3+1]=rand(-.3,1)*spd+up;pVel[i*3+2]=rand(-1,1)*spd;pLife[i]=rand(life[0],life[1]);const s=rand(.7,1.15);pCol[i*3]=r*s;pCol[i*3+1]=g*s;pCol[i*3+2]=b*s;}}
function updateParticles(dt){for(let i=0;i<PMAX;i++){if(pLife[i]<=0)continue;pLife[i]-=dt;if(pLife[i]<=0){pPos[i*3+1]=-999;continue;}
  pVel[i*3+1]-=pGrav[i]*dt;pPos[i*3]+=pVel[i*3]*dt;pPos[i*3+1]+=pVel[i*3+1]*dt;pPos[i*3+2]+=pVel[i*3+2]*dt;
  if(pPos[i*3+1]<pFloor[i]){pPos[i*3+1]=pFloor[i];pVel[i*3]*=.3;pVel[i*3+2]*=.3;pVel[i*3+1]=0;}}
  pGeo.attributes.position.needsUpdate=true;pGeo.attributes.color.needsUpdate=true;}
const muzzleLight=new THREE.PointLight(0xffc27a,0,9,2);scene.add(muzzleLight);
// effetti: palle di fuoco, fumo, lampo, anello d'urto
const fireTex=textTex(64,64,(c)=>{const g=c.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,'rgba(255,255,235,1)');g.addColorStop(.25,'rgba(255,214,120,.95)');g.addColorStop(.55,'rgba(255,120,30,.7)');g.addColorStop(1,'rgba(160,30,0,0)');c.fillStyle=g;c.fillRect(0,0,64,64);});
const smokeTex=textTex(64,64,(c)=>{const r=mulberry32(4);for(let i=0;i<9;i++){const x=20+r()*24,y=20+r()*24,rr=10+r()*14;const g=c.createRadialGradient(x,y,0,x,y,rr);g.addColorStop(0,'rgba(70,66,60,.55)');g.addColorStop(1,'rgba(70,66,60,0)');c.fillStyle=g;c.fillRect(0,0,64,64);}});
const ringTex=textTex(128,128,(c)=>{const g=c.createRadialGradient(64,64,40,64,64,63);g.addColorStop(0,'rgba(255,230,190,0)');g.addColorStop(.7,'rgba(255,230,190,.55)');g.addColorStop(1,'rgba(255,230,190,0)');c.fillStyle=g;c.fillRect(0,0,128,128);});
const FX=[];
for(let i=0;i<70;i++){const m=new THREE.SpriteMaterial({map:fireTex,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending});const s=new THREE.Sprite(m);s.visible=false;scene.add(s);FX.push({s,t:0,life:1,kind:'fire'});}
const RINGS=[];for(let i=0;i<6;i++){const m=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:ringTex,transparent:true,depthWrite:false,side:THREE.DoubleSide}));m.rotation.x=-Math.PI/2;m.visible=false;scene.add(m);RINGS.push({m,t:0,life:1,r:1});}
let fxNext=0,ringNext=0;const EMBER=new THREE.Color(0x6a1800);
function fxPuff(kind,x,y,z,s0,s1,life,vx,vy,vz,col){const f=FX[fxNext++%FX.length];f.kind=kind;f.t=0;f.life=life;f.s0=s0;f.s1=s1;f.v=[vx,vy,vz];f.s.position.set(x,y,z);f.s.visible=true;
  const m=f.s.material;m.map=kind==='smoke'?smokeTex:fireTex;m.blending=kind==='smoke'?THREE.NormalBlending:THREE.AdditiveBlending;m.color.set(col||0xffffff);m.rotation=Math.random()*6;m.needsUpdate=true;f.s.scale.setScalar(s0);}
function fxRing(x,y,z,r,life,col){const R0=RINGS[ringNext++%RINGS.length];R0.t=0;R0.life=life;R0.r=r;R0.m.position.set(x,y+.05,z);R0.m.visible=true;R0.m.material.color.set(col||0xffffff);R0.m.scale.setScalar(.1);}
function fxExplosion(x,y,z,sc,col){const c=col||0xffc890,c2=col||0xff9040;
  fxPuff('fire',x,y,z,.5*sc,3.8*sc,.2,0,0,0,c);
  for(let k=0;k<7;k++){const a=Math.random()*6.28,r=Math.random()*.7*sc;fxPuff('fire',x+Math.cos(a)*r,y+rand(-.2,.5)*sc,z+Math.sin(a)*r,.6*sc,rand(1.8,2.8)*sc,rand(.45,.8),Math.cos(a)*1.2,rand(.6,1.8),Math.sin(a)*1.2,c2);}
  for(let k=0;k<9;k++){const a=Math.random()*6.28,v=rand(6,11)*Math.sqrt(sc);fxPuff('fire',x,y,z,.22*sc,.06,rand(.3,.5),Math.cos(a)*v,rand(1,6),Math.sin(a)*v,col||0xffe0a0);}
  if(!col||col===0xffffff)for(let k=0;k<6;k++){const a=Math.random()*6.28,r=Math.random()*.8*sc;fxPuff('smoke',x+Math.cos(a)*r,y+.3*sc,z+Math.sin(a)*r,.9*sc,rand(3,4.5)*sc,rand(1.4,2.4),Math.cos(a)*.6,rand(.8,1.6),Math.sin(a)*.6,0x8a8580);}
  fxRing(x,hAt(x,z,y),z,4.5*sc,.45,col||0xffd0a0);}
function updateFX(dt){FX.forEach(f=>{if(!f.s.visible)return;f.t+=dt;const k=f.t/f.life;if(k>=1){f.s.visible=false;return;}const e=1-Math.pow(1-k,2.2);
    f.s.scale.setScalar(lerp(f.s0,f.s1,e));f.s.position.x+=f.v[0]*dt;f.s.position.y+=f.v[1]*dt;f.s.position.z+=f.v[2]*dt;f.v[0]*=.94;f.v[2]*=.94;
    f.s.material.opacity=f.kind==='smoke'?(1-k)*.75:(1-k*k)*.85;if(f.kind==='fire'&&k>.45)f.s.material.color.lerp(EMBER,Math.min(1,dt*4));});
  RINGS.forEach(R0=>{if(!R0.m.visible)return;R0.t+=dt;const k=R0.t/R0.life;if(k>=1){R0.m.visible=false;return;}R0.m.scale.setScalar(R0.r*2*(1-Math.pow(1-k,3)));R0.m.material.opacity=1-k;});}
/* fulmini (Scossa) */
const boltMat=new THREE.MeshBasicMaterial({color:0xcfe6ff,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,fog:false});
const boltGlowMat=new THREE.MeshBasicMaterial({color:0x4a8aff,transparent:true,opacity:.35,blending:THREE.AdditiveBlending,depthWrite:false,fog:false});
const boltGeo=new THREE.CylinderGeometry(1,1,1,4,1,true);const BOLTS=[];const UPV=new THREE.Vector3(0,1,0),tv1=new THREE.Vector3(),tv2=new THREE.Vector3();
for(let i=0;i<12;i++){const segs=[];for(let k=0;k<14;k++){const m=new THREE.Mesh(boltGeo,boltMat);const gl=new THREE.Mesh(boltGeo,boltGlowMat);m.visible=gl.visible=false;m.frustumCulled=gl.frustumCulled=false;scene.add(m);scene.add(gl);segs.push([m,gl]);}BOLTS.push({segs,t:0,life:0,a:new THREE.Vector3(),b:new THREE.Vector3(),jt:0});}
let boltNext=0;
function bolt(a,b,life){const B=BOLTS[boltNext++%BOLTS.length];B.a.copy(a);B.b.copy(b);B.t=0;B.life=life||.3;B.jt=0;layBolt(B);}
function layBolt(B){const n=B.segs.length,L=B.a.distanceTo(B.b),pts=[B.a.clone()];for(let k=1;k<n;k++){const t=k/n;const p=B.a.clone().lerp(B.b,t);const j=Math.min(.45,L*.08)*Math.sin(t*Math.PI);p.x+=rand(-j,j);p.y+=rand(-j,j);p.z+=rand(-j,j);pts.push(p);}pts.push(B.b.clone());
  B.segs.forEach(([m,gl],k)=>{const p0=pts[k],p1=pts[k+1];tv1.subVectors(p1,p0);const len=tv1.length();if(len<1e-4){m.visible=gl.visible=false;return;}tv1.divideScalar(len);
    m.quaternion.setFromUnitVectors(UPV,tv1);gl.quaternion.copy(m.quaternion);tv2.addVectors(p0,p1).multiplyScalar(.5);m.position.copy(tv2);gl.position.copy(tv2);m.scale.set(.009,len,.009);gl.scale.set(.03,len,.03);m.visible=gl.visible=true;});}
function updateBolts(dt){BOLTS.forEach(B=>{if(B.life<=0)return;B.t+=dt;if(B.t>=B.life){B.life=0;B.segs.forEach(([m,gl])=>{m.visible=gl.visible=false;});return;}B.jt-=dt;if(B.jt<=0){B.jt=.045;layBolt(B);}});
  boltMat.opacity=.95;}
/* scritte col sangue sui muri */
function drawSym(c,idx,x,y,r){c.save();c.translate(x,y);c.lineWidth=r*.16;c.lineCap='round';c.lineJoin='round';c.beginPath();
  if(idx===0){c.arc(0,0,r*.45,0,7);c.moveTo(r*.12,0);c.arc(0,0,r*.12,0,7);for(let k=0;k<8;k++){const a=k/8*Math.PI*2;c.moveTo(Math.cos(a)*r*.62,Math.sin(a)*r*.62);c.lineTo(Math.cos(a)*r*.95,Math.sin(a)*r*.95);}c.stroke();}
  else if(idx===1){c.arc(0,0,r*.8,.5,Math.PI*2-.5);c.arc(r*.35,0,r*.62,Math.PI*2-.75,.75,true);c.closePath();c.fill();}
  else if(idx===2){c.moveTo(0,-r*.95);c.bezierCurveTo(r*.7,-r*.2,r*.65,r*.8,0,r*.85);c.bezierCurveTo(-r*.65,r*.8,-r*.7,-r*.2,0,-r*.95);c.closePath();c.stroke();c.beginPath();c.moveTo(0,-r*.2);c.bezierCurveTo(r*.3,r*.15,r*.25,r*.6,0,r*.6);c.bezierCurveTo(-r*.25,r*.6,-r*.3,r*.15,0,-r*.2);c.fill();}
  else if(idx===3){c.rect(-r*.8,-r*.85,r*1.6,r*.5);c.fill();c.beginPath();c.moveTo(0,-r*.4);c.lineTo(0,r*.95);c.lineWidth=r*.26;c.stroke();}
  else if(idx===4){c.moveTo(-r*.95,0);c.quadraticCurveTo(0,-r*.8,r*.95,0);c.quadraticCurveTo(0,r*.8,-r*.95,0);c.stroke();c.beginPath();c.arc(0,0,r*.28,0,7);c.fill();}
  else{c.moveTo(-r*.85,r*.6);c.lineTo(-r*.85,-r*.35);c.lineTo(-r*.42,r*.1);c.lineTo(0,-r*.8);c.lineTo(r*.42,r*.1);c.lineTo(r*.85,-r*.35);c.lineTo(r*.85,r*.6);c.closePath();c.fill();}
  c.restore();}
const SYM_NAMES=['il sole','la luna','la fiamma','il martello',"l'occhio",'la corona'],SYM_DEL=['del sole','della luna','della fiamma','del martello',"dell'occhio",'della corona'];
/* scritte col sangue fatte a mano (prima erano il carattere "macchina da scrivere": sembravano stampate).
   Lettere disegnate una per una, storte e di grandezza diversa; poi la maschera viene sfocata e tagliata col rumore:
   bordi sfrangiati, pennellata a strisce dove il dito era asciutto, più scuro dove c'è più sangue; colature che scendono
   dalle lettere, schizzi e a volte l'impronta di una mano. Niente ctx.filter: su Safari dei telefoni non c'è */
function bloodNoise(seed){const H=(x,y)=>{let n=(x*374761393+y*668265263+seed*144665)|0;n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967296;};
  return (x,y)=>{const xi=Math.floor(x),yi=Math.floor(y),fx=x-xi,fy=y-yi,u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy);
    const a=H(xi,yi),b=H(xi+1,yi),c=H(xi,yi+1),d=H(xi+1,yi+1);return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v;};}
function boxBlur(A,w,h,r){const T=new Float32Array(w*h),O=new Float32Array(w*h),k=1/(2*r+1);
  for(let y=0;y<h;y++){let s=0;const o=y*w;for(let x=-r;x<=r;x++)s+=A[o+Math.min(w-1,Math.max(0,x))];for(let x=0;x<w;x++){T[o+x]=s*k;s+=A[o+Math.min(w-1,x+r+1)]-A[o+Math.max(0,x-r)];}}
  for(let x=0;x<w;x++){let s=0;for(let y=-r;y<=r;y++)s+=T[Math.min(h-1,Math.max(0,y))*w+x];for(let y=0;y<h;y++){O[y*w+x]=s*k;s+=T[Math.min(h-1,y+r+1)*w+x]-T[Math.max(0,y-r)*w+x];}}return O;}
function handPrint(m,x,y,s,rot){m.save();m.translate(x,y);m.rotate(rot);m.scale(s,s);m.beginPath();m.ellipse(0,0,10,12,0,0,7);m.fill();
  for(const [fx,fy,l,a] of [[-7,-11,15,-.28],[-2.4,-13,18,-.08],[2.6,-12.5,17,.08],[7,-10,13,.26]]){m.save();m.translate(fx,fy);m.rotate(a);m.beginPath();m.ellipse(0,-l/2,2.6,l/2,0,0,7);m.fill();m.restore();}
  m.save();m.translate(-10,1);m.rotate(-.95);m.beginPath();m.ellipse(0,-6,3,7.5,0,0,7);m.fill();m.restore();m.restore();}
function bloodDraw(lines,sym,numeral){return (c,w,h)=>{c.clearRect(0,0,w,h);const R=mulberry32(lines?lines.length*977+lines[0].length+lines.join('').charCodeAt(0):sym*31+7);
  const mk=document.createElement('canvas');mk.width=w;mk.height=h;const m=mk.getContext('2d');m.fillStyle=m.strokeStyle='#fff';m.lineJoin=m.lineCap='round';
  const FONT='"Arial Black",Impact,"Helvetica Neue",Arial,sans-serif',rows=[];let fs=90;
  if(lines){fs=Math.min(72,Math.floor(h/(lines.length+.45)),Math.floor(w*1.45/Math.max(...lines.map(l=>l.length))));const slant=-.06-R()*.14;
    lines.forEach((l,i)=>{const y=h/2+(i-(lines.length-1)/2)*fs*1.1+(R()-.5)*6;rows.push(y);m.font=`900 ${fs}px ${FONT}`;m.textAlign='center';m.textBaseline='middle';
      const ch=[...l],ws=ch.map(q=>m.measureText(q).width*(.84+R()*.14)),tot=ws.reduce((a,b)=>a+b,0);let x=w/2-tot/2+(R()-.5)*16;const tilt=(R()-.5)*.1;
      ch.forEach((q,k)=>{const cw=ws[k];if(q!==' '){m.save();m.translate(x+cw/2,y+(x-w/2)*tilt+(R()-.5)*fs*.14);m.rotate((R()-.5)*.26);m.transform(1,0,slant,1,0,0);
        const sc=.86+R()*.26;m.scale(sc*(.88+R()*.18),sc);m.lineWidth=fs*(.04+R()*.07);m.fillText(q,0,0);m.strokeText(q,0,0);m.restore();}x+=cw+fs*(R()-.45)*.07;});});
    if(R()<.4)handPrint(m,R()<.5?w*.08:w*.92,h*(.62+R()*.25),fs/30*(.9+R()*.2),(R()-.5)*.8);}
  else{m.font=`900 92px ${FONT}`;m.textAlign='center';m.textBaseline='middle';m.lineWidth=8;m.save();m.translate(w*.3,h/2);m.rotate((R()-.5)*.16);m.fillText(numeral,0,0);m.strokeText(numeral,0,0);m.restore();
    m.save();m.translate(w*.68,h/2);m.rotate((R()-.5)*.2);drawSym(m,sym,0,0,h*.36);m.restore();rows.push(h/2);}
  // bordo sfrangiato e pennellata
  const img=m.getImageData(0,0,w,h).data,A=new Float32Array(w*h);for(let i=0;i<w*h;i++)A[i]=img[i*4+3]/255;
  const B=boxBlur(A,w,h,Math.max(1,Math.round(fs*.04))),N=bloodNoise(Math.floor(R()*9999)),sm=(e0,e1,v)=>{const t=Math.min(1,Math.max(0,(v-e0)/(e1-e0)));return t*t*(3-2*t);};
  const out=c.createImageData(w,h),d=out.data;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x,bb=B[i];if(bb<.03)continue;const n1=N(x/4.5,y/4.5),n2=N(x/26+50,y/2.6),n3=N(x/60+90,y/60);
    let a=sm(.3,.6,bb+(n1-.5)*.44);if(a<.01)continue;a*=.58+.42*sm(.22,.72,n2)*(.65+.35*n3);/* dito più asciutto a tratti */
    const dk=Math.min(1,bb*1.15)*(.75+.25*n1);d[i*4]=150-62*dk+22*n3|0;d[i*4+1]=16-9*dk+5*n1|0;d[i*4+2]=11-6*dk|0;d[i*4+3]=Math.min(255,a*268)|0;}
  c.putImageData(out,0,0);
  // colature: partono dal fondo delle lettere e scendono, più strette in basso, con la goccia in fondo
  c.fillStyle='rgba(118,10,6,.92)';const nd=lines?Math.round(lines.join('').replace(/ /g,'').length*.75):8;
  for(let k=0;k<nd;k++){const y0=rows[Math.floor(R()*rows.length)],x=Math.floor(w*.06+R()*w*.88);let y=-1;
    for(let yy=Math.min(h-1,Math.floor(y0+fs*.75));yy>Math.max(0,y0-fs*.6);yy--){if(B[yy*w+x]>.55){y=yy;break;}}if(y<0)continue;
    const L=fs*(.12+R()*R()*1.6),wd=1.5+R()*2.8,ph=R()*6;c.beginPath();
    for(let t=0;t<=1.0001;t+=.1)c.lineTo(x+Math.sin(t*3+ph)*1.1-wd/2*(1-t*.5),y-2+L*t);for(let t=1;t>=-.0001;t-=.1)c.lineTo(x+Math.sin(t*3+ph)*1.1+wd/2*(1-t*.5),y-2+L*t);
    c.closePath();c.fill();c.beginPath();c.ellipse(x+Math.sin(3+ph)*1.1,y-2+L,wd*.6,wd*.85,0,0,7);c.fill();}
  // schizzi
  for(let k=0;k<28;k++){const x=R()*w,y=R()*h,sz=.6+R()*R()*3.4;c.globalAlpha=.45+R()*.5;c.beginPath();c.ellipse(x,y,sz,sz*(.55+R()*.5),R()*3,0,7);c.fill();
    if(R()<.35){c.beginPath();c.ellipse(x+(R()-.5)*sz*7,y+(R()-.5)*sz*7,sz*.4,sz*.3,0,0,7);c.fill();}}c.globalAlpha=1;};}
const boomLight=new THREE.PointLight(0xff9a40,0,16,1.6);scene.add(boomLight);
const trGeo=new THREE.BufferGeometry();trGeo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(6),3));
const tracer=new THREE.Line(trGeo,new THREE.LineBasicMaterial({color:0x7dff9a,transparent:true,opacity:.9,fog:false}));tracer.frustumCulled=false;tracer.visible=false;scene.add(tracer);let tracerT=0;

/* =========================================================
   MODELLI ARMI + BRACCIA
   ========================================================= */
const OPTIC_MODELS=['smg','smg2','drum','ar','ar2','br','mg','lmg','hmg','rifle'],LASER_MODELS=['shotgun','pump','revolver'];
/*MESHY_ARMI*/
/* armi Meshy (modelli/meshy/ARMI, tools/meshy_assets.py armi): il modello prende il posto della geometria a blocchi di gunModel con la
   stessa lunghezza, la bocca e la canna dove erano (fiammata, mira e animazioni restano tarate); mire e mani si rimettono sopra e sotto
   il modello vero usando il suo profilo (top/bot) e le impugnature segnate nello script. Opzione «Armi» (scn-armi): Meshy o classiche */
const MESHY_G=typeof MESHY_ARMI!=='undefined'&&MESHY_ARMI?MESHY_ARMI:{};
let ARMI_ON=true;try{if(localStorage.getItem('scn-armi')==='classiche')ARMI_ON=false;}catch(_){}
function b64f(s,T,k){const a=new T(b64u8(s).buffer),o=new Float32Array(a.length);for(let i=0;i<a.length;i++)o[i]=a[i]*k;return o;}
function meshyGun(kind){const d=ARMI_ON&&MESHY_G[kind];if(!d)return null;
  if(!d.geo){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(b64f(d.p,Int16Array,d.sc/32767),3));
    g.setAttribute('normal',new THREE.BufferAttribute(b64f(d.n,Int8Array,1/127),3));g.setAttribute('uv',new THREE.BufferAttribute(b64f(d.uv,Uint16Array,1/65535),2));
    g.setIndex(new THREE.BufferAttribute(new Uint16Array(b64u8(d.i).buffer),1));d.geo=g;const t=meshyTex(d);
    d.mat=new THREE.MeshLambertMaterial({map:t});d.matP=new THREE.MeshLambertMaterial({map:t,color:0xd4c4ff,emissive:0x2a0c48});}/* potenziata: riflesso viola */
  return d;}
const dotMat=new THREE.MeshBasicMaterial({color:0xb8ff5a}),redDotMat=new THREE.MeshBasicMaterial({color:0xff2418}),lensMat=new THREE.MeshBasicMaterial({color:0x9fd8ff,transparent:true,opacity:.12,depthWrite:false});
const laserGlow=new THREE.MeshBasicMaterial({color:0xff4a2a}),bowFire=new THREE.MeshBasicMaterial({color:0xffa040}),acidGlow=new THREE.MeshBasicMaterial({color:0x7dff5a});
function gunModel(kind,arms,pap){
  const g=new THREE.Group();const M=MAT;const parts={};let mz=-.3,grip=[0,-.09,.06],fore=null,S=null,optic=false,laser=false;
  const b=(w,h,d,m,x,y,z,rx,par)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(x,y,z);if(rx)o.rotation.x=rx;(par||g).add(o);return o;};
  const c=(r,l,m,x,y,z,par,r2,seg)=>{const o=new THREE.Mesh(new THREE.CylinderGeometry(r,r2??r,l,seg||8),m);o.rotation.x=Math.PI/2;o.position.set(x,y,z);(par||g).add(o);return o;};
  const part=(n,x,y,z)=>{const p=new THREE.Group();p.position.set(x,y,z);g.add(p);parts[n]=p;p.userData.base=p.position.clone();p.userData.rot=p.rotation.clone();return p;};
  // mire metalliche: tacca di mira con un punto dietro, mirino con un punto davanti
  // mire metalliche: la punta del mirino anteriore finisce esattamente al centro (dove c'è il puntino), la tacca posteriore è bassa e stretta
  let sc=null;/* quali mire ha messo il modello a blocchi: col modello Meshy si rifanno sopra di lui */
  const irons=(s,rz,fz,baseR,baseF,par)=>{S={y:s,rz,fz};sc=['i',rz,fz];const hR=s-.0055-baseR;if(hR>.001)b(.016,hR,.009,M.gunDark,0,baseR+hR/2,rz);
    for(const sx of[-1,1])b(.0036,.0045,.009,M.gunDark,sx*.006,s-.0025,rz);
    const rd=new THREE.Mesh(new THREE.SphereGeometry(.0015,8,6),dotMat);rd.position.set(0,s-.0085,rz-.005);g.add(rd);
    const hF=s-.0004-baseF;b(.0034,hF,.007,M.gunDark,0,baseF+hF/2,fz,0,par);const fd=new THREE.Mesh(new THREE.SphereGeometry(.0017,8,6),dotMat);fd.position.set(0,s-.0022,fz-.004);(par||g).add(fd);};
  // mire da mitragliatrice (stile COD): alte sopra il corpo, così mirando l'arma resta in basso e la visuale è libera.
  // Dietro un telaio sottile con la tacca a semicerchio, davanti il mirino col cappuccio a semicerchio; la punta è al centro.
  const lmgIrons=(s,rz,fz,baseR,baseF)=>{S={y:s,rz,fz};sc=['l',rz,fz];const half=(r,t,x,y,z,flip)=>{const o=new THREE.Mesh(new THREE.TorusGeometry(r,t,6,18,Math.PI),M.gunDark);o.position.set(x,y,z);if(flip)o.rotation.z=Math.PI;g.add(o);return o;};
    for(const sx of[-1,1])b(.0042,s+.006-baseR,.006,M.gunDark,sx*.0175,(baseR+s+.006)/2,rz);b(.04,.005,.007,M.gunDark,0,baseR+.0025,rz);
    half(.0125,.002,0,s+.001,rz,true);for(const sx of[-1,1])b(.0045,.0026,.005,M.gunDark,sx*.015,s+.001,rz);/* tacca a U */
    b(.0036,s-baseF,.006,M.gunDark,0,(baseF+s)/2,fz);const fd=new THREE.Mesh(new THREE.SphereGeometry(.0019,8,6),dotMat);fd.position.set(0,s-.0019,fz-.004);g.add(fd);
    half(.018,.0026,0,s-.004,fz,false);for(const sx of[-1,1])b(.004,s-.004-baseF,.006,M.gunDark,sx*.018,(baseF+s-.004)/2,fz);};/* cappuccio */
  const reflex=(base,oz)=>{optic=true;sc=['r',oz];const s=base+.024;S={y:s,rz:oz,fz:oz-.3};b(.03,.008,.05,M.gunDark,0,base+.004,oz);
    for(const sx of[-1,1])b(.004,.036,.008,M.gunDark,sx*.017,base+.02,oz-.018);b(.038,.005,.008,M.gunDark,0,base+.039,oz-.018);
    const ln=new THREE.Mesh(new THREE.PlaneGeometry(.03,.028),lensMat);ln.position.set(0,s,oz-.019);g.add(ln);
    const d=new THREE.Mesh(new THREE.SphereGeometry(.0011,8,6),redDotMat);d.position.set(0,s,oz-.021);g.add(d);};
  switch(kind){
    case 'pistol':{b(.046,.03,.2,M.gunDark,0,-.02,-.02);const sl=part('slide',0,0,0);b(.05,.045,.24,M.gunMetal,0,.012,-.02,0,sl);
      b(.044,.12,.065,M.gunDark,0,-.085,.06,-.25);b(.012,.03,.045,M.gunDark,0,-.05,-.005);
      const mg=part('mag',0,-.03,.055);b(.034,.13,.05,M.gunMetal,0,-.075,.012,-.25,mg);b(.04,.012,.056,M.gunDark,0,-.14,.03,-.25,mg);
      mz=-.15;if(!pap)irons(.047,.085,-.125,.0345,.0345,sl);break;}
    case 'revolver':{c(.016,.2,M.gunMetal,0,.015,-.13);const cy=part('cyl',0,0,-.01);const cm=new THREE.Mesh(new THREE.CylinderGeometry(.035,.035,.06,8),M.gunDark);cm.rotation.x=Math.PI/2;cy.add(cm);
      for(let k=0;k<6;k++){const a=k/6*Math.PI*2;const h=new THREE.Mesh(new THREE.CylinderGeometry(.007,.007,.062,5),M.gunMetal);h.rotation.x=Math.PI/2;h.position.set(Math.cos(a)*.021,Math.sin(a)*.021,0);cy.add(h);}
      b(.04,.05,.12,M.gunMetal,0,.01,.03);b(.045,.13,.06,M.gunWood,0,-.08,.08,-.35);mz=-.23;irons(.047,.07,-.215,.035,.031);laser=pap;break;}
    case 'rifle':{b(.06,.11,.32,M.gunWood,0,-.03,.28);b(.06,.07,.3,M.gunMetal,0,0,-.02);b(.065,.06,.36,M.gunWood,0,-.015,-.34);c(.013,.3,M.gunDark,0,.012,-.64);
      const bo=part('bolt',.035,.01,.07);b(.012,.012,.05,M.gunMetal,.01,0,0,0,bo);const kn=new THREE.Mesh(new THREE.SphereGeometry(.012,6,4),M.gunMetal);kn.position.set(.03,0,0);bo.add(kn);
      const mg=part('mag',0,-.035,-.06);b(.045,.07,.09,M.gunDark,0,-.03,0,0,mg);mz=-.8;grip=[0,-.07,.1];fore=[0,-.05,-.36];
      if(pap)reflex(.035,.02);else irons(.056,.12,-.74,.035,.025);break;}
    case 'sniper':{b(.06,.11,.34,M.gunWood,0,-.03,.3);b(.06,.07,.34,M.gunMetal,0,0,-.02);b(.065,.06,.3,M.gunWood,0,-.015,-.32);c(.015,.5,M.gunDark,0,.012,-.7);
      c(.03,.3,M.gunDark,0,.08,-.05);b(.02,.04,.02,M.gunDark,0,.05,-.05);const bo=part('bolt',.035,.01,.1);b(.012,.012,.05,M.gunMetal,.01,0,0,0,bo);
      const mg=part('mag',0,-.035,-.04);b(.045,.06,.08,M.gunDark,0,-.025,0,0,mg);mz=-.96;grip=[0,-.07,.12];fore=[0,-.05,-.34];S={y:.08,rz:.1,fz:-.2};break;}
    case 'smg':{b(.065,.085,.34,M.gunMetal,0,0,-.05);c(.016,.14,M.gunDark,0,.01,-.28);b(.045,.12,.06,M.gunDark,0,-.09,.06,-.25);
      b(.015,.015,.26,M.gunDark,-.025,-.01,.24);b(.015,.015,.26,M.gunDark,.025,-.01,.24);b(.07,.08,.02,M.gunDark,0,-.02,.37);
      const mg=part('mag',0,-.04,-.1);b(.035,.2,.055,M.gunDark,0,-.1,0,0,mg);const ch=part('slide',-.036,.02,.02);b(.012,.012,.03,M.gunMetal,0,0,0,0,ch);
      mz=-.36;fore=[0,-.2,-.1];if(pap)reflex(.0425,.04);else irons(.06,.09,-.2,.0425,.0425);break;}
    case 'smg2':{b(.055,.075,.26,M.gunMetal,0,0,-.02);c(.013,.08,M.gunDark,0,.01,-.19);b(.042,.11,.055,M.gunDark,0,-.085,.07,-.2);
      b(.01,.01,.22,M.metal,0,.0,.24);b(.05,.06,.012,M.gunDark,0,-.01,.35);
      const mg=part('mag',0,-.035,-.08);b(.03,.18,.045,M.gunDark,0,-.09,0,.08,mg);const ch=part('slide',.031,.02,.0);b(.01,.012,.03,M.gunMetal,0,0,0,0,ch);
      mz=-.23;fore=[0,-.14,-.08];if(pap)reflex(.0375,.02);else irons(.055,.08,-.13,.0375,.0375);break;}
    case 'drum':{b(.07,.09,.36,M.gunMetal,0,0,-.05);c(.018,.18,M.gunDark,0,.01,-.3);b(.045,.12,.06,M.gunWood,0,-.09,.08,-.25);b(.06,.09,.22,M.gunWood,0,-.02,.26);
      const mg=part('mag',0,-.045,-.08);const d=new THREE.Mesh(new THREE.CylinderGeometry(.08,.08,.06,14),M.gunDark);d.rotation.z=Math.PI/2;d.position.set(0,-.055,0);mg.add(d);
      const ch=part('slide',-.04,.02,.0);b(.012,.012,.03,M.gunMetal,0,0,0,0,ch);mz=-.4;fore=[0,-.03,-.24];if(pap)reflex(.045,.04);else irons(.062,.1,-.21,.045,.045);break;}
    case 'shotgun':{b(.07,.07,.12,M.gunMetal,0,-.01,.03);b(.06,.1,.34,M.gunWood,0,-.05,.26,.12);
      const br=part('brl',0,-.01,-.03);c(.021,.72,M.gunDark,-.021,.022,-.33,br);c(.021,.72,M.gunDark,.021,.022,-.33,br);b(.07,.05,.26,M.gunWood,0,-.02,-.22,0,br);b(.012,.006,.7,M.gunMetal,0,.046,-.33,0,br);
      mz=-.73;grip=[0,-.08,.12];fore=[0,-.06,-.26];irons(.058,.075,-.66,.025,.049,br);laser=pap;break;}
    case 'pump':{c(.022,.66,M.gunDark,0,.02,-.33);c(.018,.5,M.gunDark,0,-.02,-.3);b(.07,.08,.2,M.gunMetal,0,0,.02);b(.06,.1,.32,M.gunDark,0,-.04,.26,.1);
      const pu=part('pump',0,0,-.3);b(.07,.06,.2,M.gunWood,0,-.03,0,0,pu);mz=-.67;grip=[0,-.08,.12];fore=[0,-.06,-.3];irons(.058,.08,-.62,.04,.042);laser=pap;break;}
    case 'ar':{b(.065,.09,.4,M.gunMetal,0,0,-.02);b(.07,.07,.28,M.gunDark,0,0,-.35);c(.014,.16,M.gunDark,0,.005,-.56);
      b(.055,.1,.28,M.gunDark,0,-.02,.3);b(.04,.1,.05,M.gunDark,0,-.09,.08,-.25);
      const mg=part('mag',0,-.045,-.1);b(.04,.17,.07,M.gunDark,0,-.08,-.015,.25,mg);const ch=part('slide',.036,.02,.05);b(.012,.012,.03,M.gunMetal,0,0,0,0,ch);
      mz=-.65;grip=[0,-.1,.09];fore=[0,-.05,-.36];if(pap)reflex(.045,.05);else{b(.02,.03,.2,M.gunDark,0,.06,0);irons(.088,.08,-.44,.075,.035);}break;}
    case 'ar2':{b(.07,.1,.55,M.green,0,0,.02);b(.03,.012,.4,M.gunDark,0,.056,.0);c(.014,.12,M.gunDark,0,.01,-.3);b(.04,.1,.05,M.gunDark,0,-.1,-.05,-.2);
      const mg=part('mag',0,-.05,.16);b(.04,.15,.065,M.gunDark,0,-.075,0,.15,mg);const ch=part('slide',.04,.02,.1);b(.012,.012,.03,M.gunMetal,0,0,0,0,ch);
      mz=-.36;grip=[0,-.1,-.05];fore=[0,-.06,-.2];if(pap)reflex(.062,.08);else irons(.078,.16,-.2,.062,.062);break;}
    case 'br':{b(.06,.1,.32,M.gunWood,0,-.03,.3);b(.06,.075,.26,M.gunMetal,0,0,-.02);b(.065,.06,.34,M.gunWood,0,-.015,-.33);c(.014,.26,M.gunDark,0,.012,-.6);
      b(.04,.1,.05,M.gunDark,0,-.08,.1,-.25);const mg=part('mag',0,-.0375,-.06);b(.045,.12,.08,M.gunDark,0,-.06,0,.1,mg);const ch=part('slide',.034,.02,.0);b(.012,.012,.03,M.gunMetal,0,0,0,0,ch);
      mz=-.74;grip=[0,-.08,.1];fore=[0,-.05,-.34];if(pap)reflex(.0375,.02);else irons(.06,.08,-.66,.0375,.026);break;}
    case 'mg':{b(.1,.12,.5,M.gunMetal,0,0,0);c(.035,.3,M.gunDark,0,.01,-.36);c(.02,.3,M.gunDark,0,.01,-.62);
      b(.07,.12,.3,M.gunDark,0,-.02,.38);b(.05,.12,.06,M.gunDark,0,-.11,.14,-.25);
      const mg=part('mag',.02,-.06,-.05);b(.12,.12,.14,M.rayBody,0,-.06,0,0,mg);const ld=part('lid',0,.06,.18);b(.1,.012,.28,M.gunDark,0,.006,-.14,0,ld);
      mz=-.78;grip=[0,-.13,.15];fore=[0,-.05,-.36];if(pap){b(.03,.05,.06,M.gunDark,0,.095,.2);reflex(.12,.2);}else lmgIrons(.13,.17,-.5,.072,.045);break;}
    case 'lmg':{b(.09,.11,.46,M.gunDark,0,0,0);c(.032,.34,M.gunMetal,0,.005,-.39,null,null,10);c(.016,.24,M.gunDark,0,.005,-.66);
      for(let k=0;k<5;k++)b(.066,.006,.02,M.gunDark,0,.03,-.26-k*.06);b(.06,.11,.3,M.gunDark,0,-.02,.36);b(.045,.12,.06,M.gunDark,0,-.1,.12,-.25);
      for(const sx of[-1,1])b(.008,.008,.3,M.metal,sx*.02,-.04,-.42);b(.015,.03,.14,M.metal,.052,.03,-.08);
      const mg=part('mag',.0,-.055,-.03);b(.1,.14,.13,M.green,0,-.07,0,0,mg);const ld=part('lid',0,.055,.16);b(.09,.012,.28,M.gunMetal,0,.006,-.14,0,ld);
      mz=-.8;grip=[0,-.12,.13];fore=[0,-.06,-.38];if(pap)reflex(.055,.2);else irons(.074,.2,-.19,.055,.055);break;}
    case 'hmg':{b(.12,.13,.36,M.gunMetal,0,0,.05);c(.052,.5,M.metal,0,.0,-.38,null,null,12);for(let k=0;k<4;k++){const r=new THREE.Mesh(new THREE.TorusGeometry(.053,.006,5,14),M.gunDark);r.position.set(0,0,-.2-k*.12);g.add(r);}
      c(.02,.2,M.gunDark,0,.0,-.72);b(.08,.1,.24,M.gunDark,0,-.02,.36);b(.05,.13,.06,M.gunDark,0,-.12,.16,-.25);
      const mg=part('mag',.0,-.065,.0);b(.13,.15,.18,M.green,0,-.075,0,0,mg);const ld=part('lid',0,.065,.22);b(.12,.012,.3,M.gunDark,0,.006,-.15,0,ld);
      mz=-.84;grip=[0,-.14,.16];fore=[0,-.08,-.34];if(pap){b(.03,.05,.06,M.gunDark,0,.1,.17);reflex(.125,.17);}else lmgIrons(.135,.14,-.55,.075,.052);break;}
    case 'ray':{c(.055,.34,M.rayBody,0,0,-.05);for(const z of[-.2,-.1,0])c(.072,.03,M.rayGlow,0,0,z);
      const n=new THREE.Mesh(new THREE.ConeGeometry(.05,.12,8),M.gunDark);n.rotation.x=-Math.PI/2;n.position.set(0,0,-.28);g.add(n);
      b(.045,.12,.06,M.gunDark,0,-.09,.08,-.25);b(.02,.04,.2,M.rayGlow,0,.065,-.05);const ce=part('cell',0,-.07,-.06);c(.028,.12,M.rayGlow,0,0,0,ce);
      mz=-.36;fore=[0,-.07,-.18];S={y:.1,rz:.05,fz:-.15};b(.006,.03,.006,M.gunDark,0,.085,.05);b(.006,.03,.006,M.gunDark,0,.085,-.15);break;}
    case 'vortex':{b(.08,.09,.3,M.gunDark,0,0,.02);const ce=part('cell',0,.02,-.2);const s=new THREE.Mesh(new THREE.SphereGeometry(.07,12,10),M.vortGlow);ce.add(s);
      for(const k of[0,1]){const t=new THREE.Mesh(new THREE.TorusGeometry(.1,.008,6,20),M.gunMetal);t.position.set(0,.02,-.2);t.rotation.set(k?Math.PI/2:0,k?0:Math.PI/2,0);g.add(t);}
      b(.045,.12,.06,M.gunDark,0,-.09,.1,-.25);mz=-.3;fore=[0,-.06,-.06];S={y:.14,rz:.08,fz:-.2};b(.006,.05,.006,M.gunDark,0,.12,.08);break;}
    case 'laser':{b(.075,.1,.5,M.gunDark,0,0,0);for(const sx of[-1,1])b(.004,.012,.42,laserGlow,sx*.039,.01,-.02);c(.03,.12,M.gunMetal,0,.01,-.3);c(.022,.012,laserGlow,0,.01,-.365);
      for(const a of[0,2.1,4.2])b(.008,.008,.1,M.gunMetal,Math.cos(a)*.04,.01+Math.sin(a)*.04,-.36);b(.06,.1,.26,M.gunDark,0,-.02,.36);b(.045,.12,.06,M.gunDark,0,-.1,.12,-.25);
      const ce=part('cell',0,-.055,-.08);b(.05,.08,.1,M.gunMetal,0,-.04,0,0,ce);b(.052,.02,.06,laserGlow,0,-.04,0,0,ce);
      mz=-.37;grip=[0,-.12,.12];fore=[0,-.06,-.22];reflex(.05,.1);break;}
    case 'blunder':case 'blunderAcid':{/* spingarda: canna corta che si allarga a tromba, calcio di legno; l'acida ha le bombole verdi e la bocca a tre punte */
      const ac=kind==='blunderAcid';b(.062,.1,.3,M.gunWood,0,-.045,.25,.14);b(.058,.065,.17,M.gunMetal,0,-.005,0);b(.044,.12,.06,M.gunWood,0,-.09,.09,-.3);
      const br=part('brl',0,-.005,-.07);c(.021,.4,ac?M.gunDark:M.yellow,0,.015,-.2,br,.032,10);
      if(ac){for(const a of[0,2.1,4.2]){const pr=new THREE.Mesh(new THREE.ConeGeometry(.012,.07,5),acidGlow);pr.rotation.x=-Math.PI/2;pr.position.set(Math.cos(a)*.026,.015+Math.sin(a)*.026,-.43);br.add(pr);}
        const ce=part('cell',.048,-.01,-.06);c(.022,.16,acidGlow,0,0,0,ce);c(.026,.03,M.gunMetal,0,0,.08,ce);c(.026,.03,M.gunMetal,0,0,-.08,ce);
        c(.006,.2,M.gunMetal,.035,.04,-.12,br);}
      else{const bell=new THREE.Mesh(new THREE.CylinderGeometry(.068,.034,.13,12,1,true),M.yellow);bell.rotation.x=-Math.PI/2;bell.position.set(0,.015,-.46);br.add(bell);
        for(const z of[-.08,-.28])c(.028,.018,M.gunMetal,0,.015,z,br);}
      mz=-.56;grip=[0,-.09,.11];fore=[0,-.035,-.22];irons(.062,.07,-.4,.035,.05,br);break;}
    case 'carillon':{b(.12,.1,.12,M.wood,0,0,0);b(.04,.03,.06,M.yellow,0,.08,0);const k=new THREE.Mesh(new THREE.TorusGeometry(.03,.008,6,12),M.yellow);k.position.set(.08,0,0);k.rotation.y=Math.PI/2;g.add(k);mz=0;break;}
    case 'bow':return bowModel(arms);
  }
  if(pap&&!optic&&OPTIC_MODELS.includes(kind)&&kind!=='sniper'&&!S)reflex(.04,.05);
  const MG=meshyGun(kind);
  if(MG){const bb=new THREE.Box3().setFromObject(g),L=Math.max(.15,bb.max.z-mz);g.traverse(o=>{if(o.isMesh)o.visible=false;});/* i pezzi animati restano (vuoti) */
    const mm=new THREE.Mesh(MG.geo,pap?MG.matP:MG.mat);mm.scale.setScalar(L);mm.position.set(0,.01,mz);g.add(mm);
    const T=MG.top,top=z=>.01+L*T[Math.min(T.length-1,Math.max(0,Math.floor((z-mz)/L*T.length)))],topR=(z,r)=>Math.max(top(z-r),top(z),top(z+r));
    if(sc&&sc[0]==='i'){const bR=topR(sc[1],.012),bF=topR(sc[2],.008);irons(Math.max(bR,bF)+.009,sc[1],sc[2],bR,bF);}
    else if(sc&&sc[0]==='l'){const bR=topR(sc[1],.02),bF=topR(sc[2],.02);lmgIrons(Math.max(bR,bF)+.03,sc[1],sc[2],bR,bF);}
    else if(sc&&sc[0]==='r')reflex(topR(sc[1],.03),sc[1]);
    else if(S)S={y:kind==='sniper'?topR(S.rz,.02)-.012:topR(S.rz,.02)+.012,rz:S.rz,fz:S.fz};/* cannocchiale: la mira passa dentro */
    else S={y:topR(.05,.02)+.01,rz:.05,fz:-.3};
    const hp=h=>[0,.01+L*h[1],mz+L*h[2]];if(MG.grip)grip=hp(MG.grip);fore=MG.fore?hp(MG.fore):null;g.userData.meshy=mm;}
  if(arms){const arm=(p,side)=>{const a=new THREE.Group();a.position.set(p[0],p[1],p[2]);const h=new THREE.Mesh(new THREE.SphereGeometry(.045,8,6),M.skin);h.scale.set(1,.9,1.3);h.position.set(side*.02,-.01,0);a.add(h);
      const f=new THREE.Mesh(new THREE.CylinderGeometry(.042,.05,.5,8),M.sleeve);f.position.set(side*.14,-.14,.2);f.rotation.set(1.05,0,side*.55);a.add(f);g.add(a);a.userData.base=a.position.clone();return a;};
    parts.gripArm=arm(grip,1);if(fore)parts.foreArm=arm(fore,-1);}
  if(pap&&!MG){const gm=new THREE.MeshBasicMaterial({color:0xff7a2a});const len=Math.abs(mz)+.25;
    for(const s of[-1,1]){const st=new THREE.Mesh(new THREE.BoxGeometry(.006,.012,len),gm);st.position.set(s*.036,.012,mz/2+.1);g.add(st);}}
  if(laser){b(.022,.022,.07,M.gunDark,0,-.04,mz+.14);const e=new THREE.Mesh(new THREE.SphereGeometry(.006,6,4),redDotMat);e.position.set(0,-.04,mz+.104);g.add(e);g.userData.laser=e;}
  const m=new THREE.Object3D();m.position.set(0,.01,mz);g.add(m);g.userData.muzzle=m;g.userData.parts=parts;g.userData.kind=kind;
  g.userData.sight=S||{y:.05,rz:.05,fz:-.3};g.userData.optic=optic;g.userData.grip=grip;g.userData.fore=fore;return g;
}
/* arco di brace: tenuto verticale, la corda si tende con il tiro */
function bowModel(arms){
  const g=new THREE.Group();const M=MAT;const parts={};
  const riser=new THREE.Mesh(new THREE.BoxGeometry(.03,.2,.045),M.woodDark);g.add(riser);
  const limbMat=LM({color:0x3a1a10,emissive:0x2a0800});
  const V3=THREE.Vector3,limbs=[];for(const s of[-1,1]){const cv=new THREE.QuadraticBezierCurve3(new V3(0,s*.08,0),new V3(0,s*.22,-.045),new V3(0,s*.34,.05));const l=new THREE.Mesh(new THREE.TubeGeometry(cv,8,.011,5),limbMat);g.add(l);limbs.push(l);}
  for(const s of[-1,1]){const t=new THREE.Mesh(new THREE.SphereGeometry(.014,6,4),bowFire);t.position.set(0,s*.34,.05);g.add(t);}
  const sg=new THREE.BufferGeometry();sg.setAttribute('position',new THREE.BufferAttribute(new Float32Array(9),3));const str=new THREE.Line(sg,new THREE.LineBasicMaterial({color:0xe8dcc0}));str.frustumCulled=false;g.add(str);
  const arrow=new THREE.Group();const sh=new THREE.Mesh(new THREE.CylinderGeometry(.005,.005,.62,5),M.wood);sh.rotation.x=Math.PI/2;sh.position.z=-.2;arrow.add(sh);
  const tip=new THREE.Mesh(new THREE.ConeGeometry(.012,.05,5),M.gunMetal);tip.rotation.x=-Math.PI/2;tip.position.z=-.53;arrow.add(tip);
  const fire=new THREE.Mesh(new THREE.SphereGeometry(.022,8,6),new THREE.MeshBasicMaterial({color:0xff9a3a,transparent:true,opacity:.85,blending:THREE.AdditiveBlending,depthWrite:false}));fire.position.z=-.53;arrow.add(fire);
  for(const a of[0,2.1,4.2]){const f=new THREE.Mesh(new THREE.BoxGeometry(.002,.018,.05),LM({color:0x7a1a12}));f.position.set(Math.cos(a)*.008,Math.sin(a)*.008,.08);f.rotation.z=a;arrow.add(f);}
  g.add(arrow);parts.arrow=arrow;parts.fire=fire;
  if(arms){const h=new THREE.Mesh(new THREE.SphereGeometry(.036,8,6),M.skin);h.scale.set(1,1.3,.9);g.add(h);const f=new THREE.Mesh(new THREE.CylinderGeometry(.036,.044,.42,8),M.sleeve);f.position.set(-.1,-.24,.14);f.rotation.set(.75,0,-.45);g.add(f);
    const rh=new THREE.Group();const h2=new THREE.Mesh(new THREE.SphereGeometry(.043,8,6),M.skin);rh.add(h2);g.add(rh);parts.hand=rh;}
  const MB=meshyGun('bow');if(MB){riser.visible=false;limbs.forEach(l=>l.visible=false);const mm=new THREE.Mesh(MB.geo,MB.mat);mm.scale.setScalar(.68);mm.position.set(0,0,.05);g.add(mm);}/* arco Meshy: punte dove si aggancia la corda */
  g.userData.bow={str,limbs};g.rotation.set(0,0,.5);g.scale.setScalar(.72);
  const m=new THREE.Object3D();m.position.set(0,0,-.5);g.add(m);g.userData.muzzle=m;g.userData.parts=parts;g.userData.kind='bow';g.userData.sight={y:0,rz:.1,fz:-.5};g.userData.optic=false;
  setBowDraw(g,0);return g;
}
/* tomahawk infernale: manico di legno, lama scura col filo rosso acceso */
const tomaGlow=new THREE.MeshBasicMaterial({color:0xff3a1a});
function tomaModel(){const g=new THREE.Group();const h=new THREE.Mesh(new THREE.CylinderGeometry(.016,.02,.46,7),MAT.gunWood);g.add(h);
  const bl=new THREE.Mesh(new THREE.BoxGeometry(.035,.13,.15),MAT.gunDark);bl.position.set(0,.18,.07);g.add(bl);
  const ed=new THREE.Mesh(new THREE.BoxGeometry(.04,.14,.02),tomaGlow);ed.position.set(0,.18,.155);g.add(ed);
  const sp=new THREE.Mesh(new THREE.ConeGeometry(.018,.08,5),MAT.gunDark);sp.rotation.x=-Math.PI/2;sp.position.set(0,.19,-.04);g.add(sp);
  for(const y of[-.12,-.17]){const r=new THREE.Mesh(new THREE.CylinderGeometry(.022,.022,.02,7),MAT.cable);r.position.y=y;g.add(r);}
  const gl=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex,color:0xff4a1a,transparent:true,opacity:.7,depthWrite:false,blending:THREE.AdditiveBlending}));gl.scale.setScalar(.45);gl.position.set(0,.18,.12);g.add(gl);return g;}
/* scudo: anta di cella con le sbarre, maniglia e una feritoia; si tiene davanti o sta sulla schiena */
function shieldModel(){const g=new THREE.Group();const pl=new THREE.Mesh(new THREE.BoxGeometry(.62,.86,.04),MAT.rust);g.add(pl);
  for(let k=0;k<5;k++){const r=new THREE.Mesh(new THREE.CylinderGeometry(.012,.012,.84,6),MAT.bars);r.position.set(-.24+k*.12,0,-.035);g.add(r);}
  for(const y of[-.3,.3]){const r=new THREE.Mesh(new THREE.BoxGeometry(.6,.04,.03),MAT.metalDark);r.position.set(0,y,-.04);g.add(r);}
  const sl=new THREE.Mesh(new THREE.BoxGeometry(.22,.05,.05),MAT.gunDark);sl.position.set(0,.22,0);g.add(sl);
  const hd=new THREE.Mesh(new THREE.BoxGeometry(.05,.18,.05),MAT.metalDark);hd.position.set(0,0,.06);g.add(hd);return g;}
function setBowDraw(g,k,has){const B=g.userData.bow;if(!B)return;if(has!==undefined)g.userData.parts.arrow.visible=has;const nz=.05+k*.3;const p=B.str.geometry.attributes.position.array;
  p[0]=0;p[1]=.34;p[2]=.05;p[3]=.022;p[4]=.05;p[5]=nz;p[6]=0;p[7]=-.34;p[8]=.05;B.str.geometry.attributes.position.needsUpdate=true;
  const P=g.userData.parts;P.arrow.position.set(.022,.05,nz-.11);if(P.hand){P.hand.position.set(.075,-.025,nz+.02);P.hand.scale.setScalar(.75);}P.fire.scale.setScalar(.5+k*.9);
  B.limbs.forEach(l=>{l.scale.set(1,1-k*.06,1);});}

const vmAmb=new THREE.AmbientLight(0xffffff,.55);vmScene.add(vmAmb);const vmDir=new THREE.DirectionalLight(0xfff0dd,.7);vmDir.position.set(.5,1,.6);vmScene.add(vmDir);
const vmRoot=new THREE.Group();vmScene.add(vmRoot);let vmGun=null;
const knifeM=new THREE.Group();{const a=new THREE.Mesh(new THREE.BoxGeometry(.012,.03,.22),MAT.white);a.position.z=-.11;knifeM.add(a);const b=new THREE.Mesh(new THREE.BoxGeometry(.028,.036,.1),MAT.gunDark);b.position.z=.04;knifeM.add(b);
  const h=new THREE.Mesh(new THREE.SphereGeometry(.036,8,6),MAT.skin);h.position.z=.05;knifeM.add(h);const sl=new THREE.Mesh(new THREE.CylinderGeometry(.038,.046,.4,8),MAT.sleeve);sl.rotation.x=Math.PI/2;sl.position.z=.27;knifeM.add(sl);}knifeM.visible=false;vmScene.add(knifeM);
const swoosh=new THREE.Mesh(new THREE.RingGeometry(.3,.36,24,1,.2,2.6),new THREE.MeshBasicMaterial({color:0xf2eee0,transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false,depthTest:false}));swoosh.visible=false;vmScene.add(swoosh);
const throwM=new THREE.Group();{const h=new THREE.Mesh(new THREE.SphereGeometry(.05,8,6),MAT.skin);throwM.add(h);const gr=new THREE.Mesh(new THREE.SphereGeometry(.045,8,6),LM({color:0x3a4a2a}));gr.position.set(0,.05,-.02);throwM.add(gr);}throwM.visible=false;vmScene.add(throwM);
const flashTex=textTex(64,64,(c)=>{const g=c.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,'rgba(255,255,230,1)');g.addColorStop(.3,'rgba(255,190,90,.9)');g.addColorStop(1,'rgba(255,120,20,0)');c.fillStyle=g;
  c.beginPath();for(let i=0;i<10;i++){const a=i/10*Math.PI*2,r=i%2?12:32;c.lineTo(32+Math.cos(a)*r,32+Math.sin(a)*r);}c.closePath();c.fill();});
const flashMat=new THREE.SpriteMaterial({map:flashTex,blending:THREE.AdditiveBlending,depthTest:false,transparent:true});
const flash=new THREE.Sprite(flashMat);flash.visible=false;vmScene.add(flash);

/* =========================================================
   ZOMBIE: corpo con scheletro + texture pelle/vestiti
   ========================================================= */
/* scheletro: bacino, schiena in due pezzi (spine + chest), collo, testa, mascella, spalle, gomiti, polsi, anche, ginocchia, caviglie.
   Prima c'erano solo spalle e ginocchia "a pezzi rigidi": ora la pelle vicino alle giunture è divisa tra i due ossi (JR = raggio
   della zona morbida), così gomiti, ginocchia, bacino e spalle si piegano come un corpo e non come un pupazzo */
const BONES=[['root',-1,[0,0,0]],['hips',0,[0,.95,0]],['spine',1,[0,.08,0]],['neck',18,[0,.22,0]],['head',3,[0,.1,.01]],['jaw',4,[0,-.02,.03]],
  ['shL',18,[-.19,.15,0]],['elL',6,[0,-.28,0]],['shR',18,[.19,.15,0]],['elR',8,[0,-.28,0]],['hipL',1,[-.1,-.03,0]],['knL',10,[0,-.43,0]],['hipR',1,[.1,-.03,0]],['knR',12,[0,-.43,0]],
  ['haL',7,[0,-.25,0]],['haR',9,[0,-.25,0]],['ftL',11,[0,-.42,0]],['ftR',13,[0,-.42,0]],['chest',2,[0,.28,0]]];
const BI={};BONES.forEach((b,i)=>BI[b[0]]=i);
const JR={spine:.1,chest:.13,neck:.06,head:.05,shL:.075,shR:.075,elL:.085,elR:.085,haL:.05,haR:.05,hipL:.1,hipR:.1,knL:.09,knR:.09,ftL:.05,ftR:.05};
const BREST=[];/* posizione a riposo di ogni osso */
BONES.forEach((_,i)=>{const go=j=>{if(BREST[j])return BREST[j];const [,p,o]=BONES[j];const v=new THREE.Vector3().fromArray(o);if(p>=0)v.add(go(p));return BREST[j]=v;};go(i);});
const BKIDS=BONES.map(()=>[]);BONES.forEach(([,p],i)=>{if(p>=0)BKIDS[p].push(i);});
// pesi di un vertice dell'osso b: vicino alla sua giuntura con il padre e a quelle con i figli la pelle si divide (fino a metà e metà sulla giuntura)
function skinW(b,x,y,z){const w=new Map([[b,1]]);const nm=BONES[b][0],p=BONES[b][1];
  const give=(to,j,r)=>{const d=Math.hypot(x-BREST[j].x,y-BREST[j].y,z-BREST[j].z);if(d>=r)return;const t=.5*(1-d/r);w.set(b,w.get(b)-t);w.set(to,(w.get(to)||0)+t);};
  if(JR[nm]&&p>=0)give(p,b,JR[nm]);for(const c of BKIDS[b]){const r=JR[BONES[c][0]];if(r)give(c,c,r);}
  const L=[...w.entries()].filter(e=>e[1]>0).sort((a,b2)=>b2[1]-a[1]).slice(0,4);const s=L.reduce((a,e)=>a+e[1],0)||1;while(L.length<4)L.push([0,0]);return L.map(([i,v])=>[i,v/s]);}
function capsule(rt,rb,len,seg=8){const pts=[];for(let i=0;i<=3;i++){const a=-Math.PI/2+i*Math.PI/6;pts.push(new THREE.Vector2(Math.max(.001,rb*Math.cos(a)),-len+rb*Math.sin(a)));}
  for(let i=0;i<=3;i++){const a=i*Math.PI/6;pts.push(new THREE.Vector2(Math.max(.001,rt*Math.cos(a)),rt*Math.sin(a)));}return new THREE.LatheGeometry(pts,seg);}
const torsoGeo=new THREE.LatheGeometry([[.001,.96],[.13,.98],[.15,1.08],[.165,1.25],[.19,1.38],[.175,1.47],[.09,1.52],[.001,1.54]].map(([a,b])=>new THREE.Vector2(a,b)),10);
// atlante: metà sinistra pelle marcia, metà destra stoffa lacera
const zTex=makeTex(256,128,91,(g,w,h,r)=>{
  const S=w/2;
  g.fillStyle='#d8d6cc';g.fillRect(0,0,S,h);speckle(g,0,0,S,h,r,2600,['#cfccc0','#bdb9ab','#e4e2d8','#b3ae9e','#c9c3b0']);
  for(let i=0;i<22;i++){g.fillStyle=`rgba(${120+r()*40|0},${110+r()*30|0},${80+r()*30|0},${.25+r()*.3})`;g.beginPath();g.ellipse(r()*S,r()*h,3+r()*12,2+r()*8,r()*3,0,7);g.fill();}
  for(let i=0;i<14;i++){g.fillStyle=`rgba(${80+r()*30|0},${110+r()*40|0},${60+r()*20|0},${.25+r()*.25})`;g.beginPath();g.ellipse(r()*S,r()*h,4+r()*10,3+r()*7,r()*3,0,7);g.fill();}
  g.lineWidth=1;for(let i=0;i<26;i++){g.strokeStyle=`rgba(${60+r()*30|0},${40+r()*20|0},${80+r()*30|0},${.35+r()*.3})`;g.beginPath();let x=r()*S,y=r()*h;g.moveTo(x,y);for(let k=0;k<6;k++){x+=r()*10-5;y+=r()*10-5;g.lineTo(x,y);}g.stroke();}
  for(let i=0;i<7;i++){const x=r()*S,y=r()*h,rw=3+r()*6,rh=2+r()*4;g.fillStyle='#9a4a3a';g.beginPath();g.ellipse(x,y,rw+2,rh+2,0,0,7);g.fill();g.fillStyle='#4a0c08';g.beginPath();g.ellipse(x,y,rw,rh,0,0,7);g.fill();g.fillStyle='#8a1a12';g.fillRect(x-1,y-1,2,2);}
  for(let i=0;i<30;i++){g.fillStyle='rgba(70,10,6,.6)';g.fillRect(r()*S,r()*h,1+r()*2,2+r()*6);}
  g.fillStyle='#e0dfd8';g.fillRect(S,0,S,h);
  for(let y=0;y<h;y+=2){g.fillStyle='rgba(0,0,0,.07)';g.fillRect(S,y,S,1);}for(let x=S;x<w;x+=2){g.fillStyle='rgba(0,0,0,.05)';g.fillRect(x,0,1,h);}
  speckle(g,S,0,S,h,r,1800,['rgba(90,80,60,.25)','rgba(40,35,25,.25)','rgba(255,255,255,.2)']);
  const gr=g.createLinearGradient(0,0,0,h);gr.addColorStop(0,'rgba(60,50,35,0)');gr.addColorStop(1,'rgba(60,50,35,.45)');g.fillStyle=gr;g.fillRect(S,0,S,h);
  for(let i=0;i<10;i++){g.fillStyle=`rgba(${90+r()*50|0},${14+r()*10|0},${10},${.55+r()*.35})`;const x=S+r()*S,y=r()*h;g.beginPath();g.ellipse(x,y,4+r()*14,3+r()*9,r()*3,0,7);g.fill();
    for(let k=0;k<6;k++){g.beginPath();g.arc(x+rand(-18,18),y+rand(-14,14),1+r()*2.5,0,7);g.fill();}g.fillRect(x-1,y,2,6+r()*18);}
  for(let i=0;i<9;i++){const x=S+r()*S,y=r()*h;g.fillStyle='#2a2420';g.beginPath();g.moveTo(x,y);for(let k=0;k<7;k++)g.lineTo(x+rand(-8,8),y+rand(-6,6));g.closePath();g.fill();}
  g.fillStyle='rgba(20,18,14,.8)';g.font='bold 14px monospace';g.fillText('N.'+(1000+(r()*8999|0)),S+70,40);
});
zTex.minFilter=THREE.LinearMipmapLinearFilter;
const PALETTES=[
  {skin:0x8a9179,shirt:0x55657a,pants:0x4b5a6c,hair:0x1f1b17,sleeves:false},{skin:0x7c8570,shirt:0x8e5a36,pants:0x7d4f30,hair:null,sleeves:true},
  {skin:0x9a9a84,shirt:0x7a7d76,pants:0x6c6f69,hair:0x2a241c,sleeves:true},{skin:0x6f7a68,shirt:0x2b3240,pants:0x22262d,hair:0x141210,sleeves:true},
  {skin:0x8c8a76,shirt:0xa39c8a,pants:0x3b3a36,hair:null,sleeves:false},{skin:0x7f866f,shirt:0x6a5a3a,pants:0x3e3a2e,hair:0x3a2e22,sleeves:true},
];
function buildZombieGeo(pal,seed){
  const r=mulberry32(seed);
  const col=hex=>new THREE.Color(hex);
  const C={skin:col(pal.skin),skin2:col(pal.skin).multiplyScalar(.8),shirt:col(pal.shirt),pants:col(pal.pants),shoe:col(0x3c3632),hair:col(pal.hair||pal.skin),eye:col(0xffb454)};
  const CLOTH={shirt:1,pants:1,shoe:1};
  const sl=pal.sleeves?'shirt':'skin';
  const parts=[
    [new THREE.SphereGeometry(.16,10,8),[0,.95,0],[1,.75,.72],'hips','pants'],[torsoGeo,[0,0,0],[1,1,.68],'torso','shirt'],
    [capsule(.05,.052,.1),[0,1.61,0],[1,1,1],'neck','skin'],[new THREE.SphereGeometry(.115,14,12),[0,1.72,.01],[1,1.12,1.05],'head','skin'],
    [new THREE.SphereGeometry(.08,10,6),[0,1.625,.035],[1,.55,1.05],'jaw','skin2'],
    [capsule(.055,.046,.27),[-.19,1.46,0],[1,1,1],'shL','shirt'],[capsule(.055,.046,.27),[.19,1.46,0],[1,1,1],'shR','shirt'],
    [capsule(.043,.036,.24),[-.19,1.18,0],[1,1,1],'elL',sl],[capsule(.043,.036,.24),[.19,1.18,0],[1,1,1],'elR',sl],
    [new THREE.SphereGeometry(.05,8,6),[-.19,.88,.01],[.6,1.3,.9],'haL','skin'],[new THREE.SphereGeometry(.05,8,6),[.19,.88,.01],[.6,1.3,.9],'haR','skin'],
    [capsule(.075,.06,.41),[-.1,.92,0],[1,1,1],'hipL','pants'],[capsule(.075,.06,.41),[.1,.92,0],[1,1,1],'hipR','pants'],
    [capsule(.058,.045,.39),[-.1,.49,0],[1,1,1],'knL','pants'],[capsule(.058,.045,.39),[.1,.49,0],[1,1,1],'knR','pants'],
    [new THREE.SphereGeometry(.06,8,6),[-.1,.05,.05],[.9,.7,1.9],'ftL','shoe'],[new THREE.SphereGeometry(.06,8,6),[.1,.05,.05],[.9,.7,1.9],'ftR','shoe'],
  ];
  if(pal.hair)parts.push([new THREE.SphereGeometry(.12,12,8,0,Math.PI*2,0,1.25),[0,1.725,0],[1.02,1.1,1.07],'head','hair']);
  const eyes=[[new THREE.SphereGeometry(.016,8,5),[-.041,1.735,.108],[1.55,.6,1],'head','eye',-.38],[new THREE.SphereGeometry(.016,8,5),[.041,1.735,.108],[1.55,.6,1],'head','eye',.38]];
  parts.push([new THREE.BoxGeometry(.055,.014,.03),[-.043,1.757,.104],[1,1,1],'head','skin2',-.5],[new THREE.BoxGeometry(.055,.014,.03),[.043,1.757,.104],[1,1,1],'head','skin2',.5]);
  const dark=[[-.04,1.737,.1,.042,0x0c0403,.95],[.04,1.737,.1,.042,0x0c0403,.95],[0,1.63,.1,.05,0x2a0806,.7]];
  for(let k=0;k<4;k++)dark.push([rand(-.18,.18),rand(.6,1.6),rand(-.05,.2),rand(.06,.14),0x3a0806,.7]);
  const P=[],Nn=[],Cc=[],UV=[],SI=[],SW=[],I=[];
  const m4=new THREE.Matrix4(),q=new THREE.Quaternion(),v=new THREE.Vector3(),s=new THREE.Vector3(),tmpC=new THREE.Color();
  const add=list=>{list.forEach(([g0,pos,sc,bone,ck,rz])=>{const g=g0.clone();q.setFromEuler(new THREE.Euler(0,0,rz||0));m4.compose(v.set(...pos),q,s.set(...sc));g.applyMatrix4(m4);
    const base=P.length/3,pa=g.attributes.position,na=g.attributes.normal,ua=g.attributes.uv,bi=bone==='torso'?-1:BI[bone],cloth=CLOTH[ck]?.5:0,uo=r()*.3;
    for(let k=0;k<pa.count;k++){const x=pa.getX(k),y=pa.getY(k),z=pa.getZ(k);P.push(x,y,z);Nn.push(na.getX(k),na.getY(k),na.getZ(k));
      UV.push(cloth+(((ua?ua.getX(k):0)+uo)%1)*.5,ua?ua.getY(k):0);
      const c=C[ck].clone();if(ck!=='eye'){c.multiplyScalar(.85+r()*.2);for(const [bx,by,bz,br,hex,amt] of dark){const d=Math.hypot(x-bx,y-by,z-bz);if(d<br)c.lerp(tmpC.setHex(hex),amt*(1-d/br));}}
      const W=skinW(bi>=0?bi:(y>BREST[BI.chest].y?BI.chest:BI.spine),x,y,z);/* il busto: sotto il petto è schiena, sopra è petto */
      Cc.push(c.r,c.g,c.b);SI.push(W[0][0],W[1][0],W[2][0],W[3][0]);SW.push(W[0][1],W[1][1],W[2][1],W[3][1]);}
    const idx=g.index;if(idx)for(let k=0;k<idx.count;k++)I.push(base+idx.getX(k));else for(let k=0;k<pa.count;k++)I.push(base+k);});};
  add(parts);const split=I.length;add(eyes);
  const geom=new THREE.BufferGeometry();geom.setAttribute('position',new THREE.Float32BufferAttribute(P,3));geom.setAttribute('normal',new THREE.Float32BufferAttribute(Nn,3));
  geom.setAttribute('uv',new THREE.Float32BufferAttribute(UV,2));geom.setAttribute('color',new THREE.Float32BufferAttribute(Cc,3));
  geom.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(SI,4));geom.setAttribute('skinWeight',new THREE.Float32BufferAttribute(SW,4));
  geom.setIndex(I);geom.addGroup(0,split,0);geom.addGroup(split,I.length-split,1);return geom;
}
const ZGEOS=PALETTES.map((p,i)=>buildZombieGeo(p,100+i));
/* pelle degli zombie: con la grafica media/alta luce per pixel, pelle un po' lucida (bagnata) e un bordo di luce fredda sul profilo,
   così nel buio si staccano dallo sfondo come in COD */
function zMat(o){if(!PIXL)return new THREE.MeshLambertMaterial(o);const m=new THREE.MeshPhongMaterial({shininess:12,specular:0x0d0b09,...o});
  m.onBeforeCompile=s=>{s.fragmentShader=s.fragmentShader.replace('#include <dithering_fragment>',
    'float rimF=1.-abs(dot(normalize(vNormal),normalize(vViewPosition)));gl_FragColor.rgb+=vec3(.14,.17,.22)*pow(rimF,3.)*.4;\n#include <dithering_fragment>');};return m;}
const zBodyMat=zMat({map:zTex,vertexColors:true,skinning:true});
const zEyeMat=new THREE.MeshBasicMaterial({color:0xff4a14,skinning:true});
const zFondMat=zMat({map:zTex,vertexColors:true,skinning:true,color:0x6a4a3a,emissive:0x7a2a06});
const zFondEye=new THREE.MeshBasicMaterial({color:0xfff2b0,skinning:true});
/*ZOMBIE_KENNEY*/
/* zombie col modello Kenney «Animated Characters 3» (CC0, modelli/kenney): la mesh è adattata al nostro scheletro da
   tools/kenney_zombie.py (braccia giù, gambe allungate, testa a misura d'uomo), così usa le stesse ossa, pose, hitbox e animazioni.
   Due pelli (uomo e donna) per tre tinte. Nelle opzioni «Zombie»: nuovi o classici (quelli fatti a forme, si applica ricaricando) */
/*MESHY_PERSONAGGI*/
/* personaggi Meshy (modelli/meshy, fatti e riggati dall'utente; li converte tools/meshy_assets.py): zombie (prigioniero arancione e tre
   prigionieri a strisce) e sopravvissuti (i compagni online). Ogni modello ha il SUO scheletro: le nostre ossa stanno sulle giunture
   del rig, il modello non viene stirato. z.K = coscia, stinco, caviglia e bacino per i passi di poseZombie; hitbox dalle sue misure.
   Opzione «Zombie»: Meshy (di serie), Kenney o classici (si applica ricaricando) */
function b64u8(s){const b=atob(s),u=new Uint8Array(b.length);for(let i=0;i<b.length;i++)u[i]=b.charCodeAt(i);return u;}
function meshyGeo(d){const g=new THREE.BufferGeometry(),f=(s,T,k)=>{const a=new T(b64u8(s).buffer),o=new Float32Array(a.length);for(let i=0;i<a.length;i++)o[i]=a[i]*k;return o;};
  g.setAttribute('position',new THREE.BufferAttribute(f(d.p,Int16Array,.001),3));g.setAttribute('normal',new THREE.BufferAttribute(f(d.n,Int8Array,1/127),3));
  g.setAttribute('uv',new THREE.BufferAttribute(f(d.uv,Uint16Array,1/65535),2));g.setAttribute('skinWeight',new THREE.BufferAttribute(f(d.sw,Uint8Array,1/255),4));
  g.setAttribute('skinIndex',new THREE.BufferAttribute(new Uint16Array(b64u8(d.si)),4));g.setIndex(new THREE.BufferAttribute(new Uint16Array(b64u8(d.i).buffer),1));g.addGroup(0,g.index.count,0);return g;}
function meshyTex(d){if(!d.tx){d.tx=new THREE.TextureLoader().load(d.tex);d.tx.minFilter=THREE.LinearMipmapLinearFilter;d.tx.anisotropy=4;}return d.tx;}
const MESHY=typeof MESHY_CH!=='undefined'&&MESHY_CH?MESHY_CH:[];const MZ=MESHY.filter(d=>d.uso==='zombie');
const ZK_STD={L1:.43,L2:.42,ay:.07,hd:.03,hs:1};/* scheletro di serie (classici e Kenney) */
let ZSTYLE='meshy';try{const v=localStorage.getItem('scn-zstyle');if(v==='classici'||v==='kenney')ZSTYLE=v;}catch(_){}
if(ZSTYLE==='meshy'&&!MZ.length)ZSTYLE='kenney';
if(ZSTYLE==='kenney'&&typeof ZK==='undefined')ZSTYLE='classici';
if(ZSTYLE==='meshy')MZ.forEach(d=>{d.geo=meshyGeo(d);const t=meshyTex(d);
  d.mats=[0xffffff,0xd2dac6,0xe6d6c4].map(c=>({n:zMat({map:t,skinning:true,color:c}),f:zMat({map:t,skinning:true,color:0x8a5a4a,emissive:0x7a2a06})}));});
let KGEO=null;const KMATS=[];
if(ZSTYLE==='kenney'){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(ZK.p,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(ZK.n,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(ZK.uv,2));g.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(ZK.si,4));g.setAttribute('skinWeight',new THREE.Float32BufferAttribute(ZK.sw,4));
  g.setIndex(ZK.i);g.addGroup(0,ZK.i.length,0);KGEO=g;const TL=new THREE.TextureLoader();
  ZK_TEX.forEach(u=>{const t=TL.load(u);t.minFilter=THREE.LinearMipmapLinearFilter;t.anisotropy=4;
    [0xffffff,0xc9d4bd,0xe0cdb8].forEach(c=>KMATS.push({n:zMat({map:t,skinning:true,color:c}),f:zMat({map:t,skinning:true,color:0x8a5a4a,emissive:0x7a2a06})}));});}
const hitMat=new THREE.MeshBasicMaterial();
const HITBOX=[['head',[.25,.29,.26],[0,.09,.01],'head'],['spine',[.38,.56,.27],[0,.23,0],'body'],['hips',[.33,.22,.23],[0,0,0],'body'],
  ['shL',[.12,.3,.12],[0,-.14,0],'arm'],['elL',[.11,.38,.11],[0,-.18,0],'arm'],['shR',[.12,.3,.12],[0,-.14,0],'arm'],['elR',[.11,.38,.11],[0,-.18,0],'arm'],
  ['hipL',[.16,.44,.16],[0,-.21,0],'legL'],['knL',[.14,.46,.15],[0,-.22,.02],'legL'],['hipR',[.16,.44,.16],[0,-.21,0],'legR'],['knR',[.14,.46,.15],[0,-.22,.02],'legR']];
const MAX_ALIVE=24,POOL=30;const zombies=[];
const glowTex=textTex(32,32,(c)=>{const g=c.createRadialGradient(16,16,0,16,16,16);g.addColorStop(0,'rgba(255,220,160,1)');g.addColorStop(.25,'rgba(255,90,30,.8)');g.addColorStop(1,'rgba(255,40,0,0)');c.fillStyle=g;c.fillRect(0,0,32,32);});
const eyeGlowMat=new THREE.SpriteMaterial({map:glowTex,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending});
const eyeGlowFond=new THREE.SpriteMaterial({map:glowTex,color:0xfff0a0,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending});
function makeZombie(n){
  const g=new THREE.Group();g.visible=false;scene.add(g);const body=new THREE.Group();g.add(body);
  const MD=ZSTYLE==='meshy'?MZ[n%MZ.length]:null;/* modello Meshy: le ossa nelle giunture del suo rig */
  const bones=BONES.map(([nm,,p],i)=>{const b=new THREE.Bone();b.name=nm;b.position.fromArray(MD?MD.bones[i]:p);return b;});BONES.forEach(([,p],i)=>{if(p>=0)bones[p].add(bones[i]);});
  const KM=MD?MD.mats[((n/MZ.length)|0)%MD.mats.length]:KGEO?KMATS[(n*7)%KMATS.length]:null;
  const mesh=new THREE.SkinnedMesh(MD?MD.geo:KM?KGEO:ZGEOS[n%ZGEOS.length],KM?[KM.n,zEyeMat]:[zBodyMat,zEyeMat]);mesh.add(bones[0]);mesh.updateMatrixWorld(true);mesh.bind(new THREE.Skeleton(bones));mesh.frustumCulled=false;body.add(mesh);
  const B={};bones.forEach(b=>B[b.name]=b);const z={g,body,B,bones,mesh,active:false,state:'none',hits:[],matN:KM?[KM.n,zEyeMat]:[zBodyMat,zEyeMat],matF:KM?[KM.f,zFondEye]:[zFondMat,zFondEye],
    K:MD?{L1:MD.sk.L1,L2:MD.sk.L2,ay:MD.sk.ay,hd:MD.sk.hd,hs:MD.sk.hy/.95}:ZK_STD};
  const E=MD?MD.eye:KM?ZK.eye:[.041,.106,.1];z.glow=[];for(const sx of[-1,1]){const sp=new THREE.Sprite(eyeGlowMat);sp.scale.setScalar(MD?.05:KM?.06:.07);sp.position.set(sx*E[0],E[1],E[2]);B.head.add(sp);z.glow.push(sp);}
  const kid=bn=>{const c=BONES.findIndex(b=>b[1]===BI[bn]&&b[0]!=='jaw');return c>=0?bones[c].position:null;};
  HITBOX.forEach(([bn,sz,off,part])=>{if(KM&&!MD&&part==='head'){sz=[.27,.31,.28];off=[0,.14,.02];}/* la testa del modello Kenney sta un po' più in alto */
    if(MD){const h=MD.hb;if(part==='head'){sz=[h[3],h[4],h[5]];off=[h[0],h[1],h[2]];}
      else if(bn==='spine'){const nk=B.chest.position.y+B.neck.position.y;sz=[Math.abs(B.shR.position.x)*2+.04,nk+.02,.27];off=[0,nk/2,0];}/* dal bacino al collo, largo come le spalle */
      else if(bn!=='hips'){const o=kid(bn),L=o.length();sz=[sz[0],L+(part==='arm'&&bn[0]==='e'?.08:.02),sz[2]];off=[o.x/2,o.y/2,o.z/2+off[2]];}}/* braccia e gambe lungo l'osso vero */
    const m=new THREE.Mesh(new THREE.BoxGeometry(...sz),hitMat);m.position.fromArray(off);m.visible=false;m.userData.z=z;m.userData.part=part;B[bn].add(m);z.hits.push(m);});
  z.shadow=new THREE.Mesh(blobGeo,blobMat);z.shadow.position.y=.03;z.shadow.renderOrder=1;g.add(z.shadow);/* ombra morbida sotto i piedi */
  return z;
}
const blobTex=textTex(64,64,c=>{const g=c.createRadialGradient(32,32,3,32,32,31);g.addColorStop(0,'rgba(0,0,0,.6)');g.addColorStop(.55,'rgba(0,0,0,.32)');g.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=g;c.fillRect(0,0,64,64);});
const blobMat=new THREE.MeshBasicMaterial({map:blobTex,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
const blobGeo=new THREE.PlaneGeometry(1.05,1.05).rotateX(-Math.PI/2);
for(let i=0;i<POOL;i++)zombies.push(makeZombie(i));
// ragnatela (Tela Nera) visibile sugli zombie intrappolati
const webTex=textTex(64,64,(c)=>{c.strokeStyle='rgba(230,230,240,.85)';c.lineWidth=1.2;for(let i=0;i<8;i++){const a=i/8*Math.PI*2;c.beginPath();c.moveTo(32,32);c.lineTo(32+Math.cos(a)*31,32+Math.sin(a)*31);c.stroke();}
  for(let r=6;r<32;r+=6){c.beginPath();for(let i=0;i<=8;i++){const a=i/8*Math.PI*2;c.lineTo(32+Math.cos(a)*r,32+Math.sin(a)*r);}c.stroke();}});
zombies.forEach(z=>{const s=new THREE.Sprite(new THREE.SpriteMaterial({map:webTex,transparent:true,depthWrite:false}));s.scale.set(1.3,1.6,1);s.position.y=1;s.visible=false;z.g.add(s);z.webS=s;});
// in mano: lo scudo alzato e il tomahawk durante il lancio (creati qui perché il tomahawk usa glowTex)
const shieldVM=shieldModel();shieldVM.scale.setScalar(.62);shieldVM.rotation.set(.08,.15,0);shieldVM.visible=false;vmScene.add(shieldVM);
const tomaVM=tomaModel();tomaVM.scale.setScalar(.9);tomaVM.visible=false;vmScene.add(tomaVM);
