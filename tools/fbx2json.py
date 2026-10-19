"""Converte un personaggio FBX binario (es. Kenney "Animated Characters", CC0) in un JSON compatto per il gioco.
Uso: py -I tools/fbx2json.py modelli/kenney/characterMedium.fbx modelli/kenney_zombie.json [--info]

Legge solo i dati (nessun codice del pacchetto viene eseguito): vertici, triangoli, UV, ossa (posizione nella posa di riposo),
pesi della pelle. Il gioco poi lega la mesh al suo scheletro (vedi zombie Kenney in p3_engine.js)."""
import struct, zlib, sys, json, math
sys.stdout.reconfigure(encoding="utf-8")

# ---------- lettura del formato FBX binario ----------
def read_fbx(data):
    if not data.startswith(b'Kaydara FBX Binary'):
        raise SystemExit('non è un FBX binario')
    ver = struct.unpack_from('<I', data, 23)[0]
    big = ver >= 7500
    pos = 27
    def prop(p):
        t = chr(data[p]); p += 1
        if t == 'Y': return struct.unpack_from('<h', data, p)[0], p + 2
        if t == 'C': return bool(data[p]), p + 1
        if t == 'I': return struct.unpack_from('<i', data, p)[0], p + 4
        if t == 'F': return struct.unpack_from('<f', data, p)[0], p + 4
        if t == 'D': return struct.unpack_from('<d', data, p)[0], p + 8
        if t == 'L': return struct.unpack_from('<q', data, p)[0], p + 8
        if t in 'SR':
            n = struct.unpack_from('<I', data, p)[0]; p += 4
            raw = data[p:p + n]; p += n
            return (raw.decode('utf-8', 'replace') if t == 'S' else raw), p
        if t in 'fdlib':
            n, enc, clen = struct.unpack_from('<III', data, p); p += 12
            raw = data[p:p + clen]; p += clen
            if enc == 1: raw = zlib.decompress(raw)
            fmt = {'f': 'f', 'd': 'd', 'l': 'q', 'i': 'i', 'b': 'b'}[t]
            return list(struct.unpack('<%d%s' % (n, fmt), raw[:n * struct.calcsize(fmt)])), p
        raise SystemExit('tipo di proprietà sconosciuto %r' % t)
    def node(p):
        if big:
            end, nprops, plen = struct.unpack_from('<QQQ', data, p); p += 24
        else:
            end, nprops, plen = struct.unpack_from('<III', data, p); p += 12
        nl = data[p]; p += 1
        if end == 0: return None, p
        name = data[p:p + nl].decode('ascii', 'replace'); p += nl
        props = []
        for _ in range(nprops):
            v, p = prop(p); props.append(v)
        kids = []
        while p < end:
            k, p2 = node(p)
            if k is None: p = p2; break
            kids.append(k); p = p2
        return {'n': name, 'p': props, 'c': kids}, end
    nodes = []
    while pos < len(data) - 160:
        nd, pos2 = node(pos)
        if nd is None: break
        nodes.append(nd); pos = pos2
    return nodes

def kid(n, name):
    for k in n['c']:
        if k['n'] == name: return k
    return None
def kids(n, name): return [k for k in n['c'] if k['n'] == name]
def p70(n):
    out = {}
    P = kid(n, 'Properties70')
    if P:
        for q in kids(P, 'P'):
            out[q['p'][0]] = q['p'][4:]
    return out

# ---------- matrici 4x4 (righe), stile FBX: colonna = vettore ----------
def mat_mul(a, b): return [[sum(a[i][k] * b[k][j] for k in range(4)) for j in range(4)] for i in range(4)]
def mat_from_list(l): return [[l[c * 4 + r] for c in range(4)] for r in range(4)]  # FBX salva per colonne
def mat_apply(m, v): return [m[i][0] * v[0] + m[i][1] * v[1] + m[i][2] * v[2] + m[i][3] for i in range(3)]
def mat_inv(m):
    import copy
    a = copy.deepcopy(m); n = 4; inv = [[float(i == j) for j in range(n)] for i in range(n)]
    for c in range(n):
        piv = max(range(c, n), key=lambda r: abs(a[r][c])); a[c], a[piv] = a[piv], a[c]; inv[c], inv[piv] = inv[piv], inv[c]
        d = a[c][c]
        for j in range(n): a[c][j] /= d; inv[c][j] /= d
        for r in range(n):
            if r != c:
                f = a[r][c]
                for j in range(n): a[r][j] -= f * a[c][j]; inv[r][j] -= f * inv[c][j]
    return inv

