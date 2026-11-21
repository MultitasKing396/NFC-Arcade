export const MODES = {
 quick:{label:"Blitzgefecht",size:6,count:12,rows:2,counts:{marshal:1,general:1,colonel:1,captain:1,lieutenant:1,sergeant:1,scout:4,spy:1,flag:1}},
 small:{label:"Schnellgefecht",size:8,count:24,rows:3,counts:{marshal:1,general:1,colonel:1,major:1,captain:2,lieutenant:2,sergeant:2,miner:2,scout:5,spy:1,bomb:4,flag:1}},
 classic:{label:"Klassisch",size:10,count:40,rows:4,counts:{marshal:1,general:1,colonel:2,major:3,captain:4,lieutenant:4,sergeant:4,miner:5,scout:8,spy:1,bomb:6,flag:1}},
 large:{label:"Große Schlacht",size:12,count:48,rows:4,counts:{marshal:1,general:1,colonel:3,major:4,captain:5,lieutenant:5,sergeant:5,miner:6,scout:10,spy:1,bomb:7,flag:1}}
};
export let CURRENT_MODE="classic";
export function setMode(mode){CURRENT_MODE=MODES[mode]?mode:"classic";}
export function modeConfig(mode=CURRENT_MODE){return MODES[mode]||MODES.classic;}
export const RANKS = {
 marshal:{name:"Feldmarschall",rank:10,sigil:"♛",value:10},
 general:{name:"General",rank:9,sigil:"♜",value:9},
 colonel:{name:"Oberst",rank:8,sigil:"✦",value:8},
 major:{name:"Major",rank:7,sigil:"✧",value:7},
 captain:{name:"Hauptmann",rank:6,sigil:"⚔",value:6},
 lieutenant:{name:"Leutnant",rank:5,sigil:"⚔",value:5},
 sergeant:{name:"Unteroffizier",rank:4,sigil:"◆",value:4},
 miner:{name:"Mineur",rank:3,sigil:"⛏",value:3},
 scout:{name:"Späher",rank:2,sigil:"➤",value:2},
 spy:{name:"Spion",rank:1,sigil:"◈",value:1},
 bomb:{name:"Bombe",rank:0,sigil:"✹",value:"B"},
 flag:{name:"Flagge",rank:-1,sigil:"⚑",value:"F"}
};
export function armyCount(mode=CURRENT_MODE){return modeConfig(mode).count;}
export function setupRows(mode=CURRENT_MODE){return modeConfig(mode).rows;}
export function lakeSet(mode=CURRENT_MODE){
 const n=modeConfig(mode).size, mid=Math.floor(n/2);
 if(n===6)return new Set();
 if(n===8)return new Set([mid*n+2,mid*n+3,(mid-1)*n+4,(mid-1)*n+5]);
 const width=n===10?2:2, left=Math.floor(n/2)-2, right=left+width+2, rows=[mid-1,mid];
 return new Set(rows.flatMap(r=>[left,left+1,right,right+1].filter(c=>c>=0&&c<n).map(c=>r*n+c)));
}
export const LAKES=lakeSet("classic");
export function makeArmy(side,mode=CURRENT_MODE){
 const pieces=[],counts=modeConfig(mode).counts;
 for(const [type,count] of Object.entries(counts))for(let i=0;i<count;i++)pieces.push({id:side+"-"+type+"-"+i,side,type,revealed:false});
 return pieces;
}
export function shuffle(items){const a=[...items];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function formationPriority(type,formation){
 const priorities={
 balanced:{flag:20,bomb:19,marshal:18,general:17,colonel:16,major:15,captain:14,lieutenant:13,sergeant:12,miner:11,scout:10,spy:9},
 defensive:{flag:20,bomb:19,miner:18,marshal:17,general:16,colonel:15,major:14,captain:13,lieutenant:12,sergeant:11,scout:10,spy:9},
 offensive:{marshal:12,general:11,colonel:10,major:9,captain:8,lieutenant:7,sergeant:6,miner:5,scout:4,spy:3,bomb:1,flag:0},
 bastion:{flag:20,bomb:19,miner:18,marshal:17,general:16,colonel:15,major:14,captain:13,lieutenant:12,sergeant:11,scout:10,spy:9},
 spearhead:{marshal:12,general:11,colonel:10,major:9,captain:8,lieutenant:7,sergeant:6,miner:5,scout:4,spy:3,bomb:1,flag:0}
 };
 return (priorities[formation]||priorities.balanced)[type]??0;
}
function slotPriority(index,formation,size,rows){
 const row=Math.floor(index/size),col=index%size,center=(size-1)/2-Math.abs(col-(size-1)/2);
 if(formation==="defensive"||formation==="bastion")return row*10+center*.12;
 if(formation==="offensive"||formation==="spearhead")return (rows-1-row)*10+center*.08;
 return row*5+center*.25;
}
export function arrangeArmy(side,formation="balanced",mode=CURRENT_MODE){
 const cfg=modeConfig(mode),army=shuffle(makeArmy(side,mode));
 const types=army.sort((a,b)=>formationPriority(b.type,formation)-formationPriority(a.type,formation));
 const slots=Array.from({length:cfg.count},(_,i)=>i).sort((a,b)=>slotPriority(b,formation,cfg.size,cfg.rows)-slotPriority(a,formation,cfg.size,cfg.rows));
 const arranged=Array(cfg.count);slots.forEach((slot,i)=>{arranged[slot]=types[i];});return arranged;
}
export function initialBoard(blueFormation="balanced",redFormation="balanced",mode=CURRENT_MODE){
 const cfg=modeConfig(mode),n=cfg.size,board=Array(n*n).fill(null);
 const blue=arrangeArmy("blue",blueFormation,mode),red=arrangeArmy("red",redFormation,mode);
 for(let i=0;i<cfg.count;i++){board[(n-cfg.rows)*n+i]=blue[i];const rr=Math.floor(i/n),cc=i%n;board[(cfg.rows-1-rr)*n+cc]=red[i];}
 return board;
}
export function isMovable(piece){return piece&&!["bomb","flag"].includes(piece.type);}
export function legalMoves(board,index,mode=CURRENT_MODE){
 const n=modeConfig(mode).size,lakes=lakeSet(mode),piece=board[index];if(!isMovable(piece))return [];
 const row=Math.floor(index/n),col=index%n,dirs=[[1,0],[-1,0],[0,1],[0,-1]],moves=[];
 for(const [dr,dc] of dirs){let r=row+dr,c=col+dc;while(r>=0&&r<n&&c>=0&&c<n){const to=r*n+c;if(lakes.has(to))break;const target=board[to];if(!target)moves.push(to);else{if(target.side!==piece.side)moves.push(to);break;}if(piece.type!=="scout")break;r+=dr;c+=dc;}}
 return moves;
}
export function resolveCombat(attacker,defender){
 if(defender.type==="flag")return {result:"attacker",message:"Die Flagge wurde erobert!"};
 if(defender.type==="bomb"){if(attacker.type==="miner")return {result:"attacker",message:"Der Mineur entschärft die Bombe."};return {result:"defender",message:"Die Bombe besiegt den Angreifer."};}
 if(attacker.type==="spy"&&defender.type==="marshal")return {result:"attacker",message:"Der Spion besiegt den Feldmarschall!"};
 if(defender.type==="spy"&&attacker.type==="marshal")return {result:"attacker",message:"Der Feldmarschall besiegt den Spion."};
 const a=RANKS[attacker.type].rank,d=RANKS[defender.type].rank;if(a>d)return {result:"attacker",message:"Dein Rang ist überlegen."};if(a<d)return {result:"defender",message:"Der gegnerische Rang ist überlegen."};return {result:"both",message:"Gleiche Ränge – beide Figuren werden entfernt."};
}
export function sideHasMoves(board,side,mode=CURRENT_MODE){return board.some((p,i)=>p?.side===side&&legalMoves(board,i,mode).length>0);}
