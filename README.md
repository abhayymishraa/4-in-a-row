# 4-in-a-Row Game

Real-time multiplayer 4-in-a-Row game with competitive bot, matchmaking, and analytics.

## Project Structure

- `backend/` - Node.js backend server with WebSocket support
- `frontend/` - React frontend application
- `analytics/` - Kafka consumer for game analytics

## Quick Start

### Using Makefile (Recommended)

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
make help           # Show all available commands
make install        # Install all dependencies
make build          # Build all projects
make dev            # Run all services in development mode
make start          # Start all services in production mode
make clean          # Clean all build artifacts
make type-check     # Type check all projects
make setup-db       # Initialize database schema
make all            # Install, build, and setup database
make stop           # Stop all running services
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
- PostgreSQL
- Kafka (for analytics)
- Make (for using Makefile commands)

