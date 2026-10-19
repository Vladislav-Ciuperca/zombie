"""Converte i modelli Meshy (modelli/meshy, FBX) nei dati del gioco.
Uso: py -I tools/meshy_assets.py personaggi|armi|oggetti|tutto [--anteprima CARTELLA] [--solo nome,nome]
     → modelli/meshy_personaggi.json, meshy_armi.json, meshy_oggetti.json (build.py: /*MESHY_PERSONAGGI*/, /*MESHY_ARMI*/, /*MESHY_OGGETTI*/)

Personaggi (zombie e sopravvissuti):
1) rig: i modelli riggati con Meshy hanno le giunture messe a mano dall'utente e i pesi di Meshy: si usano così come sono.
   Le tre varianti dei prigionieri senza rig (T-pose) ricevono giunture stimate dalla forma del corpo (proporzioni del prigioniero
   riggato + linee centrali di gambe e braccia) e pesi per zone (gambe, braccia, busto) sfumati attorno alle giunture;
2) posa di riposo come lo scheletro del gioco: braccia giù (un poco aperte, quanto basta a non entrare nei fianchi), gambe dritte,
   piedi che restano paralleli al pavimento;
3) scheletro PER MODELLO: le nostre ossa (BONES in p3_engine.js) vanno sulle giunture del modello, il modello non viene stirato.
   Con lo scheletro escono anche lunghezze di coscia/stinco, altezza del bacino e della caviglia (per i passi in poseZombie),
   la scatola della testa (hitbox) e la posizione degli occhi;
4) normali morbide, texture WebP (1024 gli zombie, 768 sopravvissuti e armi), dati binari compatti in base64."""
import sys, os, json, math, base64, io, glob, struct
sys.stdout.reconfigure(encoding='utf-8')
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import fbx2json as F
from PIL import Image
ROOT = os.path.dirname(HERE); ME = os.path.join(ROOT, 'modelli', 'meshy')

# ---------- vettori e rotazioni ----------
def sub(a, b): return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
def add(a, b): return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
def mul(a, s): return [a[0] * s, a[1] * s, a[2] * s]
def dot(a, b): return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
def cross(a, b): return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
def norm(a): l = math.sqrt(dot(a, a)) or 1; return [a[0] / l, a[1] / l, a[2] / l]
def length(a): return math.sqrt(dot(a, a))
def mat_from_to(u, v):
    """rotazione più corta che porta la direzione u sulla direzione v (Rodrigues)"""
    u = norm(u); v = norm(v); c = dot(u, v); ax = cross(u, v); s = length(ax)
    if s < 1e-9:
        if c > 0: return [[1, 0, 0], [0, 1, 0], [0, 0, 1]]
        ax = norm(cross(u, [1, 0, 0] if abs(u[0]) < .9 else [0, 1, 0])); s = 0; c = -1
    else: ax = mul(ax, 1 / s)
    x, y, z = ax; C = 1 - c
    return [[c + x * x * C, x * y * C - z * s, x * z * C + y * s],
            [y * x * C + z * s, c + y * y * C, y * z * C - x * s],
            [z * x * C - y * s, z * y * C + x * s, c + z * z * C]]
def mv(R, v): return [dot(R[0], v), dot(R[1], v), dot(R[2], v)]
def mm(A, B): return [[sum(A[i][k] * B[k][j] for k in range(3)) for j in range(3)] for i in range(3)]
I3 = [[1, 0, 0], [0, 1, 0], [0, 0, 1]]
# trasformazione rigida (R, t): v → R·v + t
def tapply(T, v): return add(mv(T[0], v), T[1])
def tcomp(A, B): return (mm(A[0], B[0]), add(mv(A[0], B[1]), A[1]))  # prima B poi A
def trot(R, pivot): return (R, sub(pivot, mv(R, pivot)))
def smooth(a, b, x):
    if a == b: return 1.0 if x >= a else 0.0
    t = max(0.0, min(1.0, (x - a) / (b - a))); return t * t * (3 - 2 * t)

# ---------- scheletro Meshy ----------
MPARENT = {'Hips': None, 'Spine02': 'Hips', 'Spine01': 'Spine02', 'Spine': 'Spine01', 'neck': 'Spine', 'Head': 'neck',
           'LeftUpLeg': 'Hips', 'LeftLeg': 'LeftUpLeg', 'LeftFoot': 'LeftLeg', 'LeftToeBase': 'LeftFoot',
           'RightUpLeg': 'Hips', 'RightLeg': 'RightUpLeg', 'RightFoot': 'RightLeg', 'RightToeBase': 'RightFoot',
           'LeftShoulder': 'Spine', 'LeftArm': 'LeftShoulder', 'LeftForeArm': 'LeftArm', 'LeftHand': 'LeftForeArm',
           'RightShoulder': 'Spine', 'RightArm': 'RightShoulder', 'RightForeArm': 'RightArm', 'RightHand': 'RightForeArm'}
ORDER = list(MPARENT)  # genitori prima dei figli
# ossa del gioco (BONES in p3_engine.js, stesso ordine); Meshy «Left» = x positivo = il nostro lato R
BONES = [('root', -1), ('hips', 0), ('spine', 1), ('neck', 18), ('head', 3), ('jaw', 4), ('shL', 18), ('elL', 6), ('shR', 18), ('elR', 8),
         ('hipL', 1), ('knL', 10), ('hipR', 1), ('knR', 12), ('haL', 7), ('haR', 9), ('ftL', 11), ('ftR', 13), ('chest', 2)]
BIDX = {b: i for i, (b, _) in enumerate(BONES)}
OURS = {'Hips': 'hips', 'Spine02': 'spine', 'Spine01': 'chest', 'Spine': 'chest', 'neck': 'neck', 'Head': 'head', 'head_end': 'head', 'headfront': 'head',
        'LeftShoulder': 'chest', 'RightShoulder': 'chest', 'LeftArm': 'shR', 'LeftForeArm': 'elR', 'LeftHand': 'haR',
        'RightArm': 'shL', 'RightForeArm': 'elL', 'RightHand': 'haL', 'LeftUpLeg': 'hipR', 'LeftLeg': 'knR', 'LeftFoot': 'ftR', 'LeftToeBase': 'ftR',
        'RightUpLeg': 'hipL', 'RightLeg': 'knL', 'RightFoot': 'ftL', 'RightToeBase': 'ftL'}
