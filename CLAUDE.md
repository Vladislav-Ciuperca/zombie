# Penitenziario Scoglio Nero — gioco zombie in prima persona (browser)

Rispondi sempre in italiano. Il gioco è un unico file HTML (Three.js r128, WebGL), stile COD Zombies, con quattro mappe:
"Penitenziario Scoglio Nero" (prigione), "Acciaieria Vulcano" (6 livelli + zona sotterranea "Fondamenta"),
"La Rocca" (omaggio a Mob of the Dead di BO2: Alcatraz con piani sovrapposti) e "Silver Falls" (`cascate`, omaggio a Liberty Falls di BO6), vedi sotto.

## Come si costruisce
- `python3 build.py` → crea `dist/gioco.html` (offline, three.js incluso), `dist/online.html` (three.js da CDN),
  `dist/test.html` (con l'hook `window.__t` e `NOLOCK=true`, solo per i test) e `dist/game.js` (per `node --check dist/game.js`).
- Non modificare mai i file in `dist/`: si rigenerano. Si lavora solo in `src/` e `mappe/`.
  Le mappe che hanno un `.tmx` (Tiled) si modificano lì: i loro .txt li rifà la build (vedi «Disegnare le mappe con Tiled»).
- Dopo ogni modifica: `python3 build.py && node --check dist/game.js`.

## Struttura del codice (`src/`, concatenati in quest'ordine)
- `p1_html.html` — HTML + CSS: menu, HUD, pausa, opzioni, comandi touch (`#touch`, bottoni `.tb` con `data-t`).
- `p2_data.js` — dati: MAPS (luci, regioni, porte, finestre, easter egg), armi (WEAPONS, WPAP = versioni potenziate), perk, cassa.
- `p3_engine.js` — renderer, audio (Sfx), effetti, modelli delle armi (gunModel, bowModel), zombie (SkinnedMesh), collisori dei prop.
- `p4_world.js` — costruzione del mondo dalla mappa ASCII, prop, cassa, perk, forgia, easter egg.
- `p5_logic.js` — logica di gioco: giocatore, armi, ricariche, IA zombie (flow field BFS, finestre/assi, arrampicata), round, easter egg.
  In cima c'è l'oggetto `TOUCH` (joystick analogico, sprint).
- `p5b_net.js` — modalità online (vedi sotto): client MQTT, lobby, host/giocatori, avatar dei compagni, rianimazione.
- `p6_ui.js` — input (tastiera/mouse rimappabili, touch, giroscopio `GYRO`), HUD, viewmodel, ciclo principale `step()`.
- I segnaposto `/*MAP_PRIGIONE*/`, `/*MAP_ACCIAIERIA*/`, `/*MAP_ROCCA0..2*/`, `/*MAP_CASCATE*/`, `/*ZOMBIE_KENNEY*/`, `/*SUONI*/`, `/*MESHY_*/` e `/*TESTHOOK*/` vengono sostituiti da build.py.
- `tools/` — convertitori da lanciare a mano (non fanno parte del gioco): `fbx2json.py` (FBX binario → JSON), `kenney_zombie.py` (adatta il modello allo scheletro).
- `modelli/` — `zombie_kenney.json` (mesh pronta, la legge build.py) e `kenney/` (FBX, pelli PNG e licenza CC0 originali);
  `suoni.json` (suoni registrati compressi, li legge build.py) e `suoni_LICENZE.txt` (da dove vengono, tutti CC0, come rifarli).

## Mappe (`mappe/*.txt`)
Griglia ASCII 100 colonne × 80 righe (1 cella = 1 m), senza a capo finale (build.py lo controlla).
Lettere minuscole = regioni (a…v), maiuscole = rampe (la W resta la finestra), cifre = prop, più simboli per porte e finestre (vedi `loadMap` in p4_world.js).

### Disegnare le mappe con Tiled (mapeditor.org, gratuito)
- File: `mappe/prigione.tmx`, `acciaieria.tmx`, `rocca.tmx` + il tileset `tessere.tsx`/`tessere.png` (devono stare nella stessa cartella).
  Se c'è `mappe/<nome>.tmx`, ad ogni `py build.py` i .txt si rifanno da lì (`tmx_sync` in build.py: `<nome>.txt` con un livello,
  `<nome>_0.txt`, `_1.txt`… con più livelli) e si riscrivono solo se cambiano. Senza .tmx tutto funziona come prima.
- Aprire: File → Open → il .tmx. Nel pannello Tilesets la prima riga ha vuoto, muro `#`, sbarre `|`, porta `+`, finestra `W`,
  acqua/lava `~` e gli arredi 0–9; sotto le zone a–v e sotto ognuna la sua rampa A–V. Cliccando una tessera, in Properties si vede `ch`
  (il carattere che finisce nel .txt) e `nome`. Map → Map Properties elenca le zone della mappa con nome e quota (solo un promemoria
  copiato da p2_data.js: una lettera nuova va aggiunta anche in `regions`, porte/rampe/perk in `doors`, `ramps`, `perks`).
- Disegnare: Stamp (B), Rectangle Fill (R), Bucket Fill (F); la gomma (E) toglie la tessera = spazio, come la tessera «vuoto».
  Le 6 caselle trasparenti in fondo alla prima riga del tileset non hanno `ch`: se le usi, la build si ferma dicendo dove sono.
- Livelli = strati sovrapposti (La Rocca: `strato 0`, `strato 1`, `strato 2`). Nel file e nel gioco contano dal basso: nel pannello Layers
  lo strato 0 è quello in fondo alla lista. Non riordinarli e non aggiungerne: la Rocca deve averne 3 (la build lo controlla).
  Le celle vuote di uno strato alto lasciano vedere quello sotto: per capire cosa c'è su un piano usa View → Highlight Current Layer
  (Ctrl+H) o l'occhio per nascondere gli altri (anche i livelli nascosti finiscono nei .txt). I gruppi di livelli vanno bene, i livelli di oggetti si ignorano.
