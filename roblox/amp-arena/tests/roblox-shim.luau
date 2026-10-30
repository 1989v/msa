--!nonstrict
-- 서버 모듈(Combat·Bots)을 Roblox 밖(luau CLI)에서 돌리기 위한 Roblox API 대역.
-- 실제 게임 코드가 쓰는 것만 흉내 낸다: Vector3/Vector2/CFrame(위치·LookVector 만), Enum, Instance(속성 가방 + 부모/자식), 신호, workspace 시계·바닥 레이캐스트, Random, task.
-- 물리는 step(dt) 가 한다 — Humanoid:MoveTo 걷기(AutoRotate 포함), LinearVelocity(Plane/Vector), 중력·착지·FloorMaterial.
-- 회전은 LookVector 하나로만 다룬다(관절·Weld 의 C0 는 저장만). 이 대역으로 통과했다는 것은 「로직이 돈다」까지지 Studio 검증이 아니다.
local Shim = {}

-- ───────── Vector3 ─────────
local V3 = {}
V3.__index = function(t, k)
	if k == "Magnitude" then return math.sqrt(t.X * t.X + t.Y * t.Y + t.Z * t.Z) end
	if k == "Unit" then local m = t.Magnitude; return V3.new(t.X / m, t.Y / m, t.Z / m) end
	return V3[k]
end
function V3.new(x, y, z) return setmetatable({ X = x or 0, Y = y or 0, Z = z or 0 }, V3) end
V3.__add = function(a, b) return V3.new(a.X + b.X, a.Y + b.Y, a.Z + b.Z) end
V3.__sub = function(a, b) return V3.new(a.X - b.X, a.Y - b.Y, a.Z - b.Z) end
V3.__unm = function(a) return V3.new(-a.X, -a.Y, -a.Z) end
V3.__mul = function(a, b)
	if type(a) == "number" then return V3.new(a * b.X, a * b.Y, a * b.Z) end
	if type(b) == "number" then return V3.new(a.X * b, a.Y * b, a.Z * b) end
	return V3.new(a.X * b.X, a.Y * b.Y, a.Z * b.Z)
end
V3.__div = function(a, b)
	if type(b) == "number" then return V3.new(a.X / b, a.Y / b, a.Z / b) end
	return V3.new(a.X / b.X, a.Y / b.Y, a.Z / b.Z)
end
V3.__eq = function(a, b) return a.X == b.X and a.Y == b.Y and a.Z == b.Z end
V3.__tostring = function(a) return string.format("(%.2f, %.2f, %.2f)", a.X, a.Y, a.Z) end
function V3:Dot(b) return self.X * b.X + self.Y * b.Y + self.Z * b.Z end
function V3:Cross(b) return V3.new(self.Y * b.Z - self.Z * b.Y, self.Z * b.X - self.X * b.Z, self.X * b.Y - self.Y * b.X) end
function V3:Lerp(b, k) return self + (b - self) * k end
V3.zero = V3.new(0, 0, 0); V3.one = V3.new(1, 1, 1); V3.xAxis = V3.new(1, 0, 0); V3.yAxis = V3.new(0, 1, 0); V3.zAxis = V3.new(0, 0, 1)
Shim.Vector3 = V3

local V2 = {}; V2.__index = V2
function V2.new(x, y) return setmetatable({ X = x or 0, Y = y or 0 }, V2) end
V2.zero = V2.new()
Shim.Vector2 = V2

-- ───────── CFrame(위치 + 바라보는 방향) ─────────
local CF = {}; CF.__index = CF
local function cf(pos, look)
	look = look or V3.new(0, 0, -1)
	local right = look:Cross(V3.yAxis)
	if right.Magnitude < 1e-6 then right = V3.xAxis else right = right.Unit end
	return setmetatable({ Position = pos, LookVector = look, RightVector = right, UpVector = right:Cross(look) }, CF)
end
function CF.new(x, y, z)
	if x == nil then return cf(V3.zero) end
	if type(x) == "table" then return cf(x) end
	return cf(V3.new(x, y, z))
end
function CF.lookAt(from, to)
	local d = to - from
	return cf(from, d.Magnitude > 1e-6 and d.Unit or V3.new(0, 0, -1))
end
function CF.Angles() return cf(V3.zero) end -- 회전은 추적하지 않는다
CF.__mul = function(a, b)
	local p = a.Position + a.RightVector * b.Position.X + a.UpVector * b.Position.Y - a.LookVector * b.Position.Z
	return cf(p, a.LookVector)
end
function CF:Inverse() return cf(-self.Position, self.LookVector) end
CF.identity = cf(V3.zero)
Shim.CFrame = CF

-- ───────── Enum: 이름만 있으면 되는 항목 ─────────
Shim.Enum = setmetatable({}, { __index = function(t, k)
	local e = setmetatable({}, { __index = function(t2, k2) local v = { Name = k2, EnumType = k }; rawset(t2, k2, v); return v end })
	rawset(t, k, e); return e
end })

