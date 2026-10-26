local Players=game:GetService("Players")
local Run=game:GetService("RunService")
local Replicated=game:GetService("ReplicatedStorage")
local DataStores=game:GetService("DataStoreService")
local Marketplace=game:GetService("MarketplaceService")
local Http=game:GetService("HttpService")
local Shared=Replicated:WaitForChild("InfinityStep")
local Jump=require(Shared.Jump)
local Course=require(Shared.Course)
local Fall=require(Shared.Fall)
local Ledger=require(script.Parent.Ledger)
local Delivery=require(script.Parent.Delivery)
local Receipt=require(script.Parent.Receipt)
local Ingress=require(script.Parent.Ingress)
local PRODUCT_ID=0 -- Configure only after private published receipt verification.
local STUDIO=Run:IsStudio()
local remote=Shared:WaitForChild("Action")
local state=Shared:WaitForChild("State")
local store=not STUDIO and DataStores:GetDataStore("InfinityStepTickets_v1") or nil
local memory={}
local ledger=Ledger.new(function(key,transform)
    if STUDIO then
        if not memory[key] then memory[key]={version=1,balance=3,receipts={},uses={}} end
        memory[key]=transform(memory[key])
        return memory[key]
    end
    return store:UpdateAsync(key,transform)
end,function(target) return target.courseVersion==Course.version and Course.platform(target.platformId)~=nil end,os.time,Http:GenerateGUID(false))
local sessions={}
local productPrice=nil
if not STUDIO and PRODUCT_ID>0 then
    task.spawn(function()
        local ok,info=pcall(Marketplace.GetProductInfo,Marketplace,PRODUCT_ID,Enum.InfoType.Product)
        if ok and type(info.PriceInRobux)=="number" and info.IsForSale~=false then productPrice=info.PriceInRobux end
    end)
end
workspace.Gravity=Jump.Gravity
local function rootOf(character) return character and character:FindFirstChild("HumanoidRootPart") end
local function freeze(character,enabled)
    local root=rootOf(character)
    if root then root.Anchored=enabled; root.AssemblyLinearVelocity=Vector3.zero; root.AssemblyAngularVelocity=Vector3.zero end
end
local function place(character,destination)
    local target=destination.courseVersion==Course.version and Course.platform(destination.platformId)
    local root=rootOf(character)
    if not target or not root or not character.Parent then return false end
    character:PivotTo(CFrame.new(target.x,target.y+5,target.z))
    root.AssemblyLinearVelocity=Vector3.zero
    root.AssemblyAngularVelocity=Vector3.zero
    return true
end
local function notify(player,s)
    if not player.Parent then return end
    state:FireClient(player,{
        epoch=s.fall.epoch,region=Course.regions[s.fall.safeRegion].name,
        current=s.height or 0,best=s.best or 0,balance=s.record and s.record.balance or 0,
        offer=s.fall.offer,test=STUDIO,error=s.error,
        locked=s.locked,purchase=not STUDIO and s.loaded and PRODUCT_ID>0 and productPrice~=nil,
        product=PRODUCT_ID,price=productPrice,
    })
end
local function recover(player,s,character)
    if s.busy then return end
    s.busy=true
    if s.handoff then
        -- ACK committed before its yielding call returned to a replacement character.
        -- Complete the session-local obligation before any new progress/debit.
        if s.character~=character or not place(character,s.handoff.target) then s.busy=false;return end
        s.handoff=nil
    end
    local record,err=ledger:load(player.UserId)
    if s.character~=character then s.busy=false; return end
    if record then
        s.loaded=true; s.record=record
        if record.pending then
            s.locked=true
            record,err,s.handoff=Delivery.run(ledger,player.UserId,record,character,function() return s.character end,freeze,place)
            if record then s.record=record; Fall.clear(s.fall) end
        else freeze(character,false) end
    end
    if record and s.character==character then s.locked=false; s.error=nil else s.error=err or "Storage unavailable; retrying safely" end
    s.busy=false
    notify(player,s)
