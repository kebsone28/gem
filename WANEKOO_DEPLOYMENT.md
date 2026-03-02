# 🌐 PROQUELEC Web SaaS - Wanekoo Deployment Guide

## 📋 Pre-Deployment Checklist

### Infrastructure Requirements
- [x] Domain: `proquelec.wanekoo.com` (à configurer)
- [x] SSL Certificate: Let's Encrypt (auto-renewable)
- [x] Database: PostgreSQL 16 (Wanekoo managed service)
- [x] Docker support: Available on Wanekoo
- [x] 2+ CPU cores, 4GB RAM minimum

### Secrets Configuration
```bash
# .env.production - À générer AVANT le déploiement

# Database
DB_HOST=proquelec-db.internal
DB_USER=proquelec_prod
DB_PASSWORD=$(openssl rand -base64 32)  # Nouveau mot de passe
DB_NAME=proquelec_saa_prod

# JWT Secrets - Générer avec:
JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
JWT_REFRESH_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

# Save to .env.production
echo "JWT_SECRET=$JWT_SECRET" >> .env.production
echo "JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET" >> .env.production
```

---

## 🔧 Step-by-Step Deployment

### Step 1: Register Domain & DNS Setup

```bash
# 1. Acheter le domaine sur Wanekoo
# Go to: https://wanekoo.com/domains
# Register: proquelec.wanekoo.com

# 2. Configurer les DNS A records
# Point vers: [WANEKOO_IP]
# A Record: proquelec.wanekoo.com → [IP]
# A Record: *.proquelec.wanekoo.com → [IP] (wildcard)

# 3. Vérifier DNS propagation (15min-24h)
nslookup proquelec.wanekoo.com
# Should resolve to Wanekoo IP
```

### Step 2: SSH Access & Initial Setup

```bash
# 1. Generate SSH key locally
ssh-keygen -t rsa -b 4096 -f ~/.ssh/wanekoo_id_rsa

# 2. Add public key to Wanekoo dashboard
# Go to: https://wanekoo.com/dashboard/ssh-keys
# Paste content of: ~/.ssh/wanekoo_id_rsa.pub

# 3. Connect via SSH
SSH_KEYPATH=~/.ssh/wanekoo_id_rsa
WANEKOO_IP=YOUR_WANEKOO_IP
WANEKOO_USER=your_username

ssh -i $SSH_KEYPATH $WANEKOO_USER@$WANEKOO_IP

# 4. Verify Docker & Docker Compose
docker --version
# Docker version 24.0+

docker-compose --version
# Docker Compose version 2.20+
```

### Step 3: Clone Repository

```bash
# SSH into Wanekoo
ssh -i ~/.ssh/wanekoo_id_rsa $WANEKOO_USER@$WANEKOO_IP

# Create deployment directory
mkdir -p ~/proquelec-deployment
cd ~/proquelec-deployment

# Clone from GitHub
git clone https://github.com/kebsone28/electron.git .
git checkout main

# Verify structure
ls -la
# Should see: backend/, frontend/, docker-compose.yml, nginx.conf, etc.
```

### Step 4: SSL Certificate (Let's Encrypt)

```bash
# Install Certbot
sudo apt-get update
sudo apt-get install -y certbot python3-certbot-nginx

# Generate certificate
sudo certbot certonly --standalone \
  -d proquelec.wanekoo.com \
  --non-interactive \
  --agree-tos \
  -m admin@proquelec.wanekoo.com

# Create certs directory for Docker
mkdir -p ./certs

# Link certificates
sudo cp /etc/letsencrypt/live/proquelec.wanekoo.com/fullchain.pem ./certs/
sudo cp /etc/letsencrypt/live/proquelec.wanekoo.com/privkey.pem ./certs/
sudo chown $USER:$USER ./certs -R

# Setup auto-renewal with cron
echo "0 0 1 * * /usr/bin/certbot renew --quiet && cp /etc/letsencrypt/live/proquelec.wanekoo.com/*.pem ~/proquelec-deployment/certs/" | crontab -
```

### Step 5: Environment Configuration

