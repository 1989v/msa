-- KgdOrbitCam: FOV58, pitch -32..62, distance7..15 source units, lookahead2.6.
local Players=game:GetService("Players")
local Input=game:GetService("UserInputService")
local Run=game:GetService("RunService")
local Course=require(game:GetService("ReplicatedStorage"):WaitForChild("InfinityStep").Course)
local Lighting=game:GetService("Lighting")
local player=Players.LocalPlayer
local yaw,pitch=0,math.rad(16)
local distance=60
local focus,previous,ahead=nil,nil,Vector3.zero
local dragging=false
local touch=nil
local function reset()
    focus=nil;previous=nil;ahead=Vector3.zero
    local first=Course.platforms[2] or Course.platforms[1]
    local start=Course.platform("Start") or {x=0,z=-8}
    yaw=math.atan2(first.x-start.x,first.z-start.z)
end
reset()
Input.InputBegan:Connect(function(input,processed)
    if processed then return end
    if input.UserInputType==Enum.UserInputType.MouseButton2 then dragging=true end
    if input.UserInputType==Enum.UserInputType.Touch then
        local camera=workspace.CurrentCamera
        if camera and input.Position.X>camera.ViewportSize.X*0.45 then touch=input end
    end
end)
Input.InputEnded:Connect(function(input)
    if input.UserInputType==Enum.UserInputType.MouseButton2 then dragging=false end
    if input==touch then touch=nil end
end)
Input.InputChanged:Connect(function(input)
    if dragging and input.UserInputType==Enum.UserInputType.MouseMovement or input==touch then
        yaw-=math.rad(input.Delta.X*0.16)
        pitch=math.clamp(pitch+math.rad(input.Delta.Y*0.12),math.rad(-32),math.rad(62))
    end
end)
Input.WindowFocusReleased:Connect(function() dragging=false;touch=nil end)
player.CharacterAdded:Connect(reset)
Run:BindToRenderStep("InfinityOrbit",Enum.RenderPriority.Camera.Value+1,function(dt)
    local character=player.Character
    local root=character and character:FindFirstChild("HumanoidRootPart")
    local camera=workspace.CurrentCamera
    if not root or not camera then return end
    camera.CameraType=Enum.CameraType.Scriptable;camera.FieldOfView=58
    local target=root.Position-Vector3.new(0,3,0)
    local vel=previous and (target-previous)/math.max(dt,0.0001) or Vector3.zero
    previous=target
    local flat=Vector3.new(vel.X,0,vel.Z)
    local want=flat.Magnitude>8 and flat.Unit*10.4 or Vector3.zero
    ahead=ahead:Lerp(want,1-math.exp(-2.5*dt))
    local desired=target+Vector3.new(0,5.4,0)+ahead
    focus=focus and focus:Lerp(desired,1-math.exp(-9*dt)) or desired
    local close=character:GetAttribute("InfinityHanging")==true
    distance+=( (close and 28 or 60)-distance)*(1-math.exp(-4*dt))
    local forward=Vector3.new(math.sin(yaw)*math.cos(pitch),-math.sin(pitch),math.cos(yaw)*math.cos(pitch))
    local delta=-forward*distance
    local params=RaycastParams.new();params.FilterType=Enum.RaycastFilterType.Exclude;params.FilterDescendantsInstances={character}
    local hit=workspace:Raycast(focus,delta,params)
    local at=hit and hit.Position+hit.Normal*2 or focus+delta
    local floor=workspace:Raycast(at+Vector3.new(0,4.4,0),Vector3.new(0,-8.8,0),params)
    if floor and at.Y<floor.Position.Y+4.4 then at=Vector3.new(at.X,floor.Position.Y+4.4,at.Z) end
    camera.CFrame=CFrame.lookAt(at,focus);camera.Focus=CFrame.new(focus)
    local look=Course.look(target.Y)
    local sky=Color3.new(look.sky[1],look.sky[2],look.sky[3])
    Lighting.FogColor=sky;Lighting.FogStart=look.fogStart;Lighting.FogEnd=look.fogEnd
    Lighting.Ambient=sky*2.1+Color3.new(0.05,0.045,0.04);Lighting.Brightness=look.sunPower
end)