end
local function ground(character,root)
    local params=RaycastParams.new()
    params.FilterType=Enum.RaycastFilterType.Exclude
    params.FilterDescendantsInstances={character}
    local hit=workspace:Raycast(root.Position,Vector3.new(0,-4.2,0),params)
    if hit and hit.Normal.Y>0.8 then return hit.Instance end
    return nil
end
local function launch(s,root,hum,x,z)
    local velocity=Jump.release(s.charge,os.clock(),ground(s.character,root)~=nil,x,z)
    s.charge=nil; hum.WalkSpeed=12
    if not velocity then return end
    s.flight=Vector3.new(velocity.x,0,velocity.z)
    s.flightAt=os.clock()
    root:SetNetworkOwner(nil)
    hum:ChangeState(Enum.HumanoidStateType.Jumping)
    root.AssemblyLinearVelocity=Vector3.new(velocity.x,velocity.y,velocity.z)
end
remote.OnServerEvent:Connect(function(player,action,payload)
    local s=sessions[player]
    if not s or not Ingress.allow(s,os.clock()) then return end
    if action=="sync" then notify(player,s); return end
    if type(payload)~="table" or payload.epoch~=s.fall.epoch or s.busy or s.locked then return end
    local now=os.clock()
    if action~="release" and now-(s.lastAction or 0)<0.06 then return end
    s.lastAction=now
    local root=rootOf(s.character)
    local hum=s.character and s.character:FindFirstChildOfClass("Humanoid")
    if not root or not hum or hum.Health<=0 then return end
    if action=="start" then
        local x,z=Jump.direction(payload.x,payload.z)
        if not s.charge and not s.flight and x and ground(s.character,root) then
            s.charge=now;s.direction={x,z};hum.WalkSpeed=4
        end
    elseif action=="release" then
        if not s.charge then return end
        launch(s,root,hum,payload.x,payload.z)
    elseif action=="dismiss" then Fall.clear(s.fall)
    elseif action=="restart" then
        Fall.clear(s.fall);s.charge=nil;s.flight=nil;hum.WalkSpeed=12
        place(s.character,{courseVersion=Course.version,platformId="Start"});s.fall.safeRegion=1;s.fall.safeY=0
    elseif action=="use" and Fall.valid(s.fall,payload.token,payload.epoch) and s.loaded then
        local character=s.character
        local target={courseVersion=Course.version,platformId=s.fall.offer.platformId}
        local operation=Http:GenerateGUID(false)
        s.busy=true;s.locked=true;freeze(character,true)
        local record,err=ledger:reserve(player.UserId,operation,target)
        if record then
            s.record=record
            Fall.clear(s.fall)
            if s.character==character then
                record,err,s.handoff=Delivery.run(ledger,player.UserId,record,character,function() return s.character end,freeze,place)
                if record then s.record=record end
            else record=nil;err="Delivery retained for current character" end
        end
        s.busy=false
        if record and s.character==character then s.locked=false;s.error=nil
        elseif s.character==character then
            s.error=err
            -- A rejected reservation must also check for a competing pending delivery before unlocking.
        end
        s.charge=nil;s.flight=nil
    elseif action=="purchase" and not STUDIO and s.loaded and PRODUCT_ID>0 and productPrice then
        Marketplace:PromptProductPurchase(player,PRODUCT_ID)
    end
    notify(player,s)
end)
Marketplace.ProcessReceipt=function(receipt)
    local granted=Receipt.process(receipt,PRODUCT_ID,function(id)
        local p=Players:GetPlayerByUserId(id)
        return p~=nil and sessions[p]~=nil and sessions[p].loaded
    end,ledger)
    if granted then
        local p=Players:GetPlayerByUserId(receipt.PlayerId)
        local s=p and sessions[p]
        if s then
            -- Refresh via atomic read; never replace newer grants with a stale save.
            local record,err=ledger:load(p.UserId)
            if record then s.record=record else s.error=err end
            notify(p,s)
        end
    end
    return granted and Enum.ProductPurchaseDecision.PurchaseGranted or Enum.ProductPurchaseDecision.NotProcessedYet
