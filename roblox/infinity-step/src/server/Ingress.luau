local Ingress={}
function Ingress.allow(s,now)
    local elapsed=math.max(0,now-(s.ingressAt or now))
    s.ingressAt=now
    s.tokens=math.min(20,(s.tokens or 20)+elapsed*15)
    if s.tokens<1 then return false end
    s.tokens-=1
    return true
end
return Ingress
