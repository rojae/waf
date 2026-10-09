package kr.rojae.waf.social;

import kr.rojae.waf.social.domain.oauth.OAuthStateService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(properties = {
        "app.jwt.secret=0123456789abcdef0123456789abcdef",
        "GOOGLE_CLIENT_ID=dummy-client",
        "GOOGLE_CLIENT_SECRET=dummy-secret",
        "spring.security.oauth2.client.registration.google.authorization-grant-type=authorization_code",
        "spring.security.oauth2.client.registration.google.redirect-uri=http://localhost:8081/login/oauth2/code/google",
        "spring.security.oauth2.client.registration.google.provider=local-google",
        "spring.security.oauth2.client.provider.local-google.authorization-uri=https://accounts.google.com/o/oauth2/v2/auth",
        "spring.security.oauth2.client.provider.local-google.token-uri=https://oauth2.googleapis.com/token",
        "spring.security.oauth2.client.provider.local-google.jwk-set-uri=https://www.googleapis.com/oauth2/v3/certs",
        "spring.security.oauth2.client.provider.local-google.user-info-uri=https://openidconnect.googleapis.com/v1/userinfo",
        "spring.security.oauth2.client.provider.local-google.user-name-attribute=sub"
})
class SocialApiApplicationContextTest {
    @Autowired
    OAuthStateService oauthStateService;

    @Test
    void socialContextStartsWithOAuthStateServiceConstructorInjection() {
        assertThat(oauthStateService.issue()).isNotBlank();
    }
}
