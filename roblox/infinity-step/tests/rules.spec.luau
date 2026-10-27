local Rules = require("../src/shared/Rules")
local count = 0
local function check(value, message)
 count += 1
 assert(value, message)
end
local function clone(value)
 if type(value) ~= "table" then return value end
 local out = {}; for k,v in value do out[k] = clone(v) end; return out
end
-- Production-style copy-on-transaction adapter; caller memory never aliases storage.
local db = Rules.newRecord()
local function update(fn)
 local nextRecord = clone(db)
 if fn(nextRecord) == false then return false end
 db = clone(nextRecord)
 return clone(db)
end
check(Rules.power(-10) == 52 and Rules.power(10) == 76, "positive bounded native power")
check(Rules.power(.7) == 64, "automatic half-charge")
check(not Rules.canLand(0,.1,true) and Rules.canLand(0,.23,true), "stable landing debounce")
check(not Rules.canLand(10,1,true) and not Rules.canLand(0,1,false), "falling and scenery are not safe roofs")
check(not Rules.invalidJump(true,true), "fast native ground jump remains valid before stable debounce")
check(Rules.invalidJump(true,false) and not Rules.invalidJump(false,false), "reject only repeated airborne jumps")
check(Rules.stamina(.01,true,false,.2)==0, "climb exhaustion")
check(Rules.stamina(.5,false,true,.2)>.5, "ground stamina recovery")
check(Rules.stamina(.5,false,false,2)==.5, "air does not recharge stamina")
check(Rules.saveRoof(20,nil,true)==0, "unregistered ground never saves an old high roof")
check(Rules.saveRoof(20,20,false)==0 and Rules.saveRoof(20,20,true)==20, "only matching stable roof resumes")
check(Rules.shouldOffer(false,false,0,30), "fall offers once")
check(not Rules.shouldOffer(false,true,0,30), "decline stays dismissed during same fall")
check(Rules.nextDismissed(true,false), "death during dismissed fall does not reset episode")
check(not Rules.nextDismissed(true,true), "new stable landing on SAME roof resets dismissed episode")
check(Rules.canAdvance(5,7) and Rules.canAdvance(20,2) and not Rules.canAdvance(0,42), "bounded rises, valid descents")
check(not Rules.canAdvance(0,0/0) and not Rules.finite(math.huge), "nonfinite input rejected")
check(update(function(r) return Rules.claim(r,"A",100) end), "first owner")
local stale = clone(db)
check(not update(function(r) return Rules.claim(r,"B",101) end), "lease excludes parallel server")
local liveBest = 20
check(update(function(r) return Rules.snapshot(r,"A",1,0,110,liveBest) end), "fall saves floor plus unsaved personal best")
check(db.current==0 and db.best==20, "best survives fall before periodic save")
check(not update(function(r) return Rules.snapshot(r,"A",1,0,111,0) end), "out-of-order snapshot rejected")
check(update(function(r) return Rules.claim(r,"B",300) end), "expired owner takeover")
check(not update(function(r) return Rules.snapshot(r,"A",2,42,301,42) end), "stale server cannot overwrite successor")
check(stale.best==0, "storage and memory are independent")
check(not Rules.receipt(db,"real-receipt",0), "sales disabled at product zero")
-- Exercise future receipt idempotency without mutating the production constant permanently.
Rules.PRODUCT_ID=123
check(Rules.receipt(db,"receipt1",123), "receipt accepted")
check(Rules.receipt(db,"receipt1",123), "receipt retry accepted")
check(db.credits==1, "receipt credited exactly once")
Rules.PRODUCT_ID=0
check(update(function(r) return Rules.reserve(r,"B","reservation",19) end), "atomic reserve")
check(db.credits==0 and db.pending.target==19, "debit and durable destination together")
check(update(function(r) return Rules.reserve(r,"B","reservation",19) end), "same reservation retry")
check(not update(function(r) return Rules.reserve(r,"B","other",18) end), "second request cannot double consume")
-- Transport fails / player disconnects: pending stays stored for next owner, no second debit.
check(update(function(r) return Rules.claim(r,"C",500) end), "rejoin owner")
check(db.pending.target==19 and db.credits==0, "failed transport survives reconnect")
check(not update(function(r) return Rules.ack(r,"B","reservation") end), "stale acknowledgement rejected")
check(update(function(r) return Rules.ack(r,"C","reservation") end), "ack only after safe return")
check(db.current==19 and db.best==20 and db.pending==false and db.credits==0, "delivery exactly once")
check(not update(function(r) return Rules.ack(r,"C","reservation") end), "duplicate ack no effect")
check(not update(function(r) return Rules.reserve(r,"C","empty",20) end), "empty inventory fails closed")
local before=clone(db)
check(not update(function(r) r.credits=500; return false end) and db.credits==before.credits, "failed transaction rollback")
print(string.format("RULES OK: %d meaningful assertions (copy-isolated transaction adapter)",count))
