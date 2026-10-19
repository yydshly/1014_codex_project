"""Render one deterministic Chinese research infographic as PNG and SVG."""
from __future__ import annotations

import html
import json
import math
import re
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets'
WIDTH = 2400
MARGIN = 96
CONTENT = WIDTH - MARGIN * 2
PAPER = '#f6f5ef'
WHITE = '#fffefa'
INK = '#233c38'
MUTED = '#61746c'
GREEN = '#164b48'
GREEN_LIGHT = '#e7efda'
BLUE = '#37647e'
BLUE_LIGHT = '#e8eff4'
AMBER = '#93632a'
AMBER_LIGHT = '#f6ecd9'
LINE = '#d8dfd2'
GRAY = '#758079'
FONT = Path('C:/Windows/Fonts/msyh.ttc')
BOLD = Path('C:/Windows/Fonts/msyhbd.ttc')


class Poster:
    def __init__(self):
        self.ops = []
        self.fonts = {}
        self.issues = []

    def font(self, size, bold=False):
        key = (size, bold)
        if key not in self.fonts:
            self.fonts[key] = ImageFont.truetype(str(BOLD if bold else FONT), size)
        return self.fonts[key]

    def wrap(self, text, width, size=30, bold=False):
        font = self.font(size, bold)
        result = []
        for paragraph in text.split('\n'):
            if not paragraph:
                result.append('')
                continue
            current = ''
            for token in re.findall(r'[A-Za-z0-9_./:@+%-]+|\s+|.', paragraph):
                if current and font.getlength(current + token) > width:
                    result.append(current.rstrip())
                    current = token.lstrip()
                else:
                    current += token
            result.append(current.rstrip())
        return result

    def rect(self, x, y, w, h, fill=WHITE, stroke=LINE, radius=18, line=2):
        self.ops.append(('rect', x, y, w, h, fill, stroke, radius, line))

    def line(self, x1, y1, x2, y2, color=LINE, width=3):
        self.ops.append(('line', x1, y1, x2, y2, color, width))

    def arrow(self, x1, y1, x2, y2, color=GREEN, width=3, head=13, both=False):
        self.line(x1, y1, x2, y2, color, width)
        angle = math.atan2(y2-y1, x2-x1)
        points = [(x2, y2), (x2-head*math.cos(angle-.45), y2-head*math.sin(angle-.45)), (x2-head*math.cos(angle+.45), y2-head*math.sin(angle+.45))]
        self.ops.append(('polygon', points, color))
        if both:
            self.arrow(x2, y2, x1, y1, color, width, head, False)

    def text(self, text, x, y, size=30, fill=INK, bold=False):
        self.ops.append(('text', text, x, y, size, fill, bold))
        right = x + self.font(size, bold).getlength(text)
        if right > WIDTH - 35:
            self.issues.append(f'Text exceeds page width: {text}')
        return y + size * 1.5

    def paragraph(self, text, x, y, width, size=30, fill=MUTED, bold=False, leading=None, bottom=None):
        leading = leading or round(size * 1.55)
        lines = self.wrap(text, width, size, bold)
        for index, line in enumerate(lines):
            self.text(line, x, y + index*leading, size, fill, bold)
        end = y + len(lines)*leading
        if bottom is not None and end > bottom:
            self.issues.append(f'Text exceeds panel by {end-bottom}px: {text}')
        return end

    def center(self, text, cx, y, size=30, fill=INK, bold=False):
        return self.text(text, cx-self.font(size,bold).getlength(text)/2, y, size, fill, bold)

    def pill(self, text, x, y, fill=GREEN_LIGHT, color=GREEN, size=25, width=None):
        width = width or self.font(size).getlength(text)+40
        self.rect(x,y,width,51,fill,fill,12)
        self.center(text,x+width/2,y+8,size,color)
        return width

    def section(self, number, title, y, note=''):
        self.rect(MARGIN,y,66,61,GREEN,GREEN,14)
        self.center(number,MARGIN+33,y+9,31,GREEN_LIGHT,True)
        self.text(title,MARGIN+91,y+3,49,INK,True)
        if note:
            self.paragraph(note,MARGIN+91,y+76,CONTENT-91,28,MUTED,leading=42)
            return y+145
        return y+94

    def block(self, x,y,w,h,title,body,fill=WHITE,accent=GREEN,size=30):
        self.rect(x,y,w,h,fill,LINE,18)
        self.rect(x+26,y+30,6,39,accent,accent,2)
        self.text(title,x+49,y+26,36,INK,True)
        self.paragraph(body,x+31,y+92,w-62,size,MUTED,leading=45,bottom=y+h-22)

    def export(self,height):
        if self.issues:
            raise RuntimeError('\n'.join(self.issues))
        image = Image.new('RGB',(WIDTH,height),PAPER)
        draw = ImageDraw.Draw(image)
        svg = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{WIDTH}" height="{height}" viewBox="0 0 {WIDTH} {height}" role="img" aria-labelledby="title desc">',
               '<title id="title">EdgeChat：从聊天能力，到产品价值——完整研究总结图</title>',
               '<desc id="desc">总结源库能力、使用效果、Cloudflare 架构、消息流程、加密与桥接边界、网页嵌入、六类扩展方向、产品价值及我们保留研究而暂不开发通用聊天产品的阶段性取舍。</desc>',
               f'<rect width="{WIDTH}" height="{height}" fill="{PAPER}"/>']
        text_count = 0
        for op in self.ops:
            if op[0] == 'rect':
                _,x,y,w,h,fill,stroke,radius,line = op
                draw.rounded_rectangle((x,y,x+w,y+h),radius=radius,fill=fill,outline=stroke,width=line)
                svg.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{radius}" fill="{fill}" stroke="{stroke}" stroke-width="{line}"/>')
            elif op[0] == 'line':
                _,x1,y1,x2,y2,color,width = op
                draw.line((x1,y1,x2,y2),fill=color,width=width)
                svg.append(f'<path d="M {x1} {y1} L {x2} {y2}" fill="none" stroke="{color}" stroke-width="{width}"/>')
            elif op[0] == 'polygon':
                _,points,color = op
                draw.polygon(points,fill=color)
                coords=' '.join(f'{x},{y}' for x,y in points)
                svg.append(f'<polygon points="{coords}" fill="{color}"/>')
            else:
                _,text,x,y,size,color,bold = op
                draw.text((x,y),text,font=self.font(size,bold),fill=color,anchor='lt')
                weight='700' if bold else '400'
                svg.append(f'<text x="{x}" y="{y}" font-size="{size}" font-family="Microsoft YaHei, Noto Sans CJK SC, sans-serif" font-weight="{weight}" dominant-baseline="text-before-edge" fill="{color}">{html.escape(text)}</text>')
                text_count += 1
        svg.append('</svg>')
        OUT.mkdir(parents=True,exist_ok=True)
        image.save(OUT/'edgechat-summary.png',optimize=True)
        (OUT/'edgechat-summary.svg').write_text('\n'.join(svg),encoding='utf-8')
        (ROOT/'research/summary-layout.json').write_text(json.dumps({
            'width':WIDTH,'height':height,'text_lines':text_count,'layout_issues':self.issues,
            'method':'Original vector and raster infographic rendered from one scene description; no upstream image or application UI copied.',
            'reference':'EdgeChat 2.16.6 / 5a69f11; RESEARCH.md and the subsequent discussion; 2026-10-15'
        },ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
        print(f'PNG + SVG ready: {WIDTH} x {height}, {text_count} text lines, no measured overflow.')


def build():
    p = Poster()
    p.text('012 / OPEN-SOURCE RESEARCH',MARGIN,73,28,GREEN,True)
    p.text('EdgeChat：从聊天能力，到产品价值',MARGIN,126,79,INK,True)
    p.text('完整聊天应用的能力、效果、原理、扩展与阶段性取舍',MARGIN,241,37,MUTED)
    p.pill('已有实现 / 源码依据',MARGIN,310,GREEN_LIGHT,GREEN)
    p.pill('需要开发 / 候选方向',650,310,BLUE_LIGHT,BLUE)
    p.pill('研究判断 / 需求未验证',1205,310,AMBER_LIGHT,AMBER)
    p.pill('实际部署 / 尚未实测',1770,310,'#e9ece7',GRAY,width=534)
    p.rect(MARGIN,394,CONTENT,106,GREEN,GREEN,18)
    p.text('本质',MARGIN+31,423,33,GREEN_LIGHT,True)
    p.text('完整应用 = 基础通信 + 多端入口 + 外部互联',MARGIN+145,417,44,'#f5f6e8',True)

    y = p.section('01','源库已有的能力，能带来什么效果？',550)
    left = MARGIN
    right = MARGIN + 1130
    boxw = 1078
    p.rect(left,y,boxw,827,WHITE,LINE,20)
    p.rect(right,y,boxw,827,WHITE,LINE,20)
    p.text('能力 / 已有对应实现',left+32,y+24,35,GREEN,True)
    p.text('效果 / 部署与配置后的使用方式',right+32,y+24,35,GREEN,True)
    rows = [
        ('文字、群聊与私信','公开/私有群、回复、@、置顶、未读；邀请、权限与封禁。','独立团队聊天室','团队按群讨论、成员单独联系，运营者管理成员与访问范围。'),
        ('文件、录音与语音通话','图片、视频文件、附件、录音；默认上传 20 MiB，TG 入站超 16 MB 附件跳过；网页一对一语音。','异步分享与实时声音','发文件、留言录音，也能在网页私信中发起一对一语音。'),
        ('网页、PWA 与 Android','现成客户端入口；Android Web UI 可填写自己的服务地址。','多端访问同一个实例','成员打开网站或客户端登录使用；不代表任意网站一键嵌入。'),
        ('Telegram 与跨实例桥接','Telegram 群互通；跨实例通过 10 分钟邀请、双方管理员确认后绑定。','多个入口参与讨论','网页与 TG 群互通，TG 成员无需站内账号；两站群共享范围内的新消息。'),
        ('HTTP API 与 WebMCP','登录、列群、读消息、发文字、开私聊等操作入口。','外部软件 / AI 操作会话','兼容工具可复用账号与接口；更多平台和智能行为仍需适配。')
    ]
    for index,(title,body,effect,description) in enumerate(rows):
        top = y+94+index*140
        if index:
            p.line(left+32,top-13,left+boxw-32,top-13)
            p.line(right+32,top-13,right+boxw-32,top-13)
        p.text(title,left+32,top,33,INK,True)
        p.paragraph(body,left+32,top+49,boxw-64,28,MUTED,leading=39,bottom=top+135)
        p.text(effect,right+32,top,33,INK,True)
        p.paragraph(description,right+32,top+49,boxw-64,28,MUTED,leading=39,bottom=top+135)
        p.arrow(left+boxw+8,top+47,right-8,top+47,'#9db286',3,10)
    y += 874

    y = p.section('02','底层架构：界面、请求、协调与存储分工',y)
    p.rect(MARGIN,y,CONTENT,646,'#ecf1e4',LINE,20)
    p.text('资源运行在自己的 Cloudflare 账号下；机器运行交给平台，密钥、备份、配额与费用仍需管理。',MARGIN+33,y+24,29,MUTED)
    center = WIDTH/2
    for x,w,title,sub in [(215,600,'浏览器 / PWA','Vue 3 界面'),(900,600,'Android 客户端','内置 Web UI'),(1585,600,'兼容 AI 客户端','WebMCP 操作入口')]:
        p.rect(x,y+86,w,93,WHITE,LINE,12)
        p.center(title,x+w/2,y+100,32,INK,True)
        p.center(sub,x+w/2,y+146,25,MUTED)
    for x in [515,1200,1885]:
        p.line(x,y+179,x,y+204,'#a1b493',3)
    p.line(515,y+204,1885,y+204,'#a1b493',3)
    p.arrow(center,y+204,center,y+229,GREEN,3,12)
    p.rect(530,y+232,1340,104,GREEN,GREEN,15)
    p.center('Workers + Hono：登录、鉴权、业务 API、文件入口与外部回调',center,y+249,34,'#f2f5dd',True)
    p.center('按请求运行后端逻辑；服务端权限不能交给前端替代',center,y+297,27,'#c1d5bd')
    p.arrow(center,y+337,center,y+365,GREEN,3,12,True)
    p.rect(530,y+370,1340,106,WHITE,'#a6ba91',15)
    p.center('Durable Objects：房间连接、用户收件箱、通话与桥接任务',center,y+385,34,INK,True)
    p.center('ChannelRoom / UserInbox；WebSocket 实时广播与 Hibernation',center,y+435,27,MUTED)
    p.line(center,y+476,center,y+500,'#a1b493',3)
    p.line(510,y+500,1890,y+500,'#a1b493',3)
    for x,title,sub in [(215,'D1','用户 / 群组 / 消息 / Outbox'),(900,'KV','登录会话 SESSIONS'),(1585,'R2','附件文件的加密字节')]:
        p.arrow(x+300,y+500,x+300,y+523,GREEN,3,10)
        p.rect(x,y+525,600,83,WHITE,LINE,12)
        p.center(title,x+300,y+531,32,GREEN,True)
        p.center(sub,x+300,y+578,24,MUTED)
    p.text('职责概念图：Worker 与 DO 均按业务访问存储，不代表每条请求都沿同一条串行路径。',MARGIN+33,y+616,25,MUTED)
    y += 699

    return p,y


def finish(p,y):
    y = p.section('03','工作原理：存储、推送、媒体与外部投递分开处理',y)
    routes = [
        ('文字 / 附件',
         '发消息 → 身份与会话授权 → 正文加密存入 D1 → 房间 WebSocket 广播 → 异步未读与桥接',
         '附件先校验并加密上传 R2，再随消息保存引用。重试可按消息标识去重；断线后通过 HTTP 同步，实时推送不替代历史存储。'),
        ('实时语音',
         '声音：用户 A ⇄ WebRTC（P2P 直连 / 配置后的 TURN 中继）⇄ 用户 B',
         '控制：Workers / VoiceCall DO 只协调呼叫、SDP、ICE 与状态，不转发或保存音频。没有 TURN 配置时，直连失败不能当作已切到中继。'),
        ('两种桥接',
         'TG：Bot API 出站 / Webhook 入站；仅群组文字/媒体互通，私信不桥接；出站尽力转发。',
         '实例桥：签名 HTTPS + Outbox + 重试/去重；仅本站原创无附件新群消息；不补历史、不传播编辑/撤回；导入消息不再跨桥扩散。')
    ]
    for index,(label,primary,secondary) in enumerate(routes):
        top = y+index*196
        p.rect(MARGIN,top,CONTENT,180,WHITE,LINE,15)
        p.rect(MARGIN+22,top+22,230,136,GREEN_LIGHT,GREEN_LIGHT,11)
        p.center(label,MARGIN+137,top+67,31,GREEN,True)
        p.paragraph(primary,MARGIN+284,top+22,CONTENT-316,31,INK,bold=True,leading=43,bottom=top+104)
        p.paragraph(secondary,MARGIN+284,top+90,CONTENT-316,28,MUTED,leading=40,bottom=top+173)
    y += 631

    y = p.section('04','能力边界：能运行，不等于所有场景都已覆盖',y)
    gap = 24
    cardw = (CONTENT-gap*2)/3
    boundaries = [
        ('加密：仍需信任服务端',
         '新正文与新附件使用 AES-256-GCM 静态加密，密钥可版本化轮换。\nWorker 持有密钥、验权后解密；这不是端到端加密。\n历史明文不自动补加密，元数据也不代表全部加密。旧密钥仍需保留。'),
        ('语音、文件与客户端',
         '录音消息是音频文件；实时语音仅网页一对一，双方需在线留在工作区。\n群语音、视频会议、屏幕共享与 Android 通话不在当前范围。\n视频文件不等于视频通话。Android 停止后不保证即时通知；TG 提醒不含正文。'),
        ('AI 工具与运行责任',
         'WebMCP 的五个工具是：登录、列群、读消息、发文字、开私聊。\n模型、总结、自动回复和任务执行需外部实现。\nServerless 省去常驻机器维护，账号、密钥、更新、备份、配额和成本仍要管理。')
    ]
    for index,(title,body) in enumerate(boundaries):
        p.block(MARGIN+index*(cardw+gap),y,cardw,480,title,body,AMBER_LIGHT,AMBER,28)
    y += 529

    y = p.section('05','可以封装成网页模块，但必须继续开发',y)
    p.rect(MARGIN,y,CONTENT,370,BLUE_LIGHT,'#cfdde6',18)
    p.text('可做的形态：右下角聊天浮窗 / 页面讨论区 / 站内私信 / 客服入口',MARGIN+31,y+24,34,BLUE,True)
    names = ['宿主网页','可嵌入组件','账号 / 会话授权','独立聊天后端']
    nodew = 469
    step = 554
    for index,name in enumerate(names):
        x = MARGIN+35+index*step
        p.rect(x,y+91,nodew,75,WHITE,'#c5d6e0',12)
        p.center(name,x+nodew/2,y+109,33,BLUE,True)
        if index<3:
            p.arrow(x+nodew+13,y+128,x+step-13,y+128,BLUE,3,13)
    tasks = [
        ('界面封装','组件化、样式与移动适配，融入宿主页面。'),
        ('身份与业务映射','网站账号、成员权限、页面/项目/订单对应会话。'),
        ('稳定接口与后端','收发、上传、重连、版本兼容；资源部署和运营。')
    ]
    for index,(title,body) in enumerate(tasks):
        x = MARGIN+34+index*726
        p.text(title,x,y+206,32,BLUE,True)
        p.paragraph(body,x,y+255,670,28,MUTED,leading=42,bottom=y+351)
    y += 417

    y = p.section('06','六个产品方向：可扩展，只代表候选方案',y,
                  '以下均需二次开发；真实需求、付费意愿与效果尚未验证，不能当作源库现成功能。')
    columns = [MARGIN,MARGIN+430,MARGIN+1115,MARGIN+1840,MARGIN+CONTENT]
    p.rect(MARGIN,y,CONTENT,67,GREEN,GREEN,12)
    for text,x in zip(['方向 / 使用者','期待解决的问题','还需要开发','当前取舍'],columns):
        p.text(text,x+22,y+17,30,'#f0f3de',True)
    directions = [
        ('客户交付协作室','客户 / 外包与设计团队','围绕交付物沟通、改稿、传文件与确认。','项目权限、文件版本、待办、交付确认。','需求明确后验证'),
        ('页面反馈与处理','网站用户 / 开发维护者','就地报告问题、携带页面上下文，处理后回告。','嵌入与身份、问题状态、负责人、完成通知。','先看表单是否够用'),
        ('Telegram 支持台','已有 Telegram 社群','求助不沉底，有人负责，也有最终答案。','问题归档、状态与回流；访客私有客服路由另做。','适合明确 TG 人群'),
        ('AI 任务协作室','人与 AI 协作的团队','讨论后能执行任务，并回传结果与依据。','模型、工具执行、任务状态、授权、失败恢复。','投入较大，先验闭环'),
        ('通用聊天 SDK','多个网站 / 开发者','用统一模块减少重复接入聊天的工作。','组件、账号/API、多框架、多租户、文档与运维。','自用复用；售卖暂缓'),
        ('多人音视频','有会议需求的团队','群语音、视频会议、屏幕共享。','多人媒体、网络质量、移动适配及运营能力。','当前不优先')
    ]
    for index,(name,audience,effect,build,judgment) in enumerate(directions):
        top = y+67+index*134
        fill = WHITE if index%2==0 else '#edf1e6'
        p.rect(MARGIN,top,CONTENT,134,fill,LINE,0)
        p.text(name,columns[0]+22,top+22,31,INK,True)
        p.text(audience,columns[0]+22,top+78,25,MUTED)
        p.paragraph(effect,columns[1]+22,top+28,641,28,MUTED,leading=41,bottom=top+121)
        p.paragraph(build,columns[2]+22,top+28,681,28,MUTED,leading=41,bottom=top+121)
        p.paragraph(judgment,columns[3]+22,top+28,324,29,AMBER,True,leading=43,bottom=top+121)
    y += 916

    y = p.section('07','价值判断：工程与研究有收获，商业优势要另证',y)
    values = [
        ('直接自部署的使用价值','需要独立实例、邀请制成员与 Telegram 群互联时，可把现有应用作为候选。平台依赖与运营责任仍在。'),
        ('明确需求下的工程复用','会话、权限、存储、文件和实时通信已有基础。能否更省事，要与成熟产品和轻量方案比较。'),
        ('完整系统的研究价值','理解“存储 + 推送”、媒体与信令分离、桥接去重、权限与密钥边界，以及多入口如何协作。')
    ]
    for index,(title,body) in enumerate(values):
        p.block(MARGIN+index*(cardw+gap),y,cardw,304,title,body,WHITE,GREEN,28)
    y += 329
    p.rect(MARGIN,y,CONTENT,190,AMBER_LIGHT,'#e8d6b7',16)
    p.text('成熟选择已经存在：通用聊天功能的商业差异化有限。',MARGIN+30,y+23,38,AMBER,True)
    p.paragraph('Chatwoot：客服、AI 与多渠道支持   ·   CometChat：聊天 SDK / 界面组件   ·   Canny：反馈、讨论与进度通知',MARGIN+31,y+83,CONTENT-62,29,MUTED,leading=43,bottom=y+146)
    p.text('增加聊天框、接上模型、能继续扩展，都不能单独证明用户会迁移、持续使用或付费。',MARGIN+31,y+141,28,MUTED)
    y += 237

    y = p.section('08','对我们的意义：保留研究，需求出现后再选择',y)
    p.rect(MARGIN,y,CONTENT,362,GREEN,GREEN,20)
    p.text('当前取舍：暂不主动开发通用聊天模块或新产品。',MARGIN+36,y+31,45,'#f4f5df',True)
    p.paragraph('把它保留为架构研究与备选技术实现。这个判断针对当前阶段，不是永久否定；不为了利用这个库而硬找产品需求。',MARGIN+38,y+113,CONTENT-76,32,'#c8d7bc',leading=48,bottom=y+214)
    p.text('具体痛点 → 比较成熟产品 / 轻量方案 → 小范围验证收益 → 再决定是否用 EdgeChat',MARGIN+38,y+231,34,'#e7edc5',True)
    p.text('比较：改造量、身份与权限、运行成本、GPL 许可与维护；观察：回复耗时、问题解决率、历史记录复用。',MARGIN+38,y+302,27,'#bbcfb1')
    y += 402

    p.line(MARGIN,y,MARGIN+CONTENT,y,'#bfcbb5',2)
    y += 25
    p.text('研究依据：aozorae/Edgechat  2.16.6 / 5a69f11  ·  2026-10-15  ·  上游声明 GPL-3.0-or-later',MARGIN,y,27,GREEN,True)
    p.paragraph('已完成：18 处固定版本文档与核心源码核读、研究网页交互检查。尚未实测：上游部署、多账号通信、真实桥接/通话、并发与成本；产品需求和付费意愿也未验证。',MARGIN,y+51,CONTENT,27,MUTED,leading=41)
    p.text('原仓库：github.com/aozorae/Edgechat  ·  完整来源与边界：本项目 RESEARCH.md / 网页第 08、09 章',MARGIN,y+149,25,GRAY)
    p.export(round(y+230))


if __name__ == '__main__':
    poster,cursor = build()
    finish(poster,cursor)
