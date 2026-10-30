#!/usr/bin/env python3
"""결정적 Roblox XML(.rbxlx) 빌더 — 표준 라이브러리만.
서비스·스크립트·조명·로비·맵 2(ServerStorage.AmpAssets.Maps, 매치마다 서버가 Workspace 로 Clone)·액세서리 템플릿 5·아이템 템플릿·BlockRig·Remotes 를 만든다.
맵의 fallY·clock 은 src/shared/Config.luau 의 MAPS 를 정규식으로 읽는다(한 곳만 고치면 된다)."""
from pathlib import Path
import json
import math
import re
import xml.etree.ElementTree as E

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'dist/AmpArena.rbxlx'
ASSETS = ROOT / 'assets/roblox'
SOURCE_MAP = {}
MATERIAL = {'Plastic': 256, 'SmoothPlastic': 272, 'Neon': 288, 'Wood': 512, 'WoodPlanks': 528, 'Marble': 784, 'Slate': 800, 'Concrete': 816, 'Granite': 832, 'Brick': 848,
            'Pebble': 864, 'Cobblestone': 880, 'Rock': 896, 'Sand': 1280 + 16, 'Metal': 1088, 'DiamondPlate': 1056, 'Grass': 1280, 'Fabric': 1312, 'Glass': 1568, 'Ice': 1536}
SHAPE = {'Ball': 0, 'Block': 1, 'Cylinder': 2}
BASEPARTS = {'Part', 'WedgePart', 'MeshPart', 'TrussPart', 'CornerWedgePart', 'SpawnLocation', 'Seat', 'VehicleSeat', 'UnionOperation'}
SCRIPTS = {'Script', 'LocalScript', 'ModuleScript'}
PALETTE = {
    'sand': (214, 190, 140), 'stone': (160, 150, 136), 'darkstone': (104, 98, 92), 'marble': (226, 222, 214), 'wood': (124, 92, 58), 'darkwood': (84, 60, 40),
    'metal': (120, 128, 140), 'darkmetal': (62, 66, 76), 'deck': (90, 96, 108), 'line': (236, 200, 70), 'neon': (255, 214, 64), 'cyan': (82, 200, 255),
    'skin': (204, 160, 120), 'red': (190, 50, 50), 'blue': (60, 110, 200), 'black': (30, 30, 34), 'orange': (255, 140, 50), 'pink': (255, 90, 140),
    'grass': (96, 140, 70), 'sea': (54, 110, 170), 'torch': (255, 179, 73), 'ember': (255, 120, 40), 'rail': (150, 160, 170),
}
MATERIAL['Sand'] = 1296


def read_config():
    text = (ROOT / 'src/shared/Config.luau').read_text()
    maps = {}
    for m in re.finditer(r'^\s+(\w+) = \{ label = "([^"]+)", fallY = ([-\d.]+), ringout = (true|false), clock = ([-\d.]+) \},?$', text, re.M):
        maps[m[1]] = {'label': m[2], 'fallY': float(m[3]), 'ringout': m[4] == 'true', 'clock': float(m[5])}
    assert set(maps) == {'colosseum', 'skydock'}, 'Config.luau MAPS 형식이 바뀌었다'
    return maps


def yaw_matrix(a):
    c, s = math.cos(a), math.sin(a)
    return [[c, 0, s], [0, 1, 0], [-s, 0, c]]


def mat_mul(a, b):
    return [[sum(a[i][k] * b[k][j] for k in range(3)) for j in range(3)] for i in range(3)]


ROLL90 = [[0, -1, 0], [1, 0, 0], [0, 0, 1]]  # Cylinder 축(X)을 세운다


