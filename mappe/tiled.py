"""Strumenti per disegnare le mappe con Tiled (mapeditor.org).
  py mappe/tiled.py tessere                    -> rifà mappe/tessere.png e mappe/tessere.tsx (serve Pillow: pip install pillow)
  py mappe/tiled.py da-txt [nome...] [--forza] -> rifà mappe/<nome>.tmx dai .txt (di serie: prigione, acciaieria, rocca)
Il contrario (.tmx -> .txt) lo fa build.py a ogni build."""
import pathlib,re,sys,xml.etree.ElementTree as ET
R=pathlib.Path(__file__).resolve().parent
T=32;COLS=22   # lato della tessera in pixel, tessere per riga
LOW='abcdefghijklmnopqrstuv'
PROPS=['scaffale','tavolo','branda','casse e macerie','lampione','bancone','solido senza modello','lavatrici e fornelli','panca','cisterna']
# riga 0: simboli base e arredi (6 caselle vuote in fondo), riga 1: zone a-v, riga 2: rampe A-V (ognuna sotto la sua zona)
TILES=[(' ','vuoto: terreno nello strato 0, niente negli strati alti'),('#','muro'),('|','sbarre'),('+','porta (costo e zona in p2_data.js, doors)'),
       ('W','finestra con le assi'),('~','acqua (lava nell\'acciaieria)')]+[(str(i),f'arredo {i} ({PROPS[i]})') for i in range(10)]
TILES+=[None]*(COLS-len(TILES))+[(c,f'zona {c}') for c in LOW]+[(c.upper(),f'rampa o scala della zona {c}') for c in LOW]
SIZES={'prigione':1,'acciaieria':1,'rocca':3,'cascate':1}   # strati che il gioco legge per ogni mappa

def esc(s):return s.replace('&','&amp;').replace('"','&quot;').replace('<','&lt;')

def font(F,size):
    for f in ['consolab.ttf','arialbd.ttf','DejaVuSansMono-Bold.ttf','DejaVuSans-Bold.ttf']:
        try:return F.truetype(f,size)
        except OSError:pass
    return F.load_default(size=size)

def zone_col(i,dark=False):
    import colorsys
    h=(i*.618034)%1;s=.75 if i%2 else .5;v=(.95 if i%3 else .78)*(.55 if dark else 1)
    return tuple(int(c*255) for c in colorsys.hsv_to_rgb(h,s,v))+(255,)

