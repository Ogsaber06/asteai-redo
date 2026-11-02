variable "environment" { type = string }
variable "aws_region" { type = string }
variable "account_id" { type = string }
variable "rds_arn" { type = string }

variable "team_members" {
  type = list(object({
    name                = string
    iam_user            = string
    role                = string
    create_access_key   = bool
    can_assume_app_role = bool
  }))
  default = []
}
