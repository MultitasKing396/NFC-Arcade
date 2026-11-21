import {RANKS,LAKES,initialBoard,legalMoves,resolveCombat,sideHasMoves} from "./rules.js";
const boardEl=document.querySelector("#board"),messageEl=document.querySelector("#message"),strengthEl=document.querySelector("#selectedStrength"),turnEl=document.querySelector("#turnStatus");
const rulesModal=document.querySelector("#rulesModal"),setupModal=document.querySelector("#setupModal"),manualSetupModal=document.querySelector("#manualSetupModal");
let board=initialBoard(),turn="blue",selected=null,validMoves=[],busy=false,dragPointer=null,dragFrom=null;
let manualSlots=Array(40).fill(null),manualReserve={},manualSelectedType=null,manualMovingIndex=null,activeSaveSlot=0;
const pieceInfo=p=>RANKS[p.type];
function pieceArt(piece){
 const enemy=piece.side==="red",light=enemy?"#f3a092":"#a9d6ff",mid=enemy?"#a94c4b":"#3979b7",dark=enemy?"#542c37":"#1d426b",metal=enemy?"#d7a16e":"#f4cf79";
 if(enemy&&!piece.revealed)return `<svg class="miniature" viewBox="0 0 100 100" aria-hidden="true"><ellipse cx="50" cy="91" rx="29" ry="6" fill="#05080d" opacity=".45"/><path d="M50 8 78 20v28c0 20-12 34-28 43C34 82 22 68 22 48V20z" fill="#542c37" stroke="#f0b3a2" stroke-width="3"/><path d="M50 16 69 24v23c0 14-8 25-19 32-11-7-19-18-19-32V24z" fill="#a94c4b"/><path d="m50 28 5 12 13 1-10 8 3 13-11-7-11 7 3-13-10-8 13-1z" fill="#f4cf79" stroke="#ffe7b0" stroke-width="2"/></svg>`;
 const type=piece.type;
 if(type==="bomb")return `<svg class="miniature" viewBox="0 0 100 100" aria-hidden="true"><ellipse cx="50" cy="90" rx="27" ry="6" fill="#05080d" opacity=".45"/><g fill="${dark}" stroke="${metal}" stroke-width="3"><path d="M50 12 57 27 73 20 69 37 87 43 73 54 82 70 63 69 57 88 45 73 29 84 31 64 12 58 27 46 17 30 37 32z"/><circle cx="50" cy="51" r="22" fill="${mid}"/></g><path d="M50 14c0-7 8-9 13-7" fill="none" stroke="#e8d6b4" stroke-width="5" stroke-linecap="round"/><path d="m64 6 5-4" stroke="#f4c76b" stroke-width="3"/></svg>`;
 if(type==="flag")return `<svg class="miniature" viewBox="0 0 100 100" aria-hidden="true"><ellipse cx="50" cy="91" rx="27" ry="6" fill="#05080d" opacity=".45"/><path d="M50 16v70" stroke="${metal}" stroke-width="5" stroke-linecap="round"/><path d="M53 18 84 27 65 43 53 39z" fill="${light}" stroke="${metal}" stroke-width="2"/><path d="M53 18 84 27 65 43 53 39z" fill="${mid}" opacity=".6"/><path d="m64 25 3 6 6 1-5 4 1 6-5-3-5 3 1-6-5-4 6-1z" fill="${metal}"/><path d="M34 87h32" stroke="${metal}" stroke-width="5" stroke-linecap="round"/></svg>`;
 const head=type==="marshal"?`<path d="m35 24 4-12 10 8 10-8 6 12-5 8H40z" fill="${metal}" stroke="#fff0bd" stroke-width="2"/>`:type==="general"?`<path d="M47 18q-8-17 9-16 4 10-2 18" fill="${metal}" stroke="#fff0bd" stroke-width="2"/>`:type==="scout"?`<path d="M29 30q4-26 22-26t22 26l-9-5H38z" fill="${dark}" stroke="${metal}" stroke-width="2"/>`:type==="spy"?`<path d="M29 30q3-25 21-25t21 25l-8-5H37z" fill="${dark}" stroke="${metal}" stroke-width="2"/>`:`<path d="m31 27 5-15h28l5 15-8 7H39z" fill="${mid}" stroke="${metal}" stroke-width="2"/>`;
 const weapon=type==="miner"?`<path d="M74 34 83 72M68 38l17-5-3 13-12-2" stroke="#e8d5b2" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`:type==="scout"?`<path d="M76 36 86 76" stroke="#e8d5b2" stroke-width="4" stroke-linecap="round"/><path d="m81 70 5 9 2-11" fill="#e8d5b2"/>`:type==="spy"?`<path d="M75 39 86 72" stroke="#d6d9e1" stroke-width="3" stroke-linecap="round"/>`:`<path d="M76 35 84 76" stroke="#e8d5b2" stroke-width="4" stroke-linecap="round"/><path d="M78 42h9" stroke="${metal}" stroke-width="3"/>`;
 return `<svg class="miniature" viewBox="0 0 100 100" aria-hidden="true"><ellipse cx="50" cy="91" rx="29" ry="6" fill="#05080d" opacity=".45"/><path d="M24 83q3-19 12-26h28q10 8 13 26l-9 6H33z" fill="${dark}" stroke="${metal}" stroke-width="2"/><path d="M35 57 25 67l-7-6 8-16 13-3M65 57l10 10 8-6-8-17-13-3" fill="${mid}" stroke="${metal}" stroke-width="2"/><path d="M39 38q11-8 22 0l8 22-19 12-19-12z" fill="${mid}" stroke="${metal}" stroke-width="2"/><path d="m39 48 11 7 11-7M50 56v15" stroke="${metal}" stroke-width="2" fill="none"/><circle cx="50" cy="29" r="15" fill="${light}" stroke="${metal}" stroke-width="3"/><path d="M37 29q13-11 26 0" stroke="${dark}" stroke-width="4" fill="none"/>${head}<path d="M42 34h5m7 0h5" stroke="${dark}" stroke-width="2" stroke-linecap="round"/>${weapon}<path d="M30 82h40" stroke="${metal}" stroke-width="3" stroke-linecap="round"/></svg>`;
}

