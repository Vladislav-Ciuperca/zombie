"""Adatta il personaggio Kenney (CC0) allo scheletro dei nostri zombie.
Uso: py -I tools/kenney_zombie.py modelli/kenney/zombie.json modelli/zombie_kenney.json

1) braccia giù: il modello è in T-pose, le braccia ruotano di 90° attorno alla spalla (pelle mista = media pesata);
2) proporzioni umane: ogni osso Kenney viene portato sulla giuntura corrispondente del nostro scheletro (BONES in p3_engine.js)
   con una scala propria: gambe allungate (il modello ha l'anca a 62 cm su 1,88 m), testa ridotta a metà, busto quasi uguale;
3) pesi della pelle sulle nostre ossa (le giunture del gioco), normali morbide, tutto in metri.
Il risultato lo legge build.py (segnaposto /*ZOMBIE_KENNEY*/)."""
import json, sys, math
sys.stdout.reconfigure(encoding='utf-8')
src, dst = sys.argv[1], sys.argv[2]
D = json.load(open(src))
J = {k: v for k, v in D['joints'].items()}
G = .005  # cm del modello → metri (alto 3,77 m nel file → 1,88 m)

# nostro scheletro (posizioni a riposo, come BREST in p3_engine.js); L = lato x negativo
OUR = {'hips': (0, .95, 0), 'spine': (0, 1.03, 0), 'chest': (0, 1.31, 0), 'neck': (0, 1.53, 0), 'head': (0, 1.63, .01),
       'shL': (-.19, 1.46, 0), 'elL': (-.19, 1.18, 0), 'haL': (-.19, .93, 0), 'shR': (.19, 1.46, 0), 'elR': (.19, 1.18, 0), 'haR': (.19, .93, 0),
       'hipL': (-.1, .92, 0), 'knL': (-.1, .49, 0), 'ftL': (-.1, .07, 0), 'hipR': (.1, .92, 0), 'knR': (.1, .49, 0), 'ftR': (.1, .07, 0)}
BIDX = {'root': 0, 'hips': 1, 'spine': 2, 'neck': 3, 'head': 4, 'jaw': 5, 'shL': 6, 'elL': 7, 'shR': 8, 'elR': 9, 'hipL': 10, 'knL': 11, 'hipR': 12, 'knR': 13,
        'haL': 14, 'haR': 15, 'ftL': 16, 'ftR': 17, 'chest': 18}
# Kenney "Left" = x positivo = il nostro lato R
def side(n): return ('R', 'Left') if n.startswith('Left') else ('L', 'Right') if n.startswith('Right') else (None, None)
def ours(k):
    s, _ = side(k); b = k.replace('Left', '').replace('Right', '')
    if k in ('Hips', 'HipsCtrl', 'Root'): return 'hips'
    if k == 'Spine': return 'spine'
    if k in ('Chest', 'UpperChest'): return 'chest'
    if k == 'Neck': return 'neck'
    if k.startswith('Head'): return 'head'
    if b == 'Shoulder': return 'chest'
    if b == 'Arm': return 'sh' + s
    if b == 'ForeArm': return 'el' + s
    if b.startswith('Hand'): return 'ha' + s
    if b == 'UpLeg': return 'hip' + s
    if b == 'Leg': return 'kn' + s
    if b in ('Foot', 'Toes') or b.startswith('Toes'): return 'ft' + s
    return 'hips'

# --- 1) braccia giù ---
def rotz(v, c, a):
    x, y, z = v[0] - c[0], v[1] - c[1], v[2] - c[2]; ca, sa = math.cos(a), math.sin(a)
    return [c[0] + x * ca - y * sa, c[1] + x * sa + y * ca, c[2] + z]
ARM = {}
for k in J:
    s, pre = side(k); b = k.replace('Left', '').replace('Right', '')
    if s and (b in ('Arm', 'ForeArm') or b.startswith('Hand')):
        ARM[k] = (J[pre + 'Arm'], -math.pi / 2 if pre == 'Left' else math.pi / 2)
def repose_point(v, w):
    out = [0, 0, 0]; tot = 0
    for b, wt in w:
        q = rotz(v, *ARM[b]) if b in ARM else v
        out = [out[i] + q[i] * wt for i in range(3)]; tot += wt
    return [c / tot for c in out] if tot else v
JR = {k: (rotz(v, *ARM[k]) if k in ARM else v) for k, v in J.items()}  # giunture dopo aver abbassato le braccia

# --- 2) proporzioni: mappa affine per ogni osso Kenney ---
def L(a, b): return math.dist(JR[a], JR[b]) * G
M = {}  # k -> (punto Kenney, punto nostro, scala x, y, z)
def setm(k, target, sx, sy, sz): M[k] = (JR[k], target, (sx * G, sy * G, sz * G))
def apply(k, v):
    a, t, s = M[k]; return [t[i] + s[i] * (v[i] - a[i]) for i in range(3)]
torso = (OUR['neck'][1] - OUR['hips'][1]) / ((JR['Neck'][1] - JR['Hips'][1]) * G)
setm('Hips', OUR['hips'], 1, torso, 1)
for k in ('HipsCtrl', 'Root'):
    if k in JR: M[k] = M['Hips']
