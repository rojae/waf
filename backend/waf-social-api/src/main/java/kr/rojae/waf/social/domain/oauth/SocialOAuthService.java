package kr.rojae.waf.social.domain.oauth;

import kr.rojae.waf.common.enums.SocialType;
import kr.rojae.waf.social.dto.OAuthUser;

import java.net.URI;

public interface SocialOAuthService {
    SocialType supports();

    URI buildAuthorizationUri(String redirectUri, String state);

    OAuthUser handleCallback(String code, String redirectUri, String state);
}
