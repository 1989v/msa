#!/usr/bin/env python3
"""검증기. 공식 luau CLI 로 실제 공유 모듈을 실행하고, 빌더 산출물의 구조와 로블록스 네이티브 조건을 검사한다.
PASS 줄은 무엇이 아닌지도 적는다. Studio·물리·포즈 생김새·네트워크는 UNVERIFIED 로 남긴다."""
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
shared_text = ''.join(p.read_text() for p in (ROOT / 'src/shared').glob('*.luau') if p.name != 'Theme.luau') + (ROOT / 'src/server/Commands.luau').read_text()
gate(not re.search(r'game:GetService|workspace|Instance\.new|Vector3\.new|CFrame|\.Magnitude|:Dot\(|\.Unit\b', shared_text),
     'shared rule modules and Commands never touch Roblox services or vector methods ({X,Y,Z} component math only — CLI-testable; Theme holds Color3 only)')
# 서버 모듈 require 그래프: 비순환, Main 을 require 하는 모듈 없음, Combat 은 서버 모듈을 모른다
server_files = {p.stem.replace('.server', ''): p.read_text() for p in (ROOT / 'src/server').glob('*.luau')}
edges = {name: set(re.findall(r'require\(script\.Parent\.(\w+)\)', src)) for name, src in server_files.items()}
def acyclic(g):
    seen, stack = set(), set()
    def visit(n):
        if n in stack: return False
        if n in seen: return True
        seen.add(n); stack.add(n)
        for m in g.get(n, ()):
            if not visit(m): return False
        stack.discard(n); return True
    return all(visit(n) for n in g)
gate(acyclic(edges) and not any('Main' in deps for deps in edges.values()) and edges.get('Combat') == set() and 'Combat' in edges['Items'] and 'Combat' in edges['Projectiles'] and 'Combat' in edges['Bots'],
     f'server require graph is a DAG with Combat at the bottom ({ {k: sorted(v) for k, v in edges.items() if v} }); upward calls go through Combat.hooks')
heartbeats = {name: src.count('Heartbeat:Connect') for name, src in server_files.items()}
gate(heartbeats == {name: (1 if name == 'Main' else 0) for name in server_files} and re.search(r'Combat\.update\(dt\); Items\.update\(dt\); Projectiles\.update\(dt\); Bots\.update\(dt\)', server_files['Main']),
     'one Heartbeat in Main with a fixed tick order Combat → Items → Projectiles → Bots → State')
health_writers = {name for name, src in server_files.items() if re.search(r'\.Health\s*=|TakeDamage', src)}
gate(health_writers == {'Combat', 'Rigs'} and 'TakeDamage' not in ''.join(server_files.values()) and re.findall(r'\.Health\s*=', server_files['Rigs']) == ['.Health ='] and 'hum.Health = hum.MaxHealth' in server_files['Rigs'],
     'Humanoid.Health is written only by Combat (damage/heal/KO) and Rigs (initial fill); Items, Projectiles and Bots route through Combat.applyHit/heal')
handler_shape = re.search(r'OnServerEvent:Connect\(function\(player, name, args\)\s*local ok, result = Commands\.validate\(player, name, args\)\s*if not ok then return end\s*handlers\[name\]\(player, result\)\s*end\)', server_files['Main'])
gate(server_files['Main'].count('OnServerEvent:Connect') == 1 and handler_shape is not None and 'Commands.forget(player)' in server_files['Main'],
     'exactly one RemoteEvent handler whose body is validate → return on reject → dispatch the validated args (not just a validate call somewhere), and buckets are forgotten on leave')
gate('Config.ITEMS.pickupDistance + 2' in server_files['Items'] and 'F.state ~= "idle"' in server_files['Items'] and 'MaxActivationDistance = Config.ITEMS.pickupDistance' in server_files['Items'],
     'bomb pickup re-checks distance and fighter state on the server (ProximityPrompt range is a client-side condition)')
