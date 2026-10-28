--!nonstrict
-- 파이터 상태 머신. 서버 Heartbeat 가 입력 의도·타이밍·판정·피해·넉백을 결정한다. 클라이언트는 의도와 연출만.
-- 상태: idle · attack(move) · guard · hitstun · launched · down · getup · held · grabbing · stun · dead
-- 넉백·대시·띄움은 파이터당 LinearVelocity 하나를 켜고 끄며 쓴다(클라이언트 소유 캐릭터도 제약은 복제돼 소유자가 시뮬한다).
-- 시계는 workspace:GetServerTimeNow() — 클라이언트 Poser 가 같은 시계로 Attribute(MoveAt·FightAt) 를 읽는다.
local Shared = game:GetService("ReplicatedStorage"):WaitForChild("AmpArena")
local Config = require(Shared.Config)
local Moves = require(Shared.Moves)
local Rules = require(Shared.Rules)
local Styles = require(Shared.Styles)
local Accessories = require(Shared.Accessories)

local Combat = {}
Combat.hooks = {
	fx = function() end,            -- (kind, ...) 전 클라이언트 연출
	ko = function() end,            -- (victimF, creditId|nil, reason)
	projectile = function() end,    -- (F, move) 투사체 발사
	itemHit = function() end,       -- (F, move, t) 상자 판정
	throwItem = function() end,     -- (F, t) 든 아이템 던지기
	dropItem = function() end,      -- (F) KO·퇴장 때 든 아이템을 그 자리에 떨어뜨린다
}
local fighters = {}
local fallY = -1000
local AIR = Enum.Material.Air
local LOCKED = { attack = true, hitstun = true, launched = true, down = true, getup = true, held = true, grabbing = true, stun = true, dead = true }
local NOJUMP = { hitstun = true, launched = true, down = true, getup = true, held = true, stun = true, dead = true }
local INVULN = { down = true, getup = true }
local function now() return workspace:GetServerTimeNow() end

local function flatLook(root)
	local l = root.CFrame.LookVector
	local v = Vector3.new(l.X, 0, l.Z)
	if v.Magnitude < 1e-3 then return Vector3.new(0, 0, -1) end
	return v.Unit
end
local function dirBetween(a, b)
	local v = Vector3.new(b.X - a.X, 0, b.Z - a.Z)
	if v.Magnitude < 1e-3 then return nil end
	return v.Unit
end

-- ───────── 속도 제약 ─────────
local function impulsePlane(F, v, seconds)
	local lv = F.vel
	lv.VelocityConstraintMode = Enum.VelocityConstraintMode.Plane
	lv.PrimaryTangentAxis = Vector3.xAxis; lv.SecondaryTangentAxis = Vector3.zAxis
	lv.PlaneVelocity = Vector2.new(v.X, v.Z)
	lv.Enabled = true
	F.velUntil = now() + seconds
end
local function impulseVector(F, v, seconds)
	local lv = F.vel
	lv.VelocityConstraintMode = Enum.VelocityConstraintMode.Vector
	lv.VectorVelocity = v
	lv.Enabled = true
	F.velUntil = now() + seconds
end
local function stopVel(F) F.vel.Enabled = false; F.velUntil = 0 end

-- ───────── 상태 ─────────
local function applyLocks(F)
	local hum = F.hum
	local walk, jump, rot = F.baseWalk, F.baseJump, true
	if LOCKED[F.state] or F.frozen then walk, rot = 0, false end
	if F.frozen then jump = 0 end
	if NOJUMP[F.state] then jump = 0 end
	if F.state == "guard" then walk = Config.GUARD.walkSpeed end
	if hum.WalkSpeed ~= walk then hum.WalkSpeed = walk end
	if hum.JumpPower ~= jump then hum.JumpPower = jump end
	if hum.AutoRotate ~= rot then hum.AutoRotate = rot end
end
local function setState(F, s, t)
	t = t or now()
	F.state = s; F.stateAt = t
	F.model:SetAttribute("Fight", s); F.model:SetAttribute("FightAt", t)
	if s ~= "attack" then F.move = nil; F.model:SetAttribute("Move", "") end
	applyLocks(F)
