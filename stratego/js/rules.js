export const RANKS = {
  marshal:{name:"Feldmarschall",rank:10,count:1,sigil:"♛",value:10},
  general:{name:"General",rank:9,count:1,sigil:"♜",value:9},
  colonel:{name:"Oberst",rank:8,count:2,sigil:"✦",value:8},
  major:{name:"Major",rank:7,count:3,sigil:"✧",value:7},
  captain:{name:"Hauptmann",rank:6,count:4,sigil:"⚔",value:6},
  lieutenant:{name:"Leutnant",rank:5,count:4,sigil:"⚔",value:5},
  sergeant:{name:"Unteroffizier",rank:4,count:4,sigil:"◆",value:4},
  miner:{name:"Mineur",rank:3,count:5,sigil:"⛏",value:3},
  scout:{name:"Späher",rank:2,count:8,sigil:"➤",value:2},
  spy:{name:"Spion",rank:1,count:1,sigil:"◈",value:1},
  bomb:{name:"Bombe",rank:0,count:6,sigil:"✹",value:"B"},
  flag:{name:"Flagge",rank:-1,count:1,sigil:"⚑",value:"F"}
};
export const LAKES = new Set([...[4,5].flatMap(r=>[2,3,6,7].map(c=>r*10+c))]);
export function makeArmy(side){
 const pieces=[];
 for(const [type,info] of Object.entries(RANKS)) for(let i=0;i<info.count;i++) pieces.push({id:side+"-"+type+"-"+i,side,type,revealed:false});
 return pieces;
}
export function shuffle(items){const a=[...items];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function formationPriority(type,formation){
 const priorities={
  balanced:{flag:20,bomb:19,marshal:18,general:17,colonel:16,major:15,captain:14,lieutenant:13,sergeant:12,miner:11,scout:10,spy:9},
  defensive:{flag:20,bomb:19,miner:18,marshal:17,general:16,colonel:15,major:14,captain:13,lieutenant:12,sergeant:11,scout:10,spy:9},
  offensive:{marshal:12,general:11,colonel:10,major:9,captain:8,lieutenant:7,sergeant:6,miner:5,scout:4,spy:3,bomb:1,flag:0},
  bastion:{flag:0,bomb:2,miner:9,marshal:8,general:7,colonel:6,major:5,captain:4,lieutenant:3,sergeant:2,scout:1,spy:6},
  spearhead:{marshal:12,general:11,colonel:10,major:9,captain:8,lieutenant:7,sergeant:6,miner:5,scout:4,spy:3,bomb:1,flag:0}
 };
 return (priorities[formation]||priorities.balanced)[type]??0;
}
function slotPriority(index,formation){
 const row=Math.floor(index/10),col=index%10,center=4.5-Math.abs(col-4.5);
 if(formation==="defensive"||formation==="bastion")return row*10+center*.12;
 if(formation==="offensive"||formation==="spearhead")return (3-row)*10+center*.08;
 return (3-row)*5+center*.25;
}
export function arrangeArmy(side,formation="balanced"){
 const army=shuffle(makeArmy(side));
 const types=army.sort((a,b)=>formationPriority(b.type,formation)-formationPriority(a.type,formation));
 const slots=Array.from({length:40},(_,i)=>i).sort((a,b)=>slotPriority(b,formation)-slotPriority(a,formation));
 const arranged=Array(40);
 slots.forEach((slot,i)=>{arranged[slot]=types[i];});
 return arranged;
}
export function initialBoard(blueFormation="balanced",redFormation="balanced"){
 const board=Array(100).fill(null);
 const blue=arrangeArmy("blue",blueFormation),red=arrangeArmy("red",redFormation);
 for(let i=0;i<40;i++){board[60+i]=blue[i];board[i]=red[i];}
 return board;
}
export function isMovable(piece){return piece && !["bomb","flag"].includes(piece.type);}
export function legalMoves(board,index){
 const piece=board[index];if(!isMovable(piece))return [];
 const row=Math.floor(index/10),col=index%10,dirs=[[1,0],[-1,0],[0,1],[0,-1]],moves=[];
 for(const [dr,dc] of dirs){
  let r=row+dr,c=col+dc;
  while(r>=0&&r<10&&c>=0&&c<10){
   const to=r*10+c;if(LAKES.has(to))break;
   const target=board[to];
   if(!target)moves.push(to);
   else {if(target.side!==piece.side)moves.push(to);break;}
   if(piece.type!=="scout")break;
   r+=dr;c+=dc;
  }
 }
 return moves;
}
export function resolveCombat(attacker,defender){
 if(defender.type==="flag")return {result:"attacker",message:"Die Flagge wurde erobert!"};
 if(defender.type==="bomb"){
  if(attacker.type==="miner")return {result:"attacker",message:"Der Mineur entschärft die Bombe."};
  return {result:"defender",message:"Die Bombe besiegt den Angreifer."};
 }
 if(attacker.type==="spy"&&defender.type==="marshal")return {result:"attacker",message:"Der Spion besiegt den Feldmarschall!"};
 if(defender.type==="spy"&&attacker.type==="marshal")return {result:"attacker",message:"Der Feldmarschall besiegt den Spion."};
 const a=RANKS[attacker.type].rank,d=RANKS[defender.type].rank;
 if(a>d)return {result:"attacker",message:"Dein Rang ist überlegen."};
 if(a<d)return {result:"defender",message:"Der gegnerische Rang ist überlegen."};
 return {result:"both",message:"Gleiche Ränge – beide Figuren werden entfernt."};
}
export function sideHasMoves(board,side){
 return board.some((p,i)=>p?.side===side&&legalMoves(board,i).length>0);
}
