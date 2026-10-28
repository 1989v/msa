--!nonstrict
-- 클라이언트 명령의 모양 검사와 빈도 제한. 통과한 것만 Main/Combat 이 실행한다. 거부는 조용히 버린다(스팸이 화면을 채우지 않게).
-- Roblox API 를 쓰지 않아 luau CLI 로 검사한다. 시계는 인자(now)로 받는다 — 기본은 os.clock().
local Config = require("../shared/Config")
local Commands = {}

local function finiteVector(v)
	if type(v) ~= "table" and typeof(v) ~= "Vector3" then return false end
	local x, y, z = v.X, v.Y, v.Z
	if type(x) ~= "number" or type(y) ~= "number" or type(z) ~= "number" then return false end
	return x == x and y == y and z == z and math.abs(x) <= 2 and math.abs(y) <= 2 and math.abs(z) <= 2
end
local INTENTS = { light = true, heavy = true, special = true, dash = true, throw = true }

local SCHEMA = {
	loadout = function(a) return type(a.style) == "string" and #a.style <= 16 and (a.accessory == nil or (type(a.accessory) == "string" and #a.accessory <= 16)) end,
	ready = function(a) return a.on == nil or type(a.on) == "boolean" end,
	intent = function(a) return INTENTS[a.kind] == true and (a.dir == nil or finiteVector(a.dir)) end,
	guard = function(a) return type(a.on) == "boolean" end,
}

local buckets = {}
local CAP, REFILL = Config.LIMITS.commandBurst, Config.LIMITS.commandRefillPerSecond

function Commands.validate(player, name, args, now)
	now = now or os.clock()
	if type(name) ~= "string" or not SCHEMA[name] then return false, "UNKNOWN" end
	if type(args) ~= "table" then args = {} end
	local b = buckets[player] or { tokens = CAP, at = now }
	buckets[player] = b
	b.tokens = math.min(CAP, b.tokens + (now - b.at) * REFILL); b.at = now
	if b.tokens < 1 then return false, "RATE" end
	b.tokens -= 1
	if not SCHEMA[name](args) then return false, "SCHEMA" end
	return true, args
end

function Commands.forget(player) buckets[player] = nil end

return Commands