-- ───────── 신호 ─────────
local function signal()
	local s = { fns = {} }
	function s:Connect(fn) table.insert(self.fns, fn); return { Disconnect = function() end } end
	function s:Fire(...) for _, fn in self.fns do fn(...) end end
	return s
end
Shim.signal = signal

-- ───────── Instance ─────────
local Inst = {}
local methods = {}
Inst.__index = function(t, k)
	local m = methods[k]; if m then return m end
	local p = rawget(t, "_p")
	local v = p[k]; if v ~= nil then return v end
	for _, c in p._children do if c._p.Name == k then return c end end
	return nil
end
Inst.__newindex = function(t, k, v)
	local p = rawget(t, "_p")
	if k == "Parent" then
		local old = p.Parent
		if old and old._p then
			for i, c in old._p._children do if c == t then table.remove(old._p._children, i); break end end
		end
		p.Parent = v
		if v and rawget(v, "_p") then table.insert(v._p._children, t) end
		return
	end
	if k == "CFrame" then p.CFrame = v; p.Position = v.Position; return end
	if k == "Position" then p.Position = v; p.CFrame = cf(v, p.CFrame and p.CFrame.LookVector or nil); return end
	p[k] = v
end
local BASEPART = { Part = true, MeshPart = true, UnionOperation = true }
function methods:IsA(c) return self._p.ClassName == c or (c == "BasePart" and BASEPART[self._p.ClassName] == true) or (c == "Instance") end
function methods:Destroy() self.Parent = nil; self._p.destroyed = true end
function methods:GetChildren() local out = {}; for _, c in self._p._children do table.insert(out, c) end; return out end
function methods:GetDescendants()
	local out = {}
	local function walk(n) for _, c in n._p._children do table.insert(out, c); walk(c) end end
	walk(self); return out
end
function methods:FindFirstChild(name, recursive)
	for _, c in self._p._children do if c._p.Name == name then return c end end
	if recursive then for _, c in self._p._children do local f = c:FindFirstChild(name, true); if f then return f end end end
	return nil
end
function methods:WaitForChild(name) return self:FindFirstChild(name) end
function methods:FindFirstChildOfClass(c) for _, ch in self._p._children do if ch._p.ClassName == c then return ch end end; return nil end
function methods:FindFirstChildWhichIsA(c, recursive)
	for _, ch in self._p._children do if ch:IsA(c) then return ch end end
	if recursive then for _, ch in self._p._children do local f = ch:FindFirstChildWhichIsA(c, true); if f then return f end end end
	return nil
end
function methods:SetAttribute(k, v) self._p._attrs[k] = v end
function methods:GetAttribute(k) return self._p._attrs[k] end
function methods:GetPivot()
	local pp = self._p.PrimaryPart or self:FindFirstChildWhichIsA("BasePart", true)
	return pp and pp.CFrame or cf(V3.zero)
end
function methods:MoveTo(target) self._p.moveTarget = target end
function methods:SetStateEnabled() end
function methods:LoadAnimation() error("no Animator in shim") end
function methods:GetPropertyChangedSignal() return signal() end

local DEFAULTS = {
	Humanoid = function(p)
		p.Health = 100; p.MaxHealth = 100; p.WalkSpeed = 16; p.JumpPower = 50; p.AutoRotate = true; p.PlatformStand = false
		p.FloorMaterial = Shim.Enum.Material.Grass; p.MoveDirection = V3.zero; p.Died = signal(); p.RigType = Shim.Enum.HumanoidRigType.R6
	end,
	Part = function(p) p.Position = V3.zero; p.CFrame = cf(V3.zero); p.Size = V3.new(1, 1, 1); p.AssemblyLinearVelocity = V3.zero; p.Anchored = false; p.CanCollide = true end,
	LinearVelocity = function(p) p.Enabled = false; p.VectorVelocity = V3.zero; p.PlaneVelocity = V2.zero end,
	Attachment = function(p) p.Position = V3.zero end,
}
function Shim.Instance_new(class, parent)
	local self = setmetatable({ _p = { ClassName = class, Name = class, Parent = nil, _children = {}, _attrs = {} } }, Inst)
	if DEFAULTS[class] then DEFAULTS[class](self._p) end
	if parent then self.Parent = parent end
	return self
end
Shim.Instance = { new = Shim.Instance_new }

-- ───────── workspace · game · 시계 · 바닥 ─────────
Shim.clock = 1000
Shim.groundY = 0          -- 바닥 높이. HRP 는 서 있을 때 Y = groundY + 3
Shim.arenaHalf = 60       -- |X|,|Z| ≤ arenaHalf 안에만 바닥이 있다(가장자리 탐침 검증용)
local workspace = Shim.Instance_new("Workspace")
workspace._p.GetServerTimeNow = function() return Shim.clock end
workspace._p.Raycast = function(_, from, dir)
	local toY = from.Y + dir.Y
	if from.Y >= Shim.groundY and toY <= Shim.groundY and math.abs(from.X) <= Shim.arenaHalf and math.abs(from.Z) <= Shim.arenaHalf then
		return { Position = V3.new(from.X, Shim.groundY, from.Z), Instance = workspace }
	end
	return nil
