"""Draw shipped entrance geometry. This is a static diagram, never a live UI capture."""
from pathlib import Path
import json, math, html
root=Path(__file__).parent
courses=json.loads((root/'entrance-geometry.json').read_text())
parts=['<svg xmlns="http://www.w3.org/2000/svg" width="1260" height="880" viewBox="0 0 1260 880"><rect width="1260" height="880" fill="white"/><text x="24" y="28" font-size="20">Actual entrance geometry — static diagram (not a live screenshot)</text><text x="24" y="52" font-size="14">Blue: unchanged 12-person spawn · black: walls · gray: pegs · orange: bumpers / initial moving arms · dashed: y496 handoff</text>']
for index,c in enumerate(courses):
 col,row=index%3,index//3
 ox,oy=20+col*414,80+row*395
 scale=.65
 def point(x,y):return ox+207+(x-506)*scale,oy+34+(y-110)*scale
 parts.append(f'<rect x="{ox}" y="{oy}" width="398" height="378" fill="none" stroke="lightgray"/><text x="{ox+12}" y="{oy+23}" font-size="17">{html.escape(c["key"])}</text>')
 for w in c['shapes']['walls']:
  x1,y1=point(w['x1'],w['y1']);x2,y2=point(w['x2'],w['y2'])
  parts.append(f'<line stroke="black" stroke-linecap="round" x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke-width="{w["r"]*2*scale}"/>')
 for p in c['shapes']['pegs']:
  x,y=point(p['x'],p['y']);cls='orange' if p.get('bump') else 'slategray'
  parts.append(f'<circle fill="{cls}" cx="{x}" cy="{y}" r="{p["r"]*scale}"/>')
 for field in ('rotors','seesaws'):
  for bar in c['shapes'][field]:
   dx,dy=math.cos(bar['a0'])*bar['len'],math.sin(bar['a0'])*bar['len']
   x1,y1=point(bar['x']-dx,bar['y']-dy);x2,y2=point(bar['x']+dx,bar['y']+dy)
   x,y=point(bar['x'],bar['y'])
   parts.append(f'<line stroke="darkorange" stroke-linecap="round" x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke-width="{bar["r"]*2*scale}"/><circle cx="{x}" cy="{y}" r="3" fill="black"/>')
 for m in next(s['marbles'] for s in c['spawns'] if s['count']==12):
  x,y=point(m['x'],m['y']);parts.append(f'<circle fill="none" stroke="steelblue" stroke-width="1" cx="{x}" cy="{y}" r="{m["r"]*scale}"/>')
 x1,y=point(250,496);x2,_=point(762,496)
 parts.append(f'<line x1="{x1}" y1="{y}" x2="{x2}" y2="{y}" stroke="gray" stroke-dasharray="6 5"/><text x="{ox+12}" y="{oy+356}" font-size="13">Handoff y496 — downstream unchanged</text>')
parts.append('</svg>')
(root/'entrance-comparison.svg').write_text('\n'.join(parts)+'\n')
# ImageMagick's SVG delegate can drop CSS/attribute strokes on this host.
# Native vector primitives preserve the same measured radii/segments in the PNG.
draw=['push graphic-context','viewbox 0 0 1260 880','fill white','stroke none','rectangle 0,0 1260,880',"font '/System/Library/Fonts/Supplemental/Arial.ttf'",'fill black','font-size 20',"text 24,28 'Actual entrance geometry - static diagram (not a live screenshot)'",'font-size 14',"text 24,52 'Blue: unchanged 12-person spawn; black: walls; gray: pegs; orange: bumpers / initial moving arms; y496 handoff'"]
for index,c in enumerate(courses):
 col,row=index%3,index//3
 ox,oy=20+col*414,80+row*395
 scale=.65
 def point(x,y):return ox+207+(x-506)*scale,oy+34+(y-110)*scale
 draw += ['fill none','stroke lightgray','stroke-width 1',f'rectangle {ox},{oy} {ox+398},{oy+378}','stroke none','fill black','font-size 17',f"text {ox+12},{oy+23} '{c['key']}'"]
 for w in c['shapes']['walls']:
  x1,y1=point(w['x1'],w['y1']);x2,y2=point(w['x2'],w['y2'])
  draw += ['fill none','stroke black','stroke-linecap round',f'stroke-width {w["r"]*2*scale}',f'line {x1},{y1} {x2},{y2}']
 for p in c['shapes']['pegs']:
  x,y=point(p['x'],p['y']);color='orange' if p.get('bump') else 'slategray'
  draw += ['stroke none',f'fill {color}',f'circle {x},{y} {x+p["r"]*scale},{y}']
 for field in ('rotors','seesaws'):
  for bar in c['shapes'][field]:
   dx,dy=math.cos(bar['a0'])*bar['len'],math.sin(bar['a0'])*bar['len']
   x1,y1=point(bar['x']-dx,bar['y']-dy);x2,y2=point(bar['x']+dx,bar['y']+dy);x,y=point(bar['x'],bar['y'])
   draw += ['fill none','stroke darkorange',f'stroke-width {bar["r"]*2*scale}',f'line {x1},{y1} {x2},{y2}','stroke none','fill black',f'circle {x},{y} {x+3},{y}']
 for m in next(s['marbles'] for s in c['spawns'] if s['count']==12):
  x,y=point(m['x'],m['y']);draw += ['fill none','stroke steelblue','stroke-width 1',f'circle {x},{y} {x+m["r"]*scale},{y}']
 x1,y=point(250,496);x2,_=point(762,496)
 draw += ['stroke gray','stroke-width 1','stroke-dasharray 6,5',f'line {x1},{y} {x2},{y}','stroke-dasharray none','stroke none','fill black','font-size 13',f"text {ox+12},{oy+356} 'Handoff y496 - downstream unchanged'"]
draw.append('pop graphic-context')
(root/'entrance-comparison.mvg').write_text('\n'.join(draw)+'\n')

# ImageMagick native vectors avoid host SVG delegate differences.
import subprocess
subprocess.run(["magick", "-size", "1260x880", "canvas:white", "-draw", "\n".join(draw), str(root/"entrance-comparison.png")], check=True)
