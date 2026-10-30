--!nonstrict
-- 아이템: 상자(2타 파괴 → 하트/폭탄 드랍, 30초 재생성) · 하트(밟으면 회복) · 폭탄(ProximityPrompt 로 줍고 3초 뒤 폭발, 공격 키로 던진다) · 점프대.
-- 맵 모델의 CrateSpots/Pads 폴더가 자리다. 템플릿은 ServerStorage.AmpAssets.Items.
local ServerStorage = game:GetService("ServerStorage")
local CollectionService = game:GetService("CollectionService")
local Shared = game:GetService("ReplicatedStorage"):WaitForChild("AmpArena")
local Config = require(Shared.Config)
local Rules = require(Shared.Rules)
local Rigs = require(script.Parent.Rigs)
local Combat = require(script.Parent.Combat)
local Templates = ServerStorage:WaitForChild("AmpAssets"):WaitForChild("Items")

local Items = {}
Items.hooks = { fx = function() end, fighterOf = function() return nil end }
local crates, hearts, bombs, respawns, padTouched = {}, {}, {}, {}, {}
local folder = nil
local random = Random.new()
local BOMB_MOVE = { id = "bomb", damage = Config.ITEMS.bombDamage, effect = "launch", hitstun = 0.3, push = 18, launchH = 24, launchV = 52, guardBreak = true, arcDeg = 360, radius = Config.ITEMS.bombRadius, reach = 0, multiHit = 0, superArmor = false }
local CRATE_MOVE = { id = "crate", damage = Config.ITEMS.crateThrowDamage, effect = "launch", hitstun = 0.3, push = 15, launchH = 20, launchV = 39, guardBreak = false, arcDeg = 360, radius = 2.5, reach = 0, multiHit = 0, superArmor = false }

local function now() return workspace:GetServerTimeNow() end
local function place(model, pos)
	model:PivotTo(CFrame.new(pos))
	model.Parent = folder
end

-- ───────── 상자 ─────────
local function spawnCrate(spot)
	local m = Templates.Crate:Clone()
	m:SetAttribute("Hits", 0)
	place(m, spot.Position + Vector3.new(0, 1.6, 0))
	CollectionService:AddTag(m, "Crate")
	crates[m] = { model = m, spot = spot, hits = 0 }
end
local function dropAt(pos, t)
	local r = random:NextNumber()
	if r < Config.ITEMS.dropHeart then Items.spawnHeart(pos)
	elseif r < Config.ITEMS.dropHeart + Config.ITEMS.dropBomb then Items.spawnBomb(pos) end
end
local function breakCrate(rec, t, byF)
	crates[rec.model] = nil
	local pos = rec.model:GetPivot().Position
	Items.hooks.fx("crateBreak", pos)
	rec.model:Destroy()
	dropAt(pos, t)
	table.insert(respawns, { at = t + Config.ITEMS.crateRespawn, spot = rec.spot })
end
-- 공격 판정이 상자에도 닿는다(Combat.hooks.itemHit).
function Items.hitScan(F, move, t)
	if move.radius <= 0 then return end
	local pos, look = F.root.Position, Combat.look(F)
	for model, rec in crates do
		if not model.Parent then crates[model] = nil; continue end
		if F.hitSet["crate:" .. tostring(model)] then continue end
		if Rules.hitTest(pos, look, move, model:GetPivot().Position, 1.6) then
			F.hitSet["crate:" .. tostring(model)] = t
			rec.hits += 1
			model:SetAttribute("Hits", rec.hits)
			Items.hooks.fx("crateHit", model:GetPivot().Position)
			if rec.hits >= Config.ITEMS.crateHits then breakCrate(rec, t, F) end
		end
	end
end

