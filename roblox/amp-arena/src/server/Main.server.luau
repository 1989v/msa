--!nonstrict
-- 라운드 루프: 로비(준비) → 카운트다운 → 매치 → 결과 → 로비. 서버 하나가 방이다(최대 8). 플레이어가 적으면 봇이 채운다.
-- 캐릭터는 서버가 소유한다(CharacterAutoLoads 끔): 로비 발판 또는 아레나 스폰에 직접 세우고, KO 뒤 리스폰도 여기서 한다.
local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local Lighting = game:GetService("Lighting")
local ServerStorage = game:GetService("ServerStorage")
local Shared = game:GetService("ReplicatedStorage"):WaitForChild("AmpArena")
local Config = require(Shared.Config)
local Rules = require(Shared.Rules)
local Styles = require(Shared.Styles)
local Rigs = require(script.Parent.Rigs)
local Combat = require(script.Parent.Combat)
local Items = require(script.Parent.Items)
local Projectiles = require(script.Parent.Projectiles)
local Bots = require(script.Parent.Bots)
local Commands = require(script.Parent.Commands)

local Remotes = Shared:WaitForChild("Remotes")
local Command, Fx, State = Remotes.Command, Remotes.Fx, Remotes.State
local Assets = ServerStorage:WaitForChild("AmpAssets")
local Lobby = workspace:WaitForChild("Lobby")
Players.CharacterAutoLoads = false

local function now() return workspace:GetServerTimeNow() end
local function fx(kind, ...) Fx:FireAllClients(kind, ...) end

local session = { phase = "lobby", phaseAt = now(), phaseEnds = now() + Config.MATCH.lobbySeconds, rotation = 0, mode = nil, map = nil, arena = nil, matchAt = 0, spawnIndex = 0 }
local humans = {}   -- player → { loadout, ready, alive, F, id, label, respawnAt }
local bots = {}     -- id → { loadout, alive, F, id, label, respawnAt, model }
local function phaseTimeLeft() return math.max(0, session.phaseEnds - now()) end
local function humanCount() local n = 0; for _ in humans do n += 1 end; return n end

Combat.hooks.fx = fx
Combat.hooks.projectile = function(F, m, t) Projectiles.fire(F, m, t) end
Combat.hooks.itemHit = function(F, m, t) Items.hitScan(F, m, t) end
Combat.hooks.throwItem = function(F, t) Items.throwHeld(F, t) end
Items.hooks.fx = fx
Items.hooks.fighterOf = function(model) return model and Combat.byModel(model) or nil end
Projectiles.hooks.fx = fx

-- ───────── 스폰 ─────────
local function spawnPoints(container, team)
	local out = {}
	local folder = container:FindFirstChild("Spawns")
	if not folder then return out end
	for _, p in folder:GetChildren() do
		if not p:IsA("BasePart") then continue end
		local tv = p:FindFirstChild("Team")
		if team == nil or team == 0 or not tv or tv.Value == team then table.insert(out, p) end
	end
	table.sort(out, function(a, b) return a.Name < b.Name end)
	return out