end
local function startMove(F, id, chain, index, t)
	t = t or now()
	local m = Moves.get(id)
	if not m then return end
	F.state = "attack"; F.stateAt = t
	F.move = m; F.moveAt = t; F.chain = chain; F.chainIndex = index or 1
	F.hitSet = {}; F.queued = nil; F.landedAt = nil; F.fired = false; F.moving = false; F.thrown = false
	F.model:SetAttribute("Fight", "attack"); F.model:SetAttribute("FightAt", t)
	F.model:SetAttribute("Move", id); F.model:SetAttribute("MoveAt", t); F.model:SetAttribute("LandedAt", 0)
	applyLocks(F)
end
local function setGuardAttr(F)
	local g = math.floor(F.guard)
	if F.guardShown ~= g then F.guardShown = g; F.model:SetAttribute("Guard", g) end
end

-- ───────── 잡기 ─────────
local function release(F, V, reason, t)
	t = t or now()
	local w = F.root:FindFirstChild("AmpHold"); if w then w:Destroy() end
	V.hum.PlatformStand = false
	V.holder = nil; F.held = nil
	if reason == "escape" then
		setState(F, "hitstun", t); F.stunFor = Config.GRAB.escapeStun
		setState(V, "hitstun", t); V.stunFor = Config.GRAB.escapeStun
	else
		if V.state == "held" then setState(V, "idle", t) end
		if F.state == "grabbing" then setState(F, "idle", t) end
	end
end
local function doGrab(F, V, t)
	F.held = V; V.holder = F; V.heldAt = t; V.mash = 0; V.lastMashAt = nil
	stopVel(V)
	setState(V, "held", t); setState(F, "grabbing", t)
	V.hum.PlatformStand = true
	local w = Instance.new("Weld")
	w.Name = "AmpHold"; w.Part0 = F.root; w.Part1 = V.root
	w.C0 = CFrame.new(0, 0, -Config.GRAB.holdOffset) * CFrame.Angles(0, math.pi, 0)
	w.Parent = F.root
	Combat.hooks.fx("grab", V.root.Position)
end

-- ───────── 피해 ─────────
local function hurt(V, dmg, A, t, kind)
	V.hum.Health = math.max(0, V.hum.Health - dmg)
	if A then A.damage += dmg; V.lastHitBy = A.id; V.lastHitAt = t end
	Combat.hooks.fx("hit", V.root.Position + Vector3.new(0, 1.5, 0), dmg, V.model, kind or "hit")
	if V.hum.Health <= 0 then Combat.ko(V, A, "hit", t) end
end

-- 타격 적용. opts.dir 로 밀림 방향을 지정할 수 있다(투사체). 반환: 맞았는가.
function Combat.applyHit(A, V, m, t, opts)
	t = t or now()
	opts = opts or {}
	if V.state == "dead" or not V.model.Parent then return false end
	if t < V.invulnUntil or INVULN[V.state] then return false end
	if V.state == "launched" and V.airHits >= Config.HIT.airHitsMax then return false end
	local dmg = Rules.damage(m.damage, A and A.stats.atk or Config.STAT.default, V.stats.def)
	local dir = opts.dir or (A and dirBetween(A.root.Position, V.root.Position)) or (A and flatLook(A)) or Vector3.new(0, 0, -1)
	-- 가드: 정면만, 가드 무시 무브는 뚫는다. 막아도 조금 밀린다.
	local guarding = V.state == "guard" or (V.state == "attack" and V.move and V.move.guardsWhileActive)
	if guarding and not m.guardBreak and A and Rules.guardBlocks(V.root.Position, flatLook(V), A.root.Position, V.accDef.guardAngle) then
		local crushed
		V.guard, crushed = Rules.guardAfterBlock(V.guard, Rules.guardCost(dmg), V.accDef.crushImmune)
		V.counterUntil = t + Config.GUARD.counterWindow
		Combat.hooks.fx("guard", V.root.Position + Vector3.new(0, 1.5, 0))
		impulsePlane(V, dir * m.push * 0.5, 0.1)
		if crushed then setState(V, "stun", t); Combat.hooks.fx("crush", V.root.Position + Vector3.new(0, 2, 0)) end
		setGuardAttr(V)
		return true
	end
	local armored = V.state == "attack" and V.move and V.move.superArmor and m.effect == "hitstun"
	hurt(V, dmg, A, t, m.effect == "launch" and "launch" or "hit")
	if V.state == "dead" or armored then return true end
	if V.state == "held" then return true end -- 제3자 타격은 피해만
	if V.state == "grabbing" and V.held then release(V, V.held, "hit", t) end
	if V.state == "attack" and V.move and V.move.effect == "throw" and V.held then release(V, V.held, "hit", t) end
	local aid = A and A.id or "world"
	if V.consec.by == aid and t - V.consec.at < 1.5 then V.consec.count += 1 else V.consec.by = aid; V.consec.count = 1 end
	V.consec.at = t
	local mult = Rules.knockbackMult(V.consec.count)
	if m.effect == "launch" or V.state == "launched" then
		local wasAir = V.state == "launched"
		setState(V, "launched", t)
		V.airHits = wasAir and V.airHits + 1 or 0
		V.sawAir = false
		impulseVector(V, Vector3.new(dir.X * m.launchH * mult, m.launchV, dir.Z * m.launchH * mult), Config.HIT.launchSeconds)
	else
		setState(V, "hitstun", t); V.stunFor = m.hitstun
		impulsePlane(V, dir * m.push * mult, Config.HIT.pushSeconds)
	end
	return true
