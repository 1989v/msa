-- Original Tower.Tick/KgdMover/Climber.WorldStep; rendering uses the same collision parts.
local Terrain=require(game:GetService("ReplicatedStorage"):WaitForChild("InfinityStep").Terrain)
local World={}
function World.new(course,folder)
    local self={time=0,parts={},crumble={},course=course,movers={}}
    for _,part in folder:GetChildren() do
        if part:IsA("BasePart") then
            self.parts[part.Name]=self.parts[part.Name] or {}
            table.insert(self.parts[part.Name],part)
            local p=course.platform(part.Name)
            if p and p.kind=="Ice" then part.CustomPhysicalProperties=PhysicalProperties.new(1,0.02,0,100,100) end
        end
    end
    for _,p in course.platforms do if p.mover>0 then table.insert(self.movers,p) end end
    return setmetatable(self,{__index=World})
end
function World:stand(id,dt)
    local p=self.course.platform(id)
    if not p or p.kind~="Crumble" then return end
    self.crumble[id]=Terrain.stand(self.crumble[id],dt)
end
function World:tick(dt)
    self.time+=dt
    local deltas={}
    for _,p in self.movers do
        if p.mover>0 then
            local m=self.course.movers[p.mover]
            local x,y,z=Terrain.mover(m,self.time)
            local at=Vector3.new(x,y,z)
            local parts=self.parts[p.id]
            if parts then
                local part=parts[1];local nextPosition=at-Vector3.new(0,p.depth/2,0)
                deltas[p.id]=nextPosition-part.Position;part.Position=nextPosition
            end
        end
    end
    for id,c in self.crumble do
        self.crumble[id]=Terrain.tick(c,dt)
        local gone=c.stage==2 and self.crumble[id]~=nil
        for _,part in self.parts[id] or {} do
            part.CanCollide=not gone;part.Transparency=gone and 1 or 0
        end
    end
    return deltas
end
return World