class LCG:
    def __init__(self, seed): self.s = seed
    def next(self):
        self.s = (self.s * 1103515245 + 12345) & 0x7FFFFFFF
        return self.s / 0x7FFFFFFF
    def range(self, a, b): return a + (b - a) * self.next()


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

    def part(self, parent, name, pos, size, rgb, material='Plastic', cls='Part', collide=True, rot=None, transparency=0.0, shape=None, anchored=True, query=True, touch=False):
        n = self.item(parent, cls, name)
        self.prop(n, 'bool', 'Anchored', 'true' if anchored else 'false'); self.prop(n, 'bool', 'CanCollide', 'true' if collide else 'false')
        self.prop(n, 'bool', 'CanQuery', 'true' if query else 'false'); self.prop(n, 'bool', 'CanTouch', 'true' if touch else 'false'); self.prop(n, 'bool', 'CastShadow', 'true')
        self.xyz(n, 'Vector3', 'size', size); self.cframe(n, 'CFrame', pos, rot); self.packed_color(n, rgb)
        self.prop(n, 'token', 'Material', MATERIAL[material]); self.prop(n, 'float', 'Transparency', transparency)
        if shape: self.prop(n, 'token', 'shape', SHAPE[shape])
        return n

    def value(self, parent, cls, name, value):
        v = self.item(parent, cls, name)
        tag = {'NumberValue': 'double', 'IntValue': 'int', 'StringValue': 'string', 'BoolValue': 'bool'}[cls]
        self.prop(v, tag, 'Value', value)
        return v

    def light(self, parent, rgb, rng, brightness, shadows=False):
        l = self.item(parent, 'PointLight', 'Light')
        self.prop(l, 'float', 'Brightness', brightness); self.prop(l, 'float', 'Range', rng); self.color3(l, 'Color', rgb); self.prop(l, 'bool', 'Shadows', 'true' if shadows else 'false')
        return l

    def fire(self, parent, rgb, secondary, size, heat):
        f = self.item(parent, 'Fire', 'Fire')
        self.prop(f, 'float', 'Size', size); self.prop(f, 'float', 'Heat', heat); self.color3(f, 'Color', rgb); self.color3(f, 'SecondaryColor', secondary)
        return f

    def weld(self, part0, part1, c0_pos, c0_rot=None):
        w = self.item(part1, 'Weld', 'Weld'); self.ref(w, 'Part0', part0.attrib['referent']); self.ref(w, 'Part1', part1.attrib['referent'])
        self.cframe(w, 'C0', c0_pos, c0_rot); self.cframe(w, 'C1', (0, 0, 0))
        return w

    def embed(self, parent, asset_id, pos=None, yaw=0.0, ground=None, name=None):
        """assets/roblox/<id>.rbxmx 의 Item 을 붙인다. 스크립트는 버리고 referent 를 고유하게 바꾼다. pos 가 있으면 bbox 바닥 중심을 pos(+ground) 로 옮기고 yaw 로 돌린다."""
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


# ───────── 공통 조각 ─────────
def spawn_point(b, folder, index, pos, team):
    p = b.part(folder, f'Spawn{index:02d}', pos, (4, 1, 4), PALETTE['neon'], 'Neon', collide=False, transparency=1, query=False)
    b.value(p, 'NumberValue', 'Team', team)
    return p


def crate_spot(b, folder, index, pos):
    return b.part(folder, f'Spot{index:02d}', pos, (1, 1, 1), PALETTE['wood'], 'Plastic', collide=False, transparency=1, query=False)


def pad(b, folder, index, pos):
    p = b.part(folder, f'Pad{index:02d}', (pos[0], pos[1] + 0.25, pos[2]), (0.5, 5, 5), PALETTE['cyan'], 'Neon', shape='Cylinder', rot=ROLL90, touch=True)
    b.light(p, PALETTE['cyan'], 10, 1.2)
    return p


def torch(b, parent, pos, ground=0.0):
    return b.embed(parent, 56447717, pos=pos, ground=ground)


# ───────── 로비 ─────────
def build_lobby(b, workspace):
    lobby = b.item(workspace, 'Model', 'Lobby')
    y = 160.0
    b.part(lobby, 'Floor', (0, y - 1, 0), (64, 2, 64), PALETTE['marble'], 'Marble')
    b.part(lobby, 'Trim', (0, y - 2.2, 0), (68, 0.6, 68), PALETTE['darkstone'], 'Slate')
    for (x, z, sx, sz) in ((0, 32.5, 66, 1), (0, -32.5, 66, 1), (32.5, 0, 1, 66), (-32.5, 0, 1, 66)):
        b.part(lobby, 'Rail', (x, y + 1.6, z), (sx, 3.2, sz), PALETTE['rail'], 'Metal', transparency=0.35)
    for k in range(4):
        a = k * math.pi / 2 + math.pi / 4
        torch(b, lobby, (math.cos(a) * 28, math.sin(a) * 28), ground=y)
    sign = b.part(lobby, 'Sign', (0, y + 9, -30), (26, 6, 1), PALETTE['darkstone'], 'Slate')
    gui = b.item(sign, 'SurfaceGui', 'Face'); b.prop(gui, 'token', 'Face', 5); b.prop(gui, 'bool', 'AlwaysOnTop', 'false')
    tl = b.item(gui, 'TextLabel', 'Text'); b.prop(tl, 'string', 'Text', 'AMP ARENA'); b.prop(tl, 'float', 'BackgroundTransparency', 1); b.prop(tl, 'bool', 'TextScaled', 'true')
    b.color3(tl, 'TextColor3', PALETTE['neon']); b.udim2(tl, 'Size', 1, 0, 1, 0); b.prop(tl, 'token', 'Font', 25)
    ring = b.part(lobby, 'Ring', (0, y + 0.05, 0), (0.1, 36, 36), PALETTE['neon'], 'Neon', shape='Cylinder', rot=ROLL90, collide=False, transparency=0.6, query=False)
    spawns = b.item(lobby, 'Folder', 'Spawns')
    for i in range(8):
        a = i * math.pi / 4
        spawn_point(b, spawns, i + 1, (math.cos(a) * 18, y + 0.5, math.sin(a) * 18), 0)
    return lobby