end

local function doThrow(F, t)
	local V = F.held
	F.thrown = true
	if not V then return end
	local look = flatLook(F)
	local d = Rules.throwDirection({ X = look.X, Z = look.Z }, F.throwDir)
	local w = F.root:FindFirstChild("AmpHold"); if w then w:Destroy() end
	V.hum.PlatformStand = false; V.holder = nil; F.held = nil
	local style = Styles.get(F.loadout.style)
	local dmg = Rules.damage(style.throwDamage, F.stats.atk, V.stats.def)
	hurt(V, dmg, F, t, "launch")
	if V.state == "dead" then return end
	setState(V, "launched", t); V.airHits = 0; V.sawAir = false
	V.consec.by = F.id; V.consec.count = 1; V.consec.at = t
	impulseVector(V, Vector3.new(d.X * Config.GRAB.throwSpeedH, Config.GRAB.throwSpeedV, d.Z * Config.GRAB.throwSpeedH), 0.25)
	Combat.hooks.fx("throw", V.root.Position)
end

local function hitScan(F, m, t)
	local pos, look = F.root.Position, flatLook(F)
	for id, V in fighters do
		if V == F or V.state == "dead" or not V.model.Parent or not Rules.canHit(F.team, V.team) then continue end
		local last = F.hitSet[id]
		if last and (m.multiHit == 0 or t - last < m.multiHit) then continue end
		if Rules.hitTest(pos, look, m, V.root.Position) then
			F.hitSet[id] = t
			Combat.applyHit(F, V, m, t)
		end
	end
	Combat.hooks.itemHit(F, m, t)
end
local function tryGrab(F, m, t)
	local pos, look = F.root.Position, flatLook(F)
	local range = m.id == "grab" and Styles.get(F.loadout.style).grabRange or m.reach
	for _, V in fighters do
		if V == F or V.state == "dead" or not V.model.Parent or V.holder then continue end
		if t < V.invulnUntil then continue end
		if Rules.canGrab(pos, look, V.root.Position, V.state, range) then doGrab(F, V, t); return true end
	end
	return false
end

-- ───────── 입력 의도 ─────────
local function inAir(F) return F.hum.FloorMaterial == AIR end
local function nearestGrabbable(F, t)
	local pos, look = F.root.Position, flatLook(F)
	local range = Styles.get(F.loadout.style).grabRange
	for _, V in fighters do
		if V == F or V.state == "dead" or not V.model.Parent or V.holder or t < V.invulnUntil then continue end
		if Rules.canGrab(pos, look, V.root.Position, V.state, range) then return V end
	end
	return nil
