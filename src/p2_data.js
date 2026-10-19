(function(){
'use strict';
const $=id=>document.getElementById(id);
if(!window.THREE){ $('loadErr').hidden=false; $('start').disabled=true; return; }

/* =========================================================
   UTILITÀ
   ========================================================= */
const rand=(a,b)=>a+Math.random()*(b-a);
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const lerp=(a,b,t)=>a+(b-a)*t;
const pick=a=>a[(Math.random()*a.length)|0];
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

/* =========================================================
   MAPPE
   Legenda (1 carattere = 1 m): #=muro |=sbarre +=porta/cancello W=finestra con assi
   ~=liquido (mare o acciaio fuso)  a-k=pavimento di zona  A-K=scale/rampe della zona
   0-9=arredi  spazio=terreno esterno
   ========================================================= */
const MAPS={
  prigione:{
    id:'prigione',name:'Penitenziario Scoglio Nero',tab:'Fascicolo n. 1938 · Isola di Scoglio Nero',meta:'Isola di Scoglio Nero · carcere dismesso',
    desc:"Parti dal Blocco C. Apri i cancelli, sali in mensa, attraversa la passerella fino alla torretta, scendi al molo. La corrente si riattiva nell'ufficio del direttore. Dicono che in fondo al pontile ci sia una forgia incatenata.",
    startLabel:'Entra nel Blocco C',ascii:/*MAP_PRIGIONE*/,
    outside:'sea',liquidH:-2.6,fog:0x070a0d,fogFar:42,
    regions:[
      {k:'a',name:'Blocco C',h:0,ceil:7,floor:'concrete',lights:[[40.5,53.5],[60.5,53.5]],lc:0xffd9a8,ly:5.4},
      {k:'b',name:'Isolamento',h:0,ceil:3,floor:'concrete2',lights:[[21.5,53.5]],lc:0xcfe0ff},
      {k:'c',name:'Docce',h:0,ceil:3.2,floor:'tiles',lights:[[16.5,67.5]],lc:0xd8ecff},
      {k:'d',name:'Mensa',h:1.6,ceil:3.6,floor:'checker',lights:[[44.5,29.5]],lc:0xffe0a8},
      {k:'e',name:'Cucina',h:1.6,ceil:3.4,floor:'tiles2',lights:[[63.5,30.5]],lc:0xffcf88},
      {k:'f',name:'Cortile',h:0,out:true,floor:'dirt'},
      {k:'g',name:'Infermeria',h:0,ceil:3.2,floor:'checker2',lights:[[84.5,70.5]],lc:0xe2eeff},
      {k:'h',name:'Ufficio del direttore',h:3.2,ceil:3.2,floor:'parquet',lights:[[63.5,15.5]],lc:0xffc98a},
      {k:'i',name:'Molo',h:-2,out:true,floor:'planks'},
      {k:'j',name:'Sala caldaie',h:0,ceil:4,floor:'concrete',lights:[[12.5,38.5]],lc:0xff9a52},
      {k:'k',name:'Passerella e torretta',h:3.2,out:true,floor:'concrete'},
    ],
    links:{f:['k']},
    ramps:[
      {x0:46,x1:49,z0:38,z1:49,axis:'z',h0:1.6,h1:0},{x0:66,x1:68,z0:24,z1:30,axis:'z',h0:3.2,h1:1.6},
      {x0:70,x1:79,z0:33,z1:35,axis:'x',h0:1.6,h1:0},{x0:92,x1:94,z0:24,z1:33,axis:'z',h0:3.2,h1:0},
      {x0:28,x1:36,z0:68,z1:70,axis:'x',h0:0,h1:-2},{x0:64,x1:72,z0:70,z1:72,axis:'x',h0:-2,h1:0},
    ],
    doors:{
      '29,52':{to:'Isolamento',cost:750,kind:'gate'},'46,50':{to:'Mensa',cost:750,kind:'gate'},
      '70,52':{to:'Cortile',cost:1000,kind:'gate'},'13,46':{to:'Sala caldaie',cost:1000,kind:'steel'},
      '13,60':{to:'Docce',cost:750,kind:'gate'},'57,30':{to:'Cucina',cost:1000,kind:'steel'},
      '66,22':{to:'Ufficio del direttore',cost:1250,kind:'steel'},'69,33':{to:'Cortile',cost:1250,kind:'steel'},
      '69,12':{to:'Passerella',cost:1500,kind:'gate'},'82,63':{to:'Infermeria',cost:1000,kind:'steel'},
      '73,70':{to:'Molo',cost:1250,kind:'gate'},'27,68':{to:'Molo',cost:1000,kind:'gate'},
    },
    perks:['doppio@52,61,0,1','tempra@93,74,0,1','manolesta@4,44,-1,0','passosvelto@95,12,0,-1','occhio@56,36,1,0'],
    wallbuys:[{w:'lince',x:58,z:45.5,face:[0,-1]},{w:'vespa',x:21,z:52.5,face:[0,-1]},{w:'doppietta',x:21,z:61.5,face:[0,-1]},{w:'falco',x:72.5,z:45,face:[-1,0]}],
    boxSpots:[
      {name:'Mensa',cells:[[48,22],[49,22]],face:[0,-1]},
      {name:'Cortile',cells:[[72,26],[72,27]],face:[-1,0]},{name:'Infermeria',cells:[[81,74],[82,74]],face:[0,1]},
      {name:'Sala caldaie',cells:[[18,45],[19,45]],face:[0,1]},{name:'Docce',cells:[[20,74],[21,74]],face:[0,1]},
      {name:'Molo',cells:[[40,66],[41,66]],face:[0,-1]},{name:'Ufficio del direttore',cells:[[60,21],[61,21]],face:[0,1]},
    ],boxStart:[0],
    forge:{cells:[[48,78],[49,78]],face:[0,1]},
    power:{x:63.5,z:10.5,face:[0,-1]},
    risers:[],waterRisers:[],
    start:{x:50.5,z:53.5,yaw:-Math.PI/2},menuCam:{x:50.5,y:2.2,z:53.5,yaw:-Math.PI/2,swing:6},
    labels:{a:[50.5,53.6],b:[21,48],c:[16.5,63],d:[44,24.8],e:[62.5,34.5],f:[84,38],g:[84,69.5],h:[62,19.5],i:[43,70],j:[12,31.6],k:[80,11]},
    quest:'keys',
    keys:[{x:16.5,z:67.5,dy:.55},{x:91.5,z:20.5,dy:.25},{x:63.5,z:31.5,dy:1.12}],
    recorders:[],
    writings:[
      {c:[50,51,'N'],t:"LA LUCE LA TIENE LUI|SU, IN MENSA ↑",y:1.9},
      {c:[56,27,'E'],t:"IN CUCINA|POI SALI DA LUI →",y:2.1},
      {c:[61,24,'N'],t:"IL DIRETTORE|ASPETTA DI SOPRA ↑",y:2.2},
      {c:[65,10,'N'],t:"LA SUA LEVA|RIDÀ FIATO AI MURI",y:4.9},
      {c:[31,57,'W'],t:"UNA CHIAVE|DOVE L'ACQUA|SCENDE FREDDA",y:1.8},
      {c:[32,31,'W'],t:"IL CUOCO NON LA TOGLIE|DA DOVE SI SERVE IL RANCIO",y:3.4},
      {c:[72,24,'W'],t:"L'OCCHIO CHE GIRA|HA QUALCOSA AI PIEDI",y:1.9},
      {c:[28,71,'W'],t:"TRE CHIAVI|PER LA FORGIA|IN FONDO AL PONTILE",y:-.2},
    ],
  },
  acciaieria:{
    id:'acciaieria',name:'Acciaieria Vulcano',tab:'Pratica n. 1961 · Stabilimento Vulcano',meta:'Stabilimento Vulcano · sei livelli',
    desc:"Parti dalla mensa operai, a 4 m. Scendi al piano di colata tra i canali di acciaio fuso, sali sulla passerella del carroponte, poi in sala controllo, sul ponte e fino alla bocca dell'altoforno, a 10 m. Dai piani alti puoi saltare giù, ma occhio alla caduta.",
    startLabel:'Entra in mensa',ascii:/*MAP_ACCIAIERIA*/,
    outside:'ground',liquidH:-.9,fog:0x0b0907,fogFar:48,lava:true,
    regions:[
      {k:'a',name:'Mensa operai',h:4,ceil:3.4,floor:'tiles2',lights:[[49.5,37.5]],lc:0xffd9a0},
      {k:'b',name:'Sala controllo',h:8,ceil:4.8,floor:'checker2',lights:[[50.5,18.5]],lc:0xcfe4ff},
      {k:'c',name:'Passerella del carroponte',h:6,ceil:5,floor:'grate'},
      {k:'d',name:'Laminatoio',h:2,ceil:9,floor:'concrete',lights:[[78.5,40.5],[88.5,50.5]],lc:0xffe2b0,ly:10},
      {k:'e',name:'Piano di colata',h:0,ceil:8,floor:'concrete2',lights:[[40.5,56.5],[58.5,60.5],[46,63.5]],lcs:[0xffb070,0xffb070,0xff6a20],ly:6.5},
      {k:'f',name:'Deposito rottami',h:0,out:true,floor:'dirt'},
      {k:'g',name:'Altoforno',h:2,ceil:12,floor:'concrete',lights:[[12.5,20.5],[20.5,34.5]],lcs:[0xff9a52,0xffc070],ly:10},
      {k:'h',name:"Bocca dell'altoforno",h:10,out:true,floor:'rock'},
      {k:'i',name:'Cabina di comando',h:10,ceil:3,floor:'parquet',lights:[[45.5,6.5]],lc:0xffc98a},
      {k:'j',name:'Ponte',h:10,out:true,floor:'grate'},
      {k:'k',name:'Fondamenta',h:-6,ceil:4.4,floor:'rock',under:true,lights:[[67.5,9],[84.5,4.5],[84.5,13.5],[76.5,9],[92.5,9]],lcs:[0xff7a3a,0xff4a1a,0xff4a1a,0xff6a2a,0xff6a2a],ly:3.9},
    ],
    links:{j:['h'],h:['j']},
    ramps:[
      {x0:48,x1:50,z0:17,z1:29,axis:'z',h0:8,h1:4},{x0:41,x1:43,z0:12,z1:18,axis:'z',h0:10,h1:8},
      {x0:60,x1:66,z0:31,z1:33,axis:'x',h0:4,h1:6},{x0:92,x1:94,z0:27,z1:43,axis:'z',h0:6,h1:2},
      {x0:44,x1:46,z0:46,z1:59,axis:'z',h0:4,h1:0},{x0:62,x1:68,z0:54,z1:56,axis:'x',h0:0,h1:2},
      {x0:14,x1:16,z0:40,z1:46,axis:'z',h0:2,h1:0},{x0:7,x1:9,z0:16,z1:30,axis:'z',h0:6,h1:2},
      {x0:7,x1:9,z0:14,z1:15,axis:'z',h0:6,h1:6},{x0:10,x1:24,z0:14,z1:15,axis:'x',h0:6,h1:10},
    ],
    doors:{
      '48,30':{to:'Sala controllo',cost:750,kind:'steel'},'44,45':{to:'Piano di colata',cost:750,kind:'steel'},
      '59,31':{to:'Passerella',cost:1000,kind:'gate'},'91,27':{to:'Laminatoio',cost:1000,kind:'gate'},
      '69,54':{to:'Piano di colata',cost:1000,kind:'steel'},'27,62':{to:'Deposito rottami',cost:1250,kind:'gate'},
      '14,39':{to:'Altoforno',cost:1000,kind:'steel'},'23,12':{to:"Bocca dell'altoforno",cost:1500,kind:'gate'},
      '41,10':{to:'Cabina di comando',cost:1250,kind:'steel'},'39,6':{to:'Ponte',cost:1250,kind:'gate'},
    },
    perks:['secondavita@58,42,1,0','cadutalibera@58,13,1,0','terzamano@50,4,1,0','tempra@96,57,1,0','manolesta@30,69,-1,0','scossa@26,75,1,0','telanera@26,37,1,0','doppio@67,27,0,-1','passosvelto@4,74,-1,0','occhio@96,52,1,0'],
    wallbuys:[{w:'lince',x:44,z:31.5,face:[0,-1]},{w:'toro',x:56,z:24.5,face:[0,1]},{w:'vespa',x:80,z:27.5,face:[0,-1]},
      {w:'cinghiale',x:96.5,z:42,face:[1,0]},{w:'doppietta',x:44,z:70.5,face:[0,1]},{w:'falco',x:26.5,z:52,face:[1,0]}],
    boxSpots:[
      {name:'Sala controllo',cells:[[52,12],[53,12]],face:[0,-1]},
      {name:'Laminatoio',cells:[[70,50],[70,51]],face:[-1,0]},{name:'Piano di colata',cells:[[43,70],[44,70]],face:[0,1]},
      {name:'Deposito rottami',cells:[[4,56],[4,57]],face:[-1,0]},{name:'Altoforno',cells:[[22,38],[23,38]],face:[0,1]},
      {name:'Cabina di comando',cells:[[44,3],[45,3]],face:[0,-1]},
    ],boxStart:[0],
    forge:{cells:[[20,3],[21,3]],face:[0,-1]},
    power:{x:40.5,z:22.5,face:[-1,0]},
    risers:[],waterRisers:[],
    start:{x:49.5,z:38.5,yaw:-Math.PI/2},menuCam:{x:72.5,y:7.8,z:28.5,yaw:-2.3,swing:0},
    labels:{a:[49.5,32.6],b:[53,21],c:[80,28.4],d:[84,47],e:[38,60],f:[15,62],g:[16,33],h:[14,10.6],i:[45.5,8],j:[31.5,4.6],k:[84,2.4]},
    quest:'furnace',
    valves:[{x:30.5,z:51.5,face:[-1,0]},{x:96.5,z:31.5,face:[1,0]},{x:72.5,z:27.5,face:[0,-1]}],
    furnace:{x:18,z:26,r:13,need:15},
    recorders:[],
    writings:[
      {c:[54,31,'N'],t:"LA CORRENTE È IN ALTO|DOVE SI COMANDANO|LE MACCHINE ↑",y:5.9},
      {c:[40,17,'W'],t:"TIRALA|E IL FORNO RESPIRA",y:9.9},
      {c:[30,53,'W'],t:"TRE VALVOLE|TRE PIANI",y:1.9},
      {c:[6,28,'W'],t:"IL FORNO NON VUOLE CARBONE|VUOLE LORO",y:4.2},
      {c:[8,8,'W'],t:"QUELLO CHE LASCI|NELLA BOCCA|ESCE DIVERSO",y:11.9},
      {c:[70,44,'W'],t:"QUATTRO OCCHI ROSSI|LASSÙ, IN ALTO|SPEGNILI",y:4.2},
      {c:[68,62,'E'],t:"TRE CUORI NEL CROGIOLO|POI LA LEVA",y:2.1},
      {c:[69,27,'N'],t:"CINQUE TESCHI|TI GUARDANO DALL'ALTO|SOLO IL FUOCO LI FA CADERE",y:7.9},
      {c:[4,56,'W'],t:"L'OSSARIO HA FAME",y:1.9},
      {c:[69,16,'S'],t:"IL FUOCO SEGUE|L'ORDINE SCRITTO COL SANGUE",y:-4.1},
      {c:[84,2,'N'],t:"RIDAGLI IL CUORE",y:-3.9},
      {c:[57,12,'N'],sym:0,y:9.9},{c:[26,34,'E'],sym:1,y:4.2},{c:[96,39,'E'],sym:2,y:4.2},{c:[26,70,'E'],sym:3,y:1.9},{c:[58,37,'E'],sym:4,y:5.9},{c:[47,9,'S'],sym:5,y:11.8},
    ],
    egg3:{
      bells:[[50.62,12.55,4.5],[96.7,7.2,42.5],[4.35,3.1,62.5]],
      altar:{cells:[[14,50],[15,50]],x:15,z:50.5},
      skulls:[[26.96,10.2,20.5,1,0],[45.5,6.3,70.96,0,1],[84.5,8.4,58.96,0,1],[26.96,3.7,54.5,1,0],[18.5,13.3,3.04,0,-1]],
      feed:50,feedR:12,
      liftUp:{x:30.02,z:58,face:[-1,0]},liftDown:{x:63.98,z:5.5,face:[-1,0]},
      shrine:{x:84.5,z:9},
    },
    egg2:{lamps:[[96.93,8.2,44.5,-1,0],[60.5,6.2,50.07,0,1],[4.07,3.4,72.5,1,0],[16.5,12.4,3.07,0,1]],crucible:{x:58.5,z:67.5,ix:58.5,iz:65.4},need:6,time:75},
  },
  /* Silver Falls: cittadina degli Appalachi di notte, omaggio a Liberty Falls (COD BO6). mappe/cascate.txt (generata, una sola quota per cella).
     Città a quota 0: Via Principale (inizio) con Emporio, Tavola calda, Banca; Via est con sceriffo, ferramenta, distributore e officina (corrente);
     sala bowling, fumetteria e parcheggio col serbatoio dell'acqua a sud; Via ovest, ufficio postale, ponte sul fiume con la cascata e motel a ovest.
     Collina a quota 3: sagrato, chiesa (Forgia sull'altare), cimitero e mausoleo. La Forgia vuole tre fusibili: caveau, mausoleo, officina.
     Le strade sono chiuse da cumuli di rottami da comprare (porte 'debris'). Anelli per allenare: strada–colle–cimitero–scalinata,
     strada–bowling–parcheggio–officina, strada–motel–parcheggio. */
  cascate:{
    id:'cascate',name:'Silver Falls',tab:'Pratica n. 1991 · Contea di Silver Falls',meta:'Virginia Occidentale · ottobre 1991',
    desc:"Parti dalla Via Principale. Sgombra i rottami delle strade, sali al colle della chiesa dal retro della tavola calda, attraversa il cimitero e scendi la scalinata. La corrente è nell'officina del distributore. Il prete ha nascosto tre fusibili: senza, la Forgia sull'altare non si accende.",
    startLabel:'Entra in Via Principale',ascii:/*MAP_CASCATE*/,
    outside:'ground',liquidH:-2.2,fog:0x0b0e14,fogFar:52,hemi:.62,moon:.5,
    regions:[
      {k:'a',name:'Via Principale',h:0,out:true,floor:'asphalt',wall:'planks',wallH:2.4,lights:[[45.5,34.5],[57.5,42.5]],lc:0xffc27a,ly:4.1,lr:20},
      {k:'b',name:'Emporio',h:0,ceil:3.6,floor:'planks',wall:'plaster',lights:[[41.5,28.5]],lc:0xffe2b0},
      {k:'c',name:'Tavola calda',h:0,ceil:3.4,floor:'checker',wall:'tiles',lights:[[54.5,29.5]],lc:0xffe8d0},
      {k:'s',name:'Banca',h:0,ceil:4,floor:'parquet',wall:'plaster',lights:[[67.5,30.5]],lc:0xffd9a0},
      {k:'q',name:'Sagrato',h:3,out:true,floor:'concrete2',wall:'masonry',wallH:1.2,lights:[[50.5,14.5]],lc:0xc8d4ff,ly:3.9,lr:18},
      {k:'f',name:'Chiesa',h:3,ceil:7,floor:'tiles2',wall:'masonry',lights:[[46,4.5],[46,9.5]],lc:0xffb060,ly:4.5},
      {k:'e',name:'Cimitero',h:3,out:true,floor:'grass',wall:'masonry',wallH:2.4,lights:[[76.5,10.5]],lc:0x9fb8ff,ly:4,lr:24},
      {k:'o',name:'Mausoleo',h:3,ceil:3.2,floor:'concrete2',wall:'masonry',lights:[[86,6.5]],lc:0x8affb0},
      {k:'g',name:'Via est',h:0,out:true,floor:'asphalt',wall:'planks',wallH:2.4,lights:[[86.5,34.5]],lc:0xffc27a,ly:4.1,lr:20},
      {k:'h',name:'Distributore',h:0,out:true,floor:'concrete',wall:'wallOut',wallH:2.4,lights:[[86,52]],lc:0xeaf4ff,ly:4,lr:18},
      {k:'i',name:'Officina',h:0,ceil:5,floor:'concrete2',wall:'wallOut',lights:[[89.5,70.5]],lc:0xfff0d0},
      {k:'t',name:'Ufficio dello sceriffo',h:0,ceil:3.4,floor:'checker2',wall:'plaster',lights:[[75,30.5]],lc:0xe8eeff},
      {k:'u',name:'Ferramenta',h:0,ceil:3.6,floor:'planks',wall:'brick',lights:[[90.5,28.5]],lc:0xffd9a0},
      {k:'n',name:'Sala bowling',h:0,ceil:5,floor:'parquet',wall:'plaster',lights:[[44.5,50.5],[54.5,58.5]],lc:0xffd8ee},
      {k:'r',name:'Fumetteria',h:0,ceil:3.4,floor:'checker',wall:'brick'},
      {k:'p',name:'Parcheggio',h:0,out:true,floor:'asphalt',wall:'wallOut',wallH:2.6,lights:[[55.5,71.5]],lc:0xffa860,ly:5,lr:24},
      {k:'j',name:'Via ovest',h:0,out:true,floor:'asphalt',wall:'planks',wallH:2.4},
      {k:'k',name:'Ponte',h:0,out:true,floor:'planks',wall:'masonry',wallH:1.1},
      {k:'l',name:'Motel',h:0,out:true,floor:'asphalt',wall:'planks',wallH:2.2,lights:[[22.5,55.5]],lc:0xff7a6a,ly:3.6,lr:18},
      {k:'m',name:'Camere del motel',h:0,ceil:3,floor:'parquet',wall:'plaster',lights:[[8,62]],lc:0xffd9a0},
      {k:'v',name:'Ufficio postale',h:0,ceil:3.6,floor:'checker2',wall:'plaster',lights:[[21.5,28.5]],lc:0xffe2b0},
    ],
    links:{a:['b'],g:['h'],j:['k']},
    ramps:[{x0:55,x1:57,z0:17,z1:23,axis:'z',h0:3,h1:0},{x0:79,x1:83,z0:20,z1:33,axis:'z',h0:3,h1:0}],
    doors:{
      '53,33':{to:'Tavola calda',cost:750,kind:'steel'},'55,24':{to:'Sagrato',cost:1000,kind:'steel'},'65,33':{to:'Banca',cost:1000,kind:'steel'},
      '49,43':{to:'Sala bowling',cost:1250,kind:'steel'},'68,43':{to:'Fumetteria',cost:750,kind:'steel'},
      '70,34':{to:'Via est',cost:750,kind:'debris'},'29,34':{to:'Via ovest',cost:1000,kind:'debris'},
      '44,12':{to:'Chiesa',cost:1250,kind:'steel'},'61,14':{to:'Cimitero',cost:1000,kind:'gate'},'85,10':{to:'Mausoleo',cost:750,kind:'gate'},
      '79,19':{to:'Cimitero',cost:1000,kind:'gate'},'74,33':{to:'Ufficio dello sceriffo',cost:1000,kind:'steel'},'88,33':{to:'Ferramenta',cost:1000,kind:'steel'},
      '87,63':{to:'Officina',cost:1000,kind:'steel'},'82,69':{to:'Officina',cost:1000,kind:'steel'},'49,65':{to:'Parcheggio',cost:1000,kind:'steel'},
      '21,33':{to:'Ufficio postale',cost:750,kind:'steel'},'20,43':{to:'Motel',cost:1000,kind:'gate'},'13,58':{to:'Camere del motel',cost:750,kind:'steel'},
      '30,70':{to:'Parcheggio',cost:1000,kind:'gate'},
    },
    perks:['secondavita@37,32,-1,0','manolesta@60,26,1,0','tempra@72,34,0,-1','doppio@64,45,1,0','passosvelto@12,56,1,0','scossa@96,66,1,0','occhio@91,12,1,0','terzamano@35,10,-1,0'],
    wallbuys:[{w:'lince',x:45.5,z:25.5,face:[0,-1]},{w:'vespa',x:38.5,z:34.5,face:[0,-1]},{w:'doppietta',x:48.5,z:26.5,face:[-1,0]},{w:'falco',x:62.5,z:31.5,face:[-1,0]},
      {w:'toro',x:73.5,z:26.5,face:[-1,0]},{w:'cinghiale',x:95.5,z:26.5,face:[1,0]},{w:'vespa',x:55.5,z:44.5,face:[0,-1]},{w:'doppietta',x:14.5,z:66.5,face:[-1,0]},{w:'falco',x:24.5,z:25.5,face:[0,-1]}],
    boxSpots:[
      {name:'Emporio',cells:[[39,32],[40,32]],face:[0,1]},{name:'Sala bowling',cells:[[61,64],[62,64]],face:[0,1]},{name:'Motel',cells:[[29,50],[29,51]],face:[1,0]},
      {name:'Cimitero',cells:[[62,6],[62,7]],face:[-1,0]},{name:'Officina',cells:[[96,74],[96,75]],face:[1,0]},{name:'Ufficio postale',cells:[[16,26],[16,27]],face:[-1,0]},
      {name:'Distributore',cells:[[96,56],[96,57]],face:[1,0]},
    ],boxStart:[0],
    forge:{cells:[[45,2],[46,2]],face:[0,-1]},forgeWhere:"sull'altare della chiesa",
    power:{x:96.5,z:69.5,face:[1,0]},
    risers:[[36.5,38.5],[64.5,38.5],[78.5,38.5],[92.5,38.5],[84.5,58.5],[94.5,44.5],[40.5,76.5],[60.5,75.5],[76.5,76.5],[50.5,68.5],
      [66.5,5.5],[72.5,11.5],[78.5,5.5],[68.5,17.5],[84.5,15.5],[91.5,4.5],[42.5,15.5],[58.5,15.5],[16.5,40.5],[26.5,35.5],[2.5,44.5],[16.5,52.5],[26.5,70.5],[20.5,76.5]],
    waterRisers:[],
    start:{x:50.5,z:38.5,yaw:0},menuCam:{x:50.5,y:2.4,z:40.5,yaw:0,swing:6},
    labels:{a:[50,38.5],b:[42,28.5],c:[54,30],s:[67,31.5],q:[50,15],f:[46,7],e:[72,9],o:[86,7],g:[83,37],h:[86,55],i:[89,72],t:[75,31],u:[90,31],n:[50,55],r:[69.5,50],p:[55,72],j:[20,39],k:[6.5,38.5],l:[22,62],m:[8,63],v:[21.5,27]},
    quest:'keys',keyItem:{one:'il fusibile',many:'fusibili'},
    keys:[{x:65.5,z:25.6,dy:1.05},{x:86.5,z:4.6,dy:.95},{x:91.5,z:64.5,dy:1.12}],
    recorders:[],
    facades:[
      {x0:36,z0:24,x1:47,z1:33,m:'sidingG'},{x0:48,z0:24,x1:61,z1:33,m:'sidingR'},{x0:61,z0:24,x1:72,z1:33,m:'masonry'},{x0:72,z0:24,x1:78,z1:33,m:'brick'},
      {x0:84,z0:24,x1:96,z1:33,m:'sidingB'},{x0:15,z0:24,x1:28,z1:33,m:'brick'},{x0:35,z0:43,x1:65,z1:65,m:'plaster'},{x0:66,z0:43,x1:73,z1:52,m:'sidingY'},
      {x0:34,z0:1,x1:58,z1:12,m:'masonry'},{x0:82,z0:3,x1:90,z1:10,m:'masonry'},{x0:82,z0:63,x1:97,z1:77,m:'wallOut'},{x0:2,z0:50,x1:13,z1:77,m:'sidingW'},
      {x0:78,z0:19,x1:84,z1:33,m:'masonry'},{x0:54,z0:17,x1:58,z1:23,m:'masonry'},{x0:38,z0:12,x1:61,z1:17,m:'masonry'},
    ],
    writings:[
      {c:[50,34,'N'],t:"LA FORGIA È IN CHIESA|SERVONO 3 FUSIBILI",y:2.1},
      {c:[68,27,'W'],t:"IL PRIMO|NEL CAVEAU",y:1.9},
      {c:[84,11,'N'],t:"IL SECONDO DORME|CON I MORTI",y:4.9},
      {c:[96,67,'E'],t:"IL TERZO È QUI|DOVE TORNA LA LUCE",y:2.2},
      {c:[90,34,'N'],t:"LA CORRENTE|IN OFFICINA ↓",y:2.1},
      {c:[52,2,'N'],t:"QUI SI FORGIA|CIÒ CHE RESTA",y:5},
      {c:[14,47,'W'],t:"STANZA 6|NON APRITE",y:1.9},
      {c:[44,66,'N'],t:"NON SIAMO SOLI",y:2},
    ],
  },
  /* La Rocca: omaggio a Mob of the Dead (Alcatraz, COD BO2). Tre strati sovrapposti (mappe/rocca_0..2.txt):
     0 = piano terra della casa delle celle, mensa, cucina, docce, biblioteca, lavanderia, gallerie sotto il cortile, molo
     1 = ballatoi sopra le celle, infermeria sopra la mensa, ufficio del direttore sopra le docce, cortile (sopra le gallerie), ponte sul mare
     2 = tetto sopra l'infermeria (dove si costruisce l'aereo) */
  rocca:{
    id:'rocca',name:'La Rocca',tab:'Fascicolo n. 1963 · Isola dei Pellicani',meta:'Isola dei Pellicani · tre piani sovrapposti',
    desc:"Parti da Broadway, il corridoio della casa delle celle. Sali sui ballatoi, scendi nelle gallerie sotto il cortile, raggiungi il molo. Costruisci lo scudo, sfama le tre teste del cane infernale per il tomahawk, raccogli i teschi per la spingarda acida e i cinque pezzi dell'aereo: sul tetto si vola fino al ponte, dove aspetta la Forgia.",
    startLabel:'Entra a Broadway',layers:[/*MAP_ROCCA0*/,/*MAP_ROCCA1*/,/*MAP_ROCCA2*/],layerBase:[0,3.6,7.6],
    layerNames:['Piano terra e gallerie','Ballatoi, infermeria, cortile e ponte','Tetto'],
    outside:'sea',liquidH:-4.6,fog:0x080b10,fogFar:48,hemi:.6,moon:.44,
    regions:[
      {k:'a',name:'Broadway',h:0,ceil:8,floor:'concrete',lights:[[41.5,39.5],[52.5,39.5],[64.5,39.5]],lc:0xffe2b0,ly:7.1,li:.6,lr:16},
      {k:'b',name:'Ballatoio',h:3.6,ceil:4.4,floor:'grate'},
      {k:'c',name:'Biblioteca',h:0,ceil:7.3,floor:'parquet',lights:[[29.5,36.5],[29.5,42.5]],lc:0xffc98a,ly:4.4,lr:14},
      {k:'d',name:'Ufficio del direttore',h:3.6,ceil:4,floor:'parquet',lights:[[68.5,23.5]],lc:0xffc98a},
      {k:'e',name:'Mensa',h:0,ceil:3.3,floor:'checker',lights:[[35.5,21.5],[42.5,26.5]],lc:0xffe0a8},
      {k:'f',name:'Cucina',h:0,ceil:3.3,floor:'tiles2',lights:[[53.5,25.5]],lc:0xffcf88},
      {k:'g',name:'Infermeria',h:3.6,ceil:3.7,floor:'checker2',lights:[[36.5,23.5],[49.5,23.5]],lc:0xe2eeff},
      {k:'h',name:'Tetto',h:7.6,out:true,floor:'concrete2',wallH:1.1,lights:[[45.5,21.5]],lc:0xffd6a0,ly:3.85,lr:16},
      {k:'i',name:'Docce',h:0,ceil:3.3,floor:'tiles',lights:[[69.5,22.5]],lc:0xd8ecff},
      {k:'j',name:'Cortile',h:0,out:true,floor:'dirt',lights:[[18.5,60.5],[38.5,58.5]],lc:0xd0dcff,ly:3.85,lr:16},
      {k:'k',name:'Gallerie della cittadella',h:-3.5,ceil:3,floor:'rock',wall:'rock',lights:[[12.5,60.5],[31.5,69.5],[42.5,59.5],[26.5,52.5]],lc:0xff9a52,ly:2.6,lr:9},
      {k:'l',name:'Molo',h:-2,out:true,floor:'planks',wallH:2.2,lights:[[52.5,66.5],[70.5,66.5],[84.5,66.5]],lc:0xffb070,ly:3.85,lr:15},
      {k:'m',name:'Lavanderia',h:0,ceil:3.4,floor:'tiles',lights:[[57.5,53.5]],lc:0xd8ecff},
      {k:'n',name:'Ponte',h:10,out:true,floor:'concrete',wall:'redPaint',lights:[[30.5,4.5],[69.5,4.5]],lc:0xffc890,ly:5.5,lr:22},
    ],
    links:{},
    ramps:[
      {x0:70,x1:76,z0:38,z1:39,axis:'x',h0:0,h1:3.6,mesh:'scala_broadway'},{x0:25,x1:26,z0:19,z1:25,axis:'z',h0:3.6,h1:0},
      {x0:57,x1:58,z0:19,z1:25,axis:'z',h0:7.6,h1:3.6,l:1,mesh:'scala_tetto'},{x0:30,x1:31,z0:60,z1:66,axis:'z',h0:0,h1:-3.5},
      {x0:47,x1:50,z0:68,z1:70,axis:'x',h0:-3.5,h1:-2},{x0:62,x1:63,z0:60,z1:64,axis:'z',h0:0,h1:-2},
    ],
    doors:{
      '35,38':{to:'Biblioteca',cost:750,kind:'gate'},'69,38':{to:'Ballatoio',cost:750,kind:'gate'},'28,30':{to:'Mensa',cost:1000,kind:'steel'},
      '55,30':{to:'Cucina',cost:1000,kind:'gate'},'47,22':{to:'Cucina',cost:750,kind:'steel'},'59,25':{to:'Docce',cost:1000,kind:'steel'},
      '25,26':{to:'Infermeria',cost:1250,kind:'gate'},'57,26,1':{to:'Tetto',cost:1500,kind:'gate'},'74,30,1':{to:'Ufficio del direttore',cost:1000,kind:'steel'},
      '55,48':{to:'Lavanderia',cost:1000,kind:'gate'},'29,48':{to:'Cortile',cost:1000,kind:'gate'},'47,53':{to:'Cortile',cost:1000,kind:'steel'},
      '30,67':{to:'Gallerie',cost:1000,kind:'gate'},'51,68':{to:'Molo',cost:1250,kind:'steel'},'62,59':{to:'Molo',cost:1250,kind:'gate'},
    },
    perks:['scossa@44,42,0,1','doppio@45,17,0,-1','manolesta@78,27,1,0','tempra@40,29,0,1,1','occhio@88,65,0,-1'],
    wallbuys:[{w:'doppietta',x:36.5,z:37.5,face:[-1,0],y:0},{w:'vespa',x:25.5,z:40.5,face:[-1,0],y:0},{w:'lince',x:40.5,z:29.5,face:[0,1],y:0},
      {w:'falco',x:78.5,z:36.5,face:[1,0],y:3.6},{w:'cinghiale',x:48.5,z:56.5,face:[-1,0],y:0},{w:'toro',x:35.5,z:70.5,face:[0,1],y:-3.5}],
    boxSpots:[
      {name:'Broadway',cells:[[40,36],[41,36]],face:[0,-1]},{name:'Biblioteca',cells:[[25,38],[25,39]],face:[-1,0]},
      {name:'Cucina',cells:[[58,21],[58,22]],face:[1,0]},{name:'Ballatoio',cells:[[40,43],[41,43]],face:[0,1],l:1},
      {name:'Lavanderia',cells:[[65,58],[66,58]],face:[0,1]},{name:'Cortile',cells:[[20,72],[21,72]],face:[0,1],l:1},
      {name:'Molo',cells:[[70,70],[71,70]],face:[0,1]},{name:'Infermeria',cells:[[33,17],[34,17]],face:[0,-1],l:1},
    ],boxStart:[0],boxExtra:['spingarda','spingarda','spingarda'],
    forge:{cells:[[91,4],[91,5]],face:[1,0],l:1},
    power:{x:60.5,z:22.5,face:[-1,0],y:3.6},
    risers:[[15.5,58.5,1],[38.5,64.5,1],[24.5,71.5,1],[10.5,51.5,1],[60.5,67.5],[80.5,67.5],[56.5,74.5],[76.5,74.5],
      [30.5,25.5,2],[50.5,22.5,2],[40.5,18.5,2],[15.5,4.5,1],[40.5,4.5,1],[60.5,4.5,1],[80.5,4.5,1],
      [12.5,64.5],[35.5,52.5],[42.5,62.5],[21.5,58.5],[37.5,69.5]],waterRisers:[],
    start:{x:40.5,z:39.5,y:0,yaw:-Math.PI/2},menuCam:{x:42.5,y:5.4,z:39.5,yaw:-Math.PI/2,swing:5},
    labels:{a:[56,39.5],b:[56,35.6],c:[29.5,39.5],d:[69,23],e:[36,22],f:[53,20],g:[42,23],h:[42,23],i:[69,20],j:[26,63],k:[26,69.2],l:[70,67.5],m:[57,51.5],n:[50,4.6]},
    quest:'rocca',recorders:[],
    benches:[{id:'scudo',cells:[[36,41],[36,42]],face:[-1,0]},{id:'acido',cells:[[52,17],[53,17]],face:[0,-1],l:1}],
    egg4:{
      shield:[{n:'il carrello',x:64.5,z:51.5,l:0},{n:"l'anta di una cella",x:78.5,z:42.5,l:1},{n:'la morsa',x:12.5,z:66.5,l:0}],
      plane:[{n:'il serbatoio',x:50.5,z:28.5,l:0},{n:'il sartiame',x:75.5,z:28.5,l:0},{n:'la valvola',x:77.5,z:18.5,l:1},{n:'il motore',x:88.5,z:73.5,l:0},{n:"l'elica",x:40.5,z:66.5,l:1}],
      skulls:[{x:25.5,z:46.5,l:0,dy:1.15},{x:71.5,z:18.5,l:1,dy:2.15},{x:42.5,z:52.5,l:0,dy:.35}],
      dogs:[{x:8.5,z:61.5,l:1,face:[-1,0]},{x:55.5,z:69.5,l:0,face:[0,1]},{x:40.5,z:29.5,l:2,face:[0,1]}],dogNeed:8,dogR:9,
      planeSpot:{x:41.5,z:23.5,l:2},chair:{x:8.5,z:4.5,l:1},bridgeIn:{x:12.5,z:4.5,yaw:-Math.PI/2},roofIn:{x:41.5,z:27.5,yaw:0},
      gondola:[{x:88.5,z:67.5,l:0,yaw:Math.PI/2},{x:27.5,z:23.5,l:2,yaw:-Math.PI/2}],
    },
    writings:[
      {c:[36,41,'W'],t:"LO SCUDO|SI COSTRUISCE QUI",y:1.9},
      {c:[78,37,'E'],t:"TRE TESTE|HANNO FAME|SFAMALE",y:2},
      {c:[34,46,'E'],t:"TRE TESCHI|E LA SPINGARDA|DIVENTA ACIDO",y:2.6},
      {c:[58,27,'E'],t:"CINQUE PEZZI|L'AEREO SUL TETTO|L'UNICA VIA",y:5.6},
      {c:[11,69,'W'],t:"DAL PONTE|NON SI SCAPPA|SI TORNA",y:-1.6},
      {c:[60,29,'S'],t:"IL DIRETTORE|TIENE LA LUCE|DI SOPRA ↑",y:1.9},
    ],
  },
};

/* =========================================================
   PERK
   ========================================================= */
const PERK_LIMIT=5;
const PERKDEF={
  tempra:{name:'Tempra',desc:'regge 5 colpi',cost:2500,color:0xc42a1f,css:'#c42a1f',letter:'T'},
  manolesta:{name:'Mano Lesta',desc:'ricarica 2× più veloce',cost:3000,color:0x4fae6a,css:'#4fae6a',letter:'M'},
  passosvelto:{name:'Passo Svelto',desc:'scatto infinito e più rapido, ricarichi correndo',cost:2000,color:0x5b8fd6,css:'#5b8fd6',letter:'P'},
  doppio:{name:'Doppio Colpo',desc:'spari più rapidi e colpi più forti',cost:2000,color:0xd9a441,css:'#d9a441',letter:'D'},
  cadutalibera:{name:'Caduta Libera',desc:'niente danni da caduta né dalle tue esplosioni; atterrando dall\'alto scateni un\'onda d\'urto e sei invulnerabile per un attimo',cost:2000,color:0x9a5ad6,css:'#9a5ad6',letter:'C'},
  telanera:{name:'Scoppio Nero',desc:"quando ti colpiscono, brucia una granata e scatena un'onda d'urto; porti fino a 6 granate",cost:2000,color:0x3a3a44,css:'#8d8da6',letter:'N'},
  occhio:{name:'Occhio di Falco',desc:'danni alla testa raddoppiati',cost:2500,color:0xb8322a,css:'#e0563c',letter:'O'},
  secondavita:{name:'Seconda Vita',desc:'se cadi, dopo qualche secondo a terra ti rialzi (ma perdi tutte le bevande)',cost:1500,color:0x55c7d6,css:'#55c7d6',letter:'S'},
  terzamano:{name:'Terza Mano',desc:'porti tre armi',cost:4000,color:0x6f8f3a,css:'#8fb04a',letter:'3'},
  scossa:{name:'Scossa',desc:'ricaricando scateni fulmini intorno a te',cost:2000,color:0x4a8af0,css:'#6aa6ff',letter:'E'},
};

/* =========================================================
   ARMI
   ========================================================= */
const WEAPONS={
  serpe:{name:'Pistola Serpe',dmg:50,mag:8,reserve:80,rpm:420,auto:false,reload:1.4,spread:.012,bloom:.012,hs:3,pellets:1,cost:0,ammo:0,kick:.022,model:'pistol',snd:'pistol'},
  toro:{name:'Revolver Toro',dmg:220,mag:6,reserve:48,rpm:160,auto:false,reload:2.6,spread:.008,bloom:.02,hs:3,pellets:1,cost:900,ammo:450,kick:.06,model:'revolver',snd:'revolver'},
  lince:{name:'Carabina Lince',dmg:130,mag:8,reserve:96,rpm:330,auto:false,reload:2.0,spread:.006,bloom:.01,hs:3,pellets:1,cost:600,ammo:300,kick:.035,model:'rifle',snd:'rifle'},
  vespa:{name:'Mitra Vespa',dmg:50,mag:30,reserve:180,rpm:780,auto:true,reload:2.1,spread:.02,bloom:.006,hs:2.5,pellets:1,cost:1000,ammo:500,kick:.012,model:'smg',snd:'smg'},
  tuono:{name:'Mitra Tuono',dmg:65,mag:50,reserve:250,rpm:950,auto:true,reload:2.6,spread:.024,bloom:.005,hs:2.5,pellets:1,cost:0,ammo:0,kick:.012,model:'drum',snd:'smg'},
  doppietta:{name:'Doppietta',dmg:60,mag:2,reserve:40,rpm:200,auto:false,reload:2.4,spread:.075,bloom:0,hs:1.5,pellets:8,cost:1200,ammo:600,kick:.07,model:'shotgun',snd:'shotgun'},
  cinghiale:{name:'Pompa Cinghiale',dmg:70,mag:6,reserve:48,rpm:75,auto:false,reload:3.2,spread:.06,bloom:0,hs:1.5,pellets:8,cost:1500,ammo:750,kick:.08,model:'pump',snd:'shotgun'},
  falco:{name:'Fucile Falco',dmg:90,mag:30,reserve:210,rpm:620,auto:true,reload:2.3,spread:.014,bloom:.005,hs:2.5,pellets:1,cost:1400,ammo:700,kick:.016,model:'ar',snd:'ar'},
  aquila:{name:'Fucile Aquila',dmg:700,mag:5,reserve:40,rpm:48,auto:false,reload:3.4,spread:.001,bloom:.03,hs:2,pellets:1,pen:4,scope:true,cost:0,ammo:0,kick:.09,model:'sniper',snd:'sniper'},
  orso:{name:'Mitragliatrice Orso',dmg:120,mag:100,reserve:300,rpm:600,auto:true,reload:4.2,spread:.022,bloom:.004,hs:2.5,pellets:1,cost:0,ammo:0,kick:.018,model:'mg',snd:'mg'},
  fulminatore:{name:'Fulminatore',dmg:1200,mag:20,reserve:160,rpm:200,auto:false,reload:3.0,spread:.004,bloom:.01,hs:1,pellets:1,cost:0,ammo:0,kick:.03,model:'ray',snd:'ray',splash:{r:2.8,dmg:700},wonder:true},
  mastino:{name:'Mitragliatrice Mastino',dmg:110,mag:150,reserve:450,rpm:720,auto:true,reload:5.0,spread:.024,bloom:.004,hs:2.5,pellets:1,cost:0,ammo:0,kick:.017,model:'lmg',snd:'mg',heavy:true},
  bisonte:{name:'Mitragliatrice Bisonte',dmg:210,mag:80,reserve:320,rpm:480,auto:true,reload:4.6,spread:.02,bloom:.006,hs:2.5,pellets:1,pen:2,cost:0,ammo:0,kick:.03,model:'hmg',snd:'hmg',heavy:true},
  lupo:{name:'Fucile Lupo',dmg:105,mag:30,reserve:240,rpm:700,auto:true,reload:2.2,spread:.013,bloom:.005,hs:2.5,pellets:1,cost:0,ammo:0,kick:.015,model:'ar2',snd:'ar'},
  faina:{name:'Mitra Faina',dmg:48,mag:36,reserve:252,rpm:1000,auto:true,reload:1.9,spread:.022,bloom:.006,hs:2.5,pellets:1,cost:0,ammo:0,kick:.01,model:'smg2',snd:'smg'},
  cervo:{name:'Fucile Cervo',dmg:170,mag:20,reserve:180,rpm:450,auto:true,reload:2.5,spread:.009,bloom:.008,hs:3,pellets:1,pen:2,cost:0,ammo:0,kick:.028,model:'br',snd:'rifle'},
  arco:{name:'Arco di Brace',dmg:650,mag:1,reserve:14,rpm:60,auto:false,reload:.55,spread:0,bloom:0,hs:2,pellets:1,cost:0,ammo:0,kick:.02,model:'bow',snd:'bow',special:'bow',wonder:true},
  aurora:{name:'Aurora',dmg:420,mag:500,reserve:4500,rpm:900,auto:true,reload:3.0,spread:.006,bloom:.002,hs:2.5,pellets:1,pen:3,cost:0,ammo:0,kick:.008,model:'laser',snd:'laser',wonder:true,beam:0xff4a2a},
  mani:{name:'A mani nude',dmg:0,mag:0,reserve:0,rpm:60,auto:false,reload:1,spread:0,bloom:0,hs:1,pellets:1,cost:0,ammo:0,kick:0,model:'hands',snd:'pistol',special:'none'},
  vortice:{name:'Vortice',dmg:0,mag:3,reserve:9,rpm:60,auto:false,reload:2.8,spread:.002,bloom:0,hs:1,pellets:1,cost:0,ammo:0,kick:.05,model:'vortex',snd:'vortex',special:'vortex',vr:11,vt:3.6,wonder:true},
  // La Rocca: la spingarda (dalla cassa) e, con il kit fatto dei tre teschi, la spingarda acida: dardi che si attaccano e scoppiano
  spingarda:{name:'Spingarda',dmg:150,mag:2,reserve:60,rpm:130,auto:false,reload:2.3,spread:.085,bloom:0,hs:1.5,pellets:10,cost:0,ammo:0,kick:.095,model:'blunder',snd:'blunder'},
  acida:{name:'Spingarda Acida',dmg:60,mag:3,reserve:45,rpm:110,auto:false,reload:2.6,spread:.03,bloom:0,hs:1,pellets:3,cost:0,ammo:0,kick:.07,model:'blunderAcid',snd:'acid',special:'acid',wonder:true},
};
const FORGED_NAME={serpe:'Vipere Gemelle',toro:'Minotauro',lince:'Lince Reale',vespa:'Calabrone',tuono:'Uragano',doppietta:'Lupara',cinghiale:'Zanna',falco:'Grifone',aquila:'Aquila Reale',orso:'Grizzly',fulminatore:'Tempesta',vortice:'Buco Nero',mastino:'Cerbero',bisonte:'Mammut',lupo:'Lupo Mannaro',faina:'Donnola Rabbiosa',cervo:'Cervo Reale',arco:'Arco Infernale',aurora:'Aurora Boreale',mani:'A mani nude',spingarda:'Spazzatrice',acida:'Vetriolo'};
const WPAP={};Object.entries(WEAPONS).forEach(([k,d])=>{WPAP[k]={...d,name:FORGED_NAME[k],dmg:d.dmg*2.2,mag:Math.round(d.mag*1.5),reserve:d.reserve*2,rpm:d.rpm*1.1,ammo:2500,pap:true};});
WPAP.serpe.splash={r:2.2,dmg:450};WPAP.serpe.dual=true;WPAP.serpe.mag=16;WPAP.serpe.reserve=160;WPAP.serpe.rpm=620;WPAP.doppietta.pellets=10;WPAP.cinghiale.pellets=10;WPAP.fulminatore.splash={r:3.5,dmg:1500};WPAP.aquila.pen=8;
WPAP.vortice.vr=15;WPAP.vortice.vt=5;WPAP.vortice.mag=5;WPAP.vortice.reserve=15;WPAP.spingarda.pellets=14;WPAP.spingarda.mag=4;WPAP.acida.mag=5;WPAP.acida.pellets=4;
function wd(w){return w.pap?WPAP[w.id]:WEAPONS[w.id];}
const BOX_POOL=['lince','vespa','doppietta','falco','orso','toro','cinghiale','aquila','tuono','fulminatore','vortice','carillon','carillon','falco','vespa','cinghiale','tuono','mastino','bisonte','lupo','faina','cervo','lupo','faina'];
const RELOAD_KIND={blunder:'break',blunderAcid:'cell',bow:'bow',pistol:'mag',revolver:'cyl',rifle:'bolt',sniper:'bolt',smg:'mag',smg2:'mag',drum:'drum',ar:'mag',ar2:'mag',br:'mag',mg:'belt',lmg:'belt',hmg:'belt',shotgun:'break',pump:'shells',ray:'cell',vortex:'cell',laser:'cell'};
const RELOAD_EV={mag:[[.12,'magOut'],[.55,'magIn'],[.8,'rack']],cyl:[[.08,'cylOpen'],[.22,'eject'],[.42,'shell'],[.5,'shell'],[.58,'shell'],[.8,'cylClose']],bolt:[[.1,'boltUp'],[.3,'magOut'],[.6,'magIn'],[.82,'boltFwd']],
  drum:[[.12,'magOut'],[.6,'drumIn'],[.82,'rack']],belt:[[.08,'lidOpen'],[.28,'magOut'],[.56,'magIn'],[.7,'belt'],[.86,'lidClose']],break:[[.08,'breakOpen'],[.2,'eject'],[.45,'shell'],[.6,'shell'],[.84,'breakClose']],
  shells:[[.14,'shell'],[.3,'shell'],[.46,'shell'],[.62,'shell'],[.84,'pump']],cell:[[.12,'cellOut'],[.55,'cellIn'],[.8,'charge']],bow:[[.45,'nock']]};
