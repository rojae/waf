package kr.rojae.waf.social.domain.oauth;

import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import kr.rojae.waf.common.enums.SocialType;
import kr.rojae.waf.social.dto.OAuthUser;
import lombok.RequiredArgsConstructor;
import org.springframework.security.oauth2.client.endpoint.DefaultAuthorizationCodeTokenResponseClient;
import org.springframework.security.oauth2.client.endpoint.OAuth2AccessTokenResponseClient;
import org.springframework.security.oauth2.client.endpoint.OAuth2AuthorizationCodeGrantRequest;
import org.springframework.security.oauth2.client.oidc.userinfo.OidcUserRequest;
import org.springframework.security.oauth2.client.oidc.userinfo.OidcUserService;
import org.springframework.security.oauth2.client.registration.ClientRegistration;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationExchange;
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationRequest;
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationResponse;
import org.springframework.security.oauth2.core.oidc.OidcIdToken;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.util.Collections;

@Service
@RequiredArgsConstructor
public class GoogleOAuthService implements SocialOAuthService {

    private final ClientRegistrationRepository registrationRepo;
    private final OAuth2AccessTokenResponseClient<OAuth2AuthorizationCodeGrantRequest> tokenClient =
            new DefaultAuthorizationCodeTokenResponseClient();
    private final OidcUserService oidcUserService = new OidcUserService();

    private ClientRegistration reg() {
        return (ClientRegistration) registrationRepo.findByRegistrationId("google");
    }

    @Override
    public SocialType supports() {
        return SocialType.GOOGLE;
    }

    @Override
    public URI buildAuthorizationUri(String redirectUri, String state) {
        var r = reg();
        var authReq = OAuth2AuthorizationRequest.authorizationCode()
                .authorizationUri(r.getProviderDetails().getAuthorizationUri())
                .clientId(r.getClientId())
                .redirectUri(redirectUri)
                .scopes(r.getScopes())
                .state(state)
                .additionalParameters(Collections.emptyMap())
                .build();
        return URI.create(authReq.getAuthorizationRequestUri());
    }

    @Override
    public OAuthUser handleCallback(String code, String redirectUri, String state) {
        var r = reg();

        // code -> token
        var exchange = new OAuth2AuthorizationExchange(
                OAuth2AuthorizationRequest.authorizationCode()
                        .authorizationUri(r.getProviderDetails().getAuthorizationUri())
                        .clientId(r.getClientId())
                        .redirectUri(redirectUri)
                        .scopes(r.getScopes()) // openid 포함
                        .state(state).build(),
                OAuth2AuthorizationResponse.success(code).redirectUri(redirectUri).state(state).build()
        );
        var token = tokenClient.getTokenResponse(new OAuth2AuthorizationCodeGrantRequest(r, exchange));

        // id_token -> OidcUser
        var id = (String) token.getAdditionalParameters().get("id_token");
        if (id == null) throw new IllegalStateException("Missing id_token (check scope=openid)");
        var cs = parseIdTokenClaims(id);
        var oidc = oidcUserService.loadUser(
                new OidcUserRequest(r, token.getAccessToken(),
                        new OidcIdToken(id, cs.getIssueTime().toInstant(), cs.getExpirationTime().toInstant(), cs.getClaims()),
                        token.getAdditionalParameters())
        );

        // DTO 매핑
        return OAuthUser.builder()
                .sub(oidc.getSubject())
                .email(oidc.getEmail())
                .name(oidc.getFullName())
                .picture(oidc.getPicture())
                .build();
    }

    private JWTClaimsSet parseIdTokenClaims(String idToken) {
        try {
            return SignedJWT.parse(idToken).getJWTClaimsSet();
        } catch (java.text.ParseException e) {
            throw new IllegalStateException("Invalid id_token", e);
        }
    }

}