combat_calls = ['Rules.firstMove(', 'Rules.chainNext(', 'Rules.specialMove(', 'Rules.hitTest(', 'Rules.canGrab(', 'Rules.canGrabWith(', 'Rules.canHit(', 'Rules.guardBlocks(', 'Rules.guardCost(', 'Rules.guardAfterBlock(',
                'Rules.counterOpen(', 'Rules.dashAttackOpen(', 'Rules.koCredit(', 'Rules.knockbackMult(', 'Rules.launchLanded(', 'Rules.heldEscape(', 'Rules.mashAccepted(', 'Rules.damage(', 'Rules.throwDirection(', 'Rules.sanitizeDir(', 'Rules.isRingout(']
missing = [c for c in combat_calls if c not in server_files['Combat']]
gate(not missing and 'Rules.botMove(groundAhead(F, dir), groundAhead(F, side))' in server_files['Bots'] and 'Rules.loadoutPhaseOpen(session.phase)' in server_files['Main'] and 'Rules.allyKo(credit.team, V.team)' in server_files['Main']
     and 'Rules.botsNeeded(n)' in server_files['Main'] and 'Rules.sanitizeLoadout(' in server_files['Main'] and 'Rules.matchOver(' in server_files['Main'] and 'Rules.assignTeams(' in server_files['Main'] and 'Rules.nextRotation(' in server_files['Main'] and 'Rules.survivalWinner(' in server_files['Main'],
     f'combat decisions live in shared Rules and the server calls them: Combat uses {len(combat_calls)} Rules functions (chains, grab, hit geometry, guard, windows, credit, knockback, landing, escape), Main uses loadout/teams/rotation/winner/bots, Bots uses botMove{" — missing " + str(missing) if missing else ""}')
all_src = {str(p.relative_to(ROOT)): p.read_text() for p in (ROOT / 'src').rglob('*.luau')}
bad_requires = [(name, m) for name, src in all_src.items() for m in re.findall(r'require\("(\.\./[^"]+)"\)', src)]
gate(not bad_requires and 'Commands.configure(Config.LIMITS)' in server_files['Main'] and not re.search(r'^local \w+ = require\(', server_files['Commands'], re.M),
     f'no parent-folder string requires in any script (they resolve against the DataModel tree in Studio, not files){" — " + str(bad_requires) if bad_requires else ""}; Commands has no requires and Main configures its limits from Config')
proj = json.loads((ROOT / 'default.project.json').read_text())
gate(proj['name'] == 'AmpArena' and 'AmpArena' in proj['tree']['ReplicatedStorage'] and 'AmpArena' in proj['tree']['ServerScriptService'] and set(proj['tree']['ReplicatedStorage']['AmpArena']['Remotes']) >= {'Command', 'Fx', 'State'},
     'default.project.json (Rojo) describes the same tree the builder emits: ReplicatedStorage.AmpArena{shared, Remotes 3}, ServerScriptService.AmpArena, StarterPlayerScripts')
client_text = {p.name: p.read_text() for p in (ROOT / 'src/client').glob('*.luau')}
server_text = {p.name: p.read_text() for p in (ROOT / 'src/server').glob('*.luau')}
gate(all('ServerScriptService' not in t and 'ServerStorage' not in t for t in client_text.values()), 'client scripts require only ReplicatedStorage.AmpArena (no server modules or ServerStorage)')

# 3. 빌더 결정성 · 스크립트 정확 포함 · 서비스 · 템플릿
artifact = build.build()
first = artifact.read_bytes()
assert first == build.build().read_bytes(), 'non-deterministic artifact'
xml = E.parse(artifact)
items = list(xml.iter('Item'))
def name_of(n): return n.find("./Properties/string[@name='Name']").text
def has(node, cls): return any(c.attrib['class'] == cls for c in node.iter('Item'))
scripts = {n.attrib['referent']: n for n in items if n.attrib['class'] in ('Script', 'LocalScript', 'ModuleScript')}
src_files = list((ROOT / 'src').rglob('*.luau'))
gate(len(scripts) == len(build.SOURCE_MAP) == len(src_files), f'exactly {len(src_files)} scripts in the place and none inside embedded assets')
for ref, path in build.SOURCE_MAP.items():
    n = scripts[ref]
    assert n.find("./Properties/ProtectedString[@name='Source']").text == (ROOT / path).read_text(), path
    expected = 'LocalScript' if '.client.' in path else 'Script' if '.server.' in path else 'ModuleScript'
    assert n.attrib['class'] == expected, path
