local Players=game:GetService("Players")
local Run=game:GetService("RunService")
local Replicated=game:GetService("ReplicatedStorage")
local DataStores=game:GetService("DataStoreService")
local Marketplace=game:GetService("MarketplaceService")
local Http=game:GetService("HttpService")
local Shared=Replicated:WaitForChild("InfinityStep")
local Jump=require(Shared.Jump)
local Traverse=require(Shared.Traverse)
local Course=require(Shared.Course)
local Fall=require(Shared.Fall)
local Ledger=require(script.Parent.Ledger)
local Delivery=require(script.Parent.Delivery)
local Receipt=require(script.Parent.Receipt)
local Progress=require(script.Parent.Progress)
local Recovery=require(script.Parent.Recovery)
local World=require(script.Parent.World)
local world=World.new(Course,workspace:WaitForChild("Course"))
local Ingress=require(script.Parent.Ingress)
local PRODUCT_ID=0 -- Configure only after private published receipt verification.
local STUDIO=Run:IsStudio()
local remote=Shared:WaitForChild("Action")
local state=Shared:WaitForChild("State")
local store=not STUDIO and DataStores:GetDataStore("InfinityStepTickets_v1") or nil
local progressStore=not STUDIO and DataStores:GetDataStore("InfinityStepProgress_v2") or nil
local progressMemory={}
local function updateProgress(key,transform)
    if STUDIO then
        local updated=transform(progressMemory[key])
        if updated~=nil then progressMemory[key]=updated end
        return updated
    end
    return progressStore:UpdateAsync(key,transform)
end
local memory={}
local ledger=Ledger.new(function(key,transform)
    if STUDIO then
        if not memory[key] then memory[key]={version=1,balance=3,receipts={},uses={}} end
        memory[key]=transform(memory[key])
        return memory[key]
    end
    return store:UpdateAsync(key,transform)
end,function(target) return Course.resolve(target)~=nil end,os.time,Http:GenerateGUID(false))
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
local legacyPads={}
local function place(character,destination)
    local target=Course.resolve(destination)
    local root=rootOf(character)
    if not target or not root or not character.Parent then return false end
    local x,y,z=target.x,target.y,target.z
    if destination.courseVersion==Course.version and target.id~="Start" then
        local parts=world.parts[target.id]
        if not parts or not parts[1].CanCollide then return false end
        if target.mover>0 then x=parts[1].Position.X;y=parts[1].Position.Y+target.depth/2;z=parts[1].Position.Z end
        local params=OverlapParams.new();params.FilterType=Enum.RaycastFilterType.Exclude;params.FilterDescendantsInstances={character}
        for _,part in workspace:GetPartBoundsInBox(CFrame.new(x,y+5,z),Vector3.new(3,7,3),params) do
            if part.CanCollide then return false end
        end
    end
    if destination.courseVersion==1 then
        -- Exact legacy target is materialized only for a durable v1 obligation.
        -- Refuse overlapping terrain and retain the pending right; never substitute a target.
        local params=OverlapParams.new();params.FilterType=Enum.RaycastFilterType.Exclude;params.FilterDescendantsInstances={character}
        local bounds=workspace:GetPartBoundsInBox(CFrame.new(target.x,target.y+5,target.z),Vector3.new(4,7,4),params)
        for _,part in bounds do if part.CanCollide then return false end end
        local pad=legacyPads[target.id]
        if not pad or not pad.Parent then
            pad=Instance.new("Part");pad.Name="LegacyDelivery_"..target.id
            pad:SetAttribute("LegacyDelivery",true);pad.Anchored=true;pad.Size=Vector3.new(12,1,12)
            pad.Position=Vector3.new(target.x,target.y-0.5,target.z);pad.Parent=workspace;legacyPads[target.id]=pad
            task.delay(120,function() if pad.Parent then pad:Destroy() end end)
        end
    end
    character:PivotTo(CFrame.new(x,y+5,z))
    root.AssemblyLinearVelocity=Vector3.zero
    root.AssemblyAngularVelocity=Vector3.zero
    return true
