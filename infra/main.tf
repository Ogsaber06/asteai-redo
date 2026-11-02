terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
    null = {
      source  = "hashicorp/null"
      version = "~> 3.2"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "asteai"
      Environment = var.environment
      ManagedBy   = "opentofu"
    }
  }
}

# ── Subnets ───────────────────────────────────────────────────────────────────

data "aws_subnets" "all" {
  filter {
    name   = "vpc-id"
    values = [var.vpc_id]
  }
}

locals {
  db_subnet_ids = length(var.db_subnet_ids) > 0 ? var.db_subnet_ids : data.aws_subnets.all.ids
}

# ── Security group ────────────────────────────────────────────────────────────
# Allows port 5432 from developer IPs only.
# Add each dev's IP to developer_ips in terraform.tfvars.

module "rds_sg" {
  source = "./modules/sg"

  name        = "asteai-${var.environment}-rds-sg"
  description = "AsteAI RDS PostgreSQL - allow 5432 from developers"
  vpc_id      = var.vpc_id

  ingress_rules = [
    {
      description       = "PostgreSQL from developer IPs"
      from_port         = 5432
      to_port           = 5432
      protocol          = "tcp"
      cidr_blocks       = var.developer_ips
      security_group_id = null
    },
  ]
}

# ── Secrets Manager: DB master password ───────────────────────────────────────

module "db_secret" {
  source = "./modules/secrets"

  secret_name = "asteai/${var.environment}/db-master-password"
  description = "AsteAI RDS master password (${var.environment})"
}

# ── RDS PostgreSQL ────────────────────────────────────────────────────────────

module "rds" {
  source = "./modules/rds"

  environment             = var.environment
  aws_region              = var.aws_region
  vpc_id                  = var.vpc_id
  subnet_ids              = local.db_subnet_ids
  security_group_id       = module.rds_sg.sg_id
  identifier              = "asteai-${var.environment}"
  db_name                 = "asteai"
  db_username             = "asteai_root"
  db_password_secret_arn  = module.db_secret.secret_arn
  instance_class          = var.db_instance_class
  allocated_storage       = var.db_allocated_storage
  max_allocated_storage   = var.db_max_allocated_storage
  deletion_protection     = var.environment == "production"
  skip_final_snapshot     = var.environment != "production"
  backup_retention_period = var.environment == "production" ? 7 : 1
  publicly_accessible     = true

  depends_on = [module.rds_sg, module.db_secret]
}

# ── Schema initialisation ─────────────────────────────────────────────────────

resource "null_resource" "schema_init" {
  triggers = {
    schema_hash  = filesha256("${path.module}/../packages/db/migrations/001_initial_schema.sql")
    rds_endpoint = module.rds.endpoint
  }

  provisioner "local-exec" {
    interpreter = ["/bin/bash", "-c"]
    command     = <<-BASH
      set -euo pipefail

      ENDPOINT="${module.rds.endpoint}"
      PORT="${module.rds.port}"
      USER="${module.rds.master_username}"
      SECRET_ARN="${module.db_secret.secret_arn}"
      REGION="${var.aws_region}"

      echo "Fetching master password..."
      export PGPASSWORD=$(aws secretsmanager get-secret-value \
        --secret-id "$SECRET_ARN" --region "$REGION" \
        --query SecretString --output text)

      DSN="host=$ENDPOINT port=$PORT user=$USER sslmode=require"

      echo "Waiting for RDS..."
      for i in $(seq 1 20); do
        pg_isready -h "$ENDPOINT" -p "$PORT" -U "$USER" && break
        echo "  attempt $i/20 - sleeping 15s..."
        sleep 15
      done

      echo "Creating database..."
      psql "$DSN dbname=postgres" \
        -c "SELECT 1 FROM pg_database WHERE datname='asteai'" | grep -q 1 \
        || psql "$DSN dbname=postgres" \
             -c "CREATE DATABASE asteai ENCODING 'UTF8' LC_COLLATE 'en_US.UTF-8' LC_CTYPE 'en_US.UTF-8' TEMPLATE template0;"

      echo "Running schema migration..."
      psql "$DSN dbname=asteai" \
        -f "${path.module}/../packages/db/migrations/001_initial_schema.sql"

      echo "Done."
    BASH
  }

  depends_on = [module.rds]
}

# ── Team IAM users ────────────────────────────────────────────────────────────

module "team" {
  source = "./modules/team"

  environment  = var.environment
  aws_region   = var.aws_region
  account_id   = var.account_id
  rds_arn      = module.rds.arn
  team_members = var.team_members
}
