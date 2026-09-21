package kr.rojae.waf.dashboard.service;

import kr.rojae.waf.dashboard.infrastructure.influxdb.InfluxDBMetricsRepository;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class TelemetryQueryTest {
    @Test
    void alertQueryUsesCountFieldAndDoesNotSortByDroppedTime() {
        String query = new AlertService(null, "org", "bucket").recentAlertsQuery();

        assertThat(query).contains("r[\"_field\"] == \"count\"");
        assertThat(query).contains("group(columns: [\"client_ip\", \"attack_type\", \"severity\"])");
        assertThat(query).contains("sort(columns: [\"_value\"]");
        assertThat(query).doesNotContain("sort(columns: [\"_time\"]");
    }

    @Test
    void metricsGroupedQueriesFilterCountBeforeAggregation() {
        InfluxDBMetricsRepository repository = new InfluxDBMetricsRepository(null, "org", "bucket");

        assertThat(repository.severityQuery()).contains("r._field == \"count\"");
        assertThat(repository.severityQuery()).contains("group(columns: [\"severity\"]");
        assertThat(repository.severityQuery()).doesNotContain("count()");
        assertThat(repository.hourlyQuery()).contains("aggregateWindow(every: 1h, fn: sum");
    }
}
