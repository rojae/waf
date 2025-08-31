# 📊 Grafana Dashboard Guide

## 🎯 Overview

Comprehensive guide for configuring and managing Grafana dashboards for WAF real-time monitoring. Visualize real-time security metrics through InfluxDB integration.

## 🏗️ Dashboard Architecture

### **Data Source Connection**
- **InfluxDB Bucket**: `waf-realtime`
- **Main Measurements**: `waf_events`, `waf_requests`
- **Update Frequency**: 1-5 seconds (real-time)
- **Retention Policy**: 7 days high-resolution data

### **Dashboard Layout**
```
┌─────────────────────────────────────────────────────────────┐
│  🛡️ WAF Security Operations Center                         │
├─────────────────┬─────────────────┬─────────────────────────┤
│  📈 KPI Summary  │  🌍 Global Map   │  🚨 Real-time Alerts    │
├─────────────────┴─────────────────┴─────────────────────────┤
│  📊 Attack Trends (Time Series Chart)                      │
├─────────────────┬─────────────────┬─────────────────────────┤
│  🎯 Attack Types │  🚫 Severity    │  🔍 Top Attacker IPs    │
├─────────────────┴─────────────────┴─────────────────────────┤
│  📋 Real-time Event Log Table                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 📈 Core KPI Panels

### **1. Security Status Summary**
```flux
// 📊 Total Attacks (24 hours)
from(bucket: "waf-realtime")
    |> range(start: -24h)
    |> filter(fn: (r) => r._measurement == "waf_events")
    |> filter(fn: (r) => r._field == "count")
    |> sum()
    |> map(fn: (r) => ({ _value: r._value, _time: now(), title: "Total Attacks" }))
```

```flux
// 🚫 Block Success Rate (24 hours)
blocked = from(bucket: "waf-realtime")
    |> range(start: -24h)
    |> filter(fn: (r) => r._measurement == "waf_requests")
    |> filter(fn: (r) => r.blocked == "true")
    |> count()

total = from(bucket: "waf-realtime")
    |> range(start: -24h)  
    |> filter(fn: (r) => r._measurement == "waf_requests")
    |> count()

join(tables: {blocked: blocked, total: total}, on: ["_stop", "_start"])
    |> map(fn: (r) => ({ 
        _value: float(v: r._value_blocked) / float(v: r._value_total) * 100.0,
        _time: now(),
        title: "Block Rate %" 
    }))
```

### **2. Real-time Processing Status**
```flux
// ⚡ Events Per Second (1-minute average)
from(bucket: "waf-realtime")
    |> range(start: -5m)
    |> filter(fn: (r) => r._measurement == "waf_events")
    |> filter(fn: (r) => r._field == "count")
    |> aggregateWindow(every: 10s, fn: count)
    |> mean()
    |> map(fn: (r) => ({ 
        _value: r._value,
        _time: now(),
        title: "Events/sec" 
    }))
```

---

## 🌍 Geographic Threat Analysis

### **3. Attack Statistics by Country (World Map)**
```flux
from(bucket: "waf-realtime")
    |> range(start: -6h)
    |> filter(fn: (r) => r._measurement == "waf_events")
    |> filter(fn: (r) => r._field == "count")
    |> group(columns: ["country"])
    |> sum()
    |> rename(columns: {_value: "attack_count"})
    |> group()
    |> sort(columns: ["attack_count"], desc: true)
    |> limit(n: 20)
```

### **4. Real-time Attack Map (Geomap)**
```flux
from(bucket: "waf-realtime")
    |> range(start: -1h)
    |> filter(fn: (r) => r._measurement == "waf_requests")
    |> filter(fn: (r) => r._field == "latitude" or r._field == "longitude")
    |> pivot(
        rowKey: ["_time", "client_ip", "country", "city"],
        columnKey: ["_field"],
        valueColumn: "_value"
    )
    |> filter(fn: (r) => exists r.latitude and exists r.longitude)
    |> group(columns: ["country", "city", "client_ip"])
    |> reduce(
        identity: {
            count: 0, 
            lat: 0.0, 
            lon: 0.0, 
            severity_sum: 0,
            last_time: 1970-01-01T00:00:00Z
        },
        fn: (r, accumulator) => ({
            count: accumulator.count + 1,
            lat: r.latitude,
            lon: r.longitude, 
            severity_sum: accumulator.severity_sum + r.severity_score,
            last_time: if r._time > accumulator.last_time then r._time else accumulator.last_time
        })
    )
    |> map(fn: (r) => ({
        country: r.country,
        city: r.city,
        client_ip: r.client_ip,
        attack_count: r.count,
        avg_severity: float(v: r.severity_sum) / float(v: r.count),
        latitude: r.lat,
        longitude: r.lon,
        last_seen: r.last_time
    }))
    |> group()
    |> sort(columns: ["attack_count"], desc: true)
