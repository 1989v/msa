--!nonstrict
-- 절차 포즈. 업로드 애니메이션 없이 6개 논리 관절(root·neck·rs·ls·rh·lh)의 각도로 공격·피격·다운 동작을 만든다.
-- 클라이언트 Poser 가 매 Stepped 에 Motor6D.Transform 으로 쓴다(R6 기본, R15 는 같은 각도를 상완·허벅지 관절에 매핑).
-- 각도는 도(deg). fwd = 팔·다리를 앞으로 들기(+), out = 바깥으로 벌리기(+). root: pitch(+ 앞으로 숙임)·yaw(+ 왼쪽으로 틀기)·roll, dy(스터드, − 는 내려감)·dz(+ 앞으로 내밈).
-- 템플릿은 windup(발동 끝) → strike(지속, 후딜 앞 40% 까지 고정 — 뻗은 자세가 눈에 남게) → idle 로 돌아온다.
local Poses = {}

local function J(fwd, out) return { fwd = fwd or 0, out = out or 0 } end
local function R(pitch, yaw, roll, dy, dz) return { pitch = pitch or 0, yaw = yaw or 0, roll = roll or 0, dy = dy or 0, dz = dz or 0 } end
local function N(pitch, yaw) return { pitch = pitch or 0, yaw = yaw or 0 } end
local function P(root, neck, rs, ls, rh, lh)
	return { root = root or R(), neck = neck or N(), rs = rs or J(), ls = ls or J(), rh = rh or J(), lh = lh or J() }
end

Poses.IDLE = P()

