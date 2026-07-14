import crypto from 'node:crypto';
import type { GameState, Player, PlayerColor, Territory } from '@kemet/shared';
const colors: PlayerColor[] = ['red','blue','green'];
const baseTerritories: Territory[] = [
  {id:'red-city',name:'Red City',kind:'city',armies:{},neighbors:['west-desert'],x:12,y:72},
  {id:'blue-city',name:'Blue City',kind:'city',armies:{},neighbors:['east-desert'],x:88,y:72},
  {id:'green-city',name:'Green City',kind:'city',armies:{},neighbors:['north-desert'],x:50,y:8},
  {id:'west-desert',name:'Western Desert',kind:'desert',armies:{},neighbors:['red-city','center','west-temple'],x:28,y:56},
  {id:'east-desert',name:'Eastern Desert',kind:'desert',armies:{},neighbors:['blue-city','center','east-temple'],x:72,y:56},
  {id:'north-desert',name:'Northern Desert',kind:'desert',armies:{},neighbors:['green-city','center','north-temple'],x:50,y:28},
  {id:'center',name:'Nile Crossroads',kind:'desert',armies:{},neighbors:['west-desert','east-desert','north-desert'],x:50,y:52},
  {id:'west-temple',name:'Western Temple',kind:'temple',armies:{},neighbors:['west-desert'],x:16,y:32},
  {id:'east-temple',name:'Eastern Temple',kind:'temple',armies:{},neighbors:['east-desert'],x:84,y:32},
  {id:'north-temple',name:'Northern Temple',kind:'temple',armies:{},neighbors:['north-desert'],x:50,y:76}
];
export function newGame(): GameState { return {roomCode:Math.random().toString(36).slice(2,6).toUpperCase(),started:false,round:1,players:[],territories:structuredClone(baseTerritories),log:[]}; }
export function addPlayer(state:GameState,name:string,id:string): Player {
  if(state.started) throw new Error('Game already started.');
  if(state.players.length>=3) throw new Error('This prototype supports exactly 3 players.');
  const p:Player={id,name:name.trim()||`Player ${state.players.length+1}`,color:colors[state.players.length],prayer:7,connected:true}; state.players.push(p); return p;
}
export function startGame(state:GameState,caller:string){
  if(state.players[0]?.id!==caller) throw new Error('Only the first player can start.');
  if(state.players.length!==3) throw new Error('Three players must join first.');
  state.started=true; state.activePlayerId=state.players[0].id;
  state.players.forEach(p=>{const t=state.territories.find(t=>t.id===`${p.color}-city`)!;t.ownerId=p.id;t.armies[p.id]=5;});
  log(state,`${state.players[0].name} started the game.`);
}
export function recruit(state:GameState,pid:string,territoryId:string,units:number){
  turnCheck(state,pid); if(!Number.isInteger(units)||units<1) throw new Error('Units must be a positive whole number.');
  const p=player(state,pid), t=territory(state,territoryId); if(t.kind!=='city'||t.ownerId!==pid) throw new Error('Recruit only in your own city.');
  if(p.prayer<units) throw new Error('Not enough prayer points.'); if((t.armies[pid]||0)+units>10) throw new Error('Army limit is 10 in this prototype.');
  p.prayer-=units;t.armies[pid]=(t.armies[pid]||0)+units;log(state,`${p.name} recruited ${units} unit${units===1?'':'s'} in ${t.name}.`);
}
export function move(state:GameState,pid:string,fromId:string,toId:string,units:number){
  turnCheck(state,pid);if(!Number.isInteger(units)||units<1)throw new Error('Units must be a positive whole number.');
  const p=player(state,pid),from=territory(state,fromId),to=territory(state,toId);if(!from.neighbors.includes(to.id))throw new Error('Territories are not adjacent.');
  if((from.armies[pid]||0)<units)throw new Error('Not enough units in the origin.');
  const enemies=Object.entries(to.armies).filter(([id,n])=>id!==pid&&n>0);if(enemies.length)throw new Error('Combat is not implemented in v0.1. Move blocked.');
  if((to.armies[pid]||0)+units>10)throw new Error('Army limit is 10 in this prototype.');
  from.armies[pid]-=units;to.armies[pid]=(to.armies[pid]||0)+units;log(state,`${p.name} moved ${units} unit${units===1?'':'s'} from ${from.name} to ${to.name}.`);
}
export function endTurn(state:GameState,pid:string){turnCheck(state,pid);const i=state.players.findIndex(p=>p.id===pid);const next=(i+1)%state.players.length;if(next===0)state.round++;state.activePlayerId=state.players[next].id;state.players[next].prayer+=2;log(state,`${state.players[i].name} ended their turn. ${state.players[next].name} is active.`);}
function turnCheck(s:GameState,id:string){if(!s.started)throw new Error('Game has not started.');if(s.activePlayerId!==id)throw new Error('It is not your turn.');}
function player(s:GameState,id:string){const p=s.players.find(x=>x.id===id);if(!p)throw new Error('Player not found.');return p;}
function territory(s:GameState,id:string){const t=s.territories.find(x=>x.id===id);if(!t)throw new Error('Territory not found.');return t;}
export function log(s:GameState,text:string){s.log.unshift({id:crypto.randomUUID(),text,at:new Date().toISOString()});s.log=s.log.slice(0,100);}
