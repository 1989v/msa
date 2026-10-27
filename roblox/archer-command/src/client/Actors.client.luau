--!nonstrict
-- 적·동료·목수·투사체·예고 표식은 클라이언트가 그린다. 서버 10Hz 패킷을 100ms 보간.
-- 모델은 workspace.ClientActors 에 두고 id·kind·hp·flags 를 어트리뷰트로 싣는다 — HUD 가 레이캐스트로 고른다.
local Players = game:GetService("Players")
local Run = game:GetService("RunService")
local Shared = game:GetService("ReplicatedStorage"):WaitForChild("ArcherCommand")
local Packet = require(Shared.Packet)
local Grid = require(Shared.Grid)
local Theme = require(Shared.Theme)
local Balance = require(Shared.Balance)
local actorsRemote = Shared:WaitForChild("Actors")
local player = Players.LocalPlayer

local folder = Instance.new("Folder"); folder.Name = "ClientActors"; folder.Parent = workspace
local fxFolder = Instance.new("Folder"); fxFolder.Name = "ClientFx"; fxFolder.Parent = workspace
local terrain = Grid.create()

local function rgb(token) local c = Theme[token] return Color3.fromRGB(c[1], c[2], c[3]) end
local function part(parent, size, color, material, shape)
	local p = Instance.new("Part")
	p.Anchored = true; p.CanCollide = false; p.CanQuery = true; p.CastShadow = false
	p.Size = size; p.Color = color; p.Material = material or Enum.Material.SmoothPlastic
	if shape then p.Shape = shape end
	p.Parent = parent
	return p
end

-- 종류별 모양: 몸통·머리·소품. 폭 1~2 스터드 (추종 반경 5.25 안에 24명이 든다)
local STYLE = {
	archer = { body = { 1.2, 1.8, 0.8 }, color = "friendly", head = "textPrimary", prop = "bow" },
	hero_archer = { body = { 1.4, 2.2, 0.9 }, color = "warning", head = "textPrimary", prop = "bow" },
	longbow = { body = { 1.2, 2.0, 0.8 }, color = "primary", head = "textPrimary", prop = "longbow" },
	carpenter = { body = { 1.2, 1.7, 0.8 }, color = "wood", head = "textPrimary", prop = "tool" },
	zombie = { body = { 1.2, 1.8, 0.8 }, color = "infestation", head = "stone" },
	ghoul = { body = { 0.9, 1.9, 0.7 }, color = "enemy", head = "infestation" },
	plague = { body = { 1.3, 1.7, 0.9 }, color = "healing", head = "infestation" },
	bat = { body = { 1.6, 0.5, 0.6 }, color = "infestation", head = "enemy", fly = 4 },
	armored = { body = { 1.8, 2.0, 1.2 }, color = "stone", head = "stone", material = Enum.Material.Metal },
	vampire = { body = { 1.3, 2.2, 0.9 }, color = "enemy", head = "textPrimary" },
	enemy_tower = { body = { 3, 10, 3 }, color = "infestation", material = Enum.Material.Slate, still = true },
	camp = { body = { 8, 6, 8 }, color = "infestation", material = Enum.Material.Slate, still = true },
}

local models = {}      -- [id] = { model, body, head, from, to, t, kind, bob }
local lastSeen = {}
local now = 0

local function build(a)
	local st = STYLE[a.kind] or STYLE.zombie
	local model = Instance.new("Model"); model.Name = a.kind .. a.id
	local body = part(model, Vector3.new(table.unpack(st.body)), rgb(st.color), st.material)
	body.Name = "Body"
	local head
	if st.head then
		head = part(model, Vector3.new(0.9, 0.9, 0.9), rgb(st.head), nil, Enum.PartType.Ball); head.Name = "Head"
	end
	if st.prop == "bow" or st.prop == "longbow" then
		local bow = part(model, Vector3.new(0.15, if st.prop == "longbow" then 2.4 else 1.6, 0.15), rgb("wood")); bow.Name = "Prop"
	elseif st.prop == "tool" then
		local tool = part(model, Vector3.new(0.2, 1.0, 0.2), rgb("stone")); tool.Name = "Prop"
	end
	-- 체력 막대 (피해를 입었을 때만 보인다)
	local bill = Instance.new("BillboardGui"); bill.Name = "Hp"; bill.Size = UDim2.fromOffset(28, 4); bill.StudsOffset = Vector3.new(0, st.body[2] / 2 + 1.2, 0); bill.AlwaysOnTop = true; bill.Enabled = false
	local back = Instance.new("Frame"); back.Size = UDim2.fromScale(1, 1); back.BackgroundColor3 = rgb("surface0"); back.BorderSizePixel = 0; back.Parent = bill
	local bar = Instance.new("Frame"); bar.Name = "Bar"; bar.Size = UDim2.fromScale(1, 1); bar.BorderSizePixel = 0; bar.Parent = back
	bill.Adornee = body; bill.Parent = body
	model.PrimaryPart = body
	model.Parent = folder
	return { model = model, body = body, head = head, prop = model:FindFirstChild("Prop"), bill = bill, bar = bar, kind = a.kind, bob = a.id % 7 / 7 }
end

