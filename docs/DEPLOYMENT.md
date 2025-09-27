# Deployment Guide

This guide covers different deployment options for the WhatsApp Personal API, from local development to production environments.

## Table of Contents

1. [Deployment Overview](#deployment-overview)
2. [Fly.io Deployment](#flyio-deployment)
3. [Docker Deployment](#docker-deployment)
4. [VPS Deployment](#vps-deployment)
5. [Environment Configuration](#environment-configuration)
6. [Data Persistence](#data-persistence)
7. [Security Considerations](#security-considerations)
8. [Monitoring & Maintenance](#monitoring--maintenance)
9. [Troubleshooting](#troubleshooting)

---

## Deployment Overview

### Key Requirements

- **Node.js 18+** (Node.js 20+ recommended)
- **Persistent storage** for WhatsApp sessions and scheduled messages
- **Secure API key** configuration
- **Network access** for WhatsApp Web connections
- **Process management** for production reliability

### Storage Requirements

The application needs persistent storage for:
- **Sessions directory** (`sessions/`): WhatsApp authentication data
- **Data directory** (`data/`): Scheduled messages and pub/sub topics
- **Environment configuration**: API keys and settings

⚠️ **Critical**: Without persistent storage, you'll need to re-authenticate with WhatsApp and lose all scheduled messages on every restart.

---

## Fly.io Deployment

Fly.io is the recommended deployment platform, with included configuration files.

### Prerequisites

1. **Install Fly CLI**
   ```bash
   # macOS
   brew install flyctl
   
   # Linux
   curl -L https://fly.io/install.sh | sh
   
   # Windows
   powershell -Command "iwr https://fly.io/install.ps1 -useb | iex"
   ```

2. **Authenticate**
   ```bash
   fly auth login
   ```

### Deployment Steps

1. **Create Fly Application**
   ```bash
   # From your project directory
   fly launch
   
   # Or use existing fly.toml
   fly launch --copy-config
   ```

2. **Create Persistent Volume**
   ```bash
   # Create a 1GB volume (adjust size as needed)
   fly volumes create whatsapp_storage --region ord --size 1
   
   # Check your region
   fly regions list
   ```

3. **Set Environment Variables**
   ```bash
   # Set your API keys (use strong, random keys)
   fly secrets set API_TOKENS="prod_$(openssl rand -hex 32),backup_$(openssl rand -hex 32)"
   
   # Optional: Set log level
   fly secrets set LOG_LEVEL=info
   
   # Optional: Custom port (usually not needed)
   fly secrets set PORT=8080
   ```

4. **Deploy**
   ```bash
   fly deploy
   ```

5. **Check Deployment**
   ```bash
   # Check application status
   fly status
   
   # View logs
   fly logs
   
   # Check health
   curl https://your-app.fly.dev/health
   ```

### Fly.io Configuration

The included `fly.toml` configuration:

```toml
app = "whatsapp-personal-api"
primary_region = "ord"

[build]

[env]
  STORAGE_DIR = "/data"

[http_service]
  internal_port = 8080
  force_https = true
  auto_stop_machines = false
  auto_start_machines = true
  min_machines_running = 1
  processes = ["app"]

[[mounts]]
  source = "whatsapp_storage"
  destination = "/data"

[[vm]]
  cpu_kind = "shared"
  cpus = 1
  memory_mb = 512
```

### Fly.io Management

```bash
# Scale resources (if needed)
fly scale memory 1024

# SSH into container
fly ssh console

# Check volume usage
fly ssh console -C "df -h /data"

# View real-time logs
fly logs -f
```

---

## Docker Deployment

### Using Pre-built Docker Setup

1. **Build the Image**
   ```bash
   docker build -t whatsapp-personal-api .
   ```

2. **Create Data Volume**
   ```bash
   docker volume create whatsapp_data
   ```

3. **Run Container**
   ```bash
   docker run -d \
     --name whatsapp-api \
     -p 3000:8080 \
     -e API_TOKENS="your_secure_api_keys_here" \
     -e STORAGE_DIR=/data \
     -v whatsapp_data:/data \
     --restart unless-stopped \
     whatsapp-personal-api
   ```

4. **Check Status**
   ```bash
   # Check container status
   docker ps
   
   # View logs
   docker logs whatsapp-api -f
   
   # Test API
   curl http://localhost:3000/health
   ```

### Docker Compose Setup

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  whatsapp-api:
    build: .
    container_name: whatsapp-personal-api
    restart: unless-stopped
    ports:
      - "3000:8080"
    environment:
      - API_TOKENS=${API_TOKENS}
      - STORAGE_DIR=/data
      - LOG_LEVEL=info
    volumes:
      - whatsapp_data:/data
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  whatsapp_data:
```

Create `.env` file:
```env
API_TOKENS=prod_your_secure_key_here,backup_another_key_here
```

Deploy with Docker Compose:
```bash
docker-compose up -d
```

### Docker Production Tips

1. **Use Multi-stage Builds** (already configured in Dockerfile)
2. **Set Resource Limits**
   ```bash
   docker run --memory=512m --cpus=1 ...
   ```
3. **Configure Logging**
   ```bash
   docker run --log-driver=json-file --log-opt max-size=10m ...
   ```

---

## VPS Deployment

### Server Requirements

- **OS**: Ubuntu 20.04+ (recommended) or similar Linux distribution
- **RAM**: 512MB minimum, 1GB recommended
- **CPU**: 1 vCPU sufficient for most use cases
- **Storage**: 10GB minimum (for logs, sessions, data)
- **Network**: Reliable internet connection

### Deployment Steps

1. **Prepare Server**
   ```bash
   # Update system
   sudo apt update && sudo apt upgrade -y
   
   # Install Node.js 20
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs
   
   # Install PM2 for process management
   sudo npm install -g pm2
   
   # Create application user
   sudo useradd -m -s /bin/bash whatsapp
   sudo usermod -aG sudo whatsapp
   ```

2. **Deploy Application**
   ```bash
   # Switch to app user
   sudo su - whatsapp
   
   # Clone or upload your application
   git clone <your-repo> whatsapp-api
   cd whatsapp-api
   
   # Install dependencies
   npm install
   
   # Build application
   npm run build
   ```

3. **Configure Environment**
   ```bash
   # Create .env file
   cat > .env << EOF
   API_TOKENS=prod_$(openssl rand -hex 32),backup_$(openssl rand -hex 32)
   PORT=3000
   LOG_LEVEL=info
   STORAGE_DIR=/home/whatsapp/data
   EOF
   
   # Create data directory
   mkdir -p /home/whatsapp/data
   ```

4. **Setup PM2 Process Manager**
   ```bash
   # Create PM2 ecosystem file
   cat > ecosystem.config.js << EOF
   module.exports = {
     apps: [{
       name: 'whatsapp-api',
       script: 'dist/server.js',
       instances: 1,
       exec_mode: 'fork',
       restart_delay: 4000,
       max_restarts: 10,
       env: {
         NODE_ENV: 'production'
       }
     }]
   }
   EOF
   
   # Start application
   pm2 start ecosystem.config.js
   
   # Save PM2 configuration
   pm2 save
   
   # Setup auto-start on boot
   pm2 startup
   # Follow the instructions to run the suggested command with sudo
   ```

5. **Setup Nginx (Optional)**
   ```bash
   sudo apt install nginx
   
   # Create nginx config
   sudo tee /etc/nginx/sites-available/whatsapp-api << EOF
   server {
       listen 80;
       server_name your-domain.com;
   
       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade \$http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host \$host;
           proxy_set_header X-Real-IP \$remote_addr;
           proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto \$scheme;
           proxy_cache_bypass \$http_upgrade;
       }
   }
   EOF
   
   # Enable site
   sudo ln -s /etc/nginx/sites-available/whatsapp-api /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl reload nginx
   ```

### VPS Management

```bash
# PM2 management
pm2 status
pm2 logs whatsapp-api
pm2 restart whatsapp-api
pm2 stop whatsapp-api

# Monitor system resources
htop
df -h
free -h

# View application logs
tail -f ~/.pm2/logs/whatsapp-api-out.log
```

---

## Environment Configuration

### Required Variables

```env
# Required: API authentication tokens
API_TOKENS=key1,key2,key3

# Optional: Server port (default: 3000, or 8080 in Docker)
PORT=3000

# Optional: Storage directory (default: current directory)
STORAGE_DIR=/path/to/data

# Optional: Log level (default: info)
LOG_LEVEL=debug|info|warn|error
```

### API Token Security

Generate secure tokens:
```bash
# Generate a secure 64-character token
node -e "console.log('api_' + require('crypto').randomBytes(32).toString('hex'))"

# Or using OpenSSL
echo "api_$(openssl rand -hex 32)"
```

### Multiple Environments

Use different tokens for different environments:
```env
# Development
API_TOKENS=dev_abc123...,test_def456...

# Production
API_TOKENS=prod_xyz789...,backup_uvw012...
```

---

## Data Persistence

### Critical Files

1. **Sessions Directory** (`sessions/`)
   - Contains WhatsApp authentication data
   - **Critical**: Backup regularly to avoid re-authentication

2. **Scheduled Messages** (`data/scheduled.json`)
   - All your scheduled messages
   - **Critical**: Loss means losing all schedules

3. **Pub/Sub Data** (`data/pubsub.json`)
   - Topics and subscribers
   - **Important**: Loss means losing all topics/subscriptions

### Backup Strategy

```bash
# Create backup script
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups"
DATA_DIR="/path/to/your/data"

mkdir -p $BACKUP_DIR

# Backup sessions and data
tar -czf "$BACKUP_DIR/whatsapp_backup_$DATE.tar.gz" \
  "$DATA_DIR/sessions" \
  "$DATA_DIR/data"

# Keep only last 7 backups
find $BACKUP_DIR -name "whatsapp_backup_*.tar.gz" -mtime +7 -delete

echo "Backup completed: whatsapp_backup_$DATE.tar.gz"
```

Set up daily backups with cron:
```bash
# Add to crontab
0 2 * * * /path/to/backup-script.sh
```

### Restore Process

```bash
# Stop the application
pm2 stop whatsapp-api  # or docker stop whatsapp-api

# Extract backup
tar -xzf whatsapp_backup_20240115_020000.tar.gz -C /

# Start the application
pm2 start whatsapp-api  # or docker start whatsapp-api
```

---

## Security Considerations

### API Security

1. **Strong API Keys**
   - Use 32+ character random strings
   - Rotate keys regularly
   - Never commit keys to version control

2. **Network Security**
   ```bash
   # Firewall rules (UFW example)
   sudo ufw default deny incoming
   sudo ufw default allow outgoing
   sudo ufw allow ssh
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   sudo ufw enable
   ```

3. **HTTPS Setup**
   ```bash
   # Install Certbot for Let's Encrypt
   sudo apt install certbot python3-certbot-nginx
   
   # Get SSL certificate
   sudo certbot --nginx -d your-domain.com
   ```

### Application Security

1. **File Permissions**
   ```bash
   # Secure data directory
   chmod 700 /path/to/data
   chown -R whatsapp:whatsapp /path/to/data
   
   # Secure environment file
   chmod 600 .env
   ```

2. **Process Security**
   - Run as non-root user
   - Use process managers (PM2, systemd)
   - Set resource limits

3. **Monitoring**
   ```bash
   # Monitor failed authentication attempts
   grep "Unauthorized" ~/.pm2/logs/whatsapp-api-out.log
   
   # Monitor resource usage
   pm2 monit
   ```

---

## Monitoring & Maintenance

### Health Monitoring

Set up automated health checks:

```bash
#!/bin/bash
# healthcheck.sh
HEALTH_URL="https://your-domain.com/health"
WEBHOOK_URL="your-slack-or-discord-webhook"

RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" $HEALTH_URL)

if [ $RESPONSE -ne 200 ]; then
    curl -X POST $WEBHOOK_URL \
        -H "Content-Type: application/json" \
        -d '{"text":"🚨 WhatsApp API is down! HTTP status: '$RESPONSE'"}'
fi
```

### Log Management

```bash
# Rotate PM2 logs
pm2 install pm2-logrotate

# Configure log rotation
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7

# Or use logrotate
sudo tee /etc/logrotate.d/whatsapp-api << EOF
/home/whatsapp/.pm2/logs/*.log {
    daily
    missingok
    rotate 7
    compress
    notifempty
    create 644 whatsapp whatsapp
    postrotate
        pm2 reloadLogs
    endscript
}
EOF
```

### Performance Monitoring

```bash
# Monitor with PM2
pm2 monit

# System monitoring
htop
iotop
netstat -tulpn | grep :3000

# Application-specific monitoring
curl -s http://localhost:3000/health | jq '.scheduledMessages'
```

### Update Process

```bash
# Update application (VPS deployment)
cd /home/whatsapp/whatsapp-api

# Backup current state
tar -czf backup-before-update.tar.gz data sessions

# Pull updates
git pull origin main

# Install dependencies
npm install

# Rebuild
npm run build

# Restart
pm2 restart whatsapp-api

# Check health
curl http://localhost:3000/health
```

---

## Troubleshooting

### Common Issues

1. **Application Won't Start**
   ```bash
   # Check logs
   pm2 logs whatsapp-api
   
   # Check environment
   pm2 env 0
   
   # Check file permissions
   ls -la /path/to/data
   ```

2. **WhatsApp Connection Issues**
   ```bash
   # Check health endpoint
   curl http://localhost:3000/health
   
   # Check if sessions directory exists
   ls -la /path/to/data/sessions
   
   # Try restarting
   pm2 restart whatsapp-api
   ```

3. **Storage Issues**
   ```bash
   # Check disk usage
   df -h
   
   # Check data directory
   du -sh /path/to/data/*
   
   # Check file permissions
   ls -la /path/to/data
   ```

4. **Memory Issues**
   ```bash
   # Check memory usage
   free -h
   pm2 monit
   
   # Restart if needed
   pm2 restart whatsapp-api
   ```

### Debug Mode

Enable debug logging:
```bash
# Set debug log level
pm2 restart whatsapp-api --update-env --env LOG_LEVEL=debug

# Or in environment file
echo 'LOG_LEVEL=debug' >> .env
pm2 restart whatsapp-api
```

### Recovery Procedures

1. **Lost WhatsApp Session**
   - Delete `sessions/` directory
   - Restart application
   - Scan new QR code

2. **Corrupted Data**
   - Stop application
   - Restore from backup
   - Restart application

3. **High Resource Usage**
   - Check for scheduled message loops
   - Review pub/sub broadcast frequencies
   - Monitor connection stability

---

This deployment guide covers the most common deployment scenarios. Choose the option that best fits your infrastructure and maintenance preferences. For production use, Fly.io is recommended for simplicity, while VPS deployment offers maximum control.