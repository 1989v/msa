--!nonstrict
-- 방어탑: 플레이어가 지면을 탭해 자리를 정하면 스스로 올라간다(autoBuildSeconds). 목수가 붙으면 더 빠르다.
-- 완성된 탑은 발리스타가 자동 사격하고(Npc 가 쏜다), 활잡이를 주둔시키면 그 위에서 더 쏜다(ProximityPrompt).
local ServerStorage = game:GetService("ServerStorage")
local Shared = game:GetService("ReplicatedStorage"):WaitForChild("ArcherCommand")
local Config = require(Shared.Config)
local Rules = require(Shared.Rules)
local Npc = require(script.Parent.Npc)
local Assets = ServerStorage:WaitForChild("ArcherAssets")
local Fx = Shared.Remotes.Fx

local Towers = {}
Towers.hooks = { spend = function(_amount) return false end, toast = function(_text) end }
local sites, towers = {}, {}
local folder = workspace:FindFirstChild("Towers") or Instance.new("Folder")
folder.Name = "Towers"; folder.Parent = workspace

local function positions()
	local out = {}
	for _, s in sites do table.insert(out, s.model:GetPivot().Position) end
	for _, t in towers do table.insert(out, t.model:GetPivot().Position) end
	return out
end

function Towers.place(player, point)
	local root = player.Character and player.Character:FindFirstChild("HumanoidRootPart")
	if not root then return false, "NOCHAR" end
	local ok, why = Rules.canPlaceTower(point, root.Position, positions(), #sites + #towers)
	if not ok then return false, why end
	if not Towers.hooks.spend(Config.TOWER.cost) then return false, "GOLD" end
	local y = Npc.groundY(point.X, point.Z)
	local site = Assets.TowerSite:Clone()
	site:PivotTo(CFrame.new(point.X, y, point.Z))
	site:SetAttribute("Progress", 0)
	site.Parent = folder
	table.insert(sites, { model = site, progress = 0, worker = nil })
	Fx:FireAllClients("site", site)
	return true, "OK"
end

function Towers.claimBuild(ent)
	for _, s in sites do if s.worker == ent or s.worker == nil or s.worker.dead then s.worker = ent; return s.model end end
	return nil
end

-- progress 는 0~1. 스스로 1/autoBuildSeconds 씩, 목수가 붙으면 1/buildSeconds 를 더한다.
local function advance(s, i, amount)
	s.progress = math.min(1, s.progress + amount)
	s.model:SetAttribute("Progress", s.progress)
	if s.progress >= 1 then
		table.remove(sites, i)
		Towers.complete(s.model)
		return true
	end
	return false
end

function Towers.update(dt)
	for i = #sites, 1, -1 do advance(sites[i], i, dt / Config.TOWER.autoBuildSeconds) end
end

function Towers.buildProgress(siteModel, dt)
	for i, s in sites do
		if s.model == siteModel then return advance(s, i, dt / Config.CARPENTER.buildSeconds) end
	end
	return true
end

function Towers.complete(siteModel)
	local pivot = siteModel:GetPivot()
	siteModel:Destroy()
	local tower = Assets.Tower:Clone()
	tower:PivotTo(pivot)
	tower:SetAttribute("Health", Config.TOWER.maxHealth); tower:SetAttribute("MaxHealth", Config.TOWER.maxHealth); tower:SetAttribute("Garrison", 0)
	local prompt = Instance.new("ProximityPrompt")
	prompt.ActionText = "주둔 / 철수"; prompt.ObjectText = "방어탑"; prompt.MaxActivationDistance = 10; prompt.HoldDuration = 0.3; prompt.RequiresLineOfSight = false
	prompt.Parent = tower.PrimaryPart
	prompt.Triggered:Connect(function(player) Towers.toggleGarrison(player, tower) end)
	tower.Parent = folder
	table.insert(towers, { model = tower, repairer = nil })
	Fx:FireAllClients("tower", tower)
	Towers.hooks.toast("방어탑 완성 · 발리스타가 쏜다 · 가까이 가면 활잡이를 주둔시킬 수 있다")
end

function Towers.toggleGarrison(player, tower)
	local garrisoned = Npc.garrisonedOn(tower)
	local root = player.Character and player.Character:FindFirstChild("HumanoidRootPart")
	if not root then return end
	if #garrisoned < Config.TOWER.garrison then
		local best, bestD = nil, 14
		local ranged = {}
		for kind, unit in pairs(Config.UNITS) do if unit.combat and not unit.melee then ranged[kind] = true end end
		for _, a in Npc.alliesOf(player, ranged) do
			if not a.garrison then
				local d = Rules.flatDistance(a.root.Position, root.Position)
				if d < bestD then best, bestD = a, d end
			end
		end
		if best then Npc.garrison(best, tower); return end
	end
	if #garrisoned > 0 then Npc.ungarrison(garrisoned[#garrisoned], false) else Towers.hooks.toast("근처에 주둔시킬 활잡이가 없다") end
end

function Towers.claimRepair(ent)
	for _, t in towers do
		local hp, max = t.model:GetAttribute("Health") or 0, t.model:GetAttribute("MaxHealth") or 1
		if hp < max and (t.repairer == nil or t.repairer.dead or t.repairer == ent) then t.repairer = ent; return t.model end
	end
	return nil
end

function Towers.repair(towerModel, dt)
	local hp, max = towerModel:GetAttribute("Health") or 0, towerModel:GetAttribute("MaxHealth") or 1
	hp = math.min(max, hp + Config.CARPENTER.repairPerSecond * dt)
	towerModel:SetAttribute("Health", hp)
	if hp >= max then
		for _, t in towers do if t.model == towerModel then t.repairer = nil end end
		return true
	end
	return false
end

function Towers.damage(model, amount)
	for i, t in towers do
		if t.model == model then
			local hp = (model:GetAttribute("Health") or 0) - amount
			model:SetAttribute("Health", math.max(0, hp))
			if hp <= 0 then
				for _, a in Npc.garrisonedOn(model) do Npc.ungarrison(a, true) end
				table.remove(towers, i)
				Fx:FireAllClients("death", model)
				game:GetService("Debris"):AddItem(model, 1.5)
				Towers.hooks.toast("방어탑이 무너졌다")
			end
			return true
		end
	end
	return false
end

function Towers.list()
	local out = {}
	for _, t in towers do table.insert(out, { model = t.model, pos = t.model:GetPivot().Position, radius = 3.5 }) end
	return out
end

function Towers.count() return #towers end

function Towers.clear()
	for _, s in sites do s.model:Destroy() end
	for _, t in towers do t.model:Destroy() end
	sites, towers = {}, {}
end

return Towers
