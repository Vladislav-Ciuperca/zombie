/* Semplifica una mesh con texture togliendo triangoli dove la forma non cambia (costo con le quadriche di Garland-Heckbert),
   collassando un vertice su un vicino che c'è già (half-edge collapse): le superfici piatte restano esattamente piatte
   (niente effetto «carta stropicciata» della riduzione di Meshy) e le uv dei vertici rimasti non cambiano.
   Cuciture delle uv: un vertice sulla cucitura si sposta solo lungo la cucitura e ogni lato tiene la sua uv; i bordi aperti restano.
   Uso: node tools/semplifica.mjs ingresso.bin uscita.bin triangoli [libero]
   File: [nV, nT] uint32, posizioni float32 nV*3, uv float32 nV*2, indici uint32 nT*3 (lo scrive e lo legge meshy_assets.py) */
import fs from 'fs';
const [,, fin, fout, tgtS, modo] = process.argv; const target = +tgtS, libero = modo === 'libero';/* libero: per oggetti piccoli e ripetuti si può passare anche sopra le cuciture (uv del vertice più vicino) */
const buf = fs.readFileSync(fin), hdr = new Uint32Array(buf.buffer, buf.byteOffset, 2), nV = hdr[0], nT0 = hdr[1];
let o = buf.byteOffset + 8;
const POS = new Float32Array(buf.buffer.slice(o, o + nV * 12)); o += nV * 12;
const UV = new Float32Array(buf.buffer.slice(o, o + nV * 8)); o += nV * 8;
const IDX = new Uint32Array(buf.buffer.slice(o, o + nT0 * 12));
// punti = posizioni uguali saldate; wedge = vertice originale (punto + uv)
const key = new Map(), wP = new Int32Array(nV); let nP = 0; const px = [];
for (let i = 0; i < nV; i++) { const k = POS[i * 3] + ',' + POS[i * 3 + 1] + ',' + POS[i * 3 + 2]; let p = key.get(k); if (p === undefined) { p = nP++; key.set(k, p); px.push(POS[i * 3], POS[i * 3 + 1], POS[i * 3 + 2]); } wP[i] = p; }
const X = Float64Array.from(px);
// triangoli: wedge per angolo; scarto quelli degeneri
const TW = new Int32Array(nT0 * 3); let nT = 0;
for (let t = 0; t < nT0; t++) { const a = IDX[t * 3], b = IDX[t * 3 + 1], c = IDX[t * 3 + 2]; if (wP[a] === wP[b] || wP[b] === wP[c] || wP[a] === wP[c]) continue; TW[nT * 3] = a; TW[nT * 3 + 1] = b; TW[nT * 3 + 2] = c; nT++; }
const alive = new Uint8Array(nT).fill(1); let live = nT;
const inc = Array.from({ length: nP }, () => []);
for (let t = 0; t < nT; t++) for (let k = 0; k < 3; k++) inc[wP[TW[t * 3 + k]]].push(t);
const dead = new Uint8Array(nP);
// quadriche (10 numeri): piani delle facce pesati con l'area, più piani di bordo e di cucitura per non mangiarne il contorno
const Q = new Float64Array(nP * 10);
function addPlane(p, a, b, c, d, w) { const q = p * 10; Q[q] += w * a * a; Q[q + 1] += w * a * b; Q[q + 2] += w * a * c; Q[q + 3] += w * a * d; Q[q + 4] += w * b * b; Q[q + 5] += w * b * c; Q[q + 6] += w * b * d; Q[q + 7] += w * c * c; Q[q + 8] += w * c * d; Q[q + 9] += w * d * d; }
function triN(a, b, c) { const ux = X[b * 3] - X[a * 3], uy = X[b * 3 + 1] - X[a * 3 + 1], uz = X[b * 3 + 2] - X[a * 3 + 2], vx = X[c * 3] - X[a * 3], vy = X[c * 3 + 1] - X[a * 3 + 1], vz = X[c * 3 + 2] - X[a * 3 + 2];
  return [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx]; }
const tp = (t, k) => wP[TW[t * 3 + k]];
for (let t = 0; t < nT; t++) { const a = tp(t, 0), b = tp(t, 1), c = tp(t, 2); const n = triN(a, b, c), l = Math.hypot(n[0], n[1], n[2]); if (l < 1e-20) continue;
  const nx = n[0] / l, ny = n[1] / l, nz = n[2] / l, d = -(nx * X[a * 3] + ny * X[a * 3 + 1] + nz * X[a * 3 + 2]); for (const p of [a, b, c]) addPlane(p, nx, ny, nz, d, l / 2); }