local T = {}
T.punchR = { windup = P(R(0, -20), N(), J(40, 10), J(30, 10)), strike = P(R(8, 25, 0, 0, 0.3), N(5), J(95, 0), J(20, 10)) }
T.punchL = { windup = P(R(0, 20), N(), J(30, 10), J(40, 10)), strike = P(R(8, -25, 0, 0, 0.3), N(5), J(20, 10), J(95, 0)) }
T.gunWhip = { windup = P(R(0, -25), N(), J(50, 30), J(30, 10)), strike = P(R(8, 30, 0, 0, 0.3), N(5), J(90, -15), J(20, 10)) }
T.gunWhipL = { windup = P(R(0, 25), N(), J(30, 10), J(50, 30)), strike = P(R(8, -30, 0, 0, 0.3), N(5), J(20, 10), J(90, -15)) }
T.lowKickR = { windup = P(R(-5, -10), N(), J(20, 10), J(30, 15), J(-25)), strike = P(R(15, 15, 0, 0, 0.2), N(), J(30, 10), J(50, 20), J(70, 0), J(-10)) }
T.kickR = { windup = P(R(-5, -10), N(), J(20, 10), J(30, 15), J(-30)), strike = P(R(10, 10, 0, 0, 0.2), N(), J(30, 10), J(50, 20), J(90, 0), J(-10)) }
T.kickL = { windup = P(R(-5, 10), N(), J(30, 15), J(20, 10), J(0), J(-30)), strike = P(R(10, -10, 0, 0, 0.2), N(), J(50, 20), J(30, 10), J(-10), J(90, 0)) }
T.highKickR = { windup = P(R(-10, -20), N(), J(20, 20), J(40, 20), J(-30)), strike = P(R(-5, 30, 0, 0, 0.2), N(), J(30, 30), J(60, 30), J(120, 20), J(-10)) }
T.axeKick = { windup = P(R(-10, 0), N(-10), J(40, 20), J(40, 20), J(140, 10)), strike = P(R(20, 0, 0, 0, 0.3), N(10), J(20, 10), J(20, 10), J(60, 0), J(-10)) }
T.knee = { windup = P(R(-5, 0), N(), J(40, 10), J(40, 10), J(-20)), strike = P(R(10, 0, 0, 0, 0.2), N(), J(60, 20), J(60, 20), J(110, 0), J(-10)) }
T.flyKick = { windup = P(R(-10, 0), N(), J(40, 30), J(40, 30), J(-30)), strike = P(R(10, 0, 0, 0.2, 0.3), N(), J(60, 40), J(60, 40), J(100, 10), J(-40)), holdAll = true }
T.uppercutR = { windup = P(R(25, -15, 0, -0.6), N(5), J(-40, 10), J(30, 10), J(20), J(20)), strike = P(R(-15, 15, 0, 0.4), N(-10), J(160, 10), J(20, 10), J(-10), J(10)) }
T.hookR = { windup = P(R(0, -35), N(), J(60, 70), J(30, 10)), strike = P(R(8, 35, 0, 0, 0.2), N(), J(90, 10), J(20, 10)) }
T.hookL = { windup = P(R(0, 35), N(), J(30, 10), J(60, 70)), strike = P(R(8, -35, 0, 0, 0.2), N(), J(20, 10), J(90, 10)) }
T.headbutt = { windup = P(R(-25, 0), N(-20), J(30, 20), J(30, 20)), strike = P(R(35, 0, 0, 0, 0.6), N(30), J(40, 30), J(40, 30)) }
T.slam = { windup = P(R(-20, 0), N(-10), J(170, 20), J(170, 20)), strike = P(R(40, 0, 0, -0.5, 0.3), N(20), J(60, 10), J(60, 10), J(30), J(-10)) }
T.lariat = { windup = P(R(0, -60), N(), J(90, 90), J(20, 10)), strike = P(R(5, 50, 0, 0, 0.2), N(), J(90, 20), J(20, 10)) }
T.spin = { windup = P(R(0, -30), N(), J(60, 40), J(60, 40), J(20)), strike = P(R(0, 0), N(), J(80, 60), J(80, 60), J(90, 30), J(-10)), spinYaw = 720, holdAll = true }
T.overhead = { windup = P(R(-15, 0), N(-10), J(175, 10), J(160, 10)), strike = P(R(30, 0, 0, 0, 0.4), N(15), J(70, 0), J(60, 0), J(20), J(-10)) }
T.overheadL = { windup = P(R(-15, 0), N(-10), J(160, 10), J(175, 10)), strike = P(R(30, 0, 0, 0, 0.4), N(15), J(60, 0), J(70, 0), J(-10), J(20)) }
T.slashR = { windup = P(R(-5, -45), N(), J(120, 60), J(60, 20)), strike = P(R(10, 45, 0, 0, 0.3), N(5), J(60, -30), J(40, 20), J(20), J(-10)) }
T.slashL = { windup = P(R(-5, 45), N(), J(120, -40), J(60, 20)), strike = P(R(10, -45, 0, 0, 0.3), N(5), J(60, 40), J(40, 20), J(-10), J(20)) }
T.sweep = { windup = P(R(0, -70), N(), J(80, 60), J(60, 20)), strike = P(R(5, 70, 0, 0, 0.2), N(), J(85, -20), J(60, 10), J(20), J(-10)) }
T.thrust = { windup = P(R(0, -25), N(), J(50, 15), J(60, 10)), strike = P(R(10, 20, 0, 0, 0.5), N(), J(95, 0), J(70, 10), J(20), J(-20)) }
T.thrustLow = { windup = P(R(0, -25), N(), J(50, 15), J(60, 10)), strike = P(R(25, 20, 0, -0.5, 0.5), N(), J(80, 0), J(60, 10), J(40), J(-20)) }
T.charge = { windup = P(R(10, 0), N(), J(60, 10), J(60, 10)), strike = P(R(25, 0, 0, 0, 0.4), N(-5), J(90, 0), J(90, 20), J(30), J(-30)), holdAll = true }
T.tackle = { windup = P(R(15, 0), N(), J(60, 20), J(60, 20)), strike = P(R(45, 0, 0, 0, 0.8), N(-10), J(100, 20), J(100, 20), J(20), J(-20)), holdAll = true }
T.dive = { windup = P(R(10, 0), N(), J(80, 40), J(80, 40), J(60)), strike = P(R(30, 0, 0, 0, 0.3), N(), J(120, 40), J(120, 40), J(110, 0), J(20)), holdAll = true }
T.shieldBash = { windup = P(R(0, 25), N(), J(20, 10), J(40, -10)), strike = P(R(8, -20, 0, 0, 0.4), N(5), J(20, 10), J(90, 0)) }
T.shieldSlam = { windup = P(R(-15, 10), N(-10), J(40, 20), J(150, 10)), strike = P(R(30, -10, 0, 0, 0.3), N(15), J(30, 10), J(60, 0), J(20), J(-10)) }
T.shoot = { windup = P(R(0, 0), N(), J(60, 10), J(60, 10)), strike = P(R(5, 0, 0, 0, 0.2), N(), J(90, 0), J(90, 0)) }
T.roll = { windup = P(R(-10, 0), N(), J(60, 10), J(60, 10)), strike = P(R(-40, 0, 0, -1.0, 0), N(), J(90, 10), J(90, 10), J(60), J(60)), rollPitch = -360, holdAll = true }
T.quake = { windup = P(R(-20, 0, 0, 0.5), N(-15), J(175, 10), J(175, 10)), strike = P(R(45, 0, 0, -1.2, 0.3), N(20), J(60, 20), J(60, 20), J(60), J(-20)) }
T.grab = { windup = P(R(5, 0), N(), J(50, 20), J(50, -20)), strike = P(R(10, 0, 0, 0, 0.3), N(), J(80, 20), J(80, -20)) }
T.throw = { windup = P(R(-10, -30), N(), J(100, 30), J(100, -30)), strike = P(R(25, 40, 0, 0, 0.5), N(10), J(60, 40), J(60, -40), J(20), J(-10)) }
T.throwItem = { windup = P(R(-10, -20), N(-5), J(170, 20), J(30, 10)), strike = P(R(25, 20, 0, 0, 0.4), N(10), J(70, 0), J(30, 10)) }
T.rocket = { windup = P(R(0, -30), N(), J(40, 10), J(40, 10)), strike = P(R(10, 20, 0, 0, 0.4), N(), J(95, 0), J(30, 10)), hold = 0.7 }
-- 스타일 고유 템플릿 — 다섯 스타일의 사슬(맨손 + 전용 액세서리)은 서로 템플릿을 공유하지 않는다(테스트가 잰다). 몸통 회전·낮은 자세·전진량으로 실루엣을 가른다.
-- 파이터(복싱): 돌려차기·헤이메이커는 몸통이 크게 돈다
T.roundhouse = { windup = P(R(-5, -45), N(0, 20), J(40, 30), J(60, 20), J(-20, 10), J(0)), strike = P(R(5, 60, 0, 0, 0.2), N(0, -20), J(60, 40), J(40, 20), J(100, 60), J(-15)) }
T.haymaker = { windup = P(R(-10, -55, 0, 0, -0.3), N(0, 20), J(-30, 90), J(50, 20), J(10), J(-10)), strike = P(R(15, 50, 0, 0, 0.5), N(5, -15), J(100, 40), J(30, 10), J(20), J(-20)) }
-- 그래플러: 팔을 옆으로 크게 휘두른다(훅보다 넓고 느리게 보이게)
T.swingR = { windup = P(R(5, -60, 0, -0.2), N(0, 15), J(20, 100), J(40, 30), J(10), J(-10)), strike = P(R(10, 45, 0, 0, 0.3), N(0, -10), J(80, 50), J(40, 30), J(20), J(-20)) }
T.swingL = { windup = P(R(5, 60, 0, -0.2), N(0, -15), J(40, 30), J(20, 100), J(-10), J(10)), strike = P(R(10, -45, 0, 0, 0.3), N(0, 10), J(40, 30), J(80, 50), J(-20), J(20)) }
-- 스피드스타: 낮은 자세에서 손바닥 연타·무릎, 뒤돌려차기, 공중제비 차기
T.flurryL = { windup = P(R(15, 15, 0, -0.4), N(-5), J(40, 20), J(20, 40), J(20), J(-10)), strike = P(R(20, -15, 0, -0.4, 0.4), N(0), J(30, 20), J(110, -10), J(30), J(-20)) }
T.flurryR = { windup = P(R(15, -15, 0, -0.4), N(-5), J(20, 40), J(40, 20), J(-10), J(20)), strike = P(R(20, 15, 0, -0.4, 0.4), N(0), J(110, -10), J(30, 20), J(-20), J(30)) }
T.flurryKick = { windup = P(R(10, 20, 0, -0.5), N(), J(50, 30), J(50, 30), J(-20), J(10)), strike = P(R(-5, -10, 0, 0.2, 0.2), N(), J(40, 40), J(40, 40), J(110, 20), J(-20)) }
T.spinBackKick = { windup = P(R(5, -70, 0, -0.3), N(0, 30), J(60, 50), J(60, 50), J(-10), J(10)), strike = P(R(-15, 150, 0, 0.1, 0.1), N(0, -40), J(80, 60), J(80, 60), J(120, 10), J(-20)) }
T.flipKick = { windup = P(R(25, 0, 0, -0.6), N(10), J(60, 30), J(60, 30), J(30), J(30)), strike = P(R(-70, 0, 0, 0.8, 0.3), N(-20), J(150, 40), J(150, 40), J(140, 10), J(10)) }
-- 헤비: 어깨 박치기·양손 내려찍기
T.shoulderCheck = { windup = P(R(-5, 35, -10, -0.2), N(0, -20), J(-30, 20), J(30, 40), J(10), J(-10)), strike = P(R(34, -40, 25, -0.3, 0.8), N(0, 20), J(-20, 30), J(50, 50), J(30), J(-30)) }
T.groundPound = { windup = P(R(-25, 0, 0, 0.3), N(-15), J(175, 25), J(175, 25), J(-10), J(-10)), strike = P(R(45, 0, 0, -1.0, 0.4), N(20), J(70, 15), J(70, 15), J(70), J(-15)) }
-- 마셜 장창: 낮게 쓸기·창 돌진
T.spearSweep = { windup = P(R(5, -80, 0, -0.5), N(0, 30), J(60, 70), J(70, 30), J(20), J(-10)), strike = P(R(20, 60, 0, -0.6, 0.3), N(0, -20), J(50, -40), J(60, 20), J(60), J(-20)) }
T.spearCharge = { windup = P(R(10, -15, 0, -0.2), N(), J(30, 10), J(50, 10)), strike = P(R(30, 10, 0, -0.2, 0.6), N(-10), J(85, 0), J(70, 15), J(40), J(-40)), holdAll = true }
Poses.TEMPLATES = T

