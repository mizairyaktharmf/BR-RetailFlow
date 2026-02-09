# BR-RetailFlow Quick Start Guide

## 📦 What's Been Created

All Docker files and deployment configurations are now ready!

### Files Created:
✅ `apps/api/Dockerfile` - API containerization  
✅ `apps/api/requirements.txt` - Python dependencies  
✅ `apps/admin-dashboard/Dockerfile` - Admin Dashboard containerization  
✅ `apps/flavor-expert-app/Dockerfile` - Flavor Expert App containerization  
✅ `docker-compose.yml` - Production orchestration  
✅ `nginx/nginx.conf` - Reverse proxy configuration  
✅ `.github/workflows/deploy.yml` - CI/CD pipeline  
✅ `.env.example` - Environment template  
✅ `.gitignore` - Git ignore rules  
✅ `DEPLOYMENT_GUIDE.md` - Complete deployment documentation  

---

## 🚀 Step-by-Step Deployment Plan

### Phase 1: Cleanup Current AWS Resources (30 minutes)

1. **Backup Database First!**
   ```bash
   # On your EC2
   pg_dump -h br-retailflow-db.cp424kwuw8hu.eu-north-1.rds.amazonaws.com \
           -U bruser -d postgres > backup_$(date +%Y%m%d).sql
   ```

2. **Delete AWS Resources:**
   - Stop & Terminate EC2 instances
   - Delete RDS database (after backup!)
   - Clean up Security Groups
   - Remove unused Key Pairs

---

### Phase 2: Local Docker Testing (1 hour)

1. **Create .env file:**
   ```bash
   cp .env.example .env
   nano .env  # Edit with your values
   ```

2. **Test locally with Docker:**
   ```bash
   # Build images
   docker-compose build

   # Start services
   docker-compose up -d

   # Check status
   docker-compose ps

   # View logs
   docker-compose logs -f

   # Test endpoints
   curl http://localhost:8000/health
   curl http://localhost:3002  # Admin Dashboard
   curl http://localhost:3000  # Flavor Expert App
   ```

3. **If everything works, proceed to AWS setup**

---

### Phase 3: Setup New AWS Infrastructure (2 hours)

1. **Create RDS Database:**
   - Go to AWS RDS Console
   - Create PostgreSQL 15 instance
   - Instance type: `db.t3.micro` (free tier) or `db.t3.small`
   - Enable public access (or use VPC)
   - Save endpoint URL

2. **Create EC2 Instance:**
   - Ubuntu 22.04 LTS
   - Instance type: `t3.medium` minimum
   - 30 GB storage
   - Security group: Allow ports 22, 80, 443, 8000, 3000, 3002

3. **Install Docker on EC2:**
   ```bash
   # SSH into EC2
   ssh -i your-key.pem ubuntu@your-ec2-ip

   # Install Docker
   curl -fsSL https://get.docker.com | sudo sh
   sudo usermod -aG docker ubuntu

   # Install Docker Compose
   sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
   sudo chmod +x /usr/local/bin/docker-compose

   # Verify
   docker --version
   docker-compose --version
   ```

---

### Phase 4: Setup GitHub & CI/CD (30 minutes)

1. **Push to GitHub:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit with Docker setup"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/BR-RetailFlow.git
   git push -u origin main
   ```

2. **Add GitHub Secrets:**
   Go to: Repository → Settings → Secrets and Variables → Actions
   
   Add these secrets:
   ```
   EC2_HOST=your-ec2-public-ip
   EC2_USERNAME=ubuntu
   EC2_SSH_KEY=<paste your private key>
   DATABASE_URL=postgresql://bruser:password@rds-endpoint/postgres
   SECRET_KEY=<generate with: openssl rand -hex 32>
   API_URL=http://localhost:8000/api/v1
   ```

---

### Phase 5: Deploy to Production (30 minutes)

**Option A: Automatic (via GitHub Actions)**
```bash
# Just push to main branch
git push origin main

# GitHub Actions will automatically deploy!
```

**Option B: Manual Deployment**
```bash
# SSH into EC2
ssh -i your-key.pem ubuntu@your-ec2-ip

# Clone repository
git clone https://github.com/YOUR_USERNAME/BR-RetailFlow.git
cd BR-RetailFlow

# Create .env file
nano .env
# Add: DATABASE_URL, SECRET_KEY, API_URL

# Deploy
docker-compose up -d --build

# Check status
docker-compose ps
docker-compose logs -f
```

---

### Phase 6: Verify Deployment (15 minutes)

```bash
# Check services are running
docker-compose ps

# Test API
curl http://your-ec2-ip:8000/health
curl http://your-ec2-ip:8000/docs

# Test Admin Dashboard
curl http://your-ec2-ip:3002

# Test Flavor Expert App
curl http://your-ec2-ip:3000

# View logs
docker-compose logs api
docker-compose logs admin-dashboard
docker-compose logs flavor-expert-app
```

---

## 🔧 Common Commands

### Docker Management
```bash
# View running containers
docker-compose ps

# View logs
docker-compose logs -f [service_name]

# Restart a service
docker-compose restart api

# Stop all services
docker-compose down

# Rebuild and restart
docker-compose up -d --build

# Clean up old images
docker system prune -af
```

### Database Operations
```bash
# Run migrations
docker-compose exec api python -c "
from utils.database import engine, Base
Base.metadata.create_all(bind=engine)
"

# Access database
docker-compose exec api python
>>> from utils.database import engine
>>> # Run SQL queries
```

### Troubleshooting
```bash
# Check container logs
docker logs br-api

# Enter container shell
docker exec -it br-api bash

# Check disk space
df -h

# Check memory usage
free -h

# View all Docker processes
docker ps -a
```

---

## 📊 Cost Estimation

### AWS Monthly Costs:
- **EC2 t3.medium**: ~$30/month
- **RDS db.t3.micro**: ~$15/month (free tier eligible)
- **Data Transfer**: ~$5/month
- **Total**: ~$50/month

### Cost Savings:
- Free tier for 12 months (if eligible)
- Stop EC2 when not in use
- Use Reserved Instances for production

---

## 🎯 Next Steps After Deployment

1. ✅ Configure domain name (optional)
2. ✅ Setup SSL with Let's Encrypt
3. ✅ Configure automated backups
4. ✅ Setup monitoring (CloudWatch)
5. ✅ Create staging environment
6. ✅ Add health check alerts

---

## 📞 Need Help?

1. **Check logs:** `docker-compose logs -f`
2. **Read full guide:** See `DEPLOYMENT_GUIDE.md`
3. **Common issues:** Check troubleshooting section above

---

## ✅ Deployment Checklist

- [ ] Current AWS resources backed up
- [ ] Old AWS resources deleted
- [ ] Docker tested locally
- [ ] New RDS created
- [ ] New EC2 created
- [ ] Docker installed on EC2
- [ ] Code pushed to GitHub
- [ ] GitHub secrets configured
- [ ] Application deployed
- [ ] Services verified working
- [ ] Domain configured (optional)
- [ ] SSL certificates installed (optional)

---

**🎉 You're ready to deploy! Start with Phase 1.**
