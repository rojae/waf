package kr.rojae.waf.dashboard.dto;

import java.util.List;

public record RuleValidationResponse(boolean valid, List<String> errors) {
}
