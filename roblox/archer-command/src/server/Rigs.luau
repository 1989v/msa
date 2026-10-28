--!nonstrict
-- 캐릭터 리그. 아군은 아바타 체계(HumanoidDescription → R15)로 만들고, 적은 Roblox 소유 클래식 Zombie/Bat 모델을 쓴다.
-- 네트워크가 없어 아바타 생성이 실패하면 빌더가 넣어 둔 BlockRig(R6)로 대신한다.
local Players = game:GetService("Players")
local ServerStorage = game:GetService("ServerStorage")
local CollectionService = game:GetService("CollectionService")
local Shared = game:GetService("ReplicatedStorage"):WaitForChild("ArcherCommand")
local Config = require(Shared.Config)
local Theme = require(Shared.Theme)
local Assets = ServerStorage:WaitForChild("ArcherAssets")

local Rigs = {}

-- 애니메이션 ID. R15 는 첫 플레이어 캐릭터의 Animate 스크립트에서 읽는다(아바타 기본값과 같은 것을 쓰기 위해).
-- R6(클래식 Zombie·BlockRig)은 Roblox 기본 R6 Animate 의 ID. 공격은 기본 도구 휘두르기(toolslash)를 쓴다 — 활 당기기 전용 애니메이션은 Roblox 소유에 없다.
local R6_ANIM = { idle = "rbxassetid://180435571", walk = "rbxassetid://180426354", attack = "rbxassetid://129967390" }
local R15_ATTACK_FALLBACK = "rbxassetid://522635514"
local r15Anim = nil

local function readR15Anim(character)
	local animate = character:FindFirstChild("Animate")
	if not animate then return end
	local idle = animate:FindFirstChild("idle") and animate.idle:FindFirstChild("Animation1")
	local walk = animate:FindFirstChild("walk") and animate.walk:FindFirstChild("WalkAnim")
	local slash = animate:FindFirstChild("toolslash") and animate.toolslash:FindFirstChild("ToolSlashAnim")
	if idle and walk then r15Anim = { idle = idle.AnimationId, walk = walk.AnimationId, attack = slash and slash.AnimationId or R15_ATTACK_FALLBACK } end
end
Players.PlayerAdded:Connect(function(player)
	player.CharacterAdded:Connect(function(character)
		if not r15Anim then task.delay(1, function() if character.Parent then readR15Anim(character) end end) end
	end)
end)

local allyTemplate = nil
local function buildAllyTemplate()
	local ok, model = pcall(function()
		local description = Instance.new("HumanoidDescription")
		return Players:CreateHumanoidModelFromDescriptionAsync(description, Enum.HumanoidRigType.R15, Enum.AssetTypeVerification.Always)
	end)
	if ok and model then
		model.Name = "Ally"
		return model, "avatar"
	end
	warn("[ArcherCommand] 아바타 생성 실패, BlockRig 로 대체: " .. tostring(model))
	return Assets.BlockRig:Clone(), "block"
end

function Rigs.ready()
	if not allyTemplate then
		local model, source = buildAllyTemplate()
		model.Parent = Assets
		allyTemplate = model
		Rigs.allySource = source
	end
end

local function setBodyColors(model, head, torso, arms, legs)
	local colors = model:FindFirstChildOfClass("BodyColors") or Instance.new("BodyColors", model)
	colors.HeadColor3 = head; colors.TorsoColor3 = torso
	colors.LeftArmColor3 = arms; colors.RightArmColor3 = arms
	colors.LeftLegColor3 = legs; colors.RightLegColor3 = legs
	colors.Parent = model
end

