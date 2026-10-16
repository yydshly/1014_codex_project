import test from 'node:test';
import assert from 'node:assert/strict';
import { createEncounter, Experience, validEncounter, WEATHERS } from '../src/experience.js';

test('random next door avoids the immediately previous weather', () => {
  for (const weather of WEATHERS) for (let seed = 0; seed < 80; seed++) {
    assert.notEqual(createEncounter({ previousWeather: weather.id, seed }).weatherId, weather.id);
  }
});
test('an explicit weather is respected even when it matches the previous visit', () => {
  assert.equal(createEncounter({ previousWeather: 'night-rain', requestedWeather: 'night-rain', seed: 10 }).weatherId, 'night-rain');
});
test('boat appears after natural waiting without sitting or catching rain', () => {
  const visit = new Experience(createEncounter({ seed: 11 }));
  visit.advance(200); assert.equal(visit.elapsed, 0); assert.equal(visit.boatVisible, false);
  visit.enter(); visit.advance(visit.encounter.boatDelay + 1);
  assert.equal(visit.boatVisible, true);
  visit.advance(visit.encounter.boatDuration); assert.equal(visit.boatVisible, false);
});
test('waiting and actions do not reroll the weather or natural boat time', () => {
  const visit = new Experience(createEncounter({ seed: 300 }));
  const original = visit.snapshot(); visit.enter(); visit.catching = true; visit.seated = true; visit.advance(45);
  assert.deepEqual(visit.snapshot(), original);
});
test('a saved encounter restores the same weather and schedule with a fresh visit', () => {
  const original = new Experience(createEncounter({ seed: 1000 })); original.enter(); original.advance(90);
  const restored = new Experience(JSON.parse(JSON.stringify(original.snapshot())));
  assert.deepEqual(restored.snapshot(), original.snapshot()); assert.equal(restored.elapsed, 0);
});
test('previewing the boat makes it visible without changing the saved encounter', () => {
  const visit = new Experience(createEncounter({ seed: 7 })); const saved = visit.snapshot();
  visit.enter(); visit.inviteBoat(); assert.equal(visit.boatVisible, true); assert.deepEqual(visit.snapshot(), saved);
});
test('invalid persisted weather, timing and seed are rejected', () => {
  const original = createEncounter({ seed: 10 }); assert.equal(validEncounter(original), true);
  for (const value of [{ ...original, weatherId: 'storm' }, { ...original, boatDelay: NaN }, { ...original, seed: -1 }, null]) assert.equal(validEncounter(value), false);
});
