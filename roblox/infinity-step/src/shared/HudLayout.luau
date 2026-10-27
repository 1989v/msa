-- Coordinates use the ScreenGui device-safe content rectangle, in pixels.
local HudLayout={}
function HudLayout.compute(width,height,modal)
    local compact=height<520
    local function rect(x,y,w,h) return {x=x,y=y,w=w,h=h} end
    local result={
        compact=compact,modal=modal,
        status=rect(8,8,width-16,compact and 40 or 72),
        meter=rect(8,compact and 56 or 88,math.min(240,width-96),compact and 28 or 40),
        help=rect(8,132,width-16,36),
        jump=rect(width-112,height-(compact and 216 or 240),96,compact and 56 or 72),
        grab=rect(width-184,height-(compact and 216 or 240),64,compact and 56 or 72),
        run=rect(width-72,compact and 56 or 88,64,44),
        restart=rect(width-144,height-(compact and 148 or 304),128,48),
        panel=rect(16,math.max(compact and 56 or 176,math.floor((height-180)/2)),width-32,180),
    }
    local p=result.panel
    result.use=rect(p.x+8,p.y+72,p.w/2-12,48)
    result.dismiss=rect(p.x+p.w/2+4,p.y+72,p.w/2-12,48)
    result.buy=rect(p.x+8,p.y+128,p.w-16,48)
    return result
end
function HudLayout.status(data,compact)
    if data.error then
        return "저장 오류 · 재시도 중\n"..string.sub(tostring(data.error),1,compact and 32 or 90)
    end
    if compact then
        return string.format("%s · 고도 %.0f / 최고 %.0f\n%s 부활권: %d%s",data.region,data.current/4,data.best/4,data.test and "테스트" or "보유",data.balance,data.finished and " · 정상 도달!" or string.format(" · 낙하 %d회",data.falls or 0)..(data.locked and " · 복구 중" or ""))
    end
    return string.format("인피니티 스탭 / %s\n고도 %.0f · 최고 %.0f · %s 부활권: %d%s",data.region,data.current/4,data.best/4,data.test and "테스트" or "보유",data.balance,data.finished and " · 정상 도달!" or string.format(" · 낙하 %d회",data.falls or 0)..(data.locked and " · 안전 복구 중" or ""))
end
return HudLayout
