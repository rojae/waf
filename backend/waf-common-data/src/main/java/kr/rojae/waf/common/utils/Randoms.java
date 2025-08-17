package kr.rojae.waf.common.utils;

import java.security.SecureRandom;
import java.util.Base64;

public final class Randoms {
  private static final SecureRandom RND = new SecureRandom();
  public static String urlSafeState() {
    byte[] b = new byte[24];
    RND.nextBytes(b);
    return Base64.getUrlEncoder().withoutPadding().encodeToString(b);
  }
}
