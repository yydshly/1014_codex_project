import test from 'node:test';
import assert from 'node:assert/strict';
import { STATIC_DEPLOYMENT, staticExecutionState } from '../shared/deployment.js';
test('本地默认保留真实服务；公开状态明确预设与无真实任务',()=>{
  assert.equal(STATIC_DEPLOYMENT,false);
  for(const running of [false,true]){
    const state=staticExecutionState(running); assert.equal(state.kind,'demo');
    assert.match(state.label,/Pages.*无真实任务/); assert.match(state.detail,/本地 Node 服务/);
  }
  assert.match(staticExecutionState(true).label,/演示中/);
});
