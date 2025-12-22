.PHONY: help install install-backend install-frontend install-analytics build build-backend build-frontend build-analytics dev dev-backend dev-frontend dev-analytics start start-backend start-frontend start-analytics clean clean-backend clean-frontend clean-analytics type-check type-check-backend type-check-frontend setup-db migrate-db all stop

help:
	@echo "Available commands:"
	@echo "  make install          - Install all dependencies"
	@echo "  make build            - Build all projects"
	@echo "  make dev              - Run all services in development mode"
	@echo "  make start            - Start all services in production mode"
	@echo "  make clean            - Clean all build artifacts"
	@echo "  make type-check       - Type check all projects"
	@echo "  make setup-db         - Initialize database schema"
	@echo "  make all              - Install, build, and setup database"

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

all: install build setup-db
	@echo "Project setup complete!"

stop:
	@echo "Stopping all services..."
	@pkill -f "npm run dev" || true
	@pkill -f "npm start" || true
	@pkill -f "vite" || true
	@echo "All services stopped"

