# modules/iam/main.tf
# IAM role + policy for the NestJS API to connect via RDS IAM auth.
# The ECS task / EC2 instance running the API should assume this role.

data "aws_iam_policy_document" "assume" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type = "Service"
      identifiers = [
        "ecs-tasks.amazonaws.com",
        "ec2.amazonaws.com",
      ]
    }
  }
}

resource "aws_iam_role" "app" {
  name               = "asteai-${var.environment}-app-role"
  assume_role_policy = data.aws_iam_policy_document.assume.json
  description        = "AsteAI ${var.environment} - app role for RDS IAM auth"
}

# RDS IAM auth policy — tightened to the specific DB user
data "aws_iam_policy_document" "rds_iam_auth" {
  statement {
    effect  = "Allow"
    actions = ["rds-db:connect"]

    # arn:aws:rds-db:<region>:<account>:dbuser:<resource-id>/<db-user>
    # We use a wildcard for resource-id on first apply; after apply,
    # replace with the actual resource_id from the rds output.
    resources = [
      "arn:aws:rds-db:${var.aws_region}:${var.account_id}:dbuser:${var.rds_resource_id_placeholder}/${var.db_user}"
    ]
  }
}

resource "aws_iam_role_policy" "rds_iam_auth" {
  name   = "asteai-${var.environment}-rds-iam-auth"
  role   = aws_iam_role.app.id
  policy = data.aws_iam_policy_document.rds_iam_auth.json
}

# Secrets Manager read — so the app can read other secrets if needed
data "aws_iam_policy_document" "secrets_read" {
  statement {
    effect  = "Allow"
    actions = ["secretsmanager:GetSecretValue"]
    resources = [
      "arn:aws:secretsmanager:${var.aws_region}:${var.account_id}:secret:asteai/${var.environment}/*"
    ]
  }
}

resource "aws_iam_role_policy" "secrets_read" {
  name   = "asteai-${var.environment}-secrets-read"
  role   = aws_iam_role.app.id
  policy = data.aws_iam_policy_document.secrets_read.json
}

# Instance profile — needed if app runs on EC2
resource "aws_iam_instance_profile" "app" {
  name = "asteai-${var.environment}-app-profile"
  role = aws_iam_role.app.name
}
