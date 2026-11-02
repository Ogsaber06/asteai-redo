# modules/team/main.tf
# Creates IAM users with:
#   - AWS console login (one-time password, force reset)
#   - RDS Query Editor (run SQL in browser)
#   - Secrets Manager read (to fetch DB password)
#   - Optional CLI access keys

locals {
  members_map = { for m in var.team_members : m.name => m }
}

resource "aws_iam_user" "member" {
  for_each = local.members_map
  name     = each.value.iam_user
  path     = "/asteai/"
  tags     = { Role = each.value.role }
}

resource "aws_iam_user_login_profile" "member" {
  for_each                = local.members_map
  user                    = aws_iam_user.member[each.key].name
  password_reset_required = true
  lifecycle {
    ignore_changes = [password_length, password_reset_required]
  }
}

resource "aws_iam_access_key" "member" {
  for_each = { for n, m in local.members_map : n => m if m.create_access_key }
  user     = aws_iam_user.member[each.key].name
}

resource "aws_iam_group" "developers" {
  name = "asteai-developers"
  path = "/asteai/"
}

resource "aws_iam_group_membership" "developers" {
  name  = "asteai-developers-membership"
  group = aws_iam_group.developers.name
  users = [for m in aws_iam_user.member : m.name]
}

data "aws_iam_policy_document" "developer" {
  # RDS Query Editor — run SQL in the AWS console
  statement {
    sid    = "RDSQueryEditor"
    effect = "Allow"
    actions = [
      "rds-data:ExecuteStatement",
      "rds-data:BatchExecuteStatement",
      "rds-data:BeginTransaction",
      "rds-data:CommitTransaction",
      "rds-data:RollbackTransaction",
    ]
    resources = [var.rds_arn]
  }

  # Secrets Manager — Query Editor uses this to auto-fetch DB password
  statement {
    sid     = "SecretsRead"
    effect  = "Allow"
    actions = ["secretsmanager:GetSecretValue", "secretsmanager:DescribeSecret", "secretsmanager:ListSecrets"]
    resources = [
      "arn:aws:secretsmanager:${var.aws_region}:${var.account_id}:secret:asteai/${var.environment}/*",
    ]
  }

  # RDS console visibility
  statement {
    sid       = "RDSReadOnly"
    effect    = "Allow"
    actions   = ["rds:DescribeDBInstances", "rds:ListTagsForResource"]
    resources = ["*"]
  }

  # CloudWatch — view RDS logs
  statement {
    sid       = "LogsRead"
    effect    = "Allow"
    actions   = ["logs:DescribeLogGroups", "logs:DescribeLogStreams", "logs:GetLogEvents", "logs:FilterLogEvents"]
    resources = ["arn:aws:logs:${var.aws_region}:${var.account_id}:log-group:/aws/rds/*"]
  }

  # Self-service — change own password
  statement {
    sid       = "SelfIAM"
    effect    = "Allow"
    actions   = ["iam:GetUser", "iam:ChangePassword"]
    resources = ["arn:aws:iam::${var.account_id}:user/asteai/$${aws:username}"]
  }
}

resource "aws_iam_group_policy" "developer" {
  name   = "asteai-${var.environment}-developer-access"
  group  = aws_iam_group.developers.name
  policy = data.aws_iam_policy_document.developer.json
}
