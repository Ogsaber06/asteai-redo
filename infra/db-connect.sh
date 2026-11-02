#!/usr/bin/env bash
# db-connect.sh
# One-command psql connection to the AsteAI RDS instance using IAM auth.
# No PEM file needed — sslmode=require trusts the system CA bundle.
#
# Usage:
#   ./db-connect.sh              # connect as asteai_app (read/write, no DDL)
#   ./db-connect.sh --master     # connect as asteai_root (full access)
#   ./db-connect.sh --user foo   # connect as a specific DB user

set -euo pipefail

ENDPOINT="asteai-development.cfyeuu6yuuq1.ap-south-1.rds.amazonaws.com"
PORT="5432"
DBNAME="asteai"
REGION="ap-south-1"
DB_USER="asteai_app"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --master) DB_USER="asteai_root"; shift ;;
    --user)   DB_USER="$2"; shift 2 ;;
    --help)
      echo "Usage: $0 [--master] [--user <dbuser>]"
      exit 0 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

if [[ "$DB_USER" == "asteai_root" ]]; then
  echo "Fetching master password from Secrets Manager..."
  SECRET_ARN="$(aws secretsmanager list-secrets \
    --region "$REGION" \
    --filters Key=name,Values=asteai/development/db-master-password \
    --query 'SecretList[0].ARN' \
    --output text)"

  export PGPASSWORD
  PGPASSWORD="$(aws secretsmanager get-secret-value \
    --secret-id "$SECRET_ARN" \
    --region "$REGION" \
    --query SecretString \
    --output text)"
else
  echo "Generating IAM auth token for '$DB_USER'..."
  export PGPASSWORD
  PGPASSWORD="$(aws rds generate-db-auth-token \
    --hostname "$ENDPOINT" \
    --port "$PORT" \
    --username "$DB_USER" \
    --region "$REGION")"
fi

echo "Connecting to $ENDPOINT as $DB_USER..."
psql "host=$ENDPOINT port=$PORT dbname=$DBNAME user=$DB_USER sslmode=require"
