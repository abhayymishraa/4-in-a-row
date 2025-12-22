# 4-in-a-Row Game

Real-time multiplayer 4-in-a-Row game with competitive bot, matchmaking, and analytics.

## Project Structure

- `backend/` - Node.js backend server with WebSocket support
- `frontend/` - React frontend application
- `analytics/` - Kafka consumer for game analytics

## Quick Start

### Using Docker Setup (Recommended)

```bash
# Setup Docker services (PostgreSQL & Kafka)
make setup

# Copy environment files
cp backend/.env.example backend/.env
cp analytics/.env.example analytics/.env

# Install all dependencies
make install

# Run all services in development mode (in separate terminals)
make dev-backend    # Terminal 1
make dev-frontend   # Terminal 2
make dev-analytics  # Terminal 3
```

The `make setup` command will:
- Start PostgreSQL on `localhost:5432`
- Start Kafka on `localhost:9092`
- Wait for services to be healthy

### Using Makefile (Alternative)

```bash
# Install all dependencies
make install

# Setup environment files (copy .env.example to .env in each directory)
cp backend/.env.example backend/.env
cp analytics/.env.example analytics/.env

# Edit .env files with your configuration (database, Kafka, etc.)

# Build all projects
make build

# Run all services in development mode (in separate terminals)
make dev-backend    # Terminal 1
make dev-frontend   # Terminal 2
make dev-analytics  # Terminal 3

# Or run everything at once (all in background)
make dev
```

### Available Make Commands

```bash
make setup          # Setup Docker services (PostgreSQL & Kafka) - START HERE!
make install        # Install all dependencies
make build          # Build all projects
make dev            # Run all services in development mode
make start          # Start all services in production mode
make clean          # Clean all build artifacts
make type-check     # Type check all projects
make setup-db       # Initialize database schema
make all            # Install, build, and setup database
make stop           # Stop all running services

# Docker commands (for infrastructure services only)
make docker-up      # Start Docker services (PostgreSQL & Kafka)
make docker-down    # Stop Docker services
make docker-logs    # View Docker service logs
make docker-clean   # Remove Docker containers and volumes
```

### Individual Service Commands

```bash
# Backend
make install-backend
make build-backend
make dev-backend
make start-backend
make clean-backend
make type-check-backend

# Frontend
make install-frontend
make build-frontend
make dev-frontend
make start-frontend
make clean-frontend
make type-check-frontend

# Analytics
make install-analytics
make build-analytics
make dev-analytics
make start-analytics
make clean-analytics
```

## Manual Setup (Alternative)

### Backend

```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your database and Kafka configuration
npm run dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Analytics

```bash
cd analytics
npm install
cp .env.example .env
# Edit .env with your Kafka configuration
npm run dev
```

## Requirements

- Node.js 18+
- Docker and Docker Compose (for `make setup`)
- PostgreSQL (or use Docker via `make setup`)
- Kafka (or use Docker via `make setup`)
- Make (for using Makefile commands)

## Docker Services

The project uses Docker Compose **only for infrastructure services** (PostgreSQL and Kafka). The backend and frontend run directly on your machine, not in Docker.

**Docker Services:**
- **PostgreSQL**: Database server (port 5432)
- **Kafka**: Message broker (port 9092)  
- **Zookeeper**: Required for Kafka

All services are configured with health checks and will automatically start when you run `make setup`.

## Troubleshooting

### Kafka Connection Errors

If you see Kafka connection errors:

1. **Ensure Docker services are running:**
   ```bash
   make docker-up
   docker-compose ps  # Check service status
   ```

2. **Wait for Kafka to be ready:** Kafka can take 30-60 seconds to fully start. The health checks will wait, but if you start services manually, wait a bit.

3. **Check Kafka logs:**
   ```bash
   make docker-logs
   # Or specifically: docker-compose logs kafka
   ```

4. **Restart Docker services:**
   ```bash
   make docker-down
   make docker-up
   ```

### Suppress KafkaJS Warning

To suppress the KafkaJS partitioner warning, add to your `.env` files:
```bash
KAFKAJS_NO_PARTITIONER_WARNING=1
```

### Database Connection Errors

If you see PostgreSQL connection errors:

1. **Check if PostgreSQL is running:**
   ```bash
   docker-compose ps postgres
   ```

2. **Verify connection settings** in `backend/.env`:
   ```
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=emittr_game
   DB_USER=postgres
   DB_PASSWORD=postgres
   ```

3. **Reset database** (WARNING: This deletes all data):
   ```bash
   make docker-clean
   make docker-up
   ```