end
local function ammoFor(F, id)
	local spec = Moves.PROJECTILE[id]
	if not spec or spec.ammo == 0 or F.accDef.ammo == 0 then return true end
	local t = now()
	if F.ammo <= 0 and F.reloadAt and t >= F.reloadAt then F.ammo = F.accDef.ammo; F.reloadAt = nil end
	if F.ammo < spec.ammo then
		if not F.reloadAt then F.reloadAt = t + F.accDef.reload end
		return false
	end
	F.ammo -= spec.ammo
	if F.ammo <= 0 then F.reloadAt = t + F.accDef.reload end
	return true
end

function Combat.intent(F, kind, args)
	if not F or F.state == "dead" then return end
	local t = now()
	args = args or {}
	if kind == "guard" then
		if args.on then
			if F.state == "idle" then setState(F, "guard", t) end
			F.wantGuard = true
		else
			F.wantGuard = false
			if F.state == "guard" then setState(F, "idle", t) end
		end
		return
	end
	if kind == "dash" then
		if F.state ~= "idle" and F.state ~= "guard" then return end
		if t < F.dashReadyAt then return end
		if inAir(F) then
			if F.airDashLeft <= 0 then return end
			F.airDashLeft -= 1
		end
		if F.state == "guard" then setState(F, "idle", t) end
		impulsePlane(F, flatLook(F) * Config.DASH.speed, Config.DASH.duration)
		F.dashReadyAt = t + Config.DASH.cooldown
		F.dashAttackUntil = t + Config.DASH.duration + Config.DASH.attackWindow
		Combat.hooks.fx("dash", F.root.Position, F.model)
		return
	end
	if kind == "special" then
		if F.state ~= "idle" then return end
		if t < F.specialReadyAt then return end
		local id, cd = Rules.specialMove(F.loadout.style, F.loadout.accessory)
		if not ammoFor(F, id) then return end
		F.specialReadyAt = t + cd
		startMove(F, id, "special", 1, t)
		return
	end
	if kind ~= "light" and kind ~= "heavy" and kind ~= "throw" then return end
	if args.dir then F.throwDir = Rules.sanitizeDir(args.dir) end
	-- 잡힌 쪽: 연타 탈출
	if F.state == "held" then
		if Rules.mashAccepted(F.lastMashAt, t) then F.mash += 1; F.lastMashAt = t end
		if Rules.heldEscape(F.mash) and F.holder then release(F.holder, F, "escape", t) end
		return
	end
	-- 잡은 쪽: 던지기
	if F.state == "grabbing" then startMove(F, "throw", "throw", 1, t); return end
	-- 사슬 예약
	if F.state == "attack" then
		local m = F.move
		if m and (m.effect == "hitstun" or m.effect == "launch" or m.effect == "projectile") and F.chain ~= "special" and F.chain ~= "air" then
			local dt = t - F.moveAt
			if dt >= m.startup then F.queued = (kind == "throw") and "light" or kind end
		end
		return
	end
	-- 가드 중: 반격기 창 안이면 반격, 아니면 무시
	if F.state == "guard" then
		if Rules.counterOpen(F.counterUntil, t) then startMove(F, "counter", "counter", 1, t) end
		return
	end
	if F.state ~= "idle" then return end
	if kind == "throw" then kind = "light" end
	-- 아이템을 들고 있으면 던진다
	if F.item then startMove(F, "itemThrow", "item", 1, t); return end
	if inAir(F) then
		startMove(F, kind == "light" and "airAttack" or "divekick", "air", 1, t)
		return
	end
	-- 밀착 약공 = 잡기(양손 무기는 불가)
	if kind == "light" and Rules.canGrabWith(F.loadout.accessory) and nearestGrabbable(F, t) then startMove(F, "grab", "grab", 1, t); return end
	if kind == "light" and Rules.dashAttackOpen(F.dashAttackUntil, t) then startMove(F, "tackle", "dash", 1, t); return end
	local id, chain, index = Rules.firstMove(F.loadout.style, F.loadout.accessory, kind)
	if not id then return end
	if not ammoFor(F, id) then return end
	startMove(F, id, chain, index, t)
end

