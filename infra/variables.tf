variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "ap-south-1"
}

variable "environment" {
  description = "Environment name (development | staging | production)"
  type        = string
  default     = "development"
}

variable "account_id" {
  description = "AWS account ID"
  type        = string
}

variable "vpc_id" {
  description = "ID of the existing VPC to deploy RDS into"
  type        = string
}

variable "db_subnet_ids" {
  description = <<-DESC
    Explicit list of private subnet IDs for the RDS subnet group.
    Only used if the subnets are not tagged Type=private.
    Must span at least 2 AZs.
  DESC
  type        = list(string)
  default     = []
}

variable "app_security_group_id" {
  description = "SG ID of the app tier (ECS / EC2) allowed to reach RDS on 5432"
  type        = string
  default     = ""
}

# ── RDS sizing ────────────────────────────────────────────────────────────────

variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t4g.micro" # ~$12/month in ap-south-1; upgrade to db.t4g.small for prod
}

variable "db_allocated_storage" {
  description = "Initial allocated storage in GB"
  type        = number
  default     = 20
}

variable "db_max_allocated_storage" {
  description = "Maximum autoscaling storage in GB (0 = disabled)"
  type        = number
  default     = 100
}

variable "publicly_accessible" {
  description = <<-DESC
    Make RDS publicly accessible so your laptop can run the schema init.
    Set to true for development, false for production.
    The SG still restricts access to my_ip only.
  DESC
  type        = bool
  default     = true
}

variable "my_ip" {
  description = <<-DESC
    Your machine's public IP in CIDR notation, e.g. "203.0.113.42/32".
    Added to the RDS security group so psql can reach it from your laptop.
    Run: curl -s https://checkip.amazonaws.com && echo /32
  DESC
  type        = string
  default     = "0.0.0.0/0"
}

variable "team_members" {
  description = <<-DESC
    Team members to grant RDS IAM auth + Secrets Manager read access.
    iam_user must be an existing AWS IAM username.
    can_assume_app_role = true lets them impersonate the app role locally.
  DESC
  type = list(object({
    name                = string
    iam_user            = string
    can_assume_app_role = bool
  }))
  default = []
}
