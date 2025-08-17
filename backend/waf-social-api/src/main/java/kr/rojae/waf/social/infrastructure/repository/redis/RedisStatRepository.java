package kr.rojae.waf.social.infrastructure.repository.redis;

import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Repository;

import java.time.Duration;

@Repository
public class RedisStatRepository {
    private final StringRedisTemplate redis;

    public RedisStatRepository(StringRedisTemplate redis) {
        this.redis = redis;
    }

    public void save(String state, String redirect, Duration ttl) {
        String key = "oauth:state:" + state;
        redis.opsForValue().set(key, redirect, ttl);
    }

    public String consume(String state) {
        String key = "oauth:state:" + state;
        var v = redis.opsForValue().get(key);
        if (v != null) redis.delete(key);
        return v;
    }
}