# ───────── 콜로세움 ─────────
def build_colosseum(b, parent, cfg):
    m = b.item(parent, 'Model', 'colosseum')
    b.value(m, 'NumberValue', 'FallY', cfg['fallY']); b.value(m, 'StringValue', 'Label', cfg['label'])
    world = b.item(m, 'Model', 'World')
    b.part(world, 'Ground', (0, -2.2, 0), (1400, 2, 1400), PALETTE['grass'], 'Grass')
    b.part(world, 'Desert', (0, -1.6, 0), (1, 420, 420), PALETTE['sand'], 'Sand', shape='Cylinder', rot=ROLL90)
    b.part(world, 'Floor', (0, -1, 0), (2, 124, 124), PALETTE['sand'], 'Sand', shape='Cylinder', rot=ROLL90)
    b.part(world, 'Center', (0, 0.05, 0), (0.1, 20, 20), PALETTE['stone'], 'Cobblestone', shape='Cylinder', rot=ROLL90, collide=False)
    rng = LCG(1989)
    # 안쪽 벽 36 조각(높이 9), 바깥 관중석 벽(높이 16)과 그 위 성곽 모델
    for k in range(36):
        a = k * math.pi / 18
        x, z = math.cos(a) * 61.5, math.sin(a) * 61.5
        b.part(world, 'Wall', (x, 4.5, z), (3, 9, 11.2), PALETTE['stone'], 'Cobblestone', rot=yaw_matrix(-a))
        b.part(world, 'Cap', (x, 9.3, z), (3.6, 0.6, 11.4), PALETTE['darkstone'], 'Slate', rot=yaw_matrix(-a))
    for k in range(24):
        a = k * math.pi / 12
        x, z = math.cos(a) * 78, math.sin(a) * 78
        b.part(world, 'Stand', (x, 8, z), (4, 16, 20.6), PALETTE['darkstone'], 'Concrete', rot=yaw_matrix(-a))
        for tier in range(3):
            r = 65 + tier * 4.5
            b.part(world, 'Tier', (math.cos(a) * r, 9.6 + tier * 2.4, math.sin(a) * r), (4.4, 1.2, 18 + tier * 1.4), PALETTE['stone'], 'Concrete', rot=yaw_matrix(-a), collide=False)
    for k in range(12):
        a = k * math.pi / 6
        b.embed(world, 41324931, pos=(math.cos(a) * 78, math.sin(a) * 78), yaw=-a + math.pi / 2, ground=16)
    for k in range(6):
        a = k * math.pi / 3 + math.pi / 6
        t = torch(b, world, (math.cos(a) * 57, math.sin(a) * 57))
    for (x, z) in ((25, 25), (-25, 25), (25, -25), (-25, -25)):
        b.part(world, 'Pillar', (x, 7, z), (14, 4.8, 4.8), PALETTE['marble'], 'Marble', shape='Cylinder', rot=ROLL90)
        b.part(world, 'PillarBase', (x, 0.5, z), (6, 1, 6), PALETTE['stone'], 'Slate')
        b.part(world, 'PillarTop', (x, 14.3, z), (6, 0.6, 6), PALETTE['stone'], 'Slate')
    for z in (36, -36):
        b.part(world, 'Dais', (0, 2.25, z), (12, 4.5, 12), PALETTE['darkstone'], 'Slate')
        b.part(world, 'DaisStep', (0, 1.0, z + (9 if z > 0 else -9)), (8, 2, 6), PALETTE['stone'], 'Slate')
    for k in range(10):
        a = rng.range(0, 6.28); r = rng.range(90, 150)
        b.embed(world, (56449188, 56449156, 56449132)[k % 3], pos=(math.cos(a) * r, math.sin(a) * r), yaw=rng.range(0, 6.28), ground=-1.2)
    for k in range(8):
        a = k * math.pi / 4 + 0.2
        b.embed(world, 56449052, pos=(math.cos(a) * 86, math.sin(a) * 86), yaw=-a + math.pi / 2, ground=-1.2)
    spawns = b.item(m, 'Folder', 'Spawns')
    for i in range(8):
        a = i * math.pi / 4
        x, z = math.cos(a) * 45, math.sin(a) * 45
        team = 1 if math.cos(a) > 0.01 else 2 if math.cos(a) < -0.01 else (1 if i % 4 == 2 else 2)
        spawn_point(b, spawns, i + 1, (x, 0.5, z), team)
    spots = b.item(m, 'Folder', 'CrateSpots')
    for i in range(6):
        a = math.radians(i * 60 + 30)
        crate_spot(b, spots, i + 1, (math.cos(a) * 27, 0.5, math.sin(a) * 27))
    pads = b.item(m, 'Folder', 'Pads')
    pad(b, pads, 1, (15, 0, 36)); pad(b, pads, 2, (-15, 0, -36))
    return m


