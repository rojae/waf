package kr.rojae.waf.dashboard.infrastructure.elasticsearch;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.elasticsearch.annotations.Document;
import org.springframework.data.elasticsearch.annotations.Field;
import org.springframework.data.elasticsearch.annotations.FieldType;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(indexName = "waf-logs-*")
public class WafLogDocument {
    
    @Id
    private String id;
    
    @Field(type = FieldType.Date)
    private LocalDateTime timestamp;
    
    @Field(name = "client_ip", type = FieldType.Ip)
    private String clientIp;
    
    @Field(type = FieldType.Keyword)
    private String method;
    
    @Field(type = FieldType.Text)
    private String uri;
    
    @Field(name = "status_code", type = FieldType.Integer)
    private Integer statusCode;
    
    @Field(name = "attack_type", type = FieldType.Keyword)
    private String attackType;
    
    @Field(type = FieldType.Keyword)
    private String severity;
    
    @Field(type = FieldType.Keyword)
    private String country;
    
    @Field(type = FieldType.Text)
    private String message;
    
    @Field(type = FieldType.Boolean)
    private Boolean blocked;
    
    @Field(name = "user_agent", type = FieldType.Text)
    private String userAgent;
    
    @Field(name = "response_time", type = FieldType.Long)
    private Long responseTime;
}