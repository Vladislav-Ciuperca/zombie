# Prompt per Meshy — tutti i modelli 3D del gioco

## Prima di cominciare: niente doppioni
- **Un modello che esiste già non si rifà.** Prima di generarne uno, guarda in `modelli/meshy/` (e tra i modelli già fatti,
  anche con altri nomi) se c'è già. Se c'è, salti il suo prompt.
- **Se a un modello già fatto manca solo il movimento, fai solo quello**, senza rigenerare il modello. Il «movimento» che serve al
  gioco è quello della sezione 6:
  - zombie e personaggi: il **rig** (ossa e pesi in T-pose). Le animazioni non servono, le fa il gioco: non spendere crediti per farle;
  - armi: le **parti della ricarica staccate** e chiamate coi nomi giusti (`mag`, `bolt`, `pump`, `brl`, `cyl`, `lid`, `cell`);
  - cassa, interruttore della corrente e leva delle trappole: il **pezzo che si muove** staccato (`coperchio` o `leva`).
- **Zombie già fatti: 3.** Abbina ognuno al tipo più simile delle tabelle della sezione 2 (rinominandolo col nome del file indicato)
  e genera solo i tipi che mancano.

---

Un prompt = un modello. I prompt sono in **inglese** perché Meshy li capisce meglio; le note in italiano non vanno incollate.
Accanto a ogni modello c'è la **misura reale** (serve a me per scalarlo: Meshy esporta a grandezza casuale).

## Impostazioni (le stesse per tutti)
- **Art style:** Realistic. **Texture:** PBR attive, 1024 px (2048 solo per le armi).
- **Topology:** Triangle. **Remesh / target polycount** (i telefoni devono reggere 24 zombie insieme):
  - armi: al massimo 3.000 facce
  - zombie e personaggi: al massimo 15.000 facce
  - macchine (bibite, cassa, forgia): al massimo 5.000
  - oggetti piccoli: al massimo 1.500
  - oggetti grandi (caldaia, crogiolo, barca): al massimo 4.000–5.000
  - pezzi di muro: al massimo 2.000
- **Prompt pronti per sezione** (uno per tutte le armi, uno per tutti gli zombie, ecc.): nella cartella `prompt/`, in formato .txt.
- **Zombie:** Symmetry ON, posa T-pose (se Meshy chiede la posa). Poi rig su Mixamo come gli altri personaggi, stesso «Skeleton LOD».
- **Negative prompt** (per tutti): `text, letters, words, logo, watermark, signature, base, pedestal, ground plane, multiple objects, cartoon, toy, low quality`
- **Export:** `.glb`. Nomi dei file come nelle tabelle (es. `arma_toro.glb`), da mettere in `modelli/meshy/<cartella>/`.
- **Priorità** (★): prima zombie e armi, poi macchine e oggetti delle missioni, poi oggetti di scena e pezzi di muro.

> Meshy non sa scrivere testo leggibile: lettere e scritte vengono storpiate. Per questo i prompt chiedono «no readable text».
> Le scritte sui muri le fa già il gioco (scritte col sangue fatte a mano) e i nomi delle bibite li metto io sulle texture.

---

## 1. Armi (`modelli/meshy/armi/`)
Escluse: Pistola Serpe (quella iniziale), Arco di Brace e Vortice.
Stile comune: armi d'epoca 1930–1960, consumate, metallo brunito graffiato, legno scheggiato.

