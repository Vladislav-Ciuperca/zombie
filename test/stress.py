import pathlib
import asyncio,sys
from playwright.async_api import async_playwright
MAPID=sys.argv[1]
AIM="""(()=>{const P=__t.P;let b=null,bd=1e9;for(const z of __t.zombies){if(!z.active||z.state==='dying'||z.state==='approach'||z.state==='rise'||z.state==='scale')continue;const d=Math.hypot(z.x-P.x,z.z-P.z);if(d<bd&&(__t.los(P.x,P.z,z.x,z.z,P.h)||z.state==='window')){bd=d;b=z;}}
 if(!b)return 'none';P.yaw=Math.atan2(-(b.x-P.x),-(b.z-P.z));P.pitch=Math.atan2(b.h+1.6*b.g.scale.x-(P.h+1.62),bd);__t.fire();return b.state+' '+bd.toFixed(1)+(b.fond?' F':'')+(b.crawl?' C':'');})()"""
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
        pg=await b.new_page(viewport={"width":320,"height":200})
        errs=[];pg.on("pageerror",lambda e:errs.append("PAGEERR "+str(e)))
        await pg.goto((pathlib.Path(__file__).resolve().parent.parent/"dist"/"test.html").as_uri());await pg.wait_for_timeout(1200)
        await pg.evaluate(f"__t.selectMap('{MAPID}')");await pg.evaluate("window.__norender=true");await pg.click("#start");await pg.wait_for_timeout(300)
        await pg.evaluate("__t.DEV.on=true;__t.DEV.god=true;__t.DOORS.forEach(d=>{if(!d.open)__t.openDoor(d)});__t.useI({t:'power'});__t.giveWeapon('mastino');['telanera','scossa','occhio','passosvelto','cadutalibera'].forEach(k=>__t.perksSet.add(k));")
        if MAPID=='acciaieria': await pg.evaluate("__t.Q2.step=5;__t.Q2.fondFrom=0;__t.startRound(6)")
        else: await pg.evaluate("__t.startRound(8)")
        for s in range(40):
            await pg.wait_for_timeout(1000)
            r=await pg.evaluate(AIM)
            if s%4==0:await pg.evaluate("(()=>{const w=__t.inv[__t.cur];if(w.mag<20){w.mag=0;w.reserve=500;__t.startReload();}})()")
            if s%9==0:await pg.evaluate("__t.P.pitch=-.3;__t.knife()")
            st=await pg.evaluate("({r:__t.round,a:__t.alive,s:__t.toSpawn,k:__t.kills,zs:__t.zombies.filter(z=>z.active).map(z=>z.state[0]+(z.fond?'F':'')+(z.crawl?'C':'')).join(''),err:document.getElementById('errbox').innerText.slice(0,200)})")
            if s%8==0 or st['err']: print(s,r,st)
            if st['err']: break
        print("\n".join(errs[:10]) or "no errors")
        await b.close()
asyncio.run(main())
