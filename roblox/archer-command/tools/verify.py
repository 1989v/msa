#!/usr/bin/env python3
"""검증기. 공식 luau CLI 로 실제 공유 모듈을 실행하고, 빌더 산출물의 구조와 로블록스 네이티브 조건을 검사한다.
PASS 줄은 무엇이 아닌지도 적는다. Studio·물리·애니메이션·네트워크는 UNVERIFIED 로 남긴다."""
from pathlib import Path
import hashlib
import json
import os
import re
import subprocess
import sys
import xml.etree.ElementTree as E
sys.path.insert(0, str(Path(__file__).resolve().parent))
import build
ROOT = Path(__file__).resolve().parents[1]
runner = Path(os.environ.get('LUAU_BIN', 'luau'))
compiler = runner.with_name('luau-compile')
analyzer = runner.with_name('luau-analyze')
if not runner.is_file() or not compiler.is_file() or not analyzer.is_file():
    raise SystemExit('Official Luau CLI and sibling luau-compile / luau-analyze are required; no skipped pass.')
failures = []
def gate(ok, text):
    if ok: print('PASS ' + text)
    else: failures.append(text); print('FAIL ' + text)

# 1. 실제 공유 모듈 검사
spec = subprocess.run([str(runner), str(ROOT / 'tests/rules.spec.luau')], capture_output=True, text=True)
sys.stdout.write(spec.stdout)
if spec.returncode: raise SystemExit(spec.stderr or 'rules spec failed')

# 2. 컴파일 · 미지 전역 · 의존 방향
files = sorted((ROOT / 'src').rglob('*.luau')) + sorted((ROOT / 'tests').glob('*.luau'))
for path in files:
    r = subprocess.run([str(compiler), str(path)], capture_output=True)
    if r.returncode: raise SystemExit(f'{path}: {r.stderr.decode("utf-8", errors="replace")}')
allowed_globals = {'game', 'workspace', 'Enum', 'Instance', 'Vector3', 'Vector2', 'CFrame', 'Color3', 'UDim2', 'UDim', 'RaycastParams', 'script', 'task', 'typeof', 'warn',
                   'NumberSequence', 'NumberSequenceKeypoint', 'NumberRange', 'ColorSequence', 'TweenInfo', 'Random'}
analysis = subprocess.run([str(analyzer), '--formatter=plain', *[str(p) for p in files]], capture_output=True, text=True)
unknown = set(re.findall(r"Unknown global '([^']+)'", analysis.stdout + analysis.stderr)) - allowed_globals
if unknown: raise SystemExit('Undefined globals: ' + ', '.join(sorted(unknown)))
if analysis.returncode not in (0, 1): raise SystemExit('Luau analyzer failed to execute: ' + analysis.stderr)
print(f'PASS compiled {len(files)} Luau files and unknown-global analysis with explicit Roblox allowlist (not Roblox API typechecking)')
shared_text = ''.join(p.read_text() for p in (ROOT / 'src/shared').glob('*.luau'))
gate('game:GetService' not in shared_text and 'workspace' not in shared_text, 'shared modules never touch Roblox services (pure rules stay CLI-testable)')
client_text = {p.name: p.read_text() for p in (ROOT / 'src/client').glob('*.luau')}
gate(all('script.Parent' not in t and 'ServerScriptService' not in t for t in client_text.values()), 'client scripts require only ReplicatedStorage.ArcherCommand (no server modules)')

# 3. 빌더 결정성 · 스크립트 정확 포함 · 서비스
artifact = build.build()
first = artifact.read_bytes()
assert first == build.build().read_bytes(), 'non-deterministic artifact'
xml = E.parse(artifact)
items = list(xml.iter('Item'))
scripts = {n.attrib['referent']: n for n in items if n.attrib['class'] in ('Script', 'LocalScript', 'ModuleScript')}
src_files = list((ROOT / 'src').rglob('*.luau'))
gate(len(scripts) == len(build.SOURCE_MAP) == len(src_files), f'exactly {len(src_files)} scripts in the place and none inside embedded assets')
for ref, path in build.SOURCE_MAP.items():
    n = scripts[ref]
    assert n.find("./Properties/ProtectedString[@name='Source']").text == (ROOT / path).read_text(), path
    expected = 'LocalScript' if '.client.' in path else 'Script' if '.server.' in path else 'ModuleScript'
    assert n.attrib['class'] == expected, path
