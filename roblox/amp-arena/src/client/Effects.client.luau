--!nonstrict
-- 연출. 서버 Fx 를 받아 타격 스파크·피해 숫자·가드 불꽃·KO·링아웃·투사체·폭발·줍기·카운트다운·배너·소리를 그린다.
-- 이름표의 체력 막대는 여기서 Humanoid.Health 로 매 프레임 맞춘다. KO 흔들림은 Humanoid.CameraOffset(기본 카메라 유지).
local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local TweenService = game:GetService("TweenService")
local CollectionService = game:GetService("CollectionService")
local Debris = game:GetService("Debris")
local Shared = game:GetService("ReplicatedStorage"):WaitForChild("AmpArena")
local Theme = require(Shared.Theme)
local Fx = Shared:WaitForChild("Remotes"):WaitForChild("Fx")
local player = Players.LocalPlayer

local root = Instance.new("Folder"); root.Name = "ClientFx"; root.Parent = workspace
local SOUNDS = {
	hit = { id = "rbxasset://sounds/action_jump_land.mp3", volume = 0.6, speed = 1.1 },
	launch = { id = "rbxasset://sounds/impact_explosion_03.mp3", volume = 0.35, speed = 1.4 },
	guard = { id = "rbxasset://sounds/volume_slider.ogg", volume = 0.45, speed = 0.7 },
	ko = { id = "rbxasset://sounds/impact_explosion_03.mp3", volume = 0.6, speed = 0.8 },
	explode = { id = "rbxasset://sounds/impact_explosion_03.mp3", volume = 0.7, speed = 0.6 },
	shot = { id = "rbxasset://sounds/action_swim.mp3", volume = 0.3, speed = 2.4 },
	pickup = { id = "rbxasset://sounds/volume_slider.ogg", volume = 0.3, speed = 1.6 },
	count = { id = "rbxasset://sounds/volume_slider.ogg", volume = 0.4, speed = 1.0 },
	dash = { id = "rbxasset://sounds/action_swim.mp3", volume = 0.2, speed = 1.6 },
}
local function playAt(pos, kind)
	local s = SOUNDS[kind]; if not s then return end
	local a = Instance.new("Attachment"); a.WorldPosition = pos; a.Parent = workspace.Terrain
	local sound = Instance.new("Sound"); sound.SoundId = s.id; sound.Volume = s.volume; sound.PlaybackSpeed = s.speed; sound.RollOffMaxDistance = 120
	sound.Parent = a; sound:Play(); Debris:AddItem(a, 3)
end
local function part(size, color, material)
	local p = Instance.new("Part")
	p.Anchored = true; p.CanCollide = false; p.CanQuery = false; p.CanTouch = false; p.CastShadow = false
	p.Size = size; p.Color = color; p.Material = material or Enum.Material.SmoothPlastic; p.Parent = root
	return p
end
local SPARK = "rbxasset://textures/particles/sparkles_main.dds"
local SMOKE = "rbxasset://textures/particles/smoke_main.dds"
local function emitter(parent, texture, color, size, speed, light)
	local e = Instance.new("ParticleEmitter")
	e.Texture = texture; e.Color = ColorSequence.new(color); e.LightEmission = light or 0.8; e.LightInfluence = 0
	e.Size = NumberSequence.new({ NumberSequenceKeypoint.new(0, size), NumberSequenceKeypoint.new(1, 0) })
	e.Transparency = NumberSequence.new({ NumberSequenceKeypoint.new(0, 0.1), NumberSequenceKeypoint.new(1, 1) })
	e.Lifetime = NumberRange.new(0.25, 0.5); e.Speed = NumberRange.new(speed * 0.6, speed); e.SpreadAngle = Vector2.new(180, 180)
	e.Rate = 0; e.Parent = parent
	return e
end
local function burst(pos, texture, color, size, speed, count)
	local p = part(Vector3.new(0.2, 0.2, 0.2), color); p.Transparency = 1; p.Position = pos
	emitter(p, texture, color, size, speed):Emit(count)
	Debris:AddItem(p, 1.2)
end
local function flash(model, color)
	if not model or not model.Parent then return end
	local h = Instance.new("Highlight"); h.FillColor = color or Color3.new(1, 1, 1); h.FillTransparency = 0.35; h.OutlineTransparency = 1; h.Parent = model
	Debris:AddItem(h, 0.08)
end
local function floatingText(pos, text, color, size)
	local p = part(Vector3.new(0.2, 0.2, 0.2), color); p.Transparency = 1; p.Position = pos + Vector3.new((math.random() - 0.5) * 2, 1.5, 0)
	local bill = Instance.new("BillboardGui"); bill.Size = UDim2.fromOffset(100, 36); bill.AlwaysOnTop = true; bill.LightInfluence = 0; bill.Parent = p
	local label = Instance.new("TextLabel"); label.Size = UDim2.fromScale(1, 1); label.BackgroundTransparency = 1
	label.Text = text; label.TextColor3 = color; label.Font = Theme.fontTitle; label.TextSize = size or 24; label.TextStrokeTransparency = 0.3; label.Parent = bill
	TweenService:Create(p, TweenInfo.new(0.7, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), { Position = p.Position + Vector3.new(0, 3.5, 0) }):Play()
	TweenService:Create(label, TweenInfo.new(0.7), { TextTransparency = 1, TextStrokeTransparency = 1 }):Play()
	Debris:AddItem(p, 0.8)
