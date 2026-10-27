#!/usr/bin/env python3
"""검증기. 공식 luau CLI 로 실제 모듈을 실행하고, 빌더 산출물을 실행한 Grid.luau 덤프와 전수 대조한다.
PASS 줄은 무엇이 아닌지도 적는다. Studio·물리·네트워크는 UNVERIFIED 로 남긴다."""
from pathlib import Path
import hashlib
import os
import re
import subprocess
import sys
import xml.etree.ElementTree as E
sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_place
ROOT = Path(__file__).resolve().parents[1]
REPO = Path(os.environ.get('ARCHER_REPO', str(ROOT.parents[1])))  # 스크래치 사본에서 돌릴 때 원작 위치
runner = Path(os.environ.get('LUAU_BIN', 'luau'))
compiler = runner.with_name('luau-compile')
analyzer = runner.with_name('luau-analyze')
if not runner.is_file() or not compiler.is_file() or not analyzer.is_file():
    raise SystemExit('Official Luau CLI and sibling luau-compile / luau-analyze are required; no skipped pass.')

# 1. 실제 모듈 테스트 (두 별도 프로세스로 결정성 해시 비교)
first = subprocess.run([str(runner), str(ROOT / 'tests/run.luau')], capture_output=True, text=True)
sys.stdout.write(first.stdout)
if first.returncode: raise SystemExit(first.stderr or 'tests failed')
second = subprocess.run([str(runner), str(ROOT / 'tests/run.luau')], capture_output=True, text=True)
h1 = re.search(r'^HASH (\w+)$', first.stdout, re.M); h2 = re.search(r'^HASH (\w+)$', second.stdout, re.M)
assert h1 and h2 and h1.group(1) == h2.group(1), 'determinism: two processes produced different state hashes'
print('PASS determinism across two separate luau processes (same seed, same inputs)')

# 2. 컴파일 · 미지 전역 · require 허용 목록
files = sorted((ROOT / 'src').rglob('*.luau')) + sorted((ROOT / 'tests').glob('*.luau')) + sorted((ROOT / 'tools').glob('*.luau'))
for path in files:
    result = subprocess.run([str(compiler), str(path)], capture_output=True)
    if result.returncode: raise SystemExit(f'{path}: {result.stderr.decode("utf-8", errors="replace")}')
allowed_globals = {'game', 'workspace', 'Enum', 'Instance', 'Vector3', 'Vector2', 'CFrame', 'Color3', 'UDim2', 'UDim', 'RaycastParams', 'script', 'task', 'buffer', 'typeof'}
analysis = subprocess.run([str(analyzer), '--formatter=plain', *[str(p) for p in files]], capture_output=True, text=True)
unknown = set(re.findall(r"Unknown global '([^']+)'", analysis.stdout + analysis.stderr)) - allowed_globals
if unknown: raise SystemExit('Undefined globals: ' + ', '.join(sorted(unknown)))
if analysis.returncode not in (0, 1): raise SystemExit('Luau analyzer failed to execute: ' + analysis.stderr)
print(f'PASS compiled {len(files)} Luau files and unknown-global analysis with explicit Roblox allowlist (not Roblox API typechecking)')
allowed_shared = {'Sim', 'Grid', 'Balance', 'Theme', 'Packet'}
for path in list((ROOT / 'src/server').glob('*.luau')) + list((ROOT / 'src/client').glob('*.luau')):
    for mod in re.findall(r'require\(Shared\.(\w+)\)', path.read_text()):
        assert mod in allowed_shared, f'{path.name} requires shared.{mod}; allowed: {sorted(allowed_shared)}'
print('PASS server/client require only shared Sim·Grid·Balance·Theme·Packet (Campaign stays internal)')

# 3. 빌더 결정성 · 스크립트 포함 · 서비스
artifact = build_place.build()
first_bytes = artifact.read_bytes()
assert first_bytes == build_place.build().read_bytes(), 'non-deterministic artifact'
xml = E.parse(artifact)
scripts = {n.attrib['referent']: n for n in xml.iter('Item') if n.attrib['class'] in ('Script', 'LocalScript', 'ModuleScript')}
assert len(scripts) == len(build_place.SOURCE_MAP) == len(list((ROOT / 'src').rglob('*.luau')))
for ref, path in build_place.SOURCE_MAP.items():
    n = scripts[ref]
    assert n.find("./Properties/ProtectedString[@name='Source']").text == (ROOT / path).read_text(), path
    expected = 'LocalScript' if '.client.' in path else 'Script' if '.server.' in path else 'ModuleScript'
    assert n.attrib['class'] == expected
classes = [n.attrib['class'] for n in xml.iter('Item')]
for cls in ['Workspace', 'SpawnLocation', 'Lighting', 'Atmosphere', 'ReplicatedStorage', 'ServerScriptService', 'StarterPlayerScripts', 'WedgePart']:
    assert cls in classes, cls
assert classes.count('RemoteEvent') == 5
print(f'PASS deterministic XML: exact {len(scripts)} scripts, 5 RemoteEvents, services, spawn, lighting ({len(first_bytes)} bytes) — not opened in Studio')

