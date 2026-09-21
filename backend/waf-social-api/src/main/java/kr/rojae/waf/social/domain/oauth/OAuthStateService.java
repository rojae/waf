package kr.rojae.waf.social.domain.oauth;

import kr.rojae.waf.common.utils.Randoms;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.util.Base64;
import java.util.Iterator;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class OAuthStateService {
    public static final String COOKIE_NAME = "WAF_OAUTH_STATE";

    private final byte[] secret;
    private final long ttlSeconds;
    private final Clock clock;
    private final Map<String, Instant> consumedStates = new ConcurrentHashMap<>();

    public OAuthStateService(@Value("${app.oauth.state-secret:${app.jwt.secret}}") String secret,
                             @Value("${app.oauth.state-ttl-seconds:300}") long ttlSeconds) {
        this(secret, ttlSeconds, Clock.systemUTC());
    }

    OAuthStateService(String secret, long ttlSeconds, Clock clock) {
        if (secret == null || secret.getBytes(StandardCharsets.UTF_8).length < 32) {
            throw new IllegalArgumentException("OAuth state secret must be at least 32 bytes");
        }
        this.secret = secret.getBytes(StandardCharsets.UTF_8);
        this.ttlSeconds = ttlSeconds;
        this.clock = clock;
    }

    public String issue() {
        cleanupConsumed();
        long expiresAt = clock.instant().plusSeconds(ttlSeconds).getEpochSecond();
        String payload = Randoms.urlSafeState() + "." + expiresAt;
        return payload + "." + sign(payload);
    }

    public boolean consume(String callbackState, String cookieState) {
        cleanupConsumed();
        if (callbackState == null || cookieState == null || !callbackState.equals(cookieState)) {
            return false;
        }
        String[] parts = callbackState.split("\\.");
        if (parts.length != 3) {
            return false;
        }
        String payload = parts[0] + "." + parts[1];
        if (!constantTimeEquals(parts[2], sign(payload))) {
            return false;
        }
        try {
            Instant expiresAt = Instant.ofEpochSecond(Long.parseLong(parts[1]));
            if (!expiresAt.isAfter(clock.instant())) {
                return false;
            }
            return consumedStates.putIfAbsent(callbackState, expiresAt) == null;
        } catch (NumberFormatException e) {
            return false;
        }
    }

    public long ttlSeconds() {
        return ttlSeconds;
    }

    private void cleanupConsumed() {
        Instant now = clock.instant();
        Iterator<Map.Entry<String, Instant>> iterator = consumedStates.entrySet().iterator();
        while (iterator.hasNext()) {
            if (!iterator.next().getValue().isAfter(now)) {
                iterator.remove();
            }
        }
    }

    private String sign(String payload) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret, "HmacSHA256"));
            return Base64.getUrlEncoder().withoutPadding()
                    .encodeToString(mac.doFinal(payload.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException("Unable to sign OAuth state", e);
        }
    }

    private boolean constantTimeEquals(String left, String right) {
        return MessageDigestHolder.equals(left.getBytes(StandardCharsets.UTF_8), right.getBytes(StandardCharsets.UTF_8));
    }

    private static final class MessageDigestHolder {
        private static boolean equals(byte[] left, byte[] right) {
            return java.security.MessageDigest.isEqual(left, right);
        }
    }
}
