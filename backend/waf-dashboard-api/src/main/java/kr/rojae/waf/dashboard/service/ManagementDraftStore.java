package kr.rojae.waf.dashboard.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import kr.rojae.waf.dashboard.dto.RuleDraftDto;
import kr.rojae.waf.dashboard.dto.RuleValidationResponse;
import kr.rojae.waf.dashboard.dto.WhitelistDraftDto;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Pattern;

@Service
public class ManagementDraftStore {
    private static final int TEXT_LIMIT = 2_000;
    private static final Pattern IPV4_CIDR = Pattern.compile("^(\\d{1,3})(?:\\.(\\d{1,3})){3}(?:/(\\d|[12]\\d|3[0-2]))?$");

    private final ObjectMapper objectMapper;
    private final Path storePath;
    private final Clock clock;

    // Single writer: every mutating API synchronizes on this service, writes a full temp JSON file,
    // atomically replaces the store, then swaps in-memory state only after persistence succeeds.
    private StoreState state = StoreState.empty();

    @Autowired
    public ManagementDraftStore(ObjectMapper objectMapper,
                                @Value("${app.management.store:./data/management.json}") String storePath) {
        this(objectMapper, Path.of(storePath), Clock.systemUTC());
    }

    ManagementDraftStore(ObjectMapper objectMapper, Path storePath, Clock clock) {
        this.objectMapper = objectMapper.findAndRegisterModules();
        this.storePath = storePath;
        this.clock = clock;
    }

    @PostConstruct
    synchronized void load() {
        if (!Files.exists(storePath)) {
            state = StoreState.empty();
            return;
        }
        try {
            state = objectMapper.readValue(storePath.toFile(), StoreState.class).normalized();
        } catch (Exception e) {
            throw new IllegalStateException("Management draft store is corrupt: " + storePath, e);
        }
    }

    public synchronized List<RuleDraftDto> rules() {
        return state.rules.values().stream()
                .sorted(Comparator.comparing(RuleDraftDto::priority, Comparator.nullsLast(Integer::compareTo))
                        .thenComparing(RuleDraftDto::id))
                .toList();
    }

    public synchronized Optional<RuleDraftDto> rule(long id) {
        return Optional.ofNullable(state.rules.get(id));
    }

    public synchronized RuleValidationResponse validateRule(RuleDraftDto request) {
        List<String> errors = validateRuleFields(request);
        return new RuleValidationResponse(errors.isEmpty(), errors);
    }

    public synchronized RuleDraftDto createRule(RuleDraftDto request) {
        List<String> errors = validateRuleFields(request);
        if (!errors.isEmpty()) {
            throw new ValidationFailure(errors);
        }
        Instant now = clock.instant();
        long id = state.nextRuleId;
        RuleDraftDto saved = normalizeRule(request, id, now, now);
        StoreState next = state.copy();
        next.rules.put(id, saved);
        next.nextRuleId = id + 1;
        persistThenSwap(next);
        return saved;
    }

    public synchronized RuleDraftDto updateRule(long id, RuleDraftDto request) {
        RuleDraftDto existing = requireRule(id);
        List<String> errors = validateRuleFields(request);
        if (!errors.isEmpty()) {
            throw new ValidationFailure(errors);
        }
        RuleDraftDto saved = normalizeRule(request, id, existing.createdAt(), clock.instant());
        StoreState next = state.copy();
        next.rules.put(id, saved);
        persistThenSwap(next);
        return saved;
    }

    public synchronized void deleteRule(long id) {
        requireRule(id);
        StoreState next = state.copy();
        next.rules.remove(id);
        persistThenSwap(next);
    }

    public synchronized RuleDraftDto toggleRule(long id, boolean enabled) {
        RuleDraftDto existing = requireRule(id);
        RuleDraftDto saved = new RuleDraftDto(existing.id(), existing.name(), existing.description(), enabled,
                existing.severity(), existing.category(), existing.variables(), existing.operator(),
                existing.operatorData(), existing.actions(), existing.priority(), existing.createdAt(), clock.instant());
        StoreState next = state.copy();
        next.rules.put(id, saved);
        persistThenSwap(next);
        return saved;
    }

