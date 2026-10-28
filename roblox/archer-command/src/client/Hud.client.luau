--!nonstrict
-- HUD. 모바일 우선: 상단 자원·웨이브·본진, 하단 중앙 핫바(기본 점프 버튼 자리는 비워 둔다), 우상단 시점 전환.
-- 본진 건물의 ProximityPrompt 가 관리 패널을 연다. 키 이름 안내는 두지 않는다(키보드 단축은 조용히 묶는다).
local Players = game:GetService("Players")
local UserInputService = game:GetService("UserInputService")
local ContextActionService = game:GetService("ContextActionService")
local ProximityPromptService = game:GetService("ProximityPromptService")
local Shared = game:GetService("ReplicatedStorage"):WaitForChild("ArcherCommand")
local Config = require(Shared.Config)
local Rules = require(Shared.Rules)
local Theme = require(Shared.Theme)
local Remotes = Shared:WaitForChild("Remotes")
local Command, Fx, State = Remotes.Command, Remotes.Fx, Remotes.State
local player = Players.LocalPlayer
local viewToggle = player:WaitForChild("PlayerScripts"):WaitForChild("ViewToggle")

local touch = UserInputService.TouchEnabled and not UserInputService.KeyboardEnabled
local BTN = touch and 52 or 58
local gui = Instance.new("ScreenGui"); gui.Name = "ArcherHud"; gui.ResetOnSpawn = false; gui.IgnoreGuiInset = false; gui.Parent = player:WaitForChild("PlayerGui")

local function corner(o, r) local c = Instance.new("UICorner"); c.CornerRadius = UDim.new(0, r or 8); c.Parent = o end
local function frame(parent, size, pos, color, transparency)
	local f = Instance.new("Frame"); f.Size = size; f.Position = pos; f.BackgroundColor3 = color or Theme.surface0; f.BackgroundTransparency = transparency or 0.15; f.BorderSizePixel = 0; f.Parent = parent
	corner(f); return f
end
local function label(parent, text, size, pos, textSize, color, align)
	local l = Instance.new("TextLabel"); l.Size = size; l.Position = pos or UDim2.new(); l.BackgroundTransparency = 1; l.Text = text
	l.Font = Theme.fontBody; l.TextSize = textSize or 15; l.TextColor3 = color or Theme.textPrimary; l.TextXAlignment = align or Enum.TextXAlignment.Left; l.TextWrapped = true; l.Parent = parent
	return l
end
local function button(parent, text, size, pos, color)
	local b = Instance.new("TextButton"); b.Size = size; b.Position = pos or UDim2.new(); b.BackgroundColor3 = color or Theme.surface2; b.AutoButtonColor = true
	b.Text = text; b.Font = Theme.font; b.TextSize = 14; b.TextColor3 = Theme.textPrimary; b.TextWrapped = true; b.BorderSizePixel = 0; b.Parent = parent
	corner(b); return b
end
local function send(name, args) Command:FireServer(name, args or {}) end

local state = nil
local quarter = false

-- ───────── 상단 ─────────
local top = frame(gui, UDim2.fromOffset(250, 78), UDim2.fromOffset(12, 12))
local goldLabel = label(top, "금화 0", UDim2.new(1, -16, 0, 24), UDim2.fromOffset(10, 4), 18, Theme.warning)
local waveLabel = label(top, "", UDim2.new(1, -16, 0, 20), UDim2.fromOffset(10, 28), 14, Theme.textSecondary)
local baseBack = frame(top, UDim2.new(1, -20, 0, 10), UDim2.fromOffset(10, 56), Theme.surface2, 0)
local baseBar = frame(baseBack, UDim2.fromScale(1, 1), UDim2.new(), Theme.healing, 0)
local baseLabel = label(top, "본진", UDim2.new(1, -16, 0, 14), UDim2.fromOffset(10, 44), 11, Theme.textSecondary)

