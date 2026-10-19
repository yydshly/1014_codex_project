import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

async function publicRuntime(snapshotOK=true){
  class Element{
    constructor(){this.children=[];this.dataset={};this.listeners={};this.classList={toggle(){}};}
    append(...children){this.children.push(...children);}
    replaceChildren(...children){this.children=[];this.append(...children);}
    setAttribute(){}
    addEventListener(name,fn){this.listeners[name]=fn;}
    querySelectorAll(){return [];}
  }
  const elements=new Map();
  const get=selector=>{if(!elements.has(selector))elements.set(selector,new Element());return elements.get(selector);};
  const tabs=['people','candidates','process','sources'].map(tab=>Object.assign(new Element(),{dataset:{tab}}));
  get('#live-tabs').querySelectorAll=()=>tabs;
  const controls=[new Element(),new Element()];get('#live-form').querySelectorAll=()=>controls;
  const requests=[];
  const saved=JSON.parse(await readFile(new URL('../../data/discovery-latest.json',import.meta.url),'utf8'));
  const source=(await readFile(new URL('../live.js',import.meta.url),'utf8')).replace("import {PUBLIC_STATIC} from './mode.js';",'const PUBLIC_STATIC=true;');
  const context={document:{querySelector:get,createElement:()=>new Element(),createTextNode:text=>text},location:{href:'https://example.test/009/'},URL,Intl,Date,Set,Blob,setTimeout:()=>{throw new Error('公开档案不应启动轮询');},clearTimeout(){},fetch:async(url,options)=>{requests.push({url:String(url),method:options?.method||'GET'});return {ok:snapshotOK,json:async()=>saved};}};
  vm.runInNewContext(source,context);
  await new Promise(resolve=>setImmediate(resolve));
  return {get,requests,controls,context};
}

test('公开档案只读静态快照，显示结果，禁用执行且无 API 请求或轮询',async()=>{
  const {get,requests,controls,context}=await publicRuntime();
  assert.deepEqual(requests,[{url:'./data/discovery-latest.json',method:'GET'}]);
  assert.equal(get('#live-start').disabled,true);assert.equal(get('#live-refresh').hidden,true);
  assert.equal(get('#live-people-count').textContent,3);assert.equal(get('#live-candidate-count').textContent,3);
  assert.equal(get('#live-source-count').textContent,10);assert.equal(get('#live-export').disabled,false);
  assert.ok(controls.every(control=>control.disabled));
  await get('#live-form').listeners.submit({preventDefault(){}});
  await get('#live-refresh').listeners.click();await get('#live-history').listeners.change();
  await assert.rejects(vm.runInNewContext("request('runs',{method:'POST'})",context),/公开档案/);
  assert.equal(requests.length,1);
});

test('公开快照缺失时说明失败，不回退到服务或启动模型',async()=>{
  const {get,requests}=await publicRuntime(false);
  assert.equal(requests.length,1);assert.equal(get('#live-start').disabled,true);
  assert.match(get('#live-progress').children[0].textContent,/实验快照暂未读取成功/);
});