- La mappa resta 100×80 e non infinita; formato dei livelli CSV (base64, zlib e gzip si leggono lo stesso, zstd no).
- Salvare: Ctrl+S, poi `py build.py && node --check dist/game.js`.
- Con il .tmx presente si lavora sul .tmx. Se un .txt viene cambiato a mano (anche da Claude) la build non lo sovrascrive e si ferma:
  allora `py mappe/tiled.py da-txt <nome>` rifà il .tmx dai .txt (rifiuta se il .tmx ha modifiche non ancora passate dalla build; `--forza` le butta).
  "Allineato" si capisce dalle date: la build rimette la data al .txt quando è uguale al .tmx.
- `py mappe/tiled.py tessere` ridisegna tessere.png e tessere.tsx (serve Pillow). Non cambiare l'ordine di `TILES` in `mappe/tiled.py`:
  i .tmx salvano il numero della tessera, non il carattere.

## Strati: piani sovrapposti (La Rocca, `mappe/rocca_0.txt`, `rocca_1.txt`, `rocca_2.txt`)
- Una mappa può avere `layers` (più griglie 100×80) invece di `ascii`. Cella = `l*N2 + z*GW + x` (`ix(x,z,l)`, `cX/cZ/cL`).
  Le mappe con un solo strato funzionano esattamente come prima (`NL===1`).
- In ogni colonna vale lo strato più alto che lì ha qualcosa e il cui pavimento non è più di 0,75 m sopra di te: `layerAt(x,z,y)`,
  `cellAt(x,z,y)`. Per questo `hAt(x,z,y)`, `regionAt`, `walkAt`, `los(...,ay)`, `groundAt`, `projSolid/projFloor` prendono la quota.
  Il flusso degli zombie passa da uno strato all'altro con `nbCell(c,dx,dz)` (vicino all'altezza del pavimento di c).
- Tra due strati in una colonna serve almeno ~3,3 m. Le scale stanno in uno strato e sopra di loro lo strato alto è vuoto (tromba delle scale).
  Uno strato alto vuoto (spazio) = niente: si vede/cade a quello di sotto; nello strato 0 lo spazio è il terreno.
- `cellB` = base della cella (pavimento, o per i muri il pavimento più basso vicino nello stesso strato, altrimenti `M.layerBase[l]`),
  `upB` = base del primo strato sopra. Sotto un altro strato soffitti e muri finiscono al suo solaio (`SLAB` 0,3 m).
  Un muro di uno strato alto non deve toccare (anche in diagonale) pavimenti di quote molto diverse nello stesso strato.
- Porte con le estremità su strati diversi: l'estremità si cerca all'altezza della porta su tutti gli strati. Chiave in `doors`:
  `'x,z'` (strato 0) o `'x,z,l'`. Rampe, perk (`id@x,z,fx,fz,l`), cassa, armi a muro (`y`), corrente (`y`), forgia (`l`), risorgenti (`[x,z,l]`).
- Proiettili: con più strati ogni colonna è una pila di solidi (`cellBlockL`). Zombie: vanno dritti verso di te solo se sei sul loro piano (`sameLevel`).
- Livello del mare = `M.liquidH` (prigione -2,6; Rocca -4,6 così le gallerie a -3,5 restano asciutte). `wallH` = altezza dei muri delle zone all'aperto,
  `wall` = materiale dei muri della zona, `li`/`lr` = intensità/raggio delle sue luci (raggio corto dove la luce passerebbe a un altro piano).
- Planimetria: un piano alla volta (in partita il tuo, nel menu i pulsanti `#planLayers`), quello di sotto sbiadito.

## Test (Playwright + Chromium headless)
- `python3 test/sim.py prigione` / `acciaieria` / `rocca` — simula round con zombie, deve finire con "no errors".
- `python3 test/stress.py <mappa>` — stress test IA.
- `python3 test/touch.py` — emula un telefono in orizzontale (844×390, touch): joystick, visuale, fuoco, giroscopio, cambio arma, mappa.
  La parte del giroscopio è in `test/gyro_check.js` (si può anche incollare nella console di `dist/test.html` a partita avviata).
- Richiedono `pip install playwright` e `playwright install chromium`. Usano `dist/test.html`, quindi prima va lanciato build.py.
- `window.__norender=true` nella pagina salta il rendering (test più veloci).
- `python3 test/walk.py <mappa>` — cerca i muri invisibili: zone che si toccano senza porta, passaggi dove il giocatore si blocca
  (stesso codice del gioco) e, con raggi contro la geometria disegnata, i punti dove ci si ferma senza niente di visibile davanti.
  Restano solo pochi casi noti (bordo rampa nel cortile della prigione, rottami); sbarre e cancelli sono esclusi (i raggi passano tra le sbarre).
- `__t.ev(stringa)` (solo in test.html) valuta codice dentro il gioco: legge e cambia le variabili interne nei test.
- `python3 test/voice.py` — chat vocale: due pagine su un finto https://scn.test (servito da Playwright), microfono finto di Chromium,
  lobby vera sui server MQTT pubblici; deve finire con «VOCE OK» (serve internet).
- `test/gyro_check.js` mette `__norender` durante la prova: senza scheda video un fotogramma può durare più di mezzo secondo e un evento
  finto dopo un blocco così diventa «tremolio» per il filtro (sul telefono vero ogni evento ha il suo orario).

Su Windows `python3` non c'è: si usa `py build.py` (build.py legge e scrive in UTF-8).

