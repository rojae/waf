package kr.rojae.waf.dashboard.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import kr.rojae.waf.dashboard.dto.RuleDraftDto;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ManagementDraftStoreTest {
    @TempDir
    Path tempDir;

    @Test
    void persistsRuleAndReloadsFromJson() {
        Path storePath = tempDir.resolve("management.json");
        ManagementDraftStore store = store(storePath);
        RuleDraftDto created = store.createRule(validRule());

        ManagementDraftStore reloaded = store(storePath);
        reloaded.load();

        assertThat(reloaded.rule(created.id())).contains(created);
    }

    @Test
    void corruptStoreFailsClosedOnStartup() throws Exception {
        Path storePath = tempDir.resolve("management.json");
        Files.writeString(storePath, "{not-json");
        ManagementDraftStore store = store(storePath);

        assertThatThrownBy(store::load).isInstanceOf(IllegalStateException.class);
    }

    @Test
    void persistenceFailureDoesNotMutateMemory() throws Exception {
        Path fileParent = tempDir.resolve("file-parent");
        Files.writeString(fileParent, "not-a-directory");
        ManagementDraftStore store = store(fileParent.resolve("management.json"));

        assertThatThrownBy(() -> store.createRule(validRule()))
                .isInstanceOf(IllegalStateException.class);
        assertThat(store.rules()).isEmpty();
    }

    @Test
    void rejectsDnsWhitelistValues() {
        ManagementDraftStore store = store(tempDir.resolve("management.json"));

        assertThatThrownBy(() -> store.createWhitelist(new kr.rojae.waf.dashboard.dto.WhitelistDraftDto(
                null, "example.com", "dns", true, null, null)))
                .isInstanceOf(ManagementDraftStore.ValidationFailure.class);
    }

    private ManagementDraftStore store(Path path) {
        return new ManagementDraftStore(new ObjectMapper(), path,
                Clock.fixed(Instant.parse("2026-09-22T00:00:00Z"), ZoneOffset.UTC));
    }

    private RuleDraftDto validRule() {
        return new RuleDraftDto(null, "Block SQLi", "desc", true, RuleDraftDto.Severity.HIGH,
                "attack", "ARGS", "@rx", "select", "deny", 10, null, null);
    }
}
