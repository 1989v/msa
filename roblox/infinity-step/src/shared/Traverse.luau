-- Climber.Tuning + KgdTraverse, source units converted at the boundary (x4).
-- Roblox collision/ledge adapter remains subject to Studio runtime verification.
local Traverse={Walk=22,Run=34.4,ChargeScale=0.35,RunJumpBonus=0.18,
    TerminalFall=160,StaminaMax=100,HangDrain=11,LedgeCost=12,
    ClimbSpeed=12.8,LedgeReach=2,LedgeMinRise=2,LedgeMaxRise=7.8,PullTime=0.34,
    Regain=24,RegainDelay=0.5}
function Traverse.walkSpeed(running,charging)
    return (running and Traverse.Run or Traverse.Walk)*(charging and Traverse.ChargeScale or 1)
end
function Traverse.air(x,y,z,dx,dz,dt,charged)
    if not charged then
        local t=math.min(1,3*dt)
        x+=(dx*Traverse.Run-x)*t;z+=(dz*Traverse.Run-z)*t
    end
    return x,math.max(-Traverse.TerminalFall,y),z
end
function Traverse.grab(stamina,rise)
    if rise<Traverse.LedgeMinRise or rise>Traverse.LedgeMaxRise or stamina<Traverse.LedgeCost then return nil end
    return stamina-Traverse.LedgeCost
end
function Traverse.drain(stamina,dt) return math.max(0,stamina-Traverse.HangDrain*dt) end
return Traverse