end
local function ring(pos, radius, color, seconds)
	local r = part(Vector3.new(0.3, radius * 2, radius * 2), color, Enum.Material.Neon); r.Shape = Enum.PartType.Cylinder
	r.CFrame = CFrame.new(pos + Vector3.new(0, 0.3, 0)) * CFrame.Angles(0, 0, math.rad(90)); r.Transparency = 0.4
	TweenService:Create(r, TweenInfo.new(seconds or 0.5), { Transparency = 1, Size = Vector3.new(0.3, radius * 2.6, radius * 2.6) }):Play()
	Debris:AddItem(r, (seconds or 0.5) + 0.1)
end

-- 카메라 흔들림: 기본 카메라를 건드리지 않고 Humanoid.CameraOffset 만 잠깐 흔든다
local shakeUntil, shakeAmp = 0, 0
local function shake(amp, seconds) shakeAmp = amp; shakeUntil = os.clock() + seconds end
RunService.RenderStepped:Connect(function()
	local c = player.Character; local hum = c and c:FindFirstChildOfClass("Humanoid")
	if not hum then return end
	if os.clock() < shakeUntil then
		hum.CameraOffset = Vector3.new((math.random() - 0.5) * shakeAmp, (math.random() - 0.5) * shakeAmp, 0)
	elseif hum.CameraOffset ~= Vector3.zero then hum.CameraOffset = Vector3.zero end
end)

-- ───────── 화면 글자 ─────────
local gui = Instance.new("ScreenGui"); gui.Name = "AmpFx"; gui.ResetOnSpawn = false; gui.IgnoreGuiInset = true; gui.Parent = player:WaitForChild("PlayerGui")
local banner = Instance.new("TextLabel"); banner.Size = UDim2.new(1, 0, 0, 90); banner.Position = UDim2.new(0, 0, 0.2, 0); banner.BackgroundTransparency = 1
banner.Font = Theme.fontTitle; banner.TextSize = 64; banner.TextColor3 = Theme.accent; banner.TextStrokeTransparency = 0.2; banner.TextTransparency = 1; banner.Text = ""; banner.Parent = gui
local bannerToken = 0
local function showBanner(text, color, seconds, size)
	bannerToken += 1; local my = bannerToken
	banner.Text = text; banner.TextColor3 = color or Theme.accent; banner.TextSize = size or 64; banner.TextTransparency = 0; banner.TextStrokeTransparency = 0.2
	task.delay(seconds or 1.4, function() if bannerToken == my then TweenService:Create(banner, TweenInfo.new(0.5), { TextTransparency = 1, TextStrokeTransparency = 1 }):Play() end end)
end

-- ───────── 투사체 (예측 렌더) ─────────
local flights = {}
local function projectile(from, dir, speed, range, kind)
	local isRocket = kind == "rocketPunch"
	local b = part(isRocket and Vector3.new(1.4, 1.4, 2.2) or Vector3.new(0.35, 0.35, 1.4), isRocket and Theme.launch or Theme.accent, Enum.Material.Neon)
	b.CFrame = CFrame.lookAt(from, from + dir)
	local a0 = Instance.new("Attachment"); a0.Position = Vector3.new(0, 0, 0.6); a0.Parent = b
	local a1 = Instance.new("Attachment"); a1.Position = Vector3.new(0, 0, -0.6); a1.Parent = b
	local trail = Instance.new("Trail"); trail.Attachment0 = a0; trail.Attachment1 = a1; trail.Lifetime = 0.18; trail.LightEmission = 1; trail.LightInfluence = 0
	trail.Color = ColorSequence.new(b.Color); trail.WidthScale = NumberSequence.new({ NumberSequenceKeypoint.new(0, 1), NumberSequenceKeypoint.new(1, 0) }); trail.Parent = b
	local light = Instance.new("PointLight"); light.Range = 8; light.Brightness = 1.5; light.Color = b.Color; light.Parent = b
	table.insert(flights, { b = b, from = from, dir = dir, speed = speed, range = range, t0 = os.clock() })
	burst(from, SPARK, b.Color, 0.8, 6, 4)
	playAt(from, "shot")
end
RunService.RenderStepped:Connect(function()
	local t = os.clock()
	for i = #flights, 1, -1 do
		local f = flights[i]
		local d = (t - f.t0) * f.speed
		if d >= f.range then table.remove(flights, i); f.b:Destroy()
		else f.b.CFrame = CFrame.lookAt(f.from + f.dir * d, f.from + f.dir * (d + 1)) end
	end
end)