classes = [n.attrib['class'] for n in items]
ws = next(n for n in items if n.attrib['class'] == 'Workspace')
destroy_h = float(ws.find("./Properties/float[@name='FallenPartsDestroyHeight']").text)
min_fall = min(v['fallY'] for v in build.read_config().values())
gate(destroy_h <= min_fall - 100, f'FallenPartsDestroyHeight {destroy_h:g} ≤ lowest fallY {min_fall:g} − 100 (ringout KO credited before the engine destroys the character)')
for cls in ['Workspace', 'Lighting', 'Atmosphere', 'ReplicatedStorage', 'ServerScriptService', 'ServerStorage', 'StarterPlayer', 'StarterPlayerScripts', 'Players', 'ProximityPrompt', 'PointLight']:
    assert cls in classes, cls
assert classes.count('RemoteEvent') == 3
storage = next(n for n in items if n.attrib['class'] == 'ServerStorage')
maps = {name_of(n): n for n in next(c for c in storage.iter('Item') if name_of(c) == 'Maps').iter('Item') if n.attrib['class'] == 'Model' and n.find("./Properties/double[@name='Value']") is None and name_of(n) in ('colosseum', 'skydock')}
def folder(model, nm): return next((c for c in model.iter('Item') if c.attrib['class'] == 'Folder' and name_of(c) == nm), None)
map_ok = True
for mid, m in maps.items():
    sp = folder(m, 'Spawns'); cs = folder(m, 'CrateSpots'); pads = folder(m, 'Pads')
    teams = [float(c.find("./Properties/double[@name='Value']").text) for c in sp.iter('Item') if c.attrib['class'] == 'NumberValue'] if sp is not None else []
    fall = next((c for c in m.iter('Item') if c.attrib['class'] == 'NumberValue' and name_of(c) == 'FallY'), None)
    if not (sp is not None and cs is not None and pads is not None and len(teams) >= 8 and {1.0, 2.0} <= set(teams) and fall is not None): map_ok = False; print('   map incomplete', mid)
gate(len(maps) == 2 and map_ok, 'two maps in ServerStorage.Maps, each with ≥8 team-tagged spawns (both teams), crate spots, pads and FallY (cloned into Workspace per match)')
accs = next(c for c in storage.iter('Item') if c.attrib['class'] == 'Folder' and name_of(c) == 'Accessories')
acc_models = {name_of(n): n for n in accs if n.tag == 'Item' and n.attrib['class'] == 'Model'}
acc_ids = set(re.findall(r'^\t(\w+) = \{\n?\s*label', (ROOT / 'src/shared/Accessories.luau').read_text(), re.M)) - {'none'}
gate(set(acc_models) == acc_ids == {'rocket', 'shield', 'pistols', 'greatsword', 'spear'} and all(n.find("./Properties/Ref[@name='PrimaryPart']") is not None and n.find("./Properties/Ref[@name='PrimaryPart']").text != 'null' and has(n, 'Weld') for n in acc_models.values()),
     f'accessory templates match Accessories.luau ({len(acc_models)}), each a Part-built Model with PrimaryPart Handle and welded parts (no uploaded meshes)')
its = next(c for c in storage.iter('Item') if c.attrib['class'] == 'Folder' and name_of(c) == 'Items')
item_models = {name_of(n): n for n in its if n.tag == 'Item' and n.attrib['class'] == 'Model'}
gate({'Crate', 'Heart', 'Bomb'} <= set(item_models) and has(item_models['Bomb'], 'ProximityPrompt') and has(item_models['Heart'], 'PointLight'),
     'item templates Crate/Heart/Bomb exist; Bomb carries a ProximityPrompt (native pickup), Heart a light')
