local HudLayout=require("../src/shared/HudLayout")
local ChargeInput=require("../src/shared/ChargeInput")
local Jump=require("../src/shared/Jump")
local Course=require("../src/shared/Course")
local Fall=require("../src/shared/Fall")
local Ledger=require("../src/server/Ledger")
local Delivery=require("../src/server/Delivery")
local Ingress=require("../src/server/Ingress")
local Receipt=require("../src/server/Receipt")
local Traverse=require("../src/shared/Traverse")
local Progress=require("../src/server/Progress")
local Terrain=require("../src/shared/Terrain")
local Recovery=require("../src/server/Recovery")
local count=0
local function check(condition,message) assert(condition,message);count+=1 end
check(Traverse.walkSpeed(false,false)==22,"Climber walk 5.5 x4")
check(Traverse.walkSpeed(true,false)==34.4,"Climber run 8.6 x4")
check(math.abs(Traverse.walkSpeed(true,true)-12.04)<1e-8,"charge movement 35 percent")
check(Traverse.RunJumpBonus==0.18,"running launch bonus")
local ax,ay,az=Traverse.air(0,-999,0,1,0,0.1,false)
check(math.abs(ax-10.32)<1e-8 and ay==-160 and az==0,"walk-off steering and terminal fall")
ax,ay,az=Traverse.air(8,-999,2,1,0,0.1,true)
check(ax==8 and az==2 and ay==-160,"charged direction remains locked")
check(Traverse.grab(100,7.8)==88 and Traverse.grab(11,4)==nil,"ledge cost and insufficient stamina")
check(Traverse.grab(100,1.9)==nil and Traverse.grab(100,7.9)==nil,"original ledge height window")
check(Traverse.drain(100,2)==78 and Traverse.drain(5,1)==0,"hang drain11 per second")
local runs={};local progressFail=false
local progress=Progress.new(function(id,transform)
    if progressFail then error("offline") end
    local updated=transform(runs[id]);if updated~=nil then runs[id]=updated end;return updated
end,20261028,"basic-join")
check(progress:load(42).alt==0,"fresh progress starts at ground")
check(progress:save(42,{alt=200,best=500,falls=1})~=nil,"current descent altitude saves independently from best")
check(progress:load(42).alt==200 and progress:load(42).best==500,"continuation cannot restore historical best altitude")
check(progress:save(42,{alt=50,best=500,falls=2}).alt==50,"further falling overwrites current progress downward")
check(progress:save(42,{alt=0/0,best=500,falls=2})==nil,"invalid progress rejected")
progressFail=true
check(progress:load(42)==nil and progress:save(42,{alt=0,best=500,falls=2})==nil,"storage failure never defaults or overwrites run")
progressFail=false
check(runs["42"].alt==50,"failed writes preserve prior progress")
check(Course.resume(200).y<=200,"free continuation never exceeds saved current altitude")
local moving={a={0,4,0},b={20,4,0},period=4,phase=0}
check(Terrain.mover(moving,0)==0 and Terrain.mover(moving,2)==20,"mover cosine end points")
check(math.abs(Terrain.mover(moving,1)-10)<1e-8,"mover midpoint")
local crumble=Terrain.stand(nil,0.54)
check(crumble.stage==0,"crumble stand before trigger")
crumble=Terrain.stand(crumble,0.02)
check(crumble.stage==1 and crumble.t==0.6,"crumble shake after .55")
crumble=Terrain.tick(crumble,0.6)
check(crumble.stage==2 and crumble.t==8,"crumble gone after .6 shake")
check(Terrain.tick(crumble,8)==nil,"crumble regenerates after8 seconds")
local recoveryCharacter={}
local recovering={character=recoveryCharacter,busy=true,locked=true}
Recovery.finish(recovering,recoveryCharacter,nil,"placement failed")
check(not recovering.busy and recovering.locked and recovering.error=="placement failed","actual recovery adapter nil failure releases busy and stays safely locked for retry")
recovering.busy=true
Recovery.finish(recovering,recoveryCharacter,{balance=1},nil)
check(not recovering.busy and not recovering.locked,"actual recovery adapter can retry after failed delivery")
local cross={};local savedTransform=nil;local hook=nil
local function progressUpdate(id,transform)
    if hook then local fn=hook;hook=nil;fn(transform) end
    local updated=transform(cross[id]);if updated~=nil then cross[id]=updated end;return updated
