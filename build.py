"""Assembla il gioco: python build.py  ->  dist/gioco.html (offline), dist/online.html (three.js da CDN), dist/test.html (con hook __t per i test)"""
import json,os,pathlib
R=pathlib.Path(__file__).resolve().parent
# mappe del gioco: nome -> segnaposti in p2_data.js, uno per strato (La Rocca ha tre strati sovrapposti: un file per strato)
MAPPE={'prigione':['MAP_PRIGIONE'],'acciaieria':['MAP_ACCIAIERIA'],'rocca':[f'MAP_ROCCA{l}' for l in range(3)],'cascate':['MAP_CASCATE']}
def txts(nome,n):return [f'{nome}.txt'] if n==1 else [f'{nome}_{l}.txt' for l in range(n)]
def tmx_rows(tmx):
    """mappa disegnata con Tiled -> una griglia (80 righe da 100 caratteri) per ogni livello di tessere, dal basso;
    il carattere di ogni tessera è la sua proprietà ch (mappe/tessere.tsx), le celle senza tessera sono spazi"""
    import xml.etree.ElementTree as ET,base64,zlib,gzip,struct
    def err(m):return SystemExit(f'mappe/{tmx.name}: {m}')
    root=ET.parse(tmx).getroot()
    if root.get('infinite')=='1' or (root.get('width'),root.get('height'))!=('100','80'):raise err('serve una mappa di 100×80 tessere, non infinita (Map → Resize Map)')
    sets=[]
    for ts in root.findall('tileset'):
        src=ET.parse(tmx.parent/ts.get('source')).getroot() if ts.get('source') else ts;chs={}
        for t in src.iter('tile'):
            for p in t.iter('property'):
                if p.get('name')=='ch':chs[int(t.get('id'))]=p.get('value',p.text or '') or ' '
        sets.append((int(ts.get('firstgid')),chs))
    sets.sort(key=lambda s:-s[0])
    def ch(g,x,z,nm):
        g&=0x0FFFFFFF   # senza i bit di specchiatura e rotazione
        if not g:return ' '
        first,chs=next((s for s in sets if s[0]<=g),(0,{}));c=chs.get(g-first)
        if c is None or len(c)!=1:raise err(f'livello «{nm}», colonna {x}, riga {z}: la tessera non ha la proprietà ch (un carattere)')
        return c
    def layers(e):   # livelli di tessere nell'ordine del file (dal basso), anche dentro i gruppi
        for c in e:
            if c.tag=='layer':yield c
            elif c.tag=='group':yield from layers(c)
    out=[]
    for L in layers(root):
        nm=L.get('name');d=L.find('data');enc=d.get('encoding');comp=d.get('compression')
        if enc=='csv':g=[int(v) for v in d.text.split(',') if v.strip()]
        elif enc=='base64':
            raw=base64.b64decode(d.text.strip())
            if comp in ('zlib','gzip'):raw=(zlib if comp=='zlib' else gzip).decompress(raw)
            elif comp:raise err(f'livello «{nm}»: compressione {comp} non supportata, salva in CSV (Map → Map Properties → Tile Layer Format)')
            g=struct.unpack(f'<{len(raw)//4}I',raw)
        else:g=[int(t.get('gid',0)) for t in d.iter('tile')]
        if len(g)!=8000:raise err(f'livello «{nm}»: servono 100×80 tessere, ce ne sono {len(g)}')
        out.append([''.join(ch(g[z*100+x],x,z,nm) for x in range(100)) for z in range(80)])
    if not out:raise err('nessun livello di tessere')
    return out
