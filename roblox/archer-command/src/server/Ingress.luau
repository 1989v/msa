-- 명령 빈도 제한: 토큰 버킷 버스트 20 · 초당 15 보충. 초과는 버린다.
local Ingress = {}
function Ingress.allow(session, now)
	local elapsed = math.max(0, now - (session.ingressAt or now))
	session.ingressAt = now
	session.tokens = math.min(20, (session.tokens or 20) + elapsed * 15)
	if session.tokens < 1 then return false end
	session.tokens -= 1
	return true
end
return Ingress