-- ───────── 하트 ─────────
function Items.spawnHeart(pos)
	local m = Templates.Heart:Clone()
	place(m, pos + Vector3.new(0, 1.5, 0))
	hearts[m] = true
	local taken = false
	m.PrimaryPart.Touched:Connect(function(hit)
		if taken then return end
		local F = Items.hooks.fighterOf(hit:FindFirstAncestorOfClass("Model"))
		if not F or F.state == "dead" then return end
		if F.hum.Health >= F.hum.MaxHealth then return end
		taken = true
		Combat.heal(F, Config.ITEMS.heartHeal)
		Items.hooks.fx("heal", F.root.Position + Vector3.new(0, 2, 0), Config.ITEMS.heartHeal, F.model)
		hearts[m] = nil
		m:Destroy()
	end)
end

-- ───────── 폭탄 ─────────
local function explode(rec, t)
	bombs[rec.model] = nil
	local pos = rec.model:GetPivot().Position
	rec.model:Destroy()
	Items.hooks.fx("explode", pos, Config.ITEMS.bombRadius)
	local A = rec.thrower
	for _, V in Combat.all() do
		if V.state == "dead" or not V.model.Parent then continue end
		local d = Vector3.new(V.root.Position.X - pos.X, 0, V.root.Position.Z - pos.Z)
		if d.Magnitude <= Config.ITEMS.bombRadius + Config.PLAYER.bodyRadius and math.abs(V.root.Position.Y - pos.Y) < 7 then
			local dir = d.Magnitude > 0.1 and d.Unit or Combat.look(V) * -1
			Combat.applyHit(A ~= V and A or nil, V, BOMB_MOVE, t, { dir = dir })
		end
	end
	for model, rec2 in crates do
		if model.Parent and (model:GetPivot().Position - pos).Magnitude <= Config.ITEMS.bombRadius + 2 then breakCrate(rec2, t, A) end
	end
end
local function unweld(rec)
	local w = rec.model.PrimaryPart:FindFirstChild("AmpCarry"); if w then w:Destroy() end
end
-- 서버가 거리와 상태를 다시 본다: ProximityPrompt 의 MaxActivationDistance 는 클라이언트 쪽 조건이라 믿지 않는다.
function Items.pickupBy(F, rec)
	if rec.holder or F.item or F.state ~= "idle" or not rec.model.Parent then return false end
	if Rules.flatDistance(F.root.Position, rec.model:GetPivot().Position) > Config.ITEMS.pickupDistance + 2 then return false end
	local hand = Rigs.hand(F.model, "right")
	if not hand then return false end
	rec.holder = F
	rec.thrower = F
	rec.fuseAt = rec.fuseAt or (now() + Config.ITEMS.bombFuse)
	local prompt = rec.model:FindFirstChildWhichIsA("ProximityPrompt", true); if prompt then prompt.Enabled = false end
	local part = rec.model.PrimaryPart
	part.Anchored = false; part.CanCollide = false; part.Massless = true
	local w = Instance.new("Weld"); w.Name = "AmpCarry"; w.Part0 = hand; w.Part1 = part; w.C0 = CFrame.new(0, -1.2, -0.6); w.Parent = part
	F.item = rec
	Combat.setItem(F, rec)
	Items.hooks.fx("pickup", F.root.Position + Vector3.new(0, 2, 0), F.model)
	return true
end
function Items.spawnBomb(pos, fuseSeconds)
	local m = Templates.Bomb:Clone()
	place(m, pos + Vector3.new(0, 1.5, 0))
	local rec = { model = m, holder = nil, thrower = nil, fuseAt = fuseSeconds and (now() + fuseSeconds) or nil }
	bombs[m] = rec
	m.PrimaryPart.Anchored = false
	m.PrimaryPart:SetNetworkOwner(nil)
	local prompt = m:FindFirstChildWhichIsA("ProximityPrompt", true)
	if prompt then
		prompt.MaxActivationDistance = Config.ITEMS.pickupDistance
		prompt.KeyboardKeyCode = Enum.KeyCode.F
		prompt.GamepadKeyCode = Enum.KeyCode.DPadDown
		prompt.Triggered:Connect(function(player)
			local F = Items.hooks.fighterOf(player.Character)
			if not F then return end
			Items.pickupBy(F, rec)
		end)
	end
	return rec