    public synchronized List<WhitelistDraftDto> whitelist() {
        return state.whitelist.values().stream()
                .sorted(Comparator.comparing(WhitelistDraftDto::createdAt))
                .toList();
    }

    public synchronized Optional<WhitelistDraftDto> whitelist(String id) {
        return Optional.ofNullable(state.whitelist.get(id));
    }

    public synchronized WhitelistDraftDto createWhitelist(WhitelistDraftDto request) {
        List<String> errors = validateWhitelistFields(request);
        if (!errors.isEmpty()) {
            throw new ValidationFailure(errors);
        }
        Instant now = clock.instant();
        String id = UUID.randomUUID().toString();
        WhitelistDraftDto saved = normalizeWhitelist(request, id, now, now);
        StoreState next = state.copy();
        next.whitelist.put(id, saved);
        persistThenSwap(next);
        return saved;
    }

    public synchronized WhitelistDraftDto updateWhitelist(String id, WhitelistDraftDto request) {
        WhitelistDraftDto existing = requireWhitelist(id);
        List<String> errors = validateWhitelistFields(request);
        if (!errors.isEmpty()) {
            throw new ValidationFailure(errors);
        }
        WhitelistDraftDto saved = normalizeWhitelist(request, id, existing.createdAt(), clock.instant());
        StoreState next = state.copy();
        next.whitelist.put(id, saved);
        persistThenSwap(next);
        return saved;
    }

    public synchronized void deleteWhitelist(String id) {
        requireWhitelist(id);
        StoreState next = state.copy();
        next.whitelist.remove(id);
        persistThenSwap(next);
    }

    public synchronized WhitelistDraftDto toggleWhitelist(String id, boolean enabled) {
        WhitelistDraftDto existing = requireWhitelist(id);
        WhitelistDraftDto saved = new WhitelistDraftDto(id, existing.ip(), existing.description(), enabled,
                existing.createdAt(), clock.instant());
        StoreState next = state.copy();
        next.whitelist.put(id, saved);
        persistThenSwap(next);
        return saved;
    }

    private RuleDraftDto requireRule(long id) {
        RuleDraftDto existing = state.rules.get(id);
        if (existing == null) {
            throw new NotFound("rule_not_found");
        }
        return existing;
    }

    private WhitelistDraftDto requireWhitelist(String id) {
        WhitelistDraftDto existing = state.whitelist.get(id);
        if (existing == null) {
            throw new NotFound("whitelist_not_found");
        }
        return existing;
    }

