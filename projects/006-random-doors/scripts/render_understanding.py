"""生成含真实画面、精确中文排版的研究总览 PNG 与自包含 SVG。"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps
import base64
import hashlib
import html
import json
import re

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets'
W, MAX_H = 3200, 6500
PAPER, WHITE, INK = '#F2F0E8', '#FCFBF7', '#203C3D'
MUTED, LINE = '#647573', '#CDD6CF'
TEAL, TEAL_PALE = '#247266', '#E3EFE7'
BLUE, BLUE_PALE = '#376B8E', '#E7EEF5'
GOLD, GOLD_PALE = '#91652B', '#F2E7D4'
NAVY = '#142D36'
REGULAR = 'C:/Windows/Fonts/msyh.ttc'
BOLD = 'C:/Windows/Fonts/msyhbd.ttc'
canvas = Image.new('RGB', (W, MAX_H), PAPER)
draw = ImageDraw.Draw(canvas)
svg = []
font_cache = {}
inputs = {}
text_records = []


def font(size, bold=False):
    key = (size, bold)
    if key not in font_cache:
        font_cache[key] = ImageFont.truetype(BOLD if bold else REGULAR, size)
    return font_cache[key]


def rect(x, y, w, h, fill, radius=0, stroke=None, sw=2):
    draw.rounded_rectangle((x, y, x+w, y+h), radius=radius, fill=fill, outline=stroke, width=sw)
    svg.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{radius}" fill="{fill}" stroke="{stroke or "none"}" stroke-width="{sw}"/>')


def line(x1, y1, x2, y2, color=LINE, width=2):
    draw.line((x1, y1, x2, y2), fill=color, width=width)
    svg.append(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{color}" stroke-width="{width}"/>')


def text(x, y, value, size=30, color=INK, bold=False):
    draw.text((x, y), value, font=font(size, bold), fill=color, anchor='lt')
    svg.append(f'<text x="{x}" y="{y}" font-family="Microsoft YaHei, Noto Sans CJK SC, sans-serif" font-size="{size}" font-weight="{700 if bold else 400}" dominant-baseline="text-before-edge" fill="{color}">{html.escape(value)}</text>')
    text_records.append({'text': value, 'x': x, 'y': y, 'size': size})


def wrap(value, width, size, bold=False):
    rows = []
    for para in value.split('\n'):
        current = ''
        tokens = re.findall(r'[A-Za-z0-9_./@:#?&=%+\-]+|[^\x00-\x7f]|\s+|.', para)
        for token in tokens:
            candidate = current + token
            if current and draw.textlength(candidate, font=font(size, bold)) > width and token not in '，。；：！？、）》”':
                rows.append(current.rstrip())
                current = token.lstrip()
            else:
                current = candidate
        rows.append(current.rstrip())
    return rows


def para(x, y, value, width, size=30, color=MUTED, bold=False, leading=1.52):
    for row in wrap(value, width, size, bold):
        text(x, y, row, size, color, bold)
        y += round(size * leading)
    return y


def pill(x, y, value, color=TEAL, fill=TEAL_PALE, size=25):
    width = int(draw.textlength(value, font=font(size, True))) + 32
    rect(x, y, width, 45, fill, 8)
    text(x+16, y+8, value, size, color, True)
    return width


def section(y, number, title, subtitle):
    rect(96, y, 58, 58, TEAL, 12)
    text(106, y+12, number, 29, WHITE, True)
    text(174, y+3, title, 46, INK, True)
    if subtitle:
        text(174, y+66, subtitle, 29, MUTED)
    return y+124


def image(path, x, y, w, h, bg=NAVY):
    path = Path(path)
    data = path.read_bytes()
    inputs[str(path.relative_to(ROOT))] = {'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data)}
    with Image.open(path) as original:
        img = ImageOps.contain(original.convert('RGB'), (int(w), int(h)), Image.Resampling.LANCZOS)
        rect(x, y, w, h, bg)
        canvas.paste(img, (int(x+(w-img.width)/2), int(y+(h-img.height)/2)))
        mime = 'image/png' if original.format == 'PNG' else 'image/jpeg'
    encoded = base64.b64encode(data).decode()
    svg.append(f'<image x="{x}" y="{y}" width="{w}" height="{h}" preserveAspectRatio="xMidYMid meet" href="data:{mime};base64,{encoded}"/>')


def arrow(x1, y, x2, color=TEAL):
    line(x1, y, x2-13, y, color, 4)
    points = [(x2-17, y-10), (x2, y), (x2-17, y+10)]
    draw.polygon(points, fill=color)
    svg.append('<polygon points="'+ ' '.join(f'{x},{yy}' for x, yy in points) +f'" fill="{color}"/>')


def detail(x, y, label, value, width, accent=TEAL, size=29):
    text(x, y, label, 31, accent, True)
    return para(x, y+47, value, width, size)+19


def fit(y, bottom, label):
    if y > bottom:
        raise ValueError(f'{label} overflow: {y} > {bottom}')


# 01 — 封面与结论
rect(0, 0, W, 345, NAVY)
text(100, 43, '006 / 随机门研究       理解总览 · 2026.10.16', 29, '#B5C9C4')
text(96, 104, '从世界入口，到作品与经历的连接器', 79, '#F5EFE1', True)
text(100, 220, '用随机组织内容，用参与赋予意义，用记忆连接下一次相遇。', 37, '#D7C7A6')
pill(100, 282, '已验证 / 已实现', TEAL, TEAL_PALE, 24)
pill(390, 282, '源码参考 / 独立作品', BLUE, BLUE_PALE, 24)
pill(760, 282, '扩展设想 / 待验证', GOLD, GOLD_PALE, 24)
text(2190, 293, '先区分来源，再讨论产品价值', 28, '#BDD0C9')

# 02 — 源作、源码库与我们的效果，三者分别登记
y = section(400, '01', '先看清：原作是什么，源库能做什么，我们增加了什么', '原作灵感与 Four-Seasons 是同一作者的两件作品；我们的随机门是独立实现与产品探索。')
card_y, card_h, col, gap = y, 1040, 981, 32
cards = [
    ('原作灵感 · The Portal Cube', '原作视频已核验', TEAL, TEAL_PALE,
     ROOT/'web/public/research/techartist-poster.jpg', 'Techartist 原帖视频封面 · 原作媒体',
     [('原来的效果', '旋转立方体，点击窗口进入可交互 3D 世界；公开视频呈现从入口进入阳光珊瑚礁。'),
      ('带来的启发', '入口可以制造悬念；“走进去”让浏览内容成为一次主动发现。'),
      ('已知边界', '未确认随机抽取、世界生成方式或实时 AI；这段视频本身不是已验证的随机引擎。')]),
    ('源码参考 · Four-Seasons', '独立作品 / 源码可查', BLUE, BLUE_PALE,
     OUT/'references/four-seasons-readme.jpg', '固定版本 README 原图 · 作者提供',
     [('库的能力', '单文件 Three.js 三维微缩世界：山地、道路、水流、草木；可切换四季、时段和视角。'),
      ('源库的效果', '同一片空间呈现春夏秋冬与日夜光照；植被、水面、积雪、粒子与氛围同步变化。'),
      ('对我们的启发', '用参数组保持世界一致，用固定种子保留布局。它没有实现本项目的故事与手记循环。')]),
    ('本项目 · 随机门 0.6', '已实现 / 本地原型', TEAL, TEAL_PALE,
     OUT/'door-v05.jpg', '0.5 原型实际运行截图 · 0.6 增加研究总览',
     [('现在的能力', '六处可互动地点；地点内还有人物、心事、自然事件与可解布局的变化；支持连续开门与回访。'),
      ('我们的产品效果', '从“看世界”推进到“遇见事情、采取行动、留下经历”，再决定新开门或回到某一次。'),
      ('实现边界', '当前为有限内容池。主流程使用原画与互动叠层；另保留实时 3D 候车亭，无运行时 AI 调用。')]),
]
for i, (title, status, accent, pale, path, caption, details) in enumerate(cards):
    x = 96+i*(col+gap)
    rect(x, card_y, col, card_h, WHITE, 16, LINE)
    text(x+30, card_y+30, title, 35, INK, True)
    pill(x+30, card_y+88, status, accent, pale, 23)
    image(path, x+26, card_y+155, col-52, 360)
    text(x+30, card_y+530, caption, 23, MUTED)
    yy = card_y+584
    for label, value in details:
        text(x+30, yy, label, 29, accent, True)
        yy = para(x+30, yy+43, value, col-60, 27, INK, leading=1.48)+18
    fit(yy, card_y+card_h-12, title)

# 03 — 原理与随机位置
y = section(card_y+card_h+57, '02', '原理：世界怎样变化，遭遇怎样随机，经历怎样稳定', '随机负责选择相容内容；用户的行动遵循固定规则，回访保留原来的那一次。')
panel_y, panel_h, panel_w = y, 830, 1488
rect(96, y, panel_w, panel_h, BLUE_PALE, 16)
text(130, y+29, 'A / Four-Seasons：参数化世界的原理', 37, BLUE, True)
small_w = 437
for j, (title, body) in enumerate([
    ('固定种子', '地形与自然细节\n按确定规则生成'),
    ('季节参数', '草色、积雪、冻结\n粒子、植被与雾'),
    ('时段参数', '天空、光源、夜色\n亮度与发光物件')
]):
    xx = 130+j*466
    rect(xx, y+106, small_w, 157, WHITE, 10)
    text(xx+21, y+126, title, 32, BLUE, True)
    para(xx+21, y+176, body, small_w-42, 27, INK, leading=1.42)
text(455, y+281, '↓ 统一参数与插值，让多个系统同步过渡', 30, BLUE, True)
rect(130, y+338, 1420, 130, NAVY, 10)
text(160, y+359, 'Three.js / WebGL + GPU 着色与实例化', 33, '#F3F0E4', True)
text(160, y+415, '相机与光照 → 几何 / 材质 / 水流 / 粒子 → 连续场景', 28, '#BED3CD')
yy = detail(130, y+505, '可借鉴的方法', '先制作完整世界，再用相容的参数制造变化；固定种子让同一状态可以复现。', 1410, BLUE, 29)
yy = detail(130, yy, '事实边界', '该机制来自独立的 Four-Seasons 源码，不能据此断言 Portal Cube 使用了同一实现。', 1410, BLUE, 28)
fit(yy, y+panel_h-10, '源库原理')

px = 1616
rect(px, y, panel_w, panel_h, TEAL_PALE, 16)
text(px+34, y+29, 'B / 我们：内容池 + 稳定状态 + 手记', 37, TEAL, True)
node_w = 428
nodes = [
    ('1 选择范围', '安静 / 故事 / 挑战\n或全部交给偶然'),
    ('2 随机地点', '六处地点分轮抽取\n优先未遇，减少重复'),
    ('3 随机处境', '在地点的内容池中\n选完整人物或布局'),
    ('4 确定这一次', '保存内容 ID 与种子\n刷新与操作不重抽'),
    ('5 参与并记录', '行动决定反馈\n记录回应、事件与进度'),
    ('6 新门或回访', '新门创建新经历\n回访恢复原来状态'),
]
for j, (title, body) in enumerate(nodes):
    xx = px+34+(j%3)*475
    yy = y+108+(j//3)*190
    rect(xx, yy, node_w, 161, WHITE, 10)
    text(xx+19, yy+21, title, 30, TEAL, True)
    para(xx+19, yy+72, body, node_w-38, 26, INK, leading=1.45)
    if j%3 < 2:
        arrow(xx+node_w+8, yy+80, xx+node_w+39)
# 折行连接第三步与第四步，保持两行流程连续。
fold_right = px+34+2*475+node_w/2
fold_left = px+34+node_w/2
line(fold_right, y+269, fold_right, y+283, TEAL, 3)
line(fold_right, y+283, fold_left, y+283, TEAL, 3)
line(fold_left, y+283, fold_left, y+291, TEAL, 3)
draw.polygon([(fold_left-8,y+289),(fold_left+8,y+289),(fold_left,y+299)],fill=TEAL)
svg.append(f'<polygon points="{fold_left-8},{y+289} {fold_left+8},{y+289} {fold_left},{y+299}" fill="{TEAL}"/>')
text(px+34, y+496, '随机发生：地点 / 人物处境 / 自然事件 / 布局 / 时机', 29, TEAL, True)
yy = para(px+34, y+551, '人物、心事、信件与后续成套选择；天气与自然事件相容；谜题先保证可解。', 1415, 30, INK)
yy = para(px+34, yy+17, '同场景新遇见、继续去下一处、回访旧经历，是三个不同入口。手记保存在当前浏览器。', 1415, 29, MUTED)
fit(yy, y+panel_h-18, '随机门原理')

# 04 — 三种产品效果
y = section(panel_y+panel_h+57, '03', '产品效果：每次开门，遇到的是不同的参与机会', '两分钟是设计比较尺度，允许提前离开、继续停留或不完成；情绪变化是待验证的设计预期。')
route_y, route_h = y, 930
routes = [
    ('安静停留', '海边候车亭 / 风过的天台', OUT/'seaside-v05.jpg', '0.5 实际运行截图：接雨与远处船灯',
     [('随机内容', '候车亭：雨中船灯、归鸟、云缝光；天台：风铃、纸飞机、窗灯。'),
      ('可以做什么', '坐下接雨、等自然变化、留纸签、碰风铃；也可以只观察。'),
      ('预期感受与再来理由', '分心 → 好奇 → 放松 → 余韵。看新的风景，也能回到留下过一句话的地方。')]),
    ('参与故事', '打烊前的邮局 / 老街修补铺', OUT/'postoffice-v05.jpg', '0.5 实际运行截图：小满的相机与道歉',
     [('随机内容', '邮局 6 位人物、6 种心事、18 条回应及对应后续；修补铺 3 种选铃处境。'),
      ('可以做什么', '倾听、回应、陪伴寄信，或挑铃、转动木鸟发条；结果与自己的动作接得上。'),
      ('预期感受与再来理由', '好奇 → 关心 → 参与 → 牵挂。想遇到另一个人，也想看看自己参与过的后来。')]),
    ('完成小挑战', '漂浮温室 / 旧星图观测台', OUT/'challenge-stars.jpg', '0.3 历史运行截图：星环完成，非当前画风',
     [('随机内容', '温室 6 条可解光路；星环目标与起始位置随种子改变，规则保持稳定。'),
      ('可以做什么', '观察、转镜引光、转环对齐、请求提示；未完成时也能保留进度。'),
      ('预期感受与再来理由', '好奇 → 困惑 → 理解 → 成就感。把掌握的规则带到下一间有变化的房间。')]),
]
for i, (title, places, path, caption, details) in enumerate(routes):
    x = 96+i*(col+gap)
    rect(x, y, col, route_h, WHITE, 16, LINE)
    text(x+30, y+27, title, 40, TEAL, True)
    text(x+30, y+90, places, 29, MUTED)
    image(path, x+26, y+145, col-52, 300)
    text(x+30, y+463, caption, 23, MUTED)
    yy = y+518
    for label, body in details:
        text(x+30, yy, label, 29, TEAL, True)
        yy = para(x+30, yy+44, body, col-60, 27, INK, leading=1.48)+18
    fit(yy, y+route_h-12, title)

# 05 — 价值与扩展
y = section(route_y+route_h+57, '04', '对我们的价值：复用内容，组织发现，让经历值得回来', '价值来自“内容质量 × 偶遇方式 × 可参与性 × 可记忆性”的配合；长期效果仍需真实用户反馈。')
value_y, value_h = y, 760
rect(96, y, panel_w, value_h, NAVY, 16)
text(132, y+31, '为什么值得继续做', 40, '#F4EEDC', True)
values = [
    ('对访客', '减少一开始的选择负担，在自己选定的范围里发现未曾主动寻找的内容；喜欢的作品仍可直接查找和返回。'),
    ('对创作者', '让已有网页、视频、图片与模型获得新的入口，保留作品自身风格，避免为每一扇门都从头生产一个世界。'),
    ('对产品', '把随机做成内容组织方式：有未知，也有掌控；新门承载探索，旧经历承载熟悉感、关系和学到的规则。'),
    ('对本仓库', '逐步积累可复用的作品登记、候选池、内容 ID、稳定状态、互动反馈与回访能力，承接后续不同作品。'),
]
yy = y+109
for label, body in values:
    text(132, yy, label, 32, '#D9C495', True)
    yy = para(132, yy+47, body, 1410, 29, '#D3E0D7', leading=1.48)+25
fit(yy, y+value_h-10, '价值')
line(132, y+624, 1540, y+624, '#54736E')
text(132, y+657, '门负责发现与连接，内容承载体验，记忆支持回来。', 31, '#D9C495', True)

rect(px, y, panel_w, value_h, GOLD_PALE, 16)
text(px+34, y+31, '可扩展为哪些产品', 40, GOLD, True)
yy = y+109
extensions = [
    ('优先探索 / 随机作品馆', '先接入小幽灵、月门水庭、操作演示等真实作品；统一线索、进入、返回、收藏和下一件，适配不同媒介。'),
    ('后续探索 / 有回响的偶遇世界', '自己的选择改变未来候选：陪阿岚寄信后，她的奶奶有机会在候车亭出现，让偶然带上个人意义。'),
    ('后续探索 / 规则型小游戏与主题策展', '稳定规则搭配变化布局；也可按心情、创意或知识主题组织内容，允许用户控制范围。'),
    ('内容扩充 / 程序化与 AI', '先保证参数相容、故事衔接与谜题可解，再把新内容放入候选池。实时生成仍是设想，需要质量检查。'),
]
for label, body in extensions:
    text(px+34, yy, label, 30, GOLD, True)
    yy = para(px+34, yy+46, body, 1410, 29, INK, leading=1.48)+24
fit(yy, y+value_h-10, '扩展方向')
line(px+34, y+624, px+1450, y+624, '#CDB78F')
para(px+34, y+654, '按媒介接入：网页互动 / 视频播放 / 图片与模型展览；独立应用先预览，再打开。', 1400, 29, GOLD)

# 06 — 演进、沉淀与验证
y = section(value_y+value_h+57, '05', '我们形成的判断，以及下一步最值得验证的事', '从“优化单一场景”转向“持续遇见不同事情”，再走向“把自己的作品接进来”。')
last_y = y
rect(96, y, 3008, 155, TEAL_PALE, 12)
text(130, y+24, '沉淀可以很轻：安静留下熟悉感，故事留下关系，挑战留下理解。', 37, TEAL, True)
text(130, y+87, '允许不收藏、不完成、不留下什么；再次开门的理由，需要从经历本身长出来。', 31, INK)

steps = [('0.2', '单场景试验', '天气 / 接雨 / 船灯'), ('0.3', '连续随机开门', '六处遭遇 / 手记'), ('0.4', '同场景的新事情', '人物 / 心事 / 布局'), ('0.5', '补足整体效果', '原画 / 人物 / 互动层'), ('0.6', '汇总产品理解', '原作对照 / 作品馆方向')]
for j, (version, title, body) in enumerate(steps):
    xx = 130+j*599
    text(xx, y+194, version, 36, TEAL, True)
    text(xx, y+246, title, 30, INK, True)
    text(xx, y+293, body, 26, MUTED)
    if j < 4:
        arrow(xx+390, y+211, xx+545)

line(130, y+349, 3068, y+349)
text(130, y+381, '下一步', 31, TEAL, True)
text(301, y+381, '真实接入三种媒介作品 → 做通一条跨场景回响 → 观察主动再开门与回访', 34, INK, True)
text(130, y+447, '看什么：能否说清变化、记住自己的参与、找到喜欢的内容，并主动选择继续或回来。', 30, MUTED)
text(130, y+502, '现状：作品馆只有三件候选的抽取示意；跨场景因果尚未实现；29 项测试验证功能，不证明情绪与长期留存。', 27, GOLD)

# 07 — 来源与适用范围
footer_y = y+590
rect(0, footer_y, W, 265, '#DFE5DB')
text(100, footer_y+24, '来源与边界', 30, INK, True)
text(100, footer_y+77, '[1] 原作：Techartist (@techartist_) · x.com/techartist_/status/2109737086601556195 · 约 20 秒视频，版权归作者。', 25, MUTED)
text(100, footer_y+121, '[2] 源码参考：github.com/iamtechartist/Four-Seasons · 固定版本 23e276eda11e421631df3f4b726a066d59845c91 · 代码 MIT。', 24, MUTED)
text(100, footer_y+165, '[3] 我们的效果：本仓库 006 本地截图与实现，状态截至 0.6；0.5 原画由 ImageGen 制作，运行时不调用模型。', 25, MUTED)
text(100, footer_y+209, '原帖曾读取 403；研究页已用保留署名的本地副本播放。原作未披露的生成与随机机制，仍列为待确认。', 25, MUTED)
H = footer_y+265

png = OUT/'understanding-overview-20261016.png'
vector = OUT/'understanding-overview-20261016.svg'
canvas.crop((0, 0, W, H)).save(png, optimize=True)
vector.write_text(f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="{W}" height="{H}" viewBox="0 0 {W} {H}"><title>随机门：从世界入口到作品与经历的连接器</title><desc>原作、Four-Seasons 独立源码参考与我们的随机门产品探索。包含能力、原理、效果、价值、边界与扩展方向。</desc><rect width="100%" height="100%" fill="{PAPER}"/>'+''.join(svg)+'</svg>', encoding='utf-8')
(OUT/'understanding-overview-20261016.sources.json').write_text(json.dumps({
    'created_on': '2026-10-16', 'size': [W, H], 'method': '确定性中文图解排版，使用真实画面；PNG 与自包含 SVG，无新增生成素材。',
    'original': 'https://x.com/techartist_/status/2109737086601556195',
    'reference_repository': 'https://github.com/iamtechartist/Four-Seasons',
    'reference_commit': '23e276eda11e421631df3f4b726a066d59845c91',
    'reference_readme_image': 'https://github.com/user-attachments/assets/40de573c-d128-4119-b19f-7aa6a55c1e0b',
    'reference_image_note': '来自固定版本 README 引用的作者原图，原文件未修改；用于研究对照，保留作者与来源。代码 MIT 不自动推定为独立媒体的再许可。',
    'prototype_state': '0.6 研究总览，0.5 主流程视觉，0.3 挑战历史截图，均明确标注。',
    'input_assets': inputs, 'layout_text': text_records,
}, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({'png':str(png), 'svg':str(vector), 'size':[W,H], 'png_bytes':png.stat().st_size}, ensure_ascii=False))
