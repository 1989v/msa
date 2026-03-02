package com.kgd.product.infrastructure.config

import org.springframework.context.annotation.Configuration

/**
 * Redis configuration for product service.
 * The blocking RedisTemplate<String, Any> and LettuceConnectionFactory beans
 * are provided by the common module's RedisConfig.
 * This configuration class is a placeholder for any product-specific Redis
 * customization (e.g., cache TTL configuration).
 */
@Configuration
class RedisConfig