-- 템플릿이 휘두르는 부위 — 클라이언트가 판정 구간에 그 부위에 궤적(Trail)을 켠다. ra/la = 오른팔/왼팔, rl/ll = 오른다리/왼다리, both = 양팔, head = 머리. 없으면 궤적 없음.
Poses.LIMB = {
	punchR = "ra", punchL = "la", gunWhip = "ra", gunWhipL = "la", lowKickR = "rl", kickR = "rl", kickL = "ll", highKickR = "rl", axeKick = "rl", knee = "rl", flyKick = "rl",
	uppercutR = "ra", hookR = "ra", hookL = "la", slam = "both", lariat = "ra", spin = "both", overhead = "ra", overheadL = "la", slashR = "ra", slashL = "ra", sweep = "ra",
	thrust = "ra", thrustLow = "ra", charge = "ra", tackle = "both", dive = "rl", shieldBash = "la", shieldSlam = "la", quake = "both", rocket = "ra", headbutt = "head",
	roundhouse = "rl", haymaker = "ra", swingR = "ra", swingL = "la", flurryL = "la", flurryR = "ra", flurryKick = "rl", spinBackKick = "rl", flipKick = "rl",
	shoulderCheck = "ra", groundPound = "both", spearSweep = "ra", spearCharge = "ra",
}

