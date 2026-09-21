package kr.rojae.waf.dashboard.web;

import kr.rojae.waf.dashboard.service.AlertService;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.Mockito.mock;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.setup.MockMvcBuilders.standaloneSetup;

class AlertControllerTest {
    @Test
    void streamEndpointReportsUnavailableInsteadOfOpeningDeadSseConnection() throws Exception {
        MockMvc mvc = standaloneSetup(new AlertController(mock(AlertService.class))).build();

        mvc.perform(get("/api/alerts/stream"))
                .andExpect(status().isNotImplemented())
                .andExpect(jsonPath("$.error").value("alert_stream_unavailable"));
    }
}
