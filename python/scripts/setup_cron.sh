#!/bin/bash
# Setup cron jobs for continuous RL training pipeline

set -e

echo "🔧 Setting up cron jobs for continuous RL training"

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Check if running in local or coreweave
ENVIRONMENT="${TRAINING_ENV:-local}"

echo "Environment: $ENVIRONMENT"
echo "Project root: $PROJECT_ROOT"

# Create log directory
mkdir -p "$PROJECT_ROOT/logs"

# Cron schedule
if [ "$ENVIRONMENT" = "local" ]; then
    # Local: run every 2 hours to save resources
    DATA_COLLECTION_SCHEDULE="0 */2 * * *"
    TRAINING_SCHEDULE="5 */2 * * *"
else
    # CoreWeave: run every hour
    DATA_COLLECTION_SCHEDULE="0 * * * *"
    TRAINING_SCHEDULE="5 * * * *"
fi

# Generate crontab entries
CRON_FILE="/tmp/babylon_rl_cron.txt"

cat > "$CRON_FILE" << EOF
# Babylon RL Continuous Training Pipeline
# Environment: $ENVIRONMENT
# Generated: $(date)

# Set environment variables
SHELL=/bin/bash
PATH=/usr/local/bin:/usr/bin:/bin
TRAIN_RL_LOCAL=true
DATABASE_URL=${DATABASE_URL}
OPENPIPE_API_KEY=${OPENPIPE_API_KEY}
TRAINING_ENV=${ENVIRONMENT}

# Data Collection (continuous)
# Runs every hour/2hours to collect and validate window data
$DATA_COLLECTION_SCHEDULE cd $PROJECT_ROOT && python3 scripts/run_continuous_training.py MODE=continuous >> logs/training_pipeline.log 2>&1

# Cleanup old logs (daily at 3am)
0 3 * * * find $PROJECT_ROOT/logs -name "*.log" -mtime +7 -delete

# Health check (every 15 minutes)
*/15 * * * * curl -f http://localhost:8000/health || echo "Training endpoint down" >> logs/health_check.log

EOF

echo "📄 Cron configuration generated:"
cat "$CRON_FILE"
echo ""

# Install crontab
if [ "$DRY_RUN" = "true" ]; then
    echo "🔍 DRY RUN: Would install this crontab"
    echo "To actually install, run without DRY_RUN=true"
else
    echo "Installing crontab..."
    
    # Backup existing crontab
    if crontab -l > /dev/null 2>&1; then
        crontab -l > "$PROJECT_ROOT/logs/crontab_backup_$(date +%Y%m%d_%H%M%S).txt"
        echo "✅ Backed up existing crontab"
    fi
    
    # Install new crontab (append to existing)
    (crontab -l 2>/dev/null || true; cat "$CRON_FILE") | crontab -
    
    echo "✅ Crontab installed"
    echo ""
    echo "Active cron jobs:"
    crontab -l | grep -A 20 "Babylon RL"
fi

# Setup systemd service (alternative to cron for CoreWeave)
if [ "$ENVIRONMENT" = "coreweave" ] && command -v systemctl > /dev/null; then
    echo ""
    echo "Setting up systemd service..."
    
    SERVICE_FILE="/tmp/babylon-rl-training.service"
    
    cat > "$SERVICE_FILE" << EOF
[Unit]
Description=Babylon RL Continuous Training Pipeline
After=network.target postgresql.service

[Service]
Type=simple
User=$(whoami)
WorkingDirectory=$PROJECT_ROOT
Environment="TRAIN_RL_LOCAL=true"
Environment="DATABASE_URL=${DATABASE_URL}"
Environment="OPENPIPE_API_KEY=${OPENPIPE_API_KEY}"
Environment="TRAINING_ENV=${ENVIRONMENT}"
ExecStart=/usr/bin/python3 $PROJECT_ROOT/scripts/run_continuous_training.py
Restart=always
RestartSec=60
StandardOutput=append:$PROJECT_ROOT/logs/training_pipeline.log
StandardError=append:$PROJECT_ROOT/logs/training_pipeline.log

[Install]
WantedBy=multi-user.target
EOF
    
    if [ "$DRY_RUN" != "true" ]; then
        sudo cp "$SERVICE_FILE" /etc/systemd/system/
        sudo systemctl daemon-reload
        sudo systemctl enable babylon-rl-training
        sudo systemctl start babylon-rl-training
        
        echo "✅ Systemd service installed and started"
        echo "Check status with: sudo systemctl status babylon-rl-training"
    else
        echo "🔍 DRY RUN: Would install systemd service:"
        cat "$SERVICE_FILE"
    fi
fi

# Create monitoring script
MONITOR_SCRIPT="$PROJECT_ROOT/scripts/monitor_training.sh"

cat > "$MONITOR_SCRIPT" << 'EOF'
#!/bin/bash
# Monitor continuous training pipeline

echo "📊 Babylon RL Training Pipeline Status"
echo "========================================"
echo ""

# Check if training is running
if pgrep -f "run_continuous_training.py" > /dev/null; then
    echo "✅ Training pipeline is RUNNING"
    echo "PID: $(pgrep -f 'run_continuous_training.py')"
else
    echo "❌ Training pipeline is NOT running"
fi

echo ""

# Check recent logs
echo "📝 Recent logs (last 20 lines):"
echo "--------------------------------"
tail -n 20 logs/training_pipeline.log 2>/dev/null || echo "No logs found"

echo ""

# Check database status
echo "🗄️  Database status:"
echo "-------------------"
if [ -n "$DATABASE_URL" ]; then
    psql "$DATABASE_URL" -c "
        SELECT 
            window_id, 
            status, 
            agent_count,
            created_at
        FROM training_windows 
        ORDER BY created_at DESC 
        LIMIT 5;
    " 2>/dev/null || echo "Could not connect to database"
else
    echo "DATABASE_URL not set"
fi

echo ""

# Check disk space
echo "💾 Disk space (checkpoints):"
echo "---------------------------"
du -sh checkpoints/ 2>/dev/null || echo "No checkpoints directory"

echo ""

# Check latest model
echo "🤖 Latest model:"
echo "----------------"
ls -lth checkpoints/ 2>/dev/null | head -n 5 || echo "No models found"

EOF

chmod +x "$MONITOR_SCRIPT"

echo ""
echo "✅ Setup complete!"
echo ""
echo "📋 Next steps:"
echo "  1. Monitor with: $MONITOR_SCRIPT"
echo "  2. View logs: tail -f logs/training_pipeline.log"
echo "  3. Check cron: crontab -l"
if [ "$ENVIRONMENT" = "coreweave" ]; then
    echo "  4. Check systemd: sudo systemctl status babylon-rl-training"
fi
echo ""
echo "🚀 Training pipeline will run automatically!"