local function prepareHumanoid(model, walkSpeed, maxHealth, label)
	local hum = model:FindFirstChildOfClass("Humanoid")
	hum.WalkSpeed = walkSpeed
	hum.MaxHealth = maxHealth
	hum.Health = maxHealth
	hum.DisplayName = label
	hum.NameDisplayDistance = 50
	hum.HealthDisplayDistance = 60
	hum.HealthDisplayType = Enum.HumanoidHealthDisplayType.DisplayWhenDamaged
	hum.BreakJointsOnDeath = false
	hum.AutoRotate = true
	for _, state in { Enum.HumanoidStateType.Ragdoll, Enum.HumanoidStateType.FallingDown, Enum.HumanoidStateType.Seated, Enum.HumanoidStateType.PlatformStanding, Enum.HumanoidStateType.Swimming, Enum.HumanoidStateType.Climbing, Enum.HumanoidStateType.Flying } do
		hum:SetStateEnabled(state, false)
	end
	for _, part in model:GetDescendants() do
		if part:IsA("BasePart") then part.CastShadow = false; part.CollisionGroup = "Npc" end
	end
	return hum
end

local function addLight(root, range, brightness, color)
	local light = Instance.new("PointLight")
	light.Range = range; light.Brightness = brightness; light.Color = color; light.Shadows = false
	light.Parent = root
	return light
end

-- 활을 손에 건다. R15 는 LeftHand, R6 는 Left Arm.
local function attachBow(model)
	local hand = model:FindFirstChild("LeftHand") or model:FindFirstChild("Left Arm")
	if not hand then return end
	local bow = Assets.Bow:Clone()
	local weld = Instance.new("Weld")
	weld.Part0 = hand; weld.Part1 = bow.PrimaryPart
	weld.C0 = CFrame.new(0, -0.4, 0) * CFrame.Angles(0, math.rad(90), 0)
	weld.Parent = bow.PrimaryPart
	for _, p in bow:GetDescendants() do if p:IsA("BasePart") then p.Anchored = false; p.CanCollide = false; p.Massless = true end end
	bow.Parent = model
end

local SKIN = Color3.fromRGB(204, 160, 120)
local ALLY_LOOK = {
	archer = { torso = Color3.fromRGB(70, 96, 58), legs = Color3.fromRGB(72, 58, 44) },
	veteran = { torso = Color3.fromRGB(96, 128, 64), legs = Color3.fromRGB(60, 50, 40), trim = Theme.warning },
	hero = { torso = Color3.fromRGB(150, 44, 40), legs = Color3.fromRGB(54, 44, 40), trim = Color3.fromRGB(255, 140, 90) },
	longbow = { torso = Color3.fromRGB(44, 62, 102), legs = Color3.fromRGB(40, 40, 52) },
	marksman = { torso = Color3.fromRGB(60, 90, 150), legs = Color3.fromRGB(30, 30, 44), trim = Color3.fromRGB(190, 220, 255) },
	shield = { torso = Color3.fromRGB(110, 110, 118), legs = Color3.fromRGB(70, 70, 80) },
	heavy = { torso = Color3.fromRGB(80, 80, 92), legs = Color3.fromRGB(50, 50, 60), trim = Color3.fromRGB(200, 200, 215) },
	crossbow = { torso = Color3.fromRGB(120, 80, 50), legs = Color3.fromRGB(60, 44, 34) },
	carpenter = { torso = Color3.fromRGB(140, 98, 60), legs = Color3.fromRGB(96, 80, 64) },
}

-- 근접 용병은 활 대신 검과 방패. 템플릿 없이 파트 둘을 손·팔에 건다.
local function weldTo(part, limb, offset)
	local weld = Instance.new("Weld"); weld.Part0 = limb; weld.Part1 = part; weld.C0 = offset; weld.Parent = part
	part.Anchored = false; part.CanCollide = false; part.Massless = true; part.CastShadow = false
end
local function attachMeleeGear(model, trim)
	local right = model:FindFirstChild("RightHand") or model:FindFirstChild("Right Arm")
	local left = model:FindFirstChild("LeftLowerArm") or model:FindFirstChild("Left Arm")
	if right then
		local sword = Instance.new("Part"); sword.Name = "Sword"; sword.Size = Vector3.new(0.25, 3.2, 0.5); sword.Color = Color3.fromRGB(200, 205, 215); sword.Material = Enum.Material.Metal
		weldTo(sword, right, CFrame.new(0, -1.2, 0) * CFrame.Angles(math.rad(90), 0, 0)); sword.Parent = model
	end
	if left then
		local shield = Instance.new("Part"); shield.Name = "Shield"; shield.Size = Vector3.new(2.2, 2.6, 0.25); shield.Color = trim or Color3.fromRGB(120, 60, 40); shield.Material = Enum.Material.WoodPlanks
		weldTo(shield, left, CFrame.new(-0.6, 0, 0) * CFrame.Angles(0, math.rad(90), 0)); shield.Parent = model
	end
