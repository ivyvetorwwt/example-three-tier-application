# Hierarchical Architecture Model (HAM)

This document describes the Hierarchical Architecture Model for this three-tier application. It explains how each layer is organized, what responsibilities it holds, and how data flows across tier boundaries.

## Overview

The application follows a classic three-tier architecture with strict hierarchical communication:

```
┌─────────────────────────────────────────────────────────────────────┐
│                         PRESENTATION TIER                          │
│                                                                     │
│   Browser ──────────────► Next.js (Web)                            │
│                           Port 3000                                 │
│                           src/web/                                  │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ HTTP (JSON)
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          APPLICATION TIER                          │
│                                                                     │
│                           Express (API)                             │
│                           Port 3001                                 │
│                           src/api/                                  │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ PostgreSQL Protocol
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                            DATA TIER                               │
│                                                                     │
│                           PostgreSQL 17                             │
│                           Port 5432                                 │
│                           src/db/ (migrations)                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Tier Responsibilities

### Tier 1: Presentation (Web)

| Aspect | Details |
|--------|---------|
| **Location** | `src/web/` |
| **Technology** | Next.js 16, React 19, Tailwind CSS |
| **Runtime** | Node.js 22 |
| **Port** | 3000 (exposed to host) |

**Responsibilities:**
- Render the user interface (server-side and client-side)
- Handle user interactions (form submissions, clicks)
- Validate user input at the UI level
- Call the API tier via server actions
- Manage client-side state and cache invalidation

**Key Files:**
- `app/page.tsx` — Main page component (server component)
- `app/actions.ts` — Server actions that call the API
- `app/layout.tsx` — Root layout with metadata

**Communication Pattern:**
- Receives HTTP requests from browsers
- Makes internal HTTP requests to the API tier
- Never communicates directly with the database

### Tier 2: Application (API)

| Aspect | Details |
|--------|---------|
| **Location** | `src/api/` |
| **Technology** | Express 5 |
| **Runtime** | Node.js 22 |
| **Port** | 3001 (internal only) |

**Responsibilities:**
- Expose RESTful endpoints for business operations
- Validate and sanitize incoming data
- Implement business logic and rules
- Translate between HTTP and database operations
- Handle errors and return appropriate status codes

**Key Files:**
- `index.js` — Route handlers and Express app
- `db.js` — PostgreSQL connection pool

**Endpoints:**
| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/tasks` | List all tasks |
| POST | `/tasks` | Create a task |
| PATCH | `/tasks/:id` | Update a task |

**Communication Pattern:**
- Receives HTTP requests only from the web tier (not exposed externally)
- Queries the database tier via connection pool
- Returns JSON responses

### Tier 3: Data (Database)

| Aspect | Details |
|--------|---------|
| **Location** | `src/db/` (migrations only) |
| **Technology** | PostgreSQL 17 |
| **Port** | 5432 (internal only) |

**Responsibilities:**
- Persist application data durably
- Enforce data integrity constraints
- Execute SQL queries efficiently
- Manage transactions and concurrency

**Schema:**
```sql
-- users table
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

-- tasks table
CREATE TABLE tasks (
  id SERIAL PRIMARY KEY,
  title VARCHAR(500) NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
```

**Communication Pattern:**
- Accepts connections only from the API tier
- Never exposed to the web tier or external clients

## Data Flow Examples

### Creating a Task

```
1. Browser: User submits form with task title
       │
       ▼
2. Web Tier: Server action receives FormData
   - Extracts title from form
   - Calls API via fetch()
       │
       ▼
3. API Tier: POST /tasks handler
   - Validates title is present and non-empty
   - Executes INSERT query
   - Returns created task as JSON
       │
       ▼
4. Web Tier: Receives response
   - Calls revalidatePath('/') to refresh cache
   - Returns to browser
       │
       ▼
5. Browser: Page re-renders with new task
```

### Listing Tasks

