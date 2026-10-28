#!/usr/bin/env python3
"""결정적 Roblox XML(.rbxlx) 빌더 — 표준 라이브러리만.
Terrain 은 파일에 담지 않고 src/server/World.server.luau 가 실행 시 채운다. 이 파일은 서비스·스크립트·조명·건물·Roblox 소유 모델 배치·NPC 템플릿을 만든다.
배치 좌표는 src/shared/Config.luau 의 SITES/BOWL/HILL 을 정규식으로 읽는다(한 곳만 고치면 된다)."""
from pathlib import Path
import json
import math
import re
import xml.etree.ElementTree as E

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'dist/ArcherCommand.rbxlx'
ASSETS = ROOT / 'assets/roblox'
SOURCE_MAP = {}
MATERIAL = {'Plastic': 256, 'SmoothPlastic': 272, 'Neon': 288, 'Wood': 512, 'WoodPlanks': 528, 'Slate': 800, 'Concrete': 816, 'Brick': 848, 'Cobblestone': 880, 'Rock': 896, 'Metal': 1088, 'Grass': 1280, 'Fabric': 1312, 'Glass': 1568}
SHAPE = {'Ball': 0, 'Block': 1, 'Cylinder': 2}
BASEPARTS = {'Part', 'WedgePart', 'MeshPart', 'TrussPart', 'CornerWedgePart', 'SpawnLocation', 'Seat', 'VehicleSeat', 'UnionOperation'}
SCRIPTS = {'Script', 'LocalScript', 'ModuleScript'}
PALETTE = {
    'wood': (124, 92, 58), 'darkwood': (84, 60, 40), 'stone': (118, 110, 102), 'darkstone': (70, 66, 62), 'fabric': (150, 72, 58),
    'torch': (255, 179, 73), 'healing': (112, 206, 160), 'plague': (150, 220, 80), 'ore': (120, 220, 255), 'skin': (204, 160, 120),
    'rock': (88, 84, 80), 'ember': (255, 120, 40), 'leaf': (70, 110, 50),
}


def read_config():
    text = (ROOT / 'src/shared/Config.luau').read_text()
    sites = {m[0]: (float(m[1]), float(m[2]), float(m[3])) for m in re.findall(r'^\s+(\w+) = vec\(([-\d.]+), ([-\d.]+), ([-\d.]+)\),$', text, re.M)}
    bowl = {k: float(v) for k, v in re.findall(r'(minX|maxX|minZ|maxZ) = ([-\d.]+)', text)}
    hm = re.search(r'HILL = \{ center = vec\(([-\d.]+), ([-\d.]+), ([-\d.]+)\), radius = ([-\d.]+) \}', text)
    hill = ((float(hm[1]), float(hm[2]), float(hm[3])), float(hm[4]))
    assert 'base' in sites and 'exit_gate' in sites and len(bowl) == 4, 'Config.luau SITES/BOWL 형식이 바뀌었다'
    return sites, bowl, hill


class LCG:
    def __init__(self, seed): self.s = seed & 0xFFFFFFFF
    def next(self):
        self.s = (self.s * 1664525 + 1013904223) & 0xFFFFFFFF
        return self.s / 0x100000000
    def range(self, a, b): return a + (b - a) * self.next()


def yaw_matrix(yaw):
    c, s = math.cos(yaw), math.sin(yaw)
    return [[c, 0, s], [0, 1, 0], [-s, 0, c]]


def mat_mul(a, b):
    return [[sum(a[i][k] * b[k][j] for k in range(3)) for j in range(3)] for i in range(3)]


ROLL90 = [[0, -1, 0], [1, 0, 0], [0, 0, 1]]  # Cylinder 축(X)을 Y 로 세운다


