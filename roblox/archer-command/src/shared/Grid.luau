--!strict
-- 시작 분지 지형. 원작 map.js authorSouthwestStart 의 직사각형을 px ÷ 8 로 옮겼다.
-- 빌더(tools/build_place.py)가 아래 RECTS 와 SITES 를 정규식으로 읽어 같은 모양의 파트를 만든다 —
-- 격자와 보이는 지형이 한 소스에서 나온다.
local Grid = {}

Grid.CELL = 4
Grid.WIDTH = 216
Grid.HEIGHT = 208
Grid.COLS = Grid.WIDTH // Grid.CELL
Grid.ROWS = Grid.HEIGHT // Grid.CELL
Grid.COUNT = Grid.COLS * Grid.ROWS
Grid.ELEVATION_STUDS = 8

-- RECT x z w h elevation blocked ramp   (뒤가 앞을 덮는다 — 원작 rect() 호출 순서 그대로)
-- RECT 0 0 216 208 1 1 0
-- RECT 8 8 200 192 0 0 0
-- RECT 16 32 108 84 1 1 0
-- RECT 20 36 100 72 1 0 0
-- RECT 60 108 20 8 1 0 17
-- RECT 60 116 20 12 0 0 17
Grid.RECTS = {
	{ 0, 0, 216, 208, 1, 1, 0 },
	{ 8, 8, 200, 192, 0, 0, 0 },
	{ 16, 32, 108, 84, 1, 1, 0 },
	{ 20, 36, 100, 72, 1, 0, 0 },
	{ 60, 108, 20, 8, 1, 0, 17 },
	{ 60, 116, 20, 12, 0, 0, 17 },
}

-- SITE id x z   (원작 px: base 320,11968 · healer 464,11904 · C1 544,11040 · 첨탑 288/832,11360 ·
--   전초 탑 1152,11680 · 파수꾼 1216,11808 · 전초 웨이브 입구 960,11808 · 사냥터 992,11808 ·
--   정규 웨이브 입구 = 동쪽 원정로 출구 1376,11200 · 자원 160/832,12064 · 160,11744 · 1056,12064)
-- SITE base 40 168
-- SITE healer 58 160
-- SITE camp 68 52
-- SITE thorn_west 36 92
-- SITE thorn_east 104 92
-- SITE outpost_tower 144 132
-- SITE outpost_guard 152 148
-- SITE outpost_entry 120 148
-- SITE hunt 124 148
-- SITE wave_entry 172 72
-- SITE exit_gate 172 4
-- SITE wood_west 20 180
-- SITE wood_east 104 180
-- SITE ore_west 20 140
-- SITE ore_east 132 180
Grid.SITES = {
	base = { x = 40, z = 168 },
	healer = { x = 58, z = 160 },
	camp = { x = 68, z = 52 },
	thorn_west = { x = 36, z = 92, approach = { x = 44, z = 102 } },
	thorn_east = { x = 104, z = 92, approach = { x = 104, z = 100 } },
	outpost_tower = { x = 144, z = 132 },
	outpost_guard = { x = 152, z = 148 },
	outpost_entry = { x = 120, z = 148 },
	hunt = { x = 124, z = 148 },
	wave_entry = { x = 172, z = 72 },
	exit_gate = { x = 172, z = 4 },
	wood_west = { x = 20, z = 180 },
	wood_east = { x = 104, z = 180 },
	ore_west = { x = 20, z = 140 },
	ore_east = { x = 132, z = 180 },
}
Grid.RESOURCES = {
	{ id = "wood_west", kind = "wood" }, { id = "wood_east", kind = "wood" },
	{ id = "ore_west", kind = "ore" }, { id = "ore_east", kind = "ore" },
}
-- 길 위 무리: 원작 조건(경로 24셀 이후 + 본진 1000px 밖)을 분지 안 경로가 못 채워 분지 안에는 없다.
Grid.PACKS = {}

export type Terrain = { blocked: { number }, elevation: { number }, ramps: { number }, protected: { number }, revision: number }
export type Point = { x: number, z: number }

local function fillRect(t: Terrain, x: number, z: number, w: number, h: number, elevation: number, blocked: number, ramp: number)
	for row = z // Grid.CELL, (z + h) // Grid.CELL - 1 do
		for col = x // Grid.CELL, (x + w) // Grid.CELL - 1 do
			if col >= 0 and row >= 0 and col < Grid.COLS and row < Grid.ROWS then
				local i = row * Grid.COLS + col + 1
				t.elevation[i] = elevation; t.blocked[i] = blocked; t.ramps[i] = ramp
				t.protected[i] = if blocked == 1 or ramp ~= 0 then 1 else 0
			end
		end
	end
