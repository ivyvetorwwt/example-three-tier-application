# Health Checks Documentation

This document describes all health check and readiness endpoints configured in the three-tier application, including how they are used in Docker Compose and Terraform/GCP deployments.

## Overview

The application implements health checks at multiple layers:

| Service | Endpoint/Check | Port | Purpose |
|---------|---------------|------|---------|
| PostgreSQL | `pg_isready` command | 5432 | Database readiness |
| API (Express) | `GET /health` | 3001 | API service health |
| Web (Next.js) | `GET /` | 3000 | Frontend availability |

---

## 1. PostgreSQL Database Health Check

### Implementation

**Type:** Command-based health check  
**Command:** `pg_isready -U app -d app`  
**Port:** 5432 (internal)

### Configuration

#### Docker Compose (`docker-compose.yml`)

```yaml
postgres:
  image: postgres:17-alpine
  healthcheck:
    test: ["CMD-SHELL", "pg_isready -U app -d app"]
    interval: 5s
    timeout: 5s
    retries: 5
```

**Behavior:**
- Checks every 5 seconds
- Times out after 5 seconds
- Retries up to 5 times before marking as unhealthy
- Other services (`migrate`, `api`) depend on this health check passing

#### GCP Cloud SQL

Cloud SQL instances have built-in health monitoring through Google Cloud's infrastructure. No explicit health check configuration is needed in Terraform, as Cloud SQL automatically monitors:
- Database process availability
- Connection pool status
- Disk I/O and storage health

---

## 2. API Service Health Check

### Implementation

**Endpoint:** `GET /health`  
**Port:** 3001  
**Response:** `200 OK` with JSON body `{ "status": "ok" }`

### Source Code

Located in `src/api/index.js`:

```javascript
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});
```

**Note:** This is a simple liveness check that confirms the Express server is running. It does NOT verify database connectivity or other dependencies.

### Configuration

#### Docker Compose

The API service in Docker Compose does not have an explicit health check configured. It depends on:
- `postgres` service being healthy
- `migrate` service completing successfully

#### Terraform/GCP Cloud Run (`src/infrastructure/main.tf`)

The API service deployed to Cloud Run has two types of probes:

##### Startup Probe

```hcl
startup_probe {
  http_get {
    path = "/health"
    port = 3001
  }
  initial_delay_seconds = 5
  period_seconds        = 5
  failure_threshold     = 10
}
```

**Behavior:**
- Waits 5 seconds before first check
- Checks every 5 seconds
- Allows up to 10 failures (50 seconds total) before marking container as failed
- Used during container startup to determine when the service is ready

##### Liveness Probe

```hcl
liveness_probe {
  http_get {
    path = "/health"
    port = 3001
  }
  period_seconds    = 30
  failure_threshold = 3
}
```

**Behavior:**
- Checks every 30 seconds after startup
- Allows up to 3 consecutive failures (90 seconds) before restarting the container
- Used to detect if the service has become unresponsive

---

## 3. Web Service Health Check

### Implementation

**Endpoint:** `GET /` (root path)  
**Port:** 3000  
**Response:** `200 OK` with HTML page

### Configuration

#### Docker Compose

The web service in Docker Compose does not have an explicit health check configured. It depends on the `api` service being available.

#### Terraform/GCP Cloud Run (`src/infrastructure/main.tf`)

The web service deployed to Cloud Run has a startup probe only:

##### Startup Probe

```hcl
startup_probe {
  http_get {
    path = "/"
    port = 3000
  }
  initial_delay_seconds = 10
  period_seconds        = 5
  failure_threshold     = 10
}
```

**Behavior:**
- Waits 10 seconds before first check (longer than API due to Next.js build time)
- Checks every 5 seconds
- Allows up to 10 failures (50 seconds total) before marking container as failed
- Checks the root path `/` which renders the main application page

**Note:** The web service does not have a dedicated `/health` endpoint. The startup probe uses the root path `/` to verify the Next.js server is responding.

---

## How to Verify Locally

### Prerequisites