class Builder:
    def __init__(self):
        self.root = E.Element('roblox', version='4')
        E.SubElement(self.root, 'External').text = 'null'
        E.SubElement(self.root, 'External').text = 'nil'
        self.count = 0

    def item(self, parent, cls, name):
        self.count += 1
        node = E.SubElement(parent, 'Item', {'class': cls, 'referent': f'RBX{self.count:05d}'})
        E.SubElement(E.SubElement(node, 'Properties'), 'string', name='Name').text = name
        return node

    @staticmethod
    def prop(node, tag, name, value):
        p = E.SubElement(node.find('Properties'), tag, name=name); p.text = str(value); return p

    @staticmethod
    def xyz(node, tag, name, values):
        p = E.SubElement(node.find('Properties'), tag, name=name)
        for axis, v in zip(('X', 'Y', 'Z'), values): E.SubElement(p, axis).text = repr(float(v))

    @staticmethod
    def cframe(node, name, position, rot=None):
        p = E.SubElement(node.find('Properties'), 'CoordinateFrame', name=name)
        for axis, v in zip(('X', 'Y', 'Z'), position): E.SubElement(p, axis).text = repr(float(v))
        rot = rot or [[1, 0, 0], [0, 1, 0], [0, 0, 1]]
        for i in range(3):
            for j in range(3): E.SubElement(p, f'R{i}{j}').text = repr(float(rot[i][j]))

    @staticmethod
    def color3(node, name, rgb):
        p = E.SubElement(node.find('Properties'), 'Color3', name=name)
        for ch, v in zip(('R', 'G', 'B'), rgb): E.SubElement(p, ch).text = repr(v / 255)

    @staticmethod
    def packed_color(node, rgb):
        r, g, b = rgb
        E.SubElement(node.find('Properties'), 'Color3uint8', name='Color3uint8').text = str((0xFF << 24) | (r << 16) | (g << 8) | b)

    @staticmethod
    def ref(node, name, referent):
        existing = node.find(f"./Properties/Ref[@name='{name}']")
        if existing is not None: existing.text = referent
        else: E.SubElement(node.find('Properties'), 'Ref', name=name).text = referent

    @staticmethod
    def udim2(node, name, xs, xo, ys, yo):
        p = E.SubElement(node.find('Properties'), 'UDim2', name=name)
        for k, v in (('XS', xs), ('XO', xo), ('YS', ys), ('YO', yo)): E.SubElement(p, k).text = str(v)

    def part(self, parent, name, pos, size, rgb, material='Plastic', cls='Part', collide=True, rot=None, transparency=0.0, shape=None, anchored=True, query=True):
        n = self.item(parent, cls, name)
        self.prop(n, 'bool', 'Anchored', 'true' if anchored else 'false'); self.prop(n, 'bool', 'CanCollide', 'true' if collide else 'false')
        self.prop(n, 'bool', 'CanQuery', 'true' if query else 'false'); self.prop(n, 'bool', 'CanTouch', 'false'); self.prop(n, 'bool', 'CastShadow', 'true')
        self.xyz(n, 'Vector3', 'size', size); self.cframe(n, 'CFrame', pos, rot); self.packed_color(n, rgb)
        self.prop(n, 'token', 'Material', MATERIAL[material]); self.prop(n, 'float', 'Transparency', transparency)
        if shape: self.prop(n, 'token', 'shape', SHAPE[shape])
        return n

    def light(self, parent, rgb, rng, brightness, shadows=False):
        l = self.item(parent, 'PointLight', 'Light')
        self.prop(l, 'float', 'Brightness', brightness); self.prop(l, 'float', 'Range', rng); self.color3(l, 'Color', rgb); self.prop(l, 'bool', 'Shadows', 'true' if shadows else 'false')
        return l

    def fire(self, parent, rgb, secondary, size, heat):
        f = self.item(parent, 'Fire', 'Fire')
        self.prop(f, 'float', 'Size', size); self.prop(f, 'float', 'Heat', heat); self.color3(f, 'Color', rgb); self.color3(f, 'SecondaryColor', secondary)
        return f

    def prompt(self, parent, object_text, action_text, panel, distance=9):
        p = self.item(parent, 'ProximityPrompt', 'Prompt')
        self.prop(p, 'string', 'ObjectText', object_text); self.prop(p, 'string', 'ActionText', action_text)
        self.prop(p, 'float', 'MaxActivationDistance', distance); self.prop(p, 'float', 'HoldDuration', 0.25); self.prop(p, 'bool', 'RequiresLineOfSight', 'false')
        v = self.item(p, 'StringValue', 'Panel'); self.prop(v, 'string', 'Value', panel)
        return p

    # ── Roblox 소유 XML 모델 내장 ──
    def embed(self, parent, asset_id, pos=None, yaw=0.0, ground=None, name=None):
        """assets/roblox/<id>.rbxmx 의 Item 을 붙인다. 스크립트는 버리고 referent 를 고유하게 바꾼다.
        pos 가 있으면 bbox 바닥 중심을 pos(+ground) 로 옮기고 yaw 로 돌린다."""
        tree = E.parse(ASSETS / f'{asset_id}.rbxmx')
        tops = [i for i in tree.getroot() if i.tag == 'Item']
        assert len(tops) == 1, asset_id
        model = tops[0]
        for node in list(model.iter('Item')):
            for child in list(node):
                if child.tag == 'Item' and child.attrib['class'] in SCRIPTS: node.remove(child)
        mapping = {}
        for node in model.iter('Item'):
            self.count += 1
            mapping[node.attrib['referent']] = f'RBX{self.count:05d}'
        for node in model.iter('Item'): node.attrib['referent'] = mapping[node.attrib['referent']]
        for r in model.iter('Ref'):
            if r.text in mapping: r.text = mapping[r.text]
        if name is not None: model.find("./Properties/string[@name='Name']").text = name
        if pos is not None:
            parts = []
            for node in model.iter('Item'):
                if node.attrib['class'] in BASEPARTS:
                    cf = node.find("./Properties/CoordinateFrame[@name='CFrame']"); sz = node.find("./Properties/Vector3[@name='size']")
                    if cf is not None and sz is not None: parts.append((cf, sz))
            xs, ys, zs = [], [], []
            for cf, sz in parts:
                x, y, z = (float(cf.find(a).text) for a in 'XYZ'); sx, sy, sz_ = (float(sz.find(a).text) for a in 'XYZ')
                xs += [x - sx / 2, x + sx / 2]; ys += [y - sy / 2, y + sy / 2]; zs += [z - sz_ / 2, z + sz_ / 2]
            cx, cz, miny = (min(xs) + max(xs)) / 2, (min(zs) + max(zs)) / 2, min(ys)
            R = yaw_matrix(yaw)
            gy = ground if ground is not None else 0.0
            for cf, _ in parts:
                x, y, z = (float(cf.find(a).text) for a in 'XYZ')
                dx, dz = x - cx, z - cz
                nx = R[0][0] * dx + R[0][2] * dz; nz = R[2][0] * dx + R[2][2] * dz
                cf.find('X').text = repr(pos[0] + nx); cf.find('Y').text = repr(y - miny + gy); cf.find('Z').text = repr(pos[1] + nz)
                rot = [[float(cf.find(f'R{i}{j}').text) for j in range(3)] for i in range(3)]
                nrot = mat_mul(R, rot)
                for i in range(3):
                    for j in range(3): cf.find(f'R{i}{j}').text = repr(nrot[i][j])
        parent.append(model)
        return model


