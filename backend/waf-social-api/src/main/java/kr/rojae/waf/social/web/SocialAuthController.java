package kr.rojae.waf.social.web;

import kr.rojae.waf.social.application.AuthUseCase;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;

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

    @GetMapping("/{provider}/callback")
    public ResponseEntity<Void> callback(@PathVariable String provider,
                                         @RequestParam String code,
                                         @RequestParam String state) {
        log.info("GET : /{}/callback?code={}&state={}", provider, code, state);
        var r = authUseCase.handleCallback(provider, code, state);
        return ResponseEntity.status(302)
                .header(HttpHeaders.SET_COOKIE, r.cookie().toString())
                .header(HttpHeaders.LOCATION, r.redirect())
                .build();
    }
}