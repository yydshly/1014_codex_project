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
               '<title id="title">Specreel：从浏览器操作记录，到指导演示与操作备忘</title>',
               '<desc id="desc">总结 Specreel 能力、浏览器自动化与 trace 原理、已验证效果、可选 Agent 链路、自动执行与人工准备边界、教程与备忘场景，以及个人使用价值与取舍。</desc>',
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
        image.save(OUT/'specreel-understanding.png',optimize=True)
        (OUT/'specreel-understanding.svg').write_text('\n'.join(svg),encoding='utf-8')
        (ROOT/'artifacts').mkdir(parents=True,exist_ok=True)
        (ROOT/'artifacts/understanding-layout.json').write_text(json.dumps({
            'width':WIDTH,'height':height,'text_lines':text_count,'layout_issues':self.issues,
            'method':'Original vector and raster infographic rendered from one scene description; no upstream image or application UI copied.',
            'reference':'Specreel 0.2.0 / 0d3aa13241b3714f32f93fdc705100150e6c42af; RESEARCH.md and source review; organized 2026-10-19'
        },ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
        print(f'PNG + SVG ready: {WIDTH} x {height}, {text_count} text lines, no measured overflow.')


def flow(p, y, labels, fill=GREEN_LIGHT, accent=GREEN, height=144):
    """One deliberately simple, readable four-node horizontal flow."""
    gap = 54
    w = (CONTENT-gap*(len(labels)-1))/len(labels)
    for index,(title,body) in enumerate(labels):
        x = MARGIN+index*(w+gap)
        p.rect(x,y,w,height,fill,LINE,15)
        p.center(title,x+w/2,y+22,33,INK,True)
        p.paragraph(body,x+23,y+74,w-46,27,MUTED,leading=40,bottom=y+height-15)
        if index < len(labels)-1:
            p.arrow(x+w+8,y+height/2,x+w+gap-8,y+height/2,accent,4,13)


def build():
    p = Poster()
    p.text('008 / OPEN-SOURCE RESEARCH',MARGIN,68,28,GREEN,True)
    p.text('Specreel：从浏览器操作记录',MARGIN,122,80,INK,True)
    p.text('到指导演示与操作备忘',MARGIN,232,80,INK,True)
    p.text('能力 · 底层原理 · 自动化边界 · 已有结果 · 使用场景 · 对我们的意义',MARGIN,349,35,MUTED)
    p.pill('已实测 / 004 三条流程',MARGIN,419,GREEN_LIGHT,GREEN,width=506)
    p.pill('源码能力 / 尚未实测',655,419,BLUE_LIGHT,BLUE,width=506)
    p.pill('可选扩展 / 仍需开发验证',1214,419,AMBER_LIGHT,AMBER,width=540)
    p.pill('使用判断 / 收益未证实',1807,419,'#e9ece7',GRAY,width=497)
    p.rect(MARGIN,507,CONTENT,180,GREEN,GREEN,20)
    p.text('本质：把浏览器操作、检查与画面，整理成可重复生成的演示',MARGIN+35,536,43,'#f6f7e9',True)
    p.text('Agent 与模型可以帮忙，但不是生成演示的必需条件；浏览器也不限于聊天软件内置浏览器。',MARGIN+35,611,31,'#d9e4d0')

    y = p.section('01','能力是什么？能给我们什么结果？',746)
    w=(CONTENT-34)/2
    p.block(MARGIN,y,w,233,'结构化记录 → 分步网页回放','读取 Playwright trace，把动作、检查与画面匹配成步骤；可播放、暂停、前后跳转，定位当时看到的结果。',GREEN_LIGHT,GREEN,30)
    p.block(MARGIN+w+34,y,w,233,'同一份记录 → 演示视频','把画面、操作字幕、片头片尾组合并编码为 MP4，适合产品介绍、培训或分享；语音并非默认必有。',GREEN_LIGHT,GREEN,30)
    y += 263
    p.block(MARGIN,y,w,233,'重复跑流程 → 更新材料','操作脚本、输入与检查可以复用，再次执行后重生成演示。控件或业务流程变化时仍可能需要维护脚本。',GREEN_LIGHT,GREEN,30)
    p.block(MARGIN+w+34,y,w,233,'操作与断言 → 可检查的展示','不仅保存画面，也保留所选步骤和结果检查；检查通过只证明定义的条件成立，不能证明全部功能或需求有效。',WHITE,GREEN,30)
    y += 283

    y = p.section('02','两条链路：已验证的自动化，与可选的 Agent 接入',y)
    p.pill('A / 我们已经跑通',MARGIN,y,GREEN_LIGHT,GREEN,width=375)
    y += 75
    flow(p,y,[('人准备目标与脚本','明确做什么、输入什么、怎样算成功'),('Playwright 操作浏览器','启动 Chromium，执行点击、输入与检查'),('保存 trace.zip','采集事件、时间信息与浏览器画面帧'),('Specreel 生成演示','解析记录 → HTML 回放 / MP4')],height=183)
    y += 211
    p.paragraph('这一链路的录制、生成阶段可以按脚本自动运行。我们的 004 实测没有调用 AI 模型、TTS 或 Cloud。',MARGIN+4,y,CONTENT-8,31,GREEN,leading=46)
    y += 95
    p.pill('B / 可扩展组合，未验证 Agent 闭环',MARGIN,y,AMBER_LIGHT,AMBER,width=650)
    y += 75
    flow(p,y,[('用户给出业务目标','例如：展示如何生成一份采集计划'),('Agent 调用模型','理解目标、规划步骤、编写或调整脚本'),('工具执行与录制','Agent 调用 Playwright；后续同 A'),('结果审核与分享','检查是否达到目标，再发布演示')],AMBER_LIGHT,AMBER,height=183)
    y += 211
    p.paragraph('准确表述：Agent 可以调用模型并控制浏览器工具，Specreel 消费操作记录生成演示。Specreel 本身不等于自动规划、授权、纠错到验收的完整 Agent。',MARGIN+4,y,CONTENT-8,31,AMBER,leading=46)
    y += 142

    y = p.section('03','底层怎样工作？录的是什么，最后播放的是什么？',y)
    mechanisms=[
        ('1 / 浏览器执行与采集','Playwright 启动并控制浏览器，执行预先定义的动作和断言；采集操作日志、时间、截图或画面帧，打包为 trace.zip。'),
        ('2 / 解析与组织步骤','Specreel 读取 trace，提取操作和检查、匹配相应画面，整理步骤时序，并按规则生成 Click / Confirm 等操作字幕。'),
        ('3 / 两类输出','HTML / JavaScript 播放器展示保存的画面与步骤；MP4 由 Pillow 绘制字幕等画面，再用 FFmpeg 编码。'),
        ('4 / 观看与重新执行分开','网页“下一步”切换的是保存画面，不会操作真实业务网站；真正重做任务，需重新运行操作脚本。')
    ]
    for index,(title,body) in enumerate(mechanisms):
        p.block(MARGIN,y+index*185,CONTENT,159,title,body,WHITE,GREEN,30)
    y += 746
    p.rect(MARGIN,y,CONTENT,112,BLUE_LIGHT,BLUE_LIGHT,16)
    p.paragraph('与普通录屏的共同点：都能留下可观看的画面。这里额外复用的是“动作 + 检查 + 时间 + 画面”的结构化记录，不只是连续视频。',MARGIN+30,y+23,CONTENT-60,31,BLUE,leading=46,bottom=y+104)
    y += 161

    y = p.section('04','“不需要人参与”该怎样理解？',y)
    p.rect(MARGIN,y,CONTENT,157,GREEN,GREEN,18)
    p.text('准备就绪后的执行阶段，可以无人值守；不是全过程永远不需要人。',MARGIN+32,y+28,43,'#f6f7e9',True)
    p.text('前提：脚本、数据、账号与权限、验收标准就绪，环境可用；异常时有恢复或人工接手。',MARGIN+32,y+95,31,'#d9e4d0')
    y += 189
    phasew=(CONTENT-60)/3
    p.block(MARGIN,y,phasew,279,'准备 / 定义任务','人或已配置的 Agent 选择流程、准备数据和脚本；登录授权、验证码、付费与敏感操作可能仍需要人处理。',AMBER_LIGHT,AMBER,29)
    p.block(MARGIN+phasew+30,y,phasew,279,'执行 / 可以自动完成','启动浏览器 → 操作 → 检查 → 保存记录 → 生成网页和视频；稳定且已准备好的流程可批量重复执行。',GREEN_LIGHT,GREEN,29)
    p.block(MARGIN+2*(phasew+30),y,phasew,279,'验收 / 判断成果','异常、流程变化、错误目标与内容质量需要处理；演示能否让人理解、是否适合分享仍需判断。',AMBER_LIGHT,AMBER,29)
    y += 327

    y = p.section('05','我们真实生成了什么？证据与限制一起看',y)
    p.rect(MARGIN,y,CONTENT,371,WHITE,LINE,20)
    p.text('004 需求采集工作台：三条真实浏览器操作流程',MARGIN+31,y+24,36,GREEN,True)
    cols=[MARGIN+32,MARGIN+1060,MARGIN+1390,MARGIN+1720]
    heads=['流程与内容','步骤数','检查数','HTML 时长']
    for x,t in zip(cols,heads):p.text(t,x,y+91,29,MUTED,True)
    rows=[('01 真实样本：原话、已有办法与来源条件','11','6','约 14 秒'),('02 采集计划：填写、生成与切换指令','21','8','约 26 秒'),('03 来源筛选：来源详情与历史线索','15','7','约 18 秒')]
    for index,row in enumerate(rows):
        yy=y+151+index*66
        p.line(MARGIN+32,yy-12,WIDTH-MARGIN-32,yy-12)
        for x,t in zip(cols,row):p.text(t,x,yy,31,INK,index==0)
    y += 403
    p.block(MARGIN,y,w,228,'可分享成果','3 条 HTML 回放 + 3 段 MP4；中文适配后字幕可读。第二条视频：31.77 秒、1280 × 948、H.264、无音轨。',GREEN_LIGHT,GREEN,30)
    p.block(MARGIN+w+34,y,w,228,'本轮限制','首次仍手写操作脚本；网址推荐未找到核心业务路径，生成脚本有语法错误。视频需要中文字体适配。',AMBER_LIGHT,AMBER,30)
    y += 259
    p.paragraph('已验证重复输入后重生成演示；“更新”标记主要依据操作字幕签名，并非完整画面差异检测。未验证自动监测、无维护自愈、Agent 闭环或节省时间的效果。',MARGIN+2,y,CONTENT-4,29,MUTED,leading=44)
    y += 136

    y = p.section('06','适合哪些场景？什么时候普通录屏就够了？',y)
    scenarios=[
        ('指导教程 / 客户培训','把稳定的注册、导入、创建任务流程讲清楚；观看者可暂停、跳步、查看结果。'),
        ('个人操作备忘','留下“当时怎么操作成功、看到了什么”；为什么这样做、经验判断仍应另补文字。'),
        ('产品展示 / 项目研究','给研究库里的网页工具配真实使用路径，让读者看到输入、动作与输出。'),
        ('持续开发 / 材料更新','复用已有自动化流程，检查关键结果并更新教程；页面变化时维护定位与脚本。')
    ]
    p.rect(MARGIN,y,CONTENT,362,WHITE,LINE,20)
    for index,(title,body) in enumerate(scenarios):
        yy=y+27+index*82
        p.text(title,MARGIN+30,yy,32,GREEN,True)
        p.paragraph(body,MARGIN+517,yy+1,CONTENT-549,29,MUTED,leading=42,bottom=yy+75)
        if index<3:p.line(MARGIN+30,yy+66,WIDTH-MARGIN-30,yy+66)
    y += 393
    p.block(MARGIN,y,w,242,'一次展示 / 连续视觉效果','普通录屏准备更少，适合只做一次的讲解，以及 3D 房间、动画、视觉氛围等连续效果。教程和备忘本身不构成必须换工具的理由。',WHITE,GRAY,29)
    p.block(MARGIN+w+34,y,w,242,'稳定流程 / 经常更新教程','Specreel 的价值更可能来自结构化步骤、断言与脚本复用；若已经有 Playwright 测试，新增演示的成本更容易降低。',GREEN_LIGHT,GREEN,29)
    y += 291

    y = p.section('07','可扩展什么？哪些目前不能当成已有成果？',y)
    p.block(MARGIN,y,w,222,'源码提供的可选能力','可选 AI 字幕、TTS、MCP 接入可用于更丰富的制作流程；我们本轮没有实测它们，也没有验证语音输出与 Agent 全链路。',BLUE_LIGHT,BLUE,29)
    p.block(MARGIN+w+34,y,w,222,'可组合的产品方向','自动更新帮助中心、客户培训演示库、个人流程档案、发布前验证与教程生成；都需要目标设计、权限、异常与质量审核。',AMBER_LIGHT,AMBER,29)
    y += 270

    y = p.section('08','对我们的意义与当前取舍',y)
    p.rect(MARGIN,y,CONTENT,231,GREEN,GREEN,20)
    p.text('保留为可复用工具，稳定且常更新的网页流程按需采用。',MARGIN+34,y+29,46,'#f6f7e9',True)
    p.paragraph('我们获得的是一套“真实操作 → 可检查记录 → 演示材料”的方法与已有作品。不是所有项目都需要接入，也没有证据表明它整体比录屏更省时或让用户学得更好。',MARGIN+34,y+111,CONTENT-68,33,'#d9e4d0',leading=50,bottom=y+219)
    y += 266
    flow(p,y,[('有真实重复需求？','近期是否要再次更新同一操作教程'),('流程已稳定？','是否能定义输入、步骤和检查条件'),('比较总成本','首次脚本 + 维护 + 审核 vs 重录'),('小范围再使用','测制作时间、错误率和首次理解效果')],height=173)
    y += 214
    p.line(MARGIN,y,WIDTH-MARGIN,y,LINE,3)
    y += 28
    p.paragraph('版本依据：Specreel CLI 0.2.0 · 固定提交 0d3aa13241b3714f32f93fdc705100150e6c42af',MARGIN,y,CONTENT,26,MUTED,leading=39)
    y += 47
    p.paragraph('来源：github.com/specreel/specreel · 源码核读与 2026-10-15 实测；本图整理于 2026-10-19。',MARGIN,y,CONTENT,26,MUTED,leading=39)
    y += 47
    p.paragraph('许可：CLI 为 AGPL-3.0-or-later；Cloud 为专有服务。图为原创整理，未新增 AI、付费模型、TTS 或 Cloud 运行。',MARGIN,y,CONTENT,26,MUTED,leading=39)
    y += 75
    p.export(int(y))


if __name__ == '__main__':
    build()