-- 스타일별 대기 자세(상체만 — 다리는 기본 걷기·대기 애니메이션이 계속 돈다). 매치·로비 공통, Fight 가 idle 일 때.
local function U(root, neck, rs, ls) return { root = root or R(), neck = neck or N(), rs = rs or J(), ls = ls or J() } end
Poses.STANCES = {
	fighter = U(R(4, -12), N(0, 8), J(70, -12), J(85, -8)),      -- 복싱 가드: 두 주먹을 앞에
	grappler = U(R(10, 0), N(-5), J(40, 45), J(40, 45)),          -- 벌린 팔, 앞으로 숙인 상체
	speedster = U(R(14, 10, 0, -0.25), N(-6, -8), J(30, 25), J(55, 20)), -- 낮게, 한 손 앞
	heavy = U(R(-4, 0), N(3), J(8, 35), J(8, 35)),                 -- 곧게, 팔을 옆으로 늘어뜨림
	martial = U(R(2, -15), N(0, 12), J(95, -15), J(25, 25)),       -- 한 손을 길게 앞으로
}
function Poses.forStance(styleId) return Poses.STANCES[styleId] end

-- 상태 포즈(무브가 아닐 때). idle 은 nil — 기본 걷기·대기 애니메이션이 돈다.
Poses.STATES = {
	guard = P(R(8, 0), N(10), J(70, -20), J(70, 20)),
	hitstun = P(R(-12, 0, 0, 0, -0.2), N(-15), J(30, 30), J(30, 30)),
	launched = P(R(-45, 0), N(-20), J(120, 60), J(120, 60), J(40, 15), J(-20, 15)),
	down = P(R(-82, 0, 0, -2.1, 0), N(-10), J(60, 40), J(60, 40), J(10), J(10)),
	getup = P(R(-40, 0, 0, -1.0), N(0), J(40, 20), J(40, 20), J(60), J(60)),
	held = P(R(-10, 0, 0, 0.3), N(-5), J(60, 40), J(60, 40), J(30), J(-30)),
	grabbing = P(R(5, 0), N(), J(80, 10), J(80, -10)),
	stun = P(R(15, 0, 0, -0.3), N(20), J(20, 40), J(20, 40)),
	dead = P(R(-82, 0, 0, -2.1, 0), N(-10), J(60, 40), J(60, 40), J(10), J(10)),
}

