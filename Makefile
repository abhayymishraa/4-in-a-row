.PHONY: help install install-backend install-frontend install-analytics build build-backend build-frontend build-analytics dev dev-backend dev-frontend dev-analytics start start-backend start-frontend start-analytics clean clean-backend clean-frontend clean-analytics type-check type-check-backend type-check-frontend setup setup-db migrate-db docker-up docker-down docker-logs docker-clean all stop

help:
	@echo "Available commands:"
	@echo "  make setup            - Setup Docker services (PostgreSQL & Kafka)"
	@echo "  make install          - Install all dependencies"
	@echo "  make build            - Build all projects"
	@echo "  make dev              - Run all services in development mode"
	@echo "  make start            - Start all services in production mode"
	@echo "  make clean            - Clean all build artifacts"
	@echo "  make type-check       - Type check all projects"
	@echo "  make setup-db         - Initialize database schema"
	@echo "  make all              - Install, build, and setup database"
	@echo ""
	@echo "Docker commands:"
	@echo "  make docker-up        - Start Docker services (PostgreSQL & Kafka)"
	@echo "  make docker-down      - Stop Docker services"
	@echo "  make docker-logs      - View Docker service logs"
	@echo "  make docker-clean     - Remove Docker containers and volumes"

install: install-backend install-frontend install-analytics
	@echo "All dependencies installed"

install-backend:
	@echo "Installing backend dependencies..."
	cd backend && npm install

install-frontend:
	@echo "Installing frontend dependencies..."
	cd frontend && npm install

install-analytics:
	@echo "Installing analytics dependencies..."
	cd analytics && npm install

build: build-backend build-frontend build-analytics
	@echo "All projects built"

build-backend:
	@echo "Building backend..."
	cd backend && npm run build

build-frontend:
	@echo "Building frontend..."
	cd frontend && npm run build

build-analytics:
	@echo "Building analytics..."
	cd analytics && npm run build

dev:
	@echo "Starting all services in development mode..."
	@echo "Note: Run each service in a separate terminal for better control"
	@echo "Or use: make dev-backend, make dev-frontend, make dev-analytics in separate terminals"
	@echo ""
	@echo "Starting backend..."
	@cd backend && npm run dev &
	@echo "Starting frontend..."
	@cd frontend && npm run dev &
	@echo "Starting analytics..."
	@cd analytics && npm run dev &
	@echo ""
	@echo "All services started in background. Use 'make stop' to stop them."

dev-backend:
	@echo "Starting backend in development mode..."
	cd backend && npm run dev

dev-frontend:
	@echo "Starting frontend in development mode..."
	cd frontend && npm run dev

dev-analytics:
	@echo "Starting analytics in development mode..."
	cd analytics && npm run dev

start: start-backend start-frontend start-analytics
	@echo "All services started in production mode"

start-backend:
	@echo "Starting backend in production mode..."
	cd backend && npm start

start-frontend:
	@echo "Starting frontend in production mode..."
	cd frontend && npm run preview

start-analytics:
	@echo "Starting analytics in production mode..."
	cd analytics && npm start

clean: clean-backend clean-frontend clean-analytics
	@echo "All build artifacts cleaned"

clean-backend:
	@echo "Cleaning backend..."
	cd backend && rm -rf dist node_modules

clean-frontend:
	@echo "Cleaning frontend..."
	cd frontend && rm -rf dist node_modules

clean-analytics:
	@echo "Cleaning analytics..."
	cd analytics && rm -rf dist node_modules

type-check: type-check-backend type-check-frontend
	@echo "Type checking complete"

type-check-backend:
	@echo "Type checking backend..."
	cd backend && npm run type-check

type-check-frontend:
	@echo "Type checking frontend..."
	cd frontend && npx tsc --noEmit

setup-db:
	@echo "Setting up database..."
	@echo "Note: Make sure PostgreSQL is running and configured in backend/.env"
	@echo "The database schema will be initialized when the backend starts"

migrate-db: setup-db
	@echo "Database migration complete (same as setup-db)"

setup: docker-up
	@echo ""
	@echo "Docker services setup complete!"
	@echo ""
	@echo "Next steps:"
	@echo "  1. Copy .env.example files:"
	@echo "     cp backend/.env.example backend/.env"
	@echo "     cp analytics/.env.example analytics/.env"
	@echo "  2. Run: make install"
	@echo "  3. Run services in separate terminals:"
	@echo "     make dev-backend    # Terminal 1"
	@echo "     make dev-frontend   # Terminal 2"
	@echo "     make dev-analytics # Terminal 3"

docker-up:
	@echo "Starting Docker services (PostgreSQL & Kafka)..."
	@docker-compose up -d
	@echo "Waiting for services to be ready (this may take up to 60 seconds)..."
	@echo "Checking PostgreSQL..."
	@for i in $$(seq 1 30); do \
		if docker-compose exec -T postgres pg_isready -U postgres > /dev/null 2>&1; then \
			echo "PostgreSQL is ready!"; \
			break; \
		fi; \
		echo "Waiting for PostgreSQL... ($$i/30)"; \
		sleep 2; \
	done
	@echo "Checking Kafka..."
	@for i in $$(seq 1 30); do \
		if docker-compose exec -T kafka kafka-broker-api-versions --bootstrap-server localhost:9092 > /dev/null 2>&1; then \
			echo "Kafka is ready!"; \
			break; \
		fi; \
		echo "Waiting for Kafka... ($$i/30)"; \
		sleep 2; \
	done
	@echo ""
	@echo "Docker services are running!"
	@echo "PostgreSQL: localhost:5432 (user: postgres, password: postgres, db: emittr_game)"
	@echo "Kafka: localhost:9092"
	@echo ""
	@docker-compose ps

docker-down:
	@echo "Stopping Docker services..."
	@docker-compose down
	@echo "Docker services stopped"

docker-logs:
	@docker-compose logs -f

docker-clean:
	@echo "Removing Docker containers and volumes..."
	@docker-compose down -v
	@echo "Docker cleanup complete"

all: install build setup-db
	@echo "Project setup complete!"

stop:
	@echo "Stopping all services..."
	@pkill -f "npm run dev" || true
	@pkill -f "npm start" || true
	@pkill -f "vite" || true
	@echo "All services stopped"