# ───────── 스카이독 ─────────
def build_skydock(b, parent, cfg):
    m = b.item(parent, 'Model', 'skydock')
    b.value(m, 'NumberValue', 'FallY', cfg['fallY']); b.value(m, 'StringValue', 'Label', cfg['label'])
    world = b.item(m, 'Model', 'World')
    b.part(world, 'Sea', (0, -160, 0), (3000, 2, 3000), PALETTE['sea'], 'Glass', transparency=0.15, query=False)
    def deck(name, pos, size, rgb=PALETTE['deck']):
        p = b.part(world, name, pos, size, rgb, 'DiamondPlate')
        b.part(world, name + 'Under', (pos[0], pos[1] - size[1] / 2 - 1.5, pos[2]), (size[0] - 4, 3, size[2] - 4), PALETTE['darkmetal'], 'Metal')
        return p
    deck('Center', (0, -1.5, 0), (72, 3, 48))
    deck('East', (57, 4.5, 0), (24, 3, 24)); deck('West', (-57, 4.5, 0), (24, 3, 24))
    deck('North', (0, -1.5, 48), (18, 3, 30)); deck('South', (0, -1.5, -48), (18, 3, 30))
    for (x, z, sx, sz) in ((0, 0, 60, 1), (0, 0, 1, 40)):
        b.part(world, 'Line', (x, 0.05, z), (sx, 0.1, sz), PALETTE['line'], 'SmoothPlastic', collide=False, query=False)
    b.part(world, 'HeliRing', (0, 0.05, 0), (0.1, 26, 26), PALETTE['line'], 'SmoothPlastic', shape='Cylinder', rot=ROLL90, collide=False, query=False)
    b.part(world, 'HeliInner', (0, 0.06, 0), (0.1, 23, 23), PALETTE['deck'], 'DiamondPlate', shape='Cylinder', rot=ROLL90, collide=False, query=False)
    for (x, z, yaw, rgb) in ((-22, 14, 0.2, PALETTE['red']), (22, -14, -0.3, PALETTE['blue'])):
        c = b.part(world, 'Container', (x, 4, z), (12, 8, 8), rgb, 'Metal', rot=yaw_matrix(yaw))
        b.part(world, 'ContainerRib', (x, 4, z), (12.2, 7.6, 7.6), PALETTE['darkmetal'], 'Metal', rot=yaw_matrix(yaw), collide=False)
    for (x, z) in ((57, 10), (-57, -10)):
        b.part(world, 'Mast', (x, 14, z), (1, 20, 1), PALETTE['darkmetal'], 'Metal')
        lamp = b.part(world, 'Lamp', (x, 24.5, z), (1.6, 1.6, 1.6), PALETTE['orange'], 'Neon', shape='Ball', collide=False)
        b.light(lamp, PALETTE['orange'], 40, 1.6)
    for (x, z) in ((-30, 20), (30, -20), (0, 60), (0, -60)):
        b.part(world, 'Crane', (x, 10, z), (2, 20, 2), PALETTE['darkmetal'], 'Metal')
        b.part(world, 'CraneArm', (x + 10, 20.5, z), (24, 1.2, 1.2), PALETTE['darkmetal'], 'Metal')
    spawns = b.item(m, 'Folder', 'Spawns')
    pts = [((-24, 0.5, 16), 1), ((-24, 0.5, -16), 1), ((24, 0.5, 16), 2), ((24, 0.5, -16), 2), ((-57, 6.5, 0), 1), ((57, 6.5, 0), 2), ((0, 0.5, 54), 1), ((0, 0.5, -54), 2)]
    for i, (p, team) in enumerate(pts): spawn_point(b, spawns, i + 1, p, team)
    spots = b.item(m, 'Folder', 'CrateSpots')
    for i, p in enumerate(((-64, 6.5, 8), (64, 6.5, 8), (-64, 6.5, -8), (64, 6.5, -8))): crate_spot(b, spots, i + 1, p)
    pads = b.item(m, 'Folder', 'Pads')
    pad(b, pads, 1, (-31, 0, 0)); pad(b, pads, 2, (31, 0, 0)); pad(b, pads, 3, (0, 0, 0))
    return m