## Vita del giocatore
Un colpo normale di zombie toglie 50. Vita base 150 (3 colpi per andare a terra), con Tempra 250 (5 colpi): `applyPerks` e `resetGame` in p5_logic.js.
Colpi corpo a corpo (`hurtPlayer`): fino a 3 colpi di zombie diversi che arrivano insieme (finestra `MELEE_WIN` 0,22 s) contano tutti;
dopo il terzo o a finestra chiusa parte la pausa `MELEE_CD` (0,32 s). Un solo lamento per finestra, gli altri sono botte.
I tre livelli di aggressività sono i tipi `walk` (lenti), `run` (corridori, dal 3º round) e `sprint` (scattisti, dall'8º).
Dal 2º livello in su (corridori e scattisti; più ferro fuso e boss): se gli passi addosso o accanto (`z.contactCD`) colpiscono
subito senza caricare. Il movimento non cambia: si spostano ancora come prima, ma il colpo lo prendi.

## Power-up
Munizioni, Uccisione istantanea, Punti doppi, Bomba e Carpentiere (`carp`, il Carpenter di COD: rimette tutte le assi a tutte le finestre e
dà 200 punti; cade solo se c'è una finestra aperta con assi mancanti).
Se lo zombie muore fuori dalla finestra (o dove nessuno può arrivare, `puReach`) il power-up lo prende subito chi l'ha ucciso;
la Bomba invece cade dentro, davanti alla finestra (`w.inner`), così si sceglie quando prenderla (`dropPowerup` in p5_logic.js).

## Grafica: luci e texture (`GFX` in p3_engine.js, select «Luci» nel menu, `scn-luci`; si applica ricaricando)
- Di serie le luci CLASSICHE di sempre (Lambert, luce per vertice, niente effetti). L'utente ha provato le luci per pixel con
  bagliore/vignetta/grana e le ha bocciate: restano solo come prova («Per pixel», `PIXL`), non rimetterle di serie.
  Erano anche pesanti: sul telefono i fotogrammi lenti facevano arrivare in ritardo suoni e giroscopio.
- Solo con le luci per pixel: Phong con rilievo (`bumpMap`, `SURF`), ombre negli angoli nei colori dei vertici (`vmat()`),
  aloni attorno alle lampadine, `li` delle zone, post-produzione (`POST`, `renderFrame`). Con le classiche `vmat()` dà il materiale normale.
- Texture (`TX`): stessi colori e disposizione delle prime, ma 4× più risoluzione e disegnate col rumore frattale ripetibile
  (`tNoise`/`fbm`/`pix`, `tileTex` per le piastrelle): crepe, colature, fughe, venature, ruggine, sporco in basso; filtro morbido con mipmap.
  `TX.grime` dà un po' di grana agli arredi in tinta unita (metallo, pietra, smalto, legno scuro).
- Sempre: ombra morbida sotto gli zombie (`z.shadow`), mare animato, raccordi tra soffitti di altezza diversa (`gradini tra soffitti`
  in buildWorld: prima sopra la rampa cucina → ufficio della prigione si vedeva il cielo).

## Muri invisibili, arredi e dettagli (p4_world.js)
- Il giocatore sbatte contro la forma vera degli arredi alti (le sagome `PROPCOL` registrate per i proiettili), non contro il quadrato della cella:
  prima attorno a caldaie, altoforno, crogioli e casse c'erano muri invisibili. Gli arredi bassi (tavoli, letti…) restano a cella intera e i
  loro modelli ora coprono tutta la cella (tavoli `1`, casse `3` una per cella, blocchi `7`, crogioli uno per quadrato, serbatoi chiusi alle estremità).
  Nella Rocca la regione `k` sono le gallerie: il ramo «pietra» per la `k` vale solo per le Fondamenta dell'Acciaieria (prima lì le casse non si vedevano).
- Il giocatore sale camminando gli stessi gradini degli zombie (`STEP` 0,6). Porta chiusa: ci si avvicina fino al battente (collisione sottile).
- `buildRails`: ringhiere dove il pavimento finisce sull'acqua o sulla lava (non dove salgono gli zombie dall'acqua) e dove un ballatoio finisce
  contro la cima bassa di un muro. `buildDecor`: battiscopa, paraspigoli, sporco e ragnatele negli angoli, tubi sotto il soffitto (per parete,
  così continuano), estintori, quadri elettrici, avvisi, griglie; per terra fogli, calcinacci, bottiglie, lattine, macchie di sangue. Solo da vedere.
- Scritte col sangue (`bloodDraw` in p3_engine.js): fatte a mano, lettere storte una per una, bordi sfrangiati col rumore, colature, schizzi,
  a volte un'impronta di mano. Si adattano alla larghezza vera del muro (vanno a capo sui pilastri). Niente `ctx.filter` (Safari).

## Porte e trappole
- Porte vere (`buildDoors`, `doorPose`): telaio, uno o due battenti di lamiera verniciata (pannello, oblò, maniglione, cerniere); comprate si aprono
  girando sui cardini verso la zona con la lettera più avanti (uguale per tutti online) e restano aperte. I cancelli a sbarre scorrono di lato.
- Trappole (modulo in fondo a p5_logic.js, `TRAPS`): leva sul muro accanto a fino a 3 porte per mappa. Con la corrente e la porta aperta,
  1000 punti → 25 s in cui il vano uccide gli zombie (niente punti, i boss perdono vita) e fa male anche al giocatore (50 ogni 0,8 s), poi 45 s
  di ricarica. Elettrica (prigione), fuoco (acciaieria), acido (Rocca). Online: `netReq {t:'trap'}` → host `trapActivate` → evento `trap`.

## Zombie: modello
Di serie i modelli Meshy dell'utente (vedi LAVORI_IN_CORSO.md, `tools/meshy_assets.py`, opzione «Zombie» `scn-zstyle`: Meshy/Kenney/classici).
Il modello Kenney «Animated Characters 3» (CC0): `tools/fbx2json.py` legge l'FBX, `tools/kenney_zombie.py` abbassa le braccia
(era in T-pose), porta ogni osso sulle nostre giunture (gambe più lunghe, testa ridotta: l'originale è «chibi») e scrive `modelli/zombie_kenney.json`.
Usa le stesse ossa (`BONES`), pose, hitbox (testa un po' più alta) e animazioni; due pelli × tre tinte (`KMATS`, `z.matN`/`z.matF` per il ferro fuso).
Opzione «Zombie» nel menu (`scn-zstyle`): Meshy (di serie), Kenney o classici (quelli fatti a forme); si applica ricaricando.

## Modelli Meshy (fatti dall'utente, `modelli/meshy/`; convertiti da `tools/meshy_assets.py personaggi|armi|oggetti|tutto`)
- Lo script legge FBX (`tools/fbx2json.py`, `load()`) e GLB (`tools/glb.py`), riduce le texture a WebP e scrive `modelli/meshy_personaggi.json`,
  `meshy_armi.json`, `meshy_oggetti.json`; build.py li mette al posto di `/*MESHY_PERSONAGGI*/`, `/*MESHY_ARMI*/`, `/*MESHY_OGGETTI*/` (il gioco pesa ~12,5 MB).
  Dati compatti in base64 (posizioni int16, normali int8, uv uint16), decodificati con `b64u8`/`b64f` (p3_engine.js).
- Personaggi: zombie di serie (prigioniero arancione riggato dall'utente + dilaniato, robusto, smunto con rig automatico in `auto_rig`),
  posa di riposo braccia giù/gambe dritte (`repose`), scheletro PER MODELLO (giunture messe a mano dall'utente: non si stira il modello):
  `z.K` = coscia, stinco, caviglia, bacino per `legIK`/`poseZombie`; hitbox dalla testa vera. Sopravvissuti (atleta, businessman, punk,
  meccanico) = compagni online (`makeSurvivor`, `poseSurvivor`, IK delle braccia `armIK` sulle impugnature dell'arma). Opzione «Zombie» `scn-zstyle`.
- Armi: `gunModel` nasconde i blocchi e mette il modello Meshy con la stessa lunghezza e la canna dove era (fiammata, mira e animazioni
  restano tarate); mire rifatte sul profilo del modello (`top`), mani sulle impugnature (`GUNS` nello script). Arco in `bowModel`. Opzione «Armi» `scn-armi`.
- Oggetti della mappa: i modelli «image to 3D» in alta risoluzione (`modelli/Meshy_AI_*_image-to-3d-texture_*/*.glb`, 55.000–1,7 milioni di
  triangoli). La versione «low poly» di Meshy (`modelli/meshy/Meshy_AI_*_lowpoly_*`, non più usata) era stropicciata e l'utente l'ha bocciata.
  `tools/semplifica.mjs` (Node) li alleggerisce a `tri` triangoli (OGG nello script): collassa un vertice su un vicino esistente col costo delle
  quadriche, così le superfici piatte restano piatte e le uv giuste; sulle cuciture delle uv si muove solo lungo la cucitura (`libero` per asse,
  ringhiere, cancelli, sbarre, finestra, bancale: anche sopra). Poi normali per angolo (`crease`, 40°; la scala di Broadway tutte lisce) e
  texture WebP 1024 (512 per gli oggetti piccoli, `texsz`). Indici a 32 bit (`i32`) dove i vertici superano 65.535 (scala di Broadway).
  Budget provati a occhio: sotto ~3.000 triangoli sbarre e finestra si rompono, la scala di Broadway sotto ~30.000 (ringhiere sottili).
  Gli oggetti ripetuti contano tanto: con tutto la Rocca ha ~600.000 triangoli nel mondo (prima ~200.000), il gioco pesa ~19 MB.
  `--solo nome,nome` rifà solo quelli e aggiorna il json. La texture di Meshy è a pezzettini: tanti vertici doppi sulle cuciture.
  Oggetti: bibite Tempra/Mano Lesta/Doppio Colpo/Occhio (`OGG_PERK`, insegna col nome sopra), cassa col coperchio staccato e bancali, Forgia
  (sagoma dalla base vera `foot`), corrente con la leva che scatta in su (`Power.lvOn/lvOff`), porte blindate (battenti `leafL/leafR`, cardini
  `hingeL/R`, stessa `doorPose`), cancelli, telaio delle finestre e assi (InstancedMesh), ringhiere a pezzi da 1 m (InstancedMesh in `buildRails`),
  banchi dello scudo e dell'acido, sbarre (`buildBarsMeshy`: le celle «|» in fila diventano fronti di cella da 2 m, alte dal primo piano in su,
  e moduli da 1 m nelle file da 5+; i piani a gradoni della prigione restano a cilindri), scale della Rocca (`ramps[].mesh` in p2_data.js →
  `buildStairs`; la rampa resta quella di sempre per camminare, sotto c'è un pavimento piatto, i muretti ai lati restano: senza, `walk.py`
  trovava muri invisibili). Tutte le mappe. Opzione «Oggetti» `scn-ogg`.
- Le texture GLB hanno l'origine delle uv in alto (lo script fa 1-v). Davanti dei modelli verso +z, base a y=0.

## Zombie: scheletro e pose
Ossa: bacino, schiena in due pezzi (`spine` + `chest`), collo, testa, mascella, spalle, gomiti, polsi (`haL/haR`), anche, ginocchia, caviglie (`ftL/ftR`).
La pelle vicino alle giunture è divisa tra i due ossi (`JR`, `skinW` in p3_engine.js): gomiti e ginocchia si piegano senza sembrare un pupazzo.
`poseZombie`: gomiti che si piegano col passo, polsi molli, bacino che ruota con la gamba che avanza (spalle al contrario), peso che passa
da una gamba all'altra da fermi, piedi paralleli al pavimento (caviglia = -(anca+ginocchio)), punta in giù alla spinta.

## Audio (`Sfx` in p3_engine.js)
- L'utente trovava i suoni sintetizzati «suoni random che non c'entrano col gioco»: ora sono REGISTRAZIONI vere CC0 (spari della Free Firearm
  Sound Library, zombie di artisticdude e Darsycho, passi/impatti/porte/esplosioni/armi speciali di Kenney). `tools/suoni.py` le decodifica col
  Chromium di Playwright, le porta a mono 22050 Hz, toglie il silenzio, normalizza, ritaglia i singoli spari (`colpi`) o divide i lamenti
  (`dividi`) e le comprime in IMA ADPCM → `modelli/suoni.json` (~1 MB). In gioco `sndDecode` le decodifica al primo uso, `Sfx.play(nome,…)`
  sceglie una variante (mai la stessa due volte di fila) con un filo di tono diverso. Dove manca una registrazione resta il suono sintetizzato (`syn`).
- Spari: registrazione vicina per chi spara (+ un colpo basso sintetizzato), a media distanza (`gf_…`) per i compagni oltre 16 m.
- Catena: ogni suono passa da `out(node,pan,rv,oc)`: mandata `rv` a un unico riverbero (risposta all'impulso generata, più forte al chiuso:
  `Sfx.room`), e `oc` (0..1, da `sndOcc` in p5_logic.js che conta i solidi tra te e il suono) lo rende cupo e più basso dietro i muri.
  Al massimo ~70 suoni insieme (`slot`; gli importanti, `imp`, passano sempre). Passi del giocatore per superficie (`stepKind`).
  Rumori di fondo per mappa (`ambMap`/`ambTick`): mare e vento o macchinari, ogni tanto cigolii, gocce, urla e tuoni lontani.
Il volume generale passa da un limitatore (DynamicsCompressor) prima delle casse, così i suoni sommati non saturano.
Al massimo 6 voci da zombie insieme (`Sfx.vox` in `voice`). Se il telefono sospende l'audio (notifica, chiamata, secondo piano)
`Sfx.wake()` lo riattiva al primo tocco/tasto e quando la pagina torna visibile.
Andare a terra (Seconda Vita `goDown`, online `netGoDown`) suona solo `Sfx.down()`: il colpo l'ha già suonato `hurtPlayer`.
Prima c'erano un secondo `Sfx.hurt()` e `Sfx.roar(.6)`, che l'utente sentiva come audio rotto. `Sfx` è anche in `window.__t` per i test.

## Mirini delle mitragliatrici (Orso `mg`, Bisonte `hmg`)
`lmgIrons` in `gunModel` (p3_engine.js): mire alte sopra il corpo (s=.13 / .135) con tacca a semicerchio dietro e cappuccio a semicerchio
davanti, così mirando l'arma resta in basso e la visuale è libera. Le versioni potenziate hanno il reflex su un rialzo. La posizione di mira
viene da `S.y`/`S.rz`.

## Modalità online (coop fino a 4, `src/p5b_net.js`)
- Nessun server nostro: client MQTT 3.1.1 minimo su WebSocket verso un broker pubblico (`BROKERS`: HiveMQ, riserva EMQX).
  Spazio dei topic `scn/<NETV>/<hash di location.host>`: chi apre lo stesso link Netlify vede le stesse lobby.
  `l/<id>` = annuncio della lobby (messaggio conservato + testamento vuoto: sparisce anche se l'host chiude di colpo),
  `h/<id>` = host → giocatori, `c/<id>` = giocatori → host. Se si cambia il protocollo, alzare `NETV`.
- L'host fa girare zombie, round, porte, corrente, cassa, power-up ed easter egg; manda un'istantanea 10 volte al secondo (`netSnap`).
  Ogni giocatore muove sé stesso e spara in locale: `damageZombie` sul giocatore manda il colpo all'host (`netReq`),
  l'host lo applica con `NET.credit` impostato e rimanda i punti (`addPoints`/`killZombie` li accreditano al compagno).
- Zombie: `netTargets()` = giocatori in piedi; flow field a più sorgenti; ogni zombie insegue il più vicino; i colpi ai compagni partono come evento `hurt`.
- Coop: a terra 30 s (`netGoDown`), un compagno rialza tenendo premuto USA 3 s; se nessuno arriva si è morti fino al round dopo; tutti giù = fine partita.
- Online la pausa non ferma il mondo. Si entra anche a partita in corso.
- Missioni/easter egg condivise: le porta avanti l'host; i giocatori mandano `{t:'q'}` (manopole, chiavi, colpi su lampade/campane/teschi/bracieri,
  ossario, crogiolo, montacarichi, cuore, Aurora, elisir) → `netQuestAction`. Lo stato va agli altri con `netQuest`/`netQuestApply` (dentro le istantanee
  quando cambia). Messaggi `qMsg`, suoni `qSfx`, scie delle anime `soulFx` e raccolte con `anyNear` (qualunque giocatore) valgono per tutti.
  `updateEgg2/3` girano anche sui giocatori ma con le decisioni protette da `!NET.client`.
- Passaggio dell'host: se l'host esce ('end' con `mig`), cade (testamento) o tace 25 s, i rimasti calcolano lo stesso successore
  (`netSuccessors`: ordine di posto). Lui fa `netBecomeHost` + `netAdoptWorld` (le copie degli zombie diventano veri: vita e velocità
  arrivano nelle istantanee; quelli fuori dalle finestre tornano in coda), gli altri rientrano da lui ripetendo la richiesta ogni 1,5 s
  (`netMigJoin`) senza ricominciare. Se il candidato non risponde in 10 s si passa al prossimo, ma solo se nessuno prima ha già aperto la lobby.
- Test online: per ricaricare davvero una scheda serve cambiare anche la query (`?r=2`), cambiare solo `#lobby=` non ricarica la pagina.
- Ogni pagina si collega a tutti i broker (`NET.conns`); l'host annuncia la lobby e ascolta i giocatori su tutti (`bs` nell'annuncio),
  ogni giocatore gioca su un broker in comune con l'host (`NET.gb`, `p.bi` lato host). Così due telefoni su reti diverse si trovano lo stesso.
- Codice lobby = id dell'host, 6 caratteri senza 0/O/1/I/L (`netCode`). Link di invito `…#lobby=CODICE` (pulsante «Invita amici», `navigator.share`).
- Il "testamento" vuoto su `l/<id>` serve anche ad accorgersi subito di chi cade (host → tutti al menu; giocatore → tolto dalla lobby).
  Altrimenti il timeout di silenzio è 25 s.
- Schermo sempre acceso (`wakeSync`, Screen Wake Lock) quando si è in lobby o in partita, anche da soli; se il telefono non lo permette
  la lobby spiega quale impostazione cambiare (blocco automatico «Mai»). Il browser integrato dell'app Claude lo rifiuta sempre.
- `netBoot()` si collega da solo solo se la pagina è servita via http/https (i test su file:// restano offline).
- Prova: due schede su `dist/test.html` servita via http (`.claude/launch.json` → `py -m http.server 8765 --directory dist`);
  col pannello nascosto i frame non partono, quindi si fa avanzare il gioco con `setInterval(()=>__t.step(performance.now()),33)`.

## Chat vocale (fine di p5b_net.js, `VOICE`)
WebRTC diretto tra i giocatori (fino a 4, ogni coppia), presentazione tramite MQTT sul topic `v/<id>` (offerta/risposta/candidati,
doppioni scartati per `m`). Offre chi ha l'id minore; i candidati arrivati prima della descrizione aspettano in `qi`. Solo STUN pubblici.
Opzione «Chat vocale» (`scn-voice`): spenta (di serie, il microfono non viene chiesto), premi per parlare (T, croce in basso del controller,
tasto `#tTalk` a schermo), sempre aperta; «Volume delle voci» (`scn-voicevol`). Chi parla: pallino verde nella squadra e altoparlante sulla
targhetta; il tuo microfono aperto: `#voiceMe`. Serve https (Netlify va bene) e il permesso del microfono.

## Compagni online: nomi e frecce
Targhetta sopra la testa (`avTag`): niente nebbia, attraverso i muri, grandezza costante sullo schermo, distanza in metri, «A TERRA» in rosso.
Se il compagno è fuori dallo schermo una freccia del suo colore sul bordo col nome (`mateMark`, `.mate`); alle spalle va in basso.

## Comparsa degli zombie
`placeZombie` mette subito il modello al suo posto: prima per un fotogramma si vedeva dove era morto lo zombie di prima (o in piedi sopra la buca).
Chi sale da terra parte 1,9 m sotto (dall'acqua a -4,4). Online lo stesso in `netZombie`.

## Impostazioni di serie (scelte dall'utente)
Sensibilità mouse 1,5 (`SENS`), sensibilità giroscopio 1,8, accelerazione giroscopio 0,6, il bordo gira dai 23°.
Sono sia nel codice (p6_ui.js) sia nei `value` dei cursori (p1_html.html). Chi le aveva salvate prima le riceve una volta sola
(`scn-def`='2' in localStorage); per imporre altri valori a tutti in futuro, alzare quel numero.

## Visuale touch
Trascinando il dito la visuale segue il dito (`tLook` in p6_ui.js). La versione "a joystick" è stata provata e scartata dall'utente: non rimetterla.
Tasti (CSS in p1_html.html): spara nell'angolo in basso a destra, gli altri su due archi attorno a lui (vicino: ricarica, mira, salto;
esterno: coltello, usa, granata, scimmia). Con «colpo per il mirino» attivo e dati di movimento in arrivo (`GYRO.lastM` < 1,5 s)
il tasto mira sparisce, tranne con le Vipere Gemelle (`vmDual`), dove è la seconda pistola. Il nome della zona si mostra senza l'altezza: l'utente non la vuole.

## Aim assist (`AA`, `aimAssistTick` in p6_ui.js)
Solo telefono (giroscopio e dito) e controller, mai col mouse. Livelli Spento/Leggero/Normale/Forte (`scn-aa`).
Solo rallentamento (`AA.slowF` moltiplica controller, dito e giroscopio) quando il mirino passa sulla testa di uno zombie visibile
(`aaHead`: hitbox 'head' vera + margine che cresce col livello, controllo muri con `shotDist`). L'utente NON vuole aggancio né scatto:
il mirino non va mai tirato verso il bersaglio, e niente rallentamento sul busto. Col mirino libero conta `aimQuat()`.
Solo col controller (l'utente diceva che sul PC col joystick «mancava»): zona un po' più larga e aiuto rotazionale stile COD —
se ti muovi o giri con il mirino vicino alla testa, la visuale segue lo spostamento dello zombie di una parte (`AA.last`), mantenendo la
distanza che hai; non tira mai il mirino sulla testa, da fermo non fa niente. Normale ≈ un quarto dello spostamento, Forte ≈ tre quarti.

## Controller (Gamepad API, `GP`/`padTick` in p6_ui.js)
Levetta sinistra muovi (L3 = corsa), destra guarda (curva ^1,8), RT spara, LT mira, A salta, X tocco = ricarica / tenuto 0,3 s = usa e compra,
Y cambia arma, B o R3 coltello, RB granata, LB carillon, croce in basso (tenuta) chat vocale, Start pausa, Back mappa.
Menu (`padMenu`, `PADNAV`): croce o levetta sinistra spostano la selezione (bordo arancione `.padf`) verso il controllo più vicino in quella
direzione (tenuto = ripete), A preme (sulle tendine passa alla voce dopo), B indietro (`OV_BACK`: opzioni, online, pausa, prova giroscopio;
nella lobby no, per non uscire per sbaglio), ←/→ cambiano i cursori; le tendine cambiano voce solo se di lato non c'è un altro controllo.
Start preme il pulsante principale della schermata in cima. Menu e opzioni ricordano dov'eri.
Con un controller collegato non serve catturare il mouse (`frozen` lo ignora) e i comandi touch a schermo spariscono. Vibra quando vieni colpito (`padRumble`).
Test: si finge un controller sostituendo `navigator.getGamepads`.

## Movimento degli zombie (stile COD BO1)
- Inseguimento (`updateZombies`): accelerazione morbida (`z.vel`), scatto finale ×1,28 (×1,15 i lenti) entro 5 m quando ti vedono,
  zig-zag per corridori e scattisti (`z.wv`, `z.wf`), inciampi ogni tanto (`z.stumT`), passo verso di te durante l'attacco.
  Colpiti arretrano un poco (`e.fx/e.fz` in `damageZombie`).
- Finestre come in BO1: mentre strappano le assi, se sei dietro la finestra (entro 1,35 m da `w.inner`) allungano il braccio e ti colpiscono;
  poi scavalcano: mani sul davanzale e ginocchio su, accovacciati, salto giù dentro (`climbPose`, durata `CLIMB_DUR` per tipo).
  Chi striscia passa ancora carponi. `climbPose` la usano anche i giocatori online per calcolare lo scavalcamento da soli (niente tremolio).

## Mira col giroscopio (stile Pro Controller in Zelda BotW)
Codice: blocco `/* giroscopio per mirare */` in p6_ui.js (`GYRO`, `onOrient`, `onMotion`, `gyroDev`, `gyroLearn`, `scrAngle`, `askMotion`).
- Fonte principale `deviceorientation`: alpha/beta/gamma → quaternione (Euler 'ZXY'), e dalla differenza tra due letture
  la rotazione sugli assi del telefono. Stesso significato su iPhone e Android, angoli esatti senza dt.
- Il vecchio difetto su iPhone (inclinare in su girava a destra, il volante andava su/giù) veniva da `rotationRate`:
  su iOS i suoi assi sono alpha=X, beta=Y, gamma=Z invece di quelli della specifica (alpha=Z, beta=X, gamma=Y).
  Ora `rotationRate` si usa solo se manca l'orientamento, con gli assi che `gyroLearn` ricava confrontando le due fonti.
- Il lato dell'orizzontale (90/270) si ricava dalla gravità (`GYRO.up`), non da `screen.orientation.angle`.
- Inclinare su/giù = guardare su/giù; girarsi + rotazione "a volante" (orario = destra) = girare la visuale
  (opzione "Ruotare il telefono a volante gira la visuale"). Attenuazione del tremolio sotto 1,5°/s, poco smoothing sotto 9°/s.
- In Comandi e opzioni c'è "Prova il giroscopio": valori grezzi, assi rilevati e un punto che si muove come la visuale.
- Accelerazione (`GYRO.accel`, cursore 0–3, di serie 0,6): sotto 25°/s 1:1, sopra cresce fino a ×(1+accel) a 160°/s.
  `GYRO.c` usa la rotazione vera (`yw0`, prima dell'accelerazione).
- Bordo (`GYRO.edge`, `gyroEdgeTick`): `GYRO.c` conta quanto è girato il telefono rispetto al centro; oltre la soglia (`GYRO.edgeDeg`,
  23° di serie, cursore 5–60° nelle opzioni) la visuale continua a girare finché non lo riporti indietro. Parte subito veloce
  (2,4 rad/s appena oltre, 4,7 rad/s a 8° oltre): l'utente non vuole la parte lenta.
- Mirino libero stile Wii (`GYRO.aimMode='puntatore'`): il giroscopio muove `GYRO.ax/ay` (angolo del mirino), la visuale resta ferma.
  Pareti virtuali (`GYRO.wall`, % dello schermo, di serie 50, cursore 20–90): il mirino si ferma contro la parete e quanto giri il telefono
  oltre va in `GYRO.ox/oy` (gradi veri, `ptrAxis`); finché spingi la visuale gira (subito veloce, 2 → 4,6 rad/s a 8° oltre), tornando
  indietro prima ti stacchi dalla parete e poi il mirino si muove. L'utente non vuole che giri solo al bordo dello schermo. Si spara dove sta il mirino:
  `aimQuat()` sostituisce `camera.quaternion` in fire, frecce, lanci e laser. Mirando il mirino scivola al centro portandosi dietro la visuale.
- Prove del giroscopio: la finestra va messa in orizzontale (es. 844×390), altrimenti `scrAngle()` dà 0 e la rotazione diventa su/giù.
  Il centro è la posizione del telefono quando parte la mira e NON scivola piano da solo (l'utente non lo vuole). Unica eccezione voluta:
  telefono fermo (velocità media `GYRO.vs` < 3°/s) per `GYRO.rec` secondi (1,5 di serie, cursore 0–5, 0 = mai) e bordo non attivo
  → il centro diventa la posizione attuale (`GYRO.stillT`), così se ti giri col corpo non parte di colpo il bordo. Freccia `#gyroEdge`.
- Colpo per il mirino (`GYRO.shake`, `gyroShakeSample`): una spinta decisa avanti e indietro = un picco di accelerazione su un asse seguito
  entro 0,45 s da uno di segno opposto sullo stesso asse, oltre la soglia `SHAKE_TH` (leggera 4 / normale 5,5 / decisa 8 m/s², scelta nelle opzioni).
  Entra/esce dal mirino; la rotazione data dal colpo viene tolta usando `GYRO.hist`. "Prova il giroscopio" mostra il picco misurato.
- Da verificare ancora su un iPhone vero: i test simulano gli eventi, non il telefono.
- Il tempo tra due letture viene da `e.timeStamp` (quando l'evento è nato), non da quando lo leggiamo: se il telefono si blocca un attimo
  gli eventi arrivano tutti insieme e con il tempo di lettura sembravano rotazioni velocissime (accelerazione al massimo, la visuale partiva da sola).
  `gyroReset(ms)` azzera e mette in pausa il giroscopio: 0,7 s a inizio partita, 0,5 s alla ripresa. Non metterlo sui fotogrammi lenti:
  nel browser dei test (e sui telefoni deboli) lo terrebbe sempre in pausa.
Dentro l'app Claude il giroscopio è bloccato: il gioco va aperto in Safari da un indirizzo https.

## Schermo intero
- Android/iPad: Fullscreen API + blocco in orizzontale quando si tocca Entra o Riprendi (`goFull` in p6_ui.js), pulsante nel menu.
- iPhone: Safari non ha la Fullscreen API per le pagine; il menu spiega di usare Condividi → Aggiungi alla schermata Home.
  build.py mette le meta `apple-mobile-web-app-*` e il gioco crea un'icona, così dall'icona parte come app senza barre.
- `build.py` crea anche `dist/netlify/index.html`: si trascina la cartella `dist/netlify` su Netlify Drop.

## La Rocca (omaggio a Mob of the Dead, `M.egg4`, `Q4`, modulo in fondo a p5_logic.js)
- Strato 0: Broadway (corridoio delle celle, inizio), celle, biblioteca, mensa, cucina, docce, lavanderia, gallerie della cittadella (-3,5, sotto il cortile), molo (-2).
  Strato 1: ballatoi sopra le celle (3,6), infermeria sopra la mensa, ufficio del direttore (corrente) sopra le docce, cortile (quota 0, sopra le gallerie), ponte (10, sul mare).
  Strato 2: tetto (7,6) sopra l'infermeria. Bevande come in MotD: Tempra, Mano Lesta, Doppio Colpo, Occhio di Falco, Scossa.
- Scudo: 3 pezzi → banco di Broadway (tieni premuto USA) → ognuno ne prende uno (12 colpi). Sulla schiena para i colpi da dietro, alzato (tasto Scudo:
  C, croce a sinistra del controller, tasto `#tShield` col touch) para quelli davanti ma non si spara; coltello = spallata. Rotto: nuovo dopo 25 s.
- Tomahawk infernale: 3 teste del cane (cortile, molo, tetto) sfamate dalle anime degli zombie uccisi vicino (`dogNeed` 8, `egg4OnKill`, sull'host);
  poi nel cortile si prende il tomahawk: sostituisce le granate, colpisce fino a 6 zombie, torna in mano e raccoglie i power-up che tocca (`putake` online).
- Spingarda (nella cassa, `M.boxExtra`) → 3 teschi → banco dell'infermeria (kit acido) → Spingarda Acida: dardi che si attaccano e scoppiano (`acids`).
- Aereo: 5 pezzi → sul tetto, tieni premuto USA → vola sul ponte (Forgia sul ponte, sbloccata di serie ma serve la corrente);
  sedia elettrica sul ponte → torna sul tetto. Funivia molo ↔ tetto. I viaggi aprono la zona d'arrivo (online `r_open` all'host).
- Online: pezzi e costruzioni di squadra (`netQuest` q4, azioni `r_part`/`r_build`), scudo, tomahawk e viaggi di ognuno.
- Tasto sviluppatore U nella Rocca: avanza le missioni un passo alla volta (`devEgg4`).

## Modalità sviluppatore
Opzioni → «Modalità sviluppatore» → Attiva (vita, punti, munizioni infinite). Tasti N round successivo, K arma, J Forgia (corrente + missione
della mappa), H 2º easter egg dell'Acciaieria, U 3º easter egg dell'Acciaieria / passi della Rocca. In partita c'è anche la barra `#devBar`
con gli stessi comandi, toccabile dal telefono (chiama `pressCode(BIND[...])`).
Volo (noclip, «god mode» per l'utente): tasto O o pulsante «Volo» della barra (`devFly`, `setDevFly`, `devFlyMove` in p5_logic.js).
Si va dove si guarda (anche su e giù) attraverso muri, pavimenti e soffitti, senza gravità; salto = su (anche il tasto salto touch o A
del controller tenuti), X = giù (`flyDown`), scatto = più veloce. Rispegnendolo si cade a terra senza danno (`P.flyOff`). Non si salva:
ogni partita parte a piedi (`resetGame`). La vita infinita resta la casella «god» delle opzioni sviluppatore.

## Silver Falls (`cascate`, omaggio a Liberty Falls di BO6)
- `mappe/cascate.txt` (+ `cascate.tmx` per Tiled) è stata generata da uno script: pianta pensata come in COD, con anelli per allenare l'orda
  (strada–colle–cimitero–scalinata, strada–bowling–parcheggio–officina, strada–motel–parcheggio) e porte che aprono la città a tappe.
- Città a quota 0: Via Principale (inizio, con l'Emporio aperto), Tavola calda, Banca, Via est (sceriffo, ferramenta, distributore, officina con la
  corrente), Sala bowling, Fumetteria, Parcheggio col serbatoio dell'acqua, Via ovest (ufficio postale, ponte sul fiume con la cascata), Motel.
  Collina a quota 3: Sagrato (dal retro della tavola calda), Chiesa (Forgia sull'altare), Cimitero (scalinata verso Via est), Mausoleo.
- Le strade si aprono sgombrando cumuli di rottami (porte `kind:'debris'`: collisione a cella intera, crollano e affondano, niente architrave).
- Missione della Forgia = quella delle chiavi della prigione con `M.keyItem` (fusibili): caveau della banca, mausoleo, banco dell'officina.
  `M.forgeWhere` dice dove si accende la Forgia. Trappole di fuoco.
- Aspetto: `M.facades` (rettangoli → materiale delle pareti viste da fuori: assi dipinte `sidingW/G/R/B/Y`, `masonry`, `brick`…),
  arredi della cittadina in `townProp` (0 auto fuori / scaffali dentro, 9 pompe o serbatoio, 4 lampioni/alberi morti/candelabri/colonne,
  2 panche della chiesa, 6 sgabelli, 7 separé e divanetti, 5 banconi, 3 lapidi nel cimitero e cassonetti) e `buildTownExtras`
  (strisce e marciapiedi, insegne al neon, pensilina, tetto e campanile della chiesa, piste del bowling, fiume e cascata che scorrono in
  `townTick`, bosco con due InstancedMesh, zucche accese). Texture nuove: `asphalt`, `grass`, `masonry`, `siding*`.
- Le lapidi usano il carattere 3 (arredo alto, forma vera): con l'8 (arredo basso calpestabile a 45 cm) ci si camminava dentro.
- Easter egg delle zucche (`TOWN.pumpkins`, `pumpkinHit`, bersagli in `eggTargets`/`eggHit`): 16 in città + 5 nascoste in alto (serbatoio,
  pensilina, tetto della chiesa, mausoleo, ponte). Personale anche online: spente tutte → risata e una bevanda gratis della mappa (o 3000 punti).
- `test/walk.py cascate` deve dare 0 problemi (le zone che si toccano sono collegate da `links` e si aprono insieme).
