#!/usr/bin/env python3
"""클립 폴더(001.png, 002.png …) → 스프라이트시트 PNG + 프레임 JSON.

  python3 create_spritesheet.py --dir assets/characters/robot/idle --out assets/characters/robot/idle.png [--cols 4]

프레임은 파일명 순. 모든 프레임은 같은 크기여야 한다(process_asset.py 가 맞춰 준다). 의존성: Pillow.
"""
import argparse, json, sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    sys.exit('Pillow 가 없다: pip install pillow')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dir', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--cols', type=int, default=0, help='0 이면 프레임 수의 제곱근에 가깝게')
    a = ap.parse_args()

    files = sorted(p for p in Path(a.dir).iterdir() if p.suffix.lower() == '.png')
    if not files:
        sys.exit(f'{a.dir} 에 PNG 가 없다')
    frames = [Image.open(f).convert('RGBA') for f in files]
    w, h = frames[0].size
    if any(f.size != (w, h) for f in frames):
        sys.exit('프레임 크기가 제각각이다 — process_asset.py 로 먼저 맞춘다')
    cols = a.cols or max(1, round(len(frames) ** 0.5))
    rows = -(-len(frames) // cols)

    sheet = Image.new('RGBA', (cols * w, rows * h), (0, 0, 0, 0))
    meta = {'frameWidth': w, 'frameHeight': h, 'cols': cols, 'rows': rows, 'frames': []}
    for i, (f, img) in enumerate(zip(files, frames)):
        x, y = (i % cols) * w, (i // cols) * h
        sheet.paste(img, (x, y))
        meta['frames'].append({'name': f.stem, 'x': x, 'y': y, 'w': w, 'h': h})

    out = Path(a.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(out, 'PNG', optimize=True)
    out.with_suffix('.json').write_text(json.dumps(meta, ensure_ascii=False, indent=2))
    print(f'{out} ({len(frames)} frames, {cols}x{rows})')


if __name__ == '__main__':
    main()