```
1. Browser: Requests page
       │
       ▼
2. Web Tier: Server component renders
   - Calls getTasks() server action
   - Fetches from API with cache: 'no-store'
       │
       ▼
3. API Tier: GET /tasks handler
   - Executes SELECT query
   - Returns array of tasks as JSON
       │
       ▼
4. Web Tier: Receives tasks
   - Renders task list as HTML
   - Sends complete page to browser
       │
       ▼
5. Browser: Displays rendered page
```

## Isolation Boundaries

Each tier is isolated from the others through well-defined boundaries:

### Network Isolation

| Tier | Exposed To | Hidden From |
|------|------------|-------------|
| Web | Host (port 3000) | — |
| API | Web tier only | Host, external networks |
| Database | API tier only | Web tier, host, external networks |

In Docker Compose, only the web service maps a port to the host. The API uses `expose` (internal only), and PostgreSQL has no port mapping.

### Configuration Boundary

All cross-tier communication uses environment variables:

| Variable | Used By | Purpose |
|----------|---------|---------|
| `API_URL` | Web | URL to reach the API tier |
| `DATABASE_URL` | API, Migrate | PostgreSQL connection string |
| `PORT` | Web, API | Port to listen on |

### Code Boundary

Each tier has its own:
- Directory (`src/web/`, `src/api/`, `src/db/`)
- Dockerfile
- Package dependencies
- Runtime process

No code is shared between tiers. The web tier cannot import from `src/api/`, and the API cannot import from `src/web/`.

## Deployment Model

### Local (Docker Compose)

```
┌─────────────────────────────────────────────────────────────────┐
│                     Docker Network                              │
│                                                                 │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────────┐ │
│  │   web   │───▶│   api   │───▶│ migrate │───▶│  postgres   │ │
│  │  :3000  │    │  :3001  │    │ (exits) │    │    :5432    │ │
│  └─────────┘    └─────────┘    └─────────┘    └─────────────┘ │
│       │                                              │         │
└───────┼──────────────────────────────────────────────┼─────────┘
        │                                              │
        ▼                                              ▼
   Host :3000                                   postgres_data
   (browser access)                             (persistent volume)
```

**Startup Order:**
1. `postgres` — Starts and waits until healthy
2. `migrate` — Runs migrations, then exits
3. `api` — Starts after migrations complete
4. `web` — Starts after API is running

### Production (GCP)

```
┌─────────────────────────────────────────────────────────────────┐
│                         Internet                                │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Cloud Run (Web)                            │
│                      Public URL                                 │
└───────────────────────────┬─────────────────────────────────────┘
                            │ VPC Connector
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                         VPC Network                             │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                   Cloud Run (API)                        │   │
│  │                   Internal only                          │   │
│  └─────────────────────────┬───────────────────────────────┘   │
│                            │ Private IP                         │
│  ┌─────────────────────────▼───────────────────────────────┐   │
│  │                   Cloud SQL                              │   │
│  │                   PostgreSQL 17                          │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

**GCP Resources:**
- VPC network with private subnet
- VPC Access Connector for Cloud Run → VPC communication
- Cloud SQL with private IP (no public access)
- Secret Manager for database credentials
- Service accounts with minimal IAM permissions

## Benefits of This Architecture

### Separation of Concerns
Each tier has a single, well-defined responsibility. The web tier handles presentation, the API handles business logic, and the database handles persistence.

### Independent Scaling
Each tier can scale independently based on its specific load patterns:
- Web tier: Scale for concurrent users
- API tier: Scale for request throughput
- Database: Scale for query load and storage

### Security in Depth
Multiple layers of isolation protect sensitive data:
- Database is never exposed to the internet
- API is only accessible from the web tier
- Credentials are managed via environment variables and secrets

### Technology Flexibility
Each tier can use the best technology for its purpose and can be replaced independently:
- Swap Next.js for another frontend framework
- Replace Express with a different API framework
- Migrate from PostgreSQL to another database

### Testability
Each tier can be tested in isolation:
- Web tier: Mock the API responses
- API tier: Mock the database or use a test database
- Database: Test migrations independently

## Related Documentation

- [README.md](./README.md) — Quick start and project overview
- [agents.md](./agents.md) — AI-assisted development guide
