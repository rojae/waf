package kr.rojae.waf.dashboard.service;

import com.influxdb.client.InfluxDBClient;
import com.influxdb.client.QueryApi;
import com.influxdb.query.FluxRecord;
import com.influxdb.query.FluxTable;
import kr.rojae.waf.dashboard.infrastructure.influxdb.InfluxDBMetricsRepository;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

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

    @Test
    void metricsEmptyResultsRemainHonestZeroMetrics() {
        InfluxDBMetricsRepository repository = repositoryReturning(List.of(), List.of(), List.of(), List.of(), List.of(), List.of());

        var metrics = repository.getMetrics();

        assertThat(metrics.totalRequests()).isZero();
        assertThat(metrics.attackTypeStats()).isEmpty();
        assertThat(metrics.hourlyStats()).isEmpty();
    }

    @Test
    void metricsMalformedCountResultIsUnavailableInsteadOfZero() {
        InfluxDBMetricsRepository repository = repositoryReturning(
                table(record("not-a-number", null, null)),
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                List.of()
        );

        assertThatThrownBy(repository::getMetrics)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("metrics_sink_unavailable")
                .hasRootCauseMessage("metrics_result_malformed: non-numeric value in count result");
    }

    @Test
    void metricsMalformedGroupedResultIsUnavailableInsteadOfEmptyMap() {
        InfluxDBMetricsRepository repository = repositoryReturning(
                List.of(),
                List.of(),
                table(record(1, null, null)),
                List.of(),
                List.of(),
                List.of()
        );

        assertThatThrownBy(repository::getMetrics)
                .isInstanceOf(IllegalStateException.class)
                .hasRootCauseMessage("metrics_result_malformed: missing attack_type in grouped result");
    }

    @Test
    void metricsMalformedHourlyResultIsUnavailableInsteadOfEmptyMap() {
        InfluxDBMetricsRepository repository = repositoryReturning(
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                table(record(1, "ignored", null))
        );

        assertThatThrownBy(repository::getMetrics)
                .isInstanceOf(IllegalStateException.class)
                .hasRootCauseMessage("metrics_result_malformed: missing _time in hourly result");
    }

    @SafeVarargs
    private InfluxDBMetricsRepository repositoryReturning(List<FluxTable>... results) {
        InfluxDBClient client = mock(InfluxDBClient.class);
        QueryApi queryApi = mock(QueryApi.class);
        when(client.getQueryApi()).thenReturn(queryApi);
        when(queryApi.query(anyString(), eq("org"))).thenReturn(
                results[0],
                results[1],
                results[2],
                results[3],
                results[4],
                results[5]
        );
        return new InfluxDBMetricsRepository(client, "org", "bucket");
    }

    private List<FluxTable> table(FluxRecord record) {
        FluxTable table = mock(FluxTable.class);
        when(table.getRecords()).thenReturn(List.of(record));
        return List.of(table);
    }

    private FluxRecord record(Object value, String groupValue, Instant time) {
        FluxRecord record = mock(FluxRecord.class);
        when(record.getValue()).thenReturn(value);
        when(record.getValueByKey("attack_type")).thenReturn(groupValue);
        when(record.getTime()).thenReturn(time);
        return record;
    }
}
