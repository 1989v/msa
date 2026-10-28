--!nonstrict
-- HUD. 모바일 우선 — 왼쪽 위 내 상태, 위 가운데 타이머·모드, 오른쪽 위 명단, 왼쪽 아래 KO 피드. 로비 장비 패널·결과판은 가운데.
-- 조작 버튼은 Input 이 ContextActionService 로 만든다(기본 점프 버튼 둘레). 키 이름 안내는 두지 않는다.
local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local UserInputService = game:GetService("UserInputService")
local Shared = game:GetService("ReplicatedStorage"):WaitForChild("AmpArena")
local Config = require(Shared.Config)
local Styles = require(Shared.Styles)
local Accessories = require(Shared.Accessories)
local Theme = require(Shared.Theme)
local Remotes = Shared:WaitForChild("Remotes")
local Command, Fx, State = Remotes.Command, Remotes.Fx, Remotes.State
local player = Players.LocalPlayer

local touch = UserInputService.TouchEnabled and not UserInputService.KeyboardEnabled
local gui = Instance.new("ScreenGui"); gui.Name = "AmpHud"; gui.ResetOnSpawn = false; gui.IgnoreGuiInset = false; gui.Parent = player:WaitForChild("PlayerGui")

local function corner(o, r) local c = Instance.new("UICorner"); c.CornerRadius = UDim.new(0, r or 8); c.Parent = o end
local function frame(parent, size, pos, color, transparency)
	local f = Instance.new("Frame"); f.Size = size; f.Position = pos; f.BackgroundColor3 = color or Theme.surface0; f.BackgroundTransparency = transparency or 0.2; f.BorderSizePixel = 0; f.Parent = parent
	corner(f); return f
end
local function label(parent, text, size, pos, textSize, color, align, font)
	local l = Instance.new("TextLabel"); l.Size = size; l.Position = pos or UDim2.new(); l.BackgroundTransparency = 1; l.Text = text
	l.Font = font or Theme.fontBody; l.TextSize = textSize or 15; l.TextColor3 = color or Theme.textPrimary; l.TextXAlignment = align or Enum.TextXAlignment.Left; l.TextWrapped = true; l.Parent = parent
	return l
end
local function button(parent, text, size, pos, color)
	local b = Instance.new("TextButton"); b.Size = size; b.Position = pos or UDim2.new(); b.BackgroundColor3 = color or Theme.surface2; b.AutoButtonColor = true
	b.Text = text; b.Font = Theme.font; b.TextSize = 15; b.TextColor3 = Theme.textPrimary; b.TextWrapped = true; b.BorderSizePixel = 0; b.Parent = parent
	corner(b); return b
end
local function bar(parent, size, pos, color)
	local back = frame(parent, size, pos, Theme.surface2, 0); corner(back, 4)
	local fill = frame(back, UDim2.fromScale(1, 1), UDim2.new(), color, 0); corner(fill, 4)
	return fill
end
local function send(name, args) Command:FireServer(name, args or {}) end
local function teamColor(team) return if team == 1 then Theme.red elseif team == 2 then Theme.blue else Theme.textSecondary end

local state = nil

-- ───────── 내 상태(왼쪽 위) ─────────
local mine = frame(gui, UDim2.fromOffset(230, 96), UDim2.fromOffset(12, 12))
local myName = label(mine, "", UDim2.new(1, -16, 0, 22), UDim2.fromOffset(10, 4), 16, Theme.accent, nil, Theme.font)
local hpFill = bar(mine, UDim2.new(1, -20, 0, 12), UDim2.fromOffset(10, 30), Theme.healing)
local hpText = label(mine, "", UDim2.new(1, -20, 0, 12), UDim2.fromOffset(10, 30), 11, Theme.textPrimary, Enum.TextXAlignment.Center, Theme.font)
local guardFill = bar(mine, UDim2.new(1, -20, 0, 6), UDim2.fromOffset(10, 46), Theme.guard)
local skillText = label(mine, "", UDim2.new(1, -16, 0, 36), UDim2.fromOffset(10, 56), 12, Theme.textSecondary)

-- ───────── 위 가운데 ─────────
local top = frame(gui, UDim2.fromOffset(240, 56), UDim2.new(0.5, -120, 0, 12))
local timer = label(top, "", UDim2.new(1, 0, 0, 30), UDim2.fromOffset(0, 2), 28, Theme.textPrimary, Enum.TextXAlignment.Center, Theme.fontTitle)
local modeText = label(top, "", UDim2.new(1, 0, 0, 18), UDim2.fromOffset(0, 32), 12, Theme.textSecondary, Enum.TextXAlignment.Center)

