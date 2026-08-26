# Testing Notes

This document describes how to run the test suite for the three-tier application.

## Overview

The application consists of three main components:
- **Web** (Next.js frontend) - `src/web/`
- **API** (Express backend) - `src/api/`
- **Database** (PostgreSQL) - `src/db/`

## Prerequisites

- [Node.js 22](https://nodejs.org/) or later
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (for integration tests)
- npm (comes with Node.js)

## Running Tests

### Web Frontend Tests

The web frontend uses Next.js with ESLint for code quality checks.

```bash
cd src/web
npm install
npm run lint
```

To run the linter with auto-fix:

```bash
cd src/web
npm run lint -- --fix
```

### API Tests

Currently, the API has a placeholder test script. To run it:

```bash
cd src/api
npm install
npm test
```

**Note:** The current test script is a placeholder. To add proper tests, consider using:
- [Jest](https://jestjs.io/) for unit testing
- [Supertest](https://github.com/ladjs/supertest) for API endpoint testing

### Database Migration Tests

To verify database migrations work correctly:

```bash
# Start PostgreSQL with Docker Compose
docker compose up -d postgres

# Wait for PostgreSQL to be ready
docker compose exec postgres pg_isready -U app -d app

# Run migrations
cd src/db
npm install
DATABASE_URL=postgres://app:app@localhost:5432/app npx node-pg-migrate up

# Verify migrations applied
DATABASE_URL=postgres://app:app@localhost:5432/app npx node-pg-migrate status

# Clean up
docker compose down -v
```

## Integration Testing

### Full Stack Test with Docker Compose

The most comprehensive way to test the entire application is to run it with Docker Compose:

```bash
# Build and start all services
docker compose up --build

# In another terminal, verify services are running
docker compose ps

# Test the web frontend
curl http://localhost:3000

# Test the API health endpoint (through the web container)
docker compose exec web curl http://api:3001/health

# Test creating a task
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"title":"Test task"}'

# Test listing tasks
curl http://localhost:3000/api/tasks

# Clean up
docker compose down -v
```

### Manual Testing Checklist

When testing the application manually, verify:

1. **Database Connection**
   - [ ] PostgreSQL starts and becomes healthy
   - [ ] Migrations run successfully
   - [ ] Database schema is created correctly

2. **API Functionality**
   - [ ] Health check endpoint responds (`GET /health`)
   - [ ] List tasks endpoint works (`GET /tasks`)
   - [ ] Create task endpoint works (`POST /tasks`)
   - [ ] Update task endpoint works (`PATCH /tasks/:id`)
   - [ ] Tasks persist across API restarts

3. **Web Frontend**
   - [ ] Page loads at http://localhost:3000
   - [ ] Can view existing tasks
   - [ ] Can create new tasks
   - [ ] Can mark tasks as complete
   - [ ] Can edit task titles
   - [ ] UI updates reflect in database

4. **Service Communication**
   - [ ] Web can reach API
   - [ ] API can reach database
   - [ ] Proper error handling when services are unavailable

## Continuous Integration

The project uses GitHub Actions for CI/CD. The workflow configuration is located in `.github/workflows/`.

To run checks locally before pushing:

```bash
# Lint the web frontend
cd src/web && npm run lint

# Build all Docker images
docker compose build

# Run the full stack
docker compose up
```

## Adding Tests

### Adding Unit Tests to the API

1. Install testing dependencies:
   ```bash
   cd src/api
   npm install --save-dev jest supertest
   ```

2. Update `package.json`:
   ```json
   {
     "scripts": {
       "test": "jest",
       "test:watch": "jest --watch"
     }
   }
   ```

3. Create test files alongside source files (e.g., `index.test.js`)

### Adding Tests to the Web Frontend

1. Install testing dependencies:
   ```bash
   cd src/web
   npm install --save-dev @testing-library/react @testing-library/jest-dom jest jest-environment-jsdom
   ```

2. Create a `jest.config.js` file

3. Add test files with `.test.tsx` or `.test.ts` extensions

## Troubleshooting

### Tests Fail to Connect to Database

- Ensure PostgreSQL is running: `docker compose ps`
- Check the DATABASE_URL environment variable
- Verify network connectivity: `docker compose exec api ping postgres`

### Port Already in Use

If you see "port already in use" errors:

```bash
# Find and kill the process using the port
lsof -ti:3000 | xargs kill -9  # for web
lsof -ti:3001 | xargs kill -9  # for api
```

Or use different ports in `docker-compose.yml`.

### Docker Build Failures

- Clear Docker cache: `docker compose build --no-cache`
- Remove old images: `docker system prune -a`
- Check Docker Desktop has enough resources allocated

## Performance Testing

For load testing the API:

```bash
# Install Apache Bench (comes with Apache)
# or use wrk, hey, or k6

# Example with curl in a loop
for i in {1..100}; do
  curl -s http://localhost:3000/api/tasks > /dev/null
done
```

For more sophisticated load testing, consider:
- [k6](https://k6.io/)
- [Apache JMeter](https://jmeter.apache.org/)
- [wrk](https://github.com/wg/wrk)

## Test Coverage

To add test coverage reporting:

1. Configure Jest with coverage options
2. Run tests with coverage: `npm test -- --coverage`
3. View coverage report in `coverage/` directory

## Related Documentation

- [Deploy Notes](./deploy-notes.md) - Deployment procedures
- [README.md](../README.md) - Project overview and setup
