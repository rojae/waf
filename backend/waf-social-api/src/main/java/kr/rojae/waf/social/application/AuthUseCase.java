package kr.rojae.waf.social.application;

import kr.rojae.waf.common.enums.SocialType;
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
import java.util.LinkedHashMap;
import java.util.Map;

@Component
@RequiredArgsConstructor
@Slf4j
public class AuthUseCase {

    private final SocialServiceFactory factory;
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

    public LoginStart startLogin(String provider) {
        SocialType type = SocialType.ofCode(provider.toUpperCase());
        SocialOAuthService svc = factory.get(type);
        String state = oauthStateService.issue();
        return new LoginStart(svc.buildAuthorizationUri(callbackUri(provider), state), state);
    }

    private final kr.rojae.waf.social.domain.oauth.OAuthStateService oauthStateService;

    public boolean consumeState(String state, String cookieState) {
        return oauthStateService.consume(state, cookieState);
    }

    public long stateTtlSeconds() {
        return oauthStateService.ttlSeconds();
    }

    public AuthCallbackResponse handleCallback(String provider, String code, String redirectUri) {
        String redirect = safeRedirect(redirectUri);

        try {
            SocialType type = SocialType.ofCode(provider.toUpperCase());
            SocialOAuthService svc = factory.get(type);

            String configuredRedirectUri = callbackBaseUrl + "/login/oauth2/code/" + provider;
            OAuthUser user = svc.handleCallback(code, configuredRedirectUri, "validated");

            String jwt = accessTokenService.issue(user);

            return AuthCallbackResponse.success(
                jwt,
                userBody(user),
                redirect,
                cookieName,
                cookieDomain,
                "/",
                accessTokenService.ttlSeconds(),
                false, // secure - false for localhost (set to true in production)
                true,  // httpOnly - true to prevent XSS attacks
                "Lax"  // sameSite
            );
        } catch (Exception e) {
            log.error("OAuth callback failed", e);
            return AuthCallbackResponse.error(redirect);
        }
    }

    private String callbackUri(String provider) {
        String uri = callbackBaseUrl + "/login/oauth2/code/" + provider;
        return uri;
    }

    public AuthCallbackResponse safeExchangeFailure(String redirectUri) {
        return AuthCallbackResponse.error(safeRedirect(redirectUri));
    }

    public String safeRedirect(String redirectUri) {
        if (redirectUri == null || redirectUri.isBlank()) {
            return defaultRedirectUrl.startsWith("/") ? defaultRedirectUrl : "/dashboard";
        }
        if (redirectUri.startsWith("/") && !redirectUri.startsWith("//") && !redirectUri.contains("\\\\")) {
            return redirectUri;
        }
        return "/dashboard";
    }

    private Map<String, Object> userBody(OAuthUser user) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("sub", user.getSub());
        body.put("email", user.getEmail());
        body.put("name", user.getName());
        body.put("picture", user.getPicture());
        return body;
    }

    public record LoginStart(URI authorizationUri, String state) {
    }
}
