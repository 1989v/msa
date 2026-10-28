--!nonstrict
-- 연출. 서버 Fx 이벤트를 받아 화살(메시 대신 파트 + Trail) · 발사 섬광 · 명중 파티클과 소리 · 피해 숫자 · 사망 페이드 · 웨이브 배너를 그린다.
-- 서버가 쏜 순간 모든 클라이언트가 즉시 그린다(공식 Weapons Kit·공개 좀비 슈터의 분담).
local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local TweenService = game:GetService("TweenService")
local CollectionService = game:GetService("CollectionService")
local Debris = game:GetService("Debris")
local Shared = game:GetService("ReplicatedStorage"):WaitForChild("ArcherCommand")
local Theme = require(Shared.Theme)
local Fx = Shared:WaitForChild("Remotes"):WaitForChild("Fx")
local player = Players.LocalPlayer

local root = Instance.new("Folder"); root.Name = "ClientFx"; root.Parent = workspace
local SOUNDS = {
	shot = { id = "rbxasset://sounds/action_swim.mp3", volume = 0.25, speed = 2.1 },
	hit = { id = "rbxassetid://3963012401", volume = 0.5, speed = 1 },
	melee = { id = "rbxasset://sounds/action_jump_land.mp3", volume = 0.5, speed = 0.8 },
	wave = { id = "rbxasset://sounds/impact_explosion_03.mp3", volume = 0.35, speed = 0.5 },
	gold = { id = "rbxasset://sounds/volume_slider.ogg", volume = 0.3, speed = 1.6 },
}
local function playAt(pos, kind)
	local s = SOUNDS[kind]
	local a = Instance.new("Attachment"); a.WorldPosition = pos; a.Parent = workspace.Terrain
	local sound = Instance.new("Sound"); sound.SoundId = s.id; sound.Volume = s.volume; sound.PlaybackSpeed = s.speed; sound.RollOffMaxDistance = 90
	sound.Parent = a; sound:Play()
	Debris:AddItem(a, 3)
end

local function part(size, color, material)
	local p = Instance.new("Part")
	p.Anchored = true; p.CanCollide = false; p.CanQuery = false; p.CanTouch = false; p.CastShadow = false
	p.Size = size; p.Color = color; p.Material = material or Enum.Material.SmoothPlastic
	p.Parent = root
	return p
end

local function emitter(parent, texture, color, size, speed, light)
	local e = Instance.new("ParticleEmitter")
	e.Texture = texture; e.Color = ColorSequence.new(color); e.LightEmission = light or 0.8; e.LightInfluence = 0
	e.Size = NumberSequence.new({ NumberSequenceKeypoint.new(0, size), NumberSequenceKeypoint.new(1, 0) })
	e.Transparency = NumberSequence.new({ NumberSequenceKeypoint.new(0, 0.1), NumberSequenceKeypoint.new(1, 1) })
	e.Lifetime = NumberRange.new(0.25, 0.5); e.Speed = NumberRange.new(speed * 0.6, speed); e.SpreadAngle = Vector2.new(180, 180)
	e.Rate = 0; e.Parent = parent
	return e
end
local SPARK = "rbxasset://textures/particles/sparkles_main.dds"
local SMOKE = "rbxasset://textures/particles/smoke_main.dds"

local function burst(pos, texture, color, size, speed, count)
	local p = part(Vector3.new(0.2, 0.2, 0.2), color); p.Transparency = 1; p.Position = pos
	emitter(p, texture, color, size, speed):Emit(count)
	Debris:AddItem(p, 1.2)
end

