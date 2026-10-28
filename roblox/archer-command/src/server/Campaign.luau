--!nonstrict
-- 분지의 적 구성: 사냥터 보충 · 거점(언덕 위) 소탕과 역습 · 전초기지 · 본진 웨이브. 적 개체는 Npc 가 움직인다.
local Shared = game:GetService("ReplicatedStorage"):WaitForChild("ArcherCommand")
local Config = require(Shared.Config)
local Rules = require(Shared.Rules)
local Npc = require(script.Parent.Npc)

local Campaign = {}
local state
local SITES = Config.SITES
local random = Random.new(1989)

local function scatter(center, radius)
	local a = random:NextNumber(0, math.pi * 2)
	local r = random:NextNumber(1, radius)
	return center + Vector3.new(math.cos(a) * r, 0, math.sin(a) * r)
end

local function spawnGroup(composition, center, radius, role, group)
	for kind, n in composition do
		for _ = 1, n do Npc.spawnEnemy(kind, scatter(center, radius), role, group) end
	end
end

function Campaign.start(world)
	state = {
		time = 0, wave = 0, nextWave = Config.WAVES.firstAt, queue = {}, spawnTimer = 0,
		huntRespawn = 0, campCleared = false, campRespawn = 0, outpostCleared = false, gateOpen = false, notify = world.notify,
	}
	spawnGroup({ [Config.HUNT.kind] = Config.HUNT.count }, SITES.hunt, 6, "hunt", "hunt")
	spawnGroup(Config.CAMP.composition, SITES.camp, 9, "camp", "camp")
	Npc.spawnEnemy(Config.OUTPOST.guard, SITES.outpost_guard, "outpost", "outpost")
	Npc.spawnEnemy("plague", SITES.outpost_tower + Vector3.new(6, 0, 4), "outpost", "outpost")
	Npc.spawnEnemy("plague", SITES.outpost_tower + Vector3.new(-6, 0, 4), "outpost", "outpost")
	local tower = world.outpostTower
	if tower then Npc.registerStructure(tower, Config.OUTPOST.towerHealth, 4) end
	state.outpostTower = tower
end

function Campaign.structureDestroyed(model)
	if state and model == state.outpostTower then state.outpostTowerDown = true end
end

local function enqueueWave(n)
	local comp = Rules.waveComposition(n)
	for kind, count in comp do for _ = 1, count do table.insert(state.queue, kind) end end
	-- 섞어서 종류가 번갈아 나오게
	for i = #state.queue, 2, -1 do local j = random:NextInteger(1, i); state.queue[i], state.queue[j] = state.queue[j], state.queue[i] end
end

function Campaign.update(dt)
	if not state then return end
	state.time += dt
	local counts = Npc.counts()
	-- 사냥터: 한 마리씩 보충
	if Npc.aliveWithGroup("hunt") < Config.HUNT.count then
		state.huntRespawn += dt
		if state.huntRespawn >= Config.HUNT.respawnSeconds then
			state.huntRespawn = 0
			if counts.enemies < Config.LIMITS.enemies then Npc.spawnEnemy(Config.HUNT.kind, scatter(SITES.hunt, 6), "hunt", "hunt") end
		end
	else state.huntRespawn = 0 end
	-- 거점: 전멸 → 보상 + 역습 + 보충 타이머
	if not state.campCleared and Npc.aliveWithGroup("camp") == 0 then
		state.campCleared = true
		state.campRespawn = 0
		state.notify("gold", Config.CAMP.reward, "camp", SITES.camp)
		state.notify("toast", string.format("거점 소탕 · 금화 +%d · 역습이 온다", Config.CAMP.reward))
		for i = 1, Config.CAMP.counterattack do table.insert(state.queue, if i % 3 == 0 then "runner" else "zombie") end
		state.counterPending = Config.CAMP.counterattack
	elseif state.campCleared then
		state.campRespawn += dt
		if state.campRespawn >= Config.CAMP.respawnSeconds then
			state.campCleared = false
			spawnGroup(Config.CAMP.composition, SITES.camp, 9, "camp", "camp")
			state.notify("toast", "거점에 적이 다시 모였다")
		end
	end
	-- 전초기지: 거구와 탑 둘 다 → 문 열림(다음 단계)
	if not state.outpostCleared and state.outpostTowerDown and Npc.aliveWithGroup("outpost") == 0 then
		state.outpostCleared = true
		state.gateOpen = true
		state.notify("gold", Config.OUTPOST.reward, "outpost", SITES.outpost_tower)
		state.notify("toast", string.format("전초기지 함락 · 금화 +%d · 동쪽 원정로가 열렸다(다음 단계)", Config.OUTPOST.reward))
		state.notify("gate", true)
	end
	-- 웨이브
	state.nextWave -= dt
	if state.nextWave <= 0 then
		state.wave += 1
		state.nextWave = Config.WAVES.interval
		enqueueWave(state.wave)
		state.notify("wave", state.wave, Rules.waveTotal(state.wave))
		if (Rules.waveComposition(state.wave).brute or 0) > 0 then state.notify("boss", "거구 좀비가 온다 · 바위를 던진다, 거리를 벌려라") end
	end
	-- 대기열 방출: 상한 안에서 묶음 단위
	state.spawnTimer -= dt
	if #state.queue > 0 and state.spawnTimer <= 0 then
		state.spawnTimer = Config.WAVES.batchGap * random:NextNumber(0.5, 1.5)
		local released = 0
		while #state.queue > 0 and released < Config.WAVES.batch and Npc.counts().enemies < Config.LIMITS.enemies do
			local kind = table.remove(state.queue, 1)
			-- 입구를 매번 다르게 고르고 넓게 흩어 놓는다. 한 곳에서 같은 길로 오면 한 줄로 보인다.
			local entries = Config.WAVES.entries
			local role, origin, spread = "wave", entries[random:NextInteger(1, #entries)], Config.WAVES.spread
			if state.counterPending and state.counterPending > 0 then state.counterPending -= 1; role, origin, spread = "counter", SITES.camp, 8 end
			Npc.spawnEnemy(kind, scatter(origin, spread), role, role)
			released += 1
		end
	end
end

function Campaign.snapshot()
	if not state then return { wave = 0, nextWave = 0, queued = 0, camp = "none", outpost = "none", gate = false } end
	return {
		wave = state.wave, nextWave = math.max(0, math.floor(state.nextWave)), queued = #state.queue,
		camp = if state.campCleared then "cleared" else "held", outpost = if state.outpostCleared then "cleared" else "held", gate = state.gateOpen,
		time = math.floor(state.time),
	}
end

function Campaign.stop() state = nil end

return Campaign
