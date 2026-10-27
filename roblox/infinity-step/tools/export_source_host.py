#!/usr/bin/env python3
"""Compile original generator unchanged through BandOf; omit rendering only.
Uses .NET float shim, NOT Unity engine output / bit-equivalence evidence.
"""
from pathlib import Path
import hashlib,json,os,subprocess,tempfile
ROOT=Path(__file__).resolve().parents[1];REPO=ROOT.parents[1]
SOURCE=REPO/'portal-fe/public/games/_src/infinity-step/Assets/Scripts'
DOTNET=Path('/Applications/Unity/Hub/Editor/6000.5.9f1/Unity.app/Contents/Resources/Scripting/DotNetSdk/dotnet')
def run():
    project=Path(tempfile.mkdtemp(prefix='roblox-original-source-',dir='/private/tmp'))
    sources={};cuts={}
    paths={'Tower.cs':SOURCE/'World/Tower.cs','Leap.cs':SOURCE/'Sim/Leap.cs','Biome.cs':SOURCE/'World/Biome.cs','Pal.cs':SOURCE/'Core/Pal.cs','KgdMover.cs':REPO/'unity/packages/com.kgd.webgame/Runtime/Motion/KgdMover.cs'}
    for name,path in paths.items():
        text=path.read_text();sources[str(path.relative_to(REPO))]=hashlib.sha256(path.read_bytes()).hexdigest()
        if name=='Tower.cs':
            marker='    private static int BandOf(float y) => Mathf.FloorToInt(y / BandH);'
            end=text.index(marker)+len(marker);cuts[name]={'includedLines':text[:end].count('\n')+1,'excluded':'rendering/view methods after BandOf'};hash_start=text.index('    private float Bhash(');hash_end=text.index('\n    }',hash_start)+6;cuts[name]['retainedHelper']='Bhash, original lines1538-1546';text=text[:end]+'\n'+text[hash_start:hash_end]+'\n}\n'
        if name=='Biome.cs':
            start=text.index('    public static void Apply(');end=text.index('    private static (Vector3 dir, float power) Gust(',start)
            cuts[name]={'excluded':'Apply(camera, sun, look) rendering only'};text=text[:start]+text[end:]
        (project/name).write_text(text)
    for name in ['MathAdapter.cs','OriginalExport.cs']:(project/name).write_text((ROOT/'tools/original'/name).read_text())
    (project/'Host.csproj').write_text('<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net8.0</TargetFramework><EnableDefaultCompileItems>true</EnableDefaultCompileItems></PropertyGroup></Project>')
    output=ROOT/'data/original-normal-20261028.json';output.parent.mkdir(exist_ok=True)
    env=dict(os.environ,ORIGINAL_EXPORT=str(output),DOTNET_CLI_HOME=str(project/'cli'),DOTNET_CLI_TELEMETRY_OPTOUT='1',DOTNET_SKIP_FIRST_TIME_EXPERIENCE='1',DOTNET_GENERATE_ASPNET_CERTIFICATE='false')
    subprocess.run([str(DOTNET),'run','--project',str(project/'Host.csproj'),'--configuration','Release'],env=env,check=True)
    reference_paths=[SOURCE/'Actors/Climber.cs',SOURCE/'GameEntry.cs',SOURCE/'Sim/Progress.cs',SOURCE/'Core/Art.cs',REPO/'unity/packages/com.kgd.webgame/Runtime/Play/KgdTraverse.cs',REPO/'unity/packages/com.kgd.webgame/Runtime/Play/KgdOrbitCam.cs']
    references={str(p.relative_to(REPO)):hashlib.sha256(p.read_bytes()).hexdigest() for p in reference_paths}
    provenance={'referenceSources':references,'mode':'unchanged-original-generator-with-dotnet-math-adapter','NOT':'Unity engine execution or bit-identical Unity map','command':'python3 roblox/infinity-step/tools/export_source_host.py','seed':20261028,'difficulty':'Normal','target':3220,'host':'dotnet 8.0.318 / net8.0 / MathF float adapter','cuts':cuts,'outputSha256':hashlib.sha256(output.read_bytes()).hexdigest(),'sources':sources,'tools':{name:hashlib.sha256((ROOT/'tools/original'/name).read_bytes()).hexdigest() for name in ['MathAdapter.cs','OriginalExport.cs']}}
    (ROOT/'data/provenance.json').write_text(json.dumps(provenance,indent=2)+'\n')
    print(output)
if __name__=='__main__':run()
