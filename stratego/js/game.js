import {RANKS,MODES,modeConfig,armyCount,setupRows,lakeSet,setMode,initialBoard,legalMoves,resolveCombat,sideHasMoves} from "./rules.js";
const boardEl=document.querySelector("#board"),messageEl=document.querySelector("#message"),strengthEl=document.querySelector("#selectedStrength"),turnEl=document.querySelector("#turnStatus");
const rulesModal=document.querySelector("#rulesModal"),setupModal=document.querySelector("#setupModal"),manualSetupModal=document.querySelector("#manualSetupModal"),settingsModal=document.querySelector("#settingsModal");
let pendingAnimation=null;
let setupFromHome=false;
const SETTINGS_KEY="nfc-arcade-stratego-settings-v1";
const DEFAULT_SETTINGS={sound:false,animations:true,speed:"normal"};
let gameSettings={...DEFAULT_SETTINGS};
let audioContext=null;
function loadSettings(){
 try{const saved=JSON.parse(localStorage.getItem(SETTINGS_KEY)||"{}");gameSettings={...DEFAULT_SETTINGS,...saved};}catch{gameSettings={...DEFAULT_SETTINGS};}
 if(!["slow","normal","fast"].includes(gameSettings.speed))gameSettings.speed="normal";
 applySettings();
}
function saveSettings(){try{localStorage.setItem(SETTINGS_KEY,JSON.stringify(gameSettings));}catch(error){console.warn("Einstellungen konnten nicht gespeichert werden.",error);}}
function applySettings(){
 document.body.classList.toggle("no-game-animations",!gameSettings.animations);
 document.documentElement.style.setProperty("--game-animation-speed",gameSettings.speed==="slow"?"1.35":gameSettings.speed==="fast"?"0.72":"1");
 const sound=document.querySelector("#settingSound"),animations=document.querySelector("#settingAnimations"),speed=document.querySelector("#settingSpeed");
 if(sound)sound.checked=!!gameSettings.sound;
 if(animations)animations.checked=!!gameSettings.animations;
 if(speed)speed.value=gameSettings.speed;
}
function changeSetting(key,value){gameSettings[key]=value;saveSettings();applySettings();}
function cpuDelay(){const factor=gameSettings.speed==="slow"?1.45:gameSettings.speed==="fast"?0.65:1;return (650+Math.random()*650)*factor;}
function playSound(kind){
 if(!gameSettings.sound)return;
 try{
  const AudioCtor=window.AudioContext||window.webkitAudioContext;if(!AudioCtor)return;
  if(!audioContext)audioContext=new AudioCtor();
  if(audioContext.state==="suspended")audioContext.resume();
  const now=audioContext.currentTime,osc=audioContext.createOscillator(),gain=audioContext.createGain();
  const notes=kind==="combat"?[180,115]:kind==="win"?[440,660,880]:[330,440];
  osc.type=kind==="combat"?"triangle":"sine";osc.frequency.setValueAtTime(notes[0],now);
  if(notes.length>1)osc.frequency.exponentialRampToValueAtTime(notes[1],now+(kind==="combat"?.13:.09));
  gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(kind==="combat"?.075:.045,now+.015);gain.gain.exponentialRampToValueAtTime(.0001,now+.22);
  osc.connect(gain);gain.connect(audioContext.destination);osc.start(now);osc.stop(now+.23);
 }catch(error){console.warn("Sound konnte nicht abgespielt werden.",error);}
}

