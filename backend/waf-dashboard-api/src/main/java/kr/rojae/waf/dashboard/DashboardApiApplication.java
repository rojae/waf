package kr.rojae.waf.dashboard;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.security.servlet.SecurityAutoConfiguration;

@SpringBootApplication(
    scanBasePackages = {"kr.rojae.waf"},
    exclude = { SecurityAutoConfiguration.class }
)
public class DashboardApiApplication {
    public static void main(String[] args) {
        SpringApplication.run(DashboardApiApplication.class, args);
    }
}