local function lerpN(a, b, k) return a + (b - a) * k end
local function lerpJ(a, b, k) return { fwd = lerpN(a.fwd, b.fwd, k), out = lerpN(a.out, b.out, k) } end
function Poses.lerp(a, b, k)
	k = math.clamp(k, 0, 1)
	return {
		root = { pitch = lerpN(a.root.pitch, b.root.pitch, k), yaw = lerpN(a.root.yaw, b.root.yaw, k), roll = lerpN(a.root.roll, b.root.roll, k), dy = lerpN(a.root.dy, b.root.dy, k), dz = lerpN(a.root.dz, b.root.dz, k) },
		neck = { pitch = lerpN(a.neck.pitch, b.neck.pitch, k), yaw = lerpN(a.neck.yaw, b.neck.yaw, k) },
		rs = lerpJ(a.rs, b.rs, k), ls = lerpJ(a.ls, b.ls, k), rh = lerpJ(a.rh, b.rh, k), lh = lerpJ(a.lh, b.lh, k),
	}
end
local function ease(k) return 1 - (1 - k) * (1 - k) end

-- 무브 진행 시각 t(초) 의 포즈. untilLand 무브는 착지까지 strike 를 유지한다(서버가 착지 때 후딜을 시작하며 Move 를 바꾼다).
function Poses.forMove(move, t, landedAt)
	local tpl = T[move.pose]
	if not tpl then return nil end
	local su, ac, rc = move.startup, move.active, move.recovery
	if t < su then return Poses.lerp(Poses.IDLE, tpl.windup, ease(t / math.max(su, 0.01))) end
	local activeEnd = su + ac
	if move.untilLand then activeEnd = landedAt or math.huge end
	if t < activeEnd then
		local strike = tpl.strike
		local k = ac > 0 and math.clamp((t - su) / ac, 0, 1) or 0
		if tpl.spinYaw then strike = Poses.lerp(strike, strike, 0); strike.root.yaw = strike.root.yaw + tpl.spinYaw * k end
		if tpl.rollPitch then strike = Poses.lerp(strike, strike, 0); strike.root.pitch = strike.root.pitch + tpl.rollPitch * k end
		return strike
	end
	local r = (t - activeEnd) / math.max(rc, 0.01)
	local hold = tpl.hold or 0.4
	if tpl.holdAll then hold = 0.2 end
	if r < hold then return tpl.strike end
	if r >= 1 then return Poses.IDLE end
	return Poses.lerp(tpl.strike, Poses.IDLE, (r - hold) / (1 - hold))
end

-- 상태 포즈. 경직은 들어가는 순간 가장 크고 0.15초에 걸쳐 절반으로 돌아온다. 스턴은 비틀거린다.
function Poses.forState(state, t)
	local base = Poses.STATES[state]
	if not base then return nil end
	if state == "hitstun" then return Poses.lerp(base, Poses.IDLE, math.clamp(t / 0.15, 0, 1) * 0.5) end
	if state == "stun" then local p = Poses.lerp(base, base, 0); p.root.yaw = math.sin(t * 9) * 12; return p end
	if state == "getup" then return Poses.lerp(Poses.STATES.down, base, math.clamp(t / 0.4, 0, 1)) end
	return base
end

function Poses.isFinite(p)
	for _, j in { "rs", "ls", "rh", "lh" } do
		for _, v in { p[j].fwd, p[j].out } do if v ~= v or math.abs(v) == math.huge then return false end end
	end
	for _, v in { p.root.pitch, p.root.yaw, p.root.roll, p.root.dy, p.root.dz, p.neck.pitch, p.neck.yaw } do if v ~= v or math.abs(v) == math.huge then return false end end
	return true
end

return Poses
