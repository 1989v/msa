--!nonstrict
-- 액세서리 5 — 스타일당 하나, 들면 약공·강공·기술이 통째로 바뀐다(겟앰프드식). 모델은 빌더가 Part 로 만들어 ServerStorage 에 둔다.
-- grip: 손(R6 Right Arm) 기준 부착 오프셋 {x,y,z}·회전(deg). twoHanded 면 잡기 불가.
local Accessories = {}

Accessories.ORDER = { "rocket", "shield", "pistols", "greatsword", "spear" }

Accessories.DEF = {
	none = { label = "맨손", desc = "스타일의 기본기", style = nil, light = nil, heavy = nil, special = nil, specialCooldown = 0, speedMult = 1, twoHanded = false, projectile = false, ammo = 0, reload = 0 },
	rocket = {
		label = "부스터", desc = "로켓 글러브 — 리치 긴 펀치 3단, 강공 강펀치. 기술 로켓 펀치 발사(투사체).",
		style = "fighter", light = { "rk1", "rk2", "rk3" }, heavy = { "rkHeavy" }, special = "rocketPunch", specialCooldown = 5,
		speedMult = 1.0, twoHanded = false, projectile = true, ammo = 0, reload = 0, grip = { hand = "right", offset = { 0, -1.1, 0 }, rot = { 0, 0, 0 } },
	},
	shield = {
		label = "월", desc = "방패 — 방패 잽·밀치기, 강공 방패 슬램. 기술 실드 차지(가드 유지 돌진). 가드 크러시 면역, 가드 각 150°.",
		style = "grappler", light = { "shieldJab", "shieldBash" }, heavy = { "shieldSlam" }, special = "shieldCharge", specialCooldown = 5,
		speedMult = 0.95, twoHanded = false, projectile = false, ammo = 0, reload = 0, guardAngle = 150, crushImmune = true, grip = { hand = "left", offset = { -0.6, -0.6, 0 }, rot = { 0, 0, 0 } },
	},
	pistols = {
		label = "더블탭", desc = "쌍권총 — 약공은 총열로 후려치는 근접 2단, 강공은 2연발(사거리 15). 기술 백롤 난사(뒤로 구르며 부채꼴 6발). 탄 12.",
		style = "speedster", light = { "gunWhip", "gunWhip2" }, heavy = { "gunBurst" }, special = "gunRoll", specialCooldown = 6,
		speedMult = 1.0, twoHanded = false, projectile = true, ammo = 12, reload = 1.5, grip = { hand = "right", offset = { 0, -1.0, -0.3 }, rot = { -90, 0, 0 } },
	},
	greatsword = {
		label = "브레이커", desc = "대검 — 2단 대각 베기(호 120°), 강공 가로베기·내려찍기. 기술 점프 내려찍기 충격파. 이동 −10%, 잡기 불가.",
		style = "heavy", light = { "gs1", "gs2" }, heavy = { "gsSweep", "gsOverhead" }, special = "gsSlam", specialCooldown = 6,
		speedMult = 0.9, twoHanded = true, projectile = false, ammo = 0, reload = 0, grip = { hand = "right", offset = { 0, -1.0, 0 }, rot = { 0, 0, 0 } },
	},
	spear = {
		label = "스파이크", desc = "장창 — 찌르기 2단(리치 6.5), 강공 찌르기·후려치기. 기술 돌진 찌르기(관통). 판정이 직선이라 옆이 약하다.",
		style = "martial", light = { "sp1", "sp2" }, heavy = { "sp3", "spSweep" }, special = "spCharge", specialCooldown = 5,
		speedMult = 1.0, twoHanded = false, projectile = false, ammo = 0, reload = 0, grip = { hand = "right", offset = { 0, -1.0, 0 }, rot = { 0, 0, 0 } },
	},
}

function Accessories.get(id) return Accessories.DEF[id] end

return Accessories
