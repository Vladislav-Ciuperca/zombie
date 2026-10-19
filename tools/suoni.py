"""Suoni registrati (CC0) per il gioco.
  py tools/suoni.py analizza <file...>   → durata, picco e parti attive di ogni file (per scegliere quali usare)
  py tools/suoni.py costruisci <cartella> → legge tools/suoni_lista.json (percorsi relativi a <cartella>, dove stanno i pacchetti
                                           originali estratti) e scrive modelli/suoni.json (lo incorpora build.py)

I file vengono decodificati dal Chromium di Playwright (legge OGG e WAV di ogni tipo), portati a mono a 22050 Hz,
ripuliti dal silenzio, normalizzati e compressi in IMA ADPCM (4 bit per campione: 4 volte più piccoli del PCM a 16 bit).
Nel gioco li decodifica `sndDecode` in p3_engine.js (niente decodeAudioData: va uguale su Safari)."""
import asyncio, base64, json, math, pathlib, struct, sys
sys.stdout.reconfigure(encoding='utf-8')
R = pathlib.Path(__file__).resolve().parent.parent
SR = 22050

DECODE_JS = """async ([b64, sr]) => {
  const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  const tmp = new OfflineAudioContext(1, 1, 44100); const buf = await tmp.decodeAudioData(bin.buffer);
  const len = Math.max(1, Math.ceil(buf.duration * sr)); const off = new OfflineAudioContext(1, len, sr);
  const s = off.createBufferSource(); s.buffer = buf; s.connect(off.destination); s.start(); const r = await off.startRendering();
  const d = r.getChannelData(0), i16 = new Int16Array(d.length);
  for (let i = 0; i < d.length; i++) i16[i] = Math.max(-32768, Math.min(32767, Math.round(d[i] * 32767)));
  const u8 = new Uint8Array(i16.buffer); let s2 = ''; for (let i = 0; i < u8.length; i += 32768) s2 += String.fromCharCode.apply(null, u8.subarray(i, i + 32768));
  return btoa(s2); }"""