-- ───────── 틱 ─────────
local function tickFighter(F, t, dt)
	if F.state == "dead" or not F.model.Parent or not F.root.Parent then return end
	if F.vel.Enabled and t >= F.velUntil then F.vel.Enabled = false end
	if F.state ~= "guard" and F.guard < Config.GUARD.max then F.guard = math.min(Config.GUARD.max, F.guard + Config.GUARD.regenPerSecond * dt); setGuardAttr(F) end
	if F.reloadAt and t >= F.reloadAt then F.ammo = F.accDef.ammo; F.reloadAt = nil end
	if not inAir(F) then F.airDashLeft = F.airDashes end
	if Rules.isRingout(F.root.Position.Y, fallY) then Combat.ko(F, nil, "ringout", t); return end
	local s = F.state
	if s == "attack" then
		local m = F.move
		local dtm = t - F.moveAt
		if m.moveSpeed ~= 0 and dtm >= m.startup and not F.moving then F.moving = true; impulsePlane(F, flatLook(F) * m.moveSpeed, m.active) end
		if m.effect == "projectile" and dtm >= m.startup and not F.fired then F.fired = true; Combat.hooks.projectile(F, m, t) end
		if m.id == "itemThrow" and dtm >= m.startup and not F.thrown then F.thrown = true; Combat.hooks.throwItem(F, t) end
		if m.untilLand and dtm >= m.startup + 0.1 and F.landedAt == nil and not inAir(F) then F.landedAt = t; F.model:SetAttribute("LandedAt", t) end
		local active = Moves.isActive(m, dtm) and (not m.untilLand or F.landedAt == nil)
		if active then
			if m.effect == "grab" then
				if not F.held then tryGrab(F, m, t) end
			elseif m.effect == "throw" then
				if not F.thrown then doThrow(F, t) end
			elseif m.radius > 0 then
				hitScan(F, m, t)
			end
		end
		local duration = if m.untilLand then (F.landedAt and (F.landedAt - F.moveAt + m.recovery) or math.huge) else Moves.duration(m)
		if m.untilLand and dtm > 3 then duration = dtm end -- 어디에도 안 닿으면 포기
		if dtm >= duration then
			local nxt, nchain, nidx = nil, nil, nil
			if F.queued and (F.chain == "light" or F.chain == "heavy") then nxt, nchain, nidx = Rules.chainNext(F.loadout.style, F.loadout.accessory, F.chain, F.chainIndex, F.queued) end
			if nxt and ammoFor(F, nxt) then startMove(F, nxt, nchain, nidx, t)
			elseif F.wantGuard then setState(F, "guard", t)
			else setState(F, "idle", t) end
		end
	elseif s == "hitstun" then
		if t - F.stateAt >= (F.stunFor or 0.2) then setState(F, F.wantGuard and "guard" or "idle", t) end
	elseif s == "launched" then
		if inAir(F) then F.sawAir = true end
		if Rules.launchLanded(F.sawAir, t - F.stateAt, not inAir(F)) then setState(F, "down", t) end
	elseif s == "down" then
		if t - F.stateAt >= Config.HIT.downSeconds then setState(F, "getup", t) end
	elseif s == "getup" then
		if t - F.stateAt >= Config.HIT.getupSeconds then setState(F, "idle", t) end
	elseif s == "stun" then
		if t - F.stateAt >= Config.GUARD.stunSeconds then setState(F, "idle", t) end
	elseif s == "held" then
		local H = F.holder
		local holding = H and H.model.Parent and (H.state == "grabbing" or (H.state == "attack" and H.move and H.move.effect == "throw"))
		if not holding or t - F.heldAt > Config.GRAB.heldMax then
			if H then release(H, F, "timeout", t) else F.hum.PlatformStand = false; setState(F, "idle", t) end
		end
	elseif s == "grabbing" then
		if not F.held or F.held.state ~= "held" then setState(F, "idle", t) end
	elseif s == "guard" then
		if not F.wantGuard then setState(F, "idle", t) end
	end
end

function Combat.update(dt)
	local t = now()
	for _, F in fighters do tickFighter(F, t, dt) end
end

-- ───────── KO · 정리 ─────────
local function cleanup(F)
	if F.held then release(F, F.held, "cancel") end
	if F.holder then release(F.holder, F, "cancel") end
	stopVel(F)
	if F.hum.Parent then F.hum.PlatformStand = false end
	if F.item then Combat.hooks.dropItem(F) end
	F.item = nil
