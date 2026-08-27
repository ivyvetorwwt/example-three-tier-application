# Contributing to example-three-tier-application

Thank you for your interest in contributing! This guide will help you get started with local development.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Docker Desktop** (or Docker Engine + Compose plugin) - [Download here](https://www.docker.com/products/docker-desktop/)
- **Git** - For version control
- **Node.js 22** (optional) - Only needed if you want to run services outside Docker

## Local Development Setup

### 1. Clone the repository

```bash
git clone https://github.com/ivyvetorwwt/example-three-tier-application.git
cd example-three-tier-application
```

### 2. Start the application

The entire stack runs with a single command:

```bash
docker compose up --build
```

This will:
- Start PostgreSQL database on port 5432 (internal)
- Run database migrations automatically
- Start the Express API on port 3001 (internal)
- Start the Next.js frontend on port 3000 (exposed to host)

### 3. Access the application

Once all services are running, open your browser to:

**http://localhost:3000**

The application is a simple task manager where you can create and manage to-do items.

### 4. Making changes

The application is organized into three main directories:

- **`src/web/`** - Next.js frontend (React 19, TypeScript, Tailwind CSS)
- **`src/api/`** - Express REST API (Node.js 22)
- **`src/db/`** - Database migrations (node-pg-migrate)

After making code changes, rebuild and restart:

```bash
docker compose up --build
```

### 5. Stop the application

```bash
# Stop containers (preserves database data)
docker compose down

# Stop and remove all data including the database
docker compose down -v
```

## Development Workflow

### Working on the Frontend (Next.js)

The frontend code is in `src/web/`. Key files:
- `app/page.tsx` - Main page component
- `app/layout.tsx` - Root layout
- `package.json` - Dependencies and scripts

To run linting:
```bash
cd src/web
npm install
npm run lint
```

### Working on the API (Express)

The API code is in `src/api/`. Key files:
- `index.js` - Route handlers and server setup
- `db.js` - PostgreSQL connection pool
- `package.json` - Dependencies

The API exposes these endpoints:
- `GET /health` - Health check
- `GET /tasks` - List all tasks
- `POST /tasks` - Create a task
- `PATCH /tasks/:id` - Update a task

### Working on Database Migrations

Migrations are in `src/db/migrations/`. To create a new migration:

```bash
cd src/db
npm install
DATABASE_URL=postgres://app:app@localhost:5432/app npx node-pg-migrate create my-migration-name
```

Edit the generated file in `migrations/`, then apply it:

```bash
docker compose up migrate
```

## Project Structure

```
example-three-tier-application/
├── src/
│   ├── api/              # Express REST API
│   │   ├── index.js      # Route handlers
│   │   ├── db.js         # Database connection
│   │   ├── package.json
│   │   └── Dockerfile
│   ├── web/              # Next.js frontend
│   │   ├── app/          # App Router pages
│   │   ├── package.json
│   │   └── Dockerfile
│   ├── db/               # Database migrations
│   │   ├── migrations/   # Migration files
│   │   ├── package.json
│   │   └── Dockerfile
│   └── infrastructure/   # Terraform for GCP
├── docker-compose.yml    # Local development stack
└── README.md             # Project documentation
```

## Submitting Changes

1. **Create a new branch** for your changes:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** and test locally with Docker Compose

3. **Commit your changes** with a clear message:
   ```bash
   git add .
   git commit -m "Add feature: description of your changes"
   ```

4. **Push your branch** to GitHub:
   ```bash
   git push origin feature/your-feature-name
   ```

5. **Open a Pull Request** on GitHub with a description of your changes

## Troubleshooting

### Port already in use

If port 3000 or 5432 is already in use:
```bash
# Find and stop the process using the port
lsof -ti:3000 | xargs kill -9
```

Or modify the port mapping in `docker-compose.yml`.

### Database connection issues

If the API can't connect to the database:
```bash
# Check if postgres is healthy
docker compose ps

# View postgres logs
docker compose logs postgres

# Restart the stack
docker compose down -v
docker compose up --build
```

### Containers won't start

```bash
# Clean up everything and start fresh
docker compose down -v
docker system prune -f
docker compose up --build
```

## Questions or Issues?

If you encounter any problems or have questions:
- Check the [README.md](README.md) for detailed documentation
- Open an issue on GitHub
- Review existing issues for similar problems

Thank you for contributing! 🎉
