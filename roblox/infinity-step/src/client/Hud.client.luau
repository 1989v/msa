local Players=game:GetService("Players")
local Input=game:GetService("UserInputService")
local Action=game:GetService("ContextActionService")
local Run=game:GetService("RunService")
local Shared=game:GetService("ReplicatedStorage"):WaitForChild("InfinityStep")
local Jump=require(Shared.Jump)
local ChargeInput=require(Shared.ChargeInput)
local HudLayout=require(Shared.HudLayout)
local Course=require(Shared.Course)
local Theme=require(Shared.Theme)
local remote=Shared:WaitForChild("Action")
local state=Shared:WaitForChild("State")
local player=Players.LocalPlayer
local function color(name) return Color3.fromRGB(table.unpack(Theme[name])) end
local gui=Instance.new("ScreenGui")
gui.Name="InfinityStepHUD";gui.ResetOnSpawn=false;gui.IgnoreGuiInset=false
gui.ScreenInsets=Enum.ScreenInsets.DeviceSafeInsets
gui.Parent=player:WaitForChild("PlayerGui")
local canvas=Instance.new("Frame")
canvas.Size=UDim2.fromScale(1,1);canvas.BackgroundTransparency=1;canvas.Parent=gui
local function text(parent,kind,label,size,pos)
    local item=Instance.new(kind)
    item.Text=label;item.Size=size;item.Position=pos
    item.Font=Enum.Font.GothamMedium;item.TextSize=Theme.textSize
    item.TextColor3=color("hanji");item.BackgroundColor3=color("giwa")
    item.BorderSizePixel=0;item.TextWrapped=true;item.Parent=parent
    return item
end
local status=text(canvas,"TextLabel","인피니티 스탭 / 연결 중",UDim2.new(1,-32,0,72),UDim2.fromOffset(16,12))
local meter=text(canvas,"TextLabel","[ ] [ ] [ ] [ ] [ ]",UDim2.fromOffset(240,40),UDim2.new(0.5,-120,0,88))
local help=text(canvas,"TextLabel","WASD 이동 · C/Space 점프 · X 잡기/놓기 · Z 달리기 · 우클릭 시점",UDim2.new(1,-32,0,36),UDim2.fromOffset(16,132))
help.TextSize=14
local jump=text(canvas,"TextButton","누르고\n점프",UDim2.fromOffset(96,72),UDim2.new(1,-116,1,-240))
jump.BackgroundColor3=color("yeonji")
local grab=text(canvas,"TextButton","잡기/놓기",UDim2.fromOffset(64,56),UDim2.fromOffset(0,0))
local runButton=text(canvas,"TextButton","달리기",UDim2.fromOffset(64,44),UDim2.fromOffset(0,0))
local runOwner={}
local panel=Instance.new("Frame")
panel.Size=UDim2.new(1,-32,0,180);panel.Position=UDim2.fromOffset(16,176)
panel.BackgroundColor3=color("giwa");panel.Visible=false;panel.Parent=canvas
local destination=text(panel,"TextLabel","",UDim2.new(1,-16,0,64),UDim2.fromOffset(8,0))
local use=text(panel,"TextButton","부활권 1장 사용",UDim2.new(0.5,-12,0,48),UDim2.fromOffset(8,72))
use.BackgroundColor3=color("celadon")
local dismiss=text(panel,"TextButton","무료로 계속",UDim2.new(0.5,-12,0,48),UDim2.new(0.5,4,0,72))
local buy=text(panel,"TextButton","구매 비활성",UDim2.new(1,-16,0,48),UDim2.fromOffset(8,128))
local restart=text(canvas,"TextButton","처음부터 (무료)",UDim2.fromOffset(128,48),UDim2.new(1,-144,1,-304))
local data={epoch=0,locked=true,balance=0}
local held=nil
local moveSentAt=0
local inputOwner={}
local function reflow()
    local size=canvas.AbsoluteSize
    if size.X<=0 or size.Y<=0 then return end
    local layout=HudLayout.compute(size.X,size.Y,data.offer~=nil)
    for name,item in {status=status,meter=meter,help=help,jump=jump,grab=grab,run=runButton,restart=restart,panel=panel} do
        local r=layout[name]
        item.Position=UDim2.fromOffset(r.x,r.y);item.Size=UDim2.fromOffset(r.w,r.h)
    end
    status.TextSize=layout.compact and 14 or Theme.textSize
    if data.region then status.Text=HudLayout.status(data,layout.compact) end
    help.Visible=not layout.compact and not layout.modal
    meter.Visible=not layout.modal
    jump.Visible=not layout.modal;grab.Visible=not layout.modal;runButton.Visible=not layout.modal;restart.Visible=not layout.modal
end
canvas:GetPropertyChangedSignal("AbsoluteSize"):Connect(reflow)
reflow()
local function send(action,extra)
    local payload=extra or {};payload.epoch=data.epoch
    remote:FireServer(action,payload)
