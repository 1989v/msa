-- KEYS[1] = inventory:{productId}:{warehouseId}
-- ARGV[1] = qty to reserve
local key = KEYS[1]
local qty = tonumber(ARGV[1])

local available = tonumber(redis.call('HGET', key, 'availableQty') or 0)
if available < qty then
    return -1  -- insufficient stock
end

redis.call('HINCRBY', key, 'availableQty', -qty)
redis.call('HINCRBY', key, 'reservedQty', qty)
redis.call('SET', key .. ':lastUpdated', tostring(redis.call('TIME')[1]))
return redis.call('HGET', key, 'availableQty')
