import test from 'node:test';
import assert from 'node:assert/strict';
import { Journey, initialVisit, restoreJourney, traceLight, memoryLine } from '../src/encounters.js';
import { VARIATIONS, POST_STORIES, REPAIR_STORIES, variation, visibleVariationLabel } from '../src/variations.js';
import { seededRandom } from '../src/experience.js';
import { illustration, interaction } from '../src/encounter-views.js';

function specific(id, profile=VARIATIONS[id][0].id, seed=1) {
  let serial=0;
  const j=new Journey(null,seededRandom(seed),()=>`new-${++serial}`);
  j.data.pending=initialVisit(id,seed,`first-${id}`,profile);j.open();return j;
}

test('every scene exhausts its own variation pool before repeating, across several rounds',()=>{
  for(const [id,profiles] of Object.entries(VARIATIONS))for(let seed=0;seed<20;seed++){
    const j=specific(id,profiles[0].id,seed);let previous='';
    for(let round=0;round<3;round++){
      const keys=[];
      for(let i=0;i<profiles.length;i++){
        assert.equal(j.current.id,id);assert.notEqual(j.current.variationId,previous);
        previous=j.current.variationId;keys.push(previous);j.sameScene();j.open();
      }
      assert.equal(new Set(keys).size,profiles.length);
    }
  }
});
test('all eighteen postcard responses match their person, letter and later card',()=>{
  for(const profile of POST_STORIES)for(const [key,content] of Object.entries(profile.choices)){
    const j=specific('postoffice',profile.id);
    assert.ok(interaction(j.current).includes(profile.name));assert.ok(interaction(j.current).includes(profile.opening));
    j.act('post-choice',key);assert.ok(interaction(j.current).includes(content.reply));
    j.act('deliver');const first=j.current.uid;assert.ok(memoryLine(j.current).includes(content.line));
    j.sameScene();j.open();assert.notEqual(j.current.variationId,profile.id);
    j.revisit(first);assert.ok(interaction(j.current).includes(content.later));
    assert.ok(restoreJourney(j.serialize()));
  }
});
test('repair shop circumstances retain the matching reasons and followup',()=>{
  for(const profile of REPAIR_STORIES)for(const [key,content] of Object.entries(profile.choices)){
    const j=specific('repair',profile.id);j.act('listen');assert.ok(interaction(j.current).includes(profile.heard));
    j.act('bell-choice',key);j.act('wind');const uid=j.current.uid;j.next();j.revisit(uid);
    assert.ok(interaction(j.current).includes(content.later));assert.ok(restoreJourney(j.serialize()));
  }
});
test('natural variations present different events with no required action',()=>{
  for(const id of ['seaside','rooftop'])for(const profile of VARIATIONS[id]){
    const j=specific(id,profile.id);j.tick(j.current.eventAt);
    assert.ok(interaction(j.current).includes(profile.eventText));assert.ok(illustration(j.current).includes(profile.label));
    assert.ok(memoryLine(j.current).includes(profile.eventName));assert.ok(restoreJourney(j.serialize()));
  }
});
test('quiet arrivals do not reveal a future event in their labels or illustration descriptions',()=>{
  for(const id of ['seaside','rooftop'])for(const profile of VARIATIONS[id]){
    const j=specific(id,profile.id);
    assert.notEqual(visibleVariationLabel(j.current),profile.label);
    assert.ok(!illustration(j.current).includes(profile.label));
    assert.ok(!interaction(j.current).includes(profile.eventText));
    j.tick(17);assert.equal(visibleVariationLabel(j.current),profile.label);
  }
});
test('the paper plane can be read only after landing, and old paper notes survive a new encounter',()=>{
  const j=specific('rooftop','plane');assert.equal(j.act('read-plane'),false);
  j.act('hang','把今天留在这里');j.tick(17);assert.equal(j.act('read-plane'),true);
  const uid=j.current.uid;j.sameScene();j.open();assert.equal(j.current.state.hung,false);
  assert.equal(j.act('read-plane'),false);j.revisit(uid);
  assert.equal(j.current.state.note,'把今天留在这里');assert.equal(j.current.state.eventRead,true);
  assert.ok(interaction(j.current).includes(variation(j.current).paper));
});
test('six different light paths are solvable and only the correct pair of mirror orientations wins',()=>{
  const paths=[];
  for(const profile of VARIATIONS.greenhouse){
    const j=specific('greenhouse',profile.id),s=j.current.state;
    paths.push(JSON.stringify([profile.start,profile.mirrors,profile.target]));
    for(const a of [0,1])for(const b of [0,1]){s.mirrors=[a,b];s.solved=traceLight(s).solved;assert.equal(s.solved,!!(a&&b));}
    assert.ok(restoreJourney(j.serialize()));assert.ok(illustration(j.current));
  }
  assert.equal(new Set(paths).size,6);
});
test('refresh and revisit never reroll a waiting same-scene encounter or mutate the old story',()=>{
  const j=specific('postoffice','apology');j.act('post-choice','own');j.act('deliver');const uid=j.current.uid;
  j.sameScene();const pending=structuredClone(j.data.pending),old=structuredClone(j.data.visits[0]);
  const restored=new Journey(restoreJourney(j.serialize()));assert.deepEqual(restored.data.pending,pending);
  restored.revisit(uid);restored.next();assert.deepEqual(restored.data.pending,pending);
  assert.equal(restored.data.visits[0].state.choice,old.state.choice);
  restored.open();assert.notEqual(restored.current.uid,uid);assert.equal(restored.current.state.choice,'');
});
test('0.3 records migrate to their original story, event and light path without losing progress',()=>{
  const j=specific('postoffice');j.act('post-choice','home');j.act('deliver');
  const greenhouse=initialVisit('greenhouse',8,'old-green','east');greenhouse.state.mirrors=[1,1];greenhouse.state.solved=true;
  j.data.visits.push(greenhouse);j.data.opened=2;
  j.data.pending=initialVisit('rooftop',6,'old-roof');
  for(const visit of [...j.data.visits,j.data.pending]){delete visit.variationId;delete visit.state.layoutId;delete visit.state.eventRead;}
  delete j.data.variantBags;delete j.data.doorScene;
  const migrated=restoreJourney(j.serialize());assert.ok(migrated);
  assert.equal(migrated.visits[0].variationId,'departure');assert.equal(migrated.visits[0].state.choice,'home');
  assert.equal(migrated.visits[1].variationId,'east');assert.equal(traceLight(migrated.visits[1].state).solved,true);
  assert.equal(migrated.pending.variationId,'wind');assert.equal(migrated.pending.state.eventRead,false);
});
test('unpinning a known location returns to random doors; incompatible stored choices are rejected',()=>{
  const j=specific('postoffice','apology');j.sameScene();assert.equal(j.data.doorScene,'postoffice');
  j.randomDoor();assert.equal(j.data.doorScene,null);assert.ok(j.data.pending);
  const data=JSON.parse(j.serialize());data.visits[0].state.choice='home';assert.equal(restoreJourney(JSON.stringify(data)),null);
});
