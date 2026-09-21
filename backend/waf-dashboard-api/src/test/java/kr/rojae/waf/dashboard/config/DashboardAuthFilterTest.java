package kr.rojae.waf.dashboard.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.ServletException;
import kr.rojae.waf.common.security.SharedJwtService;
import kr.rojae.waf.social.dto.OAuthUser;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.io.IOException;

import static org.assertj.core.api.Assertions.assertThat;

class DashboardAuthFilterTest {
    private static final String SECRET = "0123456789abcdef0123456789abcdef";

    @Test
    void rejectsMissingTokenForApiAndMatrixApiPaths() throws ServletException, IOException {
        DashboardAuthFilter filter = filter();
        MockHttpServletResponse regular = run(filter, request("GET", "/api/dashboard/metrics"));
        MockHttpServletResponse matrix = run(filter, request("GET", "/api;v=1/dashboard/metrics"));

        assertThat(regular.getStatus()).isEqualTo(401);
        assertThat(matrix.getStatus()).isEqualTo(401);
    }

    @Test
    void rejectsCookieBackedUnsafeMutationWithoutAllowedOrigin() throws ServletException, IOException {
        DashboardAuthFilter filter = filter();
        MockHttpServletRequest request = request("POST", "/api/rules");
        request.setCookies(new jakarta.servlet.http.Cookie("WAF_AT", validToken()));

        MockHttpServletResponse response = run(filter, request);

        assertThat(response.getStatus()).isEqualTo(403);
    }

    @Test
    void acceptsValidCookieAndAllowedOriginForUnsafeMutation() throws ServletException, IOException {
        DashboardAuthFilter filter = filter();
        MockHttpServletRequest request = request("POST", "/api/rules");
        request.addHeader("Origin", "http://localhost:3001");
        request.setCookies(new jakarta.servlet.http.Cookie("WAF_AT", validToken()));

        MockHttpServletResponse response = run(filter, request);

        assertThat(response.getStatus()).isEqualTo(200);
    }

    private DashboardAuthFilter filter() {
        return new DashboardAuthFilter(SECRET, 900, "WAF_AT", new String[]{"http://localhost:3001"}, new ObjectMapper());
    }

    private String validToken() {
        return new SharedJwtService(SECRET, 900)
                .issue(OAuthUser.builder().sub("sub-1").email("a@example.com").build());
    }

    private MockHttpServletRequest request(String method, String uri) {
        return new MockHttpServletRequest(method, uri);
    }

    private MockHttpServletResponse run(DashboardAuthFilter filter, MockHttpServletRequest request)
            throws ServletException, IOException {
        MockHttpServletResponse response = new MockHttpServletResponse();
        filter.doFilter(request, response, new MockFilterChain());
        return response;
    }
}