const GAME_SAVE_KEY="nfc-arcade-stratego-current-game-v1";
let hasSavedGame=false;
let currentMode="classic";let cpuDifficulty="normal";let combatRevealMode="daueraufdeckregel";setMode(currentMode);let board=initialBoard("balanced","balanced",currentMode),turn="blue",selected=null,validMoves=[],busy=false,dragPointer=null,dragFrom=null;
let cpuIntel={known:{},moved:[]};
let playerPatterns={advances:0,attacks:0,scouts:0,miners:0,center:0};
let manualSlots=Array(armyCount(currentMode)).fill(null),manualReserve={},manualSelectedType=null,manualMovingIndex=null,activeSaveSlot=0;
const pieceInfo=p=>RANKS[p.type];
const FACTIONS={
 aurelia:{name:"Aurelia",light:"#fff0b8",mid:"#d6a844",dark:"#785326",metal:"#fff0b8",crest:"#fff8d8"},
 shadow:{name:"Schattenlegion",light:"#c4b4e8",mid:"#684c91",dark:"#29233e",metal:"#c7a6ed",crest:"#e5d5ff"},
 iron:{name:"Eisenbund",light:"#c7d0d8",mid:"#66798c",dark:"#293744",metal:"#d9e1e8",crest:"#f4f7fa"},
 sylvan:{name:"Sylvanische Wacht",light:"#c7e2a4",mid:"#628b4b",dark:"#294532",metal:"#d9c58b",crest:"#f0e4b6"},
 ash:{name:"Aschenzirkel",light:"#f0b28b",mid:"#a94f38",dark:"#482b2b",metal:"#e7a66f",crest:"#ffe0b5"},
 storm:{name:"Sturmklan",light:"#a8e0e8",mid:"#347d91",dark:"#183b50",metal:"#b9dce8",crest:"#e1fbff"}
};
let playerFaction="aurelia",cpuFaction="shadow";
function factionForSide(side){return FACTIONS[side==="blue"?playerFaction:cpuFaction]||FACTIONS.aurelia;}
function applyFactions(target){for(const piece of target){if(piece)piece.faction=piece.side==="blue"?playerFaction:cpuFaction;}return target;}
function pieceArt(piece){
 const enemy=piece.side==="red",palette=FACTIONS[piece.faction]||factionForSide(piece.side),light=palette.light,mid=palette.mid,dark=palette.dark,metal=palette.metal;
 const heraldry={aurelia:`<circle cx="50" cy="56" r="10" fill="none" stroke="${palette.crest}" stroke-width="3"/><path d="M50 40v-7m0 46v-7M34 56h-7m46 0h-7M39 45l-5-5m32 32-5-5m0-22 5-5m-32 32 5-5" stroke="${palette.crest}" stroke-width="3" stroke-linecap="round"/>`,shadow:`<path d="M34 47 23 35l2 23 12 7m29-18 11-12-2 23-12 7" fill="${dark}" stroke="${palette.crest}" stroke-width="3"/><path d="m43 57 7 5 7-5" fill="none" stroke="${palette.crest}" stroke-width="3"/>`,iron:`<path d="M31 48h38v17H31z" fill="${dark}" stroke="${metal}" stroke-width="3"/><path d="M38 53h24M38 60h24" stroke="${palette.crest}" stroke-width="3"/>`,sylvan:`<path d="M50 68C22 59 31 37 50 39c19-2 28 20 0 29z" fill="${dark}" stroke="${palette.crest}" stroke-width="3"/><path d="M50 66V43m0 13-9-7m9 12 9-8" stroke="${palette.crest}" stroke-width="2" fill="none"/>`,ash:`<path d="M50 70C27 57 45 48 43 34c16 11 7 18 17 22 2-9 8-13 8-13 9 20-2 29-18 27z" fill="${dark}" stroke="${palette.crest}" stroke-width="3"/>`,storm:`<path d="m55 37-17 22h12l-5 19 20-27H53z" fill="${palette.crest}" stroke="${metal}" stroke-width="2" stroke-linejoin="round"/>`}[piece.faction]||"";
 if(enemy&&!piece.revealed)return `<svg class="miniature" viewBox="0 0 100 100" aria-hidden="true"><ellipse cx="50" cy="91" rx="29" ry="6" fill="#05080d" opacity=".45"/><path d="M50 8 78 20v28c0 20-12 34-28 43C34 82 22 68 22 48V20z" fill="${dark}" stroke="${metal}" stroke-width="3"/><path d="M50 16 69 24v23c0 14-8 25-19 32-11-7-19-18-19-32V24z" fill="${mid}"/><path d="m50 28 5 12 13 1-10 8 3 13-11-7-11 7 3-13-10-8 13-1z" fill="${palette.crest}" stroke="${light}" stroke-width="2"/></svg>`;
 const type=piece.type;
 if(type==="bomb")return `<svg class="miniature" viewBox="0 0 100 100" aria-hidden="true"><ellipse cx="50" cy="90" rx="27" ry="6" fill="#05080d" opacity=".45"/><g fill="${dark}" stroke="${metal}" stroke-width="3"><path d="M50 12 57 27 73 20 69 37 87 43 73 54 82 70 63 69 57 88 45 73 29 84 31 64 12 58 27 46 17 30 37 32z"/><circle cx="50" cy="51" r="22" fill="${mid}"/></g><path d="M50 14c0-7 8-9 13-7" fill="none" stroke="#e8d6b4" stroke-width="5" stroke-linecap="round"/><path d="m64 6 5-4" stroke="#f4c76b" stroke-width="3"/></svg>`;
 if(type==="flag")return `<svg class="miniature" viewBox="0 0 100 100" aria-hidden="true"><ellipse cx="50" cy="91" rx="27" ry="6" fill="#05080d" opacity=".45"/><path d="M50 16v70" stroke="${metal}" stroke-width="5" stroke-linecap="round"/><path d="M53 18 84 27 65 43 53 39z" fill="${light}" stroke="${metal}" stroke-width="2"/><path d="M53 18 84 27 65 43 53 39z" fill="${mid}" opacity=".6"/><path d="m64 25 3 6 6 1-5 4 1 6-5-3-5 3 1-6-5-4 6-1z" fill="${metal}"/><path d="M34 87h32" stroke="${metal}" stroke-width="5" stroke-linecap="round"/></svg>`;
 const head=type==="marshal"?`<path d="m35 24 4-12 10 8 10-8 6 12-5 8H40z" fill="${metal}" stroke="#fff0bd" stroke-width="2"/>`:type==="general"?`<path d="M47 18q-8-17 9-16 4 10-2 18" fill="${metal}" stroke="#fff0bd" stroke-width="2"/>`:type==="scout"?`<path d="M29 30q4-26 22-26t22 26l-9-5H38z" fill="${dark}" stroke="${metal}" stroke-width="2"/>`:type==="spy"?`<path d="M29 30q3-25 21-25t21 25l-8-5H37z" fill="${dark}" stroke="${metal}" stroke-width="2"/>`:`<path d="m31 27 5-15h28l5 15-8 7H39z" fill="${mid}" stroke="${metal}" stroke-width="2"/>`;
 const factionHead={
 aurelia:`<path d="M34 25 29 10l15 8 6-12 6 12 15-8-5 17" fill="${metal}" stroke="${palette.crest}" stroke-width="3" stroke-linejoin="round"/>`,
 shadow:`<path d="M35 26Q26 5 50 7Q74 5 65 26L58 22 50 28 42 22z" fill="${dark}" stroke="${palette.crest}" stroke-width="3"/><path d="m35 16-10-8 4 18m36-10 10-8-4 18" fill="none" stroke="${palette.crest}" stroke-width="3"/>`,
 iron:`<path d="M32 27 34 10 66 10 68 27 60 35H40z" fill="${dark}" stroke="${metal}" stroke-width="3"/><path d="M50 11v21M35 22h30" stroke="${palette.crest}" stroke-width="3"/>`,
 sylvan:`<path d="M38 22Q23 4 34 3Q45 9 49 20Q55 5 68 3Q76 18 61 26" fill="${dark}" stroke="${palette.crest}" stroke-width="3"/><path d="M49 19v-9" stroke="${palette.crest}" stroke-width="2"/>`,
 ash:`<path d="M37 24Q25 4 43 8Q48-2 54 8Q73 3 63 25" fill="${dark}" stroke="${palette.crest}" stroke-width="3"/><path d="M45 17q5-13 10 0" fill="none" stroke="${palette.crest}" stroke-width="3"/>`,
 storm:`<path d="M34 25 23 7 43 16 50 3 57 16 77 7 66 25" fill="${dark}" stroke="${palette.crest}" stroke-width="3" stroke-linejoin="round"/>`
 }[piece.faction]||"";
 const armorOverlay={
 aurelia:`<path d="M39 47 50 53 61 47 66 62 50 72 34 62z" fill="${light}" stroke="${palette.crest}" stroke-width="2"/><path d="M50 54v15" stroke="${mid}" stroke-width="2"/>`,
 shadow:`<path d="M39 43 50 51 61 43 70 64 50 76 30 64z" fill="${dark}" stroke="${palette.crest}" stroke-width="2"/><path d="m39 49-8 12m30-12 8 12" stroke="${palette.crest}" stroke-width="3"/>`,
 iron:`<path d="M37 43h26l8 20-21 12-21-12z" fill="${dark}" stroke="${metal}" stroke-width="3"/><path d="M50 45v28M34 59h32" stroke="${palette.crest}" stroke-width="3"/>`,
 sylvan:`<path d="M50 72Q23 59 37 43Q47 47 50 56Q54 43 65 43Q78 59 50 72z" fill="${dark}" stroke="${palette.crest}" stroke-width="2"/><path d="M50 68V48" stroke="${palette.crest}" stroke-width="2"/>`,
 ash:`<path d="M50 73Q28 59 42 47Q40 60 51 55Q58 48 56 41Q77 61 50 73z" fill="${dark}" stroke="${palette.crest}" stroke-width="2"/>`,
 storm:`<path d="m50 45 8 13-8 15-8-15z" fill="${dark}" stroke="${palette.crest}" stroke-width="2"/><path d="M50 48v22" stroke="${metal}" stroke-width="2"/>`
 }[piece.faction]||"";
 const rankHead={
 marshal:`<path d="M31 25 27 7 42 17 50 4 58 17 73 7 69 25z" fill="${metal}" stroke="#fff0bd" stroke-width="3" stroke-linejoin="round"/><circle cx="50" cy="9" r="3" fill="#fff4c4"/>`,
 general:`<path d="M31 24Q23 2 43 12Q50-1 57 12Q77 2 69 24" fill="${mid}" stroke="${metal}" stroke-width="3"/><path d="M50 12v-8" stroke="#fff0bd" stroke-width="3"/>`,
 colonel:`<path d="M34 24V9l9 8 7-12 7 12 9-8v15" fill="${dark}" stroke="${metal}" stroke-width="3"/>`,
 captain:`<path d="M32 24Q29 6 50 8Q71 6 68 24L60 19 50 23 40 19z" fill="${mid}" stroke="${metal}" stroke-width="3"/>`,
 lieutenant:`<path d="M33 25 37 8 50 15 63 8 67 25" fill="${dark}" stroke="${metal}" stroke-width="3"/>`,
 sergeant:`<path d="M31 24 36 9 50 17 64 9 69 24" fill="${mid}" stroke="${metal}" stroke-width="2"/>`,
 miner:`<path d="M30 27 35 9 65 9 70 27 62 33H38z" fill="${dark}" stroke="${metal}" stroke-width="3"/><path d="M37 16h26" stroke="${palette.crest}" stroke-width="3"/>`,
 scout:`<path d="M26 30Q27 4 50 5Q73 4 74 30L62 24H38z" fill="${dark}" stroke="${metal}" stroke-width="2"/>`,
 spy:`<path d="M27 29Q31 7 50 7Q69 7 73 29L61 23H39z" fill="${dark}" stroke="${palette.crest}" stroke-width="2"/><path d="M37 30h26" stroke="${palette.crest}" stroke-width="3"/>`
 }[type]||"";
 const rankInsignia={
 marshal:`<path d="m50 42 5 9 10 1-8 7 2 10-9-5-9 5 2-10-8-7 10-1z" fill="#fff0b8" stroke="${metal}" stroke-width="2"/>`,
 general:`<path d="M50 45v22m-9-17 9 5 9-5" stroke="${palette.crest}" stroke-width="4" fill="none" stroke-linecap="round"/>`,
 colonel:`<path d="M39 49h22M39 57h22M39 65h22" stroke="${metal}" stroke-width="3" stroke-linecap="round"/>`,
 captain:`<circle cx="50" cy="57" r="8" fill="${palette.crest}" stroke="${metal}" stroke-width="2"/>`,
 lieutenant:`<path d="m50 48 9 9-9 9-9-9z" fill="${palette.crest}" stroke="${metal}" stroke-width="2"/>`,
 sergeant:`<path d="M39 53h22M39 62h22" stroke="${palette.crest}" stroke-width="3"/>`,
 miner:`<path d="M39 56h22M50 46v20" stroke="${metal}" stroke-width="3"/>`,
 scout:`<path d="m40 57 10-10 10 10-10 10z" fill="${dark}" stroke="${palette.crest}" stroke-width="2"/>`,
 spy:`<path d="M41 55q9-8 18 0v7q-9 8-18 0z" fill="${dark}" stroke="${palette.crest}" stroke-width="2"/><path d="M44 58h4m4 0h4" stroke="${metal}" stroke-width="2"/>`
 }[type]||"";
 const weapon={
 marshal:`<path d="M78 26 86 69M75 31l13-5-5 13-10-2" stroke="${metal}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><path d="M78 35 88 30" stroke="${palette.crest}" stroke-width="2"/><path d="M72 70h18" stroke="${metal}" stroke-width="5" stroke-linecap="round"/>`,
 general:`<path d="M81 28 83 77" stroke="${metal}" stroke-width="4" stroke-linecap="round"/><path d="m74 39 7-13 7 13z" fill="${palette.crest}" stroke="${metal}" stroke-width="2"/><path d="M75 77h16" stroke="${metal}" stroke-width="4"/>`,
 colonel:`<path d="M82 25v53" stroke="${metal}" stroke-width="4"/><path d="m75 34 7-12 7 12z" fill="${palette.crest}" stroke="${metal}" stroke-width="2"/><path d="M77 77h10" stroke="${metal}" stroke-width="4"/>`,
 captain:`<path d="M80 42v35" stroke="${metal}" stroke-width="5"/><path d="M68 42h24l-5-12H73z" fill="${palette.crest}" stroke="${metal}" stroke-width="2"/><path d="M75 77h10" stroke="${metal}" stroke-width="4"/>`,
 lieutenant:`<path d="M80 31 84 76" stroke="${metal}" stroke-width="4" stroke-linecap="round"/><path d="m73 43 8-15 8 15-8 5z" fill="${palette.crest}" stroke="${metal}" stroke-width="2"/><path d="M76 76h14" stroke="${metal}" stroke-width="4"/>`,
 sergeant:`<path d="M81 41v36" stroke="${metal}" stroke-width="5"/><path d="M70 39h22v9H70z" fill="${palette.crest}" stroke="${metal}" stroke-width="2"/><path d="M76 77h10" stroke="${metal}" stroke-width="4"/>`,
 miner:`<path d="M78 34 87 75" stroke="${metal}" stroke-width="5" stroke-linecap="round"/><path d="m69 38 20-8-2 13-15 1z" fill="${palette.crest}" stroke="${metal}" stroke-width="2" stroke-linejoin="round"/>`,
 scout:`<path d="M75 34q17 17 0 34" fill="none" stroke="${metal}" stroke-width="4"/><path d="M75 34 89 77" stroke="${palette.crest}" stroke-width="2"/><path d="M73 34 89 77" stroke="${metal}" stroke-width="1.5"/>`,
 spy:`<path d="M77 42 87 73" stroke="${metal}" stroke-width="3" stroke-linecap="round"/><path d="m73 43 7-9 8 7-6 5z" fill="${palette.crest}" stroke="${metal}" stroke-width="2"/>`
 }[type]||`<path d="M78 35 84 76" stroke="${metal}" stroke-width="4" stroke-linecap="round"/><path d="M78 42h9" stroke="${palette.crest}" stroke-width="3"/>`;
 const factionMantle={
 aurelia:`<path d="M35 49 27 58 30 82 50 88 70 82 73 58 65 49 61 65 50 73 39 65z" fill="${palette.crest}" opacity=".78" stroke="${metal}" stroke-width="2"/><path d="M50 73v12" stroke="${mid}" stroke-width="2"/>`,
 shadow:`<path d="M36 48 25 58 29 84 50 91 71 84 75 58 64 48 61 65 50 76 39 65z" fill="${dark}" stroke="${palette.crest}" stroke-width="2"/><path d="m31 60 8 8m30-8-8 8" stroke="${palette.crest}" stroke-width="2"/>`,
 iron:`<path d="M34 50 26 59 31 83 50 88 69 83 74 59 66 50 61 67 50 73 39 67z" fill="${dark}" stroke="${metal}" stroke-width="3"/><path d="M34 60h32M50 73v13" stroke="${palette.crest}" stroke-width="2"/>`,
 sylvan:`<path d="M36 48Q22 59 30 82Q39 86 50 88Q61 86 70 82Q78 59 64 48L59 67 50 77 41 67z" fill="${dark}" stroke="${palette.crest}" stroke-width="2"/><path d="M50 78Q35 69 39 57Q48 61 50 69Q55 59 63 57Q67 70 50 78z" fill="${mid}" stroke="${palette.crest}" stroke-width="1.5"/>`,
 ash:`<path d="M36 48 25 58 31 84 50 90 69 84 75 58 64 48 60 67 50 77 40 67z" fill="${dark}" stroke="${palette.crest}" stroke-width="2"/><path d="M50 78Q39 67 48 57Q47 68 56 64Q62 58 58 53Q72 72 50 78z" fill="${mid}" stroke="${palette.crest}" stroke-width="1.5"/>`,
 storm:`<path d="M35 49 25 59 30 83 50 89 70 83 75 59 65 49 60 67 50 75 40 67z" fill="${dark}" stroke="${palette.crest}" stroke-width="2"/><path d="m50 75 7 6-7 5-7-5z" fill="${palette.crest}" stroke="${metal}" stroke-width="1.5"/>`
 }[piece.faction]||"";
 const rankGear=type==="scout"?`<path d="M27 39q-12 17-5 36l7 4q-5-22 8-34z" fill="${dark}" stroke="${metal}" stroke-width="2"/><path d="M23 71h10" stroke="${palette.crest}" stroke-width="2"/>`:type==="miner"?`<path d="M66 57 78 62 75 79 64 75z" fill="${dark}" stroke="${metal}" stroke-width="2"/><path d="M67 63h8m-9 6h8" stroke="${palette.crest}" stroke-width="2"/>`:type==="marshal"||type==="general"?`<path d="M35 48 24 54 28 65 39 59M65 48 76 54 72 65 61 59" fill="${metal}" stroke="${palette.crest}" stroke-width="2"/><circle cx="29" cy="57" r="3" fill="${palette.crest}"/><circle cx="71" cy="57" r="3" fill="${palette.crest}"/>`:"";
 const equipment=type==="scout"?`<path d="M22 55q-13 12 0 24" fill="none" stroke="${palette.crest}" stroke-width="3"/><path d="M20 55v24" stroke="${metal}" stroke-width="2"/>`:type==="miner"?`<path d="M22 57h10v16H22z" fill="${dark}" stroke="${metal}" stroke-width="2"/><path d="M24 60h6" stroke="${palette.crest}" stroke-width="2"/>`:type==="marshal"||type==="general"?`<path d="M22 48q-12 10 0 26l12-4V52z" fill="${dark}" stroke="${metal}" stroke-width="2"/><path d="m24 55 7 12" stroke="${palette.crest}" stroke-width="2"/>`:"";
 return `<svg class="miniature faction-${piece.faction}" viewBox="0 0 100 100" aria-hidden="true"><ellipse cx="50" cy="91" rx="29" ry="6" fill="#05080d" opacity=".45"/><g class="faction-mantle">${factionMantle}</g><path d="M24 83q3-19 12-26h28q10 8 13 26l-9 6H33z" fill="${dark}" stroke="${metal}" stroke-width="2"/><path d="M35 57 25 67l-7-6 8-16 13-3M65 57l10 10 8-6-8-17-13-3" fill="${mid}" stroke="${metal}" stroke-width="2"/><path d="M39 38q11-8 22 0l8 22-19 12-19-12z" fill="${mid}" stroke="${metal}" stroke-width="2"/><path d="m39 48 11 7 11-7M50 56v15" stroke="${metal}" stroke-width="2" fill="none"/><g class="faction-armor">${armorOverlay}</g>${rankGear}<circle cx="50" cy="29" r="15" fill="${light}" stroke="${metal}" stroke-width="3"/><path d="M37 29q13-11 26 0" stroke="${dark}" stroke-width="4" fill="none"/>${head}${factionHead}${rankHead}<path d="M42 34h5m7 0h5" stroke="${dark}" stroke-width="2" stroke-linecap="round"/>${weapon}${equipment}${heraldry}${rankInsignia}<path d="M30 82h40" stroke="${metal}" stroke-width="3" stroke-linecap="round"/></svg>`;
}