# ───────── 액세서리 템플릿(손 아래 −Y 로 뻗는다) ─────────
def build_accessories(b, parent):
    folder = b.item(parent, 'Folder', 'Accessories')
    def model(name):
        return b.item(folder, 'Model', name)
    def attach(mdl, handle, name, pos, size, rgb, material, shape=None, rot=None):
        p = b.part(mdl, name, pos, size, rgb, material, collide=False, anchored=False, shape=shape, rot=rot)
        b.weld(handle, p, pos, rot)
        return p
    # 부스터: 로켓 글러브
    m = model('rocket'); h = b.part(m, 'Handle', (0, 0, 0), (1.5, 1.5, 1.7), PALETTE['red'], 'SmoothPlastic', collide=False, anchored=False)
    attach(m, h, 'Nozzle', (0, 0.9, 0), (1.0, 0.9, 1.0), PALETTE['darkmetal'], 'Metal', shape='Cylinder', rot=ROLL90)
    attach(m, h, 'Flame', (0, 1.4, 0), (0.7, 0.3, 0.7), PALETTE['orange'], 'Neon', shape='Cylinder', rot=ROLL90)
    attach(m, h, 'Knuckle', (0, -0.9, 0), (1.6, 0.4, 1.8), PALETTE['neon'], 'Neon'); b.ref(m, 'PrimaryPart', h.attrib['referent'])
    # 월: 방패(왼손)
    m = model('shield'); h = b.part(m, 'Handle', (0, 0, 0), (0.5, 4.4, 4.4), PALETTE['blue'], 'Metal', shape='Cylinder', collide=False, anchored=False)
    attach(m, h, 'Rim', (0, 0, 0), (0.6, 4.8, 4.8), PALETTE['darkmetal'], 'Metal', shape='Cylinder')
    attach(m, h, 'Boss', (-0.4, 0, 0), (0.8, 1.2, 1.2), PALETTE['neon'], 'Neon', shape='Ball'); b.ref(m, 'PrimaryPart', h.attrib['referent'])
    # 더블탭: 쌍열 권총
    m = model('pistols'); h = b.part(m, 'Handle', (0, 0, 0), (0.6, 1.1, 1.0), PALETTE['darkmetal'], 'Metal', collide=False, anchored=False)
    attach(m, h, 'BarrelR', (0.3, -1.1, 0.2), (0.3, 1.8, 0.3), PALETTE['metal'], 'Metal'); attach(m, h, 'BarrelL', (-0.3, -1.1, 0.2), (0.3, 1.8, 0.3), PALETTE['metal'], 'Metal')
    attach(m, h, 'Sight', (0, -0.3, 0.6), (0.5, 0.3, 0.3), PALETTE['neon'], 'Neon'); b.ref(m, 'PrimaryPart', h.attrib['referent'])
    # 브레이커: 대검
    m = model('greatsword'); h = b.part(m, 'Handle', (0, 0, 0), (0.45, 1.4, 0.45), PALETTE['darkwood'], 'Wood', collide=False, anchored=False)
    attach(m, h, 'Guard', (0, -0.8, 0), (2.2, 0.35, 0.5), PALETTE['darkmetal'], 'Metal')
    attach(m, h, 'Blade', (0, -4.6, 0), (0.7, 7.2, 0.25), PALETTE['metal'], 'Metal')
    attach(m, h, 'Edge', (0, -4.6, 0), (0.78, 7.0, 0.1), PALETTE['neon'], 'Neon')
    attach(m, h, 'Tip', (0, -8.4, 0), (0.7, 0.6, 0.25), PALETTE['metal'], 'Metal')
    attach(m, h, 'Pommel', (0, 0.85, 0), (0.6, 0.4, 0.6), PALETTE['darkmetal'], 'Metal'); b.ref(m, 'PrimaryPart', h.attrib['referent'])
    # 스파이크: 장창
    m = model('spear'); h = b.part(m, 'Handle', (0, 0, 0), (0.35, 1.2, 0.35), PALETTE['darkwood'], 'Wood', collide=False, anchored=False)
    attach(m, h, 'Shaft', (0, -3.8, 0), (0.3, 9.0, 0.3), PALETTE['wood'], 'Wood')
    attach(m, h, 'Butt', (0, 2.0, 0), (0.3, 3.0, 0.3), PALETTE['wood'], 'Wood')
    attach(m, h, 'Head', (0, -9.0, 0), (0.5, 1.6, 0.2), PALETTE['metal'], 'Metal')
    attach(m, h, 'Point', (0, -9.9, 0), (0.3, 0.4, 0.3), PALETTE['neon'], 'Neon'); b.ref(m, 'PrimaryPart', h.attrib['referent'])
    return folder


