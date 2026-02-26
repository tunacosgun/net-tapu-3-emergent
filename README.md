<div align="center">

# Net Tapu Platform — Real Estate & Online Auction System

<br/>

[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-DB-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-Cache-DC382D?style=for-the-badge&logo=redis&logoColor=white)](https://redis.io/)

<br/>

A modern **Real Estate & Land Sales Platform** featuring a comprehensive **Live Online Auction System**. Developed as a scalable monorepo, it seamlessly connects buyers, sellers, and agents with real-time bidding updates and secure transactions.

<br/>

[Features](#-features) · [Architecture](#-architecture) · [Getting Started](#-getting-started) · [Monorepo Structure](#-monorepo-structure)

</div>

<br/>

---

<br/>

## 🚀 Features

- **Real-Time Auctions**: WebSockets (Socket.IO) powered live bidding architecture for lands and property.
- **Scalable Monorepo**: Modern workspace structure separating `apps` (frontend/backend) and `packages` (shared logic).
- **Containerized Infrastructure**: Fully Dockerized environments (PostgreSQL, Redis, Nginx, App).
- **Advanced Load Testing**: Built-in performance and stress testing suites to ensure maximum auction reliability under high traffic.
- **Robust Database**: Solid relational DB schema via PostgreSQL with automated migration scripts.

<br/>

---

<br/>

## 🏗 Architecture

The platform follows a modern microservice-ready monorepo design pattern:

```text
net-tapu-platform/
├── apps/               # Independent applications (Backend API, Frontend Dashboard)
├── packages/           # Shared libraries, TS interfaces, and utilities
├── database/           # Schema, migrations, and seed scripts
├── load-tests/         # Stress testing tools for live auctions
├── nginx/              # Reverse proxy and load balancer configurations
├── scripts/            # Build and deploy automation
└── docker-compose.yml  # Container orchestration
```

<br/>

---

<br/>

## ⚡ Getting Started

The project guarantees a seamless developer experience with Docker Compose for local environments.

### Prerequisites
- Node.js >= 20.0.0
- Docker & Docker Compose
- Yarn / npm

### Quick Setup

```bash
# 1. Clone the repository
git clone https://github.com/tunacosgun/net-tapu-platform.git
cd net-tapu-platform

# 2. Install dependencies (Workspace aware)
npm install

# 3. Environment configuration
cp .env.example .env
# Edit .env with your local ports and secrets

# 4. Start Infrastructure Container (Database & Redis)
npm run db:up

# 5. Run Migrations
npm run db:migrate

# 6. Boot entire stack
npm run docker:up
```

You can cleanly shut down utilizing `npm run docker:down` or rebuild using `npm run docker:rebuild`.

<br/>

---

<br/>

## 🧪 Testing

Ensuring the live auction doesn't crash is mission-critical. Use our integrated load testing framework to simulate heavy bidding flow:

```bash
docker-compose -f docker-compose.loadtest.yml up --build
```

---

<div align="center">
<b>Built for high performance and real-time reliability.</b>
</div>