classes = [n.attrib['class'] for n in items]
for cls in ['Workspace', 'SpawnLocation', 'Lighting', 'Atmosphere', 'ReplicatedStorage', 'ServerScriptService', 'ServerStorage', 'StarterPlayer', 'StarterPlayerScripts', 'ProximityPrompt', 'PointLight', 'Fire']:
    assert cls in classes, cls
assert classes.count('RemoteEvent') == 3
print(f'PASS deterministic XML: services, spawn, lighting, 3 RemoteEvents, prompts, lights ({len(first)} bytes, {classes.count("Part") + classes.count("WedgePart")} parts) — not opened in Studio')

# 4. 에셋 출처: Roblox 공식 소유(creator 1) · 해시 일치 · 스크립트 제거
prov = json.loads((ROOT / 'assets/roblox/provenance.json').read_text())
asset_files = sorted((ROOT / 'assets/roblox').glob('*.rbxmx'))
ok = True
for p in asset_files:
    rec = prov.get(p.stem)
    if not rec or rec['creatorId'] != 1 or rec['sha256'] != hashlib.sha256(p.read_bytes()).hexdigest(): ok = False; print('   asset mismatch', p.name)
raw_scripts = sum(len(re.findall(r'class="(?:Script|LocalScript|ModuleScript)"', p.read_text())) for p in asset_files)
gate(ok and len(asset_files) == len(prov), f'{len(asset_files)} embedded models are Roblox-owned (creator id 1) with matching sha256 in provenance.json; {raw_scripts} scripts in the raw files were stripped at build')

# 5. 로블록스 네이티브 조건 (1차 이식에서 지적된 세 결함을 구조로 막는다)
cam = client_text['Camera.client.luau']
body = re.search(r'local function quarterView\(\)(.*?)\nend\n', cam, re.S)
scriptable_total = cam.count('CameraType.Scriptable')
gate(body is not None and scriptable_total == 1 and 'CameraType.Scriptable' in body.group(1) and 'CameraType.Custom' in cam,
     'default Roblox camera stays default: Scriptable appears only inside the quarter-view toggle and Custom is restored on exit')
sp = next(n for n in items if n.attrib['class'] == 'StarterPlayer')
zmin = float(sp.find("./Properties/float[@name='CameraMinZoomDistance']").text); zmax = float(sp.find("./Properties/float[@name='CameraMaxZoomDistance']").text)
qd = re.search(r'local distance = (\d+)', cam); qmax = re.search(r'local MIN, MAX = (\d+), (\d+)', cam)
gate(8 <= zmin < zmax <= 40 and qd and int(qd.group(1)) <= 36 and qmax and int(qmax.group(2)) <= 48,
     f'camera distances within public references: default zoom {zmin:g}~{zmax:g}, quarter view {qd.group(1)} (max {qmax.group(2)}) — the first port used 96~150')
rigs = (ROOT / 'src/server/Rigs.luau').read_text()
setup = re.search(r'function Rigs\.setupPlayer\(character\)(.*?)\nend\n', rigs, re.S)
cfg = (ROOT / 'src/shared/Config.luau').read_text()
lr = re.search(r'lightRange = (\d+)', cfg)
gate(setup and 'addLight(' in setup.group(1) and 'PointLight' in rigs and lr and int(lr.group(1)) >= 20,
     f'player character carries a PointLight (range {lr.group(1)}) and allies carry one too — brightness/visual quality itself is Studio-only')
fx = client_text['Effects.client.luau']
arrow_fn = re.search(r'local function makeArrow\(\)(.*?)\nend\n', fx, re.S)
gate(arrow_fn and 'Instance.new("Trail")' in arrow_fn.group(1) and 'LightInfluence = 0' in arrow_fn.group(1) and 'Neon' in arrow_fn.group(1)
     and 'ParticleEmitter' in fx and 'Instance.new("Sound")' in fx and 'PointLight' in fx,
     'arrow visuals: Trail with LightInfluence 0 + Neon head + muzzle PointLight + impact ParticleEmitter + Sound (Weapons Kit pattern)')