end
local function pickSpawn(container, team)
	local list = spawnPoints(container, team)
	if #list == 0 then list = spawnPoints(container, nil) end
	if #list == 0 then return CFrame.new(0, 10, 0) end
	session.spawnIndex += 1
	local p = list[(session.spawnIndex - 1) % #list + 1]
	return p.CFrame * CFrame.new(0, 3.5, 0)
end
local function placeCharacter(model, cf)
	model:PivotTo(cf)
	local root = model:FindFirstChild("HumanoidRootPart")
	if root then root.AssemblyLinearVelocity = Vector3.zero end
end

-- ───────── 조명 프리셋(맵별) ─────────
local function applyLighting(mapId)
	local def = Config.MAPS[mapId]
	Lighting.ClockTime = def.clock
	if mapId == "skydock" then
		Lighting.Ambient = Color3.fromRGB(120, 130, 150); Lighting.OutdoorAmbient = Color3.fromRGB(150, 160, 180); Lighting.ExposureCompensation = 0.1
	else
		Lighting.Ambient = Color3.fromRGB(70, 56, 56); Lighting.OutdoorAmbient = Color3.fromRGB(120, 96, 90); Lighting.ExposureCompensation = 0.25
	end
end

-- ───────── 파이터 등록 ─────────
local function registerFighter(entry, model, player, isBot)
	local team = session.mode and Config.MODES[session.mode].teams and entry.team or 0
	local hum, root, stats = Rigs.prepare(model, entry.loadout, team ~= 0 and team or nil, entry.label, isBot)
	if not hum then return nil end
	local F = Combat.register(entry.id, model, hum, root, entry.loadout, stats, team, player, isBot, entry.label)
	F.ko, F.deaths, F.damage = entry.ko or 0, entry.deaths or 0, entry.damage or 0
	entry.F = F
	entry.alive = true
	if isBot then
		for _, p in model:GetDescendants() do if p:IsA("BasePart") then p:SetNetworkOwner(nil) end end
		Bots.attach(F)
	end
	if session.phase == "countdown" then Combat.setFrozen(F, true) end
	Combat.setInvuln(F, Config.RESPAWN.invulnSeconds)
	Rigs.spawnShield(model, Config.RESPAWN.invulnSeconds)
	return F
end

-- 플레이어 캐릭터가 생기면: 매치 중이고 참가 자격이 있으면 아레나, 아니면 로비.
local function onCharacter(player, model)
	local entry = humans[player]
	if not entry then return end
	local hum = model:WaitForChild("Humanoid", 5)
	local root = model:WaitForChild("HumanoidRootPart", 5)
	if not hum or not root then return end
	local inMatch = (session.phase == "countdown" or session.phase == "match") and entry.joined and entry.alive and session.arena
	if inMatch then
		placeCharacter(model, pickSpawn(session.arena, entry.team))
		registerFighter(entry, model, player, false)
	else
		placeCharacter(model, pickSpawn(Lobby, nil))
		Rigs.prepare(model, entry.loadout, nil, entry.label, false)
		entry.F = nil
		-- 로비 캐릭터가 죽으면(난간 밖 추락 등) 2초 뒤 다시 세운다
		hum.Died:Connect(function()
			task.delay(2, function() if humans[player] and player.Parent and not humans[player].F then player:LoadCharacter() end end)
		end)
	end
end
local function respawnHuman(player)
	local entry = humans[player]
	if not entry then return end
	if entry.F then Combat.leave(entry.id); entry.F = nil end
	player:LoadCharacter()
end

-- ───────── 봇 ─────────
local function spawnBot(entry)
	if entry.model and entry.model.Parent then entry.model:Destroy() end
	local model = Rigs.makeBot(entry.loadout, entry.label)
	model.Parent = workspace
	placeCharacter(model, pickSpawn(session.arena, entry.team))
	entry.model = model
	registerFighter(entry, model, nil, true)
end
local function removeBot(id)
	local entry = bots[id]
	if not entry then return end
	Combat.leave(id); Bots.detach(id)
	if entry.model then entry.model:Destroy() end
	bots[id] = nil
end
local function randomLoadout()
	local style = Styles.ORDER[math.random(#Styles.ORDER)]
	local acc = math.random() < 2 / 3 and Styles.get(style).accessory or "none"
	return { style = style, accessory = acc }
end

-- ───────── 라운드 ─────────
local function allIds()
	local ids = {}
	for _, e in humans do if e.joined then table.insert(ids, e.id) end end
	for id in bots do table.insert(ids, id) end
	table.sort(ids, function(a, b) return tostring(a) < tostring(b) end)
	return ids
end
local function roster()
	local list = {}
	for player, e in humans do
		if e.joined then
			local F = e.F
			table.insert(list, { id = e.id, name = e.label, team = e.team or 0, hp = F and math.floor(F.hum.Health) or 0, maxHp = F and F.hum.MaxHealth or 0,
				ko = F and F.ko or e.ko or 0, deaths = F and F.deaths or e.deaths or 0, damage = F and F.damage or e.damage or 0,
				style = e.loadout.style, accessory = e.loadout.accessory, bot = false, alive = e.alive == true, ready = e.ready == true })
		end
	end
	for id, e in bots do
		local F = e.F
		table.insert(list, { id = id, name = e.label, team = e.team or 0, hp = F and math.floor(F.hum.Health) or 0, maxHp = F and F.hum.MaxHealth or 0,
			ko = F and F.ko or 0, deaths = F and F.deaths or 0, damage = F and F.damage or 0, style = e.loadout.style, accessory = e.loadout.accessory, bot = true, alive = e.alive == true, ready = true })
	end
	return list
end
local function setPhase(phase, seconds)
	session.phase = phase; session.phaseAt = now(); session.phaseEnds = now() + seconds
end

local function startCountdown()
	session.rotation += 1
	local modeId, mapId = Rules.nextRotation(session.rotation)
	session.mode, session.map = modeId, mapId
	local template = Assets.Maps:FindFirstChild(mapId)
	local arena = template:Clone(); arena.Name = "Arena"; arena.Parent = workspace
	session.arena = arena
	applyLighting(mapId)
	Combat.setFallY(Config.MAPS[mapId].fallY)
	Items.setup(arena)
	Projectiles.clear()
	-- 참가자: 지금 있는 사람 전원 + 봇 채움
	for id in bots do removeBot(id) end
	local n = 0
	for _, e in humans do e.joined = true; e.alive = true; e.ko, e.deaths, e.damage = 0, 0, 0; e.ready = false; n += 1 end
	local fill = Rules.botsNeeded(n)
	for i = 1, fill do
		local id = "bot" .. i
		bots[id] = { id = id, label = "봇 " .. i, loadout = randomLoadout(), alive = false }
	end
	local teams = Config.MODES[modeId].teams and Rules.assignTeams(allIds()) or {}
	for _, e in humans do e.team = teams[e.id] or 0 end
	for id, e in bots do e.team = teams[id] or 0 end
	session.spawnIndex = 0
	setPhase("countdown", Config.MATCH.countdownSeconds)
	session.countdownShown = nil
	for player in humans do respawnHuman(player) end
	for _, e in bots do spawnBot(e) end
	fx("banner", string.format("%s · %s", Config.MAPS[mapId].label, Config.MODES[modeId].label))
end
local function startMatch()
	setPhase("match", Config.MODES[session.mode].seconds)
	session.matchAt = now()
	for _, F in Combat.all() do Combat.setFrozen(F, false); Combat.resetMatchStats(F) end
	fx("fight")
end
local function endMatch(reason)
	local modeDef = Config.MODES[session.mode]
	local list = roster()
	local ranked = Rules.rank(list)
	local teams = modeDef.teams and Rules.teamTotals(list) or nil
	local winnerIds = {}
	if modeDef.lives == 1 then
		local w = Rules.survivalWinner(list)
		if w then winnerIds[w.id] = true end
	elseif teams then
		for _, r in list do if r.team == teams[1].team then winnerIds[r.id] = true end end
	elseif ranked[1] then
		winnerIds[ranked[1].id] = true
	end
	local result = { mode = session.mode, map = session.map, reason = reason, ranked = ranked, teams = teams, winners = winnerIds }
	for _, F in Combat.all() do Combat.setFrozen(F, true) end
	setPhase("result", Config.MATCH.resultSeconds)
	fx("result", result)
end
local function toLobby()
	for id in bots do removeBot(id) end
	Items.clear(); Projectiles.clear()
	for _, e in humans do if e.F then Combat.leave(e.id); e.F = nil end; e.joined = false; e.alive = false; e.ready = false end
	if session.arena then session.arena:Destroy(); session.arena = nil end
	Lighting.ClockTime = 15; Lighting.Ambient = Color3.fromRGB(90, 90, 110); Lighting.OutdoorAmbient = Color3.fromRGB(140, 140, 160); Lighting.ExposureCompensation = 0.1
	setPhase("lobby", Config.MATCH.lobbySeconds)
	for player in humans do respawnHuman(player) end
end

-- KO: 점수·리스폰 예약·피드
Combat.hooks.ko = function(V, creditId, reason)
	local entry = V.isBot and bots[V.id] or nil
	if not entry then for _, e in humans do if e.id == V.id then entry = e end end end
	if not entry then return end
	entry.alive = false
	entry.ko, entry.deaths, entry.damage = V.ko, V.deaths, V.damage
	local credit = creditId and Combat.get(creditId)
	if credit and credit ~= V then
		-- 아군 KO 는 팀 점수 없이 개인 KO −1(그리핑 억제). 그 외는 +1.
		if Rules.allyKo(credit.team, V.team) then credit.ko -= 1 else credit.ko += 1 end
	elseif reason == "ringout" then V.ko -= 1 end
	fx("feed", V.label, credit and credit.label or nil, reason)
	if V.item then Items.dropHeld(V) end
	-- 데스매치는 아레나에, 서바이벌은 로비 발판에 다시 선다(관전 자리). 봇은 데스매치에서만.
	if session.phase == "match" and (not V.isBot or Config.MODES[session.mode].lives == 0) then
		entry.respawnAt = now() + Config.RESPAWN.seconds
	end
end

-- ───────── 플레이어 ─────────
local function onPlayer(player)
	humans[player] = { id = player.UserId, label = player.DisplayName, loadout = { style = "fighter", accessory = "none" }, ready = false, alive = false, joined = false, ko = 0, deaths = 0, damage = 0 }
	player.CharacterAdded:Connect(function(c) onCharacter(player, c) end)
	player:LoadCharacter()
end
Players.PlayerAdded:Connect(onPlayer)
for _, p in Players:GetPlayers() do onPlayer(p) end
Players.PlayerRemoving:Connect(function(player)
	Commands.forget(player)
	local e = humans[player]
	if e and e.F then Combat.leave(e.id) end
	humans[player] = nil
end)

-- ───────── 명령 ─────────
local handlers = {}
function handlers.loadout(player, a)
	local e = humans[player]; if not e then return end
	if not Rules.loadoutPhaseOpen(session.phase) then return end -- 매치 중 장비 교체 불가(스타일 몸집·스탯·쿨다운 초기화 경로를 막는다)
	local lo = Rules.sanitizeLoadout(a); if not lo then return end
	e.loadout = lo
	if player.Character then Rigs.prepare(player.Character, lo, nil, e.label, false) end
end
function handlers.ready(player, a)
	local e = humans[player]; if not e or session.phase ~= "lobby" then return end
	e.ready = if a.on == nil then not e.ready else a.on
	local all = true
	for _, h in humans do if not h.ready then all = false end end
	if all and humanCount() >= 1 then session.phaseEnds = math.min(session.phaseEnds, now() + 1) end
end
function handlers.intent(player, a)
	local e = humans[player]; if not e or not e.F or session.phase ~= "match" then return end
	Combat.intent(e.F, a.kind, { dir = a.dir })
end
function handlers.guard(player, a)
	local e = humans[player]; if not e or not e.F or session.phase ~= "match" then return end
	Combat.intent(e.F, "guard", { on = a.on })
end
Command.OnServerEvent:Connect(function(player, name, args)
	local ok, result = Commands.validate(player, name, args)
	if not ok then return end
	handlers[name](player, result)
end)

-- ───────── 틱 ─────────
local stateTimer = 0
RunService.Heartbeat:Connect(function(dt)
	dt = math.min(dt, 0.1)
	local t = now()
	local phase = session.phase
	if phase == "lobby" then
		if phaseTimeLeft() <= 0 then
			if humanCount() >= 1 then startCountdown() else session.phaseEnds = t + Config.MATCH.lobbySeconds end
		end
	elseif phase == "countdown" then
		local left = math.ceil(phaseTimeLeft())
		if left ~= session.countdownShown and left > 0 then session.countdownShown = left; fx("countdown", left) end
		if phaseTimeLeft() <= 0 then startMatch() end
	elseif phase == "match" then
		Combat.update(dt); Items.update(dt); Projectiles.update(dt); Bots.update(dt)
		local respawning = Config.MODES[session.mode].lives == 0
		for player, e in humans do
			if e.respawnAt and t >= e.respawnAt then e.respawnAt = nil; e.alive = respawning; respawnHuman(player) end
		end
		for _, e in bots do
			if e.respawnAt and t >= e.respawnAt then e.respawnAt = nil; Combat.leave(e.id); spawnBot(e) end
		end
		local over, why = Rules.matchOver(session.mode, t - session.matchAt, roster())
		if over then endMatch(why) end
	elseif phase == "result" then
		if phaseTimeLeft() <= 0 then toLobby() end
	end
	stateTimer += dt
	if stateTimer >= 0.25 then
		stateTimer = 0
		local list = roster()
		local readyCount = 0
		for _, e in humans do if e.ready then readyCount += 1 end end
		for player, e in humans do
			local F = e.F
			local me = {
				loadout = e.loadout, ready = e.ready, alive = e.alive, joined = e.joined,
				guard = F and math.floor(F.guard) or Config.GUARD.max, specialIn = F and math.max(0, F.specialReadyAt - t) or 0,
				dashIn = F and math.max(0, F.dashReadyAt - t) or 0, ammo = F and F.ammo or 0, reloadIn = F and F.reloadAt and math.max(0, F.reloadAt - t) or 0,
				holding = F and F.item ~= nil or false, team = e.team or 0,
			}
			State:FireClient(player, { phase = session.phase, timeLeft = phaseTimeLeft(), mode = session.mode, map = session.map, roster = list, me = me, readyCount = readyCount, humans = humanCount() })
		end
	end
end)