def script_class(path):
    return 'LocalScript' if path.name.endswith('.client.luau') else 'Script' if path.name.endswith('.server.luau') else 'ModuleScript'


def build():
    SOURCE_MAP.clear()
    sites, bowl, hill = read_config()
    (hcx, hcy, hcz), hr = hill
    def hill_y(x, z):
        d2 = (x - hcx) ** 2 + (z - hcz) ** 2
        return max(0.0, hcy + math.sqrt(hr * hr - d2)) if d2 < hr * hr else 0.0
    b = Builder()
    rng = LCG(1989)

    # ── Workspace ──
    workspace = b.item(b.root, 'Workspace', 'Workspace')
    b.prop(workspace, 'float', 'FallenPartsDestroyHeight', -80)
    spawn = b.part(workspace, 'Spawn', (sites['spawn'][0], 0.5, sites['spawn'][2]), (6, 1, 6), PALETTE['stone'], 'Cobblestone', cls='SpawnLocation', collide=False, transparency=1)
    b.prop(spawn, 'bool', 'Neutral', 'true'); b.prop(spawn, 'int', 'Duration', 0)
    world = b.item(workspace, 'Folder', 'World')

    # 본진
    base = b.item(world, 'Model', 'Base')
    bx, bz = sites['base'][0], sites['base'][2]
    for deg in range(0, 360, 6):
        a = math.radians(deg)
        if abs(deg - 0) <= 24 or abs(deg - 270) <= 24:  # 동쪽(+X)·북쪽(−Z) 출입구
            continue
        px, pz = bx + math.cos(a) * 20, bz + math.sin(a) * 20
        h = 6.5 + rng.range(-0.5, 0.8)
        b.part(base, 'Palisade', (px, h / 2, pz), (1.3, h, 1.3), PALETTE['darkwood'], 'WoodPlanks', rot=yaw_matrix(-a))
    fire = b.part(base, 'Campfire', (bx, 0.5, bz), (1.6, 1.0, 1.6), PALETTE['ember'], 'Neon', shape='Cylinder', rot=ROLL90, collide=False)
    b.fire(fire, PALETTE['torch'], PALETTE['ember'], 7, 12); b.light(fire, PALETTE['torch'], 48, 2.0, shadows=True)
    for k in range(3):
        a = k * 2.1
        b.part(base, 'Log', (bx + math.cos(a) * 1.2, 0.4, bz + math.sin(a) * 1.2), (0.8, 0.8, 4.2), PALETTE['wood'], 'Wood', rot=yaw_matrix(a + 0.5), collide=False)
    for (tx, tz, yaw) in ((-4, 14, 0.3), (6, 14, -0.4), (-14, 4, 1.2)):
        t = b.part(base, 'Tent', (bx + tx, 2.2, bz + tz), (7, 4.4, 7), PALETTE['fabric'], 'Fabric', cls='WedgePart', rot=yaw_matrix(yaw))
        b.part(base, 'Tent', (bx + tx, 2.2, bz + tz), (7, 4.4, 7), PALETTE['fabric'], 'Fabric', cls='WedgePart', rot=yaw_matrix(yaw + math.pi))
    def cabin(parent, name, pos, panel, object_text, action_text, rgb):
        x, z = pos
        body = b.part(parent, name, (x, 3, z), (10, 6, 8), rgb, 'WoodPlanks')
        b.part(parent, name + 'Roof', (x, 7.2, z), (11, 2.4, 9), PALETTE['darkwood'], 'Wood', cls='WedgePart', rot=yaw_matrix(math.pi / 2))
        b.part(parent, name + 'Roof', (x, 7.2, z), (11, 2.4, 9), PALETTE['darkwood'], 'Wood', cls='WedgePart', rot=yaw_matrix(-math.pi / 2))
        b.part(parent, name + 'Door', (x, 2, z + 4.05), (2.2, 4, 0.2), PALETTE['darkwood'], 'Wood', collide=False)
        b.prompt(body, object_text, action_text, panel)
        return body
    cabin(base, 'Barracks', (sites['barracks'][0], sites['barracks'][2]), 'hire', '고용소', '병력 고용', PALETTE['wood'])
    cabin(base, 'Workshop', (sites['workshop'][0], sites['workshop'][2]), 'upgrade', '훈련장', '공방 강화', (104, 86, 64))
    sx, sz = sites['store'][0], sites['store'][2]
    for i, (dx, dz) in enumerate(((0, 0), (2.2, 0.3), (1.1, 2.1), (1.1, 1.0))):
        b.part(base, 'Crate', (sx + dx, 1.0 + (1.9 if i == 3 else 0), sz + dz), (1.9, 1.9, 1.9), PALETTE['wood'], 'WoodPlanks', rot=yaw_matrix(i * 0.4))
    b.embed(base, 56447829, pos=(bx + 6, bz + 12), yaw=0.4)
    b.embed(base, 56449052, pos=(sx - 6, sz + 2), yaw=math.pi / 2)
    for (tx, tz) in ((20, -3), (20, 3), (-3, -20), (3, -20), (-12, 14), (12, 10)):
        b.embed(base, 56447717, pos=(bx + tx, bz + tz))

    # 치료사
    healer = b.item(world, 'Model', 'Healer')
    hx, hz = sites['healer'][0], sites['healer'][2]
    b.part(healer, 'Ring', (hx, 0.4, hz), (0.8, 10, 10), PALETTE['stone'], 'Cobblestone', shape='Cylinder', rot=ROLL90)
    b.part(healer, 'Pillar', (hx, 3.2, hz), (1.4, 5.2, 1.4), PALETTE['darkstone'], 'Slate')
    crystal = b.part(healer, 'Crystal', (hx, 6.6, hz), (1.8, 1.8, 1.8), PALETTE['healing'], 'Neon', shape='Ball', collide=False)
    b.light(crystal, PALETTE['healing'], 30, 1.3)
    b.part(healer, 'HealRing', (hx, 0.15, hz), (0.2, 28, 28), PALETTE['healing'], 'Neon', shape='Cylinder', rot=ROLL90, collide=False, transparency=0.72, query=False)
    for k in range(4):
        a = k * math.pi / 2 + 0.4
        b.part(healer, 'Stone', (hx + math.cos(a) * 6, 0.9, hz + math.sin(a) * 6), (1.2, 1.8, 1.2), PALETTE['stone'], 'Slate', rot=yaw_matrix(a))

    # 채집지
    props = b.item(world, 'Model', 'Props')
    for key in ('wood_west', 'wood_east'):
        wx, wz = sites[key][0], sites[key][2]
        b.embed(props, 18717544, pos=(wx, wz), yaw=rng.range(0, 6.28))
        for k in range(7):
            a = k / 7 * math.pi * 2
            r = rng.range(8, 14)
            b.embed(props, (56449188, 56449156, 56449132)[k % 3], pos=(wx + math.cos(a) * r, wz + math.sin(a) * r), yaw=rng.range(0, 6.28))
    for key in ('ore_west', 'ore_east'):
        ox, oz = sites[key][0], sites[key][2]
        for k in range(5):
            a = k / 5 * math.pi * 2 + 0.7
            r = rng.range(2, 6)
            s = rng.range(2.4, 4.2)
            rock = b.part(props, 'Ore', (ox + math.cos(a) * r, s / 2, oz + math.sin(a) * r), (s, s, s), PALETTE['rock'], 'Rock', rot=yaw_matrix(rng.range(0, 3)))
            b.part(props, 'Vein', (ox + math.cos(a) * r, s * 0.6, oz + math.sin(a) * r), (s * 0.5, s * 0.5, s * 0.5), PALETTE['ore'], 'Neon', collide=False, rot=yaw_matrix(rng.range(0, 3)))
    # 사냥터
    hunt = b.item(world, 'Model', 'Hunt')
    hux, huz = sites['hunt'][0], sites['hunt'][2]
    b.embed(hunt, 63933118, pos=(hux - 8, huz + 6), yaw=0.8)
    b.embed(hunt, 63933118, pos=(hux + 9, huz - 5), yaw=2.4)
    b.embed(hunt, 56449099, pos=(hux - 14, huz - 10), yaw=1.1)
    b.embed(hunt, 56449099, pos=(hux + 13, huz + 9), yaw=2.9)
    # 전초기지
    outpost = b.item(world, 'Model', 'Outpost')
    ox, oz = sites['outpost_tower'][0] + 4, sites['outpost_tower'][2] - 8
    for i in range(-2, 3):
        for level in range(2):
            y = level * 4
            for (px, pz) in ((ox + i * 4, oz - 8), (ox + i * 4, oz + 8), (ox + 8, oz + i * 4)):
                b.embed(outpost, 56448754, pos=(px, pz), ground=y)
            if i != 0: b.embed(outpost, 56448754, pos=(ox - 8, oz + i * 4), ground=y)
    for (px, pz) in ((ox - 8, oz - 8), (ox + 8, oz - 8), (ox + 8, oz + 8), (ox - 8, oz + 8)):
        b.embed(outpost, 41324931, pos=(px, pz), ground=8)
    tower = b.item(outpost, 'Model', 'OutpostTower')
    tx, tz = sites['outpost_tower'][0], sites['outpost_tower'][2]
    shaft = b.part(tower, 'Shaft', (tx, 7, tz), (14, 7, 7), PALETTE['stone'], 'Cobblestone', shape='Cylinder', rot=ROLL90)
    b.part(tower, 'Cap', (tx, 14.5, tz), (1, 8.5, 8.5), PALETTE['darkstone'], 'Slate', shape='Cylinder', rot=ROLL90)
    totem = b.part(tower, 'Totem', (tx, 16.5, tz), (2.2, 2.2, 2.2), PALETTE['plague'], 'Neon', shape='Ball', collide=False)
    b.light(totem, PALETTE['plague'], 26, 1.0)
    b.ref(tower, 'PrimaryPart', shaft.attrib['referent'])
    # 거점(언덕 위)
    camp = b.item(world, 'Model', 'Camp')
    cx, cz = sites['camp'][0], sites['camp'][2]
    gfire = b.part(camp, 'WitchFire', (cx, hill_y(cx, cz) + 0.5, cz), (1.6, 1.0, 1.6), PALETTE['plague'], 'Neon', shape='Cylinder', rot=ROLL90, collide=False)
    b.fire(gfire, PALETTE['plague'], (40, 120, 60), 6, 8); b.light(gfire, PALETTE['plague'], 34, 1.2)
    for k in range(5):
        a = k / 5 * math.pi * 2
        px, pz = cx + math.cos(a) * 9, cz + math.sin(a) * 9
        gy = hill_y(px, pz)
        b.part(camp, 'Totem', (px, gy + 2.5, pz), (0.8, 5, 0.8), PALETTE['darkwood'], 'Wood', rot=yaw_matrix(a))
        b.part(camp, 'Skull', (px, gy + 5.4, pz), (1.1, 1.1, 1.1), (226, 220, 200), 'SmoothPlastic', shape='Ball', collide=False)
    for (dx, dz, yaw) in ((5, 4, 0.3), (-6, 3, 2.0), (1, -7, 4.1)):
        b.embed(camp, 63933118, pos=(cx + dx, cz + dz), yaw=yaw, ground=hill_y(cx + dx, cz + dz))
    # 웨이브 입구(동굴 아가리)
    cave = b.item(world, 'Model', 'Cave')
    wx, wz = sites['wave_entry'][0], sites['wave_entry'][2]
    b.part(cave, 'Pillar', (wx - 7, 5, wz + 6), (4, 10, 4), PALETTE['rock'], 'Rock', rot=yaw_matrix(0.3))
    b.part(cave, 'Pillar', (wx + 7, 5, wz + 6), (4, 10, 4), PALETTE['rock'], 'Rock', rot=yaw_matrix(-0.2))
    b.part(cave, 'Lintel', (wx, 10.5, wz + 6), (20, 3, 5), PALETTE['rock'], 'Rock')
    b.part(cave, 'Dark', (wx, 4.5, wz + 3.9), (14, 9, 0.4), (8, 8, 12), 'SmoothPlastic', collide=False)
    b.embed(cave, 56448952, pos=(wx - 18, wz + 22), yaw=0.9)
    # 동쪽 원정로 문(다음 단계) — 북동 바위 테두리 앞
    gate = b.item(world, 'Model', 'ExitGate')
    gx, gz = sites['exit_gate'][0], bowl['minZ'] + 2
    b.part(gate, 'Door', (gx - 3.1, 6, gz), (6, 12, 1), PALETTE['darkwood'], 'WoodPlanks')
    b.part(gate, 'Door', (gx + 3.1, 6, gz), (6, 12, 1), PALETTE['darkwood'], 'WoodPlanks')
    b.part(gate, 'Frame', (gx, 12.6, gz), (15, 1.4, 2), PALETTE['wood'], 'Wood')
    b.part(gate, 'Frame', (gx - 7, 6.5, gz), (1.6, 13, 2), PALETTE['wood'], 'Wood')
    b.part(gate, 'Frame', (gx + 7, 6.5, gz), (1.6, 13, 2), PALETTE['wood'], 'Wood')
    b.embed(gate, 56447717, pos=(gx - 9, gz + 3)); b.embed(gate, 56447717, pos=(gx + 9, gz + 3))
    lintel = b.part(gate, 'Lintel', (gx, 13.6, gz), (15, 0.6, 2), PALETTE['wood'], 'Wood')
    sign = b.item(lintel, 'BillboardGui', 'Sign'); b.prop(sign, 'bool', 'AlwaysOnTop', 'false'); b.udim2(sign, 'Size', 0, 260, 0, 44); b.xyz(sign, 'Vector3', 'StudsOffset', (0, 15, 0)); b.prop(sign, 'float', 'MaxDistance', 120)
    tl = b.item(sign, 'TextLabel', 'Text'); b.prop(tl, 'string', 'Text', '동쪽 원정로 · 다음 단계'); b.prop(tl, 'float', 'BackgroundTransparency', 1); b.prop(tl, 'bool', 'TextScaled', 'true'); b.color3(tl, 'TextColor3', (244, 245, 248)); b.udim2(tl, 'Size', 1, 0, 1, 0)
    # 흩어진 나무·꽃: 시설에서 떨어진 자리만
    keep = [(sites[k][0], sites[k][2]) for k in sites] + [(ox, oz)]
    forest = b.item(world, 'Model', 'Forest')
    placed = 0
    attempts = 0
    while placed < 34 and attempts < 600:
        attempts += 1
        px, pz = rng.range(bowl['minX'] + 6, bowl['maxX'] - 6), rng.range(bowl['minZ'] + 8, bowl['maxZ'] - 6)
        if any((px - kx) ** 2 + (pz - kz) ** 2 < 24 ** 2 for kx, kz in keep): continue
        if (px - hcx) ** 2 + (pz - hcz) ** 2 < (hr * 0.9) ** 2 and hill_y(px, pz) > 2: continue
        aid = (56449188, 56449156, 56449132, 56449099)[int(rng.range(0, 3.999))]
        b.embed(forest, aid, pos=(px, pz), yaw=rng.range(0, 6.28), ground=hill_y(px, pz))
        placed += 1
    for k in range(14):
        px, pz = rng.range(bowl['minX'] + 10, bowl['maxX'] - 10), rng.range(bowl['minZ'] + 12, bowl['maxZ'] - 8)
        b.embed(forest, 56448980, pos=(px, pz), yaw=rng.range(0, 6.28), ground=hill_y(px, pz))

    # ── Lighting: 밤 원정. Future 조명 + Atmosphere ──
    lighting = b.item(b.root, 'Lighting', 'Lighting')
    b.prop(lighting, 'float', 'ClockTime', 21.5); b.prop(lighting, 'float', 'Brightness', 1.4); b.prop(lighting, 'float', 'ExposureCompensation', 0.35)
    b.prop(lighting, 'bool', 'GlobalShadows', 'true'); b.prop(lighting, 'float', 'EnvironmentDiffuseScale', 0.6); b.prop(lighting, 'float', 'EnvironmentSpecularScale', 0.4)
    b.prop(lighting, 'float', 'ShadowSoftness', 0.3); b.prop(lighting, 'token', 'Technology', 4); b.prop(lighting, 'float', 'GeographicLatitude', 30)
    b.prop(lighting, 'float', 'FogStart', 0); b.prop(lighting, 'float', 'FogEnd', 100000)
    b.color3(lighting, 'Ambient', (26, 30, 46)); b.color3(lighting, 'OutdoorAmbient', (58, 64, 96)); b.color3(lighting, 'FogColor', (20, 24, 40))
    b.color3(lighting, 'ColorShift_Top', (120, 130, 180)); b.color3(lighting, 'ColorShift_Bottom', (20, 20, 30))
    atmo = b.item(lighting, 'Atmosphere', 'Atmosphere')
    b.prop(atmo, 'float', 'Density', 0.28); b.prop(atmo, 'float', 'Offset', 0.3); b.prop(atmo, 'float', 'Glare', 0.15); b.prop(atmo, 'float', 'Haze', 1.2)
    b.color3(atmo, 'Color', (140, 150, 190)); b.color3(atmo, 'Decay', (60, 70, 110))
    bloom = b.item(lighting, 'BloomEffect', 'Bloom'); b.prop(bloom, 'float', 'Intensity', 0.4); b.prop(bloom, 'float', 'Size', 24); b.prop(bloom, 'float', 'Threshold', 1.1); b.prop(bloom, 'bool', 'Enabled', 'true')
    cc = b.item(lighting, 'ColorCorrectionEffect', 'ColorCorrection'); b.prop(cc, 'float', 'Contrast', 0.08); b.prop(cc, 'float', 'Saturation', -0.05); b.prop(cc, 'float', 'Brightness', 0.02); b.color3(cc, 'TintColor', (236, 240, 255)); b.prop(cc, 'bool', 'Enabled', 'true')

    # ── ReplicatedStorage: 공유 모듈 + Remotes ──
    rs = b.item(b.root, 'ReplicatedStorage', 'ReplicatedStorage')
    shared = b.item(rs, 'Folder', 'ArcherCommand')
    for path in sorted((ROOT / 'src/shared').glob('*.luau')):
        n = b.item(shared, script_class(path), path.name.replace('.luau', ''))
        b.prop(n, 'ProtectedString', 'Source', path.read_text()); SOURCE_MAP[n.attrib['referent']] = str(path.relative_to(ROOT))
    remotes = b.item(shared, 'Folder', 'Remotes')
    for name in ('Command', 'Fx', 'State'): b.item(remotes, 'RemoteEvent', name)

    # ── ServerScriptService / ServerStorage ──
    sss = b.item(b.root, 'ServerScriptService', 'ServerScriptService')
    server = b.item(sss, 'Folder', 'ArcherCommand')
    for path in sorted((ROOT / 'src/server').glob('*.luau')):
        n = b.item(server, script_class(path), path.name.replace('.server.luau', '').replace('.luau', ''))
        b.prop(n, 'ProtectedString', 'Source', path.read_text()); SOURCE_MAP[n.attrib['referent']] = str(path.relative_to(ROOT))
    storage = b.item(b.root, 'ServerStorage', 'ServerStorage')
    assets = b.item(storage, 'Folder', 'ArcherAssets')
    zombie = b.embed(assets, 93601062, name='Zombie')
    add_root_part(b, zombie)
    bat = b.embed(assets, 167116921, name='Bat')
    b.ref(bat, 'PrimaryPart', next(n for n in bat.iter('Item') if n.find("./Properties/string[@name='Name']").text == 'Torso').attrib['referent'])
    build_block_rig(b, assets)
    build_bow(b, assets)
    build_tower(b, assets)
    build_site(b, assets)

    # ── StarterPlayer: 기본 카메라 줌 범위 · 점프는 Roblox 기본(50) ──
    sp = b.item(b.root, 'StarterPlayer', 'StarterPlayer')
    b.prop(sp, 'float', 'CameraMaxZoomDistance', 36); b.prop(sp, 'float', 'CameraMinZoomDistance', 12)
    b.prop(sp, 'float', 'CharacterWalkSpeed', 16); b.prop(sp, 'float', 'CharacterJumpPower', 50); b.prop(sp, 'bool', 'CharacterUseJumpPower', 'true')
    b.prop(sp, 'bool', 'EnableMouseLockOption', 'true'); b.prop(sp, 'float', 'HealthDisplayDistance', 0); b.prop(sp, 'float', 'NameDisplayDistance', 60)
    sps = b.item(sp, 'StarterPlayerScripts', 'StarterPlayerScripts')
    for path in sorted((ROOT / 'src/client').glob('*.luau')):
        n = b.item(sps, script_class(path), path.name.replace('.client.luau', ''))
        b.prop(n, 'ProtectedString', 'Source', path.read_text()); SOURCE_MAP[n.attrib['referent']] = str(path.relative_to(ROOT))
    b.item(b.root, 'StarterGui', 'StarterGui')
    b.item(b.root, 'SoundService', 'SoundService')

    OUTPUT.parent.mkdir(exist_ok=True)
    E.indent(b.root, space=' ')
    OUTPUT.write_bytes(b'<?xml version="1.0" encoding="utf-8"?>\n' + E.tostring(b.root, encoding='utf-8'))
    return OUTPUT


