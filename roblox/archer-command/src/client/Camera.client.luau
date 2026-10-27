--!nonstrict
-- 탑다운 고정 카메라: 캐릭터 머리 위 피치 62°, 남쪽에서 북쪽(−Z)을 본다. 확대 3단(원작 zoom .8/1/1.25 → 거리 150/120/96).
local Players = game:GetService("Players")
local Run = game:GetService("RunService")
local Input = game:GetService("UserInputService")
local Shared = game:GetService("ReplicatedStorage"):WaitForChild("ArcherCommand")
local Grid = require(Shared.Grid)
local player = Players.LocalPlayer

local DISTANCES = { 150, 120, 96 }
local PITCH = math.rad(62)
local zoomIndex = 2
local focus = nil

local zoomEvent = Instance.new("BindableEvent")
zoomEvent.Name = "Zoom"
zoomEvent.Parent = player:WaitForChild("PlayerScripts")
zoomEvent.Event:Connect(function(delta)
	zoomIndex = math.clamp(zoomIndex + delta, 1, #DISTANCES)
end)
Input.InputChanged:Connect(function(input, processed)
	if processed then return end
	if input.UserInputType == Enum.UserInputType.MouseWheel then zoomIndex = math.clamp(zoomIndex - input.Position.Z, 1, #DISTANCES) end
end)

Run:BindToRenderStep("ArcherCamera", Enum.RenderPriority.Camera.Value + 1, function(dt)
	local camera = workspace.CurrentCamera
	if not camera then return end
	camera.CameraType = Enum.CameraType.Scriptable
	camera.FieldOfView = 70
	local character = player.Character
	local root = character and character:FindFirstChild("HumanoidRootPart")
	local target
	if root then target = root.Position else local b = Grid.SITES.base; target = Vector3.new(b.x, 3, b.z) end
	focus = focus and focus:Lerp(target, 1 - math.exp(-8 * dt)) or target
	local distance = DISTANCES[zoomIndex]
	local at = focus + Vector3.new(0, math.sin(PITCH) * distance, math.cos(PITCH) * distance)
	camera.CFrame = CFrame.lookAt(at, focus)
	camera.Focus = CFrame.new(focus)
end)
