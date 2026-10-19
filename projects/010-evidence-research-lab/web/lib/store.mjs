import {DatabaseSync} from 'node:sqlite';
import {createHash,randomUUID} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync,renameSync,existsSync,rmSync} from 'node:fs';
import path from 'node:path';

export const hash = value => createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');
export const normalizeText = text => text.replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n').normalize('NFC').trim();
export function canonicalURL(value='') {
  if(!value.trim())return '';
  let u;try{u=new URL(value);}catch{throw new Error('来源链接格式无效');}
  if(!['https:','http:'].includes(u.protocol)||u.username||u.password)throw new Error('来源链接只接受无凭证的 HTTP(S) 地址');
  u.hash='';for(const key of [...u.searchParams.keys()])if(/^(utm_|fbclid|gclid)/i.test(key))u.searchParams.delete(key);
  u.searchParams.sort();return u.href.replace(/\/$/,'');
}
const kinds=['user_self_report','vendor_claim','observed','inferred'];
export function prepareSource(input) {
  if(!input || typeof input!=='object')throw new Error('资料格式无效');
  const text=typeof input.text==='string'?normalizeText(input.text):'';
  if(!text || text.length>50000)throw new Error('每份资料正文须为 1–50000 字');
  const title=typeof input.title==='string'?input.title.trim():'';
  if(!title || title.length>180)throw new Error('资料标题须为 1–180 字');
  if(!kinds.includes(input.kind))throw new Error('请选择资料类型');
  if(!['provided','synthetic'].includes(input.origin))throw new Error('请选择资料属性');
  if(typeof input.permission_note!=='string'||!input.permission_note.trim()||input.permission_note.length>500)throw new Error('请记录资料的使用权或样例说明');
  if(input.cluster_key && (typeof input.cluster_key!=='string'||input.cluster_key.length>120))throw new Error('事件分组须不超过 120 字');
  return {title,text,url:canonicalURL(input.url),kind:input.kind,origin:input.origin,permission_note:input.permission_note.trim(),cluster_key:input.cluster_key?.trim()||'',sha256:hash(text)};
}

export class Store {
  constructor(root) {
    this.root=path.resolve(root);mkdirSync(this.root,{recursive:true});
    this.db=new DatabaseSync(path.join(this.root,'lab.sqlite'));
    this.db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;
      CREATE TABLE IF NOT EXISTS sources (id TEXT PRIMARY KEY, payload TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS evidence (id TEXT PRIMARY KEY, source_id TEXT REFERENCES sources(id) ON DELETE CASCADE, payload TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS experiments (id TEXT PRIMARY KEY, created_at TEXT, status TEXT NOT NULL, payload TEXT NOT NULL);`);
  }
  close(){this.db.close();}
  sources(){return this.db.prepare('SELECT payload FROM sources ORDER BY rowid').all().map(r=>JSON.parse(r.payload));}
  importSources(inputs) {
    if(!Array.isArray(inputs)||!inputs.length||inputs.length>50)throw new Error('每次导入 1–50 份资料');
    const prepared=inputs.map(prepareSource),existing=this.sources(),result=[];
    if(existing.length+prepared.length>100)throw new Error('资料库最多保留 100 份资料');
    this.db.exec('BEGIN');
    try {
      for(const value of prepared) {
        const duplicate=[...existing,...result].find(s=>s.sha256===value.sha256);
        if(duplicate){result.push({...duplicate,duplicate:true});continue;}
        const same=[...existing,...result].find(s=>(value.url && s.url===value.url)||(value.cluster_key && s.cluster_key===value.cluster_key));
        const row={...value,id:`S-${randomUUID().slice(0,8)}`,cluster_id:same?.cluster_id||`G-${randomUUID().slice(0,8)}`,created_at:new Date().toISOString()};
        this.db.prepare('INSERT INTO sources VALUES (?,?)').run(row.id,JSON.stringify(row));result.push(row);
      }
      this.db.exec('COMMIT');return result;
    }catch(error){this.db.exec('ROLLBACK');throw error;}
  }
  evidence(){return this.db.prepare('SELECT payload FROM evidence ORDER BY rowid').all().map(r=>JSON.parse(r.payload));}
  addEvidence(input) {
    const source=this.sources().find(s=>s.id===input.source_id);
    const quote=typeof input.quote==='string'?input.quote:'';
    if(!source || !quote.trim() || !source.text.includes(quote))throw new Error('引文必须逐字存在于所选资料正文中');
    if(typeof input.summary!=='string'||!input.summary.trim()||input.summary.length>2000)throw new Error('请填写不超过 2000 字的解释');
    const start=source.text.indexOf(quote);
    const row={id:`M-${randomUUID().slice(0,8)}`,source_id:source.id,source_sha256:source.sha256,cluster_id:source.cluster_id,quote,summary:input.summary.trim(),role:input.role==='counter'?'counter':'support',kind:source.kind,start,end:start+quote.length,line:source.text.slice(0,start).split('\n').length,review_status:'pending'};
    this.db.prepare('INSERT INTO evidence VALUES (?,?,?)').run(row.id,row.source_id,JSON.stringify(row));return row;
  }
  removeEvidence(id){this.db.prepare('DELETE FROM evidence WHERE id=?').run(id);}
  saveExperiment(exp) {
    this.db.prepare('INSERT INTO experiments VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET status=excluded.status,payload=excluded.payload').run(exp.id,exp.created_at,exp.status,JSON.stringify(exp));
    const dir=this.experimentDir(exp.id);mkdirSync(dir,{recursive:true});
    writeFileSync(path.join(dir,'experiment.tmp'),JSON.stringify(exp,null,2),'utf8');
    renameSync(path.join(dir,'experiment.tmp'),path.join(dir,'experiment.json'));
  }
  experiments(){return this.db.prepare('SELECT payload FROM experiments ORDER BY created_at DESC').all().map(r=>JSON.parse(r.payload));}
  experiment(id){const r=this.db.prepare('SELECT payload FROM experiments WHERE id=?').get(id);if(!r)throw new Error('实验不存在');return JSON.parse(r.payload);}
  experimentDir(id){if(!/^R-[a-f0-9-]{36}$/.test(id))throw new Error('实验编号无效');return path.join(this.root,'runs',id);}
  artifact(id,name,value){const dir=this.experimentDir(id);mkdirSync(dir,{recursive:true});if(!/^[a-zA-Z0-9_.-]+$/.test(name))throw new Error('文件名无效');writeFileSync(path.join(dir,name),typeof value==='string'?value:JSON.stringify(value,null,2),'utf8');}
  removeSource(id) {
    const affected=this.experiments().filter(e=>e.manifest.sources.some(s=>s.id===id));
    for(const exp of affected){const dir=this.experimentDir(exp.id);if(existsSync(dir))rmSync(dir,{recursive:true,force:true});this.db.prepare('DELETE FROM experiments WHERE id=?').run(exp.id);}
    this.db.prepare('DELETE FROM sources WHERE id=?').run(id);return affected.length;
  }
  recover(){for(const exp of this.experiments().filter(e=>e.status==='running')){exp.status='failed';exp.error='服务已重启，此次执行未完成，请重新运行。';exp.progress='执行中断';this.saveExperiment(exp);}}
}