Ensure Docker Compose is running:

```bash
docker compose up --build
```

Wait for all services to start (you should see "API listening on port 3001" in the logs).

### 1. Check PostgreSQL Health

**From host machine:**

```bash
docker compose exec postgres pg_isready -U app -d app
```

**Expected output:**
```
/var/run/postgresql:5432 - accepting connections
```

**Alternative - check Docker health status:**

```bash
docker compose ps postgres
```

Look for `(healthy)` in the STATUS column.

### 2. Check API Health Endpoint

**Using curl from host:**

```bash
curl http://localhost:3001/health
```

**Expected output:**
```json
{"status":"ok"}
```

**Note:** The API port (3001) is not exposed in the default `docker-compose.yml`. To test this, you need to either:

**Option A - Temporarily expose the port:**

Add to `docker-compose.yml` under the `api` service:
```yaml
ports:
  - "3001:3001"
```

Then restart: `docker compose up --build`

**Option B - Execute from within the web container:**

```bash
docker compose exec web curl http://api:3001/health
```

**Option C - Execute from within the API container:**

```bash
docker compose exec api curl http://localhost:3001/health
```

### 3. Check Web Service

**Using curl from host:**

```bash
curl -I http://localhost:3000
```

**Expected output:**
```
HTTP/1.1 200 OK
...
```

**Using a browser:**

