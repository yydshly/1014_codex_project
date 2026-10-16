"""将本轮内置 ImageGen 的原图作 WebP 编码；不裁切或改画素材。"""
from pathlib import Path
from PIL import Image

SOURCE = Path('D:/codex/home/generated_images/01a138cb-74d6-7cc1-a284-bfe1058d63f3')
DEST = Path(__file__).resolve().parents[1] / 'web/public/art'
ASSETS = {
    'threshold': 'a035fdda-6aeb-40a7-a49b-30cdf9173cde',
    'rooftop': '392fb772-2a2d-4391-a37e-44563ce1f19f',
    'seaside': 'be0c5d7f-4745-4f08-9b57-28c6c99754f7',
    'postoffice': '216dcb24-58d1-441e-8bdd-c207af10af3d',
    'repair': 'a907fe0b-6659-4b05-a621-3bc244e76a7f',
    'greenhouse': 'd533f4dc-38c0-4095-b526-c17b3b2a22ce',
    'observatory': '9f748461-67b4-4cb8-b742-8edce7f63c42',
    'person-departure': '7754f047-a847-4804-92f6-7683018363cf',
    'person-homecoming': '6d17d85c-cd9a-467e-9615-a00778b0b3c7',
    'person-apology': 'ed91f81b-02ed-40a6-ab4d-6980606b5d08',
    'person-thanks': '82917970-8d82-476d-8c6e-818fd60d1d07',
    'person-reconnect': 'b215e640-a2fb-4dda-82fe-2a3a05bf0b13',
    'person-beginning': '131db55e-6efc-4cd9-a1b1-3adbb2adc5ec',
    'rain-hand': 'cf13266e-3d1c-43de-8db4-396b5b562659',
}

if __name__ == '__main__':
    DEST.mkdir(parents=True, exist_ok=True)
    for name, image_id in ASSETS.items():
        with Image.open(SOURCE / f'exec-{image_id}.png') as image:
            # 保留透明手臂的 alpha；只缩小人物缩略图，环境保留原分辨率。
            if name.startswith('person-'):
                image.thumbnail((640, 640), Image.Resampling.LANCZOS)
            if name == 'rain-hand':
                assert image.mode == 'RGBA' and image.getextrema()[3][0] == 0
                image.thumbnail((800, 800), Image.Resampling.LANCZOS)
            target = DEST / f'{name}.webp'
            image.save(target, 'WEBP', quality=88, method=6)
            print(f'{name}: {image.width}x{image.height}, {target.stat().st_size // 1024} KB')