# ───────── 아이템 템플릿 ─────────
def build_items(b, parent):
    folder = b.item(parent, 'Folder', 'Items')
    crate = b.item(folder, 'Model', 'Crate')
    box = b.part(crate, 'Box', (0, 0, 0), (3.2, 3.2, 3.2), PALETTE['wood'], 'WoodPlanks')
    for (pos, size) in (((0, 0, 1.62), (3.4, 0.5, 0.2)), ((0, 0, -1.62), (3.4, 0.5, 0.2)), ((1.62, 0, 0), (0.2, 0.5, 3.4)), ((-1.62, 0, 0), (0.2, 0.5, 3.4))):
        p = b.part(crate, 'Band', pos, size, PALETTE['darkwood'], 'Wood', collide=False); b.weld(box, p, pos)
    b.ref(crate, 'PrimaryPart', box.attrib['referent'])
    heart = b.item(folder, 'Model', 'Heart')
    core = b.part(heart, 'Core', (0, 0, 0), (1.8, 1.8, 1.8), PALETTE['pink'], 'Neon', shape='Ball', collide=False, touch=True)
    b.light(core, PALETTE['pink'], 12, 1.2)
    gui = b.item(core, 'BillboardGui', 'Sign'); b.udim2(gui, 'Size', 0, 80, 0, 24); b.xyz(gui, 'Vector3', 'StudsOffset', (0, 1.8, 0)); b.prop(gui, 'float', 'MaxDistance', 60)
    tl = b.item(gui, 'TextLabel', 'Text'); b.prop(tl, 'string', 'Text', '회복'); b.prop(tl, 'float', 'BackgroundTransparency', 1); b.prop(tl, 'bool', 'TextScaled', 'true'); b.color3(tl, 'TextColor3', PALETTE['pink']); b.udim2(tl, 'Size', 1, 0, 1, 0)
    b.ref(heart, 'PrimaryPart', core.attrib['referent'])
    bomb = b.item(folder, 'Model', 'Bomb')
    body = b.part(bomb, 'Body', (0, 0, 0), (2.0, 2.0, 2.0), PALETTE['black'], 'SmoothPlastic', shape='Ball', collide=True, anchored=False)
    fuse = b.part(bomb, 'Fuse', (0, 1.2, 0), (0.25, 0.8, 0.25), PALETTE['orange'], 'Neon', collide=False, anchored=False); b.weld(body, fuse, (0, 1.2, 0))
    b.light(fuse, PALETTE['orange'], 8, 1.0)
    prompt = b.item(body, 'ProximityPrompt', 'Pickup')
    b.prop(prompt, 'string', 'ObjectText', '폭탄'); b.prop(prompt, 'string', 'ActionText', '줍기'); b.prop(prompt, 'float', 'MaxActivationDistance', 6)
    b.prop(prompt, 'float', 'HoldDuration', 0); b.prop(prompt, 'bool', 'RequiresLineOfSight', 'false')
    b.ref(bomb, 'PrimaryPart', body.attrib['referent'])
    return folder


