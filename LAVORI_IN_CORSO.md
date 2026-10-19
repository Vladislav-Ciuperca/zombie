# Lavori in corso (per riprendere in una nuova sessione: scrivere «continua»)

Ultimo aggiornamento: 19/10/2026

## Modelli Meshy (personaggi, armi, oggetti della mappa) — vedi CLAUDE.md «Modelli Meshy»
Fatto:
- [x] Colpo in testa: solo la X rossa, niente suono. Chat vocale (c'era già). Volo dello sviluppatore (tasto O).
- [x] Zombie Meshy di serie, sopravvissuti come compagni online, 21 armi Meshy.
- [x] Oggetti della mappa: rifatti con i modelli «image to 3D» in alta risoluzione (modelli/Meshy_AI_*_image-to-3d-texture_*),
      alleggeriti con tools/semplifica.mjs (superfici piatte, niente effetto stropicciato). Tutti i 22: bibite (4), cassa + bancali,
      Forgia, corrente, porte blindate 2/3 m, cancelli 2/3 m, finestre + assi, ringhiere, banchi dello scudo e dell'acido,
      sbarre (fronti di cella, fronti alte, moduli), scale della Rocca. Prove: sim senza errori su 4 mappe, walk.py come prima.
- [x] I vecchi «low poly» in modelli/meshy/Meshy_AI_*_lowpoly_* non si usano più (si possono cancellare).

Da fare:
1. Controllare a schermo le altre 15 armi (in mano, mirando, potenziate) e sistemare impugnature/mire (GUNS in meshy_assets.py).
2. Mancano ancora dai prompt di PROMPT_ROCCA.md: bibita Scossa, leva/ugelli delle trappole, pezzi delle missioni, aereo, sedia elettrica,
   funivia, teste del cane, muri, pavimenti, arredi, scale che restano (infermeria, gallerie, molo, lavanderia).
3. Peso: il gioco è ~19 MB e la Rocca ~600.000 triangoli. Da provare sul telefono vero; se va lento, meno triangoli agli oggetti ripetuti.
