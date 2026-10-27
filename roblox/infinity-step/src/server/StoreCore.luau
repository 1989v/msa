-- Pure transaction boundary used by the actual Roblox DataStore adapter and CLI tests.
local StoreCore = {}
local function copy(value)
 if type(value) ~= "table" then return value end
 local result = {}
 for key, item in value do result[key] = copy(item) end
 return result
end
function StoreCore.new(backend, createRecord)
 local store = {}
 function store.update(userId, transform)
  local result
  local ok, problem = pcall(function()
   result = backend(userId, function(old)
    local record = if old then copy(old) else createRecord()
    if transform(record) == false then return nil end
    return record
   end)
  end)
  return ok and result ~= nil, if result then copy(result) else nil, problem
 end
 return store
end
return StoreCore
