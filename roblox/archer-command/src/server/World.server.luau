--!nonstrict
-- 분지 지형. Terrain 은 .rbxlx 에 담기 어려워 서버 시작 때 같은 순서로 채운다(결정적). 모델·조명·건물은 빌더가 파일에 넣었다.
local Shared = game:GetService("ReplicatedStorage"):WaitForChild("ArcherCommand")
local Config = require(Shared.Config)
local Terrain = workspace.Terrain
local B, S = Config.BOWL, Config.SITES
local M = Enum.Material

local function block(cx, cy, cz, sx, sy, sz, material, yaw)
	local cf = CFrame.new(cx, cy, cz) * CFrame.Angles(0, yaw or 0, 0)
	Terrain:FillBlock(cf, Vector3.new(sx, sy, sz), material)
end
local function path(a, b, width, material)
	local d = Vector3.new(b.X - a.X, 0, b.Z - a.Z)
	local len = d.Magnitude
	local mid = (a + b) / 2
	Terrain:FillBlock(CFrame.lookAt(Vector3.new(mid.X, -0.2, mid.Z), Vector3.new(b.X, -0.2, b.Z)), Vector3.new(width, 1.4, len), material)
end

-- 바닥(윗면 Y=0)과 분지 바깥 바위 테두리
local w, h = B.maxX - B.minX + 24, B.maxZ - B.minZ + 24
local cx, cz = (B.maxX + B.minX) / 2, (B.maxZ + B.minZ) / 2
block(cx, -6, cz, w, 12, h, M.Grass)
block(cx, 12, B.minZ - 20, w + 80, 48, 40, M.Rock)
block(cx, 12, B.maxZ + 20, w + 80, 48, 40, M.Rock)
block(B.minX - 20, 12, cz, 40, 48, h + 80, M.Rock)
block(B.maxX + 20, 12, cz, 40, 48, h + 80, M.Rock)
-- 멀리 보이는 능선
for _, p in { { -90, -200 }, { 60, -230 }, { 220, -120 }, { 230, 30 }, { -120, 60 } } do
	Terrain:FillBall(Vector3.new(p[1], -10, p[2]), 70, M.Rock)
end
-- 거점이 있는 언덕(완만한 공 모양이라 어디서든 걸어 오른다)
Terrain:FillBall(Config.HILL.center, Config.HILL.radius, M.LeafyGrass)
Terrain:FillCylinder(CFrame.new(S.camp.X, 8.2, S.camp.Z), 3, 14, M.Mud)
-- 사냥터·채집지·본진 마당
Terrain:FillCylinder(CFrame.new(S.hunt.X, -0.3, S.hunt.Z), 1.4, 16, M.Ground)
Terrain:FillCylinder(CFrame.new(S.base.X, -0.3, S.base.Z), 1.4, 20, M.Ground)
Terrain:FillCylinder(CFrame.new(S.healer.X, -0.2, S.healer.Z), 1.4, 6, M.Cobblestone)
for _, site in { S.ore_west, S.ore_east } do Terrain:FillCylinder(CFrame.new(site.X, -0.3, site.Z), 1.4, 8, M.Slate) end
for _, site in { S.wood_west, S.wood_east } do Terrain:FillCylinder(CFrame.new(site.X, -0.3, site.Z), 1.4, 12, M.LeafyGrass) end
-- 전초기지 마당과 웨이브 입구의 검은 흙
Terrain:FillCylinder(CFrame.new(S.outpost_tower.X + 4, -0.3, S.outpost_tower.Z - 8), 1.4, 20, M.Basalt)
Terrain:FillCylinder(CFrame.new(S.wave_entry.X, -0.3, S.wave_entry.Z), 1.4, 12, M.CrackedLava)
-- 자갈길: 본진 → 사냥터 → 전초기지, 본진 → 언덕 아래
path(S.base + Vector3.new(14, 0, 0), S.hunt, 5, M.Cobblestone)
path(S.hunt, S.outpost_tower + Vector3.new(0, 0, 10), 4, M.Cobblestone)
path(S.base + Vector3.new(0, 0, -14), Vector3.new(10, 0, -72), 4, M.Cobblestone)
-- 바위 몇 개
for _, p in { { 50, -50, 5 }, { 120, -130, 7 }, { -10, -90, 4 }, { 150, -40, 6 }, { 70, 20, 4 } } do
	Terrain:FillBall(Vector3.new(p[1], 0, p[2]), p[3], M.Rock)
end
-- 구름은 Terrain 의 자식이어야 보인다
local clouds = Terrain:FindFirstChildOfClass("Clouds") or Instance.new("Clouds")
clouds.Cover = 0.55; clouds.Density = 0.4; clouds.Color = Color3.fromRGB(110, 120, 150); clouds.Enabled = true
clouds.Parent = Terrain
