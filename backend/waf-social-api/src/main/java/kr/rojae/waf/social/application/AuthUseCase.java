package kr.rojae.waf.social.application;

import kr.rojae.waf.common.enums.SocialType;
import kr.rojae.waf.common.utils.Randoms;
import kr.rojae.waf.social.domain.oauth.SocialOAuthService;
import kr.rojae.waf.social.domain.oauth.SocialServiceFactory;
import kr.rojae.waf.social.domain.token.AccessTokenService;
import kr.rojae.waf.social.dto.AuthCallbackResponse;
import kr.rojae.waf.social.dto.OAuthUser;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
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
    @Value("${app.oauth.callback-base-url}")
    String callbackBaseUrl;
    @Value("${app.oauth.default-redirect-url}")
    String defaultRedirectUrl;

    public String getCallbackBaseUrl() {
        return callbackBaseUrl;
    }

    public URI startLogin(String provider, String redirectUri) {
        SocialType type = SocialType.ofCode(provider.toUpperCase());
        SocialOAuthService svc = factory.get(type);

        String state = Randoms.urlSafeState();
        if (log.isInfoEnabled())
            log.info("state : {}", state);

        // Use the configured callback URI, not the frontend redirect URI
        return svc.buildAuthorizationUri(callbackUri(provider), state);
    }

    public AuthCallbackResponse handleCallback(String provider, String code, String state, String redirectUri) {
        // State validation removed - using CSRF protection in frontend
        String redirect = redirectUri != null ? redirectUri : defaultRedirectUrl;

        try {
            SocialType type = SocialType.ofCode(provider.toUpperCase());
            SocialOAuthService svc = factory.get(type);

            // Use the Spring Security configured redirect URI instead of generating our own
        String configuredRedirectUri = callbackBaseUrl + "/login/oauth2/code/" + provider;
        OAuthUser user = svc.handleCallback(code, configuredRedirectUri, state);

            if (log.isInfoEnabled())
                log.info("OAuthUser : {}", user);

            // User profile saved in JWT token instead of Redis
            String jwt = accessTokenService.issue(user);

            return AuthCallbackResponse.success(
                jwt,
                redirect,
                cookieName,
                cookieDomain,
                "/",
                accessTokenService.ttlSeconds(),
                false, // secure - false for localhost
                false, // httpOnly - false to allow JavaScript access
                "Lax"  // sameSite
            );
        } catch (Exception e) {
            log.error("OAuth callback failed", e);
            return AuthCallbackResponse.error(redirect);
        }
    }

    private String callbackUri(String provider) {
        String uri = callbackBaseUrl + "/login/oauth2/code/" + provider;
        log.info("Generated callback URI: {}", uri);
        return uri;
    }

    public TokenResult exchangeCodeForToken(String provider, String code, String redirectUri) {
        SocialType type = SocialType.ofCode(provider.toUpperCase());
        SocialOAuthService svc = factory.get(type);

        OAuthUser user = svc.handleCallback(code, callbackUri(provider), "dummy-state");
        String jwt = accessTokenService.issue(user);

        log.info("Token exchanged for user: {}", user.getEmail());
        return new TokenResult(jwt, user);
    }

    public record TokenResult(String jwt, OAuthUser user) {
    }
}
