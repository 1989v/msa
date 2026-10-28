--!nonstrict
-- 세션: 로비 → 원정(playing) → 패배. 금화·고용·강화·합성·탑·영웅 기술·본진·치료사·저장을 서버가 결정한다.
local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local PhysicsService = game:GetService("PhysicsService")
local Shared = game:GetService("ReplicatedStorage"):WaitForChild("ArcherCommand")
local Config = require(Shared.Config)
local Rules = require(Shared.Rules)
local Rigs = require(script.Parent.Rigs)
local Npc = require(script.Parent.Npc)
local Campaign = require(script.Parent.Campaign)
local Towers = require(script.Parent.Towers)
local Save = require(script.Parent.Save)
local Commands = require(script.Parent.Commands)

local Remotes = Shared:WaitForChild("Remotes")
local Command, Fx, State = Remotes.Command, Remotes.Fx, Remotes.State
local World = workspace:WaitForChild("World")

-- NPC 끼리·NPC 와 플레이어는 서로 밀치지 않는다(무리가 끼지 않게). 지형과는 충돌한다.
pcall(function()
	PhysicsService:RegisterCollisionGroup("Npc"); PhysicsService:RegisterCollisionGroup("Player")
	PhysicsService:CollisionGroupSetCollidable("Npc", "Npc", false)
	PhysicsService:CollisionGroupSetCollidable("Npc", "Player", false)
end)

local session = {
	phase = "lobby", host = nil, eco = Rules.newEconomy(), baseHp = Config.BASE.maxHealth, baseMax = Config.BASE.maxHealth,
	skillReadyAt = 0, saveTimer = 0, saveInfo = "none", tutorial = {}, startedWith = 0,
}
local toasts = {}
local function toast(text) table.insert(toasts, text); Fx:FireAllClients("toast", text) end

local function addGold(amount, reason, pos)
	session.eco.gold += amount
	if pos then Fx:FireAllClients("gold", pos, amount) end
end

local function damageBase(amount)
	if session.phase ~= "playing" then return end
	session.baseHp = math.max(0, session.baseHp - amount)
	Fx:FireAllClients("baseHit", session.baseHp / session.baseMax)
	if session.baseHp <= 0 then
		session.phase = "defeat"
		toast("본진이 무너졌다")
		Npc.clear(); Towers.clear(); Campaign.stop()
	end
end

local outpostTower = World:FindFirstChild("Outpost") and World.Outpost:FindFirstChild("OutpostTower")
local function structureDamage(model, amount)
	if model == nil then damageBase(amount); return end
	if Towers.damage(model, amount) then return end
	if model == outpostTower then
		local hp = (model:GetAttribute("Health") or 0) - amount
		model:SetAttribute("Health", math.max(0, hp))
		if hp <= 0 then
			Npc.unregisterStructure(model)
			Campaign.structureDestroyed(model)
			Fx:FireAllClients("ruin", model)
			for _, p in model:GetDescendants() do if p:IsA("BasePart") then p.Color = Color3.fromRGB(70, 66, 62) end end
		end
	end
end

Npc.hooks.gold = addGold
Npc.hooks.enemyKilled = function(ent) addGold(ent.def.reward, "kill", ent.root.Position) end
Npc.hooks.allyDied = function(ent) session.eco.counts[ent.kind] = math.max(0, (session.eco.counts[ent.kind] or 1) - 1) end
Npc.hooks.structureDamage = structureDamage
Npc.hooks.upgrades = function() return session.eco.upgrades end
Npc.hooks.towers = Towers.list
Npc.hooks.claimBuild = Towers.claimBuild
Npc.hooks.buildProgress = Towers.buildProgress
Npc.hooks.claimRepair = Towers.claimRepair
Npc.hooks.repair = Towers.repair
Npc.hooks.phasePlaying = function() return session.phase == "playing" end
Towers.hooks.spend = function(amount)
	if session.eco.gold < amount then return false end
	session.eco.gold -= amount
	return true
end
Towers.hooks.toast = toast

-- ───────── 플레이어 ─────────
local function setupCharacter(player, character)
	Rigs.setupPlayer(character)
	local function group(p) if p:IsA("BasePart") then p.CollisionGroup = "Player" end end
	for _, p in character:GetDescendants() do group(p) end
	character.DescendantAdded:Connect(group)
end

local function playerCount() return #Players:GetPlayers() end

local function onPlayer(player)
	if not session.host then
		session.host = player
		session.saveInfo = Save.load(player.UserId)
	end
	Npc.registerPlayer(player)
	player.CharacterAdded:Connect(function(c) setupCharacter(player, c) end)
	if player.Character then setupCharacter(player, player.Character) end
	if session.phase == "playing" and playerCount() == 2 and session.startedWith < 2 then
		session.startedWith = 2
		session.baseMax += Config.BASE.coopBonus; session.baseHp += Config.BASE.coopBonus
		toast(player.DisplayName .. " 합류 · 본진 체력 +" .. Config.BASE.coopBonus)
	end
end
Players.PlayerAdded:Connect(onPlayer)
for _, p in Players:GetPlayers() do onPlayer(p) end

