# taskflow-api

Small **Node.js 20 + TypeScript + Express + PostgreSQL** API used as the case-study application for Jenkins labs.

## Endpoints

- `GET /health` — process health; does not require PostgreSQL
- `GET /ready` — checks PostgreSQL readiness
- `GET /tasks`
- `POST /tasks` with `{ "title": "Learn Jenkins" }`
- `PATCH /tasks/:id/done`
- `DELETE /tasks/:id`

## Setup

```bash
cp .env.example .env
npm install
npm run lint
npm test
npm run build
npm start
```

A local PostgreSQL instance is required for `/ready` and Task CRUD when running the real server.
The Jest tests inject a mocked service, so `npm test` does not require PostgreSQL.

## Why TypeScript?

The Jenkins manual requires Node.js 20, Express and PostgreSQL; it does not require JavaScript specifically. TypeScript keeps the same runtime stack while adding compile-time checks. `npm ci`, linting and Jest still fit the lab workflow.

## Important for the labs

This starter intentionally does **not** include a `Jenkinsfile`, Kubernetes manifests, Terraform, Ansible, SonarQube configuration, Playwright, or security-tool configuration. Those will be added when the corresponding lab asks for them.
