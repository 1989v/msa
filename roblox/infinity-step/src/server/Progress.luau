-- Current descent altitude, separate from ticket inventory. Atomic owner/epoch/sample fences
-- reject old-server exit saves and out-of-order UpdateAsync retries after a newer lower save.
local Progress={}
local function finite(v) return type(v)=="number" and v==v and math.abs(v)<math.huge end
local function valid(v,seed)
    return type(v)=="table" and v.version==1 and v.seed==seed and finite(v.alt) and v.alt>=0 and
        finite(v.best) and v.best>=v.alt and finite(v.falls) and v.falls>=0 and
        finite(v.elapsed or 0) and finite(v.summitSec or 0)
end
function Progress.new(update,seed,owner)
    assert(type(owner)=="string" and #owner>0,"Each player join requires a distinct progress owner")
    return setmetatable({update=update,seed=seed,owner=owner,claims={},sequences={},closed=false},{__index=Progress})
end
function Progress:close()
    self.closed=true;self.claims={};self.sequences={}
end
function Progress:load(userId)
    if self.closed then return nil,"종료된 진행 세션" end
    local key=tostring(userId)
    local claim=self.claims[key]
    local ok,result=pcall(self.update,key,function(old)
        if self.closed then return nil end
        if old==nil then old={version=1,seed=self.seed,alt=0,best=0,falls=0,elapsed=0,summitSec=0} end
        if not valid(old,self.seed) then return old end
        if claim then return old end
        local nextRecord=table.clone(old)
        nextRecord.owner=self.owner;nextRecord.sessionEpoch=(old.sessionEpoch or 0)+1;nextRecord.sampleSequence=0
        return nextRecord
    end)
    if self.closed then return nil,"종료된 진행 세션" end
    if not ok then return nil,"진행 저장소 연결 실패" end
    if not valid(result,self.seed) then return nil,"진행 저장 형식 또는 맵 시드 불일치" end
    if result.owner~=self.owner or claim and result.sessionEpoch~=claim then return nil,"다른 세션에서 이어하는 중입니다" end
    self.claims[key]=result.sessionEpoch;self.sequences[key]=math.max(self.sequences[key] or 0,result.sampleSequence or 0)
    return result
end
function Progress:save(userId,sample)
    if self.closed then return nil,"종료된 진행 세션" end
    if not finite(sample.alt) or not finite(sample.best) or not finite(sample.falls) or sample.alt<0 or sample.best<sample.alt then return nil,"잘못된 진행 값" end
    local key=tostring(userId);local epoch=self.claims[key]
    if not epoch then return nil,"진행 세션을 먼저 불러와야 합니다" end
    local sequence=(self.sequences[key] or 0)+1;self.sequences[key]=sequence
    local ok,result=pcall(self.update,key,function(old)
        if self.closed or not valid(old,self.seed) or old.owner~=self.owner or old.sessionEpoch~=epoch then return nil end
        if (old.sampleSequence or 0)>sequence then return nil end
        if old.sampleSequence==sequence then return old end
        return {version=1,seed=self.seed,owner=self.owner,sessionEpoch=epoch,sampleSequence=sequence,
            alt=sample.alt,best=math.max(old.best,sample.best),falls=math.max(old.falls,sample.falls),
            elapsed=sample.elapsed or old.elapsed or 0,summitSec=(old.summitSec or 0)>0 and old.summitSec or sample.summitSec or 0}
    end)
    if not ok or not result then return nil,"진행 저장 실패 또는 오래된 세션 · 기존 기록 유지" end
    return result
end
return Progress
