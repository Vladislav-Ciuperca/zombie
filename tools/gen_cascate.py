"""Silver Falls: genera mappe/cascate.txt (100×80). Uso: py tools/gen_cascate.py mappe/cascate.txt
C'è anche mappe/cascate.tmx: dopo aver rigenerato il .txt va rifatto con  py mappe/tiled.py da-txt cascate --forza
(oppure si modifica direttamente il .tmx in Tiled, e allora questo script non serve più). x verso est, z verso sud. 1 cella = 1 m.
Collina (quota 3) a nord: chiesa, sagrato, cimitero, mausoleo. Città (quota 0): Via Principale (inizio) da ovest a est,
negozi sul lato nord, bowling e fumetteria a sud, stazione di servizio e officina a est, motel e fiume con la cascata a ovest,
parcheggio col serbatoio dell'acqua a sud. Gli spazi vuoti (' ') sono il terreno fuori: da lì arrivano gli zombie alle finestre."""
import sys,pathlib
W,H=100,80
G=[[' ']*W for _ in range(H)]
def put(x,z,c):
    if 0<=x<W and 0<=z<H:G[z][x]=c
def fill(x0,z0,x1,z1,c):
    for z in range(z0,z1+1):
        for x in range(x0,x1+1):put(x,z,c)
def box(x0,z0,x1,z1,floor,wall='#'):
    fill(x0,z0,x1,z1,wall);fill(x0+1,z0+1,x1-1,z1-1,floor)
def hl(x0,x1,z,c):fill(x0,z,x1,z,c)
def vl(x,z0,z1,c):fill(x,z0,x,z1,c)

# ===== COLLINA (quota 3) =====
box(34,1,58,12,'f')          # Chiesa: navata x35-57, z2-11
hl(44,46,12,'+')             # portone
box(38,12,61,17,'q')         # Sagrato: z13-16, muretto sul bordo verso la città
hl(34,58,12,'#');hl(44,46,12,'+')
box(61,1,92,19,'e','|')      # Cimitero: cancellata di ferro verso fuori
vl(61,1,19,'#');hl(61,92,19,'#')   # muro di pietra verso il sagrato e verso la città
vl(61,14,15,'+')             # cancello sagrato → cimitero
box(82,3,90,10,'o')          # Mausoleo
hl(85,86,10,'+')
fill(54,17,58,23,'#');fill(55,17,57,23,'Q')   # scalinata dal retro della tavola calda al sagrato
fill(78,19,84,33,'#');fill(79,20,83,33,'G');hl(79,83,19,'+')   # scalinata cimitero → Via est, cancello in cima
# ===== VIA PRINCIPALE e lato nord =====
fill(30,34,69,42,'a')
box(36,24,47,33,'b');hl(41,42,33,'a')          # Emporio (ingresso aperto: zona d'inizio)
box(47,24,61,33,'c');hl(53,55,33,'+');hl(55,57,24,'+')   # Tavola calda: porta su strada e sul retro
box(61,24,72,33,'s');hl(65,66,33,'+')          # Banca
box(63,24,67,28,'s');fill(64,25,66,27,'s');put(65,28,'s')   # caveau
hl(39,40,24,'W');hl(49,50,24,'W');hl(69,70,24,'W')
# ===== VIA EST, sceriffo, ferramenta =====
fill(70,34,95,42,'g');vl(70,34,42,'+')         # rottami tra Via Principale e Via est
fill(96,34,97,42,'#')
box(72,24,78,33,'t');hl(74,75,33,'+')          # Ufficio dello sceriffo
hl(75,77,28,'|');fill(75,25,77,27,'t')         # cella con le sbarre
box(84,24,96,33,'u');hl(88,89,33,'+');vl(96,28,29,'W')   # Ferramenta
# ===== STAZIONE DI SERVIZIO e OFFICINA =====
box(75,42,97,63,'h');hl(76,96,42,'h')          # piazzale aperto verso Via est
vl(97,47,48,'W')
box(82,63,97,77,'i');hl(87,89,63,'+');vl(97,72,73,'W')   # Officina
# ===== BOWLING e FUMETTERIA (lato sud) =====
box(35,43,65,65,'n');hl(49,51,43,'+');hl(49,51,65,'+')
vl(35,50,51,'W');vl(35,58,59,'W');vl(65,56,57,'W')
box(66,43,73,52,'r');hl(68,69,43,'+');vl(73,47,48,'W')
# ===== PARCHEGGIO =====
box(30,65,82,78,'p');hl(35,65,65,'#');hl(49,51,65,'+');vl(82,69,70,'+')
# ===== VIA OVEST, ufficio postale =====
fill(12,34,29,42,'j');vl(29,34,42,'+')         # rottami tra Via Principale e Via ovest
box(15,24,28,33,'v');hl(21,22,33,'+');hl(19,20,24,'W')
# ===== PONTE e CASCATA =====
fill(4,13,9,48,'~');fill(0,46,9,49,'~')        # il fiume scende dalla cascata (a nord) e piega a ovest
box(1,29,12,47,'k');fill(2,30,11,46,'k')
fill(4,30,9,35,'~');fill(4,41,9,46,'~')        # sotto il ponte
hl(4,9,29,'~');hl(4,9,47,'~')                  # il fiume passa sotto le recinzioni
vl(12,34,42,'j')                               # dalla strada al ponte senza porta
hl(2,11,13,'#')                                # parete di roccia della cascata (fuori)
# ===== MOTEL =====
box(13,43,30,78,'l');hl(20,23,43,'+')          # cortile (parcheggio del motel), cancello da Via ovest
box(2,50,13,77,'m');vl(13,58,59,'+')           # camere
for z in (55,60,65,70):hl(3,12,z,'#');put(9,z,'m')
vl(2,51,52,'W');vl(2,61,62,'W');vl(2,71,72,'W')
vl(30,70,72,'+')                               # cancello cortile → parcheggio
# ===== ARREDI =====
def P(cells,c):
    for x,z in cells:put(x,z,c)
