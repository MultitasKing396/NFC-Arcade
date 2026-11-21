import {RANKS,LAKES,initialBoard,legalMoves,resolveCombat,sideHasMoves} from "./rules.js";
const boardEl=document.querySelector("#board"),messageEl=document.querySelector("#message"),turnEl=document.querySelector("#turnStatus");
const rulesModal=document.querySelector("#rulesModal");
let board=initialBoard(),turn="blue",selected=null,validMoves=[],busy=false,dragPointer=null,dragFrom=null;
const pieceInfo=p=>RANKS[p.type];
function setMessage(t){messageEl.textContent=t;}
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
   el.innerHTML=p.side==="red"&&!p.revealed?'<span class="sigil">♜</span>':`<span class="sigil">${info.sigil}</span><span class="rank">${info.name}</span><span class="value">${info.value}</span>`;
   cell.append(el);
  }
  boardEl.append(cell);
 }
}
function clearSelection(){selected=null;validMoves=[];dragFrom=null;render();}
function choose(index){
 const p=board[index];if(!p||p.side!=="blue"||!legalMoves(board,index).length)return false;
 selected=index;validMoves=legalMoves(board,index);render();setMessage(`${pieceInfo(p).name}: Ziehe die Figur auf ein markiertes Feld.`);return true;
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
 document.body.append(banner);banner.querySelector("#resultNew").addEventListener("click",()=>{banner.remove();newGame();});
}
function newGame(){board=initialBoard();selected=null;validMoves=[];busy=false;setTurn("blue");setMessage("Wähle eine deiner Figuren und ziehe sie auf ein markiertes Feld.");render();}
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
document.querySelector("#newGameBtn").addEventListener("click",newGame);
document.querySelector("#rulesBtn").addEventListener("click",()=>rulesModal.hidden=false);
document.querySelector("#closeRules").addEventListener("click",()=>rulesModal.hidden=true);
rulesModal.addEventListener("click",e=>{if(e.target===rulesModal)rulesModal.hidden=true;});
document.addEventListener("keydown",e=>{if(e.key==="Escape")rulesModal.hidden=true;});
render();
