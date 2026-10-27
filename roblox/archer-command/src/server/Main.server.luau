--!nonstrict
-- 서버: 세션·협동 수락·틱·리더 검사·패킷·저장. 규칙은 전부 shared/Sim 에 있다.
local Players = game:GetService("Players")
local Run = game:GetService("RunService")
local Replicated = game:GetService("ReplicatedStorage")
local DataStores = game:GetService("DataStoreService")
local Http = game:GetService("HttpService")

local Shared = Replicated:WaitForChild("ArcherCommand")
local Sim = require(Shared.Sim)
local Grid = require(Shared.Grid)
local Balance = require(Shared.Balance)
local Packet = require(Shared.Packet)
local Theme = require(Shared.Theme)
local Save = require(script.Parent.Save)
local Ingress = require(script.Parent.Ingress)
local Commands = require(script.Parent.Commands)

local STUDIO = Run:IsStudio()
local commandRemote = Shared:WaitForChild("Command")
local stateRemote = Shared:WaitForChild("State")
local actorsRemote = Shared:WaitForChild("Actors")
local lobbyRemote = Shared:WaitForChild("Lobby")
local eventRemote = Shared:WaitForChild("Event")

Players.CharacterAutoLoads = false

-- ── 저장소 (Studio 는 메모리) ───────────────────────────────────────────────
local memory = {}
local store = if STUDIO then nil else DataStores:GetDataStore("ArcherCommand_v1")
local function update(key, transform)
	if STUDIO then
		local updated = transform(memory[key])
		if updated ~= nil then memory[key] = updated end
		return memory[key]
	end
	return store:UpdateAsync(key, transform)
end
local save = Save.new(update, function(snapshot) return Http:JSONEncode(snapshot) end, function(text) return Http:JSONDecode(text) end, os.time)

-- ── 세션 ───────────────────────────────────────────────────────────────────
local sim = nil            -- Sim 상태 (선택이 끝나기 전에는 nil)
local campaignId = nil
local hostUserId = nil
local sessions = {}        -- [player] = { ownerId, spectator, pending, lastAccepted, corrections, rejected, queue }
local loadResult = nil     -- 호스트 로드 결과
local pendingJoin = nil    -- 수락 대기 중인 손님
local lastSave = 0
local overflowTicks = 0

local function sessionOf(player) return sessions[player] end
local function ownerSession(ownerId)
	for player, s in sessions do if s.ownerId == ownerId then return player, s end end
	return nil
end

local function toast(player, text, kind) eventRemote:FireClient(player, { type = "toast", text = text, kind = kind or "info" }) end

-- ── 캐릭터 ─────────────────────────────────────────────────────────────────
local function setupCharacter(player, character)
	local humanoid = character:WaitForChild("Humanoid")
	local health = character:FindFirstChild("Health")
	if health then health:Destroy() end
	humanoid.BreakJointsOnDeath = false
	humanoid:SetStateEnabled(Enum.HumanoidStateType.Jumping, false)
	humanoid:SetStateEnabled(Enum.HumanoidStateType.Dead, false)
	humanoid.JumpPower = 0
	humanoid.UseJumpPower = true
	humanoid.WalkSpeed = Balance.UNITS.archer.speed
	humanoid.MaxHealth = 100
	humanoid.Health = 100
	humanoid.NameDisplayDistance = 0
	humanoid.HealthDisplayType = Enum.HumanoidHealthDisplayType.AlwaysOff
end

local function worldY(p) return Grid.heightAt(Sim.terrain, p) + 3 end
local function pivotTo(character, p)
	local root = character and character:FindFirstChild("HumanoidRootPart")
	if not root then return end
	character:PivotTo(CFrame.new(p.x, worldY(p), p.z) * (root.CFrame - root.CFrame.Position))
	root.AssemblyLinearVelocity = Vector3.zero
end

local function spawnCharacter(player, at)
	player:LoadCharacter()
	local character = player.Character or player.CharacterAdded:Wait()
	setupCharacter(player, character)
	task.defer(function() pivotTo(character, at or Grid.SITES.base) end)
	return character
end

-- ── 캠페인 시작 ─────────────────────────────────────────────────────────────
local function startCampaign(snapshot, newCampaignId)
	campaignId = newCampaignId
	if snapshot then
		sim = Sim.restore(snapshot)
	else
		sim = Sim.create(os.time() % 1000003, "solo")
	end
	if not sim then return false end
	lastSave = os.clock()
	return true
end

local function bindOwner(player, ownerId)
	local s = sessionOf(player)
	s.ownerId = ownerId; s.spectator = false
	local owner = Sim.ownerOf(sim, ownerId)
	if owner then owner.userId = player.UserId; owner.name = player.DisplayName end
	local leader = Sim.leaderOf(sim, ownerId)
	spawnCharacter(player, leader and { x = leader.x, z = leader.z } or Grid.SITES.base)
	lobbyRemote:FireClient(player, { type = "playing", ownerId = ownerId, studio = STUDIO })