def tmx_sync():
    """se c'è mappe/<nome>.tmx (disegnata con Tiled) rifà i .txt da lì; un .txt cambiato a mano dopo il .tmx non viene sovrascritto"""
    for tmx in sorted((R/'mappe').glob('*.tmx')):
        nome=tmx.stem;grids=tmx_rows(tmx);n=len(grids)
        if nome in MAPPE and n!=len(MAPPE[nome]):
            raise SystemExit(f'mappe/{tmx.name}: ha {n} livelli ma il gioco ne legge {len(MAPPE[nome])} (layers e layerBase in src/p2_data.js, MAPPE in build.py)')
        todo=[]
        for f,rows in zip(txts(nome,n),grids):
            p=R/'mappe'/f;new='\n'.join(rows)
            if p.exists():
                if p.read_text(encoding='utf-8')==new:   # già uguale: la data nuova dice che è allineato al .tmx
                    if p.stat().st_mtime<tmx.stat().st_mtime:os.utime(p)
                    continue
                if p.stat().st_mtime>tmx.stat().st_mtime:
                    raise SystemExit(f"mappe/{f} è stato cambiato a mano dopo l'ultimo salvataggio di mappe/{tmx.name}: la build non lo sovrascrive.\n"
                                     f"  Per tenere il .txt:  py mappe/tiled.py da-txt {nome}   (rifà il .tmx dai .txt)\n"
                                     f"  Per tenere il .tmx:  risalvalo in Tiled (o cancella mappe/{f}) e rilancia la build")
            todo.append((p,new))
        for p,new in todo:p.write_text(new,encoding='utf-8',newline='\n');print('mappa',p.name,'<-',tmx.name)
def arr(p):
    rows=(R/'mappe'/p).read_text(encoding='utf-8').split('\n')
    assert len(rows)==80 and all(len(r)==100 for r in rows),f'{p}: servono 80 righe da 100 caratteri, senza a capo finale'
    return '[\n'+',\n'.join(json.dumps(r) for r in rows)+'\n]'
tmx_sync()
html=(R/'src'/'p1_html.html').read_text(encoding='utf-8')
js=''.join((R/'src'/f).read_text(encoding='utf-8') for f in ['p2_data.js','p3_engine.js','p4_world.js','p5_logic.js','p5b_net.js','p6_ui.js'])
for nome,seg in MAPPE.items():
    for s,f in zip(seg,txts(nome,len(seg))):js=js.replace(f'/*{s}*/',arr(f))
# zombie Kenney (CC0): mesh già adattata allo scheletro (tools/kenney_zombie.py) e le due pelli, dentro il file
import base64
zk=(R/'modelli'/'zombie_kenney.json').read_text(encoding='utf-8')
ztex=['data:image/png;base64,'+base64.b64encode((R/'modelli'/'kenney'/f).read_bytes()).decode() for f in ('zombieMaleA.png','zombieFemaleA.png')]
js=js.replace('/*ZOMBIE_KENNEY*/',f'const ZK={zk};const ZK_TEX={json.dumps(ztex)};')
# personaggi Meshy (tools/meshy_assets.py personaggi → modelli/meshy_personaggi.json)
mp=R/'modelli'/'meshy_personaggi.json'
js=js.replace('/*MESHY_PERSONAGGI*/','const MESHY_CH='+(mp.read_text(encoding='utf-8') if mp.exists() else 'null')+';')
ma=R/'modelli'/'meshy_armi.json'
js=js.replace('/*MESHY_ARMI*/','const MESHY_ARMI='+(ma.read_text(encoding='utf-8') if ma.exists() else 'null')+';')
mo=R/'modelli'/'meshy_oggetti.json'
js=js.replace('/*MESHY_OGGETTI*/','const MESHY_OGG='+(mo.read_text(encoding='utf-8') if mo.exists() else 'null')+';')
# suoni registrati CC0 (tools/suoni.py → modelli/suoni.json)
js=js.replace('/*SUONI*/','const SND_DATA='+(R/'modelli'/'suoni.json').read_text(encoding='utf-8')+';')
CDN='<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>'
three=(R/'vendor'/'three.min.js').read_text(encoding='utf-8').replace('</script','<\\/script')
body=html+'\n'+CDN+'\n<script>\n'+js+'\n</script>\n'
# le meta "web-app" fanno partire il gioco a schermo intero quando lo si apre dall'icona sulla schermata Home (iPhone e Android)
HEAD=('<!DOCTYPE html>\n<html lang="it">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,user-scalable=no">\n'
      '<meta name="apple-mobile-web-app-capable" content="yes">\n<meta name="mobile-web-app-capable" content="yes">\n'
      '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">\n<meta name="apple-mobile-web-app-title" content="Scoglio Nero">\n'
      '<meta name="theme-color" content="#07090a">\n<title>Penitenziario Scoglio Nero</title>\n</head>\n<body>\n')