-- ───────── 화살 ─────────
local ARROW_COLOR = { player = Theme.arrow, archer = Theme.arrow, longbow = Color3.fromRGB(190, 220, 255), hero = Color3.fromRGB(255, 140, 90) }
local pool, flights = {}, {}
local function makeArrow()
	local shaft = part(Vector3.new(0.18, 0.18, 2.6), Color3.fromRGB(160, 120, 80), Enum.Material.Wood)
	local head = part(Vector3.new(0.3, 0.3, 0.7), Theme.arrow, Enum.Material.Neon); head.Parent = shaft
	local a0 = Instance.new("Attachment"); a0.Position = Vector3.new(0, 0, 1.3); a0.Parent = shaft
	local a1 = Instance.new("Attachment"); a1.Position = Vector3.new(0, 0, -1.3); a1.Parent = shaft
	local trail = Instance.new("Trail")
	trail.Attachment0 = a0; trail.Attachment1 = a1; trail.Lifetime = 0.22; trail.LightEmission = 1; trail.LightInfluence = 0
	trail.WidthScale = NumberSequence.new({ NumberSequenceKeypoint.new(0, 1), NumberSequenceKeypoint.new(1, 0.2) })
	trail.Transparency = NumberSequence.new({ NumberSequenceKeypoint.new(0, 0.2), NumberSequenceKeypoint.new(1, 1) })
	trail.Parent = shaft
	return { shaft = shaft, head = head, trail = trail }
end
local function arrow(from, to, travel, kind)
	local a = table.remove(pool) or makeArrow()
	local color = ARROW_COLOR[kind] or Theme.arrow
	a.head.Color = color; a.trail.Color = ColorSequence.new(color); a.trail.Enabled = true
	a.shaft.CFrame = CFrame.lookAt(from, to); a.shaft.Transparency = 0; a.head.Transparency = 0
	table.insert(flights, { a = a, from = from, to = to, t0 = os.clock(), travel = math.max(0.05, travel) })
	-- 발사 섬광
	local flash = Instance.new("PointLight"); flash.Range = 10; flash.Brightness = 2; flash.Color = color; flash.Parent = a.shaft
	Debris:AddItem(flash, 0.08)
	burst(from, SPARK, color, 0.6, 6, 3)
	if (from - (player.Character and player.Character:GetPivot().Position or from)).Magnitude < 60 then playAt(from, "shot") end
end
RunService.RenderStepped:Connect(function()
	local t = os.clock()
	for i = #flights, 1, -1 do
		local f = flights[i]
		local k = (t - f.t0) / f.travel
		if k >= 1 then
			table.remove(flights, i)
			f.a.trail.Enabled = false
			f.a.shaft.CFrame = CFrame.new(0, -500, 0)
			table.insert(pool, f.a)
			burst(f.to, SPARK, f.a.head.Color, 0.8, 8, 6)
			playAt(f.to, "hit")
		else
			local pos = f.from:Lerp(f.to, k)
			f.a.shaft.CFrame = CFrame.lookAt(pos, f.to)
		end
	end
end)

-- ───────── 피해 숫자 · 금화 ─────────
local function floatingText(pos, text, color, size)
	local p = part(Vector3.new(0.2, 0.2, 0.2), color); p.Transparency = 1; p.Position = pos + Vector3.new((math.random() - 0.5) * 1.5, 2, 0)
	local bill = Instance.new("BillboardGui"); bill.Size = UDim2.fromOffset(80, 30); bill.AlwaysOnTop = true; bill.LightInfluence = 0; bill.Parent = p
	local label = Instance.new("TextLabel"); label.Size = UDim2.fromScale(1, 1); label.BackgroundTransparency = 1
	label.Text = text; label.TextColor3 = color; label.Font = Theme.font; label.TextSize = size or 18; label.TextStrokeTransparency = 0.4; label.Parent = bill
	TweenService:Create(p, TweenInfo.new(0.8, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), { Position = p.Position + Vector3.new(0, 3, 0) }):Play()
	TweenService:Create(label, TweenInfo.new(0.8), { TextTransparency = 1, TextStrokeTransparency = 1 }):Play()
	Debris:AddItem(p, 0.9)
end

local function flash(model)
	if not model or not model.Parent then return end
	local h = Instance.new("Highlight"); h.FillColor = Color3.new(1, 1, 1); h.FillTransparency = 0.4; h.OutlineTransparency = 1; h.Parent = model
	Debris:AddItem(h, 0.08)
end

