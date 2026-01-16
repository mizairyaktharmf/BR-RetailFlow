# BR-RetailFlow Production Deployment Guide

## For 1000+ Branches in UAE

---

## Step 1: Prepare Your Data (Excel)

### Create your branches Excel file with columns:
| Territory | Area | Branch Name | Branch Code | Address | Phone | Steward Name | Steward Email |
|-----------|------|-------------|-------------|---------|-------|--------------|---------------|
| Dubai | Karama | Karama Center | KRM-01 | Shop 12, Mall | +971-4-123-4567 | Ahmed Hassan | ahmed@email.com |
| Dubai | Karama | Karama Mall | KRM-02 | Ground Floor | +971-4-123-4568 | Fatima Ali | fatima@email.com |
| Abu Dhabi | Khalidiya | Khalidiya Mall | KHL-01 | Level 1 | +971-2-456-7890 | Sara Mohammed | sara@email.com |

### Generate sample template:
```bash
cd apps/api/scripts
pip install pandas openpyxl
python bulk_import.py --sample
```

### Import your data:
```bash
python bulk_import.py --file your_branches.xlsx
```

This generates:
- `your_branches_credentials.csv` - Share with managers (Branch ID + Password)
- `your_branches_import_data.json` - Upload to database

---

## Step 2: Database Setup (AWS RDS - PostgreSQL)

### Create RDS Instance:
1. Go to AWS Console → RDS
2. Create database → PostgreSQL 15
3. Settings:
   - DB Instance: `db.t3.medium` (for 1000 branches)
   - Storage: 50GB (auto-scaling)
   - Multi-AZ: Yes (for high availability)

### Create tables:
```bash
cd apps/api
pip install -r requirements.txt
export DATABASE_URL="postgresql://user:pass@your-rds-endpoint:5432/br_retailflow"
python -m alembic upgrade head
```

---

## Step 3: Backend Deployment (AWS EC2)

### Launch EC2 Instance:
- Instance type: `t3.medium`
- OS: Ubuntu 22.04
- Security Group: Allow ports 80, 443, 8000

### Setup:
```bash
# SSH into EC2
ssh -i your-key.pem ubuntu@your-ec2-ip

# Install dependencies
sudo apt update
sudo apt install python3-pip python3-venv nginx certbot

# Clone repo
git clone https://github.com/your-repo/BR-RetailFlow.git
cd BR-RetailFlow/apps/api

# Setup environment
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Environment variables
export DATABASE_URL="postgresql://user:pass@rds-endpoint:5432/br_retailflow"
export SECRET_KEY="your-secret-key-here"
export AWS_S3_BUCKET="br-retailflow-photos"

# Run with Gunicorn
gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8000
```

### Setup Nginx:
```nginx
server {
    listen 80;
    server_name api.your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Enable HTTPS:
```bash
sudo certbot --nginx -d api.your-domain.com
```

---

## Step 4: Frontend Deployment (Vercel - FREE)

### Deploy Steward App:
```bash
cd apps/steward-app

# Update API URL
echo "NEXT_PUBLIC_API_URL=https://api.your-domain.com/api/v1" > .env.production

# Deploy
npx vercel --prod
```

### Deploy Admin Dashboard:
```bash
cd apps/admin-dashboard

# Update API URL
echo "NEXT_PUBLIC_API_URL=https://api.your-domain.com/api/v1" > .env.production

# Deploy
npx vercel --prod
```

---

## Step 5: Photo Storage (AWS S3)

### Create S3 Bucket:
1. AWS Console → S3 → Create bucket
2. Name: `br-retailflow-photos`
3. Region: `me-south-1` (Bahrain - closest to UAE)
4. Enable CORS for uploads

---

## Cost Estimate (Monthly)

| Service | Spec | Cost (USD) |
|---------|------|------------|
| AWS RDS (PostgreSQL) | db.t3.medium, 50GB | ~$50 |
| AWS EC2 (API Server) | t3.medium | ~$30 |
| AWS S3 (Photos) | 100GB | ~$2 |
| Vercel (Frontends) | Free tier | $0 |
| **Total** | | **~$82/month** |

---

## Scaling for Growth

### If you grow beyond 1000 branches:
- **Database**: Upgrade RDS to `db.r6g.large`
- **API**: Add load balancer + multiple EC2 instances
- **Caching**: Add Redis (ElastiCache)

---

## Quick Commands

### Start local development:
```bash
# Steward App
cd apps/steward-app && npm run dev  # http://localhost:3001

# Admin Dashboard
cd apps/admin-dashboard && npm run dev  # http://localhost:3002

# API (backend)
cd apps/api && uvicorn main:app --reload  # http://localhost:8000
```

### Import branches:
```bash
cd apps/api/scripts
python bulk_import.py --sample                    # Generate template
python bulk_import.py --file branches.xlsx        # Preview import
python bulk_import.py --file branches.xlsx -e     # Execute import
```

---

## Support

For issues: https://github.com/your-repo/BR-RetailFlow/issues
