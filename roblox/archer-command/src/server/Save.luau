--!nonstrict
-- 호스트 계정 키 하나에 UpdateAsync 로 저장한다. Studio 에서 DataStore 가 막혀 있으면 서버 메모리에만 둔다.
local DataStoreService = game:GetService("DataStoreService")
local RunService = game:GetService("RunService")
local Shared = game:GetService("ReplicatedStorage"):WaitForChild("ArcherCommand")
local Config = require(Shared.Config)
local Rules = require(Shared.Rules)

local Save = {}
local memory = {}
local store = nil
local function getStore()
	if store == nil then
		local ok, s = pcall(function() return DataStoreService:GetDataStore(Config.SAVE.storeName) end)
		store = ok and s or false
	end
	return store
end
local function key(userId) return "host_" .. tostring(userId) end

-- 결과: "none" 저장 없음 · "ok" · "fail" (실패는 새 게임으로 덮어쓰지 않도록 호출자가 구분한다)
function Save.load(userId)
	local s = getStore()
	if s then
		local ok, data = pcall(function() return s:GetAsync(key(userId)) end)
		if ok then
			if data == nil then return "none", nil end
			local eco = Rules.sanitizeSave(data.economy)
			if not eco then return "fail", nil end
			return "ok", { economy = eco, wave = math.max(0, math.floor(tonumber(data.wave) or 0)), savedTick = tonumber(data.savedTick) or 0, towers = tonumber(data.towers) or 0 }
		end
		if not RunService:IsStudio() then return "fail", nil end
	end
	local m = memory[key(userId)]
	if not m then return "none", nil end
	return "ok", m
end

function Save.write(userId, snapshot)
	local s = getStore()
	local payload = { economy = snapshot.economy, wave = snapshot.wave, towers = snapshot.towers, savedTick = snapshot.savedTick }
	if s then
		local ok, err = pcall(function()
			s:UpdateAsync(key(userId), function(old)
				if type(old) == "table" and type(old.savedTick) == "number" and old.savedTick > payload.savedTick then return nil end
				return payload
			end)
		end)
		if ok then return true end
		if not RunService:IsStudio() then warn("[ArcherCommand] 저장 실패: " .. tostring(err)); return false end
	end
	memory[key(userId)] = payload
	return true
end

function Save.isMemoryOnly() return getStore() == false end

return Save