def motor(b, parent, name, part0, part1, c0, c1):
    m = b.item(parent, 'Motor6D', name)
    b.ref(m, 'Part0', part0.attrib['referent']); b.ref(m, 'Part1', part1.attrib['referent'])
    b.cframe(m, 'C0', c0[0], c0[1]); b.cframe(m, 'C1', c1[0], c1[1])
    b.prop(m, 'float', 'MaxVelocity', 0.1)
    return m


def build_block_rig(b, parent):
    """봇 리그(R6). Motor6D 의 C0/C1 은 Roblox 기본 R6 와 같다 — Poser 의 관절 축이 플레이어와 같아야 한다."""
    rig = b.item(parent, 'Model', 'BlockRig')
    skin = PALETTE['skin']
    def rpart(name, pos, size, rgb, transparency=0.0):
        return b.part(rig, name, pos, size, rgb, 'SmoothPlastic', anchored=False, transparency=transparency)
    hrp = rpart('HumanoidRootPart', (0, 3, 0), (2, 2, 1), skin, transparency=1)
    torso = rpart('Torso', (0, 3, 0), (2, 2, 1), (70, 96, 58))
    head = rpart('Head', (0, 4.5, 0), (2, 1, 1), skin)
    mesh = b.item(head, 'SpecialMesh', 'Mesh'); b.prop(mesh, 'token', 'MeshType', 0); b.xyz(mesh, 'Vector3', 'Scale', (1.25, 1.25, 1.25))
    face = b.item(head, 'Decal', 'face'); b.prop(face, 'Content', 'Texture', 'rbxasset://textures/face.png'); b.prop(face, 'token', 'Face', 5)
    la = rpart('Left Arm', (-1.5, 3, 0), (1, 2, 1), skin); ra = rpart('Right Arm', (1.5, 3, 0), (1, 2, 1), skin)
    ll = rpart('Left Leg', (-0.5, 1, 0), (1, 2, 1), (52, 56, 72)); rl = rpart('Right Leg', (0.5, 1, 0), (1, 2, 1), (52, 56, 72))
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
    b.color3(colors, 'TorsoColor3', (70, 96, 58)); b.color3(colors, 'LeftLegColor3', (52, 56, 72)); b.color3(colors, 'RightLegColor3', (52, 56, 72))
    b.ref(rig, 'PrimaryPart', hrp.attrib['referent'])
    return rig


