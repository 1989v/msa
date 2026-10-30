--!nonstrict
-- 연습 봇. 같은 Combat 상태 머신에 의도만 넣는다. 접근·사슬·가끔 가드·대시·기술·하트 줍기, 절벽 앞에서는 멈춘다(웹 참고작에서 봇 사망 36% 가 자멸이었다).
local Shared = game:GetService("ReplicatedStorage"):WaitForChild("AmpArena")
local Config = require(Shared.Config)
local Rules = require(Shared.Rules)
local Combat = require(script.Parent.Combat)
local Items = require(script.Parent.Items)
local Rigs = require(script.Parent.Rigs)

local Bots = {}
local random = Random.new()
local bots = {}
local rayParams = RaycastParams.new()
rayParams.FilterType = Enum.RaycastFilterType.Exclude

local function now() return workspace:GetServerTimeNow() end

function Bots.attach(F)
	F.bot = { nextThink = 0, target = nil, retarget = 0, nextAction = 0, guardUntil = 0, plan = {}, lastYaw = nil }
	bots[F.id] = F
end
function Bots.detach(id) bots[id] = nil end
function Bots.clear() bots = {} end

local function enemies(F)
	local out = {}
	for _, V in Combat.all() do
		if V ~= F and V.state ~= "dead" and V.model.Parent and (F.team == 0 or V.team ~= F.team) then table.insert(out, V) end
	end
	return out
end
local function nearest(F)
	local best, bd = nil, math.huge
	for _, V in enemies(F) do
		local d = (V.root.Position - F.root.Position).Magnitude
		if d < bd then best, bd = V, d end
	end
	return best, bd
end
-- 앞쪽 edgeProbe 지점 아래에 바닥이 있는가
local function groundAhead(F, dir)
	local exclude = {}
	for _, V in Combat.all() do table.insert(exclude, V.model) end
	rayParams.FilterDescendantsInstances = exclude
	local from = F.root.Position + dir * Config.BOTS.edgeProbe + Vector3.new(0, 1, 0)
	return workspace:Raycast(from, Vector3.new(0, -12, 0), rayParams) ~= nil
end
local function face(F, target)
	local p = F.root.Position
	local look = Vector3.new(target.X - p.X, 0, target.Z - p.Z)
	if look.Magnitude < 0.5 then return end
	F.root.CFrame = CFrame.lookAt(p, p + look.Unit)
end
local function moveToward(F, target)
	local p = F.root.Position
	local dir = Vector3.new(target.X - p.X, 0, target.Z - p.Z)
	if dir.Magnitude < 0.5 then F.hum:MoveTo(p); return false end
	dir = dir.Unit
	local side = dir:Cross(Vector3.yAxis)
	local step = Rules.botMove(groundAhead(F, dir), groundAhead(F, side))
	if step == "forward" then F.hum:MoveTo(p + dir * 6); return true end
	if step == "side" then F.hum:MoveTo(p + side * 4) else F.hum:MoveTo(p) end
	return false
end

local function think(F, t)
	local b = F.bot
	local s = F.state
	if s == "held" then
		if t >= b.nextAction then Combat.intent(F, "light"); b.nextAction = t + 0.15 end
		return
	end
	-- 잡았으면 던진다(안 던지면 2초 뒤 저절로 놓는다 — 봇이 잡고만 있다가 놓는 모습이 그 버그였다)
	if s == "grabbing" then
		if t >= b.nextAction then Combat.intent(F, "light"); b.nextAction = t + 0.3 end
		return
	end
	if s ~= "idle" and s ~= "guard" then return end
	if s == "guard" then
		if t >= b.guardUntil then Combat.intent(F, "guard", { on = false }) end
		return
	end
	-- 예약된 사슬 입력
	if #b.plan > 0 and t >= b.nextAction then
		local kind = table.remove(b.plan, 1)
		Combat.intent(F, kind)
		b.nextAction = t + 0.35
		return
	end
	if t >= b.retarget or not b.target or b.target.state == "dead" or not b.target.model.Parent then
		b.target = nearest(F); b.retarget = t + 1
	end
	-- 다쳤으면 하트
	if F.hum.Health < F.hum.MaxHealth * 0.5 then
		local heart = Items.nearest("heart", F.root.Position, 30)
		if heart then moveToward(F, heart:GetPivot().Position); Rigs.animate(F.model, F.hum, true); return end
	end
	-- 가까운 폭탄은 가끔 줍는다
	if not F.item and random:NextNumber() < 0.02 then
		local bomb = Items.nearest("bomb", F.root.Position, 14)
		if bomb then
			if (bomb.model:GetPivot().Position - F.root.Position).Magnitude < Config.ITEMS.pickupDistance then Items.pickupBy(F, bomb)
			else moveToward(F, bomb.model:GetPivot().Position) end
			return
		end
	end
	local T = b.target
	if not T then F.hum:MoveTo(F.root.Position); Rigs.animate(F.model, F.hum, false); return end
	local tp = T.root.Position
	local d = (Vector3.new(tp.X, 0, tp.Z) - Vector3.new(F.root.Position.X, 0, F.root.Position.Z)).Magnitude
	if F.item then
		if d < 20 and t >= b.nextAction then face(F, tp); Combat.intent(F, "throw"); b.nextAction = t + 0.5; return end
	end
	-- 교전 거리는 사슬의 최소 리치 — 7 스터드처럼 리치 끝에 서면 판정 원 가장자리라 헛친다
	local engage = Rules.engageDistance(F.loadout.style, F.loadout.accessory)
	if d > engage then
		if d < 18 and d > 9 and t >= F.dashReadyAt and random:NextNumber() < 0.15 then face(F, tp); Combat.intent(F, "dash"); b.nextAction = t + 0.25; return end
		local moving = moveToward(F, tp)
		Rigs.animate(F.model, F.hum, moving)
		return
	end
	F.hum:MoveTo(F.root.Position)
	Rigs.animate(F.model, F.hum, false)
	face(F, tp)
	if t < b.nextAction then return end
	local r = random:NextNumber()
	if T.state == "attack" and r < Config.BOTS.guardChance then
		Combat.intent(F, "guard", { on = true }); b.guardUntil = t + 0.6; b.nextAction = t + 0.7
		return
	end
	if t >= F.specialReadyAt and r < 0.25 then Combat.intent(F, "special"); b.nextAction = t + 0.6; return end
	if r < Config.BOTS.guardChance + Config.BOTS.heavyChance then
		Combat.intent(F, "heavy"); b.plan = { "heavy" }
	else
		Combat.intent(F, "light"); b.plan = { "light", random:NextNumber() < 0.5 and "light" or "heavy" }
	end
	b.nextAction = t + Config.BOTS.reaction + 0.2
end

function Bots.update(dt)
	local t = now()
	for id, F in bots do
		if not F.model.Parent or F.state == "dead" then continue end
		if t >= F.bot.nextThink then F.bot.nextThink = t + 0.1; think(F, t) end
	end
end
function Bots.count() local n = 0; for _ in bots do n += 1 end; return n end

return Bots
