-- update(key, transform) must be atomic (DataStore UpdateAsync in live adapter).
-- Never cache and save an entire record. Transforms may be retried by Roblox.
local Ledger = {}
Ledger.__index = Ledger
local function fresh(old)
    if old == nil then return {version=1,balance=0,receipts={},uses={}} end
    assert(type(old)=="table" and old.version==1 and type(old.balance)=="number"
        and old.balance>=0 and old.balance%1==0 and type(old.receipts)=="table"
        and type(old.uses)=="table", "Invalid stored record; refusing defaults")
    local copy = table.clone(old)
    copy.receipts, copy.uses = table.clone(old.receipts), table.clone(old.uses)
    if old.pending then copy.pending=table.clone(old.pending) end
    return copy
end
function Ledger.new(update, validTarget, clock, owner)
    return setmetatable({update=update, validTarget=validTarget, clock=clock or os.time, owner=owner or "local"}, Ledger)
end
function Ledger:mutate(key, transform)
    local ok, value = pcall(self.update, tostring(key), function(old)
        return transform(fresh(old))
    end)
    if not ok then return nil, tostring(value) end
    return value
end
function Ledger:load(key)
    return self:mutate(key, function(r) return r end)
end
function Ledger:grant(key, purchaseId)
    if type(purchaseId)~="string" or #purchaseId==0 then return nil,"Invalid receipt" end
    return self:mutate(key, function(r)
        if not r.receipts[purchaseId] then
            r.receipts[purchaseId]=true
            r.balance+=1
        end
        return r
    end)
end
function Ledger:reserve(key, operation, target)
    if type(operation)~="string" or #operation==0 or type(target)~="table" or not self.validTarget(target) then
        return nil,"Invalid operation or authored platform"
    end
    local r, err = self:mutate(key,function(record)
        if record.pending or record.uses[operation] or record.balance<=0 then return record end
        record.balance-=1
        record.uses[operation]=true
        record.pending={id=operation,target=table.clone(target),owner=self.owner,leaseUntil=self.clock()+30}
        return record
    end)
    if not r then return nil,err end
    if not r.pending or r.pending.id~=operation then return nil,"Another delivery pending, used operation, or no tickets" end
    return r
end
function Ledger:claim(key, operation)
    local r,err=self:mutate(key,function(record)
        local p=record.pending
        if p and p.id==operation and (p.owner==self.owner or (p.leaseUntil or 0)<self.clock()) then
            p.owner=self.owner;p.leaseUntil=self.clock()+30
        end
        return record
    end)
    if not r then return nil,err end
    local p=r.pending
    if not p or p.id~=operation or p.owner~=self.owner or p.leaseUntil<=self.clock() then
        return nil,"Delivery owned by another session, expired or completed"
    end
    return r
end
function Ledger:ack(key, operation, stillCurrent)
    return self:mutate(key,function(r)
        if r.pending and r.pending.id==operation and r.pending.owner==self.owner and r.pending.leaseUntil>self.clock() and (not stillCurrent or stillCurrent()) then r.pending=nil end
        return r
    end)
end
return Ledger
