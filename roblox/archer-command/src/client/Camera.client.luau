--!nonstrict
-- 카메라. 기본은 Roblox 3인칭(줌 범위는 StarterPlayer 가 정한다). HUD 의 시점 버튼이 내려보기(쿼터뷰)로 바꾼다.
-- 내려보기는 공식 아이소메트릭 예제 범위(거리 30 안팎)로 두고 Focus 를 매 프레임 갱신한다.
local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local UserInputService = game:GetService("UserInputService")
local player = Players.LocalPlayer

local toggle = Instance.new("BindableEvent")
toggle.Name = "ViewToggle"
toggle.Parent = player:WaitForChild("PlayerScripts")

local quarter = false
local distance = 32
local MIN, MAX = 24, 44
local PITCH = math.rad(50)
local focus = nil

local function quarterView()
	local camera = workspace.CurrentCamera
	if not camera then return end
	camera.CameraType = Enum.CameraType.Scriptable
	camera.FieldOfView = 70
	local character = player.Character
	local root = character and character:FindFirstChild("HumanoidRootPart")
	local target = root and root.Position or Vector3.new(0, 4, 0)
	target += Vector3.new(0, 1.5, 0)
	focus = if focus then focus:Lerp(target, 0.25) else target
	local eye = focus + Vector3.new(0, math.sin(PITCH) * distance, math.cos(PITCH) * distance)
	camera.CFrame = CFrame.lookAt(eye, focus)
	camera.Focus = CFrame.new(focus)
end

toggle.Event:Connect(function()
	quarter = not quarter
	player:SetAttribute("QuarterView", quarter)
	local camera = workspace.CurrentCamera
	if not quarter and camera then camera.CameraType = Enum.CameraType.Custom end
	if quarter then focus = nil; RunService:BindToRenderStep("ArcherQuarterView", Enum.RenderPriority.Camera.Value + 1, quarterView)
	else RunService:UnbindFromRenderStep("ArcherQuarterView") end
end)

UserInputService.InputChanged:Connect(function(input, processed)
	if not quarter or processed then return end
	if input.UserInputType == Enum.UserInputType.MouseWheel then distance = math.clamp(distance - input.Position.Z * 4, MIN, MAX) end
end)
UserInputService.TouchPinch:Connect(function(_, scale, _, state)
	if not quarter then return end
	if state == Enum.UserInputState.Change then distance = math.clamp(distance / scale ^ 0.2, MIN, MAX) end
end)
player:SetAttribute("QuarterView", false)
