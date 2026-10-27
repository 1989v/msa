#!/usr/bin/env python3
"""Deterministic, stdlib-only Roblox XML builder. No Roblox installation needed."""
from pathlib import Path
import re
import math
import json
import xml.etree.ElementTree as E
ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'dist/InfinityStep.rbxlx'
SOURCE_MAP = {}

def authored():
    from generate_native import hashes
    provenance=json.loads((ROOT/'data/native-course-provenance.json').read_text())
    assert provenance['sources']==hashes(), 'Native snapshot stale: run LUAU_BIN=/path/to/luau python3 roblox/infinity-step/tools/generate_native.py'
    original=json.loads((ROOT/'data/native-course.json').read_text())
    platforms=original['platforms']
    theme = (ROOT / 'src/shared/Theme.luau').read_text()
    colors = {k: tuple(map(int, rgb.split(','))) for k, rgb in re.findall(r'(\w+)=\{([\d,]+)\}', theme)}
    return platforms, colors, original

def build():
    SOURCE_MAP.clear()
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
        p = E.SubElement(node.find('Properties'), tag, name=name)
        p.text = str(value)
        return p
    def xyz(node, tag, name, values):
        p = E.SubElement(node.find('Properties'), tag, name=name)
        for axis, v in zip(('X','Y','Z'), values): E.SubElement(p, axis).text = str(v)
    def cframe(node, name, position):
        p = E.SubElement(node.find('Properties'), 'CoordinateFrame', name=name)
        for axis, v in zip(('X','Y','Z'), position): E.SubElement(p, axis).text = str(v)
        for i in range(3):
            for j in range(3): E.SubElement(p, f'R{i}{j}').text = '1' if i==j else '0'
    platforms, colors, original = authored()
    def color(node, name, token):
        p = E.SubElement(node.find('Properties'), 'Color3', name=name)
        for channel, v in zip(('R','G','B'),colors[token]): E.SubElement(p,channel).text = str(v/255)
    workspace = item(root,'Workspace','Workspace')
    prop(workspace,'float','Gravity',104)
    prop(workspace,'float','FallenPartsDestroyHeight',-60)
    course = item(workspace,'Model','Course')
    def part(parent, name, pos, size, token, cls='Part'):
        n=item(parent,cls,name)
        prop(n,'bool','Anchored','true');prop(n,'bool','CanCollide','true')
        xyz(n,'Vector3','size',size);cframe(n,'CFrame',pos);color(n,'Color',token)
        prop(n,'token','Material',256) # Plastic, no external assets.
        return n
    prop(workspace,'bool','StreamingEnabled','true')
    prop(workspace,'int','StreamingMinRadius',128);prop(workspace,'int','StreamingTargetRadius',320)
    def rgb(node, values):
        c=E.SubElement(node.find('Properties'),'Color3',name='Color')
        for key,value in zip(('R','G','B'),values):E.SubElement(c,key).text=str(value)
    def slab_part(p,x,y,z,sx,sz):
        n=part(course,p['id'],(x,y-p['depth']/2,z),(sx,p['depth'],sz),'giwa')
        values=original['palette']['asphalt'] if p['id']=='Start' else original['palette']['body'][p['region']-1]
        if p['kind']=='Ice':values=[min(1,v*1.3) for v in values]
        if p['kind']=='Crumble':values=[0.851,0.443,0.192]
        if p['kind']=='Mover':values=[1,0.878,0.478]
        rgb(n,values)
        return n
    for p in platforms:
        slab_part(p,p['x'],p['y'],p['z'],p['sx'],p['sz'])
    scenery=item(workspace,'Model','UrbanBackdrop')
    for index,d in enumerate(original['decor']):
        n=part(scenery,f"Decor{index}",(d['x'],d['y'],d['z']),(d['sx'],d['sy'],d['sz']),'giwa','Part' if d.get('shape')=='Ball' else d.get('shape','Part'))
        rgb(n,d['color']);prop(n,'bool','CanCollide',str(d.get('collide',False)).lower());prop(n,'bool','CanQuery','false')
        if d.get('shape')=='Ball':prop(n,'token','shape',0)
    # Region beacons communicate progress without labeling every single jump.
    for region in range(1,8):
        p=next(p for p in platforms if p['region']==region and p['id']!='Start')
        n=part(scenery,f'Region{region}',(p['x']-p['sx']/2,p['y']+2,p['z']),(0.5,4,0.5),'celadon')
        prop(n,'bool','CanCollide','false')
        label=item(n,'BillboardGui','RegionLabel');xyz(label,'Vector3','StudsOffset',(0,4,0))
        size=E.SubElement(label.find('Properties'),'UDim2',name='Size')
        for key,value in [('XS',0),('XO',180),('YS',0),('YO',36)]:E.SubElement(size,key).text=str(value)
        prop(label,'float','MaxDistance',120)
        title=item(label,'TextLabel','Title');prop(title,'string','Text',original['regions'][region-1]['name'])
        size=E.SubElement(title.find('Properties'),'UDim2',name='Size')
        for key,value in [('XS',1),('XO',0),('YS',1),('YO',0)]:E.SubElement(size,key).text=str(value)
        prop(title,'float','TextSize',20);prop(title,'float','BackgroundTransparency',1);color(title,'TextColor3','hanji')
    spawn=part(workspace,'Spawn',(0,0.5,-8),(6,1,6),'ocher','SpawnLocation')
    prop(spawn,'bool','Neutral','true');prop(spawn,'float','Duration',0)
    sign=part(scenery,'StartInstructions',(-15,5,-4),(10,7,.5),'ink')
    prop(sign,'bool','CanCollide','false')
    board=item(sign,'BillboardGui','Instructions');prop(board,'bool','AlwaysOnTop','false');prop(board,'float','MaxDistance',100)
    size=E.SubElement(board.find('Properties'),'UDim2',name='Size')
    for key,value in [('XS',0),('XO',280),('YS',0),('YO',80)]:E.SubElement(size,key).text=str(value)
    title=item(board,'TextLabel','Title');prop(title,'string','Text','플레이 ▶를 눌러 시작\n충전 점프 C·Space / 잡기 X / 달리기 Z')
    size=E.SubElement(title.find('Properties'),'UDim2',name='Size')
    for key,value in [('XS',1),('XO',0),('YS',1),('YO',0)]:E.SubElement(size,key).text=str(value)
    prop(title,'float','TextSize',18);prop(title,'float','BackgroundTransparency',1);color(title,'TextColor3','hanji')
    camera=item(workspace,'Camera','Camera')
    cframe(camera,'CFrame',(0,28,-64));cframe(camera,'Focus',(0,10,14))
    camera_frame=camera.find("./Properties/CoordinateFrame[@name='CFrame']")
    length=math.sqrt(18*18+78*78);up_y=78/length;up_z=18/length
    rotation=[[-1,0,0],[0,up_y,up_z],[0,up_z,-up_y]]
    for i in range(3):
        for j in range(3):camera_frame.find(f'R{i}{j}').text=str(rotation[i][j])
    prop(camera,'token','CameraType',5);prop(camera,'float','FieldOfView',58)
    prop(workspace,'Ref','CurrentCamera',camera.attrib['referent'])
    lighting=item(root,'Lighting','Lighting')
    prop(lighting,'float','ClockTime',0);prop(lighting,'float','Brightness',0.32)
    for name,values in [('Ambient',(0.1655,0.1773,0.2626)),('FogColor',(0.055,0.063,0.106))]:
        c=E.SubElement(lighting.find('Properties'),'Color3',name=name)
        for key,value in zip(('R','G','B'),values):E.SubElement(c,key).text=str(value)
    prop(lighting,'float','FogStart',56);prop(lighting,'float','FogEnd',380)
    replicated=item(root,'ReplicatedStorage','ReplicatedStorage')
    shared=item(replicated,'Folder','InfinityStep')
    item(shared,'RemoteEvent','Action');item(shared,'RemoteEvent','State')
    server=item(item(root,'ServerScriptService','ServerScriptService'),'Folder','InfinityStep')
    starter=item(root,'StarterPlayer','StarterPlayer')
    client=item(starter,'StarterPlayerScripts','StarterPlayerScripts')
    item(root,'StarterGui','StarterGui')
    for directory,parent in [('shared',shared),('server',server),('client',client)]:
        for path in sorted((ROOT/'src'/directory).glob('*.luau')):
            cls='Script' if path.name.endswith('.server.luau') else 'LocalScript' if path.name.endswith('.client.luau') else 'ModuleScript'
            name=path.name.removesuffix('.luau').removesuffix('.server').removesuffix('.client')
            n=item(parent,cls,name)
            prop(n,'ProtectedString','Source',path.read_text())
            SOURCE_MAP[n.attrib['referent']]=path.relative_to(ROOT).as_posix()
    E.indent(root,space='  ')
    OUTPUT.parent.mkdir(parents=True,exist_ok=True)
    E.ElementTree(root).write(OUTPUT,encoding='utf-8',xml_declaration=True)
    return OUTPUT
if __name__=='__main__': print(build())