# Chiesa: panche, candelabri (la Forgia sta sull'altare, in data)
for z in (5,7,9):fill(37,z,43,z,'2');fill(47,z,55,z,'2')
P([(41,3),(49,3)],'4')
# Sagrato: lampioni, panchine
P([(40,13),(60,13)],'4');P([(48,16),(52,16)],'8')
# Cimitero: lapidi in file, alberi morti
for x in range(64,80,3):
    for z in range(4,18,3):put(x,z,'3')   # lapidi (3: bloccano con la forma vera)
P([(70,9),(76,15),(88,15),(66,12)],'4')
# Via Principale: lampioni, auto, panchine
P([(33,34),(45,34),(58,34),(67,34),(33,42),(45,42),(57,42),(67,42)],'4')
fill(37,35,40,36,'0');fill(60,40,63,41,'0');fill(46,40,49,41,'0')
P([(52,34),(53,34),(39,42),(40,42)],'8')
# Emporio: scaffali e banco
fill(38,26,38,30,'0');fill(41,26,41,29,'0');fill(44,26,44,29,'0');fill(44,31,46,31,'5')
# Tavola calda: bancone, sgabelli, separé
fill(49,27,53,27,'5');P([(49,29),(51,29),(53,29)],'6');fill(48,31,49,32,'7');fill(59,29,60,32,'7')
# Banca: sportello
fill(62,30,66,30,'5');fill(68,30,71,30,'5')
# Sceriffo: scrivanie
fill(73,30,74,31,'5')
# Ferramenta: scaffali
for x in (86,89,92):fill(x,26,x,30,'0')
fill(94,31,95,31,'5')
# Via est: lampioni, auto
P([(74,34),(86,34),(80,42),(92,34)],'4');fill(88,38,91,39,'0')
# Stazione di servizio: pompe, colonne della pensilina, auto
for x in (82,86,90):fill(x,49,x,50,'9')
P([(79,46),(79,53),(93,46),(93,53)],'4');fill(78,57,81,58,'0');fill(90,58,93,59,'0')
# Officina: banco da lavoro, auto sul ponte sollevatore, casse
fill(84,64,94,64,'5');fill(87,69,90,70,'0');fill(84,75,85,76,'3')
# Bowling: banco delle scarpe, divanetti, ritorni delle palle in testa alle piste
fill(37,45,45,45,'5');fill(38,48,39,50,'7');fill(57,46,60,47,'7')
for x in range(40,61,4):put(x,51,'7')
# Fumetteria: scaffali
fill(68,45,68,49,'0');fill(71,45,71,49,'0')
# Parcheggio: auto, serbatoio dell'acqua, cassonetti, lampioni
fill(36,69,39,70,'0');fill(44,73,47,74,'0');fill(56,69,59,70,'0');fill(72,73,75,74,'0')
fill(64,68,67,71,'9');fill(79,67,80,68,'3');fill(31,76,32,77,'3')
P([(42,67),(54,67),(70,76),(77,72)],'4')
# Via ovest: lampioni, auto
P([(14,34),(24,34),(14,42),(26,42)],'4');fill(17,36,20,37,'0')
# Ufficio postale: banco
fill(17,30,26,30,'5')
# Ponte: lampioni
P([(2,35),(2,41),(11,35),(11,41)],'4')
# Motel: letti nelle camere, auto e lampioni nel cortile
for z0 in (50,55,60,65,70):fill(4,z0+2,6,z0+3,'2')
fill(18,48,21,49,'0');fill(24,58,27,59,'0');fill(17,71,20,72,'0')
P([(16,46),(27,46),(16,64),(27,64),(16,75)],'4')

# finestre sui fianchi della chiesa (danno sul vicolo vuoto tra chiesa e cimitero, e a ovest)
vl(34,5,6,'W');vl(58,5,6,'W')
# recinzione automatica: nessuna zona all'aperto deve toccare il terreno esterno (sarebbe un muro invisibile)
OUT=set('aghjklpqeQG')
for z in range(H):
    for x in range(W):
        if G[z][x] in OUT:
            for dz in (-1,0,1):
                for dx in (-1,0,1):
                    a,b=x+dx,z+dz
                    if 0<=a<W and 0<=b<H and G[b][a]==' ':G[b][a]='#'
rows=[''.join(r) for r in G]
assert len(rows)==H and all(len(r)==W for r in rows)
if len(sys.argv)>1:pathlib.Path(sys.argv[1]).write_text('\n'.join(rows),encoding='utf-8',newline='\n')
print('\n'.join(f'{i:2d} {r}' for i,r in enumerate(rows)))