rig = next(c for c in storage.iter('Item') if c.attrib['class'] == 'Model' and name_of(c) == 'BlockRig')
gate(has(rig, 'Humanoid') and sum(1 for c in rig.iter('Item') if c.attrib['class'] == 'Motor6D') == 6 and {name_of(c) for c in rig.iter('Item') if c.attrib['class'] == 'Motor6D'} == {'RootJoint', 'Neck', 'Right Shoulder', 'Left Shoulder', 'Right Hip', 'Left Hip'},
     'bot BlockRig is an R6 Humanoid rig with the six standard Motor6D joints (same joint axes as player R6 avatars)')
print(f'PASS deterministic XML: services, lobby, lighting, 3 RemoteEvents, prompts, lights ({len(first)} bytes, {classes.count("Part")} parts) — not opened in Studio')

# 4. 에셋 출처: Roblox 공식 소유(creator 1) · 해시 일치 · 스크립트 제거
prov = json.loads((ROOT / 'assets/roblox/provenance.json').read_text())
asset_files = sorted((ROOT / 'assets/roblox').glob('*.rbxmx'))
ok = True
for p in asset_files:
    rec = prov.get(p.stem)
    if not rec or rec['creatorId'] != 1 or rec['sha256'] != hashlib.sha256(p.read_bytes()).hexdigest(): ok = False; print('   asset mismatch', p.name)
raw_scripts = sum(len(re.findall(r'class="(?:Script|LocalScript|ModuleScript)"', p.read_text())) for p in asset_files)
gate(ok and len(asset_files) == len(prov) and len(asset_files) >= 5, f'{len(asset_files)} embedded models are Roblox-owned (creator id 1) with matching sha256 in provenance.json; {raw_scripts} scripts in the raw files were stripped at build')

# 5. 로블록스 네이티브 조건 — 「웹을 그대로 옮긴」 모양을 구조로 막는다
all_client = ''.join(client_text.values())
gate('CameraType.Scriptable' not in all_client and 'CameraType' not in all_client, 'default Roblox camera is never replaced: no CameraType anywhere in client scripts (KO shake uses Humanoid.CameraOffset)')
sp = next(n for n in items if n.attrib['class'] == 'StarterPlayer')
zmin = float(sp.find("./Properties/float[@name='CameraMinZoomDistance']").text); zmax = float(sp.find("./Properties/float[@name='CameraMaxZoomDistance']").text)
gate(6 <= zmin < zmax <= 24, f'camera zoom {zmin:g}~{zmax:g} within public third-person references (default 12.5, brawlers 8~20)')
avatar = sp.find("./Properties/token[@name='GameSettingsAvatar']")
poser = client_text['Poser.client.luau']
gate(avatar is not None and avatar.text == '0' and 'RigType == Enum.HumanoidRigType.R15' in poser and '"Right Shoulder"' in poser and '"RightShoulder"' in poser,
     'R6 avatars (GameSettingsAvatar R6) with procedural poses; Poser maps the six logical joints for both R6 and R15 rigs')
gate('RunService.Stepped:Connect' in poser and '.Transform = CFrame' in poser and 'LoadAnimation' not in poser and 'Poses.forMove' in poser and 'Poses.forState' in poser,
     'procedural animation: Poser writes Motor6D.Transform every RunService.Stepped from shared Poses (no uploaded animation IDs required)')
players_node = next(n for n in items if n.attrib['class'] == 'Players')
gate(players_node.find("./Properties/bool[@name='CharacterAutoLoads']").text == 'false' and 'player:LoadCharacter()' in server_text['Main.server.luau'],
     'server owns spawning: Players.CharacterAutoLoads false in the place and Main calls LoadCharacter for lobby/arena/respawn')