banned = re.compile(r'WASD|Space|Shift|\[Q\]|Q/E|키를 눌러|을 누르면|클릭하세요|점프 버튼')
hits = [(name, m.group(0)) for name, t in client_text.items() for lit in re.findall(r'"([^"\n]*)"', t) for m in banned.finditer(lit)]
gate(not hits, f'no web-style key hints or jump buttons in client UI strings ({hits})')
storage = next(n for n in items if n.attrib['class'] == 'ServerStorage')
templates = {n.find("./Properties/string[@name='Name']").text: n for n in storage.iter('Item') if n.attrib['class'] == 'Model'}
def has(node, cls): return any(c.attrib['class'] == cls for c in node.iter('Item'))
gate(all(k in templates for k in ('Zombie', 'Bat', 'BlockRig', 'Bow', 'Tower', 'TowerSite')) and has(templates['Zombie'], 'Humanoid') and has(templates['Zombie'], 'Motor6D')
     and has(templates['Bat'], 'Motor6D') and has(templates['BlockRig'], 'Humanoid') and sum(1 for c in templates['BlockRig'].iter('Item') if c.attrib['class'] == 'Motor6D') == 6
     and all(templates[k].find("./Properties/Ref[@name='PrimaryPart']") is not None and templates[k].find("./Properties/Ref[@name='PrimaryPart']").text != 'null' for k in ('Zombie', 'Bat', 'BlockRig', 'Tower', 'TowerSite', 'Bow'))
     and 'CreateHumanoidModelFromDescriptionAsync' in rigs,
     'NPC templates are Humanoid rigs with Motor6D joints (Roblox Zombie, Bat wings, R6 fallback) and allies come from HumanoidDescription avatars')
lim = re.search(r'LIMITS = \{ enemies = (\d+)', cfg)
gate(lim and int(lim.group(1)) <= 60, f'concurrent enemy cap {lim.group(1)} ≤ 60 for server Humanoid rigs')
jp = float(sp.find("./Properties/float[@name='CharacterJumpPower']").text)
gate(jp == 0 and 'Jump' not in ''.join(client_text.values()), 'no jump: CharacterJumpPower 0 (default touch jump button hides itself) and no custom jump GUI')
lighting = next(n for n in items if n.attrib['class'] == 'Lighting')
clock = float(lighting.find("./Properties/float[@name='ClockTime']").text)
tech = lighting.find("./Properties/token[@name='Technology']").text
gate((clock >= 19 or clock <= 5) and tech == '4' and has(lighting, 'Atmosphere') and has(lighting, 'BloomEffect'),
     f'night lighting preset: ClockTime {clock:g}, Technology Future, Atmosphere + Bloom (visual result is Studio-only)')
# 6. 플레이 피드백(2026-10-29)으로 더한 조건: 공격 모션 · 무리 산개 · 치료사 NPC · 강화 먼저 튜토리얼
npc = (ROOT / 'src/server/Npc.luau').read_text(); main = (ROOT / 'src/server/Main.server.luau').read_text(); camp_src = (ROOT / 'src/server/Campaign.luau').read_text()
attack_fn = re.search(r'function Rigs\.attack\(model, hum\)(.*?)\nend\n', rigs, re.S)
gate(attack_fn and ':Play(' in attack_fn.group(1) and 'attack = "rbxassetid://' in rigs and 'AnimationPriority.Action' in rigs
     and npc.count('Rigs.attack(') >= 2 and 'ToolSlashAnim' in fx and 'AnimationPriority.Action' in fx and 'shooter == player.Character' in fx,
     'attack motion: NPC archers and zombies play an Action-priority attack track on the server, the local player plays toolslash on its own character when its arrow Fx arrives')
