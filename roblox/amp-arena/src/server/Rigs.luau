--!nonstrict
-- 캐릭터 설정. 플레이어는 자기 아바타(R6)를 그대로 쓰고 스타일 몸집·액세서리·팀 외곽선·이름표를 서버가 붙인다. 봇은 빌더가 넣은 BlockRig(R6).
local Players = game:GetService("Players")
local ServerStorage = game:GetService("ServerStorage")
local CollectionService = game:GetService("CollectionService")
local Shared = game:GetService("ReplicatedStorage"):WaitForChild("AmpArena")
local Config = require(Shared.Config)
local Styles = require(Shared.Styles)
local Accessories = require(Shared.Accessories)
local Rules = require(Shared.Rules)
local Theme = require(Shared.Theme)
local Assets = ServerStorage:WaitForChild("AmpAssets")

local Rigs = {}

local function rgb(t) return Color3.fromRGB(t[1], t[2], t[3]) end
local function teamColor(team) return if team == 1 then Theme.red elseif team == 2 then Theme.blue else Theme.accent end

-- R6/R15 손 파트
function Rigs.hand(model, side)
	if side == "left" then return model:FindFirstChild("Left Arm") or model:FindFirstChild("LeftHand") end
	return model:FindFirstChild("Right Arm") or model:FindFirstChild("RightHand")
end

-- 액세서리 모델을 손에 건다. 기존 것은 뗀다.
function Rigs.attachAccessory(model, accId, scale)
	scale = scale or 1
	local old = model:FindFirstChild("Accessory")
	if old then old:Destroy() end
	local def = Accessories.get(accId)
	if not def or not def.grip then return end
	local template = Assets.Accessories:FindFirstChild(accId)
	local hand = Rigs.hand(model, def.grip.hand)
	if not template or not hand then return end
	local acc = template:Clone()
	acc.Name = "Accessory"
	for _, p in acc:GetDescendants() do if p:IsA("BasePart") then p.Anchored = false; p.CanCollide = false; p.CanQuery = false; p.CanTouch = false; p.Massless = true end end
	if scale ~= 1 then pcall(function() acc:ScaleTo(scale) end) end
	local weld = Instance.new("Weld")
	weld.Name = "Grip"; weld.Part0 = hand; weld.Part1 = acc.PrimaryPart
	local o, r = def.grip.offset, def.grip.rot
	weld.C0 = CFrame.new(o[1] * scale, o[2] * scale, o[3] * scale) * CFrame.Angles(math.rad(r[1]), math.rad(r[2]), math.rad(r[3]))
	weld.Parent = acc.PrimaryPart
	acc.Parent = model
	return acc
end

-- 머리 위 이름표: 이름 + 체력 막대 + 팀 테두리. 막대 길이는 클라이언트가 Humanoid.Health 로 매 프레임 맞춘다.
local function nameTag(model, label, team)
	local head = model:FindFirstChild("Head")
	if not head then return end
	local old = head:FindFirstChild("AmpTag"); if old then old:Destroy() end
	local gui = Instance.new("BillboardGui")
	gui.Name = "AmpTag"; gui.Size = UDim2.fromOffset(120, 34); gui.StudsOffset = Vector3.new(0, 2.6, 0); gui.AlwaysOnTop = false; gui.MaxDistance = 110; gui.LightInfluence = 0
	local name = Instance.new("TextLabel")
	name.Name = "Name"; name.Size = UDim2.new(1, 0, 0, 18); name.BackgroundTransparency = 1; name.Text = label; name.Font = Theme.font; name.TextSize = 14
	name.TextColor3 = Theme.textPrimary; name.TextStrokeTransparency = 0.3; name.TextStrokeColor3 = teamColor(team); name.Parent = gui
	local back = Instance.new("Frame")
	back.Name = "Back"; back.Size = UDim2.new(0.8, 0, 0, 6); back.Position = UDim2.new(0.1, 0, 0, 22); back.BackgroundColor3 = Theme.surface0; back.BorderSizePixel = 0; back.Parent = gui
	local stroke = Instance.new("UIStroke"); stroke.Color = teamColor(team); stroke.Thickness = 1.5; stroke.Parent = back
	local bar = Instance.new("Frame")
	bar.Name = "Bar"; bar.Size = UDim2.fromScale(1, 1); bar.BackgroundColor3 = Theme.healing; bar.BorderSizePixel = 0; bar.Parent = back
	gui.Parent = head
end

local function teamOutline(model, team)
	local old = model:FindFirstChild("TeamOutline"); if old then old:Destroy() end
	if not team then return end
	local h = Instance.new("Highlight")
	h.Name = "TeamOutline"; h.FillTransparency = 1; h.OutlineColor = teamColor(team); h.OutlineTransparency = 0.1; h.DepthMode = Enum.HighlightDepthMode.Occluded
	h.Parent = model
