#!/usr/bin/env python3
"""Deterministic, stdlib-only Roblox XML world and source packager. No remote assets."""
from pathlib import Path
import json, math, xml.etree.ElementTree as ET
ROOT = Path(__file__).resolve().parents[1]
MATERIAL = dict(Concrete=816, Brick=848, Metal=1088, Glass=1568, Neon=288, Wood=512, SmoothPlastic=272, Asphalt=1376, Cobblestone=880, DiamondPlate=1040, Slate=800)
COLORS = dict(stone=(143,147,145), brick=(137,83,67), steel=(79,94,108), glass=(105,172,184), glow=(255,199,104), wood=(144,107,72), green=(73,115,87), black=(10,13,23), white=(214,221,221), signal=(224,164,53))
class Builder:
 def __init__(self):
  self.root=ET.Element('roblox',version='4'); ET.SubElement(self.root,'External').text='null'; ET.SubElement(self.root,'External').text='nil'; self.serial=0; self.parts=0; self.models=0; self.lights=0
 def item(self,parent,kind,name,props=None):
  self.serial+=1; obj=ET.SubElement(parent,'Item',{'class':kind,'referent':f'RBX{self.serial:06d}'})
  p=ET.SubElement(obj,'Properties'); self.prop(p,'string','Name',name)
  for tag,key,val in props or []: self.prop(p,tag,key,val)
  if kind=='Model': self.models+=1
  return obj
 def prop(self,p,tag,key,value):
  node=ET.SubElement(p,tag,name=key)
  if tag=='Vector3':
   for axis,n in zip(('X','Y','Z'),value): ET.SubElement(node,axis).text=f'{n:.6f}'
  elif tag=='CoordinateFrame':
   for axis,n in zip(('X','Y','Z'),value[:3]): ET.SubElement(node,axis).text=f'{n:.6f}'
   for index,n in enumerate(value[3:] if len(value)>3 else (1,0,0,0,1,0,0,0,1)): ET.SubElement(node,f'R{index//3}{index%3}').text=f'{n:.6f}'
  elif tag=='Color3':
   for axis,n in zip(('R','G','B'),value): ET.SubElement(node,axis).text=str(n/255)
  else: node.text=str(value).lower() if isinstance(value,bool) else str(value)
 def part(self,parent,name,pos,size,mat='Concrete',color='stone',collide=True,kind='Part',angle=0):
  rgb=COLORS[color]; packed=(rgb[0]<<16)|(rgb[1]<<8)|rgb[2]
  c,s=math.cos(angle),math.sin(angle)
  props=[('bool','Anchored',True),('bool','CanCollide',collide),('bool','CanTouch',False),('bool','CanQuery',collide),('Vector3','size',size),('CoordinateFrame','CFrame',(*pos,c,0,s,0,1,0,-s,0,c)),('token','Material',MATERIAL[mat]),('Color3uint8','Color3uint8',packed),('token','TopSurface',0),('token','BottomSurface',0)]
  obj=self.item(parent,kind,name,props); self.parts+=1
  if mat=='Glass': self.prop(obj.find('Properties'),'float','Transparency',.28)
  return obj
 def model(self,parent,name): return self.item(parent,'Model',name)
 def light(self,parent,brightness=1.2,radius=16):
  self.lights+=1; self.item(parent,'PointLight','WarmLight',[('float','Brightness',brightness),('float','Range',radius),('Color3','Color',COLORS['glow']),('bool','Shadows',False)])
 def source(self,parent,path,kind): return self.item(parent,kind,Path(path).name.split('.')[0],[('ProtectedString','Source',(ROOT/path).read_text())])