local right = frame(gui, UDim2.fromOffset(150, 78), UDim2.new(1, -162, 0, 12))
local viewButton = button(right, "시점 · 내려보기", UDim2.new(1, -12, 0, 30), UDim2.fromOffset(6, 6), Theme.surface2)
local squadLabel = label(right, "", UDim2.new(1, -12, 0, 32), UDim2.fromOffset(8, 40), 12, Theme.textSecondary)
viewButton.Activated:Connect(function()
	viewToggle:Fire()
	quarter = not quarter
	viewButton.Text = quarter and "시점 · 3인칭" or "시점 · 내려보기"
end)

-- ───────── 핫바 ─────────
local hotbar = frame(gui, UDim2.fromOffset(BTN * 5 + 8 * 6, BTN + 12), UDim2.new(touch and 0.56 or 0.5, -(BTN * 5 + 48) / 2, 1, -(BTN + 12) - (touch and 8 or 16)), Theme.surface0, 0.3)
local hot = {}
local defs = {
	{ key = "hire", title = "고용", sub = "" }, { key = "attack", title = "공업", sub = "" }, { key = "armor", title = "방업", sub = "" },
	{ key = "tower", title = "방어탑", sub = tostring(Config.TOWER.cost) }, { key = "skill", title = "일제 사격", sub = "" },
}
for i, d in defs do
	local b = button(hotbar, d.title, UDim2.fromOffset(BTN, BTN), UDim2.fromOffset(8 + (i - 1) * (BTN + 8), 6))
	b.TextSize = 13
	local sub = label(b, d.sub, UDim2.new(1, 0, 0, 14), UDim2.new(0, 0, 1, -16), 11, Theme.warning, Enum.TextXAlignment.Center)
	-- 튜토리얼이 가리키는 버튼은 테두리가 깜빡인다
	local ring = Instance.new("UIStroke"); ring.Thickness = 3; ring.Color = Theme.warning; ring.Transparency = 1; ring.Parent = b
	hot[d.key] = { b = b, sub = sub, ring = ring }
end
local hint = nil
game:GetService("RunService").RenderStepped:Connect(function()
	local pulse = 0.25 + 0.5 * (0.5 + 0.5 * math.sin(os.clock() * 5))
	for key, h in hot do h.ring.Transparency = if key == hint then pulse else 1 end
end)

-- ───────── 관리 패널 ─────────
local panel = frame(gui, UDim2.fromOffset(300, 300), UDim2.new(0.5, -150, 0.5, -150)); panel.Visible = false
label(panel, "원정대 관리", UDim2.new(1, -60, 0, 30), UDim2.fromOffset(14, 8), 18)
local closeBtn = button(panel, "닫기", UDim2.fromOffset(56, 30), UDim2.new(1, -66, 0, 8))
closeBtn.Activated:Connect(function() panel.Visible = false end)
local rows = {}
local rowDefs = {
	{ key = "archer", text = "활잡이", cmd = function() send("hire", { kind = "archer" }) end },
	{ key = "longbow", text = "장궁수 · 사거리 길고 느림", cmd = function() send("hire", { kind = "longbow" }) end },
	{ key = "carpenter", text = "목수 · 채집·건설·수리", cmd = function() send("hire", { kind = "carpenter" }) end },
	{ key = "attack", text = "공업 · 모든 활잡이 피해 +2", cmd = function() send("upgrade", { kind = "attack" }) end },
	{ key = "armor", text = "방업 · 받는 피해 −1", cmd = function() send("upgrade", { kind = "armor" }) end },
	{ key = "combine", text = "활잡이 3 → 영웅 활잡이", cmd = function() send("combine") end },
}
for i, r in rowDefs do
	local y = 48 + (i - 1) * 40
	label(panel, r.text, UDim2.new(1, -120, 0, 32), UDim2.fromOffset(14, y), 14)
	local b = button(panel, "", UDim2.fromOffset(92, 32), UDim2.new(1, -104, 0, y), Theme.primary)
	b.Activated:Connect(r.cmd)
	rows[r.key] = b
end

