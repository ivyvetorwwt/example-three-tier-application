# Services

This repository runs the following services:

## Docker Compose Services

1. **postgres** - PostgreSQL 17 database
   - Provides persistent data storage for the application
   - Runs on Alpine Linux for minimal footprint
   - Exposed internally to other services

2. **migrate** - Database migration service
   - Applies schema migrations using node-pg-migrate
   - Runs once on startup and exits after completion
   - Ensures database schema is up-to-date

3. **api** - Express REST API
   - Node.js 22 backend service
   - Handles business logic and database operations
   - Exposes endpoints on port 3001 (internal)

4. **web** - Next.js frontend
   - React 19 with Next.js 16 framework
   - User interface with Tailwind CSS
   - Exposed on port 3000 (accessible from host)

## Architecture

The services communicate in a three-tier architecture:
```
Browser → Web (Next.js :3000) → API (Express :3001) → PostgreSQL
```
