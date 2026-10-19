"""Cerca i "muri invisibili": python test/walk.py <mappa>
1) confini tra zone diverse senza porta (pavimento contro pavimento): finché una delle due è chiusa il giocatore lì sbatte contro il nulla;
2) con tutte le porte aperte, prova a camminare (stesso codice del gioco: playerCollide + groundAt) da ogni cella calpestabile
   a ogni vicina in cui gli zombie possono passare, e segnala i passaggi in cui il giocatore resta bloccato;
3) pavimenti calpestabili che nessun giocatore può raggiungere (isole)."""
import asyncio,sys,pathlib,json
from playwright.async_api import async_playwright
MAPID=sys.argv[1] if len(sys.argv)>1 else 'prigione'
JS=r"""(()=>{
const D4=[[1,0],[0,1],[-1,0],[0,-1]],nm=r=>r>=0?REG[r].name:'-',out={pairs:[],stuck:[],islands:[]};
// 1) zone che si toccano senza porta
const pr={};
for(let i=0;i<N;i++){if(!walkable(i)||kind[i]===K.DOOR)continue;const ra=region[i];
  for(const [dx,dz] of D4){const j=nbCell(i,dx,dz);if(j<0||!walkable(j)||kind[j]===K.DOOR||!stepOK(i,j))continue;const rb=region[j];if(rb===ra||ra<0||rb<0||ra>rb)continue;
    const k=ra+'|'+rb;(pr[k]=pr[k]||{a:nm(ra),b:nm(rb),oa:!!regionOpen[ra],ob:!!regionOpen[rb],n:0,at:[]}).n++;if(pr[k].at.length<3)pr[k].at.push([cX(i),cZ(i),cL(i)]);}}
out.pairs=Object.values(pr);
// 2) tutto aperto: si cammina davvero
const ro=regionOpen.slice(),dop=DOORS.map(d=>d.open);for(let r=0;r<regionOpen.length;r++)regionOpen[r]=true;DOORS.forEach(d=>d.open=true);
const sx=P.x,sz=P.z,sh=P.h;computeFlow();
const seen=new Set();
for(let i=0;i<N;i++){if(!walkable(i)||flow[i]>=65535)continue;
  for(const [dx,dz] of D4){const j=nbCell(i,dx,dz);if(j<0||!walkable(j)||!stepOK(i,j)||flow[j]>=65535)continue;
    const ax=cX(i)+.5,az=cZ(i)+.5,bx=cX(j)+.5,bz=cZ(j)+.5;const o={x:ax,z:az,h:groundAt(ax,az,cellH[i]+.05),grounded:true,vy:0};
    if(!isFinite(o.h))continue;let ok=false;
    for(let s=0;s<90;s++){const ddx=bx-o.x,ddz=bz-o.z,d=Math.hypot(ddx,ddz);if(d<.25){ok=true;break;}const v=4.4/60;o.x+=ddx/d*Math.min(v,d);o.z+=ddz/d*Math.min(v,d);
      playerCollide(o,.34);playerCollide(o,.34);const g=groundAt(o.x,o.z,o.h);if(o.grounded){if(g<o.h-.5){o.grounded=false;o.vy=0;}else o.h=g;}
      if(!o.grounded){o.vy-=22/60;o.h+=o.vy/60;if(o.h<=g){o.h=g;o.vy=0;o.grounded=true;}}}
    if(!ok){const key=Math.min(i,j)+'-'+Math.max(i,j);if(seen.has(key))continue;seen.add(key);
      out.stuck.push({da:[cX(i),cZ(i),cL(i)],a:[cX(j),cZ(j),cL(j)],zona:nm(region[i]),hA:+cellH[i].toFixed(2),hB:+cellH[j].toFixed(2),fine:[+o.x.toFixed(2),+o.z.toFixed(2),+o.h.toFixed(2)]});}}}
// 3) isole: calpestabili, in una zona, ma nessuno ci arriva
const isl={};for(let i=0;i<N;i++){if(!walkable(i)||flow[i]<65535||region[i]<0)continue;const k=nm(region[i])+' (strato '+cL(i)+')';(isl[k]=isl[k]||{n:0,at:[]}).n++;if(isl[k].at.length<4)isl[k].at.push([cX(i),cZ(i)]);}
out.islands=Object.entries(isl).map(([k,v])=>({zona:k,...v}));
regionOpen.forEach((_,r)=>regionOpen[r]=ro[r]);DOORS.forEach((d,k)=>d.open=dop[k]);computeFlow();
return JSON.stringify(out);})()"""
# 4) muri invisibili veri: il giocatore cammina da ogni cella in ogni direzione; se si ferma, si tirano raggi contro la geometria
#    disegnata (all'altezza delle caviglie, della vita e della testa, un po' a destra e a sinistra): se non colpiscono niente, lì c'è un muro invisibile
JS2=r"""((allOpen)=>{
const ro=regionOpen.slice(),dop=DOORS.map(d=>d.open);if(allOpen){for(let r=0;r<regionOpen.length;r++)regionOpen[r]=true;DOORS.forEach(d=>{d.open=true;d.anim=1;doorPose(d);});}computeFlow();
scene.updateMatrixWorld(true);const G=new Map(),T=[],big=[];const vis=o=>{for(let q=o;q;q=q.parent)if(!q.visible)return false;return true;};
const A=new THREE.Vector3(),B=new THREE.Vector3(),C=new THREE.Vector3(),Mx=new THREE.Matrix4(),Mi=new THREE.Matrix4();
scene.traverse(o=>{if(!o.isMesh||o.isSkinnedMesh||!vis(o))return;const mt=Array.isArray(o.material)?o.material[0]:o.material;if(!mt||mt.blending===THREE.AdditiveBlending||(mt.transparent&&mt.opacity<.3)||mt.visible===false)return;
  const g=o.geometry;if(!g||!g.attributes||!g.attributes.position)return;const pos=g.attributes.position,idx=g.index,nT=(idx?idx.count:pos.count)/3;
  for(let k=0;k<(o.isInstancedMesh?o.count:1);k++){Mx.copy(o.matrixWorld);if(o.isInstancedMesh){o.getMatrixAt(k,Mi);Mx.multiply(Mi);}
    for(let t=0;t<nT;t++){const a=idx?idx.getX(t*3):t*3,b=idx?idx.getX(t*3+1):t*3+1,c=idx?idx.getX(t*3+2):t*3+2;
      A.fromBufferAttribute(pos,a).applyMatrix4(Mx);B.fromBufferAttribute(pos,b).applyMatrix4(Mx);C.fromBufferAttribute(pos,c).applyMatrix4(Mx);
      const id=T.length;T.push([A.x,A.y,A.z,B.x,B.y,B.z,C.x,C.y,C.z]);
      const x0=Math.floor(Math.min(A.x,B.x,C.x)),x1=Math.floor(Math.max(A.x,B.x,C.x)),z0=Math.floor(Math.min(A.z,B.z,C.z)),z1=Math.floor(Math.max(A.z,B.z,C.z));
      if((x1-x0+1)*(z1-z0+1)>400){big.push(id);continue;}for(let x=x0;x<=x1;x++)for(let z=z0;z<=z1;z++){const kk=x*4096+z;let L=G.get(kk);if(!L)G.set(kk,L=[]);L.push(id);}}}});
const hitTri=(t,ox,oy,oz,dx,dz,L)=>{const e1x=t[3]-t[0],e1y=t[4]-t[1],e1z=t[5]-t[2],e2x=t[6]-t[0],e2y=t[7]-t[1],e2z=t[8]-t[2];
  const px=-dz*e2y,py=dz*e2x-dx*e2z,pz=dx*e2y;const det=e1x*px+e1y*py+e1z*pz;if(Math.abs(det)<1e-9)return false;const inv=1/det;
  const sx=ox-t[0],sy=oy-t[1],sz=oz-t[2];const u=(sx*px+sy*py+sz*pz)*inv;if(u<0||u>1)return false;
  const qx=sy*e1z-sz*e1y,qy=sz*e1x-sx*e1z,qz=sx*e1y-sy*e1x;const v=(dx*qx+dz*qz)*inv;if(v<0||u+v>1)return false;const tt=(e2x*qx+e2y*qy+e2z*qz)*inv;return tt>=0&&tt<=L;};
const ray=(ox,oy,oz,dx,dz,L)=>{const seen=new Set();for(let s=0;s<=Math.ceil(L*3);s++){const x=Math.floor(ox+dx*s/3),z=Math.floor(oz+dz*s/3);
    for(let ax=-1;ax<=1;ax++)for(let az=-1;az<=1;az++){const l=G.get((x+ax)*4096+z+az);if(!l)continue;for(const id of l){if(seen.has(id))continue;seen.add(id);if(hitTri(T[id],ox,oy,oz,dx,dz,L))return true;}}}
  for(const id of big)if(hitTri(T[id],ox,oy,oz,dx,dz,L))return true;return false;};
const res=[],D4=[[1,0],[0,1],[-1,0],[0,-1]];
for(let i=0;i<N;i++){if(!walkable(i)||flow[i]>=65535||kind[i]===K.DOOR)continue;const cx=cX(i)+.5,cz=cZ(i)+.5,h0=groundAt(cx,cz,cellH[i]+.05);if(!isFinite(h0))continue;
  for(const [dx,dz] of D4){const o={x:cx,z:cz,h:h0,grounded:true,vy:0};let mx=0;
    for(let s=0;s<30;s++){o.x+=dx*.06;o.z+=dz*.06;playerCollide(o,.34);playerCollide(o,.34);const g=groundAt(o.x,o.z,o.h);if(g>=o.h-.5)o.h=g;else break;mx=Math.max(mx,(o.x-cx)*dx+(o.z-cz)*dz);}
    if(mx>.9)continue;/* è arrivato nella cella accanto */
    const L=mx+.34+.3;let hit=false;
    for(let yy=.05;yy<1.8;yy+=.1){for(const lo of [0,-.25,.25]){if(ray(cx+dz*lo,h0+yy,cz+dx*lo,dx,dz,L)){hit=true;break;}}if(hit)break;}
    if(hit)continue;const nx=cX(i)+dx,nz=cZ(i)+dz,j=inb(nx,nz)?cellAt(nx,nz,h0):-1,KN=Object.keys(K).find(n=>K[n]===kind[j])||'?';
    if(KN==='BARS'||(KN==='DOOR'&&DOORS[doorOf[j]].kind==='gate'))continue;/* sbarre e cancelli: si vedono, ma i raggi passano tra le sbarre */
    res.push({da:[cX(i),cZ(i),cL(i)],dir:[dx,dz],h:+h0.toFixed(2),fermo:+mx.toFixed(2),zona:region[i]>=0?REG[region[i]].name:'-',
      contro:j<0?'fuori':KN+(kind[j]===K.PROP?' '+propCh[j]:'')+' strato '+cL(j)+(region[j]>=0?' '+REG[region[j]].name+(regionOpen[region[j]]?'':' (chiusa)'):'')+' h '+(+cellH[j].toFixed(2))});}}
regionOpen.forEach((_,r)=>regionOpen[r]=ro[r]);DOORS.forEach((d,k)=>{d.open=dop[k];d.anim=dop[k]?1:0;doorPose(d);});computeFlow();
return JSON.stringify({n:T.length,res});})"""
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
        pg=await b.new_page(viewport={"width":320,"height":200})
        errs=[];pg.on("pageerror",lambda e:errs.append("PAGEERR "+str(e)))
        await pg.goto((pathlib.Path(__file__).resolve().parent.parent/"dist"/"test.html").as_uri());await pg.wait_for_timeout(1200)
        await pg.evaluate(f"__t.selectMap('{MAPID}')")
        await pg.evaluate("window.__norender=true");await pg.click("#start");await pg.wait_for_timeout(500)
        await pg.evaluate("__t.toSpawn=0;__t.zombies.forEach(z=>{z.active=false;z.g.visible=false;});__t.alive=0;")
        r=json.loads(await pg.evaluate("__t.ev(%s)"%json.dumps(JS)))
        bad=0
        print("== zone che si toccano senza porta")
        for q in r['pairs']:
            flag='' if q['oa']==q['ob'] else '  <-- una aperta e una chiusa: muro invisibile a inizio partita'
            print(f"  {q['a']} | {q['b']}: {q['n']} celle, es. {q['at']}{flag}")
        print("== passaggi dove il giocatore resta bloccato (tutto aperto):",len(r['stuck']))
        for q in r['stuck'][:60]:print("  ",q)
        print("== isole irraggiungibili:")
        for q in r['islands']:print("  ",q)
        bad=len(r['stuck'])+sum(q['oa']!=q['ob'] for q in r['pairs'])
        for allOpen in (False,True):
            q=json.loads(await pg.evaluate("__t.ev(%s)(%s)"%(json.dumps(JS2),'true' if allOpen else 'false')))
            print("== muri invisibili (raggi contro %d triangoli), %s:"%(q['n'],'tutto aperto' if allOpen else 'inizio partita'),len(q['res']))
            for x in q["res"][:400]:print("  ",x)
            bad+=len(q['res'])
        print("\n".join(errs) or "no errors");print("problemi:",bad)
        await b.close()
asyncio.run(main())