-- ───────── 명단(오른쪽 위) ─────────
local rosterBox = frame(gui, UDim2.fromOffset(190, 8 + 22 * Config.LIMITS.fighters), UDim2.new(1, -202, 0, 12))
local rows = {}
for i = 1, Config.LIMITS.fighters do
	local r = frame(rosterBox, UDim2.new(1, -8, 0, 20), UDim2.fromOffset(4, 4 + (i - 1) * 22), Theme.surface1, 0.4); corner(r, 4)
	local nm = label(r, "", UDim2.new(1, -62, 1, 0), UDim2.fromOffset(6, 0), 12)
	local st = label(r, "", UDim2.fromOffset(52, 20), UDim2.new(1, -56, 0, 0), 11, Theme.textSecondary, Enum.TextXAlignment.Right)
	local hp = bar(r, UDim2.new(1, -12, 0, 3), UDim2.new(0, 6, 1, -5), Theme.healing)
	rows[i] = { r = r, nm = nm, st = st, hp = hp }
end

-- ───────── 피드(왼쪽 아래) ─────────
local feed = label(gui, "", UDim2.fromOffset(320, 80), UDim2.new(0, 12, 1, -(touch and 150 or 100)), 13, Theme.textSecondary)
feed.TextYAlignment = Enum.TextYAlignment.Bottom; feed.TextStrokeTransparency = 0.5
local feedLines = {}
local function addFeed(text)
	table.insert(feedLines, text); if #feedLines > 4 then table.remove(feedLines, 1) end
	feed.Text = table.concat(feedLines, "\n")
end

-- ───────── 로비 장비 패널 ─────────
local lobby = frame(gui, UDim2.fromOffset(420, 330), UDim2.new(0.5, -210, 0.5, -165), Theme.surface0, 0.08); lobby.Visible = false
label(lobby, "AMP ARENA", UDim2.new(1, 0, 0, 44), UDim2.fromOffset(0, 8), 40, Theme.accent, Enum.TextXAlignment.Center, Theme.fontTitle)
local lobbyHint = label(lobby, "", UDim2.new(1, -24, 0, 20), UDim2.fromOffset(12, 50), 13, Theme.textSecondary, Enum.TextXAlignment.Center)
local styleButtons = {}
for i, id in Styles.ORDER do
	local st = Styles.get(id)
	local b = button(lobby, st.label, UDim2.fromOffset(74, 40), UDim2.fromOffset(12 + (i - 1) * 80, 76))
	b.Activated:Connect(function()
		local cur = state and state.me.loadout or { style = "fighter", accessory = "none" }
		local acc = cur.accessory ~= "none" and st.accessory or "none"
		send("loadout", { style = id, accessory = acc })
	end)
	styleButtons[id] = b
end
local styleDesc = label(lobby, "", UDim2.new(1, -24, 0, 54), UDim2.fromOffset(12, 122), 13, Theme.textSecondary)
local accButton = button(lobby, "", UDim2.new(1, -24, 0, 44), UDim2.fromOffset(12, 180), Theme.surface2)
local accDesc = label(lobby, "", UDim2.new(1, -24, 0, 40), UDim2.fromOffset(12, 226), 12, Theme.textSecondary)
accButton.Activated:Connect(function()
	local cur = state and state.me.loadout; if not cur then return end
	local own = Styles.get(cur.style).accessory
	send("loadout", { style = cur.style, accessory = cur.accessory == "none" and own or "none" })
end)
local readyButton = button(lobby, "준비", UDim2.new(1, -24, 0, 44), UDim2.fromOffset(12, 274), Theme.primary)
readyButton.Activated:Connect(function() send("ready") end)

-- ───────── 결과 ─────────
local resultBox = frame(gui, UDim2.fromOffset(380, 330), UDim2.new(0.5, -190, 0.5, -165), Theme.surface0, 0.08); resultBox.Visible = false
local resultTitle = label(resultBox, "결과", UDim2.new(1, 0, 0, 44), UDim2.fromOffset(0, 8), 36, Theme.accent, Enum.TextXAlignment.Center, Theme.fontTitle)
local resultBody = label(resultBox, "", UDim2.new(1, -24, 1, -70), UDim2.fromOffset(12, 56), 14, Theme.textPrimary)
resultBody.TextYAlignment = Enum.TextYAlignment.Top

-- ───────── 로비 대기 안내(매치 밖에서 죽었을 때) ─────────
local waitText = label(gui, "", UDim2.fromOffset(320, 30), UDim2.new(0.5, -160, 0.3, 0), 16, Theme.textSecondary, Enum.TextXAlignment.Center, Theme.font)

