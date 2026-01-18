# BR-RetailFlow: EC2 & PostgreSQL Complete Guide

## Understanding the Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        YOUR COMPUTER                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Steward App  │  │Admin Dashboard│  │   VS Code    │          │
│  │ localhost:3001│  │localhost:3002│  │   (SSH)      │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
└─────────┼─────────────────┼─────────────────┼───────────────────┘
          │                 │                 │
          │    Internet     │                 │ SSH Connection
          │                 │                 │
┌─────────▼─────────────────▼─────────────────▼───────────────────┐
│                     AWS EC2 SERVER                              │
│                   IP: 13.60.96.55                               │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              FastAPI Backend (Python)                    │   │
│  │              Running on port 8000                        │   │
│  │              URL: http://13.60.96.55:8000               │   │
│  │              Path: ~/BR-RetailFlow/apps/api             │   │
│  └─────────────────────────┬───────────────────────────────┘   │
│                            │                                    │
│                            │ Connects to                        │
│                            ▼                                    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              PostgreSQL Database                         │   │
│  │              Running on port 5432                        │   │
│  │              Database: br_retailflow                     │   │
│  │              User: bruser                                │   │
│  │              Password: brpassword123                     │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## What is What?

### 1. EC2 (Elastic Compute Cloud)
- **What**: A virtual computer running in Amazon's cloud
- **Your EC2 IP**: `13.60.96.55`
- **Operating System**: Ubuntu Linux
- **How to access**: SSH (Secure Shell) connection

### 2. SSH (Secure Shell)
- **What**: A secure way to remotely control another computer via terminal
- **How VS Code connects**: VS Code has "Remote - SSH" extension that connects to EC2
- **When you open VS Code terminal (SSH tab)**: You're typing commands ON the EC2 server, not your computer!

### 3. PostgreSQL
- **What**: A database software (like MongoDB, but SQL-based)
- **Where it runs**: ON the EC2 server (not your computer)
- **Port**: 5432
- **Data location**: `/var/lib/postgresql/` on EC2

### 4. pgAdmin
- **What**: A web-based GUI tool to manage PostgreSQL (like MongoDB Compass)
- **How to access**: Install on EC2 and access via browser, OR install locally and connect remotely


## How to Access PostgreSQL Database

### Method 1: Command Line (on EC2)

First, connect to PostgreSQL:
```bash
sudo -u postgres psql
```

Then you're inside PostgreSQL. You'll see: `postgres=#`

Common commands:
```sql
-- List all databases
\l

-- Connect to br_retailflow database
\c br_retailflow

-- List all tables
\dt

-- See all users in users table
SELECT * FROM users;

-- Exit PostgreSQL
\q
```

### Method 2: Using bruser (your app user)

```bash
sudo -u postgres psql -d br_retailflow
```

This connects directly to your database as postgres superuser.


## Creating the Admin User (WORKING METHOD)

### Step 1: Enter PostgreSQL
```bash
sudo -u postgres psql -d br_retailflow
```

### Step 2: Check if users table exists
```sql
\dt
```

You should see `users` table listed.

### Step 3: See table structure
```sql
\d users
```

### Step 4: Insert the admin user
```sql
INSERT INTO users (username, email, hashed_password, full_name, role, is_active, created_at, updated_at)
VALUES (
  'hq_admin',
  'hq@br.com',
  '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.VttYqPHNkXa1lG',
  'HQ Admin',
  'supreme_admin',
  true,
  NOW(),
  NOW()
);
```

### Step 5: Verify user was created
```sql
SELECT id, username, email, role, is_active FROM users;
```

### Step 6: Exit PostgreSQL
```sql
\q
```

Now login with:
- **Username**: hq_admin
- **Password**: Admin123


## Common EC2 Commands

### Server Management
```bash
# Check if uvicorn (API) is running
ps aux | grep uvicorn

# Kill uvicorn server
pkill -f uvicorn

# Start uvicorn server (from api folder)
cd ~/BR-RetailFlow/apps/api
source venv/bin/activate
nohup uvicorn main:app --host 0.0.0.0 --port 8000 > server.log 2>&1 &

# Check server logs
tail -f ~/BR-RetailFlow/apps/api/server.log

# Check what's running on port 8000
sudo lsof -i :8000
```

