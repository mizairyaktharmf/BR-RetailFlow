# BR-RetailFlow Complete Deployment Guide
## From Zero to Production with Docker + AWS + GitHub Actions

---

## 📋 Table of Contents

1. [Current Infrastructure Cleanup](#1-current-infrastructure-cleanup)
2. [Architecture Overview](#2-architecture-overview)
3. [Prerequisites](#3-prerequisites)
4. [Step 1: Dockerize Applications](#step-1-dockerize-applications)
5. [Step 2: Setup GitHub Repository](#step-2-setup-github-repository)
6. [Step 3: AWS Infrastructure Setup](#step-3-aws-infrastructure-setup)
7. [Step 4: Configure GitHub Actions CI/CD](#step-4-configure-github-actions-cicd)
8. [Step 5: Deploy to Production](#step-5-deploy-to-production)
9. [Step 6: Domain & SSL Setup](#step-6-domain--ssl-setup)
10. [Monitoring & Maintenance](#monitoring--maintenance)

---

## 1. Current Infrastructure Cleanup

### ⚠️ **IMPORTANT: Backup First!**

Before deleting anything, backup your database:

```bash
# Connect to your RDS instance and create a backup
pg_dump -h br-retailflow-db.cp424kwuw8hu.eu-north-1.rds.amazonaws.com \
        -U bruser -d postgres > backup_$(date +%Y%m%d).sql
```

### Delete Resources in Order:

#### 1.1 Stop EC2 Instances
```
1. Go to AWS Console → EC2 → Instances
2. Select your instance
3. Instance State → Stop Instance
4. Wait for it to stop, then Terminate Instance
```

#### 1.2 Delete RDS Database
```
1. Go to AWS Console → RDS → Databases
2. Select br-retailflow-db
3. Actions → Delete
4. ⚠️ UNCHECK "Create final snapshot" if you already have backup
5. Type "delete me" to confirm
```

#### 1.3 Delete S3 Buckets (if any)
```
1. Go to AWS Console → S3
2. Select buckets related to BR-RetailFlow
3. Empty bucket first, then Delete
```

#### 1.4 Delete Security Groups
```
1. Go to AWS Console → EC2 → Security Groups
2. Delete custom security groups (after instances are terminated)
```

#### 1.5 Delete Key Pairs
```
1. Go to AWS Console → EC2 → Key Pairs
2. Delete unused key pairs
```

---

## 2. Architecture Overview

### New Infrastructure Design

```
┌─────────────────────────────────────────────────────────────────┐
│                         GITHUB REPOSITORY                        │
│  - Push code → Triggers GitHub Actions → Builds & Tests         │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ├─── Triggers CI/CD Pipeline
                         │
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│                     AWS INFRASTRUCTURE                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ EC2 Instance (Docker Host)                                │  │
│  │  - Docker Compose running 3 services:                     │  │
│  │    1. API Container (FastAPI)                             │  │
│  │    2. Admin Dashboard Container (Next.js)                 │  │
│  │    3. Steward App Container (Next.js)                     │  │
│  │    4. Nginx Reverse Proxy                                 │  │
│  └──────────────────────────────────────────────────────────┘  │
│                         ↓                                         │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ RDS PostgreSQL Database                                   │  │
│  │  - Managed Database Service                               │  │
│  │  - Automated Backups                                      │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ S3 Bucket (Optional)                                      │  │
│  │  - Static assets, backups, logs                           │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### Tech Stack

- **Backend**: FastAPI + PostgreSQL
- **Frontend**: Next.js (Admin Dashboard + Steward App)
- **Containerization**: Docker + Docker Compose
- **CI/CD**: GitHub Actions
- **Cloud**: AWS (EC2, RDS, S3)
- **Reverse Proxy**: Nginx
- **SSL**: Let's Encrypt (Certbot)

---

## 3. Prerequisites

### Local Development Tools

```bash
# Install Docker Desktop
# Download from: https://www.docker.com/products/docker-desktop

# Install Git
# Download from: https://git-scm.com/downloads

# Install AWS CLI
# Download from: https://aws.amazon.com/cli/
```

### AWS Account Setup

1. Create or login to AWS Account
2. Create IAM User with these permissions:
   - AmazonEC2FullAccess
   - AmazonRDSFullAccess
   - AmazonS3FullAccess
   - IAMUserChangePassword
3. Generate Access Keys (save them securely!)

---

## Step 1: Dockerize Applications

### 1.1 Create Dockerfile for API

Create `apps/api/Dockerfile`:

```dockerfile
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose port
EXPOSE 8000

# Run the application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

Create `apps/api/requirements.txt`:

```txt
fastapi==0.104.1
uvicorn[standard]==0.24.0
sqlalchemy==2.0.23
psycopg2-binary==2.9.9
pydantic==2.5.0
pydantic-settings==2.1.0
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
python-multipart==0.0.6
```

### 1.2 Create Dockerfile for Admin Dashboard

Create `apps/admin-dashboard/Dockerfile`:

```dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy application code
COPY . .

# Build the application
RUN npm run build

# Production image
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copy built application
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000

CMD ["npm", "start"]
```

### 1.3 Create Dockerfile for Steward App

Create `apps/steward-app/Dockerfile`:

```dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy application code
COPY . .

# Build the application
RUN npm run build

# Production image
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copy built application
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3001

CMD ["npm", "start"]
```

### 1.4 Create Docker Compose File

Create `docker-compose.yml` in project root:

```yaml
version: '3.8'

services:
  # API Service
  api:
    build:
      context: ./apps/api
      dockerfile: Dockerfile
    container_name: br-api
    restart: unless-stopped
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - SECRET_KEY=${SECRET_KEY}
      - ALGORITHM=HS256
      - ACCESS_TOKEN_EXPIRE_MINUTES=30
      - REFRESH_TOKEN_EXPIRE_DAYS=7
    ports:
      - "8000:8000"
    networks:
      - br-network
    depends_on:
      - db
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Admin Dashboard
  admin-dashboard:
    build:
      context: ./apps/admin-dashboard
      dockerfile: Dockerfile
    container_name: br-admin-dashboard
    restart: unless-stopped
    environment:
      - NEXT_PUBLIC_API_URL=${API_URL}
    ports:
      - "3000:3000"
    networks:
      - br-network
    depends_on:
      - api

  # Steward App
  steward-app:
    build:
      context: ./apps/steward-app
      dockerfile: Dockerfile
    container_name: br-steward-app
    restart: unless-stopped
    environment:
      - NEXT_PUBLIC_API_URL=${API_URL}
    ports:
      - "3001:3001"
    networks:
      - br-network
    depends_on:
      - api

  # Nginx Reverse Proxy
  nginx:
    image: nginx:alpine
    container_name: br-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
    networks:
      - br-network
    depends_on:
      - api
      - admin-dashboard
      - steward-app

  # PostgreSQL Database (Development only)
  db:
    image: postgres:15-alpine
    container_name: br-postgres
    restart: unless-stopped
    environment:
      - POSTGRES_USER=${DB_USER}
      - POSTGRES_PASSWORD=${DB_PASSWORD}
      - POSTGRES_DB=${DB_NAME}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    networks:
      - br-network

networks:
  br-network:
    driver: bridge

volumes:
  postgres_data:
```

### 1.5 Create Nginx Configuration

Create `nginx/nginx.conf`:

```nginx
events {
    worker_connections 1024;
}

http {
    upstream api {
        server api:8000;
    }

    upstream admin {
        server admin-dashboard:3000;
    }

    upstream steward {
        server steward-app:3001;
    }

    # HTTP Server - Redirect to HTTPS
    server {
        listen 80;
        server_name your-domain.com;
        return 301 https://$server_name$request_uri;
    }

    # HTTPS Server - API
    server {
        listen 443 ssl;
        server_name api.your-domain.com;

        ssl_certificate /etc/nginx/ssl/fullchain.pem;
        ssl_certificate_key /etc/nginx/ssl/privkey.pem;

        location / {
            proxy_pass http://api;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }

    # HTTPS Server - Admin Dashboard
    server {
        listen 443 ssl;
        server_name admin.your-domain.com;

        ssl_certificate /etc/nginx/ssl/fullchain.pem;
        ssl_certificate_key /etc/nginx/ssl/privkey.pem;

        location / {
            proxy_pass http://admin;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }

    # HTTPS Server - Steward App
    server {
        listen 443 ssl;
        server_name steward.your-domain.com;

        ssl_certificate /etc/nginx/ssl/fullchain.pem;
        ssl_certificate_key /etc/nginx/ssl/privkey.pem;

        location / {
            proxy_pass http://steward;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
}
```

### 1.6 Create Environment File

Create `.env.example`:

```env
# Database
DATABASE_URL=postgresql://user:password@db:5432/brretailflow
DB_USER=bruser
DB_PASSWORD=your_secure_password
DB_NAME=brretailflow

# API
SECRET_KEY=your-secret-key-change-in-production-use-openssl-rand-hex-32
API_URL=http://api:8000/api/v1

# AWS (for production)
AWS_REGION=eu-north-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key

# RDS (Production Database)
RDS_HOSTNAME=your-rds-endpoint.rds.amazonaws.com
RDS_PORT=5432
RDS_DB_NAME=brretailflow
RDS_USERNAME=bruser
RDS_PASSWORD=your_rds_password
```

---

## Step 2: Setup GitHub Repository

### 2.1 Initialize Git Repository

```bash
cd "m:/Projects for NexCode Nova/BR-RetailFlow"

# Initialize git if not already done
git init

# Create .gitignore
cat > .gitignore << 'EOF'
# Environment variables
.env
.env.local
.env.production

# Python
__pycache__/
*.py[cod]
*$py.class
*.so
.Python
venv/
env/

# Node
node_modules/
.next/
out/
build/
dist/

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
*.log
logs/

# Database
*.db
*.sqlite

# Backups
*.sql
*.dump
EOF

# Add all files
git add .

# Commit
git commit -m "Initial commit: Dockerized BR-RetailFlow with CI/CD"
```

### 2.2 Create GitHub Repository

```bash
# Go to github.com and create a new repository: BR-RetailFlow

# Add remote
git remote add origin https://github.com/YOUR_USERNAME/BR-RetailFlow.git

# Push to GitHub
git branch -M main
git push -u origin main
```

### 2.3 Add GitHub Secrets

Go to GitHub Repository → Settings → Secrets and Variables → Actions

Add these secrets:
```
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=eu-north-1
EC2_HOST=your-ec2-public-ip
EC2_USERNAME=ubuntu
EC2_SSH_KEY=your-private-key-content
DATABASE_URL=postgresql://user:pass@rds-endpoint/db
SECRET_KEY=your-secret-key
```

---

## Step 3: AWS Infrastructure Setup

### 3.1 Create VPC and Security Groups

```bash
# Login to AWS Console

# 1. Create Security Group for EC2
Name: br-retailflow-ec2-sg
Description: Security group for BR-RetailFlow EC2 instance
Inbound Rules:
  - SSH (22) from Your IP
  - HTTP (80) from Anywhere
  - HTTPS (443) from Anywhere
  - Custom TCP (8000) from VPC only
  - Custom TCP (3000) from VPC only
  - Custom TCP (3001) from VPC only

# 2. Create Security Group for RDS
Name: br-retailflow-rds-sg
Description: Security group for BR-RetailFlow RDS
Inbound Rules:
  - PostgreSQL (5432) from br-retailflow-ec2-sg
```

### 3.2 Create RDS Database

```
1. Go to RDS → Create Database
2. Choose PostgreSQL 15
3. Template: Free tier (or Production for real deployment)
4. DB Instance Identifier: br-retailflow-db
5. Master username: bruser
6. Master password: (generate strong password)
7. DB instance class: db.t3.micro (or larger)
8. Storage: 20 GB (enable autoscaling)
9. VPC: Default VPC
10. Security group: br-retailflow-rds-sg
11. Create database
12. Wait 10-15 minutes for creation
13. Copy endpoint URL (e.g., br-retailflow-db.xxxxx.eu-north-1.rds.amazonaws.com)
```

### 3.3 Create EC2 Instance

```
1. Go to EC2 → Launch Instance
2. Name: br-retailflow-server
3. AMI: Ubuntu Server 22.04 LTS
4. Instance type: t3.medium (minimum) or t3.large (recommended)
5. Key pair: Create new or use existing
6. Network settings:
   - VPC: Default
   - Subnet: Public subnet
   - Auto-assign public IP: Enable
   - Security group: br-retailflow-ec2-sg
7. Storage: 30 GB gp3
8. Launch instance
9. Wait for instance to start
10. Copy Public IPv4 address
```

### 3.4 Connect to EC2 and Install Docker

```bash
# SSH into EC2
ssh -i your-key.pem ubuntu@your-ec2-public-ip

# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add user to docker group
sudo usermod -aG docker ubuntu

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Verify installations
docker --version
docker-compose --version

# Logout and login again for group changes
exit
ssh -i your-key.pem ubuntu@your-ec2-public-ip
```

---

## Step 4: Configure GitHub Actions CI/CD

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to AWS EC2

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'

      - name: Install API dependencies
        run: |
          cd apps/api
          pip install -r requirements.txt

      - name: Run API tests
        run: |
          cd apps/api
          # Add your test commands here
          # pytest

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'

    steps:
      - uses: actions/checkout@v3

      - name: Deploy to EC2
        env:
          PRIVATE_KEY: ${{ secrets.EC2_SSH_KEY }}
          HOST: ${{ secrets.EC2_HOST }}
          USER: ${{ secrets.EC2_USERNAME }}
        run: |
          echo "$PRIVATE_KEY" > private_key && chmod 600 private_key

          # Copy files to EC2
          scp -o StrictHostKeyChecking=no -i private_key -r ./* ${USER}@${HOST}:~/BR-RetailFlow/

          # SSH and deploy
          ssh -o StrictHostKeyChecking=no -i private_key ${USER}@${HOST} << 'ENDSSH'
            cd ~/BR-RetailFlow

            # Create .env file
            cat > .env << 'EOF'
          DATABASE_URL=${{ secrets.DATABASE_URL }}
          SECRET_KEY=${{ secrets.SECRET_KEY }}
          API_URL=${{ secrets.API_URL }}
          EOF

            # Pull latest images and restart
            docker-compose down
            docker-compose build --no-cache
            docker-compose up -d

            # Clean up old images
            docker system prune -af
          ENDSSH
```

---

## Step 5: Deploy to Production

### 5.1 Initial Deployment

```bash
# On your local machine
git add .
git commit -m "Add Docker configuration and CI/CD"
git push origin main

# GitHub Actions will automatically:
# 1. Run tests
# 2. Deploy to EC2
# 3. Build Docker containers
# 4. Start services
```

### 5.2 Manual Deployment (if needed)

```bash
# SSH into EC2
ssh -i your-key.pem ubuntu@your-ec2-public-ip

# Clone repository (first time only)
git clone https://github.com/YOUR_USERNAME/BR-RetailFlow.git
cd BR-RetailFlow

# Create .env file
nano .env
# Add all environment variables

# Build and start services
docker-compose up -d --build

# Check status
docker-compose ps

# View logs
docker-compose logs -f
```

### 5.3 Database Migration

```bash
# SSH into EC2
ssh -i your-key.pem ubuntu@your-ec2-public-ip
cd BR-RetailFlow

# Run migrations
docker-compose exec api python -c "
from utils.database import engine, Base
Base.metadata.create_all(bind=engine)
"

# Or enter the container
docker exec -it br-api bash
# Inside container:
python
>>> from utils.database import engine, Base
>>> Base.metadata.create_all(bind=engine)
>>> exit()
```

---

## Step 6: Domain & SSL Setup

### 6.1 Configure Domain (if you have one)

```
1. Go to your domain registrar (GoDaddy, Namecheap, etc.)
2. Add A records:
   - api.your-domain.com → EC2 Public IP
   - admin.your-domain.com → EC2 Public IP
   - steward.your-domain.com → EC2 Public IP
```

### 6.2 Install SSL Certificates

```bash
# SSH into EC2
ssh -i your-key.pem ubuntu@your-ec2-public-ip

# Install Certbot
sudo apt install certbot python3-certbot-nginx -y

# Stop Nginx container temporarily
docker-compose stop nginx

# Get SSL certificates
sudo certbot certonly --standalone -d api.your-domain.com
sudo certbot certonly --standalone -d admin.your-domain.com
sudo certbot certonly --standalone -d steward.your-domain.com

# Copy certificates to project
sudo mkdir -p ~/BR-RetailFlow/nginx/ssl
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem ~/BR-RetailFlow/nginx/ssl/
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem ~/BR-RetailFlow/nginx/ssl/
sudo chown -R ubuntu:ubuntu ~/BR-RetailFlow/nginx/ssl

# Restart services
docker-compose up -d nginx

# Setup auto-renewal
sudo crontab -e
# Add this line:
0 0 1 * * certbot renew --quiet && docker-compose -f ~/BR-RetailFlow/docker-compose.yml restart nginx
```

---

## Monitoring & Maintenance

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f api
docker-compose logs -f admin-dashboard
docker-compose logs -f steward-app
```

### Restart Services

```bash
# Restart all
docker-compose restart

# Restart specific service
docker-compose restart api
```

### Update Deployment

```bash
# Just push to main branch
git add .
git commit -m "Update feature"
git push origin main

# GitHub Actions will auto-deploy
```

### Backup Database

```bash
# Create backup
docker exec br-postgres pg_dump -U bruser brretailflow > backup_$(date +%Y%m%d).sql

# Restore backup
docker exec -i br-postgres psql -U bruser brretailflow < backup_20240101.sql
```

### Scale Services

```bash
# Edit docker-compose.yml
# Add this under services:
  api:
    deploy:
      replicas: 3  # Run 3 instances

# Restart
docker-compose up -d --scale api=3
```

---

## 🎉 Deployment Complete!

Your application is now running at:
- **API**: https://api.your-domain.com
- **Admin Dashboard**: https://admin.your-domain.com
- **Steward App**: https://steward.your-domain.com

---

## Troubleshooting

### Container not starting?
```bash
docker-compose logs service-name
```

### Database connection issues?
```bash
docker-compose exec api python -c "from utils.database import engine; print(engine.url)"
```

### Port already in use?
```bash
sudo lsof -i :8000
sudo kill -9 PID
```

### Out of disk space?
```bash
docker system prune -a
```

---

## Cost Estimation (Monthly)

- **EC2 t3.medium**: ~$30
- **RDS db.t3.micro**: ~$15
- **Data Transfer**: ~$5
- **S3 Storage**: ~$1
- **Total**: ~$51/month

---

## Next Steps

1. ✅ Setup monitoring (CloudWatch, Grafana)
2. ✅ Configure automated backups
3. ✅ Setup staging environment
4. ✅ Configure CDN (CloudFront)
5. ✅ Add health checks
6. ✅ Setup alerts (SNS)

---

**Documentation Version**: 1.0
**Last Updated**: 2026-02-07
**Author**: BR-RetailFlow Team
