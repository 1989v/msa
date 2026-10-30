--!nonstrict
-- 스타일 5. 맨손 약공·강공 사슬·기술·스탯 증감·몸집·전용 액세서리 하나. 액세서리를 들면 공격은 액세서리 것이 되고 패시브는 남는다.
-- 색은 CLI 에서도 읽히도록 {r,g,b} 표다(Roblox 쪽이 Color3 로 바꾼다).
local Styles = {}

Styles.ORDER = { "fighter", "grappler", "speedster", "heavy", "martial" }

Styles.DEF = {
	fighter = {
		label = "파이터", desc = "잽·스트레이트·로킥, 강공 돌려차기·헤이메이커. 기술 어퍼컷. 균형 잡힌 기본형.",
		light = { "jab", "straight", "lowkick" }, heavy = { "roundhouse", "haymaker" }, special = "uppercut", specialCooldown = 3,
		stats = {}, speedMult = 1.0, grabRange = 3.0, throwDamage = 15, airDashes = 0, accessory = "rocket", scale = 1.0,
		color = { 236, 180, 60 },
	},
	grappler = {
		label = "그래플러", desc = "훅·훅·박치기, 강공 바디슬램(슈퍼아머)·래리어트. 기술 대시 잡기. 잡기 범위·던지기가 세다.",
		light = { "hook", "hook2", "headbutt" }, heavy = { "bodySlam", "lariat" }, special = "dashGrab", specialCooldown = 5,
		stats = { hp = 1, def = 1, spd = -1 }, speedMult = 0.95, grabRange = 3.9, throwDamage = 22, airDashes = 0, accessory = "shield", scale = 1.1,
		color = { 150, 72, 58 },
	},
	speedster = {
		label = "스피드스타", desc = "낮은 자세 3단 속공, 강공 뒤돌려차기·공중제비 차기. 기술 회전 발차기(다단). 이동 +15%, 공중 대시 1회, 방어 −1.",
		light = { "quick1", "quick2", "quick3" }, heavy = { "quick4", "flipKick" }, special = "spinKick", specialCooldown = 4,
		stats = { spd = 2, jmp = 1, def = -1 }, speedMult = 1.15, grabRange = 3.0, throwDamage = 12, airDashes = 1, accessory = "pistols", scale = 0.92,
		color = { 112, 206, 160 },
	},
	heavy = {
		label = "헤비", desc = "해머 2단, 강공 어깨 박치기·양손 내려찍기(슈퍼아머). 기술 지진(반경 띄움). 체력 +2·방어 +1, 이동 −10%.",
		light = { "hammer1", "hammer2" }, heavy = { "heavy1", "heavy2" }, special = "quake", specialCooldown = 7,
		stats = { hp = 2, def = 1, spd = -2 }, speedMult = 0.9, grabRange = 3.3, throwDamage = 18, airDashes = 0, accessory = "greatsword", scale = 1.18,
		color = { 118, 110, 102 },
	},
	martial = {
		label = "마셜", desc = "발차기·발차기·무릎, 강공 상단차기·도끼차기(리치 김). 기술 비연각. 점프 +2, 근력 +1, 체력 −1.",
		light = { "kick1", "kick2", "knee" }, heavy = { "kick3", "axeKick" }, special = "flyingKick", specialCooldown = 5,
		stats = { jmp = 2, atk = 1, hp = -1 }, speedMult = 1.05, grabRange = 3.0, throwDamage = 14, airDashes = 0, accessory = "spear", scale = 1.0,
		color = { 216, 69, 46 },
	},
}

function Styles.get(id) return Styles.DEF[id] end

return Styles
