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

  # Uncomment and fill in once you have an S3 bucket for state
  # backend "s3" {
  #   bucket         = "asteai-tofu-state"
  #   key            = "asteai-redo/rds/terraform.tfstate"
  #   region         = "ap-south-1"
  #   encrypt        = true
  #   dynamodb_table = "asteai-tofu-locks"
  # }
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

# ── Data: VPC + subnets ──────────────────────────────────────────────────────
data "aws_vpc" "main" {
  id = var.vpc_id
}

# All subnets in the VPC - used as fallback when no explicit IDs are given
data "aws_subnets" "all" {
  filter {
    name   = "vpc-id"
    values = [var.vpc_id]
  }
}

# Try private-tagged subnets first (preferred - keeps RDS off public routes)
data "aws_subnets" "private" {
  filter {
    name   = "vpc-id"
    values = [var.vpc_id]
  }
  filter {
    name   = "tag:Type"
    values = ["private"]
  }
}

locals {
  # Resolution order:
  #  1. Explicit var.db_subnet_ids (highest priority - set these in tfvars)
  #  2. Subnets tagged Type=private
  #  3. All subnets in the VPC (last resort)
  db_subnet_ids = (
    length(var.db_subnet_ids) > 0
    ? var.db_subnet_ids
    : length(data.aws_subnets.private.ids) > 0
    ? data.aws_subnets.private.ids
    : data.aws_subnets.all.ids
  )
}

# ── Security group for RDS ────────────────────────────────────────────────────
module "rds_sg" {
  source = "./modules/sg"

  name        = "asteai-${var.environment}-rds-sg"
  description = "AsteAI RDS PostgreSQL - allow 5432 from app layer"
  vpc_id      = var.vpc_id

  # Allow inbound 5432 from the app security group (ECS / EC2)
  # and from the VPC CIDR so local-exec schema init works via the bastion/runner
  ingress_rules = [
    {
      description       = "PostgreSQL from app sg"
      from_port         = 5432
      to_port           = 5432
      protocol          = "tcp"
      cidr_blocks       = []
      security_group_id = var.app_security_group_id
    },
    {
      description       = "PostgreSQL from VPC CIDR (migrations / psql)"
      from_port         = 5432
      to_port           = 5432
      protocol          = "tcp"
      cidr_blocks       = [data.aws_vpc.main.cidr_block]
      security_group_id = null
    },
    {
      description       = "PostgreSQL from my IP (tofu local-exec schema init)"
      from_port         = 5432
      to_port           = 5432
      protocol          = "tcp"
      cidr_blocks       = [var.my_ip]
      security_group_id = null
    },
  ]
}

# ── IAM: role for RDS IAM auth + Secrets Manager access ──────────────────────
module "rds_iam" {
  source = "./modules/iam"

  environment                 = var.environment
  rds_resource_id_placeholder = "db-*" # tightened after first apply via output
  aws_region                  = var.aws_region
  account_id                  = var.account_id
  db_user                     = "asteai_app"
}

# ── Secrets Manager: DB master password ───────────────────────────────────────
module "db_secret" {
  source = "./modules/secrets"

  secret_name = "asteai/${var.environment}/db-master-password"
  description = "AsteAI RDS master password (${var.environment})"
}

# ── RDS PostgreSQL instance ────────────────────────────────────────────────────
module "rds" {
  source = "./modules/rds"

  environment       = var.environment
  aws_region        = var.aws_region
  vpc_id            = var.vpc_id
  subnet_ids        = local.db_subnet_ids
  security_group_id = module.rds_sg.sg_id

  identifier             = "asteai-${var.environment}"
  db_name                = "asteai"
  db_username            = "asteai_root" # master user (IAM auth added separately)
  db_password_secret_arn = module.db_secret.secret_arn

  instance_class        = var.db_instance_class
  allocated_storage     = var.db_allocated_storage
  max_allocated_storage = var.db_max_allocated_storage

  deletion_protection     = var.environment == "production"
  skip_final_snapshot     = var.environment != "production"
  backup_retention_period = var.environment == "production" ? 7 : 1
  publicly_accessible     = var.publicly_accessible

  depends_on = [module.rds_sg, module.db_secret]
}

# ── Schema initialisation ─────────────────────────────────────────────────────
# Runs once after RDS is ready. Requires psql and aws CLI on the machine
# running tofu apply (your laptop / CI runner).
resource "null_resource" "schema_init" {
  triggers = {
    # Re-run only when the migration file changes
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
      REGION="${var.aws_region}"
      CERT="/tmp/rds-ap-south-1-bundle.pem"

      echo "→ Downloading RDS CA bundle..."
      curl -fsSL \
        https://truststore.pki.rds.amazonaws.com/ap-south-1/ap-south-1-bundle.pem \
        -o "$CERT"

      echo "→ Generating IAM auth token..."
      export PGPASSWORD=$(aws rds generate-db-auth-token \
        --hostname "$ENDPOINT" \
        --port "$PORT" \
        --username "$USER" \
        --region "$REGION")

      echo "→ Waiting for RDS to accept connections..."
      for i in $(seq 1 20); do
        pg_isready -h "$ENDPOINT" -p "$PORT" -U "$USER" && break
        echo "  attempt $i/20 — sleeping 15s..."
        sleep 15
      done

      echo "→ Creating database and app user..."
      PGSSLMODE=verify-full PGSSLROOTCERT="$CERT" \
      psql "host=$ENDPOINT port=$PORT user=$USER dbname=postgres sslmode=verify-full sslrootcert=$CERT" <<SQL
        CREATE DATABASE asteai
          ENCODING 'UTF8'
          LC_COLLATE 'en_US.UTF-8'
          LC_CTYPE   'en_US.UTF-8'
          TEMPLATE   template0;
SQL

      echo "→ Running schema migration..."
      PGSSLMODE=verify-full PGSSLROOTCERT="$CERT" \
      psql "host=$ENDPOINT port=$PORT user=$USER dbname=asteai sslmode=verify-full sslrootcert=$CERT" \
        -f "${path.module}/../packages/db/migrations/001_initial_schema.sql"

      echo "→ Creating app user with IAM auth..."
      PGSSLMODE=verify-full PGSSLROOTCERT="$CERT" \
      psql "host=$ENDPOINT port=$PORT user=$USER dbname=asteai sslmode=verify-full sslrootcert=$CERT" <<SQL
        DO \$\$ BEGIN
          IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'asteai_app') THEN
            CREATE USER asteai_app;
          END IF;
        END \$\$;

        GRANT rds_iam TO asteai_app;

        GRANT USAGE  ON SCHEMA public TO asteai_app;
        GRANT SELECT, INSERT, UPDATE, DELETE
              ON ALL TABLES    IN SCHEMA public TO asteai_app;
        GRANT USAGE, SELECT
              ON ALL SEQUENCES IN SCHEMA public TO asteai_app;

        ALTER DEFAULT PRIVILEGES IN SCHEMA public
          GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES    TO asteai_app;
        ALTER DEFAULT PRIVILEGES IN SCHEMA public
          GRANT USAGE, SELECT                  ON SEQUENCES TO asteai_app;
SQL

      echo "✓ Schema initialisation complete."
    BASH
  }

  depends_on = [module.rds]
}