end

function Grid.cellAt(p: Point): number?
	if p.x < 0 or p.z < 0 or p.x >= Grid.WIDTH or p.z >= Grid.HEIGHT then return nil end
	return (p.z // Grid.CELL) * Grid.COLS + (p.x // Grid.CELL) + 1
end

function Grid.cellCenter(index: number): Point
	local i = index - 1
	return { x = (i % Grid.COLS + 0.5) * Grid.CELL, z = (i // Grid.COLS + 0.5) * Grid.CELL }
end

function Grid.colRow(index: number): (number, number)
	local i = index - 1
	return i % Grid.COLS, i // Grid.COLS
end

local function protectAround(t: Terrain, p: Point, radius: number)
	for row = (p.z - radius) // Grid.CELL, (p.z + radius) // Grid.CELL do
		for col = (p.x - radius) // Grid.CELL, (p.x + radius) // Grid.CELL do
			if col >= 0 and row >= 0 and col < Grid.COLS and row < Grid.ROWS then t.protected[row * Grid.COLS + col + 1] = 1 end
		end
	end
end

function Grid.create(): Terrain
	local t: Terrain = { blocked = table.create(Grid.COUNT, 1), elevation = table.create(Grid.COUNT, 0), ramps = table.create(Grid.COUNT, 0), protected = table.create(Grid.COUNT, 0), revision = 0 }
	for _, r in Grid.RECTS do fillRect(t, r[1], r[2], r[3], r[4], r[5], r[6], r[7]) end
	-- 원작 protect(): 거점·자원·입구 둘레 셀은 건설 금지. 본진은 192px(24스터드) 정사각형.
	protectAround(t, Grid.SITES.base, 12)
	for _, id in { "healer", "camp", "thorn_west", "thorn_east", "outpost_tower", "outpost_guard", "outpost_entry", "hunt", "wave_entry", "wood_west", "wood_east", "ore_west", "ore_east" } do
		protectAround(t, Grid.SITES[id], Grid.CELL)
	end
	return t
end

function Grid.isWalkable(t: Terrain, p: Point): boolean
	local i = Grid.cellAt(p)
	return i ~= nil and t.blocked[i] == 0
end

function Grid.elevationAt(t: Terrain, p: Point): number
	local i = Grid.cellAt(p)
	return if i then t.elevation[i] else 0
end

-- 보이는 높이(스터드): 경사로 셀은 양 끝 고도 사이를 잇는다
function Grid.heightAt(t: Terrain, p: Point): number
	local i = Grid.cellAt(p)
	if not i then return 0 end
	if t.ramps[i] == 0 then return t.elevation[i] * Grid.ELEVATION_STUDS end
	-- 경사로는 세로(z)로만 놓인다. 북쪽 끝이 높다.
	local top, bottom = math.huge, -math.huge
	for _, r in Grid.RECTS do
		if r[7] == t.ramps[i] then top = math.min(top, r[2]); bottom = math.max(bottom, r[2] + r[4]) end
	end
	local f = math.clamp((p.z - top) / (bottom - top), 0, 1)
	return (1 - f) * Grid.ELEVATION_STUDS
end

local function adjacent(t: Terrain, a: number, b: number): boolean
	if t.blocked[a] == 1 or t.blocked[b] == 1 then return false end
	local ac, ar = Grid.colRow(a)
	local bc, br = Grid.colRow(b)
	if math.abs(ac - bc) + math.abs(ar - br) > 1 then return false end
	local change = math.abs(t.elevation[a] - t.elevation[b])
	return change == 0 or (change == 1 and t.ramps[a] ~= 0 and t.ramps[a] == t.ramps[b])
end
Grid.adjacent = adjacent

function Grid.canTraverse(t: Terrain, from: Point, to: Point): boolean
	local a, b = Grid.cellAt(from), Grid.cellAt(to)
	return a ~= nil and b ~= nil and adjacent(t, a, b)
end

-- 직선으로 갈 수 있나 (셀 1/4 간격 표본, 막히면 ㄱ자 우회 둘 중 하나)
function Grid.straightClear(t: Terrain, from: Point, to: Point): boolean
	local d = math.sqrt((to.x - from.x) ^ 2 + (to.z - from.z) ^ 2)
	local steps = math.max(1, math.ceil(d / (Grid.CELL / 4)))
	local prev = from
	for i = 1, steps do
		local p = { x = from.x + (to.x - from.x) * i / steps, z = from.z + (to.z - from.z) * i / steps }
		if not Grid.canTraverse(t, prev, p) then
			local across, down = { x = p.x, z = prev.z }, { x = prev.x, z = p.z }
			local okAcross = Grid.canTraverse(t, prev, across) and Grid.canTraverse(t, across, p)
			local okDown = Grid.canTraverse(t, prev, down) and Grid.canTraverse(t, down, p)
			if not (okAcross and okDown) then return false end
		end
		prev = p
	end
	return true
end

-- 격자 DDA. 사격 LOS: 관측자보다 높은 셀이 사이에 있으면 막힌다 (원작 hasLineOfSight, visionBlock = blocked)
function Grid.hasLineOfSight(t: Terrain, from: Point, to: Point): boolean
	local a, b = Grid.cellAt(from), Grid.cellAt(to)
	if not a or not b then return false end
	local height = t.elevation[a]
	local x, z = Grid.colRow(a)
	local bx, bz = Grid.colRow(b)
	local dx, dz = to.x - from.x, to.z - from.z
	local sx, sz = if dx > 0 then 1 elseif dx < 0 then -1 else 0, if dz > 0 then 1 elseif dz < 0 then -1 else 0
	local tx = if dx == 0 then math.huge else Grid.CELL / math.abs(dx)
	local tz = if dz == 0 then math.huge else Grid.CELL / math.abs(dz)
	local nx = if dx == 0 then math.huge else (((if sx > 0 then x + 1 else x) * Grid.CELL) - from.x) / dx
	local nz = if dz == 0 then math.huge else (((if sz > 0 then z + 1 else z) * Grid.CELL) - from.z) / dz
	local function check(cx: number, cz: number): boolean
		local i = cz * Grid.COLS + cx + 1
		if i == a then return true end
		if t.elevation[i] > height then return false end
		if t.blocked[i] == 1 and i ~= b then return false end
		return true
	end
	if not check(x, z) then return false end
	for _ = 1, Grid.COLS + Grid.ROWS + 2 do
		if x == bx and z == bz then break end
		local crossing = math.min(nx, nz)
		if crossing > 1 + 1e-10 then break end
		if math.abs(nx - nz) < 1e-10 then
			if not check(x + sx, z) or not check(x, z + sz) then return false end
			x += sx; z += sz; nx += tx; nz += tz
		elseif nx < nz then x += sx; nx += tx
		else z += sz; nz += tz end
		if not check(x, z) then return false end
		if crossing >= 1 - 1e-10 then break end
	end
	return true
end

-- 본진으로 가는 흐름장: 본진 셀에서 역방향 BFS 한 번 (wave-ai.js baseFlow)
export type Flow = { next: { number }, distance: { number }, goal: number, revision: number }
function Grid.baseFlow(t: Terrain, goalPoint: Point): Flow?
	local goal = Grid.cellAt(goalPoint)
	if not goal or t.blocked[goal] == 1 then return nil end
	local nextCell, distance = table.create(Grid.COUNT, -1), table.create(Grid.COUNT, -1)
	local queue, head = { goal }, 1
	distance[goal] = 0; nextCell[goal] = goal
	while head <= #queue do
		local at = queue[head]; head += 1
		local col, row = Grid.colRow(at)
		for _, d in { { 0, -1 }, { -1, 0 }, { 1, 0 }, { 0, 1 } } do
			local c, r = col + d[1], row + d[2]
			if c >= 0 and r >= 0 and c < Grid.COLS and r < Grid.ROWS then
				local i = r * Grid.COLS + c + 1
				if distance[i] < 0 and t.blocked[i] == 0 and adjacent(t, i, at) then
					distance[i] = distance[at] + 1; nextCell[i] = at; table.insert(queue, i)
				end
			end
		end
	end
	return { next = nextCell, distance = distance, goal = goal, revision = t.revision }
end

function Grid.flowWaypoint(flow: Flow, from: Point, goalPoint: Point): Point?
	local i = Grid.cellAt(from)
	if not i or flow.next[i] < 0 then return nil end
	if i == flow.goal then return goalPoint end
	return Grid.cellCenter(flow.next[i])
end

-- 예산 있는 재개형 A* (원작 findPath). status=budget 이면 search 를 돌려주니 다음 호출에 그대로 넘겨 이어 찾는다.
export type PathResult = { status: string, path: { Point }, visited: number, search: any }
function Grid.findPath(t: Terrain, from: Point, to: Point, maxVisited: number, search: any?): PathResult
	local start, goal = Grid.cellAt(from), Grid.cellAt(to)
	if not start or not goal then return { status = "invalid", path = {}, visited = 0, search = nil } end
	if t.blocked[start] == 1 or t.blocked[goal] == 1 then return { status = "no-path", path = {}, visited = 0, search = nil } end
	if search and (search.revision ~= t.revision or search.goal ~= goal or search.done) then search = nil end
	local gcol, grow = Grid.colRow(goal)
	local function h(i: number): number
		local c, r = Grid.colRow(i)
		return math.abs(c - gcol) + math.abs(r - grow)
	end
	if not search then
		search = { revision = t.revision, start = start, goal = goal, done = false, cost = {}, parent = {}, closed = {}, open = { start }, total = 0 }
		search.cost[start] = 0
	end
	local cost, parent, closed, open = search.cost, search.parent, search.closed, search.open
	local visited = 0
	while #open > 0 and visited < maxVisited do
		local bestIndex, best = 1, open[1]
		local bestF = cost[best] + h(best)
		for k = 2, #open do
			local n = open[k]
			local f = cost[n] + h(n)
			if f < bestF or (f == bestF and (h(n) < h(best) or (h(n) == h(best) and n < best))) then bestIndex, best, bestF = k, n, f end
		end
		table.remove(open, bestIndex)
		if closed[best] then continue end
		closed[best] = true; visited += 1; search.total += 1
		if best == goal then
			local path = {}
			local node = best
			while node ~= search.start do table.insert(path, 1, Grid.cellCenter(node)); node = parent[node] end
			if #path > 0 then path[#path] = { x = to.x, z = to.z } elseif from.x ~= to.x or from.z ~= to.z then table.insert(path, { x = to.x, z = to.z }) end
			search.done = true
			return { status = "found", path = path, visited = visited, search = nil }
		end
		local col, row = Grid.colRow(best)
		for _, d in { { 0, -1 }, { 1, 0 }, { 0, 1 }, { -1, 0 } } do
			local c, r = col + d[1], row + d[2]
			if c >= 0 and r >= 0 and c < Grid.COLS and r < Grid.ROWS then
				local n = r * Grid.COLS + c + 1
				if not closed[n] and adjacent(t, best, n) then
					local g = cost[best] + 1
					if cost[n] == nil or g < cost[n] then cost[n] = g; parent[n] = best; table.insert(open, n) end
				end
			end
		end
	end
	if #open == 0 then search.done = true; return { status = "no-path", path = {}, visited = visited, search = nil } end
	return { status = "budget", path = {}, visited = visited, search = search }
end

-- 건설 판정 (원작 canBuild): 왼쪽 위 기준 footprint, 보호·막힘·경사로·고도차·점유 겹침
export type Rect = { x: number, z: number, w: number, h: number }
function Grid.canBuild(t: Terrain, footprint: Rect, occupied: { Rect }): (boolean, string?)
	if footprint.x < 0 or footprint.z < 0 or footprint.x + footprint.w > Grid.WIDTH or footprint.z + footprint.h > Grid.HEIGHT then return false, "bounds" end
	local left, right = footprint.x // Grid.CELL, math.ceil((footprint.x + footprint.w) / Grid.CELL) - 1
	local top, bottom = footprint.z // Grid.CELL, math.ceil((footprint.z + footprint.h) / Grid.CELL) - 1
	local height = t.elevation[top * Grid.COLS + left + 1]
	for row = top, bottom do
		for col = left, right do
			local i = row * Grid.COLS + col + 1
			if t.protected[i] == 1 then return false, "protected" end
			if t.blocked[i] == 1 then return false, "blocked" end
			if t.ramps[i] ~= 0 then return false, "ramp" end
			if t.elevation[i] ~= height then return false, "slope" end
		end
	end
	local pad = Grid.CELL
	for _, r in occupied do
		if footprint.x < r.x + r.w + pad and footprint.x + footprint.w > r.x - pad and footprint.z < r.z + r.h + pad and footprint.z + footprint.h > r.z - pad then return false, "occupied" end
	end
	return true, nil
end

-- 탑을 세우면 그 발자국 셀이 막힌다 (원작 terrainFor). 새 지형 사본을 만든다.
function Grid.withSolids(t: Terrain, rects: { Rect }): Terrain
	if #rects == 0 then return t end
	local copy: Terrain = { blocked = table.clone(t.blocked), elevation = t.elevation, ramps = t.ramps, protected = t.protected, revision = t.revision + #rects }
	for _, r in rects do
		for row = r.z // Grid.CELL, math.ceil((r.z + r.h) / Grid.CELL) - 1 do
			for col = r.x // Grid.CELL, math.ceil((r.x + r.w) / Grid.CELL) - 1 do
				if col >= 0 and row >= 0 and col < Grid.COLS and row < Grid.ROWS then copy.blocked[row * Grid.COLS + col + 1] = 1 end
			end
		end
	end
	return copy
end

return Grid
