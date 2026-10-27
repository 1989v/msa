--!strict
-- 캠페인 생성 규칙 (원작 campaign.js). 사냥터·길 위 무리·거점·전초기지·웨이브를 대기열에 넣고 틱마다 방출한다.
-- Roblox API 없음. Sim 상태 테이블만 다룬다.
local Grid = require("./Grid")
local Balance = require("./Balance")

local Campaign = {}

local function dist(a: { x: number, z: number }, b: { x: number, z: number }): number
	return math.sqrt((a.x - b.x) ^ 2 + (a.z - b.z) ^ 2)
end

local function random(s): number
	s.rng = (s.rng * 1664525 + 1013904223) % 4294967296
	return s.rng / 4294967296
end
Campaign.random = random

-- 결정적 잡음 (campaign.js noise): 시드와 색인으로 0~1
-- 32비트 곱 (JS Math.imul). 두 값이 2^32 에 가까우면 배정도 곱이 2^53 을 넘으므로 16비트로 나눠 곱한다.
local function imul(a: number, b: number): number
	a %= 4294967296; b %= 4294967296
	local ah, al = a // 65536, a % 65536
	local bh, bl = b // 65536, b % 65536
	return (al * bl + ((ah * bl + al * bh) % 65536) * 65536) % 4294967296
end
local function noise(seed: number, index: number): number
	local x = bit32.bxor(seed, imul(index + 1, 0x9e3779b1))
	x = imul(bit32.bxor(x, bit32.rshift(x, 16)), 0x85ebca6b)
	x = imul(bit32.bxor(x, bit32.rshift(x, 13)), 0xc2b2ae35)
	return bit32.bxor(x, bit32.rshift(x, 16)) / 4294967296
end
Campaign.noise = noise

local function emit(s, kind: string, detail: { [string]: any }?)
	if #s.events < 128 then
		local e = detail or {}
		e.type = kind; e.tick = s.tick
		table.insert(s.events, e)
	end
end
Campaign.emit = emit

local function enqueue(s, request): boolean
	local q = s.campaign.spawnQueue
	if #q >= Balance.LIMITS.queue then
		if not request.required then return false end
		local index = nil
		for i, r in q do if not r.required then index = i; break end end
		if not index then return false end
		table.remove(q, index)
	end
	request.id = s.campaign.nextSpawnId; s.campaign.nextSpawnId += 1
	request.cursor = 0
	if request.required then table.insert(q, 1, request) else table.insert(q, request) end
	return true
end

function Campaign.openingWaveActive(s): boolean
	if not s.campaign.outpostSpawned then return true end
	for _, e in s.enemies do if e.outpost and e.hp > 0 then return true end end
	for _, q in s.campaign.spawnQueue do if q.outpost then return true end end
	return false
end

function Campaign.waveReleaseRemaining(s): number
	local n = 0
	for _, q in s.campaign.spawnQueue do if q.source == "wave" then n += #q.kinds - q.cursor end end
	return n
end

function Campaign.init(s, terrain)
	s.campaign = { initialized = true, spawnQueue = {}, nextSpawnId = 1, nextHunt = 12, outpostSpawned = false, towersSpawned = false, fieldPacks = {} }
	local camp = Grid.SITES.camp
	local hp = Balance.CAMP.hp * (if s.mode == "coop" then Balance.COOP.enemyHp else 1)
	s.camp = { id = "C1", label = "북쪽 감시 고지", kind = "camp", x = camp.x, z = camp.z, hp = hp, maxHp = hp, cleared = false, rewardPaid = false, ambushPending = false, nextRegen = 20, cooldown = 0, reward = Balance.CAMP.reward, contributors = {} }
	enqueue(s, { source = "initial", required = true, kinds = table.clone(Balance.CAMP.composition), x = camp.x, z = camp.z, campId = "C1" })
	-- 원작: 본진 900px 안의 사냥터·무리 요청은 정규 웨이브 입구로 옮겨진다. 사냥터 F 가 그렇다.
	local hunt = Grid.SITES.wave_entry
	enqueue(s, { source = "hunt", required = false, kinds = { "zombie", "zombie", "zombie" }, x = hunt.x, z = hunt.z, hunt = true })
	for _, id in Grid.PACKS do
		local p = Grid.SITES[id]
		table.insert(s.campaign.fieldPacks, { id = id, x = p.x, z = p.z, nextRegen = 45 })
		enqueue(s, { source = "field", required = false, kinds = table.clone(Balance.FIELD_PACK.kinds), x = p.x, z = p.z, fieldPackId = id })
	end
end