end
local function addPlayer(player)
    local s={fall=Fall.new(),locked=true,loaded=false,best=0}
    sessions[player]=s
    local function spawn(character)
        local root=character:WaitForChild("HumanoidRootPart")
        local hum=character:WaitForChild("Humanoid")
        s.character=character;s.charge=nil;s.flight=nil;s.locked=true
        Fall.character(s.fall,s.died==true);s.died=false
        hum.UseJumpPower=true;hum.JumpPower=0;hum.WalkSpeed=12
        hum:SetStateEnabled(Enum.HumanoidStateType.Jumping,false)
        freeze(character,true)
        hum.Died:Connect(function()
            if s.character~=character then return end
            Fall.death(s.fall);s.died=true;s.charge=nil;s.flight=nil
        end)
        recover(player,s,character)
    end
    player.CharacterAdded:Connect(spawn)
    if player.Character then task.spawn(spawn,player.Character) end
end
Players.PlayerAdded:Connect(addPlayer)
for _,player in Players:GetPlayers() do addPlayer(player) end
Players.PlayerRemoving:Connect(function(player)
    local s=sessions[player]
    if s then s.character=nil end
    sessions[player]=nil -- No whole-record exit save; all operations are already durable.
end)
local tickAccum=0
Run.Heartbeat:Connect(function(dt)
    tickAccum+=dt
    local send=tickAccum>=0.15
    if send then tickAccum=0 end
    for player,s in sessions do
        local root=rootOf(s.character)
        local hum=s.character and s.character:FindFirstChildOfClass("Humanoid")
        if not root or not hum then continue end
        if s.locked then
            if not s.busy and os.clock()-(s.retryAt or 0)>2 then
                s.retryAt=os.clock();task.spawn(recover,player,s,s.character)
            end
            continue
        end
        if hum.Health<=0 then continue end
        if s.charge and os.clock()-s.charge>=Jump.MaxHold then launch(s,root,hum,s.direction[1],s.direction[2]) end
        local floor=ground(s.character,root)
        local velocity=root.AssemblyLinearVelocity
        if s.flight then
            hum:Move(Vector3.zero,false)
            if floor and os.clock()-s.flightAt>0.15 and velocity.Y<2 then
                s.flight=nil;root:SetNetworkOwnershipAuto()
            else
                -- Sweep forward to stop against walls; never CFrame through collision solids.
                local params=RaycastParams.new();params.FilterType=Enum.RaycastFilterType.Exclude;params.FilterDescendantsInstances={s.character}
                local hit=workspace:Raycast(root.Position,s.flight*math.max(dt,0.03)+(s.flight.Magnitude>0.01 and s.flight.Unit*1.2 or Vector3.zero),params)
                if hit and math.abs(hit.Normal.Y)<0.7 then s.flight=Vector3.zero end
                root.AssemblyLinearVelocity=Vector3.new(s.flight.X,velocity.Y,s.flight.Z)
            end
        elseif not floor then
            -- Walking off an edge also commits horizontal momentum until contact.
            s.flight=Vector3.new(velocity.X,0,velocity.Z);s.flightAt=os.clock();root:SetNetworkOwner(nil)
        end
        if floor and math.abs(velocity.Y)<2 then
            if s.floor==floor then s.stable=(s.stable or 0)+dt else s.floor=floor;s.stable=0 end
            if s.stable>=0.12 then Fall.land(s.fall,Course.platform(floor.Name)) end
        else s.floor=nil;s.stable=0 end
        s.height=math.max(0,root.Position.Y-3)
        s.best=math.max(s.best,s.height)
        Fall.sample(s.fall,s.height,velocity.Y < -2)
        if root.Position.Y < -35 then hum.Health=0 end
        if send then notify(player,s) end
    end
end)
