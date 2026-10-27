#!/usr/bin/env python3
"""결정적 Roblox XML(.rbxlx) 빌더 — 표준 라이브러리만. Roblox 설치 불필요.
지형은 src/shared/Grid.luau 의 RECTS/SITES(한 줄 한 사각형, 숫자 리터럴만)를 정규식으로 읽어 같은 모양의 파트를 만든다.
검증(tools/verify.py)은 이 파일의 파서를 다시 쓰지 않고, 실행한 Grid.luau 의 덤프와 XML 파트를 대조한다."""
from pathlib import Path
import re
import xml.etree.ElementTree as E
ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'dist/ArcherCommand.rbxlx'
SOURCE_MAP = {}
MATERIAL = {'Plastic': 256, 'SmoothPlastic': 272, 'Wood': 512, 'Slate': 800, 'Grass': 1280, 'Neon': 288, 'Cobblestone': 880, 'Metal': 1088, 'Rock': 896}

def read_grid():
    text = (ROOT / 'src/shared/Grid.luau').read_text()
    rects = [tuple(int(v) for v in m) for m in re.findall(r'^-- RECT (\d+) (\d+) (\d+) (\d+) (\d+) (\d+) (\d+)$', text, re.M)]
    sites = {m[0]: (int(m[1]), int(m[2])) for m in re.findall(r'^-- SITE (\w+) (\d+) (\d+)$', text, re.M)}
    assert len(rects) == 6 and 'base' in sites, 'Grid.luau RECT/SITE 주석 형식이 바뀌었다'
    return rects, sites

def read_theme():
    text = (ROOT / 'src/shared/Theme.luau').read_text()
    return {k: tuple(int(x) for x in rgb.split(',')) for k, rgb in re.findall(r'(\w+)=\{(\d+,\d+,\d+)\}', text)}

