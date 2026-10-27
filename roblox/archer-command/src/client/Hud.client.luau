--!nonstrict
-- HUD · 패널 · 입력. 문구는 원작 marine-command 의 한국어를 Roblox 판 표(requirements.md)대로 쓴다.
-- Esc/Tab 키는 쓰지 않는다. 점프는 서버가 껐고 터치 점프 버튼은 숨긴다. Q/E 는 무장 → 지면 탭 → 발동.
local Players = game:GetService("Players")
local Input = game:GetService("UserInputService")
local Action = game:GetService("ContextActionService")
local StarterGui = game:GetService("StarterGui")
local Run = game:GetService("RunService")
local Shared = game:GetService("ReplicatedStorage"):WaitForChild("ArcherCommand")
local Balance = require(Shared.Balance)
local Grid = require(Shared.Grid)
local Theme = require(Shared.Theme)
local Packet = require(Shared.Packet)
local commandRemote = Shared:WaitForChild("Command")
local stateRemote = Shared:WaitForChild("State")
local lobbyRemote = Shared:WaitForChild("Lobby")
local eventRemote = Shared:WaitForChild("Event")
local player = Players.LocalPlayer
local terrain = Grid.create()

pcall(function() StarterGui:SetCoreGuiEnabled(Enum.CoreGuiType.PlayerList, false) end)
task.spawn(function()
	local gui = player:WaitForChild("PlayerGui")
	local touch = gui:WaitForChild("TouchGui", 10)
	if touch then
		local frame = touch:WaitForChild("TouchControlFrame", 5)
		local jump = frame and frame:WaitForChild("JumpButton", 5)
		if jump then jump.Visible = false end
	end
end)

local function rgb(token) local c = Theme[token] return Color3.fromRGB(c[1], c[2], c[3]) end
local gui = Instance.new("ScreenGui"); gui.Name = "ArcherHUD"; gui.ResetOnSpawn = false; gui.ScreenInsets = Enum.ScreenInsets.DeviceSafeInsets; gui.Parent = player:WaitForChild("PlayerGui")

local function frame(parent, size, pos, token, transparency)
	local f = Instance.new("Frame"); f.Size = size; f.Position = pos; f.BackgroundColor3 = rgb(token or "surface1"); f.BackgroundTransparency = transparency or 0.08; f.BorderSizePixel = 0; f.Parent = parent
	local corner = Instance.new("UICorner"); corner.CornerRadius = UDim.new(0, Theme.radius); corner.Parent = f
	return f
end
local function label(parent, text, size, pos, textSize, align)
	local l = Instance.new("TextLabel"); l.Text = text; l.Size = size; l.Position = pos; l.BackgroundTransparency = 1
	l.Font = Enum.Font.GothamMedium; l.TextSize = textSize or Theme.textSize; l.TextColor3 = rgb("textPrimary"); l.TextWrapped = true
	l.TextXAlignment = align or Enum.TextXAlignment.Left; l.TextYAlignment = Enum.TextYAlignment.Top; l.Parent = parent
	return l
end
local function button(parent, text, size, pos, onClick, token)
	local b = Instance.new("TextButton"); b.Text = text; b.Size = size; b.Position = pos; b.BackgroundColor3 = rgb(token or "surface2"); b.BorderSizePixel = 0
	b.Font = Enum.Font.GothamBold; b.TextSize = Theme.hudSize; b.TextColor3 = rgb("textPrimary"); b.TextWrapped = true; b.AutoButtonColor = true; b.Parent = parent
	local corner = Instance.new("UICorner"); corner.CornerRadius = UDim.new(0, Theme.radius); corner.Parent = b
	b.Activated:Connect(onClick)
	return b
end

-- ── 상단 ───────────────────────────────────────────────────────────────────
local top = frame(gui, UDim2.new(1, -16, 0, 40), UDim2.fromOffset(8, 8))
local brand = label(top, "궁수 키우기", UDim2.fromOffset(120, 40), UDim2.fromOffset(12, 10), 16)
local resources = label(top, "금화 0 · 병력 1 · 목수 0", UDim2.new(1, -420, 0, 40), UDim2.fromOffset(136, 11), Theme.hudSize)
local waveLabel = label(top, "", UDim2.fromOffset(260, 40), UDim2.new(1, -272, 0, 11), Theme.hudSize, Enum.TextXAlignment.Right)
local baseBack = frame(gui, UDim2.fromOffset(240, 10), UDim2.fromOffset(8, 52), "surface0")
local baseBar = frame(baseBack, UDim2.fromScale(1, 1), UDim2.fromOffset(0, 0), "healing")
local baseText = label(gui, "본진 4000", UDim2.fromOffset(240, 16), UDim2.fromOffset(8, 64), 12)
local saveText = label(gui, "", UDim2.fromOffset(240, 16), UDim2.fromOffset(8, 80), 12)
saveText.TextColor3 = rgb("textSecondary")

