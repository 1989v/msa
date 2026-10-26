#!/usr/bin/env python3
"""Deterministic, stdlib-only Roblox XML builder. No Roblox installation needed."""
from pathlib import Path
import re
import xml.etree.ElementTree as E
ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'dist/InfinityStep.rbxlx'
SOURCE_MAP = {}

def authored():
    source = (ROOT / 'src/shared/Course.luau').read_text()
    platforms = []
    for row in re.findall(r'\{ id="([^\n]+)', source):
        name = row.split('"')[0]
        values = dict((k, float(v)) for k, v in re.findall(r'(x|y|z|sx|sz|region)=(-?[\d.]+)', row))
        platforms.append(dict(id=name, **values))
    assert len(platforms) == 9
    theme = (ROOT / 'src/shared/Theme.luau').read_text()
    colors = {k: tuple(map(int, rgb.split(','))) for k, rgb in re.findall(r'(\w+)=\{([\d,]+)\}', theme)}
    return platforms, colors

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
    platforms, colors = authored()
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
    for p in platforms:
        n=part(course,p['id'],(p['x'],p['y']-2,p['z']),(p['sx'],4,p['sz']),'celadon' if p['id'] in ('Exterior','Roof','Finish') else 'giwa')
        label=item(n,'BillboardGui','PlatformLabel')
        xyz(label,'Vector3','StudsOffset',(0,4,0))
        size=E.SubElement(label.find('Properties'),'UDim2',name='Size')
        for key,val in [('XS',0),('XO',190),('YS',0),('YO',48)]: E.SubElement(size,key).text=str(val)
        prop(label,'float','MaxDistance',130)
        text=item(label,'TextLabel','Title')
        size=E.SubElement(text.find('Properties'),'UDim2',name='Size')
        for key,val in [('XS',1),('XO',0),('YS',1),('YO',0)]: E.SubElement(size,key).text=str(val)
        prop(text,'string','Text',f"{int(p['region']):02d} / {p['id'].upper()}" + (' / FINISH' if p['id']=='Finish' else ''))
        prop(text,'float','TextSize',18);prop(text,'float','BackgroundTransparency',1);color(text,'TextColor3','hanji')
    spawn=part(workspace,'Spawn',(0,0.5,0),(6,1,6),'ocher','SpawnLocation')
    prop(spawn,'bool','Neutral','true');prop(spawn,'float','Duration',0)
    # Static urban silhouettes behind the climbing lane, never blocking route jumps.
    scenery=item(workspace,'Model','UrbanBackdrop')
    for i in range(5):
        part(scenery,f'Facade{i}',(i*18,12+i*5,-17),(15,24+i*10,8),'ink')
        for j in range(3): part(scenery,f'Window{i}_{j}',(i*18-4+j*4,13+i*5,-12.8),(2,3,.3),'ocher')
    part(scenery,'FinishBeacon',(platforms[-1]['x'],platforms[-1]['y']+3,-5),(1,6,1),'yeonji')
    camera=item(workspace,'Camera','Camera')
    cframe(camera,'CFrame',(36,42,100));cframe(camera,'Focus',(36,22,0))
    prop(camera,'token','CameraType',5);prop(camera,'float','FieldOfView',70)
    prop(workspace,'Ref','CurrentCamera',camera.attrib['referent'])
    lighting=item(root,'Lighting','Lighting')
    prop(lighting,'float','ClockTime',16);prop(lighting,'float','Brightness',2)
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