# 4. 격자 전수 대조: 실행한 Grid.luau 덤프 vs XML 파트 AABB
dump = subprocess.run([str(runner), str(ROOT / 'tools/dump_grid.luau')], capture_output=True, text=True, check=True).stdout.splitlines()
cols, rows, cell, el = (int(v) for v in dump[0].split()[1:])
cells = {}
sites = {}
for line in dump[1:]:
    if line.startswith('SITE'):
        _, sid, x, z = line.split(); sites[sid] = (float(x), float(z))
    else:
        c, r, blocked, elev, ramp = (int(v) for v in line.split()); cells[(c, r)] = (blocked, elev, ramp)
def num(node, tag, name):
    p = node.find(f"./Properties/{tag}[@name='{name}']")
    return p
parts = []
for n in xml.iter('Item'):
    if n.attrib['class'] not in ('Part', 'WedgePart', 'SpawnLocation'): continue
    collide = n.find("./Properties/bool[@name='CanCollide']").text == 'true'
    size = num(n, 'Vector3', 'size'); cf = num(n, 'CoordinateFrame', 'CFrame')
    sx, sy, sz = (float(size.find(a).text) for a in ('X', 'Y', 'Z'))
    x, y, z = (float(cf.find(a).text) for a in ('X', 'Y', 'Z'))
    parts.append({'cls': n.attrib['class'], 'collide': collide, 'x0': x - sx / 2, 'x1': x + sx / 2, 'y0': y - sy / 2, 'y1': y + sy / 2, 'z0': z - sz / 2, 'z1': z + sz / 2, 'name': n.find("./Properties/string[@name='Name']").text})
def covers(p, c, r):
    cx0, cz0 = c * cell, r * cell
    return p['x0'] <= cx0 + 1e-6 and p['x1'] >= cx0 + cell - 1e-6 and p['z0'] <= cz0 + 1e-6 and p['z1'] >= cz0 + cell - 1e-6
def overlaps_band(p, lo, hi): return p['y1'] > lo + 1e-6 and p['y0'] < hi - 1e-6
def intersects_cell(p, c, r):
    cx0, cz0 = c * cell, r * cell
    return p['x1'] > cx0 + 1e-6 and p['x0'] < cx0 + cell - 1e-6 and p['z1'] > cz0 + 1e-6 and p['z0'] < cz0 + cell - 1e-6
failures = []
for (c, r), (blocked, elev, ramp) in cells.items():
    base_y = elev * el
    if ramp:
        if not any(p['cls'] == 'WedgePart' and covers(p, c, r) for p in parts): failures.append(f'ramp cell {c},{r} has no WedgePart')
    elif blocked:
        if not any(p['collide'] and p['cls'] == 'Part' and covers(p, c, r) and overlaps_band(p, base_y, base_y + 4) for p in parts): failures.append(f'blocked cell {c},{r} elev {elev} has no solid part in [{base_y},{base_y + 4}]')
    else:
        bad = [p['name'] for p in parts if p['collide'] and p['cls'] != 'WedgePart' and intersects_cell(p, c, r) and overlaps_band(p, base_y + 0.5, base_y + 4)]
        if bad: failures.append(f'walkable cell {c},{r} elev {elev} is obstructed by {bad}')
gx, gz = sites['exit_gate']
assert cells[(int(gx // cell), int(gz // cell))][0] == 1, 'east exit gate cell must be blocked in Grid'
if failures: raise SystemExit('GRID MISMATCH:\n' + '\n'.join(failures[:20]) + f'\n({len(failures)} total)')
print(f'PASS grid vs parts: all {len(cells)} cells (walkable band clear, blocked covered, ramp wedge, east gate blocked) — collision geometry, not Studio physics')

# 5. 원작 오라클 신선도: 원작 소스 해시가 기록과 다르면 STALE
expected = {'sim.js': 'b19b6cc2349aba244798759aa5bd2b2b8f57dd626c7a586de225967ee145ed8c', 'campaign.js': '6b334b890d0be7c7ac2f6c49b754ed0d1abbc7149eebb125dfbce12e7391e763', 'map.js': 'bdf6970a73e034dff4fd33ecbe9d446abc03643b640e7abe04e4819c840502c1'}
origin = REPO / 'portal-fe/public/games/marine-command/js/origin'
stale = [name for name, h in expected.items() if not (origin / name).is_file() or hashlib.sha256((origin / name).read_bytes()).hexdigest() != h]
if stale:
    print(f'STALE original oracle: {stale} changed since verifications/original-bot.md — re-measure with orig_bot.mjs; oracle rows in tests/run.luau are not a PASS')
    raise SystemExit(2)
print('PASS original oracle freshness: sim.js/campaign.js/map.js hashes match verifications/original-bot.md (oracle windows still valid)')
for line in [
    'Studio Play, Humanoid physics, WalkSpeed 13.75 실측, HRP→Sim 리더 주입 지연',
    '클라이언트 액터 240 렌더 프레임 시간, 10Hz buffer 패킷 크기, 5Hz 요약 크기',
    '카메라 피치/거리, 배치·조준 레이캐스트, 터치 배치, 터치 점프 버튼 숨김',
    '2인 접속, 협동 수락 흐름, 호스트 단독 이어하기(부재 손님 병력), 슬롯 재결속',
    'DataStore UpdateAsync 호출, BindToClose, Studio 메모리 저장소 외 실제 저장',
    'Lighting/Atmosphere 시각, 가시 절벽 높이와 격자 LOS 의 일치',
]:
    print('UNVERIFIED: ' + line)
