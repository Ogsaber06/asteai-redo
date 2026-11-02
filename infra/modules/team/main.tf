# modules/team/main.tf
#
# Creates IAM users for team members and grants them:
#   - RDS IAM auth tokens (connect to DB as asteai_app or asteai_root)
#   - Secrets Manager read on asteai/* secrets
#   - Optionally assume the app role (for local testing)
#   - AWS console login with a one-time password (rotated on first login)

locals {
  members_map = { for m in var.team_members : m.name => m }
}

# ── IAM users ─────────────────────────────────────────────────────────────────

resource "aws_iam_user" "member" {
  for_each = local.members_map

  name = each.value.iam_user
  path = "/asteai/"

  tags = {
    Team = "asteai"
    Role = each.value.role
  }
}

resource "aws_iam_user_login_profile" "member" {
  for_each = local.members_map

  user                    = aws_iam_user.member[each.key].name
  password_reset_required = true # forces password change on first login

  lifecycle {
    # Never regenerate the password after first creation
    ignore_changes = [password_length, password_reset_required]
  }
}

resource "aws_iam_access_key" "member" {
  for_each = {
    for name, m in local.members_map : name => m
    if m.create_access_key
  }

  user = aws_iam_user.member[each.key].name
}

# ── Group: asteai-developers ──────────────────────────────────────────────────

resource "aws_iam_group" "developers" {
  name = "asteai-developers"
  path = "/asteai/"
}

resource "aws_iam_group_membership" "developers" {
  name  = "asteai-developers-membership"
  group = aws_iam_group.developers.name
  users = [for m in aws_iam_user.member : m.name]
}

# ── Group policy ──────────────────────────────────────────────────────────────

data "aws_iam_policy_document" "developer" {
  # RDS IAM auth - connect as asteai_app (daily) or asteai_root (migrations)
  statement {
    sid     = "RDSIAMConnect"
    effect  = "Allow"
    actions = ["rds-db:connect"]
    resources = [
      "arn:aws:rds-db:${var.aws_region}:${var.account_id}:dbuser:${var.rds_resource_id}/asteai_app",
      "arn:aws:rds-db:${var.aws_region}:${var.account_id}:dbuser:${var.rds_resource_id}/asteai_root",
    ]
  }

  # Read secrets
  statement {
    sid    = "SecretsRead"
    effect = "Allow"
    actions = [
      "secretsmanager:GetSecretValue",
      "secretsmanager:DescribeSecret",
      "secretsmanager:ListSecrets",
    ]
    resources = [
      "arn:aws:secretsmanager:${var.aws_region}:${var.account_id}:secret:asteai/${var.environment}/*",
    ]
  }

  # RDS console visibility (read-only)
  statement {
    sid    = "RDSDescribe"
    effect = "Allow"
    actions = [
      "rds:DescribeDBInstances",
      "rds:ListTagsForResource",
    ]
    resources = ["*"]
  }

  # Let developers see their own IAM info
  statement {
    sid    = "SelfIAM"
    effect = "Allow"
    actions = [
      "iam:GetUser",
      "iam:GetLoginProfile",
      "iam:ChangePassword",
      "iam:ListAccessKeys",
      "iam:CreateAccessKey",
      "iam:DeleteAccessKey",
    ]
    resources = ["arn:aws:iam::${var.account_id}:user/asteai/$${aws:username}"]
  }
}

resource "aws_iam_group_policy" "developer" {
  name   = "asteai-${var.environment}-developer-access"
  group  = aws_iam_group.developers.name
  policy = data.aws_iam_policy_document.developer.json
}

# ── Per-member: optional app role assumption ──────────────────────────────────

data "aws_iam_policy_document" "assume_app_role" {
  for_each = {
    for name, m in local.members_map : name => m
    if m.can_assume_app_role
  }

  statement {
    sid       = "AssumeAppRole"
    effect    = "Allow"
    actions   = ["sts:AssumeRole"]
    resources = [var.app_role_arn]
  }
}

resource "aws_iam_user_policy" "assume_app_role" {
  for_each = {
    for name, m in local.members_map : name => m
    if m.can_assume_app_role
  }

  name   = "assume-asteai-app-role"
  user   = aws_iam_user.member[each.key].name
  policy = data.aws_iam_policy_document.assume_app_role[each.key].json
}
