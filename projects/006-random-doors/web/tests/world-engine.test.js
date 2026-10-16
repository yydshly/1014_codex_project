import test from 'node:test';
import assert from 'node:assert/strict';
import {WorldJourney,createVisit,reduceVisit,configFor,WORLDS,WORLD_IDS,ROLES,PEOPLE,LAWS,MUSEUM_BLOCKS,availableAxes,missionComplete,genesisOutcome,restoreWorlds,seeded} from '../src/world-engine.js';

test('worlds rotate without replacement and avoid an immediate repeat at the round boundary',()=>{
  const j=new WorldJourney(null,seeded(2048)),seen=[];
  for(let i=0;i<30;i++){const v=j.enter();seen.push(v.world);assert.ok(WORLDS[v.world].roles.includes(v.role));j.prepare();}
  for(let i=0;i<seen.length;i+=3)assert.equal(new Set(seen.slice(i,i+3)).size,3);
  for(let i=1;i<seen.length;i++)assert.notEqual(seen[i],seen[i-1]);
});
test('reentering one world keeps its seed, changes identity, and preserves the old actions',()=>{
  const j=new WorldJourney(null,seeded(1));j.prepare('museum');const a=j.enter();j.act({type:'move',dx:1,dy:0});
  const old=structuredClone(j.current),b=j.repeatIdentity();assert.notEqual(a.role,b.role);assert.equal(a.seed,b.seed);assert.deepEqual(configFor(a),configFor(b));
  assert.deepEqual(j.data.visits.find(v=>v.uid===old.uid),old);assert.notEqual(old.uid,b.uid);
});
test('refresh restores the active identity, exact progress and pending random door',()=>{
  const j=new WorldJourney(null,seeded(5));j.prepare('train');j.enter();j.act({type:'car',car:3});
  let restored=new WorldJourney(j.serialize(),()=>{throw new Error('should not redraw on refresh');});
  assert.equal(restored.data.phase,'inside');assert.deepEqual(restored.current,j.current);
  j.prepare('museum');const pending=structuredClone(j.data.pending);j.revisit(j.data.visits[0].uid);
  restored=new WorldJourney(j.serialize(),()=>{throw new Error('should keep pending door');});
  assert.deepEqual(restored.data.pending,pending);assert.equal(restored.current.state.car,3);
});
test('all role/world combinations are compatible; malformed saves are sanitized',()=>{
  assert.throws(()=>createVisit('museum',1,'god'));
  assert.equal(restoreWorlds('{broken'),null);
  const raw={version:1,visits:[{uid:'unsafe',world:'museum',role:'hush',seed:3,state:{x:-500,y:700,charges:99,turn:-1,log:['<script>']}}],current:'unsafe',phase:'inside'};
  const safe=restoreWorlds(raw);assert.equal(safe.visits[0].state.x,0);assert.equal(safe.visits[0].state.charges,2);
});
function path(from,to){
  const queue=[[from,[]]],seen=new Set([from.join()]);
  while(queue.length){const [p,steps]=queue.shift();if(p[0]===to[0]&&p[1]===to[1])return steps;
    for(const [dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){
      const n=[p[0]+dx,p[1]+dy];if(n[0]<0||n[0]>8||n[1]<0||n[1]>5||seen.has(n.join())||MUSEUM_BLOCKS.some(b=>b[0]===n[0]&&b[1]===n[1]))continue;
      seen.add(n.join());queue.push([n,[...steps,[dx,dy]]]);
    }
  }throw new Error('No museum route');
}
test('museum objectives are reachable for both identities across layout and weather variants',()=>{
  for(let seed=1;seed<=40;seed++)for(const role of WORLDS.museum.roles){
    let v=createVisit('museum',seed,role);const c=configFor(v);
    for(const [dx,dy]of path([0,5],c.target)){v=reduceVisit(v,{type:'move',dx,dy});if(v.state.alert)v=reduceVisit(v,{type:'wait'});}
    v=reduceVisit(v,{type:'interact'});assert.ok(v.state.obtained);
    for(const [dx,dy]of path([v.state.x,v.state.y],[0,5])){v=reduceVisit(v,{type:'move',dx,dy});if(v.state.alert)v=reduceVisit(v,{type:'wait'});}
    v=reduceVisit(v,{type:'interact'});assert.ok(missionComplete(v));
  }
});
test('museum identity changes actual movement; blocked jumps do not consume a charge',()=>{
  let hush=createVisit('museum',1,'hush'),shade=createVisit('museum',1,'shade');
  hush=reduceVisit(reduceVisit(hush,{type:'ability'}),{type:'move',dx:1,dy:0});
  shade=reduceVisit(reduceVisit(shade,{type:'ability'}),{type:'move',dx:1,dy:0});
  assert.equal(hush.state.x,1);assert.equal(shade.state.x,2);assert.equal(shade.state.charges,1);
  shade.state.x=0;shade.state.y=1;shade=reduceVisit(shade,{type:'ability'});shade=reduceVisit(shade,{type:'move',dx:1,dy:0});
  assert.equal(shade.state.x,0);assert.equal(shade.state.charges,1);
});
test('actions are deterministic; waiting advances a visible patrol without fresh randomness',()=>{
  const v=createVisit('museum',18,'hush');assert.deepEqual(reduceVisit(v,{type:'move',dx:1,dy:0}),reduceVisit(v,{type:'move',dx:1,dy:0}));
  const moved=reduceVisit(v,{type:'wait'});assert.equal(moved.state.turn,1);assert.equal(v.state.turn,0);
});
test('all train identities can find and return every variant, using different access points',()=>{
  for(let seed=0;seed<35;seed++)for(const role of WORLDS.train.roles){
    let v=createVisit('train',seed,role);const c=configFor(v),needed={cat:3,conductor:0,passenger:1}[role];
    v=reduceVisit(v,{type:'car',car:(needed+1)%4});v=reduceVisit(v,{type:'inspect'});assert.equal(v.state.clue,false);
    v=reduceVisit(v,{type:'car',car:needed});v=reduceVisit(v,{type:'inspect'});assert.ok(v.state.clue);
    const wrong=(c.owner+1)%3;v=reduceVisit(v,{type:'car',car:c.order.indexOf(wrong)+1});v=reduceVisit(v,{type:'talk',person:PEOPLE[wrong].id});v=reduceVisit(v,{type:'deliver'});assert.equal(v.state.done,false);
    v=reduceVisit(v,{type:'car',car:c.order.indexOf(c.owner)+1});v=reduceVisit(v,{type:'talk',person:PEOPLE[c.owner].id});v=reduceVisit(v,{type:'deliver'});assert.ok(missionComplete(v));
  }
});
test('creator goals always match identity permissions; every goal has an observable solution',()=>{
  for(let seed=0;seed<35;seed++)for(const role of WORLDS.genesis.roles){
    let v=createVisit('genesis',seed,role);const c=configFor(v);assert.ok(availableAxes(v).includes(c.axis));
    v=reduceVisit(v,{type:'law',axis:c.axis,value:c.goal.success});assert.equal(missionComplete(v),false);
    v=reduceVisit(v,{type:'advance'});assert.ok(missionComplete(v));assert.ok(genesisOutcome(v).safe);
    v=reduceVisit(v,{type:'seal'});assert.ok(v.state.done);
  }
});
test('a keeper cannot alter gravity; a new law replaces rather than stacks the old one',()=>{
  let v=createVisit('genesis',1,'keeper');v=reduceVisit(v,{type:'law',axis:'gravity',value:'light'});assert.equal(v.state.axis,null);
  v=createVisit('genesis',1,'god');v=reduceVisit(v,{type:'law',axis:'gravity',value:'light'});v=reduceVisit(v,{type:'advance'});assert.ok(genesisOutcome(v).connected);
  v=reduceVisit(v,{type:'law',axis:'time',value:'pause'});v=reduceVisit(v,{type:'advance'});assert.equal(genesisOutcome(v).connected,false);assert.equal(v.state.axis,'time');
});
test('unmet creator goals can be saved as an honest incomplete outcome; finished worlds do not mutate',()=>{
  let v=createVisit('genesis',7,'weaver');v=reduceVisit(v,{type:'law',axis:'gravity',value:'reverse'});v=reduceVisit(v,{type:'advance'});assert.equal(genesisOutcome(v).safe,false);
  v=reduceVisit(v,{type:'seal'});assert.ok(v.state.done);assert.equal(missionComplete(v),false);assert.deepEqual(reduceVisit(v,{type:'law',axis:'gravity',value:'light'}),v);
});
