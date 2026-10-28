--!nonstrict
-- 순수 규칙. Roblox API 를 쓰지 않아 luau CLI 로 검사한다. 벡터는 X/Y/Z 필드만 읽는다(Vector3 와 {X,Y,Z} 표 모두).
local Config = require("./Config")
local Styles = require("./Styles")
local Moves = require("./Moves")
local Accessories = require("./Accessories")

local Rules = {}

-- ───────── 스탯 ─────────
function Rules.statsFor(styleId)
	local st = Styles.get(styleId)
	local d = st and st.stats or {}
	local out = {}
	for _, k in { "hp", "atk", "def", "jmp", "spd", "tec" } do
		out[k] = math.clamp(Config.STAT.default + (d[k] or 0), Config.STAT.min, Config.STAT.max)
	end
	return out
end
function Rules.maxHealth(stats) return Config.PLAYER.baseHealth + Config.PLAYER.healthPerStat * stats.hp end
function Rules.atkMult(s) return 0.85 + 0.05 * s end
function Rules.defMult(s) return 1.15 - 0.05 * s end
function Rules.cooldownMult(s) return 1.15 - 0.05 * s end
function Rules.jumpPower(s) return Config.PLAYER.jumpPower + 4 * (s - Config.STAT.default) end
-- 1e-6 은 부동소수(0.9×10 = 8.999…)로 한 점이 깎이지 않게 하는 보정이다.
function Rules.damage(base, atkStat, defStat) return math.floor(base * Rules.atkMult(atkStat) * Rules.defMult(defStat) + 1e-6) end

-- ───────── 장비 ─────────
-- 직업이 들 수 없는 액세서리는 맨손으로 — 권위와 화면이 같은 규칙을 쓴다.
function Rules.allowedAccessory(styleId, accId)
	local st = Styles.get(styleId)
	if not st then return "none" end
	if accId == st.accessory then return accId end
	return "none"
end
function Rules.sanitizeLoadout(args)
	if type(args) ~= "table" then return nil end
	local style = args.style
	if type(style) ~= "string" or not Styles.get(style) then return nil end
	local acc = args.accessory
	if type(acc) ~= "string" or not Accessories.get(acc) then acc = "none" end
	return { style = style, accessory = Rules.allowedAccessory(style, acc) }
end
function Rules.walkSpeed(styleId, accId)
	local st, acc = Styles.get(styleId), Accessories.get(accId or "none")
	local stats = Rules.statsFor(styleId)
	return Config.PLAYER.walkSpeed * (st and st.speedMult or 1) * (acc and acc.speedMult or 1) * (0.85 + 0.05 * stats.spd)
end
function Rules.canGrabWith(accId)
	local acc = Accessories.get(accId or "none")
	return not (acc and acc.twoHanded)
end

-- ───────── 사슬 ─────────
-- 약공(light)/강공(heavy) 사슬. 같은 키 연타는 같은 사슬의 다음 타. 약공 사슬 중 강공 → 강공 사슬의 마지막 타(피니시). 강공 중 약공은 무시.
-- 반환: 다음 무브 id, 사슬 이름, 인덱스. 없으면 nil.
local function chains(styleId, accId)
	local acc = Accessories.get(accId or "none")
	if acc and acc.light then return acc.light, acc.heavy, acc.special end
	local st = Styles.get(styleId)
	return st.light, st.heavy, st.special
end
function Rules.chains(styleId, accId) return chains(styleId, accId) end
function Rules.firstMove(styleId, accId, button)
	local light, heavy = chains(styleId, accId)
	if button == "light" then return light[1], "light", 1 end
	if button == "heavy" then return heavy[1], "heavy", 1 end
	return nil
