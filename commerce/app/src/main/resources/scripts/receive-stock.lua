-- KEYS[1] = inventory:{productId}:{warehouseId}
-- ARGV[1] = qty to receive
local key = KEYS[1]
local qty = tonumber(ARGV[1])

redis.call('HINCRBY', key, 'availableQty', qty)
redis.call('SET', key .. ':lastUpdated', tostring(redis.call('TIME')[1]))
return redis.call('HGET', key, 'availableQty')
