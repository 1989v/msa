--!nonstrict
-- Roblox API 없이 돌아가는 순수 규칙. 서버가 그대로 부르고 tests/rules.spec.luau 가 같은 함수를 검사한다.
local Config = require("./Config")

local Rules = {}

export type Economy = { gold: number, upgrades: { attack: number, armor: number }, counts: { [string]: number } }

function Rules.newEconomy(): Economy
	return { gold = 0, upgrades = { attack = 0, armor = 0 }, counts = { archer = 0, longbow = 0, hero = 0, carpenter = 0 } }
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
		local combat = (eco.counts.archer or 0) + (eco.counts.longbow or 0) + (eco.counts.hero or 0)
		if combat >= Config.LIMITS.allies then return false, "LIMIT" end
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

function Rules.canCombine(eco: Economy): (boolean, string)
	if (eco.counts[Config.COMBINE.from] or 0) < Config.COMBINE.count then return false, "COUNT" end
	return true, "OK"
end

function Rules.combine(eco: Economy): (boolean, string)
	local ok, why = Rules.canCombine(eco)
	if not ok then return false, why end
	eco.counts[Config.COMBINE.from] -= Config.COMBINE.count
	eco.counts[Config.COMBINE.to] = (eco.counts[Config.COMBINE.to] or 0) + 1
	return true, "OK"
end

-- 사격 피해: 기본 피해 + 공업. 피격 측 방업은 적용받는 쪽(아군)만.
function Rules.attackDamage(base: number, attackLevel: number): number
	return base + Config.UPGRADES.attack.damagePerLevel * attackLevel
end

function Rules.damageTaken(raw: number, armorLevel: number): number
	return math.max(1, raw - Config.UPGRADES.armor.reductionPerLevel * armorLevel)
end

-- 웨이브 n(1부터)의 구성. 수는 줄이고 개체는 키운 규모.
function Rules.waveComposition(n: number): { zombie: number, plague: number, bat: number }
	return {
		zombie = 10 + 3 * (n - 1),
		plague = math.floor(n / 2),
		bat = if n >= 3 then 2 + (n - 3) else 0,
	}
end

function Rules.waveTotal(n: number): number
	local c = Rules.waveComposition(n)
	return c.zombie + c.plague + c.bat
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
		local n = finite(raw.counts[k], Config.LIMITS.allies)
		if not n then return nil end
		eco.counts[k] = n
	end
	return eco
end

return Rules