local function apply(entry, a)
	local m = entry.model
	m:SetAttribute("id", a.id); m:SetAttribute("kind", a.kind); m:SetAttribute("hp", a.hp); m:SetAttribute("flags", a.flags)
	local enemy = Packet.has(a.flags, Packet.FLAG.enemy)
	entry.bill.Enabled = a.hp < 0.999 or a.kind == "camp" or Packet.has(a.flags, Packet.FLAG.guard)
	entry.bar.Size = UDim2.fromScale(math.max(0, a.hp), 1)
	entry.bar.BackgroundColor3 = if enemy then rgb("enemy") else rgb("healing")
	-- 리더(플레이어 아바타)는 실물 캐릭터가 있으니 액터 모델을 숨긴다
	local hide = Packet.has(a.flags, Packet.FLAG.leader) or Packet.has(a.flags, Packet.FLAG.garrison)
	for _, p in m:GetChildren() do if p:IsA("BasePart") then p.Transparency = if hide then 1 else 0 end end
	entry.bill.Enabled = entry.bill.Enabled and not hide
end

local function place(entry, x, z, heading, dt)
	local st = STYLE[entry.kind] or STYLE.zombie
	local y = Grid.heightAt(terrain, { x = x, z = z }) + (st.fly or 0)
	local bodyH = st.body[2]
	local bob = if st.still then 0 else math.abs(math.sin(now * 9 + entry.bob * 6)) * 0.18
	local cf = CFrame.new(x, y + bodyH / 2 + bob, z) * CFrame.Angles(0, -heading + math.pi / 2, 0)
	entry.body.CFrame = cf
	if entry.head then entry.head.CFrame = cf * CFrame.new(0, bodyH / 2 + 0.5, 0) end
	if entry.prop then entry.prop.CFrame = cf * CFrame.new(st.body[1] / 2 + 0.2, 0, -0.2) end
end

-- 투사체·예고 풀
local bulletPool, fxPool = {}, {}
local function bullet(b)
	local p = table.remove(bulletPool) or part(fxFolder, Vector3.new(0.12, 0.12, 1), rgb("warning"), Enum.Material.Neon)
	p.CanQuery = false
	local y1 = Grid.heightAt(terrain, { x = b.x, z = b.z }) + 2.2
	local y2 = Grid.heightAt(terrain, { x = b.tx, z = b.tz }) + 2
	local a, c = Vector3.new(b.x, y1, b.z), Vector3.new(b.tx, y2, b.tz)
	local len = math.max(0.5, (c - a).Magnitude)
	p.Size = Vector3.new(0.12, 0.12, len)
	p.CFrame = CFrame.lookAt((a + c) / 2, c)
	p.Color = if b.friendly then rgb("warning") else rgb("enemy")
	p.Transparency = 0.2
	p.Parent = fxFolder
	task.delay(0.12, function() p.Parent = nil; table.insert(bulletPool, p) end)
end
local function effect(fx)
	local p = table.remove(fxPool) or part(fxFolder, Vector3.new(1, 0.2, 1), rgb("enemy"), Enum.Material.Neon, Enum.PartType.Cylinder)
	p.CanQuery = false
	local y = Grid.heightAt(terrain, { x = fx.x, z = fx.z }) + 0.15
	p.Size = Vector3.new(0.2, fx.radius * 2, fx.radius * 2)
	p.CFrame = CFrame.new(fx.x, y, fx.z) * CFrame.Angles(0, 0, math.pi / 2)
	p.Color = if fx.warning then rgb("enemy") else rgb("stone")
	p.Transparency = if fx.warning then 0.55 else 0.3
	p.Parent = fxFolder
	task.delay(0.12, function() p.Parent = nil; table.insert(fxPool, p) end)
end

actorsRemote.OnClientEvent:Connect(function(buf)
	if typeof(buf) ~= "buffer" then return end
	local packet = Packet.decode(buf)
	local t = os.clock()
	for _, a in packet.actors do
		local entry = models[a.id]
		if not entry or entry.kind ~= a.kind then
			if entry then entry.model:Destroy() end
			entry = build(a); models[a.id] = entry
			entry.from = { x = a.x, z = a.z }; entry.to = { x = a.x, z = a.z }; entry.heading = a.heading; entry.t = t
		else
			entry.from = { x = entry.cx or entry.to.x, z = entry.cz or entry.to.z }; entry.to = { x = a.x, z = a.z }; entry.heading = a.heading; entry.t = t
		end
		lastSeen[a.id] = t
		apply(entry, a)
	end
	for _, b in packet.bullets do bullet(b) end
	for _, fx in packet.effects do effect(fx) end
	for id, entry in models do
		if t - (lastSeen[id] or 0) > 0.6 then entry.model:Destroy(); models[id] = nil; lastSeen[id] = nil end
	end
end)

Run.RenderStepped:Connect(function(dt)
	now = os.clock()
	for _, entry in models do
		local k = math.clamp((now - entry.t) / 0.1, 0, 1)
		local x = entry.from.x + (entry.to.x - entry.from.x) * k
		local z = entry.from.z + (entry.to.z - entry.from.z) * k
		entry.cx, entry.cz = x, z
		place(entry, x, z, entry.heading, dt)
	end
end)
