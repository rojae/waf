📢 [1주차 과제 안내 - 기본 환경 구성]
📆 마감: 8월 10일(토) 온라인 회의 전까지
🕗 회의 일정: 매주 일요일 오후 8시

🎯 과제 목표
ModSecurity + OWASP CRS + Nginx를 Docker 기반으로 구성하고
WAF가 기본적으로 동작하는지 테스트하는 것이 이번 주 목표입니다.

🛠️ 과제 내용 요약
Docker 기반으로 ModSecurity + CRS + Nginx 환경 구성

로컬 포트로 웹서버 접속 가능하게 만들기 (예: http://localhost:8080/)

테스트용 요청 보내서 ModSecurity 로그 생성 확인

WAF 동작 여부 확인 (공격 시도 시 차단 메시지 또는 로그 발생)

🧱 구성 요소
Nginx (웹서버)

ModSecurity (WAF 엔진)

OWASP Core Rule Set (탐지 룰셋)

Docker / Docker Compose

⚙️ 설치 및 실행 Flow
# 1. 레포 클론 (예시)
git clone https://github.com/jasonish/docker-modsecurity.git
cd docker-modsecurity

# 2. Dockerfile, CRS 설정 확인
# 필요 시 crs-setup.conf, rules/ 폴더 구성 확인

# 3. docker-compose.yml 확인 및 실행
docker compose up -d

# 4. 브라우저 접속 (기본 포트 8080)
http://localhost:8080

# 5. 테스트 요청
curl -I "http://localhost:8080/?q=<script>alert(1)</script>"
# 또는 Postman, 브라우저 활용

# 6. 로그 확인
docker logs <container_id>
# 또는 /var/log/modsec_audit.log 등 확인

🧪 WAF 동작 확인 예시
공격 시도 요청 (<script> 등) 시 403 Forbidden 또는 ModSecurity 로그 발생

정상 요청은 그대로 통과
