--!strict
-- 수치는 원작 marine-command/js/origin/sim.js · campaign.js · map.js 그대로다.
-- 길이는 원작 px ÷ 8 = 스터드. 시간은 초. 원작 숫자를 바꾸지 않고 단위만 옮겼다.
local Balance = {}

Balance.STUDS_PER_PX = 1 / 8
local function studs(px: number): number return px / 8 end
Balance.studs = studs

Balance.FIXED_DT = 1 / 30
Balance.CELL = 4

export type UnitDef = { label: string, cost: number?, hp: number, damage: number, rate: number, range: number, speed: number, armor: number, penetration: number }
Balance.UNITS = {
	archer = { label = "활잡이", cost = 700, hp = 100, damage = 12, rate = 0.55, range = studs(190), speed = studs(110), armor = 0, penetration = 0 },
	hero_archer = { label = "영웅 활잡이", cost = nil, hp = 300, damage = 40, rate = 0.45, range = studs(220), speed = studs(110), armor = 2, penetration = 0 },
	longbow = { label = "장궁수", cost = 1400, hp = 150, damage = 34, rate = 0.95, range = studs(560), speed = studs(95), armor = 1, penetration = 4 },
	carpenter = { label = "목수", cost = 500, hp = 70, damage = 0, rate = 0, range = 0, speed = studs(80), armor = 0, penetration = 0 },
} :: { [string]: UnitDef }

export type EnemyDef = { label: string, hp: number, damage: number, rate: number, speed: number, range: number, armor: number, reward: number, stationary: boolean?, flying: boolean?, boss: boolean? }
Balance.ENEMIES = {
	enemy_tower = { label = "가시 첨탑", hp = 350, damage = 12, rate = 1.6, speed = 0, range = studs(340), armor = 2, reward = 150, stationary = true },
	zombie = { label = "떠도는 시체", hp = 24, damage = 11, rate = 1.3, speed = studs(123), range = studs(24), armor = 0, reward = 10 },
	ghoul = { label = "굶주린 망자", hp = 52, damage = 7, rate = 0.8, speed = studs(110), range = studs(24), armor = 0, reward = 16 },
	plague = { label = "역병 망자", hp = 70, damage = 9, rate = 1.5, speed = studs(45), range = studs(170), armor = 0, reward = 22 },
	bat = { label = "흡혈박쥐", hp = 36, damage = 5, rate = 0.7, speed = studs(125), range = studs(20), armor = 0, reward = 14, flying = true },
	armored = { label = "철갑 망자", hp = 160, damage = 13, rate = 1.5, speed = studs(40), range = studs(28), armor = 5, reward = 35 },
	vampire = { label = "하급 흡혈귀", hp = 220, damage = 18, rate = 1.1, speed = studs(85), range = studs(30), armor = 2, reward = 55 },
} :: { [string]: EnemyDef }

-- 전초 파수꾼 — vampire 외형에 아래 값이 덮인다 (map.js openingOutpost.guardStats)
Balance.GUARD = { hp = 600, damage = 14, rate = 1.4, speed = studs(126), range = studs(32), armor = 2, reward = 180, aggro = studs(320), leash = studs(360), returnHeal = 0.2 }
Balance.SCOUT_HP = 12

Balance.UPGRADE_LIMITS = { attack = 50, armor = 30 } :: { [string]: number }
Balance.CAPS = { fighters = 24, carpenters = 8, towers = 6, garrison = 4, nodeWorkers = 3 }

Balance.BASE_HP = { solo = 4000, coop = 6000 }
Balance.COOP = { enemyHp = 1.5, waveCount = 1.4, reward = 1.5 }

Balance.HEAL = { baseRadius = studs(96), idleAfter = 3, idleRate = 0.10, combatRate = 0.02, healerRadius = studs(180), healerRate = 0.5 }

Balance.WORK = { woodSeconds = 6, woodCargo = 10, oreSeconds = 10, oreCargo = 18 }
Balance.TOWER = { cost = 220, buildSeconds = 20, startHp = 80, growHp = 720, maxHp = 800, armor = 3, footprint = studs(96), rangeBonus = studs(60), repairPerSecond = 20, goldPerRepairHp = 0.1, cancelRefund = 0.75, ejectLoss = 0.25 }

Balance.HERO = { multishotAngle = 70, multishotTargets = 6, multishotMultiplier = 1.5, multishotCooldownTicks = 420, rollMax = studs(120), rollMin = studs(24), rollTicks = 9, rollCooldownTicks = 300 }

Balance.WAVE = { first = 8, scoutUntil = 180, scoutGap = 15, lateGap = 35, firstFraction = 2 / 3,
	scoutBase = 120, scoutStep = 40, scoutCap = 440, lateBase = 320, lateStep = 30, lateFrom = 12, lateCap = 670,
	burstMin = 2, burstMax = 4, insideMin = 0.13, insideSpan = 0.08, betweenMin = 0.45, betweenSpan = 0.30, lateralSpread = studs(120), forwardSpread = studs(24),
	targetKeep = studs(240), targetKeepExtra = studs(80), retryTicks = 45 }

