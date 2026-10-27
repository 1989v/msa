-- 실제 shared 모듈을 공식 luau 로 실행하는 검사. 근거는 전부 Sim 이 내놓은 값이다 (planning/test-quality.md).
local Sim = require("../src/shared/Sim")
local Grid = require("../src/shared/Grid")
local Balance = require("../src/shared/Balance")
local Packet = require("../src/shared/Packet")
local Campaign = require("../src/shared/Campaign")
local count = 0
local function check(condition, message) assert(condition, message); count += 1 end
local function near(a, b, eps) return math.abs(a - b) <= (eps or 1e-6) end
local DT = Balance.FIXED_DT

local function newGame(seed, mode)
	local s = Sim.create(seed or 1, mode or "solo")
	Sim.addOwner(s, 0, "A")
	if mode == "coop" then Sim.addOwner(s, 1, "B") end
	return s
end
local function hold(s, ownerId)
	local l = Sim.leaderOf(s, ownerId or 0)
	if l then Sim.setLeader(s, ownerId or 0, l.x, l.z, false) end
end
local function run(s, seconds, each)
	for _ = 1, math.floor(seconds / DT + 0.5) do
		for _, o in s.owners do hold(s, o.id) end
		if each then each() end
		Sim.step(s, DT)
		if s.phase ~= "playing" then break end
	end
end
local function events(s, kind)
	local out = {}
	for _, e in s.events do if e.type == kind then table.insert(out, e) end end
	return out
end

-- 1 피해식 · 2 강화 비용 · 가격
check(Balance.damage(Balance.UNITS.archer, 0, 0) == 12 and Balance.damage(Balance.UNITS.archer, 3, 5) == 13 and Balance.damage(Balance.UNITS.longbow, 0, 5) == 33, "피해식 12+2L-max(0,방-관통)")
check(Balance.damage(Balance.UNITS.archer, 0, 20) == 1, "최소 피해 1")
check(Balance.upgradeCost("attack", 0, 1) == 30 and Balance.upgradeCost("attack", 0, 10) == 1200 and Balance.upgradeCost("armor", 0, 1) == 25 and Balance.upgradeCost("armor", 29, 10) == 25 + 25 * 29, "강화 비용 30+20L · 25+25L · 상한 근처 잔여만")
check(Balance.upgradeCost("attack", 50, 1) == nil and Balance.upgradeCost("armor", 30, 10) == nil, "상한에서 nil")
do
	local s = newGame()
	s.owners[1].gold = 5000
	local lb = Sim.unitById(s, Sim.act(s, { type = "hire", kind = "longbow", ownerId = 0 }).unitId)
	check(Sim.attackDamage(s, lb, { kind = "armored", contributors = {} }) == 33 and Sim.attackDamage(s, Sim.leaderOf(s, 0), { kind = "armored", contributors = {} }) == 7, "Sim 피해식: 장궁수 관통 4 vs 철갑 5 → 33, 활잡이 → 7")
	s.units = { Sim.leaderOf(s, 0) }; s.owners[1].gold = 0
	check(Sim.price(s, 0, "archer") == 700 and Sim.price(s, 0, "longbow") == 1400 and Sim.price(s, 0, "carpenter") == 500 and Sim.price(s, 0, "hero_archer") == nil, "가격")
	check(near(Balance.fireInterval(Balance.UNITS.archer, 50), 0.55 * 0.8), "공업 50 → 간격 −20%")
end