def load(src, info=False):
    """Legge l'FBX e restituisce il dizionario (vertici, uv, triangoli, giunture, pesi). Lo usa anche meshy_assets.py."""
    nodes = read_fbx(open(src, 'rb').read())
    top = {n['n']: n for n in nodes}
    objs = top['Objects']; conns = top['Connections']
    gs = p70(kid(top['GlobalSettings'], 'Properties70') and top['GlobalSettings'])
    unit = gs.get('UnitScaleFactor', [1.0])[0] if gs else 1.0
    upax = gs.get('UpAxis', [1])[0] if gs else 1
    byid = {}
    for o in objs['c']: byid[o['p'][0]] = o
    parent = {}; children = {}
    for c in kids(conns, 'C'):
        if c['p'][0] == 'OO' or c['p'][0] == 'OP':
            a, b = c['p'][1], c['p'][2]
            parent.setdefault(a, []).append(b); children.setdefault(b, []).append(a)
    geos = [o for o in objs['c'] if o['n'] == 'Geometry' and kid(o, 'Vertices')]
    models = {o['p'][0]: o for o in objs['c'] if o['n'] == 'Model'}
    nm = lambda o: o['p'][1].split('\x00')[0]
    if info:
        print('unità (cm per unità):', unit, 'asse su:', upax)
        for i, o in models.items(): print('Model', nm(o), o['p'][2], '→ padre', [nm(byid[p]) for p in parent.get(i, []) if p in byid])
    g = geos[0]
    V = kid(g, 'Vertices')['p'][0]; PV = kid(g, 'PolygonVertexIndex')['p'][0]
    uvl = kid(g, 'LayerElementUV'); UV = kid(uvl, 'UV')['p'][0]; UVI = kid(uvl, 'UVIndex')['p'][0] if kid(uvl, 'UVIndex') else None
    uvmap = kid(uvl, 'MappingInformationType')['p'][0]
    # clusters (ossa → vertici)
    skin = [byid[c] for c in children.get(g['p'][0], []) if c in byid and byid[c]['n'] == 'Deformer' and byid[c]['p'][2] == 'Skin']
    clusters = [byid[c] for c in children.get(skin[0]['p'][0], [])] if skin else []
    bones = []; W = [dict() for _ in range(len(V) // 3)]
    for cl in clusters:
        bid = [c for c in children.get(cl['p'][0], []) if c in models]
        if not bid: continue
        bname = nm(models[bid[0]])
        tl = kid(cl, 'TransformLink'); tl = mat_from_list(tl['p'][0]) if tl else None
        ix = kid(cl, 'Indexes'); ws = kid(cl, 'Weights')
        bones.append({'name': bname, 'id': bid[0], 'link': tl})
        if ix:
            for i, w in zip(ix['p'][0], ws['p'][0]):
                if w > 1e-4: W[i][bname] = W[i].get(bname, 0) + w
    # posizione delle giunture nella posa di riposo = traslazione di TransformLink (mondo)
    joints = {}
    for b in bones:
        m = b['link']; joints[b['name']] = [m[0][3], m[1][3], m[2][3]]
    hier = {}
    for b in bones:
        ps = [p for p in parent.get(b['id'], []) if p in models]
        hier[b['name']] = nm(models[ps[0]]) if ps else None
    # trasformazione della mesh (Geometry → Model) per portare i vertici nel mondo
    gm = [p for p in parent.get(g['p'][0], []) if p in models]
    # triangoli (ventaglio sui poligoni)
    tris = []; poly = []; corner = 0
    for k, vi in enumerate(PV):
        end = vi < 0; v = ~vi if end else vi
        if uvmap == 'ByPolygonVertex': u = UVI[k] if UVI else k
        else: u = UVI[v] if UVI else v
        poly.append((v, u))
        if end:
            for t in range(1, len(poly) - 1): tris.append((poly[0], poly[t], poly[t + 1]))
            poly = []
    # vertici nello spazio del mondo (come le giunture): trasformazione del Model della mesh (Lcl Scaling, poi Lcl Rotation XYZ, poi Lcl Translation)
    if gm:
        pr = p70(models[gm[0]]); S = pr.get('Lcl Scaling', [1, 1, 1]); R = [math.radians(a) for a in pr.get('Lcl Rotation', [0, 0, 0])]; Tt = pr.get('Lcl Translation', [0, 0, 0])
        def rot(v):
            x, y, z = v
            c, s_ = math.cos(R[0]), math.sin(R[0]); y, z = y * c - z * s_, y * s_ + z * c
            c, s_ = math.cos(R[1]), math.sin(R[1]); x, z = x * c + z * s_, -x * s_ + z * c
            c, s_ = math.cos(R[2]), math.sin(R[2]); x, y = x * c - y * s_, x * s_ + y * c
            return [x, y, z]
        V2 = []
        for i in range(0, len(V), 3):
            v = rot([V[i] * S[0], V[i + 1] * S[1], V[i + 2] * S[2]]); V2 += [v[0] + Tt[0], v[1] + Tt[1], v[2] + Tt[2]]
        V = V2
    # appiattisco: un vertice per coppia (vertice, uv)
    key = {}; P = []; T = []; idx = []; SK = []
    for tri in tris:
        for v, u in tri:
            k = (v, u)
            if k not in key:
                key[k] = len(P) // 3; P += V[v * 3:v * 3 + 3]; T += [UV[u * 2], UV[u * 2 + 1]]
                SK.append(sorted(W[v].items(), key=lambda e: -e[1])[:4])
            idx.append(key[k])
    out = {'cp': [key_v for key_v, _ in sorted(key.items(), key=lambda e: e[1])], 'unit': unit, 'up': upax, 'joints': joints, 'parent': hier, 'pos': [round(x, 4) for x in P], 'uv': [round(x, 5) for x in T], 'idx': idx,
           'skin': [[[b, round(w, 4)] for b, w in s] for s in SK]}
    if info:
        ys = P[1::3]; xs = P[0::3]; zs = P[2::3]
        print('vertici', len(P) // 3, 'triangoli', len(idx) // 3, 'bbox x', min(xs), max(xs), 'y', min(ys), max(ys), 'z', min(zs), max(zs))
        for b in bones: print('  osso', b['name'], 'padre', hier[b['name']], 'giuntura', [round(c, 3) for c in joints[b['name']]])
    return out

def main():
    src, dst = sys.argv[1], sys.argv[2]
    out = load(src, '--info' in sys.argv)
    json.dump(out, open(dst, 'w'), separators=(',', ':'))
    print('scritto', dst)

if __name__ == '__main__':
    main()