def add_root_part(b, model):
    """2012년 R6 모델엔 HumanoidRootPart 가 없다. Torso 자리에 투명 루트 파트와 RootJoint 를 더해 현재 Humanoid 가 움직일 수 있게 한다."""
    torso = next(n for n in model.iter('Item') if n.attrib['class'] == 'Part' and n.find("./Properties/string[@name='Name']").text == 'Torso')
    cf = torso.find("./Properties/CoordinateFrame[@name='CFrame']")
    pos = tuple(float(cf.find(a).text) for a in 'XYZ')
    hrp = b.part(model, 'HumanoidRootPart', pos, (2, 2, 1), PALETTE['skin'], 'SmoothPlastic', anchored=False, transparency=1, collide=False)
    neck = [[-1, 0, 0], [0, 0, 1], [0, 1, 0]]
    motor(b, hrp, 'RootJoint', hrp, torso, ((0, 0, 0), neck), ((0, 0, 0), neck))
    b.ref(model, 'PrimaryPart', hrp.attrib['referent'])


def motor(b, parent, name, part0, part1, c0, c1):
    m = b.item(parent, 'Motor6D', name)
    b.ref(m, 'Part0', part0.attrib['referent']); b.ref(m, 'Part1', part1.attrib['referent'])
    b.cframe(m, 'C0', c0[0], c0[1]); b.cframe(m, 'C1', c1[0], c1[1])
    b.prop(m, 'float', 'MaxVelocity', 0.1)
    return m