-- ── 안내 ───────────────────────────────────────────────────────────────────
local mission = frame(gui, UDim2.fromOffset(300, 120), UDim2.fromOffset(8, 100))
local missionTitle = label(mission, "첫 사냥", UDim2.new(1, -16, 0, 22), UDim2.fromOffset(8, 6), 15)
local missionDetail = label(mission, "", UDim2.new(1, -16, 0, 56), UDim2.fromOffset(8, 30), 12)
missionDetail.TextColor3 = rgb("textSecondary")
local missionAction = button(mission, "훈련장 열기", UDim2.fromOffset(120, 26), UDim2.fromOffset(8, 88), function() end, "primary")
local missionToggle = button(mission, "감추기", UDim2.fromOffset(64, 22), UDim2.new(1, -72, 0, 6), function() end)
local tutorialCollapsed = false
local tutorialTarget = "growth"

-- ── 토스트 ─────────────────────────────────────────────────────────────────
local toastLabel = label(gui, "", UDim2.fromOffset(360, 40), UDim2.new(0.5, -180, 0, 60), 14, Enum.TextXAlignment.Center)
toastLabel.TextYAlignment = Enum.TextYAlignment.Center
local toastAt = 0
local function toast(text, kind)
	toastLabel.Text = text; toastLabel.TextColor3 = if kind == "error" then rgb("enemy") elseif kind == "warn" then rgb("warning") else rgb("textPrimary"); toastAt = os.clock()
end

-- ── 오른쪽 세로열 ─────────────────────────────────────────────────────────
local column = Instance.new("Frame"); column.Size = UDim2.fromOffset(104, 330); column.Position = UDim2.new(1, -112, 0.5, -165); column.BackgroundTransparency = 1; column.Parent = gui
local panelOpen = nil
local showPanel -- forward
local placement = nil
local skillAim = nil
local zoomEvent = player:WaitForChild("PlayerScripts"):WaitForChild("Zoom")
button(column, "부대 관리", UDim2.fromOffset(104, 48), UDim2.fromOffset(0, 0), function() showPanel("hire") end)
button(column, "몬스터 도감", UDim2.fromOffset(104, 48), UDim2.fromOffset(0, 56), function() showPanel("bestiary") end)
button(column, "탑 건설", UDim2.fromOffset(104, 48), UDim2.fromOffset(0, 112), function() showPanel("workers") end)
button(column, "확대 ＋", UDim2.fromOffset(50, 40), UDim2.fromOffset(0, 168), function() zoomEvent:Fire(1) end)
button(column, "축소 －", UDim2.fromOffset(50, 40), UDim2.fromOffset(54, 168), function() zoomEvent:Fire(-1) end)
-- 키 이름은 키보드가 있는 기기에서만 적는다 (터치에서는 버튼이 곧 조작이다)
local KEYS = Input.KeyboardEnabled
local QN, EN = if KEYS then "Q 다중 사격" else "다중 사격", if KEYS then "E 회피 구르기" else "회피 구르기"
local skillQ = button(column, QN, UDim2.fromOffset(104, 48), UDim2.fromOffset(0, 220), function() end, "warning")
local skillE = button(column, EN, UDim2.fromOffset(104, 48), UDim2.fromOffset(0, 276), function() end, "warning")
skillQ.Visible = false; skillE.Visible = false

-- ── 상태 ───────────────────────────────────────────────────────────────────
local state = nil
local selectedEnemy = nil
local selectedUnits = {}
local myOwnerId = nil

local function send(payload) commandRemote:FireServer(payload) end
local function format(n) return tostring(math.floor(n)) end

