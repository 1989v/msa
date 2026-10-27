--!nonstrict
-- 캠페인 저장. 키는 호스트 userId 하나. 저장소는 함수 주입(update(key, transform)) 이라 테스트가 메모리로 바꿔 낀다.
-- 로드 결과 넷: none / ok / mismatch / fail. 불일치·실패 기록은 보존하고 새 원정은 overwrite 를 받아야 덮는다.
-- UpdateAsync 변환 안에서 기존 savedTick 이 더 크면 nil 을 돌려 쓰기를 포기한다.
local Save = {}
Save.VERSION = 1
Save.MAP_VERSION = "bowl-1"

function Save.new(update, encode, decode, now)
	return setmetatable({ update = update, encode = encode, decode = decode, now = now, loaded = {}, saving = {} }, { __index = Save })
end

local function keyOf(userId) return "ArcherCommand_v1/" .. tostring(userId) end

function Save:load(userId)
	local key = keyOf(userId)
	local ok, raw = pcall(self.update, key, function(old) return old end)
	if not ok then return { status = "fail", message = "저장소를 읽지 못했습니다." } end
	if raw == nil then self.loaded[key] = { status = "none" }; return { status = "none" } end
	if type(raw) ~= "table" or raw.version ~= Save.VERSION or type(raw.snapshot) ~= "string" then return { status = "mismatch", message = "저장 형식이 다릅니다. 기록은 보존합니다." } end
	if raw.mapVersion ~= Save.MAP_VERSION then return { status = "mismatch", message = "다른 지도 판의 기록입니다. 기록은 보존하고 새 원정만 시작할 수 있습니다.", record = raw } end
	local okDecode, snapshot = pcall(self.decode, raw.snapshot)
	if not okDecode or type(snapshot) ~= "table" then return { status = "mismatch", message = "기록을 해석하지 못했습니다.", record = raw } end
	self.loaded[key] = { status = "ok", savedTick = raw.savedTick, campaignId = raw.campaignId }
	return { status = "ok", snapshot = snapshot, savedTick = raw.savedTick, campaignId = raw.campaignId, savedAt = raw.savedAt }
end

-- 새 원정 확정 (overwrite 가 참이어야 mismatch 기록을 덮는다)
function Save:beginNew(userId, campaignId, overwrite)
	local key = keyOf(userId)
	local state = self.loaded[key]
	if (state == nil or state.status ~= "none") and not overwrite then return false, "기존 기록을 덮어쓰려면 확인이 필요합니다." end
	self.loaded[key] = { status = "ok", savedTick = -1, campaignId = campaignId }
	return true
end

function Save:resume(userId, campaignId, savedTick)
	self.loaded[keyOf(userId)] = { status = "ok", savedTick = savedTick, campaignId = campaignId }
end

function Save:canSave(userId)
	local st = self.loaded[keyOf(userId)]
	return st ~= nil and st.status == "ok"
end

-- snapshot: Sim.snapshot 결과(순수 테이블). 직렬화는 변환 밖에서 한다(변환 안에서 yield 금지).
function Save:save(userId, snapshot, campaignId)
	local key = keyOf(userId)
	if not self:canSave(userId) then return false, "로드 전에는 저장하지 않습니다." end
	if self.saving[key] then return false, "저장 중" end
	self.saving[key] = true
	local text = self.encode(snapshot)
	local record = { version = Save.VERSION, mapVersion = Save.MAP_VERSION, campaignId = campaignId, savedTick = snapshot.tick, savedAt = self.now(), snapshot = text }
	local ok, result = pcall(self.update, key, function(old)
		if type(old) == "table" and old.campaignId == campaignId and type(old.savedTick) == "number" and old.savedTick > record.savedTick then return nil end
		return record
	end)
	self.saving[key] = nil
	if not ok then return false, "저장 실패" end
	if result == nil then return false, "더 새로운 기록이 있어 저장하지 않았습니다." end
	self.loaded[key].savedTick = record.savedTick
	return true
end

return Save
