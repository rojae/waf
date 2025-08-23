## 초고카디널리티 태그
현재 라인프로토콜에서 client_ip(그리고 uri, rule_id)가 tag로 들어가면 series cardinality 폭증
-> 메모리/인덱스 압박 -> 질의/압축/GC가 급격히 느려짐.