def build():
    SOURCE_MAP.clear()
    maps = read_config()
    b = Builder()
    # ── Workspace ──
    workspace = b.item(b.root, 'Workspace', 'Workspace')
    b.prop(workspace, 'float', 'FallenPartsDestroyHeight', -220)
    build_lobby(b, workspace)
    # ── Lighting: 로비 기본(맵별 프리셋은 서버가 ClockTime·Ambient 를 바꾼다) ──
    lighting = b.item(b.root, 'Lighting', 'Lighting')
    b.prop(lighting, 'float', 'ClockTime', 15); b.prop(lighting, 'float', 'Brightness', 2.2); b.prop(lighting, 'float', 'ExposureCompensation', 0.1)
    b.prop(lighting, 'bool', 'GlobalShadows', 'true'); b.prop(lighting, 'float', 'EnvironmentDiffuseScale', 0.8); b.prop(lighting, 'float', 'EnvironmentSpecularScale', 0.6)
    b.prop(lighting, 'float', 'ShadowSoftness', 0.25); b.prop(lighting, 'token', 'Technology', 4); b.prop(lighting, 'float', 'GeographicLatitude', 25)
    b.prop(lighting, 'float', 'FogStart', 0); b.prop(lighting, 'float', 'FogEnd', 100000)
    b.color3(lighting, 'Ambient', (90, 90, 110)); b.color3(lighting, 'OutdoorAmbient', (140, 140, 160)); b.color3(lighting, 'FogColor', (190, 200, 220))
    b.color3(lighting, 'ColorShift_Top', (255, 240, 220)); b.color3(lighting, 'ColorShift_Bottom', (120, 110, 100))
    atmo = b.item(lighting, 'Atmosphere', 'Atmosphere')
    b.prop(atmo, 'float', 'Density', 0.3); b.prop(atmo, 'float', 'Offset', 0.25); b.prop(atmo, 'float', 'Glare', 0.3); b.prop(atmo, 'float', 'Haze', 1.6)
    b.color3(atmo, 'Color', (200, 210, 230)); b.color3(atmo, 'Decay', (110, 120, 150))
    bloom = b.item(lighting, 'BloomEffect', 'Bloom'); b.prop(bloom, 'float', 'Intensity', 0.5); b.prop(bloom, 'float', 'Size', 24); b.prop(bloom, 'float', 'Threshold', 1.0); b.prop(bloom, 'bool', 'Enabled', 'true')
    rays = b.item(lighting, 'SunRaysEffect', 'SunRays'); b.prop(rays, 'float', 'Intensity', 0.08); b.prop(rays, 'float', 'Spread', 0.6); b.prop(rays, 'bool', 'Enabled', 'true')
    cc = b.item(lighting, 'ColorCorrectionEffect', 'ColorCorrection'); b.prop(cc, 'float', 'Contrast', 0.1); b.prop(cc, 'float', 'Saturation', 0.08); b.prop(cc, 'float', 'Brightness', 0.02); b.color3(cc, 'TintColor', (255, 250, 245)); b.prop(cc, 'bool', 'Enabled', 'true')
    # ── ReplicatedStorage: 공유 모듈 + Remotes ──
    rs = b.item(b.root, 'ReplicatedStorage', 'ReplicatedStorage')
    shared = b.item(rs, 'Folder', 'AmpArena')
    for path in sorted((ROOT / 'src/shared').glob('*.luau')):
        n = b.item(shared, script_class(path), path.name.replace('.luau', ''))
        b.prop(n, 'ProtectedString', 'Source', path.read_text()); SOURCE_MAP[n.attrib['referent']] = str(path.relative_to(ROOT))
    remotes = b.item(shared, 'Folder', 'Remotes')
    for name in ('Command', 'Fx', 'State'): b.item(remotes, 'RemoteEvent', name)
    # ── ServerScriptService / ServerStorage ──
    sss = b.item(b.root, 'ServerScriptService', 'ServerScriptService')
    server = b.item(sss, 'Folder', 'AmpArena')
    for path in sorted((ROOT / 'src/server').glob('*.luau')):
        n = b.item(server, script_class(path), path.name.replace('.server.luau', '').replace('.luau', ''))
        b.prop(n, 'ProtectedString', 'Source', path.read_text()); SOURCE_MAP[n.attrib['referent']] = str(path.relative_to(ROOT))
    storage = b.item(b.root, 'ServerStorage', 'ServerStorage')
    assets = b.item(storage, 'Folder', 'AmpAssets')
    maps_folder = b.item(assets, 'Folder', 'Maps')
    build_colosseum(b, maps_folder, maps['colosseum'])
    build_skydock(b, maps_folder, maps['skydock'])
    build_accessories(b, assets)
    build_items(b, assets)
    build_block_rig(b, assets)
    # ── Players / StarterPlayer: 서버가 캐릭터를 세운다 · R6 · 기본 카메라 줌 8~20 · 쉬프트락 끔(Shift 가 대시) ──
    players = b.item(b.root, 'Players', 'Players')
    b.prop(players, 'bool', 'CharacterAutoLoads', 'false'); b.prop(players, 'float', 'RespawnTime', 3)
    sp = b.item(b.root, 'StarterPlayer', 'StarterPlayer')
    b.prop(sp, 'float', 'CameraMaxZoomDistance', 20); b.prop(sp, 'float', 'CameraMinZoomDistance', 8)
    b.prop(sp, 'float', 'CharacterWalkSpeed', 14); b.prop(sp, 'float', 'CharacterJumpPower', 50); b.prop(sp, 'bool', 'CharacterUseJumpPower', 'true')
    b.prop(sp, 'bool', 'EnableMouseLockOption', 'false'); b.prop(sp, 'float', 'HealthDisplayDistance', 0); b.prop(sp, 'float', 'NameDisplayDistance', 0)
    b.prop(sp, 'token', 'GameSettingsAvatar', 0)
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


if __name__ == '__main__':
    out = build()
    print(out, out.stat().st_size, 'bytes')
