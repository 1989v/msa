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
-- R6(클래식 Zombie·BlockRig)은 Roblox 기본 R6 Animate 의 ID. 재생 여부는 Studio 에서 확인한다.
local R6_ANIM = { idle = "rbxassetid://180435571", walk = "rbxassetid://180426354" }
local r15Anim = nil

local function readR15Anim(character)
	local animate = character:FindFirstChild("Animate")
	if not animate then return end
	local idle = animate:FindFirstChild("idle") and animate.idle:FindFirstChild("Animation1")
	local walk = animate:FindFirstChild("walk") and animate.walk:FindFirstChild("WalkAnim")
	if idle and walk then r15Anim = { idle = idle.AnimationId, walk = walk.AnimationId } end
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

local ALLY_LOOK = {
	archer = { head = Color3.fromRGB(204, 160, 120), torso = Color3.fromRGB(70, 96, 58), arms = Color3.fromRGB(204, 160, 120), legs = Color3.fromRGB(72, 58, 44) },
	longbow = { head = Color3.fromRGB(204, 160, 120), torso = Color3.fromRGB(44, 62, 102), arms = Color3.fromRGB(204, 160, 120), legs = Color3.fromRGB(40, 40, 52) },
	hero = { head = Color3.fromRGB(204, 160, 120), torso = Color3.fromRGB(150, 44, 40), arms = Color3.fromRGB(190, 150, 110), legs = Color3.fromRGB(54, 44, 40) },
	carpenter = { head = Color3.fromRGB(204, 160, 120), torso = Color3.fromRGB(140, 98, 60), arms = Color3.fromRGB(204, 160, 120), legs = Color3.fromRGB(96, 80, 64) },
}

function Rigs.makeAlly(kind)
	Rigs.ready()
	local unit = Config.UNITS[kind]
	local model = allyTemplate:Clone()
	model.Name = kind
	local look = ALLY_LOOK[kind]
	setBodyColors(model, look.head, look.torso, look.arms, look.legs)
	local hum = prepareHumanoid(model, unit.walkSpeed, unit.maxHealth, unit.label)
	if kind == "hero" then pcall(function() model:ScaleTo(1.12) end) end
	local root = model:FindFirstChild("HumanoidRootPart")
	addLight(root, 12, 0.7, Theme.torch)
	if unit.combat then attachBow(model) end
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
	if kind == "plague" then
		setBodyColors(model, Color3.fromRGB(150, 190, 90), Color3.fromRGB(96, 130, 60), Color3.fromRGB(150, 190, 90), Color3.fromRGB(70, 90, 50))
		local glow = Instance.new("Highlight")
		glow.FillColor = Theme.plague; glow.FillTransparency = 0.75; glow.OutlineTransparency = 1
		glow.Parent = model
	elseif kind == "brute" then
		setBodyColors(model, Color3.fromRGB(120, 70, 60), Color3.fromRGB(80, 40, 40), Color3.fromRGB(120, 70, 60), Color3.fromRGB(50, 30, 30))
		pcall(function() model:ScaleTo(1.45) end)
	end
	local hum = prepareHumanoid(model, def.walkSpeed, def.maxHealth, def.label)
	CollectionService:AddTag(model, "Enemy")
	model:SetAttribute("Kind", kind)
	return model, hum, model:FindFirstChild("HumanoidRootPart")
end

-- 플레이어 아바타 = 원정대 선두 활잡이. 걷기·카메라는 Roblox 기본, 점프 없음(JumpPower 0 이면 기본 터치 점프 버튼이 숨는다).
function Rigs.setupPlayer(character)
	local hum = character:WaitForChild("Humanoid")
	hum.WalkSpeed = Config.PLAYER.walkSpeed
	hum.MaxHealth = Config.PLAYER.maxHealth
	hum.Health = Config.PLAYER.maxHealth
	hum.UseJumpPower = true
	hum.JumpPower = 0
	hum.DisplayName = "활잡이 " .. (Players:GetPlayerFromCharacter(character) and Players:GetPlayerFromCharacter(character).DisplayName or "")
	local root = character:WaitForChild("HumanoidRootPart")
	addLight(root, Config.PLAYER.lightRange, Config.PLAYER.lightBrightness, Theme.torch)
	task.defer(attachBow, character)
	return hum, root
end

-- 걷기/대기 애니메이션. Animator 트랙을 모델마다 한 번만 만든다.
local tracks = setmetatable({}, { __mode = "k" })
function Rigs.animate(model, hum, moving)
	if not hum then return end
	local set = tracks[model]
	if not set then
		local animator = hum:FindFirstChildOfClass("Animator") or Instance.new("Animator", hum)
		local ids = if hum.RigType == Enum.HumanoidRigType.R15 then r15Anim else R6_ANIM
		if not ids then return end
		set = {}
		for name, id in ids do
			local anim = Instance.new("Animation"); anim.AnimationId = id
			local ok, track = pcall(function() return animator:LoadAnimation(anim) end)
			if ok then track.Looped = true; set[name] = track end
		end
		tracks[model] = set
	end
	local want = if moving then "walk" else "idle"
	for name, track in set do
		if name == want then if not track.IsPlaying then track:Play(0.15) end
		elseif track.IsPlaying then track:Stop(0.15) end
	end
end

return Rigs