end
Shim.workspace = workspace

Shim.shared = {}
function Shim.configure(opts)
	for _, name in { "Config", "Moves", "Rules", "Styles", "Accessories", "Poses", "Theme" } do Shim.shared[name] = opts.sharedPrefix .. name end
end
local services = {}
Shim.game = {
	GetService = function(_, name)
		if services[name] then return services[name] end
		local s
		if name == "ReplicatedStorage" or name == "ServerStorage" then
			s = { WaitForChild = function() return Shim.shared end, FindFirstChild = function() return Shim.shared end }
		elseif name == "CollectionService" then
			local tags = {}
			s = {
				AddTag = function(_, inst, tag) tags[tag] = tags[tag] or {}; tags[tag][inst] = true end,
				RemoveTag = function(_, inst, tag) if tags[tag] then tags[tag][inst] = nil end end,
				HasTag = function(_, inst, tag) return tags[tag] ~= nil and tags[tag][inst] == true end,
				GetTagged = function(_, tag) local out = {}; for inst in tags[tag] or {} do table.insert(out, inst) end; return out end,
			}
		else
			s = setmetatable({}, { __index = function() return function() end end })
		end
		services[name] = s
		return s
	end,
}

Shim.timers = {}
Shim.task = {
	wait = function() end,
	delay = function(s, fn, ...) local args = { ... }; table.insert(Shim.timers, { at = Shim.clock + s, fn = function() fn(table.unpack(args)) end }) end,
	spawn = function(fn, ...) fn(...) end,
	defer = function(fn, ...) fn(...) end,
}
Shim.Random = { new = function(seed) math.randomseed(seed or 1); return {
	NextNumber = function(_, a, b) local r = math.random(); if a then return a + r * (b - a) end; return r end,
	NextInteger = function(_, a, b) return math.random(a, b) end,
} end }
Shim.RaycastParams = { new = function() return { FilterDescendantsInstances = {} } end }
Shim.Color3 = { fromRGB = function(r, g, b) return { R = r / 255, G = g / 255, B = b / 255 } end, new = function(r, g, b) return { R = r, G = g, B = b } end }

-- ───────── 몸(물리) ─────────
Shim.bodies = {}
function Shim.addBody(model, hum, root)
	local b = { model = model, hum = hum, root = root, vy = 0 }
	table.insert(Shim.bodies, b)
	return b
end
local GRAVITY = 196.2
function Shim.step(dt)
	Shim.clock += dt
	for _, b in Shim.bodies do
		if not b.model.Parent then continue end
		local hum, root = b.hum, b.root
		local p = root.Position
		local lv = root:FindFirstChildOfClass("LinearVelocity")
		local lvOn = lv ~= nil and lv.Enabled == true
		local look = root.CFrame.LookVector
		if lvOn and lv.VelocityConstraintMode == Shim.Enum.VelocityConstraintMode.Plane then
			p = V3.new(p.X + lv.PlaneVelocity.X * dt, p.Y, p.Z + lv.PlaneVelocity.Y * dt)
		elseif lvOn then
			p = p + lv.VectorVelocity * dt
			b.vy = lv.VectorVelocity.Y
		elseif not hum.PlatformStand and hum._p.moveTarget and hum.WalkSpeed > 0 then
			local tgt = hum._p.moveTarget
			local d = V3.new(tgt.X - p.X, 0, tgt.Z - p.Z)
			if d.Magnitude < 0.3 then hum._p.moveTarget = nil
			else
				local stepLen = math.min(d.Magnitude, hum.WalkSpeed * dt)
				p = p + d.Unit * stepLen
				if hum.AutoRotate then look = d.Unit end
			end
		end
		-- 중력·착지
		if not (lvOn and lv.VelocityConstraintMode ~= Shim.Enum.VelocityConstraintMode.Plane) then
			b.vy -= GRAVITY * dt
			p = V3.new(p.X, p.Y + b.vy * dt, p.Z)
		end
		local standY = Shim.groundY + 3
		if p.Y <= standY and (math.abs(p.X) <= Shim.arenaHalf and math.abs(p.Z) <= Shim.arenaHalf) then
			p = V3.new(p.X, standY, p.Z); b.vy = 0; hum.FloorMaterial = Shim.Enum.Material.Grass
		else
			hum.FloorMaterial = Shim.Enum.Material.Air
		end
		root.CFrame = cf(p, look)
		if hum.Health <= 0 and not b.diedFired then b.diedFired = true; hum.Died:Fire() end
	end
	local due = {}
	for i = #Shim.timers, 1, -1 do
		if Shim.timers[i].at <= Shim.clock then table.insert(due, table.remove(Shim.timers, i)) end
	end
	for _, tm in due do tm.fn() end
end

return Shim
