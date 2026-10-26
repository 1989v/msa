-- Placement/freeze boundaries are synchronous. Only atomic storage calls may yield.
local Delivery = {}
function Delivery.run(ledger, key, record, character, current, freeze, place)
    local pending=record.pending
    if not pending then return record end
    if current()~=character then return nil,"Character replaced; delivery retained" end
    -- Never trust a cached pending record: acquire ownership of the live operation.
    local owned,claimError=ledger:claim(key,pending.id)
    if not owned then return nil,claimError end
    pending=owned.pending
    if current()~=character then return nil,"Character replaced during claim; delivery retained" end
    freeze(character,true)
    local ok, delivered=pcall(place,character,pending.target)
    if not ok or not delivered then return nil,"Placement failed; delivery retained" end
    if current()~=character then return nil,"Character replaced; delivery retained" end
    local ack,err=ledger:ack(key,pending.id,function() return current()==character end)
    if not ack then return nil,err end
    if ack.pending then return nil,"Delivery pending" end
    if current()~=character then
        -- UpdateAsync may commit and then yield before returning. Hand the completed
        -- delivery to the replacement before unlocking; never teleport the stale body.
        local replacement=current()
        if not replacement then return nil,"Waiting for replacement character",pending end
        freeze(replacement,true)
        local placed,safe=pcall(place,replacement,pending.target)
        if not placed or not safe or current()~=replacement then
            return nil,"Replacement placement pending",pending
        end
        freeze(replacement,false)
    else freeze(character,false) end
    return ack
end
return Delivery
