--!nonstrict
-- 절차 포즈. 태그 Fighter 전부의 Attribute(Fight·FightAt·Move·MoveAt·LandedAt·Style) 를 읽어 Poses 의 각도를 Motor6D.Transform 으로 쓴다.
-- RunService.Stepped 는 Animator 가 Transform 을 쓴 뒤라 여기서 쓰면 그 프레임의 걷기·대기 애니메이션을 덮는다.
-- idle 은 스타일 대기 자세를 상체(root·neck·어깨)에만 쓴다 — 다리 관절은 건드리지 않아 기본 걷기 애니메이션이 그대로 돈다.
-- 판정 구간에는 휘두르는 사지(Poses.LIMB)에 스타일 색 궤적(Trail)을 켠다 — 상자 인형의 팔 각도보다 궤적이 「무엇을 휘둘렀나」를 먼저 읽힌다.
-- R6 관절 축은 C0 의 회전(Right Shoulder = Ry(90°)) 때문에 로컬 Z 가 「앞으로 들기」다. R15 는 C0 회전이 없어 로컬 X 가 그 축이다.
local RunService = game:GetService("RunService")
local CollectionService = game:GetService("CollectionService")
local Shared = game:GetService("ReplicatedStorage"):WaitForChild("AmpArena")
local Moves = require(Shared.Moves)
local Poses = require(Shared.Poses)
local Styles = require(Shared.Styles)

local rad = math.rad
local R6 = { root = "RootJoint", neck = "Neck", rs = "Right Shoulder", ls = "Left Shoulder", rh = "Right Hip", lh = "Left Hip" }
local R15 = { root = "Root", neck = "Neck", rs = "RightShoulder", ls = "LeftShoulder", rh = "RightHip", lh = "LeftHip" }
local KEYS = { "root", "neck", "rs", "ls", "rh", "lh" }
-- 궤적을 붙일 부위의 파트 이름과 그 파트 안의 위아래 지점(스터드)
local LIMB_PARTS = {
	R6 = { ra = "Right Arm", la = "Left Arm", rl = "Right Leg", ll = "Left Leg", head = "Head" },
	R15 = { ra = "RightLowerArm", la = "LeftLowerArm", rl = "RightLowerLeg", ll = "LeftLowerLeg", head = "Head" },
}
local TRAIL_AFTER = 0.12 -- 지속이 끝난 뒤에도 잠깐 남겨 짧은 판정(0.04초)도 보이게

local cache = setmetatable({}, { __mode = "k" })
local function joints(model)
	local j = cache[model]
	if j and j.alive then return j end
	local hum = model:FindFirstChildOfClass("Humanoid")
	local r15 = hum and hum.RigType == Enum.HumanoidRigType.R15
	local names = r15 and R15 or R6
	j = { r15 = r15, alive = true, posed = {}, trails = {}, trailOn = {} }
	for key, name in names do
		local m = model:FindFirstChild(name, true)
		if m and m:IsA("Motor6D") then j[key] = m end
	end
	cache[model] = j
	return j
end

local function styleColor(model)
	local st = Styles.get(model:GetAttribute("Style") or "fighter")
	local c = st and st.color or { 255, 255, 255 }
	return Color3.fromRGB(c[1], c[2], c[3])
end
-- 부위 궤적: 파트 위·아래 Attachment 사이에 Trail. 처음 켤 때 만든다.
local function limbTrail(model, j, limb)
	local t = j.trails[limb]
	if t then return t end
	local partName = LIMB_PARTS[j.r15 and "R15" or "R6"][limb]
	local part = partName and model:FindFirstChild(partName, true)
	if not part then return nil end
	local half = part.Size.Y / 2
	local a0 = Instance.new("Attachment"); a0.Name = "AmpTrail0"; a0.Position = Vector3.new(0, half * 0.2, 0); a0.Parent = part
	local a1 = Instance.new("Attachment"); a1.Name = "AmpTrail1"; a1.Position = Vector3.new(0, -half, 0); a1.Parent = part
	local trail = Instance.new("Trail")
	trail.Name = "AmpTrail"; trail.Attachment0 = a0; trail.Attachment1 = a1
	trail.Lifetime = 0.14; trail.MinLength = 0.05; trail.LightEmission = 0.6; trail.FaceCamera = true
	trail.Color = ColorSequence.new(styleColor(model)); trail.Transparency = NumberSequence.new(0.15, 1); trail.WidthScale = NumberSequence.new(1, 0.4)
	trail.Enabled = false; trail.Parent = part
	j.trails[limb] = trail
	return trail