local function fade(model)
	if not model then return end
	for _, h in model:GetChildren() do if h:IsA("Highlight") then h:Destroy() end end
	for _, p in model:GetDescendants() do
		if p:IsA("BasePart") then TweenService:Create(p, TweenInfo.new(0.6), { Transparency = 1 }):Play()
		elseif p:IsA("Decal") or p:IsA("Texture") then TweenService:Create(p, TweenInfo.new(0.6), { Transparency = 1 }):Play()
		elseif p:IsA("Light") then p.Enabled = false
		elseif p:IsA("BillboardGui") then p.Enabled = false end
	end
end

-- ───────── 화면 배너 ─────────
local gui = Instance.new("ScreenGui"); gui.Name = "ArcherFx"; gui.ResetOnSpawn = false; gui.IgnoreGuiInset = true; gui.Parent = player:WaitForChild("PlayerGui")
local banner = Instance.new("TextLabel"); banner.Size = UDim2.new(1, 0, 0, 60); banner.Position = UDim2.new(0, 0, 0.22, 0); banner.BackgroundTransparency = 1
banner.Font = Theme.fontTitle; banner.TextSize = 44; banner.TextColor3 = Theme.enemy; banner.TextStrokeTransparency = 0.3; banner.TextTransparency = 1; banner.Text = ""; banner.Parent = gui
local function showBanner(text, color)
	banner.Text = text; banner.TextColor3 = color or Theme.enemy; banner.TextTransparency = 0; banner.TextStrokeTransparency = 0.3
	task.delay(1.8, function() if banner.Text == text then TweenService:Create(banner, TweenInfo.new(0.6), { TextTransparency = 1, TextStrokeTransparency = 1 }):Play() end end)
end

-- ───────── 내 캐릭터의 공격 모션 ─────────
-- 플레이어 캐릭터의 애니메이션은 그 클라이언트가 재생해야 모두에게 복제된다. 기본 Animate 의 도구 휘두르기(toolslash)를 쓴다.
local myAttack = nil
local function playMyAttack(to)
	local char = player.Character
	local hum = char and char:FindFirstChildOfClass("Humanoid")
	if not hum or hum.Health <= 0 then return end
	if not myAttack or myAttack.char ~= char then
		local animate = char:FindFirstChild("Animate")
		local slash = animate and animate:FindFirstChild("toolslash") and animate.toolslash:FindFirstChild("ToolSlashAnim")
		local anim = Instance.new("Animation"); anim.AnimationId = slash and slash.AnimationId or "rbxassetid://522635514"
		local animator = hum:FindFirstChildOfClass("Animator") or Instance.new("Animator", hum)
		local ok, track = pcall(function() return animator:LoadAnimation(anim) end)
		if not ok then return end
		track.Priority = Enum.AnimationPriority.Action; track.Looped = false
		myAttack = { char = char, track = track }
	end
	if myAttack.track.IsPlaying then myAttack.track:Stop(0) end
	myAttack.track:Play(0.05)
	-- 서 있을 때는 표적을 향해 돈다(움직일 때는 기본 AutoRotate 가 진행 방향을 잡는다)
	local root = char:FindFirstChild("HumanoidRootPart")
	if root and hum.MoveDirection.Magnitude < 0.1 then root.CFrame = CFrame.lookAt(root.Position, Vector3.new(to.X, root.Position.Y, to.Z)) end
end

-- ───────── 이벤트 ─────────
local handlers = {}
function handlers.arrow(from, to, travel, kind, shooter)
	arrow(from, to, travel, kind)
	if shooter and shooter == player.Character then playMyAttack(to) end
end
function handlers.heal(model)
	if not model then return end
	burst(model:GetPivot().Position + Vector3.new(0, 1.5, 0), SPARK, Theme.healing, 0.9, 4, 6)
end
function handlers.spit(from, to, travel)
	local glob = part(Vector3.new(0.6, 0.6, 0.6), Theme.plague, Enum.Material.Neon); glob.Shape = Enum.PartType.Ball; glob.Position = from
	TweenService:Create(glob, TweenInfo.new(travel, Enum.EasingStyle.Linear), { Position = to }):Play()
	task.delay(travel, function() burst(to, SMOKE, Theme.plague, 1.2, 4, 5); glob:Destroy() end)
