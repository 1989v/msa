--!nonstrict
-- 10Hz 액터 패킷. 서버가 Sim 상태를 buffer 로 눌러 보내고 클라이언트가 푼다.
-- 액터 한 개 = 12바이트: id u32 · kind u8 · x u16(×100) · z u16(×100) · heading u8 · hp u8 · flags u8
-- 투사체 = 9바이트, 예고 = 8바이트. 액터는 기준점(요청 소유자 리더)에서 가까운 순 최대 MAX_ACTORS.
local Packet = {}

Packet.KINDS = { "archer", "hero_archer", "longbow", "carpenter", "zombie", "ghoul", "plague", "bat", "armored", "vampire", "enemy_tower", "camp", "base" }
local KIND_INDEX = {}
for i, k in Packet.KINDS do KIND_INDEX[k] = i end
Packet.KIND_INDEX = KIND_INDEX

Packet.MAX_ACTORS = 240
Packet.FLAG = { enemy = 1, wave = 2, leader = 4, garrison = 8, roll = 16, cargo = 32, owner1 = 64, guard = 128 }

local function clamp16(v: number): number return math.clamp(math.floor(v * 100 + 0.5), 0, 65535) end
local function u8(v: number): number return math.clamp(math.floor(v + 0.5), 0, 255) end
local function heading(a: number?): number
	if not a then return 0 end
	return u8(((a % (2 * math.pi)) / (2 * math.pi)) * 255)
end

-- 액터 목록을 평탄한 배열로 모은다 (Roblox 없이도 테스트 가능)
function Packet.collect(s, around)
	local actors = {}
	for _, u in s.units do
		local flags = 0
		if u.isLeader then flags += Packet.FLAG.leader end
		if u.towerId then flags += Packet.FLAG.garrison end
		if u.roll then flags += Packet.FLAG.roll end
		if (u.cargo or 0) > 0 then flags += Packet.FLAG.cargo end
		if u.ownerId == 1 then flags += Packet.FLAG.owner1 end
		table.insert(actors, { id = u.id, kind = u.kind, x = u.x, z = u.z, heading = u.shotAngle, hp = u.hp / u.maxHp, flags = flags })
	end
	for _, e in s.enemies do
		local flags = Packet.FLAG.enemy
		if e.wave then flags += Packet.FLAG.wave end
		if e.guard then flags += Packet.FLAG.guard end
		if e.scout then flags += Packet.FLAG.cargo end -- 적에게 cargo 비트는 정찰형 표시다
		table.insert(actors, { id = e.id, kind = e.kind, x = e.x, z = e.z, heading = e.shotAngle, hp = e.hp / e.maxHp, flags = flags })
	end
	if s.camp and not s.camp.cleared then
		table.insert(actors, { id = 1000000, kind = "camp", x = s.camp.x, z = s.camp.z, heading = 0, hp = s.camp.hp / s.camp.maxHp, flags = Packet.FLAG.enemy })
	end
	if around and #actors > Packet.MAX_ACTORS then
		table.sort(actors, function(a, b)
			local da = (a.x - around.x) ^ 2 + (a.z - around.z) ^ 2
			local db = (b.x - around.x) ^ 2 + (b.z - around.z) ^ 2
			if da ~= db then return da < db end
			return a.id < b.id
		end)
		for i = #actors, Packet.MAX_ACTORS + 1, -1 do actors[i] = nil end
	end
	return actors
end

function Packet.encode(s, actors): buffer
	local bullets, effects = s.bullets, s.effects
	local size = 4 + 2 * 3 + #actors * 12 + #bullets * 9 + #effects * 8
	local b = buffer.create(size)
	local o = 0
	buffer.writeu32(b, o, s.tick); o += 4
	buffer.writeu16(b, o, #actors); o += 2
	buffer.writeu16(b, o, #bullets); o += 2
	buffer.writeu16(b, o, #effects); o += 2
	for _, a in actors do
		buffer.writeu32(b, o, a.id); o += 4
		buffer.writeu8(b, o, KIND_INDEX[a.kind] or 0); o += 1
		buffer.writeu16(b, o, clamp16(a.x)); o += 2
		buffer.writeu16(b, o, clamp16(a.z)); o += 2
		buffer.writeu8(b, o, heading(a.heading)); o += 1
		buffer.writeu8(b, o, u8(a.hp * 255)); o += 1
		buffer.writeu8(b, o, a.flags); o += 1
	end
	for _, bl in bullets do
		buffer.writeu16(b, o, clamp16(bl.x)); o += 2
		buffer.writeu16(b, o, clamp16(bl.z)); o += 2
		buffer.writeu16(b, o, clamp16(bl.tx)); o += 2
		buffer.writeu16(b, o, clamp16(bl.tz)); o += 2
		buffer.writeu8(b, o, if bl.friendly then 1 else 0); o += 1
	end
	for _, fx in effects do
		buffer.writeu16(b, o, clamp16(fx.x)); o += 2
		buffer.writeu16(b, o, clamp16(fx.z)); o += 2
		buffer.writeu8(b, o, u8(fx.radius * 10)); o += 1
		buffer.writeu8(b, o, u8(fx.life * 100)); o += 1
		buffer.writeu8(b, o, if fx.type == "warning" then 1 else 2); o += 1
		buffer.writeu8(b, o, if fx.attack == "spike" then 1 else 0); o += 1
	end
	return b
end

function Packet.decode(b: buffer)
	local o = 0
	local tick = buffer.readu32(b, o); o += 4
	local na = buffer.readu16(b, o); o += 2
	local nb = buffer.readu16(b, o); o += 2
	local ne = buffer.readu16(b, o); o += 2
	local actors, bullets, effects = table.create(na), table.create(nb), table.create(ne)
	for i = 1, na do
		local a = {}
		a.id = buffer.readu32(b, o); o += 4
		a.kind = Packet.KINDS[buffer.readu8(b, o)]; o += 1
		a.x = buffer.readu16(b, o) / 100; o += 2
		a.z = buffer.readu16(b, o) / 100; o += 2
		a.heading = buffer.readu8(b, o) / 255 * 2 * math.pi; o += 1
		a.hp = buffer.readu8(b, o) / 255; o += 1
		a.flags = buffer.readu8(b, o); o += 1
		actors[i] = a
	end
	for i = 1, nb do
		local bl = {}
		bl.x = buffer.readu16(b, o) / 100; o += 2
		bl.z = buffer.readu16(b, o) / 100; o += 2
		bl.tx = buffer.readu16(b, o) / 100; o += 2
		bl.tz = buffer.readu16(b, o) / 100; o += 2
		bl.friendly = buffer.readu8(b, o) == 1; o += 1
		bullets[i] = bl
	end
	for i = 1, ne do
		local fx = {}
		fx.x = buffer.readu16(b, o) / 100; o += 2
		fx.z = buffer.readu16(b, o) / 100; o += 2
		fx.radius = buffer.readu8(b, o) / 10; o += 1
		fx.life = buffer.readu8(b, o) / 100; o += 1
		fx.warning = buffer.readu8(b, o) == 1; o += 1
		fx.spike = buffer.readu8(b, o) == 1; o += 1
		effects[i] = fx
	end
	return { tick = tick, actors = actors, bullets = bullets, effects = effects }
end

function Packet.has(flags: number, flag: number): boolean
	return flags // flag % 2 == 1
end

return Packet