def build_block_rig(b, parent):
    """아바타 생성이 안 될 때(오프라인) 쓰는 R6 블록 리그. Motor6D 의 C0/C1 은 Roblox 기본 R6 와 같다."""
    rig = b.item(parent, 'Model', 'BlockRig')
    skin = PALETTE['skin']
    def rpart(name, pos, size, rgb, transparency=0.0):
        return b.part(rig, name, pos, size, rgb, 'SmoothPlastic', anchored=False, transparency=transparency)
    hrp = rpart('HumanoidRootPart', (0, 3, 0), (2, 2, 1), skin, transparency=1)
    torso = rpart('Torso', (0, 3, 0), (2, 2, 1), (70, 96, 58))
    head = rpart('Head', (0, 4.5, 0), (2, 1, 1), skin)
    mesh = b.item(head, 'SpecialMesh', 'Mesh'); b.prop(mesh, 'token', 'MeshType', 0); b.xyz(mesh, 'Vector3', 'Scale', (1.25, 1.25, 1.25))
    la = rpart('Left Arm', (-1.5, 3, 0), (1, 2, 1), skin); ra = rpart('Right Arm', (1.5, 3, 0), (1, 2, 1), skin)
    ll = rpart('Left Leg', (-0.5, 1, 0), (1, 2, 1), (72, 58, 44)); rl = rpart('Right Leg', (0.5, 1, 0), (1, 2, 1), (72, 58, 44))
    y90 = yaw_matrix(math.pi / 2); ym90 = yaw_matrix(-math.pi / 2)
    neck = [[-1, 0, 0], [0, 0, 1], [0, 1, 0]]
    motor(b, hrp, 'RootJoint', hrp, torso, ((0, 0, 0), neck), ((0, 0, 0), neck))
    motor(b, torso, 'Neck', torso, head, ((0, 1, 0), neck), ((0, -0.5, 0), neck))
    motor(b, torso, 'Right Shoulder', torso, ra, ((1, 0.5, 0), y90), ((-0.5, 0.5, 0), y90))
    motor(b, torso, 'Left Shoulder', torso, la, ((-1, 0.5, 0), ym90), ((0.5, 0.5, 0), ym90))
    motor(b, torso, 'Right Hip', torso, rl, ((1, -1, 0), y90), ((0.5, 1, 0), y90))
    motor(b, torso, 'Left Hip', torso, ll, ((-1, -1, 0), ym90), ((-0.5, 1, 0), ym90))
    hum = b.item(rig, 'Humanoid', 'Humanoid'); b.prop(hum, 'token', 'RigType', 0); b.prop(hum, 'float', 'MaxHealth', 100); b.prop(hum, 'float', 'Health', 100)
    colors = b.item(rig, 'BodyColors', 'Body Colors')
    for name in ('HeadColor3', 'LeftArmColor3', 'RightArmColor3'): b.color3(colors, name, skin)
    b.color3(colors, 'TorsoColor3', (70, 96, 58)); b.color3(colors, 'LeftLegColor3', (72, 58, 44)); b.color3(colors, 'RightLegColor3', (72, 58, 44))
    b.ref(rig, 'PrimaryPart', hrp.attrib['referent'])
    return rig


