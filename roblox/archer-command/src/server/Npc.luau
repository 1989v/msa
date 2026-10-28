--!nonstrict
-- 아군·적 NPC. 서버 Humanoid 리그를 Humanoid:MoveTo 재발행으로 움직인다(공개 협동 좀비 슈터의 방식).
-- 사격은 서버가 판정하고, 화살·명중 연출은 Fx 이벤트로 모든 클라이언트가 즉시 그린다.
local Debris = game:GetService("Debris")
local Shared = game:GetService("ReplicatedStorage"):WaitForChild("ArcherCommand")
local Config = require(Shared.Config)
local Rules = require(Shared.Rules)
local Rigs = require(script.Parent.Rigs)

local Npc = {}
-- Main 이 채운다. Npc 는 탑·금화·캠페인을 직접 알지 않는다.
Npc.hooks = {
	gold = function(_amount, _reason, _pos) end,
	enemyKilled = function(_ent) end,
	allyDied = function(_ent) end,
	structureDamage = function(_model, _amount) end,
	upgrades = function() return { attack = 0, armor = 0 } end,
	towers = function() return {} end,
	claimBuild = function(_ent) return nil end,
	buildProgress = function(_site, _dt) return false end,
	claimRepair = function(_ent) return nil end,
	repair = function(_tower, _dt) return false end,
	phasePlaying = function() return false end,
}

local Fx = Shared:WaitForChild("Remotes"):WaitForChild("Fx")
local folder = workspace:FindFirstChild("Npcs") or Instance.new("Folder")
folder.Name = "Npcs"; folder.Parent = workspace

local allies, enemies, structures, players = {}, {}, {}, {}
local flat = Rules.flatDistance
local now = os.clock

local groundParams = RaycastParams.new()
groundParams.FilterType = Enum.RaycastFilterType.Include
groundParams.FilterDescendantsInstances = { workspace.Terrain, workspace:WaitForChild("World") }
local function groundY(x, z)
	local hit = workspace:Raycast(Vector3.new(x, 80, z), Vector3.new(0, -160, 0), groundParams)
	return hit and hit.Position.Y or 0
end
Npc.groundY = groundY

local function ownPhysics(model)
	for _, p in model:GetDescendants() do
		if p:IsA("BasePart") and not p.Anchored then pcall(function() p:SetNetworkOwner(nil) end) end
	end
end

local function alive(ent) return ent and ent.model.Parent ~= nil and not ent.dead end

local function fx(kind, ...) Fx:FireAllClients(kind, ...) end

-- ───────── 적 ─────────
function Npc.spawnEnemy(kind, position, role, group)
	local def = Config.ENEMIES[kind]
	local model, hum, root = Rigs.makeEnemy(kind)
	local y = groundY(position.X, position.Z)
	model:PivotTo(CFrame.new(position.X, y + (def.flying and def.altitude or 3), position.Z))
	model.Parent = folder
	ownPhysics(model)
	local ent = { kind = kind, def = def, model = model, hum = hum, root = root, role = role, group = group, home = Vector3.new(position.X, y, position.Z), retarget = 0, moveTimer = 0, lastAttack = 0, lastPos = root.Position, stuckTimer = 0, hp = def.maxHealth }
	enemies[model] = ent
	if hum then
		hum.Died:Connect(function() Npc.killEnemy(ent) end)
	end
	return ent
end

function Npc.killEnemy(ent)
	if ent.dead then return end
	ent.dead = true
	enemies[ent.model] = nil
	Npc.hooks.enemyKilled(ent)
	fx("death", ent.model)
	Debris:AddItem(ent.model, 1.5)
end

function Npc.damageEnemy(ent, amount, hitPos)
	if not alive(ent) then return end
	fx("hit", hitPos or ent.root.Position, amount, ent.model)
	if ent.hum then
		ent.hum:TakeDamage(amount)
	else
		ent.hp -= amount
		ent.model:SetAttribute("Health", math.max(0, ent.hp))
		if ent.hp <= 0 then Npc.killEnemy(ent) end
	end
end

function Npc.registerStructure(model, health, radius)
	structures[model] = { model = model, radius = radius or 4 }
	model:SetAttribute("Health", health); model:SetAttribute("MaxHealth", health)
