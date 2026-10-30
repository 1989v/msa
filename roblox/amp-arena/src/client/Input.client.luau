--!nonstrict
-- 입력. 이동·점프·카메라는 Roblox 기본. 게임 동작만 ContextActionService 로 묶는다 — 터치 기기엔 버튼(제목은 동작 이름), 게임패드도 같은 줄.
-- 자판은 혼자 플레이(왼손 WASD + 오른손 공격키) 기준 — 약공 Z · 강공 X · 가드 C(홀드) · 기술 V · 대시 Shift · 줍기 F(아이템의 ProximityPrompt) · 점프 Space.
-- 마우스는 카메라(오른쪽 드래그)만 — 공격을 마우스에 두면 로비 버튼 클릭이 공격이 되고, 오른쪽 클릭은 카메라 회전과 겹친다.
-- Shift 를 대시로 쓰므로 빌더가 StarterPlayer.EnableMouseLockOption 을 끈다(쉬프트락 토글과 겹치지 않게). 키 이름은 화면에 적지 않는다.
-- 공격 전에 정면 ±60° 가장 가까운 적을 향해 돈다(조준 보조 — 마우스 조준이 없으니 넓게). 서버는 복제된 방향으로 판정한다.
local Players = game:GetService("Players")
local ContextActionService = game:GetService("ContextActionService")
local UserInputService = game:GetService("UserInputService")
local CollectionService = game:GetService("CollectionService")
local Shared = game:GetService("ReplicatedStorage"):WaitForChild("AmpArena")
local Theme = require(Shared.Theme)
local Command = Shared:WaitForChild("Remotes"):WaitForChild("Command")
local player = Players.LocalPlayer

local function send(name, args) Command:FireServer(name, args or {}) end

local function myRoot()
	local c = player.Character
	return c and c:FindFirstChild("HumanoidRootPart"), c
end
local function myTeam() local c = player.Character; return c and c:GetAttribute("Team") or 0 end

-- 조준 보조: 정면 ±60°, 14 스터드 안 가장 가까운 적을 향해 돈다
local function aimAssist()
	local root, me = myRoot()
	if not root then return end
	local look = Vector3.new(root.CFrame.LookVector.X, 0, root.CFrame.LookVector.Z)
	if look.Magnitude < 1e-3 then return end
	look = look.Unit
	local best, bd = nil, 14
	local team = myTeam()
	for _, m in CollectionService:GetTagged("Fighter") do
		if m == me or not m.Parent then continue end
		if team ~= 0 and m:GetAttribute("Team") == team then continue end
		if m:GetAttribute("Fight") == "dead" then continue end
		local r = m:FindFirstChild("HumanoidRootPart")
		if not r then continue end
		local d = Vector3.new(r.Position.X - root.Position.X, 0, r.Position.Z - root.Position.Z)
		local dist = d.Magnitude
		if dist < 0.5 or dist > bd then continue end
		local ang = math.deg(math.acos(math.clamp(d.Unit:Dot(look), -1, 1)))
		if ang <= 60 then best, bd = r, dist end
	end
	if best then
		local hum = me:FindFirstChildOfClass("Humanoid")
		if hum and hum.MoveDirection.Magnitude < 0.1 then
			root.CFrame = CFrame.lookAt(root.Position, Vector3.new(best.Position.X, root.Position.Y, best.Position.Z))
		end
	end
end
local function moveDir()
	local c = player.Character
	local hum = c and c:FindFirstChildOfClass("Humanoid")
	return hum and hum.MoveDirection or Vector3.zero
end

local function attack(kind)
	aimAssist()
	send("intent", { kind = kind, dir = moveDir() })
end
local actions = {
	{ name = "AmpLight", title = "약공", keys = { Enum.KeyCode.Z, Enum.KeyCode.ButtonX }, run = function() attack("light") end },
	{ name = "AmpHeavy", title = "강공", keys = { Enum.KeyCode.X, Enum.KeyCode.ButtonY }, run = function() attack("heavy") end },
	{ name = "AmpSpecial", title = "기술", keys = { Enum.KeyCode.V, Enum.KeyCode.ButtonR1 }, run = function() aimAssist(); send("intent", { kind = "special" }) end },
	{ name = "AmpDash", title = "대시", keys = { Enum.KeyCode.LeftShift, Enum.KeyCode.RightShift, Enum.KeyCode.ButtonB }, run = function() send("intent", { kind = "dash" }) end },
}
for _, a in actions do
	ContextActionService:BindAction(a.name, function(_, state)
		if state == Enum.UserInputState.Begin then a.run() end
		return Enum.ContextActionResult.Pass
	end, true, table.unpack(a.keys))
	ContextActionService:SetTitle(a.name, a.title)
end
-- 가드는 홀드
ContextActionService:BindAction("AmpGuard", function(_, state)
	if state == Enum.UserInputState.Begin then send("guard", { on = true })
	elseif state == Enum.UserInputState.End or state == Enum.UserInputState.Cancel then send("guard", { on = false }) end
	return Enum.ContextActionResult.Pass
end, true, Enum.KeyCode.C, Enum.KeyCode.ButtonL2)
ContextActionService:SetTitle("AmpGuard", "가드")

-- 터치 버튼 배치: 오른쪽 엄지 반경, 기본 점프 버튼(우하단) 둘레. 화면 짧은 축 ≤ 500px 이면 작게.
local function layout()
	local cam = workspace.CurrentCamera
	local short = cam and math.min(cam.ViewportSize.X, cam.ViewportSize.Y) or 600
	local s = short <= 500 and 58 or 72
	local pos = {
		AmpLight = UDim2.new(1, -(s * 2 + 120), 1, -(s + 60)),
		AmpHeavy = UDim2.new(1, -(s + 110), 1, -(s * 2 + 70)),
		AmpSpecial = UDim2.new(1, -(s * 3 + 130), 1, -(s * 2 + 40)),
		AmpDash = UDim2.new(1, -(s * 2 + 120), 1, -(s * 3 + 50)),
		AmpGuard = UDim2.new(1, -(s * 3 + 140), 1, -(s + 10)),
	}
	for name, p in pos do
		ContextActionService:SetPosition(name, p)
		local b = ContextActionService:GetButton(name)
		if b then
			b.Size = UDim2.fromOffset(s, s)
			local l = b:FindFirstChildOfClass("TextLabel") or b:FindFirstChild("ActionTitle", true)
			if l then l.Font = Theme.font; l.TextSize = 14 end
		end
	end
end
if UserInputService.TouchEnabled then
	task.defer(layout)
	if workspace.CurrentCamera then workspace.CurrentCamera:GetPropertyChangedSignal("ViewportSize"):Connect(layout) end
end