for k, p in (('Spine', 'Hips'), ('Chest', 'Spine'), ('UpperChest', 'Chest')): setm(k, apply(p, JR[k]), 1, torso, 1)
neck = (OUR['head'][1] - OUR['neck'][1]) / (L('Neck', 'Head'))
setm('Neck', OUR['neck'], .8, neck, .8)
HEAD = .52  # testa a misura d'uomo
setm('Head', OUR['head'], HEAD, HEAD, HEAD)
for pre, s in (('Left', 'R'), ('Right', 'L')):
    setm(pre + 'Shoulder', apply('UpperChest', JR[pre + 'Shoulder']), 1, 1, 1)
    setm(pre + 'Arm', OUR['sh' + s], .95, (OUR['sh' + s][1] - OUR['el' + s][1]) / L(pre + 'Arm', pre + 'ForeArm'), .95)
    setm(pre + 'ForeArm', OUR['el' + s], .9, (OUR['el' + s][1] - OUR['ha' + s][1]) / L(pre + 'ForeArm', pre + 'Hand'), .9)
    setm(pre + 'Hand', OUR['ha' + s], .78, .78, .78)
    for k in JR:
        if k.startswith(pre + 'Hand') and k != pre + 'Hand': M[k] = M[pre + 'Hand']
    setm(pre + 'UpLeg', OUR['hip' + s], .95, (OUR['hip' + s][1] - OUR['kn' + s][1]) / L(pre + 'UpLeg', pre + 'Leg'), .95)
    setm(pre + 'Leg', OUR['kn' + s], .9, (OUR['kn' + s][1] - OUR['ft' + s][1]) / ((JR[pre + 'Leg'][1] - JR[pre + 'Foot'][1]) * G), .9)
    setm(pre + 'Foot', OUR['ft' + s], .95, .95, .95)
    for k in JR:
        if k.startswith(pre + 'Toes'): M[k] = M[pre + 'Foot']
# --- 3) vertici ---
P = D['pos']; UV = D['uv']; IDX = D['idx']; SK = D['skin']; CP = D['cp']
n = len(P) // 3; out = []; si = []; sw = []
for i in range(n):
    v = P[i * 3:i * 3 + 3]; w = SK[i] or [['Hips', 1]]
    r = repose_point(v, w); tot = sum(x[1] for x in w)
    q = [0, 0, 0]
    for b, wt in w:
        mb = M.get(b, M['Hips']); a = apply(b, r) if b in M else apply('Hips', r)
        q = [q[c] + a[c] * wt / tot for c in range(3)]
    out.append(q)
    acc = {}
    for b, wt in w: acc[ours(b)] = acc.get(ours(b), 0) + wt / tot
    L4 = sorted(acc.items(), key=lambda e: -e[1])[:4]; s = sum(x[1] for x in L4)
    L4 = [(BIDX[b], x / s) for b, x in L4] + [(0, 0)] * (4 - len(L4))
    si += [b for b, _ in L4]; sw += [round(x, 3) for _, x in L4]
# il modello Kenney guarda verso +z come i nostri zombie; piedi a terra
miny = min(p[1] for p in out)
for p in out: p[1] -= miny
# normali morbide: per punto di controllo originale (così le cuciture delle UV non si vedono)
cpn = {}
for t in range(0, len(IDX), 3):
    a, b, c = (out[IDX[t]], out[IDX[t + 1]], out[IDX[t + 2]])
    u = [b[k] - a[k] for k in range(3)]; v = [c[k] - a[k] for k in range(3)]
    nn = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
    for j in IDX[t:t + 3]:
        key = CP[j][0]; o = cpn.setdefault(key, [0, 0, 0])
        for k in range(3): o[k] += nn[k]
NRM = []
for i in range(n):
    o = cpn.get(CP[i][0], [0, 1, 0]); l = math.sqrt(sum(x * x for x in o)) or 1; NRM += [round(x / l, 3) for x in o]
# occhi: i punti più avanti della faccia all'altezza degli occhi (per le luci arancioni)
hv = [out[i] for i in range(n) if any(b == 'Head' and wt > .6 for b, wt in SK[i])]
hy0 = min(p[1] for p in hv); hy1 = max(p[1] for p in hv); ey = hy0 + (hy1 - hy0) * .42
front = max(p[2] for p in hv if abs(p[1] - ey) < .03)
hj = OUR['head']
info = {'top': round(max(p[1] for p in out), 3), 'head': [round(hy0, 3), round(hy1, 3)], 'eye': [round(.045, 3), round(ey - hj[1], 3), round(front - hj[2] - .005, 3)]}
res = {'p': [round(c, 4) for p in out for c in p], 'n': NRM, 'uv': [round(x, 4) for x in UV], 'i': IDX, 'si': si, 'sw': sw, 'eye': info['eye']}
json.dump(res, open(dst, 'w'), separators=(',', ':'))
print('scritto', dst, 'vertici', n, 'triangoli', len(IDX) // 3, info)