-- ── 적 카드 ────────────────────────────────────────────────────────────────
local enemyCard = frame(gui, UDim2.fromOffset(300, 150), UDim2.new(1, -420, 1, -170))
enemyCard.Visible = false
local enemyTitle = label(enemyCard, "", UDim2.new(1, -16, 0, 22), UDim2.fromOffset(8, 6), 15)
local enemyBody = label(enemyCard, "", UDim2.new(1, -16, 0, 110), UDim2.fromOffset(8, 30), 12)
enemyBody.TextColor3 = rgb("textSecondary")
button(enemyCard, "닫기", UDim2.fromOffset(48, 22), UDim2.new(1, -56, 0, 6), function() selectedEnemy = nil; enemyCard.Visible = false end)

local function enemyDefFor(kind, flags)
	local d = table.clone(Balance.ENEMIES[kind] or Balance.ENEMIES.zombie)
	if Packet.has(flags, Packet.FLAG.guard) then for k, v in Balance.GUARD do d[k] = v end; d.label = "전초 파수꾼" end
	if Packet.has(flags, Packet.FLAG.cargo) then d.hp = Balance.SCOUT_HP; d.label = "정찰형 " .. d.label end
	return d
end
local function refreshEnemyCard()
	if not selectedEnemy or not selectedEnemy.Parent or not state then enemyCard.Visible = false; return end
	local kind, flags, hpRatio = selectedEnemy:GetAttribute("kind"), selectedEnemy:GetAttribute("flags") or 0, selectedEnemy:GetAttribute("hp") or 1
	if kind == "camp" then
		enemyTitle.Text = "북쪽 감시 고지 거점"
		enemyBody.Text = ("체력 %d / %d · 가시 예고 사격 12 · 사거리 %d · 부수면 100G + 역습"):format(state.camp.hp, state.camp.maxHp, Balance.ENEMIES.enemy_tower.range * 8)
		enemyCard.Visible = true; return
	end
	local d = enemyDefFor(kind, flags)
	local hp = d.hp * (if state.mode == "coop" then Balance.COOP.enemyHp else 1)
	local mine = Balance.UNITS.archer
	local attack, armor = state.upgrades and state.upgrades.attack or 0, state.upgrades and state.upgrades.armor or 0
	local leaderKind = state.leader and state.leader.kind or "archer"
	local unitDef = Balance.UNITS[leaderKind]
	local dealt = Balance.damage(unitDef, attack, d.armor)
	local received = math.max(1, d.damage - (unitDef.armor + armor))
	local armorTarget = math.max(0, math.ceil(d.damage - unitDef.armor - 1))
	local extra = math.max(0, armorTarget - armor)
	local cost = if extra > 0 then Balance.upgradeCost("armor", armor, extra) else 0
	enemyTitle.Text = d.label
	enemyBody.Text = ("체력 %d / %d · 공격 %d · 간격 %.1f초 · 방어 %d · 사거리 %d · %s · %s\n내 %s: 받는 피해 %d · 주는 피해 %d · 처치 %d발\n피해 1까지 방업 %d 더 (%s)"):format(
		math.floor(hp * hpRatio), math.floor(hp), d.damage, d.rate, d.armor, d.range * 8, if d.range > 7.5 then "원거리" else "근거리", if d.flying then "비행" else "지상",
		unitDef.label, received, dealt, math.ceil(hp * hpRatio / dealt), extra, if armorTarget > Balance.UPGRADE_LIMITS.armor then "상한 초과" else (if extra > 0 then format(cost) .. "G" else "달성"))
	enemyCard.Visible = true
end

-- ── 패널 ───────────────────────────────────────────────────────────────────
local panel = frame(gui, UDim2.new(0, 520, 0, 420), UDim2.new(0.5, -260, 0.5, -210))
panel.Visible = false
local tabs = Instance.new("Frame"); tabs.Size = UDim2.new(1, -16, 0, 32); tabs.Position = UDim2.fromOffset(8, 8); tabs.BackgroundTransparency = 1; tabs.Parent = panel
local content = Instance.new("ScrollingFrame"); content.Size = UDim2.new(1, -16, 1, -56); content.Position = UDim2.fromOffset(8, 48); content.BackgroundTransparency = 1; content.BorderSizePixel = 0; content.ScrollBarThickness = 6; content.CanvasSize = UDim2.fromOffset(0, 0); content.AutomaticCanvasSize = Enum.AutomaticSize.Y; content.Parent = panel
local layout = Instance.new("UIListLayout"); layout.Padding = UDim.new(0, 6); layout.Parent = content
button(panel, "✕", UDim2.fromOffset(32, 28), UDim2.new(1, -40, 0, 8), function() panel.Visible = false; panelOpen = nil end)
local TABS = { { "hire", "고용소" }, { "growth", "훈련장" }, { "units", "병력" }, { "workers", "목수·건설" }, { "towers", "방어탑" }, { "bestiary", "몬스터 도감" } }
local tabButtons = {}
for i, t in TABS do tabButtons[t[1]] = button(tabs, t[2], UDim2.fromOffset(76, 28), UDim2.fromOffset((i - 1) * 80, 0), function() showPanel(t[1]) end) end

