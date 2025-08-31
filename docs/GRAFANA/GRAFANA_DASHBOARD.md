# 📊 Grafana 대시보드 가이드

## 🎯 개요

WAF 실시간 모니터링을 위한 Grafana 대시보드 구성 및 쿼리 가이드입니다. InfluxDB 연동을 통해 실시간 보안 메트릭을 시각화합니다.

## 🏗️ 대시보드 아키텍처

### **데이터 소스 연결**
- **InfluxDB 버킷**: `waf-realtime`
- **메인 측정**: `waf_events`, `waf_requests`
- **업데이트 주기**: 1-5초 (실시간)
- **보존 정책**: 7일간 고해상도 데이터

### **대시보드 구성**
```
┌─────────────────────────────────────────────────────────────┐
│  🛡️ WAF Security Operations Center                         │
├─────────────────┬─────────────────┬─────────────────────────┤
│  📈 KPI 요약     │  🌍 글로벌 맵    │  🚨 실시간 알림          │
├─────────────────┴─────────────────┴─────────────────────────┤
│  📊 공격 트렌드 (시계열 차트)                               │
├─────────────────┬─────────────────┬─────────────────────────┤
│  🎯 공격 유형    │  🚫 심각도 분포  │  🔍 상위 공격자 IP       │
├─────────────────┴─────────────────┴─────────────────────────┤
│  📋 실시간 이벤트 로그 테이블                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 📈 핵심 KPI 패널

### **1. 보안 상태 요약**
```flux
// 📊 총 공격 수 (24시간)
from(bucket: "waf-realtime")
    |> range(start: -24h)
    |> filter(fn: (r) => r._measurement == "waf_events")
    |> filter(fn: (r) => r._field == "count")
    |> sum()
    |> map(fn: (r) => ({ _value: r._value, _time: now(), title: "Total Attacks" }))
```

```flux
// 🚫 차단 성공률 (24시간)
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

### **2. 실시간 처리 상태**
```flux
// ⚡ 초당 이벤트 처리량 (1분 평균)
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

## 🌍 지리적 위협 분석

### **3. 국가별 공격 통계 (세계지도)**
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

### **4. 실시간 공격 지도 (Geomap)**
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

## 📊 시계열 트렌드 분석

### **5. 공격 패턴 시계열 (시간별)**
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

### **6. 심각도별 분포 (파이 차트)**
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

### **7. 응답 코드 분석**
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

## 🚨 실시간 모니터링

### **8. 실시간 이벤트 스트림 (테이블)**
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

### **9. 상위 공격자 IP (막대 차트)**
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

### **10. 고위험 이벤트 알림 (Stat 패널)**
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

## ⚙️ 대시보드 설정

### **패널 유형 권장사항**

| 쿼리 목적 | 패널 유형 | 새로고침 주기 |
|-----------|-----------|---------------|
| KPI 요약 | Stat | 5s |
| 실시간 로그 | Table | 2s |
| 공격 트렌드 | Time series | 10s |
| 지리적 분포 | Geomap / Piechart | 30s |
| 상위 공격자 | Bar chart | 15s |
| 심각도 분포 | Pie chart | 30s |

### **색상 및 임계값 설정**

#### **심각도별 색상 코드**
```
🔴 Critical (80-100): Red (#FF0000)
🟠 High (60-79): Orange (#FF8C00) 
🟡 Medium (40-59): Yellow (#FFD700)
🟢 Low (0-39): Green (#32CD32)
```

#### **응답 코드별 색상**
```
🟢 2xx Success: Green
🟡 3xx Redirect: Yellow
🟠 4xx Client Error: Orange
🔴 5xx Server Error: Red
```

### **알림 규칙 설정**

#### **긴급 알림 조건**
- 초당 공격 수 > 100 (1분 지속)
- Critical 심각도 이벤트 > 10 (5분간)
- 차단 실패율 > 10% (10분간)
- 동일 IP 공격 > 50회 (5분간)

---

## 🔧 대시보드 구성 방법

### **1. InfluxDB 데이터 소스 추가**
```yaml
# Grafana Datasource 설정
- name: InfluxDB-WAF
  type: influxdb
  url: http://waf-influxdb:8086
  database: waf-realtime
  user: admin
  password: your-password
```

### **2. 변수 설정**
```
$country = query: SHOW TAG VALUES FROM "waf_events" WITH KEY = "country"
$severity = custom: critical,high,medium,low
$timerange = custom: 5m,15m,1h,6h,24h,7d
```

### **3. 패널 레이아웃 JSON**
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

## 📱 모바일 최적화

### **반응형 패널 크기**
```
Large Desktop (1920px+): 4-6 columns
Desktop (1200px-1919px): 3-4 columns  
Tablet (768px-1199px): 2-3 columns
Mobile (767px 이하): 1-2 columns
```

### **모바일 우선 메트릭**
1. 실시간 공격 수
2. 차단 성공률
3. 심각도 분포
4. 최근 이벤트 (최대 10개)

---

## 🎨 템플릿 다운로드

### **완성된 대시보드 파일**
- `WAF-Security-Overview.json`: 전체 보안 현황
- `WAF-Realtime-Monitoring.json`: 실시간 모니터링 전용
- `WAF-Geographic-Analysis.json`: 지리적 위협 분석
- `WAF-Performance-Metrics.json`: 성능 지표 중심

### **설치 방법**
1. Grafana 관리자 로그인
2. **Import Dashboard** 선택
3. JSON 파일 업로드 또는 내용 붙여넣기
4. InfluxDB 데이터 소스 선택
5. **Import** 클릭

---

**💡 팁**: 모든 쿼리는 현재 운영 중인 `waf-realtime-events` 토픽과 InfluxDB `waf-realtime` 버킷 기준으로 작성되었습니다.