| ★ | File | Arma nel gioco | Misura | Prompt |
|---|---|---|---|---|
| ★ | `arma_toro.glb` | Revolver Toro | 0,30 m | `Heavy six-shot revolver, 1930s, blued steel worn to bare metal at the edges, long barrel, cracked dark wooden grip, realistic first-person shooter weapon, PBR, highly detailed, single object, side view, no hands, no readable text` |
| ★ | `arma_lince.glb` | Carabina Lince | 0,90 m | `Semi-automatic military carbine like an M1 Carbine, 1940s, short wooden stock with scratches, 15-round box magazine, worn steel, leather sling, realistic first-person shooter weapon, PBR, single object, side view, no hands, no readable text` |
| ★ | `arma_vespa.glb` | Mitra Vespa | 0,70 m | `1940s submachine gun like an MP40, folding metal stock, long straight box magazine underneath, worn black steel with rust spots, realistic first-person shooter weapon, PBR, single object, side view, no hands, no readable text` |
| ★ | `arma_tuono.glb` | Mitra Tuono | 0,85 m | `Classic 1930s tommy gun submachine gun with a round drum magazine, wooden stock and front vertical grip, ribbed barrel, worn blued steel, realistic first-person shooter weapon, PBR, single object, side view, no hands, no readable text` |
| ★ | `arma_doppietta.glb` | Doppietta | 1,00 m | `Double-barrel side-by-side shotgun, sawn-off barrels, worn walnut stock with carved checkering, exposed hammers, tarnished steel, realistic first-person shooter weapon, PBR, single object, side view, no hands, no readable text` |
| ★ | `arma_cinghiale.glb` | Pompa Cinghiale | 1,05 m | `Pump-action police shotgun, 1950s, wooden pump grip and stock, tube magazine under the barrel, scratched black steel, realistic first-person shooter weapon, PBR, single object, side view, no hands, no readable text` |
| ★ | `arma_falco.glb` | Fucile Falco | 1,00 m | `Cold War assault rifle like an AK-47, curved 30-round magazine, worn wooden handguard and stock, stamped steel receiver with rust, realistic first-person shooter weapon, PBR, single object, side view, no hands, no readable text` |
| ★ | `arma_aquila.glb` | Fucile Aquila (cecchino) | 1,20 m | `Bolt-action sniper rifle, 1940s, long wooden stock, large telescopic scope on rings, bolt handle, worn blued steel, leather sling, realistic first-person shooter weapon, PBR, single object, side view, no hands, no readable text` |
| ★ | `arma_orso.glb` | Mitragliatrice Orso | 1,10 m | `Belt-fed light machine gun like an M60, bipod folded under the barrel, carry handle, ammo belt hanging from the side, tall rear sight, worn olive and black metal, realistic first-person shooter weapon, PBR, single object, side view, no hands, no readable text` |
| ★ | `arma_mastino.glb` | Mitragliatrice Mastino | 1,20 m | `Heavy belt-fed machine gun like an MG42, perforated barrel shroud, bipod, ammo box attached on the side with a long bullet belt, worn dark steel, realistic first-person shooter weapon, PBR, single object, side view, no hands, no readable text` |
| ★ | `arma_bisonte.glb` | Mitragliatrice Bisonte | 1,30 m | `Very heavy machine gun like a Browning M1919 carried by hand, thick cooling jacket on the barrel, pistol grip and front handle, green ammo can with brass belt, worn steel, realistic first-person shooter weapon, PBR, single object, side view, no hands, no readable text` |
| | `arma_lupo.glb` | Fucile Lupo | 1,00 m | `Battle rifle like a FN FAL, 1960s, black polymer and wood furniture, 20-round magazine, carry handle, scratched steel, realistic first-person shooter weapon, PBR, single object, side view, no hands, no readable text` |
| | `arma_faina.glb` | Mitra Faina | 0,50 m | `Compact machine pistol like an Uzi, folding wire stock, magazine inside the pistol grip, worn matte black steel, realistic first-person shooter weapon, PBR, single object, side view, no hands, no readable text` |
| | `arma_cervo.glb` | Fucile Cervo | 1,10 m | `Military marksman rifle like an M14, long wooden stock, 20-round magazine, peep sight, worn steel, realistic first-person shooter weapon, PBR, single object, side view, no hands, no readable text` |
| ★ | `arma_fulminatore.glb` | Fulminatore (arma speciale) | 0,45 m | `Retro 1930s electric ray gun pistol, brass and copper body, glass tube with blue lightning inside, small tesla coil rings on the barrel, bakelite grip, glowing blue parts, mad scientist prototype, realistic PBR, single object, side view, no hands, no readable text` |
| ★ | `arma_aurora.glb` | Aurora (laser) | 1,00 m | `Ancient-looking laser rifle forged in a steel foundry, blackened iron body with glowing red-orange crystal core, cooling fins, cables, molten cracks glowing on the barrel, realistic PBR, single object, side view, no hands, no readable text` |
| ★ | `arma_spingarda.glb` | Spingarda | 0,80 m | `Blunderbuss-style double-barrel weapon like the Blundergat, brass flared bell muzzles, dark wood stock wrapped with leather, iron bands, old prison-made look, realistic first-person weapon, PBR, single object, side view, no hands, no readable text` |
| ★ | `arma_spingarda_acida.glb` | Spingarda Acida | 0,85 m | `Same blunderbuss double-barrel weapon upgraded with glass canisters of glowing green acid strapped on the sides, rubber tubes feeding the barrels, metal clamps, dripping green liquid, realistic PBR, single object, side view, no hands, no readable text` |

### Equipaggiamento
| ★ | File | Oggetto | Misura | Prompt |
|---|---|---|---|---|
| ★ | `eq_granata.glb` | Granata | 0,12 m | `WWII fragmentation hand grenade, olive green painted metal body with grid pattern, spoon lever and pull ring, worn paint, realistic PBR, single object, no readable text` |
| ★ | `eq_carillon.glb` | Carillon (richiamo esplosivo) | 0,20 m | `Antique wind-up music box with a small brass key and a tiny dancing figure on top, dynamite sticks taped around it with wires, wooden box with brass corners, realistic PBR, single object, no readable text` |
| ★ | `eq_coltello.glb` | Coltello | 0,30 m | `Military combat knife, 1940s, blackened steel blade with a worn edge, leather washer handle, brass guard, realistic PBR, single object, no readable text` |
| ★ | `eq_tomahawk.glb` | Tomahawk infernale (Rocca) | 0,50 m | `Infernal tomahawk axe, dark iron blade with glowing red runes and embers, bone handle wrapped in old leather, small chains, cursed and demonic, realistic PBR, single object, no readable text` |
| ★ | `eq_scudo.glb` | Scudo (Rocca) | 1,10 × 0,60 m | `Makeshift riot shield made from a steel prison cell door panel with bars, welded to a hand truck dolly frame, clamps and leather straps on the back, rusty and dented, realistic PBR, single object, no readable text` |

---

## 2. Zombie: 4 tipi per mappa (`modelli/meshy/zombie/`)
Tutti con lo stesso corpo di base del tuo zombie già fatto: uomo adulto di 1,80 m, proporzioni realistiche, **T-pose**, niente oggetti che
penzolano lontano dal corpo (si riggano male). Coda da lasciare in ogni prompt (è già dentro):
`full body, T-pose, arms straight out to the sides, standing straight, adult 1.8 m tall, realistic human proportions, realistic PBR game character, Call of Duty Black Ops Zombies style, horror, no base`

### Penitenziario Scoglio Nero (carcere, 1938)
| ★ | File | Tipo | Prompt |
|---|---|---|---|
| ★ | `zombie_prigione_detenuto.glb` | Detenuto (il più comune) | `Zombie prisoner from 1938 in a torn black-and-white striped prison uniform with a prisoner number patch, rotten grey-green skin, sunken eyes glowing orange, broken teeth, bloody shirt, barefoot with torn trousers, full body, T-pose, arms straight out to the sides, standing straight, adult 1.8 m tall, realistic human proportions, realistic PBR game character, Call of Duty Black Ops Zombies style, horror, no base` |
| ★ | `zombie_prigione_guardia.glb` | Guardia carceraria | `Zombie prison guard from 1938 in a dark grey wool uniform with brass buttons, peaked cap, leather belt with empty holster and keys, torn sleeve, rotten pale skin, glowing orange eyes, bite wounds on the neck, full body, T-pose, arms straight out to the sides, standing straight, adult 1.8 m tall, realistic human proportions, realistic PBR game character, Call of Duty Black Ops Zombies style, horror, no base` |
| ★ | `zombie_prigione_isolamento.glb` | Recluso dell'isolamento (veloce) | `Emaciated zombie inmate from solitary confinement wearing a torn dirty straitjacket with loose straps, shaved head with stitches, very thin and pale bruised skin, wild glowing orange eyes, open screaming mouth, bare feet, full body, T-pose, arms straight out to the sides, standing straight, adult 1.8 m tall, realistic human proportions, realistic PBR game character, Call of Duty Black Ops Zombies style, horror, no base` |
| ★ | `zombie_prigione_infermiere.glb` | Infermiere / cuoco della mensa | `Zombie prison infirmary orderly from 1938 in a stained white medical coat over grey clothes, surgical mask torn and hanging, rubber gloves, blood splatter, rotten skin, glowing orange eyes, full body, T-pose, arms straight out to the sides, standing straight, adult 1.8 m tall, realistic human proportions, realistic PBR game character, Call of Duty Black Ops Zombies style, horror, no base` |

