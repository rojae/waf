package kr.rojae.waf.dashboard.web;

import kr.rojae.waf.dashboard.infrastructure.elasticsearch.ElasticsearchWafLogRepository;
import kr.rojae.waf.dashboard.infrastructure.influxdb.InfluxDBMetricsRepository;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.setup.MockMvcBuilders.standaloneSetup;

class DashboardControllerTest {
    @Test
    void metricsSinkFailureReturnsStructuredJsonError() throws Exception {
        InfluxDBMetricsRepository metricsRepository = mock(InfluxDBMetricsRepository.class);
        ElasticsearchWafLogRepository logRepository = mock(ElasticsearchWafLogRepository.class);
        when(metricsRepository.getMetrics()).thenThrow(new IllegalStateException("metrics_sink_unavailable"));

        MockMvc mvc = standaloneSetup(new DashboardController(metricsRepository, logRepository)).build();

        mvc.perform(get("/api/dashboard/metrics"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.error").value("metrics_sink_unavailable"));
    }

    @Test
    void logSinkFailureReturnsStructuredJsonError() throws Exception {
        InfluxDBMetricsRepository metricsRepository = mock(InfluxDBMetricsRepository.class);
        ElasticsearchWafLogRepository logRepository = mock(ElasticsearchWafLogRepository.class);
        when(logRepository.findWafLogs(any(), isNull(), isNull(), isNull()))
                .thenThrow(new IllegalStateException("log_sink_unavailable"));

        MockMvc mvc = standaloneSetup(new DashboardController(metricsRepository, logRepository)).build();

        mvc.perform(get("/api/dashboard/logs"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.error").value("log_sink_unavailable"));
    }
}
