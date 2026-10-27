#!/usr/bin/env python3
"""Evaluate unchanged original code in an isolated Unity project; no UI automation."""
from pathlib import Path
import hashlib,json,os,shutil,subprocess,tempfile
ROOT=Path(__file__).resolve().parents[1]; REPO=ROOT.parents[1]
SOURCE=REPO/'portal-fe/public/games/_src/infinity-step'
UNITY=Path('/Applications/Unity/Hub/Editor/6000.5.9f1/Unity.app/Contents/MacOS/Unity')
def run():
    project=Path(tempfile.mkdtemp(prefix='roblox-original-',dir='/private/tmp'))
    for name in ['Assets','Packages','ProjectSettings','Library']:
        shutil.copytree(SOURCE/name,project/name)
    manifest=project/'Packages/manifest.json'; data=json.loads(manifest.read_text())
    data['dependencies']['com.kgd.webgame']='file:'+str(REPO/'unity/packages/com.kgd.webgame')
    manifest.write_text(json.dumps(data,indent=2))
    editor=project/'Assets/Editor'; editor.mkdir(exist_ok=True)
    shutil.copy2(ROOT/'tools/original/OriginalExport.cs',editor/'OriginalExport.cs')
    output=ROOT/'data/original-normal-20261028.json';log=project/'export.log'
    env=dict(os.environ,ORIGINAL_EXPORT=str(output))
    result=subprocess.run([str(UNITY),'-batchmode','-nographics','-quit','-projectPath',str(project),'-executeMethod','OriginalExport.Run','-logFile',str(log)],env=env)
    if result.returncode or not output.exists(): raise SystemExit(f'Unity export failed ({result.returncode}); inspect {log}')
    files=list((SOURCE/'Assets/Scripts').rglob('*.cs'))+list((REPO/'unity/packages/com.kgd.webgame/Runtime').rglob('*.cs'))
    provenance={'command':'python3 roblox/infinity-step/tools/export_original.py','seed':20261028,'difficulty':'Normal','target':3220,'unity':'6000.5.9f1','outputSha256':hashlib.sha256(output.read_bytes()).hexdigest(),'sources':{str(p.relative_to(REPO)):hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(files)}}
    (ROOT/'data/provenance.json').write_text(json.dumps(provenance,indent=2)+'\n')
    print(output);print(log)
if __name__=='__main__':run()
