#!/usr/bin/env python3
from pathlib import Path
import os
import re
import subprocess
import xml.etree.ElementTree as E
import build_place
import generate_native
ROOT=Path(__file__).resolve().parents[1]
runner=Path(os.environ.get('LUAU_BIN','luau'))
compiler=runner.with_name('luau-compile')
analyzer=runner.with_name('luau-analyze')
if not runner.is_file() or not compiler.is_file() or not analyzer.is_file():
    raise SystemExit('Official Luau CLI and sibling luau-compile / luau-analyze are required; no skipped pass.')
subprocess.run([str(runner),str(ROOT/'tests/run.luau')],check=True)
generate_native.generate(runner)
files=sorted((ROOT/'src').rglob('*.luau'))+sorted((ROOT/'tests').glob('*.luau'))
for path in files:
    result=subprocess.run([str(compiler),str(path)],capture_output=True)
    if result.returncode: raise SystemExit(f'{path}: {result.stderr.decode('utf-8',errors='replace')}')
allowed_globals={'game','workspace','Enum','Instance','Vector3','CFrame','Color3','UDim2','RaycastParams','OverlapParams','PhysicalProperties','script','task'}
analysis=subprocess.run([str(analyzer),'--formatter=plain',*[str(p) for p in files]],capture_output=True,text=True)
unknown=set(re.findall(r"Unknown global '([^']+)'",analysis.stdout+analysis.stderr))-allowed_globals
if unknown: raise SystemExit('Undefined globals: '+', '.join(sorted(unknown)))
if analysis.returncode not in (0,1): raise SystemExit('Luau analyzer failed to execute: '+analysis.stderr)
print('PASS unknown-global analysis with explicit Roblox globals allowlist (not Roblox API typechecking)')
print(f'PASS compiled {len(files)} Luau files (syntax/bytecode, not Roblox API typechecking)')
artifact=build_place.build()
first=artifact.read_bytes()
assert first==build_place.build().read_bytes(),'non-deterministic artifact'
xml=E.parse(artifact)
scripts={n.attrib['referent']:n for n in xml.iter('Item') if n.attrib['class'] in ('Script','LocalScript','ModuleScript')}
assert len(scripts)==len(build_place.SOURCE_MAP)==len(list((ROOT/'src').rglob('*.luau')))
for ref,path in build_place.SOURCE_MAP.items():
    n=scripts[ref]
    assert n.find("./Properties/ProtectedString[@name='Source']").text==(ROOT/path).read_text(),path
    expected='LocalScript' if '.client.' in path else 'Script' if '.server.' in path else 'ModuleScript'
    assert n.attrib['class']==expected
classes=[n.attrib['class'] for n in xml.iter('Item')]
for cls in ['Workspace','Camera','SpawnLocation','ReplicatedStorage','ServerScriptService','StarterPlayerScripts']:
    assert cls in classes,cls
assert classes.count('RemoteEvent')==2
import json
native=json.loads((ROOT/'data/native-course.json').read_text())
assert len(native['regions'])==7
assert len(native['links'])==len(native['path'])-1
part_count=sum(1 for cls in classes if cls in ('Part','WedgePart','TrussPart','SpawnLocation'))
assert part_count<=1500, 'Native map part budget exceeded'
assert 'Source0000' not in first.decode(), 'Original reference snapshot leaked into default artifact'
print(f'PASS native route: {len(native["path"])} primary decisions, {part_count} native parts, seven regions; reference export excluded')
assert 'PRODUCT_ID=0' in (ROOT/'src/server/Main.server.luau').read_text()
print(f'PASS deterministic XML: exact {len(scripts)} scripts, services, visible course, spawn, camera ({len(first)} bytes)')
print('UNVERIFIED: Roblox physics/API runtime, Studio play, touch feel, two live clients, real Marketplace receipts.')
