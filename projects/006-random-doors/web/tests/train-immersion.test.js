import test from 'node:test';
import assert from 'node:assert/strict';
import {WorldJourney,createVisit,reduceVisit,configFor,WORLDS,PEOPLE,missionComplete,seeded} from '../src/world-engine.js';
import {trainRoutes,trainScene,personCar} from '../src/train-engine.js';
import {renderTrain} from '../src/train-view.js';
const change=(v,a)=>reduceVisit(v,a);
function reachPerson(v,c,index){
  if(v.state.car!==personCar(c,index))v=change(v,{type:'travel',route:'walk'});
  return change(v,{type:v.role==='conductor'?'ticket':'talk',person:PEOPLE[index].id});
}
function findClue(v){
  v=change(v,{type:'awake'});
  if(v.role==='cat'){
    v=change(v,{type:'travel',route:'duck'});v=change(v,{type:'travel',route:'crawl'});
    v=change(v,{type:'sniff'});v=change(v,{type:'take'});
    v=change(v,{type:'travel',route:'back'});return change(v,{type:'travel',route:'out'});
  }
  if(v.role==='conductor'){
    v=change(v,{type:'travel',route:'cab'});v=change(v,{type:'inspect'});v=change(v,{type:'take'});v=change(v,{type:'announce'});return change(v,{type:'travel',route:'out'});
  }
  v=change(v,{type:'remember'});v=change(v,{type:'take'});v=change(v,{type:'travel',route:'walk'});return change(v,{type:'remember'});
}
test('all train identities complete every seeded owner and item through their own physical route',()=>{
  for(let seed=0;seed<45;seed++)for(const role of WORLDS.train.roles){
    let v=createVisit('train',seed,role);const c=configFor(v);v=findClue(v);
    assert.ok(v.state.clue);assert.ok(v.state.claimed);
    v=reachPerson(v,c,(c.owner+1)%3);v=change(v,{type:'deliver'});assert.equal(v.state.done,false);assert.ok(v.state.claimed);
    v=reachPerson(v,c,c.owner);v=change(v,{type:'deliver'});
    if(role==='conductor'){
      assert.equal(v.state.done,false);assert.ok(v.state.delivered);
      if(v.state.car===2)v=change(v,{type:'travel',route:'walk'});
      v=change(v,{type:'travel',route:'cab'});v=change(v,{type:'depart'});assert.equal(v.state.done,false);
      v=change(v,{type:'doors'});v=change(v,{type:'depart'});
    }
    assert.ok(missionComplete(v),`${seed} ${role}`);
  }
});
test('bodies enforce inaccessible spaces and generic car shortcuts cannot bypass them',()=>{
  for(const role of ['cat','passenger']){
    let v=change(createVisit('train',7,role),{type:'awake'});
    v=change(v,{type:'travel',route:'cab'});assert.notEqual(v.state.place,'cab');
    v=change(v,{type:'car',car:0});assert.notEqual(v.state.car,0);
    v=change(v,{type:'inspect'});assert.equal(v.state.clue,false);
  }
  let v=change(createVisit('train',7,'conductor'),{type:'awake'});
  v=change(v,{type:'travel',route:'duck'});assert.equal(v.state.place,'aisle');
  v=change(createVisit('train',7,'passenger'),{type:'awake'});
  v=change(v,{type:'car',car:3});assert.notEqual(v.state.car,3);
});
test('a cat must crouch and crawl to reach an object; staff actions grant it no human privileges',()=>{
  let v=change(createVisit('train',5,'cat'),{type:'awake'});
  v=change(v,{type:'take'});assert.equal(v.state.claimed,false);
  v=change(v,{type:'doors'});assert.equal(v.state.doorsClosed,false);
  v=change(v,{type:'travel',route:'duck'});assert.equal(v.state.place,'underseat');
  v=change(v,{type:'travel',route:'crawl'});assert.equal(v.state.car,3);
  v=change(v,{type:'take'});assert.equal(v.state.claimed,false);
  v=change(v,{type:'sniff'});v=change(v,{type:'take'});assert.ok(v.state.claimed);
});
test('passengers piece together two situated memories; conductors actually control lamps and doors',()=>{
  let v=change(createVisit('train',2,'passenger'),{type:'awake'});
  v=change(v,{type:'travel',route:'walk'});v=change(v,{type:'remember'});assert.equal(v.state.clue,false);
  v=change(v,{type:'travel',route:'walk'});v=change(v,{type:'remember'});assert.equal(v.state.memoryStep,1);
  v=change(v,{type:'travel',route:'walk'});v=change(v,{type:'remember'});assert.ok(v.state.clue);
  v=change(createVisit('train',2,'conductor'),{type:'awake'});v=change(v,{type:'light'});assert.equal(v.state.lightOn,false);
  v=change(v,{type:'travel',route:'cab'});v=change(v,{type:'doors'});assert.ok(v.state.doorsClosed);
});
test('every body renders a distinct first-person scene, situated actions and an awakening',()=>{
  const scenes=new Set();
  for(const role of WORLDS.train.roles){
    let v=createVisit('train',4,role);const c=configFor(v);assert.match(renderTrain(v,c,1),/train-awakening/);
    v=change(v,{type:'awake'});const html=renderTrain(v,c,1);scenes.add(trainScene(v));
    assert.match(html,new RegExp(`data-identity="${role}"`));assert.ok(html.includes(`train-v09/${trainScene(v)}.webp`));
    assert.equal(html.includes('car-selector'),false);assert.equal(html.includes('identity-panel'),false);
  }
  assert.equal(scenes.size,3);
});
test('old memories retain completed results and new private-space progress survives refresh',()=>{
  const old={version:1,phase:'inside',current:'old-cat',visits:[{uid:'old-cat',world:'train',role:'cat',seed:17,state:{car:3,clue:true,claimed:true,done:true,talked:['keeper'],selected:'keeper',log:['旧经历']}}]};
  const restored=new WorldJourney(old);assert.ok(restored.current.state.done);assert.ok(restored.current.state.clue);assert.ok(restored.current.state.legacyComplete);
  assert.equal(configFor(restored.current).owner,configFor(old.visits[0]).owner);
  const j=new WorldJourney(null,seeded(15));j.prepare('train');j.enter();j.act({type:'awake'});
  j.act({type:'travel',route:trainRoutes(j.current)[0].id});
  assert.deepEqual(new WorldJourney(j.serialize()).current,j.current);
});