// bordi aperti e cuciture: lato che sta in un solo triangolo (bordo) o i cui due triangoli hanno uv diverse (cucitura)
function edgeTris(a, b) { const r = []; for (const t of inc[a]) if (alive[t] && (tp(t, 0) === b || tp(t, 1) === b || tp(t, 2) === b)) r.push(t); return r; }
function wOf(t, p) { for (let k = 0; k < 3; k++) if (tp(t, k) === p) return TW[t * 3 + k]; return -1; }
const sameUV = (w1, w2) => w1 === w2 || (UV[w1 * 2] === UV[w2 * 2] && UV[w1 * 2 + 1] === UV[w2 * 2 + 1]);
for (let t = 0; t < nT; t++) for (let k = 0; k < 3; k++) { const a = tp(t, k), b = tp(t, (k + 1) % 3); if (a > b) continue; const ts = edgeTris(a, b);
  let feat = ts.length !== 2; if (!feat) { const [t1, t2] = ts; feat = !sameUV(wOf(t1, a), wOf(t2, a)) || !sameUV(wOf(t1, b), wOf(t2, b)); }
  if (!feat) continue; const n = triN(tp(t, 0), tp(t, 1), tp(t, 2)), ex = X[b * 3] - X[a * 3], ey = X[b * 3 + 1] - X[a * 3 + 1], ez = X[b * 3 + 2] - X[a * 3 + 2];
  let qx = ey * n[2] - ez * n[1], qy = ez * n[0] - ex * n[2], qz = ex * n[1] - ey * n[0]; const l = Math.hypot(qx, qy, qz); if (l < 1e-20) continue; qx /= l; qy /= l; qz /= l;
  const d = -(qx * X[a * 3] + qy * X[a * 3 + 1] + qz * X[a * 3 + 2]), w = (ex * ex + ey * ey + ez * ez) * 8; addPlane(a, qx, qy, qz, d, w); addPlane(b, qx, qy, qz, d, w); }
function cost(p1, p0) { const a = p1 * 10, b = p0 * 10, x = X[p0 * 3], y = X[p0 * 3 + 1], z = X[p0 * 3 + 2];
  const q = i => Q[a + i] + Q[b + i];
  return q(0) * x * x + 2 * q(1) * x * y + 2 * q(2) * x * z + 2 * q(3) * x + q(4) * y * y + 2 * q(5) * y * z + 2 * q(6) * y + q(7) * z * z + 2 * q(8) * z + q(9); }
function nbrs(p) { const s = new Set(); for (const t of inc[p]) if (alive[t]) for (let k = 0; k < 3; k++) { const q = tp(t, k); if (q !== p) s.add(q); } return s; }
// prova a collassare p1 su p0: restituisce null se non si può (varietà, cuciture, triangoli che si girano)
function plan(p1, p0) {
  const T1 = inc[p1].filter(t => alive[t]), del = T1.filter(t => tp(t, 0) === p0 || tp(t, 1) === p0 || tp(t, 2) === p0);
  if (!del.length || del.length > 2) return null;
  const opp = new Set(); for (const t of del) for (let k = 0; k < 3; k++) { const q = tp(t, k); if (q !== p0 && q !== p1) opp.add(q); }
  const n0 = nbrs(p0); let common = 0; for (const q of nbrs(p1)) if (n0.has(q)) { if (!opp.has(q)) return null; common++; }
  if (common !== opp.size) return null;
  // p1 su un bordo aperto: si muove solo lungo quel bordo (il lato p1-p0 deve essere di bordo)
  let onB = false; for (const t of T1) { for (let k = 0; k < 3 && !onB; k++) { const r = tp(t, k); if (r !== p1 && edgeTris(p1, r).length === 1) onB = true; } if (onB) break; }
  if (onB && del.length !== 1) return null;
  const map = new Map();
  for (const t of del) { const w1 = wOf(t, p1), w0 = wOf(t, p0); const m = map.get(w1); if (m !== undefined && !sameUV(m, w0)) return null; map.set(w1, w0); }
  const keep = T1.filter(t => !del.includes(t));
  for (const t of keep) { const w1 = wOf(t, p1); if (!map.has(w1)) { let ok = false; for (const [wa, wb] of map) if (sameUV(wa, w1)) { map.set(w1, wb); ok = true; break; }
      if (!ok && libero) { let bw = -1, bd = Infinity; for (const t0 of inc[p0]) if (alive[t0]) { const w0 = wOf(t0, p0), du = UV[w0 * 2] - UV[w1 * 2], dv = UV[w0 * 2 + 1] - UV[w1 * 2 + 1], dd = du * du + dv * dv; if (dd < bd) { bd = dd; bw = w0; } }
        if (bw >= 0) { map.set(w1, bw); ok = true; } }
      if (!ok) return null; } }
  for (const t of keep) { const a = tp(t, 0), b = tp(t, 1), c = tp(t, 2); const n = triN(a, b, c);
    const r = [a, b, c].map(q => q === p1 ? p0 : q); const m = triN(r[0], r[1], r[2]);
    const ln = Math.hypot(n[0], n[1], n[2]), lm = Math.hypot(m[0], m[1], m[2]); if (lm < ln * 1e-3) return null;
    if ((n[0] * m[0] + n[1] * m[1] + n[2] * m[2]) / (ln * lm + 1e-30) < .25) return null; }
  return { del, keep, map };
}
// mucchio (heap) dei punti con il loro collasso migliore
const hc = [], hv = [], hs = [], stamp = new Int32Array(nP), best = new Int32Array(nP).fill(-1);
function hpush(c, v, s) { let i = hc.length; hc.push(c); hv.push(v); hs.push(s); while (i > 0) { const p = (i - 1) >> 1; if (hc[p] <= hc[i]) break; [hc[p], hc[i]] = [hc[i], hc[p]]; [hv[p], hv[i]] = [hv[i], hv[p]]; [hs[p], hs[i]] = [hs[i], hs[p]]; i = p; } }
function hpop() { const r = [hc[0], hv[0], hs[0]], lc = hc.pop(), lv = hv.pop(), ls = hs.pop(); if (hc.length) { hc[0] = lc; hv[0] = lv; hs[0] = ls; let i = 0;
    for (;;) { const l = 2 * i + 1, rr = l + 1; let m = i; if (l < hc.length && hc[l] < hc[m]) m = l; if (rr < hc.length && hc[rr] < hc[m]) m = rr; if (m === i) break;
      [hc[m], hc[i]] = [hc[i], hc[m]]; [hv[m], hv[i]] = [hv[i], hv[m]]; [hs[m], hs[i]] = [hs[i], hs[m]]; i = m; } } return r; }