local function snapshot()
	local counts = Npc.counts()
	return { economy = session.eco, wave = Campaign.snapshot().wave, towers = Towers.count(), savedTick = os.time(), alive = counts }
end
local function persist()
	if session.phase ~= "playing" or not session.host then return end
	-- 저장되는 병력 수는 살아 있는 것 기준
	local eco = session.eco
	for k in pairs(Config.UNITS) do eco.counts[k] = 0 end
	for _, a in Npc.allAllies() do if not a.dead then eco.counts[a.kind] = (eco.counts[a.kind] or 0) + 1 end end
	Save.write(session.host.UserId, snapshot())
end

Players.PlayerRemoving:Connect(function(player)
	Commands.forget(player)
	if player == session.host then persist() end
	Npc.unregisterPlayer(player)
	if player == session.host then
		local rest = Players:GetPlayers()
		session.host = rest[1] ~= player and rest[1] or rest[2]
	end
end)
game:BindToClose(function() persist() end)

-- ───────── 시작·재시작 ─────────
local function recruitPoint() return Config.SITES.barracks + Vector3.new(0, 0, Config.BASE.recruitWalkOut) end

local function startGame(mode)
	Rigs.ready()
	Npc.clear(); Towers.clear()
	local eco = Rules.newEconomy()
	if mode == "continue" then
		local info, data = Save.load(session.host.UserId)
		if info == "ok" then eco = data.economy else toast("저장을 읽지 못해 새 원정으로 시작한다") end
	end
	session.eco = eco
	session.baseMax = Config.BASE.maxHealth + (playerCount() >= 2 and Config.BASE.coopBonus or 0)
	session.baseHp = session.baseMax
	session.startedWith = playerCount()
	session.skillReadyAt = 0; session.saveTimer = 0; session.tutorial = {}
	if outpostTower then
		outpostTower:SetAttribute("Health", Config.OUTPOST.towerHealth)
		for _, p in outpostTower:GetDescendants() do if p:IsA("BasePart") and p.Name ~= "Totem" then p.Color = Color3.fromRGB(118, 110, 102) end end
	end
	local gate = World:FindFirstChild("ExitGate")
	if gate then gate:SetAttribute("Open", false) end
	Campaign.start({
		outpostTower = outpostTower,
		notify = function(kind, a, b, c)
			if kind == "gold" then addGold(a, b, c)
			elseif kind == "toast" then toast(a)
			elseif kind == "wave" then Fx:FireAllClients("wave", a, b)
			elseif kind == "gate" and gate then gate:SetAttribute("Open", a) end
		end,
	})
	-- 저장된 병력을 본진에서 다시 세운다(호스트 소속)
	for kind, n in eco.counts do
		for _ = 1, n do
			local p = recruitPoint()
			Npc.spawnAlly(kind, session.host, p + Vector3.new(math.random(-4, 4), 0, math.random(-4, 4)))
		end
	end
	session.phase = "playing"
	toast(if mode == "continue" then "원정을 이어간다" else "활잡이 하나, 금화 0. 동쪽 사냥터에서 시작한다")
end

-- ───────── 명령 ─────────
local handlers = {}
function handlers.start(player, a)
	if session.phase ~= "lobby" and session.phase ~= "defeat" then return end
	if player ~= session.host then return end
	startGame(a.mode)
end
function handlers.restart(player)
	if player ~= session.host or session.phase ~= "defeat" then return end
	session.phase = "lobby"
	session.saveInfo = Save.load(player.UserId)
end
function handlers.hire(player, a)
	if session.phase ~= "playing" then return end
	local ok, why = Rules.hire(session.eco, a.kind)
	if not ok then
		toast(if why == "GOLD" then "금화가 모자란다" elseif why == "LIMIT" then "더 둘 수 없다" else "고용 불가")
		return
	end
	local p = recruitPoint()
	Npc.spawnAlly(a.kind, player, p + Vector3.new(math.random(-3, 3), 0, math.random(-2, 2)))
	Fx:FireAllClients("recruit", p, Config.UNITS[a.kind].label)
end
function handlers.upgrade(player, a)
	if session.phase ~= "playing" then return end
	local ok, why = Rules.upgrade(session.eco, a.kind)
	if not ok then toast(if why == "GOLD" then "금화가 모자란다" elseif why == "MAX" then "최대 강화" else "강화 불가"); return end
	Fx:FireAllClients("upgrade", a.kind, session.eco.upgrades[a.kind])
end
function handlers.combine(player)
	if session.phase ~= "playing" then return end
	local archers = {}
	for _, a in Npc.alliesOf(player, { archer = true }) do if not a.garrison then table.insert(archers, a) end end
	if #archers < Config.COMBINE.count then toast("합성에는 뒤따르는 활잡이 셋이 필요하다"); return end
	local ok = Rules.combine(session.eco)
	if not ok then toast("합성 불가"); return end
	local sum = Vector3.zero
	for i = 1, Config.COMBINE.count do sum += archers[i].root.Position; Npc.removeAlly(archers[i]) end
	local pos = sum / Config.COMBINE.count
	Npc.spawnAlly("hero", player, pos)
	Fx:FireAllClients("combine", pos)
	toast("영웅 활잡이 탄생 · 일제 사격을 쓸 수 있다")
