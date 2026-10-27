-- Shared by the actual Roblox recovery adapter and executable failure-boundary tests.
local Recovery={}
function Recovery.finish(session,character,record,err)
    if record and session.character==character then
        session.locked=false;session.error=nil
    else
        session.locked=true;session.error=err or "안전 전달을 재시도합니다"
    end
    session.busy=false
end
return Recovery
