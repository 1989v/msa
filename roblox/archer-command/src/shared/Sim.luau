--!nonstrict
-- 시뮬레이션 (원작 marine-command/js/origin/sim.js 의 규칙을 Roblox 구성에 맞춰 다시 썼다).
-- 순수 Luau: Roblox API 를 쓰지 않는다. 서버가 틱마다 돌리고 클라이언트는 결과만 받는다.
-- Roblox 에서 바뀐 것: 소유자의 선두 활잡이(leader)는 플레이어 아바타가 움직이고, 나머지가 뒤따른다.
local Grid = require("./Grid")
local Balance = require("./Balance")
local Campaign = require("./Campaign")

local Sim = {}
local FIXED_DT = Balance.FIXED_DT
local UNITS, ENEMIES = Balance.UNITS, Balance.ENEMIES
local emit = Campaign.emit

local BASE_TERRAIN = Grid.create()
Sim.terrain = BASE_TERRAIN

local function dist(a, b): number return math.sqrt((a.x - b.x) ^ 2 + (a.z - b.z) ^ 2) end
local function alive(u): boolean return u.hp > 0 end
local function stationed(u): boolean return u.assignment == "garrison" or u.towerId ~= nil end
local function finite(v): boolean return type(v) == "number" and v == v and v ~= math.huge and v ~= -math.huge end
local function response(ok, code, message, extra)
	local r = extra or {}
	r.ok = ok; r.code = code; r.message = message
	return r
end
local function refuse(code, message) return response(false, code, message) end

local function ownerOf(s, id)
	for _, o in s.owners do if o.id == id then return o end end
	return nil
end
Sim.ownerOf = ownerOf

local function activeTower(t): boolean return t.state ~= "destroyed" and t.state ~= "cancelled" end
local function solidTower(t): boolean return activeTower(t) and t.started end

-- ── 캐시 (저장 상태 밖) ─────────────────────────────────────────────────────
local caches = setmetatable({}, { __mode = "k" })
local function cache(s)
	local c = caches[s]
	if not c then c = { paths = {}, budget = 2048, terrainKey = "", terrain = BASE_TERRAIN, flow = nil, flowRevision = -1 }; caches[s] = c end
	return c
end

local function terrainFor(s)
	local c = cache(s)
	local keys, rects = {}, {}
	for _, t in s.towers do if solidTower(t) then table.insert(keys, t.id); table.insert(rects, t.footprint) end end
	local key = table.concat(keys, ",")
	if c.terrainKey ~= key then c.terrainKey = key; c.terrain = Grid.withSolids(BASE_TERRAIN, rects); c.paths = {}; c.flow = nil end
	return c.terrain
end
Sim.terrainFor = terrainFor

local function flowFor(s, terrain)
	local c = cache(s)
	if not c.flow or c.flowRevision ~= terrain.revision then c.flow = Grid.baseFlow(terrain, s.base); c.flowRevision = terrain.revision end
	return c.flow
end

-- ── 생성 ───────────────────────────────────────────────────────────────────
local function makeUnit(s, ownerId, kind, position)
	local d = UNITS[kind]
	local u = { id = s.nextId, ownerId = ownerId, kind = kind, x = position.x, z = position.z, hp = d.hp, maxHp = d.hp,
		assignment = if kind == "carpenter" then "idle" else "follow", cooldown = 0, lastCombatTime = -1e9 }
	s.nextId += 1
	return u
end

function Sim.create(seed: number, mode: string?)
	local m = mode or "solo"
	local maxHp = Balance.BASE_HP[m]
	local s = { version = 1, time = 0, tick = 0, accumulator = 0, seed = seed, rng = seed % 4294967296, nextId = 1, phase = "playing", mode = m,
		owners = {}, units = {}, enemies = {}, towers = {}, base = { x = Grid.SITES.base.x, z = Grid.SITES.base.z, hp = maxHp, maxHp = maxHp, lastDamageTime = -1e9 },
		wave = { number = 0, next = Balance.WAVE.first }, events = {}, effects = {}, bullets = {} }
	Campaign.init(s, BASE_TERRAIN)
	return s
end

-- 소유자 추가. 두 번째 소유자가 들어오면 캠페인이 coop 이 된다 (본진 상한 6000, 이후 생성 적 ×1.5, 웨이브 ×1.4).
function Sim.addOwner(s, ownerId: number, name: string?)
	-- ownerId 는 슬롯 0/1 이다. userId 는 서버가 owner.userId 에 따로 적는다.
	if ownerOf(s, ownerId) then return ownerOf(s, ownerId) end
	if #s.owners >= 2 or (ownerId ~= 0 and ownerId ~= 1) then return nil end
	local o = { id = ownerId, name = name or ("원정대 " .. tostring(ownerId + 1)), gold = 0, upgrades = { attack = 0, armor = 0 }, leaderId = nil, leaderPos = nil, moving = false }
	table.insert(s.owners, o)
	local leader = makeUnit(s, ownerId, "archer", { x = s.base.x + ownerId * 1.5, z = s.base.z })
	leader.isLeader = true
	table.insert(s.units, leader)
	o.leaderId = leader.id
	if #s.owners == 2 and s.mode ~= "coop" then
		s.mode = "coop"
		local gained = Balance.BASE_HP.coop - s.base.maxHp
		s.base.maxHp = Balance.BASE_HP.coop; s.base.hp += gained
		emit(s, "coop", {})
	end
	emit(s, "ownerJoined", { ownerId = ownerId })
	return o
end

-- ── 조회 ───────────────────────────────────────────────────────────────────
function Sim.unitById(s, id)
	for _, u in s.units do if u.id == id then return u end end
	return nil
end
function Sim.enemyById(s, id)
	for _, e in s.enemies do if e.id == id then return e end end
	return nil
end
function Sim.towerById(s, id)
	for _, t in s.towers do if t.id == id then return t end end
	return nil
end
function Sim.leaderOf(s, ownerId)
	local o = ownerOf(s, ownerId)
	return if o and o.leaderId then Sim.unitById(s, o.leaderId) else nil
end

function Sim.enemyStats(enemy)
	local base = ENEMIES[enemy.kind]
	if not base then return nil end
	if enemy.guard then
		local d = table.clone(base)
		for k, v in Balance.GUARD do d[k] = v end
		d.label = "전초 파수꾼"
		return d
	end
	if enemy.scout then
		local d = table.clone(base); d.hp = Balance.SCOUT_HP; d.label = "정찰형 " .. base.label
		return d
	end
	return base
end

function Sim.unitStats(s, unit)
	local d, o = UNITS[unit.kind], ownerOf(s, unit.ownerId)
	local combat = unit.kind ~= "carpenter"
	local attackLevel = if combat then o.upgrades.attack else 0
	local armorLevel = if combat then o.upgrades.armor else 0
	local tower = if unit.towerId then Sim.towerById(s, unit.towerId) else nil
	local inTower = tower ~= nil and tower.state == "completed" and tower.hp > 0
	return { label = d.label, hp = unit.hp, maxHp = unit.maxHp, damage = d.damage + 2 * attackLevel, armor = d.armor + armorLevel,
		range = d.range + (if inTower and combat then Balance.TOWER.rangeBonus else 0), rate = Balance.fireInterval(d, attackLevel), speed = d.speed,
		attackLevel = attackLevel, armorLevel = armorLevel, baseDamage = d.damage, baseArmor = d.armor, garrison = inTower, penetration = d.penetration }
end

local function attackDamage(s, unit, target, multiplier)
	local d, o = UNITS[unit.kind], ownerOf(s, unit.ownerId)
	local armor = if target.kind == "camp" then 0 else (ENEMIES[target.kind] and ENEMIES[target.kind].armor or 0)
	return Balance.damage(d, o.upgrades.attack, armor, multiplier)
end
Sim.attackDamage = attackDamage

function Sim.combatComparison(s, enemy, unit)
	local d, o, base = Sim.enemyStats(enemy), ownerOf(s, unit.ownerId), UNITS[unit.kind]
	local armor = base.armor + o.upgrades.armor
	local received = math.max(1, d.damage - armor)
	local dealt = attackDamage(s, unit, enemy)
	local armorTarget = math.max(0, math.ceil(d.damage - base.armor - 1))
	local extra = math.max(0, armorTarget - o.upgrades.armor)
	local reachable = armorTarget <= Balance.UPGRADE_LIMITS.armor
	return { received = received, dealt = dealt, hits = math.ceil(enemy.hp / dealt), armorTarget = armorTarget, extra = extra, reachable = reachable,
		cost = if reachable then (if extra > 0 then Balance.upgradeCost("armor", o.upgrades.armor, extra) else 0) else nil }
end

function Sim.price(s, ownerId, item, count)
	local o = ownerOf(s, ownerId)
	count = count or 1
	if not o or (count ~= 1 and count ~= 10) then return nil end
	if item == "archer" or item == "longbow" or item == "carpenter" then return if count == 1 then UNITS[item].cost else nil end
	if item ~= "attack" and item ~= "armor" then return nil end
	return Balance.upgradeCost(item, o.upgrades[item], count)
end