def main():
 b=Builder(); w=b.item(b.root,'Workspace','Workspace',[('bool','StreamingEnabled',True),('int','StreamingMinRadius',128),('int','StreamingTargetRadius',384),('float','Gravity',196.2),('float','FallenPartsDestroyHeight',-80)])
 b.item(w,'Terrain','Terrain')
 world=b.model(w,'NativeWorld'); b.prop(world.find('Properties'),'token','ModelStreamingMode',2) # Persistent: falling players retain the course.
 surfaces=b.item(world,'Folder','Surfaces'); context=b.item(world,'Folder','Architecture')
 plaza=b.model(context,'ArrivalPlaza')
 b.part(surfaces,'Landing00',(0,0,0),(52,2,52),'Cobblestone')
 b.item(w,'SpawnLocation','ArrivalSpawn',[('Vector3','size',(8,1,8)),('CoordinateFrame','CFrame',(-12,1.5,8)),('bool','Anchored',True),('bool','Neutral',True),('bool','Enabled',True),('bool','AllowTeamChangeOnTouch',False),('float','Duration',0)])
 # Starting space: walkable courtyard, pavement, storefronts, raised planters and real stairs.
 for x,z in [(-32,-22),(-32,12),(8,-32),(35,-30)]:
  m=b.model(plaza,'CourtyardShop')
  b.part(m,'Masonry',(x,8,z),(20,16,14),'Brick','brick')
  b.part(m,'Cornice',(x,16.4,z),(22,1,16))
  b.part(m,'Entrance',(x,3.5,z+7.1),(4,7,.3),'Wood','wood',False)
  for dx in (-6,6): b.part(m,'ShopWindow',(x+dx,4.5,z+7.2),(5,6,.25),'Glass','glass',False)
  for dx in (-7,0,7): b.part(m,'UpperWindow',(x+dx,12,z+7.2),(3.5,4,.3),'Glass','glass',False)
  b.part(m,'Awning',(x,8,z+9),(21,.5,5),'Metal','green',False)
 for x,z in [(-20,20),(20,-20),(20,20)]:
  lamp=b.model(plaza,'CourtyardLamp'); b.part(lamp,'Column',(x,5,z),(.5,10,.5),'Metal','steel',False)
  glow=b.part(lamp,'Lantern',(x,10.2,z),(2,1.4,2),'Neon','glow',False); b.light(glow)
 for z in (-18,18):
  b.part(plaza,'Planter',(-19,1.8,z),(9,3,4))
  b.part(plaza,'Hedge',(-19,4,z),(8,3,3),'SmoothPlastic','green',False)
 for i in range(4): b.part(plaza,'EntranceStep',(23+i*1.5, .5+i*.5,-8),(2,1+i,8))
 # Ground city remains a place, rather than suspended tutorial squares.
 for i in range(12):
  x=40+i*35
  b.part(plaza,'Boulevard',(x,-.7,60),(36,1,24),'Asphalt','steel')
  b.part(plaza,'Pavement',(x,0,43),(36,2,8))
  for z in (82,-58):
   m=b.model(context,'CityBlock')
   h=18+(i%4)*8
   b.part(m,'Facade',(x,h/2,z),(25,h,22),'Brick','brick')
   b.part(m,'Roof',(x,h+.5,z),(27,1,24))
   for yy in range(7,h,7):
    for xx in (-8,0,8): b.part(m,'Window',(x+xx,yy,z-11.1),(4,4,.2),'Glass','glass',False)
 # One rising route, every roof supports a distinctive functional architectural silhouette.
 route=[dict(id=0,x=0,y=1,z=0,width=52,depth=52,region=0)]
 x=y=z=0
 rises=(5,6,8,5,9,6)
 labels=['CityRoof','FacadeTerrace','ResidentialRoof','SkyscraperCrown','ConstructionDeck','OrbitalRelay','EventHorizonLab']
 for i in range(1,43):
  region=(i-1)//6; local=(i-1)%6
  x+=18; y+=rises[local]; z=math.sin(i*.65)*12
  width=14 if region==1 else (22 if region==2 else 18)
  depth=16 if region==1 else 20
  deck=b.part(surfaces,f'Landing{i:02d}',(x,y,z),(width,1.5,depth),'DiamondPlate' if region>=4 else 'Concrete','steel' if region>=4 else 'stone')
  m=b.model(context,f'{i:02d}_{labels[region]}')
  if region<=3:
   h=y-1.25
   b.part(m,'BuildingBody',(x,(h-1)/2,z),(width-1,h+1,depth-1),'Brick' if region<3 else 'Metal','brick' if region<2 else 'steel')
   for yy in range(5,int(y)-2,8):
    for xx in (-width*.3,width*.3):
     b.part(m,'Window',(x+xx,yy,z+depth/2),(3.5,4,.3),'Glass','glass',False)
    b.part(m,'FacadeBand',(x,yy+3,z+depth/2),(width,.4,.4),'Metal','white',False)
   b.part(m,'Stairwell',(x,y+3,z-depth/2+3),(6,6,5),'Concrete','stone')
   b.part(m,'ServiceDoor',(x,y+2.7,z-depth/2+5.6),(4,5.5,.3),'Metal','steel',False)
   # Plumbing down each facade, capped ventilation and AC on the clear rear edge.
   b.part(m,'DrainPipe',(x-width/2+.8,y/2,z+depth/2+.5),(.5,y,.5),'Metal','steel',False)
   b.part(m,'VentHousing',(x-4,y+1.8,z-depth/2+3),(4,3,3),'Metal','white')
   for vent in (-.8,0,.8): b.part(m,'VentSlat',(x-4+vent,y+1.8,z-depth/2+4.55),(.25,2,.15),'Metal','steel',False)
   if region==2:
    tank=b.part(m,'WaterTank',(x+5,y+4,z-depth/2+4),(6,5,5),'Metal','steel'); b.prop(tank.find('Properties'),'token','shape',2); tank.find('Properties').remove(tank.find("Properties/CoordinateFrame[@name='CFrame']")); b.prop(tank.find('Properties'),'CoordinateFrame','CFrame',(x+5,y+4,z-depth/2+4,0,-1,0,1,0,0,0,0,1))
    b.part(m,'TankCap',(x+5,y+7.2,z-depth/2+4),(6,.6,6),'Metal','white')
   if region==3:
    b.part(m,'Spire',(x,y+13,z-7),(.7,25,.7),'Metal','white',False)
    light=b.part(m,'Beacon',(x,y+26,z-7),(1.5,1.5,1.5),'Neon','signal',False)
    if local==5: b.light(light,1,20)
  elif region==4:
   for dx in (-6,6):
    for dz in (-7,7): b.part(m,'ScaffoldColumn',(x+dx,y-11,z+dz),(1.3,22,1.3),'Metal','signal')
   b.part(m,'RearCrossbeam',(x,y-7,z-7),(18,1.3,1.3),'Metal','signal')
   for dx in (-5,0,5): b.part(m,'DeckPlank',(x+dx,y+1,z-5),(4,.4,8),'Wood','wood')
   if local in (1,4):
    b.part(m,'CraneMast',(x+5,y+15,z-6),(2,30,2),'Metal','signal')
    b.part(m,'CraneJib',(x+5,y+29,z-2),(3,2,37),'Metal','signal')
    b.part(m,'LiftCable',(x+5,y+14,z+13),(.2,28,.2),'Metal','black',False)
  else:
   for dx in (-7,7):
    b.part(m,'StationGirder',(x+dx,y-4,z),(1.5,8,18),'Metal','white')
    for dz in (-7,7): b.part(m,'Brace',(x+dx,y-8,z+dz),(1.5,9,1.5),'Metal','steel')
   b.part(m,'RelayMast',(x,y+10,z-7),(1,20,1),'Metal','white')
   dish=b.part(m,'RelayDish',(x,y+16,z-7),(2,9,9),'Metal','white',False); b.prop(dish.find('Properties'),'token','shape',2); dish.find('Properties').remove(dish.find("Properties/CoordinateFrame[@name='CFrame']")); b.prop(dish.find('Properties'),'CoordinateFrame','CFrame',(x,y+16,z-7,0,-1,0,1,0,0,0,0,1))
   for dx in (-12,12):
    b.part(m,'SolarArray',(x+dx,y+1,z-5),(7,.3,11),'Glass','glass',False)
    for line in (-3,0,3): b.part(m,'SolarFrame',(x+dx,y+1.25,z-5+line),(7,.2,.15),'Metal','white',False)
   if region==6:
    b.part(m,'HorizonAccent',(x,y+1,z-8),(12,.4,.4),'Neon','glow',False)
  # Guard the rear and side edge while leaving both route-facing edges open.
  b.part(m,'RearRail',(x,y+3,z-depth/2+.4),(width,.35,.35),'Metal','white')
  for dx in (-width/2+.5,width/2-.5): b.part(m,'RailPost',(x+dx,y+1.5,z-depth/2+.4),(.35,3,.35),'Metal','white')
  # Engine TrussPart route to the next roof, accessible from the current landing.
  if i>1:
   prev=route[-1]; ladderx=x-width/2-.7
   b.part(m,'NativeServiceLadder',(ladderx,(y+prev['y'])/2+1,z),(2,y-prev['y']+3,2),'Metal','steel',True,'TrussPart')
   b.part(m,'LadderApproach',((prev['x']+ladderx)/2,prev['y']+.1,z),(abs(ladderx-prev['x'])+2,.5,4),'Metal','steel')
  # Path signal is physical lighting in the architecture, no floating arrow HUD.
  b.part(m,'RouteEdge',(x-5,y+.85,z+depth/2-1),(8,.12,.6),'Neon','glow',False)
  route.append(dict(id=i,x=x,y=y+.75,z=z,width=width,depth=depth,region=region))
 # Black hole: static non-colliding light ring and central sphere, safe research deck at the end.
 hole=b.model(context,'BlackHoleObservatory'); hx=x+25; hy=y+32
 core=b.part(hole,'Singularity',(hx,hy,z-20),(25,25,25),'SmoothPlastic','black',False); b.prop(core.find('Properties'),'token','shape',0)
 for j in range(48):
  a=j*math.tau/48
  b.part(hole,'AccretionRing',(hx+math.cos(a)*24,hy+math.sin(a)*7,z-20+math.sin(a)*24),(3,.7,3),'Neon','glow',False,angle=-a)
 b.item(world,'Folder','CourseMetadata')
 lighting=b.item(b.root,'Lighting','Lighting',[('float','Brightness',2.2),('float','ClockTime',16.2),('float','ExposureCompensation',.1),('Color3','Ambient',(108,121,140)),('Color3','OutdoorAmbient',(137,151,167)),('bool','GlobalShadows',True)])
 b.item(lighting,'Atmosphere','CityHaze',[('float','Density',.24),('float','Offset',.12),('Color3','Color',(193,211,223)),('Color3','Decay',(113,127,147)),('float','Glare',.15),('float','Haze',1.4)])
 b.item(lighting,'Sky','NativeSky')
 b.item(lighting,'BloomEffect','SolarBloom',[('float','Intensity',.2),('float','Size',20),('float','Threshold',1.7)])
 replicated=b.item(b.root,'ReplicatedStorage','ReplicatedStorage'); shared=b.item(replicated,'Folder','InfinityStep')
 for p in sorted((ROOT/'src/shared').glob('*.luau')): b.source(shared,p.relative_to(ROOT),'ModuleScript')
 b.item(shared,'RemoteEvent','Action')
 service=b.item(b.root,'ServerScriptService','ServerScriptService'); server=b.item(service,'Folder','InfinityStepServer')
 for p in sorted((ROOT/'src/server').glob('*.luau')): b.source(server,p.relative_to(ROOT),'Script' if '.server.' in p.name else 'ModuleScript')
 starter=b.item(b.root,'StarterPlayer','StarterPlayer',[('float','CharacterWalkSpeed',16),('float','CharacterJumpPower',52),('bool','CharacterUseJumpPower',True),('float','CameraMaxZoomDistance',48),('float','CameraMinZoomDistance',.5)])
 scripts=b.item(starter,'StarterPlayerScripts','StarterPlayerScripts')
 for p in sorted((ROOT/'src/client').glob('*.luau')): b.source(scripts,p.relative_to(ROOT),'LocalScript')
 ET.indent(b.root,space=' ')
 (ROOT/'dist').mkdir(exist_ok=True)
 ET.ElementTree(b.root).write(ROOT/'dist/InfinityStep.rbxlx',encoding='utf-8',xml_declaration=True)
 manifest=dict(route=route,gravity=196.2,walkSpeed=16,parts=b.parts,models=b.models,lights=b.lights,terrain='runtime: Environment.server.luau',source='authored procedural native geometry; no remote asset IDs')
 (ROOT/'dist/world-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
 print(f'BUILD OK: {b.parts} parts, {b.models} models, {b.lights} lights, 43 stable landing surfaces; { (ROOT/"dist/InfinityStep.rbxlx").stat().st_size } bytes')
if __name__=='__main__': main()
