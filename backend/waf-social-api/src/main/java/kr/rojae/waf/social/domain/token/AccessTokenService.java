package kr.rojae.waf.social.domain.token;

import com.nimbusds.jwt.JWTClaimsSet;
import kr.rojae.waf.common.security.SharedJwtService;
import kr.rojae.waf.social.dto.OAuthUser;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class AccessTokenService {
    private final SharedJwtService sharedJwtService;

    public AccessTokenService(@Value("${app.jwt.secret}") String secret,
                              @Value("${app.jwt.access-ttl-seconds}") long ttlSeconds) {
        this.sharedJwtService = new SharedJwtService(secret, ttlSeconds);
    }

    public String issue(OAuthUser u) {
        return sharedJwtService.issue(u);
    }

    public long ttlSeconds() {
        return sharedJwtService.ttlSeconds();
    }

    public JWTClaimsSet verifyAndClaims(String jwt) {
        return sharedJwtService.verifyAndClaims(jwt);
    }
}