banned = re.compile(r'WASD|Space|Shift|\[Q\]|Q/E|키를 눌러|을 누르면|클릭하세요|점프 버튼|M1|M2|마우스')
hits = [(name, m.group(0)) for name, t in client_text.items() for lit in re.findall(r'"([^"\n]*)"', t) for m in banned.finditer(lit)]
gate(not hits, f'no web-style key hints or jump buttons in client UI strings ({hits})')
inp = client_text['Input.client.luau']
titles = re.findall(r'title = "([^"]+)"', inp)
gate('ContextActionService:BindAction' in inp and 'SetTitle' in inp and 'KeyCode.E' not in inp and len(titles) >= 4 and 'MouseButton1' in inp and 'ButtonX' in inp,
     f'actions bound through ContextActionService with touch buttons titled {titles} + guard (keyboard, gamepad, touch); pickup is not a bound key')
items_src = server_text['Items.luau']
gate('ProximityPrompt' in items_src and '.Triggered:Connect' in items_src and 'Touched:Connect' in items_src,
     'pickup is the native ProximityPrompt (bomb) and hearts use Touched — no custom pickup key')
combat = server_text['Combat.luau']
gate('Instance.new("LinearVelocity")' in combat and 'BodyVelocity' not in combat and 'ApplyImpulse' not in combat and combat.count('Instance.new("LinearVelocity")') == 1 and 'lv.Enabled = false' in combat,
     'knockback/launch/dash use one LinearVelocity per fighter toggled on and off (constraints replicate to the owning client; no BodyVelocity/ApplyImpulse)')
gate('hum.Health = math.max(0, V.hum.Health - dmg)' in combat and 'hum.Died:Connect' in combat and 'SetAttribute("Hp"' not in combat,
     'health is Humanoid.Health (native KO via Died); no shadow HP attribute')
gate('workspace:GetServerTimeNow()' in combat and 'workspace:GetServerTimeNow()' in poser and 'os.clock()' not in combat,
     'MoveAt/FightAt use workspace:GetServerTimeNow() on both server and Poser (shared clock for pose phase)')
rules_src = (ROOT / 'src/shared/Rules.luau').read_text()
gate('F.sawAir = true' in combat and 'Rules.launchLanded(F.sawAir' in combat and 'elapsed > Config.HIT.launchTimeout' in rules_src and 'launchTimeout = 2.5' in cfg and 'Weld' in combat and 'PlatformStand = false' in combat and 'local function cleanup(F)' in combat and 'function Combat.leave' in combat,
     'launched→down waits for an Air observation (replication lag) with a 2.5s timeout (Rules.launchLanded); grab uses a Weld with PlatformStand; single cleanup()/leave() clears weld, velocity and locks')
frozen_fn = re.search(r'function Combat\.setFrozen\(F, on\)(.*?)\nend', combat, re.S)
hurt_fn = re.search(r'local function hurt\(V, dmg, A, t, kind\)(.*?)\nend', combat, re.S)
rigs_src = server_text['Rigs.luau']
gate(frozen_fn and 'stopVel(F)' in frozen_fn.group(1) and hurt_fn and hurt_fn.group(1).index('V.lastHitBy = A.id') < hurt_fn.group(1).index('V.hum.Health = ')
     and 'BreakJointsOnDeath = false' in rigs_src and 'model:GetScale()' in rigs_src and 'acc:ScaleTo(scale)' in rigs_src,
     'end-of-match freeze also stops the velocity constraint; KO credit is written before Health (sync Died safe); joints survive death (dead pose, accessory stays); style scale is re-applied as an absolute value and the accessory scales with it')
main = server_text['Main.server.luau']
phases = set(re.findall(r'setPhase\("(\w+)"', main))
gate(phases == {'lobby', 'countdown', 'match', 'result'} and 'arena:Destroy()' in main and 'Lighting.ClockTime' in main,
     f'round loop phases {sorted(phases)}; arena cloned per match and destroyed after; lighting preset applied per map')
