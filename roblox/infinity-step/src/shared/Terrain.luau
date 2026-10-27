-- Original KgdMover.At / Tower.StandOn / Tower.Tick scalar rules.
local Terrain={}
function Terrain.mover(m,time)
    local t=0.5-0.5*math.cos((time/math.max(0.1,m.period)+m.phase)*math.pi*2)
    return m.a[1]+(m.b[1]-m.a[1])*t,m.a[2]+(m.b[2]-m.a[2])*t,m.a[3]+(m.b[3]-m.a[3])*t
end
function Terrain.stand(c,dt)
    c=c or {stage=0,t=0}
    if c.stage==0 then c.t+=dt;c.stood=true;if c.t>=0.55 then c.stage=1;c.t=0.6 end end
    return c
end
function Terrain.tick(c,dt)
    if c.stage==0 then
        if not c.stood then c.t=math.max(0,c.t-dt*2) end
        c.stood=false
        if c.t==0 then return nil end
    else
        c.t-=dt
        if c.t<=0 then
            if c.stage==1 then c.stage=2;c.t=8 else return nil end
        end
    end
    return c
end
return Terrain