-- 9·10 거부 무변경 · 거부 코드
do
	local s = newGame()
	local before = Sim.canonical(s)
	local cases = {
		{ { type = "hire", kind = "archer", ownerId = 0 }, "INSUFFICIENT_GOLD" },
		{ { type = "hire", kind = "hero_archer", ownerId = 0 }, "INVALID_KIND" },
		{ { type = "hire", kind = "archer", ownerId = 5 }, "INVALID_OWNER" },
		{ { type = "upgrade", stat = "attack", count = -1, ownerId = 0 }, "INVALID_UPGRADE" },
		{ { type = "combine", unitIds = { 0 / 0, 1, 2 }, ownerId = 0 }, "INVALID_MATERIALS" },
		{ { type = "combine", unitIds = { "a", "b", "c" }, ownerId = 0 }, "INVALID_MATERIALS" },
		{ { type = "garrison", unitIds = { math.huge }, towerId = 1, ownerId = 0 }, "INVALID_UNITS" },
		{ { type = "assign", unitId = 1, job = "wood", nodeId = "wood_west", ownerId = 0 }, "INVALID_WORKER" },
		{ { type = "build", workerId = 1, x = 60, z = 140, ownerId = 0 }, "INVALID_WORKER" },
		{ { type = "cancelBuild", towerId = 99, ownerId = 0 }, "INVALID_TOWER" },
		{ { type = "heroSkill", skill = "multishot", dx = 1, dz = 0, ownerId = 0 }, "SKILL_UNAVAILABLE" },
		{ { type = "heroSkill", skill = 42, dx = 1, dz = 0, ownerId = 0 }, "SKILL_UNAVAILABLE" },
		{ { type = "nope", ownerId = 0 }, "UNKNOWN_COMMAND" },
		{ "string", "INVALID_COMMAND" },
	}
	for _, c in cases do
		local r = Sim.act(s, c[1])
		check(r.ok == false and r.code == c[2], ("거부 코드 %s (got %s)"):format(c[2], tostring(r.code)))
	end
	check(Sim.canonical(s) == before, "거부된 명령은 상태를 바꾸지 않는다")
	s.owners[1].upgrades.attack = 50; s.owners[1].gold = 10000
	local capBefore = Sim.canonical(s)
	check(Sim.act(s, { type = "upgrade", stat = "attack", count = 1, ownerId = 0 }).code == "UPGRADE_CAP" and Sim.canonical(s) == capBefore, "UPGRADE_CAP 거부도 무변경")
	s.owners[1].upgrades.attack = 0; s.owners[1].gold = 0
	local l = Sim.leaderOf(s, 0)
	local r = Sim.act(s, { type = "garrison", unitIds = { l.id }, towerId = 1, ownerId = 0 })
	check(r.code == "LEADER" or r.code == "INVALID_TOWER", "선두 주둔 거부 (" .. tostring(r.code) .. ")")
end

-- 3·5·6 첫 웨이브 80/112 · 출발지 · 타이머
do
	local s = newGame(1, "solo")
	local first
	run(s, 8.2, function() for _, e in events(s, "wave") do first = first or e end end)
	check(first and first.count == 80 and near(first.tick * DT, 8, DT) and first.x == Grid.SITES.outpost_entry.x and first.z == Grid.SITES.outpost_entry.z, "첫 웨이브 8초 80마리 전초기지 입구")
	local c = newGame(2, "coop")
	local cf
	run(c, 8.2, function() for _, e in events(c, "wave") do cf = cf or e end end)
	check(cf and cf.count == 112, "협동 첫 웨이브 112")
	-- 둘째 웨이브는 전량 방출 완료 + 15초 뒤, 160마리
	local s2 = newGame(3)
	s2.owners[1].gold = 100000; s2.base.hp = 1e9; s2.base.maxHp = 1e9 -- 리더·본진이 죽어도 끝나지 않게 (타이머만 본다)
	local done, second = nil, nil
	run(s2, 120, function()
		if not done and s2.wave.number == 1 and Campaign.waveReleaseRemaining(s2) == 0 then done = s2.time end
		for _, e in events(s2, "wave") do if e.number == 2 then second = second or e end end
	end)
	check(done and second and second.count == 160 and near(second.tick * DT, done + 15, 0.2), ("둘째 웨이브 = 방출 완료 %.2f + 15초 (실제 %.2f), 160마리"):format(done or -1, second and second.tick * DT or -1))
	-- 출발지 전환: 전초 탑·파수꾼 하나라도 살아 있으면 입구, 둘 다 죽으면 정규 입구
	local s3 = newGame(4)
	run(s3, 1)
	for _, e in s3.enemies do if e.siteId == "outpost_guard" then e.hp = 0 end end
	s3.wave.next = s3.time; s3.campaign.spawnQueue = {}
	run(s3, 0.1)
	local w1 = events(s3, "wave")
	check(Campaign.openingWaveActive(s3) == true, "탑만 남아도 전초기지 활성")
	for _, e in s3.enemies do if e.siteId == "outpost_tower" then e.hp = 0 end end
	run(s3, 0.1)
	s3.wave.next = s3.time; s3.campaign.spawnQueue = {}
	local w2
	run(s3, 0.1, function() for _, e in events(s3, "wave") do w2 = w2 or e end end)
	check(w2 and w2.x == Grid.SITES.wave_entry.x and w2.z == Grid.SITES.wave_entry.z, "둘 다 죽으면 정규 입구 (172,72)")
