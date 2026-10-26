local HudLayout=require("../src/shared/HudLayout")
local ChargeInput=require("../src/shared/ChargeInput")
local Jump=require("../src/shared/Jump")
local Course=require("../src/shared/Course")
local Fall=require("../src/shared/Fall")
local Ledger=require("../src/server/Ledger")
local Delivery=require("../src/server/Delivery")
local Ingress=require("../src/server/Ingress")
local Receipt=require("../src/server/Receipt")
local count=0
local function check(condition,message) assert(condition,message);count+=1 end
local function overlaps(a,b)
    return a.x<b.x+b.w and b.x<a.x+a.w and a.y<b.y+b.h and b.y<a.y+a.h
end
for _,size in {{320,320},{667,375},{812,320},{390,844}} do
    for _,modal in {false,true} do
        local layout=HudLayout.compute(size[1],size[2],modal)
        local failureText=HudLayout.status({error="Storage temporarily unavailable"},layout.compact)
        check(string.find(failureText,"STORAGE ERROR",1,true)~=nil and string.find(failureText,"temporarily unavailable",1,true)~=nil,"storage error remains in visible status, including compact/modal")
        local visible=modal and {layout.status,layout.panel} or {layout.status,layout.meter,layout.jump,layout.restart}
        if not modal and not layout.compact then table.insert(visible,layout.help) end
        for i,a in visible do
            check(a.x>=0 and a.y>=0 and a.x+a.w<=size[1] and a.y+a.h<=size[2],"safe-area bounds")
            for j=i+1,#visible do check(not overlaps(a,visible[j]),"visible HUD rectangles do not overlap") end
        end
        for _,action in modal and {layout.use,layout.dismiss,layout.buy} or {layout.jump,layout.restart} do
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
-- Solve actual descending landing AND front-edge body clearance from an authored takeoff.
for index=2,#Course.platforms do
    local a,b=Course.platforms[index-1],Course.platforms[index]
    local found=false
    for level=1,5 do
        local distance=Jump.landing(level,b.y-a.y)
        if distance then
            for n=0,100 do
                local launch=a.x-a.sx/2+2+(a.sx-4)*n/100
                local landing=launch+distance
                local vy,vx=Jump.speeds(level)
                local t=(b.x-b.sx/2-1.8-launch)/vx
                local h=vy*t-.5*Jump.Gravity*t*t
                if t>0 and h>=b.y-a.y+.5 and landing>b.x-b.sx/2+2 and landing<b.x+b.sx/2-2 then found=true end
            end
        end
    end
    check(found,"route unreachable: "..b.id)
end
local f=Fall.new();Fall.character(f,false)
Fall.sample(f,-20,true);check(f.offer==nil,"no ground revival")
Fall.land(f,Course.platform("Vent"));Fall.sample(f,23,true);Fall.sample(f,12,true)
check(f.offer.platformId=="Vent","last safe platform offered")
local oldToken,oldEpoch=f.offer.token,f.epoch
Fall.land(f,Course.platform("Awning"));Fall.sample(f,0,true)
check(f.offer.platformId=="Vent","lower landing preserves snapshot")
Fall.death(f);Fall.character(f,true)
check(f.offer.platformId=="Vent" and not Fall.valid(f,oldToken,oldEpoch),"death fresh character offer")
Fall.clear(f);check(f.snapshot==nil and f.offer==nil,"free dismissal")
Fall.sample(f,-20,true);Fall.death(f);Fall.character(f,true)
check(f.offer==nil,"dismissed descent never recreates offer, even on death")
Fall.land(f,Course.platform("Vent"));Fall.sample(f,0,true);Fall.land(f,Course.platform("Roof"))
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
local function valid(target) return target.courseVersion==Course.version and Course.platform(target.platformId)~=nil end
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
check(ledger:reserve(1,"bad",{courseVersion=2,platformId="Vent"})==nil,"course version validation")
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
local s=Fall.new();Fall.character(s,false);Fall.land(s,Course.platform("Vent"));Fall.sample(s,0,true)
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