end
local oldRun=Progress.new(progressUpdate,20261028,"old-server")
local newRun=Progress.new(progressUpdate,20261028,"new-server")
check(oldRun:load(9)~=nil,"first progress session claims epoch")
oldRun:save(9,{alt=500,best=500,falls=0})
hook=function(transform)
    savedTransform=transform
    check(newRun:load(9)~=nil,"new session atomically replaces owner")
    check(newRun:save(9,{alt=50,best=500,falls=1})~=nil,"new session commits lower current altitude")
end
check(oldRun:save(9,{alt=450,best=500,falls=0})==nil,"old server high exit save rejected after new low save")
check(cross["9"].alt==50 and savedTransform(cross["9"])==nil,"old callback retry fenced by atomic owner and epoch")
check(oldRun:load(9)==nil,"old session cannot reclaim ownership during read retry")
local staleSample=nil
hook=function(transform)
    staleSample=transform
    check(newRun:save(9,{alt=20,best=500,falls=2})~=nil,"later sample commits while earlier sample yields")
end
check(newRun:save(9,{alt=40,best=500,falls=1})==nil,"out-of-order earlier sample cannot overwrite later lower sample")
check(cross["9"].alt==20 and staleSample(cross["9"])==nil,"sample sequence also fences callback retries in one session")
-- A -> B -> A uses a fresh join handle even when server A itself stays alive.
local aFirst=Progress.new(progressUpdate,20261028,"server-A/join-1")
check(aFirst:load(77)~=nil,"A first join loads")
aFirst:save(77,{alt=400,best=400,falls=0})
aFirst:close()
local bJoin=Progress.new(progressUpdate,20261028,"server-B/join-1")
check(bJoin:load(77)~=nil and bJoin:save(77,{alt=120,best=400,falls=1})~=nil,"B join claims and saves lower altitude")
bJoin:close()
local aReturn=Progress.new(progressUpdate,20261028,"server-A/join-2")
local returned=aReturn:load(77)
check(returned~=nil and returned.alt==120 and returned.sessionEpoch==3,"A return joins with fresh handle and epoch after B")
check(aFirst:load(77)==nil and bJoin:load(77)==nil,"closed old handles cannot reload and reclaim ownership")
check(aFirst:save(77,{alt=400,best=400,falls=0})==nil,"closed old join cannot write its historical altitude")
local aReturnEpoch=returned.sessionEpoch
local sameServerJoin=nil;local beforeRejoin=nil
hook=function(transform)
    beforeRejoin=transform
    -- Same still-running server creates another handle before an old exit write returns.
    sameServerJoin=Progress.new(progressUpdate,20261028,"server-A/join-3")
    local resumed=sameServerJoin:load(77)
    check(resumed and resumed.sessionEpoch>aReturnEpoch,"same server rejoin gets distinct epoch")
    check(sameServerJoin:save(77,{alt=30,best=400,falls=2})~=nil,"same server new join commits lower current position")
end
check(aReturn:save(77,{alt=110,best=400,falls=1})==nil,"old same-server handle late write fenced after rejoin")
check(cross["77"].alt==30 and beforeRejoin(cross["77"])==nil,"old handle callback retry cannot overwrite rejoin progress")
aReturn:close()
check(aReturn:load(77)==nil and cross["77"].owner=="server-A/join-3","closed previous handle cannot acquire new epoch")
local closingLoad=Progress.new(progressUpdate,20261028,"closing-during-load")
hook=function() closingLoad:close() end
check(closingLoad:load(88)==nil and cross["88"]==nil,"closing an in-flight initial load prevents its claim")
local function overlaps(a,b)
    return a.x<b.x+b.w and b.x<a.x+a.w and a.y<b.y+b.h and b.y<a.y+a.h
