package kr.rojae.waf.social.web;

import kr.rojae.waf.social.application.AuthUseCase;
import kr.rojae.waf.social.dto.AuthCallbackResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;

import java.util.Map;

@Controller
@RequiredArgsConstructor
@RequestMapping("/auth")
@Slf4j
public class SocialAuthController {

    private final AuthUseCase authUseCase;

    @GetMapping("/{provider}/login")
    public String login(@PathVariable String provider, @RequestParam("redirect_uri") String redirectUri) {
        log.info("GET : /{}/login?redirectUri={}", provider, redirectUri);
        return "redirect:" + authUseCase.startLogin(provider, redirectUri);
    }

    @GetMapping("/debug/callback-base-url")
    @ResponseBody
    public String debugCallbackBaseUrl() {
        return "Current callback base URL: " + authUseCase.getCallbackBaseUrl();
    }

    @PostMapping("/{provider}/exchange")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> exchangeCode(
            @PathVariable String provider,
            @RequestBody Map<String, String> requestBody) {

        String code = requestBody.get("code");
        String redirectUri = requestBody.get("redirect_uri");

        if (code == null || redirectUri == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Missing required parameters"));
        }

        try {
            var result = authUseCase.exchangeCodeForToken(provider, code, redirectUri);
            return ResponseEntity.ok(Map.of(
                "success", true,
                "access_token", result.jwt()
            ));
        } catch (Exception e) {
            log.error("Token exchange failed", e);
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/{provider}/callback")
    @ResponseBody
    public ResponseEntity<AuthCallbackResponse> callback(@PathVariable String provider,
                                                        @RequestParam String code,
                                                        @RequestParam String state,
                                                        @RequestParam(required = false) String redirect_uri) {
        log.info("GET : /{}/callback?code={}&state={}&redirect_uri={}", provider, code, state, redirect_uri);
        var response = authUseCase.handleCallback(provider, code, state, redirect_uri);
        return ResponseEntity.ok(response);
    }
}