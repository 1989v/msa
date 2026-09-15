#!/usr/bin/env python3
"""로컬 ComfyUI 로 에셋 1장 생성 → assets/generated/raw/<name>.png + <name>.json (표준 라이브러리만).

  python3 generate_asset.py --type character --name robot_warrior_001 --prompt "cute small retro robot warrior" [--seed 12345]
        [--pose "standing, facing forward"] [--workflow workflows/sdxl-txt2img.json] [--server http://127.0.0.1:8188]

골격 — ComfyUI 실연동 미검증(2026-09-15). README 의 사다리 STEP 8 에서 처음 실제로 돈다.
"""
import argparse, json, sys, time, uuid, urllib.request, urllib.error, urllib.parse
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]  # <game>/
STYLE = json.loads((HERE / 'prompts/style.json').read_text())


def compose_prompt(asset_type: str, description: str, pose: str | None) -> tuple[str, str]:
    parts = [STYLE['ASSET_TYPE'].get(asset_type, asset_type), description]
    if pose:
        parts.append(pose)
    parts += [STYLE['CAMERA'], STYLE['GLOBAL_STYLE'], STYLE['QUALITY'], STYLE['BACKGROUND']]
    return ', '.join(p.strip() for p in parts if p and p.strip()), STYLE['NEGATIVE']


def fill(obj, values: dict):
    """자리표시자 문자열을 타입 있는 값으로 바꾼다 ("{{SEED}}" → 12345)."""
    if isinstance(obj, dict):
        return {k: fill(v, values) for k, v in obj.items() if k != '_'}
    if isinstance(obj, list):
        return [fill(v, values) for v in obj]
    if isinstance(obj, str) and obj.startswith('{{') and obj.endswith('}}'):
        key = obj[2:-2]
        if key not in values:
            sys.exit(f'워크플로 자리표시자 {obj} 에 넣을 값이 없다')
        return values[key]
    return obj


def http(method: str, url: str, body: dict | None = None) -> bytes:
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers={'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.read()
    except urllib.error.URLError as e:
        sys.exit(f'ComfyUI 에 닿지 못했다: {url} — {e}. README STEP 1 (서버 실행) 부터 확인')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--type', required=True, choices=list(STYLE['ASSET_TYPE']))
    ap.add_argument('--name', required=True)
    ap.add_argument('--prompt', required=True, help='캐릭터별 설명 (바뀌는 것만)')
    ap.add_argument('--pose', default=None)
    ap.add_argument('--seed', type=int, default=12345, help='재현성 확인용 고정값. 다양화는 seed 를 바꿔서')
    ap.add_argument('--workflow', default=str(HERE / 'workflows/sdxl-txt2img.json'))
    ap.add_argument('--server', default='http://127.0.0.1:8188')
    a = ap.parse_args()

    positive, negative = compose_prompt(a.type, a.prompt, a.pose)
    wf = fill(json.loads(Path(a.workflow).read_text()), {
        'CHECKPOINT': STYLE['checkpoint'], 'WIDTH': STYLE['width'], 'HEIGHT': STYLE['height'], 'STEPS': STYLE['steps'],
        'CFG': STYLE['cfg'], 'SAMPLER': STYLE['sampler'], 'SCHEDULER': STYLE['scheduler'],
        'POSITIVE': positive, 'NEGATIVE': negative, 'SEED': a.seed, 'PREFIX': f'forge/{a.name}',
    })
    client_id = uuid.uuid4().hex
    resp = json.loads(http('POST', f'{a.server}/prompt', {'prompt': wf, 'client_id': client_id}))
    if 'prompt_id' not in resp:
        sys.exit(f'ComfyUI 가 프롬프트를 거부했다: {json.dumps(resp, ensure_ascii=False)[:500]}')
    pid = resp['prompt_id']
    print(f'queued {pid} — 생성 대기', file=sys.stderr)

    outputs = None
    for _ in range(600):  # 최대 10분
        hist = json.loads(http('GET', f'{a.server}/history/{pid}'))
        if pid in hist and hist[pid].get('outputs'):
            outputs = hist[pid]['outputs']
            break
        time.sleep(1)
    if not outputs:
        sys.exit('10분 안에 결과가 없다 — ComfyUI 콘솔의 오류를 본다')

    images = [img for node in outputs.values() for img in node.get('images', [])]
    if not images:
        sys.exit('SaveImage 출력이 없다 — 워크플로의 SaveImage 노드를 확인')
    img = images[0]
    q = urllib.parse.urlencode({'filename': img['filename'], 'subfolder': img.get('subfolder', ''), 'type': img.get('type', 'output')})
    png = http('GET', f'{a.server}/view?{q}')

    raw = ROOT / 'assets/generated/raw'
    raw.mkdir(parents=True, exist_ok=True)
    out = raw / f'{a.name}.png'
    out.write_bytes(png)
    meta = {
        'name': a.name, 'type': a.type, 'provider': 'comfyui', 'model': STYLE['checkpoint'], 'seed': a.seed,
        'width': STYLE['width'], 'height': STYLE['height'], 'sampler': STYLE['sampler'], 'scheduler': STYLE['scheduler'],
        'steps': STYLE['steps'], 'cfg': STYLE['cfg'], 'prompt': positive, 'negative_prompt': negative,
        'workflow': str(Path(a.workflow).relative_to(ROOT)) if Path(a.workflow).is_relative_to(ROOT) else a.workflow,
        'created_at': datetime.now(timezone.utc).isoformat(),
    }
    (raw / f'{a.name}.json').write_text(json.dumps(meta, ensure_ascii=False, indent=2))
    print(str(out.relative_to(ROOT)))


if __name__ == '__main__':
    main()