function setMessage(t){messageEl.textContent=t;}
function showSelectedStrength(piece){if(!strengthEl)return;const info=pieceInfo(piece);strengthEl.textContent=info.rank>0?`Stärke ${info.rank}`:piece.type==="bomb"?"Sonderfigur · unbeweglich":"Sonderfigur · unbeweglich";}
function setTurn(t){turn=t;turnEl.textContent=t==="blue"?"Dein Zug":"CPU denkt nach …";turnEl.classList.toggle("cpu",t==="red");}
function render(){
 boardEl.innerHTML="";
 for(let i=0;i<100;i++){
  const cell=document.createElement("div");cell.className="cell";cell.dataset.index=i;
  if(LAKES.has(i))cell.classList.add("lake");
  if(i===selected)cell.classList.add("selected");
  if(validMoves.includes(i))cell.classList.add("valid");
  const p=board[i];
  if(p){
   const info=pieceInfo(p),el=document.createElement("div");
   el.className="piece "+p.side+(p.side==="red"&&!p.revealed?" hidden-rank":"");
   el.setAttribute("aria-label",p.side==="red"&&!p.revealed?"Gegnerische Figur":info.name);
   el.innerHTML=pieceArt(p);
   cell.append(el);
  }
  boardEl.append(cell);
 }
}
function clearSelection(){selected=null;validMoves=[];dragFrom=null;if(strengthEl)strengthEl.textContent="";render();}
function choose(index){
 const p=board[index];if(!p||p.side!=="blue")return false;
 selected=index;validMoves=legalMoves(board,index);render();setMessage(`Ausgewählt: ${pieceInfo(p).name}`);showSelectedStrength(p);return true;
}
function finishMove(from,to){
 if(from===null||!validMoves.includes(to)||busy){clearSelection();return;}
 const attacker=board[from],defender=board[to];
 if(defender){
  defender.revealed=true;attacker.revealed=true;
  const outcome=resolveCombat(attacker,defender);
  if(outcome.result==="attacker"){board[to]=attacker;board[from]=null;}
  else if(outcome.result==="defender"){board[to]=defender;board[from]=null;}
  else {board[to]=null;board[from]=null;}
  setMessage(outcome.message);
  if(defender.type==="flag"&&outcome.result==="attacker"){endGame("blue");return;}
 }else{board[to]=attacker;board[from]=null;setMessage("Zug ausgeführt.");}
 clearSelection();
 if(!sideHasMoves(board,"red")){endGame("blue");return;}
 setTurn("red");busy=true;render();
 window.setTimeout(cpuMove,650+Math.random()*650);
}
function cpuMove(){
 const options=[];
 for(let i=0;i<100;i++){const p=board[i];if(p?.side==="red")for(const to of legalMoves(board,i))options.push({from:i,to});}
 if(!options.length){endGame("blue");return;}
 const move=options[Math.floor(Math.random()*options.length)],attacker=board[move.from],defender=board[move.to];
 if(defender){
  defender.revealed=true;attacker.revealed=true;
  const result=resolveCombat(attacker,defender);
  if(result.result==="attacker"){board[move.to]=attacker;board[move.from]=null;}
  else if(result.result==="defender"){board[move.to]=defender;board[move.from]=null;}
  else{board[move.to]=null;board[move.from]=null;}
  setMessage(result.message);
  if(defender.type==="flag"&&result.result==="attacker"){busy=false;render();endGame("red");return;}
 }else{board[move.to]=attacker;board[move.from]=null;setMessage("Der CPU hat seinen Zug ausgeführt.");}
 busy=false;setTurn("blue");render();
 if(!sideHasMoves(board,"blue"))endGame("red");
}
function endGame(winner){
 busy=true;setTurn("blue");turnEl.textContent=winner==="blue"?"Sieg!":"Niederlage";
 setMessage(winner==="blue"?"Du hast gewonnen! Die gegnerische Flagge ist gefallen.":"Du hast verloren. Deine Flagge wurde erobert.");
 const banner=document.createElement("div");banner.className="result-banner";banner.innerHTML=`<div class="result-card"><div class="eyebrow">DIE SCHLACHT IST ENTSCHIEDEN</div><h2>${winner==="blue"?"SIEG":"NIEDERLAGE"}</h2><p>${winner==="blue"?"Deine Armee triumphiert.":"Deine Armee wurde besiegt."}</p><button class="gold-button" id="resultNew">Neue Partie</button></div>`;
 document.body.append(banner);banner.querySelector("#resultNew").addEventListener("click",()=>{banner.remove();openSetup();});
}
function openSetup(){setupModal.hidden=false;const manual=document.querySelector("#playerFormation").value==="manual";document.querySelector("#openManualSetupBtn").hidden=!manual;}
function closeSetup(){setupModal.hidden=true;}
const SAVE_KEY="nfc-arcade-stratego-formations-v1";
function readSavedFormations(){try{return JSON.parse(localStorage.getItem(SAVE_KEY)||"[]");}catch{return [];}}
function writeSavedFormations(items){try{localStorage.setItem(SAVE_KEY,JSON.stringify(items));return true;}catch{return false;}}
function savedFormations(){const a=readSavedFormations();return Array.from({length:3},(_,i)=>a[i]||null);}
function updateSaveLabels(){savedFormations().forEach((s,i)=>{const el=document.querySelector("#saveStatus"+i);if(el)el.textContent=s?"Gespeichert":"Leer";});}
function resetManualPlacement(){manualSlots=Array(40).fill(null);manualReserve={};for(const [type,info] of Object.entries(RANKS))manualReserve[type]=info.count;manualSelectedType=null;manualMovingIndex=null;activeSaveSlot=0;renderManualSetup();}
function renderManualSetup(){
 const grid=document.querySelector("#manualBoard"),palette=document.querySelector("#manualPalette");grid.innerHTML="";palette.innerHTML="";
 for(let i=0;i<40;i++){const p=manualSlots[i],cell=document.createElement("button");cell.type="button";cell.className="manual-cell"+(p?" occupied":"")+(manualMovingIndex===i?" moving":"");
  cell.innerHTML=p?("<span class=\"manual-piece\">"+RANKS[p.type].sigil+"</span><small>"+RANKS[p.type].name+"</small>"):"<span class=\"empty-mark\">＋</span>";
  cell.addEventListener("click",()=>placeManualCell(i));grid.append(cell);}
 for(const [type,info] of Object.entries(RANKS)){const count=manualReserve[type]||0,btn=document.createElement("button");btn.type="button";btn.className="palette-piece"+(manualSelectedType===type?" active":"")+(count===0?" exhausted":"");btn.disabled=count===0;
  btn.innerHTML="<span>"+info.sigil+"</span><b>"+info.name+"</b><small>"+count+" übrig</small>";btn.addEventListener("click",()=>{manualSelectedType=type;manualMovingIndex=null;renderManualSetup();});palette.append(btn);}
 const placed=manualSlots.filter(Boolean).length;document.querySelector("#manualProgress").textContent=placed+" / 40 platziert";
 document.querySelector("#manualSelected").textContent=manualMovingIndex!==null?"Figur zum Verschieben gewählt":manualSelectedType?RANKS[manualSelectedType].name+" ausgewählt":"Keine Figur ausgewählt";
 document.querySelector("#confirmManualSetup").disabled=placed!==40;updateSaveLabels();
}
function placeManualCell(index){
 if(manualMovingIndex!==null){if(manualMovingIndex===index){manualMovingIndex=null;renderManualSetup();return;}if(!manualSlots[index]){manualSlots[index]=manualSlots[manualMovingIndex];manualSlots[manualMovingIndex]=null;}manualMovingIndex=null;renderManualSetup();return;}
 if(manualSlots[index]){manualMovingIndex=index;manualSelectedType=null;renderManualSetup();return;}
 if(!manualSelectedType)return;manualSlots[index]={type:manualSelectedType};manualReserve[manualSelectedType]--;manualSelectedType=null;renderManualSetup();
}
function openManualSetup(){closeSetup();resetManualPlacement();manualSetupModal.hidden=false;}
function closeManualSetup(){manualSetupModal.hidden=true;}
function saveManualFormation(){const placed=manualSlots.filter(Boolean).length;if(placed!==40)return;const slots=savedFormations();const old=slots[activeSaveSlot];if(old&&!confirm("Diesen Speicherplatz zuerst leeren, bevor du ihn neu belegst."))return;if(old)return;slots[activeSaveSlot]={name:["Formation Alpha","Formation Beta","Formation Charlie"][activeSaveSlot],types:manualSlots.map(p=>p.type)};if(!writeSavedFormations(slots)){alert("Speichern ist in diesem Browser nicht verfügbar.");return;}updateSaveLabels();}
function loadManualFormation(index){const saved=savedFormations()[index];if(!saved)return;if(manualSlots.some(Boolean)&&!confirm("Die aktuelle Aufstellung durch diese Formation ersetzen?"))return;manualSlots=saved.types.map(type=>({type}));manualReserve={};for(const [type,info] of Object.entries(RANKS))manualReserve[type]=info.count;manualSlots.forEach(p=>manualReserve[p.type]--);manualSelectedType=null;manualMovingIndex=null;activeSaveSlot=index;renderManualSetup();}
function clearManualFormation(){const slots=savedFormations();if(!slots[activeSaveSlot])return;if(!confirm("Diesen Speicherplatz wirklich leeren?"))return;slots[activeSaveSlot]=null;writeSavedFormations(slots);updateSaveLabels();}
function confirmManualPlacement(){if(manualSlots.some(p=>!p))return;const player=manualSlots.map((p,i)=>({...p,id:"blue-manual-"+i,side:"blue",revealed:false}));const cpuFormation=document.querySelector("#cpuFormation").value;board=initialBoard("balanced",cpuFormation);for(let i=0;i<40;i++)board[60+i]=player[i];selected=null;validMoves=[];busy=false;dragPointer=null;dragFrom=null;if(strengthEl)strengthEl.textContent="";closeManualSetup();setTurn("blue");setMessage("Deine manuelle Aufstellung ist bereit.");render();}
function startConfiguredGame(){const player=document.querySelector("#playerFormation").value;const cpu=document.querySelector("#cpuFormation").value;if(player==="manual"){openManualSetup();return;}board=initialBoard(player,cpu);selected=null;validMoves=[];busy=false;dragPointer=null;dragFrom=null;if(strengthEl)strengthEl.textContent="";closeSetup();setTurn("blue");setMessage("Aufstellung bereit – wähle eine deiner Figuren aus.");render();}
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
document.querySelector("#newGameBtn").addEventListener("click",openSetup);
document.querySelector("#openManualSetupBtn").addEventListener("click",()=>openManualSetup());
document.querySelector("#playerFormation").addEventListener("change",e=>{const manual=e.target.value==="manual";document.querySelector("#openManualSetupBtn").hidden=!manual;});
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
document.querySelector("#closeRules").addEventListener("click",()=>rulesModal.hidden=true);
rulesModal.addEventListener("click",e=>{if(e.target===rulesModal)rulesModal.hidden=true;});
document.addEventListener("keydown",e=>{if(e.key==="Escape"){rulesModal.hidden=true;closeSetup();closeManualSetup();}});
render();
