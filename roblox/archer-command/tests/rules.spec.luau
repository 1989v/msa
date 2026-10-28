-- 실제 shared/Config·Rules 를 공식 luau CLI 로 실행하는 검사. Roblox 의 Vector3 만 X/Y/Z 필드 테이블로 대신한다.
local function V(x, y, z) return { X = x, Y = y, Z = z } end
local Config = require("../src/shared/Config")
local Rules = require("../src/shared/Rules")
local n = 0
local function check(cond, msg) assert(cond, msg); n += 1 end

-- 가격·강화 비용
check(Rules.price("archer") == 700 and Rules.price("longbow") == 1200 and Rules.price("carpenter") == 500, "고용 가격")
check(Rules.price("hero") == 0 and Rules.price("veteran") == 0 and Rules.price("marksman") == 0 and Rules.price("heavy") == 0 and Rules.price("nope") == nil, "영웅·정예·명궁·중갑은 합성 전용, 미지 종류 nil")
check(Rules.price("shield") == 900 and Rules.price("crossbow") == 1500 and Config.UNITS.shield.mercenary and Config.UNITS.crossbow.mercenary, "용병 둘은 고용 가능")
check(Rules.upgradeCost("attack", 0) == 80 and Rules.upgradeCost("attack", 5) == 280 and Rules.upgradeCost("armor", 3) == 230, "강화 비용 base+step*level")
check(Rules.upgradeCost("attack", 30) == nil and Rules.upgradeCost("zzz", 0) == nil, "상한·미지 nil")

-- 고용: 금화 부족 → GOLD, 성공 시 차감과 수 증가
local eco = Rules.newEconomy()
check(eco.gold == Config.START.gold and Config.START.gold >= Rules.upgradeCost("attack", 0) + Rules.upgradeCost("attack", 1) + Rules.upgradeCost("armor", 0), "시작 군자금으로 공업 둘·방업 하나")
local ok, why = Rules.hire(eco, "archer"); check(not ok and why == "GOLD" and eco.gold == Config.START.gold, "금화 부족이면 거부하고 상태 불변")
eco.gold = 1400
ok = Rules.hire(eco, "archer"); check(ok and eco.gold == 700 and eco.counts.archer == 1, "고용 차감")
ok = Rules.hire(eco, "archer"); check(ok and eco.gold == 0 and eco.counts.archer == 2, "두 번째 고용")
ok, why = Rules.hire(eco, "hero"); check(not ok and why == "UNKNOWN", "영웅 직접 고용 불가")
-- 전투 병력 상한
local full = Rules.newEconomy(); full.gold = 1e6; full.counts.archer = Config.LIMITS.allies
ok, why = Rules.hire(full, "longbow"); check(not ok and why == "LIMIT", "전투 병력 상한")
local merc = Rules.newEconomy(); merc.gold = 1e6; merc.counts.shield = Config.LIMITS.allies - 1
ok = Rules.hire(merc, "crossbow"); check(ok, "용병도 전투 병력에 든다 · 한 자리 남으면 고용")
ok, why = Rules.hire(merc, "archer"); check(not ok and why == "LIMIT", "용병이 찬 자리는 활잡이도 못 든다")
ok = Rules.hire(full, "carpenter"); check(ok, "목수는 별도 상한")
full.counts.carpenter = Config.LIMITS.carpenters
ok, why = Rules.hire(full, "carpenter"); check(not ok and why == "LIMIT", "목수 상한")

-- 강화
local up = Rules.newEconomy(); up.gold = 100
ok = Rules.upgrade(up, "attack"); check(ok and up.gold == 20 and up.upgrades.attack == 1, "공업 1")
ok, why = Rules.upgrade(up, "attack"); check(not ok and why == "GOLD", "비용 부족")
up.upgrades.armor = Config.UPGRADES.armor.max; up.gold = 1e6
ok, why = Rules.upgrade(up, "armor"); check(not ok and why == "MAX", "상한")