end
function Npc.unregisterStructure(model) structures[model] = nil end

-- ───────── 아군 ─────────
local function nextIndex(owner)
	local used = {}
	for _, a in allies do if a.owner == owner then used[a.index] = true end end
	local i = 0
	while used[i] do i += 1 end
	return i
end

local NODES = {
	{ kind = "wood", pos = Config.SITES.wood_west }, { kind = "ore", pos = Config.SITES.ore_west },
	{ kind = "wood", pos = Config.SITES.wood_east }, { kind = "ore", pos = Config.SITES.ore_east },
}

function Npc.spawnAlly(kind, owner, position)
	local def = Config.UNITS[kind]
	local model, hum, root = Rigs.makeAlly(kind)
	local y = groundY(position.X, position.Z)
	model:PivotTo(CFrame.new(position.X, y + 3, position.Z))
	model.Parent = folder
	ownPhysics(model)
	local ent = { kind = kind, def = def, model = model, hum = hum, root = root, owner = owner, index = nextIndex(owner), lastShot = 0, moveTimer = 0, state = "idle", timer = 0, nodeIndex = 0 }
	if owner then model:SetAttribute("OwnerId", owner.UserId) end
	allies[model] = ent
	hum.Died:Connect(function()
		if ent.dead then return end
		ent.dead = true
		allies[model] = nil
		if ent.garrison then Npc.ungarrison(ent, true) end
		Npc.hooks.allyDied(ent)
		fx("death", model)
		Debris:AddItem(model, 1.5)
	end)
	return ent
end

function Npc.removeAlly(ent)
	if ent.dead then return end
	ent.dead = true
	allies[ent.model] = nil
	ent.model:Destroy()
end

function Npc.registerPlayer(player) players[player] = { lastShot = 0 } end
function Npc.unregisterPlayer(player)
	players[player] = nil
	for _, a in allies do if a.owner == player then a.owner = nil end end
end

-- ───────── 조회 ─────────
function Npc.counts()
	local c = { enemies = 0, allies = 0, carpenters = 0 }
	for _, e in enemies do if alive(e) then c.enemies += 1 end end
	for _, a in allies do if alive(a) then if a.kind == "carpenter" then c.carpenters += 1 else c.allies += 1 end end end
	return c
end
function Npc.aliveWithGroup(group)
	local n = 0
	for _, e in enemies do if alive(e) and e.group == group then n += 1 end end
	return n
end
function Npc.alliesOf(player, kinds)
	local out = {}
	for _, a in allies do if alive(a) and a.owner == player and (not kinds or kinds[a.kind]) then table.insert(out, a) end end
	return out
end
function Npc.allAllies() return allies end
function Npc.allEnemies() return enemies end
function Npc.clear()
	for _, e in enemies do e.dead = true; e.model:Destroy() end
	for _, a in allies do a.dead = true; a.model:Destroy() end
	enemies, allies, structures = {}, {}, {}
end

-- ───────── 사격 ─────────
local function shoot(fromPos, ent, damage, color)
	if not alive(ent) then return end
	local toPos = ent.root.Position + Vector3.new(0, 1, 0)
	local travel = (toPos - fromPos).Magnitude / Config.ARROW.speed
	fx("arrow", fromPos, toPos, travel, color)
	task.delay(travel, function()
		if alive(ent) then Npc.damageEnemy(ent, damage, ent.root.Position) end
	end)
end

local function shootStructure(fromPos, s, damage)
	local toPos = s.model:GetPivot().Position + Vector3.new(0, 4, 0)
	local travel = (toPos - fromPos).Magnitude / Config.ARROW.speed
	fx("arrow", fromPos, toPos, travel)
	task.delay(travel, function()
		if s.model.Parent then Npc.hooks.structureDamage(s.model, damage) end
	end)
end

local function nearestEnemy(pos, range)
	local best, bestD = nil, range
	for _, e in enemies do
		if alive(e) then
			local d = flat(e.root.Position, pos)
			if d < bestD then best, bestD = e, d end
		end
	end
	local bestS = nil
	if not best then
		for _, s in structures do
			if s.model.Parent and (s.model:GetAttribute("Health") or 0) > 0 then
				local d = flat(s.model:GetPivot().Position, pos)
				if d < bestD then bestS, bestD = s, d end
			end
		end
	end
	return best, bestS