end

local function hostChoose(player, payload)
	local s = sessionOf(player)
	if not s or player.UserId ~= hostUserId or sim then return end
	if type(payload) ~= "table" then return end
	if payload.action == "continue" and loadResult and loadResult.status == "ok" then
		if not startCampaign(loadResult.snapshot, loadResult.campaignId) then toast(player, "기록을 복원하지 못했습니다.", "error"); return end
		save:resume(hostUserId, campaignId, loadResult.savedTick)
		-- 호스트는 저장된 소유자 0. 상대 슬롯은 그 userId 가 와야 움직인다.
		bindOwner(player, 0)
		return
	end
	if payload.action == "new" then
		local newId = Http:GenerateGUID(false)
		local ok, why = save:beginNew(hostUserId, newId, payload.overwrite == true)
		if not ok then toast(player, why, "error"); lobbyRemote:FireClient(player, { type = "confirmOverwrite" }); return end
		if not startCampaign(nil, newId) then return end
		Sim.addOwner(sim, 0, player.DisplayName)
		bindOwner(player, 0)
	end
end

local function offerJoin(guest)
	local hostPlayer = ownerSession(0)
	if not hostPlayer then return end
	pendingJoin = guest
	lobbyRemote:FireClient(hostPlayer, { type = "joinRequest", name = guest.DisplayName })
	lobbyRemote:FireClient(guest, { type = "waiting", text = "호스트의 수락을 기다리는 중입니다." })
end

local function hostAccept(player, payload)
	if player.UserId ~= hostUserId or not sim or not pendingJoin then return end
	local guest = pendingJoin
	pendingJoin = nil
	if type(payload) ~= "table" or payload.accept ~= true or not guest.Parent then
		if guest.Parent then lobbyRemote:FireClient(guest, { type = "spectating", text = "호스트가 거절했습니다. 관전합니다." }) end
		return
	end
	local owner = Sim.addOwner(sim, 1, guest.DisplayName)
	if not owner then lobbyRemote:FireClient(guest, { type = "spectating", text = "빈 자리가 없습니다." }); return end
	bindOwner(guest, 1)
	toast(player, guest.DisplayName .. " 님이 합류했습니다 · 협동 원정 (본진 +2000)", "info")
	toast(guest, "이 원정은 호스트(" .. player.DisplayName .. ") 계정에 저장됩니다. 내 계정에는 남지 않습니다.", "warn")
end

local function onJoin(player)
	sessions[player] = { ownerId = nil, spectator = true, corrections = 0, rejected = {}, lastAccepted = nil }
	if sim then
		-- 같은 userId 의 슬롯이 있으면 돌려준다
		for _, o in sim.owners do
			if o.userId == player.UserId and not ownerSession(o.id) then bindOwner(player, o.id); return end
		end
		if #sim.owners < 2 and not pendingJoin then offerJoin(player)
		else lobbyRemote:FireClient(player, { type = "spectating", text = "자리가 없어 관전합니다." }) end
		spawnCharacter(player, Grid.SITES.base)
		return
	end
	if hostUserId == nil then
		hostUserId = player.UserId
		loadResult = save:load(player.UserId)
		lobbyRemote:FireClient(player, { type = "choose", status = loadResult.status, message = loadResult.message, savedAt = loadResult.savedAt, studio = STUDIO })
		spawnCharacter(player, Grid.SITES.base)
	else
		lobbyRemote:FireClient(player, { type = "waiting", text = "호스트가 원정을 고르는 중입니다." })
		spawnCharacter(player, Grid.SITES.base)
	end
end

local function saveNow(reason)
	if not sim or not hostUserId or not save:canSave(hostUserId) then return end
	local snapshot = Sim.snapshot(sim)
	local ok, why = save:save(hostUserId, snapshot, campaignId)
	local hostPlayer = ownerSession(0)
	if hostPlayer then eventRemote:FireClient(hostPlayer, { type = "saveStatus", ok = ok, text = if ok then (if STUDIO then "TEST 저장(메모리)" else "저장됨") else why, reason = reason }) end
end

local function onLeave(player)
	local s = sessions[player]
	sessions[player] = nil
	if pendingJoin == player then pendingJoin = nil end
	if s and s.ownerId == 0 then saveNow("leave") end
	if sim and s and s.ownerId ~= nil then
		-- 소유자 슬롯은 Sim 에 남는다(한 명이 나가도 coop 유지). 캐릭터만 사라진다.
		local owner = Sim.ownerOf(sim, s.ownerId)
		if owner then owner.leaderPos = nil; owner.moving = false end
	end
	if hostUserId == player.UserId and not sim then hostUserId = nil; loadResult = nil end