-- ───────── 이름표 체력 막대 ─────────
local tagTimer = 0
RunService.Heartbeat:Connect(function(dt)
	tagTimer += dt
	if tagTimer < 0.1 then return end
	tagTimer = 0
	for _, m in CollectionService:GetTagged("Fighter") do
		local head = m:FindFirstChild("Head"); local tag = head and head:FindFirstChild("AmpTag")
		local hum = m:FindFirstChildOfClass("Humanoid")
		if not tag or not hum then continue end
		local k = hum.MaxHealth > 0 and math.clamp(hum.Health / hum.MaxHealth, 0, 1) or 0
		local bar = tag.Back.Bar
		bar.Size = UDim2.fromScale(k, 1)
		bar.BackgroundColor3 = k > 0.5 and Theme.healing or k > 0.25 and Theme.warning or Theme.danger
		tag.Enabled = m ~= player.Character and hum.Health > 0
	end
end)

-- ───────── 이벤트 ─────────
local handlers = {}
function handlers.hit(pos, amount, model, kind)
	local launch = kind == "launch"
	burst(pos, SPARK, launch and Theme.launch or Theme.hit, launch and 1.4 or 0.9, launch and 12 or 8, launch and 12 or 7)
	floatingText(pos, tostring(math.floor(amount)), launch and Theme.launch or Theme.textPrimary, launch and 30 or 22)
	flash(model)
	playAt(pos, launch and "launch" or "hit")
	if model == player.Character then shake(launch and 0.9 or 0.4, 0.15) end
end
function handlers.guard(pos) burst(pos, SPARK, Theme.guard, 1.0, 8, 8); playAt(pos, "guard") end
function handlers.crush(pos) burst(pos, SMOKE, Theme.guard, 2, 6, 12); floatingText(pos, "가드 크러시", Theme.guard, 20) end
function handlers.grab(pos) burst(pos, SMOKE, Color3.fromRGB(200, 200, 220), 1.2, 4, 6) end
function handlers.throw(pos) burst(pos, SMOKE, Color3.fromRGB(220, 220, 240), 1.6, 8, 10); playAt(pos, "launch") end
function handlers.dash(pos, model) burst(pos, SMOKE, Color3.fromRGB(230, 230, 240), 1.2, 6, 6); if model == player.Character then playAt(pos, "dash") end end
function handlers.ko(pos, victim, attacker)
	burst(pos + Vector3.new(0, 2, 0), SPARK, Theme.accent, 2.4, 16, 28); ring(pos, 6, Theme.accent, 0.6); playAt(pos, "ko")
	if attacker and attacker == player.DisplayName then showBanner("KO!", Theme.accent, 1.2, 72); shake(1.2, 0.25) end
end
function handlers.ringout(pos, victim)
	ring(pos + Vector3.new(0, 20, 0), 8, Theme.danger, 0.8)
	if victim == player.DisplayName then showBanner("링아웃", Theme.danger, 1.2) end
end
function handlers.projectile(from, dir, speed, range, kind) projectile(from, dir, speed, range, kind) end
function handlers.impact(pos, kind) burst(pos, SPARK, kind == "rocketPunch" and Theme.launch or Theme.accent, 1.0, 8, 6) end
function handlers.explode(pos, radius)
	ring(pos, radius, Theme.launch, 0.6); burst(pos, SMOKE, Color3.fromRGB(90, 80, 70), 4, 10, 20); burst(pos, SPARK, Theme.launch, 2.4, 18, 24)
	local light = part(Vector3.new(0.2, 0.2, 0.2), Theme.launch); light.Transparency = 1; light.Position = pos
	local l = Instance.new("PointLight"); l.Range = radius * 2; l.Brightness = 4; l.Color = Theme.launch; l.Parent = light; Debris:AddItem(light, 0.25)
	playAt(pos, "explode"); shake(0.8, 0.2)
end
function handlers.crateHit(pos) burst(pos, SMOKE, Color3.fromRGB(150, 110, 70), 1.0, 5, 5); playAt(pos, "hit") end
function handlers.crateBreak(pos) burst(pos, SMOKE, Color3.fromRGB(150, 110, 70), 2.2, 9, 14); playAt(pos, "launch") end
function handlers.heal(pos, amount, model) burst(pos, SPARK, Theme.healing, 1.2, 6, 10); floatingText(pos, "+" .. tostring(amount), Theme.healing, 22); flash(model, Theme.healing) end
function handlers.pickup(pos) burst(pos, SPARK, Theme.accent, 0.9, 5, 6); playAt(pos, "pickup") end
function handlers.throwItem(pos) burst(pos, SMOKE, Color3.fromRGB(200, 200, 200), 0.8, 4, 4) end
function handlers.pad(pos) ring(pos, 3, Theme.primary, 0.4); burst(pos, SPARK, Theme.primary, 1.0, 10, 8) end
function handlers.countdown(n) showBanner(tostring(n), Theme.textPrimary, 0.9, 96); local c = player.Character; if c then playAt(c:GetPivot().Position, "count") end end
function handlers.fight() showBanner("싸워!", Theme.accent, 1.0, 84) end
function handlers.banner(text) showBanner(text, Theme.textPrimary, 2.2, 40) end
function handlers.feed() end   -- HUD 가 받는다
function handlers.result() end -- HUD 가 받는다
Fx.OnClientEvent:Connect(function(kind, ...)
	local h = handlers[kind]
	if h then h(...) end
end)
