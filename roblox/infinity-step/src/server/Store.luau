-- New namespace. Studio memory is deliberately isolated from production inventory.
local DataStoreService = game:GetService("DataStoreService")
local RunService = game:GetService("RunService")
local Rules = require(game.ReplicatedStorage.InfinityStep.Rules)
local StoreCore = require(script.Parent.StoreCore)
local memory = {}
local database = if RunService:IsStudio() then nil else DataStoreService:GetDataStore("InfinityStepNative_v1")
return StoreCore.new(function(userId, callback)
 if database then return database:UpdateAsync("player:" .. userId, callback) end
 local nextRecord = callback(memory[userId])
 if nextRecord ~= nil then memory[userId] = nextRecord end
 return nextRecord
end, function()
 local record = Rules.newRecord()
 if RunService:IsStudio() then record.credits = 3 end
 return record
end)