end
local function direction()
    local character=player.Character
    local hum=character and character:FindFirstChildOfClass("Humanoid")
    local dir=hum and hum.MoveDirection or Vector3.zero
    if dir.Magnitude<0.01 then
        local camera=workspace.CurrentCamera
        dir=camera and camera.CFrame.LookVector or Vector3.new(1,0,0)
    end
    dir=Vector3.new(dir.X,0,dir.Z)
    if dir.Magnitude<0.01 then dir=Vector3.new(1,0,0) end
    return dir.Unit
end
local function begin(input)
    if held or data.locked or not ChargeInput.begin(inputOwner,input) then return end
    held=os.clock()
    local dir=direction();send("start",{x=dir.X,z=dir.Z})
end
local function finish(input,forced)
    local accepted=forced and ChargeInput.cancel(inputOwner) or ChargeInput.finish(inputOwner,input)
    if not held or not accepted then return end
    held=nil
    local dir=direction();send("release",{x=dir.X,z=dir.Z})
end
Action:BindActionAtPriority("InfinityCharge",function(_,inputState)
    if inputState==Enum.UserInputState.Begin then begin("bound")
    elseif inputState==Enum.UserInputState.End or inputState==Enum.UserInputState.Cancel then finish("bound") end
    return Enum.ContextActionResult.Sink
end,false,3000,Enum.KeyCode.C,Enum.KeyCode.Space,Enum.KeyCode.ButtonA)
Action:BindAction("InfinityGrab",function(_,inputState)
    if inputState==Enum.UserInputState.Begin then send("grab") end
    return Enum.ContextActionResult.Sink
end,false,Enum.KeyCode.X)
Action:BindAction("InfinityRun",function(_,inputState)
    send("run",{enabled=inputState==Enum.UserInputState.Begin})
    return Enum.ContextActionResult.Sink
end,false,Enum.KeyCode.Z,Enum.KeyCode.LeftShift)
grab.Activated:Connect(function() if not data.locked then send("grab") end end)
runButton.InputBegan:Connect(function(input)
    if data.locked then return end
    if input.UserInputType==Enum.UserInputType.Touch or input.UserInputType==Enum.UserInputType.MouseButton1 then
        if ChargeInput.begin(runOwner,input) then send("run",{enabled=true}) end
    end
end)
jump.InputBegan:Connect(function(input)
    if input.UserInputType==Enum.UserInputType.Touch or input.UserInputType==Enum.UserInputType.MouseButton1 then begin(input) end
end)
Input.InputEnded:Connect(function(input)
    if ChargeInput.finish(runOwner,input) then send("run",{enabled=false}) end
    if input.UserInputType==Enum.UserInputType.Touch or input.UserInputType==Enum.UserInputType.MouseButton1 then finish(input) end
end)
Input.WindowFocusReleased:Connect(function() finish(nil,true);if ChargeInput.cancel(runOwner) then send("run",{enabled=false}) end end)
use.Activated:Connect(function() if data.offer and data.balance>0 then send("use",{token=data.offer.token}) end end)
dismiss.Activated:Connect(function() send("dismiss") end)
restart.Activated:Connect(function() send("restart") end)
buy.Activated:Connect(function() if data.purchase and not data.locked then send("purchase") end end)
state.OnClientEvent:Connect(function(nextData)
    if data.epoch~=nextData.epoch or nextData.locked then held=nil;ChargeInput.cancel(inputOwner) end
    data=nextData
    help.Text=data.error and ("저장: "..data.error) or data.hanging and "매달림: C/Space로 올라서기 · X로 놓기" or "WASD 이동 · C/Space 점프 · X 잡기/놓기 · Z 달리기 · 우클릭 시점"
    panel.Visible=data.offer~=nil
    if data.offer then destination.Text="복귀: "..data.offer.platformId.." / "..Course.regions[data.offer.region].name.."?\n선택 사항 · 무료로 계속할 수 있습니다" end
    use.Text=data.balance>0 and "부활권 1장 사용" or "부활권 없음"
    use.Active=data.balance>0 and not data.locked
    buy.Text=data.purchase and ("부활권 1장 · "..tostring(data.price).." Robux") or (data.test and "스튜디오 · 테스트 3장 · 구매 비활성" or "구매 비활성")
    buy.Active=data.purchase==true and not data.locked
    reflow()
end)
Run.RenderStepped:Connect(function()
    if not data.locked and os.clock()-moveSentAt>=0.1 then
        moveSentAt=os.clock()
        local character=player.Character
        local hum=character and character:FindFirstChildOfClass("Humanoid")
        local wish=hum and hum.MoveDirection or Vector3.zero
        send("move",{x=wish.X,z=wish.Z})
    end
    local level=held and Jump.level(os.clock()-held) or 0
    local segments={}
    for i=1,5 do segments[i]=i<=level and "[■]" or "[ ]" end
    meter.Text=table.concat(segments," ")..((data.hanging or data.climbing or (data.stamina or 100)<99) and string.format("  체력 %.0f",data.stamina or 100) or "")
    if held and os.clock()-held>=Jump.MaxHold then finish(nil,true) end
end)
player.CharacterAdded:Connect(function() held=nil;ChargeInput.cancel(inputOwner);send("sync") end)
send("sync")
