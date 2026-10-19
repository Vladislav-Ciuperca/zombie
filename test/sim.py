import pathlib
import asyncio,sys
from playwright.async_api import async_playwright
MAPID=sys.argv[1]
AIM="""(()=>{const P=__t.P;let b=null,bd=1e9;for(const z of __t.zombies){if(!z.active||z.state==='dying'||z.state==='approach'||z.state==='rise')continue;const d=Math.hypot(z.x-P.x,z.z-P.z);if(d<bd&&(__t.los(P.x,P.z,z.x,z.z,P.h)||z.state==='window')){bd=d;b=z;}}
 if(!b)return 'none';P.yaw=Math.atan2(-(b.x-P.x),-(b.z-P.z));P.pitch=Math.atan2(b.h+1.3-(P.h+1.62),bd);__t.fire();return b.state+' '+bd.toFixed(1);})()"""
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
        pg=await b.new_page(viewport={"width":320,"height":200})
        errs=[];pg.on("pageerror",lambda e:errs.append("PAGEERR "+str(e)));pg.on("console",lambda m:errs.append("CONSOLE "+m.text) if m.type=='error' and 'TUNNEL' not in m.text else None)
        await pg.goto((pathlib.Path(__file__).resolve().parent.parent/"dist"/"test.html").as_uri());await pg.wait_for_timeout(1200)
        await pg.evaluate(f"__t.selectMap('{MAPID}')")
        await pg.evaluate("window.__norender=true");await pg.click("#start")
        for step in range(30):
            await pg.wait_for_timeout(1000)
            r=await pg.evaluate(AIM)
            st=await pg.evaluate("({r:__t.round,a:__t.alive,s:__t.toSpawn,k:__t.kills,pts:__t.points,hp:Math.round(__t.P.hp),h:__t.P.h.toFixed(2),st:__t.state,zs:__t.zombies.filter(z=>z.active).map(z=>z.state[0]).join(''),err:!document.getElementById('errbox').hidden})")
            if step%5==0 or st['st']!='playing' or st['err']: print(step,r,st)
            if st['st']!='playing' or st['err']: break
        print(await pg.evaluate("document.getElementById('errbox').innerText"))
        print("\n".join(errs[:10]) or "no errors")
        await b.close()
asyncio.run(main())