```

---

## 📊 Time Series Trend Analysis

### **5. Attack Pattern Time Series (Hourly)**
```flux
from(bucket: "waf-realtime")
    |> range(start: -24h)
    |> filter(fn: (r) => r._measurement == "waf_events")
    |> filter(fn: (r) => r._field == "count")
    |> group(columns: ["attack_type"])
    |> aggregateWindow(every: 1h, fn: sum, createEmpty: true)
    |> fill(value: 0)
    |> yield(name: "attacks_by_type")
```

### **6. Severity Distribution (Pie Chart)**
```flux
from(bucket: "waf-realtime")
    |> range(start: -6h)
    |> filter(fn: (r) => r._measurement == "waf_events")
    |> filter(fn: (r) => r._field == "count")
    |> group(columns: ["severity"])
    |> sum()
    |> group()
    |> sort(columns: ["_value"], desc: true)
```

### **7. Response Code Analysis**
```flux
from(bucket: "waf-realtime")
    |> range(start: -2h)
    |> filter(fn: (r) => r._measurement == "waf_requests")
    |> filter(fn: (r) => r._field == "count")
    |> group(columns: ["response_code"])
    |> sum()
    |> group()
    |> sort(columns: ["_value"], desc: true)
```

---

## 🚨 Real-time Monitoring

### **8. Real-time Event Stream (Table)**
```flux
import "strings"

from(bucket: "waf-realtime")
    |> range(start: -30m)
    |> filter(fn: (r) => r._measurement == "waf_events")
    |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
    |> group(columns: [])
    |> sort(columns: ["_time"], desc: true)
    |> map(fn: (r) => ({
        Time: r._time,
        "Client IP": (if exists r.client_ip then r.client_ip else "N/A"),
        Method: (if exists r.method then r.method else "N/A"),
        URI: (if exists r.uri then r.uri else "N/A"),
        "Attack Type": (if exists r.attack_type then r.attack_type else "N/A"),
        Severity: (if exists r.severity then r.severity else "N/A"),
        "Response Code": (if exists r.response_code then string(v: r.response_code) else "N/A"),
        Country: (if exists r.country then r.country else "N/A"),
        Blocked: (if exists r.blocked then r.blocked else "N/A")
    }))
    |> limit(n: 100)
```

### **9. Top Attacker IPs (Bar Chart)**
```flux
from(bucket: "waf-realtime")
    |> range(start: -2h)
    |> filter(fn: (r) => r._measurement == "waf_requests")
    |> filter(fn: (r) => r._field == "count")
    |> group(columns: ["client_ip"])
    |> sum()
    |> group()
    |> sort(columns: ["_value"], desc: true)
    |> limit(n: 15)
    |> rename(columns: {_value: "attack_count"})
```

### **10. High-Risk Event Alerts (Stat Panel)**
```flux
from(bucket: "waf-realtime")
    |> range(start: -10m)
    |> filter(fn: (r) => r._measurement == "waf_events")
    |> filter(fn: (r) => r._field == "severity_score")
    |> filter(fn: (r) => r._value >= 80)
    |> count()
    |> map(fn: (r) => ({
        _value: r._value,
        _time: now(),
        title: "Critical Events (10m)"
    }))