end
function Combat.ko(V, A, reason, t)
	t = t or now()
	if V.state == "dead" then return end
	cleanup(V)
	setState(V, "dead", t)
	V.alive = false
	V.deaths += 1
	if V.hum.Health > 0 then V.hum.Health = 0 end
	local credit = if reason == "hit" and A then A.id else Rules.koCredit(V.lastHitBy, V.lastHitAt, t)
	Combat.hooks.fx(reason == "ringout" and "ringout" or "ko", V.root.Position, V.label, credit and fighters[credit] and fighters[credit].label or nil)
	Combat.hooks.ko(V, credit, reason)
end

-- ───────── 등록 ─────────
function Combat.register(id, model, hum, root, loadout, stats, team, player, isBot, label)
	local st = Styles.get(loadout.style)
	local accDef = Accessories.get(loadout.accessory) or Accessories.get("none")
	local F = {
		id = id, model = model, hum = hum, root = root, player = player, isBot = isBot, label = label,
		loadout = loadout, stats = stats, team = team, accDef = accDef,
		state = "idle", stateAt = now(), move = nil, moveAt = 0, chain = nil, chainIndex = 0, hitSet = {}, queued = nil,
		guard = Config.GUARD.max, guardShown = nil, counterUntil = 0, wantGuard = false,
		dashReadyAt = 0, dashAttackUntil = 0, airDashes = st.airDashes, airDashLeft = st.airDashes,
		specialReadyAt = 0, ammo = accDef.ammo, reloadAt = nil,
		invulnUntil = 0, lastHitBy = nil, lastHitAt = nil, consec = { by = nil, count = 0, at = 0 }, airHits = 0, sawAir = false,
		held = nil, holder = nil, mash = 0, lastMashAt = nil, heldAt = 0, item = nil, throwDir = nil,
		ko = 0, deaths = 0, damage = 0, alive = true,
		baseWalk = hum.WalkSpeed, baseJump = hum.JumpPower, velUntil = 0,
	}
	local att = Instance.new("Attachment"); att.Name = "AmpVel"; att.Parent = root
	local lv = Instance.new("LinearVelocity")
	lv.Name = "AmpVel"; lv.Attachment0 = att; lv.MaxForce = math.huge; lv.RelativeTo = Enum.ActuatorRelativeTo.World
	lv.VelocityConstraintMode = Enum.VelocityConstraintMode.Vector; lv.VectorVelocity = Vector3.zero; lv.Enabled = false; lv.Parent = root
	F.vel = lv
	fighters[id] = F
	hum.Died:Connect(function() if F.state ~= "dead" and fighters[id] == F then Combat.ko(F, nil, "died") end end)
	return F
end
function Combat.leave(id)
	local F = fighters[id]
	if not F then return end
	cleanup(F)
	fighters[id] = nil
end
function Combat.get(id) return fighters[id] end
function Combat.byModel(model)
	for _, F in fighters do if F.model == model then return F end end
	return nil
end
function Combat.all() return fighters end
function Combat.setFallY(y) fallY = y end
function Combat.setFrozen(F, on) F.frozen = on; applyLocks(F) end
-- 점프대: 위로 쏘아 올린다. 공중 대시도 다시 채운다.
function Combat.launchUp(F, speed)
	if F.state == "dead" or F.state == "held" then return end
	impulseVector(F, Vector3.new(F.root.AssemblyLinearVelocity.X, speed, F.root.AssemblyLinearVelocity.Z), 0.15)
	F.airDashLeft = F.airDashes
end
function Combat.setInvuln(F, seconds) F.invulnUntil = now() + seconds end
function Combat.resetMatchStats(F) F.ko = 0; F.deaths = 0; F.damage = 0 end
function Combat.heal(F, amount) F.hum.Health = math.min(F.hum.MaxHealth, F.hum.Health + amount) end
function Combat.look(F) return flatLook(F) end
function Combat.time() return now() end
-- 아이템을 들었을 때 던질 수 있게 기억한다(Items 가 부른다)
function Combat.setItem(F, item) F.item = item end

return Combat
