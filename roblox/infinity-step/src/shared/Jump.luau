-- Source reference: Leap.cs. Four studs per source unit; levels are 1-based here.
local Jump = { Gravity = 104, HoldStep = 0.12, MaxHold = 1.2 }
function Jump.finite(n)
    return type(n) == "number" and n == n and math.abs(n) < math.huge
end
function Jump.level(seconds)
    return math.clamp(math.floor(math.clamp(seconds, 0, Jump.MaxHold) / Jump.HoldStep + 1e-7) + 1, 1, 5)
end
function Jump.speeds(level)
    local t = (math.clamp(level, 1, 5) - 1) / 4
    return 30 + 34 * t, 6 + 34 * t
end
function Jump.direction(x, z)
    if not Jump.finite(x) or not Jump.finite(z) then return nil end
    local length = math.sqrt(x*x + z*z)
    if length < 0.01 or length > 1.1 then return nil end
    return x / length, z / length
end
function Jump.release(started, now, grounded, x, z)
    if not started or not grounded or not Jump.finite(now) or now < started then return nil end
    local dx, dz = Jump.direction(x, z)
    if not dx then return nil end
    local level = Jump.level(now - started)
    local vy, vx = Jump.speeds(level)
    return { x = dx * vx, y = vy, z = dz * vx, level = level }
end
-- Descending intersection with target height; used to verify authored route.
function Jump.landing(level, rise)
    local vy, vx = Jump.speeds(level)
    local disc = vy*vy - 2*Jump.Gravity*rise
    if disc < 0 then return nil end
    local seconds = (vy + math.sqrt(disc)) / Jump.Gravity
    return vx * seconds, seconds
end
return Jump
