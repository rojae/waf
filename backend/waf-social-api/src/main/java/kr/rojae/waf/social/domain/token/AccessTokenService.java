package kr.rojae.waf.social.domain.token;

import com.nimbusds.jose.JOSEException;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.MACSigner;
import com.nimbusds.jose.crypto.MACVerifier;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import kr.rojae.waf.social.dto.OAuthUser;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.UUID;

@Service
public class AccessTokenService {
    private final byte[] secret;
    private final long ttlSeconds;

    public AccessTokenService(@Value("${app.jwt.secret}") String secret,
                              @Value("${app.jwt.access-ttl-seconds}") long ttlSeconds) {
        this.secret = secret.getBytes(StandardCharsets.UTF_8);
        this.ttlSeconds = ttlSeconds;
    }

    public String issue(OAuthUser u) {
        var now = new Date();
        var exp = new Date(now.getTime() + ttlSeconds * 1000);
        var jti = UUID.randomUUID().toString();
        var claims = new JWTClaimsSet.Builder()
                .subject(u.getSub())
                .issueTime(now).expirationTime(exp).jwtID(jti)
                .claim("email", u.getEmail())
                .claim("name", u.getName())
                .build();
        var jwt = new SignedJWT(new JWSHeader(JWSAlgorithm.HS256), claims);
        try {
            jwt.sign(new MACSigner(secret));
            return jwt.serialize();
        } catch (JOSEException e) {
            throw new RuntimeException(e);
        }
    }

    public long ttlSeconds() {
        return ttlSeconds;
    }

    public JWTClaimsSet verifyAndClaims(String jwt) {
        try {
            var parsed = SignedJWT.parse(jwt);
            if (!parsed.verify(new MACVerifier(secret))) {
                throw new SecurityException("invalid_signature");
            }
            var claims = parsed.getJWTClaimsSet();
            if (claims.getExpirationTime() != null &&
                claims.getExpirationTime().before(new Date())) {
                throw new SecurityException("expired");
            }
            return claims;
        } catch (Exception e) {
            throw new SecurityException("invalid_token", e);
        }
    }

    public String jti(String jwt) {
        var claims = verifyAndClaims(jwt);
        return claims.getJWTID();
    }
}