    private void persistThenSwap(StoreState next) {
        try {
            Path parent = storePath.toAbsolutePath().getParent();
            if (parent != null) {
                Files.createDirectories(parent);
            }
            Path temp = Files.createTempFile(parent, storePath.getFileName().toString(), ".tmp");
            objectMapper.writerWithDefaultPrettyPrinter().writeValue(temp.toFile(), next);
            try {
                Files.move(temp, storePath, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
            } catch (IOException atomicUnsupported) {
                Files.move(temp, storePath, StandardCopyOption.REPLACE_EXISTING);
            }
            state = next;
        } catch (IOException e) {
            throw new IllegalStateException("Failed to persist management draft store", e);
        }
    }

    private RuleDraftDto normalizeRule(RuleDraftDto request, long id, Instant createdAt, Instant updatedAt) {
        return new RuleDraftDto(
                id,
                trim(request.name()),
                trimToEmpty(request.description()),
                request.enabled() == null ? Boolean.TRUE : request.enabled(),
                request.severity(),
                trim(request.category()),
                trimToEmpty(request.variables()),
                trimToEmpty(request.operator()),
                trimToEmpty(request.operatorData()),
                trimToEmpty(request.actions()),
                request.priority() == null ? 100 : request.priority(),
                createdAt,
                updatedAt
        );
    }

    private WhitelistDraftDto normalizeWhitelist(WhitelistDraftDto request, String id, Instant createdAt, Instant updatedAt) {
        return new WhitelistDraftDto(
                id,
                trim(request.ip()),
                trimToEmpty(request.description()),
                request.enabled() == null ? Boolean.TRUE : request.enabled(),
                createdAt,
                updatedAt
        );
    }

    private List<String> validateRuleFields(RuleDraftDto request) {
        List<String> errors = new ArrayList<>();
        if (blank(request.name())) errors.add("name is required");
        if (request.name() != null && request.name().length() > 255) errors.add("name is too long");
        if (request.severity() == null) errors.add("severity is required");
        if (blank(request.category())) errors.add("category is required");
        if (request.priority() != null && (request.priority() < 0 || request.priority() > 100_000)) errors.add("priority is out of range");
        rejectUnsafeText(errors, "variables", request.variables());
        rejectUnsafeText(errors, "operator", request.operator());
        rejectUnsafeText(errors, "operatorData", request.operatorData());
        rejectUnsafeText(errors, "actions", request.actions());
        rejectUnsafeText(errors, "description", request.description());
        return errors;
    }

    private List<String> validateWhitelistFields(WhitelistDraftDto request) {
        List<String> errors = new ArrayList<>();
        if (blank(request.ip())) {
            errors.add("ip is required");
        } else if (!validIpv4Cidr(request.ip())) {
            errors.add("ip must be a literal IPv4 address or CIDR");
        }
        rejectUnsafeText(errors, "description", request.description());
        return errors;
    }

    private void rejectUnsafeText(List<String> errors, String field, String value) {
        if (value == null) return;
        String lower = value.toLowerCase();
        if (value.length() > TEXT_LIMIT) errors.add(field + " is too long");
        if (lower.contains("include") || lower.contains("../") || lower.contains("..\\") || lower.startsWith("/") || lower.contains("\u0000")) {
            errors.add(field + " contains unsafe content");
        }
    }

    private boolean validIpv4Cidr(String value) {
        var matcher = IPV4_CIDR.matcher(value);
        if (!matcher.matches()) {
            return false;
        }
        String address = value.contains("/") ? value.substring(0, value.indexOf('/')) : value;
        for (String octet : address.split("\\.")) {
            int parsed = Integer.parseInt(octet);
            if (parsed < 0 || parsed > 255) {
                return false;
            }
        }
        return true;
    }

    private boolean blank(String value) {
        return value == null || value.isBlank();
    }

    private String trim(String value) {
        return value == null ? null : value.trim();
    }

    private String trimToEmpty(String value) {
        return value == null ? "" : value.trim();
    }

    static class StoreState {
        public long nextRuleId = 1;
        public Map<Long, RuleDraftDto> rules = new LinkedHashMap<>();
        public Map<String, WhitelistDraftDto> whitelist = new LinkedHashMap<>();

        static StoreState empty() {
            return new StoreState();
        }

        StoreState normalized() {
            if (rules == null) rules = new LinkedHashMap<>();
            if (whitelist == null) whitelist = new LinkedHashMap<>();
            long maxId = rules.keySet().stream().mapToLong(Long::longValue).max().orElse(0);
            nextRuleId = Math.max(nextRuleId, maxId + 1);
            return this;
        }

        StoreState copy() {
            StoreState copy = new StoreState();
            copy.nextRuleId = nextRuleId;
            copy.rules = new LinkedHashMap<>(rules);
            copy.whitelist = new LinkedHashMap<>(whitelist);
            return copy;
        }
    }

    public static class ValidationFailure extends RuntimeException {
        private final List<String> errors;

        public ValidationFailure(List<String> errors) {
            super("validation_failed");
            this.errors = errors;
        }

        public List<String> errors() {
            return errors;
        }
    }

    public static class NotFound extends RuntimeException {
        public NotFound(String message) {
            super(message);
        }
    }
}