end
function Rules.chainNext(styleId, accId, chain, index, button)
	local light, heavy = chains(styleId, accId)
	if chain == "light" then
		if button == "light" then
			if index < #light then return light[index + 1], "light", index + 1 end
			return nil
		elseif button == "heavy" then
			return heavy[#heavy], "heavy", #heavy
		end
	elseif chain == "heavy" then
		if button == "heavy" and index < #heavy then return heavy[index + 1], "heavy", index + 1 end
		return nil
	end
	return nil
end
function Rules.specialMove(styleId, accId)
	local _, _, special = chains(styleId, accId)
	local acc = Accessories.get(accId or "none")
	local st = Styles.get(styleId)
	local cd = (acc and acc.light) and acc.specialCooldown or st.specialCooldown
	return special, cd * Rules.cooldownMult(Rules.statsFor(styleId).tec)
end

-- ───────── 기하 ─────────
local function flat(a, b) local dx, dz = b.X - a.X, b.Z - a.Z; return dx, dz, math.sqrt(dx * dx + dz * dz) end
function Rules.flatDistance(a, b) local _, _, d = flat(a, b); return d end
-- 정면 각(deg). look 은 평면 단위 벡터(X/Z). 0 = 정면.
function Rules.facingAngle(pos, look, target)
	local dx, dz, d = flat(pos, target)
	if d < 1e-6 then return 0 end
	local lx, lz = look.X, look.Z
	local ll = math.sqrt(lx * lx + lz * lz)
	if ll < 1e-6 then return 0 end
	local c = (dx * lx + dz * lz) / (d * ll)
	return math.deg(math.acos(math.clamp(c, -1, 1)))
end
-- 타격 판정: 공격자 앞 reach 지점의 원(radius) 과 상대 몸(bodyRadius) 이 겹치고, 정면 arc/2 안이며, 높이 차가 3.5 스터드 이하.
function Rules.hitTest(attPos, look, move, victimPos, bodyRadius)
	bodyRadius = bodyRadius or Config.PLAYER.bodyRadius
	if move.radius <= 0 then return false end
	-- 몸이 겹칠 만큼 붙어 있으면(점블랭크) 리치·각도를 보지 않는다
	local _, _, d0 = flat(attPos, victimPos)
	if d0 <= bodyRadius * 1.6 and math.abs((victimPos.Y or 0) - (attPos.Y or 0)) <= 3.5 then return true end
	local lx, lz = look.X, look.Z
	local ll = math.sqrt(lx * lx + lz * lz)
	if ll < 1e-6 then lx, lz, ll = 0, -1, 1 end
	lx, lz = lx / ll, lz / ll
	local cx, cz = attPos.X + lx * move.reach, attPos.Z + lz * move.reach
	local dx, dz = victimPos.X - cx, victimPos.Z - cz
	if dx * dx + dz * dz > (move.radius + bodyRadius) ^ 2 then return false end
	if math.abs((victimPos.Y or 0) - (attPos.Y or 0)) > 3.5 then return false end
	if move.arcDeg < 360 and Rules.facingAngle(attPos, { X = lx, Z = lz }, victimPos) > move.arcDeg / 2 + 1e-6 then return false end
	return true
end
-- 가드: 피격자가 공격자를 정면 guardAngle/2 안에 두고 있어야 막는다. 뒤는 안 막힌다.
function Rules.guardBlocks(victimPos, victimLook, attackerPos, guardAngle)
	return Rules.facingAngle(victimPos, victimLook, attackerPos) <= (guardAngle or Config.GUARD.angleDeg) / 2
end
function Rules.guardCost(damage) return damage * Config.GUARD.costMult end
-- 잡기: 거리 ≤ range, 정면 coneDeg/2, 상대가 잡힐 수 있는 상태.
local GRABBABLE = { idle = true, guard = true, hitstun = true, stun = true }
function Rules.canGrab(attPos, look, victimPos, victimState, range)
	if not GRABBABLE[victimState] then return false end
	local _, _, d = flat(attPos, victimPos)
	if d > (range or Config.GRAB.range) + Config.PLAYER.bodyRadius then return false end
	return Rules.facingAngle(attPos, look, victimPos) <= Config.GRAB.coneDeg / 2
end
function Rules.knockbackMult(consecutiveHits)
	return consecutiveHits >= Config.HIT.consecutiveFrom and Config.HIT.consecutiveMult or 1
end
function Rules.isRingout(y, fallY) return y < fallY end
-- 던지기 방향: 이동 입력이 있으면 그쪽, 없으면 정면. 평면 단위 벡터.
function Rules.throwDirection(look, moveDir)
	local x, z = look.X, look.Z
	if moveDir and (math.abs(moveDir.X) + math.abs(moveDir.Z)) > 0.2 then x, z = moveDir.X, moveDir.Z end
	local l = math.sqrt(x * x + z * z)
	if l < 1e-6 then return { X = 0, Z = -1 } end
	return { X = x / l, Z = z / l }
end
function Rules.sanitizeDir(v)
	if typeof(v) ~= "Vector3" and type(v) ~= "table" then return nil end
	local x, z = v.X, v.Z
	if type(x) ~= "number" or type(z) ~= "number" or x ~= x or z ~= z or math.abs(x) > 2 or math.abs(z) > 2 then return nil end
	return { X = x, Z = z }
end

-- ───────── 매치 ─────────
function Rules.score(ko, damage, win) return ko * Config.POINTS.ko + math.floor(damage) * Config.POINTS.damage + (win and Config.POINTS.win or 0) end
-- 순위: KO 많고, 데스 적고, 준 피해 많은 순. 팀전은 팀 합산 뒤 같은 기준.
local function better(a, b)
	if a.ko ~= b.ko then return a.ko > b.ko end
	if a.deaths ~= b.deaths then return a.deaths < b.deaths end
	return a.damage > b.damage
end
function Rules.rank(roster)
	local out = {}
	for _, r in roster do table.insert(out, r) end
	table.sort(out, better)
	return out
end
function Rules.teamTotals(roster)
	local t = {}
	for _, r in roster do
		local id = r.team or 0
		t[id] = t[id] or { team = id, ko = 0, deaths = 0, damage = 0 }
		t[id].ko += r.ko; t[id].deaths += r.deaths; t[id].damage += r.damage
	end
	local list = {}
	for _, v in t do table.insert(list, v) end
	table.sort(list, better)
	return list
end
-- 서바이벌: 살아 있는 사람이 하나(또는 팀 하나)면 끝.
function Rules.survivalOver(roster)
	local alive = 0
	for _, r in roster do if r.alive then alive += 1 end end
	return alive <= 1
end
function Rules.survivalWinner(roster)
	for _, r in roster do if r.alive then return r end end
	return nil
end
-- 모드 끝 판정: 시간 종료 또는 서바이벌 생존 1.
function Rules.matchOver(modeId, elapsed, roster)
	local mode = Config.MODES[modeId]
	if elapsed >= mode.seconds then return true, "time" end
	if mode.lives == 1 and Rules.survivalOver(roster) then return true, "lastone" end
	return false
end
-- 팀 배정: 들어온 순서로 번갈아. 봇도 같은 줄에 선다.
function Rules.assignTeams(ids)
	local out = {}
	for i, id in ids do out[id] = (i % 2 == 1) and 1 or 2 end
	return out
end
-- KO 크레딧: koCreditSeconds 안의 마지막 타격자, 없으면 nil(자멸).
function Rules.koCredit(lastHitBy, lastHitAt, now)
	if lastHitBy and lastHitAt and now - lastHitAt <= Config.HIT.koCreditSeconds then return lastHitBy end
	return nil
end
-- 다음 매치: 모드·맵을 순환(둘의 길이가 서로소가 아니어도 전부 돈다).
function Rules.nextRotation(index)
	local m = Config.MODE_ORDER[(index - 1) % #Config.MODE_ORDER + 1]
	local map = Config.MAP_ORDER[math.floor((index - 1) / #Config.MODE_ORDER) % #Config.MAP_ORDER + 1]
	return m, map
end

-- ───────── 전투 결정(서버 Combat 이 그대로 부른다 — 결정은 여기, 적용은 Combat) ─────────
function Rules.heldEscape(count) return count >= Config.GRAB.mashToEscape end
-- 연타는 mashInterval 보다 촘촘히 세지 않는다(버스트 입력이 탈출 시간을 줄이지 못하게)
function Rules.mashAccepted(lastAt, now) return lastAt == nil or now - lastAt >= Config.LIMITS.mashInterval end
function Rules.counterOpen(counterUntil, now) return now < counterUntil end
function Rules.dashAttackOpen(dashAttackUntil, now) return now < dashAttackUntil end
-- 띄움 뒤 착지: 공중을 한 번은 봐야(복제 지연) 바닥을 믿고, 2.5초가 지나면 어디든 내린다
function Rules.launchLanded(sawAir, elapsed, onGround)
	if elapsed > 2.5 then return true end
	return (sawAir or elapsed > 0.25) and onGround and elapsed > 0.1
end
function Rules.botsNeeded(humans)
	local n = math.clamp(Config.BOTS.fillTo - humans, 0, Config.BOTS.max)
	return math.max(0, math.min(n, Config.LIMITS.fighters - humans))
end
-- 봇 걸음: 앞에 바닥이 없으면 옆으로, 옆도 없으면 선다(웹판 봇 자멸 36% 교훈)
function Rules.botMove(footingAhead, footingSide)
	if footingAhead then return "forward" end
	if footingSide then return "side" end
	return "stop"
end
function Rules.allyKo(attackerTeam, victimTeam) return attackerTeam ~= 0 and attackerTeam == victimTeam end
function Rules.canHit(attackerTeam, victimTeam) return true end -- 팀전에서도 아군이 맞는다(의도된 규칙)
function Rules.loadoutPhaseOpen(phase) return phase == "lobby" end

-- ───────── 무브 조회 ─────────
function Rules.move(id) return Moves.get(id) end
function Rules.moveDuration(id) return Moves.duration(Moves.get(id)) end

return Rules
