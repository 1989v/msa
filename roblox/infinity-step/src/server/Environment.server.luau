local Workspace = game:GetService("Workspace")
local PhysicsService = game:GetService("PhysicsService")
local Terrain = Workspace.Terrain
Terrain:FillBlock(CFrame.new(330, -7, 0), Vector3.new(1100, 12, 420), Enum.Material.Rock)
Terrain:FillBlock(CFrame.new(-115, -0.8, 0), Vector3.new(32, 3, 380), Enum.Material.Water)
Terrain:FillBlock(CFrame.new(330, -0.5, -95), Vector3.new(1100, 3, 110), Enum.Material.Grass)
Terrain.WaterColor = Color3.fromRGB(42, 97, 108)
Terrain.WaterTransparency = 0.3
if not Terrain:FindFirstChildOfClass("Clouds") then
 local clouds = Instance.new("Clouds")
 clouds.Cover, clouds.Density = 0.48, 0.55
 clouds.Parent = Terrain
end
pcall(function() PhysicsService:RegisterCollisionGroup("Scenery") end)
PhysicsService:CollisionGroupSetCollidable("Scenery", "Default", false)
for _, object in Workspace.NativeWorld:GetDescendants() do
 if object:IsA("BasePart") and not object.CanCollide then object.CollisionGroup = "Scenery" end
end
