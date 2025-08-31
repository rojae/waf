package kr.rojae.waf.social.application;

import kr.rojae.waf.common.enums.SocialType;
import kr.rojae.waf.common.utils.Randoms;
import kr.rojae.waf.social.domain.oauth.SocialOAuthService;
import kr.rojae.waf.social.domain.oauth.SocialServiceFactory;
import kr.rojae.waf.social.domain.token.AccessTokenService;
import kr.rojae.waf.social.dto.OAuthUser;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

import java.net.URI;

@Component
@RequiredArgsConstructor
@Slf4j
public class AuthUseCase {

    private final SocialServiceFactory factory;
    // Redis removed - using stateless JWT authentication
    private final AccessTokenService accessTokenService;

    @Value("${app.jwt.cookie-name}")
    String cookieName;
    @Value("${app.jwt.cookie-domain}")
    String cookieDomain;

    public URI startLogin(String provider, String redirectUri) {
        SocialType type = SocialType.ofCode(provider.toUpperCase());
        SocialOAuthService svc = factory.get(type);

        String state = Randoms.urlSafeState();
        if (log.isInfoEnabled())
            log.info("state : {}", state);

        // State validation removed - using CSRF protection in frontend

        return svc.buildAuthorizationUri(callbackUri(provider), state);
    }

    public CallbackResult handleCallback(String provider, String code, String state) {
        // State validation removed - using CSRF protection in frontend
        String redirect = "http://localhost:3001"; // Default redirect

        SocialType type = SocialType.ofCode(provider.toUpperCase());
        SocialOAuthService svc = factory.get(type);

        OAuthUser user = svc.handleCallback(code, callbackUri(provider), state);

        if (log.isInfoEnabled())
            log.info("OAuthUser : {}", user);

        // User profile saved in JWT token instead of Redis

        String jwt = accessTokenService.issue(user);

        var cookie = ResponseCookie.from(cookieName, jwt)
                .httpOnly(true).secure(false).sameSite("Lax")
                .domain(cookieDomain).path("/").maxAge(accessTokenService.ttlSeconds()).build();

        return new CallbackResult(redirect, cookie);
    }

    private String callbackUri(String provider) {
        return "http://localhost:8081/auth/" + provider + "/callback";
    }

    public record CallbackResult(String redirect, ResponseCookie cookie) {
    }
}