end

-- 공통: 체력·이동·점프·몸집·태그·속성. 전투 상태 속성은 Combat 이 쓴다.
function Rigs.prepare(model, loadout, team, label, isBot)
	local hum = model:FindFirstChildOfClass("Humanoid")
	local root = model:FindFirstChild("HumanoidRootPart")
	if not hum or not root then return nil end
	local style = Styles.get(loadout.style)
	local stats = Rules.statsFor(loadout.style)
	hum.MaxHealth = Rules.maxHealth(stats)
	hum.Health = hum.MaxHealth
	hum.WalkSpeed = Rules.walkSpeed(loadout.style, loadout.accessory)
	hum.UseJumpPower = true
	hum.JumpPower = Rules.jumpPower(stats.jmp)
	hum.AutoRotate = true
	hum.BreakJointsOnDeath = false -- 죽어도 관절·Grip Weld 를 남겨 dead 포즈와 액세서리가 보인다(시체는 리스폰·라운드 전환이 치운다)
	hum.HealthDisplayType = Enum.HumanoidHealthDisplayType.AlwaysOff
	hum.NameDisplayDistance = 0
	hum.HealthDisplayDistance = 0
	hum.DisplayName = label
	for _, state in { Enum.HumanoidStateType.Ragdoll, Enum.HumanoidStateType.FallingDown, Enum.HumanoidStateType.Seated, Enum.HumanoidStateType.Swimming, Enum.HumanoidStateType.Climbing } do
		pcall(function() hum:SetStateEnabled(state, false) end)
	end
	-- ScaleTo 는 절댓값: 로비에서 헤비(1.18)→파이터(1.0)로 바꿔도 돌아오게 현재 배율과 다를 때 매번 맞춘다
	local ok, cur = pcall(function() return model:GetScale() end)
	if not ok or math.abs(cur - style.scale) > 1e-3 then pcall(function() model:ScaleTo(style.scale) end) end
	Rigs.attachAccessory(model, loadout.accessory, style.scale)
	nameTag(model, label, team)
	teamOutline(model, team)
	model:SetAttribute("Style", loadout.style)
	model:SetAttribute("Accessory", loadout.accessory)
	model:SetAttribute("Team", team or 0)
	model:SetAttribute("Bot", isBot == true)
	model:SetAttribute("Fight", "idle")
	model:SetAttribute("FightAt", workspace:GetServerTimeNow())
	model:SetAttribute("Move", "")
	model:SetAttribute("MoveAt", 0)
	model:SetAttribute("Guard", Config.GUARD.max)
	CollectionService:AddTag(model, "Fighter")
	return hum, root, stats
end

-- 봇 리그. 빌더의 BlockRig(R6) 에 스타일 색을 칠한다. 서버 소유 물리.
function Rigs.makeBot(loadout, name)
	local model = Assets.BlockRig:Clone()
	model.Name = name
	local style = Styles.get(loadout.style)
	local colors = model:FindFirstChildOfClass("BodyColors") or Instance.new("BodyColors", model)
	colors.TorsoColor3 = rgb(style.color)
	colors.LeftArmColor3 = Color3.fromRGB(204, 160, 120); colors.RightArmColor3 = Color3.fromRGB(204, 160, 120)
	colors.HeadColor3 = Color3.fromRGB(204, 160, 120)
	colors.LeftLegColor3 = Color3.fromRGB(52, 56, 72); colors.RightLegColor3 = Color3.fromRGB(52, 56, 72)
	for _, p in model:GetDescendants() do if p:IsA("BasePart") then p.Anchored = false end end
	return model
end

-- 봇 걷기/대기 애니메이션(Roblox 기본 R6 ID). 플레이어 캐릭터는 자기 Animate 가 한다.
local R6_ANIM = { idle = "rbxassetid://180435571", walk = "rbxassetid://180426354" }
local tracks = setmetatable({}, { __mode = "k" })
function Rigs.animate(model, hum, moving)
	local set = tracks[model]
	if not set then
		set = {}
		local animator = hum:FindFirstChildOfClass("Animator") or Instance.new("Animator", hum)
		for name, id in R6_ANIM do
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

-- 리스폰 무적 표시: Roblox 기본 ForceField(피해 판정은 Combat 이 따로 본다).
function Rigs.spawnShield(model, seconds)
	local ff = Instance.new("ForceField"); ff.Visible = true; ff.Parent = model
	task.delay(seconds, function() if ff.Parent then ff:Destroy() end end)
end

function Rigs.teamColor(team) return teamColor(team) end
function Rigs.styleColor(styleId) return rgb(Styles.get(styleId).color) end

return Rigs