end

-- 4 행렬 방출 간격 · 이동 간격 (예정 간격 = 방출 직후 nextRelease − 현재 시각. 자리가 막히면 실제 생성은 몇 틱 늦어진다 — 원작도 같다)
do
	local s = newGame(5)
	s.units = {}; s.owners[1].leaderId = nil; s.owners[1].gold = 100000; s.base.hp = 1e9; s.base.maxHp = 1e9
	local gaps, lastCursor, seen = {}, 0, {}
	local firstBurst = nil
	run(s, 20, function()
		for _, q in s.campaign.spawnQueue do
			if q.source == "wave" and q.cursor > lastCursor then
				lastCursor = q.cursor
				table.insert(gaps, q.nextRelease - s.time)
			end
		end
		for _, e in s.enemies do if e.wave and not seen[e.id] then seen[e.id] = true end end
	end)
	local inside, between, other = 0, 0, 0
	for _, gap in gaps do
		if gap >= 0.13 - 1e-9 and gap <= 0.21 + 1e-9 then inside += 1 elseif gap >= 0.45 - 1e-9 and gap <= 0.75 + 1e-9 then between += 1 else other += 1 end
	end
	local spawned = 0
	for _ in seen do spawned += 1 end
	check(#gaps >= 20 and inside > 0 and between > 0 and other == 0, ("행렬 예정 간격 안 0.13~0.21 / 사이 0.45~0.75 (%d/%d/%d)"):format(inside, between, other))
	check(spawned >= 20, ("20초 안에 20마리 이상 생성 (%d)"):format(spawned))
	-- 행군 중(본진 20 스터드 밖)인 적끼리만. 본진에 붙어 공격하는 적은 원작도 겹친다.
	local minGap, marching = math.huge, 0
	local function far(e) return math.sqrt((e.x - s.base.x) ^ 2 + (e.z - s.base.z) ^ 2) > 20 end
	for i, a in s.enemies do if a.wave and far(a) then marching += 1 for j, b in s.enemies do if i < j and b.wave and far(b) then
		minGap = math.min(minGap, math.sqrt((a.x - b.x) ^ 2 + (a.z - b.z) ^ 2))
	end end end end
	check(marching >= 2 and minGap >= 3.5, ("행군 중 최소 간격 ≥3.5 (실제 %.2f, %d마리)"):format(minGap, marching))
end

-- 7·8 목수 수입 · 건설 · 취소 환급 · 노드 3명
do
	local s = newGame(6)
	s.owners[1].gold = 2000
	s.wave.next = 1e9; s.campaign.nextHunt = 1e9
	local r = Sim.act(s, { type = "hire", kind = "carpenter", ownerId = 0 })
	check(r.ok and s.owners[1].gold == 1500, "목수 고용 500G")
	local w = Sim.unitById(s, r.unitId)
	check(w.job == "wood" and w.nodeId == "wood_west", "고용 즉시 첫 빈 숲 자동 배치")
	local firstIncome
	run(s, 40, function() for _, e in events(s, "income") do if e.source == "harvest" then firstIncome = firstIncome or { t = s.time, amount = e.amount } end end end)
	local node = Grid.SITES.wood_west
	local walk = math.sqrt((node.x - s.base.x) ^ 2 + (node.z - s.base.z) ^ 2) / Balance.UNITS.carpenter.speed
	check(firstIncome and firstIncome.amount == 10 and firstIncome.t > walk * 2 + 6 - 0.5 and firstIncome.t < walk * 2 + 6 + 2.5, ("첫 반납 ≈ 왕복 %.1f + 6초 (실제 %.2f) +10G"):format(walk * 2, firstIncome and firstIncome.t or -1))
	for _ = 1, 3 do Sim.act(s, { type = "hire", kind = "carpenter", ownerId = 0 }) end
	local before = s.owners[1].gold
	local r4 = Sim.act(s, { type = "assign", unitId = s.units[#s.units].id, job = "wood", nodeId = "wood_west", ownerId = 0 })
	check(r4.code == "NODE_FULL" and s.owners[1].gold == before, "노드 4번째 거부 · 무차감")
	-- 건설
	s.owners[1].gold = 5000
	local gold0 = s.owners[1].gold
	local b = Sim.act(s, { type = "build", workerId = w.id, x = 61, z = 141, ownerId = 0 })
	check(b.ok and s.owners[1].gold == gold0 - 220, "건설 220 차감 (" .. tostring(b.code) .. " " .. tostring(b.message) .. ")")
	local tower = Sim.towerById(s, b.towerId)
	check(tower.footprint.x == 60 and tower.footprint.z == 140, "건설 좌표 셀로 내림")
	local completedAt
	run(s, 60, function() for _, e in events(s, "towerComplete") do completedAt = completedAt or s.time end end)
	check(tower.state == "completed" and tower.hp == 800 and tower.maxHp == 800 and completedAt, "20초 공사 → 완공 800HP")
	-- 취소 환급
	local b2 = Sim.act(s, { type = "build", workerId = w.id, x = 100, z = 160, ownerId = 0 })
	local t2 = Sim.towerById(s, b2.towerId)
	run(s, 1)
	local g = s.owners[1].gold
	local cancel = Sim.act(s, { type = "cancelBuild", towerId = t2.id, ownerId = 0 })
	check(cancel.ok and s.owners[1].gold == g + math.floor(220 * (1 - t2.progress) * 0.75), "취소 환급 floor(220×(1−p)×.75)")
	-- 주둔: 걸어가서 입장, 예약 4, 빈 탑 비공격
	for _ = 1, 4 do Sim.act(s, { type = "hire", kind = "archer", ownerId = 0 }) end
	local ids = {}
	for _, u in s.units do if u.kind == "archer" and not u.isLeader then table.insert(ids, u.id) end end
	local g1 = Sim.act(s, { type = "garrison", unitIds = ids, towerId = tower.id, ownerId = 0 })
	check(g1.ok and #tower.reservations == 4, "주둔 예약 4")
	local g2 = Sim.act(s, { type = "hire", kind = "archer", ownerId = 0 })
	local extra = Sim.unitById(s, g2.unitId)
	check(Sim.act(s, { type = "garrison", unitIds = { extra.id }, towerId = tower.id, ownerId = 0 }).code == "GARRISON_FULL", "다섯째 거부")
	run(s, 15)
	check(#tower.occupants == 4, "걸어가서 4명 입장")
	local stats = Sim.unitStats(s, Sim.unitById(s, ids[1]))
	check(stats.garrison and near(stats.range, Balance.UNITS.archer.range + Balance.TOWER.rangeBonus), "주둔 사거리 +60px")
	tower.hp = 0
	run(s, DT)
	check(tower.state == "destroyed", "탑 파괴")
	local outside = true
	for _, id in ids do local u = Sim.unitById(s, id); if u then
		local inside = u.x >= 60 and u.x < 72 and u.z >= 140 and u.z < 152
		if inside or u.towerId then outside = false end
		check(near(u.hp, Balance.UNITS.archer.hp * 0.75, 0.01) or u.hp <= Balance.UNITS.archer.hp * 0.75 + 0.01, "파괴 시 주둔자 HP 25% 손실")
	end end
	check(outside, "파괴 시 발자국 밖 배치")
end

-- 11 협동 보상 분배 · 12 경제 패배 경계 · 회복
do
	local s = newGame(7, "coop")
	s.wave.next = 1e9; s.campaign.nextHunt = 1e9
	local enemy = { id = 9999, kind = "zombie", x = 100, z = 100, homeX = 100, homeZ = 100, hp = 1, maxHp = 24, cooldown = 1e9, abilityCooldown = 8, contributors = { [0] = s.time, [1] = s.time }, lastDamageOwnerId = 0 }
	table.insert(s.enemies, enemy)
	local a, b = Sim.leaderOf(s, 0), Sim.leaderOf(s, 1)
	a.x, a.z = 95, 100; b.x, b.z = 200, 10
	Sim.setLeader(s, 0, 95, 100, false); Sim.setLeader(s, 1, 200, 10, false)
	local g0, g1 = s.owners[1].gold, s.owners[2].gold
	Sim.step(s, DT)
	check(s.owners[1].gold - g0 == 8 and s.owners[2].gold - g1 == 7, "협동 보상 15 → 8/7 (낮은 id 가 나머지)")
	local e2 = { id = 9998, kind = "zombie", x = 100, z = 100, homeX = 100, homeZ = 100, hp = 1, maxHp = 24, cooldown = 1e9, abilityCooldown = 8, contributors = { [1] = s.time - 11 }, lastDamageOwnerId = 1 }
	table.insert(s.enemies, e2)
	g0, g1 = s.owners[1].gold, s.owners[2].gold
	a.cooldown = 0
	Sim.setLeader(s, 0, 95, 100, false); Sim.setLeader(s, 1, 200, 10, false)
	Sim.step(s, DT)
	check(s.owners[1].gold - g0 == 15 and s.owners[2].gold == g1, ("10초 밖 기여는 제외, 최근 처치자만 (A +%d, B +%d)"):format(s.owners[1].gold - g0, s.owners[2].gold - g1))
	-- 경제 패배 경계
	local d = newGame(8)
	d.units = {}; d.owners[1].leaderId = nil; d.owners[1].gold = 499
	Sim.step(d, DT)
	check(d.phase == "dead" and d.defeat.reason == "economy", "유닛 0·499G → 경제 패배")
	local d2 = newGame(9)
	d2.units = {}; d2.owners[1].leaderId = nil; d2.owners[1].gold = 500
	Sim.step(d2, DT)
	check(d2.phase == "playing", "유닛 0·500G → 계속")
	-- 회복
	local h = newGame(10)
	h.wave.next = 1e9; h.campaign.nextHunt = 1e9
	local l = Sim.leaderOf(h, 0)
	l.hp = 10; l.lastCombatTime = h.time
	Sim.setLeader(h, 0, l.x, l.z, false)
	check(near(Sim.healingRate(h, l), 0.5), "치료사 반경 안 50%/초 (본진 2% 보다 높은 쪽)")
	l.x, l.z = h.base.x - 10, h.base.z + 1
	check(near(Sim.healingRate(h, l), 0.02), "본진 전투 중 2%/초")
	l.lastCombatTime = h.time - 4
	check(near(Sim.healingRate(h, l), 0.10), "본진 비전투 3초 뒤 10%/초")
end

-- 13 리더 클램프 · 14 리더 없음 · 합성 리더 승계 · 영웅 Q/E
do
	local s = newGame(11)
	local l = Sim.leaderOf(s, 0)
	local x0, z0 = l.x, l.z
	Sim.setLeader(s, 0, x0 + 20, z0, true)
	Sim.step(s, DT)
	check(l.x == x0 and l.z == z0 and #events(s, "correct") == 1, "한 틱 20 스터드 점프 → 미변경 + correct")
	Sim.setLeader(s, 0, x0 + 0.4, z0, true)
	Sim.step(s, DT)
	check(near(l.x, x0 + 0.4), "정상 걸음 수용")
	Sim.setLeader(s, 0, 2, 2, true)
	Sim.step(s, DT)
	check(near(l.x, x0 + 0.4) and l.x ~= 2, "벽 셀로는 못 간다")
	-- 리더 없음: 자동 고용 없음, hire 로 승계
	l.hp = 0
	s.owners[1].gold = 1000
	Sim.step(s, DT)
	check(s.owners[1].leaderId == nil and s.owners[1].gold == 1000, "리더 사망·병력 0 → 리더 없음, 자동 차감 없음")
	local r = Sim.act(s, { type = "hire", kind = "archer", ownerId = 0 })
	check(r.ok and s.owners[1].leaderId == r.unitId and Sim.unitById(s, r.unitId).isLeader, "고용한 병력이 리더")
	-- 합성: 리더 포함 3 → 영웅이 리더
	s.owners[1].gold = 5000
	local a1 = Sim.act(s, { type = "hire", kind = "archer", ownerId = 0 }).unitId
	local a2 = Sim.act(s, { type = "hire", kind = "archer", ownerId = 0 }).unitId
	local before = Sim.canonical(s)
	local bad = Sim.act(s, { type = "combine", unitIds = { a1, a2, a2 }, ownerId = 0 })
	check(bad.ok == false and Sim.canonical(s) == before, "합성 중복 id 거부·무변경")
	local c = Sim.act(s, { type = "combine", unitIds = { s.owners[1].leaderId, a1, a2 }, ownerId = 0 })
	local hero = Sim.unitById(s, c.unitId)
	check(c.ok and hero.kind == "hero_archer" and hero.isLeader and s.owners[1].leaderId == hero.id and #s.units == 1, "리더 포함 합성 → 영웅이 리더, 재료 3 소비")
	-- Q: 부채꼴 안 적 6명까지 150%
	s.wave.next = 1e9; s.campaign.nextHunt = 1e9; s.enemies = {}
	for i = 1, 8 do table.insert(s.enemies, { id = 5000 + i, kind = "zombie", x = hero.x + 10 + i * 0.5, z = hero.z + (i - 4) * 0.8, homeX = hero.x, homeZ = hero.z, hp = 24, maxHp = 24, cooldown = 1e9, abilityCooldown = 8, contributors = {} }) end
	local q = Sim.act(s, { type = "heroSkill", skill = "multishot", dx = 1, dz = 0, ownerId = 0 })
	local hit = 0
	for _, e in s.enemies do if e.hp < 24 then hit += 1 end end
	check(q.ok and hit == 6, ("Q 는 최대 6명 (실제 %d)"):format(hit))
	check(s.enemies[1].hp == math.max(0, 24 - math.max(1, (40 + 2 * s.owners[1].upgrades.attack) * 1.5)), "Q 피해 150% (체력 0 에서 멈춘다)")
	check(Sim.act(s, { type = "heroSkill", skill = "multishot", dx = 1, dz = 0, ownerId = 0 }).code == "SKILL_UNAVAILABLE", "Q 재사용 대기 14초")
	-- E: 최대 15 스터드, 9틱, 벽 앞에서 멈춤
	local hx = hero.x
	local e = Sim.act(s, { type = "heroSkill", skill = "roll", dx = 1, dz = 0, length = 100, ownerId = 0 })
	check(e.ok and hero.roll ~= nil, "구르기 시작")
	run(s, DT * 10)
	check(hero.roll == nil and near(hero.x, hx + 15, 0.6), ("구르기 15 스터드 (실제 %.2f)"):format(hero.x - hx))
	local wallHero = { x = 10, z = 100 } -- 서쪽 벽(x<8)까지 2 스터드
	hero.x, hero.z = wallHero.x, wallHero.z
	check(Sim.act(s, { type = "heroSkill", skill = "roll", dx = -1, dz = 0, ownerId = 0 }).code == "SKILL_UNAVAILABLE", "재사용 대기 중 거부")
	hero.rollReadyTick = 0
	check(Sim.act(s, { type = "heroSkill", skill = "roll", dx = -1, dz = 0, ownerId = 0 }).code == "ROLL_BLOCKED", "벽 쪽 3 스터드 미만 → ROLL_BLOCKED")
end

-- 파수꾼 leash·귀환 · 첨탑 예고 · 보상 180 1회 · C1 보상·역습 · 정찰형 HP · 거점 25
do
	local s = newGame(12)
	s.wave.next = 1e9; s.campaign.nextHunt = 1e9
	run(s, 1)
	local guard, tower
	for _, e in s.enemies do if e.siteId == "outpost_guard" then guard = e elseif e.siteId == "outpost_tower" then tower = e end end
	check(guard and guard.hp == 600 and guard.kind == "vampire" and tower and tower.kind == "enemy_tower", "전초기지 파수꾼 600 · 가시 첨탑")
	local campCount = 0
	for _, e in s.enemies do if e.campId == "C1" then campCount += 1 end end
	check(campCount == 25, ("거점 주둔 25 (실제 %d)"):format(campCount))
	local scout = newGame(13)
	run(scout, 9)
	local scoutHp
	for _, e in scout.enemies do if e.wave then scoutHp = e.maxHp; break end end
	check(scoutHp == 12, "정찰형 HP 12")
	local l = Sim.leaderOf(s, 0)
	l.x, l.z = guard.homeX - 12, guard.homeZ
	l.cooldown = 1e9
	Sim.setLeader(s, 0, l.x, l.z, false)
	local gx = guard.x
	Sim.step(s, DT)
	check(guard.x < gx and guard.guardState == "engaged", "파수꾼 인식 안 추격")
	l.x, l.z = Grid.SITES.healer.x, Grid.SITES.healer.z
	Sim.setLeader(s, 0, l.x, l.z, false)
	run(s, 6)
	check(math.sqrt((guard.x - guard.homeX) ^ 2 + (guard.z - guard.homeZ) ^ 2) < 2 and guard.guardState == "guarding", "추격 한계 밖 → 귀환")
	-- 첨탑: 예고 0.55초 뒤 12
	s.effects = {}
	tower.cooldown = 0
	l.x, l.z = tower.x - 25, tower.z; l.hp = 100; l.lastCombatTime = s.time
	Sim.setLeader(s, 0, l.x, l.z, false)
	Sim.step(s, DT)
	local warn = false
	for _, fx in s.effects do if fx.attack == "spike" and fx.type == "warning" then warn = true end end
	check(warn, "첨탑 예고 표식")
	l.lastCombatTime = s.time
	run(s, 0.6, function() l.lastCombatTime = s.time end)
	check(l.hp == 88, ("예고 뒤 피해 12 (hp %d)"):format(l.hp))
	-- 파수꾼 보상 180 한 번
	guard.hp = 1; guard.x, guard.z = guard.homeX, guard.homeZ
	l.x, l.z = guard.homeX - 10, guard.homeZ; l.cooldown = 0
	Sim.setLeader(s, 0, l.x, l.z, false)
	local gold = s.owners[1].gold
	Sim.step(s, DT); Sim.step(s, DT)
	check(s.owners[1].gold == gold + 180, "파수꾼 보상 180 한 번")
	-- C1 보상 100 + 역습 6
	local g2 = s.owners[1].gold
	s.camp.hp = 0
	Sim.step(s, DT)
	check(s.camp.cleared and s.owners[1].gold == g2 + 100, "C1 보상 100")
	check(s.camp.ambushPending == true, "역습 대기 표시")
	local waveBefore = 0
	for _, e in s.enemies do if e.wave then waveBefore += 1 end end
	Sim.step(s, DT)
	local ambushers = 0
	for _, e in s.enemies do if e.wave and math.abs(e.homeX - s.camp.x) < 1 and math.abs(e.homeZ - (s.camp.z - 15)) < 1 then ambushers += 1 end end
	check(ambushers == 6 and not s.camp.ambushPending, ("역습 6마리가 거점 앞에 선다 (%d)"):format(ambushers))
end

-- 15·16 스냅샷 복원 · 손상 스냅샷
do
	local s = newGame(14)
	run(s, 12)
	local snap = Sim.snapshot(s)
	local a, b = Sim.restore(snap), Sim.restore(snap)
	for _ = 1, 90 do Sim.step(a, DT); Sim.step(b, DT) end
	check(Sim.canonical(a) == Sim.canonical(b), "복원본 둘 90틱 동일")
	local c = Sim.restore(snap)
	Sim.step(s, DT); Sim.step(c, DT)
	check(Sim.canonical(s) == Sim.canonical(c), "복원본과 원본 1틱 동일")
	local wrongVersion = Sim.snapshot(s); wrongVersion.version = 2
	local wrongMode = Sim.snapshot(s); wrongMode.mode = "duo"
	check(Sim.restore(wrongVersion) == nil and Sim.restore(wrongMode) == nil and Sim.restore("x") == nil and Sim.restore({ version = 1, mode = "solo", phase = "playing" }) == nil, "손상 스냅샷(버전·모드·필드 결손) nil")
	-- 패킷 왕복
	local actors = Packet.collect(s, Grid.SITES.base)
	local decoded = Packet.decode(Packet.encode(s, actors))
	check(#decoded.actors == #actors and decoded.tick == s.tick and near(decoded.actors[1].x, actors[1].x, 0.01), "패킷 왕복")
end

-- 17 원작 오라클: still 봇 리더 사망 18.7~35.3초 · 무사격 첫 피해 10.7~17.0초 (verifications/original-bot.md)
local deaths, hits = {}, {}
for seed = 1, 20 do
	local s = newGame(seed)
	local died
	run(s, 60, function()
		local o = s.owners[1]
		local stat = if o.upgrades.armor <= o.upgrades.attack then "armor" else "attack"
		local cost = Sim.price(s, 0, stat)
		if o.upgrades.attack + o.upgrades.armor < 5 and cost and o.gold >= cost then Sim.act(s, { type = "upgrade", stat = stat, count = 1, ownerId = 0 }) end
		if o.gold >= 500 then Sim.act(s, { type = "hire", kind = "carpenter", ownerId = 0 }) end
	end)
	for _, e in ({ s.defeat }) do end
	died = s.defeat and s.defeat.tick * DT or nil
	if not died then
		local anyFighter = false
		for _, u in s.units do if u.kind ~= "carpenter" then anyFighter = true end end
		if not anyFighter then died = s.time end
	end
	table.insert(deaths, died or -1)
	local n = newGame(seed)
	local snap = Sim.snapshot(n)
	for _, u in snap.units do u.cooldown = 1e9; u.assignment = "garrison" end -- 원작 측정과 같은 손잡이: 사격 없음 · 적이 무시
	n = Sim.restore(snap)
	local hitAt
	run(n, 40, function() if not hitAt and n.base.hp < n.base.maxHp then hitAt = n.time end end)
	table.insert(hits, hitAt or -1)
end
local function range(list) local lo, hi = math.huge, -math.huge for _, v in list do lo = math.min(lo, v); hi = math.max(hi, v) end return lo, hi end
local dlo, dhi = range(deaths)
local hlo, hhi = range(hits)
local fmt = {}
for i = 1, 20 do table.insert(fmt, ("%.2f"):format(deaths[i])) end
print("ORACLE still-bot leader death per seed: " .. table.concat(fmt, " "))
fmt = {}
for i = 1, 20 do table.insert(fmt, ("%.2f"):format(hits[i])) end
print("ORACLE nofire first base hit per seed: " .. table.concat(fmt, " "))
check(dlo >= 18.7 and dhi <= 35.3, ("still 봇 리더 사망 %.2f~%.2f 가 원작 23.37~29.40 ±20%% 안"):format(dlo, dhi))
check(hlo >= 10.7 and hhi <= 17.0, ("무사격 첫 피해 %.2f~%.2f 가 원작 13.37~14.13 ±20%% 안"):format(hlo, hhi))

-- 결정성 해시 (verify.py 가 별도 프로세스 둘에서 비교)
local d = newGame(1989)
run(d, 30)
local text = Sim.canonical(d)
local hash = 0
for i = 1, #text do hash = (hash * 31 + string.byte(text, i)) % 4294967296 end
print(("HASH %08x"):format(hash))
print(("PASS %d actual Luau assertions (rules, economy, towers, waves, outpost, hero skills, snapshot, oracle windows) — not Roblox runtime"):format(count))
