package kr.rojae.waf.social.application;

import com.nimbusds.jwt.JWTClaimsSet;
import kr.rojae.waf.social.domain.token.AccessTokenService;
import kr.rojae.waf.social.infrastructure.repository.redis.SessionRepository;
import kr.rojae.waf.social.infrastructure.repository.redis.UserProfileRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

import java.text.ParseException;
import java.util.HashMap;
import java.util.Map;

@Component
@RequiredArgsConstructor
public class SessionUseCase {

    private final AccessTokenService accessTokenService;
    private final SessionRepository sessionRepository;
    private final UserProfileRepository userProfileRepository;

    @Value("${app.jwt.cookie-name}")
    String cookieName;
    @Value("${app.jwt.cookie-domain}")
    String cookieDomain;

    public MeResult me(String jwt) {
        if (jwt == null) return MeResult.unauthorized("no_token");
        try {
            JWTClaimsSet claims = accessTokenService.verifyAndClaims(jwt);
            String jti = claims.getJWTID();
            if (!sessionRepository.isActive(jti)) return MeResult.unauthorized("session_revoked");

            String sub = claims.getSubject();
            Map<Object, Object> profile = userProfileRepository.entries(sub); // 없으면 빈 맵
            Map<String, Object> body = new HashMap<>();
            body.put("sub", sub);
            body.put("email", claims.getStringClaim("email"));
            body.put("name", claims.getStringClaim("name"));
            body.put("profile", profile);
            return new MeResult(200, body);
        } catch (SecurityException | ParseException e) {
            return MeResult.unauthorized(e.getMessage());
        }
    }

    public LogoutResult logout(String jwt) {
        if (jwt != null) {
            try {
                sessionRepository.revoke(accessTokenService.jti(jwt));
            } catch (Exception ignore) {
            }
        }
        ResponseCookie del = ResponseCookie.from(cookieName, "")
                .httpOnly(true).secure(false)  // HTTPS면 true
                .sameSite("Lax")
                .domain(cookieDomain)
                .path("/")
                .maxAge(0)
                .build();
        return new LogoutResult(del);
    }

    public record MeResult(int status, Object body) {
        static MeResult unauthorized(String reason) {
            return new MeResult(401, Map.of("error", reason));
        }
    }

    public record LogoutResult(ResponseCookie deleteCookie) {
    }
}
