-- 실제 shared 모듈(Config·Styles·Moves·Accessories·Rules·Poses)을 공식 luau CLI 로 실행하는 검사. Roblox 의 Vector3 는 X/Y/Z 표로 대신한다.
local function V(x, y, z) return { X = x, Y = y, Z = z } end
local Config = require("../src/shared/Config")
local Styles = require("../src/shared/Styles")
local Moves = require("../src/shared/Moves")
local Accessories = require("../src/shared/Accessories")
local Rules = require("../src/shared/Rules")
local Poses = require("../src/shared/Poses")
local n = 0
local function check(cond, msg) assert(cond, msg); n += 1 end

-- ───────── 스탯·피해 ─────────
local f, h, s = Rules.statsFor("fighter"), Rules.statsFor("heavy"), Rules.statsFor("speedster")
check(f.hp == 3 and f.atk == 3 and h.hp == 5 and h.spd == 1 and s.spd == 5 and s.def == 2, "스타일 스탯 증감 1~5 클램프")
check(Rules.maxHealth(f) == 100 and Rules.maxHealth(h) == 120 and Rules.maxHealth(Rules.statsFor("martial")) == 90, "체력 70+10×체력")
check(Rules.damage(10, 3, 3) == 10 and Rules.damage(10, 5, 3) == 11 and Rules.damage(10, 3, 5) == 9 and Rules.damage(7, 1, 5) == 5, "피해 = 내림(기본×근력×방어)")
check(Rules.walkSpeed("speedster", "none") > Rules.walkSpeed("fighter", "none") and Rules.walkSpeed("heavy", "greatsword") < Rules.walkSpeed("heavy", "none"), "이동 배율: 스피드스타 빠르고 대검은 느리다")

-- ───────── 장비 ─────────
check(Rules.allowedAccessory("heavy", "greatsword") == "greatsword" and Rules.allowedAccessory("fighter", "greatsword") == "none", "스타일 외 액세서리는 맨손")
local lo = Rules.sanitizeLoadout({ style = "martial", accessory = "spear" }); check(lo.style == "martial" and lo.accessory == "spear", "장비 정리 정상")
check(Rules.sanitizeLoadout({ style = "martial", accessory = "pistols" }).accessory == "none", "남의 전용은 맨손으로")
check(Rules.sanitizeLoadout({ style = "zzz" }) == nil and Rules.sanitizeLoadout("x") == nil and Rules.sanitizeLoadout({ style = "fighter", accessory = 5 }).accessory == "none", "미지 스타일 nil, 비문자 액세서리는 맨손")
check(Rules.canGrabWith("none") and Rules.canGrabWith("spear") and not Rules.canGrabWith("greatsword"), "양손 대검은 잡기 불가")
-- 액세서리 배타: 스타일당 정확히 하나, 액세서리마다 주인 스타일 하나
local owners = {}
for _, id in Styles.ORDER do
	local acc = Styles.DEF[id].accessory
	check(Accessories.DEF[acc] and Accessories.DEF[acc].style == id, "스타일 " .. id .. " 의 전용 액세서리가 존재하고 서로 가리킨다")
	check(owners[acc] == nil, "액세서리 " .. acc .. " 가 두 스타일에 겹친다"); owners[acc] = id