end
local function setTrails(model, j, limb, on)
	local want = {}
	if on and limb then
		if limb == "both" then want.ra = true; want.la = true else want[limb] = true end
	end
	for _, l in { "ra", "la", "rl", "ll", "head" } do
		local isOn = want[l] == true
		if j.trailOn[l] ~= isOn then
			local t = limbTrail(model, j, l)
			if t then t.Enabled = isOn end
			j.trailOn[l] = isOn
		end
	end
end

-- 포즈에 없는 관절(대기 자세의 다리)은 쓰지 않는다 — 그 관절은 Animator 의 값이 남는다.
local function r6(j, p)
	-- RootJoint/Neck 프레임: 로컬 X = 왼쪽, Y = 뒤, Z = 위
	if j.root and p.root then j.root.Transform = CFrame.new(0, -p.root.dz, p.root.dy) * CFrame.Angles(rad(p.root.pitch), rad(-p.root.roll), rad(p.root.yaw)) end
	if j.neck and p.neck then j.neck.Transform = CFrame.Angles(rad(p.neck.pitch), 0, rad(p.neck.yaw)) end
	-- 어깨·엉덩이 프레임: 로컬 Z = 몸통 X(오른쪽), 로컬 X = 앞. Z 회전 = 앞으로 들기(왼쪽은 부호 반대), X 회전 = 벌리기
	if j.rs and p.rs then j.rs.Transform = CFrame.Angles(rad(-p.rs.out), 0, rad(p.rs.fwd)) end
	if j.ls and p.ls then j.ls.Transform = CFrame.Angles(rad(-p.ls.out), 0, rad(-p.ls.fwd)) end
	if j.rh and p.rh then j.rh.Transform = CFrame.Angles(rad(-p.rh.out), 0, rad(p.rh.fwd)) end
	if j.lh and p.lh then j.lh.Transform = CFrame.Angles(rad(-p.lh.out), 0, rad(-p.lh.fwd)) end
end
local function r15(j, p)
	if j.root and p.root then j.root.Transform = CFrame.new(0, p.root.dy, -p.root.dz) * CFrame.Angles(rad(-p.root.pitch), rad(p.root.yaw), rad(p.root.roll)) end
	if j.neck and p.neck then j.neck.Transform = CFrame.Angles(rad(-p.neck.pitch), rad(p.neck.yaw), 0) end
	if j.rs and p.rs then j.rs.Transform = CFrame.Angles(rad(p.rs.fwd), 0, rad(p.rs.out)) end
	if j.ls and p.ls then j.ls.Transform = CFrame.Angles(rad(p.ls.fwd), 0, rad(-p.ls.out)) end
	if j.rh and p.rh then j.rh.Transform = CFrame.Angles(rad(p.rh.fwd), 0, rad(p.rh.out)) end
	if j.lh and p.lh then j.lh.Transform = CFrame.Angles(rad(p.lh.fwd), 0, rad(-p.lh.out)) end
end
-- 지난 프레임에 썼지만 이번 포즈에 없는 관절은 한 번 되돌린다(공격 포즈의 다리가 대기 자세에 남지 않게)
local function settle(j, p)
	for _, key in KEYS do
		local has = p ~= nil and p[key] ~= nil
		if j.posed[key] and not has and j[key] then j[key].Transform = CFrame.identity end
		j.posed[key] = has
	end
end

-- 반환: 포즈, 궤적을 켤 사지(판정 구간일 때만)
local function poseFor(model, t)
	local moveId = model:GetAttribute("Move")
	if moveId and moveId ~= "" then
		local m = Moves.get(moveId)
		if m then
			local at = model:GetAttribute("MoveAt") or t
			local landedAt = model:GetAttribute("LandedAt") or 0
			local dtm = t - at
			local activeEnd = m.untilLand and (landedAt > 0 and (landedAt - at) or math.huge) or (m.startup + m.active)
			local swinging = dtm >= m.startup and dtm < activeEnd + TRAIL_AFTER
			return Poses.forMove(m, dtm, landedAt > 0 and (landedAt - at) or nil), swinging and Poses.LIMB[m.pose] or nil
		end
	end
	local state = model:GetAttribute("Fight") or "idle"
	if state == "idle" then return Poses.forStance(model:GetAttribute("Style")), nil end
	return Poses.forState(state, t - (model:GetAttribute("FightAt") or t)), nil
end

RunService.Stepped:Connect(function()
	local t = workspace:GetServerTimeNow()
	for _, model in CollectionService:GetTagged("Fighter") do
		if not model.Parent then continue end
		local j = joints(model)
		local p, limb = poseFor(model, t)
		if p then
			if j.r15 then r15(j, p) else r6(j, p) end
		end
		settle(j, p)
		setTrails(model, j, limb, limb ~= nil)
	end
end)
