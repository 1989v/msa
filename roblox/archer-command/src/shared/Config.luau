--!nonstrict
-- 게임 수치 한 곳. 단위는 스터드·초·금화. 원작(웹 「궁수 키우기」)의 구성과 리듬을 따르되 값은 Roblox 규모에 맞게 정했다.
-- 적은 원작보다 수를 줄이고 개체를 키웠다(동시 60마리 상한). 밸런스를 바꾸려면 이 파일만 고친다.
-- 좌표는 Roblox 에선 Vector3, luau CLI 검사에선 X/Y/Z 테이블이다(둘 다 .X/.Z 로 읽는다).

local function vec(x, y, z)
	if Vector3 ~= nil then return Vector3.new(x, y, z) end
	return { X = x, Y = y, Z = z }
end

local Config = {}

Config.PLAYER = { walkSpeed = 16, maxHealth = 140, range = 30, damage = 16, fireInterval = 0.8, lightRange = 28, lightBrightness = 1.4 }

Config.UNITS = {
	archer = { label = "활잡이", cost = 700, walkSpeed = 15, maxHealth = 90, range = 28, damage = 14, fireInterval = 0.9, combat = true },
	longbow = { label = "장궁수", cost = 1200, walkSpeed = 14, maxHealth = 80, range = 40, damage = 24, fireInterval = 1.3, combat = true },
	hero = { label = "영웅 활잡이", cost = 0, walkSpeed = 16, maxHealth = 220, range = 32, damage = 34, fireInterval = 0.7, combat = true },
	carpenter = { label = "목수", cost = 500, walkSpeed = 14, maxHealth = 70, range = 0, damage = 0, fireInterval = 0, combat = false },
}
Config.COMBINE = { from = "archer", count = 3, to = "hero" }
Config.HERO_SKILL = { label = "일제 사격", arrows = 12, radius = 8, damage = 20, cooldown = 10, maxDistance = 45 }

Config.UPGRADES = {
	attack = { label = "공업", base = 80, step = 40, max = 30, damagePerLevel = 2 },
	armor = { label = "방업", base = 80, step = 50, max = 30, reductionPerLevel = 1 },
}

Config.CARPENTER = { gatherSeconds = 3, woodGold = 10, oreGold = 16, buildSeconds = 8, repairPerSecond = 6 }
Config.TOWER = { label = "방어탑", cost = 220, maxHealth = 400, garrison = 2, heightBonus = 6, minSpacing = 10, maxDistanceFromPlayer = 40 }
Config.BASE = { maxHealth = 2000, coopBonus = 1000, healerRadius = 14, healPerSecond = 6, recruitWalkOut = 6 }

Config.ENEMIES = {
	zombie = { label = "좀비", maxHealth = 60, damage = 8, walkSpeed = 11, attackRange = 4, cooldown = 1.4, reward = 12, flying = false },
	plague = { label = "역병 좀비", maxHealth = 48, damage = 10, walkSpeed = 10, attackRange = 16, cooldown = 2.5, reward = 20, flying = false, spitSpeed = 40 },
	bat = { label = "박쥐", maxHealth = 24, damage = 5, walkSpeed = 20, attackRange = 3, cooldown = 1.0, reward = 8, flying = true, altitude = 5 },
	brute = { label = "거구 좀비", maxHealth = 240, damage = 18, walkSpeed = 9, attackRange = 5, cooldown = 1.8, reward = 60, flying = false },
}

-- 분지 배치. 본진이 원점, 북쪽이 -Z. 지면 높이 0.
Config.SITES = {
	base = vec(0, 0, 0),
	spawn = vec(0, 0, 6),
	barracks = vec(-10, 0, -6),
	workshop = vec(10, 0, -6),
	store = vec(-8, 0, 8),
	healer = vec(22, 0, -10),
	hunt = vec(84, 0, -20),
	outpost_tower = vec(104, 0, -36),
	outpost_guard = vec(112, 0, -52),
	camp = vec(28, 0, -116),
	wave_entry = vec(132, 0, -96),
	exit_gate = vec(132, 0, -164),
	wood_west = vec(-22, 0, 16),
	wood_east = vec(64, 0, 14),
	ore_west = vec(-22, 0, -30),
	ore_east = vec(92, 0, 12),
}
Config.BOWL = { minX = -32, maxX = 176, minZ = -160, maxZ = 40 }
Config.HILL = { center = vec(20, -30, -114), radius = 40 }

Config.HUNT = { count = 4, respawnSeconds = 12, kind = "zombie" }
Config.CAMP = { composition = { zombie = 6, plague = 2, bat = 2 }, reward = 250, respawnSeconds = 60, counterattack = 6 }
Config.OUTPOST = { guard = "brute", towerHealth = 500, reward = 300 }
Config.WAVES = { firstAt = 25, interval = 40, batch = 6, batchGap = 0.5 }

Config.LIMITS = { enemies = 60, allies = 24, carpenters = 8, towers = 8, players = 2 }
Config.SAVE = { intervalSeconds = 60, storeName = "ArcherCommandNative_v1" }
Config.ARROW = { speed = 90, gravity = 0 }

return Config