def build_bow(b, parent):
    bow = b.item(parent, 'Model', 'Bow')
    handle = b.part(bow, 'Handle', (0, 0, 0), (0.3, 1.2, 0.3), PALETTE['darkwood'], 'Wood', collide=False)
    b.part(bow, 'Limb', (0, 1.3, 0.3), (0.22, 1.6, 0.22), PALETTE['wood'], 'Wood', collide=False, rot=[[1, 0, 0], [0, math.cos(0.35), -math.sin(0.35)], [0, math.sin(0.35), math.cos(0.35)]])
    b.part(bow, 'Limb', (0, -1.3, 0.3), (0.22, 1.6, 0.22), PALETTE['wood'], 'Wood', collide=False, rot=[[1, 0, 0], [0, math.cos(-0.35), -math.sin(-0.35)], [0, math.sin(-0.35), math.cos(-0.35)]])
    b.part(bow, 'String', (0, 0, 0.55), (0.06, 3.6, 0.06), (230, 225, 210), 'Fabric', collide=False)
    for child in bow:
        if child.tag == 'Item' and child is not handle:
            w = b.item(child, 'Weld', 'Weld'); b.ref(w, 'Part0', handle.attrib['referent']); b.ref(w, 'Part1', child.attrib['referent'])
            cf = child.find("./Properties/CoordinateFrame[@name='CFrame']")
            pos = tuple(float(cf.find(a).text) for a in 'XYZ'); rot = [[float(cf.find(f'R{i}{j}').text) for j in range(3)] for i in range(3)]
            b.cframe(w, 'C0', pos, rot); b.cframe(w, 'C1', (0, 0, 0))
    b.ref(bow, 'PrimaryPart', handle.attrib['referent'])
    return bow


