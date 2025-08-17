# 🛡️ WAF - Nginx Application Firewall with ModSecurity & OWASP CRS

[![Docker](https://img.shields.io/badge/docker-ready-blue?logo=docker)](https://www.docker.com/) [![Nginx](https://img.shields.io/badge/Nginx-1.22-green?logo=nginx)](https://nginx.org/) [![OWASP CRS](https://img.shields.io/badge/OWASP%20CRS-v4.0-orange)](https://coreruleset.org/) [![License](https://img.shields.io/badge/license-MIT-lightgrey)](LICENSE) [![YouTube Demo](https://img.shields.io/badge/YouTube-Demo-red?logo=youtube)](https://youtu.be/f_OKEZ0H4FQ)

> **Nginx + ModSecurity WAF** powered by **OWASP ModSecurity Core Rule Set (CRS)** 🚀  
> Test and experiment with a Web Application Firewall locally using Docker.

---

## 📺 Preview
[![youtube link](https://i9.ytimg.com/vi_webp/f_OKEZ0H4FQ/mq2.webp?sqp=CMCT4sQG-oaymwEmCMACELQB8quKqQMa8AEB-AH-CIAC0AWKAgwIABABGGcgZyhnMA8=&rs=AOn4CLAlm_0NgKKLtHNhWkIh6qA8LHUQMQ)](https://youtu.be/f_OKEZ0H4FQ)


## Flow Diagram
- Nginx → (modsec-logs volume) → Filebeat → Kafka → Logstash → Elasticsearch ← Kibana

```mermaid
flowchart TD
    %% ===== Styles (밝은 톤) =====
    classDef svc fill:#e8f1fd,stroke:#4a90e2,color:#0d1a26,stroke-width:1.2,rx:10,ry:10
    classDef db  fill:#e6f7f1,stroke:#28a745,color:#0d1a26,rx:10,ry:10
    classDef vol fill:#fff7e6,stroke:#ffa940,color:#663300,stroke-dasharray:3 3,rx:8,ry:8
    classDef ext fill:#f5f5f5,stroke:#999,color:#333,stroke-dasharray:4 4,rx:8,ry:8

    %% ===== External =====
    Client[Browser / Client]:::ext
    ExtApps[External Apps]:::ext

    %% ===== Nginx & Volume =====
    subgraph Nginx[WAF - Nginx + ModSecurity]
        N1[nginx - waf-nginx]:::svc
        V1[(modsec-logs volume)]:::vol
        N1 -->|write ModSecurity logs| V1
    end

    %% ===== Filebeat =====
    subgraph Filebeat[Filebeat]
        F1[filebeat - waf-filebeat]:::svc
        V1 -. read-only mount .- F1
        F1 -->|produce logs| K1
    end

    %% ===== Logstash =====
    subgraph Logstash[Logstash]
        L1[logstash - waf-logstash]:::svc
        K1 -->|consume| L1
        L1 -->|index| E1
    end

    subgraph Kibana[Kibana]
        B1[kibana - waf-kibana]:::svc
        B1 -->|visualize and search| E1
    end

    %% ===== External Connections =====
    Client -. HTTP 8080 .-> N1
    Client -. HTTP 5601 .-> B1
    ExtApps -. PLAINTEXT 9092 .-> K1

```

## Expaned Final Flow

```mermaid
flowchart TD
    %% ===== Styles (밝은 톤) =====
    classDef svc fill:#e8f1fd,stroke:#4a90e2,color:#0d1a26,stroke-width:1.2,rx:10,ry:10
    classDef db  fill:#e6f7f1,stroke:#28a745,color:#0d1a26,rx:10,ry:10
    classDef vol fill:#fff7e6,stroke:#ffa940,color:#663300,stroke-dasharray:3 3,rx:8,ry:8
    classDef ext fill:#f5f5f5,stroke:#999,color:#333,stroke-dasharray:4 4,rx:8,ry:8
    classDef topic fill:#f0f5ff,stroke:#5b8ff9,color:#0d1a26,rx:10,ry:10

    %% ===== External traffic =====
    Client[End users]:::ext

    %% ===== Scalable ingest pool =====
    subgraph IngestPool[WAF ingest pool scale out]
      direction LR

      subgraph UnitA[Ingest unit A]
        NA[nginx waf a]:::svc
        VA[(modsec logs a)]:::vol
        FA[filebeat a]:::svc
        NA --> VA
        VA -. ro mount .- FA
      end

      subgraph UnitB[Ingest unit B]
        NB[nginx waf b]:::svc
        VB[(modsec logs b)]:::vol
        FB[filebeat b]:::svc
        NB --> VB
        VB -. ro mount .- FB
      end

      subgraph UnitC[Ingest unit C]
        NC[nginx waf c]:::svc
        VC[(modsec logs c)]:::vol
        FC[filebeat c]:::svc
        NC --> VC
        VC -. ro mount .- FC
      end
    end

    %% ===== Kafka core =====
    subgraph Kafka[Kafka cluster]
      K1[kafka broker]:::svc
      T1[[topic modsec logs]]:::topic
      K1 --- T1
    end

    %% ===== Logstash to Elasticsearch to Kibana =====
    subgraph Pipeline[Observability pipeline]
      L1[logstash]:::svc
      E1[elasticsearch]:::db
      B1[kibana]:::svc
      L1 -->|index| E1
      B1 -->|visualize search| E1
    end

    %% ===== Other consumers =====
    subgraph Others[Other systems consuming from kafka]
      O1[siem or dq jobs]:::ext
      O2[stream processors]:::ext
      O3[data lake ingestors]:::ext
    end

    %% ===== Flows =====
    Client -. http traffic .-> NA
    Client -. http traffic .-> NB
    Client -. http traffic .-> NC

    FA -->|produce| K1
    FB -->|produce| K1
    FC -->|produce| K1

    K1 -->|consume| L1
    K1 --> O1
    K1 --> O2
    K1 --> O3
```

---

## Deploy Flow
```mermaid
flowchart TD
  subgraph FE[Admin Web UI]
    UI[React Admin]
  end

  subgraph BE[Backend API]
    RULE[Rule Manager API]
    BUNDLE[Bundle Builder]
  end

  subgraph WAFCluster[WAF Cluster]
    AG[Agent fetch and apply]
    WA[nginx modsecurity]
  end

  subgraph DATA[Observability]
    ES[Elasticsearch]
    KB[Kibana]
  end

  UI -->|CRUD rule| RULE
  RULE -->|build bundle| BUNDLE
  BUNDLE -->|publish gitops or other api| AG
  AG -->|download and verify| BUNDLE
  AG -->|write rules conf| WA
  AG -->|nginx test and reload| WA

  WA -->|modsec logs| ES
  ES --> KB
  UI -->|view dashboards| KB
```

---

## ⚙️ Components
- **Nginx + ModSecurity**: WebServer with ModSecurity engine
- **OWASP CRS**: Attack detection ruleset ([coreruleset/coreruleset](https://github.com/coreruleset/coreruleset))
- **Docker Compose**: Local setup with a custom Dockerfile based on `owasp/modsecurity:nginx-alpine`

---

## 📂 Directory Structure
```
├── startup.sh
├── Dockerfile
├── docker-compose.yml
├── nginx
│   ├── nginx.conf
│   ├── init.sh
│   ├── html/
│   │   ├── 403.html
│   │   └── 404.html
│   └── modsecurity/
│       ├── modsecurity.conf
│       ├── crs-setup.conf
│       ├── include.conf
│       └── rules/
```

---

## 🚀 How to Run

```bash
docker-compose build --no-cache
docker-compose up
```

---

## 🧪 How to Test
**Request**
```bash
curl -i "http://localhost:8080/?q=<script>alert(1)</script>"
```
**Response**
```http
HTTP/1.1 403 Forbidden
Server: nginx/1.22.1
...
<h1>403 Forbidden</h1>
<p>Access has been blocked. (ModSecurity)</p>
```

---

## 📜 Log Check

```bash
docker logs waf-nginx
docker exec -it waf-nginx cat /var/log/modsecurity/modsec_audit.log
```

---

## 🛠️ Key Configs

**`modsecurity.conf`**

```conf
SecRuleEngine On
SecRequestBodyAccess On
SecResponseBodyAccess Off
SecAuditEngine RelevantOnly
SecAuditLogParts ABIJDEFHZ
SecAuditLog /var/log/modsecurity/modsec_audit.log
Include /etc/modsecurity.d/crs-setup.conf
Include /etc/modsecurity.d/rules/*.conf
```

**`nginx.conf`**

```conf
modsecurity on;
modsecurity_rules_file /etc/modsecurity/modsecurity.conf;
```

**`403 page`**

```nginx
error_page 403 /403.html;

location = /403.html {
    root /usr/share/nginx/html;
    internal;
}
```

---

## 🔍 Rule Examples

| Case         | Rule ID  | Rule File                              |
|--------------|----------|----------------------------------------|
| XSS          | 941100   | REQUEST-941-APPLICATION-ATTACK-XSS     |
| SQL Injection| 942100   | REQUEST-942-APPLICATION-ATTACK-SQLI    |
| LFI          | 930100   | REQUEST-930-APPLICATION-ATTACK-LFI     |

---

## 📚 Reference

- [OWASP CRS GitHub](https://github.com/coreruleset/coreruleset)
- [ModSecurity Reference Manual](https://github.com/SpiderLabs/ModSecurity/wiki)