end
function handlers.melee(_from, to) burst(to + Vector3.new(0, 1, 0), SMOKE, Color3.fromRGB(120, 100, 90), 1.0, 3, 4); playAt(to, "melee") end
function handlers.hit(pos, amount, model) floatingText(pos, tostring(math.floor(amount)), Theme.textPrimary, 18); flash(model) end
function handlers.death(model) fade(model) end
function handlers.ruin(model) fade(model); burst(model:GetPivot().Position, SMOKE, Color3.fromRGB(90, 80, 70), 4, 6, 14) end
function handlers.gold(pos, amount) floatingText(pos, "+" .. tostring(amount), Theme.warning, 20); playAt(pos, "gold") end
function handlers.wave(n, total) showBanner(string.format("웨이브 %d · 적 %d", n, total)); playAt(player.Character and player.Character:GetPivot().Position or Vector3.zero, "wave") end
function handlers.baseHit(ratio) if ratio < 0.3 then showBanner("본진이 위험하다", Theme.enemy) end end
function handlers.recruit(pos) burst(pos + Vector3.new(0, 2, 0), SPARK, Theme.friendly, 1.2, 5, 10) end
function handlers.combine(pos) burst(pos + Vector3.new(0, 2, 0), SPARK, Color3.fromRGB(255, 140, 90), 2, 8, 24); showBanner("영웅 활잡이", Color3.fromRGB(255, 140, 90)) end
function handlers.upgrade(kind, level) showBanner((kind == "attack" and "공업 " or "방업 ") .. level, Theme.primary) end
function handlers.site(model) burst(model:GetPivot().Position + Vector3.new(0, 1, 0), SMOKE, Color3.fromRGB(150, 120, 90), 2, 4, 8) end
function handlers.tower(model) burst(model:GetPivot().Position + Vector3.new(0, 6, 0), SPARK, Theme.warning, 1.5, 6, 16) end
function handlers.gather(pos, kind) burst(pos + Vector3.new(0, 2, 0), kind == "wood" and SMOKE or SPARK, kind == "wood" and Color3.fromRGB(150, 110, 70) or Color3.fromRGB(200, 200, 230), 1, 4, 6) end
function handlers.volley(point)
	local ring = part(Vector3.new(0.2, 16, 16), Color3.fromRGB(255, 140, 90), Enum.Material.Neon); ring.Shape = Enum.PartType.Cylinder
	ring.CFrame = CFrame.new(point + Vector3.new(0, 0.3, 0)) * CFrame.Angles(0, 0, math.rad(90)); ring.Transparency = 0.5
	TweenService:Create(ring, TweenInfo.new(0.8), { Transparency = 1 }):Play(); Debris:AddItem(ring, 0.9)
end
function handlers.toast() end -- HUD 가 받는다
Fx.OnClientEvent:Connect(function(kind, ...)
	local h = handlers[kind]
	if h then h(...) end
end)

-- ───────── 박쥐 날개 · 좀비 신음 ─────────
RunService.Stepped:Connect(function(t)
	local angle = math.sin(t * 16) * 0.7
	for _, bat in CollectionService:GetTagged("Bat") do
		for _, m in bat:GetDescendants() do
			if m:IsA("Motor6D") then m.Transform = CFrame.Angles(0, 0, if m.Name:find("Left") then angle else -angle) end
		end
	end
end)
task.spawn(function()
	while true do
		task.wait(4 + math.random() * 4)
		local me = player.Character and player.Character:GetPivot().Position
		if me then
			local near = {}
			for _, e in CollectionService:GetTagged("Enemy") do
				local s = e:FindFirstChild("GroanSound", true)
				if s and (e:GetPivot().Position - me).Magnitude < 50 then table.insert(near, s) end
			end
			if #near > 0 then local s = near[math.random(#near)]; s.Volume = 0.35; s:Play() end
		end
	end
end)
