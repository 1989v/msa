#!/usr/bin/env python3
"""서버 Combat·Bots 스모크 테스트 — Roblox 대역(tests/roblox-shim.luau) 위에서 실제 모듈 본문을 luau CLI 로 돌린다.

luau CLI 는 모듈마다 환경을 격리해서 전역(game·workspace·Instance…)을 주입할 수 없다. 그래서 쉼 로드 → 모듈 본문을
함수로 감싼 것 → 테스트 본문을 한 청크로 이어 붙인다. 모듈 본문의 game/Instance/require 는 청크 앞의 local 에 묶인다.
생성 파일은 dist/smoke/combined.luau(미추적). require 문자열은 그 파일 기준 상대 경로다.
"""
import os, pathlib, subprocess, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
LUAU = os.environ.get('LUAU_BIN', 'luau')

HEADER = '''--!nonstrict
-- tools/smoke.py 가 생성. 손으로 고치지 않는다.
local Shim = require("../../tests/roblox-shim")
Shim.configure({ sharedPrefix = "../../src/shared/" })
local game, workspace, Instance, Enum = Shim.game, Shim.workspace, Shim.Instance, Shim.Enum
local Vector3, Vector2, CFrame, Random, RaycastParams, task, Color3 = Shim.Vector3, Shim.Vector2, Shim.CFrame, Shim.Random, Shim.RaycastParams, Shim.task, Shim.Color3
local realRequire = require
local function require(x) if type(x) == "table" then return x end return realRequire(x) end
local script = { Parent = {} }
local Config = realRequire("../../src/shared/Config")
local Rules = realRequire("../../src/shared/Rules")
local Styles = realRequire("../../src/shared/Styles")
local Moves = realRequire("../../src/shared/Moves")
'''

ITEMS_STUB = '''script.Parent.Items = { nearest = function() return nil end, pickupBy = function() end, throwHeld = function() end, dropHeld = function() end }
script.Parent.Rigs = { animate = function() end }
'''


def wrap(name, path):
    src = path.read_text(encoding='utf-8')
    return f'local {name} = (function()\n{src}\nend)()\nscript.Parent.{name} = {name}\n'


def build():
    out = ROOT / 'dist' / 'smoke' / 'combined.luau'
    out.parent.mkdir(parents=True, exist_ok=True)
    body = HEADER
    body += wrap('Combat', ROOT / 'src' / 'server' / 'Combat.luau')
    body += ITEMS_STUB
    body += wrap('Bots', ROOT / 'src' / 'server' / 'Bots.luau')
    body += (ROOT / 'tests' / 'combat.smoke.luau').read_text(encoding='utf-8')
    out.write_text(body, encoding='utf-8')
    return out


def main():
    out = build()
    r = subprocess.run([LUAU, str(out)], capture_output=True, text=True)
    sys.stdout.write(r.stdout)
    if r.returncode != 0:
        sys.stdout.write(r.stderr)
        print(f'SMOKE exit={r.returncode}')
    return r.returncode


if __name__ == '__main__':
    sys.exit(main())
