--!nonstrict
-- 무브 프레임 데이터. 단위 초·스터드·스터드/초. 발동(startup) → 지속(active, 판정) → 후딜(recovery). 다음 타는 후딜이 끝나야 나간다.
-- 경직(hitstun)은 후딜 + 다음 발동보다 짧게 둔다 — 사슬은 「확정 콤보」가 아니라 「압박」이고 맞는 쪽이 사이에 가드·대시를 끼운다(웹 참고작 3차 소감).
-- pose 는 Poses.luau 의 템플릿 이름(절차 포즈). 투사체 무브는 PROJECTILE 에 스펙이 있어야 한다.
-- stepIn 은 발동+지속 동안 앞으로 내딛는 속도(스터드/초) — 제자리 공격은 인형극처럼 보인다. moveSpeed 는 지속 구간의 돌진(태클·차지)이다.
local Moves = {}

local BASE = { hitstun = 0.17, push = 9, launchH = 24, launchV = 46, arcDeg = 110, moveSpeed = 0, stepIn = 0, pierce = false, guardBreak = false, untilLand = false, multiHit = 0, superArmor = false, pose = "punchR" }

local function def(id, t)
	local m = {}
	for k, v in BASE do m[k] = v end
	for k, v in t do m[k] = v end
	m.id = id
	return m
end

