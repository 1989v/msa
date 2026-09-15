#!/usr/bin/env python3
"""생성 원본 → 배경 제거(선택) → 알파 crop → padding → 정사각 리사이즈 → PNG.

  python3 process_asset.py --in assets/generated/raw/x.png --out assets/generated/processed/x.png [--size 512] [--pad 0.06] [--no-rembg]

의존성: Pillow (필수), rembg (선택 — 없으면 알파가 이미 있는 이미지만 처리한다).
골격 — 실연동 미검증(2026-09-15).
"""
import argparse, sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    sys.exit('Pillow 가 없다: pip install pillow')


def remove_background(img: 'Image.Image') -> 'Image.Image':
    try:
        from rembg import remove  # type: ignore
    except ImportError:
        sys.exit('알파 채널이 없고 rembg 도 없다: pip install rembg (로컬 실행, 유료 API 아님) 또는 --no-rembg 로 알파 있는 원본을 넣는다')
    return remove(img).convert('RGBA')


def has_alpha(img: 'Image.Image') -> bool:
    if img.mode != 'RGBA':
        return False
    lo, hi = img.getchannel('A').getextrema()
    return lo < 250


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--in', dest='src', required=True)
    ap.add_argument('--out', dest='dst', required=True)
    ap.add_argument('--size', type=int, default=512)
    ap.add_argument('--pad', type=float, default=0.06, help='한 변 대비 여백 비율')
    ap.add_argument('--no-rembg', action='store_true')
    a = ap.parse_args()

    img = Image.open(a.src).convert('RGBA')
    if not has_alpha(img):
        if a.no_rembg:
            sys.exit('알파가 없는데 --no-rembg 다. 배경 제거를 먼저 하라')
        img = remove_background(img)

    bbox = img.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()
    if not bbox:
        sys.exit('알파가 전부 투명 — 빈 그림')
    img = img.crop(bbox)

    side = int(max(img.size) * (1 + a.pad * 2))
    canvas = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    canvas.paste(img, ((side - img.width) // 2, side - img.height - int(side * a.pad)))  # 발을 아래 여백선에 맞춘다
    canvas = canvas.resize((a.size, a.size), Image.LANCZOS)

    Path(a.dst).parent.mkdir(parents=True, exist_ok=True)
    canvas.save(a.dst, 'PNG', optimize=True)
    print(a.dst)


if __name__ == '__main__':
    main()
