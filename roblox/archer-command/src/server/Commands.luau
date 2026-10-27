--!nonstrict
-- 클라이언트 명령의 고정 스키마. 통과한 것만 Sim.act 에 간다. ownerId 는 여기서 붙이지 않는다(서버 세션이 붙인다).
-- 타입이 다르면 nil — 오류 응답으로 탐색 정보를 주지 않는다.
local Commands = {}

local function finite(v) return type(v) == "number" and v == v and v ~= math.huge and v ~= -math.huge end
local function int(v) return finite(v) and v == math.floor(v) and v >= 1 and v < 2 ^ 31 end
local function oneOf(v, list)
	if type(v) ~= "string" then return false end
	for _, x in list do if x == v then return true end end
	return false
end
local function intList(v, maxLen)
	if type(v) ~= "table" or #v == 0 or #v > maxLen then return nil end
	local out, seen = {}, {}
	for i = 1, #v do
		local id = v[i]
		if not int(id) or seen[id] then return nil end
		seen[id] = true; out[i] = id
	end
	return out
end

function Commands.normalize(payload)
	if type(payload) ~= "table" or type(payload.type) ~= "string" then return nil end
	local t = payload.type
	if t == "hire" then
		if not oneOf(payload.kind, { "archer", "longbow", "carpenter" }) then return nil end
		return { type = "hire", kind = payload.kind }
	elseif t == "upgrade" then
		if not oneOf(payload.stat, { "attack", "armor" }) or (payload.count ~= 1 and payload.count ~= 10) then return nil end
		return { type = "upgrade", stat = payload.stat, count = payload.count }
	elseif t == "combine" then
		local ids = intList(payload.unitIds, 3)
		if not ids or #ids ~= 3 then return nil end
		return { type = "combine", unitIds = ids }
	elseif t == "garrison" then
		local ids = intList(payload.unitIds, 24)
		if not ids or not int(payload.towerId) then return nil end
		return { type = "garrison", unitIds = ids, towerId = payload.towerId }
	elseif t == "ungarrison" then
		local ids = intList(payload.unitIds, 24)
		if not ids then return nil end
		return { type = "ungarrison", unitIds = ids }
	elseif t == "assign" then
		if not int(payload.unitId) or not oneOf(payload.job, { "wood", "mine", "repair", "idle" }) then return nil end
		local c = { type = "assign", unitId = payload.unitId, job = payload.job }
		if payload.job == "wood" or payload.job == "mine" then
			if not oneOf(payload.nodeId, { "wood_west", "wood_east", "ore_west", "ore_east" }) then return nil end
			c.nodeId = payload.nodeId
		elseif payload.job == "repair" then
			if not int(payload.towerId) then return nil end
			c.towerId = payload.towerId
		end
		return c
	elseif t == "build" then
		if not int(payload.workerId) or not finite(payload.x) or not finite(payload.z) then return nil end
		-- 서버가 셀로 내린다. 클라이언트 스냅은 표시용이다.
		return { type = "build", workerId = payload.workerId, x = math.floor(payload.x / 4) * 4, z = math.floor(payload.z / 4) * 4 }
	elseif t == "cancelBuild" then
		if not int(payload.towerId) then return nil end
		return { type = "cancelBuild", towerId = payload.towerId }
	elseif t == "heroSkill" then
		if not oneOf(payload.skill, { "multishot", "roll" }) or not finite(payload.dx) or not finite(payload.dz) then return nil end
		local length = if finite(payload.length) then math.clamp(payload.length, 0, 15) else 15
		return { type = "heroSkill", skill = payload.skill, dx = payload.dx, dz = payload.dz, length = length }
	end
	return nil
end

return Commands