```bash
# Create production environment file
cat > .env.production << 'EOF'
NODE_ENV=production
PORT=3001
API_URL=https://proquelec.wanekoo.com

# Database
DB_HOST=proquelec-db.internal
DB_PORT=5432
DB_USER=proquelec_prod
DB_PASSWORD=YOUR_SECURE_PASSWORD_HERE
DB_NAME=proquelec_saa_prod

# Connection Pool (optimisé pour 200+ users)
DB_POOL_MIN=8
DB_POOL_MAX=30
DB_POOL_IDLE_TIMEOUT=60000

# JWT
JWT_SECRET=YOUR_32_CHAR_SECRET_HERE
JWT_EXPIRATION=24h
JWT_REFRESH_SECRET=YOUR_32_CHAR_REFRESH_SECRET_HERE
JWT_REFRESH_EXPIRATION=7d

# Security
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=500
CORS_ORIGIN=https://proquelec.wanekoo.com

# Logging
LOG_LEVEL=info

# KPI Caching (5 min)
ENABLE_KPI_CACHING=true
KPI_CACHE_TTL_SECONDS=300
EOF

# Restrict permissions
chmod 600 .env.production
```

### Step 6: PostgreSQL Database Setup

```bash
# If using Wanekoo managed PostgreSQL:
# 1. Go to https://wanekoo.com/dashboard/databases
# 2. Create new database: proquelec_saa_prod
# 3. Get connection string

# If using Docker PostgreSQL:
# Update docker-compose.yml with:
# - POSTGRES_PASSWORD from .env.production
# - postgres_data volume path

# Initialize schema
docker exec proquelec-postgres psql -U proquelec_prod -d proquelec_saa_prod -f /docker-entrypoint-initdb.d/01-schema.sql

# Or manually:
psql -h $DB_HOST -U proquelec_prod -d proquelec_saa_prod < backend/src/db/schema.sql
```

### Step 7: Start Docker Services

```bash
# Build and start all services
docker-compose up -d

# Wait for services to be healthy
sleep 30

# Check status
docker-compose ps
# All services should show "Up"

# View logs
docker-compose logs -f

# Test health endpoint
curl https://proquelec.wanekoo.com/api/health
# Should return: {"status":"OK","environment":"production","version":"1.0.0"}
```

### Step 8: Database Population

```bash
# Create initial admin user
docker exec proquelec-app node -e "
const bcrypt = require('bcryptjs');
const email = 'admin@proquelec.com';
const password = 'ChangeMe123!';
const hash = bcrypt.hashSync(password, 10);

console.log('Email:', email);
console.log('Hash:', hash);
console.log('⚠️  Change this password after first login!');
"

# Note: The initial admin user is created by schema.sql
# Login with: admin@proquelec.com / admin123
# Change password immediately in settings
```

### Step 9: Backup Strategy

```bash
# Create backup script
cat > backup-database.sh << 'EOF'
#!/bin/bash

BACKUP_DIR="/backups/proquelec"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
DB_HOST="$DB_HOST"
DB_USER="$DB_USER"
DB_NAME="$DB_NAME"

mkdir -p $BACKUP_DIR

# Dump database
PGPASSWORD="$DB_PASSWORD" pg_dump \
  -h $DB_HOST \
  -U $DB_USER \
  -d $DB_NAME \
  -F c > "$BACKUP_DIR/backup_$TIMESTAMP.dump"

# Keep only last 30 days
find $BACKUP_DIR -name "backup_*.dump" -mtime +30 -delete

echo "✅ Backup completed: $BACKUP_DIR/backup_$TIMESTAMP.dump"
EOF

chmod +x backup-database.sh

# Schedule daily backups at 2 AM
echo "0 2 * * * ~/proquelec-deployment/backup-database.sh" | crontab -

# Test backup
./backup-database.sh
```

### Step 10: Monitoring & Logs

```bash
# View real-time application logs
docker-compose logs -f app

# View streaming nginx access logs
docker logs -f proquelec-nginx | tail -f

# Check disk space
df -h

# Monitor database connections
docker-compose exec postgres psql -U proquelec_prod -d proquelec_saa_prod \
  -c "SELECT count(*) FROM pg_stat_activity;"

# Setup log rotation
sudo cat > /etc/logrotate.d/proquelec << 'EOF'
/var/lib/docker/containers/*/*.log {
  rotate 10
  daily
  compress
  delaycompress
  copytruncate
}
EOF
```

