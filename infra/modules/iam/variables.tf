variable "environment" {
  type = string
}
variable "aws_region" {
  type = string
}
variable "account_id" {
  type = string
}
variable "db_user" {
  type    = string
  default = "asteai_app"
}
variable "rds_resource_id_placeholder" {
  type    = string
  default = "db-*"
}