def build():
    SOURCE_MAP.clear()
    rects, sites = read_grid()
    theme = read_theme()
    root = E.Element('roblox', version='4')
    E.SubElement(root, 'External').text = 'null'
    E.SubElement(root, 'External').text = 'nil'
    count = 0
    def item(parent, cls, name):
        nonlocal count
        count += 1
        node = E.SubElement(parent, 'Item', {'class': cls, 'referent': f'RBX{count:04d}'})
        E.SubElement(E.SubElement(node, 'Properties'), 'string', name='Name').text = name
        return node
    def prop(node, tag, name, value):
        p = E.SubElement(node.find('Properties'), tag, name=name); p.text = str(value); return p
    def xyz(node, tag, name, values):
        p = E.SubElement(node.find('Properties'), tag, name=name)
        for axis, v in zip(('X', 'Y', 'Z'), values): E.SubElement(p, axis).text = repr(float(v))
    def cframe(node, name, position, yaw180=False):
        p = E.SubElement(node.find('Properties'), 'CoordinateFrame', name=name)
        for axis, v in zip(('X', 'Y', 'Z'), position): E.SubElement(p, axis).text = repr(float(v))
        rot = {'R00': -1 if yaw180 else 1, 'R11': 1, 'R22': -1 if yaw180 else 1}
        for i in range(3):
            for j in range(3): E.SubElement(p, f'R{i}{j}').text = str(rot.get(f'R{i}{j}', 0))
    def color(node, name, rgb):
        p = E.SubElement(node.find('Properties'), 'Color3', name=name)
        for ch, v in zip(('R', 'G', 'B'), rgb): E.SubElement(p, ch).text = repr(v / 255)
    workspace = item(root, 'Workspace', 'Workspace')
    prop(workspace, 'float', 'FallenPartsDestroyHeight', -60)
    terrain = item(workspace, 'Model', 'BowlTerrain')
    decor = item(workspace, 'Model', 'Decor')
    def part(parent, name, pos, size, rgb, material='Plastic', cls='Part', collide=True, yaw180=False, transparency=0.0):
        n = item(parent, cls, name)
        prop(n, 'bool', 'Anchored', 'true'); prop(n, 'bool', 'CanCollide', 'true' if collide else 'false')
        prop(n, 'bool', 'CanQuery', 'true'); prop(n, 'bool', 'CastShadow', 'true')
        xyz(n, 'Vector3', 'size', size); cframe(n, 'CFrame', pos, yaw180); color(n, 'Color', rgb)
        prop(n, 'token', 'Material', MATERIAL[material]); prop(n, 'float', 'Transparency', transparency)
        return n
    def box(parent, name, x0, z0, x1, z1, y0, y1, rgb, material, collide=True, cls='Part', yaw180=False):
        return part(parent, name, ((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), (x1 - x0, y1 - y0, z1 - z0), rgb, material, cls, collide, yaw180)
    ring, interior, plateau, inner, ramp_hi, ramp_lo = rects
    W, H = ring[2], ring[3]
    EL = 8
    # 저지 바닥 (윗면 Y=0) · 분지 바깥 어두운 바닥
    box(terrain, 'Lowland', interior[0], interior[1], interior[0] + interior[2], interior[1] + interior[3], -2, 0, theme['grass'], 'Grass')
    box(terrain, 'Outside', -400, -400, W + 400, H + 400, -3, -2.5, theme['surface0'], 'Slate', collide=False)
    # 테두리 벽: 높이 24 (카메라가 경계 밖을 봐도 벽과 안개뿐이다)
    wall = theme['cliff']
    box(terrain, 'WallNorth', 0, 0, W, interior[1], 0, 24, wall, 'Slate')
    box(terrain, 'WallSouth', 0, interior[1] + interior[3], W, H, 0, 24, wall, 'Slate')
    box(terrain, 'WallWest', 0, interior[1], interior[0], interior[1] + interior[3], 0, 24, wall, 'Slate')
    box(terrain, 'WallEast', interior[0] + interior[2], interior[1], W, interior[1] + interior[3], 0, 24, wall, 'Slate')
    # 고지: 절벽 띠(높이 12, 경사로 자리는 비운다) + 윗면(Y 6~8)
    px, pz, pw, ph = plateau[0], plateau[1], plateau[2], plateau[3]
    ix, iz, iw, ih = inner[0], inner[1], inner[2], inner[3]
    rx, rz, rw = ramp_hi[0], ramp_hi[1], ramp_hi[2]
    box(terrain, 'CliffNorth', px, pz, px + pw, iz, 0, 12, wall, 'Slate')
    box(terrain, 'CliffWest', px, iz, ix, iz + ih, 0, 12, wall, 'Slate')
    box(terrain, 'CliffEast', ix + iw, iz, px + pw, iz + ih, 0, 12, wall, 'Slate')
    box(terrain, 'CliffSouthWest', px, iz + ih, rx, pz + ph, 0, 12, wall, 'Slate')
    box(terrain, 'CliffSouthEast', rx + rw, iz + ih, px + pw, pz + ph, 0, 12, wall, 'Slate')
    box(terrain, 'PlateauTop', ix, iz, ix + iw, iz + ih, EL - 2, EL, theme['grass'], 'Grass')
    # 경사로: 쐐기 하나가 경사로 셀 20 스터드 전체를 덮는다 (북쪽 끝이 높다 → yaw 180°)
    ramp_top, ramp_bottom = ramp_hi[1], ramp_lo[1] + ramp_lo[3]
    box(terrain, 'Ramp', rx, ramp_top, rx + rw, ramp_bottom, 0, EL, theme['stone'], 'Cobblestone', cls='WedgePart', yaw180=True)
    # 동쪽 원정로 문 (북벽 위, 셀은 Grid 에서 blocked) + 표지
    gx, gz = sites['exit_gate']
    gate = box(decor, 'EastGate', gx - 12, interior[1] - 0.5, gx + 12, interior[1] + 0.5, 0, 10, theme['wood'], 'Wood', collide=False)
    sign = item(gate, 'BillboardGui', 'Sign'); prop(sign, 'bool', 'AlwaysOnTop', 'true')
    s = E.SubElement(sign.find('Properties'), 'UDim2', name='Size')
    for k, v in (('XS', 0), ('XO', 220), ('YS', 0), ('YO', 40)): E.SubElement(s, k).text = str(v)
    xyz(sign, 'Vector3', 'StudsOffset', (0, 8, 0))
    tl = item(sign, 'TextLabel', 'Text'); prop(tl, 'string', 'Text', '동쪽 원정로 · 다음 단계'); prop(tl, 'float', 'BackgroundTransparency', 1); prop(tl, 'bool', 'TextScaled', 'true')
    color(tl, 'TextColor3', theme['textPrimary'])
    s2 = E.SubElement(tl.find('Properties'), 'UDim2', name='Size')
    for k, v in (('XS', 1), ('XO', 0), ('YS', 1), ('YO', 0)): E.SubElement(s2, k).text = str(v)
    # 본진: 목책(장식, 통행 셀이므로 충돌 없음) · 모닥불 · 횃불
    bx, bz = sites['base']
    fence = theme['wood']
    for name, x0, z0, x1, z1 in (('FenceWest', bx - 12, bz - 12, bx - 11, bz + 12), ('FenceEast', bx + 11, bz - 12, bx + 12, bz + 12), ('FenceSouth', bx - 12, bz + 11, bx + 12, bz + 12), ('FenceNorthA', bx - 12, bz - 12, bx - 4, bz - 11), ('FenceNorthB', bx + 4, bz - 12, bx + 12, bz - 11)):
        box(decor, name, x0, z0, x1, z1, 0, 2.5, fence, 'Wood', collide=False)
    fire = part(decor, 'Campfire', (bx, 0.6, bz), (2.4, 1.2, 2.4), theme['torch'], 'Neon', 'Part', False)
    light = item(fire, 'PointLight', 'Light'); prop(light, 'float', 'Brightness', 3); prop(light, 'float', 'Range', 36); color(light, 'Color', theme['torch'])
    for i, (tx, tz) in enumerate(((bx - 11.5, bz - 11.5), (bx + 11.5, bz - 11.5), (bx - 11.5, bz + 11.5), (bx + 11.5, bz + 11.5))):
        torch = part(decor, f'Torch{i}', (tx, 2.5, tz), (0.6, 5, 0.6), theme['wood'], 'Wood', 'Part', False)
        flame = part(torch, 'Flame', (tx, 5.3, tz), (0.9, 0.9, 0.9), theme['torch'], 'Neon', 'Part', False)
        l = item(flame, 'PointLight', 'Light'); prop(l, 'float', 'Brightness', 1.6); prop(l, 'float', 'Range', 22); color(l, 'Color', theme['torch'])
    # 자원 4곳 · 치료사 · 전초기지 터
    for sid, (sx, sz) in sites.items():
        if sid.startswith('wood'):
            part(decor, sid + 'Trunk', (sx, 2, sz), (1.2, 4, 1.2), theme['wood'], 'Wood', 'Part', False)
            part(decor, sid + 'Crown', (sx, 5.5, sz), (5, 4, 5), theme['grass'], 'Grass', 'Part', False)
        elif sid.startswith('ore'):
            part(decor, sid + 'Rock', (sx, 1.2, sz), (4, 2.4, 3.2), theme['stone'], 'Rock', 'Part', False)
            part(decor, sid + 'Vein', (sx + 1, 2.2, sz - 0.6), (1.2, 1.2, 1.2), theme['warning'], 'Neon', 'Part', False)
        elif sid == 'healer':
            ring_ = part(decor, 'HealerRing', (sx, 0.1, sz), (0.2, 7, 7), theme['healing'], 'Neon', 'Part', False, transparency=0.6)
            prop(ring_, 'token', 'shape', 2)  # Cylinder
            hl = item(ring_, 'PointLight', 'Light'); prop(hl, 'float', 'Brightness', 1.2); prop(hl, 'float', 'Range', 20); color(hl, 'Color', theme['healing'])
            part(decor, 'HealerFigure', (sx, 1.5, sz), (1.2, 3, 0.8), theme['healing'], 'SmoothPlastic', 'Part', False)
        elif sid == 'outpost_tower':
            part(decor, 'OutpostPlinth', (sx, 0.3, sz), (5, 0.6, 5), theme['infestation'], 'Slate', 'Part', False)
        elif sid == 'camp':
            part(decor, 'CampPlinth', (sx, EL + 0.3, sz), (10, 0.6, 10), theme['infestation'], 'Slate', 'Part', False)
    # 스폰: 본진 중심, 윗면 Y=0 (보행 부피와 겹치지 않는다)
    spawn = part(workspace, 'Spawn', (bx, -0.5, bz), (6, 1, 6), theme['stone'], 'Cobblestone', 'SpawnLocation', False)
    prop(spawn, 'bool', 'Neutral', 'true'); prop(spawn, 'float', 'Duration', 0)
    # 조명: 밤 숲
    lighting = item(root, 'Lighting', 'Lighting')
    prop(lighting, 'float', 'ClockTime', 20.5); prop(lighting, 'float', 'Brightness', 0.6)
    prop(lighting, 'float', 'FogStart', 60); prop(lighting, 'float', 'FogEnd', 180)
    prop(lighting, 'bool', 'GlobalShadows', 'true'); prop(lighting, 'float', 'EnvironmentDiffuseScale', 0.4)
    color(lighting, 'Ambient', (18, 22, 40)); color(lighting, 'OutdoorAmbient', (30, 36, 60)); color(lighting, 'FogColor', (10, 12, 20))
    clouds = item(lighting, 'Clouds', 'Clouds'); prop(clouds, 'float', 'Cover', 0.62); prop(clouds, 'float', 'Density', 0.55); color(clouds, 'Color', (120, 130, 170))
    atmo = item(lighting, 'Atmosphere', 'Atmosphere'); prop(atmo, 'float', 'Density', 0.42); prop(atmo, 'float', 'Haze', 1.6); color(atmo, 'Color', theme['moon']); color(atmo, 'Decay', (20, 24, 40))
    # 서비스 · 스크립트
    replicated = item(root, 'ReplicatedStorage', 'ReplicatedStorage')
    shared = item(replicated, 'Folder', 'ArcherCommand')
    for name in ('Command', 'State', 'Actors', 'Lobby', 'Event'): item(shared, 'RemoteEvent', name)
    server = item(item(root, 'ServerScriptService', 'ServerScriptService'), 'Folder', 'ArcherCommand')
    client = item(item(root, 'StarterPlayer', 'StarterPlayer'), 'StarterPlayerScripts', 'StarterPlayerScripts')
    item(root, 'StarterGui', 'StarterGui')
    for directory, parent in (('shared', shared), ('server', server), ('client', client)):
        for path in sorted((ROOT / 'src' / directory).glob('*.luau')):
            cls = 'Script' if path.name.endswith('.server.luau') else 'LocalScript' if path.name.endswith('.client.luau') else 'ModuleScript'
            name = path.name.removesuffix('.luau').removesuffix('.server').removesuffix('.client')
            n = item(parent, cls, name)
            prop(n, 'ProtectedString', 'Source', path.read_text())
            SOURCE_MAP[n.attrib['referent']] = path.relative_to(ROOT).as_posix()
    E.indent(root, space='  ')
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    E.ElementTree(root).write(OUTPUT, encoding='utf-8', xml_declaration=True)
    return OUTPUT

if __name__ == '__main__':
    print(build())