-- ───────── 로비 · 패배 ─────────
local center = frame(gui, UDim2.fromOffset(320, 230), UDim2.new(0.5, -160, 0.5, -115)); center.Visible = false
local title = label(center, "궁수 키우기", UDim2.new(1, 0, 0, 50), UDim2.fromOffset(0, 14), 36, Theme.warning, Enum.TextXAlignment.Center); title.Font = Theme.fontTitle
local subtitle = label(center, "", UDim2.new(1, -24, 0, 60), UDim2.fromOffset(12, 64), 14, Theme.textSecondary, Enum.TextXAlignment.Center)
local primaryBtn = button(center, "새 원정", UDim2.new(1, -24, 0, 40), UDim2.fromOffset(12, 130), Theme.primary)
local secondaryBtn = button(center, "이어하기", UDim2.new(1, -24, 0, 40), UDim2.fromOffset(12, 178))

-- ───────── 안내 ─────────
local toastLabel = label(gui, "", UDim2.new(0, 360, 0, 44), UDim2.new(0.5, -180, 1, -(BTN + 12) - (touch and 60 or 72)), 15, Theme.textPrimary, Enum.TextXAlignment.Center)
toastLabel.TextStrokeTransparency = 0.5
local toastQueue, toastBusy = {}, false
local function pumpToasts()
	if toastBusy then return end
	local text = table.remove(toastQueue, 1)
	if not text then return end
	toastBusy = true
	toastLabel.Text = text
	task.delay(3.2, function() toastLabel.Text = ""; toastBusy = false; pumpToasts() end)
end
Fx.OnClientEvent:Connect(function(kind, text)
	if kind == "toast" then table.insert(toastQueue, text); if #toastQueue > 3 then table.remove(toastQueue, 1) end; pumpToasts() end
end)

-- ───────── 적 카드 ─────────
local card = frame(gui, UDim2.fromOffset(220, 70), UDim2.new(0.5, -110, 0, 100)); card.Visible = false
local cardTitle = label(card, "", UDim2.new(1, -16, 0, 22), UDim2.fromOffset(8, 4), 15, Theme.enemy)
local cardBody = label(card, "", UDim2.new(1, -16, 0, 40), UDim2.fromOffset(8, 26), 12, Theme.textSecondary)
local cardUntil = 0
local function showEnemy(model)
	local kind = model:GetAttribute("Kind"); local def = kind and Config.ENEMIES[kind]
	if not def then return end
	local hum = model:FindFirstChildOfClass("Humanoid")
	local hp = hum and hum.Health or model:GetAttribute("Health") or 0
	local armor = state and state.upgrades.armor or 0
	local more = math.max(0, (def.damage - 1) - armor)
	cardTitle.Text = string.format("%s  체력 %d/%d", def.label, math.floor(hp), def.maxHealth)
	cardBody.Text = string.format("피해 %d → 지금 %d 받음 · 피해 1까지 방업 %d 더 · 보상 %d", def.damage, Rules.damageTaken(def.damage, armor), more, def.reward)
	card.Visible = true; cardUntil = os.clock() + 4
end

-- ───────── 지면 지정(탑·일제 사격) ─────────
local mode = nil
local marker = Instance.new("Part"); marker.Shape = Enum.PartType.Cylinder; marker.Anchored = true; marker.CanCollide = false; marker.CanQuery = false
marker.Material = Enum.Material.Neon; marker.Transparency = 0.5; marker.Parent = workspace
local cancelBtn = button(gui, "취소", UDim2.fromOffset(90, 36), UDim2.new(0.5, -45, 0, 60), Theme.enemy); cancelBtn.Visible = false
local rayParams = RaycastParams.new(); rayParams.FilterType = Enum.RaycastFilterType.Include
rayParams.FilterDescendantsInstances = { workspace.Terrain, workspace:WaitForChild("World") }
local function groundFromScreen(x, y)
	local camera = workspace.CurrentCamera
	local ray = camera:ViewportPointToRay(x, y)
	local hit = workspace:Raycast(ray.Origin, ray.Direction * 400, rayParams)
	return hit and hit.Position