-- Roblox 동시 상한 (원작 waveField 1000 · ambientField 65 에서 내렸다 — 대기열·인원은 그대로)
Balance.LIMITS = { waveField = 150, ambientField = 30, outpostField = 2, campField = 25, perTickSpawn = 16, queue = 128 }

-- campaign.js campComposition(0): authored { zombie, zombie } × 12.5 = 25 — i%5==3 역병, i%5==4 박쥐, 나머지 좀비
local campKinds = {}
for i = 0, 24 do table.insert(campKinds, if i % 5 == 3 then "plague" elseif i % 5 == 4 then "bat" else "zombie") end
Balance.CAMP = { hp = 1200, reward = 100, regen = 20, ambush = 6, composition = campKinds }
Balance.HUNT = { every = 12, keep = 4, initial = 3, perRefill = 2 }
Balance.FIELD_PACK = { regen = 45, keep = 3, perRefill = 2, kinds = { "zombie", "zombie", "zombie" } }
Balance.ENEMY_TOWER = { telegraph = 0.55, radius = studs(30), damage = 12 }
Balance.PLAGUE = { telegraph = 0.7, radius = studs(36), damage = 9 }
Balance.VAMPIRE_LEECH = 0.25
Balance.LEASH = { hunt = studs(300), pack = studs(500), aggro = studs(240) }
Balance.SQUAD = { slotRadiusMax = studs(42), slotRadiusStep = studs(14), followNear = studs(2) }
Balance.DEFEAT_GOLD = 500 -- min(archer 700, carpenter 500)
Balance.CONTRIBUTION_WINDOW = 10

function Balance.upgradeCost(stat: string, level: number, count: number): number?
	local limit = Balance.UPGRADE_LIMITS[stat]
	if not limit or level < 0 or count < 1 then return nil end
	local n = math.min(count, limit - level)
	if n <= 0 then return nil end
	local base = if stat == "attack" then 30 else 25
	local slope = if stat == "attack" then 20 else 25
	return n * (base + slope * level) + slope * n * (n - 1) // 2
end

function Balance.damage(def: UnitDef, attackLevel: number, enemyArmor: number, multiplier: number?): number
	return math.max(1, (def.damage + 2 * attackLevel) * (multiplier or 1) - math.max(0, enemyArmor - def.penetration))
end

function Balance.fireInterval(def: UnitDef, attackLevel: number): number
	return def.rate * (1 - math.min(0.2, attackLevel * 0.006))
end

function Balance.waveCount(number: number, time: number, coop: boolean): number
	local scouts = time < Balance.WAVE.scoutUntil
	local base = if scouts then math.min(Balance.WAVE.scoutBase + Balance.WAVE.scoutStep * number, Balance.WAVE.scoutCap)
		else math.min(Balance.WAVE.lateBase + Balance.WAVE.lateStep * math.max(0, number - Balance.WAVE.lateFrom), Balance.WAVE.lateCap)
	local fraction = if number == 0 then Balance.WAVE.firstFraction else 1
	return math.ceil(base * fraction * (if coop then Balance.COOP.waveCount else 1))
end

-- campaign.js waveComposition: 웨이브 번호와 경과 시간으로 종류·비율을 정한다 (거점 수는 분지 안에서 C1 하나뿐)
function Balance.waveComposition(number: number, time: number, clearedCamps: number, count: number): { string }
	local result = {}
	local function fill(kinds: { string }, weights: { number })
		for i, kind in kinds do
			local n = if i == #kinds then count - #result else math.floor(count * weights[i])
			for _ = 1, n do table.insert(result, kind) end
		end
	end
	if number < 3 then
		if number == 0 then fill({ "zombie" }, { 1 })
		elseif number == 1 then fill({ "zombie", "ghoul" }, { 0.9, 0.1 })
		else fill({ "zombie", "ghoul", "plague" }, { 0.75, 0.15, 0.1 }) end
		return result
	end
	local types, weights
	if clearedCamps >= 5 or time >= 480 then
		types = { "zombie", "ghoul", "plague", "bat", "armored", "vampire" }; weights = { 0.25, 0.2, 0.2, 0.15, 0.15, 0.05 }
	elseif clearedCamps >= 3 or time >= 180 then
		types = { "zombie", "ghoul", "plague", "bat", "armored" }; weights = { 0.35, 0.25, 0.15, 0.15, 0.1 }
	else
		types = { "zombie", "ghoul", "plague", "bat" }; weights = { 0.55, 0.2, 0.1, 0.15 }
	end
	local bat = table.find(types, "bat") :: number
	local flying = math.min(weights[bat], 0.03 + 0.02 * (number - 3))
	weights[1] += weights[bat] - flying
	weights[bat] = flying
	fill(types, weights)
	return result
end

return Balance