### Acciaieria Vulcano (fonderia, 1961)
| ★ | File | Tipo | Prompt |
|---|---|---|---|
| ★ | `zombie_acciaieria_operaio.glb` | Operaio della fonderia (il più comune) | `Zombie steel mill worker from 1961 in soot-covered blue work overalls, yellow hard hat dented, heavy work boots, leather gloves, burned and blackened skin with ash, glowing orange eyes, full body, T-pose, arms straight out to the sides, standing straight, adult 1.8 m tall, realistic human proportions, realistic PBR game character, Call of Duty Black Ops Zombies style, horror, no base` |
| ★ | `zombie_acciaieria_fonditore.glb` | Fonditore col grembiule di cuoio | `Zombie foundry smelter in a thick burned leather apron and heat-resistant sleeves, cracked protective face visor pushed up on the head, scorched skin with blisters and soot, glowing orange eyes, full body, T-pose, arms straight out to the sides, standing straight, adult 1.8 m tall, realistic human proportions, realistic PBR game character, Call of Duty Black Ops Zombies style, horror, no base` |
| ★ | `zombie_acciaieria_meccanico.glb` | Meccanico con la maschera antigas (veloce) | `Zombie factory maintenance mechanic from 1961 in a grease-stained grey jumpsuit, old rubber gas mask with round lenses cracked, tool belt, torn knees, rotten grey skin on the arms, glowing orange eyes behind the lenses, full body, T-pose, arms straight out to the sides, standing straight, adult 1.8 m tall, realistic human proportions, realistic PBR game character, Call of Duty Black Ops Zombies style, horror, no base` |
| ★ | `zombie_acciaieria_ferrofuso.glb` | Ferro fuso (lo zombie speciale che esplode) | `Molten metal zombie, body made of cooling black slag and charred flesh with glowing orange-yellow lava cracks all over, remains of burned work overalls, drips of molten metal, glowing white-hot eyes and mouth, heavy and bulky, full body, T-pose, arms straight out to the sides, standing straight, adult 1.8 m tall, realistic human proportions, realistic PBR game character, Call of Duty Black Ops Zombies style, horror, no base` |
| | `boss_capomastro.glb` | Capomastro (boss, opzionale) | `Giant zombie foreman of a steel mill, huge muscular body, torn leather apron and heavy chains around the shoulders, welded steel plates bolted to the chest, burned face with a cracked welding mask, glowing orange eyes, full body, T-pose, arms straight out to the sides, standing straight, realistic PBR game character, Call of Duty Black Ops Zombies style, horror, no base` |

