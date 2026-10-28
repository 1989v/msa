--!nonstrict
-- Roblox API 없이 돌아가는 순수 규칙. 서버가 그대로 부르고 tests/rules.spec.luau 가 같은 함수를 검사한다.
local Config = require("./Config")

local Rules = {}

export type Economy = { gold: number, upgrades: { attack: number, armor: number }, counts: { [string]: number } }

function Rules.newEconomy(): Economy
	local counts = {}
	for kind in pairs(Config.UNITS) do counts[kind] = 0 end
	return { gold = Config.START.gold, upgrades = { attack = 0, armor = 0 }, counts = counts }
end

local function combatCount(eco: Economy): number
	local n = 0
	for kind, unit in pairs(Config.UNITS) do if unit.combat then n += eco.counts[kind] or 0 end end
	return n
end

function Rules.price(kind: string): number?
	local unit = Config.UNITS[kind]
	return unit and unit.cost or nil
end

function Rules.upgradeCost(kind: string, level: number): number?
	local up = Config.UPGRADES[kind]
	if not up or level >= up.max then return nil end
	return up.base + up.step * level
end

-- 고용 가능 여부. 상한은 전투 병력/목수 따로.
function Rules.canHire(eco: Economy, kind: string): (boolean, string)
	local unit = Config.UNITS[kind]
	if not unit or unit.cost <= 0 then return false, "UNKNOWN" end
	if eco.gold < unit.cost then return false, "GOLD" end
	if unit.combat then
		if combatCount(eco) >= Config.LIMITS.allies then return false, "LIMIT" end
	elseif (eco.counts.carpenter or 0) >= Config.LIMITS.carpenters then
		return false, "LIMIT"
	end
	return true, "OK"
end

function Rules.hire(eco: Economy, kind: string): (boolean, string)
	local ok, why = Rules.canHire(eco, kind)
	if not ok then return false, why end
	eco.gold -= Config.UNITS[kind].cost
	eco.counts[kind] = (eco.counts[kind] or 0) + 1
	return true, "OK"
end

function Rules.upgrade(eco: Economy, kind: string): (boolean, string)
	local level = eco.upgrades[kind]
	if level == nil then return false, "UNKNOWN" end
	local cost = Rules.upgradeCost(kind, level)
	if not cost then return false, "MAX" end
	if eco.gold < cost then return false, "GOLD" end
	eco.gold -= cost
	eco.upgrades[kind] = level + 1
	return true, "OK"
end

-- 합성 규칙: from 병종 count 명 → to 병종 하나. 한 병종은 한 규칙에만 속한다.
function Rules.combineRule(from: string)
	for _, rule in Config.COMBINES do if rule.from == from then return rule end end
	return nil
end

function Rules.canCombine(eco: Economy, from: string): (boolean, string)
	local rule = Rules.combineRule(from)
	if not rule then return false, "UNKNOWN" end
	if (eco.counts[rule.from] or 0) < rule.count then return false, "COUNT" end
	return true, "OK"
end

function Rules.combine(eco: Economy, from: string): (boolean, string)
	local ok, why = Rules.canCombine(eco, from)
	if not ok then return false, why end
	local rule = Rules.combineRule(from)
	eco.counts[rule.from] -= rule.count
	eco.counts[rule.to] = (eco.counts[rule.to] or 0) + 1
	return true, "OK"
end

-- 사격 피해: 기본 피해 + 공업. 피격 측 방업은 적용받는 쪽(아군)만.
function Rules.attackDamage(base: number, attackLevel: number): number
	return base + Config.UPGRADES.attack.damagePerLevel * attackLevel
end

function Rules.damageTaken(raw: number, armorLevel: number): number
	return math.max(1, raw - Config.UPGRADES.armor.reductionPerLevel * armorLevel)
end

