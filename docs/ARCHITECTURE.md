# 🏗️ Enterprise WAF Platform Architecture

## Table of Contents
- [System Overview](#system-overview)
- [Dual-Track Architecture](#dual-track-architecture)
- [Component Architecture](#component-architecture)
- [Data Flow Diagrams](#data-flow-diagrams)
- [Security Architecture](#security-architecture)
- [Scalability & Performance](#scalability--performance)
- [Deployment Architecture](#deployment-architecture)
- [Integration Points](#integration-points)

---

## System Overview

The Enterprise WAF Platform implements a sophisticated multi-tier architecture designed for high-performance security event processing, real-time threat detection, and comprehensive analytics.

### High-Level System Architecture

```mermaid
C4Context
    title Enterprise WAF Platform - System Context

    Person(user, "End Users", "Web application users")
    Person(admin, "Security Team", "SOC analysts and administrators")
    
    System_Boundary(waf, "Enterprise WAF Platform") {
        System(waf_core, "WAF Core", "Web Application Firewall with intelligent routing")
        System(realtime, "Real-Time Processing", "Immediate threat detection and alerting")
        System(analytics, "Analytics Processing", "Historical analysis and reporting")
        System(monitoring, "Monitoring & Dashboards", "Operational visibility and alerting")
    }
    
    System_Ext(threats, "External Threats", "Malicious actors and automated attacks")
    System_Ext(intel, "Threat Intelligence", "External threat feeds and reputation services")
    System_Ext(notifications, "Notification Systems", "PagerDuty, Slack, Email, SMS")
    
    Rel(user, waf_core, "HTTP/HTTPS Requests")
    Rel(threats, waf_core, "Attack Attempts")
    Rel(waf_core, realtime, "High-severity events")
    Rel(waf_core, analytics, "All security events")
    Rel(realtime, notifications, "Critical alerts")
    Rel(intel, realtime, "Threat data")
    Rel(admin, monitoring, "Security operations")
```

### Core Principles

1. **Separation of Concerns**: Real-time and analytics processing are completely separated
2. **Event-Driven Architecture**: All components communicate via events and streams
3. **Horizontal Scalability**: Every component can scale independently
4. **Fault Tolerance**: No single points of failure, graceful degradation
5. **Security by Design**: Defense in depth, least privilege, encrypted communications

---

## Dual-Track Architecture

The platform's core innovation is the intelligent dual-track processing system that routes events based on threat severity and processing requirements.

### Architectural Decision: Why Dual-Track?

| Challenge | Traditional Approach | Dual-Track Solution |
|-----------|---------------------|---------------------|
| **High-volume scanner noise** | All events processed equally | Scanner traffic isolated to analytics track |
| **Alert fatigue from false positives** | Manual tuning and filtering | Intelligent severity-based routing |
| **Delayed critical threat response** | Batch processing delays | Sub-second real-time processing |
| **Resource contention** | Single pipeline bottlenecks | Independent resource allocation |
| **Operational complexity** | One-size-fits-all configuration | Optimized per-track configurations |

### Track Comparison

```mermaid
graph TB
    subgraph "Event Classification"
        Event[Security Event] --> Classifier{Severity Analysis}
        Classifier -->|Score ≥ 80| Critical[Critical Threat]
        Classifier -->|Scanner Pattern| Scanner[Scanner Activity]
        Classifier -->|Standard Event| Standard[Standard Event]
    end
    
    subgraph "Real-Time Track"
        Critical --> RT_Queue[Redis Streams]
        RT_Queue --> RT_Processor[Go Processor]
        RT_Processor --> RT_Storage[InfluxDB]
        RT_Processor --> RT_Alert[Immediate Alerts]
        RT_Storage --> RT_Dashboard[Real-time Dashboard]
    end
    
    subgraph "Analytics Track"
        Scanner --> AN_Queue[Kafka Topics]
        Standard --> AN_Queue
        AN_Queue --> AN_Stream[ksqlDB Processing]
        AN_Queue --> AN_ETL[Logstash ETL]
        AN_Stream --> AN_Search[Elasticsearch]
        AN_ETL --> AN_Search
        AN_ETL --> AN_OLAP[ClickHouse]
        AN_Search --> AN_Dashboard[Analytics Dashboard]
        AN_OLAP --> AN_Reports[Executive Reports]
    end
    
    classDef critical fill:#ff6b6b,stroke:#d63031,color:#fff
    classDef analytics fill:#6c5ce7,stroke:#5f3dc4,color:#fff
    classDef storage fill:#00b894,stroke:#00a085,color:#fff
    
    class Critical,RT_Queue,RT_Processor,RT_Storage,RT_Alert,RT_Dashboard critical
    class Scanner,Standard,AN_Queue,AN_Stream,AN_ETL,AN_Search,AN_OLAP,AN_Dashboard,AN_Reports analytics
```

### Processing Characteristics

| Aspect | Real-Time Track | Analytics Track |
|--------|----------------|-----------------|
| **Latency** | < 1 second | 5-30 seconds |
| **Throughput** | 1K-10K events/sec | 100K+ events/sec |
| **Storage** | Time-series (7 days) | Long-term (1+ years) |
| **Processing** | Stateful stream processing | Batch and micro-batch |
| **Use Cases** | Alerts, dashboards, investigations | Reports, compliance, ML training |
| **SLA** | 99.9% availability | 99% availability |

---

## Component Architecture

### WAF Layer Components

```mermaid
graph TB
    subgraph "WAF Layer - High Availability"
        LB[Load Balancer<br/>HAProxy/Nginx]
        
        subgraph "WAF Instances"
            WAF1[WAF Instance 1<br/>Nginx + ModSecurity]
            WAF2[WAF Instance 2<br/>Nginx + ModSecurity]
            WAF3[WAF Instance 3<br/>Nginx + ModSecurity]
        end
        
        subgraph "Shared Storage"
            Logs[(Shared Log Volume<br/>NFS/EFS)]
        end
    end
    
    LB --> WAF1
    LB --> WAF2
    LB --> WAF3
    WAF1 --> Logs
    WAF2 --> Logs
    WAF3 --> Logs
    
    classDef waf fill:#ff6b6b,stroke:#d63031,color:#fff
    classDef storage fill:#fff2cc,stroke:#d6b656,color:#000
    
    class LB,WAF1,WAF2,WAF3 waf
    class Logs storage
```

#### ModSecurity Configuration
- **OWASP CRS 3.3+**: 200+ security rules covering OWASP Top 10
- **Paranoia Levels**: Configurable strictness (1-4)
- **Custom Rules**: Organization-specific attack patterns
- **Anomaly Scoring**: Cumulative threat scoring system
- **JSON Audit Logs**: Structured logging for automated processing

### Event Router (Fluent Bit + Lua)

```mermaid
graph TB
    subgraph "Intelligent Event Router"
        Input[ModSecurity Logs] --> Parser[JSON Parser]
        Parser --> Classifier[Lua Classifier]
        
        subgraph "Classification Logic"
            Classifier --> AnomalyCheck{Anomaly Score ≥ 50?}
            Classifier --> RuleCheck{Critical Rule Pattern?}
            Classifier --> ScannerCheck{Scanner Pattern?}
        end
        
        AnomalyCheck -->|Yes| Realtime[Real-time Track]
        RuleCheck -->|SQLi/XSS/RCE| Realtime
        ScannerCheck -->|Scanner| Analytics[Analytics Track]
        
        AnomalyCheck -->|No| Analytics
        RuleCheck -->|No| Analytics
        
        Realtime --> RedisStreams[(Redis Streams)]
        Analytics --> KafkaTopics[(Kafka Topics)]
    end
    
    classDef router fill:#74b9ff,stroke:#0984e3,color:#fff
    classDef decision fill:#fdcb6e,stroke:#e17055,color:#000
    classDef output fill:#a29bfe,stroke:#6c5ce7,color:#fff
    
    class Input,Parser,Classifier router
    class AnomalyCheck,RuleCheck,ScannerCheck decision
    class Realtime,Analytics,RedisStreams,KafkaTopics output
```

#### Classification Rules
```lua
-- High-severity attacks (Real-time track)
critical_rules = {"942", "941", "932", "930"}  -- SQLi, XSS, RCE, LFI
anomaly_threshold = 50

-- Scanner detection patterns (Analytics track)
scanner_rules = {"913"}  -- Scanner detection rules
scanner_user_agents = {"nikto", "sqlmap", "burp", "nessus"}

-- IP reputation scoring
threat_intel_sources = {"abuseipdb", "virustotal", "custom_feeds"}
```

### Real-Time Processing Components

```mermaid
graph TB
    subgraph "Real-Time Processing Pipeline"
        Redis[(Redis Streams<br/>waf-realtime-events)]
        
        subgraph "Processing Cluster"
            Proc1[Processor Instance 1<br/>Go Microservice]
            Proc2[Processor Instance 2<br/>Go Microservice]
            Proc3[Processor Instance 3<br/>Go Microservice]
        end
        
        subgraph "Threat Analysis Engine"
            Scorer[Severity Scorer]
            Intel[Threat Intel Client]
            Rules[Rule Engine]
        end
        
        subgraph "Output Systems"
            InfluxDB[(InfluxDB<br/>Time-series DB)]
            Alerts[Alert Manager]
            Cache[Redis Cache<br/>Dashboard Data)]
        end
    end
    
    Redis --> Proc1
    Redis --> Proc2
    Redis --> Proc3
    
    Proc1 --> Scorer
    Proc2 --> Scorer
    Proc3 --> Scorer
    
    Scorer --> Intel
    Scorer --> Rules
    
    Scorer --> InfluxDB
    Scorer --> Alerts
    Scorer --> Cache
    
    classDef realtime fill:#fd79a8,stroke:#e84393,color:#fff
    classDef processing fill:#fdcb6e,stroke:#e17055,color:#000
    classDef output fill:#00b894,stroke:#00a085,color:#fff
    
    class Redis,Proc1,Proc2,Proc3 realtime
    class Scorer,Intel,Rules processing
    class InfluxDB,Alerts,Cache output
```

#### Go Microservice Architecture
```go
// Core components
type RealTimeProcessor struct {
    redisClient  *redis.Client        // Stream consumption
    influxClient influxdb2.Client     // Metrics storage
    alertManager *AlertManager        // Multi-channel alerting
    threatIntel  *ThreatIntelClient   // IP reputation
    ruleEngine   *RuleEngine          // Custom rules
    logger       *logrus.Logger       // Structured logging
}

// Processing pipeline
func (rtp *RealTimeProcessor) Process(event *SecurityEvent) {
    severity := rtp.calculateSeverity(event)
    
    // Store metrics
    rtp.storeMetrics(event, severity)
    
    // Trigger alerts if critical
    if severity >= 80 {
        rtp.triggerAlert(event, severity)
    }
    
    // Update dashboards
    rtp.updateDashboard(event, severity)
}
```

### Analytics Processing Components

```mermaid
graph TB
    subgraph "Analytics Processing Pipeline"
        Kafka[(Apache Kafka<br/>Distributed Streaming)]
        
        subgraph "Stream Processing"
            ksqlDB[ksqlDB Server<br/>SQL Stream Processing]
            Connect[Kafka Connect<br/>Source/Sink Connectors]
        end
        
        subgraph "ETL Pipeline"
            Logstash1[Logstash Instance 1]
            Logstash2[Logstash Instance 2]
            Logstash3[Logstash Instance 3]
        end
        
        subgraph "Storage Layer"
            Elasticsearch[(Elasticsearch<br/>Search & Analytics)]
            ClickHouse[(ClickHouse<br/>OLAP Database)]
        end
        
        subgraph "Data Processing"
            Enrichment[Data Enrichment<br/>GeoIP, Rules, Users]
            Aggregation[Aggregation<br/>Time-based Windows]
            ML[ML Pipeline<br/>Anomaly Detection]
        end
    end
    
    Kafka --> ksqlDB
    Kafka --> Connect
    Kafka --> Logstash1
    Kafka --> Logstash2
    Kafka --> Logstash3
    
    ksqlDB --> Enrichment
    ksqlDB --> Aggregation
    
    Logstash1 --> Elasticsearch
    Logstash2 --> Elasticsearch
    Logstash3 --> Elasticsearch
    
    Logstash1 --> ClickHouse
    Logstash2 --> ClickHouse
    Logstash3 --> ClickHouse
    
    Elasticsearch --> ML
    ClickHouse --> ML
    
    classDef analytics fill:#6c5ce7,stroke:#5f3dc4,color:#fff
    classDef processing fill:#fdcb6e,stroke:#e17055,color:#000
    classDef storage fill:#00b894,stroke:#00a085,color:#fff
    
    class Kafka,ksqlDB,Connect,Logstash1,Logstash2,Logstash3 analytics
    class Enrichment,Aggregation,ML processing
    class Elasticsearch,ClickHouse storage
```

#### Stream Processing Topology
```sql
-- ksqlDB stream processing examples

-- 1. Event enrichment with rule metadata
CREATE STREAM enriched_events AS
SELECT 
    e.timestamp,
    e.client_ip,
    e.rule_id,
    r.category,
    r.severity,
    GEO_IP(e.client_ip) as geo_data
FROM raw_events e
LEFT JOIN rule_lookup r ON e.rule_id = r.rule_id;

-- 2. Time-windowed aggregations
CREATE TABLE attack_metrics AS
SELECT 
    client_ip,
    rule_category,
    COUNT(*) as attack_count,
    AVG(severity_score) as avg_severity
FROM enriched_events
WINDOW TUMBLING (SIZE 1 HOUR)
GROUP BY client_ip, rule_category;

-- 3. Anomaly detection preparation
CREATE STREAM anomalies AS
SELECT *
FROM enriched_events
WHERE severity_score > 90
   OR attack_count > PERCENTILE(attack_count, 0.99);
```

---

## Data Flow Diagrams

### End-to-End Data Flow

```mermaid
sequenceDiagram
    participant Client as Web Client
    participant WAF as WAF (Nginx+ModSec)
    participant Router as Event Router (Fluent Bit)
    participant Redis as Redis Streams
    participant Kafka as Kafka Topics
    participant RTP as Real-time Processor
    participant Analytics as Analytics Pipeline
    participant InfluxDB as InfluxDB
    participant ES as Elasticsearch
    participant SOC as Security Operations
    
    Client->>WAF: HTTP Request
    WAF->>WAF: Apply Security Rules
    WAF->>Router: JSON Audit Log
    
    Router->>Router: Classify Event Severity
    
    alt High Severity Event
        Router->>Redis: Real-time Stream
        Redis->>RTP: Consumer Group Read
        RTP->>RTP: Threat Analysis
        RTP->>InfluxDB: Store Metrics
        RTP->>SOC: Critical Alert
    else Standard/Scanner Event
        Router->>Kafka: Analytics Topic
        Kafka->>Analytics: Bulk Processing
        Analytics->>ES: Indexed Events
        Analytics->>SOC: Scheduled Reports
    end
    
    WAF-->>Client: HTTP Response
```

### Real-Time Track Detailed Flow

```mermaid
graph TD
    A[ModSecurity Event] --> B[Fluent Bit Router]
    B --> C{Severity >= 80?}
    C -->|Yes| D[Redis Streams]
    C -->|No| E[Kafka Topics]
    
    D --> F[Go Processor]
    F --> G[Severity Calculator]
    G --> H[Threat Intel Lookup]
    H --> I[Rule Engine]
    I --> J{Critical Threat?}
    
    J -->|Yes| K[Alert Manager]
    J -->|No| L[Store Metrics]
    
    K --> M[PagerDuty]
    K --> N[Slack]
    K --> O[Email]
    
    L --> P[InfluxDB]
    P --> Q[Grafana Dashboard]
    
    F --> R[Redis Cache]
    R --> S[Real-time Dashboard]
    
    classDef critical fill:#ff6b6b,stroke:#d63031,color:#fff
    classDef processing fill:#74b9ff,stroke:#0984e3,color:#fff
    classDef storage fill:#00b894,stroke:#00a085,color:#fff
    classDef alert fill:#fd79a8,stroke:#e84393,color:#fff
    
    class A,B,D,F critical
    class G,H,I processing
    class P,R storage
    class K,M,N,O alert
```

### Analytics Track Detailed Flow

```mermaid
graph TD
    A[ModSecurity Event] --> B[Fluent Bit Router]
    B --> C{Scanner/Standard?}
    C --> D[Kafka Topics]
    
    D --> E[ksqlDB Processing]
    D --> F[Logstash ETL]
    
    E --> G[Stream Enrichment]
    E --> H[Windowed Aggregation]
    E --> I[ML Feature Extraction]
    
    F --> J[GeoIP Enrichment]
    F --> K[Field Mapping]
    F --> L[Data Validation]
    
    G --> M[Elasticsearch]
    H --> M
    I --> N[ML Pipeline]
    
    J --> M
    K --> O[ClickHouse]
    L --> O
    
    M --> P[Kibana Dashboard]
    O --> Q[Analytics Dashboard]
    N --> R[Anomaly Alerts]
    
    classDef analytics fill:#6c5ce7,stroke:#5f3dc4,color:#fff
    classDef enrichment fill:#fdcb6e,stroke:#e17055,color:#000
    classDef storage fill:#00b894,stroke:#00a085,color:#fff
    classDef viz fill:#a29bfe,stroke:#74b9ff,color:#fff
    
    class A,B,D,E,F analytics
    class G,H,I,J,K,L enrichment
    class M,O storage
    class P,Q,R viz
```

---

## Security Architecture

### Defense in Depth

```mermaid
graph TB
    subgraph "External Layer"
        Internet[Internet] --> CDN[CDN/Edge Protection]
        CDN --> DDoS[DDoS Protection]
        DDoS --> Firewall[Network Firewall]
    end
    
    subgraph "Application Layer"
        Firewall --> LB[Load Balancer<br/>SSL Termination]
        LB --> WAF[WAF Layer<br/>ModSecurity + OWASP CRS]
        WAF --> App[Protected Applications]
    end
    
    subgraph "Data Processing Layer"
        WAF --> Router[Event Router<br/>Input Validation]
        Router --> RT[Real-time Pipeline<br/>Encrypted Streams]
        Router --> AN[Analytics Pipeline<br/>Data Anonymization]
    end
    
    subgraph "Storage Layer"
        RT --> RTStore[(Encrypted Storage<br/>Time-series + Cache)]
        AN --> ANStore[(Encrypted Storage<br/>Search + OLAP)]
    end
    
    subgraph "Management Layer"
        Dashboard[Monitoring Dashboards<br/>RBAC + MFA]
        API[Management APIs<br/>API Keys + OAuth]
        Backup[Backup Systems<br/>Encrypted + Immutable]
    end
    
    RTStore --> Dashboard
    ANStore --> Dashboard
    RTStore --> API
    ANStore --> API
    RTStore --> Backup
    ANStore --> Backup
    
    classDef external fill:#ff6b6b,stroke:#d63031,color:#fff
    classDef app fill:#fd79a8,stroke:#e84393,color:#fff
    classDef processing fill:#74b9ff,stroke:#0984e3,color:#fff
    classDef storage fill:#00b894,stroke:#00a085,color:#fff
    classDef mgmt fill:#fdcb6e,stroke:#e17055,color:#000
    
    class Internet,CDN,DDoS,Firewall external
    class LB,WAF,App app
    class Router,RT,AN processing
    class RTStore,ANStore storage
    class Dashboard,API,Backup mgmt
```

### Access Control Architecture

```mermaid
graph TB
    subgraph "Identity & Access Management"
        Users[Users] --> SSO[SSO Provider<br/>SAML/OAuth]
        SSO --> RBAC[RBAC Engine]
        RBAC --> Roles{Role Assignment}
        
        Roles --> Admin[Admin Role<br/>Full Access]
        Roles --> Analyst[Analyst Role<br/>Read + Investigate]
        Roles --> Viewer[Viewer Role<br/>Dashboard Only]
        Roles --> API[API Role<br/>Programmatic Access]
    end
    
    subgraph "Protected Resources"
        Admin --> AdminDash[Admin Dashboard]
        Admin --> Config[Configuration Management]
        Admin --> UserMgmt[User Management]
        
        Analyst --> AnalystDash[Analysis Dashboard]
        Analyst --> Investigate[Investigation Tools]
        Analyst --> Reports[Report Generation]
        
        Viewer --> ViewDash[View-only Dashboard]
        
        API --> RestAPI[REST APIs]
        API --> Metrics[Metrics Endpoints]
    end
    
    subgraph "Audit & Compliance"
        ALL[All Activities] --> AuditLog[Audit Logging]
        AuditLog --> SIEM[SIEM Integration]
        AuditLog --> Compliance[Compliance Reports]
    end
    
    AdminDash --> ALL
    AnalystDash --> ALL
    ViewDash --> ALL
    RestAPI --> ALL
    
    classDef auth fill:#74b9ff,stroke:#0984e3,color:#fff
    classDef resources fill:#00b894,stroke:#00a085,color:#fff
    classDef audit fill:#fdcb6e,stroke:#e17055,color:#000
    
    class Users,SSO,RBAC,Roles auth
    class AdminDash,AnalystDash,ViewDash,RestAPI resources
    class ALL,AuditLog,SIEM,Compliance audit
```

### Encryption & Data Protection

| Layer | Component | Encryption Method | Key Management |
|-------|-----------|------------------|----------------|
| **Transport** | Client ↔ WAF | TLS 1.3 | Certificate Authority |
| **Transport** | Inter-service | mTLS | Service Mesh (Istio) |
| **Application** | Event Streams | SASL_SSL | Kafka ACLs + Certificates |
| **Storage** | Database Files | AES-256 | Vault/KMS Integration |
| **Storage** | Backup Files | AES-256-GCM | Hardware Security Module |
| **Memory** | Sensitive Data | In-memory encryption | Application-level keys |

---

## Scalability & Performance

### Horizontal Scaling Architecture

```mermaid
graph TB
    subgraph "Load Balancers (Auto-scaling)"
        LB1[Load Balancer 1]
        LB2[Load Balancer 2]
        LBN[Load Balancer N]
    end
    
    subgraph "WAF Layer (Auto-scaling)"
        WAF1[WAF Instance 1]
        WAF2[WAF Instance 2]
        WAFN[WAF Instance N]
    end
    
    subgraph "Event Processing (Auto-scaling)"
        Router1[Router 1]
        Router2[Router 2]
        RouterN[Router N]
    end
    
    subgraph "Real-time Pipeline (Consumer Groups)"
        RT1[RT Processor 1]
        RT2[RT Processor 2]
        RTN[RT Processor N]
    end
    
    subgraph "Analytics Pipeline (Partitioned)"
        AN1[Analytics 1<br/>Partition 0-1]
        AN2[Analytics 2<br/>Partition 2-3]
        ANN[Analytics N<br/>Partition N-M]
    end
    
    subgraph "Storage Layer (Clustered)"
        InfluxCluster[(InfluxDB Cluster<br/>3+ Nodes)]
        ESCluster[(Elasticsearch Cluster<br/>3+ Nodes)]
        CHCluster[(ClickHouse Cluster<br/>3+ Nodes)]
    end
    
    LB1 --> WAF1
    LB2 --> WAF2
    LBN --> WAFN
    
    WAF1 --> Router1
    WAF2 --> Router2
    WAFN --> RouterN
    
    Router1 --> RT1
    Router1 --> AN1
    Router2 --> RT2
    Router2 --> AN2
    RouterN --> RTN
    RouterN --> ANN
    
    RT1 --> InfluxCluster
    RT2 --> InfluxCluster
    RTN --> InfluxCluster
    
    AN1 --> ESCluster
    AN1 --> CHCluster
    AN2 --> ESCluster
    AN2 --> CHCluster
    ANN --> ESCluster
    ANN --> CHCluster
    
    classDef autoscale fill:#74b9ff,stroke:#0984e3,color:#fff
    classDef consumer fill:#fd79a8,stroke:#e84393,color:#fff
    classDef partition fill:#6c5ce7,stroke:#5f3dc4,color:#fff
    classDef cluster fill:#00b894,stroke:#00a085,color:#fff
    
    class LB1,LB2,LBN,WAF1,WAF2,WAFN,Router1,Router2,RouterN autoscale
    class RT1,RT2,RTN consumer
    class AN1,AN2,ANN partition
    class InfluxCluster,ESCluster,CHCluster cluster
```

### Performance Targets

| Component | Throughput | Latency | Availability |
|-----------|------------|---------|--------------|
| **WAF Layer** | 10,000 RPS per instance | < 10ms | 99.99% |
| **Real-time Track** | 1,000 events/sec | < 1 second | 99.9% |
| **Analytics Track** | 100,000 events/sec | < 30 seconds | 99% |
| **Alert Generation** | 100 alerts/sec | < 2 seconds | 99.9% |
| **Dashboard Queries** | 100 concurrent users | < 3 seconds | 99.5% |

### Auto-scaling Triggers

```yaml
# Kubernetes HPA Configuration
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: waf-autoscaler
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: waf-nginx
  minReplicas: 3
  maxReplicas: 50
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  - type: Pods
    pods:
      metric:
        name: nginx_requests_per_second
      target:
        type: AverageValue
        averageValue: "8000"
```

---

## Deployment Architecture

### Multi-Environment Strategy

```mermaid
graph TB
    subgraph "Development Environment"
        DevWAF[Single WAF Instance]
        DevRouter[Single Router]
        DevRT[Single RT Processor]
        DevStorage[(Local Storage)]
    end
    
    subgraph "Staging Environment"
        StagWAF[2x WAF Instances]
        StagRouter[2x Routers]
        StagRT[2x RT Processors]
        StagAN[2x Analytics]
        StagStorage[(Shared Storage)]
    end
    
    subgraph "Production Environment"
        subgraph "Multi-AZ Deployment"
            ProdWAF[Auto-scaling WAF]
            ProdRouter[Auto-scaling Router]
            ProdRT[Consumer Groups RT]
            ProdAN[Partitioned Analytics]
        end
        
        subgraph "Clustered Storage"
            ProdInflux[(InfluxDB Cluster)]
            ProdES[(Elasticsearch Cluster)]
            ProdCH[(ClickHouse Cluster)]
        end
    end
    
    subgraph "CI/CD Pipeline"
        Git[Git Repository] --> CI[CI/CD System]
        CI --> DevDeploy[Deploy to Dev]
        DevDeploy --> Test[Run Tests]
        Test --> StagDeploy[Deploy to Staging]
        StagDeploy --> Validate[Validation Tests]
        Validate --> ProdDeploy[Deploy to Production]
    end
    
    classDef dev fill:#74b9ff,stroke:#0984e3,color:#fff
    classDef staging fill:#fdcb6e,stroke:#e17055,color:#000
    classDef prod fill:#00b894,stroke:#00a085,color:#fff
    classDef cicd fill:#fd79a8,stroke:#e84393,color:#fff
    
    class DevWAF,DevRouter,DevRT,DevStorage dev
    class StagWAF,StagRouter,StagRT,StagAN,StagStorage staging
    class ProdWAF,ProdRouter,ProdRT,ProdAN,ProdInflux,ProdES,ProdCH prod
    class Git,CI,DevDeploy,Test,StagDeploy,Validate,ProdDeploy cicd
```

### Kubernetes Production Deployment

```yaml
# WAF Deployment with Anti-Affinity
apiVersion: apps/v1
kind: Deployment
metadata:
  name: waf-nginx
spec:
  replicas: 3
  selector:
    matchLabels:
      app: waf-nginx
  template:
    metadata:
      labels:
        app: waf-nginx
    spec:
      affinity:
        podAntiAffinity:
          requiredDuringSchedulingIgnoredDuringExecution:
          - labelSelector:
              matchExpressions:
              - key: app
                operator: In
                values:
                - waf-nginx
            topologyKey: kubernetes.io/hostname
      containers:
      - name: nginx
        image: waf-nginx:latest
        resources:
          requests:
            cpu: 500m
            memory: 1Gi
          limits:
            cpu: 2
            memory: 4Gi
        ports:
        - containerPort: 80
        - containerPort: 443
        volumeMounts:
        - name: modsec-logs
          mountPath: /var/log/modsecurity
      volumes:
      - name: modsec-logs
        persistentVolumeClaim:
          claimName: modsec-logs-pvc
```

### Cloud-Native Features

| Feature | AWS | Azure | GCP | Kubernetes |
|---------|-----|-------|-----|------------|
| **Load Balancing** | ALB/NLB | App Gateway | Load Balancer | Ingress |
| **Auto-scaling** | ASG | VMSS | MIG | HPA/VPA |
| **Secret Management** | Secrets Manager | Key Vault | Secret Manager | Secrets |
| **Monitoring** | CloudWatch | Monitor | Operations | Prometheus |
| **Storage** | EBS/EFS | Disk/Files | Disk/Filestore | PV/PVC |
| **Networking** | VPC | VNet | VPC | CNI |

---

## Integration Points

### External System Integrations

```mermaid
graph TB
    subgraph "WAF Platform Core"
        WAF[WAF Platform]
    end
    
    subgraph "Identity & Access"
        AD[Active Directory]
        Okta[Okta SSO]
        LDAP[LDAP Server]
    end
    
    subgraph "Threat Intelligence"
        AbuseIPDB[AbuseIPDB API]
        VirusTotal[VirusTotal API]
        ThreatFox[ThreatFox Feed]
        Custom[Custom Intel Feeds]
    end
    
    subgraph "Notification Systems"
        PagerDuty[PagerDuty]
        Slack[Slack Webhooks]
        Email[SMTP Server]
        SMS[SMS Gateway]
        Teams[Microsoft Teams]
    end
    
    subgraph "Security Tools"
        SIEM[SIEM Platform]
        SOAR[SOAR Platform]
        TIP[Threat Intel Platform]
        Vulnerability[Vuln Scanners]
    end
    
    subgraph "Infrastructure"
        DNS[DNS Providers]
        CDN[CDN Services]
        Cloud[Cloud APIs]
        Monitoring[External Monitoring]
    end
    
    WAF <--> AD
    WAF <--> Okta
    WAF <--> LDAP
    
    WAF --> AbuseIPDB
    WAF --> VirusTotal
    WAF --> ThreatFox
    WAF --> Custom
    
    WAF --> PagerDuty
    WAF --> Slack
    WAF --> Email
    WAF --> SMS
    WAF --> Teams
    
    WAF --> SIEM
    WAF --> SOAR
    WAF --> TIP
    WAF <--> Vulnerability
    
    WAF --> DNS
    WAF --> CDN
    WAF --> Cloud
    WAF --> Monitoring
    
    classDef core fill:#ff6b6b,stroke:#d63031,color:#fff
    classDef auth fill:#74b9ff,stroke:#0984e3,color:#fff
    classDef intel fill:#6c5ce7,stroke:#5f3dc4,color:#fff
    classDef notify fill:#fd79a8,stroke:#e84393,color:#fff
    classDef security fill:#00b894,stroke:#00a085,color:#fff
    classDef infra fill:#fdcb6e,stroke:#e17055,color:#000
    
    class WAF core
    class AD,Okta,LDAP auth
    class AbuseIPDB,VirusTotal,ThreatFox,Custom intel
    class PagerDuty,Slack,Email,SMS,Teams notify
    class SIEM,SOAR,TIP,Vulnerability security
    class DNS,CDN,Cloud,Monitoring infra
```

### API Integration Specifications

#### REST API Endpoints
```yaml
# OpenAPI 3.0 Specification
openapi: 3.0.0
info:
  title: WAF Platform API
  version: 1.0.0
  description: Enterprise WAF Platform Management API

paths:
  /api/v1/events:
    get:
      summary: Query security events
      parameters:
        - name: start_time
          schema:
            type: string
            format: date-time
        - name: severity
          schema:
            type: string
            enum: [critical, high, medium, low]
      responses:
        200:
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/SecurityEvent'
                  
  /api/v1/alerts:
    post:
      summary: Create custom alert
      requestBody:
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/Alert'
      responses:
        201:
          description: Alert created successfully
          
  /api/v1/rules:
    get:
      summary: List WAF rules
    post:
      summary: Create custom rule
      
components:
  schemas:
    SecurityEvent:
      type: object
      properties:
        id:
          type: string
        timestamp:
          type: string
          format: date-time
        severity:
          type: integer
        client_ip:
          type: string
        rule_id:
          type: string
        attack_type:
          type: string
```

#### Webhook Integrations
```json
{
  "webhook_url": "https://hooks.slack.com/services/...",
  "events": ["critical_alert", "rule_created"],
  "payload_template": {
    "text": "🚨 Critical security alert detected",
    "attachments": [
      {
        "color": "danger",
        "fields": [
          {"title": "Severity", "value": "{{severity}}", "short": true},
          {"title": "Source IP", "value": "{{client_ip}}", "short": true},
          {"title": "Attack Type", "value": "{{attack_type}}", "short": false}
        ]
      }
    ]
  }
}
```

---

## Conclusion

The Enterprise WAF Platform architecture provides a robust, scalable, and secure foundation for web application protection. The dual-track design ensures both immediate threat response and comprehensive security analytics, while the cloud-native architecture enables seamless scaling and high availability.

Key architectural strengths:
- **Intelligent Event Routing**: Reduces noise and improves response times
- **Horizontal Scalability**: Every component scales independently
- **Security by Design**: Multiple layers of defense and encryption
- **Operational Excellence**: Comprehensive monitoring and automation
- **Integration Ready**: Extensive API and webhook support

This architecture supports organizations from startup to enterprise scale, with clear upgrade paths and operational best practices built-in.