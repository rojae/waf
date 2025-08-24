package kr.rojae.waf.dashboard.infrastructure.elasticsearch;

import kr.rojae.waf.dashboard.dto.WafLogDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.elasticsearch.client.elc.ElasticsearchTemplate;
import org.springframework.data.elasticsearch.core.SearchHits;
import org.springframework.data.elasticsearch.core.query.Criteria;
import org.springframework.data.elasticsearch.core.query.CriteriaQuery;
import org.springframework.data.elasticsearch.core.query.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.stream.Collectors;

@Repository
@RequiredArgsConstructor
@Slf4j
public class ElasticsearchWafLogRepository {

    private final ElasticsearchTemplate elasticsearchTemplate;

    public Page<WafLogDto> findWafLogs(Pageable pageable, String severity, String attackType, String clientIp) {
        try {
            Criteria criteria = new Criteria();
            
            // Add filters
            if (severity != null && !severity.isEmpty()) {
                criteria = criteria.and("severity.keyword").is(severity);
            }
            
            if (attackType != null && !attackType.isEmpty()) {
                criteria = criteria.and("attack_type.keyword").is(attackType);
            }
            
            if (clientIp != null && !clientIp.isEmpty()) {
                criteria = criteria.and("client_ip.keyword").is(clientIp);
            }

            Query query = new CriteriaQuery(criteria).setPageable(pageable);

            SearchHits<WafLogDocument> searchHits = elasticsearchTemplate.search(query, WafLogDocument.class);
            
            List<WafLogDto> logs = searchHits.getSearchHits().stream()
                    .map(hit -> convertToDto(hit.getContent()))
                    .collect(Collectors.toList());
            
            return new PageImpl<>(logs, pageable, searchHits.getTotalHits());
        } catch (Exception e) {
            log.error("Error searching WAF logs", e);
            return Page.empty(pageable);
        }
    }

    private WafLogDto convertToDto(WafLogDocument doc) {
        return WafLogDto.builder()
                .id(doc.getId())
                .timestamp(doc.getTimestamp())
                .clientIp(doc.getClientIp())
                .method(doc.getMethod())
                .uri(doc.getUri())
                .statusCode(doc.getStatusCode())
                .attackType(doc.getAttackType())
                .severity(doc.getSeverity())
                .country(doc.getCountry())
                .message(doc.getMessage())
                .blocked(doc.getBlocked() != null ? doc.getBlocked() : false)
                .userAgent(doc.getUserAgent())
                .responseTime(doc.getResponseTime())
                .build();
    }

    public long getTotalLogCount() {
        try {
            Query query = Query.findAll();
            return elasticsearchTemplate.count(query, WafLogDocument.class);
        } catch (Exception e) {
            log.error("Error counting total logs", e);
            return 0L;
        }
    }
    
    public Page<WafLogDto> getRecentLogs(Pageable pageable) {
        try {
            LocalDateTime since = LocalDateTime.now().minusHours(24);
            Criteria criteria = new Criteria("timestamp").greaterThanEqual(since.toEpochSecond(ZoneOffset.UTC));
            Query query = new CriteriaQuery(criteria).setPageable(pageable);
            
            SearchHits<WafLogDocument> searchHits = elasticsearchTemplate.search(query, WafLogDocument.class);
            
            List<WafLogDto> logs = searchHits.getSearchHits().stream()
                    .map(hit -> convertToDto(hit.getContent()))
                    .collect(Collectors.toList());
            
            return new PageImpl<>(logs, pageable, searchHits.getTotalHits());
        } catch (Exception e) {
            log.error("Error fetching recent logs", e);
            return Page.empty(pageable);
        }
    }
}