function rekey(p) { if (dead[p]) return; let bc = Infinity, bt = -1; for (const q of nbrs(p)) { const c = cost(p, q); if (c < bc) { bc = c; bt = q; } }
  stamp[p]++; best[p] = bt; if (bt >= 0) hpush(bc, p, stamp[p]); }
for (let p = 0; p < nP; p++) rekey(p);
const fail = new Uint8Array(nP);
while (live > target && hc.length) {
  const [c, p1, s] = hpop(); if (dead[p1] || s !== stamp[p1]) continue;
  // il vicino valido che costa meno; se costa più di quanto diceva il mucchio, torna in coda con il costo vero
  const cand = [...nbrs(p1)].map(q => [cost(p1, q), q]).sort((a, b) => a[0] - b[0]); let P = null, p0 = -1, pc = 0;
  for (const [cc, q] of cand) { P = plan(p1, q); if (P) { p0 = q; pc = cc; break; } }
  if (p0 < 0) { stamp[p1]++; continue; }  // nessun collasso valido: riprovo quando cambia qualcosa vicino
  if (pc > c * (1 + 1e-6) + 1e-18) { stamp[p1]++; hpush(pc, p1, stamp[p1]); continue; }
  for (const t of P.del) { alive[t] = 0; live--; for (let k = 0; k < 3; k++) { const q = tp(t, k), L = inc[q], i = L.indexOf(t); if (i >= 0) L.splice(i, 1); } }
  for (const t of P.keep) { for (let k = 0; k < 3; k++) if (tp(t, k) === p1) TW[t * 3 + k] = P.map.get(TW[t * 3 + k]); inc[p0].push(t); }
  inc[p1] = []; dead[p1] = 1; for (let i = 0; i < 10; i++) Q[p0 * 10 + i] += Q[p1 * 10 + i];
  rekey(p0); for (const q of nbrs(p0)) rekey(q);
}
// uscita: solo i wedge usati
const used = new Map(), outP = [], outU = [], outI = [];
for (let t = 0; t < nT; t++) { if (!alive[t]) continue; for (let k = 0; k < 3; k++) { const w = TW[t * 3 + k]; let n = used.get(w); if (n === undefined) { n = used.size; used.set(w, n); const p = wP[w]; outP.push(X[p * 3], X[p * 3 + 1], X[p * 3 + 2]); outU.push(UV[w * 2], UV[w * 2 + 1]); } outI.push(n); } }
const nv = used.size, nt = outI.length / 3, ob = Buffer.alloc(8 + nv * 20 + nt * 12);
ob.writeUInt32LE(nv, 0); ob.writeUInt32LE(nt, 4); let q = 8;
for (const v of outP) { ob.writeFloatLE(v, q); q += 4; } for (const v of outU) { ob.writeFloatLE(v, q); q += 4; } for (const v of outI) { ob.writeUInt32LE(v, q); q += 4; }
fs.writeFileSync(fout, ob);
console.log(`semplificata: ${nT0} → ${nt} triangoli, ${nv} vertici`);