```

---

## ⚙️ Dashboard Configuration

### **Recommended Panel Types**

| Query Purpose | Panel Type | Refresh Rate |
|---------------|-----------|--------------|
| KPI Summary | Stat | 5s |
| Real-time Logs | Table | 2s |
| Attack Trends | Time series | 10s |
| Geographic Distribution | Geomap / Piechart | 30s |
| Top Attackers | Bar chart | 15s |
| Severity Distribution | Pie chart | 30s |

### **Color & Threshold Settings**

#### **Severity-based Color Codes**
```
🔴 Critical (80-100): Red (#FF0000)
🟠 High (60-79): Orange (#FF8C00) 
🟡 Medium (40-59): Yellow (#FFD700)
🟢 Low (0-39): Green (#32CD32)
```

#### **Response Code Colors**
```
🟢 2xx Success: Green
🟡 3xx Redirect: Yellow
🟠 4xx Client Error: Orange
🔴 5xx Server Error: Red
```

### **Alert Rules Configuration**

#### **Critical Alert Conditions**
- Attacks per second > 100 (sustained for 1 minute)
- Critical severity events > 10 (within 5 minutes)
- Block failure rate > 10% (over 10 minutes)
- Same IP attacks > 50 (within 5 minutes)

---

## 🔧 Dashboard Setup Guide

### **1. Add InfluxDB Data Source**
```yaml
# Grafana Datasource Configuration
- name: InfluxDB-WAF
  type: influxdb
  url: http://waf-influxdb:8086
  database: waf-realtime
  user: admin
  password: your-password
```

### **2. Variable Setup**
```
$country = query: SHOW TAG VALUES FROM "waf_events" WITH KEY = "country"
$severity = custom: critical,high,medium,low
$timerange = custom: 5m,15m,1h,6h,24h,7d
```

### **3. Panel Layout JSON**
```json
{
  "dashboard": {
    "title": "WAF Security Operations Center",
    "tags": ["waf", "security", "realtime"],
    "time": {
      "from": "now-6h",
      "to": "now"
    },
    "refresh": "5s",
    "panels": [...]
  }
}
```

---

## 📱 Mobile Optimization

### **Responsive Panel Sizes**
```
Large Desktop (1920px+): 4-6 columns
Desktop (1200px-1919px): 3-4 columns  
Tablet (768px-1199px): 2-3 columns
Mobile (767px and below): 1-2 columns
```

### **Mobile-First Metrics**
1. Real-time attack count
2. Block success rate
3. Severity distribution
4. Recent events (max 10)

---

## 🎨 Template Downloads

### **Pre-built Dashboard Files**
- `WAF-Security-Overview.json`: Complete security overview
- `WAF-Realtime-Monitoring.json`: Real-time monitoring focused
- `WAF-Geographic-Analysis.json`: Geographic threat analysis
- `WAF-Performance-Metrics.json`: Performance metrics focused

### **Installation Steps**
1. Login to Grafana as administrator
2. Select **Import Dashboard**
3. Upload JSON file or paste content
4. Select InfluxDB data source
5. Click **Import**

---

## 🚀 Advanced Features

### **Custom Variables & Templating**
```flux
// Dynamic country filter
SHOW TAG VALUES FROM "waf_events" WITH KEY = "country" WHERE time > now() - 24h

// Dynamic time range selector
$__timeFilter(column_name)

// Multi-value severity selector  
$severity = critical,high,medium,low
```

### **Alerting Integration**
```yaml
# Grafana Alert Rules
alerts:
  - name: "High Attack Volume"
    condition: "attacks_per_minute > 100"
    duration: "1m"
    notifications:
      - slack_channel
      - email_admin
  
  - name: "Critical Security Event"
    condition: "severity_score >= 80"
    duration: "0s"
    notifications:
      - pagerduty
      - sms_oncall
```

### **Performance Optimization**
- Use data source caching for static queries
- Implement query result caching (5-30 seconds)
- Optimize Flux queries with proper filtering
- Use dashboard snapshots for reporting

---

## 📊 Dashboard Templates

### **Executive Summary Dashboard**
- High-level KPIs only
- 30-second refresh rate
- Mobile-optimized layout
- Export-ready for reports

### **Security Operations Dashboard**
- Real-time event monitoring
- Detailed threat analysis
- Geographic visualization
- Rapid response panels

### **Performance Monitoring Dashboard**
- System health metrics
- Processing throughput
- Error rates and latencies
- Infrastructure monitoring

---

## 🔍 Troubleshooting

### **Common Issues**

#### **No Data Showing**
```bash
# Check InfluxDB connection
curl http://localhost:8086/health

# Verify bucket exists
docker exec waf-influxdb influx bucket list

# Test query manually
docker exec waf-influxdb influx query 'from(bucket:"waf-realtime") |> range(start:-1h) |> limit(n:5)'
```

#### **Slow Dashboard Performance**
- Reduce query time ranges
- Increase refresh intervals
- Optimize Flux queries with proper filters
- Use data source caching

#### **Missing Geographic Data**
- Verify GeoIP database is loaded in realtime-processor
- Check latitude/longitude fields in InfluxDB
- Ensure country/city tags are populated

---

**💡 Tip**: All queries are designed for the currently operational `waf-realtime-events` topic and InfluxDB `waf-realtime` bucket.