end

-- 상위 병종은 어깨 장식(Neon 띠)으로 구분한다.
local function addTrim(model, color)
	local torso = model:FindFirstChild("UpperTorso") or model:FindFirstChild("Torso")
	if not torso then return end
	local band = Instance.new("Part"); band.Name = "Trim"; band.Size = Vector3.new(torso.Size.X + 0.3, 0.35, torso.Size.Z + 0.3); band.Color = color; band.Material = Enum.Material.Neon
	weldTo(band, torso, CFrame.new(0, torso.Size.Y * 0.35, 0)); band.Parent = model
end

function Rigs.makeAlly(kind)
	Rigs.ready()
	local unit = Config.UNITS[kind]
	local model = allyTemplate:Clone()
	model.Name = kind
	local look = ALLY_LOOK[kind]
	setBodyColors(model, SKIN, look.torso, SKIN, look.legs)
	local hum = prepareHumanoid(model, unit.walkSpeed, unit.maxHealth, unit.label)
	if unit.scale then pcall(function() model:ScaleTo(unit.scale) end) end
	local root = model:FindFirstChild("HumanoidRootPart")
	addLight(root, 12, 0.7, Theme.torch)
	if unit.melee then attachMeleeGear(model, look.trim) elseif unit.combat then attachBow(model) end
	if look.trim then addTrim(model, look.trim) end
	CollectionService:AddTag(model, "Ally")
	model:SetAttribute("Kind", kind)
	return model, hum, root
end