function Sim.healingRate(s, unit)
	if not alive(unit) then return 0 end
	local base = 0
	if not stationed(unit) and dist(unit, s.base) <= Balance.HEAL.baseRadius then
		base = if s.time - unit.lastCombatTime > Balance.HEAL.idleAfter then Balance.HEAL.idleRate else Balance.HEAL.combatRate
	end
	local healer = Grid.SITES.healer
	local h = if dist(unit, healer) <= Balance.HEAL.healerRadius then Balance.HEAL.healerRate else 0
	return math.max(base, h)
end

-- ── 이동 ───────────────────────────────────────────────────────────────────
local function moveToward(actor, point, speed)
	local d = dist(actor, point)
	if d == 0 then return end
	local f = math.min(1, speed * FIXED_DT / d)
	actor.x += (point.x - actor.x) * f; actor.z += (point.z - actor.z) * f
end

local function navigate(s, actor, destination, speed, terrain): boolean
	local c = cache(s)
	local key = actor.id
	if dist(actor, destination) <= Grid.CELL * 3 and Grid.straightClear(terrain, actor, destination) then
		c.paths[key] = nil; actor.pathBlocked = false
		moveToward(actor, destination, speed)
		return dist(actor, destination) < 0.25
	end
	local route = c.paths[key]
	local destCell = Grid.cellAt(destination)
	if not route or route.destCell ~= destCell or (route.path and #route.path == 0 and dist(actor, destination) >= 0.25) then
		route = { destCell = destCell, path = nil, retry = 0, search = nil }; c.paths[key] = route; actor.pathBlocked = false
	end
	if not route.path and s.time >= route.retry and c.budget > 0 then
		-- 미완 탐색은 route 에 보존해 이어 찾는다. 보존은 4개까지 — 적이 자리를 다 차지해 동료·목수가 굶지 않게 적의 것을 비운다.
		if not route.search then
			local suspended = {}
			for id, r in c.paths do if r.search then table.insert(suspended, { id = id, r = r }) end end
			if #suspended >= 4 then
				local evicted = false
				local isUnit = Sim.unitById(s, key) ~= nil
				for _, e in suspended do if isUnit and Sim.enemyById(s, e.id) then e.r.search = nil; evicted = true; break end end
				if not evicted then return false end
			end
		end
		local result = Grid.findPath(terrain, actor, destination, math.min(256, c.budget), route.search)
		c.budget -= result.visited
		route.search = result.search
		if result.status == "found" then route.path = result.path
		elseif result.status ~= "budget" then route.retry = s.time + 1; route.search = nil; actor.pathBlocked = true end
	end
	if route.path then
		actor.pathBlocked = false
		while #route.path > 0 and dist(actor, route.path[1]) < 0.125 do table.remove(route.path, 1) end
		if #route.path > 0 then moveToward(actor, route.path[1], speed) end
		if dist(actor, destination) < 0.25 then actor.x = destination.x; actor.z = destination.z; return true end
	end
	return false
end

local function towerEntry(terrain, tower)
	local r = tower.footprint
	local cell = Grid.CELL
	local cx = (r.x + r.w / 2) // cell * cell + cell / 2
	local cz = (r.z + r.h / 2) // cell * cell + cell / 2
	local preferred = {
		{ x = r.x // cell * cell - cell / 2, z = cz }, { x = math.ceil((r.x + r.w) / cell) * cell + cell / 2, z = cz },
		{ x = cx, z = r.z // cell * cell - cell / 2 }, { x = cx, z = math.ceil((r.z + r.h) / cell) * cell + cell / 2 },
	}
	for _, p in preferred do if Grid.isWalkable(terrain, p) then return p end end
	return nil
end

local function ejectPosition(s, tower)
	local terrain = terrainFor(s)
	local walk = { blocked = table.clone(terrain.blocked), elevation = terrain.elevation, ramps = terrain.ramps, protected = terrain.protected, revision = terrain.revision }
	local r = tower.footprint
	for row = r.z // Grid.CELL, math.ceil((r.z + r.h) / Grid.CELL) - 1 do
		for col = r.x // Grid.CELL, math.ceil((r.x + r.w) / Grid.CELL) - 1 do
			local i = row * Grid.COLS + col + 1
			walk.blocked[i] = BASE_TERRAIN.blocked[i]
		end
	end
	local start = Grid.cellAt(tower)
	if not start then return nil end
	local queue, seen, head = { start }, { [start] = true }, 1
	while head <= #queue do
		local cur = queue[head]; head += 1
		local p = Grid.cellCenter(cur)
		local inside = p.x >= r.x and p.x < r.x + r.w and p.z >= r.z and p.z < r.z + r.h
		if Grid.isWalkable(terrain, p) and not inside then return p end
		local col, row = Grid.colRow(cur)
		for _, d in { { 0, -1 }, { -1, 0 }, { 1, 0 }, { 0, 1 } } do
			local c2, r2 = col + d[1], row + d[2]
			if c2 >= 0 and r2 >= 0 and c2 < Grid.COLS and r2 < Grid.ROWS then
				local n = r2 * Grid.COLS + c2 + 1
				if not seen[n] and Grid.adjacent(walk, cur, n) then seen[n] = true; table.insert(queue, n) end
			end
		end
	end
	return nil
end

-- ── 목수 ───────────────────────────────────────────────────────────────────
local function releaseJob(s, unit)
	local tower = if unit.buildTowerId then Sim.towerById(s, unit.buildTowerId) else nil
	if tower and activeTower(tower) and tower.state ~= "completed" and tower.builderId == unit.id then tower.builderId = nil; tower.state = "paused" end
	unit.buildTowerId = nil; unit.nodeId = nil; unit.work = 0
end
local function setJob(s, unit, job)
	releaseJob(s, unit)
	if (unit.cargo or 0) > 0 then unit.job = "return"; unit.nextJob = job
	else for k, v in job do unit[k] = v end; unit.nextJob = nil end
	unit.assignment = "work"
end

local function resourceNode(id)
	for _, n in Grid.RESOURCES do if n.id == id then return { id = n.id, kind = n.kind, x = Grid.SITES[n.id].x, z = Grid.SITES[n.id].z } end end
	return nil
end
Sim.resourceNode = resourceNode

local function workerTick(s, unit, terrain)
	if not unit.job or unit.job == "idle" then return end
	if unit.job == "return" or (unit.cargo or 0) > 0 then
		if navigate(s, unit, s.base, UNITS.carpenter.speed, terrain) then
			local o, amount = ownerOf(s, unit.ownerId), unit.cargo or 0
			o.gold += amount; unit.cargo = 0
			if amount > 0 then emit(s, "income", { ownerId = o.id, amount = amount, source = "harvest", unitId = unit.id }) end
			if unit.nextJob then for k, v in unit.nextJob do unit[k] = v end; unit.nextJob = nil
			elseif unit.job == "return" then unit.job = "idle" end
		end
		return
	end
	if unit.job == "wood" or unit.job == "mine" then
		local node = resourceNode(unit.nodeId)
		if not node then return end
		if navigate(s, unit, node, UNITS.carpenter.speed, terrain) then
			unit.work = (unit.work or 0) + FIXED_DT
			local need = if unit.job == "wood" then Balance.WORK.woodSeconds else Balance.WORK.oreSeconds
			if unit.work + 1e-9 >= need then unit.cargo = if unit.job == "wood" then Balance.WORK.woodCargo else Balance.WORK.oreCargo; unit.work = 0 end
		end
		return
	end
	local tower = Sim.towerById(s, unit.buildTowerId or unit.repairTowerId or -1)
	if not tower or not activeTower(tower) then unit.job = "idle"; return end
	local entry = towerEntry(terrain, tower)
	if not entry or not navigate(s, unit, entry, UNITS.carpenter.speed, terrain) then return end
	if unit.job == "build" and tower.builderId == unit.id and tower.state ~= "completed" then
		if not tower.started then tower.started = true; tower.hp = Balance.TOWER.startHp end
		tower.state = "building"
		local previous = tower.maxHp
		tower.progress = math.min(1, tower.progress + FIXED_DT / Balance.TOWER.buildSeconds)
		tower.maxHp = Balance.TOWER.startHp + Balance.TOWER.growHp * tower.progress
		tower.hp += tower.maxHp - previous
		if tower.progress > 1 - 1e-9 then
			tower.progress = 1; tower.hp += Balance.TOWER.maxHp - tower.maxHp; tower.maxHp = Balance.TOWER.maxHp
			tower.state = "completed"; tower.builderId = nil
			unit.job = "idle"; unit.buildTowerId = nil
			emit(s, "towerComplete", { towerId = tower.id })
		end
	elseif unit.job == "repair" and tower.state == "completed" then
		local o = ownerOf(s, unit.ownerId)
		local amount = math.min(Balance.TOWER.repairPerSecond * FIXED_DT, tower.maxHp - tower.hp, o.gold / Balance.TOWER.goldPerRepairHp)
		if amount > 0 then tower.hp += amount; o.gold = math.max(0, o.gold - amount * Balance.TOWER.goldPerRepairHp) end
	end
end

local function leaveTower(unit, tower, position)
	for i = #tower.occupants, 1, -1 do if tower.occupants[i] == unit.id then table.remove(tower.occupants, i) end end
	for i = #tower.reservations, 1, -1 do if tower.reservations[i] == unit.id then table.remove(tower.reservations, i) end end
	unit.x = position.x; unit.z = position.z
	unit.towerId = nil; unit.garrisonTarget = nil; unit.assignment = "follow"; unit.target = nil
end

local function towerTransitions(s)
	for _, tower in s.towers do
		local keepR, keepO = {}, {}
		for _, id in tower.reservations do local u = Sim.unitById(s, id); if u and alive(u) and u.garrisonTarget == tower.id then table.insert(keepR, id) end end
		for _, id in tower.occupants do local u = Sim.unitById(s, id); if u and alive(u) and u.towerId == tower.id then table.insert(keepO, id) end end
		tower.reservations, tower.occupants = keepR, keepO
		if activeTower(tower) and tower.started and tower.hp <= 0 then
			local position = ejectPosition(s, tower)
			if not position and #tower.occupants > 0 then continue end
			tower.state = "destroyed"; tower.hp = 0; tower.builderId = nil
			for _, unit in s.units do
				if unit.towerId == tower.id or unit.garrisonTarget == tower.id then
					local occupied = unit.towerId == tower.id
					if occupied then unit.hp *= (1 - Balance.TOWER.ejectLoss) end
					leaveTower(unit, tower, if occupied then position else { x = unit.x, z = unit.z })
				end
			end
			emit(s, "towerDestroyed", { towerId = tower.id })
		end
		if activeTower(tower) and tower.state ~= "completed" and tower.builderId then
			local b = Sim.unitById(s, tower.builderId)
			if not b or not alive(b) then tower.builderId = nil; tower.state = "paused" end
		end
	end
end

-- ── 전투 기록 ───────────────────────────────────────────────────────────────
local function recordShot(s, source, target, damage, friendly)
	source.lastShotTick = s.tick
	source.shotAngle = math.atan2(target.z - source.z, target.x - source.x)
	local actual = math.min(target.hp, math.max(1, damage))
	if friendly and target.guard then target.guardAttackerId = source.id end
	target.hp = math.max(0, target.hp - math.max(1, damage))
	if target == s.base then s.base.lastDamageTime = s.time; s.base.lastDamage = actual end
	if #s.bullets < 256 then table.insert(s.bullets, { x = source.x, z = source.z, tx = target.x, tz = target.z, life = 0.15, friendly = friendly }) end
	emit(s, "shot", { sourceId = source.id, targetId = target.id, damage = actual, friendly = friendly })
	return actual
end

local function awardKill(s, enemy)
	if enemy.rewarded then return end
	enemy.rewarded = true
	local d = Sim.enemyStats(enemy)
	if not d then return end
	local eligible = {}
	for _, o in s.owners do
		local t = enemy.contributors[o.id]
		if finite(t) and t >= s.time - Balance.CONTRIBUTION_WINDOW and t <= s.time then table.insert(eligible, o) end
	end
	if #eligible == 0 then local last = ownerOf(s, enemy.lastDamageOwnerId); if last then eligible = { last } end end
	table.sort(eligible, function(a, b) return a.id < b.id end)
	if #eligible > 0 then
		local total = math.floor(d.reward * (if s.mode == "coop" then Balance.COOP.reward else 1))
		local quotient, remainder = total // #eligible, total % #eligible
		for i, o in eligible do
			local amount = quotient + (if i - 1 < remainder then 1 else 0)
			o.gold += amount
			emit(s, "income", { ownerId = o.id, amount = amount, source = "kill", enemyId = enemy.id })
		end
	end
	emit(s, "kill", { enemyId = enemy.id, kind = enemy.kind, x = enemy.x, z = enemy.z })
end

local function telegraph(s, enemy, target): boolean
	if #s.effects >= 256 then return false end
	local spike = enemy.kind == "enemy_tower" or enemy.kind == "camp"
	local e = { id = s.nextId, type = "warning", attack = if spike then "spike" else nil, sourceId = enemy.id, x = target.x, z = target.z,
		radius = if spike then Balance.ENEMY_TOWER.radius else Balance.PLAGUE.radius,
		damage = if spike then Balance.ENEMY_TOWER.damage else Balance.PLAGUE.damage,
		life = if spike then Balance.ENEMY_TOWER.telegraph else Balance.PLAGUE.telegraph }
	s.nextId += 1
	table.insert(s.effects, e)
	return true
end

local function processEffects(s)
	for _, fx in s.effects do
		fx.life -= FIXED_DT
		if fx.type ~= "warning" or fx.life > 0 then continue end
		local targets = {}
		for _, u in s.units do if alive(u) and not stationed(u) then table.insert(targets, u) end end
		for _, t in s.towers do if solidTower(t) and t.hp > 0 then table.insert(targets, t) end end
		table.insert(targets, s.base)
		for _, target in targets do
			if dist(target, fx) > fx.radius then continue end
			local armor = 0
			if target.kind then
				local o = ownerOf(s, target.ownerId)
				armor = UNITS[target.kind].armor + (if target.kind == "carpenter" then 0 else o.upgrades.armor)
			elseif target.footprint then armor = Balance.TOWER.armor end
			local damage = math.min(target.hp, math.max(1, fx.damage - armor))
			target.hp = math.max(0, target.hp - damage); target.lastCombatTime = s.time
			if target == s.base then s.base.lastDamageTime = s.time; s.base.lastDamage = damage end
			emit(s, "hit", { targetId = target.id, x = target.x, z = target.z, damage = damage })
		end
		if fx.attack == "spike" then fx.type = "eruption"; fx.life = 0.38 end
	end
	local keep = {}
	for _, fx in s.effects do if fx.life > 0 then table.insert(keep, fx) end end
	s.effects = keep
end

-- ── 명령 ───────────────────────────────────────────────────────────────────
local function validId(id): boolean
	return type(id) == "number" and id == id and id ~= math.huge and id ~= -math.huge and id == math.floor(id) and id >= 1
end
local function ownedUnit(s, owner, id)
	if not validId(id) then return nil end
	local u = Sim.unitById(s, id)
	return if u and u.ownerId == owner.id and alive(u) then u else nil
end

local function eligibleHero(s, ownerId, skill)
	local best = nil
	for _, u in s.units do
		if u.ownerId == ownerId and alive(u) and u.kind == "hero_archer" and not stationed(u) and u.garrisonTarget == nil and not u.roll and (u[skill .. "ReadyTick"] or 0) <= s.tick then
			if not best or u.isLeader or (u.id < best.id and not best.isLeader) then best = u end
		end
	end
	return best
end
Sim.eligibleHero = eligibleHero

local function heroSkill(s, c, owner, terrain)
	if c.skill ~= "multishot" and c.skill ~= "roll" then return refuse("SKILL_UNAVAILABLE", "알 수 없는 스킬입니다.") end
	if not finite(c.dx) or not finite(c.dz) then return refuse("INVALID_TARGET", "스킬 방향이나 지점을 지정하세요.") end
	local u = eligibleHero(s, owner.id, c.skill)
	if not u then return refuse("SKILL_UNAVAILABLE", "내 영웅을 선택하세요 · 주둔/구르기/재사용 중에는 사용할 수 없습니다.") end
	local n = math.sqrt(c.dx * c.dx + c.dz * c.dz)
	if n < 0.001 then return refuse("INVALID_TARGET", "유효한 전장 지점을 지정하세요.") end
	local dx, dz = c.dx / n, c.dz / n
	if c.skill == "multishot" then
		local angle, d = math.atan2(dz, dx), UNITS.hero_archer
		local targets = {}
		local candidates = table.clone(s.enemies)
		if not s.camp.cleared then table.insert(candidates, s.camp) end
		for _, e in candidates do
			if alive(e) and dist(u, e) <= d.range then
				local a = math.atan2(e.z - u.z, e.x - u.x) - angle
				local wrapped = math.abs(math.atan2(math.sin(a), math.cos(a)))
				if wrapped <= math.rad(Balance.HERO.multishotAngle / 2) and Grid.hasLineOfSight(terrain, u, e) then table.insert(targets, e) end
			end
		end
		table.sort(targets, function(a, b)
			local da, db = dist(u, a), dist(u, b)
			if da ~= db then return da < db end
			return tostring(a.id) < tostring(b.id)
		end)
		if #targets == 0 then return refuse("NO_TARGET", "부채꼴 안에 보이는 적이 없습니다.") end
		for i = 1, math.min(Balance.HERO.multishotTargets, #targets) do
			local target = targets[i]
			local damage = attackDamage(s, u, target, Balance.HERO.multishotMultiplier)
			recordShot(s, u, target, damage, true)
			target.contributors[owner.id] = s.time; target.lastDamageOwnerId = owner.id
			if not alive(target) and target.kind ~= "camp" then awardKill(s, target) end
		end
		u.multishotReadyTick = s.tick + Balance.HERO.multishotCooldownTicks; u.lastCombatTime = s.time
	else
		local endPoint = { x = u.x, z = u.z }
		local length = math.min(Balance.HERO.rollMax, if finite(c.length) then math.max(0, c.length) else Balance.HERO.rollMax)
		local t = math.min(0.5, length)
		while t <= length + 0.001 do
			local p = { x = u.x + dx * t, z = u.z + dz * t }
			if not Grid.canTraverse(terrain, endPoint, p) then break end
			endPoint = p
			if t == length then break end
			t = math.min(length, t + 0.5)
		end
		if dist(u, endPoint) < Balance.HERO.rollMin then return refuse("ROLL_BLOCKED", "구르기 경로가 너무 짧습니다.") end
		u.roll = { x = u.x, z = u.z, tx = endPoint.x, tz = endPoint.z, step = 0 }
		u.rollReadyTick = s.tick + Balance.HERO.rollCooldownTicks
	end
	emit(s, "heroSkill", { unitId = u.id, skill = c.skill, ownerId = owner.id })
	return response(true, "OK", if c.skill == "roll" then "회피 구르기" else "다중 사격", { unitId = u.id })
end

local function unitIdsOf(s, owner, ids)
	if type(ids) ~= "table" or #ids == 0 or #ids > Balance.CAPS.fighters then return nil end
	local seen, units = {}, {}
	for _, id in ids do
		if not validId(id) or seen[id] then return nil end
		seen[id] = true
		local u = ownedUnit(s, owner, id)
		if not u then return nil end
		table.insert(units, u)
	end
	return units
end

function Sim.act(s, command)
	if not s or s.phase ~= "playing" then return refuse("ENDED", "원정이 종료되었습니다.") end
	if type(command) ~= "table" then return refuse("INVALID_COMMAND", "잘못된 명령입니다.") end
	local owner = ownerOf(s, command.ownerId)
	if not owner then return refuse("INVALID_OWNER", "유효한 소유자가 아닙니다.") end
	local terrain = terrainFor(s)
	local kind = command.type
	if kind == "heroSkill" then return heroSkill(s, command, owner, terrain) end
	if kind == "hire" then
		local cost = Sim.price(s, owner.id, command.kind)
		if (command.kind ~= "archer" and command.kind ~= "longbow" and command.kind ~= "carpenter") or cost == nil then return refuse("INVALID_KIND", "고용할 수 없는 병종입니다.") end
		local workers = command.kind == "carpenter"
		local count = 0
		for _, u in s.units do if u.ownerId == owner.id and alive(u) and (u.kind == "carpenter") == workers then count += 1 end end
		if count >= (if workers then Balance.CAPS.carpenters else Balance.CAPS.fighters) then return refuse("UNIT_CAP", if workers then "목수는 최대 8명입니다." else "전투 병력은 최대 24명입니다.") end
		if owner.gold < cost then return refuse("INSUFFICIENT_GOLD", "금화가 부족합니다.") end
		local unit = makeUnit(s, owner.id, command.kind, s.base)
		if workers then
			for _, n in Grid.RESOURCES do
				local used = 0
				for _, u in s.units do if u.nodeId == n.id and alive(u) then used += 1 end end
				if used < Balance.CAPS.nodeWorkers then
					unit.job = if n.kind == "wood" then "wood" else "mine"; unit.nodeId = n.id; unit.work = 0; unit.cargo = 0; unit.assignment = "work"
					break
				end
			end
		end
		owner.gold -= cost
		table.insert(s.units, unit)
		if not owner.leaderId and not workers then unit.isLeader = true; owner.leaderId = unit.id; emit(s, "leaderChanged", { ownerId = owner.id, unitId = unit.id }) end
		emit(s, "hire", { ownerId = owner.id, unitId = unit.id, kind = unit.kind, cost = cost })
		return response(true, "OK", UNITS[unit.kind].label .. " 고용 완료", { unitId = unit.id })
	end
	if kind == "upgrade" then
		local stat, count = command.stat, command.count or 1
		if (stat ~= "attack" and stat ~= "armor") or (count ~= 1 and count ~= 10) then return refuse("INVALID_UPGRADE", "강화 종류 또는 횟수가 잘못되었습니다.") end
		local cost = Sim.price(s, owner.id, stat, count)
		if cost == nil then return refuse("UPGRADE_CAP", "최대 강화 단계입니다.") end
		if owner.gold < cost then return refuse("INSUFFICIENT_GOLD", ("금화 %d가 필요합니다."):format(cost)) end
		local levels = math.min(count, Balance.UPGRADE_LIMITS[stat] - owner.upgrades[stat])
		owner.gold -= cost; owner.upgrades[stat] += levels
		emit(s, "upgrade", { ownerId = owner.id, stat = stat, levels = levels, cost = cost })
		return response(true, "OK", (if stat == "attack" then "공격" else "방어") .. " 강화 +" .. levels)
	end
	if kind == "combine" then
		local ids = command.unitIds
		if type(ids) ~= "table" or #ids ~= 3 then return refuse("INVALID_MATERIALS", "서로 다른 활잡이 3명을 선택하세요.") end
		local seen, units = {}, {}
		for _, id in ids do
			if not validId(id) or seen[id] then return refuse("INVALID_MATERIALS", "서로 다른 활잡이 3명을 선택하세요.") end
			seen[id] = true
			local u = ownedUnit(s, owner, id)
			if not u or u.kind ~= "archer" or stationed(u) or u.garrisonTarget then return refuse("INVALID_MATERIALS", "내 소유의 살아 있는 일반 활잡이만 합성할 수 있습니다. 주둔자는 제외됩니다.") end
			table.insert(units, u)
		end
		local first = units[1]
		for _, u in units do
			if u.assignment ~= first.assignment then return refuse("MATERIAL_GROUP", "같은 지역과 명령 그룹의 활잡이를 선택하세요.") end
			if u.isLeader then first = u end
		end
		local hero = makeUnit(s, owner.id, "hero_archer", first)
		local ratio = 0
		for _, u in units do ratio += u.hp / u.maxHp end
		hero.hp = hero.maxHp * ratio / 3
		hero.assignment = first.assignment
		hero.cooldown = 0; hero.lastCombatTime = -1e9
		for _, u in units do hero.cooldown = math.max(hero.cooldown, u.cooldown); hero.lastCombatTime = math.max(hero.lastCombatTime, u.lastCombatTime) end
		if first.isLeader then hero.isLeader = true; owner.leaderId = hero.id end
		local keep = {}
		for _, u in s.units do if not seen[u.id] then table.insert(keep, u) end end
		s.units = keep
		table.insert(s.units, hero)
		emit(s, "combine", { ownerId = owner.id, unitId = hero.id, consumedIds = table.clone(ids) })
		if hero.isLeader then emit(s, "leaderChanged", { ownerId = owner.id, unitId = hero.id }) end
		return response(true, "OK", "영웅 활잡이 합성 완료", { unitId = hero.id })
	end
	if kind == "assign" then
		local unit = ownedUnit(s, owner, command.unitId)
		local job = command.job
		if not unit or unit.kind ~= "carpenter" or (job ~= "wood" and job ~= "mine" and job ~= "repair" and job ~= "idle") then return refuse("INVALID_WORKER", "내 목수와 유효한 작업을 선택하세요.") end
		local next = { job = job, nodeId = nil, buildTowerId = nil, repairTowerId = nil, work = 0 }
		if job == "wood" or job == "mine" then
			local node = resourceNode(command.nodeId)
			if not node or node.kind ~= (if job == "wood" then "wood" else "ore") then return refuse("INVALID_NODE", "해당 지역의 자원을 선택하세요.") end
			local used = 0
			for _, u in s.units do if u.id ~= unit.id and alive(u) and (u.nodeId == node.id or (u.nextJob and u.nextJob.nodeId == node.id)) then used += 1 end end
			if used >= Balance.CAPS.nodeWorkers then return refuse("NODE_FULL", "이 자원에는 목수 3명까지만 배치할 수 있습니다.") end
			next.nodeId = node.id
		end
		if job == "repair" then
			local tower = Sim.towerById(s, command.towerId or -1)
			if not tower or tower.ownerId ~= owner.id or not activeTower(tower) then return refuse("INVALID_TOWER", "내 소유의 탑을 선택하세요.") end
			if tower.state ~= "completed" then
				if tower.builderId and tower.builderId ~= unit.id then return refuse("BUILDER_ASSIGNED", "이미 목수가 공사를 맡고 있습니다.") end
				next.job = "build"; next.buildTowerId = tower.id
			else next.repairTowerId = tower.id end
		end
		setJob(s, unit, next)
		if next.buildTowerId then Sim.towerById(s, next.buildTowerId).builderId = unit.id end
		return response(true, "OK", "목수의 임무를 변경했습니다.")
	end
	if kind == "build" then
		local worker = ownedUnit(s, owner, command.workerId)
		if not worker or worker.kind ~= "carpenter" then return refuse("INVALID_WORKER", "건설할 내 목수가 필요합니다.") end
		if not finite(command.x) or not finite(command.z) then return refuse("INVALID_POSITION", "건설 좌표가 잘못되었습니다.") end
		local active = 0
		for _, t in s.towers do if t.ownerId == owner.id and activeTower(t) then active += 1 end end
		if active >= Balance.CAPS.towers then return refuse("TOWER_CAP", "탑은 소유자당 최대 6개입니다.") end
		local size = Balance.TOWER.footprint
		-- 좌표는 셀로 내린다 (클라이언트 스냅은 표시용)
		local footprint = { x = math.floor(command.x / Grid.CELL) * Grid.CELL, z = math.floor(command.z / Grid.CELL) * Grid.CELL, w = size, h = size }
		local occupied = {}
		for _, t in s.towers do if activeTower(t) then table.insert(occupied, t.footprint) end end
		table.insert(occupied, { x = s.base.x - 12, z = s.base.z - 12, w = 24, h = 24 })
		for _, n in Grid.RESOURCES do local p = Grid.SITES[n.id]; table.insert(occupied, { x = p.x - 2, z = p.z - 2, w = 4, h = 4 }) end
		local ok, reason = Grid.canBuild(BASE_TERRAIN, footprint, occupied)
		if not ok then return refuse("BUILD_BLOCKED", "건설 불가: " .. tostring(reason)) end
		if owner.gold < Balance.TOWER.cost then return refuse("INSUFFICIENT_GOLD", "금화 220이 필요합니다.") end
		local tower = { id = s.nextId, ownerId = owner.id, x = footprint.x + size / 2, z = footprint.z + size / 2, footprint = footprint, state = "travelling", started = false, progress = 0, hp = 0, maxHp = Balance.TOWER.startHp, builderId = worker.id, occupants = {}, reservations = {} }
		s.nextId += 1
		owner.gold -= Balance.TOWER.cost
		table.insert(s.towers, tower)
		setJob(s, worker, { job = "build", buildTowerId = tower.id, nodeId = nil, repairTowerId = nil, work = 0 })
		emit(s, "build", { ownerId = owner.id, towerId = tower.id, cost = Balance.TOWER.cost })
		return response(true, "OK", "목수가 건설 현장으로 이동합니다.", { towerId = tower.id })
	end
	if kind == "cancelBuild" then
		local tower = Sim.towerById(s, command.towerId or -1)
		if not tower or tower.ownerId ~= owner.id or not activeTower(tower) or tower.state == "completed" then return refuse("INVALID_TOWER", "취소할 내 미완성 공사가 없습니다.") end
		local refund = math.floor(Balance.TOWER.cost * (1 - tower.progress) * Balance.TOWER.cancelRefund)
		tower.state = "cancelled"; tower.builderId = nil; owner.gold += refund
		for _, w in s.units do
			if w.buildTowerId == tower.id or (w.nextJob and w.nextJob.buildTowerId == tower.id) then setJob(s, w, { job = "idle", buildTowerId = nil, nodeId = nil, repairTowerId = nil, work = 0 }) end
		end
		emit(s, "cancelBuild", { towerId = tower.id, refund = refund })
		return response(true, "OK", ("공사 취소: %d금화 환급"):format(refund))
	end
	if kind == "recall" then
		-- Roblox 판: 플레이어가 직접 걷는다. 추종자를 본진으로 보내지 않고 안내만 한다.
		return response(true, "OK", "본진으로 돌아가세요.", { x = s.base.x, z = s.base.z })
	end
	if kind ~= "garrison" and kind ~= "ungarrison" then return refuse("UNKNOWN_COMMAND", "지원하지 않는 명령입니다.") end
	local units = unitIdsOf(s, owner, command.unitIds)
	if not units then return refuse("INVALID_UNITS", "병력을 선택하세요.") end
	for _, u in units do
		if u.roll or u.kind == "carpenter" then return refuse("INVALID_UNITS", "내 전투 병력만 명령할 수 있습니다.") end
		if u.isLeader then return refuse("LEADER", "선두 활잡이(내 캐릭터)는 주둔할 수 없습니다.") end
	end
	if kind == "garrison" then
		local tower = Sim.towerById(s, command.towerId or -1)
		if not tower or tower.ownerId ~= owner.id or tower.state ~= "completed" or tower.hp <= 0 then return refuse("INVALID_TOWER", "내 완성된 탑과 원정 병력을 선택하세요.") end
		for _, u in units do if stationed(u) or u.garrisonTarget then return refuse("INVALID_TOWER", "이미 주둔 중이거나 입장 중인 병력입니다.") end end
		if #tower.occupants + #tower.reservations + #units > Balance.CAPS.garrison then return refuse("GARRISON_FULL", "탑에는 최대 4명까지 주둔할 수 있습니다.") end
		for _, u in units do u.assignment = "entering"; u.garrisonTarget = tower.id; table.insert(tower.reservations, u.id) end
		return response(true, "OK", "병력이 탑으로 이동합니다.")
	end
	for _, u in units do if not stationed(u) and not u.garrisonTarget then return refuse("NOT_GARRISONED", "주둔 또는 입장 중인 병력을 선택하세요.") end end
	local exits = {}
	for _, u in units do
		local t = Sim.towerById(s, u.towerId or u.garrisonTarget)
		local p = if t then (if stationed(u) then ejectPosition(s, t) else { x = u.x, z = u.z }) else nil
		if not p then return refuse("NO_EXIT", "안전한 퇴각 위치가 없습니다.") end
		table.insert(exits, { u = u, t = t, p = p })
	end
	for _, e in exits do leaveTower(e.u, e.t, e.p) end
	return response(true, "OK", "주둔 병력이 철수했습니다.")
end

-- ── 선두 (플레이어 아바타) ──────────────────────────────────────────────────
-- 서버가 틱마다 캐릭터 위치를 넣는다. 한 틱에 걸을 수 있는 거리·통행 가능 여부를 검사해 어긋나면 되돌린다.
function Sim.setLeader(s, ownerId, x, z, moving)
	local o = ownerOf(s, ownerId)
	if not o then return end
	o.leaderPos = if finite(x) and finite(z) then { x = x, z = z } else nil
	o.moving = moving == true
end

local function applyLeader(s, owner, terrain)
	local leader = if owner.leaderId then Sim.unitById(s, owner.leaderId) else nil
	if not leader or not alive(leader) then return end
	if leader.roll then return end
	local p = owner.leaderPos
	if not p then return end
	local speed = Sim.squadSpeed(s, owner.id)
	local allowed = speed * FIXED_DT * 2 + 0.5
	local moved = dist(leader, p)
	local ok = moved <= allowed and Grid.isWalkable(terrain, p) and (moved < 0.01 or Grid.straightClear(terrain, leader, p))
	if ok then
		leader.x = p.x; leader.z = p.z
	else
		-- 너무 멀거나 지나갈 수 없는 자리: 시뮬레이션 자리로 되돌린다 (서버가 캐릭터를 옮긴다). 같은 표본을 다음 틱에 또 거부하지 않는다.
		owner.correction = { x = leader.x, z = leader.z }
		owner.leaderPos = nil
		emit(s, "correct", { ownerId = owner.id, x = leader.x, z = leader.z })
	end
	if owner.moving then
		for _, u in s.units do if u.ownerId == owner.id and u.assignment == "skillHold" then u.assignment = "follow" end end
	end
end

local function moveFollowers(s, owner, terrain)
	local leader = if owner.leaderId then Sim.unitById(s, owner.leaderId) else nil
	if not leader or not alive(leader) then return end
	local index = 0
	for _, unit in s.units do
		if unit.ownerId == owner.id and alive(unit) and not stationed(unit) and not unit.roll and unit.assignment == "follow" and not unit.isLeader then
			index += 1
			local angle = index * 2.399963
			local radius = math.min(Balance.SQUAD.slotRadiusMax, Balance.SQUAD.slotRadiusStep * math.sqrt(index))
			local slot = { x = leader.x + math.cos(angle) * radius, z = leader.z + math.sin(angle) * radius }
			local destination = if Grid.isWalkable(terrain, slot) and Grid.straightClear(terrain, leader, slot) then slot else { x = leader.x, z = leader.z }
			if dist(unit, destination) > Balance.SQUAD.followNear then navigate(s, unit, destination, UNITS[unit.kind].speed, terrain) end
		end
	end
end

-- 원정대 속도: 살아 있는 추종 전투 병력 중 최저 (원작 moveOwner). 서버가 WalkSpeed 로 쓴다.
function Sim.squadSpeed(s, ownerId)
	local speed = UNITS.archer.speed
	for _, u in s.units do
		if u.ownerId == ownerId and alive(u) and u.kind ~= "carpenter" and not stationed(u) and not u.garrisonTarget then speed = math.min(speed, UNITS[u.kind].speed) end
	end
	return speed
end

-- 리더가 죽으면 비주둔 전투 병력 ID 순, 없으면 주둔자를 철수시켜 승계. 자동 고용은 없다(원작에 없다) — 「리더 없음」.
local function ensureLeader(s, owner)
	local leader = if owner.leaderId then Sim.unitById(s, owner.leaderId) else nil
	if leader and alive(leader) then return end
	local candidate, stationedCandidate = nil, nil
	for _, u in s.units do
		if u.ownerId == owner.id and alive(u) and u.kind ~= "carpenter" then
			if not stationed(u) and not u.garrisonTarget then
				if not candidate or u.id < candidate.id then candidate = u end
			elseif not stationedCandidate or u.id < stationedCandidate.id then stationedCandidate = u end
		end
	end
	if not candidate and stationedCandidate then
		local u = stationedCandidate
		local t = Sim.towerById(s, u.towerId or u.garrisonTarget)
		local p = if t then (if stationed(u) then ejectPosition(s, t) else { x = u.x, z = u.z }) else { x = u.x, z = u.z }
		if t and p then leaveTower(u, t, p); candidate = u end
	end
	if candidate then
		candidate.isLeader = true; candidate.assignment = "follow"; owner.leaderId = candidate.id
		emit(s, "leaderChanged", { ownerId = owner.id, unitId = candidate.id, reason = "death" })
		return
	end
	if owner.leaderId ~= nil then
		owner.leaderId = nil
		emit(s, "leaderChanged", { ownerId = owner.id, unitId = nil, reason = "none" })
	end
end

-- ── 틱 ─────────────────────────────────────────────────────────────────────
local function enemyTargetFor(s, enemy, d, terrain)
	local target, nearest = nil, if enemy.guard then d.aggro else math.max(Balance.LEASH.aggro, d.range)
	local home = { x = enemy.homeX, z = enemy.homeZ }
	if not enemy.wave then
		for _, u in s.units do
			if alive(u) and not stationed(u) and (not enemy.guard or dist(u, home) <= d.leash) then
				local r = dist(u, enemy)
				if r <= nearest then nearest = r; target = u end
			end
		end
		for _, t in s.towers do
			if solidTower(t) and t.hp > 0 and (not enemy.guard or dist(t, home) <= d.leash) then
				local r = math.max(0, dist(t, enemy) - 6)
				if r <= nearest then nearest = r; target = t end
			end
		end
	end
	return target, nearest
end

local function waveTarget(s, enemy, d, terrain, budget)
	local radius = math.max(Balance.WAVE.targetKeep, d.range)
	local function reachable(t)
		local point = if t.footprint then towerEntry(terrain, t) else t
		if not point then return false end
		if d.flying or Grid.straightClear(terrain, enemy, point) then return true end
		if budget.remaining < 96 then return nil end
		local result = Grid.findPath(terrain, enemy, point, 96)
		budget.remaining -= result.visited
		if result.status == "budget" then return nil end
		return result.status == "found" and #result.path * Grid.CELL <= radius * 1.5
	end
	local previous = nil
	if enemy.waveTargetId then
		previous = Sim.unitById(s, enemy.waveTargetId) or Sim.towerById(s, enemy.waveTargetId)
		if previous and (previous.hp <= 0 or (previous.kind and stationed(previous)) or (previous.footprint and not solidTower(previous))) then previous = nil end
	end
	local function blocked(t) return t.id == enemy.waveBlockedId and s.tick < (enemy.waveRetryAt or 0) end
	if previous and dist(enemy, previous) <= radius + Balance.WAVE.targetKeepExtra and not blocked(previous) then
		if s.tick < (enemy.waveTargetUntil or 0) then return previous end
		local result = reachable(previous)
		if result ~= false then enemy.waveTargetUntil = s.tick + (if result == nil then 5 else Balance.WAVE.retryTicks); return previous end
		enemy.waveBlockedId = previous.id; enemy.waveRetryAt = s.tick + Balance.WAVE.retryTicks
	end
	local nearby = {}
	for _, u in s.units do if alive(u) and not stationed(u) and dist(enemy, u) <= radius and not blocked(u) then table.insert(nearby, u) end end
	for _, t in s.towers do if solidTower(t) and t.hp > 0 and dist(enemy, t) <= radius and not blocked(t) then table.insert(nearby, t) end end
	table.sort(nearby, function(a, b)
		local fa, fb = if a.footprint then 1 else 0, if b.footprint then 1 else 0
		if fa ~= fb then return fa < fb end
		local da, db = dist(enemy, a), dist(enemy, b)
		if da ~= db then return da < db end
		return a.id < b.id
	end)
	local target = s.base
	for _, t in nearby do if reachable(t) == true then target = t; break end end
	enemy.waveTargetId = if target == s.base then nil else target.id
	enemy.waveTargetUntil = s.tick + Balance.WAVE.retryTicks
	return target
end

-- 행렬 간격: 같은 웨이브 적끼리 4스터드 안으로 파고들지 않는다 (wave-ai.js processionGrid)
local function settle(s, enemy, previous): boolean
	for _, other in s.enemies do
		if other ~= enemy and other.wave and other.hp > 0 then
			local r = dist(enemy, other)
			if r < 4 - 1e-8 and r < dist(previous, other) - 1e-8 then enemy.x = previous.x; enemy.z = previous.z; return false end
		end
	end
	return true
end

local function processionWaypoint(s, flow, enemy)
	local point = Grid.flowWaypoint(flow, enemy, s.base)
	if not point or dist(enemy, s.base) < 20 then return point end
	local dx, dz = point.x - enemy.x, point.z - enemy.z
	local length = math.sqrt(dx * dx + dz * dz)
	if length == 0 then length = 1 end
	local seed = bit32.bxor((enemy.id * 0x45d9f3b) % 4294967296, ((enemy.homeX or 0) * 97) % 4294967296, ((enemy.homeZ or 0) * 53) % 4294967296)
	seed = (bit32.bxor(seed, bit32.rshift(seed, 16)) * 0x45d9f3b) % 4294967296
	local phase = seed / 4294967296 * math.pi * 2
	local sway = math.sin(s.time * 0.33 + phase) * 4.5
	local side = { x = point.x - dz / length * sway, z = point.z + dx / length * sway }
	local at, nextCell = Grid.cellAt(enemy), Grid.cellAt(side)
	if nextCell and at and flow.distance[nextCell] >= 0 and flow.distance[nextCell] < flow.distance[at] and Grid.canTraverse(terrainFor(s), enemy, side) then return side end
	return point
end

local function enemyTick(s, enemy, terrain, flow, budget)
	local d = Sim.enemyStats(enemy)
	enemy.cooldown = math.max(0, (enemy.cooldown or 0) - FIXED_DT)
	local home = { x = enemy.homeX, z = enemy.homeZ }
	if enemy.guard then
		local function actor(id)
			if not id then return nil end
			local u = Sim.unitById(s, id)
			if u and alive(u) and not stationed(u) then return u end
			local t = Sim.towerById(s, if u then u.towerId or -1 else id)
			return if t and solidTower(t) and t.hp > 0 then t else nil
		end
		local attacker, previous = actor(enemy.guardAttackerId), actor(enemy.guardTargetId)
		if (enemy.guardState == "engaged" and (not previous or dist(previous, home) > d.leash)) or dist(enemy, home) > d.leash or (attacker and dist(attacker, home) > d.leash) then enemy.guardState = "returning" end
		if enemy.guardState == "returning" then
			enemy.guardTargetId = nil
			navigate(s, enemy, home, d.speed, terrain)
			enemy.hp = math.min(enemy.maxHp, enemy.hp + enemy.maxHp * d.returnHeal * FIXED_DT)
			if dist(enemy, home) <= 0.25 and enemy.hp == enemy.maxHp then enemy.guardState = "guarding"; enemy.guardAttackerId = nil end
			return
		end
		local target, nearest = enemyTargetFor(s, enemy, d, terrain)
		local preferred = if attacker and dist(attacker, home) <= d.leash then attacker elseif previous and dist(previous, home) <= d.leash then previous else nil
		if preferred then target = preferred; nearest = math.max(0, dist(enemy, target) - (if target.footprint then 6 else 0)) end
		if target then enemy.guardState = "engaged"; enemy.guardTargetId = target.id else enemy.guardState = "guarding" end
		if not target then return end
		if nearest > d.range then
			local approach = if target.footprint then towerEntry(terrain, target) else target
			if approach then
				if Grid.straightClear(terrain, enemy, approach) then moveToward(enemy, approach, d.speed) else navigate(s, enemy, approach, d.speed, terrain) end
			end
		elseif enemy.cooldown <= 0 and Grid.hasLineOfSight(terrain, enemy, target) then
			local o = ownerOf(s, target.ownerId)
			local armor = if target.footprint then Balance.TOWER.armor else UNITS[target.kind].armor + (if target.kind == "carpenter" then 0 else o.upgrades.armor)
			recordShot(s, enemy, target, d.damage - armor, false)
			target.lastCombatTime = s.time; enemy.cooldown = d.rate
		end
		return
	end
	local target, nearest = enemyTargetFor(s, enemy, d, terrain)
	if enemy.wave then
		target = waveTarget(s, enemy, d, terrain, budget)
		nearest = math.max(0, dist(enemy, target) - (if target == s.base or target.footprint then 6 else 0))
	end
	if not target and (enemy.wave or dist(enemy, s.base) < Balance.LEASH.aggro) then target = s.base; nearest = math.max(0, dist(enemy, s.base) - 6) end
	if not d.stationary and not enemy.wave then
		local leash = if enemy.hunt then Balance.LEASH.hunt else Balance.LEASH.pack
		if dist(enemy, home) > leash then navigate(s, enemy, home, d.speed, terrain); return end
		if not target and dist(enemy, home) > 1.25 then
			if d.flying then moveToward(enemy, home, d.speed) else navigate(s, enemy, home, d.speed, terrain) end
		end
	end
	if not target then return end
	if nearest > d.range then
		if d.stationary then return end
		local previous = { x = enemy.x, z = enemy.z }
		local approach = if target.footprint then towerEntry(terrain, target) else target
		if enemy.kind == "ghoul" and nearest > 12.5 then approach = { x = target.x + (if enemy.id % 2 == 1 then 8.75 else -8.75), z = target.z + 3.75 } end
		if approach then
			if d.flying then moveToward(enemy, approach, d.speed)
			elseif enemy.wave and target == s.base and flow then
				local point = processionWaypoint(s, flow, enemy)
				if point then moveToward(enemy, point, d.speed) end
			elseif enemy.wave and Grid.straightClear(terrain, enemy, approach) then moveToward(enemy, approach, d.speed); enemy.pathBlocked = false
			else
				navigate(s, enemy, approach, d.speed, terrain)
				if enemy.wave and enemy.pathBlocked then
					enemy.waveBlockedId = enemy.waveTargetId; enemy.waveRetryAt = s.tick + Balance.WAVE.retryTicks; enemy.waveTargetId = nil; enemy.waveTargetUntil = 0
					local point = if flow then Grid.flowWaypoint(flow, enemy, s.base) else nil
					if point then moveToward(enemy, point, d.speed) end
				end
			end
		end
		if enemy.wave and target == s.base and nearest > d.range + 6 then
			local dx, dz = enemy.x - previous.x, enemy.z - previous.z
			if not settle(s, enemy, previous) then
				for _, side in { if enemy.id % 2 == 1 then 1 else -1, if enemy.id % 2 == 1 then -1 else 1 } do
					enemy.x = previous.x + dx * 0.5 - dz * side * 0.8660254037844386
					enemy.z = previous.z + dz * 0.5 + dx * side * 0.8660254037844386
					if (d.flying or Grid.canTraverse(terrain, previous, enemy)) and settle(s, enemy, previous) then break end
					enemy.x = previous.x; enemy.z = previous.z
				end
			end
		end
	elseif enemy.cooldown <= 0 then
		if not Grid.hasLineOfSight(terrain, enemy, target) then return end
		if enemy.kind == "enemy_tower" then
			if telegraph(s, enemy, target) then enemy.cooldown = d.rate; enemy.lastShotTick = s.tick end
			return
		end
		if enemy.kind == "plague" then
			if telegraph(s, enemy, target) then enemy.cooldown = d.rate end
			return
		end
		local armor
		if target.footprint then armor = Balance.TOWER.armor
		elseif target == s.base then armor = 0
		else local o = ownerOf(s, target.ownerId); armor = UNITS[target.kind].armor + (if target.kind == "carpenter" then 0 else o.upgrades.armor) end
		local actual = recordShot(s, enemy, target, d.damage - armor, false)
		target.lastCombatTime = s.time; enemy.cooldown = d.rate
		if enemy.kind == "vampire" and target.kind then enemy.hp = math.min(enemy.maxHp, enemy.hp + actual * Balance.VAMPIRE_LEECH) end
	end
end

local function unitTick(s, unit, terrain)
	local owner, d = ownerOf(s, unit.ownerId), UNITS[unit.kind]
	unit.cooldown = math.max(0, unit.cooldown - FIXED_DT)
	unit.hp = math.min(unit.maxHp, unit.hp + unit.maxHp * Sim.healingRate(s, unit) * FIXED_DT)
	if unit.roll then
		local r = unit.roll
		local t = (r.step + 1) / Balance.HERO.rollTicks
		local p = { x = r.x + (r.tx - r.x) * t, z = r.z + (r.tz - r.z) * t }
		if Grid.canTraverse(terrain, unit, p) then unit.x = p.x; unit.z = p.z; r.step += 1 else r.step = Balance.HERO.rollTicks end
		if r.step >= Balance.HERO.rollTicks then unit.roll = nil; unit.assignment = if unit.isLeader then "follow" else "skillHold" end
		return
	end
	if unit.kind == "carpenter" then workerTick(s, unit, terrain); return end
	if unit.garrisonTarget then
		local tower = Sim.towerById(s, unit.garrisonTarget)
		if tower and tower.state == "completed" and tower.hp > 0 then
			local entry = towerEntry(terrain, tower)
			if entry and navigate(s, unit, entry, d.speed, terrain) and #tower.occupants < Balance.CAPS.garrison then
				for i = #tower.reservations, 1, -1 do if tower.reservations[i] == unit.id then table.remove(tower.reservations, i) end end
				table.insert(tower.occupants, unit.id)
				unit.garrisonTarget = nil; unit.towerId = tower.id; unit.assignment = "garrison"; unit.x = tower.x; unit.z = tower.z
			end
		else unit.garrisonTarget = nil; unit.assignment = "follow" end
	end
	local tower = if unit.towerId then Sim.towerById(s, unit.towerId) else nil
	if tower and (tower.state ~= "completed" or tower.hp <= 0) then tower = nil end
	if stationed(unit) and not tower then return end
	local target, nearest = nil, d.range + (if tower then Balance.TOWER.rangeBonus else 0)
	local candidates = s.enemies
	for _, e in candidates do
		if alive(e) and (e.spawnReadyAt or 0) <= s.time then
			local r = dist(unit, e)
			if r <= nearest and Grid.hasLineOfSight(terrain, unit, e) then nearest = r; target = e end
		end
	end
	if not s.camp.cleared and s.camp.hp > 0 then
		local r = dist(unit, s.camp)
		if r <= nearest and Grid.hasLineOfSight(terrain, unit, s.camp) then nearest = r; target = s.camp end
	end
	if target and unit.cooldown <= 0 then
		local damage = attackDamage(s, unit, target)
		recordShot(s, unit, target, damage, true)
		unit.cooldown = Balance.fireInterval(d, owner.upgrades.attack); unit.lastCombatTime = s.time
		target.contributors[owner.id] = s.time; target.lastDamageOwnerId = owner.id
		if not alive(target) and target.kind ~= "camp" then awardKill(s, target) end
	end
end

local function campTick(s, terrain)
	local camp = s.camp
	if camp.cleared or camp.hp <= 0 then return end
	camp.cooldown = math.max(0, (camp.cooldown or 0) - FIXED_DT)
	for _, u in s.units do
		if alive(u) and not stationed(u) and dist(u, camp) <= Balance.ENEMIES.enemy_tower.range and Grid.hasLineOfSight(terrain, camp, u) then
			if camp.cooldown <= 0 and telegraph(s, camp, u) then camp.cooldown = 1.6 end
			break
		end
	end
end

function Sim.tick(s)
	s.tick += 1; s.time = s.tick * FIXED_DT
	local terrain = terrainFor(s)
	Campaign.advance(s, terrain)
	local c = cache(s)
	c.budget = 2048
	local live = {}
	for _, u in s.units do live[u.id] = true end
	for _, e in s.enemies do live[e.id] = true end
	for id in c.paths do if not live[id] then c.paths[id] = nil end end
	local bullets = {}
	for _, b in s.bullets do b.life -= FIXED_DT; if b.life > 0 then table.insert(bullets, b) end end
	s.bullets = bullets
	processEffects(s)
	towerTransitions(s)
	for _, owner in s.owners do owner.correction = nil; applyLeader(s, owner, terrain); moveFollowers(s, owner, terrain) end
	for _, unit in s.units do if alive(unit) then unitTick(s, unit, terrain) end end
	campTick(s, terrain)
	local anyWave = false
	for _, e in s.enemies do if e.wave then anyWave = true; break end end
	local flow = if anyWave then flowFor(s, terrain) else nil
	local budget = { remaining = 512 }
	for _, enemy in s.enemies do
		if alive(enemy) and (enemy.spawnReadyAt or 0) <= s.time and ENEMIES[enemy.kind] then enemyTick(s, enemy, terrain, flow, budget) end
	end
	towerTransitions(s)
	local units, enemies, towers = {}, {}, {}
	for _, u in s.units do if alive(u) then table.insert(units, u) else emit(s, "unitDied", { unitId = u.id, ownerId = u.ownerId, kind = u.kind, x = u.x, z = u.z }) end end
	for _, e in s.enemies do if alive(e) then table.insert(enemies, e) end end
	for _, t in s.towers do if activeTower(t) then table.insert(towers, t) end end
	s.units, s.enemies, s.towers = units, enemies, towers
	for _, owner in s.owners do ensureLeader(s, owner) end
	Campaign.resolve(s)
	local economyDead = #s.owners > 0
	for _, o in s.owners do
		local hasUnit = false
		for _, u in s.units do if u.ownerId == o.id then hasUnit = true; break end end
		if hasUnit or o.gold >= Balance.DEFEAT_GOLD then economyDead = false end
	end
	if s.base.hp <= 0 or economyDead then
		s.phase = "dead"
		local golds = {}
		for _, o in s.owners do table.insert(golds, o.gold) end
		s.defeat = { reason = if s.base.hp <= 0 then "base" else "economy", tick = s.tick, baseHp = s.base.hp, gold = golds, units = #s.units }
		emit(s, "lose", { reason = s.defeat.reason })
	end
end

function Sim.step(s, dt)
	if s.phase ~= "playing" or not finite(dt) or dt <= 0 then return s end
	s.events = {}
	-- 한 번에 최대 3틱 (0.1초). 그 이상 밀린 시간은 버린다 — 느린 프레임이 다음 프레임을 더 느리게 만드는 나선을 막는다.
	s.accumulator += math.min(dt, 3 * FIXED_DT)
	while s.accumulator + 1e-10 >= FIXED_DT and s.phase == "playing" do
		s.accumulator = math.max(0, s.accumulator - FIXED_DT)
		Sim.tick(s)
	end
	return s
end

-- ── 튜토리얼 (원작 main.js updateTutorial) ──────────────────────────────────
function Sim.tutorial(s, ownerId)
	local o = ownerOf(s, ownerId)
	if not o then return nil end
	local workers, fighters, working = 0, 0, false
	for _, u in s.units do
		if u.ownerId == ownerId then
			if u.kind == "carpenter" then
				workers += 1
				if u.job == "wood" or u.job == "mine" or u.job == "return" or (u.nextJob and (u.nextJob.job == "wood" or u.nextJob.job == "mine")) then working = true end
			else fighters += 1 end
		end
	end
	local towers, completed = 0, false
	for _, t in s.towers do if t.ownerId == ownerId and activeTower(t) then towers += 1; if t.state == "completed" then completed = true end end end
	if o.upgrades.attack < 3 or o.upgrades.armor < 2 then
		return { title = "1 · 첫 활잡이 공방 강화", detail = "본진 주변에서 사냥하고 훈련장에서 공격을 먼저 강화하고 적 정보로 필요한 방어 단계를 확인하세요. 기본 좀비 피해 1은 일반 궁수 방어 10부터입니다. 북쪽 고지에는 원거리 가시 첨탑이 있습니다. 용병은 700G부터, 목수는 500G입니다.", action = "훈련장 열기", target = "growth" }
	elseif workers == 0 then
		local ready = o.gold >= 500
		return { title = if ready then "2 · 첫 목수 고용" else "2 · 강화한 활잡이로 고지 공략",
			detail = if ready then "500G가 모였습니다. 고용소에서 목수 1명을 고용하세요." else ("본진으로 몰려오는 적을 막아 500G를 모으세요 (%d/500G). 고지 탑의 교차 사격을 피하고 필요하면 공방을 더 강화하세요. 상위 사냥터일수록 전리품이 많습니다. 다치면 본진에서 회복하세요."):format(math.floor(o.gold)),
			action = if ready then "목수 고용하기" else "고용소 안내", target = "hire" }
	elseif not working and towers == 0 then
		return { title = "3 · 목수에게 채집 지정", detail = "병력·목수에서 숲이나 광산을 선택하세요. 목수가 짐을 본진에 반납할 때 금화가 들어옵니다.", action = "채집 지정하기", target = "units" }
	elseif fighters < 2 or o.upgrades.attack + o.upgrades.armor == 0 then
		local target = if fighters < 2 then "hire" else "growth"
		return { title = "4 · 상위 사냥터와 용병", detail = "강화한 활잡이로 고지·묘역·광산 순서로 진출하세요. 더 많은 전리품으로 활잡이 700G·장궁수 1,400G를 고용하고 공방 강화를 이어갑니다.", action = if target == "hire" then "추가 병력 고용" else "훈련장 열기", target = target }
	elseif not completed then
		return { title = "5 · 목수로 방어탑 건설", detail = if towers > 0 then "목수가 현장에 도착해 공사합니다. 멈춘 공사는 목수를 선택하고 수리·재개하세요." else "220G를 모은 뒤 탑 건설을 선택하고 본진 주변의 빈 곳을 지정하세요.", action = if towers > 0 then "공사 확인" else "탑 건설 준비", target = if towers > 0 then "towers" else "units" }
	end
	return { title = "준비 완료 · 탑에 병력 주둔", detail = "빈 탑은 공격하지 않습니다. 전투원을 선택해 주둔시키고, 나머지 병력으로 적 거점에 진출하세요.", action = "방어탑 관리", target = "towers" }
end


-- ── 소유자 요약 (5Hz 전송) ─────────────────────────────────────────────────
function Sim.view(s, ownerId)
	local o = ownerOf(s, ownerId)
	local units, towers = {}, {}
	local fighters, carpenters = 0, 0
	for _, u in s.units do
		if u.ownerId == ownerId then
			if u.kind == "carpenter" then carpenters += 1 else fighters += 1 end
			table.insert(units, { id = u.id, kind = u.kind, hp = math.floor(u.hp), maxHp = u.maxHp, assignment = u.assignment, job = u.job, nodeId = u.nodeId, cargo = u.cargo, towerId = u.towerId, garrisonTarget = u.garrisonTarget, isLeader = u.isLeader or false,
				multishotReady = if u.kind == "hero_archer" then math.max(0, ((u.multishotReadyTick or 0) - s.tick) * FIXED_DT) else nil,
				rollReady = if u.kind == "hero_archer" then math.max(0, ((u.rollReadyTick or 0) - s.tick) * FIXED_DT) else nil })
		end
	end
	for _, t in s.towers do
		if t.ownerId == ownerId then table.insert(towers, { id = t.id, x = t.x, z = t.z, state = t.state, progress = t.progress, hp = math.floor(t.hp), maxHp = t.maxHp, occupants = table.clone(t.occupants), reservations = table.clone(t.reservations), builderId = t.builderId }) end
	end
	local releaseRemaining = Campaign.waveReleaseRemaining(s)
	local leader = if o and o.leaderId then Sim.unitById(s, o.leaderId) else nil
	return { tick = s.tick, time = s.time, phase = s.phase, mode = s.mode, defeat = s.defeat,
		wave = { number = s.wave.number, next = math.max(0, s.wave.next - s.time), releaseRemaining = releaseRemaining, releasing = releaseRemaining > 0 },
		base = { hp = math.floor(s.base.hp), maxHp = s.base.maxHp },
		gold = if o then math.floor(o.gold) else 0, upgrades = if o then table.clone(o.upgrades) else nil,
		prices = if o then { archer = UNITS.archer.cost, longbow = UNITS.longbow.cost, carpenter = UNITS.carpenter.cost,
			attack1 = Sim.price(s, ownerId, "attack", 1), attack10 = Sim.price(s, ownerId, "attack", 10), armor1 = Sim.price(s, ownerId, "armor", 1), armor10 = Sim.price(s, ownerId, "armor", 10) } else nil,
		counts = { fighters = fighters, carpenters = carpenters, towers = #towers },
		units = units, towers = towers, leaderId = if o then o.leaderId else nil,
		leader = if leader then { hp = leader.hp, maxHp = leader.maxHp, kind = leader.kind, x = leader.x, z = leader.z, rolling = leader.roll ~= nil } else nil,
		tutorial = if o then (if o.leaderId then Sim.tutorial(s, ownerId) else { title = "활잡이가 없습니다", detail = "금화가 모이면 고용소에서 활잡이(700G)나 장궁수(1,400G)를 고용하세요. 목수는 계속 일합니다.", action = "고용소 열기", target = "hire" }) else nil,
		camp = { hp = math.floor(s.camp.hp), maxHp = s.camp.maxHp, cleared = s.camp.cleared },
		owners = (function() local list = {} for _, x in s.owners do table.insert(list, { id = x.id, name = x.name, gold = math.floor(x.gold) }) end return list end)() }
end

-- ── 저장 ───────────────────────────────────────────────────────────────────
local function deepCopy(v)
	if type(v) ~= "table" then return v end
	local out = {}
	for k, x in v do out[k] = deepCopy(x) end
	return out
end

function Sim.snapshot(s)
	local copy = deepCopy(s)
	copy.events = {}; copy.bullets = {}
	for _, o in copy.owners do o.leaderPos = nil; o.correction = nil; o.moving = false end
	return copy
end

function Sim.restore(snapshot)
	if type(snapshot) ~= "table" or snapshot.version ~= 1 or (snapshot.mode ~= "solo" and snapshot.mode ~= "coop") or (snapshot.phase ~= "playing" and snapshot.phase ~= "dead") then return nil end
	if type(snapshot.owners) ~= "table" or type(snapshot.units) ~= "table" or type(snapshot.enemies) ~= "table" or type(snapshot.towers) ~= "table" or type(snapshot.campaign) ~= "table" or type(snapshot.camp) ~= "table" then return nil end
	local s = deepCopy(snapshot)
	s.events = {}; s.bullets = s.bullets or {}; s.effects = s.effects or {}
	-- JSON 을 거치면 숫자 키가 문자열이 된다. 기여자 표의 키를 되돌린다.
	local function fixKeys(tbl)
		if type(tbl) ~= "table" then return {} end
		local out = {}
		for k, v in tbl do out[tonumber(k) or k] = v end
		return out
	end
	for _, e in s.enemies do e.contributors = fixKeys(e.contributors) end
	s.camp.contributors = fixKeys(s.camp.contributors)
	for _, o in s.owners do o.leaderPos = nil; o.correction = nil; o.moving = false end
	return s
end

-- 결정성 검사용: 키를 정렬한 문자열. 캐시·이벤트는 포함하지 않는다.
function Sim.canonical(v, depth)
	depth = depth or 0
	if type(v) == "number" then return if v == math.floor(v) then tostring(v) else ("%.6f"):format(v) end
	if type(v) ~= "table" then return tostring(v) end
	local keys = {}
	for k in v do table.insert(keys, k) end
	table.sort(keys, function(a, b) return tostring(a) < tostring(b) end)
	local parts = {}
	for _, k in keys do
		if k ~= "events" and k ~= "bullets" and k ~= "leaderPos" and k ~= "correction" then table.insert(parts, tostring(k) .. "=" .. Sim.canonical(v[k], depth + 1)) end
	end
	return "{" .. table.concat(parts, ",") .. "}"
end

return Sim
