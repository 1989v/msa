-- 서버 Combat·Bots 를 Roblox 대역 위에서 실제로 돌리는 스모크 테스트. tools/smoke.py 가 쉼·Combat·Bots 본문 뒤에 이 파일을 이어 붙여 한 청크로 만든다.
-- 여기서 쓰는 Shim·Combat·Bots·Config·Rules·Styles·Moves·Vector3·CFrame·Instance·workspace 는 그 청크의 local 이다.
-- 판정 기준은 「대상이 내놓은 값」 — Humanoid.Health, 파이터 상태, 위치. 코드 모양을 보지 않는다.
local checks, fails = 0, 0
local function check(cond, msg)
	checks += 1
	if not cond then fails += 1; print("FAIL " .. msg) end
end
local DT = 1 / 60
local function run(seconds, each)
	local n = math.floor(seconds / DT + 0.5)
	for i = 1, n do
		Combat.update(DT)
		if each then each(i * DT) end
		Shim.step(DT)
	end
end

local counter = 0
local function makeFighter(style, acc, x, z, faceX, faceZ, isBot, team)
	counter += 1
	local id = style .. counter
	local model = Instance.new("Model"); model.Name = id; model.Parent = workspace
	local root = Instance.new("Part"); root.Name = "HumanoidRootPart"; root.Size = Vector3.new(2, 2, 1); root.Parent = model
	root.CFrame = CFrame.lookAt(Vector3.new(x, 3, z), Vector3.new(faceX, 3, faceZ))
	local head = Instance.new("Part"); head.Name = "Head"; head.Parent = model
	model.PrimaryPart = root
	local hum = Instance.new("Humanoid"); hum.Parent = model
	local stats = Rules.statsFor(style)
	hum.MaxHealth = Rules.maxHealth(stats); hum.Health = hum.MaxHealth
	hum.WalkSpeed = Rules.walkSpeed(style, acc); hum.JumpPower = Rules.jumpPower(stats.jmp)
	Shim.addBody(model, hum, root)
	local F = Combat.register(id, model, hum, root, { style = style, accessory = acc }, stats, team or 0, nil, isBot == true, id)
	return F
end
local function dist(A, B)
	local a, b = A.root.Position, B.root.Position
	return math.sqrt((a.X - b.X) ^ 2 + (a.Z - b.Z) ^ 2)
end
local function reset()
	for id in Combat.all() do Combat.leave(id) end
	Bots.clear()
	Shim.bodies = {}
	Combat.setFallY(-1000)
end
local kos = {}
Combat.hooks.ko = function(V, credit, reason) table.insert(kos, { id = V.id, credit = credit, reason = reason }) end
local fxLog = {}
Combat.hooks.fx = function(kind) fxLog[kind] = (fxLog[kind] or 0) + 1 end

-- 1. 약공이 맞는다: 5 스터드 앞(잡기 범위 밖, 리치 안)의 상대 체력이 Rules.damage 만큼 준다
reset()
local A = makeFighter("fighter", "none", 0, 0, 0, -10)
local B = makeFighter("fighter", "none", 0, -5, 0, 10)
local maxB = B.hum.MaxHealth
Combat.intent(A, "light")
check(A.state == "attack" and A.move and A.move.id == "jab", "약공 의도 → jab 시작")
local sawStun = false
run(0.3, function() if B.state == "hitstun" then sawStun = true end end)
local jab = Moves.get("jab")
check(B.hum.Health == maxB - Rules.damage(jab.damage, A.stats.atk, B.stats.def), "jab 피해가 Humanoid.Health 에 들어갔다: " .. B.hum.Health .. " / " .. maxB)
check(sawStun, "맞은 쪽이 경직(hitstun)에 들어갔다")
check(A.damage == Rules.damage(jab.damage, A.stats.atk, B.stats.def), "가한 피해가 누적된다")
check((fxLog.hit or 0) >= 1, "hit 연출이 한 번 나갔다")
check(A.root.Position.Z < -0.5, "내딛기(stepIn)로 공격자가 앞으로 움직였다: z=" .. A.root.Position.Z)

-- 2. 사슬: 후딜 안에 약공을 또 누르면 straight 가 이어 나간다
reset()
A = makeFighter("fighter", "none", 0, 0, 0, -10); B = makeFighter("fighter", "none", 0, -5, 0, 10)
Combat.intent(A, "light")
run(0.2); Combat.intent(A, "light")
local sawStraight = false
run(0.5, function() if A.move and A.move.id == "straight" then sawStraight = true end end)
check(sawStraight, "약공 연타가 사슬 2타(straight)로 이어진다")
check(B.hum.Health < B.hum.MaxHealth - 6, "2타까지 피해가 들어갔다: " .. B.hum.Health)

-- 3. 대시: 바라보는 방향으로 5 스터드 넘게 움직인다
reset()
A = makeFighter("fighter", "none", 0, 0, 0, -10)
Combat.intent(A, "dash")
run(0.3)
check(A.root.Position.Z < -5, "대시로 앞(−Z)으로 이동: z=" .. A.root.Position.Z)
check(A.state == "idle", "대시 뒤 idle 로 돌아온다")

-- 4. 가드: 정면 가드는 피해 0, 가드 게이지는 깎인다
reset()
A = makeFighter("fighter", "none", 0, 0, 0, -10); B = makeFighter("fighter", "none", 0, -5, 0, 10)
Combat.intent(B, "guard", { on = true })
check(B.state == "guard", "가드 의도 → guard 상태")
Combat.intent(A, "light")
run(0.4)
check(B.hum.Health == B.hum.MaxHealth, "가드로 막으면 체력이 안 깎인다")
check(B.guard < Config.GUARD.max, "가드 게이지가 깎인다: " .. B.guard)
check((fxLog.guard or 0) >= 1, "guard 연출이 나갔다")