local function garrisonPoint(s, terrain, request): Grid.Point?
	local center = Grid.cellAt(request)
	if not center then return nil end
	local ccol, crow = Grid.colRow(center)
	for ring = 2, 24 do
		for dz = -ring, ring do
			for dx = -ring, ring do
				if math.max(math.abs(dx), math.abs(dz)) == ring then
					local col, row = ccol + dx, crow + dz
					if col >= 0 and row >= 0 and col < Grid.COLS and row < Grid.ROWS then
						local i = row * Grid.COLS + col + 1
						local p = Grid.cellCenter(i)
						if terrain.blocked[i] == 0 and terrain.elevation[i] == terrain.elevation[center] and dist(p, Grid.SITES.base) >= 100 then
							local occupied = false
							for _, e in s.enemies do if e.hp > 0 and e.campId == request.campId and dist(e, p) < 3.5 then occupied = true; break end end
							if not occupied then return p end
						end
					end
				end
			end
		end
	end
	return nil
end

local function processionPoint(s, terrain, request): (Grid.Point?, boolean)
	local base = Grid.SITES.base
	local dirx, dirz = base.x - request.x, base.z - request.z
	local length = math.sqrt(dirx * dirx + dirz * dirz)
	if length == 0 then length = 1 end
	local minimum = if request.openingWave then 80 else 100
	for attempt = 0, 6 do
		local lateral = if attempt == 6 then 0 else (noise(request.paceSeed, request.cursor * 17 + attempt * 2) - 0.5) * Balance.WAVE.lateralSpread
		local forward = if attempt == 6 then 0 else (noise(request.paceSeed, request.cursor * 17 + attempt * 2 + 1) - 0.5) * Balance.WAVE.forwardSpread
		local p = { x = request.x + dirx / length * forward - dirz / length * lateral, z = request.z + dirz / length * forward + dirx / length * lateral }
		if Grid.isWalkable(terrain, p) and Grid.canTraverse(terrain, request, p) and dist(p, base) >= minimum then
			for _, e in s.enemies do if e.hp > 0 and e.wave and dist(e, p) < 4 then return nil, true end end
			return p, false
		end
	end
	return nil, false
end

local function spawnPoint(terrain, request, index: number): Grid.Point?
	local base = Grid.SITES.base
	local minimum = if request.openingWave then 80 else 100
	if request.siteId and Grid.isWalkable(terrain, request) then return { x = request.x, z = request.z } end
	local angle = index * 2.39996
	local radius = 4 + (index % 4) * 3
	local p = { x = request.x + math.cos(angle) * radius, z = request.z + math.sin(angle) * radius }
	if dist(p, base) >= minimum and Grid.isWalkable(terrain, p) and Grid.findPath(terrain, request, p, 256).status == "found" then return p end
	local center = Grid.cellAt(request)
	if not center then return nil end
	local ccol, crow = Grid.colRow(center)
	for ring = 1, 8 do
		for dx = -ring, ring do
			for _, dz in { -ring, ring } do
				local col, row = ccol + dx, crow + dz
				if col >= 0 and row >= 0 and col < Grid.COLS and row < Grid.ROWS then
					local i = row * Grid.COLS + col + 1
					local q = Grid.cellCenter(i)
					if dist(q, base) >= minimum and terrain.blocked[i] == 0 and terrain.elevation[i] == terrain.elevation[center] and Grid.findPath(terrain, request, q, 256).status == "found" then return q end
				end
			end
		end
	end
	return nil
end

local function countField(s, predicate): number
	local n = 0
	for _, e in s.enemies do if predicate(e) then n += 1 end end
	return n
end

