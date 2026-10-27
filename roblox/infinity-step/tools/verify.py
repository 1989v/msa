#!/usr/bin/env python3
"""Structural and ballistic checks; this is NOT Studio/physics validation."""
import hashlib, json, math, re, subprocess, sys, xml.etree.ElementTree as ET
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def check(condition,message):
 if not condition: raise AssertionError(message)
def main():
 place=ROOT/'dist/InfinityStep.rbxlx'; manifest=ROOT/'dist/world-manifest.json'
 first=place.read_bytes(); first_manifest=manifest.read_bytes()
 subprocess.run([sys.executable,str(ROOT/'tools/build.py')],check=True)
 check(first==place.read_bytes() and first_manifest==manifest.read_bytes(),'nondeterministic build')
 tree=ET.parse(place); document=tree.getroot(); data=json.loads(manifest.read_text())
 items=document.findall('.//Item'); properties=lambda obj:obj.find('Properties')
 name=lambda obj:properties(obj).find("*[@name='Name']").text
 byname={name(obj):obj for obj in items}
 check(len([i for i in items if i.attrib['class']=='SpawnLocation'])==1,'spawn')
 check(len(data['route'])==43,'missing route surfaces')
 def vector(obj,key):return tuple(float(obj.find(f"Properties/*[@name='{key}']/{axis}").text) for axis in ('X','Y','Z'))
 roofs=[]
 for point in data['route']:
  obj=byname[f"Landing{point['id']:02d}"]; pos=vector(obj,'CFrame'); size=vector(obj,'size')
  check(abs(pos[0]-point['x'])<1e-5 and abs(pos[2]-point['z'])<1e-5,'manifest not derived from geometry')
  top=pos[1]+size[1]/2
  check(abs(top-point['y'])<1e-5,'roof top manifest mismatch')
  check(obj.find("Properties/bool[@name='CanCollide']").text=='true','noncolliding landing')
  roofs.append((pos,size,top))
 rules=(ROOT/'src/shared/Rules.luau').read_text()
 low=float(re.search(r'MIN_POWER = (\d+)',rules)[1]); high=float(re.search(r'MAX_POWER = (\d+)',rules)[1]); gravity=data['gravity']; speed=data['walkSpeed']
 need_charge=0; worst=0
 for index in range(1,len(roofs)):
  p,ps,py=roofs[index-1]; q,qs,qy=roofs[index]; rise=qy-py
  # Distance between safe interior landing rectangles (2-stud inset each side).
  dx=max(0,abs(q[0]-p[0])-(ps[0]+qs[0])/2+4)
  dz=max(0,abs(q[2]-p[2])-(ps[2]+qs[2])/2+4)
  gap=math.hypot(dx,dz)
  def reach(power):
   discriminant=power*power-2*gravity*rise
   return 0 if discriminant<0 else speed*(power+math.sqrt(discriminant))/gravity
  check(reach(high)>=gap+.5,f'route {index} lacks full-power landing safety margin: gap{gap}, range{reach(high)}')
  if reach(low)<gap+.5:need_charge+=1
  worst=max(worst,gap)
 check(0<need_charge<25,'route should mix immediate native jumps and charge choices')
 sources=list((ROOT/'src').rglob('*.luau'))
 for path in sources:
  source=path.read_text(); packed=next((obj for obj in items if obj.attrib['class'] in ('Script','LocalScript','ModuleScript') and name(obj)==path.name.split('.')[0]),None)
  check(packed is not None and packed.find("Properties/ProtectedString[@name='Source']").text==source,f'not packed: {path}')
 client='\n'.join(p.read_text() for p in (ROOT/'src/client').glob('*.luau'))
 for forbidden in ('CameraType','JumpRequest','ContextActionService','UserInputService','AssemblyLinearVelocity','JumpPower','VirtualInput','WASD','Scriptable'):
  check(forbidden not in client,f'custom input/camera/jump found: {forbidden}')
 check('LandingId' in (ROOT/'src/server/Game.server.luau').read_text(),'landing identity initialization absent')
 check('SetAttribute("LandingId", id)' in (ROOT/'src/server/Game.server.luau').read_text(),'landing IDs never attached')
 check('Instance.new("Clouds")' in (ROOT/'src/server/Environment.server.luau').read_text() and 'clouds.Parent = Terrain' in (ROOT/'src/server/Environment.server.luau').read_text(),'Clouds parent')
 check(byname['Terrain'].attrib['class']=='Terrain' and byname['CityHaze'].attrib['class']=='Atmosphere','native environment')
 check(data['parts']<3000 and data['lights']<=12 and len(first)<4_000_000,'world budget')
 check(len([o for o in items if o.attrib['class']=='TrussPart'])>=35,'native climbing route missing')
 print(f'WORLD OK: 42 transitions; {42-need_charge} immediate-power / {need_charge} charged rises; largest safe-interior gap {worst:.2f} studs')
 print(f'PACKAGE OK: {len(sources)} exact embedded sources; deterministic sha256 {hashlib.sha256(first).hexdigest()}; native input/camera retained')
 print('LIMIT: Studio import, API execution, actual character movement, mobile/gamepad, streaming and visuals NOT VERIFIED')
if __name__=='__main__':main()