end
local function setMode(m)
	mode = m
	cancelBtn.Visible = m ~= nil
	marker.Transparency = m and 0.5 or 1
	if m == "tower" then marker.Size = Vector3.new(0.2, Config.TOWER.minSpacing, Config.TOWER.minSpacing); marker.Color = Theme.warning
	elseif m == "skill" then marker.Size = Vector3.new(0.2, Config.HERO_SKILL.radius * 2, Config.HERO_SKILL.radius * 2); marker.Color = Color3.fromRGB(255, 140, 90) end
end
cancelBtn.Activated:Connect(function() setMode(nil) end)
local function placeAt(x, y)
	local p = groundFromScreen(x, y)
	if not p then return end
	if mode == "tower" then send("tower", { point = p }) elseif mode == "skill" then send("skill", { point = p }) end
	setMode(nil)
end
UserInputService.InputBegan:Connect(function(input, processed)
	if processed then return end
	if input.UserInputType == Enum.UserInputType.MouseButton1 then
		if mode then placeAt(input.Position.X, input.Position.Y)
		else
			local camera = workspace.CurrentCamera
			local ray = camera:ViewportPointToRay(input.Position.X, input.Position.Y)
			local hit = workspace:Raycast(ray.Origin, ray.Direction * 300)
			local model = hit and hit.Instance:FindFirstAncestorOfClass("Model")
			if model and model:GetAttribute("Kind") and Config.ENEMIES[model:GetAttribute("Kind")] then showEnemy(model) end
		end
	end
end)
UserInputService.TouchTapInWorld:Connect(function(position, processed)
	if processed then return end
	if mode then placeAt(position.X, position.Y)
	else
		local camera = workspace.CurrentCamera
		local ray = camera:ViewportPointToRay(position.X, position.Y)
		local hit = workspace:Raycast(ray.Origin, ray.Direction * 300)
		local model = hit and hit.Instance:FindFirstAncestorOfClass("Model")
		if model and model:GetAttribute("Kind") and Config.ENEMIES[model:GetAttribute("Kind")] then showEnemy(model) end
	end
end)
UserInputService.InputChanged:Connect(function(input)
	if not mode then return end
	if input.UserInputType == Enum.UserInputType.MouseMovement or input.UserInputType == Enum.UserInputType.Touch then
		local p = groundFromScreen(input.Position.X, input.Position.Y)
		if p then marker.CFrame = CFrame.new(p + Vector3.new(0, 0.3, 0)) * CFrame.Angles(0, 0, math.rad(90)) end
	end
end)

hot.hire.b.Activated:Connect(function() panel.Visible = not panel.Visible end)
hot.attack.b.Activated:Connect(function() send("upgrade", { kind = "attack" }) end)
hot.armor.b.Activated:Connect(function() send("upgrade", { kind = "armor" }) end)
hot.tower.b.Activated:Connect(function() setMode(if mode == "tower" then nil else "tower") end)
hot.skill.b.Activated:Connect(function() setMode(if mode == "skill" then nil else "skill") end)
-- 키보드 단축(안내 없음)
ContextActionService:BindAction("ArcherTower", function(_, s) if s == Enum.UserInputState.Begin then hot.tower.b:Activate() end end, false, Enum.KeyCode.T)
ContextActionService:BindAction("ArcherSkill", function(_, s) if s == Enum.UserInputState.Begin then hot.skill.b:Activate() end end, false, Enum.KeyCode.Q)
ContextActionService:BindAction("ArcherPanel", function(_, s) if s == Enum.UserInputState.Begin then hot.hire.b:Activate() end end, false, Enum.KeyCode.B)
ContextActionService:BindAction("ArcherView", function(_, s) if s == Enum.UserInputState.Begin then viewButton:Activate() end end, false, Enum.KeyCode.V)

ProximityPromptService.PromptTriggered:Connect(function(prompt)
	if prompt:FindFirstChild("Panel") then panel.Visible = true end
end)