-- 5. 잡기·던지기: 밀착 약공은 잡기, 잡은 뒤 약공은 던지기(띄움 → 다운 → 기상)
reset()
A = makeFighter("grappler", "none", 0, 0, 0, -10); B = makeFighter("fighter", "none", 0, -2.2, 0, 10)
Combat.intent(A, "light")
check(A.move and A.move.id == "grab", "밀착 약공은 잡기(grab): " .. tostring(A.move and A.move.id))
run(0.2)
check(B.state == "held" and A.state == "grabbing", "잡기 성공: 상대 held, 나 grabbing (" .. B.state .. "/" .. A.state .. ")")
Combat.intent(A, "light")
check(A.move and A.move.id == "throw", "잡은 뒤 약공은 던지기")
local hpBefore = B.hum.Health
local sawLaunched, sawDown, sawGetup = false, false, false
run(3.0, function()
	if B.state == "launched" then sawLaunched = true end
	if B.state == "down" then sawDown = true end
	if B.state == "getup" then sawGetup = true end
end)
check(B.hum.Health == hpBefore - Rules.damage(Styles.get("grappler").throwDamage, A.stats.atk, B.stats.def), "던지기 피해: " .. B.hum.Health)
check(sawLaunched and sawDown and sawGetup and B.state == "idle", "던져진 뒤 launched → down → getup → idle 을 지난다")
check(B.hum.PlatformStand == false, "놓인 뒤 PlatformStand 해제")

-- 6. 강공 띄움: roundhouse 에 맞으면 공중 → 착지 → 다운
reset()
A = makeFighter("fighter", "none", 0, 0, 0, -10); B = makeFighter("heavy", "none", 0, -5, 0, 10)
Combat.intent(A, "heavy")
check(A.move and A.move.id == "roundhouse", "강공 1타는 roundhouse")
local air = false
run(2.5, function() if B.state == "launched" and B.hum.FloorMaterial == Shim.Enum.Material.Air then air = true end end)
check(air, "띄움 피격은 실제로 공중에 뜬다")
check(B.state == "idle" or B.state == "getup", "띄움 뒤 2.5초면 다운을 지나 기상한다: " .. B.state)

-- 7. 봇: 12 스터드 밖에서 다가와 교전 거리 안에서 공격하고, 상대 체력을 깎는다
reset()
local bot = makeFighter("grappler", "none", 0, 12, 0, 0, true)
local dummy = makeFighter("fighter", "none", 0, 0, 0, 10)
Bots.attach(bot)
bot.dashReadyAt = math.huge -- 대시를 끈다: 대시 뒤 태클 거리가 아니라 걸어서 닿는 교전 거리를 잰다
local firstAttackDist, startDist = nil, dist(bot, dummy)
run(6.0, function()
	Bots.update(DT)
	if firstAttackDist == nil and bot.state == "attack" then firstAttackDist = dist(bot, dummy) end
end)
local engage = Rules.engageDistance("grappler", "none")
check(firstAttackDist ~= nil, "봇이 6초 안에 공격을 시작한다")
check(firstAttackDist ~= nil and firstAttackDist <= engage + 0.6, string.format("봇은 교전 거리(%.1f) 안에서 공격한다: %.2f", engage, firstAttackDist or -1))
check(dummy.hum.Health < dummy.hum.MaxHealth, "봇의 타격이 상대 체력을 깎는다: " .. dummy.hum.Health .. " / " .. dummy.hum.MaxHealth)
check(dist(bot, dummy) < startDist, "봇이 상대에게 다가갔다")

-- 8. 링아웃: fallY 아래로 떨어지면 KO, 크레딧 없음
reset()
A = makeFighter("fighter", "none", 0, 0, 0, -10)
Combat.setFallY(-10)
kos = {}
A.root.Position = Vector3.new(0, -20, 0)
Combat.update(DT)
check(A.state == "dead" and #kos == 1 and kos[1].reason == "ringout" and kos[1].credit == nil, "링아웃 KO, 자멸(크레딧 nil)")

-- 9. KO 크레딧: 마지막 타격자가 크레딧을 받는다
reset()
A = makeFighter("fighter", "none", 0, 0, 0, -10); B = makeFighter("fighter", "none", 0, -5, 0, 10)
B.hum.Health = 3
kos = {}
Combat.intent(A, "light")
run(0.3)
check(B.state == "dead" and #kos == 1 and kos[1].credit == A.id and kos[1].reason == "hit", "타격 KO 크레딧 = 공격자")
check(B.hum.Health == 0, "KO 뒤 체력 0")

-- 10. 봇 가장자리: 바닥이 끊긴 쪽으로는 전진하지 않는다(상대가 절벽 너머)
reset()
Shim.arenaHalf = 10
bot = makeFighter("speedster", "none", 0, 8, 0, 0, true)
dummy = makeFighter("fighter", "none", 0, -30, 0, 10) -- 아레나 밖(절벽 너머)
Bots.attach(bot)
run(3.0, function() Bots.update(DT) end)
check(bot.root.Position.Z > -Shim.arenaHalf and bot.hum.FloorMaterial ~= Shim.Enum.Material.Air, "봇이 절벽(z=-10) 앞에서 멈추고 떨어지지 않는다: z=" .. bot.root.Position.Z)
Shim.arenaHalf = 60

print(string.format("SMOKE %d checks, %d failed", checks, fails))
if fails > 0 then error("smoke failed") end
