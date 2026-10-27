-- Pure rules; no engine dependencies. Power is prepared BEFORE native jumping.
local Rules = {}
Rules.CHARGE_SECONDS = 1.4
Rules.STABLE_SECONDS = 0.22
Rules.MIN_POWER = 52
Rules.MAX_POWER = 76
Rules.PRODUCT_ID = 0
Rules.REGIONS = {"도시 광장", "외벽 골목", "주거 옥상", "마천루", "공사장", "성층권", "블랙홀"}
function Rules.finite(n)
 return type(n) == "number" and n == n and math.abs(n) < math.huge
end
function Rules.power(seconds)
 return Rules.MIN_POWER + (Rules.MAX_POWER - Rules.MIN_POWER) * math.clamp(seconds / Rules.CHARGE_SECONDS, 0, 1)
end
function Rules.stamina(value, climbing, grounded, dt)
 return math.clamp(value + (if climbing then -0.2 elseif grounded then 0.35 else 0) * math.clamp(dt, 0, 0.2), 0, 1)
end
function Rules.canLand(verticalSpeed, seconds, isSurface)
 return isSurface and math.abs(verticalSpeed) < 3 and seconds >= Rules.STABLE_SECONDS
end
function Rules.invalidJump(seenInAir, groundedTransition)
 return seenInAir and not groundedTransition
end
function Rules.saveRoof(lastStable, acceptedRoof, isStable)
 return if isStable and lastStable == acceptedRoof then lastStable else 0
end
function Rules.nextDismissed(dismissed, newStableLanding)
 return dismissed and not newStableLanding
end
function Rules.shouldOffer(hasOffer, dismissed, height, roofHeight)
 return not hasOffer and not dismissed and height < roofHeight - 24
end
function Rules.canAdvance(previous, target)
 -- A normal rise can reach the next two roofs; large teleports never become saved progress.
 return type(target) == "number" and target % 1 == 0 and target >= 0 and target <= 42 and target <= previous + 2
end
function Rules.newRecord()
 return {version = 1, current = 0, best = 0, credits = 0, receipts = {}, pending = false, owner = "", lease = 0, sequence = 0}
end
function Rules.claim(record, token, now)
 if record.owner ~= "" and record.owner ~= token and record.lease > now then return false end
 record.owner, record.lease, record.sequence = token, now + 120, 0
 return true
end
function Rules.snapshot(record, token, sequence, current, now, best)
 if record.owner ~= token or sequence <= record.sequence or not Rules.finite(current) or current % 1 ~= 0 or current < 0 or current > 42 then return false end
 if best ~= nil and (not Rules.finite(best) or best % 1 ~= 0 or best < 0 or best > 42) then return false end
 record.current, record.best = current, math.max(record.best, current, best or 0)
 record.sequence, record.lease = sequence, now + 120
 return true
end
function Rules.reserve(record, token, request, target)
 if record.owner ~= token then return false end
 if record.pending then return record.pending.id == request end
 if record.credits < 1 or not Rules.finite(target) or target % 1 ~= 0 or target < 0 or target > 42 then return false end
 record.credits -= 1
 record.pending = {id = request, target = target}
 return true
end
function Rules.ack(record, token, request)
 if record.owner ~= token or not record.pending or record.pending.id ~= request then return false end
 record.current = record.pending.target
 record.best = math.max(record.best, record.current)
 record.pending = false
 return true
end
function Rules.receipt(record, id, product)
 if product ~= Rules.PRODUCT_ID or product == 0 or type(id) ~= "string" or #id == 0 then return false end
 if not record.receipts[id] then record.receipts[id] = true; record.credits += 1 end
 return true
end
return Rules
