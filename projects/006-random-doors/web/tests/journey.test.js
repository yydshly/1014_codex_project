import test from 'node:test';
import assert from 'node:assert/strict';
import { Journey, ENCOUNTERS, initialVisit, restoreJourney, traceLight, memoryLine, POST_CHOICES, BELL_CHOICES } from '../src/encounters.js';
import { seededRandom } from '../src/experience.js';
import { illustration, interaction } from '../src/encounter-views.js';

function create(seed=1){let id=0;return new Journey(null,seededRandom(seed),()=>`visit-${++id}`);}
function specific(id,seed=1){const journey=create(seed);journey.data.pending=initialVisit(id,seed,`specific-${id}`);journey.open();return journey;}

test('each unrestricted round visits six different encounters and avoids an immediate repeat',()=>{
  for(let seed=0;seed<80;seed++){
    const j=create(seed);let previous='';
    for(let round=0;round<3;round++){
      const seen=[];
      for(let n=0;n<6;n++){const v=j.open();assert.notEqual(v.id,previous);seen.push(v.id);previous=v.id;j.next();}
      assert.equal(new Set(seen).size,6);
    }
  }
});
test('a chosen range gives both encounters before repeating, without exposing unrelated kinds',()=>{
  for(const scope of ['quiet','story','challenge']){
    const j=create(7);j.setScope(scope);const sequence=[];
    for(let n=0;n<8;n++){const v=j.open();sequence.push(v.id);assert.equal(ENCOUNTERS.find(e=>e.id===v.id).kind,scope);j.next();}
    for(let n=1;n<8;n++)assert.notEqual(sequence[n],sequence[n-1]);
  }
});
test('refreshing a closed door preserves the pending encounter, seed and remaining round',()=>{
  const j=create(29);j.open();j.next();const pending=structuredClone(j.data.pending);
  const restored=new Journey(restoreJourney(j.serialize()));
  assert.deepEqual(restored.data.pending,pending);assert.deepEqual(restored.data.remaining,j.data.remaining);
  restored.next();assert.deepEqual(restored.data.pending,pending);
});
test('revisiting preserves a choice and unfinished progress without consuming a pending door',()=>{
  const j=specific('postoffice');j.act('post-choice','home');const uid=j.current.uid;
  j.next();const remaining=[...j.data.remaining],pending=structuredClone(j.data.pending);
  j.revisit(uid);assert.equal(j.current.state.choice,'home');assert.equal(j.current.state.delivered,false);
  assert.equal(j.current.returns,1);assert.deepEqual(j.data.remaining,remaining);assert.deepEqual(j.data.pending,pending);
  const restored=new Journey(restoreJourney(j.serialize()));assert.equal(restored.current.state.choice,'home');
  restored.act('deliver');assert.equal(restored.current.state.followup,false);
  restored.next();assert.deepEqual(restored.data.pending,pending);
  restored.revisit(uid);assert.equal(restored.current.state.followup,true);
});
test('all postcard responses retain their own letter and corresponding return note',()=>{
  for(const [choice,content] of Object.entries(POST_CHOICES)){
    const j=specific('postoffice');j.act('post-choice',choice);j.act('deliver');j.act('post-choice','scenery');
    assert.equal(j.current.state.choice,choice);assert.ok(memoryLine(j.current).includes(content.line));
    const uid=j.current.uid;j.next();j.revisit(uid);assert.ok(interaction(j.current).includes(content.later));
  }
});
test('both wooden bird choices create stable outcomes and different return notes',()=>{
  for(const [choice,content] of Object.entries(BELL_CHOICES)){
    const j=specific('repair');j.act('wind');assert.equal(j.current.state.wound,false);
    j.act('listen');j.act('bell-choice',choice);j.act('wind');const uid=j.current.uid;
    j.next();j.revisit(uid);assert.equal(j.current.state.wound,true);assert.ok(interaction(j.current).includes(content.later));
  }
});
test('quiet events arrive without actions and persist with paper notes on return',()=>{
  for(const id of ['seaside','rooftop']){
    const j=specific(id);j.tick(j.current.eventAt-.1);assert.equal(j.current.state.eventSeen,false);
    j.tick(.2);assert.equal(j.current.state.eventSeen,true);
    if(id==='rooftop')j.act('hang','今天先到这里');
    const uid=j.current.uid;j.next();j.revisit(uid);assert.equal(j.current.state.eventSeen,true);
    if(id==='rooftop')assert.equal(j.current.state.note,'今天先到这里');
  }
});
test('both mirror layouts have a visible causal light path and solve in either order',()=>{
  for(const flipped of [false,true])for(const order of [['mirror-a','mirror-b'],['mirror-b','mirror-a']]){
    const j=specific('greenhouse');j.current.state.flipped=flipped;
    assert.equal(traceLight(j.current.state).solved,false);
    for(const action of order)j.act(action);
    assert.equal(traceLight(j.current.state).solved,true);assert.equal(j.current.state.solved,true);
    assert.ok(restoreJourney(j.serialize()));
  }
});
test('every seeded star puzzle starts unsolved and can be solved with at most nine turns',()=>{
  for(let seed=0;seed<80;seed++){
    const j=specific('observatory',seed),s=j.current.state;assert.equal(s.solved,false);let turns=0;
    for(let i=0;i<3;i++)while(s.rings[i]!==s.targets[i]){j.act(`ring-${i}`);assert.ok(++turns<=9);}
    assert.equal(s.solved,true);assert.ok(restoreJourney(j.serialize()));
  }
});
test('all six encounters render, escape user notes and reject broken persisted records',()=>{
  for(const e of ENCOUNTERS){const j=specific(e.id);assert.ok(illustration(j.current).includes(`art/${e.id}.webp`));assert.ok(interaction(j.current));assert.ok(restoreJourney(j.serialize()));}
  const j=specific('rooftop');j.act('hang','<img src=x onerror=x>');assert.ok(!illustration(j.current).includes('<img src=x'));assert.ok(illustration(j.current).includes('&lt;img src=x onerror=x&gt;'));
  const raw=JSON.parse(j.serialize());raw.visits[0].id='unknown';assert.equal(restoreJourney(JSON.stringify(raw)),null);
  assert.equal(restoreJourney('not json'),null);
});
