# 🏥 MediCore HMS - Production Deployment Guide

## Pre-Deployment Checklist

### Security
- [ ] Generate strong JWT secrets (64+ chars random): `openssl rand -base64 32`
- [ ] Change all default passwords in `.env`
- [ ] Enable HTTPS/SSL on frontend (nginx with certbot)
- [ ] Set `NODE_ENV=production` in backend
- [ ] Review all environment variables are not exposed
- [ ] Enable database password authentication
- [ ] Create database backups
- [ ] Configure firewall rules (only allow 80, 443, 5432 from internal)

### Database
- [ ] Run migrations: `npm run prisma:migrate`
- [ ] Run seed script: `npm run seed`
- [ ] Verify database backups are automated
- [ ] Set up database replication if needed
- [ ] Enable transaction logging

### Infrastructure
- [ ] Use AWS S3 or similar for file storage (not local)
- [ ] Configure email service (SendGrid recommended)
- [ ] Set up SMS/WhatsApp (Twilio) if needed
- [ ] Configure monitoring/logging (CloudWatch, DataDog, etc.)
- [ ] Set up CDN for static assets
- [ ] Configure load balancing if multiple instances

### Deployment
- [ ] Build Docker images
- [ ] Push to container registry
- [ ] Test container images locally
- [ ] Set up CI/CD pipeline
- [ ] Configure health checks
- [ ] Set up auto-recovery

---

## Docker Deployment

### 1. Build Images
```bash
cd medicore
docker-compose build
```

### 2. Set Environment Variables
```bash
# Create .env file in backend/
cp backend/.env.example backend/.env
# Edit with production values
nano backend/.env
```

### 3. Start Services
```bash
# With environment file
export DB_PASSWORD=your_secure_password
docker-compose up -d

# View logs
docker-compose logs -f backend
docker-compose logs -f frontend
```

### 4. Verify Deployment
```bash
# Check services
docker-compose ps

# Test API
curl http://localhost:5000/health

# Test Frontend
curl http://localhost:80/health
```

---

## Kubernetes Deployment

### Prerequisites
- kubectl installed
- Docker images pushed to registry
- ConfigMaps for environment variables

### Deploy
```bash
kubectl apply -f k8s/namespace.yml
kubectl apply -f k8s/configmap.yml
kubectl apply -f k8s/secret.yml
kubectl apply -f k8s/postgres.yml
kubectl apply -f k8s/backend.yml
kubectl apply -f k8s/frontend.yml
```

---

## Monitoring & Maintenance

### Logs
```bash
# Backend logs
docker-compose logs -f backend

# Database logs
docker-compose logs -f postgres

# Real-time monitoring
docker stats
```

### Database Maintenance
```bash
# Backup
docker-compose exec postgres pg_dump -U medicore_user medicore_db > backup.sql

# Restore
docker-compose exec -T postgres psql -U medicore_user medicore_db < backup.sql
```

### Health Checks
- API Health: `GET /health` → Should return 200
- Database: Check connectivity from backend pod
- Frontend: Check nginx logs for errors

---

## Production Best Practices

### Security
1. **Use HTTPS only** - Configure nginx with SSL/TLS
2. **Rotate secrets** - Change JWT secrets every 30 days
3. **Database encryption** - Enable PostgreSQL encryption at rest
4. **Audit logs** - Monitor AuditLog table for suspicious activities
5. **Rate limiting** - Enabled by default, adjust per environment
6. **CORS** - Whitelist only your frontend domain

### Performance
1. **Database indexing** - Added on foreign keys and common queries
2. **Caching** - Implement Redis for sessions/cache
3. **CDN** - Serve static assets from CDN
4. **Compression** - Enabled gzip compression
5. **Connection pooling** - Use PgBouncer for database

### Reliability
1. **Auto-restart** - Docker restart policies configured
2. **Health checks** - Kubernetes liveness/readiness probes
3. **Backups** - Daily automated backups
4. **Failover** - Configure database replication
5. **Load balancing** - Use multiple backend instances

---

## Emergency Procedures

### Database Recovery
```bash
# Check database status
docker-compose exec postgres pg_isready

# Reset database
docker-compose down
docker volume rm medicore_postgres_data
docker-compose up -d postgres
# Run migrations again
docker-compose exec backend npm run prisma:migrate
```

### Container Issues
```bash
# Restart specific service
docker-compose restart backend

# View detailed logs
docker-compose logs backend --tail=100

# Rebuild and restart
docker-compose up --build -d backend
```

### Performance Issues
```bash
# Check resource usage
docker stats

# Check database connections
docker-compose exec postgres psql -U medicore_user -c "SELECT count(*) FROM pg_stat_activity;"

# Clear old logs
docker system prune -a
```

---

## Support & Documentation

- API Docs: `docs/API.md`
- Setup Guide: `SETUP_GUIDE.md`
- Database Schema: Check Prisma schema.prisma
- Error Logs: `backend/logs/` directory