function Campaign.advance(s, terrain)
	local c = s.campaign
	-- 전초기지 탑 + 파수꾼 (1회)
	if not c.outpostSpawned then
		local t, g = Grid.SITES.outpost_tower, Grid.SITES.outpost_guard
		local okTower = enqueue(s, { source = "outpost", required = true, kinds = { "enemy_tower" }, x = t.x, z = t.z, siteId = "outpost_tower", outpost = true })
		local okGuard = enqueue(s, { source = "outpost", required = true, kinds = { "vampire" }, x = g.x, z = g.z, siteId = "outpost_guard", outpost = true, guard = true })
		if okTower and okGuard then c.outpostSpawned = true end
	end
	-- 고지 가시 첨탑 2기 (1회)
	if not c.towersSpawned then
		local ok = true
		for _, id in { "thorn_west", "thorn_east" } do
			local p = Grid.SITES[id]
			ok = enqueue(s, { source = "enemy_tower", required = true, kinds = { "enemy_tower" }, x = p.x, z = p.z, siteId = id }) and ok
		end
		if ok then c.towersSpawned = true end
	end
	-- 길 위 무리 보충
	for _, pack in c.fieldPacks do
		if s.time >= pack.nextRegen then
			local count = countField(s, function(e) return e.fieldPackId == pack.id and e.hp > 0 end)
			local queued = false
			for _, r in c.spawnQueue do if r.fieldPackId == pack.id then queued = true; break end end
			if count < Balance.FIELD_PACK.keep and not queued then
				local kinds = {}
				for i = 1, math.min(Balance.FIELD_PACK.perRefill, Balance.FIELD_PACK.keep - count) do table.insert(kinds, Balance.FIELD_PACK.kinds[i]) end
				enqueue(s, { source = "field", required = false, kinds = kinds, x = pack.x, z = pack.z, fieldPackId = pack.id })
			end
			pack.nextRegen = s.time + Balance.FIELD_PACK.regen
		end
	end
	-- 사냥터 보충
	if s.time >= c.nextHunt then
		local alive = countField(s, function(e) return e.hunt and e.hp > 0 end)
		local queued = false
		for _, r in c.spawnQueue do if r.hunt then queued = true; break end end
		if alive < Balance.HUNT.keep and not queued then
			local kinds = {}
			for _ = 1, math.min(Balance.HUNT.perRefill, Balance.HUNT.keep - alive) do table.insert(kinds, "zombie") end
			local h = Grid.SITES.wave_entry
			enqueue(s, { source = "hunt", required = false, kinds = kinds, x = h.x, z = h.z, hunt = true })
		end
		c.nextHunt = s.time + Balance.HUNT.every
	end
	-- 거점 보충·역습
	local camp = s.camp
	if not camp.cleared and s.time >= camp.nextRegen then
		local existing = countField(s, function(e) return e.campId == "C1" and e.hp > 0 end)
		local cap = #Balance.CAMP.composition
		local queued = false
		for _, r in c.spawnQueue do if r.campId == "C1" then queued = true; break end end
		if existing < cap and not queued then
			local kinds = {}
			for i = existing + 1, cap do table.insert(kinds, Balance.CAMP.composition[i]) end
			enqueue(s, { source = "regen", required = false, kinds = kinds, x = camp.x, z = camp.z, campId = "C1" })
		end
		camp.nextRegen = s.time + Balance.CAMP.regen
	end
	if camp.ambushPending then
		local cleared = if camp.cleared then 1 else 0
		local kinds = Balance.waveComposition(s.wave.number, s.time, cleared, Balance.CAMP.ambush)
		if enqueue(s, { source = "ambush", required = true, kinds = kinds, x = camp.x, z = camp.z - 15, wave = true }) then camp.ambushPending = false end
	end
	-- 웨이브
	local waveQueued = false
	for _, q in c.spawnQueue do if q.source == "wave" then waveQueued = true; break end end
	if s.time >= s.wave.next and not waveQueued then
		local scouts = s.time < Balance.WAVE.scoutUntil
		local opening = Campaign.openingWaveActive(s)
		local point = if opening then Grid.SITES.outpost_entry else Grid.SITES.wave_entry
		local count = Balance.waveCount(s.wave.number, s.time, s.mode == "coop")
		local cleared = if camp.cleared then 1 else 0
		local kinds = Balance.waveComposition(s.wave.number, s.time, cleared, count)
		if enqueue(s, { source = "wave", required = true, kinds = kinds, x = point.x, z = point.z, wave = true, scout = scouts, openingWave = opening, procession = true, paceSeed = s.rng, nextRelease = s.time }) then
			s.wave.number += 1
			s.wave.next = s.time + (if scouts then Balance.WAVE.scoutGap else Balance.WAVE.lateGap)
			emit(s, "wave", { number = s.wave.number, count = count, x = point.x, z = point.z })
		end
	end
	for _, q in c.spawnQueue do
		if q.source == "wave" then
			if q.paceSeed == nil then q.paceSeed = s.rng end
			if q.burstRemaining == nil then q.burstRemaining = Balance.WAVE.burstMin + math.floor(noise(q.paceSeed, q.cursor + 401) * 3) end
		end
	end
	local oldestWave = nil
	for _, q in c.spawnQueue do if q.source == "wave" and (oldestWave == nil or q.id < oldestWave.id) then oldestWave = q end end
	-- 방출: 거점 요청 먼저, 그다음 나머지 (틱당 16)
	local requests = table.clone(c.spawnQueue)
	table.sort(requests, function(a, b)
		local ca, cb = if a.campId then 1 else 0, if b.campId then 1 else 0
		if ca ~= cb then return ca > cb end
		return a.id < b.id
	end)
	local spawned = 0
	local coop = s.mode == "coop"
	for _, request in requests do
		if request.source == "wave" and (request ~= oldestWave or s.time + 1e-10 < (request.nextRelease or s.time)) then continue end
		while request.cursor < #request.kinds and (request.campId or spawned < Balance.LIMITS.perTickSpawn) do
			local waveAlive = countField(s, function(e) return e.wave and not e.campId end)
			local ambientAlive = countField(s, function(e) return not e.wave and not e.campId and not e.outpost end)
			local outpostAlive = countField(s, function(e) return e.outpost end)
			local campAlive = countField(s, function(e) return e.campId ~= nil end)
			local allowed
			if request.campId then allowed = campAlive < Balance.LIMITS.campField
			elseif request.outpost then allowed = outpostAlive < Balance.LIMITS.outpostField
			elseif request.wave then allowed = waveAlive < Balance.LIMITS.waveField
			else allowed = ambientAlive < Balance.LIMITS.ambientField end
			if not allowed then break end
			local point: Grid.Point?
			local waiting = false
			if request.campId then point = garrisonPoint(s, terrain, request)
			elseif request.procession then point, waiting = processionPoint(s, terrain, request)
			else point = spawnPoint(terrain, request, request.cursor) end
			if not point then
				-- 행렬은 자리 차면 기다리고, 자리 자체가 없으면 그 자리 건너뛴다
				if request.procession and not waiting then request.cursor += 1 end
				break
			end
			local kind = request.kinds[request.cursor + 1]
			local def = Balance.ENEMIES[kind]
			local hp = if request.scout then Balance.SCOUT_HP elseif request.guard then Balance.GUARD.hp else def.hp
			hp *= (if coop then Balance.COOP.enemyHp else 1)
			local enemy = { id = s.nextId, kind = kind, x = point.x, z = point.z, homeX = if request.campId then point.x else request.x, homeZ = if request.campId then point.z else request.z,
				hp = hp, maxHp = hp, cooldown = random(s) * 0.3, abilityCooldown = 8, contributors = {}, lastDamageOwnerId = nil,
				campId = request.campId, outpost = request.outpost or nil, guard = request.guard or nil, fieldPackId = request.fieldPackId, siteId = request.siteId,
				hunt = request.hunt or nil, wave = request.wave or nil, scout = request.scout or nil, spawnReadyAt = if request.source == "regen" then s.time + 0.9 else nil }
			if request.guard then enemy.guardState = "guarding" end
			s.nextId += 1
			table.insert(s.enemies, enemy)
			request.cursor += 1
			if not request.campId then spawned += 1 end
			if request.procession then
				request.burstRemaining -= 1
				local ended = request.burstRemaining == 0
				request.nextRelease = s.time + (if ended then Balance.WAVE.betweenMin + Balance.WAVE.betweenSpan * noise(request.paceSeed, request.cursor + 701) else Balance.WAVE.insideMin + Balance.WAVE.insideSpan * noise(request.paceSeed, request.cursor + 901))
				if ended then request.burstRemaining = Balance.WAVE.burstMin + math.floor(noise(request.paceSeed, request.cursor + 401) * 3) end
				break
			end
		end
		if request.cursor >= #request.kinds then
			for i, r in c.spawnQueue do if r.id == request.id then table.remove(c.spawnQueue, i); break end end
			if request.source == "wave" then s.wave.next = s.time + (if request.scout then Balance.WAVE.scoutGap else Balance.WAVE.lateGap) end
		end
	end
end

-- 거점 파괴 → 보상 분배·역습 예약 (원작 resolveCampaign)
function Campaign.resolve(s)
	local camp = s.camp
	if camp.hp <= 0 and not camp.cleared then
		camp.hp = 0; camp.cleared = true; camp.ambushPending = true
		local q = s.campaign.spawnQueue
		for i = #q, 1, -1 do if q[i].campId == "C1" then table.remove(q, i) end end
		if not camp.rewardPaid then
			camp.rewardPaid = true
			local total = math.floor(camp.reward * (if s.mode == "coop" then Balance.COOP.reward else 1))
			local n = #s.owners
			for i, o in s.owners do
				local amount = total // n + (if i - 1 < total % n then 1 else 0)
				o.gold += amount
				emit(s, "income", { ownerId = o.id, source = "camp", amount = amount, campId = "C1" })
			end
		end
		emit(s, "campCleared", { campId = "C1", label = camp.label })
	end
end

return Campaign