primaryBtn.Activated:Connect(function()
	if not state then return end
	if state.phase == "lobby" then send("start", { mode = "new" }) elseif state.phase == "defeat" then send("restart") end
end)
secondaryBtn.Activated:Connect(function()
	if state and state.phase == "lobby" then send("start", { mode = "continue" }) end
end)

-- ───────── 상태 반영 ─────────
local function money(n) return n and tostring(n) or "—" end
State.OnClientEvent:Connect(function(s)
	state = s
	local isHost = s.hostId == player.UserId
	local playing = s.phase == "playing"
	top.Visible = playing; right.Visible = true; hotbar.Visible = playing
	if not playing then panel.Visible = false; setMode(nil) end
	goldLabel.Text = "금화 " .. s.gold
	local c = s.campaign
	waveLabel.Text = if c.wave == 0 then string.format("첫 웨이브까지 %d초", c.nextWave) else string.format("웨이브 %d · 다음 %d초 · 거점 %s · 전초기지 %s", c.wave, c.nextWave, c.camp == "cleared" and "소탕" or "점거", c.outpost == "cleared" and "함락" or "건재")
	baseBar.Size = UDim2.fromScale(math.clamp(s.base.hp / math.max(1, s.base.max), 0, 1), 1)
	baseBar.BackgroundColor3 = if s.base.hp / s.base.max < 0.3 then Theme.enemy else Theme.healing
	baseLabel.Text = string.format("본진 %d / %d", s.base.hp, s.base.max)
	squadLabel.Text = string.format("병력 %d/%d · 목수 %d/%d · 탑 %d/%d", s.alive.allies, Config.LIMITS.allies, s.alive.carpenters, Config.LIMITS.carpenters, s.towers, Config.LIMITS.towers)
	hot.attack.sub.Text = money(s.prices.attack); hot.armor.sub.Text = money(s.prices.armor)
	hot.attack.b.Text = "공업 " .. s.upgrades.attack; hot.armor.b.Text = "방업 " .. s.upgrades.armor
	hot.skill.sub.Text = if s.skillIn > 0 then string.format("%d초", math.ceil(s.skillIn)) else (s.counts.hero > 0 and "준비" or "영웅 없음")
	rows.archer.Text = money(s.prices.archer); rows.longbow.Text = money(s.prices.longbow); rows.carpenter.Text = money(s.prices.carpenter)
	rows.attack.Text = money(s.prices.attack); rows.armor.Text = money(s.prices.armor); rows.combine.Text = string.format("합성 (%d/3)", s.counts.archer)
	for key, b in rows do
		local price = s.prices[key]
		local ok = if key == "combine" then s.counts.archer >= 3 else (price ~= nil and s.gold >= price)
		b.BackgroundColor3 = ok and Theme.primary or Theme.surface2
	end
	hot.tower.b.BackgroundColor3 = s.gold >= Config.TOWER.cost and Theme.surface2 or Theme.surface1
	hint = playing and s.hint or nil
	if s.phase == "lobby" then
		center.Visible = true; primaryBtn.Visible = isHost; secondaryBtn.Visible = isHost and s.saveInfo == "ok"
		primaryBtn.Text = "새 원정"
		if not isHost then subtitle.Text = "호스트가 원정을 시작하길 기다린다"
		elseif s.saveInfo == "fail" then subtitle.Text = "저장을 읽지 못했다 · 새 원정만 가능"
		elseif s.memoryOnly then subtitle.Text = "활잡이 하나로 시작해 원정대를 키운다\nStudio: 저장은 메모리에만 남는다"
		else subtitle.Text = "활잡이 하나로 시작해 원정대를 키운다" end
	elseif s.phase == "defeat" then
		center.Visible = true; primaryBtn.Visible = isHost; secondaryBtn.Visible = false
		primaryBtn.Text = "다시"; subtitle.Text = string.format("본진이 무너졌다 · 웨이브 %d 까지 버텼다", c.wave)
	else
		center.Visible = false
	end
	if card.Visible and os.clock() > cardUntil then card.Visible = false end
end)
