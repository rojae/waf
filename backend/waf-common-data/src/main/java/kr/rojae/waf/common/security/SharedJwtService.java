package kr.rojae.waf.common.security;

import com.nimbusds.jose.JOSEException;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.MACSigner;
import com.nimbusds.jose.crypto.MACVerifier;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import kr.rojae.waf.social.dto.OAuthUser;

import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.util.Date;
import java.util.Objects;
import java.util.UUID;

public class SharedJwtService {
    private static final int MIN_SECRET_BYTES = 32;

    private final byte[] secret;
    private final long ttlSeconds;
    private final Clock clock;

    public SharedJwtService(String secret, long ttlSeconds) {
        this(secret, ttlSeconds, Clock.systemUTC());
    }

    public SharedJwtService(String secret, long ttlSeconds, Clock clock) {
        if (secret == null || secret.getBytes(StandardCharsets.UTF_8).length < MIN_SECRET_BYTES) {
            throw new IllegalArgumentException("JWT secret must be at least 32 bytes");
        }
        if (ttlSeconds <= 0) {
            throw new IllegalArgumentException("JWT TTL must be positive");
        }
        this.secret = secret.getBytes(StandardCharsets.UTF_8);
        this.ttlSeconds = ttlSeconds;
        this.clock = Objects.requireNonNull(clock, "clock");
    }

    public String issue(OAuthUser user) {
        if (user == null || user.getSub() == null || user.getSub().isBlank()) {
            throw new IllegalArgumentException("JWT subject is required");
        }
        var now = Date.from(clock.instant());
        var exp = Date.from(clock.instant().plusSeconds(ttlSeconds));
        var claims = new JWTClaimsSet.Builder()
                .subject(user.getSub())
                .issueTime(now)
                .expirationTime(exp)
                .jwtID(UUID.randomUUID().toString())
                .claim("email", user.getEmail())
                .claim("name", user.getName())
                .build();
        var jwt = new SignedJWT(new JWSHeader(JWSAlgorithm.HS256), claims);
        try {
            jwt.sign(new MACSigner(secret));
            return jwt.serialize();
        } catch (JOSEException e) {
            throw new IllegalStateException("Unable to sign JWT", e);
        }
    }

    public JWTClaimsSet verifyAndClaims(String jwt) {
        if (jwt == null || jwt.isBlank()) {
            throw new SecurityException("no_token");
        }
        try {
            var parsed = SignedJWT.parse(jwt);
            if (!JWSAlgorithm.HS256.equals(parsed.getHeader().getAlgorithm())) {
                throw new SecurityException("invalid_algorithm");
            }
            if (!parsed.verify(new MACVerifier(secret))) {
                throw new SecurityException("invalid_signature");
            }
            var claims = parsed.getJWTClaimsSet();
            if (claims.getSubject() == null || claims.getSubject().isBlank()) {
                throw new SecurityException("missing_subject");
            }
            Date expiration = claims.getExpirationTime();
            if (expiration == null || !expiration.after(Date.from(clock.instant()))) {
                throw new SecurityException("expired");
            }
            return claims;
        } catch (SecurityException e) {
            throw e;
        } catch (Exception e) {
            throw new SecurityException("invalid_token", e);
        }
    }

    public long ttlSeconds() {
        return ttlSeconds;
    }
}
