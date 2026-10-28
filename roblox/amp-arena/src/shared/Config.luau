--!nonstrict
-- 게임 수치 한 곳. 단위는 스터드·초. 겟앰프드식 난투의 구성(사슬·가드·잡기·다운·링아웃·아이템·라운드)을 따르되
-- 값은 Roblox 기본 캐릭터(R6 5 스터드, 중력 196.2, 걷기 16)에 맞춰 정했다. 웹 참고작의 미터·60틱 값은 옮기지 않았다.
-- 밸런스를 바꾸려면 이 파일과 Moves.luau 만 고친다.
local Config = {}

Config.PLAYER = { walkSpeed = 14, jumpPower = 50, baseHealth = 70, healthPerStat = 10, bodyRadius = 1.4, hitHeight = 2.7, lightRange = 0 }
Config.STAT = { default = 3, min = 1, max = 5 }
Config.DASH = { speed = 46, duration = 0.22, cooldown = 0.9, attackWindow = 0.3 }
Config.GUARD = { max = 100, regenPerSecond = 20, costMult = 4, angleDeg = 180, stunSeconds = 1.5, counterWindow = 0.25, walkSpeed = 0 }
Config.GRAB = { range = 3.0, coneDeg = 60, heldMax = 2.0, mashToEscape = 6, throwSpeedH = 24, throwSpeedV = 14, damage = 15, wallBonus = 5, holdOffset = 2.4, escapeStun = 0.2 }
-- 경타는 짧은 밀림, 강타는 띄움 → 착지 → 다운 → 기상(둘 다 무적). 같은 공격자 연속 4히트째부터 넉백 ×1.5(무한 콤보 방지).
Config.HIT = { pushSeconds = 0.12, launchSeconds = 0.2, downSeconds = 0.8, getupSeconds = 0.4, consecutiveFrom = 4, consecutiveMult = 1.5, koCreditSeconds = 3, airHitsMax = 1, hitStop = 0.05 }
Config.RESPAWN = { seconds = 3, invulnSeconds = 2 }
Config.ITEMS = {
	crateHits = 2, crateRespawn = 30, heartHeal = 30, dropHeart = 0.3, dropBomb = 0.2,
	bombFuse = 3, bombRadius = 9.5, bombDamage = 20, throwSpeedH = 28, throwSpeedV = 12, crateThrowDamage = 8, pickupDistance = 6,
}
Config.PROJECTILE = { maxAlive = 40, step = 1 / 30 }
Config.MATCH = { lobbySeconds = 20, countdownSeconds = 3, resultSeconds = 10, minFighters = 2, endWarning = 5 }
Config.MODES = {
	ffa_dm = { label = "개인 데스매치", teams = false, lives = 0, seconds = 180 },
	team_dm = { label = "팀 데스매치", teams = true, lives = 0, seconds = 180 },
	survival = { label = "서바이벌", teams = false, lives = 1, seconds = 120 },
}
Config.MODE_ORDER = { "ffa_dm", "team_dm", "survival" }
-- 맵. fallY 아래로 떨어지면 KO(링아웃). 콜로세움은 벽이 있어 떨어질 수 없지만 안전망으로 같은 규칙을 둔다.
Config.MAPS = {
	colosseum = { label = "콜로세움", fallY = -60, ringout = false, clock = 17.5 },
	skydock = { label = "스카이독", fallY = -40, ringout = true, clock = 13 },
}
Config.MAP_ORDER = { "colosseum", "skydock" }
Config.PAD = { launchSpeed = 70 }
Config.BOTS = { fillTo = 4, max = 7, reaction = 0.25, edgeProbe = 2.5, guardChance = 0.2, heavyChance = 0.3 }
Config.LIMITS = { players = 8, fighters = 8, commandBurst = 30, commandRefillPerSecond = 20, mashInterval = 0.08 }
Config.CAMERA = { minZoom = 8, maxZoom = 20 }
Config.TEAMS = { { id = 1, label = "레드", color = { 226, 86, 70 } }, { id = 2, label = "블루", color = { 82, 150, 232 } } }

return Config
