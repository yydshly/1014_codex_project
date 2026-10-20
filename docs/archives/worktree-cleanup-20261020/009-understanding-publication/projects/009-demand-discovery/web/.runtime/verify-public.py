from pathlib import Path
from urllib.request import Request,urlopen
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime,timezone
from html.parser import HTMLParser
import hashlib,json

root=Path(__file__).resolve().parents[4]
site=root/'_site'
base='https://yydshly.github.io/1014_codex_project/'
project='009-demand-discovery/'
files=sorted(p.relative_to(site).as_posix() for p in (site/project).rglob('*') if p.is_file())
files+=['index.html','projects.json','entries.json',
 'projects/009-demand-discovery/README.md','projects/009-demand-discovery/RESEARCH.md','projects/009-demand-discovery/assets/understanding-map.png',
 '004-jasonzhu-ai/research.html','006-random-doors/research.html','007-autumn-courtyard-blender/research.html','010-evidence-research-lab/index.html','014-cyber-xiaoya-study/index.html']
sha=lambda b:hashlib.sha256(b).hexdigest()
bodies={}
def check(name):
 url=base+name
 with urlopen(Request(url,headers={'User-Agent':'ResearchArchiveVerification/009','Cache-Control':'no-cache'}),timeout=30) as response:
  body=response.read();status=response.status;content_type=response.headers.get('Content-Type','')
 assert status==200,(url,status)
 expected=(site/name).read_bytes()
 binary=Path(name).suffix.lower() in ['.png','.webp','.jpg','.glb']
 normalized_equal=body==expected if binary else body.replace(b'\r\n',b'\n')==expected.replace(b'\r\n',b'\n')
 assert normalized_equal,('Public content differs from prepared build',name)
 bodies[name]=body
 return {'url':url,'status':status,'content_type':content_type,'bytes':len(body),'sha256':sha(body),'exact_bytes_equal':body==expected,'text_normalized_equal':normalized_equal}
with ThreadPoolExecutor(max_workers=8) as executor:results=list(executor.map(check,files))
with urlopen(base+project,timeout=30) as response:
 assert response.status==200;body=response.read()
assert body==bodies[project+'index.html']
html=body.decode('utf-8')
class IDs(HTMLParser):
 def __init__(self):super().__init__();self.ids=[];self.links=[]
 def handle_starttag(self,tag,attrs):
  attrs=dict(attrs)
  if attrs.get('id'):self.ids.append(attrs['id'])
  if attrs.get('href','').startswith('#'):self.links.append(attrs['href'][1:])
parser=IDs();parser.feed(html)
assert len(parser.ids)==len(set(parser.ids))
assert set(parser.links)<=set(parser.ids)
for term in ['入口引导','做之前回看','研究 → 实践 → 记录 → 展示 → 接触用户 → 获得反馈 → 更新研究','发现需求 → 验证问题 → 产品化扩展']:
 assert term in html,term
assert b'PUBLIC_STATIC=true' in bodies[project+'mode.js']
report=json.loads(bodies[project+'data/discovery-latest.json'])
assert [len(report[k]) for k in ['people','candidates','sources']]==[3,3,10]
assert any('搁置' in item['decision'] for item in report['candidates'])
catalog=json.loads(bodies['projects.json']);entry=next(p for p in catalog['projects'] if p['id']=='009')
assert entry['source_url']=='https://jasonzhu.ai/'
assert '入口引导' in entry['summary'] and '更新研究' in entry['summary']
assert entry['demo_url']==base+project+'#synthesis'
entrances=json.loads(bodies['entries.json'])['projects']['009'];assert len(entrances)==4
record={
 'project':'009-demand-discovery','verified_at':datetime.now(timezone.utc).isoformat(),
 'source_commit':'6b3d0fd851dcb8204299d18343e2a6f62c03fe09',
 'workflow':{'id':39209216688,'url':'https://github.com/yydshly/1014_codex_project/actions/runs/39209216688','conclusion':'success'},
 'public_url':base+project+'#synthesis','map_url':base+project+'understanding.html',
 'checks':{'http_urls':len(results)+1,'local_file_comparisons':len(results),'html_ids':len(parser.ids),'internal_anchor_links':len(parser.links),'existing_projects_retained':5,'summary_and_cycle_present':True,'public_static_mode':True,'saved_people':3,'saved_candidates':3,'saved_sources':10,'tests_passed':10,'full_site_build':'passed','image_size':[2000,4375]},
 'verification_limits':['本轮浏览器接入被 URL 安全策略拒绝，未做新的视觉与点击验收。','公开静态模式的执行禁用、快照读取与失败路径通过隔离脚本行为测试；HTTP 与字节核对不等于真实浏览器交互。','实验001的10条来源中6条可关联页面打开动作，本地独立逐字核验成功0条，需求与付费未验证。'],
 'results':results,
}
dest=root/'projects/009-demand-discovery/web/.runtime/public-final-check.json'
dest.write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(record['checks'],ensure_ascii=False))
