-- Character epochs and offer serials are server-owned. Death carries only the snapshot.
local Fall = {}
function Fall.new()
    return { epoch=0, serial=0, safeRegion=1, safeId="Start", safeY=0, peak=0 }
end
function Fall.clear(s)
    s.serial += 1
    s.snapshot = nil
    s.offer = nil
    s.suppressed = true
end
function Fall.character(s, preserveDeath)
    s.epoch += 1
    s.serial += 1
    s.offer = nil
    s.safeRegion, s.safeId, s.safeY, s.peak = 1, "Start", 0, 0
    if not preserveDeath then s.snapshot = nil end
    if s.snapshot then
        s.offer = { token=s.serial, epoch=s.epoch, region=s.snapshot.region, platformId=s.snapshot.platformId }
    end
end
function Fall.land(s, platform)
    if not platform then return end
    -- Only a new ascent above the departure clears the original descent snapshot.
    if s.snapshot and platform.y > s.snapshot.y + 1 then Fall.clear(s) end
    s.safeRegion, s.safeId, s.safeY = platform.region, platform.id, platform.y
    s.suppressed=false
    s.peak = math.max(s.peak, platform.y)
end
function Fall.sample(s, y, descending)
    if descending and not s.suppressed and not s.snapshot and s.safeY > 0 then
        s.snapshot = { region=s.safeRegion, platformId=s.safeId, y=s.safeY }
    end
    if s.snapshot and s.snapshot.y - y >= 10 and not s.offer then
        s.serial += 1
        s.offer = { token=s.serial, epoch=s.epoch, region=s.snapshot.region, platformId=s.snapshot.platformId }
    end
end
function Fall.death(s)
    if not s.suppressed and not s.snapshot and s.safeY > 0 then s.snapshot={region=s.safeRegion,platformId=s.safeId,y=s.safeY} end
    s.offer=nil
end
function Fall.valid(s, token, epoch)
    return s.offer ~= nil and s.offer.token == token and s.offer.epoch == epoch and s.epoch == epoch
end
return Fall
