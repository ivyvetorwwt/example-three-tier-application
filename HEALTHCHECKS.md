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