Moves.DEF = {
	-- 공통
	grab = def("grab", { startup = 0.07, active = 0.04, recovery = 0.2, damage = 0, reach = 0, radius = 0, effect = "grab", pose = "grab" }),
	throw = def("throw", { startup = 0.17, active = 0.02, recovery = 0.33, damage = 0, reach = 0, radius = 0, effect = "throw", pose = "throw" }),
	tackle = def("tackle", { startup = 0.17, active = 0.13, recovery = 0.33, damage = 8, reach = 3.6, radius = 1.8, effect = "launch", launchH = 20, launchV = 33, moveSpeed = 18, pose = "tackle" }),
	airAttack = def("airAttack", { startup = 0.08, active = 0.05, recovery = 0.2, damage = 7, reach = 4.3, radius = 1.8, effect = "hitstun", hitstun = 0.23, push = 12, pose = "kickR" }),
	divekick = def("divekick", { startup = 0.12, active = 0, recovery = 0.25, damage = 9, reach = 3.0, radius = 1.8, effect = "launch", launchH = 16, launchV = 33, untilLand = true, pose = "dive" }),
	counter = def("counter", { startup = 0.07, active = 0.05, recovery = 0.27, damage = 8, reach = 3.9, radius = 1.95, effect = "launch", launchH = 24, launchV = 39, pose = "uppercutR" }),
	itemThrow = def("itemThrow", { startup = 0.1, active = 0, recovery = 0.2, damage = 0, reach = 0, radius = 0, effect = "none", pose = "throwItem" }),
	-- 파이터
	jab = def("jab", { startup = 0.1, active = 0.05, recovery = 0.22, damage = 6, reach = 4.0, radius = 1.65, effect = "hitstun", hitstun = 0.23, push = 9, stepIn = 8, pose = "punchL" }),
	straight = def("straight", { startup = 0.12, active = 0.05, recovery = 0.25, damage = 7, reach = 4.3, radius = 1.65, effect = "hitstun", hitstun = 0.27, push = 12, stepIn = 10, pose = "punchR" }),
	lowkick = def("lowkick", { startup = 0.12, active = 0.05, recovery = 0.23, damage = 6, reach = 4.8, radius = 1.65, effect = "hitstun", hitstun = 0.23, push = 12, stepIn = 6, pose = "lowKickR" }),
	roundhouse = def("roundhouse", { startup = 0.2, active = 0.08, recovery = 0.38, damage = 11, reach = 4.6, radius = 2.1, effect = "launch", launchH = 24, launchV = 46, pose = "roundhouse" }),
	haymaker = def("haymaker", { startup = 0.23, active = 0.07, recovery = 0.43, damage = 15, reach = 4.5, radius = 2.1, effect = "launch", launchH = 28, launchV = 46, pose = "haymaker" }),
	uppercut = def("uppercut", { startup = 0.28, active = 0.07, recovery = 0.47, damage = 14, reach = 3.75, radius = 2.1, effect = "launch", launchH = 8, launchV = 58, pose = "uppercutR" }),
	-- 그래플러
	hook = def("hook", { startup = 0.13, active = 0.05, recovery = 0.3, damage = 8, reach = 4.0, radius = 1.8, effect = "hitstun", hitstun = 0.3, push = 12, stepIn = 6, pose = "swingR" }),
	hook2 = def("hook2", { startup = 0.13, active = 0.05, recovery = 0.27, damage = 8, reach = 4.0, radius = 1.8, effect = "hitstun", hitstun = 0.3, push = 12, stepIn = 6, pose = "swingL" }),
	headbutt = def("headbutt", { startup = 0.15, active = 0.05, recovery = 0.3, damage = 10, reach = 3.0, radius = 1.8, effect = "hitstun", hitstun = 0.33, push = 18, stepIn = 12, pose = "headbutt" }),
	bodySlam = def("bodySlam", { startup = 0.23, active = 0.08, recovery = 0.42, damage = 12, reach = 4.2, radius = 2.25, effect = "launch", launchH = 20, launchV = 52, superArmor = true, pose = "slam" }),
	lariat = def("lariat", { startup = 0.22, active = 0.08, recovery = 0.4, damage = 14, reach = 4.2, radius = 2.4, effect = "launch", launchH = 28, launchV = 39, arcDeg = 160, pose = "lariat" }),
	dashGrab = def("dashGrab", { startup = 0.07, active = 0.37, recovery = 0.23, damage = 0, reach = 3.0, radius = 1.5, effect = "grab", moveSpeed = 27, pose = "charge" }),
	-- 스피드스타
	quick1 = def("quick1", { startup = 0.07, active = 0.04, recovery = 0.15, damage = 4, reach = 3.9, radius = 1.5, effect = "hitstun", hitstun = 0.2, push = 6, stepIn = 12, pose = "flurryL" }),
	quick2 = def("quick2", { startup = 0.07, active = 0.04, recovery = 0.15, damage = 4, reach = 3.9, radius = 1.5, effect = "hitstun", hitstun = 0.2, push = 6, stepIn = 12, pose = "flurryR" }),
	quick3 = def("quick3", { startup = 0.08, active = 0.04, recovery = 0.17, damage = 6, reach = 4.0, radius = 1.5, effect = "hitstun", hitstun = 0.23, push = 9, stepIn = 12, pose = "flurryKick" }),
	quick4 = def("quick4", { startup = 0.13, active = 0.07, recovery = 0.33, damage = 8, reach = 4.5, radius = 1.95, effect = "launch", launchH = 24, launchV = 39, pose = "spinBackKick" }),
	flipKick = def("flipKick", { startup = 0.22, active = 0.08, recovery = 0.4, damage = 12, reach = 4.2, radius = 2.1, effect = "launch", launchH = 10, launchV = 58, pose = "flipKick" }),
	axeKick = def("axeKick", { startup = 0.25, active = 0.07, recovery = 0.43, damage = 13, reach = 4.5, radius = 1.95, effect = "launch", launchH = 12, launchV = 58, pose = "axeKick" }),
	spinKick = def("spinKick", { startup = 0.17, active = 0.3, recovery = 0.3, damage = 4, reach = 1.8, radius = 3.9, effect = "hitstun", hitstun = 0.17, push = 12, arcDeg = 360, multiHit = 0.1, pose = "spin" }),
	-- 헤비
	hammer1 = def("hammer1", { startup = 0.15, active = 0.07, recovery = 0.3, damage = 9, reach = 4.2, radius = 2.1, effect = "hitstun", hitstun = 0.3, push = 15, stepIn = 4, pose = "overhead" }),
	hammer2 = def("hammer2", { startup = 0.17, active = 0.07, recovery = 0.33, damage = 10, reach = 4.35, radius = 2.1, effect = "hitstun", hitstun = 0.33, push = 18, stepIn = 4, pose = "overheadL" }),
	heavy1 = def("heavy1", { startup = 0.22, active = 0.07, recovery = 0.38, damage = 12, reach = 4.35, radius = 2.1, effect = "hitstun", hitstun = 0.33, push = 18, superArmor = true, stepIn = 10, pose = "shoulderCheck" }),
	heavy2 = def("heavy2", { startup = 0.28, active = 0.08, recovery = 0.5, damage = 16, reach = 4.5, radius = 2.4, effect = "launch", launchH = 28, launchV = 46, superArmor = true, pose = "groundPound" }),
	quake = def("quake", { startup = 0.4, active = 0.07, recovery = 0.55, damage = 18, reach = 1.5, radius = 7.8, effect = "launch", launchH = 20, launchV = 52, arcDeg = 360, pierce = true, superArmor = true, pose = "quake" }),
	-- 마셜
	kick1 = def("kick1", { startup = 0.12, active = 0.05, recovery = 0.23, damage = 6, reach = 4.8, radius = 1.65, effect = "hitstun", hitstun = 0.23, push = 12, stepIn = 6, pose = "kickR" }),
	kick2 = def("kick2", { startup = 0.13, active = 0.05, recovery = 0.25, damage = 7, reach = 5.1, radius = 1.65, effect = "hitstun", hitstun = 0.27, push = 15, stepIn = 6, pose = "kickL" }),
	knee = def("knee", { startup = 0.13, active = 0.05, recovery = 0.27, damage = 8, reach = 3.6, radius = 1.65, effect = "hitstun", hitstun = 0.27, push = 12, stepIn = 12, pose = "knee" }),
	kick3 = def("kick3", { startup = 0.22, active = 0.08, recovery = 0.42, damage = 12, reach = 5.4, radius = 2.1, effect = "launch", launchH = 28, launchV = 39, pose = "highKickR" }),
	flyingKick = def("flyingKick", { startup = 0.12, active = 0.27, recovery = 0.3, damage = 12, reach = 3.9, radius = 2.1, effect = "launch", launchH = 24, launchV = 39, moveSpeed = 27, pose = "flyKick" }),
	-- 브레이커(대검)
	gs1 = def("gs1", { startup = 0.18, active = 0.07, recovery = 0.3, damage = 10, reach = 5.55, radius = 2.4, effect = "hitstun", hitstun = 0.33, push = 18, arcDeg = 120, pose = "slashR" }),
	gs2 = def("gs2", { startup = 0.23, active = 0.08, recovery = 0.47, damage = 14, reach = 5.55, radius = 2.4, effect = "launch", launchH = 24, launchV = 46, arcDeg = 120, pose = "slashL" }),
	gsSweep = def("gsSweep", { startup = 0.17, active = 0.07, recovery = 0.3, damage = 10, reach = 5.55, radius = 2.4, effect = "hitstun", hitstun = 0.33, push = 18, arcDeg = 150, pose = "sweep" }),
	gsOverhead = def("gsOverhead", { startup = 0.27, active = 0.08, recovery = 0.5, damage = 17, reach = 5.7, radius = 2.7, effect = "launch", launchH = 20, launchV = 58, arcDeg = 90, pose = "overhead" }),
	gsSlam = def("gsSlam", { startup = 0.43, active = 0.07, recovery = 0.55, damage = 20, reach = 1.8, radius = 7.5, effect = "launch", launchH = 20, launchV = 52, arcDeg = 360, pierce = true, pose = "quake" }),
	-- 스파이크(장창)
	sp1 = def("sp1", { startup = 0.12, active = 0.05, recovery = 0.22, damage = 7, reach = 6.45, radius = 1.35, effect = "hitstun", hitstun = 0.23, push = 12, arcDeg = 60, pose = "thrust" }),
	sp2 = def("sp2", { startup = 0.12, active = 0.05, recovery = 0.22, damage = 7, reach = 6.45, radius = 1.35, effect = "hitstun", hitstun = 0.27, push = 12, arcDeg = 60, pose = "thrustLow" }),
	sp3 = def("sp3", { startup = 0.18, active = 0.07, recovery = 0.33, damage = 13, reach = 6.75, radius = 1.5, effect = "launch", launchH = 24, launchV = 39, arcDeg = 60, pose = "thrust" }),
	spSweep = def("spSweep", { startup = 0.2, active = 0.08, recovery = 0.4, damage = 13, reach = 5.7, radius = 2.4, effect = "launch", launchH = 28, launchV = 39, arcDeg = 170, pose = "spearSweep" }),
	spCharge = def("spCharge", { startup = 0.12, active = 0.5, recovery = 0.38, damage = 14, reach = 5.4, radius = 1.8, effect = "launch", launchH = 24, launchV = 39, arcDeg = 40, moveSpeed = 36, pierce = true, pose = "spearCharge" }),
	-- 월(방패)
	shieldJab = def("shieldJab", { startup = 0.1, active = 0.05, recovery = 0.2, damage = 7, reach = 3.6, radius = 1.65, effect = "hitstun", hitstun = 0.23, push = 12, pose = "shieldBash" }),
	shieldBash = def("shieldBash", { startup = 0.13, active = 0.05, recovery = 0.25, damage = 9, reach = 3.75, radius = 1.8, effect = "hitstun", hitstun = 0.27, push = 18, pose = "shieldBash" }),
	shieldSlam = def("shieldSlam", { startup = 0.22, active = 0.07, recovery = 0.4, damage = 14, reach = 3.9, radius = 2.1, effect = "launch", launchH = 28, launchV = 39, pose = "shieldSlam" }),
	shieldCharge = def("shieldCharge", { startup = 0.12, active = 0.63, recovery = 0.33, damage = 12, reach = 3.3, radius = 1.8, effect = "launch", launchH = 24, launchV = 33, moveSpeed = 24, guardsWhileActive = true, pose = "charge" }),
	-- 더블탭(쌍권총)
	gunWhip = def("gunWhip", { startup = 0.1, active = 0.05, recovery = 0.22, damage = 7, reach = 4.35, radius = 1.65, effect = "hitstun", hitstun = 0.23, push = 9, pose = "gunWhip" }),
	gunWhip2 = def("gunWhip2", { startup = 0.12, active = 0.05, recovery = 0.25, damage = 9, reach = 4.5, radius = 1.65, effect = "hitstun", hitstun = 0.27, push = 12, pose = "gunWhipL" }),
	gunBurst = def("gunBurst", { startup = 0.1, active = 0.02, recovery = 0.37, damage = 4, reach = 0, radius = 0, effect = "projectile", hitstun = 0.05, push = 6, pose = "shoot" }),
	gunRoll = def("gunRoll", { startup = 0.08, active = 0.33, recovery = 0.22, damage = 4, reach = 0, radius = 0, effect = "projectile", hitstun = 0.13, push = 6, moveSpeed = -27, pose = "roll" }),
	-- 부스터(로켓 글러브)
	rk1 = def("rk1", { startup = 0.1, active = 0.05, recovery = 0.22, damage = 6, reach = 5.25, radius = 1.65, effect = "hitstun", hitstun = 0.23, push = 9, pose = "punchR" }),
	rk2 = def("rk2", { startup = 0.12, active = 0.05, recovery = 0.25, damage = 6, reach = 5.55, radius = 1.65, effect = "hitstun", hitstun = 0.27, push = 12, pose = "punchL" }),
	rk3 = def("rk3", { startup = 0.2, active = 0.08, recovery = 0.38, damage = 11, reach = 5.85, radius = 2.1, effect = "launch", launchH = 24, launchV = 46, pose = "hookR" }),
	rkHeavy = def("rkHeavy", { startup = 0.23, active = 0.08, recovery = 0.43, damage = 14, reach = 6.0, radius = 2.1, effect = "launch", launchH = 28, launchV = 46, pose = "uppercutR" }),
	rocketPunch = def("rocketPunch", { startup = 0.17, active = 0.02, recovery = 0.3, damage = 16, reach = 0, radius = 0, effect = "projectile", launchH = 24, launchV = 39, pose = "rocket" }),
}

-- 투사체: 속도·사거리·반지름(스터드), 부채꼴 발 수·각. 판정은 서버 Projectiles 가 한다.
Moves.PROJECTILE = {
	gunBurst = { speed = 66, range = 15, radius = 0.9, fanCount = 2, fanDeg = 6, ammo = 2, effect = "hitstun" },
	gunRoll = { speed = 66, range = 36, radius = 0.9, fanCount = 6, fanDeg = 60, ammo = 6, effect = "hitstun" },
	rocketPunch = { speed = 42, range = 30, radius = 1.5, fanCount = 1, fanDeg = 0, ammo = 0, effect = "launch" },
}

Moves.GRAB_MOVES = { grab = true, dashGrab = true }

function Moves.get(id) return Moves.DEF[id] end
function Moves.duration(m) return m.startup + m.active + m.recovery end
function Moves.isActive(m, t) return t >= m.startup and (m.untilLand or t < m.startup + m.active) end
function Moves.ids()
	local out = {}
	for id in Moves.DEF do table.insert(out, id) end
	table.sort(out)
	return out
end

return Moves
