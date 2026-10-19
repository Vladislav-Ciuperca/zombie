"""Prova della chat vocale: python test/voice.py
Due pagine (host e giocatore) su un finto https://scn.test servito da Playwright (il microfono vuole un'origine sicura),
microfono finto di Chromium (un bip continuo), lobby vera sui server MQTT pubblici. Controlla che la connessione WebRTC
si apra nei due sensi e che ognuno senta l'altro (livello dell'audio in arrivo)."""
import asyncio, pathlib, mimetypes
from playwright.async_api import async_playwright
DIST = pathlib.Path(__file__).resolve().parent.parent / 'dist'
ORIGIN = 'https://scn.test'

async def serve(route):
    path = route.request.url[len(ORIGIN) + 1:].split('?')[0].split('#')[0] or 'test.html'
    f = DIST / path
    if f.is_file(): await route.fulfill(body=f.read_bytes(), content_type=mimetypes.guess_type(str(f))[0] or 'text/html')
    else: await route.fulfill(status=404, body='')

STATE = """()=>__t.ev(`(()=>{const L=[...VOICE.pcs.values()].map(v=>({id:v.id,stato:v.pc.connectionState,ice:v.pc.iceConnectionState,lvl:+v.lvl.toFixed(3),el:!!v.el}));
  return {me:NET.me,on:NET.on,host:NET.host,mic:!!VOICE.mic,mio:+VOICE.lvl.toFixed(3),peers:L};})()`)"""

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required',
                                          '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        ctx = await b.new_context(viewport={'width': 480, 'height': 270})
        await ctx.grant_permissions(['microphone'], origin=ORIGIN)
        await ctx.route(ORIGIN + '/**', serve)
        await ctx.add_init_script("try{localStorage.setItem('scn-voice','sempre');}catch(_){}window.__norender=true;")
        errs = []
        A = await ctx.new_page(); B = await ctx.new_page()
        for pg, n in ((A, 'A'), (B, 'B')): pg.on('pageerror', lambda e, n=n: errs.append(n + ' ' + str(e)))
        await A.goto(ORIGIN + '/test.html'); await B.goto(ORIGIN + '/test.html?r=2')
        # le pagine nascoste non disegnano: si fa andare il gioco a mano
        for pg in (A, B): await pg.evaluate("setInterval(()=>__t.step(performance.now()),50)")
        await A.wait_for_timeout(3000)
        await A.evaluate("()=>__t.ev('Sfx.init();netCreate()')")
        code = await A.evaluate("()=>__t.ev('NET.me')"); print('lobby', code)
        for k in range(40):
            await B.wait_for_timeout(500)
            if await B.evaluate(f"()=>__t.ev('NET.lobbies.has(\"{code}\")')"): break
        await B.evaluate(f"()=>__t.ev('Sfx.init();netJoin(\"{code}\")')")
        ok = False
        for k in range(30):
            await A.wait_for_timeout(1000)
            sa = await A.evaluate(STATE); sb = await B.evaluate(STATE)
            con = lambda s: [q for q in s['peers'] if q['stato'] == 'connected']
            if k % 5 == 4 or (con(sa) and con(sb)): print(k + 1, 's  A:', sa, '\n      B:', sb)
            if con(sa) and con(sb) and all(q['lvl'] > .01 for q in con(sa) + con(sb)): ok = True; break
        print('\n'.join(errs) or 'no errors'); print('VOCE OK' if ok else 'VOCE NON COLLEGATA')
        await b.close()
asyncio.run(main())
