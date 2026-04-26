-- TG-P2-11.4 — Atomic Redis token bucket (multi-instance 합산 한도 보장).
--
-- KEYS[1] = bucket key (예: ratelimit:bithumb:{tenantId}:{apiKeyHash})
-- ARGV[1] = now_ms                  (현재 시각, ms)
-- ARGV[2] = bucket_size             (최대 토큰 수)
-- ARGV[3] = refill_rate_per_sec     (초당 보충량, float)
-- ARGV[4] = tokens_to_consume       (요청당 소비량, int)
--
-- Returns: { result, remaining_tokens }
--   result = 1 → success (소비 성공)
--   result = 0 → throttled (잔량 부족)
--
-- Notes:
--   - 키 만료(EXPIRE 3600s)로 idle bucket 자동 회수.
--   - 정확한 atomic 보장을 위해 모든 read/write 가 한 스크립트 안에서 처리된다.
local key = KEYS[1]
local now = tonumber(ARGV[1])
local size = tonumber(ARGV[2])
local rate = tonumber(ARGV[3])
local consume = tonumber(ARGV[4])

local bucket = redis.call('HMGET', key, 'tokens', 'last_refill')
local tokens = tonumber(bucket[1])
local last_refill = tonumber(bucket[2])

if tokens == nil then tokens = size end
if last_refill == nil then last_refill = now end

-- Refill: elapsed seconds × rate
local elapsed_sec = (now - last_refill) / 1000
if elapsed_sec < 0 then elapsed_sec = 0 end
local refill = elapsed_sec * rate
tokens = math.min(size, tokens + refill)
last_refill = now

local result = 0
if tokens >= consume then
    tokens = tokens - consume
    result = 1
end

redis.call('HMSET', key, 'tokens', tokens, 'last_refill', last_refill)
redis.call('EXPIRE', key, 3600)

return { result, math.floor(tokens) }
