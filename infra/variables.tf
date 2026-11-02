variable "aws_region" {
  type    = string
  default = "ap-south-1"
}

variable "environment" {
  type    = string
  default = "development"
}

variable "account_id" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "db_subnet_ids" {
  description = "Optional explicit subnet IDs. Auto-discovered from VPC if empty."
  type        = list(string)
  default     = []
}

variable "db_instance_class" {
  type    = string
  default = "db.t4g.micro"
}

variable "db_allocated_storage" {
  type    = number
  default = 20
}

variable "db_max_allocated_storage" {
  type    = number
  default = 100
}

variable "developer_ips" {
  description = "Developer public IPs allowed to reach RDS on 5432. Get yours: curl https://checkip.amazonaws.com"
  type        = list(string)
  default     = []
}

variable "team_members" {
  description = "Team members to create IAM users for (console access + RDS Query Editor)."
  type = list(object({
    name                = string
    iam_user            = string
    role                = string
    create_access_key   = bool
    can_assume_app_role = bool
  }))
  default = []
}