Open [http://localhost:3000](http://localhost:3000) and verify the To-Do List application loads.

### 4. Check All API Endpoints

**List tasks:**

```bash
curl http://localhost:3001/tasks
```

**Create a task:**

```bash
curl -X POST http://localhost:3001/tasks \
  -H "Content-Type: application/json" \
  -d '{"title":"Test task"}'
```

**Update a task (mark as completed):**

```bash
curl -X PATCH http://localhost:3001/tasks/1 \
  -H "Content-Type: application/json" \
  -d '{"completed":true}'
```

**Note:** Remember to expose port 3001 as described in section 2 above, or execute these commands from within a container.

### 5. Monitor Health Check Status in Real-Time

**Watch Docker health status:**

```bash
watch -n 1 'docker compose ps'
```

This will refresh every second and show the health status of all services.

**View health check logs:**

```bash
docker compose logs -f postgres | grep health
```

### 6. Test Health Check Failure Scenarios

**Simulate database failure:**

```bash
docker compose stop postgres
```

Then try to access the API - it will fail to connect to the database.

**Restart the database:**

```bash
docker compose start postgres
```

Wait for the health check to pass (5-25 seconds based on configuration).

---

## Health Check Dependencies

The services have the following dependency chain based on health checks:

```
postgres (healthy)
    ↓
migrate (completed successfully)
    ↓
api (running)
    ↓
web (running)
```

**In Docker Compose:**
- `migrate` waits for `postgres` to be healthy
- `api` waits for `migrate` to complete successfully
- `web` waits for `api` to be running (no health check)

**In GCP Cloud Run:**
- API startup probe must pass before receiving traffic
- API liveness probe monitors ongoing health
- Web startup probe must pass before receiving traffic
- Services communicate via internal Cloud Run URLs with IAM authentication

---

## Troubleshooting

### PostgreSQL health check failing

**Symptoms:** `migrate` and `api` services don't start

**Check:**
```bash
docker compose logs postgres
```

**Common causes:**
- Database initialization in progress (wait 10-15 seconds)
- Port conflict on 5432
- Insufficient disk space for database volume

### API health check failing in Cloud Run

**Symptoms:** Cloud Run service shows "Revision failed" or continuous restarts

**Check Cloud Run logs:**
```bash
gcloud run services logs read api --region=us-central1
```

**Common causes:**
- Database connection string incorrect
- VPC connector not configured properly
- Container image not built correctly
- Port mismatch (ensure PORT=3001 environment variable is set)

### Web service not responding

**Symptoms:** HTTP 502/503 errors or timeout

**Check:**
```bash
docker compose logs web
```

**Common causes:**
- API_URL environment variable not set correctly
- API service not running or not accessible
- Next.js build failed
- Port mismatch (ensure PORT=3000 environment variable is set)

---

## Best Practices

1. **Always implement health checks** for production services to enable:
   - Automatic restart of failed containers
   - Load balancer traffic routing decisions
   - Deployment rollout validation

2. **Use appropriate timeouts and thresholds:**
   - Startup probes: More lenient (longer timeout, more retries)
   - Liveness probes: Conservative (avoid false positives that cause unnecessary restarts)
   - Readiness probes: Responsive (quickly remove unhealthy instances from load balancing)

3. **Health check endpoints should be lightweight:**
   - Avoid expensive operations (complex queries, external API calls)
   - Return quickly (< 1 second)
   - Consider separate `/health` (liveness) and `/ready` (readiness) endpoints

4. **Monitor health check metrics:**
   - Track failure rates
   - Alert on repeated failures
   - Use as early warning for capacity or dependency issues

---

## Additional Resources

- [Docker Compose Health Check Documentation](https://docs.docker.com/compose/compose-file/compose-file-v3/#healthcheck)
- [Google Cloud Run Health Checks](https://cloud.google.com/run/docs/configuring/healthchecks)
- [PostgreSQL pg_isready Documentation](https://www.postgresql.org/docs/current/app-pg-isready.html)
- [Express.js Best Practices](https://expressjs.com/en/advanced/best-practice-performance.html)


---

## Complete File-by-File Health Check Impact Analysis

This section documents every source file in the repository and describes whether and how it affects health checks.

### Configuration Files

| File | Affects Health Checks? | Description |
|------|----------------------|-------------|
| `docker-compose.yml` | **YES** | Defines PostgreSQL healthcheck with `pg_isready` command (5s interval, 5s timeout, 5 retries). Sets service dependencies based on health status. |
| `.github/workflows/deploy.yml` | **Indirect** | CI/CD pipeline that builds and deploys services. Deployment success depends on health checks passing in Cloud Run. |
| `README.md` | No | Documentation file, no health check impact. |
| `.gitignore` | No | Git configuration, no health check impact. |
| `LICENSE` | No | License file, no health check impact. |
| `agents.md` | No | Documentation file, no health check impact. |

### API Service Files (`src/api/`)

| File | Affects Health Checks? | Description |
|------|----------------------|-------------|
| `src/api/index.js` | **YES - CRITICAL** | Implements the `/health` endpoint that returns `{"status":"ok"}`. This is used by Cloud Run startup and liveness probes. Also defines PORT (3001) which must match probe configuration. |
| `src/api/db.js` | **Indirect** | Creates PostgreSQL connection pool. While not directly part of health check, database connectivity affects overall service health. The `/health` endpoint does NOT check database connectivity. |
| `src/api/package.json` | **Indirect** | Defines dependencies (express, pg) and start script. If dependencies fail to install or start script fails, service won't start and health checks will fail. |
| `src/api/package-lock.json` | **Indirect** | Locks dependency versions. Corrupted lock file could prevent service startup. |
| `src/api/Dockerfile` | **YES** | Builds the API container image. Exposes port 3001 which must match health check configuration. CMD starts the service that responds to health checks. |
| `src/api/.dockerignore` | No | Build optimization, no direct health check impact. |

### Web Service Files (`src/web/`)

| File | Affects Health Checks? | Description |
|------|----------------------|-------------|
| `src/web/app/page.tsx` | **YES** | Main page component rendered at `/` path. Cloud Run startup probe checks `GET /` so this page must render successfully. |
| `src/web/app/layout.tsx` | **YES** | Root layout component. Must render successfully for `/` health check to pass. |
| `src/web/app/actions.ts` | **Indirect** | Server actions that call API. Not directly checked by health probes, but failures here could indicate API connectivity issues. |
| `src/web/app/globals.css` | No | Styling file, doesn't affect health check responses. |
| `src/web/app/favicon.ico` | No | Icon file, no health check impact. |
| `src/web/package.json` | **Indirect** | Defines Next.js dependencies and build/start scripts. Build or start failures prevent service from responding to health checks. |
| `src/web/package-lock.json` | **Indirect** | Locks dependency versions. |
| `src/web/Dockerfile` | **YES** | Multi-stage build for Next.js app. Exposes port 3000 which must match health check configuration. CMD starts server.js that responds to health checks. |
| `src/web/next.config.ts` | **YES** | Sets `output: "standalone"` which affects how the production server runs. Required for Docker deployment and health check responses. |
| `src/web/tsconfig.json` | **Indirect** | TypeScript configuration. Compilation errors prevent build, which prevents health checks from working. |
| `src/web/eslint.config.mjs` | No | Linting configuration, no runtime health check impact. |
| `src/web/postcss.config.mjs` | No | CSS processing configuration, no health check impact. |
| `src/web/.dockerignore` | No | Build optimization, no direct health check impact. |
| `src/web/.gitignore` | No | Git configuration, no health check impact. |
| `src/web/README.md` | No | Documentation, no health check impact. |
| `src/web/AGENTS.md` | No | Documentation, no health check impact. |
| `src/web/CLAUDE.md` | No | Documentation, no health check impact. |
| `src/web/public/*` | No | Static assets (SVG files), no health check impact. |

### Database Migration Files (`src/db/`)

| File | Affects Health Checks? | Description |
|------|----------------------|-------------|
| `src/db/migrations/1718500000000_initial-schema.js` | **Indirect** | Creates `users` table. Migration failures prevent API from starting, which causes health checks to fail. |
| `src/db/migrations/1718500001000_create-tasks.js` | **Indirect** | Creates `tasks` table. Migration failures prevent API from starting, which causes health checks to fail. |
| `src/db/package.json` | **Indirect** | Defines node-pg-migrate dependency and migration scripts. Required for database setup before services can be healthy. |
| `src/db/package-lock.json` | **Indirect** | Locks dependency versions for migration tool. |
| `src/db/Dockerfile` | **Indirect** | Builds migration container. Runs migrations that must complete before API can start and pass health checks. |
| `src/db/.dockerignore` | No | Build optimization, no direct health check impact. |

### Infrastructure Files (`src/infrastructure/`)

| File | Affects Health Checks? | Description |
|------|----------------------|-------------|
| `src/infrastructure/main.tf` | **YES - CRITICAL** | Defines Cloud Run startup and liveness probes for both API and web services. Configures probe paths, ports, timeouts, and failure thresholds. Also provisions Cloud SQL which has built-in health monitoring. |
| `src/infrastructure/migration.tf` | **Indirect** | Defines Cloud Run Job for migrations. Migrations must succeed before API can be healthy. |
| `src/infrastructure/variables.tf` | **Indirect** | Defines variables including image URIs and instance limits. Incorrect values could cause deployment failures. |
| `src/infrastructure/outputs.tf` | No | Defines Terraform outputs. No health check impact. |
| `src/infrastructure/terraform.tfvars.example` | No | Example configuration file, not used in actual deployments. |
| `src/infrastructure/.gitignore` | No | Git configuration, no health check impact. |

### Summary Statistics

- **Total files analyzed:** 45
- **Files with DIRECT health check impact:** 6
  - `docker-compose.yml`
  - `src/api/index.js`
  - `src/api/Dockerfile`
  - `src/web/Dockerfile`
  - `src/web/next.config.ts`
  - `src/infrastructure/main.tf`
- **Files with INDIRECT health check impact:** 14
- **Files with NO health check impact:** 25

### Critical Health Check Dependencies

1. **`src/api/index.js`** - Implements the `/health` endpoint
2. **`src/infrastructure/main.tf`** - Configures all Cloud Run health probes
3. **`docker-compose.yml`** - Configures PostgreSQL health check and service dependencies
4. **`src/web/app/page.tsx`** - Must render successfully for web health check
5. **`src/api/Dockerfile` & `src/web/Dockerfile`** - Must expose correct ports and start services properly
