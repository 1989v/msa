local Rules = require("../src/shared/Rules")
local StoreCore = require("../src/server/StoreCore")
local count = 0
local function check(condition,message) count+=1; assert(condition,message) end
local records = {}
local failing = false
local retryCallback = false
local uncertainCommit = false
-- DataStore-shaped backend controls commit failures and retried UpdateAsync callbacks.
local store = StoreCore.new(function(id,callback)
 if failing then error("simulated storage unavailable") end
 if retryCallback then callback(records[id]) end
 local nextRecord = callback(records[id])
 if nextRecord then records[id] = nextRecord end
 if uncertainCommit then error("commit succeeded but response lost") end
 return nextRecord
end, Rules.newRecord)
local ok, record = store.update(1,function(r) return Rules.claim(r,"session1",100) end)
check(ok and record.owner=="session1", "actual StoreCore new record/claim")
record.credits=900
check(records[1].credits==0, "actual returned record is isolated from durable storage")
local result = store.update(1,function(r) r.credits=500; return false end)
check(not result and records[1].credits==0, "actual nil cancellation does not mutate durable data")
failing=true
local failed,_,problem=store.update(1,function(r) r.credits=800; return true end)
check(not failed and type(problem)=="string" and records[1].credits==0, "actual pcall reports backend failure without overwriting")
failing=false
retryCallback=true
Rules.PRODUCT_ID=901
check(store.update(1,function(r) return Rules.receipt(r,"same-receipt",901) end), "actual callback retry receipt")
check(records[1].credits==1, "callback retry credits once")
check(store.update(1,function(r) return Rules.receipt(r,"same-receipt",901) end), "duplicate transaction receipt")
check(records[1].credits==1, "durable receipt de-duplication")
Rules.PRODUCT_ID=0
uncertainCommit=true
local reserved=store.update(1,function(r) return Rules.reserve(r,"session1","request1",8) end)
check(not reserved and records[1].credits==0 and records[1].pending.target==8, "committed reservation survives lost response")
uncertainCommit=false
check(store.update(1,function(r) return Rules.reserve(r,"session1","request1",8) end), "same request safely retried after unknown outcome")
check(records[1].credits==0 and records[1].pending.target==8, "reservation retry does not double debit")
check(not store.update(1,function(r) return Rules.claim(r,"session2",101) end), "actual concurrent-session cancellation")
check(store.update(1,function(r) return Rules.claim(r,"session2",300) end), "actual lease takeover")
check(not store.update(1,function(r) return Rules.snapshot(r,"session1",9,42,301,42) end), "old server snapshot rejected")
check(records[1].pending.target==8, "pending delivery survives successor ownership")
check(store.update(1,function(r) return Rules.ack(r,"session2","request1") end), "successor acknowledges same pending delivery")
check(records[1].current==8 and records[1].pending==false and records[1].credits==0, "actual delivery committed once")
print(string.format("STORE CORE OK: %d assertions against actual StoreCore.update; Roblox service adapter remains engine-unverified",count))