---

## 🔄 Continuous Deployment (GitHub Actions)

### GitHub Secrets Setup

```bash
# Add to GitHub repo settings → Secrets:

WANEKOO_HOST = your.wanekoo.ip  # ou domain
WANEKOO_USER = your_username
WANEKOO_PASSWORD = your_password
WANEKOO_SSH_KEY = (contenu de ~/.ssh/wanekoo_id_rsa)
WANEKOO_DEPLOY_PATH = /home/your_username/proquelec-deployment
```

### Auto-Deploy on Push

```bash
# GitHub Actions will:
# 1. Run tests on every push
# 2. Build Docker image
# 3. Push to GitHub Container Registry
# 4. SSH into Wanekoo
# 5. Pull latest code
# 6. docker-compose up -d (zero-downtime)
# 7. Health checks

# Monitor deployments at:
# https://github.com/kebsone28/electron/actions
```

---

## 🚨 Troubleshooting

### Services not starting
```bash
# Check Docker logs
docker-compose logs app
docker-compose logs postgres
docker-compose logs nginx

# Rebuild containers
docker-compose down
docker-compose up -d --build
```

### Database connection errors
```bash
# Check connection
docker-compose exec app nc -zv postgres 5432

# Verify credentials in .env.production
cat .env.production | grep DB_

# Check PostgreSQL is running
docker-compose exec postgres pg_isready
```

### SSL Certificate issues
```bash
# Check certificate validity
sudo certbot certificates

# Renew if needed
sudo certbot renew --force-renewal

# Verify nginx config
docker exec proquelec-nginx nginx -t
```

### Performance degradation (slow queries)
```bash
# Enable PostgreSQL query logging
docker-compose exec postgres psql -U proquelec_prod \
  -c "ALTER SYSTEM SET log_statement = 'all';"

# Check slow queries
docker-compose exec postgres psql -U proquelec_prod \
  -c "SELECT query, calls, mean_time FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 5;"
```

---

## 📊 Production Monitoring

### Health Checks (Auto-restart if down)
```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:3001/api/health"]
  interval: 30s
  timeout: 10s
  retries: 3
```

### Key Metrics to Monitor
- API response time: Should be <500ms
- Database connection pool usage: <80%
- Disk space: Free >10GB
- Memory usage: <80%
- Error rate: <1% of requests

---

## 🔒 Security Hardening (Production)

```bash
# 1. Disable SSH password auth (use keys only)
sudo sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
sudo systemctl restart sshd

# 2. Setup firewall
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

# 3. Update all packages
sudo apt-get update && sudo apt-get upgrade -y

# 4. Add fail2ban for brute force protection
sudo apt-get install -y fail2ban
sudo systemctl enable fail2ban

# 5. Regular security audits
# Run: docker-compose exec app npm audit
```

---

## 📞 Support & Escalation

- **Wanekoo Support**: https://wanekoo.com/support
- **GitHub Issues**: https://github.com/kebsone28/electron/issues
- **Application Logs**: docker-compose logs app
- **Database Logs**: docker-compose logs postgres
- **Nginx Logs**: docker logs proquelec-nginx

---

## ✅ Post-Deployment Verification

```bash
# 1. Test API health
curl https://proquelec.wanekoo.com/api/health

# 2. Test login flow
curl -X POST https://proquelec.wanekoo.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@proquelec.com","password":"admin123"}'

# 3. Test KPI endpoint
curl https://proquelec.wanekoo.com/api/kpi/summary \
  -H "Authorization: Bearer YOUR_TOKEN"

# 4. Check SSL certificate
echo | openssl s_client -servername proquelec.wanekoo.com -connect proquelec.wanekoo.com:443 2>/dev/null | openssl x509 -noout -dates

# 5. Load test (simulate 200 concurrent users)
# Use: Apache JMeter, k6, or wrk2 for load testing
```

---

**Deployment Status**: 🚀 READY FOR PRODUCTION  
**Last Updated**: 2025-02-28  
**Next Review**: After first production deployment