-- 웨이브 n(1부터)의 구성. 첫 웨이브는 활잡이 하나가 치료사 곁에서 버틸 만큼 작고, 종류는 웨이브마다 하나씩 는다.
-- bossEvery 번째 웨이브엔 거구 좀비(중간 보스)가 하나 온다. 총량이 동시 상한을 넘으면 대기열이 상한 안에서 흘려보낸다.
function Rules.waveComposition(n: number): { [string]: number }
	return {
		zombie = 6 + 4 * (n - 1),
		runner = if n >= 2 then 2 + 2 * (n - 2) else 0,
		plague = math.floor(n / 2),
		bat = if n >= 3 then 2 + (n - 3) else 0,
		bomber = if n >= 3 then 1 + math.floor((n - 3) / 2) else 0,
		armored = if n >= 4 then math.floor((n - 2) / 2) else 0,
		brute = if n % Config.WAVES.bossEvery == 0 then 1 else 0,
	}
end

function Rules.waveTotal(n: number): number
	local total = 0
	for _, count in Rules.waveComposition(n) do total += count end
	return total
end

-- 적이 받는 화살 피해: 철갑은 차감, 최소 1.
function Rules.enemyDamageTaken(raw: number, enemyArmor: number?): number
	return math.max(1, raw - (enemyArmor or 0))
end

local function inBowl(p: Vector3): boolean
	local b = Config.BOWL
	return p.X >= b.minX and p.X <= b.maxX and p.Z >= b.minZ and p.Z <= b.maxZ
end
Rules.inBowl = inBowl

local function flat(a: Vector3, b: Vector3): number
	local dx, dz = a.X - b.X, a.Z - b.Z
	return math.sqrt(dx * dx + dz * dz)
end
Rules.flatDistance = flat

-- 탑 배치 판정: 분지 안 · 플레이어에서 가까움 · 다른 탑/본진/치료사와 간격.
function Rules.canPlaceTower(point: Vector3, playerPos: Vector3, towers: { Vector3 }, towerCount: number): (boolean, string)
	if towerCount >= Config.LIMITS.towers then return false, "LIMIT" end
	if not inBowl(point) then return false, "BOWL" end
	if flat(point, playerPos) > Config.TOWER.maxDistanceFromPlayer then return false, "FAR" end
	for _, site in { Config.SITES.base, Config.SITES.healer, Config.SITES.barracks, Config.SITES.workshop } do
		if flat(point, site) < Config.TOWER.minSpacing + 4 then return false, "SITE" end
	end
	for _, t in towers do
		if flat(point, t) < Config.TOWER.minSpacing then return false, "SPACING" end
	end
	return true, "OK"
end

-- 목수 운반 수입. 노드 종류별 고정 금화.
function Rules.carryGold(nodeKind: string): number
	if nodeKind == "wood" then return Config.CARPENTER.woodGold end
	if nodeKind == "ore" then return Config.CARPENTER.oreGold end
	return 0
end

-- 저장 스냅샷의 모양 검사. 숫자 범위·종류를 확인하고 통과한 것만 돌려준다.
function Rules.sanitizeSave(raw: any): Economy?
	if type(raw) ~= "table" then return nil end
	local function finite(v: any, max: number): number?
		if type(v) ~= "number" or v ~= v or v < 0 or v > max then return nil end
		return math.floor(v)
	end
	local gold = finite(raw.gold, 1e9)
	if not gold then return nil end
	local eco = Rules.newEconomy()
	eco.gold = gold
	if type(raw.upgrades) ~= "table" then return nil end
	for _, k in { "attack", "armor" } do
		local lv = finite(raw.upgrades[k], Config.UPGRADES[k].max)
		if not lv then return nil end
		eco.upgrades[k] = lv
	end
	if type(raw.counts) ~= "table" then return nil end
	for k in pairs(Config.UNITS) do
		local n = finite(raw.counts[k] or 0, Config.LIMITS.allies)
		if not n then return nil end
		eco.counts[k] = n
	end
	return eco
end

return Rules
