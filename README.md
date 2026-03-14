# Banking RPA POC

> A proof-of-concept demonstrating RPA automation of a legacy banking CRM — orchestrated via n8n workflows and surfaced on an Apache Cordova mobile app.

---

## 🏗️ Architecture

```
┌─────────────────┐     JWT      ┌──────────────────┐     HTTP      ┌─────────────────┐
│  Cordova Mobile │ ──────────▶  │   n8n Workflows  │ ──────────▶  │   RPA Service   │
│   (port 8080)   │              │   (port 5678)    │              │   (port 3002)   │
└─────────────────┘              └──────────────────┘              └────────┬────────┘
                                                                            │ Playwright
                                                                            ▼
                                                                   ┌─────────────────┐
                                                                   │   Mock Legacy   │
                                                                   │   CRM (HTML)    │
                                                                   │   (port 3001)   │
                                                                   └─────────────────┘
```

**Key design decisions:**
- The CRM has **no API** — Playwright drives it like a real user (clicks, form fills, navigation)
- n8n acts as the **orchestration layer** — visual workflows with full audit trail
- The mobile app **falls back** to direct RPA calls if n8n is unavailable
- JWT auth with HMAC-SHA256 signature verification on all API calls

---

## 🚀 Run Locally

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running
- [Node.js 18+](https://nodejs.org/)
- Git

### 1. Clone and configure

```bash
git clone <repo-url>
cd bank_automation_rpa
cp env.example .env
```

The defaults in `env.example` work as-is — no changes needed for local dev.

### 2. Start all backend services

```bash
docker compose up --build
```

This starts 3 services:

| Service | URL | Purpose |
|---|---|---|
| Mock Legacy CRM | http://localhost:3001 | HTML-only banking CRM (no API) |
| RPA Service | http://localhost:3002/health | Playwright automation wrapper |
| n8n Orchestrator | http://localhost:5678 | Workflow engine |

Wait for all 3 to show `healthy` (~30 seconds).

### 3. Start the mobile app

```bash
cd mobile
npm install
npx cordova run browser
```

App opens at **http://localhost:8080**

### 4. Log in

| Field | Value |
|---|---|
| Username | `admin` |
| Password | `demo123!@#$` |

---

## 🎬 What to Demo

1. **Search** — enter a name or account number to find a customer
2. **View detail** — see the customer's full profile pulled live from the CRM via RPA
3. **Edit** — update a field (phone, email, status, notes) — Playwright fills the CRM form in the background
4. **History** — view the customer's full activity log extracted from the CRM

To see the **n8n workflow visually:**
- Go to http://localhost:5678 → login: `admin` / `n8npass!@#$`
- Import the 3 workflow files from `services/n8n/workflows/*.json`
- Activate each workflow → trigger actions in the mobile app → watch the execution log

---

## 🧪 Run Tests

With Docker services running:

```bash
# Phase 1 — RPA automation (8 tests)
cd services/rpa && node src/test-rpa.js

# Phase 2 — n8n orchestration (9 tests)
cd services/n8n && node test-n8n.js

# Phase 3 — Mobile app, headless browser (10 tests)
cd mobile && node test-app.js

# Phase 4 — Security + end-to-end (11 tests)
node test-security.js
```

**38 tests across 4 phases — all passing.**

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Mobile app | Apache Cordova (browser platform), vanilla JS |
| Orchestration | n8n (self-hosted) |
| RPA engine | Playwright (Node.js) |
| Mock CRM | Express.js + EJS (HTML forms, no API) |
| Auth | JWT with HMAC-SHA256 signature verification |
| Containers | Docker + Docker Compose |

---

## 📁 Project Structure

```
bank_automation_rpa/
├── services/
│   ├── mock-crm/       # Legacy CRM simulator (Express/EJS)
│   ├── rpa/            # Playwright RPA service + tests
│   └── n8n/            # n8n mock server, workflow JSONs + tests
├── mobile/             # Cordova app (www/ + tests)
├── docs/               # Steering doc, architecture, guides
├── docker-compose.yml  # Full local stack
└── env.example         # Environment variable template
```

---