end
for _,size in {{320,320},{667,375},{812,320},{390,844}} do
    for _,modal in {false,true} do
        local layout=HudLayout.compute(size[1],size[2],modal)
        local failureText=HudLayout.status({error="Storage temporarily unavailable"},layout.compact)
        check(string.find(failureText,"저장 오류",1,true)~=nil and string.find(failureText,"temporarily unavailable",1,true)~=nil,"storage error remains in visible status, including compact/modal")
        local visible=modal and {layout.status,layout.panel} or {layout.status,layout.meter,layout.jump,layout.grab,layout.run,layout.restart}
        if not modal and not layout.compact then table.insert(visible,layout.help) end
        for i,a in visible do
            check(a.x>=0 and a.y>=0 and a.x+a.w<=size[1] and a.y+a.h<=size[2],"safe-area bounds")
            for j=i+1,#visible do check(not overlaps(a,visible[j]),"visible HUD rectangles do not overlap") end
        end
        for _,action in modal and {layout.use,layout.dismiss,layout.buy} or {layout.jump,layout.grab,layout.run,layout.restart} do
            check(action.w>=44 and action.h>=44,"minimum touch target")
        end
        if modal then
            check(not overlaps(layout.use,layout.dismiss) and not overlaps(layout.buy,layout.use) and not overlaps(layout.buy,layout.dismiss),"modal actions do not overlap")
        end
    end
end
local touchState={};local jumpTouch={};local stickTouch={}
check(ChargeInput.begin(touchState,jumpTouch),"jump touch begins charge")
check(not ChargeInput.finish(touchState,stickTouch) and touchState.owner==jumpTouch,"movement thumb release cannot launch jump")
check(not ChargeInput.begin(touchState,stickTouch),"second finger cannot steal charge")
check(ChargeInput.finish(touchState,jumpTouch),"initiating touch releases jump")
check(not ChargeInput.finish(touchState,jumpTouch),"touch end cannot release twice")
check(ChargeInput.begin(touchState,"bound") and ChargeInput.finish(touchState,"bound"),"keyboard/gamepad action release")
check(ChargeInput.begin(touchState,jumpTouch) and ChargeInput.cancel(touchState) and touchState.owner==nil,"focus/lifecycle/auto-launch cancellation")
local runningTouch={};local runFinger={}
check(ChargeInput.begin(runningTouch,runFinger),"touch run owns its initiating finger")
check(not ChargeInput.finish(runningTouch,stickTouch),"stick finger release cannot cancel touch running")
check(ChargeInput.finish(runningTouch,runFinger),"run finger release ends running")
local forcedCharge={}
check(ChargeInput.begin(forcedCharge,jumpTouch),"auto-release owns charge")
check(ChargeInput.cancel(forcedCharge) and forcedCharge.owner==nil,"1.2-second forced release clears local owner")
check(not ChargeInput.finish(forcedCharge,jumpTouch),"later touch ending cannot repeat forced release")
for i=1,5 do
    check(Jump.level((i-1)*.12)==i,"charge boundary")
    local vy,vx=Jump.speeds(i)
    check(vy==30+(i-1)*8.5 and vx==6+(i-1)*8.5,"source constants")