def tessere():
    from PIL import Image,ImageDraw,ImageFont
    img=Image.new('RGBA',(COLS*T,(len(TILES)//COLS)*T),(0,0,0,0));big=font(ImageFont,23);mid=font(ImageFont,18);huge=font(ImageFont,32)
    for n,t in enumerate(TILES):
        if not t:continue
        ch=t[0];tl=Image.new('RGBA',(T,T),(0,0,0,0));d=ImageDraw.Draw(tl);c=T//2
        txt=lambda s,f=big,fill=(20,20,20),st=0,sf=(255,255,255):d.text((c,c+1),s,font=f,fill=fill,anchor='mm',stroke_width=st,stroke_fill=sf)
        if ch==' ':   # quasi trasparente: negli strati alti si vede quello di sotto
            for k in range(-T,T,8):d.line([(k,T),(k+T,0)],fill=(160,170,180,55))
            d.rectangle([0,0,T-1,T-1],outline=(160,170,180,90))
        elif ch=='#':
            d.rectangle([0,0,T-1,T-1],fill=(62,62,70,255))
            for y in (0,8,16,24):
                d.line([(0,y),(T,y)],fill=(92,92,102,255))
                for x in range(4 if y%16 else 12,T,16):d.line([(x,y),(x,y+7)],fill=(92,92,102,255))
        elif ch=='|':
            d.rectangle([0,0,T-1,T-1],fill=(36,40,46,255))
            for x in (4,12,20,28):d.rectangle([x-1,0,x+1,T],fill=(170,176,186,255))
            d.rectangle([0,13,T,16],fill=(140,146,156,255))
        elif ch=='+':
            d.rectangle([0,0,T-1,T-1],fill=(150,92,38,255))
            for x in (8,16,24):d.line([(x,0),(x,T)],fill=(112,66,24,255))
            txt('+',f=huge,fill=(255,236,190),st=2,sf=(70,38,10))
        elif ch=='W':
            d.rectangle([0,0,T-1,T-1],fill=(150,205,235,255))
            for y in (7,15,23):d.rectangle([2,y,T-3,y+3],fill=(150,100,50,255))
            txt('W',f=mid,fill=(10,40,90),st=2,sf=(225,245,255))
        elif ch=='~':
            d.polygon([(0,0),(T,0),(0,T)],fill=(36,88,175,255));d.polygon([(T,0),(T,T),(0,T)],fill=(215,92,24,255))
            txt('~',f=huge,fill=(255,255,255),st=2,sf=(20,30,60))
        elif ch.isdigit():
            i=int(ch);d.rectangle([0,0,T-1,T-1],fill=(118+i*6,96+i*3,62,255));d.rectangle([3,3,T-4,T-4],outline=(70,52,30,255),width=2)
            txt(ch,fill=(255,250,225),st=2,sf=(60,40,20))
        elif ch.islower():
            col=zone_col(LOW.index(ch));d.rectangle([0,0,T-1,T-1],fill=col,outline=tuple(int(v*.7) for v in col[:3]))
            txt(ch,fill=(15,15,15),st=1,sf=(255,255,255))
        else:   # rampa: stesso colore della zona, più scuro, a gradini
            col=zone_col(LOW.index(ch.lower()),True);d.rectangle([0,0,T-1,T-1],fill=col)
            lt=tuple(min(255,int(v*1.6)) for v in col[:3])
            for y in (7,15,23,31):d.line([(0,y),(T,y)],fill=lt,width=2)
            txt(ch,fill=(255,255,255),st=2,sf=(10,10,10))
        img.alpha_composite(tl,((n%COLS)*T,(n//COLS)*T))
    img.save(R/'tessere.png')
    out=['<?xml version="1.0" encoding="UTF-8"?>',
         f'<tileset version="1.10" tiledversion="1.11.2" name="Scoglio Nero" tilewidth="{T}" tileheight="{T}" tilecount="{len(TILES)}" columns="{COLS}">',
         f' <image source="tessere.png" width="{img.width}" height="{img.height}"/>']
    for n,t in enumerate(TILES):
        if t:out+=[f' <tile id="{n}">','  <properties>',f'   <property name="ch" value="{esc(t[0])}"/>',f'   <property name="nome" value="{esc(t[1])}"/>','  </properties>',' </tile>']
    (R/'tessere.tsx').write_text('\n'.join(out+['</tileset>','']),encoding='utf-8',newline='\n')
    print('ok mappe/tessere.png, mappe/tessere.tsx')

def tsx_ids():
    """carattere -> id della tessera, letti da tessere.tsx"""
    ids={}
    for t in ET.parse(R/'tessere.tsx').getroot().iter('tile'):
        for p in t.iter('property'):
            if p.get('name')=='ch':ids.setdefault(p.get('value') or ' ',int(t.get('id')))
    return ids

def zone_info(name):
    """nomi delle zone e degli strati presi da src/p2_data.js (solo come promemoria dentro il .tmx)"""
    src=(R.parent/'src'/'p2_data.js').read_text(encoding='utf-8');m=re.search(r"\bid:'"+re.escape(name)+"'",src)
    if not m:return [],[]
    blk=src[m.end():];nxt=re.search(r"\n  \w+:\{\n    id:'",blk);blk=blk[:nxt.start()] if nxt else blk
    regs=[(k,nm,h) for k,_,nm,h in re.findall(r"\{k:'([a-v])',name:(['\"])(.*?)\2,h:(-?[\d.]+)",blk)];ln=re.search(r"layerNames:\[([^\]]*)\]",blk)
    return regs,(re.findall(r"'([^']*)'",ln.group(1)) if ln else [])

def txt_names(name,n):return [f'{name}.txt'] if n==1 else [f'{name}_{l}.txt' for l in range(n)]

def da_txt(name,forza=False):
    n=SIZES.get(name) or len(list(R.glob(f'{name}_[0-9].txt'))) or 1
    files=[R/f for f in txt_names(name,n)];ids=tsx_ids();tmx=R/f'{name}.tmx'
    grids=[]
    for f in files:
        rows=f.read_text(encoding='utf-8').split('\n')
        assert len(rows)==80 and all(len(r)==100 for r in rows),f'{f.name}: servono 80 righe da 100 caratteri, senza a capo finale'
        bad=sorted({c for r in rows for c in r if c not in ids})
        assert not bad,f'{f.name}: caratteri senza tessera: {bad!r}'
        grids.append(rows)
    if tmx.exists() and not forza and tmx.stat().st_mtime>max(f.stat().st_mtime for f in files):
        sys.exit(f'{tmx.name} è più recente dei .txt: forse ha modifiche fatte in Tiled che la build non ha ancora copiato. '
                 f'Lancia prima py build.py, oppure aggiungi --forza per buttarle via.')
    regs,lnames=zone_info(name)
    out=['<?xml version="1.0" encoding="UTF-8"?>',
         f'<map version="1.10" tiledversion="1.11.2" orientation="orthogonal" renderorder="right-down" width="100" height="80" tilewidth="{T}" tileheight="{T}" infinite="0" backgroundcolor="#16191e" nextlayerid="{n+1}" nextobjectid="1">']
    if regs:
        out.append(' <properties>')
        for k,nm,h in regs:out.append(f'  <property name="zona {k}" value="{esc(nm)} (quota {h})"/>')
        out.append(' </properties>')
    out.append(' <tileset firstgid="1" source="tessere.tsx"/>')
    for l,rows in enumerate(grids):
        ln=f'strato {l}'+(f' - {lnames[l]}' if l<len(lnames) else '') if n>1 else 'mappa'
        csv=',\n'.join(','.join('0' if c==' ' else str(ids[c]+1) for c in r) for r in rows)
        out+=[f' <layer id="{l+1}" name="{esc(ln)}" width="100" height="80">','  <data encoding="csv">',csv,'</data>',' </layer>']
    tmx.write_text('\n'.join(out+['</map>','']),encoding='utf-8',newline='\n')
    print(f'ok mappe/{tmx.name} da',', '.join(f.name for f in files))

if __name__=='__main__':
    a=sys.argv[1:];forza='--forza' in a;a=[x for x in a if x!='--forza']
    if a[:1]==['tessere']:tessere()
    elif a[:1]==['da-txt']:
        for nm in a[1:] or list(SIZES):da_txt(nm,forza)
    else:print(__doc__)
