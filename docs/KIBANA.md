# Kibana
- 이 문서는 `Kibana` UI에 대한 Custom Setting에 대한 기록용 문서입니다.
- 사전에 Index 생성이 필요합니다. (`waf-modsec-*`)
- 아래 내용을 통해서, 일정의 `custom runtime field` 혹은 `dashboard` 생성이 가능합니다.

## Runtime field
(Location) Kibana : Data views -> waf-logs-* -> Add field

### status
```java
def s = 0L;   // long으로 초기화
if (doc.containsKey('modsec.status') && !doc['modsec.status'].empty) {
  s = doc['modsec.status'].value;
} else if (doc.containsKey('status') && !doc['status'].empty) {
  s = doc['status'].value;
}
if (s >= 400) {
  emit("blocked");
} else {
  emit("allowed");
}
```

### attack keyword
```java
for (def t : doc['transaction.messages.details.tags.keyword']) {
  if (t.startsWith('OWASP_CRS/ATTACK-')) {
    emit(t.substring('OWASP_CRS/'.length()));
  }
}
```

---

## Dashboard

### Total Count
```kql
count()
```

### Blocked Request
```kql
count(kql='status_bucket : "blocked"')
```

### Allowed Rate(%)
```kql
count(kql='status_bucket : "allowed"') / count()
```

### Block Rate(%)
```kql
count(kql='status_bucket : "blocked"') / count()
```