end

-- ── 명령 ───────────────────────────────────────────────────────────────────
commandRemote.OnServerEvent:Connect(function(player, payload)
	local s = sessionOf(player)
	if not s or s.spectator or s.ownerId == nil or not sim then return end
	if not Ingress.allow(s, os.clock()) then return end
	local command = Commands.normalize(payload)
	if not command then return end
	command.ownerId = s.ownerId
	local result = Sim.act(sim, command)
	if not result.ok then s.rejected[result.code] = (s.rejected[result.code] or 0) + 1 end
	eventRemote:FireClient(player, { type = "result", ok = result.ok, code = result.code, message = result.message, command = command.type, unitId = result.unitId, towerId = result.towerId })
end)

lobbyRemote.OnServerEvent:Connect(function(player, payload)
	if type(payload) ~= "table" then return end
	if payload.action == "new" or payload.action == "continue" then hostChoose(player, payload)
	elseif payload.action == "acceptCoop" then hostAccept(player, payload) end
end)

-- ── 지형 칠하기: 빌더 파트(충돌·검증의 진실)와 같은 부피를 Terrain 으로 덧칠해 풀·바위 질감을 낸다 ───
local function paintTerrain()
	local terrainService = workspace.Terrain
	local function fill(x0, z0, x1, z1, y0, y1, material)
		terrainService:FillBlock(CFrame.new((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), Vector3.new(x1 - x0, y1 - y0, z1 - z0), material)
	end
	local ring, interior, plateau, inner, rampHi, rampLo = table.unpack(Grid.RECTS)
	local W, H, EL = Grid.WIDTH, Grid.HEIGHT, Grid.ELEVATION_STUDS
	-- 저지 풀밭 (윗면 Y=0 바로 아래) · 분지 바깥 어두운 흙
	fill(interior[1], interior[2], interior[1] + interior[3], interior[2] + interior[4], -6, -0.2, Enum.Material.Grass)
	fill(-300, -300, W + 300, H + 300, -8, -2.6, Enum.Material.Mud)
	-- 테두리·고지 절벽은 바위, 고지 윗면은 풀
	for _, r in { { 0, 0, W, interior[2] }, { 0, interior[2] + interior[4], W, H }, { 0, interior[2], interior[1], interior[2] + interior[4] }, { interior[1] + interior[3], interior[2], W, interior[2] + interior[4] } } do
		fill(r[1], r[2], r[3], r[4], -2, 22, Enum.Material.Rock)
	end
	local px, pz, pw, ph = plateau[1], plateau[2], plateau[3], plateau[4]
	local ix, iz, iw, ih = inner[1], inner[2], inner[3], inner[4]
	local rx, rw = rampHi[1], rampHi[3]
	fill(px, pz, px + pw, iz, -1, 11, Enum.Material.Rock)
	fill(px, iz, ix, iz + ih, -1, 11, Enum.Material.Rock)
	fill(ix + iw, iz, px + pw, iz + ih, -1, 11, Enum.Material.Rock)
	fill(px, iz + ih, rx, pz + ph, -1, 11, Enum.Material.Rock)
	fill(rx + rw, iz + ih, px + pw, pz + ph, -1, 11, Enum.Material.Rock)
	fill(ix, iz, ix + iw, iz + ih, EL - 6, EL - 0.2, Enum.Material.Grass)
end
pcall(paintTerrain)

-- ── 탑 모델 (서버 Workspace 의 유일한 동적 구조물) ───────────────────────────
local towerFolder = Instance.new("Folder")
towerFolder.Name = "Towers"
towerFolder.Parent = workspace
local towerModels = {}
local function color(token) local c = Theme[token] return Color3.fromRGB(c[1], c[2], c[3]) end
local function syncTowers()
	local seen = {}
	for _, t in sim.towers do
		seen[t.id] = true
		local model = towerModels[t.id]
		if not model then
			model = Instance.new("Model"); model.Name = "Tower" .. t.id
			local base = Instance.new("Part"); base.Name = "Body"; base.Anchored = true; base.Material = Enum.Material.Wood; base.Color = color("wood")
			base.Size = Vector3.new(Balance.TOWER.footprint - 1, 1, Balance.TOWER.footprint - 1)
			base.Position = Vector3.new(t.x, worldY({ x = t.x, z = t.z }) - 2.5, t.z)
			base.Parent = model
			model.Parent = towerFolder
			towerModels[t.id] = model
		end
		local body = model:FindFirstChild("Body")
		local height = if t.state == "completed" then 12 else 1 + 11 * t.progress
		body.Size = Vector3.new(Balance.TOWER.footprint - 1, height, Balance.TOWER.footprint - 1)
		body.Position = Vector3.new(t.x, worldY({ x = t.x, z = t.z }) - 3 + height / 2, t.z)
		body.CanCollide = t.started
		model:SetAttribute("state", t.state)
		model:SetAttribute("hp", math.floor(t.hp)); model:SetAttribute("maxHp", t.maxHp)
		model:SetAttribute("occupants", #t.occupants)
		model:SetAttribute("ownerId", t.ownerId)
	end
	for id, model in towerModels do if not seen[id] then model:Destroy(); towerModels[id] = nil end end
end

-- ── 틱 ─────────────────────────────────────────────────────────────────────
local accumulator = 0
local lastState, lastActors = 0, 0
Run.Heartbeat:Connect(function(dt)
	if not sim or sim.phase ~= "playing" then return end
	accumulator += math.min(dt, 0.25)
	local ticks = 0
	while accumulator + 1e-10 >= Balance.FIXED_DT and ticks < 3 do
		accumulator -= Balance.FIXED_DT
		for player, s in sessions do
			if s.ownerId ~= nil then
				local character = player.Character
				local root = character and character:FindFirstChild("HumanoidRootPart")
				local humanoid = character and character:FindFirstChild("Humanoid")
				if root and humanoid then Sim.setLeader(sim, s.ownerId, root.Position.X, root.Position.Z, humanoid.MoveDirection.Magnitude > 0) end
			end
		end
		Sim.tick(sim)
		ticks += 1
		-- 역방향 쓰기: 되돌림 · 구르기 · 리더 교체
		for _, e in sim.events do
			if e.type == "leaderChanged" then
				local player = ownerSession(e.ownerId)
				if player then
					local leader = if e.unitId then Sim.unitById(sim, e.unitId) else nil
					if player.Character then pivotTo(player.Character, leader and { x = leader.x, z = leader.z } or Grid.SITES.base) end
					eventRemote:FireClient(player, { type = "toast", text = if e.reason == "none" then "활잡이가 모두 쓰러졌습니다. 고용소에서 새 활잡이를 고용하세요." elseif e.reason == "death" then "선두 활잡이가 쓰러져 다른 병력이 이어받습니다." else "선두가 바뀌었습니다.", kind = "warn" })
				end
			elseif e.type == "wave" then
				for player, s in sessions do if s.ownerId ~= nil then eventRemote:FireClient(player, { type = "toast", text = ("웨이브 %d · %d마리"):format(e.number, e.count), kind = "warn" }) end end
			elseif e.type == "campCleared" then
				for player, s in sessions do if s.ownerId ~= nil then eventRemote:FireClient(player, { type = "toast", text = e.label .. " 거점을 부쉈습니다 · 역습이 옵니다", kind = "info" }) end end
			elseif e.type == "lose" then
				for player in sessions do eventRemote:FireClient(player, { type = "lose", reason = e.reason }) end
				saveNow("lose")
			end
		end
	end
	if accumulator >= Balance.FIXED_DT then overflowTicks += 1; accumulator = 0 end
	for player, s in sessions do
		if s.ownerId ~= nil then
			local owner = Sim.ownerOf(sim, s.ownerId)
			local character = player.Character
			local humanoid = character and character:FindFirstChild("Humanoid")
			if owner and character and humanoid then
				local leader = Sim.leaderOf(sim, s.ownerId)
				if owner.correction then pivotTo(character, owner.correction); s.corrections += 1 end
				if leader and leader.roll then pivotTo(character, leader) end
				humanoid.WalkSpeed = Sim.squadSpeed(sim, s.ownerId)
				if leader then
					humanoid.MaxHealth = leader.maxHp; humanoid.Health = math.max(1, leader.hp)
				else
					humanoid.MaxHealth = 100; humanoid.Health = 100
				end
			end
		end
	end
	syncTowers()
	local now = os.clock()
	if now - lastActors >= 0.1 then
		lastActors = now
		for player, s in sessions do
			local around = if s.ownerId ~= nil then Sim.leaderOf(sim, s.ownerId) else nil
			actorsRemote:FireClient(player, Packet.encode(sim, Packet.collect(sim, around or Grid.SITES.base)))
		end
	end
	if now - lastState >= 0.2 then
		lastState = now
		for player, s in sessions do
			local view = Sim.view(sim, s.ownerId or -1)
			view.overflowTicks = overflowTicks; view.corrections = s.corrections; view.spectator = s.ownerId == nil
			stateRemote:FireClient(player, view)
		end
	end
	if now - lastSave >= 60 then lastSave = now; saveNow("timer") end
end)

Players.PlayerAdded:Connect(onJoin)
Players.PlayerRemoving:Connect(onLeave)
for _, p in Players:GetPlayers() do task.spawn(onJoin, p) end
game:BindToClose(function()
	if sim and hostUserId then saveNow("close") end
end)