end

-- 영웅 일제 사격: 반경 안 적에게 화살을 나눠 쏜다.
function Npc.volley(point, fromPos)
	local skill = Config.HERO_SKILL
	local inside = {}
	for _, e in enemies do if alive(e) and flat(e.root.Position, point) <= skill.radius then table.insert(inside, e) end end
	local up = Npc.hooks.upgrades()
	local damage = Rules.attackDamage(skill.damage, up.attack)
	for i = 1, skill.arrows do
		local target = inside[(i - 1) % math.max(1, #inside) + 1]
		if target then
			task.delay((i - 1) * 0.05, function() shoot(fromPos + Vector3.new(0, 2, 0), target, damage, "hero") end)
		else
			local angle = i / skill.arrows * math.pi * 2
			local to = point + Vector3.new(math.cos(angle) * skill.radius * 0.6, 0, math.sin(angle) * skill.radius * 0.6)
			local travel = (to - fromPos).Magnitude / Config.ARROW.speed
			task.delay((i - 1) * 0.05, function() fx("arrow", fromPos + Vector3.new(0, 2, 0), to, travel, "hero") end)
		end
	end
	return #inside
end

-- ───────── 주둔 ─────────
function Npc.garrison(ent, tower)
	local top = tower:FindFirstChild("Top", true)
	ent.garrison = tower
	ent.root.Anchored = true
	ent.model:PivotTo(CFrame.new(top.WorldPosition + Vector3.new(0, 3, 0)))
	tower:SetAttribute("Garrison", (tower:GetAttribute("Garrison") or 0) + 1)
end
function Npc.ungarrison(ent, destroyed)
	local tower = ent.garrison
	ent.garrison = nil
	if not tower then return end
	tower:SetAttribute("Garrison", math.max(0, (tower:GetAttribute("Garrison") or 1) - 1))
	if alive(ent) then
		ent.root.Anchored = false
		local base = tower:GetPivot().Position
		ent.model:PivotTo(CFrame.new(base.X + 4, groundY(base.X + 4, base.Z + 4) + 3, base.Z + 4))
		ownPhysics(ent.model)
		if destroyed then ent.hum:TakeDamage(ent.hum.MaxHealth * 0.5) end
	end
end
function Npc.garrisonedOn(tower)
	local out = {}
	for _, a in allies do if alive(a) and a.garrison == tower then table.insert(out, a) end end
	return out
end

-- ───────── 틱 ─────────
local function targetsForEnemies()
	local list = {}
	for player in players do
		local char = player.Character
		local hum = char and char:FindFirstChildOfClass("Humanoid")
		local root = char and char:FindFirstChild("HumanoidRootPart")
		if hum and root and hum.Health > 0 then table.insert(list, { kind = "player", pos = root.Position, radius = 2, hum = hum }) end
	end
	for _, a in allies do
		if alive(a) and not a.garrison then table.insert(list, { kind = "ally", pos = a.root.Position, radius = 2, hum = a.hum, ent = a }) end
	end
	for _, t in Npc.hooks.towers() do table.insert(list, { kind = "tower", pos = t.pos, radius = t.radius, model = t.model }) end
	table.insert(list, { kind = "base", pos = Config.SITES.base, radius = 9, base = true })
	return list
end

local function applyEnemyDamage(target, raw)
	if target.hum then
		local up = Npc.hooks.upgrades()
		target.hum:TakeDamage(Rules.damageTaken(raw, up.armor))
	elseif target.model then
		Npc.hooks.structureDamage(target.model, raw)
	elseif target.base then
		Npc.hooks.structureDamage(nil, raw)
	end
end

local function pickEnemyTarget(ent, list)
	local aggro = if ent.role == "wave" or ent.role == "counter" then 28 else 32
	local best, bestD = nil, math.huge
	for _, t in list do
		if not t.base then
			local d = flat(t.pos, ent.root.Position)
			if d < bestD and d <= aggro + t.radius then best, bestD = t, d end
		end
	end
	if best then return best end
	if ent.role == "wave" or ent.role == "counter" then
		for _, t in list do if t.base then return t end end
	end
	return nil
end

local function updateEnemy(ent, dt, list, t)
	local root = ent.root
	if ent.retarget <= t then
		ent.retarget = t + 0.5
		ent.target = pickEnemyTarget(ent, list)
	end
	local target = ent.target
	local def = ent.def
	if target and target.hum and target.hum.Health <= 0 then target = nil; ent.target = nil end
	local dest = target and target.pos or (flat(ent.home, root.Position) > 4 and ent.home or nil)
	if def.flying then
		local goal = dest or root.Position
		local dir = Vector3.new(goal.X - root.Position.X, 0, goal.Z - root.Position.Z)
		local dist = dir.Magnitude
		local stop = target and (def.attackRange + target.radius) or 1
		if dist > stop then
			local step = math.min(dist - stop, def.walkSpeed * dt)
			local nextPos = root.Position + dir.Unit * step
			local y = groundY(nextPos.X, nextPos.Z) + def.altitude + math.sin(t * 6) * 0.4
			ent.model:PivotTo(CFrame.lookAt(Vector3.new(nextPos.X, y, nextPos.Z), Vector3.new(goal.X, y, goal.Z)))
		end
	elseif dest then
		local d = flat(dest, root.Position)
		local reach = target and (def.attackRange + target.radius) or 2
		if d > reach then
			if ent.moveTimer <= t then ent.moveTimer = t + 0.3; ent.hum:MoveTo(dest) end
			Rigs.animate(ent.model, ent.hum, true)
			ent.stuckTimer += dt
			if ent.stuckTimer >= 1.2 then
				if (root.Position - ent.lastPos).Magnitude < 0.8 then ent.hum.Jump = true end
				ent.lastPos = root.Position; ent.stuckTimer = 0
			end
		else
			ent.hum:MoveTo(root.Position)
			Rigs.animate(ent.model, ent.hum, false)
			root.CFrame = CFrame.lookAt(root.Position, Vector3.new(dest.X, root.Position.Y, dest.Z))
		end
	else
		Rigs.animate(ent.model, ent.hum, false)
	end
	if target and t - ent.lastAttack >= def.cooldown and flat(target.pos, root.Position) <= def.attackRange + target.radius + 0.5 then
		ent.lastAttack = t
		if def.spitSpeed then
			local from = root.Position + Vector3.new(0, 1.5, 0)
			local travel = (target.pos - from).Magnitude / def.spitSpeed
			fx("spit", from, target.pos, travel)
			task.delay(travel, function() if alive(ent) then applyEnemyDamage(target, def.damage) end end)
		else
			fx("melee", root.Position, target.pos)
			applyEnemyDamage(target, def.damage)
		end
	end
end

local function formationOffset(index)
	local ring = math.floor(index / 6)
	local angle = (index % 6) / 6 * math.pi * 2 + ring * 0.5
	local r = 4 + ring * 2.5
	return Vector3.new(math.cos(angle) * r, 0, 2 + math.abs(math.sin(angle)) * r)
end

local function updateCombatAlly(ent, dt, t, up)
	local root = ent.root
	local range = ent.def.range + (ent.garrison and Config.TOWER.heightBonus or 0)
	local enemy, structure = nearestEnemy(root.Position, range)
	if (enemy or structure) and t - ent.lastShot >= ent.def.fireInterval then
		ent.lastShot = t
		local from = root.Position + Vector3.new(0, 1.6, 0)
		local damage = Rules.attackDamage(ent.def.damage, up.attack)
		if enemy then shoot(from, enemy, damage, ent.kind) else shootStructure(from, structure, damage) end
		local aim = enemy and enemy.root.Position or structure.model:GetPivot().Position
		if ent.garrison or ent.hum.MoveDirection.Magnitude < 0.1 then root.CFrame = CFrame.lookAt(root.Position, Vector3.new(aim.X, root.Position.Y, aim.Z)) end
	end
	if ent.garrison then Rigs.animate(ent.model, ent.hum, false); return end
	local ownerRoot = ent.owner and ent.owner.Character and ent.owner.Character:FindFirstChild("HumanoidRootPart")
	local anchor = ownerRoot and ownerRoot.CFrame or CFrame.new(Config.SITES.base + Vector3.new(0, 3, 0))
	local dest = (anchor * CFrame.new(formationOffset(ent.index))).Position
	local d = flat(dest, root.Position)
	if d > 3 then
		if ent.moveTimer <= t then ent.moveTimer = t + 0.3; ent.hum:MoveTo(dest) end
		Rigs.animate(ent.model, ent.hum, true)
	else
		Rigs.animate(ent.model, ent.hum, false)
	end
end

local storePos = Config.SITES.store
local function updateCarpenter(ent, dt, t)
	local root = ent.root
	local function goTo(pos)
		if ent.moveTimer <= t then ent.moveTimer = t + 0.3; ent.hum:MoveTo(pos) end
		Rigs.animate(ent.model, ent.hum, true)
	end
	local function near(pos, r) return flat(pos, root.Position) <= r end
	if ent.state == "idle" then
		local site = Npc.hooks.claimBuild(ent)
		if site then ent.state = "build"; ent.site = site; return end
		local tower = Npc.hooks.claimRepair(ent)
		if tower then ent.state = "repair"; ent.site = tower; return end
		ent.nodeIndex = ent.nodeIndex % #NODES + 1
		ent.node = NODES[(ent.index + ent.nodeIndex) % #NODES + 1]
		ent.state = "toNode"
	elseif ent.state == "toNode" then
		if near(ent.node.pos, 5) then ent.state = "gather"; ent.timer = 0 else goTo(ent.node.pos) end
	elseif ent.state == "gather" then
		Rigs.animate(ent.model, ent.hum, false)
		ent.timer += dt
		if ent.timer >= Config.CARPENTER.gatherSeconds then ent.carry = ent.node.kind; ent.state = "return"; fx("gather", ent.node.pos, ent.node.kind) end
	elseif ent.state == "return" then
		if near(storePos, 5) then
			Npc.hooks.gold(Rules.carryGold(ent.carry), "carry", storePos)
			ent.carry = nil; ent.state = "idle"
		else goTo(storePos) end
	elseif ent.state == "build" then
		local site = ent.site
		if not site or not site.Parent then ent.state = "idle"; return end
		local pos = site:GetPivot().Position
		if near(pos, 6) then
			Rigs.animate(ent.model, ent.hum, false)
			if Npc.hooks.buildProgress(site, dt) then ent.state = "idle"; ent.site = nil end
		else goTo(pos) end
	elseif ent.state == "repair" then
		local tower = ent.site
		if not tower or not tower.Parent then ent.state = "idle"; return end
		local pos = tower:GetPivot().Position
		if near(pos, 6) then
			Rigs.animate(ent.model, ent.hum, false)
			if Npc.hooks.repair(tower, dt) then ent.state = "idle"; ent.site = nil end
		else goTo(pos) end
	end
end

local function updatePlayers(t, up)
	for player, p in players do
		local char = player.Character
		local hum = char and char:FindFirstChildOfClass("Humanoid")
		local root = char and char:FindFirstChild("HumanoidRootPart")
		if hum and root and hum.Health > 0 and t - p.lastShot >= Config.PLAYER.fireInterval then
			local enemy, structure = nearestEnemy(root.Position, Config.PLAYER.range)
			if enemy or structure then
				p.lastShot = t
				local from = root.Position + Vector3.new(0, 1.6, 0)
				local damage = Rules.attackDamage(Config.PLAYER.damage, up.attack)
				if enemy then shoot(from, enemy, damage, "player") else shootStructure(from, structure, damage) end
			end
		end
	end
end

local listCache, listAt = {}, 0
function Npc.update(dt)
	if not Npc.hooks.phasePlaying() then return end
	local t = now()
	if t - listAt > 0.25 then listCache = targetsForEnemies(); listAt = t end
	local up = Npc.hooks.upgrades()
	for _, e in enemies do if alive(e) then updateEnemy(e, dt, listCache, t) end end
	for _, a in allies do
		if alive(a) then
			if a.kind == "carpenter" then updateCarpenter(a, dt, t) else updateCombatAlly(a, dt, t, up) end
		end
	end
	updatePlayers(t, up)
end

return Npc
