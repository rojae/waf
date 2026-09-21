package kr.rojae.waf.dashboard.config;

import kr.rojae.waf.common.security.SharedJwtService;
import kr.rojae.waf.social.dto.OAuthUser;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.data.elasticsearch.client.elc.ElasticsearchTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.net.URI;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "app.jwt.secret=0123456789abcdef0123456789abcdef",
        "app.cors.allowed-origins=http://localhost:3101",
        "spring.kafka.listener.auto-startup=false",
        "app.management.store=${java.io.tmpdir}/waf-dashboard-encoded-path-${random.uuid}.json"
})
class DashboardEncodedPathAuthIntegrationTest {
    private static final String SECRET = "0123456789abcdef0123456789abcdef";

    @LocalServerPort
    int port;

    @Autowired
    TestRestTemplate restTemplate;

    @MockBean
    ElasticsearchTemplate elasticsearchTemplate;

    @Test
    void encodedApiPathIsRejectedByRunningServerBeforeRulesControllerCanReturnDrafts() {
        ResponseEntity<String> response = restTemplate.getForEntity(URI.create(url("/%61pi/rules")), String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(response.getBody()).contains("no_token");
    }

    @Test
    void configuredCorsOriginCanReachCookieAuthenticatedUnsafeRoute() {
        HttpHeaders headers = new HttpHeaders();
        headers.add(HttpHeaders.ORIGIN, "http://localhost:3101");
        headers.add(HttpHeaders.COOKIE, "WAF_AT=" + validToken());

        ResponseEntity<String> response = restTemplate.exchange(
                url("/api/rules/deploy"),
                HttpMethod.POST,
                new HttpEntity<>(null, headers),
                String.class
        );

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_IMPLEMENTED);
        assertThat(response.getHeaders().getFirst(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN))
                .isEqualTo("http://localhost:3101");
        assertThat(response.getBody()).contains("Rule deployment is unavailable");
    }

    private String validToken() {
        return new SharedJwtService(SECRET, 900)
                .issue(OAuthUser.builder().sub("sub-1").email("a@example.com").build());
    }

    private String url(String path) {
        return "http://localhost:" + port + path;
    }
}
