package kr.rojae.waf.dashboard.config;

import com.influxdb.client.InfluxDBClient;
import com.influxdb.client.InfluxDBClientFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class InfluxDbConfig {

    @Value("${app.influxdb.url}")
    private String influxdbUrl;

    @Value("${app.influxdb.token}")
    private String influxdbToken;

    @Bean
    public InfluxDBClient influxDBClient() {
        return InfluxDBClientFactory.create(influxdbUrl, influxdbToken.toCharArray());
    }
}