function Rigs.makeEnemy(kind)
	local def = Config.ENEMIES[kind]
	if kind == "bat" then
		local model = Assets.Bat:Clone()
		model.Name = "bat"
		-- 몸통만 고정하고 날개는 Motor6D 로 따라오게 둔다(클라이언트가 날갯짓을 돌린다)
		for _, p in model:GetDescendants() do if p:IsA("BasePart") then p.Anchored = (p == model.PrimaryPart); p.CanCollide = false; p.CastShadow = false end end
		model:SetAttribute("Health", def.maxHealth); model:SetAttribute("MaxHealth", def.maxHealth)
		CollectionService:AddTag(model, "Enemy"); CollectionService:AddTag(model, "Bat")
		model:SetAttribute("Kind", kind)
		return model, nil, model.PrimaryPart
	end
	local model = Assets.Zombie:Clone()
	model.Name = kind
	local function glow(color, fill)
		local h = Instance.new("Highlight"); h.FillColor = color; h.FillTransparency = fill or 0.75; h.OutlineTransparency = 1; h.Parent = model
	end
	if kind == "plague" then
		setBodyColors(model, Color3.fromRGB(150, 190, 90), Color3.fromRGB(96, 130, 60), Color3.fromRGB(150, 190, 90), Color3.fromRGB(70, 90, 50))
		glow(Theme.plague)
	elseif kind == "runner" then
		setBodyColors(model, Color3.fromRGB(90, 96, 100), Color3.fromRGB(60, 62, 70), Color3.fromRGB(90, 96, 100), Color3.fromRGB(40, 40, 48))
	elseif kind == "bomber" then
		setBodyColors(model, Color3.fromRGB(230, 120, 50), Color3.fromRGB(180, 70, 30), Color3.fromRGB(230, 120, 50), Color3.fromRGB(90, 40, 20))
		local torso = model:FindFirstChild("Torso")
		if torso then
			local fire = Instance.new("Fire"); fire.Size = 3; fire.Heat = 6; fire.Color = Color3.fromRGB(255, 140, 40); fire.SecondaryColor = Color3.fromRGB(255, 60, 20); fire.Parent = torso
			addLight(torso, 10, 1.0, Color3.fromRGB(255, 120, 40))
		end
	elseif kind == "armored" then
		setBodyColors(model, Color3.fromRGB(120, 124, 132), Color3.fromRGB(70, 74, 84), Color3.fromRGB(120, 124, 132), Color3.fromRGB(50, 52, 60))
		glow(Color3.fromRGB(200, 205, 215), 0.85)
		for _, name in { "Torso", "Head" } do
			local part = model:FindFirstChild(name)
			if part then part.Material = Enum.Material.Metal; part.Color = Color3.fromRGB(110, 114, 124) end
		end
	elseif kind == "brute" then
		setBodyColors(model, Color3.fromRGB(120, 70, 60), Color3.fromRGB(80, 40, 40), Color3.fromRGB(120, 70, 60), Color3.fromRGB(50, 30, 30))
		glow(Theme.enemy, 0.8)
		addLight(model:FindFirstChild("Torso") or model:FindFirstChild("Head"), 16, 1.2, Theme.enemy)
	end
	-- 같은 모델이라도 크기를 조금씩 다르게(모양 변주). 보스·철갑·질주는 고유 배율.
	local scale = (def.scale or 1) * (1 + Config.SWARM.scaleJitter * (math.random() * 2 - 1))
	pcall(function() model:ScaleTo(scale) end)
	local hum = prepareHumanoid(model, def.walkSpeed, def.maxHealth, def.label)
	if def.boss then
		-- 보스 체력바: 머리 위에 항상 보인다(일반 적은 맞았을 때만 기본 체력바).
		hum.HealthDisplayType = Enum.HumanoidHealthDisplayType.AlwaysOff
		hum.NameDisplayDistance = 160
		local head = model:FindFirstChild("Head")
		if head then
			local bar = Instance.new("BillboardGui"); bar.Name = "BossBar"; bar.Size = UDim2.fromOffset(180, 16); bar.StudsOffset = Vector3.new(0, 4.5, 0); bar.MaxDistance = 160; bar.AlwaysOnTop = true
			local back = Instance.new("Frame"); back.Size = UDim2.fromScale(1, 1); back.BackgroundColor3 = Color3.fromRGB(30, 20, 20); back.BorderSizePixel = 0; back.Parent = bar
			local fill = Instance.new("Frame"); fill.Name = "Fill"; fill.Size = UDim2.fromScale(1, 1); fill.BackgroundColor3 = Theme.enemy; fill.BorderSizePixel = 0; fill.Parent = back
			bar.Parent = head
			hum.HealthChanged:Connect(function(h) fill.Size = UDim2.fromScale(math.clamp(h / hum.MaxHealth, 0, 1), 1) end)
		end
		CollectionService:AddTag(model, "Boss")
	end
	CollectionService:AddTag(model, "Enemy")
	model:SetAttribute("Kind", kind)
	return model, hum, model:FindFirstChild("HumanoidRootPart")
end

-- 플레이어 아바타 = 원정대 선두 활잡이. 걷기·점프·카메라는 Roblox 기본(기본 터치 점프 버튼 그대로).
function Rigs.setupPlayer(character)
	local hum = character:WaitForChild("Humanoid")
	hum.WalkSpeed = Config.PLAYER.walkSpeed
	hum.MaxHealth = Config.PLAYER.maxHealth
	hum.Health = Config.PLAYER.maxHealth
	hum.UseJumpPower = true
	hum.JumpPower = Config.PLAYER.jumpPower
	hum.DisplayName = "활잡이 " .. (Players:GetPlayerFromCharacter(character) and Players:GetPlayerFromCharacter(character).DisplayName or "")
	local root = character:WaitForChild("HumanoidRootPart")
	addLight(root, Config.PLAYER.lightRange, Config.PLAYER.lightBrightness, Theme.torch)
	task.defer(attachBow, character)
	return hum, root
end