JOINT_OF = {'hips': 'Hips', 'spine': 'Spine02', 'chest': 'Spine01', 'neck': 'neck', 'head': 'Head', 'shR': 'LeftArm', 'elR': 'LeftForeArm', 'haR': 'LeftHand',
            'shL': 'RightArm', 'elL': 'RightForeArm', 'haL': 'RightHand', 'hipR': 'LeftUpLeg', 'knR': 'LeftLeg', 'ftR': 'LeftFoot',
            'hipL': 'RightUpLeg', 'knL': 'RightLeg', 'ftL': 'RightFoot'}
# proporzioni del prigioniero riggato (altezze / statura), per stimare le giunture dei modelli senza rig
RATIO = {'Hips': .533, 'LeftUpLeg': .485, 'LeftLeg': .292, 'LeftFoot': .069, 'Spine02': .61, 'Spine01': .687, 'Spine': .764, 'LeftShoulder': .789,
         'neck': .822, 'Head': .862}

# ---------- rig automatico (T-pose, modello rivolto verso +z, piedi a y=0) ----------
def auto_rig(P):
    n = len(P) // 3; V = [P[i * 3:i * 3 + 3] for i in range(n)]
    H = max(v[1] for v in V)
    def slab(y0, y1, cond=lambda v: True): return [v for v in V if y0 <= v[1] <= y1 and cond(v)]
    def cen(L): return [sum(v[k] for v in L) / len(L) for k in range(3)] if L else None
    J = {}
    # busto e testa: centro delle fette orizzontali (solo vicino all'asse, così le braccia in T non contano)
    for k in ('Hips', 'Spine02', 'Spine01', 'Spine', 'neck', 'Head'):
        y = RATIO[k] * H; c = cen(slab(y - .01, y + .01, lambda v: abs(v[0]) < .11 * H)); J[k] = [0, y, c[2] if c else 0]
    # ascella: la prima fascia in x dove anche la parte bassa dei vertici sta in alto (braccio orizzontale)
    def armpit(sg):
        for xb in range(int(.06 * H * 100), int(.4 * H * 100)):
            x0 = xb / 100; L = sorted(v[1] for v in V if x0 <= sg * v[0] < x0 + .01 and v[1] > .45 * H)
            if len(L) > 6 and L[len(L) // 10] > .66 * H: return x0
        return .12 * H
    for sg, pre in ((1, 'Left'), (-1, 'Right')):
        # gambe
        kn = cen(slab(RATIO['LeftLeg'] * H - .015, RATIO['LeftLeg'] * H + .015, lambda v: sg * v[0] > .005))
        an = cen(slab(RATIO['LeftFoot'] * H + .01, RATIO['LeftFoot'] * H + .04, lambda v: sg * v[0] > .005))
        hp = cen(slab(RATIO['LeftUpLeg'] * H - .01, RATIO['LeftUpLeg'] * H + .01, lambda v: sg * v[0] > .005 and abs(v[0]) < .14 * H))
        J[pre + 'UpLeg'] = [hp[0], RATIO['LeftUpLeg'] * H, hp[2]]
        J[pre + 'Leg'] = [kn[0], RATIO['LeftLeg'] * H, kn[2]]
        J[pre + 'Foot'] = [an[0], RATIO['LeftFoot'] * H, an[2]]
        feet = [v for v in V if v[1] < .05 * H and sg * v[0] > .005]
        front = max(v[2] for v in feet); J[pre + 'ToeBase'] = [an[0], .023 * H, an[2] + (front - an[2]) * .6]
        # braccia (orizzontali)
        ax = armpit(sg); tip = max(sg * v[0] for v in V if v[1] > .6 * H)
        xs = {'Arm': ax - .015 * H, 'Hand': tip - .105 * H}; xs['ForeArm'] = xs['Arm'] + (xs['Hand'] - xs['Arm']) * .516
        for b, x in xs.items():  # altezza e profondità = mediana della fetta del braccio (la spalla si misura poco fuori dall'ascella)
            xm = max(x, ax + .02 * H); L = [v for v in V if abs(sg * v[0] - xm) < .015 and v[1] > .62 * H]
            ym = sorted(v[1] for v in L)[len(L) // 2]; zm = sorted(v[2] for v in L)[len(L) // 2]; J[pre + b] = [sg * x, ym, zm]
        J[pre + 'Shoulder'] = [sg * .02 * H, RATIO['LeftShoulder'] * H, J['Spine'][2]]
        J[pre + 'Armpit'] = sg * ax
    # pesi per zone, sfumati attorno alle giunture
    W = []
    crotch = J['LeftUpLeg'][1]
    def chain(t, joints, names, rads):
        """t = coordinata lungo la catena (crescente), joints = valori di t delle giunture interne; sfuma entro ±rad"""
        w = {names[0]: 1.0}
        for j, nm, r in zip(joints, names[1:], rads):
            f = smooth(j - r, j + r, t)
            if f <= 0: break
            for k in list(w): w[k] *= (1 - f)
            w[nm] = w.get(nm, 0) + f
        return w
    tj = [J['Spine02'][1], J['Spine01'][1], J['Spine'][1], J['neck'][1], J['Head'][1]]
    for v in V:
        x, y, z = v; sg = 1 if x > 0 else -1; pre = 'Left' if x > 0 else 'Right'
        tw = chain(y, tj, ['Hips', 'Spine02', 'Spine01', 'Spine', 'neck', 'Head'], [.03 * H, .035 * H, .03 * H, .015 * H, .012 * H])
        w = {}
        # gamba: sotto il bacino, sfumata in alto verso i fianchi e al centro (cavallo) verso il bacino
        fl = smooth(crotch + .05 * H, crotch - .05 * H, y) * smooth(0, .025 * H, abs(x))
        # braccio: oltre l'ascella (in T-pose)
        fa = smooth(abs(J[pre + 'Armpit']) - .035 * H, abs(J[pre + 'Armpit']) + .01 * H, abs(x)) if y > .6 * H else 0
        if fl > 0:
            lw = chain(-y, [-J[pre + 'Leg'][1], -J[pre + 'Foot'][1]], [pre + 'UpLeg', pre + 'Leg', pre + 'Foot'], [.045 * H, .02 * H])
            for k, a in lw.items(): w[k] = w.get(k, 0) + a * fl
        if fa > 0:
            aw = chain(abs(x), [abs(J[pre + 'ForeArm'][0]), abs(J[pre + 'Hand'][0])], [pre + 'Arm', pre + 'ForeArm', pre + 'Hand'], [.03 * H, .015 * H])
            for k, a in aw.items(): w[k] = w.get(k, 0) + a * fa
        rest = 1 - fl - fa if fl + fa < 1 else 0
        if fl + fa > 1: w = {k: a / (fl + fa) for k, a in w.items()}
        for k, a in tw.items(): w[k] = w.get(k, 0) + a * rest
        W.append(sorted(((k, a) for k, a in w.items() if a > .01), key=lambda e: -e[1])[:4])
    for k in [k for k in J if k.endswith('Armpit')]: del J[k]
    return J, W

# ---------- posa di riposo del gioco ----------
def repose(V, W, J, arm_deg):
    """braccia giù (aperte di arm_deg gradi), gambe dritte; restituisce (vertici, giunture) nella nuova posa"""
    T = {}
    for b in ORDER:
        p = MPARENT[b]; Tp = T[p] if p else (I3, [0, 0, 0])
        Tb = Tp
        if b.endswith('UpLeg') or b.endswith('Leg'):
            ch = b.replace('UpLeg', 'Leg') if b.endswith('UpLeg') else b.replace('Leg', 'Foot')
            a = tapply(Tp, J[b]); c = tapply(Tp, J[ch]); Tb = tcomp(trot(mat_from_to(sub(c, a), [0, -1, 0]), a), Tp)
        elif b.endswith('Foot'):  # il piede resta come era (suola parallela al pavimento), solo spostato
            a = tapply(Tp, J[b]); Tb = (I3, sub(a, J[b]))
        elif b.endswith('Arm') or b.endswith('ForeArm'):
            sg = 1 if J[b][0] > 0 else -1; d = [sg * math.sin(math.radians(arm_deg)), -math.cos(math.radians(arm_deg)), 0]
            ch = b.replace('ForeArm', 'Hand') if b.endswith('ForeArm') else b.replace('Arm', 'ForeArm')
            a = tapply(Tp, J[b]); c = tapply(Tp, J[ch]); Tb = tcomp(trot(mat_from_to(sub(c, a), d), a), Tp)
        T[b] = Tb
    def tb(b): return T.get(b) or T[{'head_end': 'Head', 'headfront': 'Head'}.get(b, 'Hips')]
    NV = []
    for v, w in zip(V, W):
        if not w: NV.append(v); continue
        q = [0, 0, 0]; s = 0
        for b, a in w: q = add(q, mul(tapply(tb(b), v), a)); s += a
        NV.append(mul(q, 1 / s))
    NJ = {b: tapply(T[MPARENT[b]] if MPARENT[b] else (I3, [0, 0, 0]), J[b]) for b in ORDER}
    return NV, NJ

def arm_angle(V, W, J):
    """apertura minima delle braccia (gradi) perché mano e avambraccio non entrino nei fianchi"""
    armb = {'LeftForeArm', 'LeftHand', 'RightForeArm', 'RightHand'}
    for deg in range(4, 22):
        NV, NJ = repose(V, W, J, deg); ok = True
        for sg, pre in ((1, 'Left'), (-1, 'Right')):
            y0 = NJ[pre + 'Hand'][1] - .12; y1 = NJ[pre + 'ForeArm'][1]
            arm = {}; body = {}  # per fasce di 2 cm d'altezza: il punto più interno del braccio e il più esterno del corpo
            for v, w in zip(NV, W):
                if not w or not (y0 < v[1] < y1): continue
                k = int(v[1] / .02); wa = sum(a for b, a in w if b in armb and b.startswith(pre))
                if wa > .8: arm[k] = min(arm.get(k, 9), sg * v[0])
                elif sum(a for b, a in w if 'Arm' in b or 'Hand' in b) < .05 and sg * v[0] > 0: body[k] = max(body.get(k, -9), sg * v[0])
            if any(k in body and arm[k] < body[k] + .012 for k in arm): ok = False
        if ok: return deg
    return 22

# ---------- normali morbide (per punto di controllo: le cuciture delle UV non si vedono) ----------
def normals(V, IDX, CP):
    acc = {}
    for t in range(0, len(IDX), 3):
        a, b, c = V[IDX[t]], V[IDX[t + 1]], V[IDX[t + 2]]
        nn = cross(sub(b, a), sub(c, a))
        for j in IDX[t:t + 3]:
            o = acc.setdefault(CP[j], [0, 0, 0]); o[0] += nn[0]; o[1] += nn[1]; o[2] += nn[2]
    return [norm(acc.get(CP[i], [0, 1, 0])) for i in range(len(V))]

def b64(fmt, vals): return base64.b64encode(struct.pack('<%d%s' % (len(vals), fmt), *vals)).decode()
def tex64(path, size, q=72):
    """texture ridotta e compressa in WebP (circa il 35% più piccola del JPEG a pari qualità; Safari la legge da iOS 14)"""
    im = Image.open(path).convert('RGB'); im = im.resize((size, size), Image.LANCZOS)
    buf = io.BytesIO(); im.save(buf, 'WEBP', quality=q, method=6)
    return 'data:image/webp;base64,' + base64.b64encode(buf.getvalue()).decode()

def one(pattern):
    L = glob.glob(os.path.join(ME, pattern))
    if len(L) != 1: raise SystemExit('non trovo (o ne trovo più di uno): ' + pattern + ' → ' + repr(L))
    return L[0]

# nome, fbx, texture, uso, statura (m, solo per i modelli senza unità vere: quelli senza rig sono normalizzati da Meshy)
CHARS = [
    ('prigioniero', 'PERSONAGGI/Meshy_AI_rigged_zombie_prisone_biped/*_withSkin.fbx', 'PERSONAGGI/Meshy_AI_rigged_zombie_prisone_biped/*_texture_0.png', 'zombie', None),
    ('dilaniato', 'PERSONAGGI/Meshy_AI_zombie_prigione_dilan_*/*_texture.fbx', 'PERSONAGGI/Meshy_AI_zombie_prigione_dilan_*/*_texture.png', 'zombie', 1.80),
    ('robusto', 'PERSONAGGI/Meshy_AI_zombie_prigione_robus_*/*_texture.fbx', 'PERSONAGGI/Meshy_AI_zombie_prigione_robus_*/*_texture.png', 'zombie', 1.79),
    ('smunto', 'PERSONAGGI/Meshy_AI_zombie_prigione_smunt_*/*_texture.fbx', 'PERSONAGGI/Meshy_AI_zombie_prigione_smunt_*/*_texture.png', 'zombie', 1.83),
    ('atleta', 'PERSONAGGI/Meshy_AI_rigged_athlete_biped/*_withSkin.fbx', 'PERSONAGGI/Meshy_AI_rigged_athlete_biped/*_texture_0.png', 'giocatore', None),
    ('businessman', 'PERSONAGGI/Meshy_AI_rigged_businessman_biped/*_withSkin.fbx', 'PERSONAGGI/Meshy_AI_rigged_businessman_biped/*_texture_0.png', 'giocatore', None),
    ('punk', 'PERSONAGGI/Meshy_AI_rigged_punk_girl_biped/*_withSkin.fbx', 'PERSONAGGI/Meshy_AI_rigged_punk_girl_biped/*_texture_0.png', 'giocatore', None),
    ('meccanico', 'PERSONAGGI/Meshy_AI_rigged_survivor_mecha_biped/*_withSkin.fbx', 'PERSONAGGI/Meshy_AI_rigged_survivor_mecha_biped/*_texture_0.png', 'giocatore', None),
]

def character(name, fbx, png, use, height, preview=None):
    D = F.load(one(fbx))
    P = D['pos']; n = len(P) // 3
    rigged = bool(D['joints'])
    ys = P[1::3]; y0 = min(ys); H0 = max(ys) - y0
    s = (D['unit'] or 1) / 100 if rigged else height / H0  # → metri
    cx = (min(P[0::3]) + max(P[0::3])) / 2 if not rigged else 0
    V = [[(P[i * 3] - cx) * s, (P[i * 3 + 1] - y0) * s, P[i * 3 + 2] * s] for i in range(n)]
    if rigged:
        J = {k: [(v[0] - cx) * s, (v[1] - y0) * s, v[2] * s] for k, v in D['joints'].items()}
        W = [[(b, a) for b, a in w] for w in D['skin']]
    else:
        J, W = auto_rig([c for v in V for c in v])
    deg = arm_angle(V, W, J)
    NV, NJ = repose(V, W, J, deg)
    # nostre ossa: posizioni a riposo dalle giunture del modello
    pos = {b: NJ[m] for b, m in JOINT_OF.items()}
    pos['root'] = [0, 0, 0]
    # mascella: nessun peso (la bocca è nella texture), l'osso serve solo a poseZombie
    pos['jaw'] = add(pos['head'], [0, -.02, .03])
    off = []
    for b, p in BONES:
        off.append([round(c, 4) for c in (sub(pos[b], pos[BONES[p][0]]) if p >= 0 else pos[b])])
    # pesi sulle nostre ossa
    SI = []; SW = []
    for w in W:
        acc = {}
        for b, a in (w or [('Hips', 1)]): o = OURS.get(b, 'hips'); acc[o] = acc.get(o, 0) + a
        L4 = sorted(acc.items(), key=lambda e: -e[1])[:4]; t = sum(a for _, a in L4) or 1
        q = [round(a / t * 255) for _, a in L4]; q[0] += 255 - sum(q)
        L4 = [(BIDX[b], qq) for (b, _), qq in zip(L4, q)] + [(0, 0)] * (4 - len(L4))
        SI += [b for b, _ in L4]; SW += [a for _, a in L4]
    NRM = normals(NV, D['idx'], [c[0] for c in D['cp']])
    # testa: scatola dei vertici della testa (relativa all'osso), occhi
    hj = pos['head']
    hv = [v for v, w in zip(NV, W) if w and sum(a for b, a in w if OURS.get(b) == 'head') > .6]
    hx0 = min(v[0] for v in hv); hx1 = max(v[0] for v in hv); hy0 = min(v[1] for v in hv); hy1 = max(v[1] for v in hv)
    hz0 = min(v[2] for v in hv); hz1 = max(v[2] for v in hv)
    hb = [round(c, 3) for c in ((hx0 + hx1) / 2 - hj[0], (hy0 + hy1) / 2 - hj[1], (hz0 + hz1) / 2 - hj[2], hx1 - hx0 + .02, hy1 - hy0 + .02, hz1 - hz0 + .02)]
    top = max(v[1] for v in NV); ey = hj[1] + (top - hj[1]) * .5; ex = .032 * top / 1.8
    eyez = max((v[2] for v in hv if abs(abs(v[0]) - ex) < .01 and abs(v[1] - ey) < .012), default=hz1 - .02)
    eye = [round(ex, 3), round(ey - hj[1], 3), round(eyez - hj[2] - .004, 3)]
    sk = {'L1': round(length(sub(pos['knR'], pos['hipR'])), 4), 'L2': round(length(sub(pos['ftR'], pos['knR'])), 4), 'ay': round(pos['ftR'][1], 4),
          'hy': round(pos['hips'][1], 4), 'hd': round(pos['hips'][1] - pos['hipR'][1], 4)}
    UV = D['uv']
    out = {'nome': name, 'uso': use, 'h': round(top, 3), 'bones': off, 'sk': sk, 'hb': hb, 'eye': eye, 'nv': len(NV),
           'p': b64('h', [max(-32768, min(32767, round(c * 1000))) for v in NV for c in v]),
           'n': b64('b', [max(-127, min(127, round(c * 127))) for v in NRM for c in v]),
           'uv': b64('H', [max(0, min(65535, round(u * 65535))) for u in UV]),
           'si': b64('B', SI), 'sw': b64('B', SW), 'i': b64('H', D['idx']), 'tex': tex64(one(png), 1024 if use == 'zombie' else 768)}
    print(f'{name:12s} {"riggato" if rigged else "rig automatico":15s} vertici {len(NV):5d} triangoli {len(D["idx"]) // 3:5d} statura {top:.2f} m  braccia aperte {deg}°',
          f'coscia {sk["L1"]:.3f} stinco {sk["L2"]:.3f} caviglia {sk["ay"]:.3f} bacino {sk["hy"]:.3f}  testa {hb}  occhi {eye}  ~{sum(len(out[k]) for k in ("p","n","uv","si","sw","i","tex")) // 1024} KB')
    if preview:
        sys.path.insert(0, preview)
        try:
            import rast
            tex = Image.open(one(png)).convert('RGB'); tex.thumbnail((512, 512))
            flat = [c for v in NV for c in v]; im = Image.new('RGB', (900, 300))
            im.paste(rast.render(flat, D['idx'], 300, 'front', uv=UV, tex=tex), (0, 0)); im.paste(rast.render(flat, D['idx'], 300, 'side', uv=UV, tex=tex), (300, 0))
            import colorsys
            pal = {i: tuple(int(c * 255) for c in colorsys.hsv_to_rgb(i / 19 * .97, .85, 1)) for i in range(19)}
            col = [pal[SI[i * 4]] for i in range(len(NV))]
            im.paste(rast.render(flat, D['idx'], 300, 'front', col=col), (600, 0)); im.save(os.path.join(preview, 'ch_' + name + '.png'))
        except ImportError: pass
    return out

# ---------- armi ----------
# tipo di modello del gioco (WEAPONS[..].model) → cartella Meshy, impugnatura e mano davanti (u = 0 bocca … 1 calcio; None = niente)
GUNS = {
    'pistol': ('ARMI/*standard_pistol*', .75, None), 'revolver': ('ARMI/*arma_toro_2026*', .9, None), 'rifle': ('ARMI/*arma_lince*', .6, .35),
    'smg': ('ARMI/*arma_vespa*', .7, .38), 'drum': ('ARMI/*arma_tuono*', .58, .22), 'shotgun': ('ARMI/*arma_doppietta*', .66, .35),
    'pump': ('ARMI/*arma_cinghiale*', .62, .2), 'ar': ('ARMI/*arma_falco*', .68, .3), 'sniper': ('ARMI/*arma_aquila*', .66, .42),
    'mg': ('ARMI/*arma_orso*', .66, .4), 'ray': ('ARMI/*arma_fulminatore*', .83, .55), 'lmg': ('ARMI/*arma_mastino*', .72, .5),
    'hmg': ('ARMI/*arma_bisonte*', .87, .37), 'ar2': ('ARMI/*arma_lupo*', .68, .3), 'smg2': ('ARMI/*arma_faina*', .37, .2),
    'br': ('ARMI/*arma_cervo*', .6, .35), 'laser': ('ARMI/*arma_aurora*', .72, .47), 'vortex': ('ARMI/*black_hole*', .78, .5),
    'blunder': ('ARMI/*arma_spingarda_2026*', .68, .45), 'blunderAcid': ('ARMI/*arma_spingarda_acida*', .65, .4), 'bow': ('ARMI/*mystic_bow*', None, None),
}
NB = 40  # fasce del profilo (alto/basso) lungo l'arma

def gun(kind, folder, gu, fu, preview=None):
    fbx = one(folder + '/*.fbx')
    png = [q for q in glob.glob(os.path.join(os.path.dirname(fbx), '*.png')) if not any(k in os.path.basename(q) for k in ('metallic', 'normal', 'roughness'))][0]
    D = F.load(fbx); P = D['pos']; n = len(P) // 3
    # Meshy: canna lungo -x, alto +y → gioco: canna lungo -z (x' = -z, y' = y, z' = x)
    V = [[-P[i * 3 + 2], P[i * 3 + 1], P[i * 3]] for i in range(n)]
    out = {'kind': kind}
    if kind == 'bow':  # arco in verticale: le punte stanno dalla parte di chi tira (z più grande dell'impugnatura)
        ys = [v[1] for v in V]; y0, y1 = min(ys), max(ys); H = y1 - y0
        grip = [v[2] for v in V if abs(v[1] - (y0 + y1) / 2) < H * .05]; tips = [v[2] for v in V if abs(v[1] - (y0 + y1) / 2) > H * .45]
        if sum(tips) / len(tips) < sum(grip) / len(grip): V = [[-v[0], v[1], -v[2]] for v in V]
        tz = max(v[2] for v in V if abs(v[1] - (y0 + y1) / 2) > H * .47)
        xc = (min(v[0] for v in V) + max(v[0] for v in V)) / 2
        NV = [[(v[0] - xc) / H, (v[1] - (y0 + y1) / 2) / H, (v[2] - tz) / H] for v in V]  # punte a y=±0,5, z=0
    else:
        zs = [v[2] for v in V]; z0, z1 = min(zs), max(zs); L = z1 - z0
        mzl = [v for v in V if v[2] < z0 + L * .02]
        by = (min(v[1] for v in mzl) + max(v[1] for v in mzl)) / 2; bx = (min(v[0] for v in mzl) + max(v[0] for v in mzl)) / 2
        NV = [[(v[0] - bx) / L, (v[1] - by) / L, (v[2] - z0) / L] for v in V]  # bocca in (0,0,0), calcio a z=1
        top = [None] * NB; bot = [None] * NB
        for v in NV:
            k = min(NB - 1, int(v[2] * NB))
            if top[k] is None or v[1] > top[k]: top[k] = v[1]
            if bot[k] is None or v[1] < bot[k]: bot[k] = v[1]
        for arr in (top, bot):  # fasce vuote: come la vicina
            for k in range(NB):
                if arr[k] is None: arr[k] = next((arr[j] for j in sorted(range(NB), key=lambda j: abs(j - k)) if arr[j] is not None), 0)
        out['top'] = [round(t, 4) for t in top]; out['bot'] = [round(t, 4) for t in bot]
        def hand(u, fore):
            k = min(NB - 1, int(u * NB)); t, b = top[k], bot[k]
            return [0, round(b + .012 if fore else t - (t - b) * .55, 4), round(u, 4)]
        if gu is not None: out['grip'] = hand(gu, False)
        if fu is not None: out['fore'] = hand(fu, True)
        out['h'] = round(max(v[1] for v in NV) - min(v[1] for v in NV), 4)
    NRM = normals(NV, D['idx'], [c[0] for c in D['cp']])
    m = max(abs(c) for v in NV for c in v)
    out.update({'sc': round(m, 5), 'nv': len(NV), 'p': b64('h', [round(c / m * 32767) for v in NV for c in v]),
                'n': b64('b', [max(-127, min(127, round(c * 127))) for v in NRM for c in v]),
                'uv': b64('H', [max(0, min(65535, round(u * 65535))) for u in D['uv']]), 'i': b64('H', D['idx']), 'tex': tex64(png, 768)})
    print(f'{kind:12s} vertici {len(NV):5d} triangoli {len(D["idx"]) // 3:5d} impugnatura {out.get("grip")} davanti {out.get("fore")} ~{sum(len(out[k]) for k in ("p","n","uv","i","tex")) // 1024} KB')
    return out

# ---------- oggetti della mappa (GLB) ----------
# Modelli «image to 3D» in alta risoluzione (modelli/Meshy_AI_*_image-to-3d-texture_*): da 55.000 a 1,7 milioni di triangoli.
# Si alleggeriscono con tools/semplifica.mjs (Node) fino a «tri» triangoli: le superfici piatte restano piatte e le uv giuste.
# (La riduzione «low poly» di Meshy le stropicciava: l'utente l'ha bocciata.)
# nome nel gioco: (cartella in modelli/, regole). fit = (asse, misura): scala uguale su tutti gli assi; box = (larghezza, altezza, profondità):
# scala separata per asse; stair = (lunghezza, salita, larghezza) per le scale; split = pezzi che si muovono; anchor 'back' = retro a z=0;
# libero = oggetti piccoli e ripetuti: si semplifica anche sopra le cuciture delle uv
IMG = 'Meshy_AI_%s_2026*image-to-3d*'
OGG = {
    'bibita_tempra': (IMG % 'bibita_tempra', {'fit': ('y', 2.05), 'tri': 6000}), 'bibita_manolesta': (IMG % 'bibita_manolesta', {'fit': ('y', 2.05), 'tri': 6000}),
    'bibita_doppio': (IMG % 'bibita_doppiocolpo', {'fit': ('y', 2.05), 'tri': 6000}), 'bibita_occhio': (IMG % 'bibita_occhio', {'fit': ('y', 2.05), 'tri': 6000}),
    'cassa': (IMG % 'cassa', {'fit': ('x', 1.8), 'split': 'lid', 'tri': 8000}), 'bancale': (IMG % 'bancale_cassa', {'fit': ('x', 1.8), 'tri': 1200, 'texsz': 512, 'libero': 1}),
    'forgia': (IMG % 'forgia', {'fit': ('y', 2.35), 'tri': 10000}), 'corrente': (IMG % 'corrente', {'fit': ('x', .7), 'split': 'lever', 'anchor': 'back', 'tri': 4000, 'texsz': 512}),
    'porta2': (IMG % 'porta_blindata_2m', {'fit': ('y', 2.5), 'split': 'leaves', 'tri': 6000}), 'porta3': (IMG % 'porta_blindata_3m', {'fit': ('y', 2.5), 'split': 'leaves', 'tri': 6000}),
    'cancello2': (IMG % 'cancello_2m', {'box': (2.0, 2.5, .12), 'tri': 2500, 'libero': 1, 'texsz': 512}), 'cancello3': (IMG % 'cancello_3m', {'box': (3.0, 2.5, .12), 'tri': 3000, 'libero': 1, 'texsz': 512}),
    'finestra': (IMG % 'finestra', {'box': (2.0, 1.66, .98), 'tri': 3000, 'libero': 1}), 'asse': (IMG % 'asse', {'fit': ('x', 1.85), 'tri': 250, 'libero': 1, 'texsz': 512}),
    'ringhiera': (IMG % 'ringhiera', {'box': (1.0, 1.1, .12), 'tri': 400, 'libero': 1, 'texsz': 512}),
    'banco_scudo': (IMG % 'banco_scudo', {'fit': ('x', 1.9), 'tri': 8000}), 'banco_acido': (IMG % 'banco_acido', {'fit': ('x', 1.9), 'tri': 8000}),
    'sbarre_cella': (IMG % 'sbarre_cella', {'box': (2.0, 3.3, .1), 'tri': 3000, 'libero': 1, 'texsz': 512}), 'sbarre_cella_alta': (IMG % 'sbarre_cella_alta', {'box': (2.0, 4.4, .1), 'tri': 3200, 'libero': 1, 'texsz': 512}),
    'sbarre_modulo': (IMG % 'sbarre_modulo', {'box': (1.0, 3.3, .1), 'tri': 1200, 'libero': 1, 'texsz': 512}),
    'scala_broadway': (IMG % 'scala_broadway', {'stair': (7.0, 3.6, 2.0), 'tri': 30000, 'crease': 180})  # ringhiere sottili e grata: sotto ~30.000 si rompono, 'scala_tetto': (IMG % 'scala_tetto', {'stair': (7.0, 4.0, 2.0), 'axis': 'z', 'tri': 9000, 'libero': 1}),
}

def decimate(V, UV, T, target, libero=False):
    """semplifica i triangoli T (indici in V/UV) con tools/semplifica.mjs; restituisce (posizioni, uv, indici) nuovi"""
    import subprocess, tempfile
    used = sorted({i for t in T for i in t}); re = {i: k for k, i in enumerate(used)}
    d = tempfile.mkdtemp(); fi = os.path.join(d, 'in.bin'); fo = os.path.join(d, 'out.bin')
    with open(fi, 'wb') as f:
        f.write(struct.pack('<II', len(used), len(T)))
        f.write(struct.pack('<%df' % (len(used) * 3), *[V[i][k] for i in used for k in range(3)]))
        f.write(struct.pack('<%df' % (len(used) * 2), *[UV[i][k] for i in used for k in range(2)]))
        f.write(struct.pack('<%dI' % (len(T) * 3), *[re[i] for t in T for i in t]))
    r = subprocess.run(['node', os.path.join(HERE, 'semplifica.mjs'), fi, fo, str(target)] + (['libero'] if libero else []), capture_output=True, text=True)
    if r.returncode: raise SystemExit('semplifica.mjs: ' + r.stderr[-800:])
    b = open(fo, 'rb').read(); nv, nt = struct.unpack_from('<II', b); o = 8
    P = struct.unpack_from('<%df' % (nv * 3), b, o); o += nv * 12; U = struct.unpack_from('<%df' % (nv * 2), b, o); o += nv * 8; I = struct.unpack_from('<%dI' % (nt * 3), b, o)
    for x in (fi, fo): os.remove(x)
    os.rmdir(d)
    return [list(P[i * 3:i * 3 + 3]) for i in range(nv)], [list(U[i * 2:i * 2 + 2]) for i in range(nv)], list(I)

def crease(P, U, I, deg=40):
    """normali per angolo: lisce dentro le superfici, nette sugli spigoli (oltre deg gradi); divide i vertici dove serve"""
    ca = math.cos(math.radians(deg)); nt = len(I) // 3
    key = {}; pt = [key.setdefault((round(p[0], 5), round(p[1], 5), round(p[2], 5)), len(key)) for p in P]
    FN = []; at = [[] for _ in key]
    for t in range(nt):
        a, b, c = I[t * 3:t * 3 + 3]; n = cross(sub(P[b], P[a]), sub(P[c], P[a])); FN.append(n)
        for v in (a, b, c): at[pt[v]].append(t)
    unit = [norm(n) for n in FN]
    OP = []; OU = []; ON = []; OI = []; seen = {}
    for t in range(nt):
        for v in I[t * 3:t * 3 + 3]:
            acc = [0, 0, 0]
            for f in at[pt[v]]:
                if dot(unit[f], unit[t]) >= ca: acc = add(acc, FN[f])
            n = norm(acc); k = (v, round(n[0] * 60), round(n[1] * 60), round(n[2] * 60))
            jj = seen.get(k)
            if jj is None: jj = seen[k] = len(OP); OP.append(P[v]); OU.append(U[v]); ON.append(n)
            OI.append(jj)
    return OP, OU, ON, OI

def obj(name, folder, R):
    import glb
    L = glob.glob(os.path.join(ROOT, 'modelli', folder, '*.glb'))
    if len(L) != 1: raise SystemExit('non trovo (o ne trovo più di uno): ' + folder + ' → ' + repr(L))
    D = glb.load_glb(L[0])
    V = [list(p) for p in D['pos']]; NN = [list(n) for n in D['nrm']]; UV = [[u[0], 1 - u[1]] for u in D['uv']]; IDX = D['idx']  # glTF: v dall'alto
    if R.get('axis') == 'z': V = [[v[2], v[1], -v[0]] for v in V]; NN = [[n[2], n[1], -n[0]] for n in NN]  # la scala corre lungo z: la giro lungo x
    def bb(L): return [min(v[k] for v in L) for k in range(3)], [max(v[k] for v in L) for k in range(3)]
    lo, hi = bb(V); S = [1, 1, 1]
    if 'stair' in R:
        L_, rise, W_ = R['stair']; ln = hi[0] - lo[0]; wz = hi[2] - lo[2]; cz = (lo[2] + hi[2]) / 2
        core = [v for v in V if abs(v[2] - cz) < wz * .3]  # al centro della larghezza (fuori dai corrimano)
        def topAt(x0, x1):  # piano dell'ultimo gradino: la quota più alta dove stanno tanti vertici (non la cima del corrimano)
            ys = sorted((v[1] for v in core if x0 <= v[0] <= x1), reverse=True)
            for y in ys:
                if sum(1 for q in ys if abs(q - y) < .015) >= max(5, len(ys) * .1): return y
            return ys[0] if ys else lo[1]
        tA = topAt(lo[0], lo[0] + ln * .15); tB = topAt(hi[0] - ln * .15, hi[0])
        if tA > tB:  # parte bassa a x=0
            V = [[-v[0], v[1], -v[2]] for v in V]; NN = [[-n[0], n[1], -n[2]] for n in NN]; lo, hi = bb(V); tA, tB = tB, tA
        S = [L_ / ln, rise / (tB - lo[1]), W_ / wz]; org = [lo[0], lo[1], (lo[2] + hi[2]) / 2]
        print(f'   scala: gradino in cima a {tB - lo[1]:.3f} (modello), alta in tutto {hi[1] - lo[1]:.3f}')
    else:
        if 'fit' in R:
            ax, m = R['fit']; k = 'xyz'.index(ax); S = [m / (hi[k] - lo[k])] * 3
        else:
            bw, bh, bd = R['box']; S = [bw / (hi[0] - lo[0]), bh / (hi[1] - lo[1]), bd / (hi[2] - lo[2])]
        org = [(lo[0] + hi[0]) / 2, lo[1], lo[2] if R.get('anchor') == 'back' else (lo[2] + hi[2]) / 2]
    V = [[(v[k] - org[k]) * S[k] for k in range(3)] for v in V]
    NN = [norm([n[0] / S[0], n[1] / S[1], n[2] / S[2]]) for n in NN]  # normali con la scala non uniforme
    tris = [tuple(IDX[t:t + 3]) for t in range(0, len(IDX), 3)]
    def cen(t): return [sum(V[i][k] for i in t) / 3 for k in range(3)]
    parts = {'main': tris}; extra = {}
    sp = R.get('split')
    if sp == 'lid':  # coperchio = il pezzo separato più in alto (Meshy lo fa staccato e sospeso): lo appoggio sul corpo
        key = {}; cp = [key.setdefault((round(v[0], 4), round(v[1], 4), round(v[2], 4)), len(key)) for v in V]; par = list(range(len(key)))
        def fd(a):
            while par[a] != a: par[a] = par[par[a]]; a = par[a]
            return a
        for t in tris: a = fd(cp[t[0]]); par[fd(cp[t[1]])] = a; par[fd(cp[t[2]])] = a
        comp = {}
        for t in tris: comp.setdefault(fd(cp[t[0]]), []).append(t)
        lid = max(comp.values(), key=lambda T: min(V[i][1] for t in T for i in t)); ls = set(lid); body = [t for t in tris if t not in ls]
        bt = max(V[i][1] for t in body for i in t); lb = min(V[i][1] for t in lid for i in t)
        for i in {i for t in lid for i in t}: V[i][1] -= lb - bt
        hz = min(V[i][2] for t in lid for i in t); extra['hinge'] = [0, round(bt, 4), round(hz, 4)]
        parts = {'main': body, 'lid': lid}
    elif sp == 'leaves':  # battenti: dentro il telaio, a sinistra e a destra della fessura centrale
        W2 = max(abs(v[0]) for v in V); H = max(v[1] for v in V)
        lx = W2 * (.835 if name == 'porta2' else .842); ly = H * (.86 if name == 'porta2' else .92)
        Lf = [t for t in tris if abs(cen(t)[0]) < lx and cen(t)[1] < ly and cen(t)[0] < 0]; Rt = [t for t in tris if abs(cen(t)[0]) < lx and cen(t)[1] < ly and cen(t)[0] >= 0]
        used = set(Lf) | set(Rt); fr = [t for t in tris if t not in used]
        hl = min(V[i][0] for t in Lf for i in t); hr = max(V[i][0] for t in Rt for i in t)
        extra['hingeL'] = round(hl, 4); extra['hingeR'] = round(hr, 4)
        parts = {'main': fr, 'leafL': Lf, 'leafR': Rt}
    elif sp == 'lever':  # leva: la parte che sporge davanti, in basso al centro
        zf = sorted(v[2] for v in V)[int(len(V) * .9)]; ymid = max(v[1] for v in V) * .5
        lev = [t for t in tris if cen(t)[2] > zf + .012 and abs(cen(t)[0]) < .09 and cen(t)[1] < ymid]
        ls = set(lev); rest = [t for t in tris if t not in ls]
        lv = [V[i] for t in lev for i in t]; extra['hinge'] = [0, round(max(v[1] for v in lv), 4), round(min(v[2] for v in lv), 4)]; extra['front'] = round(zf, 4)
        parts = {'main': rest, 'lever': lev}
    lo, hi = bb(V); m = max(abs(c) for v in V for c in v)
    low = [v for v in V if v[1] < lo[1] + (hi[1] - lo[1]) * .45]  # impronta della parte bassa (per la sagoma contro cui si sbatte)
    extra['foot'] = [round(min(v[0] for v in low), 3), round(min(v[2] for v in low), 3), round(max(v[0] for v in low), 3), round(max(v[2] for v in low), 3)]
    out = {'sc': round(m, 5), 'box': [round(c, 3) for c in lo + hi], **extra, 'parts': {}}
    tot = 0
    for pn, T in parts.items():
        tg = max(120, round(R['tri'] * len(T) / len(tris)))
        P2, U2, I2 = decimate(V, UV, T, tg, R.get('libero')); P3, U3, N3, I3 = crease(P2, U2, I2, R.get('crease', 40)); tot += len(I3) // 3
        out['parts'][pn] = {'nv': len(P3), 'p': b64('h', [round(c / m * 32767) for v in P3 for c in v]),
                            'n': b64('b', [max(-127, min(127, round(c * 127))) for v in N3 for c in v]),
                            'uv': b64('H', [max(0, min(65535, round(c * 65535))) for u in U3 for c in u]), 'i': b64('I' if len(P3) > 65535 else 'H', I3)}
        if len(P3) > 65535: out['parts'][pn]['i32'] = 1  # più di 65.535 vertici: indici a 32 bit
    tz = R.get('texsz', 1024); im = Image.open(io.BytesIO(D['tex'])).convert('RGB').resize((tz, tz), Image.LANCZOS)
    buf = io.BytesIO(); im.save(buf, 'WEBP', quality=78, method=6); out['tex'] = 'data:image/webp;base64,' + base64.b64encode(buf.getvalue()).decode()
    print(f'{name:17s} triangoli {len(tris):7d} → {tot:6d} pezzi {list(parts)} misure {[round(hi[k] - lo[k], 2) for k in range(3)]} {extra} ~{len(json.dumps(out)) // 1024} KB')
    return out

def main():
    what = sys.argv[1] if len(sys.argv) > 1 else 'personaggi'
    prev = sys.argv[sys.argv.index('--anteprima') + 1] if '--anteprima' in sys.argv else None
    only = sys.argv[sys.argv.index('--solo') + 1].split(',') if '--solo' in sys.argv else None
    if what in ('personaggi', 'tutto'):
        res = [character(*c, preview=prev) for c in CHARS if not only or c[0] in only]
        if not only:
            dst = os.path.join(ROOT, 'modelli', 'meshy_personaggi.json')
            json.dump(res, open(dst, 'w', encoding='utf-8'), separators=(',', ':'))
            print('scritto', dst, os.path.getsize(dst) // 1024, 'KB')
    if what in ('oggetti', 'tutto'):
        dst = os.path.join(ROOT, 'modelli', 'meshy_oggetti.json')
        res = json.load(open(dst, encoding='utf-8')) if only and os.path.exists(dst) else {}  # con --solo si aggiornano solo quelli
        for k, v in OGG.items():
            if not only or k in only: res[k] = obj(k, *v)
        res = {k: res[k] for k in OGG if k in res}
        json.dump(res, open(dst, 'w', encoding='utf-8'), separators=(',', ':'))
        print('scritto', dst, os.path.getsize(dst) // 1024, 'KB')
    if what in ('armi', 'tutto'):
        res = {k: gun(k, *v, preview=prev) for k, v in GUNS.items() if not only or k in only}
        if not only:
            dst = os.path.join(ROOT, 'modelli', 'meshy_armi.json')
            json.dump(res, open(dst, 'w', encoding='utf-8'), separators=(',', ':'))
            print('scritto', dst, os.path.getsize(dst) // 1024, 'KB')

if __name__ == '__main__':
    main()