end
local function notify(player,s)
    if not player.Parent then return end
    state:FireClient(player,{
        epoch=s.fall.epoch,region=Course.regions[s.fall.safeRegion].name,falls=s.falls or 0,stamina=s.stamina or 100,hanging=s.hang~=nil,climbing=s.climb~=nil,finished=s.finished==true,
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
    if not s.progressLoaded then
        local run,progressError=s.progress:load(player.UserId)
        if s.character~=character then s.busy=false;return end
        if not run then s.error=progressError;s.busy=false;notify(player,s);return end
        s.progressLoaded=true;s.savedRun=run;s.best=run.best;s.falls=run.falls;s.elapsed=run.elapsed or 0;s.summitSec=run.summitSec or 0;s.finished=s.summitSec>0
    end
    local record,err=ledger:load(player.UserId)
    if s.character~=character then s.busy=false; return end
    if record then
        s.loaded=true; s.record=record
        if record.pending then
            s.savedRun=nil
            s.locked=true
            record,err,s.handoff=Delivery.run(ledger,player.UserId,record,character,function() return s.character end,freeze,place)
            if record then s.record=record; Fall.clear(s.fall) end
        else
            if s.savedRun then
                local target=Course.resume(s.savedRun.alt)
                if not place(character,{courseVersion=Course.version,platformId=target.id}) then s.busy=false;return end
                s.savedRun=nil
            end
            freeze(character,false)
        end
    end
    Recovery.finish(s,character,record,err)
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
local function detach(s,root)
    s.hang=nil;s.climb=nil;s.pull=nil;s.cool=os.clock()+0.25
    root.Anchored=false;s.character:SetAttribute("InfinityHanging",false)
end
local function surface(s,root,direction)
    if direction.Magnitude<0.01 then return nil end
    local params=RaycastParams.new();params.FilterType=Enum.RaycastFilterType.Exclude;params.FilterDescendantsInstances={s.character}
    local hit=workspace:Raycast(root.Position-Vector3.new(0,1.1,0),direction.Unit*5.7,params)
    local p=hit and Course.platform(hit.Instance.Name)
    if not p or not hit.Instance.CanCollide or math.abs(hit.Normal.Y)>0.3 then return nil end
    local top=hit.Instance.Position.Y+hit.Instance.Size.Y/2
    return {p=p,part=hit.Instance,top=top,inward=-hit.Normal}
end
local function startPull(s,root)
    local h=s.hang
    if not h then return end
    local goal=Vector3.new(root.Position.X,h.top+3.2,root.Position.Z)+h.inward*3.68
    local params=OverlapParams.new();params.FilterType=Enum.RaycastFilterType.Exclude;params.FilterDescendantsInstances={s.character}
    for _,part in workspace:GetPartBoundsInBox(CFrame.new(goal),Vector3.new(2.8,6,2.8),params) do
        if part.CanCollide then return end
    end
    s.pull={from=root.Position,to=goal,start=os.clock()};s.hang=nil
end
local function launch(s,root,hum,x,z)
    local velocity=Jump.release(s.charge,os.clock(),ground(s.character,root)~=nil,x,z)
    s.charge=nil; hum.WalkSpeed=Traverse.walkSpeed(s.running,s.charge~=nil)
    if not velocity then return end
    local bonus=s.running and 1+Traverse.RunJumpBonus or 1
    s.flight=Vector3.new(velocity.x*bonus,0,velocity.z*bonus)
    s.flightAt=os.clock()
    root:SetNetworkOwner(nil)
    hum:ChangeState(Enum.HumanoidStateType.Freefall)
    root.AssemblyLinearVelocity=Vector3.new(s.flight.X,velocity.y,s.flight.Z)
end
remote.OnServerEvent:Connect(function(player,action,payload)
    local s=sessions[player]
    if not s or not Ingress.allow(s,os.clock()) then return end
    if action=="sync" then notify(player,s); return end
    if type(payload)~="table" or payload.epoch~=s.fall.epoch or s.busy or s.locked then return end
    if action=="move" then
        local x,z=payload.x,payload.z
        if Jump.finite(x) and Jump.finite(z) and x*x+z*z<=1.21 then
            s.wish=Vector3.new(x,0,z)
            if s.wish.Magnitude>1 then s.wish=s.wish.Unit end
        end
        return
    end
    local now=os.clock()
    if action~="release" and now-(s.lastAction or 0)<0.06 then return end
    s.lastAction=now
    local root=rootOf(s.character)
    local hum=s.character and s.character:FindFirstChildOfClass("Humanoid")
    if not root or not hum or hum.Health<=0 then return end
    if action=="grab" then
        if s.hang or s.climb or s.pull then detach(s,root)
        elseif not ground(s.character,root) and (s.stamina or 100)>0 then
            local d=(s.wish or Vector3.zero).Magnitude>0.01 and (s.wish or Vector3.zero) or root.CFrame.LookVector
            local wall=surface(s,root,d)
            if wall and wall.p.kind=="Wall" and wall.top-(root.Position.Y-3)>8.8 then
                s.climb=wall;s.flight=nil;s.charge=nil;root.Anchored=true;s.character:SetAttribute("InfinityHanging",true)
            end
        end
    elseif action=="run" then
        s.running=payload.enabled==true;hum.WalkSpeed=Traverse.walkSpeed(s.running,s.charge~=nil)
    elseif action=="start" then
        if s.hang then startPull(s,root);notify(player,s);return end
        if s.climb or s.pull then return end
        local x,z=Jump.direction(payload.x,payload.z)
        if not s.charge and not s.flight and x and ground(s.character,root) then
            s.charge=now;s.direction={x,z};hum.WalkSpeed=Traverse.walkSpeed(s.running,true)
        end
    elseif action=="release" then
        if not s.charge then return end
        launch(s,root,hum,payload.x,payload.z)
    elseif action=="dismiss" then Fall.clear(s.fall)
    elseif action=="restart" then
        Fall.clear(s.fall);detach(s,root);s.charge=nil;s.flight=nil;hum.WalkSpeed=Traverse.walkSpeed(s.running,s.charge~=nil)
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
    -- A new owner and independent epoch/sequence state on EVERY join, including a return
    -- to this still-running server after a different server claimed the saved run.
    local s={fall=Fall.new(),locked=true,loaded=false,best=0,
        progress=Progress.new(updateProgress,Course.seed,Http:GenerateGUID(false))}
    sessions[player]=s
    local function spawn(character)
        local root=character:WaitForChild("HumanoidRootPart")
        local hum=character:WaitForChild("Humanoid")
        s.character=character;s.charge=nil;s.flight=nil;s.hang=nil;s.climb=nil;s.pull=nil;s.stamina=100;s.running=false;s.locked=true
        Fall.character(s.fall,s.died==true);s.died=false
        hum.UseJumpPower=true;hum.JumpPower=0;hum.WalkSpeed=Traverse.walkSpeed(s.running,s.charge~=nil)
        hum:SetStateEnabled(Enum.HumanoidStateType.Jumping,false)
        freeze(character,true)
        hum.Died:Connect(function()
            if s.character~=character then return end
            Fall.death(s.fall);s.died=true;s.charge=nil;s.flight=nil;s.falls=(s.falls or 0)+1
        end)
        recover(player,s,character)
    end
    player.CharacterAdded:Connect(spawn)
    if player.Character then task.spawn(spawn,player.Character) end
end
Players.PlayerAdded:Connect(addPlayer)
for _,player in Players:GetPlayers() do addPlayer(player) end
local function saveProgress(player,s)
    if not s.progressLoaded then return end
    local root=rootOf(s.character)
    local alt=root and math.max(0,root.Position.Y-3) or s.height or 0
    s.progressPending={alt=alt,best=math.max(s.best or 0,alt),falls=s.falls or 0,elapsed=s.elapsed or 0,summitSec=s.summitSec or 0}
    if s.progressSaving then return end
    s.progressSaving=true
    repeat
        local sample=s.progressPending;s.progressPending=nil
        local result,err=s.progress:save(player.UserId,sample)
        if not result then s.error=err end
    until not s.progressPending
    s.progressSaving=false
    if s.leaving then s.progress:close() end
end
Players.PlayerRemoving:Connect(function(player)
    local s=sessions[player]
    if not s then return end
    s.leaving=true
    local root=rootOf(s.character)
    s.height=root and math.max(0,root.Position.Y-3) or s.height
    s.character=nil
    sessions[player]=nil
    -- Drain an already-yielding final sample using this join's handle. New joins get
    -- a different owner; their atomic claim fences this old work even before close.
    saveProgress(player,s)
    if not s.progressSaving then s.progress:close() end
end)
local tickAccum=0
Run.Heartbeat:Connect(function(dt)
    tickAccum+=dt
    local send=tickAccum>=0.15
    if send then tickAccum=0 end
    local deltas=world:tick(dt)
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
        s.elapsed=(s.elapsed or 0)+dt
        if os.clock()-(s.progressSaveAt or 0)>5 then
            s.progressSaveAt=os.clock();task.spawn(saveProgress,player,s)
        end
        if s.pull then
            local p=s.pull;local t=math.clamp((os.clock()-p.start)/Traverse.PullTime,0,1)
            local up=math.min(1,t*1.4);up=up*up*(3-2*up)
            root.CFrame=CFrame.new(p.from.X+(p.to.X-p.from.X)*t*t,p.from.Y+(p.to.Y-p.from.Y)*up,p.from.Z+(p.to.Z-p.from.Z)*t*t)
            if t>=1 then detach(s,root) end
        elseif s.hang or s.climb then
            local h=s.hang or s.climb
            s.stamina=Traverse.drain(s.stamina,dt);s.regainAt=os.clock()+Traverse.RegainDelay
            if s.stamina<=0 or not h.part.CanCollide then detach(s,root)
            elseif s.hang then
                local want=h.top-Traverse.LedgeMaxRise+3
                root.CFrame=root.CFrame+Vector3.new(0,(want-root.Position.Y)*(1-math.exp(-14*dt)),0)
            else
                local direction=(s.wish or Vector3.zero)
                local up=direction:Dot(h.inward)
                local side=Vector3.new(h.inward.Z,0,-h.inward.X)
                local lateral=direction:Dot(side)
                local step=(Vector3.new(0,up,0)+side*lateral)
                if step.Magnitude>1 then step=step.Unit end
                local wall=surface(s,root,h.inward)
                if not wall or wall.p.kind~="Wall" then detach(s,root)
                else root.CFrame=root.CFrame+step*Traverse.ClimbSpeed*dt end
                if s.climb and h.top-(root.Position.Y-3)<=Traverse.LedgeMaxRise then s.hang=h;s.climb=nil;startPull(s,root) end
            end
            root.AssemblyLinearVelocity=Vector3.zero
        end
        if s.hang or s.climb or s.pull then
            s.height=math.max(0,root.Position.Y-3);s.best=math.max(s.best,s.height)
            if send then notify(player,s) end
            continue
        end
        if s.charge and os.clock()-s.charge>=Jump.MaxHold then launch(s,root,hum,s.direction[1],s.direction[2]) end
        local floor=ground(s.character,root)
        local velocity=root.AssemblyLinearVelocity
        local look=Course.look(root.Position.Y)
        if not floor then
            velocity+=Vector3.new(look.wind[1],0,look.wind[3])*dt
            -- Workspace gravity is global; compensate per avatar for the original altitude scale.
            velocity+=Vector3.new(0,Jump.Gravity*(1-look.gravity)*dt,0)
            root.AssemblyLinearVelocity=velocity
            if os.clock()>(s.cool or 0) then
                local d=s.flight and s.flight.Magnitude>0.01 and s.flight or (s.wish or Vector3.zero).Magnitude>0.01 and (s.wish or Vector3.zero) or root.CFrame.LookVector
                local ledge=surface(s,root,d)
                local rise=ledge and ledge.top-(root.Position.Y-3) or 0
                local stamina=Traverse.grab(s.stamina or 100,rise)
                if ledge and stamina and not (velocity.Y>0 and root.Position.Y-3+velocity.Y^2/(2*Jump.Gravity*look.gravity)>=ledge.top) then
                    s.stamina=stamina;s.hang=ledge;s.flight=nil;s.charge=nil;root.Anchored=true
                    s.character:SetAttribute("InfinityHanging",true)
                end
            end
        end
        if floor then
            if os.clock()>=(s.regainAt or 0) then s.stamina=math.min(100,(s.stamina or 100)+Traverse.Regain*dt) end
            world:stand(floor.Name,dt)
            if deltas[floor.Name] then root.CFrame+=deltas[floor.Name] end
            local platform=Course.platform(floor.Name)
            if platform and platform.grade>0 and (platform.kind=="Ice" or platform.grade>=0.45) then
                root.AssemblyLinearVelocity+=Vector3.new(-platform.slopeX,0,-platform.slopeZ)*(platform.grade*36*dt)
            end
        end
        if s.flight then
            hum:Move(Vector3.zero,false)
            if floor and os.clock()-s.flightAt>0.15 and velocity.Y<2 then
                s.flight=nil;root:SetNetworkOwnershipAuto()
            else
                -- Sweep forward to stop against walls; never CFrame through collision solids.
                local params=RaycastParams.new();params.FilterType=Enum.RaycastFilterType.Exclude;params.FilterDescendantsInstances={s.character}
                local hit=workspace:Raycast(root.Position,s.flight*math.max(dt,0.03)+(s.flight.Magnitude>0.01 and s.flight.Unit*1.2 or Vector3.zero),params)
                if hit and math.abs(hit.Normal.Y)<0.7 then s.flight=Vector3.zero end
                root.AssemblyLinearVelocity=Vector3.new(s.flight.X,math.max(-Traverse.TerminalFall,velocity.Y),s.flight.Z)
            end
        elseif not floor then
            -- KgdTraverse.Air: walking off remains steerable at 3/s toward run speed.
            local wish=(s.wish or Vector3.zero)
            local x,y,z=Traverse.air(velocity.X,velocity.Y,velocity.Z,wish.X,wish.Z,dt,false)
            root.AssemblyLinearVelocity=Vector3.new(x,y,z)
        end
        if floor and math.abs(velocity.Y)<2 then
            if s.floor==floor then s.stable=(s.stable or 0)+dt else s.floor=floor;s.stable=0 end
            if s.stable>=0.12 then
                Fall.land(s.fall,Course.platform(floor.Name))
                if s.airPeak and s.airPeak-(root.Position.Y-3)>40 then s.falls=(s.falls or 0)+1 end
                s.airPeak=nil
                if floor.Name==Course.path[#Course.path] then
                    s.finished=true
                    if (s.summitSec or 0)==0 then s.summitSec=s.elapsed end
                end
            end
        else s.floor=nil;s.stable=0;s.airPeak=math.max(s.airPeak or 0,root.Position.Y-3) end
        s.height=math.max(0,root.Position.Y-3)
        s.best=math.max(s.best,s.height)
        Fall.sample(s.fall,s.height,velocity.Y < -2)
        if root.Position.Y < -35 then hum.Health=0 end
        if send then notify(player,s) end
    end
end)