-- ───────── 상태 반영 ─────────
local function fmtTime(s) s = math.max(0, math.floor(s + 0.999)); return string.format("%d:%02d", s // 60, s % 60) end
State.OnClientEvent:Connect(function(s)
	state = s
	local me = s.me
	local playing = s.phase == "match" or s.phase == "countdown"
	mine.Visible = playing and me.alive
	rosterBox.Visible = playing or s.phase == "result"
	lobby.Visible = s.phase == "lobby"
	resultBox.Visible = s.phase == "result"
	waitText.Text = if (playing and not me.alive) then "다음 라운드까지 로비에서 기다린다" else ""
	-- 위 가운데
	if s.phase == "lobby" then
		timer.Text = fmtTime(s.timeLeft)
		modeText.Text = string.format("준비 %d/%d · 전원 준비면 바로 시작", s.readyCount, s.humans)
	elseif s.phase == "result" then
		timer.Text = "결과"; modeText.Text = string.format("%d초 뒤 로비", math.ceil(s.timeLeft))
	else
		timer.Text = fmtTime(s.timeLeft)
		timer.TextColor3 = (s.phase == "match" and s.timeLeft <= Config.MATCH.endWarning) and Theme.danger or Theme.textPrimary
		modeText.Text = string.format("%s · %s", Config.MAPS[s.map] and Config.MAPS[s.map].label or "", Config.MODES[s.mode] and Config.MODES[s.mode].label or "")
	end
	-- 내 상태
	local st = Styles.get(me.loadout.style); local acc = Accessories.get(me.loadout.accessory)
	myName.Text = string.format("%s · %s", st.label, acc.label)
	guardFill.Size = UDim2.fromScale(me.guard / Config.GUARD.max, 1)
	local parts = {}
	table.insert(parts, me.specialIn > 0 and string.format("기술 %.1f초", me.specialIn) or "기술 준비")
	if acc.ammo > 0 then table.insert(parts, me.reloadIn > 0 and string.format("재장전 %.1f", me.reloadIn) or string.format("탄 %d", me.ammo)) end
	if me.holding then table.insert(parts, "폭탄 들고 있음 · 공격으로 던진다") end
	skillText.Text = table.concat(parts, " · ")
	-- 명단
	local list = s.roster
	table.sort(list, function(a, b) if a.ko ~= b.ko then return a.ko > b.ko end; return a.name < b.name end)
	for i, row in rows do
		local e = list[i]
		row.r.Visible = e ~= nil
		if e then
			row.nm.Text = (e.bot and "🤖 " or "") .. e.name; row.nm.TextColor3 = e.alive and Theme.textPrimary or Theme.textSecondary
			row.st.Text = string.format("%d / %d", e.ko, e.deaths); row.st.TextColor3 = teamColor(e.team)
			row.hp.Size = UDim2.fromScale(e.maxHp > 0 and math.clamp(e.hp / e.maxHp, 0, 1) or 0, 1)
			row.hp.BackgroundColor3 = e.team ~= 0 and teamColor(e.team) or Theme.healing
		end
	end
	-- 로비 패널
	if s.phase == "lobby" then
		for id, b in styleButtons do b.BackgroundColor3 = id == me.loadout.style and Theme.primary or Theme.surface2 end
		styleDesc.Text = st.desc
		local own = Accessories.get(st.accessory)
		accButton.Text = me.loadout.accessory == "none" and ("맨손 → " .. own.label .. " 들기") or (own.label .. " → 맨손")
		accDesc.Text = me.loadout.accessory == "none" and ("전용 액세서리: " .. own.desc) or acc.desc
		readyButton.Text = me.ready and "준비 취소" or "준비"
		readyButton.BackgroundColor3 = me.ready and Theme.healing or Theme.primary
		lobbyHint.Text = string.format("스타일과 액세서리를 고른다 · %s · 인원 %d", s.humans < Config.BOTS.fillTo and string.format("봇 %d이 채운다", Config.BOTS.fillTo - s.humans) or "봇 없음", s.humans)
	end
end)

-- 내 체력은 매 프레임 Humanoid 에서
RunService.RenderStepped:Connect(function()
	local c = player.Character; local hum = c and c:FindFirstChildOfClass("Humanoid")
	if not hum then return end
	local k = hum.MaxHealth > 0 and math.clamp(hum.Health / hum.MaxHealth, 0, 1) or 0
	hpFill.Size = UDim2.fromScale(k, 1)
	hpFill.BackgroundColor3 = k > 0.5 and Theme.healing or k > 0.25 and Theme.warning or Theme.danger
	hpText.Text = string.format("%d / %d", math.floor(hum.Health), math.floor(hum.MaxHealth))
end)

Fx.OnClientEvent:Connect(function(kind, a, b, c)
	if kind == "feed" then
		if c == "ringout" then addFeed(string.format("%s 링아웃%s", a, b and (" · " .. b) or ""))
		elseif b then addFeed(string.format("%s → %s KO", b, a))
		else addFeed(string.format("%s KO", a)) end
	elseif kind == "result" then
		local r = a
		local lines = {}
		if r.teams then
			for i, t in r.teams do table.insert(lines, string.format("%d위  %s팀  KO %d · 데스 %d · 피해 %d", i, t.team == 1 and "레드" or "블루", t.ko, t.deaths, math.floor(t.damage))) end
			table.insert(lines, "")
		end
		for i, e in r.ranked do
			table.insert(lines, string.format("%s%d. %s  KO %d · 데스 %d · 피해 %d", r.winners[e.id] and "★ " or "", i, e.name, e.ko, e.deaths, math.floor(e.damage)))
		end
		local mine = nil
		for _, e in r.ranked do if e.id == player.UserId then mine = e end end
		resultTitle.Text = mine and r.winners[mine.id] and "승리" or (r.reason == "lastone" and "결과" or "시간 종료")
		resultBody.Text = table.concat(lines, "\n")
		feedLines = {}; feed.Text = ""
	end
end)