-- 걷기/대기/공격 애니메이션. Animator 트랙을 모델마다 한 번만 만든다. 공격은 Action 우선순위라 걷기 위에 겹쳐 보인다.
local tracks = setmetatable({}, { __mode = "k" })
local function ensureTracks(model, hum)
	local set = tracks[model]
	if set then return set end
	local animator = hum:FindFirstChildOfClass("Animator") or Instance.new("Animator", hum)
	local ids = if hum.RigType == Enum.HumanoidRigType.R15 then r15Anim else R6_ANIM
	if not ids then return nil end
	set = {}
	for name, id in ids do
		local anim = Instance.new("Animation"); anim.AnimationId = id
		local ok, track = pcall(function() return animator:LoadAnimation(anim) end)
		if ok then
			track.Looped = name ~= "attack"
			if name == "attack" then track.Priority = Enum.AnimationPriority.Action end
			set[name] = track
		end
	end
	tracks[model] = set
	return set
end

function Rigs.animate(model, hum, moving)
	if not hum then return end
	local set = ensureTracks(model, hum)
	if not set then return end
	local want = if moving then "walk" else "idle"
	for name, track in set do
		if name == "attack" then continue end
		if name == want then if not track.IsPlaying then track:Play(0.15) end
		elseif track.IsPlaying then track:Stop(0.15) end
	end
end

-- 공격 모션 한 번(활 쏘기·좀비 휘두르기). 서버 NPC 용. 플레이어 자신은 클라이언트가 같은 ID 로 재생한다.
function Rigs.attack(model, hum)
	if not hum or hum.Health <= 0 then return end
	local set = ensureTracks(model, hum)
	local track = set and set.attack
	if not track then return end
	if track.IsPlaying then track:Stop(0) end
	track:Play(0.05)
end

-- 치료사 NPC. 본진 북동쪽 제단 위에 서서 움직이지 않는다. 이름표·초록 광원·회복 파티클로 누가 치료사인지 보인다.
function Rigs.makeHealer()
	Rigs.ready()
	local model = allyTemplate:Clone()
	model.Name = "Healer"
	setBodyColors(model, Color3.fromRGB(204, 160, 120), Color3.fromRGB(236, 240, 232), Color3.fromRGB(204, 160, 120), Color3.fromRGB(96, 150, 120))
	local hum = prepareHumanoid(model, 0, 1000, "치료사")
	hum.NameDisplayDistance = 120
	hum.HealthDisplayType = Enum.HumanoidHealthDisplayType.AlwaysOff
	local root = model:FindFirstChild("HumanoidRootPart")
	root.Anchored = true
	addLight(root, 20, 1.2, Theme.healing)
	local aura = Instance.new("ParticleEmitter")
	aura.Texture = "rbxasset://textures/particles/sparkles_main.dds"; aura.Color = ColorSequence.new(Theme.healing)
	aura.LightEmission = 0.9; aura.LightInfluence = 0; aura.Rate = 3; aura.Lifetime = NumberRange.new(0.8, 1.4); aura.Speed = NumberRange.new(2, 4)
	aura.Size = NumberSequence.new({ NumberSequenceKeypoint.new(0, 0.6), NumberSequenceKeypoint.new(1, 0) }); aura.SpreadAngle = Vector2.new(60, 60)
	aura.Name = "Aura"; aura.Parent = root
	local head = model:FindFirstChild("Head")
	if head then
		local sign = Instance.new("BillboardGui")
		sign.Name = "Sign"; sign.Size = UDim2.fromOffset(200, 44); sign.StudsOffset = Vector3.new(0, 3.2, 0); sign.AlwaysOnTop = false; sign.MaxDistance = 90
		local text = Instance.new("TextLabel")
		text.Size = UDim2.fromScale(1, 1); text.BackgroundTransparency = 1; text.Text = "치료사 · 곁에 서면 빨리 낫는다"
		text.Font = Theme.font; text.TextSize = 16; text.TextColor3 = Theme.healing; text.TextStrokeTransparency = 0.4; text.Parent = sign
		sign.Parent = head
	end
	CollectionService:AddTag(model, "Healer")
	return model, hum, root
end

return Rigs