cfg = (ROOT / 'src/shared/Config.luau').read_text()
bots_max = int(re.search(r'BOTS = \{ fillTo = (\d+), max = (\d+)', cfg).group(2)); fighters_cap = int(re.search(r'LIMITS = \{ players = (\d+), fighters = (\d+)', cfg).group(2))
proj_cap = int(re.search(r'PROJECTILE = \{ maxAlive = (\d+)', cfg).group(1))
gate(bots_max <= 7 and fighters_cap <= 8 and proj_cap <= 40 and 'Rules.botsNeeded(n)' in main and 'Config.LIMITS.fighters - humans' in rules_src and '#alive >= Config.PROJECTILE.maxAlive' in server_text['Projectiles.luau'],
     f'caps: bots ≤ {bots_max}, fighters ≤ {fighters_cap}, projectiles ≤ {proj_cap} (server Humanoid rigs and raycast steps stay bounded)')
gate('groundAhead' in server_text['Bots.luau'] and 'edgeProbe' in cfg and 'workspace:Raycast' in server_text['Bots.luau'],
     'bots probe the ground ahead before stepping (the web reference lost 36% of bot deaths to self-ringouts)')
guard_writes = combat.count('SetAttribute("Guard"')
gate(guard_writes == 1 and 'F.guardShown ~= g' in combat, 'Guard attribute replicates only when its integer value changes (no per-tick attribute churn)')
cmd = server_text['Commands.luau']
gate('finiteVector' in cmd and 'buckets' in cmd and 'INTENTS' in cmd and 'Combat.intent(e.F, a.kind' in main and 'Rules.sanitizeLoadout' in main,
     'client commands are shape-checked (enum intents, finite direction) and rate-limited; loadout is re-validated against style exclusivity on the server')
gate('ScaleTo' in server_text['Rigs.luau'] and 'HumanoidHealthDisplayType.AlwaysOff' in server_text['Rigs.luau'] and 'BillboardGui' in server_text['Rigs.luau'] and 'Highlight' in server_text['Rigs.luau'],
     'player avatars are kept (R6 own clothes); style adds scale, accessory weld, name tag with HP bar and team outline (Highlight)')
lighting = next(n for n in items if n.attrib['class'] == 'Lighting')
tech = lighting.find("./Properties/token[@name='Technology']").text
clocks = re.findall(r'clock = ([\d.]+)', cfg)
gate(tech == '4' and has(lighting, 'Atmosphere') and has(lighting, 'BloomEffect') and len(clocks) == 2 and len(set(clocks)) == 2,
     f'lighting: Future technology, Atmosphere + Bloom, per-map ClockTime presets {clocks} (visual result is Studio-only)')
world = next(n for n in items if n.attrib['class'] == 'Workspace')
embedded = sum(1 for m in maps.values() for n in m.iter('Item') if n.attrib['class'] == 'Model' and name_of(n) in ('castleInteriorTorch', 'landscapeFence', 'Castle_Roof_2', 'Model', 'Tree'))
print(f'INFO world: {embedded} Roblox-owned models placed across maps, {classes.count("ProximityPrompt")} ProximityPrompt template(s) (counts are scale, not quality evidence)')

if failures: raise SystemExit(f'{len(failures)} native gate(s) failed')
for line in [
    'Studio Play: round loop timing, LoadCharacter into lobby/arena, bots filling, ForceField spawn shield',
    'procedural pose look (R6 joint axis signs for shoulders/hips/root), hold timing, down pose resting on the floor, R15 mapping',
    'LinearVelocity knockback feel on client-owned characters, launched→down landing detection, grab Weld between two player characters',
    'hit reach/radius feel vs R6 bodies, aim assist turning, guard/counter window, chain buffering',
    'touch button placement around the default jump button, gamepad bindings, ProximityPrompt on bombs',
    '8 players, team outline colors, name tag HP bars, result ranking screen, lobby ready shortcut',
    'balance: every number in Config.luau/Moves.luau is a first guess translated from the web reference',
    'fighter state transition table and per-state intent acceptance (idle/attack/guard/hitstun/launched/down/getup/held/grabbing/stun) live in Combat.luau and are exercised only in Studio — decisions with logic are in Rules, the transitions themselves are not CLI-tested',
    'sound IDs (rbxasset) audible, Bangers font availability, Atmosphere density by eye',
]:
    print('UNVERIFIED: ' + line)