end
-- 든 폭탄을 정면(또는 입력 방향)으로 던진다. Combat.hooks.throwItem 에서 부른다.
function Items.throwHeld(F, t)
	local rec = F.item
	if not rec or rec.holder ~= F then F.item = nil; Combat.setItem(F, nil); return end
	unweld(rec)
	rec.holder = nil
	F.item = nil; Combat.setItem(F, nil)
	local look = Combat.look(F)
	local d = Rules.throwDirection({ X = look.X, Z = look.Z }, F.throwDir)
	local part = rec.model.PrimaryPart
	part.CanCollide = true; part.Massless = false
	part.CFrame = CFrame.new(F.root.Position + Vector3.new(d.X * 2, 1.5, d.Z * 2))
	part.AssemblyLinearVelocity = Vector3.new(d.X * Config.ITEMS.throwSpeedH, Config.ITEMS.throwSpeedV, d.Z * Config.ITEMS.throwSpeedH)
	Items.hooks.fx("throwItem", part.Position)
end
-- 들고 있던 사람이 죽거나 나가면 폭탄은 그 자리에 떨어진다.
function Items.dropHeld(F)
	local rec = F.item
	if not rec then return end
	unweld(rec); rec.holder = nil; F.item = nil; Combat.setItem(F, nil)
	local part = rec.model.PrimaryPart
	part.CanCollide = true; part.Massless = false
end
-- 가까운 하트/폭탄(봇용)
function Items.nearest(kind, pos, maxDist)
	local best, bestD = nil, maxDist
	local set = kind == "heart" and hearts or bombs
	for m, rec in set do
		if not m.Parent then set[m] = nil; continue end
		if kind == "bomb" and rec.holder then continue end
		local d = (m:GetPivot().Position - pos).Magnitude
		if d < bestD then best, bestD = (kind == "heart" and m or rec), d end
	end
	return best
end

-- ───────── 점프대 ─────────
local function hookPad(part)
	part.Touched:Connect(function(hit)
		local F = Items.hooks.fighterOf(hit:FindFirstAncestorOfClass("Model"))
		if not F then return end
		local t = now()
		if padTouched[F] and t - padTouched[F] < 0.6 then return end
		padTouched[F] = t
		Combat.launchUp(F, Config.PAD.launchSpeed)
		Items.hooks.fx("pad", part.Position)
	end)
end

-- ───────── 매치 ─────────
function Items.setup(arena)
	Items.clear()
	folder = Instance.new("Folder"); folder.Name = "Items"; folder.Parent = arena
	local spots = arena:FindFirstChild("CrateSpots")
	if spots then for _, s in spots:GetChildren() do if s:IsA("BasePart") then spawnCrate(s) end end end
	local pads = arena:FindFirstChild("Pads")
	if pads then for _, p in pads:GetChildren() do if p:IsA("BasePart") then hookPad(p) end end end
end
function Items.clear()
	for _, F in Combat.all() do if F.item then Items.dropHeld(F) end end
	crates, hearts, bombs, respawns, padTouched = {}, {}, {}, {}, {}
	if folder then folder:Destroy(); folder = nil end
end
function Items.update(dt)
	local t = now()
	for i = #respawns, 1, -1 do
		local r = respawns[i]
		if t >= r.at then table.remove(respawns, i); if folder and r.spot.Parent then spawnCrate(r.spot) end end
	end
	for m, rec in bombs do
		if not m.Parent then bombs[m] = nil; continue end
		if rec.fuseAt and t >= rec.fuseAt then explode(rec, t)
		elseif not rec.holder and m.PrimaryPart.Position.Y < -200 then bombs[m] = nil; m:Destroy() end
	end
end
function Items.counts() local c, h, b = 0, 0, 0; for _ in crates do c += 1 end; for _ in hearts do h += 1 end; for _ in bombs do b += 1 end; return c, h, b end

return Items
