--!nonstrict
-- 서버 투사체(쌍권총 탄·로켓 펀치). Heartbeat 마다 한 걸음씩 나가며 벽은 레이캐스트로, 파이터는 거리로 판정한다.
-- 클라이언트는 발사 Fx 를 받아 같은 속도로 탄을 그린다(예측). 명중·벽 충돌은 Fx 로 따로 알린다.
local Shared = game:GetService("ReplicatedStorage"):WaitForChild("AmpArena")
local Config = require(Shared.Config)
local Moves = require(Shared.Moves)
local Combat = require(script.Parent.Combat)

local Projectiles = {}
Projectiles.hooks = { fx = function() end }
local alive = {}
local params = RaycastParams.new()
params.FilterType = Enum.RaycastFilterType.Exclude
params.IgnoreWater = true

local function pseudo(move, spec)
	return { id = move.id, damage = move.damage, effect = spec.effect, hitstun = move.hitstun, push = move.push, launchH = move.launchH, launchV = move.launchV,
		guardBreak = false, arcDeg = 360, radius = spec.radius, reach = 0, multiHit = 0, superArmor = false }
end

function Projectiles.fire(F, move, t)
	local spec = Moves.PROJECTILE[move.id]
	if not spec then return end
	if #alive >= Config.PROJECTILE.maxAlive then return end
	local look = Combat.look(F)
	local origin = F.root.Position + look * 2 + Vector3.new(0, 1.2, 0)
	local n = spec.fanCount
	for i = 1, n do
		local ang = n > 1 and math.rad(-spec.fanDeg / 2 + spec.fanDeg * (i - 1) / (n - 1)) or 0
		local dir = (CFrame.fromAxisAngle(Vector3.yAxis, ang) * look).Unit
		table.insert(alive, { owner = F, pos = origin, dir = dir, spec = spec, move = pseudo(move, spec), traveled = 0, kind = move.id })
		Projectiles.hooks.fx("projectile", origin, dir, spec.speed, spec.range, move.id)
	end
end

function Projectiles.update(dt)
	if #alive == 0 then return end
	local t = Combat.time()
	local exclude = {}
	for _, F in Combat.all() do table.insert(exclude, F.model) end
	params.FilterDescendantsInstances = exclude
	for i = #alive, 1, -1 do
		local p = alive[i]
		local step = p.dir * p.spec.speed * dt
		local hit = workspace:Raycast(p.pos, step, params)
		local done = false
		if hit then
			Projectiles.hooks.fx("impact", hit.Position, p.kind)
			done = true
		else
			local np = p.pos + step
			for _, V in Combat.all() do
				if V == p.owner or V.state == "dead" or not V.model.Parent then continue end
				local d = Vector3.new(V.root.Position.X - np.X, 0, V.root.Position.Z - np.Z)
				if d.Magnitude <= p.spec.radius + Config.PLAYER.bodyRadius and math.abs(V.root.Position.Y - np.Y) <= 3.5 then
					Combat.applyHit(p.owner, V, p.move, t, { dir = p.dir })
					Projectiles.hooks.fx("impact", np, p.kind)
					done = true
					break
				end
			end
			p.pos = np
			p.traveled += step.Magnitude
			if p.traveled >= p.spec.range then done = true end
		end
		if done then table.remove(alive, i) end
	end
end
function Projectiles.clear() alive = {} end
function Projectiles.count() return #alive end

return Projectiles