END='\n</body>\n</html>\n'
D=R/'dist';D.mkdir(exist_ok=True)
prod=body.replace('/*TESTHOOK*/\n','')
(D/'online.html').write_text(HEAD+prod+END,encoding='utf-8',newline='\n')
(D/'gioco.html').write_text(HEAD+prod.replace(CDN,'<script>'+three+'</script>')+END,encoding='utf-8',newline='\n')
# cartella da trascinare così com'è su Netlify Drop
(D/'netlify').mkdir(exist_ok=True);(D/'netlify'/'index.html').write_text((D/'gioco.html').read_text(encoding='utf-8'),encoding='utf-8',newline='\n')
hook="window.__t={P,get M(){return M},zombies,get DOORS(){return DOORS},openDoor,startRound,giveWeapon,get Box(){return Box},get Forge(){return Forge},get Q(){return Q},get VALVES(){return VALVES},get RECS(){return RECS},get KEYOBJ(){return KEYOBJ},DEV,placeBox,useI:useInteract,los,hAt,get flow(){return flow},computeFlow,selectMap,throwItem,perks,explode,get kills(){return kills},get heads(){return heads},fire:()=>fire(),get alive(){return alive},set alive(v){alive=v},get toSpawn(){return toSpawn},set toSpawn(v){toSpawn=v},get round(){return round},get points(){return points},set points(v){points=v},get state(){return state},get fps(){return fps},get inv(){return inv},get trig(){return trigger},get fireCD(){return fireCD},get switchT(){return switchT},set trig(v){trigger=v},get regionOpen(){return regionOpen},get REG(){return REG},get grenades(){return grenades},get lure(){return lure},get vortexes(){return vortexes},keys,set jq(v){jumpQueued=v},get Q2(){return Q2},get WINDOWS(){return WINDOWS},get PERKS(){return PERKS},get Power(){return Power},land,hurtPlayer,get webCD(){return webCD},get vmDual(){return vmDual},get cur(){return cur},spawnZombie,regionAt,get RI(){return RI},egg2Lamp,egg2Use,wd,updateEgg2,get powerups(){return powerups},findInteract,fxExplosion,makeCrawler,zFondMat,zFondEye,zBodyMat,zEyeMat,get kind(){return kind},K,get GW(){return GW},get GH(){return GH},playerCollide,killZombie,shotDist,zapInfo:()=>[zapCD.toFixed(1),zapQ.length,zapCharges],nextCell,markStuck,get Q3(){return Q3},devEgg3,startRide,get arrows(){return arrows},set bowDraw(v){bowDraw=v},get bowDraw(){return bowDraw},set adsOn(v){ads=v},get adsT(){return adsT},get reloadT(){return reloadT},startReload,spawnBoss,shootArrow,get fondRound(){return fondRound},set fondRound(v){fondRound=v},knife,get vmGun(){return vmGun},damageZombie,get perksSet(){return perks},equipModel,set cur(v){cur=v},get inv(){return inv},GYRO,scrAngle,askMotion,NET,step:t=>step(t),get lure(){return lure},dropPowerup,puReach,applyPowerup,netTargets,netSnap,AA,Sfx,get Q4(){return Q4},egg4Use,egg4Build,egg4Part,egg4OnKill,devEgg4,throwToma,TOMA,toggleShield,get shieldUp(){return shieldUp},layerAt,cellAt,hL,acids,get NL(){return NL},renderFrame,POST,netQuest,netQuestApply,netQuestAction,netAction,ev:s=>eval(s)/* solo test: legge le variabili interne */};NOLOCK=true;\n"
(D/'test.html').write_text(HEAD+body.replace('/*TESTHOOK*/',hook).replace(CDN,'<script>'+three+'</script>')+END,encoding='utf-8',newline='\n')
(D/'game.js').write_text(js.replace('/*TESTHOOK*/',''),encoding='utf-8',newline='\n')
print('ok',len(prod))