### La Rocca (isola-carcere stile Alcatraz, 1963)
| ★ | File | Tipo | Prompt |
|---|---|---|---|
| ★ | `zombie_rocca_detenuto.glb` | Detenuto (il più comune) | `Zombie Alcatraz inmate from 1963 in a faded blue chambray work shirt with a stenciled number patch and grey denim trousers, rotten skin, glowing orange eyes, torn and bloody clothes, prison work shoes, full body, T-pose, arms straight out to the sides, standing straight, adult 1.8 m tall, realistic human proportions, realistic PBR game character, Call of Duty Black Ops Zombies style, horror, no base` |
| ★ | `zombie_rocca_secondino.glb` | Secondino anni '60 | `Zombie prison guard from 1963 in a navy blue uniform with a peaked cap and badge shape without text, black tie, leather belt with a baton holder, bitten arm, rotten pale skin, glowing orange eyes, full body, T-pose, arms straight out to the sides, standing straight, adult 1.8 m tall, realistic human proportions, realistic PBR game character, Call of Duty Black Ops Zombies style, horror, no base` |
| ★ | `zombie_rocca_annegato.glb` | Annegato della baia (sale dall'acqua) | `Drowned zombie inmate pulled from the bay, bloated waterlogged pale blue-grey skin, seaweed and barnacles on the body, soaked torn prison clothes, dripping wet, chain shackle on one ankle, cloudy glowing eyes, full body, T-pose, arms straight out to the sides, standing straight, adult 1.8 m tall, realistic human proportions, realistic PBR game character, Call of Duty Black Ops Zombies style, horror, no base` |
| ★ | `zombie_rocca_fulminato.glb` | Fulminato dalla sedia elettrica (veloce) | `Zombie executed on the electric chair, shaved head with burn marks from the electrode cap, charred skin with branching lightning scars, smoking grey prison jumpsuit, faint blue electric glow in the eyes and veins, full body, T-pose, arms straight out to the sides, standing straight, adult 1.8 m tall, realistic human proportions, realistic PBR game character, Call of Duty Black Ops Zombies style, horror, no base` |

---

## 3. Macchine e oggetti di gioco (`modelli/meshy/gioco/`)
Le bibite sono distributori anni '50 consumati, ognuno col suo colore e un simbolo senza scritte (il nome lo metto io).
Misura: 1,0 × 0,8 m di base, alte 2,0 m.

| ★ | File | Oggetto | Prompt |
|---|---|---|---|
| ★ | `bibita_tempra.glb` | Tempra | `1950s soda vending machine, deep red paint chipped and rusty, big round emblem of a shield on the front, glass window with red glass bottles inside, chrome trim, coin slot, bottle opener, glowing lights, realistic PBR, single object, no readable text` |
| ★ | `bibita_manolesta.glb` | Mano Lesta | `1950s soda vending machine, green paint chipped and rusty, emblem of a hand with motion lines, glass window with green bottles, chrome trim, coin slot, glowing lights, realistic PBR, single object, no readable text` |
| ★ | `bibita_passosvelto.glb` | Passo Svelto | `1950s soda vending machine, blue paint chipped and rusty, emblem of a running boot with wings, glass window with blue bottles, chrome trim, coin slot, glowing lights, realistic PBR, single object, no readable text` |
| ★ | `bibita_doppiocolpo.glb` | Doppio Colpo | `1950s soda vending machine, mustard yellow-orange paint chipped and rusty, emblem of two crossed bullets, glass window with orange bottles, chrome trim, coin slot, glowing lights, realistic PBR, single object, no readable text` |
| ★ | `bibita_cadutalibera.glb` | Caduta Libera | `1950s soda vending machine, purple paint chipped and rusty, emblem of a falling star with an impact ring, glass window with purple bottles, chrome trim, coin slot, glowing lights, realistic PBR, single object, no readable text` |
| ★ | `bibita_scoppionero.glb` | Scoppio Nero | `1950s soda vending machine, matte black and charcoal grey paint chipped, emblem of a black grenade bursting, glass window with dark bottles, chrome trim, coin slot, dim glowing lights, realistic PBR, single object, no readable text` |
| ★ | `bibita_occhio.glb` | Occhio di Falco | `1950s soda vending machine, crimson and orange paint chipped and rusty, emblem of a hawk eye inside a crosshair, glass window with orange-red bottles, chrome trim, coin slot, glowing lights, realistic PBR, single object, no readable text` |
| ★ | `bibita_secondavita.glb` | Seconda Vita | `1950s soda vending machine, cyan turquoise paint chipped and rusty, emblem of a heart with a rising arrow, glass window with cyan bottles, chrome trim, coin slot, glowing lights, realistic PBR, single object, no readable text` |
| ★ | `bibita_terzamano.glb` | Terza Mano | `1950s soda vending machine, olive green paint chipped and rusty, emblem of three crossed rifles, glass window with olive bottles, chrome trim, coin slot, glowing lights, realistic PBR, single object, no readable text` |
| ★ | `bibita_scossa.glb` | Scossa | `1950s soda vending machine, electric blue paint chipped and rusty, emblem of a lightning bolt, tesla coil on top, glass window with glowing blue bottles, chrome trim, coin slot, realistic PBR, single object, no readable text` |
| ★ | `cassa_misteriosa.glb` (1,6 × 0,7 × 0,8 m) | Cassa delle armi | `Old wooden weapon crate with a hinged lid, iron corner brackets and padlock hasp, carved mysterious glowing blue runes on the sides, worn dark wood, chains, realistic PBR, single object, no readable text` |
| ★ | `forgia.glb` (2,0 × 1,5 m, alta 2,5 m) | Forgia (potenzia le armi) | `Ancient arcane weapon-upgrade forge machine, massive iron furnace with an anvil in front, glowing orange molten core visible through a grate, bellows, gears and pipes, chains wrapped around, skull ornaments, realistic PBR, single object, no readable text` |
| ★ | `corrente.glb` (1,0 × 0,4, alta 1,8 m) | Interruttore della corrente | `Large 1930s industrial power switch panel on a steel cabinet, big knife-switch lever with a red handle, dials and warning lamps, thick cables going up, worn grey paint, realistic PBR, single object, no readable text` |
| ★ | `finestra_assi.glb` (1,8 × 2,3 m) | Finestra con le assi | `Broken prison window frame for a thick wall opening, empty with no planks, shattered glass shards in the corners, rusty iron frame with bent bars, concrete sill, realistic PBR, single object, no readable text` |
| ★ | `asse.glb` (1,6 × 0,2 m) | Asse singola | `Single old wooden plank with rusty nails sticking out at both ends, cracked and dirty, realistic PBR, single object, no readable text` |
| | `leva_trappola.glb` (0,3 × 0,46 m) | Leva delle trappole | `Wall-mounted industrial trap lever box, yellow and black hazard striped metal casing, big pull lever with a red knob, small indicator lamp, rusty bolts, realistic PBR, single object, no readable text` |
| | `registratore.glb` (0,4 m) | Registratore (nastri) | `1950s reel-to-reel tape recorder, two metal tape reels, brown leather case, chrome knobs and buttons, realistic PBR, single object, no readable text` |

### Oggetti delle missioni
| ★ | File | Mappa | Prompt |
|---|---|---|---|
| ★ | `ee_chiave.glb` (0,15 m) | Prigione | `Old large iron skeleton key with an ornate bow, rusty and heavy, realistic PBR, single object, no readable text` |
| ★ | `ee_manopola.glb` (0,6 m) | Prigione / Acciaieria | `Large red cast-iron valve wheel on a short pipe stub, chipped paint, rust, realistic PBR, single object, no readable text` |
| ★ | `ee_crogiolo.glb` (1,4 m) | Acciaieria | `Small foundry crucible ladle on a tilting iron stand with a handwheel, glowing molten metal inside, soot and slag, realistic PBR, single object, no readable text` |
| ★ | `ee_elisir.glb` (0,25 m) | Acciaieria | `Glass flask of glowing silver liquid metal elixir with a cork, iron cage around the bottle, realistic PBR, single object, no readable text` |
| ★ | `ee_teschio_parete.glb` (0,3 m) | Acciaieria | `Human skull fixed to a rusty iron wall plate with nails, burning embers in the eye sockets, realistic PBR, single object, no readable text` |
| ★ | `ee_campana.glb` (0,6 m) | Acciaieria | `Old bronze bell hanging from a riveted iron bracket, green patina and soot, realistic PBR, single object, no readable text` |
| ★ | `ee_braciere.glb` (1,0 m) | Acciaieria | `Iron brazier on three legs with burning coals and small flames, blackened metal, realistic PBR, single object, no readable text` |
| ★ | `ee_altare.glb` (2,0 m) | Acciaieria | `Dark ritual altar made of foundry iron and bones, stone slab with iron spikes, melted candles, ash, realistic PBR, single object, no readable text` |
| ★ | `ee_sarcofago.glb` (2,2 m) | Acciaieria | `Iron sarcophagus with a heavy lid, molten orange cracks glowing in the seams, chains and runes carved without letters, realistic PBR, single object, no readable text` |
| ★ | `ee_scudo_carrello.glb` (1,1 m) | Rocca | `Old two-wheel hand truck dolly, rusty steel frame, worn rubber wheels, realistic PBR, single object, no readable text` |
| ★ | `ee_scudo_anta.glb` (1,0 × 0,6 m) | Rocca | `Detached steel prison cell door panel with vertical bars and a small food slot, rusty and dented, realistic PBR, single object, no readable text` |
| ★ | `ee_scudo_morsa.glb` (0,35 m) | Rocca | `Heavy cast-iron bench vise clamp, rusty, realistic PBR, single object, no readable text` |
| ★ | `ee_aereo_serbatoio.glb` (0,7 m) | Rocca | `Old aircraft fuel tank, dented aluminium cylinder with straps and a cap, realistic PBR, single object, no readable text` |
| ★ | `ee_aereo_sartiame.glb` (0,8 m) | Rocca | `Coiled bundle of aircraft rigging cables and ropes with metal pulleys and hooks, realistic PBR, single object, no readable text` |
| ★ | `ee_aereo_valvola.glb` (0,4 m) | Rocca | `Brass engine valve assembly with pipes and a small pressure gauge, realistic PBR, single object, no readable text` |
| ★ | `ee_aereo_motore.glb` (1,0 m) | Rocca | `Small vintage radial airplane engine, cylinders with cooling fins, oily and rusty, realistic PBR, single object, no readable text` |
| ★ | `ee_aereo_elica.glb` (1,8 m) | Rocca | `Wooden two-blade vintage airplane propeller with a metal hub, chipped varnish, realistic PBR, single object, no readable text` |
| ★ | `ee_aereo.glb` (8 m di apertura alare) | Rocca | `Rickety homemade 1960s biplane built from scrap, patched fabric wings, wooden struts, radial engine, wooden propeller, mismatched metal panels, realistic PBR, single object, no readable text` |
| ★ | `ee_testa_cane.glb` (1,0 m) | Rocca | `Large demonic three-eyed hound head statue mounted on a stone wall plaque, black iron with red glowing eyes and open fanged jaws, smoke, realistic PBR, single object, no readable text` |
| ★ | `ee_teschio_acido.glb` (0,25 m) | Rocca | `Human skull glowing with eerie green light from inside, cracked bone, realistic PBR, single object, no readable text` |
| ★ | `ee_kit_acido.glb` (0,5 m) | Rocca | `Homemade acid conversion kit on a workbench tray: glass canisters of glowing green acid, rubber tubes, clamps and metal brackets, realistic PBR, single object, no readable text` |
| ★ | `ee_sedia_elettrica.glb` (1,2 m) | Rocca | `Old wooden electric chair with leather straps on the arms and legs, metal electrode helmet hanging above, thick cables, scorch marks, realistic PBR, single object, no readable text` |
| ★ | `ee_funivia.glb` (2,5 m) | Rocca | `Small rusty cable car gondola cabin for two people, riveted steel, broken windows, hanger arm with wheels on top, realistic PBR, single object, no readable text` |
| | `ee_banco_lavoro.glb` (2,0 m) | Rocca | `Heavy wooden workbench with a vise, scattered tools, scrap metal and wires, realistic PBR, single object, no readable text` |

---

## 4. Oggetti di scena (`modelli/meshy/scena/`)
Coda comune (già dentro): `realistic PBR game asset, worn, dirty and weathered, single object, no readable text`

### Prigione (1938)
| File | Misura | Prompt |
|---|---|---|
| `pr_branda.glb` | 2,0 m | `1930s prison bunk bed, rusty iron frame, thin stained mattress, torn grey wool blanket, realistic PBR game asset, worn, dirty and weathered, single object, no readable text` |
| `pr_wc_lavandino.glb` | 0,9 m | `Prison cell steel toilet and sink combo unit, stained and rusty, realistic PBR game asset, worn, dirty and weathered, single object, no readable text` |
| `pr_tavolo_mensa.glb` | 3,0 m | `Prison mess hall steel table with attached round stools, scratched and dirty, food trays on top, realistic PBR game asset, worn, dirty and weathered, single object, no readable text` |
| `pr_vassoio.glb` | 0,4 m | `Dented metal prison food tray with spilled gray slop and a spoon, realistic PBR game asset, worn, dirty and weathered, single object, no readable text` |
| `pr_cucina_stufa.glb` | 1,5 m | `1930s industrial cast-iron kitchen stove with large pots on top, grease and soot, realistic PBR game asset, worn, dirty and weathered, single object, no readable text` |
| `pr_pentolone.glb` | 0,6 m | `Huge dented aluminium cooking pot with a ladle, burned bottom, realistic PBR game asset, worn, dirty and weathered, single object, no readable text` |
| `pr_ganci_carne.glb` | 2,0 m | `Ceiling rail with rusty meat hooks and chains, realistic PBR game asset, worn, dirty and weathered, single object, no readable text` |
| `pr_doccia.glb` | 2,2 m | `Row of three old prison shower heads on exposed rusty pipes with valves, realistic PBR game asset, worn, dirty and weathered, single object, no readable text` |
| `pr_letto_ospedale.glb` | 2,0 m | `1930s hospital bed with leather restraint straps, iron frame, stained sheets, realistic PBR game asset, worn, dirty and weathered, single object, no readable text` |
| `pr_armadietto_medico.glb` | 1,8 m | `White enamel medical cabinet with glass doors, old bottles and jars inside, chipped paint, realistic PBR game asset, worn, dirty and weathered, single object, no readable text` |
| `pr_flebo.glb` | 1,8 m | `Old IV drip stand on wheels with a glass bottle, realistic PBR game asset, worn, dirty and weathered, single object, no readable text` |
| `pr_sedia_rotelle.glb` | 1,0 m | `1930s wooden and wicker wheelchair, broken, realistic PBR game asset, worn, dirty and weathered, single object, no readable text` |
| `pr_scrivania_direttore.glb` | 1,8 m | `1930s warden's wooden desk with a typewriter, desk lamp, scattered papers and an ashtray, realistic PBR game asset, worn, dirty and weathered, single object, no readable text` |
| `pr_schedario.glb` | 1,3 m | `Metal filing cabinet with one drawer pulled open and papers sticking out, dented, realistic PBR game asset, worn, dirty and weathered, single object, no readable text` |
| `pr_caldaia.glb` | 3,0 m | `Large riveted industrial boiler from the 1930s, pipes, pressure gauges, valve wheels, soot and rust, realistic PBR game asset, worn, dirty and weathered, single object, no readable text` |
| `pr_carbone.glb` | 1,5 m | `Pile of coal with a shovel stuck in it, realistic PBR game asset, worn, dirty and weathered, single object, no readable text` |
| `pr_faro_torretta.glb` | 1,0 m | `Old guard tower searchlight on a swivel mount, cracked lens, realistic PBR game asset, worn, dirty and weathered, single object, no readable text` |
| `pr_filo_spinato.glb` | 3,0 m | `Section of prison fence with wooden posts and coiled barbed wire, realistic PBR game asset, worn, dirty and weathered, single object, no readable text` |
| `pr_barca.glb` | 4,0 m | `Old wooden rowboat with oars, peeling paint, water stains, realistic PBR game asset, worn, dirty and weathered, single object, no readable text` |
| `pr_bitta.glb` | 0,5 m | `Cast-iron mooring bollard on a dock with a coiled rope, realistic PBR game asset, worn, dirty and weathered, single object, no readable text` |
| `pr_lanterna.glb` | 0,35 m | `Old kerosene lantern with a cracked glass, realistic PBR game asset, worn, dirty and weathered, single object, no readable text` |
| `pr_altoparlante.glb` | 0,5 m | `1930s horn loudspeaker mounted on a wall bracket with cables, realistic PBR game asset, worn, dirty and weathered, single object, no readable text` |
| `pr_lampada_gabbia.glb` | 0,4 m | `Industrial caged ceiling lamp with an old bulb, realistic PBR game asset, worn, dirty and weathered, single object, no readable text` |
| `pr_secchio_mocio.glb` | 0,9 m | `Mop in a dented metal bucket with dirty water, realistic PBR game asset, worn, dirty and weathered, single object, no readable text` |
| `pr_camicia_forza.glb` | 0,9 m | `Torn straitjacket hanging on a wall hook, stained canvas and leather straps, realistic PBR game asset, worn, dirty and weathered, single object, no readable text` |

### Acciaieria (1961)
| File | Misura | Prompt |
|---|---|---|
| `ac_siviera.glb` | 2,0 m | `Steel mill ladle bucket full of glowing molten steel, thick refractory walls, hanging from crane hooks, realistic PBR game asset, worn, dirty and weathered, single object, no readable text` |
| `ac_lingotti.glb` | 1,2 m | `Stack of steel ingots on a wooden pallet, dark oxidized metal, realistic PBR game asset, worn, dirty and weathered, single object, no readable text` |
| `ac_stampi.glb` | 1,5 m | `Row of iron ingot molds with cooling slag, realistic PBR game asset, worn, dirty and weathered, single object, no readable text` |
| `ac_travi.glb` | 4,0 m | `Pile of rusty steel I-beams stacked on wooden blocks, realistic PBR game asset, worn, dirty and weathered, single object, no readable text` |
| `ac_gancio_gru.glb` | 2,0 m | `Huge crane hook with a pulley block and heavy chains, yellow paint chipped, realistic PBR game asset, worn, dirty and weathered, single object, no readable text` |
| `ac_quadro_comandi.glb` | 1,6 m | `1960s industrial control console with analog dials, levers, colored buttons and warning lamps, green-grey paint, realistic PBR game asset, worn, dirty and weathered, single object, no readable text` |
| `ac_armadietti.glb` | 1,9 m | `Row of three dented metal worker lockers, one door open with a jacket inside, realistic PBR game asset, worn, dirty and weathered, single object, no readable text` |
| `ac_caschi.glb` | 1,0 m | `Wall rack with old yellow hard hats and leather gloves hanging, realistic PBR game asset, worn, dirty and weathered, single object, no readable text` |
| `ac_bombole.glb` | 1,5 m | `Group of three gas cylinders chained to a wall bracket, faded paint, realistic PBR game asset, worn, dirty and weathered, single object, no readable text` |
| `ac_banco_morsa.glb` | 2,0 m | `Steel workbench with a vise, hammers, wrenches and metal shavings, realistic PBR game asset, worn, dirty and weathered, single object, no readable text` |
| `ac_incudine.glb` | 0,8 m | `Blacksmith anvil on a wooden stump with tongs leaning on it, realistic PBR game asset, worn, dirty and weathered, single object, no readable text` |
| `ac_carrello_rotaie.glb` | 1,4 m | `Small rusty mine cart on a short rail section, full of scrap metal, realistic PBR game asset, worn, dirty and weathered, single object, no readable text` |
| `ac_nastro.glb` | 3,0 m | `Section of heavy industrial roller conveyor with steel rollers and a frame, realistic PBR game asset, worn, dirty and weathered, single object, no readable text` |
| `ac_rottami.glb` | 2,0 m | `Pile of scrap metal: bent pipes, gears, sheet metal and chains, realistic PBR game asset, worn, dirty and weathered, single object, no readable text` |
| `ac_fusto.glb` | 0,9 m | `Dented oil drum with leaking black oil, rust, realistic PBR game asset, worn, dirty and weathered, single object, no readable text` |
| `ac_orologio_timbri.glb` | 0,6 m | `1960s factory time clock punch machine on the wall with a card rack, realistic PBR game asset, worn, dirty and weathered, single object, no readable text` |
| `ac_quadro_elettrico.glb` | 1,8 m | `Large electrical cabinet with open door, fuses, thick cables and sparks, realistic PBR game asset, worn, dirty and weathered, single object, no readable text` |
| `ac_trasformatore.glb` | 1,8 m | `Industrial electrical transformer with ceramic insulators and cooling fins, realistic PBR game asset, worn, dirty and weathered, single object, no readable text` |
| `ac_lampada_industriale.glb` | 0,6 m | `1960s industrial pendant lamp with an enamel shade, realistic PBR game asset, worn, dirty and weathered, single object, no readable text` |
| `ac_scoria.glb` | 1,5 m | `Slag pot cart with cooling glowing slag, realistic PBR game asset, worn, dirty and weathered, single object, no readable text` |
| `ac_tavolo_mensa.glb` | 2,0 m | `1960s factory canteen table with metal chairs, lunch boxes and thermos on top, realistic PBR game asset, worn, dirty and weathered, single object, no readable text` |

### La Rocca (1963)
| File | Misura | Prompt |
|---|---|---|
| `ro_branda.glb` | 2,0 m | `1960s prison cell bunk with a folded grey blanket and a pillow, steel frame bolted to the wall, realistic PBR game asset, worn, dirty and weathered, single object, no readable text` |
| `ro_mensola_cella.glb` | 0,8 m | `Small prison cell wall shelf with a few books, a tin cup and a toothbrush, realistic PBR game asset, worn, dirty and weathered, single object, no readable text` |
| `ro_libreria.glb` | 2,2 m | `Tall wooden prison library bookshelf full of old books, some books fallen, realistic PBR game asset, worn, dirty and weathered, single object, no readable text` |
| `ro_tavolo_lettura.glb` | 2,0 m | `Long wooden library reading table with chairs and open books, realistic PBR game asset, worn, dirty and weathered, single object, no readable text` |
| `ro_schedario_libri.glb` | 1,2 m | `Wooden card catalog cabinet with many small drawers, realistic PBR game asset, worn, dirty and weathered, single object, no readable text` |
| `ro_lavatrice.glb` | 1,5 m | `1960s industrial laundry washing machine with a round door, realistic PBR game asset, worn, dirty and weathered, single object, no readable text` |
| `ro_carrello_biancheria.glb` | 1,0 m | `Canvas laundry cart on wheels full of dirty prison clothes, realistic PBR game asset, worn, dirty and weathered, single object, no readable text` |
| `ro_pressa_stiro.glb` | 1,3 m | `Old industrial laundry ironing press machine, realistic PBR game asset, worn, dirty and weathered, single object, no readable text` |
| `ro_tavolo_mensa.glb` | 3,0 m | `Long prison mess hall wooden table with benches, metal cups and trays, realistic PBR game asset, worn, dirty and weathered, single object, no readable text` |
| `ro_lacrimogeno.glb` | 0,3 m | `Ceiling-mounted tear gas canister dispenser, metal cylinder, realistic PBR game asset, worn, dirty and weathered, single object, no readable text` |
| `ro_salvagente.glb` | 0,8 m | `Old life ring buoy hanging on a wooden post, faded red and white, realistic PBR game asset, worn, dirty and weathered, single object, no readable text` |
| `ro_reti.glb` | 1,5 m | `Pile of fishing nets with cork floats and a rope, realistic PBR game asset, worn, dirty and weathered, single object, no readable text` |
| `ro_boa.glb` | 1,5 m | `Rusty navigation buoy with a lamp on top, realistic PBR game asset, worn, dirty and weathered, single object, no readable text` |
| `ro_cisterna.glb` | 6,0 m | `Old steel water tower on four legs with a ladder, rust streaks, realistic PBR game asset, worn, dirty and weathered, single object, no readable text` |
| `ro_casse_molo.glb` | 1,5 m | `Stack of wooden shipping crates with rope nets, realistic PBR game asset, worn, dirty and weathered, single object, no readable text` |
| `ro_torretta_guardia.glb` | 4,0 m | `Small concrete guard tower with a searchlight and railing, realistic PBR game asset, worn, dirty and weathered, single object, no readable text` |
| `ro_sirena.glb` | 0,6 m | `Old mechanical air raid siren on a pole bracket, realistic PBR game asset, worn, dirty and weathered, single object, no readable text` |
| `ro_cartello_divieto.glb` | 1,0 m | `Weathered metal warning sign on a post with only a red symbol and no words, realistic PBR game asset, worn, dirty and weathered, single object, no readable text` |
| `ro_scrivania_direttore.glb` | 1,8 m | `1960s warden office desk with a rotary phone, ashtray, files and a desk lamp, realistic PBR game asset, worn, dirty and weathered, single object, no readable text` |
| `ro_cassaforte.glb` | 1,0 m | `Heavy old safe with a dial, door ajar, realistic PBR game asset, worn, dirty and weathered, single object, no readable text` |
| `ro_lampione.glb` | 4,0 m | `Old cast-iron yard street lamp post with a caged light, realistic PBR game asset, worn, dirty and weathered, single object, no readable text` |

---

## 5. Pezzi di muro e di stanza (`modelli/meshy/kit/`)
Il gioco costruisce muri e stanze dalla mappa a griglia (celle da 1 m). Questi pezzi li userò come rivestimenti e dettagli sopra i
muri (non sostituiscono la griglia), quindi vanno fatti **larghi 1 m, alti 3 m, spessi al massimo 0,2 m**.
Meshy non scrive testo leggibile: per «muri con scritte» si chiedono segni, graffi e conteggi; le frasi col sangue le fa già il gioco.

| File | Prompt |
|---|---|
| `kit_muro_carcere.glb` | `Modular prison wall panel 1 meter wide 3 meters tall, painted concrete two-tone dark green bottom and cream top, peeling paint, cracks and water stains, flat back, realistic PBR game asset, single object, no readable text` |
| `kit_muro_graffi.glb` | `Modular prison wall panel 1 meter wide 3 meters tall, concrete with scratched tally marks counting days, scratches and crude carved drawings, peeling paint, realistic PBR game asset, single object, no readable text` |
| `kit_muro_sangue.glb` | `Modular wall panel 1 meter wide 3 meters tall, dirty concrete with bloody handprints and smeared blood streaks dripping down, realistic PBR game asset, horror, single object, no readable text` |
| `kit_muro_mattoni.glb` | `Modular industrial red brick wall panel 1 meter wide 3 meters tall, soot stains, missing bricks, realistic PBR game asset, single object, no readable text` |
| `kit_muro_buco.glb` | `Modular concrete wall panel 1 meter wide 3 meters tall with a broken hole in the middle showing rebar and bricks, rubble at the base, realistic PBR game asset, single object, no readable text` |
| `kit_muro_manifesti.glb` | `Modular prison wall panel 1 meter wide 3 meters tall with torn old paper notices and posters showing only pictures and no words, realistic PBR game asset, single object, no readable text` |
| `kit_muro_tubi.glb` | `Modular wall panel 1 meter wide 3 meters tall with exposed rusty pipes, valves and electrical conduit running across, realistic PBR game asset, single object, no readable text` |
| `kit_muro_piastrelle.glb` | `Modular wall panel 1 meter wide 3 meters tall, white ceramic tiles cracked and missing, mold and grime, realistic PBR game asset, single object, no readable text` |
| `kit_muro_lamiera.glb` | `Modular industrial wall panel 1 meter wide 3 meters tall made of corrugated metal sheets, rust and soot, realistic PBR game asset, single object, no readable text` |
| `kit_sbarre_cella.glb` | `Modular prison cell bars section 1 meter wide 3 meters tall, vertical iron bars with horizontal braces, peeling paint, realistic PBR game asset, single object, no readable text` |
| `kit_porta_cella.glb` | `Sliding prison cell door 1 meter wide 2.5 meters tall made of iron bars with a lock box, realistic PBR game asset, single object, no readable text` |
| `kit_pilastro.glb` | `Square concrete support pillar 0.6 meters wide 4 meters tall, chipped corners with exposed rebar, realistic PBR game asset, single object, no readable text` |
| `kit_ringhiera.glb` | `Modular steel catwalk railing section 1 meter long, rusty, realistic PBR game asset, single object, no readable text` |
| `kit_passerella.glb` | `Modular steel grate catwalk floor section 1 meter by 1 meter, rusty, realistic PBR game asset, single object, no readable text` |
| `kit_scala_ferro.glb` | `Steep industrial steel staircase with handrails, 3 meters tall, rusty, realistic PBR game asset, single object, no readable text` |
| `kit_macerie.glb` | `Pile of concrete rubble and broken bricks with twisted rebar, 1.5 meters wide, realistic PBR game asset, single object, no readable text` |
| `kit_tubo_soffitto.glb` | `Straight section of thick rusty industrial pipe 2 meters long with brackets and a flange, realistic PBR game asset, single object, no readable text` |

---

## 6. Movimento: cosa serve e cosa no

### Zombie e personaggi: nessuna animazione
Non usare «Animate» di Meshy né scaricare animazioni da Mixamo. Il gioco muove lo scheletro da solo, adattando ogni posa alla situazione:
camminata, corsa e scatto, strisciare, inciampi, attacchi, braccio dentro la finestra, scavalcamento, colpi ricevuti e morte.
Animazioni già fatte sarebbero più rigide e non coprirebbero cose come lo scavalcamento delle finestre. Serve solo il **rig**
(ossa e pesi, in T-pose), come per i personaggi che hai già fatto.

### Armi: le parti che si muovono nella ricarica vanno staccate
Meshy fa ogni arma come un pezzo unico, ma nella ricarica il gioco sposta caricatore, otturatore, pompa, canne o tamburo.
Quei pezzi vanno separati (in Blender: modalità Modifica, selezioni il pezzo, tasto P → «Selection») e chiamati con questi nomi esatti.
Il resto dell'arma resta un pezzo solo, chiamato `corpo`.

| Arma | Pezzi da separare |
|---|---|
| Revolver Toro | `cyl` (il tamburo) |
| Carabina Lince, Fucile Aquila | `bolt` (otturatore con la manetta), `mag` (caricatore) |
| Mitra Vespa, Mitra Faina, Fucile Falco, Fucile Lupo, Fucile Cervo | `mag` (caricatore), `slide` (leva d'armamento o carrello) |
| Mitra Tuono | `mag` (il caricatore a tamburo) |
| Doppietta, Spingarda | `brl` (tutto quello che sta davanti alla cerniera: canne e astina) |
| Pompa Cinghiale | `pump` (l'astina della pompa) |
| Mitragliatrici Orso, Mastino, Bisonte | `lid` (coperchio sopra il nastro), `mag` (cassetta delle munizioni col nastro) |
| Fulminatore, Aurora, Spingarda Acida | `cell` (la bombola o cella di energia che si sostituisce) |

### Oggetti con una parte mobile
| Oggetto | Pezzo da separare |
|---|---|
| Cassa delle armi | `coperchio` |
| Interruttore della corrente | `leva` |
| Leva delle trappole | `leva` |
| Finestra con le assi | le assi le metto io una per una con `asse.glb`: la finestra va generata **senza** assi |

L'aereo e la funivia si muovono interi: non serve staccare niente.

---

## 7. Versione potenziata delle armi (facoltativo)
Per le armi passate dalla Forgia si può usare **Retexture** di Meshy sullo stesso modello, con questo prompt:
`Same weapon with an upgraded forged camo: blackened steel with glowing orange molten veins and engraved arcane patterns, polished brass details, realistic PBR, no readable text`
Salvale come `arma_<nome>_forgia.glb`.
