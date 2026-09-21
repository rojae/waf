package kr.rojae.waf.dashboard.infrastructure.elasticsearch;

import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.elasticsearch.client.elc.ElasticsearchTemplate;
import org.springframework.data.elasticsearch.core.SearchHits;
import org.springframework.data.elasticsearch.core.query.CriteriaQuery;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ElasticsearchWafLogRepositoryTest {
    @Test
    void filtersUseFlatKeywordFieldsFromLogstashTemplate() {
        ElasticsearchTemplate template = mock(ElasticsearchTemplate.class);
        SearchHits<WafLogDocument> hits = mock(SearchHits.class);
        when(hits.getSearchHits()).thenReturn(java.util.List.of());
        when(hits.getTotalHits()).thenReturn(0L);
        when(template.search(org.mockito.ArgumentMatchers.any(CriteriaQuery.class), eq(WafLogDocument.class)))
                .thenReturn(hits);

        new ElasticsearchWafLogRepository(template)
                .findWafLogs(PageRequest.of(0, 20), "high", "sqli", "192.0.2.10");

        org.mockito.ArgumentCaptor<CriteriaQuery> captor = org.mockito.ArgumentCaptor.forClass(CriteriaQuery.class);
        org.mockito.Mockito.verify(template).search(captor.capture(), eq(WafLogDocument.class));
        java.util.List<String> fields = captor.getValue().getCriteria().getCriteriaChain().stream()
                .map(criteria -> criteria.getField().getName())
                .toList();

        assertThat(fields).contains("severity", "attack_type", "client_ip");
        assertThat(fields).doesNotContain("severity.keyword", "attack_type.keyword", "client_ip.keyword");
    }
}
