"""Legge un modello GLB (glTF binario, come lo esporta Meshy): vertici, normali, uv, triangoli e la texture del colore.
Solo dati (nessun codice del file viene eseguito). Applica le trasformazioni dei nodi. Uso: from glb import load_glb"""
import json, struct, math

CT = {5120: 'b', 5121: 'B', 5122: 'h', 5123: 'H', 5125: 'I', 5126: 'f'}
NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}

def _mat(node):
    if 'matrix' in node:
        m = node['matrix']; return [[m[c * 4 + r] for c in range(4)] for r in range(4)]
    t = node.get('translation', [0, 0, 0]); q = node.get('rotation', [0, 0, 0, 1]); s = node.get('scale', [1, 1, 1])
    x, y, z, w = q
    R = [[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
         [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
         [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]]
    return [[R[r][0] * s[0], R[r][1] * s[1], R[r][2] * s[2], t[r]] for r in range(3)] + [[0, 0, 0, 1]]
def _mul(a, b): return [[sum(a[i][k] * b[k][j] for k in range(4)) for j in range(4)] for i in range(4)]

def load_glb(path):
    data = open(path, 'rb').read()
    if data[:4] != b'glTF': raise SystemExit('non è un GLB: ' + path)
    pos = 12; J = None; BIN = b''
    while pos < len(data):
        ln, typ = struct.unpack_from('<II', data, pos); ch = data[pos + 8:pos + 8 + ln]; pos += 8 + ln
        if typ == 0x4E4F534A: J = json.loads(ch.decode('utf-8'))
        elif typ == 0x004E4942: BIN = ch
    def view(i):
        v = J['bufferViews'][i]; o = v.get('byteOffset', 0); return BIN[o:o + v['byteLength']], v.get('byteStride')
    def acc(i):
        a = J['accessors'][i]; raw, stride = view(a['bufferView']); o = a.get('byteOffset', 0); f = CT[a['componentType']]; n = NC[a['type']]
        sz = struct.calcsize(f); out = []
        st = stride or sz * n
        for k in range(a['count']):
            out.append(struct.unpack_from('<%d%s' % (n, f), raw, o + k * st))
        if a.get('normalized'):
            d = {'B': 255, 'H': 65535, 'b': 127, 'h': 32767}.get(f, 1); out = [tuple(c / d for c in v) for v in out]
        return out
    P = []; N = []; UV = []; IDX = []; tex = None
    def walk(ni, M):
        nonlocal tex
        node = J['nodes'][ni]; M2 = _mul(M, _mat(node))
        if 'mesh' in node:
            for pr in J['meshes'][node['mesh']]['primitives']:
                at = pr['attributes']; base = len(P)
                ps = acc(at['POSITION']); ns = acc(at['NORMAL']) if 'NORMAL' in at else [(0, 1, 0)] * len(ps)
                uvs = acc(at['TEXCOORD_0']) if 'TEXCOORD_0' in at else [(0, 0)] * len(ps)
                for p in ps: P.append([sum(M2[r][c] * p[c] for c in range(3)) + M2[r][3] for r in range(3)])
                for nn in ns:
                    v = [sum(M2[r][c] * nn[c] for c in range(3)) for r in range(3)]; l = math.sqrt(sum(c * c for c in v)) or 1; N.append([c / l for c in v])
                UV.extend([list(u) for u in uvs])
                ids = [i[0] for i in acc(pr['indices'])] if 'indices' in pr else list(range(len(ps)))
                IDX.extend(base + i for i in ids)
                if tex is None and 'material' in pr:
                    mt = J['materials'][pr['material']].get('pbrMetallicRoughness', {}).get('baseColorTexture')
                    if mt is not None:
                        im = J['images'][J['textures'][mt['index']]['source']]
                        if 'bufferView' in im: tex = view(im['bufferView'])[0]
        for c in node.get('children', []): walk(c, M2)
    I4 = [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]]
    for ni in J['scenes'][J.get('scene', 0)]['nodes']: walk(ni, I4)
    return {'pos': P, 'nrm': N, 'uv': UV, 'idx': IDX, 'tex': tex, 'json': J}
