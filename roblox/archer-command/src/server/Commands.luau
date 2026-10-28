--!nonstrict
-- 클라이언트 명령의 모양 검사와 빈도 제한. 통과한 것만 Main 이 실행한다.
local Commands = {}

local function finiteVector(v)
	if typeof(v) ~= "Vector3" then return false end
	return v.X == v.X and v.Y == v.Y and v.Z == v.Z and math.abs(v.X) < 1e4 and math.abs(v.Y) < 1e4 and math.abs(v.Z) < 1e4
end

local Shared = game:GetService("ReplicatedStorage"):WaitForChild("ArcherCommand")
local Config = require(Shared.Config)

local SCHEMA = {
	start = function(a) return a.mode == "new" or a.mode == "continue" end,
	hire = function(a) local u = Config.UNITS[a.kind]; return u ~= nil and u.cost > 0 end,
	upgrade = function(a) return a.kind == "attack" or a.kind == "armor" end,
	combine = function(a) return type(a.kind) == "string" and Config.UNITS[a.kind] ~= nil end,
	tower = function(a) return finiteVector(a.point) end,
	skill = function(a)
		local s = Config.SKILLS[a.kind]
		if not s then return false end
		return s.target ~= "ground" or finiteVector(a.point)
	end,
	restart = function() return true end,
}

local buckets = {}
local CAP, REFILL = 20, 2 -- 20개, 초당 2개 회복

function Commands.validate(player, name, args)
	if type(name) ~= "string" or not SCHEMA[name] then return false, "UNKNOWN" end
	if type(args) ~= "table" then args = {} end
	local b = buckets[player] or { tokens = CAP, at = os.clock() }
	buckets[player] = b
	local t = os.clock()
	b.tokens = math.min(CAP, b.tokens + (t - b.at) * REFILL); b.at = t
	if b.tokens < 1 then return false, "RATE" end
	b.tokens -= 1
	if not SCHEMA[name](args) then return false, "SCHEMA" end
	return true, args
end

function Commands.forget(player) buckets[player] = nil end

return Commands
