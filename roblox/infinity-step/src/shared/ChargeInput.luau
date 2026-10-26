-- Identity-based ownership prevents the movement thumb from releasing held jump.
local ChargeInput={}
function ChargeInput.begin(s,input)
    if s.owner~=nil or input==nil then return false end
    s.owner=input
    return true
end
function ChargeInput.finish(s,input)
    if s.owner==nil or s.owner~=input then return false end
    s.owner=nil
    return true
end
function ChargeInput.cancel(s)
    local active=s.owner~=nil
    s.owner=nil
    return active
end
return ChargeInput
