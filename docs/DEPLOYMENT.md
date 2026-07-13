# MediCore HMS — Production Deployment Guide

## Quick Deploy with Docker Compose

```bash
# 1. Clone and enter directory
git clone https://github.com/yourcompany/medicore-hms.git
cd medicore-hms

# 2. Set up backend environment
cp backend/.env.example backend/.env
nano backend/.env   # Edit with your production values

# 3. Set up frontend environment  
cp frontend/.env.example frontend/.env

# 4. Start all services
docker-compose up -d --build

# 5. Check logs
docker-compose logs -f backend
```

## Production Checklist

### Security
- [ ] Change JWT_SECRET to 64+ char random string
- [ ] Change JWT_REFRESH_SECRET to different 64+ char string
- [ ] Change default super admin password
- [ ] Set strong PostgreSQL password
- [ ] Enable HTTPS with Let's Encrypt
- [ ] Configure firewall (allow only 80, 443, 22)

### Database
- [ ] Set up automated daily backups
- [ ] Test restore procedure
- [ ] Use managed database (AWS RDS, Supabase) for production

### Email / SMS
- [ ] Configure SendGrid or SMTP for transactional emails
- [ ] Set up Twilio for SMS alerts (critical vitals, OTP)

### Performance
- [ ] Use PM2 for Node.js process management
- [ ] Configure Nginx as reverse proxy
- [ ] Enable Redis for session caching (optional)

## Manual Deploy (Ubuntu Server)

### Install prerequisites
```bash
# Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# PostgreSQL 15
sudo apt install -y postgresql postgresql-contrib

# Nginx
sudo apt install -y nginx

# PM2
npm install -g pm2
```

### Setup PostgreSQL
```bash
sudo -u postgres createdb medicore_prod
sudo -u postgres createuser medicore_user --pwprompt
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE medicore_prod TO medicore_user;"
```

### Deploy Backend
```bash
cd /var/www/medicore/backend
npm install --production
cp .env.example .env && nano .env   # Fill production values
npx prisma migrate deploy
npm run seed
pm2 start src/server.js --name medicore-backend
pm2 save
```

### Deploy Frontend
```bash
cd /var/www/medicore/frontend
npm install
npm run build
# Copy dist/ to Nginx web root
sudo cp -r dist/* /var/www/html/
```

### Nginx Configuration
```nginx
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # Frontend
    root /var/www/html;
    index index.html;
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:5000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Socket.io
    location /socket.io/ {
        proxy_pass http://localhost:5000/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

### SSL Certificate (Let's Encrypt)
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

## Support
For deployment issues: support@medicore.com
