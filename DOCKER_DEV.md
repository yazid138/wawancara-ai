# Development Setup Guide

## Prerequisites
- Docker
- Docker Compose

## Quick Start

### 1. Setup Environment Variables
```bash
cp .env.example .env
# Edit .env dengan nilai API key dan konfigurasi Anda
```

### 2. Start Development Environment
```bash
docker-compose up --build
```

Ini akan:
- Membangun image Dockerfile.dev
- Menjalankan PostgreSQL di port 5432
- Menjalankan Backend di port 5000 dengan hot reload

### 3. Verify Services
```bash
# Check if all services are running
docker-compose ps

# View logs
docker-compose logs -f backend

# Access backend
curl http://localhost:5000
```

### 4. Stop Services
```bash
docker-compose down

# Remove volumes (optional, untuk clean slate)
docker-compose down -v
```

## Development Workflow

### Hot Reload
- Nodemon otomatis watch file di `src/**/*.ts`
- Setiap perubahan file akan trigger restart server
- Tidak perlu rebuild image atau restart container

### Running Commands
```bash
# Run a command inside backend container
docker-compose exec backend npm run format

# Run db seed
docker-compose exec backend npm run db:seed

# Access database
docker-compose exec postgres psql -U postgres -d wawancara_db
```

### Database Management
- PostgreSQL berjalan di container terpisah
- Data disimpan di volume `postgres_data` (tidak hilang saat container stop)
- Connection string: `postgresql://postgres:@postgres:5432/wawancara_db`

### Volume Mounts
- `.:/app` - Source code (enable hot reload)
- `/app/node_modules` - Preserve node_modules dari image
- `/app/dist` - Preserve compiled output

## Production Build

Untuk production, gunakan Dockerfile original:
```bash
docker build -t wawancara-be .
docker run -e DATABASE_URL=... wawancara-be
```
