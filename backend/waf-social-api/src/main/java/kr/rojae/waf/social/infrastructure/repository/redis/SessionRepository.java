package kr.rojae.waf.social.infrastructure.repository.redis;

import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Repository;

import java.time.Duration;

@Repository
public class SessionRepository {
    private final StringRedisTemplate redis;

    public SessionRepository(StringRedisTemplate redis) {
        this.redis = redis;
    }

    private String key(String jti) {
        return "session:" + jti;
    }

    public void markActive(String jti, Duration ttl) {
        redis.opsForValue().set(key(jti), "1", ttl);
    }

    public boolean isActive(String jti) {
        return redis.hasKey(key(jti));
    }

    public void revoke(String jti) {
        redis.delete(key(jti));
    }
}
