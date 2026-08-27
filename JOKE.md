# Architecture & Features

## Overall Architecture

This is a **three-tier web application** demonstrating a modern, containerized full-stack architecture:

```
┌─────────────────────────────────────────────────────────────┐
│                         Browser                              │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  Frontend Tier (Next.js 16 + React 19)                      │
│  - Server-side rendering (SSR)                               │
│  - React Server Components                                   │
│  - Tailwind CSS styling                                      │
│  - Port: 3000 (exposed to host)                             │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP (internal)
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  API Tier (Express 5 + Node.js 22)                          │
│  - RESTful API endpoints                                     │
│  - JSON request/response                                     │
│  - Database connection pooling                               │
│  - Port: 3001 (internal only)                               │
└────────────────────────┬────────────────────────────────────┘
                         │ PostgreSQL protocol
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  Database Tier (PostgreSQL 17)                              │
│  - Relational data storage                                   │
│  - Schema migrations via node-pg-migrate                     │
│  - Persistent volume storage                                 │
│  - Port: 5432 (internal only)                               │
└─────────────────────────────────────────────────────────────┘
```

### Technology Stack

| Layer          | Technology                    | Purpose                                    |
|----------------|-------------------------------|--------------------------------------------|
| **Frontend**   | Next.js 16, React 19          | UI rendering, server components            |
| **Styling**    | Tailwind CSS                  | Utility-first CSS framework                |
| **API**        | Express 5, Node.js 22         | REST API, business logic                   |
| **Database**   | PostgreSQL 17                 | Data persistence                           |
| **Migrations** | node-pg-migrate               | Database schema versioning                 |
| **Container**  | Docker + Docker Compose       | Local development environment              |
| **Cloud**      | GCP (Cloud Run + Cloud SQL)   | Production deployment                      |
| **IaC**        | Terraform                     | Infrastructure provisioning                |

### Deployment Environments

#### Local Development (Docker Compose)
- All three tiers run as separate containers
- PostgreSQL data persists in a Docker volume
- Hot reload enabled for development
- Services orchestrated with health checks and dependencies

#### Production (Google Cloud Platform)
- **Frontend**: Cloud Run (serverless containers)
- **API**: Cloud Run (serverless containers)
- **Database**: Cloud SQL (managed PostgreSQL)
- **Networking**: VPC with private IP for database
- **Secrets**: Secret Manager for database credentials
- **IAM**: Service accounts with least-privilege access

---

## Main Features

### 1. **Task Management (To-Do List)**
The application implements a simple but complete task management system:

- ✅ **Create tasks** - Add new to-do items with a title
- ✅ **List tasks** - View all tasks ordered by creation date
- ✅ **Toggle completion** - Mark tasks as complete/incomplete
- ✅ **Persistent storage** - All tasks saved to PostgreSQL database
- ✅ **Real-time updates** - Server-side rendering ensures fresh data

### 2. **Modern Frontend Architecture**
- **React Server Components** - Fetch data on the server, reducing client-side JavaScript
- **Server Actions** - Form submissions handled server-side without API routes
- **Dark mode support** - Automatic theme switching based on system preferences
- **Responsive design** - Mobile-first layout with Tailwind CSS
- **Accessibility** - Semantic HTML and ARIA labels

### 3. **RESTful API**
Clean, predictable API endpoints:

| Method | Endpoint      | Description                          | Request Body                    |
|--------|---------------|--------------------------------------|---------------------------------|
| GET    | `/health`     | Health check                         | -                               |
| GET    | `/tasks`      | List all tasks                       | -                               |
| POST   | `/tasks`      | Create a new task                    | `{ "title": "..." }`            |
| PATCH  | `/tasks/:id`  | Update task (complete/rename)        | `{ "completed": true/false }`   |

### 4. **Database Schema Management**
- **Versioned migrations** - All schema changes tracked in code
- **Automated migration** - Runs automatically on container startup
- **Rollback support** - Can revert migrations if needed
- **Schema versioning** - Migrations numbered with timestamps

Current schema:
```sql
tasks (
  id          SERIAL PRIMARY KEY,
  title       VARCHAR(500) NOT NULL,
  completed   BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMP NOT NULL DEFAULT now()
)
```

### 5. **Container Orchestration**
Docker Compose manages service dependencies:

1. **postgres** - Starts first, waits until healthy
2. **migrate** - Runs migrations, exits when complete
3. **api** - Starts after migrations succeed
4. **web** - Starts after API is running

### 6. **Infrastructure as Code**
Terraform provisions complete GCP infrastructure:

- VPC network with custom subnet
- Cloud SQL PostgreSQL instance (private IP)
- Cloud Run services for API and web
- Secret Manager for database credentials
- IAM roles and service accounts
- Outputs for deployed URLs

### 7. **Production-Ready Features**
- **Health checks** - API health endpoint for monitoring
- **Error handling** - Validation and 404/400 responses
- **Connection pooling** - Efficient database connections
- **Environment variables** - Configuration via env vars
- **Logging** - Console logging for debugging
- **Security** - Database not exposed to public internet

### 8. **Developer Experience**
- **Single command startup** - `docker compose up --build`
- **Hot reload** - Code changes reflected immediately
- **Clean shutdown** - `docker compose down`
- **Data persistence** - Database survives container restarts
- **Easy cleanup** - `docker compose down -v` removes all data

---

## Data Flow Example

### Creating a Task

1. **User** types "Buy groceries" and clicks "Add"
2. **Frontend** (Next.js) submits form via Server Action
3. **Server Action** calls API: `POST http://api:3001/tasks`
4. **API** (Express) validates request and inserts into database
5. **Database** (PostgreSQL) stores task and returns new row
6. **API** returns JSON: `{ "id": 1, "title": "Buy groceries", "completed": false, ... }`
7. **Frontend** revalidates and re-renders with new task
8. **Browser** displays updated task list

### Toggling Task Completion

1. **User** clicks checkbox next to task
2. **Frontend** submits form via inline Server Action
3. **Server Action** calls API: `PATCH http://api:3001/tasks/1`
4. **API** updates `completed` field in database
5. **Database** returns updated row
6. **Frontend** revalidates and re-renders
7. **Browser** shows task with strikethrough and checkmark

---

## Why This Architecture?

### Separation of Concerns
- **Frontend** focuses on UI/UX
- **API** handles business logic and data validation
- **Database** manages data persistence

### Scalability
- Each tier can scale independently
- Cloud Run auto-scales based on traffic
- Database can be upgraded without touching app code

### Maintainability
- Clear boundaries between layers
- Easy to test each tier in isolation
- Technology choices can be swapped per tier

### Portability
- Runs identically on any machine with Docker
- Same containers used locally and in production
- Infrastructure defined as code for reproducibility