entries = re.search(r'entries = \{((?:\s*vec\([^)]*\),?)+)\s*\}', cfg)
n_entries = len(re.findall(r'vec\(', entries.group(1))) if entries else 0
jitter = re.search(r'speedJitter = ([\d.]+)', cfg); wobble = re.search(r'wobbleRadius = ([\d.]+)', cfg)
gate(n_entries >= 3 and jitter and float(jitter.group(1)) > 0 and wobble and float(wobble.group(1)) >= 3
     and 'entries[random:NextInteger(1, #entries)]' in camp_src and 'def.walkSpeed * (1 + Config.SWARM.speedJitter' in npc and '(target.pos + ent.wobble)' in npc,
     f'swarm spread: waves enter from {n_entries} bowl edges, per-enemy WalkSpeed jitter {jitter.group(1) if jitter else "?"}, destination wobble {wobble.group(1) if wobble else "?"} studs re-rolled every few seconds')
heal_fn = re.search(r'function Rigs\.makeHealer\(\)(.*?)\nend\n', rigs, re.S)
hps = re.search(r'healPerSecond = (\d+)', cfg)
gate(heal_fn and 'BillboardGui' in heal_fn.group(1) and 'AddTag(model, "Healer")' in heal_fn.group(1) and 'addLight(' in heal_fn.group(1) and 'ParticleEmitter' in heal_fn.group(1)
     and 'ensureHealer()' in main and 'FireAllClients("heal"' in main and 'function handlers.heal' in fx and hps and int(hps.group(1)) >= 15,
     f'healer is a visible NPC: HumanoidDescription avatar with name sign, green light, aura particles, tag Healer; heal {hps.group(1) if hps else "?"} hp/s near it with per-second heal Fx')
steps = re.search(r'local tutorialSteps = \{(.*?)\n\}', main, re.S)
first = re.search(r'\{ key = "(\w+)", hint = "(\w+)"', steps.group(1)) if steps else None
start_gold = re.search(r'START = \{ gold = (\d+)', cfg); first_at = re.search(r'firstAt = (\d+)', cfg)
gate(first and first.group(2) == 'attack' and 'hint = session.hint' in main and 's.hint' in client_text['Hud.client.luau'] and 'UIStroke' in client_text['Hud.client.luau']
     and start_gold and int(start_gold.group(1)) >= 280 and first_at and int(first_at.group(1)) >= 60,
     f'upgrade-first opening: {start_gold.group(1) if start_gold else "?"} starting gold, first wave at {first_at.group(1) if first_at else "?"}s, tutorial step 1 points at the attack-upgrade button and the HUD pulses it')
world = next(n for n in items if n.attrib['class'] == 'Workspace')
embedded = sum(1 for n in world.iter('Item') if n.attrib['class'] == 'Model' and n.find("./Properties/string[@name='Name']").text in ('Model', 'castleInteriorTorch', 'castleInteriorWell', 'landscapeFence', 'Skeleton', 'Flowers', 'Castle_Roof_2'))
prompts = sum(1 for n in world.iter('Item') if n.attrib['class'] == 'ProximityPrompt')
print(f'INFO world: {embedded} Roblox-owned models placed, {prompts} ProximityPrompts (counts are scale, not quality evidence)')

if failures: raise SystemExit(f'{len(failures)} native gate(s) failed')
for line in [
    'Studio Play, Humanoid physics/MoveTo on Terrain hills, stuck-jump, NPC animation IDs actually playing',
    'CreateHumanoidModelFromDescriptionAsync in Studio (network), BlockRig fallback posture, Model:ScaleTo on R6 Zombie',
    'arrow/trail visibility and sound IDs audible, PointLight look under Future lighting, Atmosphere density by eye',
    'default camera feel vs quarter-view toggle, touch tap placement, pinch zoom, ProximityPrompt panels',
    '2 players, host handoff, DataStore UpdateAsync outside Studio, BindToClose save',
    'balance: upgrade-first opening and 6-zombie first wave at 75s — numbers in Config.luau are a second guess after one play session',
    'attack track visually reads as a bow shot (toolslash is a swing), swarm spread by eye, healer NPC pose on the shrine ring',
]:
    print('UNVERIFIED: ' + line)
