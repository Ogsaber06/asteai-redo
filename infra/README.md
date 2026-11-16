# AsteAI Infra — RDS + IAM

OpenTofu config that provisions and fully initialises the AsteAI PostgreSQL database on AWS RDS (ap-south-1).

## What this creates

| Resource | Details |
|----------|---------|
| `aws_db_instance` | PostgreSQL 16, `db.t4g.micro`, gp3, encrypted, IAM auth enabled |
| `aws_db_subnet_group` | Spans your private subnets (≥ 2 AZs) |
| `aws_db_parameter_group` | pg16 family — slow query log, SSL enforced |
| `aws_secretsmanager_secret` | Random 32-char master password, stored in Secrets Manager |
| `aws_security_group` | Allows 5432 from app SG + VPC CIDR |
| `aws_iam_role` | App role with `rds-db:connect` + Secrets Manager read |
| `aws_iam_instance_profile` | For EC2 / ECS task attachment |
| `null_resource` (local-exec) | Runs `001_initial_schema.sql`, creates `asteai_app` user with `rds_iam` |

## Optional natural voice output

The API uses the user's browser voice by default. Polly voice output is opt-in: set
`VOICE_TTS_ENABLED=true` on the API and grant its runtime role `polly:DescribeVoices`
and `polly:SynthesizeSpeech` in the configured `AWS_REGION`. Generative voices are
preferred for a more expressive sound, with a neural voice fallback when that engine or
locale is unavailable. For example, `ap-south-1` supports Neural but not Generative. Set
`VOICE_TTS_ENGINE=neural` to avoid trying Generative. This RDS-focused Terraform module
does not grant those Polly permissions. Leave the flag unset or `false` until the runtime
role and usage budget are approved. When enabled, only short assistant replies are sent
to Polly; microphone recordings are not sent through this endpoint or stored by it.

## Prerequisites

- OpenTofu >= 1.6
- `aws` CLI configured (`aws configure` or instance role)
- `psql` installed locally (used by the schema init local-exec)
- Your machine must be able to reach the RDS endpoint on port 5432
  (either same VPC, VPN, or temporarily make RDS publicly accessible)

## Quick start

### 1. Fill in your values

```bash
cp terraform.tfvars terraform.tfvars   # already exists — just edit it
```

Get the two required values:

```bash
# Account ID
aws sts get-caller-identity --query Account --output text

# VPC ID (pick the one your other infra uses)
aws ec2 describe-vpcs --region ap-south-1 \
  --query 'Vpcs[*].{ID:VpcId,CIDR:CidrBlock,Name:Tags[?Key==`Name`]|[0].Value}' \
  --output table
```

Paste them into `terraform.tfvars`:

```hcl
account_id = "123456789012"
vpc_id     = "vpc-0abc1234"
```

### 2. Init and plan

```bash
cd infra
tofu init
tofu plan
```

Review the plan — you should see ~12 resources to create.

### 3. Apply

```bash
tofu apply
```

This will:
1. Generate a random master password → store in Secrets Manager
2. Create the RDS instance (takes ~5–8 min)
3. Wait for it to be ready
4. Run `001_initial_schema.sql` via local-exec psql
5. Create the `asteai_app` IAM-auth DB user

### 4. Copy the env snippet

After apply, get the values for your API:

```bash
tofu output env_file_snippet
```

Paste the output into `apps/api/.env.local`.

Also generate your JWT secrets:

```bash
openssl rand -hex 32   # JWT_SECRET
openssl rand -hex 32   # JWT_REFRESH_SECRET
```

### 5. Tighten the IAM policy (optional but recommended)

After the first apply, the IAM policy uses a `db-*` wildcard.  
Lock it down to the exact resource ID:

```bash
# Get the actual resource ID
tofu output rds_resource_id

# Edit terraform.tfvars — add:
# rds_resource_id = "db-ABCDEFGHIJKLMNOP"

# Then in modules/iam/main.tf replace the placeholder variable usage,
# or pass it through as a variable and re-apply:
tofu apply
```

## Connecting manually (psql)

```bash
# One-liner — generates a fresh IAM token and connects
ENDPOINT=$(tofu output -raw rds_endpoint)
PGPASSWORD=$(aws rds generate-db-auth-token \
  --hostname $ENDPOINT --port 5432 \
  --username asteai_root --region ap-south-1) \
psql "host=$ENDPOINT port=5432 dbname=asteai user=asteai_root \
  sslmode=verify-full sslrootcert=/tmp/rds-ap-south-1-bundle.pem"
```

## Re-running the schema migration

The `null_resource.schema_init` only applies `001_initial_schema.sql` (it triggers on
that file's SHA256). Apply everything else with the repo's migration runner, which
tracks each file in `schema_migrations`:

```bash
# Download the RDS CA bundle once
curl -o /tmp/rds-global-bundle.pem https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem

export DATABASE_HOST=$(tofu output -raw rds_endpoint) DATABASE_NAME=asteai AWS_REGION=ap-south-1
export DATABASE_MIGRATION_USER=asteai_root DATABASE_IAM_AUTH=true DATABASE_SSL=true
export DATABASE_SSL_REJECT_UNAUTHORIZED=true NODE_EXTRA_CA_CERTS=/tmp/rds-global-bundle.pem

# If schema_init already ran 001, tell the runner first (--status creates schema_migrations):
bun run --filter @asteai/db migrate:status
#   INSERT INTO schema_migrations (name) VALUES ('001_initial_schema.sql');
bun run --filter @asteai/db migrate
```

Notes:
- Run as the master user: the migrations create extensions, types and tables.
- The runner signs a 15-minute IAM token itself and connects once, so token expiry is no problem.
- An advisory lock serialises concurrent runs, such as several API tasks starting at once.
- Each file is its own transaction, so a failure rolls back that file and stops the run.
- `DATABASE_URL`, if set, overrides all of the above.

## Destroy

```bash
tofu destroy
```

> **Note:** `deletion_protection = true` in production. You must disable it
> manually in the AWS console before `tofu destroy` will succeed.

## Folder structure

```
infra/
├── main.tf           # Root: provider, data sources, module calls, schema init
├── variables.tf      # Input variables
├── outputs.tf        # Endpoint, ARNs, env file snippet
├── terraform.tfvars  # Your values (gitignored)
└── modules/
    ├── rds/          # aws_db_instance + subnet group + parameter group
    ├── secrets/      # aws_secretsmanager_secret + random password
    ├── sg/           # aws_security_group with mixed cidr/sg ingress rules
    └── iam/          # IAM role + rds-db:connect policy + instance profile
```