-- 합성(강화): 같은 병종 셋 → 한 단계 위
local c = Rules.newEconomy(); c.counts.archer = 2
ok, why = Rules.combine(c, "archer"); check(not ok and why == "COUNT" and c.counts.archer == 2, "셋 미만 거부")
c.counts.archer = 4
ok = Rules.combine(c, "archer"); check(ok and c.counts.archer == 1 and c.counts.veteran == 1, "활잡이 3 → 정예 1")
c.counts.veteran = 3
ok = Rules.combine(c, "veteran"); check(ok and c.counts.veteran == 0 and c.counts.hero == 1, "정예 3 → 영웅 1")
c.counts.longbow = 3; c.counts.shield = 3
ok = Rules.combine(c, "longbow"); check(ok and c.counts.marksman == 1, "장궁수 3 → 명궁")
ok = Rules.combine(c, "shield"); check(ok and c.counts.heavy == 1, "방패 3 → 중갑")
ok, why = Rules.combine(c, "hero"); check(not ok and why == "UNKNOWN", "영웅은 더 합칠 수 없다")
check(#Config.COMBINES >= 3, "합성 규칙 셋 이상")

-- 피해
check(Rules.attackDamage(14, 0) == 14 and Rules.attackDamage(14, 5) == 24, "공업 +2/레벨")
check(Rules.damageTaken(8, 0) == 8 and Rules.damageTaken(8, 3) == 5 and Rules.damageTaken(8, 30) == 1, "방업 −1/레벨, 최소 1")

-- 웨이브 구성: 단조 증가, 첫 웨이브는 작게, 종류가 늘고, 5번째마다 거구 보스
local w1, w2, w3, w5 = Rules.waveComposition(1), Rules.waveComposition(2), Rules.waveComposition(3), Rules.waveComposition(5)
check(w1.zombie == 6 and w1.plague == 0 and w1.bat == 0 and w1.runner == 0 and Rules.waveTotal(1) <= 8, "첫 웨이브 좀비 6, 8 이하")
check(Config.WAVES.firstAt >= 60 and #Config.WAVES.entries >= 3 and Config.SWARM.speedJitter > 0, "첫 웨이브 60초 뒤, 입구 셋 이상, 속도 흔들림")
check(w2.plague == 1 and w2.runner == 2 and w3.bat == 2 and w3.bomber == 1 and Rules.waveTotal(3) > Rules.waveTotal(2) and Rules.waveTotal(2) > Rules.waveTotal(1), "웨이브 증가·종류 추가")
check(w5.brute == 1 and Rules.waveComposition(4).brute == 0 and Rules.waveComposition(10).brute == 1, "5번째마다 거구 보스")
local kinds = 0
for kind, n in Rules.waveComposition(6) do if n > 0 then kinds += 1 end end
check(kinds >= 5, "6 웨이브엔 다섯 종류 이상")
for i = 1, 10 do check(Rules.waveTotal(i) <= Config.LIMITS.enemies, "10 웨이브까지 동시 상한 이하") end
check(Rules.enemyDamageTaken(16, 4) == 12 and Rules.enemyDamageTaken(2, 4) == 1 and Rules.enemyDamageTaken(10, nil) == 10, "철갑 차감, 최소 1")
check(Config.ENEMIES.brute.boss and Config.ENEMIES.brute.boulder and Config.ENEMIES.brute.boulder.range > Config.ENEMIES.brute.attackRange and Config.ENEMIES.brute.maxHealth >= 600, "거구는 보스 · 원거리 투척")
local enemyKinds = 0
for _ in pairs(Config.ENEMIES) do enemyKinds += 1 end
check(enemyKinds >= 7, "적 일곱 종류 이상")
check(Config.TOWER.autoBuildSeconds > 0 and Config.TOWER.ballista.damage > 0 and Config.TOWER.ballista.range > 20, "탑은 스스로 지어지고 발리스타가 쏜다")
local skills = 0
for _, s in pairs(Config.SKILLS) do if s.cooldown > 0 then skills += 1 end end
check(skills >= 4 and Config.SKILLS.rain.target == "ground" and Config.SKILLS.dash.target == "self", "스킬 넷 이상, 지면/자기 대상")
check(Config.PLAYER.jumpPower == 50, "점프는 Roblox 기본 50")

-- 탑 배치
local me = V(30, 0, -20)
ok = Rules.canPlaceTower(V(34, 0, -24), me, {}, 0); check(ok, "가까운 빈 자리")
ok, why = Rules.canPlaceTower(V(120, 0, -24), me, {}, 0); check(not ok and why == "FAR", "플레이어에서 멀면 거부")
ok, why = Rules.canPlaceTower(V(2, 0, 2), V(0, 0, 0), {}, 0); check(not ok and why == "SITE", "본진 위 거부")
ok, why = Rules.canPlaceTower(V(34, 0, -24), me, { V(36, 0, -26) }, 1); check(not ok and why == "SPACING", "다른 탑과 간격")
ok, why = Rules.canPlaceTower(V(34, 0, -24), me, {}, Config.LIMITS.towers); check(not ok and why == "LIMIT", "탑 상한")
ok, why = Rules.canPlaceTower(V(-40, 0, 0), V(-30, 0, 0), {}, 0); check(not ok and why == "BOWL", "분지 밖")

-- 운반 수입 · 저장 정리
check(Rules.carryGold("wood") == 10 and Rules.carryGold("ore") == 16 and Rules.carryGold("x") == 0, "운반 수입")
local s = Rules.sanitizeSave({ gold = 123.7, upgrades = { attack = 2, armor = 1 }, counts = { archer = 3, longbow = 0, hero = 1, carpenter = 2 } })
check(s and s.gold == 123 and s.upgrades.attack == 2 and s.counts.hero == 1 and s.counts.shield == 0, "정상 저장 복원(내림) · 옛 저장엔 없는 병종은 0")
check(Rules.sanitizeSave({ gold = -1, upgrades = {}, counts = {} }) == nil, "음수 거부")
check(Rules.sanitizeSave({ gold = 0 / 0, upgrades = { attack = 0, armor = 0 }, counts = {} }) == nil, "NaN 거부")
check(Rules.sanitizeSave({ gold = 1, upgrades = { attack = 99, armor = 0 }, counts = { archer = 0, longbow = 0, hero = 0, carpenter = 0 } }) == nil, "강화 상한 초과 거부")
check(Rules.sanitizeSave("x") == nil, "문자열 거부")

print(string.format("PASS %d actual Luau assertions on shared Config/Rules (prices, hire limits, upgrades, combine, damage, waves, tower placement, save sanitize) — not Roblox runtime", n))
