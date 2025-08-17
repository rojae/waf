package kr.rojae.waf.social.infrastructure.repository.redis;

import kr.rojae.waf.social.dto.OAuthUser;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Repository;

import java.time.Duration;
import java.util.Map;

@Repository
public class UserProfileRepository {
    private final StringRedisTemplate redis;

    private String key(String sub) {
        return "user:" + sub;
    }

    public UserProfileRepository(StringRedisTemplate redis) {
        this.redis = redis;
    }

    public void save(OAuthUser u) {
        String key = "user:" + u.getSub();
        redis.opsForHash().putAll(key, Map.of(
                "email", u.getEmail(),
                "name", u.getName(),
                "picture", String.valueOf(u.getPicture())
        ));
        redis.expire(key, Duration.ofDays(7));
    }

    public Map<Object, Object> entries(String sub) {
        return redis.opsForHash().entries(key(sub));
    }
}