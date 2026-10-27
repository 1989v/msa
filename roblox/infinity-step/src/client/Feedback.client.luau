-- Feedback only: PlayerModule, default camera and native jump input remain untouched.
local Players = game:GetService("Players")
local player = Players.LocalPlayer
local shared = game.ReplicatedStorage:WaitForChild("InfinityStep")
local Rules = require(shared:WaitForChild("Rules"))
local Theme = require(shared:WaitForChild("Theme"))
local gui = Instance.new("ScreenGui")
gui.Name, gui.ResetOnSpawn, gui.IgnoreGuiInset = "InfinityFeedback", false, false
gui.ScreenInsets = Enum.ScreenInsets.CoreUISafeInsets
gui.Parent = player:WaitForChild("PlayerGui")
local function corner(object)
 local value = Instance.new("UICorner"); value.CornerRadius = UDim.new(0, Theme.Radius); value.Parent = object
end
local info = Instance.new("TextLabel")
info.Size, info.Position = UDim2.fromOffset(300, 74), UDim2.new(0.5, -150, 0, Theme.Gap)
info.BackgroundColor3, info.BackgroundTransparency = Theme.Surface, 0.18
info.TextColor3, info.TextSize, info.Font = Theme.Text, Theme.BodySize, Enum.Font.GothamMedium
info.TextWrapped = true
info.Parent = gui
corner(info)
local panel = Instance.new("Frame")
panel.Size, panel.Position = UDim2.fromOffset(292, 164), UDim2.new(0.5, -146, 0.5, -82)
panel.BackgroundColor3, panel.Visible = Theme.Surface, false
panel.Parent = gui
corner(panel)
local question = Instance.new("TextLabel")
question.Size, question.Position = UDim2.new(1, -16, 0, 60), UDim2.fromOffset(8, 8)
question.BackgroundTransparency, question.TextWrapped = 1, true
question.TextColor3, question.TextSize, question.Font = Theme.Text, Theme.HeadingSize, Enum.Font.GothamMedium
question.Parent = panel
local function choice(text, y, action)
 local button = Instance.new("TextButton")
 button.Text, button.Size, button.Position = text, UDim2.new(1, -16, 0, 40), UDim2.fromOffset(8, y)
 button.BackgroundColor3, button.TextColor3 = Theme.Accent, Theme.Text
 button.TextSize, button.Font = Theme.BodySize, Enum.Font.GothamMedium
 button.Parent = panel; corner(button)
 button.Activated:Connect(function() shared.Action:FireServer(action) end)
 return button
end
local revive = choice("부활권 사용", 72, "revive")
choice("그대로 계속하기", 116, "decline")
local function refresh()
 local roof = player:GetAttribute("CurrentRoof") or 0
 local region = math.clamp(math.floor(math.max(0, roof - 1) / 6) + 1, 1, #Rules.REGIONS)
 local charge = math.floor((player:GetAttribute("Charge") or 0) * 100)
 local stamina = math.floor((player:GetAttribute("Stamina") or 1) * 100)
 local message = player:GetAttribute("SaveMessage") or ""
 if player:GetAttribute("Completed") then message = "블랙홀 관측소 도달 · 정상에서 도시를 돌아보세요" end
 info.Text = string.format("%s · %d / 42\n도약 %d%% · 등반 체력 %d%%%s", Rules.REGIONS[region], roof, charge, stamina, if message ~= "" then "\n" .. message else "")
 local target = player:GetAttribute("ReviveTarget") or -1
 local credits = player:GetAttribute("Revives") or 0
 panel.Visible = target >= 0 and player:GetAttribute("SaveReady") == true
 question.Text = string.format("마지막 안정 착지면 %d로 돌아갈까요?\n%s %d개", target, if player:GetAttribute("DevelopmentInventory") then "개발 테스트권" else "부활권", credits)
 revive.Text = if credits > 0 then "부활권 1개 사용" else "보유 부활권 없음"
 revive.Active = credits > 0
 revive.AutoButtonColor = credits > 0
end
player.AttributeChanged:Connect(refresh)
local function characterAdded(character)
 local humanoid = character:WaitForChild("Humanoid")
 local function updateClimbing()
  local canClimb = humanoid:GetAttribute("CanClimb") ~= false
  humanoid:SetStateEnabled(Enum.HumanoidStateType.Climbing, canClimb)
  if not canClimb and humanoid:GetState() == Enum.HumanoidStateType.Climbing then humanoid:ChangeState(Enum.HumanoidStateType.Freefall) end
 end
 humanoid:GetAttributeChangedSignal("CanClimb"):Connect(updateClimbing)
 updateClimbing()
end
player.CharacterAdded:Connect(characterAdded)
if player.Character then task.spawn(characterAdded, player.Character) end
refresh()