end
function handlers.tower(player, a)
	if session.phase ~= "playing" then return end
	local ok, why = Towers.place(player, a.point)
	if not ok then
		toast(({ GOLD = "금화가 모자란다", LIMIT = "탑은 더 세울 수 없다", BOWL = "분지 밖이다", FAR = "너무 멀다 · 가까이 가서 짓는다", SITE = "건물 위에는 못 짓는다", SPACING = "다른 탑과 너무 가깝다" })[why] or "지을 수 없다")
		return
	end
	if Npc.counts().carpenters == 0 then toast("탑 자리를 잡았다 · 목수가 있어야 짓는다") else toast("목수가 탑을 지으러 간다") end
end
function handlers.skill(player, a)
	if session.phase ~= "playing" then return end
	local heroes = Npc.alliesOf(player, { hero = true })
	if #heroes == 0 then toast("영웅 활잡이가 없다"); return end
	local t = os.clock()
	if t < session.skillReadyAt then return end
	local hero = heroes[1]
	if Rules.flatDistance(hero.root.Position, a.point) > Config.HERO_SKILL.maxDistance then toast("너무 멀다"); return end
	session.skillReadyAt = t + Config.HERO_SKILL.cooldown
	Npc.volley(a.point, hero.root.Position)
	Fx:FireAllClients("volley", a.point)
end

Command.OnServerEvent:Connect(function(player, name, args)
	local ok, result = Commands.validate(player, name, args)
	if not ok then return end
	handlers[name](player, result)
end)

-- ───────── 틱 ─────────
local tutorialSteps = {
	{ key = "upgrade", text = "금화가 모이면 공업·방업을 올린다", when = function(e) return e.gold >= 80 and e.upgrades.attack == 0 end },
	{ key = "carpenter", text = "목수(500)를 고용하면 채집으로 금화가 들어온다", when = function(e) return e.gold >= 500 and e.counts.carpenter == 0 end },
	{ key = "archer", text = "활잡이(700)를 고용해 원정대를 키운다", when = function(e) return e.gold >= 700 and e.counts.archer == 0 end },
	{ key = "tower", text = "방어탑(220)을 세우고 가까이 가서 활잡이를 주둔시킨다", when = function(e) return e.gold >= 220 and e.counts.archer >= 1 and Towers.count() == 0 end },
	{ key = "combine", text = "활잡이 셋을 영웅으로 합친다", when = function(e) return e.counts.archer >= 3 end },
	{ key = "skill", text = "일제 사격으로 북쪽 언덕의 거점을 친다", when = function(e) return e.counts.hero >= 1 end },
}

local stateTimer, healTick = 0, 0
RunService.Heartbeat:Connect(function(dt)
	dt = math.min(dt, 0.1)
	if session.phase == "playing" then
		Npc.update(dt)
		Campaign.update(dt)
		-- 치료사 고리
		healTick += dt
		if healTick >= 0.25 then
			local h = Config.BASE.healerRadius
			for _, player in Players:GetPlayers() do
				local c = player.Character; local hum = c and c:FindFirstChildOfClass("Humanoid"); local root = c and c:FindFirstChild("HumanoidRootPart")
				if hum and root and hum.Health > 0 and Rules.flatDistance(root.Position, Config.SITES.healer) <= h then hum.Health = math.min(hum.MaxHealth, hum.Health + Config.BASE.healPerSecond * healTick) end
			end
			for _, a in Npc.allAllies() do
				if not a.dead and Rules.flatDistance(a.root.Position, Config.SITES.healer) <= h then a.hum.Health = math.min(a.hum.MaxHealth, a.hum.Health + Config.BASE.healPerSecond * healTick) end
			end
			healTick = 0
		end
		for _, step in tutorialSteps do
			if not session.tutorial[step.key] and step.when(session.eco) then session.tutorial[step.key] = true; toast(step.text) end
		end
		session.saveTimer += dt
		if session.saveTimer >= Config.SAVE.intervalSeconds then session.saveTimer = 0; persist() end
	end
	stateTimer += dt
	if stateTimer >= 0.25 then
		stateTimer = 0
		local c = Npc.counts()
		State:FireAllClients({
			phase = session.phase, hostId = session.host and session.host.UserId or 0, saveInfo = session.saveInfo, memoryOnly = Save.isMemoryOnly(),
			gold = math.floor(session.eco.gold), upgrades = session.eco.upgrades, counts = session.eco.counts, alive = c,
			base = { hp = math.floor(session.baseHp), max = session.baseMax }, towers = Towers.count(),
			campaign = Campaign.snapshot(), skillIn = math.max(0, session.skillReadyAt - os.clock()),
			prices = { archer = Rules.price("archer"), longbow = Rules.price("longbow"), carpenter = Rules.price("carpenter"), tower = Config.TOWER.cost, attack = Rules.upgradeCost("attack", session.eco.upgrades.attack), armor = Rules.upgradeCost("armor", session.eco.upgrades.armor) },
		})
	end
end)
