#!/usr/bin/env python3
"""Serialize the actual pure-Luau native generator; build_place can use its checked snapshot."""
from pathlib import Path
import os,json,subprocess,hashlib
ROOT=Path(__file__).resolve().parents[1]
SOURCES=['src/shared/Generator.luau','src/shared/Course.luau','src/shared/Jump.luau']
def hashes():return {p:hashlib.sha256((ROOT/p).read_bytes()).hexdigest() for p in SOURCES}
def generate(runner=None):
    runner=runner or os.environ.get('LUAU_BIN','luau')
    result=subprocess.run([str(runner),str(ROOT/'tools/export_native.luau')],check=True,capture_output=True,text=True)
    data=json.loads(result.stdout)
    (ROOT/'data/native-course.json').write_text(json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n')
    (ROOT/'data/native-course-provenance.json').write_text(json.dumps({'generator':'actual pure Luau Generator.build','sources':hashes()},indent=2)+'\n')
    return data
if __name__=='__main__':generate()