function setCombatRuleStatus(){
 const el=document.querySelector("#combatRuleStatus");
 if(el)el.textContent=combatRevealMode==="classic"?"Klassischer Modus":"Daueraufdeckregel";
}
function setMessage(t){messageEl.textContent=t;}
function showSelectedStrength(piece){if(!strengthEl)return;const info=pieceInfo(piece);strengthEl.textContent=info.rank>0?`Stärke ${info.rank}`:piece.type==="bomb"?"Sonderfigur · unbeweglich":"Sonderfigur · unbeweglich";}
function setTurn(t){turn=t;turnEl.textContent=t==="blue"?"Dein Zug":"CPU denkt nach …";turnEl.classList.toggle("cpu",t==="red");}
function render(){
 boardEl.innerHTML="";
 const size=modeConfig(currentMode).size,lakes=lakeSet(currentMode);boardEl.style.gridTemplateColumns=`repeat(${size},minmax(0,1fr))`;boardEl.style.gridTemplateRows=`repeat(${size},minmax(0,1fr))`;
 for(let i=0;i<board.length;i++){
  const cell=document.createElement("div");cell.className="cell";cell.dataset.index=i;
  if(lakes.has(i))cell.classList.add("lake");
  if(i===selected)cell.classList.add("selected");
  if(pendingAnimation?.from===i)cell.classList.add("move-origin");
  if(pendingAnimation?.to===i){
   cell.classList.add(pendingAnimation.kind==="combat"?"combat-impact":"move-arrival");
   if(pendingAnimation.kind==="combat")cell.classList.add("combat-"+(pendingAnimation.outcome||"hit"));
  }
  if(validMoves.includes(i))cell.classList.add("valid");
  const p=board[i];
  if(p){
   const info=pieceInfo(p),el=document.createElement("div");
   const movingClass=pendingAnimation?.to===i&&pendingAnimation.kind==="move"?(p.type==="scout"?" move-scout":["marshal","general","colonel"].includes(p.type)?" move-commander":p.type==="miner"?" move-miner":" move-standard"):"";
   const combatClass=pendingAnimation?.to===i&&pendingAnimation.kind==="combat"?(pendingAnimation.winner===p.side?" combat-winner":" combat-survivor"):"";
   const isAnimatingHere=pendingAnimation&&(pendingAnimation.from===i||pendingAnimation.to===i);
   const idleClass=i!==selected&&!isAnimatingHere?" idle-piece":"";
   el.className="piece faction-"+(p.faction||"aurelia")+" "+p.side+(p.side==="red"&&!p.revealed?" hidden-rank":"")+(pendingAnimation?.to===i&&pendingAnimation.kind==="combat"&&pendingAnimation.winner===p.side?" attack-piece":"")+(pendingAnimation?.to===i&&pendingAnimation.kind==="move"?" moving-piece":"")+movingClass+combatClass+idleClass;
   el.setAttribute("aria-label",p.side==="red"&&!p.revealed?"Gegnerische Figur":info.name);
   el.innerHTML=pieceArt(p);
   if(p.side==="blue"||p.revealed){
    const rankMark=document.createElement("span");
    rankMark.className="piece-rank-badge";
    rankMark.textContent=info.rank>0?String(info.rank):p.type==="bomb"?"B":"F";
    rankMark.setAttribute("aria-label",info.rank>0?"Stärke "+info.rank:p.type==="bomb"?"Bombe":"Flagge");
    rankMark.title=info.rank>0?"Stärke "+info.rank:info.name;
    el.append(rankMark);
   }
   if(pendingAnimation?.to===i&&pendingAnimation.kind==="combat"&&pendingAnimation.revealType){
    const reveal=document.createElement("span");reveal.className="combat-reveal-badge";
    const revealInfo=RANKS[pendingAnimation.revealType];
    reveal.textContent=revealInfo?.rank>0?"STÄRKE "+revealInfo.rank:revealInfo?.name||"ENTHÜLLT";
    el.append(reveal);
   }
   cell.append(el);
  }
  boardEl.append(cell);
 }
 pendingAnimation=null;
}
function clearSelection(){selected=null;validMoves=[];dragFrom=null;if(strengthEl)strengthEl.textContent="";render();}
function choose(index){
 const p=board[index];if(!p||p.side!=="blue")return false;
 selected=index;validMoves=legalMoves(board,index,currentMode);render();setMessage(`Ausgewählt: ${pieceInfo(p).name}`);showSelectedStrength(p);return true;
}
function finishMove(from,to){
 if(from===null||!validMoves.includes(to)||busy){clearSelection();return;}
 const attacker=board[from],defender=board[to];markPlayerMove(attacker,from,to);if(defender)playerPatterns.attacks++;let animationKind="move",winner=null,combatOutcome=null;
 if(defender){
  defender.revealed=true;attacker.revealed=true;
  const outcome=resolveCombat(attacker,defender);combatOutcome=outcome.result;animationKind="combat";winner=outcome.result==="attacker"?"blue":outcome.result==="defender"?"red":null;
  if(outcome.result==="attacker")attacker.revealed=combatRevealMode==="daueraufdeckregel";
  else if(outcome.result==="defender")defender.revealed=combatRevealMode==="daueraufdeckregel";
  const survivor=outcome.result==="attacker"?attacker:outcome.result==="defender"?defender:null;
  if(outcome.result==="attacker"){board[to]=attacker;board[from]=null;}
  else if(outcome.result==="defender"){board[to]=defender;board[from]=null;}
  else {board[to]=null;board[from]=null;}
  setMessage(outcome.message);
  if(defender.type==="flag"&&outcome.result==="attacker"){
   pendingAnimation={from,to,kind:animationKind,winner,outcome:outcome.result,revealType:survivor?.type||null};
   selected=null;validMoves=[];dragFrom=null;if(strengthEl)strengthEl.textContent="";
   render();busy=true;playSound("combat");window.setTimeout(()=>endGame("blue"),850);return;
  }
 }else{board[to]=attacker;board[from]=null;setMessage("Zug ausgeführt.");}
 const survivor=animationKind==="combat"?(winner==="blue"?attacker:winner==="red"?defender:null):null;
 pendingAnimation={from,to,kind:animationKind,winner,outcome:combatOutcome,revealType:survivor?.type||null};
 selected=null;validMoves=[];dragFrom=null;if(strengthEl)strengthEl.textContent="";
 playSound(animationKind==="combat"?"combat":"move");
 if(!sideHasMoves(board,"red",currentMode)){render();endGame("blue");return;}
 setTurn("red");busy=true;render();saveGameState();
 window.setTimeout(cpuMove,cpuDelay());
}
let lastCpuMove=null;
function rememberPlayerPiece(piece){
 if(!piece||piece.side!=="blue")return;
 cpuIntel.known[piece.id]={type:piece.type,seen:true};
}
function markPlayerMove(piece,from,to){
 if(!piece||piece.side!=="blue")return;
 if(!cpuIntel.moved.includes(piece.id))cpuIntel.moved.push(piece.id);
 const n=modeConfig(currentMode).size;
 playerPatterns.scouts+=piece.type==="scout"?1:0;
 playerPatterns.miners+=piece.type==="miner"?1:0;
 if(Number.isInteger(from)&&Number.isInteger(to)){
  const fr=Math.floor(from/n),tr=Math.floor(to/n),fc=from%n,tc=to%n;
  if(tr<fr)playerPatterns.advances++;
  if(Math.abs(tc-(n-1)/2)<Math.abs(fc-(n-1)/2))playerPatterns.center++;
 }
}
function remainingEnemyPool(){
 const counts={...modeConfig(currentMode).counts};
 for(const report of Object.values(cpuIntel.known))if(counts[report.type]>0)counts[report.type]--;
 return Object.entries(counts).filter(([,count])=>count>0);
}
function expectedAttackScore(attacker,defender){
 const known=cpuIntel.known[defender.id]?.type;
 if(known){
  const outcome=resolveCombat(attacker,{...defender,type:known});
  if(known==="flag")return 100000;
  if(outcome.result==="attacker")return 135+(RANKS[known]?.rank||0)*8;
  if(outcome.result==="both")return -45-(RANKS[attacker.type]?.rank||0)*5;
  return -175-(RANKS[attacker.type]?.rank||0)*10;
 }
 const pool=remainingEnemyPool().filter(([type])=>!cpuIntel.moved.includes(defender.id)||!["bomb","flag"].includes(type));
 const total=pool.reduce((sum,[,count])=>sum+count,0)||1;
 let expected=0;
 for(const [type,count] of pool){
  const outcome=resolveCombat(attacker,{...defender,type});
  let value=type==="flag"?210:outcome.result==="attacker"?105+(RANKS[type]?.rank||0)*7:outcome.result==="both"?-35-(RANKS[attacker.type]?.rank||0)*4:-145-(RANKS[attacker.type]?.rank||0)*8;
  if(type==="bomb"&&attacker.type==="miner")value+=35;
  expected+=value*count/total;
 }
 return expected;
}
function cpuPersonality(){
 const aggressive=playerPatterns.advances+playerPatterns.attacks*2;
 const cautious=playerPatterns.miners+playerPatterns.center;
 if(aggressive>cautious+2)return "defensive";
 if(cautious>aggressive+2)return "aggressive";
 return "balanced";
}
function cpuMoveScore(from,to){
 const attacker=board[from],defender=board[to],n=modeConfig(currentMode).size,style=cpuPersonality();
 let score=Math.random()*1.5;
 if(defender)return expectedAttackScore(attacker,defender);
 const fromRow=Math.floor(from/n),toRow=Math.floor(to/n),fromCol=from%n,toCol=to%n;
 const centre=(n-1)/2;
 score+=(toRow-fromRow)*3.4;
 score+=(Math.abs(fromCol-centre)-Math.abs(toCol-centre))*1.35;
 const simulated=board.slice();simulated[to]=attacker;simulated[from]=null;
 const mobility=legalMoves(simulated,to,currentMode).length;
 score+=Math.min(mobility,5)*1.8;
 // Scouts erkunden bevorzugt unbekannte Frontbereiche und bleiben beweglich.
 if(attacker.type==="scout"){
  const unknown=board.reduce((sum,p,i)=>sum+(p?.side==="blue"&&!cpuIntel.known[p.id]?1/(1+Math.abs(Math.floor(i/n)-toRow)+Math.abs(i%n-toCol)):0),0);
  score+=Math.min(unknown*2.4,13)+mobility*1.4;
 }
 // Miner rücken vorsichtig an unbewegte, unbekannte Figuren heran: dort sind Bomben wahrscheinlicher.
 if(attacker.type==="miner"){
  for(let i=0;i<board.length;i++){
   const p=board[i];if(!p||p.side!=="blue"||cpuIntel.known[p.id]||cpuIntel.moved.includes(p.id))continue;
   const d=Math.abs(Math.floor(i/n)-toRow)+Math.abs(i%n-toCol);
   if(d<=2)score+=(3-d)*4.5;
  }
 }
 // Nur tatsächlich aufgedeckte gegnerische Ränge gelten als sichere Jagdziele.
 for(let i=0;i<board.length;i++){
  const enemy=board[i];if(!enemy||enemy.side!=="blue"||!cpuIntel.known[enemy.id])continue;
  const knownType=cpuIntel.known[enemy.id].type,result=resolveCombat(attacker,{...enemy,type:knownType});
  if(result.result==="attacker"){
   const distance=Math.abs(toRow-Math.floor(i/n))+Math.abs(toCol-i%n);
   score+=Math.max(0,18-distance*3)+(RANKS[knownType]?.rank||0)*1.8;
  }
 }
 const flagIndex=board.findIndex(p=>p?.side==="red"&&p.type==="flag");
 if(flagIndex>=0){
  const fr=Math.floor(flagIndex/n),fc=flagIndex%n;
  const before=Math.abs(fromRow-fr)+Math.abs(fromCol-fc),after=Math.abs(toRow-fr)+Math.abs(toCol-fc);
  const nearbyThreat=board.some((p,i)=>p?.side==="blue"&&Math.abs(Math.floor(i/n)-fr)+Math.abs(i%n-fc)<=3);
  if(nearbyThreat&&before<=4&&after>before&&["marshal","general","colonel","major","captain","lieutenant","sergeant","miner"].includes(attacker.type))score-=18+(before<=2?15:0);
  if(before<=3&&after<before)score+=nearbyThreat?12:3;
 }
 // Taktischer Stil: gegen aggressive Vorstöße kompakter verteidigen, gegen passive Gegner Druck aufbauen.
 if(style==="defensive"){
  const blueNear=board.some((p,i)=>p?.side==="blue"&&Math.abs(Math.floor(i/n)-toRow)+Math.abs(i%n-toCol)<=2);
  if(blueNear)score+=attacker.type==="miner"?5:2;
  if(attacker.type==="marshal"||attacker.type==="general")score-=7;
 }else if(style==="aggressive"){
  score+=(toRow-fromRow)*1.8;
  if(attacker.type==="scout"||attacker.type==="miner")score+=2;
 }else if(attacker.type==="miner"||attacker.type==="scout")score+=1.5;
 if(lastCpuMove&&lastCpuMove.from===to&&lastCpuMove.to===from)score-=24;
 if(["marshal","general"].includes(attacker.type))score-=3;
 return score;
}
function expertThreatPenalty(move){
 const simulated=board.slice(),attacker=simulated[move.from],defender=simulated[move.to];
 if(defender){
  const known=cpuIntel.known[defender.id]?.type;
  if(!known)return 0;
  const outcome=resolveCombat(attacker,{...defender,type:known});
  if(outcome.result==="attacker"){simulated[move.to]=attacker;simulated[move.from]=null;}
  else if(outcome.result==="defender"){simulated[move.from]=null;}
  else{simulated[move.from]=null;simulated[move.to]=null;}
 }else{simulated[move.to]=attacker;simulated[move.from]=null;}
 let penalty=0;
 for(let i=0;i<simulated.length;i++){
  const hunter=simulated[i];if(!hunter||hunter.side!=="blue")continue;
  for(const targetIndex of legalMoves(simulated,i,currentMode)){
   const target=simulated[targetIndex];if(!target||target.side!=="red")continue;
   const outcome=resolveCombat(hunter,target);
   if(outcome.result==="attacker"){
    const rank=RANKS[target.type]?.rank||0;
    penalty+=12+rank*8+(["marshal","general"].includes(target.type)?35:0);
   }else if(outcome.result==="both")penalty+=8;
  }
 }
 return penalty;
}
function expertLookahead(move){
 // Zweite Ebene: Nach jedem Kandidatenzug wird die gefährlichste legale Antwort gesucht.
 const simulated=board.slice(),attacker=simulated[move.from],defender=simulated[move.to];
 if(defender){
  const known=cpuIntel.known[defender.id]?.type;
  if(!known)return expertThreatPenalty(move);
  const result=resolveCombat(attacker,{...defender,type:known});
  if(result.result==="attacker"){simulated[move.to]=attacker;simulated[move.from]=null;}
  else if(result.result==="defender")simulated[move.from]=null;
  else{simulated[move.from]=null;simulated[move.to]=null;}
 }else{simulated[move.to]=attacker;simulated[move.from]=null;}
 let worstReply=0;
 for(let i=0;i<simulated.length;i++){
  const p=simulated[i];if(!p||p.side!=="blue")continue;
  for(const target of legalMoves(simulated,i,currentMode)){
   const victim=simulated[target];if(!victim||victim.side!=="red")continue;
   const outcome=resolveCombat(p,victim);
   const value=outcome.result==="attacker"?24+(RANKS[victim.type]?.rank||0)*9+(victim.type==="flag"?500:0):outcome.result==="both"?16:0;
   worstReply=Math.max(worstReply,value);
  }
 }
 return worstReply;
}
function chooseCpuMove(options){
 const ranked=options.map(move=>{
  const base=cpuMoveScore(move.from,move.to);
  const expertRisk=cpuDifficulty==="expert"?(expertThreatPenalty(move)*.8+expertLookahead(move)*1.15):0;
  return {...move,score:base-expertRisk};
 }).sort((a,b)=>b.score-a.score);
 if(cpuDifficulty==="easy"){
  const pool=ranked.slice(0,Math.max(1,Math.ceil(ranked.length*.55)));
  return pool[Math.floor(Math.random()*pool.length)];
 }
 if(cpuDifficulty==="normal"){
  const top=ranked.slice(0,Math.min(3,ranked.length));
  return top[Math.floor(Math.random()*top.length)];
 }
 if(cpuDifficulty==="hard"){
  // Schwer priorisiert Angriff und Raumgewinn, berücksichtigt aber unmittelbare Risiken.
  return ranked[0];
 }
 // Experte bewertet die gefährlichste Antwort des Spielers zusätzlich eine Ebene voraus.
 return ranked[0];
}
function cpuMove(){
 const options=[];
 for(let i=0;i<board.length;i++){const p=board[i];if(p?.side==="red")for(const to of legalMoves(board,i,currentMode))options.push({from:i,to});}
 if(!options.length){endGame("blue");return;}
 const move=chooseCpuMove(options),attacker=board[move.from],defender=board[move.to];
 lastCpuMove={from:move.from,to:move.to};
 let animationKind="move",winner=null,combatOutcome=null;
 if(defender){
  rememberPlayerPiece(defender);
  defender.revealed=true;attacker.revealed=true;
  const result=resolveCombat(attacker,defender);combatOutcome=result.result;animationKind="combat";winner=result.result==="attacker"?"red":result.result==="defender"?"blue":null;
  if(result.result==="attacker")attacker.revealed=combatRevealMode==="daueraufdeckregel";
  else if(result.result==="defender")defender.revealed=combatRevealMode==="daueraufdeckregel";
  const survivor=result.result==="attacker"?attacker:result.result==="defender"?defender:null;
  if(result.result==="attacker"){board[move.to]=attacker;board[move.from]=null;}
  else if(result.result==="defender"){board[move.to]=defender;board[move.from]=null;}
  else{board[move.to]=null;board[move.from]=null;}
  setMessage(result.message);
  if(defender.type==="flag"&&result.result==="attacker"){
   pendingAnimation={from:move.from,to:move.to,kind:animationKind,winner,outcome:result.result,revealType:survivor?.type||null};
   busy=false;render();window.setTimeout(()=>endGame("red"),850);return;
  }
 }else{board[move.to]=attacker;board[move.from]=null;setMessage("Der CPU hat seinen Zug ausgeführt.");}
 const survivor=animationKind==="combat"?(winner==="red"?attacker:winner==="blue"?defender:null):null;
 pendingAnimation={from:move.from,to:move.to,kind:animationKind,winner,outcome:combatOutcome,revealType:survivor?.type||null};
 playSound(animationKind==="combat"?"combat":"move");
 busy=false;setTurn("blue");render();saveGameState();
 if(!sideHasMoves(board,"blue",currentMode))endGame("red");
}
function endGame(winner){
 playSound("win");
 busy=true;try{localStorage.removeItem(GAME_SAVE_KEY);}catch{}hasSavedGame=false;updateResumeButton();setTurn("blue");turnEl.textContent=winner==="blue"?"Sieg!":"Niederlage";
 setMessage(winner==="blue"?"Du hast gewonnen! Die gegnerische Flagge ist gefallen.":"Du hast verloren. Deine Flagge wurde erobert.");
 const banner=document.createElement("div");banner.className="result-banner";banner.innerHTML=`<div class="result-card"><div class="eyebrow">DIE SCHLACHT IST ENTSCHIEDEN</div><h2>${winner==="blue"?"SIEG":"NIEDERLAGE"}</h2><p>${winner==="blue"?"Deine Armee triumphiert.":"Deine Armee wurde besiegt."}</p><button class="gold-button" id="resultNew">Neue Partie</button></div>`;
 document.body.append(banner);banner.querySelector("#resultNew").addEventListener("click",()=>{banner.remove();openSetup();});
}
function showGameScreen(){document.querySelector("#homeScreen").hidden=true;document.querySelector("#gameScreen").hidden=false;}
function showHomeScreen(){saveGameState();document.querySelector("#gameScreen").hidden=true;document.querySelector("#homeScreen").hidden=false;updateResumeButton();}
function saveGameState(){if(!board||!board.some(Boolean))return;try{const state={version:1,currentMode,combatRevealMode,board,turn,playerFaction,cpuFaction,cpuDifficulty,cpuIntel,playerPatterns,message:messageEl.textContent};localStorage.setItem(GAME_SAVE_KEY,JSON.stringify(state));hasSavedGame=true;updateResumeButton();}catch(error){console.warn("Spielstand konnte nicht gespeichert werden.",error);}}
function updateResumeButton(){
 const card=document.querySelector("#savedGameCard"),btn=document.querySelector("#homeResumeBtn");
 if(card)card.hidden=!hasSavedGame;
 if(btn)btn.hidden=!hasSavedGame;
 if(!hasSavedGame)return;
 const faction=FACTIONS[playerFaction]||FACTIONS.aurelia,config=modeConfig(currentMode);
 const blueLeft=board.filter(p=>p?.side==="blue").length;
 const redLeft=board.filter(p=>p?.side==="red").length;
 document.querySelector("#savedFactionName").textContent=faction.name;
 document.querySelector("#savedModeName").textContent=config.label+" · "+config.size+" × "+config.size;
 document.querySelector("#savedTurnStatus").textContent=turn==="blue"?"Dein Zug":"CPU am Zug";
 document.querySelector("#savedTurnStatus").classList.toggle("cpu-turn",turn==="red");
 document.querySelector("#savedArmyInfo").textContent=blueLeft+" deiner "+config.count+" Figuren übrig · "+redLeft+" Gegner";
 document.querySelector("#savedDifficultyInfo").textContent="CPU: "+({easy:"Leicht",normal:"Normal",hard:"Schwer",expert:"Experte"}[cpuDifficulty]||"Normal");
 document.querySelector("#savedFactionMark").textContent=({aurelia:"✦",shadow:"☾",iron:"⚒",sylvan:"❧",ash:"♨",storm:"ϟ"})[playerFaction]||"⚔";
}
function loadGameState(){try{const raw=localStorage.getItem(GAME_SAVE_KEY);if(!raw)return false;const state=JSON.parse(raw);if(state?.version!==1||!MODES[state.currentMode]||!Array.isArray(state.board)||state.board.length!==modeConfig(state.currentMode).size**2||!state.board.every(p=>p===null||(p&&typeof p.type==="string"&&(p.side==="blue"||p.side==="red"))))return false;currentMode=state.currentMode;setMode(currentMode);combatRevealMode=state.combatRevealMode==="classic"?"classic":"daueraufdeckregel";setCombatRuleStatus();board=state.board;turn=state.turn==="red"?"red":"blue";playerFaction=FACTIONS[state.playerFaction]?state.playerFaction:"aurelia";cpuFaction=FACTIONS[state.cpuFaction]?state.cpuFaction:"shadow";cpuDifficulty=["easy","normal","hard","expert"].includes(state.cpuDifficulty)?state.cpuDifficulty:"normal";cpuIntel=state.cpuIntel&&typeof state.cpuIntel==="object"?{known:state.cpuIntel.known&&typeof state.cpuIntel.known==="object"?state.cpuIntel.known:{},moved:Array.isArray(state.cpuIntel.moved)?state.cpuIntel.moved:[]}: {known:{},moved:[]};playerPatterns={advances:0,attacks:0,scouts:0,miners:0,center:0,...(state.playerPatterns||{})};setMessage(state.message||"Spielstand geladen.");hasSavedGame=true;updateResumeButton();return true;}catch(error){console.warn("Gespeicherter Spielstand ist ungültig.",error);return false;}}
function resumeSavedGame(){if(!loadGameState())return;selected=null;validMoves=[];busy=turn==="red";showGameScreen();setTurn(turn);render();updateResumeButton();if(busy)window.setTimeout(cpuMove,500);}
function renderRulesRankList(){
 const list=document.querySelector("#rulesRankList");if(!list||list.dataset.ready==="true")return;
 list.innerHTML="";
 for(const [type,info] of Object.entries(RANKS)){
  const row=document.createElement("article");row.className="rules-rank-row";
  const visual=document.createElement("div");visual.className="rules-rank-visual";
  visual.innerHTML=pieceArt({side:"blue",faction:"aurelia",type,revealed:true});
  const details=document.createElement("div");details.className="rules-rank-details";
  const name=document.createElement("b");name.textContent=info.name;
  const strength=document.createElement("span");strength.className="rules-rank-strength";
  strength.textContent=info.rank>0?"Stärke "+info.rank:type==="bomb"?"Sonderfigur · unbeweglich":"Sonderfigur · unbeweglich";
  details.append(name,strength);row.append(visual,details);
  const badge=document.createElement("strong");badge.className="rules-rank-number";
  badge.textContent=info.rank>0?String(info.rank):type==="bomb"?"B":"F";row.append(badge);
  list.append(row);
 }
 list.dataset.ready="true";
}
function selectRulesTab(tab){
 document.querySelectorAll("[data-rules-tab]").forEach(button=>{
  const active=button.dataset.rulesTab===tab;button.classList.toggle("active",active);button.setAttribute("aria-selected",String(active));button.tabIndex=active?0:-1;
 });
 document.querySelectorAll("[data-rules-panel]").forEach(panel=>{
  const active=panel.dataset.rulesPanel===tab;panel.classList.toggle("active",active);panel.hidden=!active;
 });
}
function openHomeRules(){renderRulesRankList();selectRulesTab("basics");rulesModal.hidden=false;}
function openSettings(){applySettings();settingsModal.hidden=false;}
function openSetup(fromHome=false){setupFromHome=fromHome;setupModal.hidden=false;}
function closeSetup(){setupModal.hidden=true;if(setupFromHome){document.querySelector("#homeScreen").hidden=false;document.querySelector("#gameScreen").hidden=true;}setupFromHome=false;}
const SAVE_KEY=()=>currentMode==="classic"?"nfc-arcade-stratego-formations-v1":`nfc-arcade-stratego-formations-${currentMode}-v1`;
function readSavedFormations(){try{return JSON.parse(localStorage.getItem(SAVE_KEY())||"[]");}catch{return [];}}
function writeSavedFormations(items){try{localStorage.setItem(SAVE_KEY(),JSON.stringify(items));return true;}catch{return false;}}
function savedFormations(){const a=readSavedFormations();return Array.from({length:3},(_,i)=>a[i]||null);}
function updateSaveLabels(){savedFormations().forEach((s,i)=>{const el=document.querySelector("#saveStatus"+i);if(el)el.textContent=s?"Gespeichert":"Leer";});}
function resetManualPlacement(){manualSlots=Array(armyCount(currentMode)).fill(null);manualReserve={};for(const [type,count] of Object.entries(modeConfig(currentMode).counts))manualReserve[type]=count;manualSelectedType=null;manualMovingIndex=null;activeSaveSlot=0;renderManualSetup();}
function renderManualSetup(){
 const grid=document.querySelector("#manualBoard"),palette=document.querySelector("#manualPalette");grid.innerHTML="";palette.innerHTML="";
 const size=modeConfig(currentMode).size;grid.style.gridTemplateColumns=`repeat(${size},minmax(0,1fr))`;grid.style.aspectRatio=`${size}/${setupRows(currentMode)}`;
 for(let i=0;i<manualSlots.length;i++){const p=manualSlots[i],cell=document.createElement("button");cell.type="button";cell.className="manual-cell"+(p?" occupied":"")+(manualMovingIndex===i?" moving":"");
  cell.innerHTML=p?("<span class=\"manual-piece\">"+RANKS[p.type].sigil+"</span><small>"+RANKS[p.type].name+"</small>"):"<span class=\"empty-mark\">＋</span>";
  cell.addEventListener("click",()=>placeManualCell(i));grid.append(cell);}
 for(const [type,countAvailable] of Object.entries(modeConfig(currentMode).counts)){const info=RANKS[type],count=manualReserve[type]||0,btn=document.createElement("button");btn.type="button";btn.className="palette-piece"+(manualSelectedType===type?" active":"")+(count===0?" exhausted":"");btn.disabled=count===0;
  btn.innerHTML="<span>"+info.sigil+"</span><b>"+info.name+"</b><small>"+count+" übrig</small>";btn.addEventListener("click",()=>{manualSelectedType=type;manualMovingIndex=null;renderManualSetup();});palette.append(btn);}
 const placed=manualSlots.filter(Boolean).length;document.querySelector("#manualProgress").textContent=placed+" / "+armyCount(currentMode)+" platziert";
 document.querySelector("#manualSelected").textContent=manualMovingIndex!==null?"Figur zum Verschieben gewählt":manualSelectedType?RANKS[manualSelectedType].name+" ausgewählt":"Keine Figur ausgewählt";
 document.querySelector("#confirmManualSetup").disabled=placed!==armyCount(currentMode);updateSaveLabels();
}
function placeManualCell(index){
 if(manualMovingIndex!==null){if(manualMovingIndex===index){manualMovingIndex=null;renderManualSetup();return;}if(!manualSlots[index]){manualSlots[index]=manualSlots[manualMovingIndex];manualSlots[manualMovingIndex]=null;}manualMovingIndex=null;renderManualSetup();return;}
 if(manualSlots[index]){manualMovingIndex=index;manualSelectedType=null;renderManualSetup();return;}
 if(!manualSelectedType)return;manualSlots[index]={type:manualSelectedType};manualReserve[manualSelectedType]--;manualSelectedType=null;renderManualSetup();
}
function openManualSetup(){closeSetup();resetManualPlacement();manualSetupModal.hidden=false;}
function closeManualSetup(){manualSetupModal.hidden=true;}
function saveManualFormation(){const placed=manualSlots.filter(Boolean).length;if(placed!==armyCount(currentMode))return;const slots=savedFormations();const old=slots[activeSaveSlot];if(old&&!confirm("Diesen Speicherplatz zuerst leeren, bevor du ihn neu belegst."))return;if(old)return;slots[activeSaveSlot]={name:["Formation Alpha","Formation Beta","Formation Charlie"][activeSaveSlot],types:manualSlots.map(p=>p.type)};if(!writeSavedFormations(slots)){alert("Speichern ist in diesem Browser nicht verfügbar.");return;}updateSaveLabels();}
function loadManualFormation(index){const saved=savedFormations()[index];if(!saved)return;if(manualSlots.some(Boolean)&&!confirm("Die aktuelle Aufstellung durch diese Formation ersetzen?"))return;manualSlots=saved.types.map(type=>({type}));manualReserve={};for(const [type,count] of Object.entries(modeConfig(currentMode).counts))manualReserve[type]=count;manualSlots.forEach(p=>manualReserve[p.type]--);manualSelectedType=null;manualMovingIndex=null;activeSaveSlot=index;renderManualSetup();}
function clearManualFormation(){const slots=savedFormations();if(!slots[activeSaveSlot])return;if(!confirm("Diesen Speicherplatz wirklich leeren?"))return;slots[activeSaveSlot]=null;writeSavedFormations(slots);updateSaveLabels();}
function confirmManualPlacement(){if(manualSlots.some(p=>!p))return;cpuDifficulty=document.querySelector("#cpuDifficulty").value;combatRevealMode=document.querySelector("#combatRevealMode").value==="classic"?"classic":"daueraufdeckregel";setCombatRuleStatus();lastCpuMove=null;cpuIntel={known:{},moved:[]};playerPatterns={advances:0,attacks:0,scouts:0,miners:0,center:0};const player=manualSlots.map((p,i)=>({...p,id:"blue-manual-"+i,side:"blue",revealed:false}));const cpuFormation=document.querySelector("#cpuFormation").value;board=applyFactions(initialBoard("balanced",cpuFormation,currentMode));const n=modeConfig(currentMode).size,start=(n-setupRows(currentMode))*n;for(let i=0;i<player.length;i++)board[start+i]=player[i];selected=null;validMoves=[];busy=false;dragPointer=null;dragFrom=null;if(strengthEl)strengthEl.textContent="";closeManualSetup();showGameScreen();setTurn("blue");setMessage("Deine manuelle Aufstellung ist bereit.");render();saveGameState();}
function startConfiguredGame(){cpuDifficulty=document.querySelector("#cpuDifficulty").value;combatRevealMode=document.querySelector("#combatRevealMode").value==="classic"?"classic":"daueraufdeckregel";setCombatRuleStatus();lastCpuMove=null;cpuIntel={known:{},moved:[]};playerPatterns={advances:0,attacks:0,scouts:0,miners:0,center:0};const chosen=document.querySelector("#gameMode").value;currentMode=MODES[chosen]?chosen:"classic";setMode(currentMode);playerFaction=document.querySelector("#playerFaction").value;cpuFaction=document.querySelector("#cpuFaction").value;const player=document.querySelector("#playerFormation").value;const cpu=document.querySelector("#cpuFormation").value;if(player==="manual"){openManualSetup();return;}board=applyFactions(initialBoard(player,cpu,currentMode));selected=null;validMoves=[];busy=false;dragPointer=null;dragFrom=null;if(strengthEl)strengthEl.textContent="";closeSetup();showGameScreen();setTurn("blue");setMessage("Aufstellung bereit – wähle eine deiner Figuren aus.");render();saveGameState();}
boardEl.addEventListener("pointerdown",e=>{
 const cell=e.target.closest(".cell");if(!cell||turn!=="blue"||busy)return;
 const index=Number(cell.dataset.index),p=board[index];
 if(selected!==null&&validMoves.includes(index)){dragPointer=e.pointerId;dragFrom=selected;return;}
 if(p?.side==="blue"){choose(index);dragPointer=e.pointerId;dragFrom=index;}
});
boardEl.addEventListener("pointerup",e=>{
 if(dragPointer!==e.pointerId||dragFrom===null)return;
 const el=document.elementFromPoint(e.clientX,e.clientY)?.closest(".cell");
 const to=el?Number(el.dataset.index):-1,from=dragFrom;
 dragPointer=null;dragFrom=null;
 if(validMoves.includes(to))finishMove(from,to);
 else if(to===from){}else if(board[to]?.side==="blue")choose(to);
});
boardEl.addEventListener("click",e=>{
 const cell=e.target.closest(".cell");if(!cell||turn!=="blue"||busy)return;
 const i=Number(cell.dataset.index);
 if(selected!==null&&validMoves.includes(i))finishMove(selected,i);
 else if(board[i]?.side==="blue")choose(i);
});
document.querySelector("#newGameBtn").addEventListener("click",showHomeScreen);
document.querySelector("#homeStartBtn").addEventListener("click",()=>openSetup(true));
document.querySelector("#homeResumeBtn").addEventListener("click",resumeSavedGame);
document.querySelector("#homeSettingsBtn").addEventListener("click",openSettings);
document.querySelector("#settingSound").addEventListener("change",e=>changeSetting("sound",e.target.checked));
document.querySelector("#settingAnimations").addEventListener("change",e=>changeSetting("animations",e.target.checked));
document.querySelector("#settingSpeed").addEventListener("change",e=>changeSetting("speed",e.target.value));
document.querySelector("#closeSettings").addEventListener("click",()=>settingsModal.hidden=true);
settingsModal.addEventListener("click",e=>{if(e.target===settingsModal)settingsModal.hidden=true;});
document.querySelector("#homeRulesBtn").addEventListener("click",openHomeRules);
document.querySelector("#startGameBtn").addEventListener("click",startConfiguredGame);
document.querySelector("#confirmManualSetup").addEventListener("click",confirmManualPlacement);
document.querySelector("#cancelManualSetup").addEventListener("click",()=>{closeManualSetup();openSetup();});
document.querySelector("#closeManualSetup").addEventListener("click",()=>{closeManualSetup();openSetup();});
document.querySelector("#clearFormationBtn").addEventListener("click",clearManualFormation);
document.querySelectorAll(".save-slot").forEach(btn=>btn.addEventListener("click",()=>{const i=Number(btn.dataset.slot);const saved=savedFormations()[i];if(saved)loadManualFormation(i);else{activeSaveSlot=i;saveManualFormation();}}));
document.querySelector("#cancelSetup").addEventListener("click",closeSetup);
document.querySelector("#closeSetup").addEventListener("click",closeSetup);
setupModal.addEventListener("click",e=>{if(e.target===setupModal)closeSetup();});
document.querySelector("#rulesBtn").addEventListener("click",()=>rulesModal.hidden=false);
document.querySelectorAll("[data-rules-tab]").forEach(button=>button.addEventListener("click",()=>selectRulesTab(button.dataset.rulesTab)));
document.querySelector("#closeRules").addEventListener("click",()=>rulesModal.hidden=true);
rulesModal.addEventListener("click",e=>{if(e.target===rulesModal)rulesModal.hidden=true;});
document.addEventListener("keydown",e=>{if(e.key==="Escape"){rulesModal.hidden=true;settingsModal.hidden=true;closeSetup();closeManualSetup();}});
window.addEventListener("pagehide",saveGameState);
window.addEventListener("beforeunload",saveGameState);
loadSettings();
if(loadGameState()){updateResumeButton();setTurn(turn);}else{try{localStorage.removeItem(GAME_SAVE_KEY);}catch{}hasSavedGame=false;updateResumeButton();}
render();