async def decode_all(paths):
    from playwright.async_api import async_playwright
    out = {}
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(); await pg.goto('about:blank')
        for f in paths:
            data = base64.b64encode(pathlib.Path(f).read_bytes()).decode()
            raw = base64.b64decode(await pg.evaluate(DECODE_JS, [data, SR]))
            out[f] = list(struct.unpack('<%dh' % (len(raw) // 2), raw))
        await b.close()
    return out

def segments(a, thr=.02, gap=.12):
    """parti attive: finestre di 10 ms sopra la soglia, unite se separate da meno di gap secondi"""
    w = SR // 100; act = []
    for i in range(0, len(a) - w, w):
        r = math.sqrt(sum(x * x for x in a[i:i + w]) / w) / 32768
        act.append(r > thr)
    segs = []; start = None; last = None
    for k, on in enumerate(act):
        if on:
            if start is None: start = k
            elif last is not None and (k - last) * .01 > gap: segs.append((start, last)); start = k
            last = k
    if start is not None: segs.append((start, last))
    return [(s * w, (e + 1) * w) for s, e in segs]

def zcr(a):
    return sum(1 for i in range(1, len(a)) if (a[i] >= 0) != (a[i - 1] >= 0)) / max(1, len(a)) * SR / 2

# ---------- IMA ADPCM ----------
STEPS = [7, 8, 9, 10, 11, 12, 13, 14, 16, 17, 19, 21, 23, 25, 28, 31, 34, 37, 41, 45, 50, 55, 60, 66, 73, 80, 88, 97, 107, 118, 130, 143,
         157, 173, 190, 209, 230, 253, 279, 307, 337, 371, 408, 449, 494, 544, 598, 658, 724, 796, 876, 963, 1060, 1166, 1282, 1411, 1552,
         1707, 1878, 2066, 2272, 2499, 2749, 3024, 3327, 3660, 4026, 4428, 4871, 5358, 5894, 6484, 7132, 7845, 8630, 9493, 10442, 11487,
         12635, 13899, 15289, 16818, 18500, 20350, 22385, 24623, 27086, 29794, 32767]
IDX = [-1, -1, -1, -1, 2, 4, 6, 8]
def adpcm(a):
    pred, ix = 0, 0; nib = []
    for s in a:
        st = STEPS[ix]; d = s - pred; code = 0
        if d < 0: code = 8; d = -d
        diff = st >> 3
        if d >= st: code |= 4; d -= st; diff += st
        if d >= st >> 1: code |= 2; d -= st >> 1; diff += st >> 1
        if d >= st >> 2: code |= 1; diff += st >> 2
        pred = max(-32768, min(32767, pred - diff if code & 8 else pred + diff))
        ix = max(0, min(88, ix + IDX[code & 7])); nib.append(code)
    if len(nib) & 1: nib.append(0)
    return bytes(nib[i] | (nib[i + 1] << 4) for i in range(0, len(nib), 2))

def prep(a, o):
    """taglio, silenzio, guadagno, dissolvenza: o = {da, a, max, gain, norm, fade}"""
    if 'da' in o or 'a' in o: a = a[int(o.get('da', 0) * SR):int(o['a'] * SR) if 'a' in o else None]
    segs = segments(a, o.get('soglia', .008), 99)
    if segs: a = a[max(0, segs[0][0] - SR // 200):min(len(a), segs[-1][1] + SR // 50)]
    if 'max' in o: a = a[:int(o['max'] * SR)]
    pk = max(1, max(abs(x) for x in a)); g = (o.get('norm', .92) * 32767 / pk) * o.get('gain', 1)
    a = [int(max(-32768, min(32767, x * g))) for x in a]
    f = int(o.get('fade', .03) * SR)
    for i in range(min(f, len(a))): a[-1 - i] = int(a[-1 - i] * i / f)
    return a

def main():
    cmd = sys.argv[1] if len(sys.argv) > 1 else ''
    if cmd == 'analizza':
        files = sys.argv[2:]; D = asyncio.run(decode_all(files))
        for f in files:
            a = D[f]; pk = max(abs(x) for x in a) / 32768; segs = segments(a)
            print(pathlib.Path(f).name, f'{len(a)/SR:.2f}s picco {pk:.2f} brillantezza {zcr(a):.0f}Hz', 'parti:', ' '.join(f'{s/SR:.2f}-{e/SR:.2f}' for s, e in segs[:12]))
        return
    if cmd == 'costruisci':
        L = json.loads((R / 'tools' / 'suoni_lista.json').read_text(encoding='utf-8')); S = pathlib.Path(sys.argv[2])
        files = sorted({(S / v['f']).as_posix() for vs in L.values() for v in vs})
        D = asyncio.run(decode_all(files)); out = {}; tot = 0
        for name, vs in L.items():
            out[name] = []
            for v in vs:
                a = D[(S / v['f']).as_posix()]
                parts = [a]
                if v.get('colpi'):  # più spari nello stesso file: ognuno dal suo inizio per 'colpi' secondi (al massimo 'quanti')
                    st = [s0 for s0, _ in segments(a, .12, .8)][:v.get('quanti', 3)]
                    parts = [a[max(0, s0 - SR // 200):s0 + int(v['colpi'] * SR)] for s0 in st]
                elif v.get('dividi'):
                    parts = [a[s:e] for s, e in segments(a, v.get('soglia', .02), v.get('pausa', .15)) if (e - s) / SR >= v.get('min', .25)]
                for pa in parts:
                    q = prep(pa, v); enc = adpcm(q); tot += len(enc)
                    out[name].append({'n': len(q), 'd': base64.b64encode(enc).decode()})
        (R / 'modelli' / 'suoni.json').write_text(json.dumps(out, separators=(',', ':')), encoding='utf-8')
        print('scritto modelli/suoni.json:', len(out), 'suoni,', sum(len(v) for v in out.values()), 'varianti,', f'{tot/1024:.0f} KB')
        return
    print(__doc__)

main()