### Git Commands
```bash
# Pull latest code from GitHub
cd ~/BR-RetailFlow
git pull origin main

# Check git status
git status
```

### PostgreSQL Service
```bash
# Check if PostgreSQL is running
sudo systemctl status postgresql

# Start PostgreSQL
sudo systemctl start postgresql

# Restart PostgreSQL
sudo systemctl restart postgresql
```


## File Locations on EC2

| What | Location |
|------|----------|
| Project Code | `~/BR-RetailFlow/` |
| API Code | `~/BR-RetailFlow/apps/api/` |
| Python Virtual Env | `~/BR-RetailFlow/apps/api/venv/` |
| Environment File | `~/BR-RetailFlow/apps/api/.env` |
| Server Logs | `~/BR-RetailFlow/apps/api/server.log` |
| PostgreSQL Data | `/var/lib/postgresql/` |
| PostgreSQL Config | `/etc/postgresql/` |


## Difference: MongoDB vs PostgreSQL

| Feature | MongoDB | PostgreSQL |
|---------|---------|------------|
| Type | NoSQL (documents) | SQL (tables) |
| Data Format | JSON-like documents | Rows and columns |
| GUI Tool | MongoDB Compass | pgAdmin |
| Query Language | MongoDB Query | SQL |
| Access | `mongosh` command | `psql` command |
| Cloud Service | MongoDB Atlas | Amazon RDS (or self-hosted) |


## Setting up pgAdmin (Optional - GUI Access)

### Option A: Install pgAdmin on EC2 (Web Access)

```bash
# Add pgAdmin repository
curl -fsS https://www.pgadmin.org/static/packages_pgadmin_org.pub | sudo gpg --dearmor -o /usr/share/keyrings/packages-pgadmin-org.gpg

sudo sh -c 'echo "deb [signed-by=/usr/share/keyrings/packages-pgadmin-org.gpg] https://ftp.postgresql.org/pub/pgadmin/pgadmin4/apt/$(lsb_release -cs) pgadmin4 main" > /etc/apt/sources.list.d/pgadmin4.list && apt update'

# Install pgAdmin web version
sudo apt install pgadmin4-web

# Configure pgAdmin
sudo /usr/pgadmin4/bin/setup-web.sh
```

Then open: `http://13.60.96.55/pgadmin4`

### Option B: Allow Remote PostgreSQL Access

1. Edit PostgreSQL config:
```bash
sudo nano /etc/postgresql/*/main/postgresql.conf
```
Find and change:
```
listen_addresses = '*'
```

2. Edit pg_hba.conf:
```bash
sudo nano /etc/postgresql/*/main/pg_hba.conf
```
Add this line:
```
host    all    all    0.0.0.0/0    md5
```

3. Restart PostgreSQL:
```bash
sudo systemctl restart postgresql
```

4. Open port 5432 in AWS Security Group

5. Install pgAdmin on your local computer and connect to:
   - Host: 13.60.96.55
   - Port: 5432
   - Database: br_retailflow
   - Username: bruser
   - Password: brpassword123


## Quick Reference Card

### Access PostgreSQL:
```bash
sudo -u postgres psql -d br_retailflow
```

### Start API Server:
```bash
cd ~/BR-RetailFlow/apps/api && source venv/bin/activate && nohup uvicorn main:app --host 0.0.0.0 --port 8000 > server.log 2>&1 &
```

### Stop API Server:
```bash
pkill -f uvicorn
```

### Pull Latest Code:
```bash
cd ~/BR-RetailFlow && git pull origin main
```

### View Server Logs:
```bash
tail -f ~/BR-RetailFlow/apps/api/server.log
```


## Troubleshooting

### "Connection refused" error
- Check if PostgreSQL is running: `sudo systemctl status postgresql`
- Check if API is running: `ps aux | grep uvicorn`

### "Peer authentication failed"
- Use `sudo -u postgres psql` instead of `psql -U bruser`

### "CORS error" in browser
- Make sure the frontend URL is in `config.py` CORS_ORIGINS
- Restart the API server after changes

### "Module not found" error
- Make sure virtual environment is activated: `source venv/bin/activate`

---

**Created for BR-RetailFlow Project**
**Last Updated: January 2026**