local function row(text, actions)
	local r = frame(content, UDim2.new(1, -8, 0, 44), UDim2.fromOffset(0, 0), "surface2", 0.2)
	label(r, text, UDim2.new(1, -8 - 110 * #actions, 1, 0), UDim2.fromOffset(8, 6), 13)
	for i, a in actions do
		local b = button(r, a[1], UDim2.fromOffset(104, 32), UDim2.new(1, -110 * (#actions - i + 1), 0, 6), a[2], a[3])
		if a[4] then b.AutoButtonColor = false; b.BackgroundColor3 = rgb("surface0"); b.TextColor3 = rgb("textSecondary") end
	end
	return r
end
local function note(text)
	local l = label(content, text, UDim2.new(1, -8, 0, 40), UDim2.fromOffset(0, 0), 12)
	l.TextColor3 = rgb("textSecondary")
	l.AutomaticSize = Enum.AutomaticSize.Y
end

local function renderPanel()
	if not panel.Visible or not state then return end
	for _, c in content:GetChildren() do if not c:IsA("UIListLayout") then c:Destroy() end end
	for id, b in tabButtons do b.BackgroundColor3 = if id == panelOpen then rgb("primary") else rgb("surface2") end
	local gold = state.gold
	if panelOpen == "hire" then
		note(("금화 %dG · 전투 병력 %d/24 · 목수 %d/8"):format(gold, state.counts.fighters, state.counts.carpenters))
		row("활잡이 · 700G · HP100 피해12", { { "고용", function() send({ type = "hire", kind = "archer" }) end, "primary", gold < 700 } })
		row("장궁수 · 1,400G · HP150 피해34 관통4 사거리 560", { { "고용", function() send({ type = "hire", kind = "longbow" }) end, "primary", gold < 1400 } })
		row("목수 · 500G · 채집·건설·수리 (고용 즉시 빈 숲/광산으로)", { { "고용", function() send({ type = "hire", kind = "carpenter" }) end, "primary", gold < 500 } })
		if not state.leaderId then note("활잡이가 없습니다. 고용하면 그 병력이 내 캐릭터가 됩니다.") end
	elseif panelOpen == "growth" then
		local u, p = state.upgrades, state.prices
		note(("공업 %d/50 (피해 +2/단계, 간격 −0.6%%) · 방업 %d/30 (방어 +1) · 금화 %dG"):format(u.attack, u.armor, gold))
		row(("공격 강화 +1 · %sG"):format(p.attack1 and format(p.attack1) or "상한"), { { "+1", function() send({ type = "upgrade", stat = "attack", count = 1 }) end, "primary", not p.attack1 or gold < p.attack1 }, { ("+10 · %s"):format(p.attack10 and format(p.attack10) .. "G" or "상한"), function() send({ type = "upgrade", stat = "attack", count = 10 }) end, nil, not p.attack10 or gold < p.attack10 } })
		row(("방어 강화 +1 · %sG"):format(p.armor1 and format(p.armor1) or "상한"), { { "+1", function() send({ type = "upgrade", stat = "armor", count = 1 }) end, "primary", not p.armor1 or gold < p.armor1 }, { ("+10 · %s"):format(p.armor10 and format(p.armor10) .. "G" or "상한"), function() send({ type = "upgrade", stat = "armor", count = 10 }) end, nil, not p.armor10 or gold < p.armor10 } })
		local archers = {}
		for _, un in state.units do if un.kind == "archer" and not un.towerId and not un.garrisonTarget then table.insert(archers, un) end end
		local ids = {}
		for i = 1, math.min(3, #archers) do table.insert(ids, archers[i].id) end
		row(("영웅 합성 · 일반 활잡이 3 → 영웅 1 (HP300 피해40 Q/E) · 가능 %d/3"):format(#archers), { { "합성", function() send({ type = "combine", unitIds = ids }) end, "warning", #archers < 3 } })
	elseif panelOpen == "units" then
		note("전투 병력. 주둔은 완공된 내 탑에 최대 4명. 선두(내 캐릭터)는 주둔할 수 없습니다.")
		for _, un in state.units do
			if un.kind ~= "carpenter" then
				local d = Balance.UNITS[un.kind]
				local where = if un.towerId then "주둔 중" elseif un.garrisonTarget then "입장 중" elseif un.isLeader then "선두(나)" else "추종"
				local actions = {}
				if un.towerId or un.garrisonTarget then table.insert(actions, { "철수", function() send({ type = "ungarrison", unitIds = { un.id } }) end })
				elseif not un.isLeader then
					for _, t in state.towers do
						if t.state == "completed" and #t.occupants + #t.reservations < 4 then table.insert(actions, { ("탑%d 주둔"):format(t.id), function() send({ type = "garrison", unitIds = { un.id }, towerId = t.id }) end, "primary" }); break end
					end
				end
				row(("%s #%d · HP %d/%d · %s"):format(d.label, un.id, un.hp, un.maxHp, where), actions)
			end
		end
	elseif panelOpen == "workers" then
		note(("목수 %d명. 숲 6초 → 10G · 광석 10초 → 18G (노드당 3명). 탑 건설 220G·20초. 금화 %dG"):format(state.counts.carpenters, gold))
		for _, un in state.units do
			if un.kind == "carpenter" then
				local jobName = ({ wood = "벌목", mine = "채광", build = "건설", repair = "수리", ["return"] = "운반", idle = "대기" })[un.job or "idle"] or un.job
				row(("목수 #%d · HP %d · %s%s"):format(un.id, un.hp, jobName, if (un.cargo or 0) > 0 then (" (짐 %dG)"):format(un.cargo) else ""), {
					{ "숲", function() send({ type = "assign", unitId = un.id, job = "wood", nodeId = "wood_west" }) end },
					{ "광산", function() send({ type = "assign", unitId = un.id, job = "mine", nodeId = "ore_west" }) end },
					{ "탑 건설", function() placement = { workerId = un.id, x = nil, z = nil }; panel.Visible = false; panelOpen = nil; toast("탑을 세울 빈 땅을 탭하거나 클릭하세요 · 220G", "info") end, "primary", gold < 220 },
				})
			end
		end
		if state.counts.carpenters == 0 then note("목수가 없습니다. 고용소에서 500G 로 고용하세요.") end
	elseif panelOpen == "towers" then
		note("빈 탑은 공격하지 않습니다. 주둔자는 사거리 +60 으로 쏘고 탑이 피해를 받습니다.")
		for _, t in state.towers do
			local st = ({ travelling = "목수 이동 중", building = ("건설 %d%%"):format(t.progress * 100), paused = "공사 중단", completed = "완공" })[t.state] or t.state
			local actions = {}
			if t.state ~= "completed" then table.insert(actions, { "취소", function() send({ type = "cancelBuild", towerId = t.id }) end })
			else
				table.insert(actions, { "전원 철수", function() local ids = {} for _, id in t.occupants do table.insert(ids, id) end if #ids > 0 then send({ type = "ungarrison", unitIds = ids }) end end })
			end
			for _, un in state.units do if un.kind == "carpenter" then table.insert(actions, { "목수 수리", function() send({ type = "assign", unitId = un.id, job = "repair", towerId = t.id }) end }); break end end
			row(("탑 #%d · %s · HP %d/%d · 주둔 %d/4"):format(t.id, st, t.hp, t.maxHp, #t.occupants), actions)
		end
		if #state.towers == 0 then note("탑이 없습니다. 목수·건설 탭에서 지으세요.") end
	elseif panelOpen == "bestiary" then
		local order = { "zombie", "ghoul", "plague", "bat", "armored", "vampire", "enemy_tower" }
		for _, kind in order do
			local d = Balance.ENEMIES[kind]
			note(("%s · 체력 %d · 공격 %d/%.1f초 · 방어 %d · 사거리 %d · 보상 %dG%s"):format(d.label, d.hp, d.damage, d.rate, d.armor, d.range * 8, d.reward, if d.flying then " · 비행" else ""))
		end
		note(("정찰형(180초 전 웨이브)은 체력 12. 전초 파수꾼: 체력 600 · 공격 14 · 인식 320 · 추격 360 · 보상 180G. 가시 첨탑 예고 0.55초 뒤 반경 30 피해 12."))
	end
end
showPanel = function(tab)
	panelOpen = tab; panel.Visible = true; skillAim = nil; renderPanel()
end
missionAction.Activated:Connect(function() showPanel(tutorialTarget) end)
missionToggle.Activated:Connect(function() tutorialCollapsed = not tutorialCollapsed; missionDetail.Visible = not tutorialCollapsed; missionAction.Visible = not tutorialCollapsed; mission.Size = if tutorialCollapsed then UDim2.fromOffset(300, 34) else UDim2.fromOffset(300, 120); missionToggle.Text = if tutorialCollapsed then "다시 보기" else "감추기" end)

-- ── 배치 모드 ──────────────────────────────────────────────────────────────
local ghost = Instance.new("Part"); ghost.Anchored = true; ghost.CanCollide = false; ghost.CanQuery = false; ghost.Transparency = 0.5; ghost.Color = rgb("friendly"); ghost.Size = Vector3.new(12, 2, 12); ghost.Parent = nil
local placeBar = frame(gui, UDim2.fromOffset(360, 44), UDim2.new(0.5, -180, 1, -64))
placeBar.Visible = false
local placeText = label(placeBar, "탑 위치를 선택하세요 · 220G", UDim2.fromOffset(190, 44), UDim2.fromOffset(8, 12), 13)
button(placeBar, "이 위치에 건설", UDim2.fromOffset(100, 32), UDim2.new(1, -212, 0, 6), function()
	if placement and placement.x then send({ type = "build", workerId = placement.workerId, x = placement.x, z = placement.z }); placement = nil end
end, "primary")
button(placeBar, "취소", UDim2.fromOffset(64, 32), UDim2.new(1, -72, 0, 6), function() placement = nil end)

-- ── 스킬 조준 ──────────────────────────────────────────────────────────────
local function armSkill(skill)
	if not state or not state.leaderId then return end
	if skillAim == skill then skillAim = nil; toast("조준 취소", "info"); return end
	skillAim = skill
	toast(if skill == "multishot" then "다중 사격 방향을 탭하거나 클릭하세요 (다시 누르면 취소)" else "구르기 방향을 탭하거나 클릭하세요 (다시 누르면 취소)", "info")
end
skillQ.Activated:Connect(function() armSkill("multishot") end)
skillE.Activated:Connect(function() armSkill("roll") end)
Action:BindAction("ArcherSkillQ", function(_, inputState) if inputState == Enum.UserInputState.Begin then armSkill("multishot") end end, false, Enum.KeyCode.Q)
Action:BindAction("ArcherSkillE", function(_, inputState) if inputState == Enum.UserInputState.Begin then armSkill("roll") end end, false, Enum.KeyCode.E)

-- ── 전장 탭 (순서: 스킬 조준 > 배치 > 적 카드 > 아군 > 탑) ───────────────────
local function groundPoint(screen)
	local camera = workspace.CurrentCamera
	local ray = camera:ViewportPointToRay(screen.X, screen.Y)
	local params = RaycastParams.new(); params.FilterType = Enum.RaycastFilterType.Exclude
	params.FilterDescendantsInstances = { player.Character, workspace:FindFirstChild("ClientFx") }
	local hit = workspace:Raycast(ray.Origin, ray.Direction * 600, params)
	return hit
end
local function onTap(position)
	local hit = groundPoint(position)
	if not hit then return end
	local p = { x = hit.Position.X, z = hit.Position.Z }
	if skillAim then
		local leader = state and state.leader
		if leader then
			local dx, dz = p.x - leader.x, p.z - leader.z
			local length = math.sqrt(dx * dx + dz * dz)
			send({ type = "heroSkill", skill = skillAim, dx = dx, dz = dz, length = length })
		end
		skillAim = nil
		return
	end
	if placement then
		placement.x = math.floor(p.x / 4) * 4 - 4; placement.z = math.floor(p.z / 4) * 4 - 4
		return
	end
	local model = hit.Instance:FindFirstAncestorOfClass("Model")
	if model and model.Parent and model.Parent.Name == "ClientActors" then
		local flags = model:GetAttribute("flags") or 0
		if Packet.has(flags, Packet.FLAG.enemy) then selectedEnemy = model; refreshEnemyCard(); return end
		return
	end
	if model and model.Parent and model.Parent.Name == "Towers" then showPanel("towers"); return end
end
Input.InputBegan:Connect(function(input, processed)
	if processed then return end
	if input.UserInputType == Enum.UserInputType.MouseButton1 or input.UserInputType == Enum.UserInputType.Touch then
		local pos = input.Position
		-- 터치 스틱 영역(왼쪽 아래)은 이동이다
		local camera = workspace.CurrentCamera
		if input.UserInputType == Enum.UserInputType.Touch and pos.X < camera.ViewportSize.X * 0.35 and pos.Y > camera.ViewportSize.Y * 0.55 then return end
		onTap(Vector2.new(pos.X, pos.Y))
	end
end)

-- ── 로비 ───────────────────────────────────────────────────────────────────
local lobby = frame(gui, UDim2.fromScale(1, 1), UDim2.fromOffset(0, 0), "surface0", 0.15)
lobby.Visible = false
local lobbyBox = frame(lobby, UDim2.fromOffset(420, 260), UDim2.new(0.5, -210, 0.5, -130))
local lobbyTitle = label(lobbyBox, "궁수 키우기", UDim2.new(1, -32, 0, 36), UDim2.fromOffset(16, 16), Theme.titleSize)
local lobbyText = label(lobbyBox, "", UDim2.new(1, -32, 0, 80), UDim2.fromOffset(16, 60), 13)
lobbyText.TextColor3 = rgb("textSecondary")
local lobbyButtons = {}
local function lobbyShow(title, text, buttons)
	lobbyTitle.Text = title; lobbyText.Text = text
	for _, b in lobbyButtons do b:Destroy() end
	lobbyButtons = {}
	for i, b in buttons do table.insert(lobbyButtons, button(lobbyBox, b[1], UDim2.fromOffset(180, 40), UDim2.fromOffset(16 + (i - 1) * 196, 196), b[2], b[3])) end
	lobby.Visible = true
end
lobbyRemote.OnClientEvent:Connect(function(msg)
	if msg.type == "choose" then
		local studioNote = if msg.studio then "\nStudio: 저장은 메모리(TEST)입니다." else ""
		if msg.status == "ok" then
			lobbyShow("이어하기", "저장된 원정이 있습니다." .. studioNote, { { "이어하기", function() lobbyRemote:FireServer({ action = "continue" }) end, "primary" }, { "새 원정 (기록 덮어쓰기)", function() lobbyRemote:FireServer({ action = "new", overwrite = true }) end } })
		elseif msg.status == "none" then
			lobbyShow("새 원정", "활잡이 1명, 목수 0명, 금화 0으로 시작합니다. 8초 뒤 동쪽에서 첫 습격이 옵니다." .. studioNote, { { "원정 시작", function() lobbyRemote:FireServer({ action = "new" }) end, "primary" } })
		else
			lobbyShow("기록을 이어갈 수 없습니다", (msg.message or "") .. " 기존 기록은 보존됩니다. 새 원정을 시작하면 덮어씁니다." .. studioNote, { { "새 원정 (덮어쓰기)", function() lobbyRemote:FireServer({ action = "new", overwrite = true }) end, "warning" } })
		end
	elseif msg.type == "confirmOverwrite" then
		lobbyShow("기존 기록을 덮어쓸까요?", "새 원정을 시작하면 저장된 기록이 사라집니다.", { { "덮어쓰고 시작", function() lobbyRemote:FireServer({ action = "new", overwrite = true }) end, "warning" } })
	elseif msg.type == "waiting" then
		lobbyShow("대기 중", msg.text or "", {})
	elseif msg.type == "joinRequest" then
		lobby.Visible = false
		local box = frame(gui, UDim2.fromOffset(360, 90), UDim2.new(0.5, -180, 0, 110))
		label(box, (msg.name or "플레이어") .. " 님이 참가하려 합니다. 수락하면 협동 원정이 됩니다 (본진 +2000, 적 체력 ×1.5).", UDim2.new(1, -16, 0, 44), UDim2.fromOffset(8, 6), 12)
		button(box, "수락", UDim2.fromOffset(100, 28), UDim2.fromOffset(8, 54), function() lobbyRemote:FireServer({ action = "acceptCoop", accept = true }); box:Destroy() end, "primary")
		button(box, "거절", UDim2.fromOffset(100, 28), UDim2.fromOffset(116, 54), function() lobbyRemote:FireServer({ action = "acceptCoop", accept = false }); box:Destroy() end)
	elseif msg.type == "spectating" then
		lobbyShow("관전", msg.text or "", {})
		task.delay(3, function() if lobbyTitle.Text == "관전" then lobby.Visible = false end end)
	elseif msg.type == "playing" then
		myOwnerId = msg.ownerId
		lobby.Visible = false
		saveText.Text = if msg.studio then "TEST · 메모리 저장" else ""
	end
end)

-- ── 사건 ───────────────────────────────────────────────────────────────────
local lose = frame(gui, UDim2.fromScale(1, 1), UDim2.fromOffset(0, 0), "surface0", 0.3)
lose.Visible = false
local loseText = label(lose, "", UDim2.new(1, -64, 0, 120), UDim2.new(0, 32, 0.5, -60), 20, Enum.TextXAlignment.Center)
eventRemote.OnClientEvent:Connect(function(msg)
	if msg.type == "toast" then toast(msg.text, msg.kind)
	elseif msg.type == "result" then
		if msg.ok then
			if msg.command ~= "heroSkill" then toast(msg.message, "info") end
			if msg.command == "build" then placement = nil end
		else toast(msg.message, "error") end
		renderPanel()
	elseif msg.type == "saveStatus" then saveText.Text = msg.text or ""
	elseif msg.type == "lose" then
		lose.Visible = true
		loseText.Text = if msg.reason == "base" then "본진이 무너졌습니다.\n다시 서버에 들어오면 마지막 저장에서 이어집니다." else "병력도 금화도 남지 않았습니다. 원정 실패.\n다시 서버에 들어와 새 원정을 시작하세요."
	end
end)

stateRemote.OnClientEvent:Connect(function(view)
	state = view
	if view.spectator then resources.Text = "관전 중"; return end
	resources.Text = ("금화 %d · 병력 %d · 목수 %d%s"):format(view.gold, view.counts.fighters, view.counts.carpenters, if view.mode == "coop" then " · 협동" else "")
	waveLabel.Text = if view.wave.releasing then ("웨이브 %d · 출발 중 %d명"):format(view.wave.number, view.wave.releaseRemaining) else ("웨이브 %d · 다음 %d초"):format(view.wave.number, math.ceil(view.wave.next))
	baseBar.Size = UDim2.fromScale(math.clamp(view.base.hp / view.base.maxHp, 0, 1), 1)
	baseText.Text = ("본진 %d / %d"):format(view.base.hp, view.base.maxHp)
	if view.tutorial then missionTitle.Text = view.tutorial.title; missionDetail.Text = view.tutorial.detail; missionAction.Text = view.tutorial.action; tutorialTarget = view.tutorial.target end
	local hero = nil
	for _, u in view.units do if u.kind == "hero_archer" and not u.towerId then if not hero or u.isLeader then hero = u end end end
	skillQ.Visible = hero ~= nil; skillE.Visible = hero ~= nil
	if hero then
		skillQ.Text = if hero.multishotReady > 0 then ("%s · %.0f초"):format(QN, hero.multishotReady) else QN .. " · 준비됨"
		skillE.Text = if hero.rollReady > 0 then ("%s · %.0f초"):format(EN, hero.rollReady) else EN .. " · 준비됨"
	end
	renderPanel()
	refreshEnemyCard()
end)

Run.RenderStepped:Connect(function()
	if os.clock() - toastAt > 3.5 then toastLabel.Text = "" end
	placeBar.Visible = placement ~= nil
	if placement and placement.x then
		local y = Grid.heightAt(terrain, { x = placement.x + 6, z = placement.z + 6 })
		ghost.CFrame = CFrame.new(placement.x + 6, y + 1, placement.z + 6)
		ghost.Parent = workspace
		placeText.Text = ("탑 위치 (%d, %d) · 220G"):format(placement.x, placement.z)
	else
		ghost.Parent = nil
	end
end)
