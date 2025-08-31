# 🛡️ WAF Dashboard - SaaS Web Management Dashboard

## 🎯 Project Overview

A complete SaaS solution that adds a **differentiated web management dashboard** to the existing WAF infrastructure.

### **Role Distribution**
- **Grafana (Port 3000)**: Real-time monitoring & technical metrics (for developers/engineers)
- **Next.js Dashboard (Port 3001)**: Business management & configuration (for administrators/executives)

## 🚀 Key Features

### **1. Google OAuth Social Login** ✅
- NextAuth.js-based Google social login
- Multi-tenant support ready
- Session-based authentication management

### **2. Real-time WAF Metrics Dashboard** ✅
- InfluxDB integration for real-time data visualization
- Attack detection statistics, block/allow ratios
- Interactive charts based on Material UI Charts
- Real-time data refresh capabilities
<!-- 
### **3. Custom WAF Rule Management** ⚠️ (Backend implemented, Frontend UI basic)
- ModSecurity rule CRUD operations
- Rule activation/deactivation
- Rule priority management
- Current status: Basic UI only implemented, actual ModSecurity integration needed

### **4. IP Whitelist Management** ⚠️ (Backend implemented, Frontend UI basic)
- IP address/subnet CRUD management
- CIDR notation support
- Current status: Basic UI only implemented, actual application logic needed

### **5. Real-time Alert System** ⚠️ (Partially implemented)
- Server-Sent Events (SSE) backend ready
- Severity-based alert classification structure
- Current status: Frontend real-time alert UI at basic level

### **6. WAF Log Viewing & Analysis** ⚠️ (Backend implemented, Frontend UI basic)
- Elasticsearch-integrated log search
- Current status: Basic UI only implemented, actual search/filtering features needed

### **7. Grafana Dashboard Integration** ✅
- Real-time charts display via iframe embed
- Technical metrics visualization
- Full-screen Grafana dashboard links -->

## 🏗️ Technology Stack

### **Backend** ✅
- **Spring Boot 3.2.2** (Java 21)
- **Multi-module structure**: `waf-dashboard-api`, `waf-social-api`, `waf-common-data`
- **Data sources**: Elasticsearch, InfluxDB, Redis
- **Real-time communication**: Server-Sent Events (SSE)
- **Implementation status**: All controllers and service layers complete

### **Frontend** ⚠️
- **Next.js 15** (React 19, TypeScript)
- **Authentication**: NextAuth.js + Google OAuth ✅
- **UI**: Material UI (MUI) + MUI X Charts ✅
- **State management**: React Hooks ✅
- **Current status**: Basic UI implemented, actual feature integration needed

### **Infrastructure Integration**
- **Grafana**: Real-time monitoring dashboard
- **Docker Compose**: Complete multi-service orchestration
- **Redis**: Session management
- **CORS**: Frontend-backend communication

## 📁 Project Structure

```
waf/
├── frontend/                    # Next.js dashboard
│   ├── src/app/
│   │   ├── dashboard/          # Main dashboard
│   │   │   ├── rules/          # Custom rule management ⚠️
│   │   │   ├── whitelist/      # IP whitelist ⚠️
│   │   │   ├── logs/           # WAF log viewing ⚠️
│   │   │   └── alerts/         # Real-time alerts ⚠️
│   │   ├── auth/signin/        # Google OAuth login ✅
│   │   └── api/auth/           # NextAuth API ✅
│   ├── src/components/ui/      # Material UI components ✅
│   ├── src/lib/               # Utilities (API client, auth) ✅
│   └── src/types/             # TypeScript type definitions ✅
│
├── backend/
│   ├── waf-dashboard-api/      # New dashboard API ✅
│   │   ├── src/main/java/kr/rojae/waf/dashboard/
│   │   │   ├── web/           # REST controllers ✅
│   │   │   ├── service/       # Business logic ✅
│   │   │   └── config/        # CORS configuration ✅
│   │   └── src/main/resources/application.yml ✅
│   ├── waf-social-api/        # Existing Google OAuth API ✅
│   └── waf-common-data/       # Shared DTO classes ✅
│
├── docker-compose.yml          # Existing WAF infrastructure
├── docker-compose.override.yml # Dashboard services added
└── README-DASHBOARD.md         # This file
```

## 🔧 Installation & Execution

### **1. Environment Setup**

```bash
# Google OAuth configuration
cp frontend/.env.local.example frontend/.env.local
# Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
```

### **2. Development Environment**

```bash
# Backend execution (port 8082)
cd backend
./gradlew :waf-dashboard-api:bootRun

# Frontend execution (port 3001) 
cd frontend
npm install
npm run dev
```

### **3. Full Infrastructure Execution**

```bash
# Run full WAF + dashboard
docker-compose up -d

# Service verification
- WAF Dashboard: http://localhost:3001
- Grafana: http://localhost:3000
- Dashboard API: http://localhost:8082
- Elasticsearch: http://localhost:9200
```

## 🔗 Service Ports

| Service | Port | Description |
|--------|------|------|
| Next.js Dashboard | 3001 | Administrator web dashboard |
| Grafana | 3000 | Real-time monitoring (for technical users) |
| Dashboard API | 8082 | Dashboard backend API |
| Social API | 8081 | Google OAuth API |
| Elasticsearch | 9200 | Log search engine |
| InfluxDB | 8086 | Real-time metrics DB |

## 🎨 UI/UX Features

### **Differentiated Web Dashboard**
- **Administrator-friendly**: Intuitive UI for business users, unlike Grafana
- **Configuration-focused**: Direct WAF configuration management via web
- **Real-time notifications**: Immediate alerts for important security events
- **Mobile responsive**: Responsive design based on Material UI

### **Grafana Integration**
- Real-time charts embedded via iframe
- Full-screen Grafana for detailed technical analysis
- Optimized user experience through role separation

## 🚀 Expansion Plans

### **Short-term Development** (Priority Order)
- [ ] **Frontend feature completion**: Actual integration with backend APIs
- [ ] **Real-time alert UI**: SSE integration and browser notifications
- [ ] **Log search functionality**: Elasticsearch query UI implementation
- [ ] **Advanced rule management**: Actual ModSecurity rule file integration
- [ ] **Whitelist application**: Actual nginx/ModSecurity configuration integration

### **Long-term Roadmap**
- [ ] AI-based threat analysis
- [ ] Automatic rule generation and optimization
- [ ] Automated compliance report generation
- [ ] Cloud deployment and scalability improvements

## 🔐 Security Considerations

- Google OAuth 2.0 standard compliance
- JWT token-based authentication
- CORS policy implementation
- Input validation and SQL injection protection
- Session management and automatic logout

## 📊 Current Implementation Status

### ✅ **Completed**
- Backend APIs (All controllers, services, repositories)
- Google OAuth authentication
- Basic frontend UI structure
- InfluxDB real-time dashboard integration
- Docker infrastructure integration

### ⚠️ **Partially Implemented**
- Frontend-backend API integration
- Real-time alert notifications
- Log search and filtering
- Rule management UI functionality
- Whitelist application logic

### ❌ **Not Implemented**
- Actual ModSecurity rule file modification
- Email/Slack notification integration
- Multi-tenant user management
- Automated rule deployment

---

**Development Status**: Next.js + Spring Boot based differentiated WAF management dashboard - Backend complete, Frontend basic implementation ✅