end
check(Jump.level(99)==5 and Jump.level(-1)==1,"clamped hold")
check(Jump.release(nil,1,true,1,0)==nil,"missing charge")
check(Jump.release(2,1,true,1,0)==nil,"negative duration")
check(Jump.release(0,1,false,1,0)==nil,"airborne release rejected")
check(Jump.release(0,1,true,0/0,1)==nil,"NaN direction rejected")
check(Jump.release(0,1,true,10,0)==nil,"unbounded direction rejected")
check(Jump.release(0,99,true,1,0).level==5,"server caps charge")
-- Native Roblox route: semantic coverage, deterministic IDs, and actual Leap landing margins.
local Generator=require("../src/shared/Generator")
check(#Course.path>30 and #Course.regions==7,"native route covers seven meaningful altitude regions")
local seen={};local maxY=0;local minX,maxX,minZ,maxZ=0,0,0,0
for _,p in Course.platforms do
    seen[p.kind]=true;maxY=math.max(maxY,p.y)
    minX=math.min(minX,p.x);maxX=math.max(maxX,p.x);minZ=math.min(minZ,p.z);maxZ=math.max(maxZ,p.z)
end
check(maxY==Course.summit and maxX-minX>200 and maxZ-minZ>200,"route traverses a broad urban space to its summit")
for _,kind in {"Solid","Ice","Crumble","Mover","Wall"} do check(seen[kind],"native route uses device "..kind) end
local function chord(p,x,z)
    return math.min(math.abs(x)>1e-4 and p.sx/2/math.abs(x) or math.huge,math.abs(z)>1e-4 and p.sz/2/math.abs(z) or math.huge)
end
local function verifyNative(route)
    local ids={};for _,p in route.platforms do check(not ids[p.id],"stable ID uniqueness");ids[p.id]=p end
    for index,link in route.links do
        local a,b=ids[link.source],ids[link.target]
        check(a~=nil and b~=nil and route.path[index]==a.id and route.path[index+1]==b.id,"native route connects stable IDs in order")
        local gap=math.sqrt((b.x-a.x)^2+(b.z-a.z)^2)-chord(a,link.dir[1],link.dir[3])-chord(b,link.dir[1],link.dir[3])
        check(math.abs(gap-link.gap)<.00001,"native geometry agrees with tested jump gap")
        if b.kind=="Wall" then
            check(b.depth>b.y-a.y and gap<=9.00001 and b.y-a.y>20,"wall route requires attachment then climb, with base below departure")
        else
            -- Test mover vertical endpoint extremes, including the outgoing lowest takeoff.
            for _,offset in {0,(a.kind=="Mover" and 1 or 0),(b.kind=="Mover" and -1 or 0)} do
                local back,air=Jump.solve(link.level,b.y-a.y+offset,gap,chord(b,link.dir[1],link.dir[3])*2,chord(a,link.dir[1],link.dir[3])*2-2.4,link.gravityScale,0)
                check(back~=nil and air>0,"native solid front/body/landing margins "..b.id)
            end
            if a.kind=="Crumble" then check(link.level<=3,"crumble departure fits short charge") end
        end
    end
end
verifyNative(Course)
for _,seed in {20261028,41,98765} do
    for _,difficulty in {"Normal","Hard"} do
        local route=Generator.build(seed,difficulty,Jump.solve)
        verifyNative(route)
        local repeated=Generator.build(seed,difficulty,Jump.solve)
        for index,p in route.platforms do
            local q=repeated.platforms[index]
            check(p.id==q.id and p.x==q.x and p.y==q.y and p.z==q.z and p.kind==q.kind,"same seed/difficulty reproduces geometry and IDs")
        end
    end
end
-- Lifecycle fixtures remain separate from the production course IDs.
local fixture={Vent={id="Vent",y=24,region=2},Awning={id="Awning",y=12,region=1},Roof={id="Roof",y=36,region=3}}
local function testPlatform(id) return fixture[id] end
local f=Fall.new();Fall.character(f,false)
Fall.sample(f,-20,true);check(f.offer==nil,"no ground revival")
Fall.land(f,testPlatform("Vent"));Fall.sample(f,23,true);Fall.sample(f,12,true)
check(f.offer.platformId=="Vent","last safe platform offered")
local oldToken,oldEpoch=f.offer.token,f.epoch
Fall.land(f,testPlatform("Awning"));Fall.sample(f,0,true)
check(f.offer.platformId=="Vent","lower landing preserves snapshot")
Fall.death(f);Fall.character(f,true)
check(f.offer.platformId=="Vent" and not Fall.valid(f,oldToken,oldEpoch),"death fresh character offer")
Fall.clear(f);check(f.snapshot==nil and f.offer==nil,"free dismissal")
Fall.sample(f,-20,true);Fall.death(f);Fall.character(f,true)
check(f.offer==nil,"dismissed descent never recreates offer, even on death")
Fall.land(f,testPlatform("Vent"));Fall.sample(f,0,true);Fall.land(f,testPlatform("Roof"))
check(f.offer==nil,"new progress invalidates old offer")
Fall.sample(f,10,true);Fall.character(f,false);check(f.offer==nil and f.snapshot==nil,"ordinary replacement clears offer")
local records={};local fail=false;local before=nil;local after=nil;local time=0
local function clone(v)
    if type(v)~="table" then return v end
    local result={};for k,x in v do result[k]=clone(x) end;return result
end
local function update(key,transform)
    if fail then error("injected storage failure") end
    if before then local fn=before;before=nil;fn() end
    -- Simulate UpdateAsync callback retry; both calls see the same committed input.
    transform(clone(records[key]))
    records[key]=transform(clone(records[key]));local result=clone(records[key])
    if after then local fn=after;after=nil;fn() end
    return result
end
local function valid(target) return Course.resolve(target)~=nil end
local ledger=Ledger.new(update,valid,function() return time end,"A")
local target={courseVersion=1,platformId="Vent"}
check(ledger:load(1).balance==0,"fresh inventory")
check(not Receipt.process({ProductId=9,PlayerId=1,PurchaseId="r"},0,function() return true end,ledger),"ID zero disabled")
check(not Receipt.process({ProductId=8,PlayerId=1,PurchaseId="r"},9,function() return true end,ledger),"unknown product")
check(not Receipt.process({ProductId=9,PlayerId=1,PurchaseId="r"},9,function() return false end,ledger),"offline deferred")
fail=true
check(not Receipt.process({ProductId=9,PlayerId=1,PurchaseId="r"},9,function() return true end,ledger),"failed receipt deferred")
check(ledger:load(1)==nil,"failed load not default")
fail=false
for _=1,2 do check(Receipt.process({ProductId=9,PlayerId=1,PurchaseId="r"},9,function() return true end,ledger),"receipt retry ack") end
check(records['1'].balance==1,"atomic receipt once despite callback retries")
check(f.offer==nil,"receipt grants without offer or teleport")
fail=true;check(ledger:reserve(1,"op",target)==nil,"failed reserve");fail=false
check(records['1'].balance==1 and records['1'].pending==nil,"failed debit unchanged")
check(ledger:reserve(1,"bad",{courseVersion=999,platformId="Vent"})==nil,"course version validation")
local reserved=ledger:reserve(1,"op",target)
check(reserved.balance==0 and reserved.pending.target.platformId=="Vent","atomic debit and pending target")
ledger:grant(1,"second")
local session2=Ledger.new(update,valid,function() return time end,"B")
check(session2:reserve(1,"competing",target)==nil and records['1'].balance==1,"cross-session pending exclusion")
check(ledger:reserve(1,"op",target).balance==1,"same-operation retry no debit")
local character={};local current=character;local frozen=false;local placed=0
local function freeze(c,value) check(c==current,"never freeze stale character");frozen=value end
local function place(c,t) check(c==current and t.platformId=="Vent","authored target only");placed+=1;return true end
current={}
check(Delivery.run(ledger,1,reserved,character,function() return current end,freeze,place)==nil and placed==0,"stale character excluded")
character=current
check(Delivery.run(ledger,1,reserved,character,function() return current end,freeze,function() return false end)==nil and frozen,"failed placement frozen and retained")
after=function() fail=true end
local beforeFailedAck=placed
check(Delivery.run(ledger,1,reserved,character,function() return current end,freeze,place)==nil,"ack failure")
check(frozen and records['1'].pending.id=="op" and placed==beforeFailedAck+1,"ack failure after placement retains obligation and freezes")
fail=false
-- Recovery after debit crash and after teleport crash uses the stored pending operation.
time=31
after=function() before=function() ledger:grant(1,"interleaved") end end
local recovered=Delivery.run(session2,1,records['1'],character,function() return current end,freeze,place)
check(recovered and recovered.pending==nil and not frozen,"recovery acknowledges before unlocking")
check(records['1'].balance==2 and records['1'].receipts.interleaved,"ack preserves interleaved receipt")
check(ledger:reserve(1,"op",target)==nil and records['1'].balance==2,"used operation cannot debit twice")
check(ledger:ack(1,"unknown").balance==2,"ack replay harmless")
local p=ledger:reserve(1,"next",target)
ledger:ack(1,"wrong");check(records['1'].pending.id=="next","wrong ack cannot erase obligation")
-- Replacement during yielding reservation leaves durable work for the next character.
local s=Fall.new();Fall.character(s,false);Fall.land(s,testPlatform("Vent"));Fall.sample(s,0,true)
local epoch=s.epoch;before=function() Fall.character(s,false) end
ledger:ack(1,"next")
local nextRecord=ledger:reserve(1,"lifecycle",target)
check(s.epoch~=epoch and nextRecord.pending.id=="lifecycle","replacement does not erase durable reservation")
local ackCharacter=current
after=function() before=function() current={} end end
local unacked=Delivery.run(ledger,1,nextRecord,ackCharacter,function() return current end,freeze,place)
check(unacked==nil and records['1'].pending.id=="lifecycle","replacement during ack retains durable delivery")
-- Cached second runner may never replay a completed delivery.
local pendingRecord=records['1']
time=62
local completed=Delivery.run(session2,1,pendingRecord,current,function() return current end,freeze,place)
check(completed and records['1'].pending==nil,"lease expiry recovers after server loss")
local priorPlaced=placed
check(Delivery.run(ledger,1,pendingRecord,current,function() return current end,freeze,place)==nil and placed==priorPlaced,"stale two-runner replay fenced")
ledger:grant(1,"handoffTicket")
local handoffRecord=ledger:reserve(1,"handoff",target)
local firstCharacter=current
-- Claim commits first; arm a callback which replaces the character after ACK commits.
after=function() after=function() current={} end end
local handoffDone=Delivery.run(ledger,1,handoffRecord,firstCharacter,function() return current end,freeze,place)
check(handoffDone and not frozen and current~=firstCharacter and records['1'].pending==nil,"post-commit pre-return character handoff")
ledger:grant(1,"leaseRaceTicket")
local leaseRace=ledger:reserve(1,"leaseRace",target)
local beforeRace=placed
after=function()
    time+=31
    local other=Delivery.run(session2,1,records['1'],current,function() return current end,freeze,place)
    check(other~=nil,"competing owner completes after expired claim")
end
check(Delivery.run(ledger,1,leaseRace,current,function() return current end,freeze,place)==nil and placed==beforeRace+1,"expired yielding claim cannot replay placement")
local allowed=0;local bucket={}
for _=1,100 do if Ingress.allow(bucket,1) then allowed+=1 end end
check(allowed==20,"all-action ingress burst is bounded")
check(not Ingress.allow(bucket,1),"sync/release flood exhausted")
check(Ingress.allow(bucket,1.12),"legitimate charge cadence replenishes")
records['corrupt']={balance=0}
check(ledger:load("corrupt")==nil,"invalid record never replaced with defaults")
print("PASS "..count.." actual Luau assertions (movement, route, falls, receipts, atomic ledger, recovery)")