def build_tower(b, parent):
    tower = b.item(parent, 'Model', 'Tower')
    base = b.part(tower, 'Base', (0, 0.5, 0), (6.5, 1, 6.5), PALETTE['stone'], 'Cobblestone')
    for (dx, dz) in ((-2.6, -2.6), (2.6, -2.6), (2.6, 2.6), (-2.6, 2.6)):
        b.part(tower, 'Post', (dx, 5.5, dz), (0.7, 9, 0.7), PALETTE['darkwood'], 'WoodPlanks')
    b.part(tower, 'Deck', (0, 9.8, 0), (6.5, 0.6, 6.5), PALETTE['wood'], 'WoodPlanks')
    for (dx, dz, sx, sz) in ((0, -3.1, 6.5, 0.3), (0, 3.1, 6.5, 0.3), (-3.1, 0, 0.3, 6.5), (3.1, 0, 0.3, 6.5)):
        b.part(tower, 'Rail', (dx, 11.0, dz), (sx, 1.8, sz), PALETTE['darkwood'], 'Wood', collide=False)
    torch = b.part(tower, 'Torch', (0, 12.4, -2.4), (0.5, 0.5, 0.5), PALETTE['ember'], 'Neon', collide=False)
    b.fire(torch, PALETTE['torch'], PALETTE['ember'], 3, 8); b.light(torch, PALETTE['torch'], 30, 1.4)
    top = b.item(base, 'Attachment', 'Top'); b.cframe(top, 'CFrame', (0, 10.2, 0))
    b.ref(tower, 'PrimaryPart', base.attrib['referent'])
    return tower


def build_site(b, parent):
    site = b.item(parent, 'Model', 'TowerSite')
    base = b.part(site, 'Base', (0, 0.3, 0), (6.5, 0.6, 6.5), PALETTE['darkstone'], 'Slate', collide=False)
    for (dx, dz) in ((-2.6, -2.6), (2.6, -2.6), (2.6, 2.6), (-2.6, 2.6)):
        b.part(site, 'Post', (dx, 1.6, dz), (0.7, 2.6, 0.7), PALETTE['darkwood'], 'WoodPlanks', collide=False)
    b.ref(site, 'PrimaryPart', base.attrib['referent'])
    return site


if __name__ == '__main__':
    out = build()
    print(out, out.stat().st_size, 'bytes')
