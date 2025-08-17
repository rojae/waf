package kr.rojae.waf.social.dto;

import lombok.*;

@Data
@ToString
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class OAuthUser {
    String sub;
    String email;
    String name;
    String picture;
}