end
check(#Accessories.ORDER == 5 and #Styles.ORDER == 5, "스타일 5 · 액세서리 5")

-- ───────── 사슬 ─────────
check(Rules.firstMove("fighter", "none", "light") == "jab" and Rules.firstMove("fighter", "none", "heavy") == "roundhouse", "첫 타")
local m2, c2, i2 = Rules.chainNext("fighter", "none", "light", 1, "light"); check(m2 == "straight" and c2 == "light" and i2 == 2, "약공 2타")
local m3 = Rules.chainNext("fighter", "none", "light", 3, "light"); check(m3 == nil, "3타 뒤 끊김")
local fin, fc = Rules.chainNext("fighter", "none", "light", 1, "heavy"); check(fin == "haymaker" and fc == "heavy", "약공 중 강공 → 강공 피니시")
check(Rules.chainNext("fighter", "none", "heavy", 1, "light") == nil and Rules.chainNext("fighter", "none", "heavy", 1, "heavy") == "haymaker", "강공 중 약공 무시, 강공 2타")
check(Rules.firstMove("heavy", "greatsword", "light") == "gs1" and Rules.firstMove("speedster", "pistols", "heavy") == "gunBurst", "액세서리를 들면 사슬이 통째로 바뀐다")
local sp, cd = Rules.specialMove("speedster", "none"); check(sp == "spinKick" and cd < 4 and cd > 3, "기술과 쿨다운(기술 스탯 배율)")
local sp2, cd2 = Rules.specialMove("heavy", "greatsword"); check(sp2 == "gsSlam" and math.abs(cd2 - 6) < 0.01, "액세서리 기술 쿨다운")
-- 모든 사슬·기술의 무브가 존재하고 수치가 양수
local function eachChain(fn)
	for _, id in Styles.ORDER do local st = Styles.DEF[id]; for _, mv in st.light do fn(mv) end; for _, mv in st.heavy do fn(mv) end; fn(st.special) end
	for _, id in Accessories.ORDER do local a = Accessories.DEF[id]; for _, mv in a.light do fn(mv) end; for _, mv in a.heavy do fn(mv) end; fn(a.special) end
end
local seen = 0
eachChain(function(mv)
	local m = Moves.get(mv); check(m ~= nil, "무브 존재 " .. tostring(mv))
	check(m.startup > 0 and m.recovery > 0 and (m.active > 0 or m.untilLand), "타이밍 양수 " .. mv)
	if m.effect == "projectile" then check(Moves.PROJECTILE[mv] ~= nil, "투사체 스펙 " .. mv) else check(m.reach >= 0 and m.radius >= 0, "리치 " .. mv) end
	check(Poses.TEMPLATES[m.pose] ~= nil, "포즈 템플릿 " .. mv .. " → " .. tostring(m.pose))
	seen += 1
end)
check(seen >= 40, "사슬·기술 무브 40개 이상 검사")
-- 압박이지 확정 콤보가 아니다: 약공 경직 < 후딜 + 다음 발동 (가드·대시가 사이에 들어간다)
local function pressureChain(chain, label)
	for i = 1, #chain - 1 do
		local a, b = Moves.get(chain[i]), Moves.get(chain[i + 1])
		if a.effect == "hitstun" then check(a.hitstun < a.recovery + b.startup, "경직 < 후딜+다음 발동 " .. label .. ":" .. chain[i]) end
	end
end
for _, id in Styles.ORDER do pressureChain(Styles.DEF[id].light, id); pressureChain(Styles.DEF[id].heavy, id) end
for _, id in Accessories.ORDER do pressureChain(Accessories.DEF[id].light, id); pressureChain(Accessories.DEF[id].heavy, id) end
for id, m in Moves.DEF do check(Moves.duration(m) <= 1.4, "무브 길이 1.4초 이하 " .. id) end
check(Moves.isActive(Moves.get("jab"), 0.12) and not Moves.isActive(Moves.get("jab"), 0.05) and not Moves.isActive(Moves.get("jab"), 0.2), "지속 구간")
check(Moves.isActive(Moves.get("divekick"), 1.0), "급강하는 착지까지 지속")

-- ───────── 기하 ─────────
local me, look = V(0, 0, 0), V(0, 0, -1)
local jab = Moves.get("jab")
check(Rules.hitTest(me, look, jab, V(0, 0, -5)), "정면 5 스터드 잽 명중")
check(not Rules.hitTest(me, look, jab, V(0, 0, 5)), "뒤는 안 맞는다")
check(not Rules.hitTest(me, look, jab, V(0, 0, -9)), "리치 밖")
check(not Rules.hitTest(me, look, jab, V(0, 6, -5)), "높이 차 3.5 넘으면 안 맞는다")
check(Rules.hitTest(me, look, jab, V(1.5, 0, -1.0)), "몸이 겹칠 만큼 붙으면 각도 무관")
local spear = Moves.get("sp1")
check(Rules.hitTest(me, look, spear, V(0, 0, -7.5)) and not Rules.hitTest(me, look, spear, V(4, 0, -5)), "장창은 멀리 닿지만 호가 좁다")
local quake = Moves.get("quake")
check(Rules.hitTest(me, look, quake, V(0, 0, 7)) and Rules.hitTest(me, look, quake, V(-6, 0, 2)), "지진은 360°")
check(Rules.guardBlocks(V(0, 0, 0), V(0, 0, -1), V(0, 0, -4)) and not Rules.guardBlocks(V(0, 0, 0), V(0, 0, -1), V(0, 0, 4)), "가드는 정면만 막는다")
check(not Rules.guardBlocks(V(0, 0, 0), V(0, 0, -1), V(4, 0, 1), 150), "방패 가드 각 150°: 옆뒤는 뚫린다")
check(Rules.guardCost(6) == 24 and Config.GUARD.max / Rules.guardCost(6) < 5, "잽 5회면 가드가 깨진다")
check(Rules.canGrab(me, look, V(0, 0, -3), "idle") and not Rules.canGrab(me, look, V(0, 0, -3), "down") and not Rules.canGrab(me, look, V(0, 0, -6), "idle") and not Rules.canGrab(me, look, V(3, 0, 0), "idle"), "잡기: 거리·정면 60°·상태")
check(Rules.canGrab(me, look, V(0, 0, -3.8), "guard", 3.9) and not Rules.canGrab(me, look, V(0, 0, -4.1), "guard", 3.9) and not Rules.canGrab(me, look, V(0, 0, -3.8), "guard", 2.0), "그래플러 잡기 범위(중심 거리, 몸 반지름 안 더함)")
-- 잡기 거리는 약공 교전 거리보다 짧다 — 아니면 사거리 안의 약공이 전부 잡기가 된다
for _, sid in Styles.ORDER do
	local st = Styles.get(sid)
	check(st.grabRange < Rules.engageDistance(sid, "none") + Config.PLAYER.bodyRadius, sid .. " 잡기 범위 < 교전 거리 + 몸 반지름")
end
check(Rules.knockbackMult(3) == 1 and Rules.knockbackMult(4) == 1.5, "연속 4히트째 넉백 ×1.5")
check(Rules.isRingout(-41, Config.MAPS.skydock.fallY) and not Rules.isRingout(0, Config.MAPS.skydock.fallY), "링아웃 Y")
local d = Rules.throwDirection(V(0, 0, -1), V(1, 0, 0)); check(math.abs(d.X - 1) < 1e-6 and math.abs(d.Z) < 1e-6, "던지기 방향은 입력 우선")
check(Rules.throwDirection(V(0, 0, -1), nil).Z == -1, "입력 없으면 정면")
check(Rules.sanitizeDir({ X = 0 / 0, Z = 1 }) == nil and Rules.sanitizeDir({ X = 9, Z = 0 }) == nil and Rules.sanitizeDir("x") == nil and Rules.sanitizeDir({ X = 0.5, Z = -0.5 }).X == 0.5, "방향 입력 정리")

-- ───────── 매치 ─────────
local roster = { { id = "a", ko = 2, deaths = 1, damage = 100, team = 1, alive = true }, { id = "b", ko = 2, deaths = 0, damage = 50, team = 2, alive = false }, { id = "c", ko = 1, deaths = 3, damage = 400, team = 1, alive = true } }
local r = Rules.rank(roster); check(r[1].id == "b" and r[2].id == "a" and r[3].id == "c", "순위 KO → 데스 → 피해")
local tt = Rules.teamTotals(roster); check(tt[1].team == 1 and tt[1].ko == 3, "팀 합산")
check(not Rules.survivalOver(roster) and Rules.survivalOver({ roster[1], roster[2] }) and Rules.survivalWinner({ roster[1], roster[2] }).id == "a", "서바이벌 생존 1")
check(Rules.survivalWinner(roster).id == "a" and Rules.survivalWinner({ roster[3], roster[1] }).id == "a" and Rules.survivalWinner({ roster[2] }) == nil, "서바이벌 시간 종료: 생존자 중 KO 순(명단 순서 무관), 생존자 없으면 nil")
check(Rules.matchOver("ffa_dm", 200, roster) and not Rules.matchOver("ffa_dm", 100, roster), "시간 종료")
local over, why = Rules.matchOver("survival", 10, { roster[1], roster[2] }); check(over and why == "lastone", "서바이벌 마지막 하나")
local teams = Rules.assignTeams({ "p1", "p2", "p3" }); check(teams.p1 == 1 and teams.p2 == 2 and teams.p3 == 1, "팀 번갈아")
check(Rules.koCredit("x", 10, 12.9) == "x" and Rules.koCredit("x", 10, 13.1) == nil and Rules.koCredit(nil, nil, 1) == nil, "KO 크레딧 3초(2.9 안 / 3.1 밖)")
check(Config.GUARD.counterWindow == 0.25 and Config.DASH.attackWindow == 0.3, "반격 창 0.25 · 대시 공격 창 0.3")
local g1, c1 = Rules.guardAfterBlock(20, 24, false); check(g1 == 0 and c1 == true, "게이지가 바닥나면 크러시")
local g2, c2 = Rules.guardAfterBlock(20, 24, true); check(g2 == 1 and c2 == false, "방패는 크러시 면역(1 로 남는다)")
local g3, c3 = Rules.guardAfterBlock(100, 24, false); check(g3 == 76 and c3 == false, "막으면 피해×4 소모")
local m1, map1 = Rules.nextRotation(1); local m4, map4 = Rules.nextRotation(4)
check(m1 == "ffa_dm" and map1 == "colosseum" and m4 == "ffa_dm" and map4 == "skydock", "모드·맵 순환")
local seenMaps = {}
for i = 1, 6 do local _, mp = Rules.nextRotation(i); seenMaps[mp] = true end
check(seenMaps.colosseum and seenMaps.skydock, "6판 안에 두 맵 모두")

-- ───────── 전투 결정 ─────────
check(not Rules.heldEscape(5) and Rules.heldEscape(6), "6연타 탈출")
check(Rules.mashAccepted(nil, 1) and not Rules.mashAccepted(1.0, 1.05) and Rules.mashAccepted(1.0, 1.09), "연타는 0.08초 간격으로만 센다")
check(Rules.counterOpen(1.25, 1.24) and not Rules.counterOpen(1.25, 1.26), "반격 창 0.25초")
check(Rules.dashAttackOpen(2.0, 1.9) and not Rules.dashAttackOpen(2.0, 2.1), "대시 공격 창")
check(not Rules.launchLanded(false, 0.05, true) and not Rules.launchLanded(false, 0.2, true) and Rules.launchLanded(true, 0.2, true) and Rules.launchLanded(false, 0.3, true) and not Rules.launchLanded(true, 0.5, false) and Rules.launchLanded(false, 2.6, false), "띄움 착지: 공중을 본 뒤 바닥, 아니면 0.25초 뒤, 2.5초 타임아웃")
check(Rules.botsNeeded(1) == 3 and Rules.botsNeeded(4) == 0 and Rules.botsNeeded(0) == 4 and Rules.botsNeeded(8) == 0, "봇 채움 4까지")
check(Rules.botMove(true, true) == "forward" and Rules.botMove(false, true) == "side" and Rules.botMove(false, false) == "stop", "봇은 절벽 앞에서 비키거나 선다")
check(Rules.allyKo(1, 1) and not Rules.allyKo(1, 2) and not Rules.allyKo(0, 0), "아군 KO 판정(개인전은 아군 없음)")
check(Rules.canHit(1, 1) and Rules.canHit(1, 2), "팀전에서도 아군이 맞는다")
check(Rules.loadoutPhaseOpen("lobby") and not Rules.loadoutPhaseOpen("match") and not Rules.loadoutPhaseOpen("countdown"), "장비는 로비에서만")
check(Rules.specialMove("speedster", "pistols") == "gunRoll" and Moves.PROJECTILE.gunRoll.ammo == 6 and Accessories.DEF.pistols.ammo == 12, "백롤 난사는 탄 6")
check(Styles.DEF.speedster.airDashes == 1 and Styles.DEF.fighter.airDashes == 0 and Styles.DEF.heavy.airDashes == 0, "공중 대시는 스피드스타만")
check(Config.GRAB.heldMax == 2 and Config.HIT.downSeconds + Config.HIT.getupSeconds >= 1.0, "잡힘 최대 2초 · 다운+기상 1초 이상 무적")

-- ───────── 명령 검사(서버 Commands, Roblox API 없음) ─────────
local Commands = require("../src/server/Commands")
Commands.configure(Config.LIMITS)
local pl = { Name = "p" }
local function vec(x, y, z) return { X = x, Y = y, Z = z } end
local ok, why = Commands.validate(pl, "zzz", {}, 10); check(not ok and why == "UNKNOWN", "미지 명령")
ok, why = Commands.validate(pl, "intent", { kind = "fly" }, 10); check(not ok and why == "SCHEMA", "enum 밖 의도")
ok, why = Commands.validate(pl, "intent", { kind = "light", dir = vec(0 / 0, 0, 1) }, 10); check(not ok and why == "SCHEMA", "NaN 방향")
ok, why = Commands.validate(pl, "intent", { kind = "light", dir = vec(9, 0, 0) }, 10); check(not ok and why == "SCHEMA", "과대 방향")
ok = Commands.validate(pl, "intent", { kind = "light", dir = vec(0, 0, 0) }, 10); check(ok, "영벡터는 통과(던지기 방향은 정면으로 정리)")
ok, why = Commands.validate(pl, "guard", { on = "yes" }, 10); check(not ok and why == "SCHEMA", "가드 on 은 boolean")
ok = Commands.validate(pl, "loadout", { style = "heavy", accessory = "greatsword" }, 10); check(ok, "장비 명령 모양")
ok, why = Commands.validate(pl, "loadout", { style = 5 }, 10); check(not ok and why == "SCHEMA", "장비 비문자")
ok = Commands.validate(pl, "ready", "notatable", 10); check(ok, "args 가 표가 아니면 빈 표로")
local pl2 = { Name = "q" }
local passed = 0
for i = 1, Config.LIMITS.commandBurst + 5 do if Commands.validate(pl2, "ready", {}, 20) then passed += 1 end end
check(passed == Config.LIMITS.commandBurst, "같은 순간 버스트 상한")
ok, why = Commands.validate(pl2, "ready", {}, 20); check(not ok and why == "RATE", "버스트 초과는 RATE")
ok = Commands.validate(pl2, "ready", {}, 20.1); check(ok, "0.1초 뒤 토큰 회복")
Commands.forget(pl2)
passed = 0
for i = 1, Config.LIMITS.commandBurst do if Commands.validate(pl2, "ready", {}, 21) then passed += 1 end end
check(passed == Config.LIMITS.commandBurst, "forget 뒤 버킷 리셋")

-- ───────── 포즈 ─────────
for id, m in Moves.DEF do
	local dur = Moves.duration(m)
	for _, t in { 0, m.startup * 0.5, m.startup + m.active * 0.5, m.startup + m.active + m.recovery * 0.2, dur + 0.5 } do
		local p = Poses.forMove(m, t, m.untilLand and (m.startup + 0.3) or nil)
		check(p ~= nil and Poses.isFinite(p), "포즈 유한 " .. id)
	end
	if m.effect == "hitstun" or m.effect == "launch" then
		local strike = Poses.forMove(m, m.startup + m.active * 0.5, m.startup + 0.3)
		-- 팔·다리를 60° 이상 뻗거나(타격) 몸통을 30° 이상 내민다(박치기·태클)
		local function extended(p) return math.max(p.rs.fwd, p.ls.fwd, p.rh.fwd, p.lh.fwd) >= 60 or p.root.pitch >= 30 end
		check(extended(strike), "타격 무브는 지속 구간에 팔·다리·몸을 뻗는다 " .. id)
		local hold = Poses.forMove(m, m.startup + m.active + m.recovery * 0.1, m.startup + 0.3)
		check(extended(hold), "후딜 앞 구간은 뻗은 자세 고정 " .. id)
	end
end
for _, st in { "guard", "hitstun", "launched", "down", "getup", "held", "grabbing", "stun", "dead" } do
	check(Poses.forState(st, 0) and Poses.isFinite(Poses.forState(st, 0.3)), "상태 포즈 " .. st)
end
check(Poses.forState("idle", 0) == nil, "idle 은 기본 애니메이션에 맡긴다")
check(Poses.forState("down", 0).root.dy <= -2 and math.abs(Poses.forState("down", 0).root.pitch) >= 80, "다운은 바닥에 눕는다")
local spin = Moves.get("spinKick"); check(Poses.forMove(spin, spin.startup + spin.active * 0.5).root.yaw > 300, "회전 발차기는 돈다")
local w = Poses.forMove(jab, 0.0); check(math.abs(w.rs.fwd) < 1e-6, "발동 시작은 idle 에서 출발")

-- ───────── 스타일별 동작 고유성 · 교전 거리 · 대기 자세 ─────────
-- 다섯 스타일의 사슬(맨손 + 전용 액세서리)은 포즈 템플릿을 서로 공유하지 않는다 — 공유하면 「캐릭터별 동작이 같다」가 된다
local poseOwner = {}
for _, sid in Styles.ORDER do
	local st = Styles.get(sid)
	for _, accId in { "none", st.accessory } do
		local light, heavy, special = Rules.chains(sid, accId)
		local ids = {}
		for _, id in light do table.insert(ids, id) end
		for _, id in heavy do table.insert(ids, id) end
		if special then table.insert(ids, special) end
		for _, id in ids do
			local pose = Moves.get(id).pose
			check(poseOwner[pose] == nil or poseOwner[pose] == sid, string.format("포즈 템플릿 %s 를 %s 와 %s 가 같이 쓴다(%s)", pose, tostring(poseOwner[pose]), sid, id))
			poseOwner[pose] = sid
		end
	end
end
-- 휘두르는 부위 표: 값은 ra/la/rl/ll/both/head, 사슬의 판정 무브는 전부 궤적 부위가 있다(잡기·던지기·투사체·아이템 던지기 제외)
local LIMBS = { ra = true, la = true, rl = true, ll = true, both = true, head = true }
for pose, limb in Poses.LIMB do check(LIMBS[limb] == true and Poses.TEMPLATES[pose] ~= nil, "LIMB 항목 " .. pose .. " → " .. tostring(limb)) end
for _, sid in Styles.ORDER do
	local st = Styles.get(sid)
	for _, accId in { "none", st.accessory } do
		local light, heavy = Rules.chains(sid, accId)
		for _, chain in { light, heavy } do
			for _, id in chain do
				local m = Moves.get(id)
				if m.radius > 0 then check(Poses.LIMB[m.pose] ~= nil, "판정 무브는 궤적 부위가 있다: " .. id .. " (" .. m.pose .. ")") end
			end
		end
	end
end
-- 교전 거리: 그 거리에 서서 바라보면 사슬의 모든 판정 무브가 맞고, 잡기 범위(몸 반지름 없이)는 교전 거리 안쪽이다
for _, sid in Styles.ORDER do
	local st = Styles.get(sid)
	for _, accId in { "none", st.accessory } do
		local engage = Rules.engageDistance(sid, accId)
		check(engage >= 2.5 and engage <= 7, sid .. "/" .. accId .. " 교전 거리 " .. engage)
		local light, heavy = Rules.chains(sid, accId)
		for _, chain in { light, heavy } do
			for _, id in chain do
				local m = Moves.get(id)
				if m.radius > 0 then check(Rules.hitTest(V(0, 0, 0), V(0, 0, -1), m, V(0, 0, -engage)), string.format("%s 교전 거리 %.1f 에서 %s 가 맞는다", sid, engage, id)) end
			end
		end
	end
end
-- 내딛기는 타격 무브에만, 걷기보다 빠르되 대시보다 느리다
for _, id in Moves.ids() do
	local m = Moves.get(id)
	check(m.stepIn >= 0 and m.stepIn < Config.DASH.speed, "stepIn 범위 " .. id)
	if m.stepIn > 0 then check(m.effect == "hitstun" or m.effect == "launch", "내딛기는 타격 무브에만 " .. id) end
end
-- 대기 자세: 스타일마다 하나, 상체(root·neck·rs·ls)만 — 다리를 쓰면 걷기 애니메이션을 덮는다
for _, sid in Styles.ORDER do
	local u = Poses.forStance(sid)
	check(u ~= nil and u.root and u.neck and u.rs and u.ls and u.rh == nil and u.lh == nil, "대기 자세 상체만 " .. sid)
	check(u and u.rs.fwd >= 0 and u.rs.fwd <= 100 and u.ls.fwd >= 0 and u.ls.fwd <= 100 and math.abs(u.root.yaw) <= 20, "대기 자세 각도 범위 " .. sid)
end
check(Poses.forStance("nope") == nil, "모르는 스타일은 대기 자세 없음(기본 애니메이션)")

print(string.format("PASS %d actual Luau assertions on shared Config/Styles/Moves/Accessories/Rules/Poses (stats, loadout exclusivity, chains, hit geometry, guard, grab, ringout, ranking, rotation, procedural poses, per-style pose uniqueness, engage distance, stances) — not Roblox runtime", n))
