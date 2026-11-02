variable "environment" {
  type = string
}

variable "aws_region" {
  type = string
}

variable "account_id" {
  type = string
}

variable "rds_resource_id" {
  type        = string
  description = "RDS DbiResourceId (db-XXXX) from tofu output rds_resource_id"
}

variable "app_role_arn" {
  type        = string
  description = "ARN of the app IAM role"
}

variable "team_members" {
  description = "Team members to create IAM users for and grant DB access"
  type = list(object({
    name                = string # human name / map key
    iam_user            = string # desired AWS IAM username (will be created)
    role                = string # tag only: "backend" | "frontend" | "devops" etc.
    create_access_key   = bool   # true = also create programmatic access keys
    can_assume_app_role = bool   # true = can impersonate the app role locally
  }))
  default = []
}
