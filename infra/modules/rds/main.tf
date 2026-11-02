# modules/rds/main.tf
# Provisions: subnet group, parameter group, RDS PostgreSQL 16 instance

resource "aws_db_subnet_group" "this" {
  name        = "asteai-${var.environment}-subnet-group"
  subnet_ids  = var.subnet_ids
  description = "AsteAI ${var.environment} RDS subnet group"
}

resource "aws_db_parameter_group" "this" {
  name        = "asteai-${var.environment}-pg16"
  family      = "postgres16"
  description = "AsteAI ${var.environment} PostgreSQL 16 parameters"

  # Dynamic parameters - take effect immediately, no reboot needed
  parameter {
    name         = "log_min_duration_statement"
    value        = "1000"
    apply_method = "immediate"
  }

  parameter {
    name         = "idle_in_transaction_session_timeout"
    value        = "30000"
    apply_method = "immediate"
  }

  # Static parameters - only take effect after an instance reboot
  parameter {
    name         = "rds.force_ssl"
    value        = "1"
    apply_method = "pending-reboot"
  }

  parameter {
    name         = "shared_preload_libraries"
    value        = "pg_stat_statements"
    apply_method = "pending-reboot"
  }
}

# Retrieve the master password from Secrets Manager
data "aws_secretsmanager_secret_version" "master_password" {
  secret_id = var.db_password_secret_arn
}

resource "aws_db_instance" "this" {
  identifier = var.identifier

  # Engine
  engine               = "postgres"
  engine_version       = "16"
  instance_class       = var.instance_class
  parameter_group_name = aws_db_parameter_group.this.name

  # Storage
  storage_type          = "gp3"
  allocated_storage     = var.allocated_storage
  max_allocated_storage = var.max_allocated_storage > 0 ? var.max_allocated_storage : null
  storage_encrypted     = true

  # Credentials
  db_name  = var.db_name
  username = var.db_username
  password = data.aws_secretsmanager_secret_version.master_password.secret_string

  # IAM database authentication (replaces password for app connections)
  iam_database_authentication_enabled = true

  # Network
  db_subnet_group_name   = aws_db_subnet_group.this.name
  vpc_security_group_ids = [var.security_group_id]
  publicly_accessible    = var.publicly_accessible

  # Backups
  backup_retention_period = var.backup_retention_period
  backup_window           = "03:00-04:00" # UTC → 08:30–09:30 IST
  maintenance_window      = "mon:04:00-mon:05:00"

  # Lifecycle
  deletion_protection       = var.deletion_protection
  skip_final_snapshot       = var.skip_final_snapshot
  final_snapshot_identifier = var.skip_final_snapshot ? null : "${var.identifier}-final-snapshot"

  # Monitoring
  monitoring_interval = 60 # Enhanced monitoring every 60s
  monitoring_role_arn = aws_iam_role.rds_monitoring.arn

  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]

  # Performance Insights (free tier: 7 days retention)
  performance_insights_enabled          = true
  performance_insights_retention_period = 7

  lifecycle {
    # Prevent accidental password changes from destroying the instance
    ignore_changes = [password]
  }
}

# Enhanced monitoring IAM role
resource "aws_iam_role" "rds_monitoring" {
  name = "asteai-${var.environment}-rds-monitoring"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "monitoring.rds.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "rds_monitoring" {
  role       = aws_iam_role.rds_monitoring.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}
