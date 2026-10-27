local Course=require("../src/shared/Course")
local function json(value)
    local kind=type(value)
    if kind=="string" then return string.format("%q",value) end
    if kind=="number" or kind=="boolean" then return tostring(value) end
    assert(kind=="table")
    local list={}
    if #value>0 then
        for _,v in value do table.insert(list,json(v)) end
        return "["..table.concat(list,",").."]"
    end
    local keys={}
    for key,v in value do if type(v)~="function" then table.insert(keys,key) end end
    table.sort(keys)
    for _,key in keys do table.insert(list,json(key)..":"..json(value[key])) end
    return "{"..table.concat(list,",").."}"
end
print(json(Course))
