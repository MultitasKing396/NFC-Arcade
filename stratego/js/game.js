import {RANKS,MODES,modeConfig,armyCount,setupRows,lakeSet,setMode,initialBoard,legalMoves,resolveCombat,sideHasMoves} from "./rules.js";
const boardEl=document.querySelector("#board"),messageEl=document.querySelector("#message"),strengthEl=document.querySelector("#selectedStrength"),turnEl=document.querySelector("#turnStatus");
const rulesModal=document.querySelector("#rulesModal"),setupModal=document.querySelector("#setupModal"),manualSetupModal=document.querySelector("#manualSetupModal"),settingsModal=document.querySelector("#settingsModal");
let pendingAnimation=null;
let setupFromHome=false;
const SETTINGS_KEY="nfc-arcade-stratego-settings-v1";
const DEFAULT_SETTINGS={sound:false,animations:true,speed:"normal",theme:"forest"};
let gameSettings={...DEFAULT_SETTINGS};
let audioContext=null;
function loadSettings(){
 try{const saved=JSON.parse(localStorage.getItem(SETTINGS_KEY)||"{}");gameSettings={...DEFAULT_SETTINGS,...saved};}catch{gameSettings={...DEFAULT_SETTINGS};}
 if(!["slow","normal","fast"].includes(gameSettings.speed))gameSettings.speed="normal";
 if(!["forest","ice","volcano","ruins"].includes(gameSettings.theme))gameSettings.theme="forest";
 applySettings();
}
function saveSettings(){try{localStorage.setItem(SETTINGS_KEY,JSON.stringify(gameSettings));}catch(error){console.warn("Einstellungen konnten nicht gespeichert werden.",error);}}
function applySettings(){
 document.body.classList.toggle("no-game-animations",!gameSettings.animations);
 document.documentElement.style.setProperty("--game-animation-speed",gameSettings.speed==="slow"?"1.35":gameSettings.speed==="fast"?"0.72":"1");
 const sound=document.querySelector("#settingSound"),animations=document.querySelector("#settingAnimations"),speed=document.querySelector("#settingSpeed"),theme=document.querySelector("#settingBattlefield");
 boardEl.dataset.theme=gameSettings.theme;
 if(boardEl.parentElement)boardEl.parentElement.dataset.theme=gameSettings.theme;
 if(sound)sound.checked=!!gameSettings.sound;
 if(animations)animations.checked=!!gameSettings.animations;
 if(speed)speed.value=gameSettings.speed;
 if(theme)theme.value=gameSettings.theme;
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
 const archetypes={marshal:"king",general:"paladin",colonel:"knight",major:"knight",captain:"standard",lieutenant:"standard",sergeant:"ranger",miner:"dwarf",scout:"ranger",spy:"ranger",bomb:"dwarf",flag:"standard"};
 const archetype=archetypes[piece.type]||"knight";
 return `<span class="miniature-sprite sprite-${archetype}" aria-hidden="true"></span>`;
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
   if(pendingAnimation.kind==="combat"){
    cell.classList.add("combat-"+(pendingAnimation.outcome||"hit"));
    if(FACTIONS[pendingAnimation.faction])cell.classList.add("combat-faction-"+pendingAnimation.faction);
    if(pendingAnimation.winner&&FACTIONS[pendingAnimation.winnerFaction])cell.classList.add("combat-victory-"+pendingAnimation.winnerFaction);
    if(pendingAnimation.special==="spy-marshal")cell.classList.add("spy-marshal-counter");
    const attackerRank=RANKS[pendingAnimation.attackerType]?.rank||0,defenderRank=RANKS[pendingAnimation.opponentType]?.rank||0;
    if(Math.max(attackerRank,defenderRank)>=8)cell.classList.add("combat-elite");
    if(pendingAnimation.attackerType==="marshal"||pendingAnimation.opponentType==="marshal")cell.classList.add("combat-marshal");
   }
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
   const upright=document.createElement("div");
   upright.className="piece-upright";
   upright.innerHTML=pieceArt(p);
   el.append(upright);
   if(p.side==="blue"||p.revealed){
    const rankMark=document.createElement("span");
    rankMark.className="piece-rank-badge";
    rankMark.textContent=info.rank>0?String(info.rank):p.type==="bomb"?"B":"F";
    rankMark.setAttribute("aria-label",info.rank>0?"Stärke "+info.rank:p.type==="bomb"?"Bombe":"Flagge");
    rankMark.title=info.rank>0?"Stärke "+info.rank:info.name;
    upright.append(rankMark);
   }
   cell.append(el);
  }
  boardEl.append(cell);
 }
 const boardWrap=boardEl.parentElement;
 boardWrap.querySelector(".combat-callout-layer")?.remove();
 if(pendingAnimation?.kind==="combat"&&pendingAnimation.to!=null){
  const calloutLayer=document.createElement("div");
  calloutLayer.className="combat-callout-layer";
  const boardStyle=getComputedStyle(boardEl);
  calloutLayer.style.top=(boardEl.offsetTop+boardEl.clientTop+parseFloat(boardStyle.paddingTop||0))+"px";
  calloutLayer.style.left=(boardEl.offsetLeft+boardEl.clientLeft+parseFloat(boardStyle.paddingLeft||0))+"px";
  calloutLayer.style.width=boardEl.clientWidth-parseFloat(boardStyle.paddingLeft||0)-parseFloat(boardStyle.paddingRight||0)+"px";
  calloutLayer.style.height=boardEl.clientHeight-parseFloat(boardStyle.paddingTop||0)-parseFloat(boardStyle.paddingBottom||0)+"px";
  calloutLayer.style.gridTemplateColumns=`repeat(${size},minmax(0,1fr))`;
  calloutLayer.style.gridTemplateRows=`repeat(${size},minmax(0,1fr))`;
  const callout=document.createElement("div");
  callout.className="combat-callout";
  if(pendingAnimation.attackerType==="marshal"||pendingAnimation.opponentType==="marshal")callout.classList.add("combat-callout-marshal");
  callout.style.gridColumn=String((pendingAnimation.to%size)+1);
  callout.style.gridRow=String(Math.floor(pendingAnimation.to/size)+1);
  const label=document.createElement("span");
  label.className="combat-callout-label";
  const defeatedType=pendingAnimation.outcome==="attacker"?pendingAnimation.opponentType:pendingAnimation.outcome==="defender"?pendingAnimation.attackerType:null;
  const opponentInfo=defeatedType?RANKS[defeatedType]:null;
  const resultForPlayer=pendingAnimation.winner==="blue"?"win":pendingAnimation.winner==="red"?"loss":"draw";
  callout.classList.add("combat-callout-"+resultForPlayer);
  const opponentLabel=opponentInfo?.rank>0?"STÄRKE "+opponentInfo.rank:opponentInfo?.name||"SONDERFIGUR";
  label.textContent=pendingAnimation.special==="spy-marshal"&&resultForPlayer==="win"?"SIEG · FELDMARSCHALL BESIEGT":pendingAnimation.opponentType==="flag"?(resultForPlayer==="win"?"FLAGGE EROBERT":"DEINE FLAGGE EROBERT"):pendingAnimation.outcome==="both"?"GLEICHSTAND":resultForPlayer==="win"?"SIEG · "+opponentLabel+" BESIEGT":resultForPlayer==="loss"?"NIEDERLAGE · "+opponentLabel: "GLEICHSTAND";
  callout.append(label);
  if(pendingAnimation.special==="spy-marshal"){
   const legendary=document.createElement("span");
   legendary.className="legendary-counter";
   legendary.textContent="SPION STÜRZT FELDMARSCHALL!";
   legendary.style.top="auto";legendary.style.bottom="-17px";
   callout.append(legendary);
  }
  if(pendingAnimation.special!=="spy-marshal"&&pendingAnimation.winner&&pendingAnimation.revealType&&RANKS[pendingAnimation.revealType]&&(pendingAnimation.winner==="blue"||combatRevealMode==="daueraufdeckregel")){
   const reveal=document.createElement("span");
   const revealedInfo=RANKS[pendingAnimation.revealType];
   reveal.className="combat-reveal-badge";
   reveal.textContent=revealedInfo.rank>0?"ÜBERLEBT · STÄRKE "+revealedInfo.rank:"ÜBERLEBT · "+revealedInfo.name.toUpperCase();
   reveal.style.top="auto";reveal.style.bottom="-7px";
   callout.append(reveal);
  }
  calloutLayer.append(callout);
  boardWrap.append(calloutLayer);
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
   pendingAnimation={from,to,kind:animationKind,winner,outcome:outcome.result,faction:attacker.faction||"aurelia",winnerFaction:survivor?.faction||null,special:attacker.type==="spy"&&defender?.type==="marshal"&&outcome.result==="attacker"?"spy-marshal":null,attackerType:attacker?.type||null,opponentType:defender?.type||null,revealType:survivor?.type||null};
   selected=null;validMoves=[];dragFrom=null;if(strengthEl)strengthEl.textContent="";
   render();busy=true;playSound("combat");window.setTimeout(()=>endGame("blue"),850);return;
  }
 }else{board[to]=attacker;board[from]=null;setMessage("Zug ausgeführt.");}
 const survivor=animationKind==="combat"?(winner==="blue"?attacker:winner==="red"?defender:null):null;
 pendingAnimation={from,to,kind:animationKind,winner,outcome:combatOutcome,faction:attacker.faction||"aurelia",winnerFaction:survivor?.faction||null,special:attacker.type==="spy"&&defender?.type==="marshal"&&combatOutcome==="attacker"?"spy-marshal":null,attackerType:attacker?.type||null,opponentType:defender?.type||null,revealType:survivor?.type||null};
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
   pendingAnimation={from:move.from,to:move.to,kind:animationKind,winner,outcome:result.result,faction:attacker.faction||"shadow",winnerFaction:survivor?.faction||null,special:attacker.type==="spy"&&defender?.type==="marshal"&&result.result==="attacker"?"spy-marshal":null,attackerType:attacker?.type||null,opponentType:defender?.type||null,revealType:survivor?.type||null};
   busy=false;render();window.setTimeout(()=>endGame("red"),850);return;
  }
 }else{board[move.to]=attacker;board[move.from]=null;setMessage("Der CPU hat seinen Zug ausgeführt.");}
 const survivor=animationKind==="combat"?(winner==="red"?attacker:winner==="blue"?defender:null):null;
 pendingAnimation={from:move.from,to:move.to,kind:animationKind,winner,outcome:combatOutcome,faction:attacker.faction||"shadow",winnerFaction:survivor?.faction||null,special:attacker.type==="spy"&&defender?.type==="marshal"&&combatOutcome==="attacker"?"spy-marshal":null,attackerType:attacker?.type||null,opponentType:defender?.type||null,revealType:survivor?.type||null};
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
function openSetup(fromHome=false){setupFromHome=fromHome;applySettings();if(fromHome){const formation=document.querySelector("#playerFormation");if(formation)formation.value="balanced";}const environment=document.querySelector("#setupBattlefield");if(environment)environment.value=gameSettings.theme;setupModal.hidden=false;}
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
function startConfiguredGame(){const chosenTheme=document.querySelector("#setupBattlefield").value;changeSetting("theme",["forest","ice","volcano","ruins"].includes(chosenTheme)?chosenTheme:"forest");cpuDifficulty=document.querySelector("#cpuDifficulty").value;combatRevealMode=document.querySelector("#combatRevealMode").value==="classic"?"classic":"daueraufdeckregel";setCombatRuleStatus();lastCpuMove=null;cpuIntel={known:{},moved:[]};playerPatterns={advances:0,attacks:0,scouts:0,miners:0,center:0};const chosen=document.querySelector("#gameMode").value;currentMode=MODES[chosen]?chosen:"classic";setMode(currentMode);playerFaction=document.querySelector("#playerFaction").value;cpuFaction=document.querySelector("#cpuFaction").value;const player=document.querySelector("#playerFormation").value;const cpu=document.querySelector("#cpuFormation").value;if(player==="manual"){openManualSetup();return;}board=applyFactions(initialBoard(player,cpu,currentMode));selected=null;validMoves=[];busy=false;dragPointer=null;dragFrom=null;if(strengthEl)strengthEl.textContent="";closeSetup();showGameScreen();setTurn("blue");setMessage("Aufstellung bereit – wähle eine deiner Figuren aus.");render();saveGameState();}
// Robuste Tap-Steuerung: Das Spielfeld wird erst nach dem Klick neu gerendert.
 // Pointerdown darf die angeklickte Zelle nicht vor dem Click-Event ersetzen.
 boardEl.addEventListener("click",e=>{
  const cell=e.target.closest(".cell");
  if(!cell||!boardEl.contains(cell)||turn!=="blue"||busy)return;
  const index=Number(cell.dataset.index);
  if(!Number.isInteger(index)||index<0||index>=board.length)return;
  if(selected!==null&&validMoves.includes(index)){
   finishMove(selected,index);
   return;
  }
  if(board[index]?.side==="blue"){
   choose(index);
   return;
  }
  if(selected!==null)setMessage("Wähle ein markiertes Zielfeld oder eine andere eigene Figur.");
 });
document.querySelector("#newGameBtn").addEventListener("click",showHomeScreen);
document.querySelector("#homeStartBtn").addEventListener("click",()=>openSetup(true));
document.querySelector("#homeResumeBtn").addEventListener("click",resumeSavedGame);
document.querySelector("#homeSettingsBtn").addEventListener("click",openSettings);
document.querySelector("#settingSound").addEventListener("change",e=>changeSetting("sound",e.target.checked));
document.querySelector("#settingAnimations").addEventListener("change",e=>changeSetting("animations",e.target.checked));
document.querySelector("#settingSpeed").addEventListener("change",e=>changeSetting("speed",e.target.value));
document.querySelector("#settingBattlefield").addEventListener("change",e=>changeSetting("theme",e.target.value));
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
