-- KEYS[1] = inventory:{productId}:{warehouseId}
-- ARGV[1] = qty to release
local key = KEYS[1]
local qty = tonumber(ARGV[1])

local reserved = tonumber(redis.call('HGET', key, 'reservedQty') or 0)
if reserved < qty then
    return -1  -- insufficient reserved
end

redis.call('HINCRBY', key, 'availableQty', qty)
redis.call('HINCRBY', key, 'reservedQty', -qty)
redis.call('SET', key .. ':lastUpdated', tostring(redis.call('TIME')[1]))
return redis.call('HGET', key, 'availableQty')
