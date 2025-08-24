package kr.rojae.waf.social.application;

import com.nimbusds.jwt.JWTClaimsSet;
import kr.rojae.waf.social.domain.token.AccessTokenService;
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
    // Redis removed - using stateless JWT authentication

    @Value("${app.jwt.cookie-name}")
    String cookieName;
    @Value("${app.jwt.cookie-domain}")
    String cookieDomain;

    public MeResult me(String jwt) {
        if (jwt == null) return MeResult.unauthorized("no_token");
        try {
            JWTClaimsSet claims = accessTokenService.verifyAndClaims(jwt);
            // Session check removed - using stateless JWT

            String sub = claims.getSubject();
            // Profile from JWT claims instead of Redis
            Map<String, Object> body = new HashMap<>();
            body.put("sub", sub);
            body.put("email", claims.getStringClaim("email"));
            body.put("name", claims.getStringClaim("name"));
            body.put("profile", new HashMap<>()); // Empty profile
            return new MeResult(200, body);
        } catch (SecurityException | ParseException e) {
            return MeResult.unauthorized(e.getMessage());
        }
    }

    public LogoutResult logout(String jwt) {
        // Session revocation removed - JWT tokens are stateless
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
