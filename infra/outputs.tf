output "rds_endpoint" {
  description = "RDS instance endpoint (host only, no port)"
  value       = module.rds.endpoint
}

output "rds_port" {
  description = "RDS port"
  value       = module.rds.port
}

output "rds_resource_id" {
  description = "RDS DbiResourceId — used in IAM policy ARNs for IAM DB auth"
  value       = module.rds.resource_id
}

output "rds_arn" {
  description = "RDS instance ARN"
  value       = module.rds.arn
}

output "db_secret_arn" {
  description = "Secrets Manager ARN holding the master password"
  value       = module.db_secret.secret_arn
  sensitive   = true
}

output "app_iam_role_arn" {
  description = "IAM role ARN the NestJS app should assume for RDS IAM auth"
  value       = module.rds_iam.role_arn
}

output "app_iam_role_name" {
  description = "IAM role name"
  value       = module.rds_iam.role_name
}

output "rds_sg_id" {
  description = "Security group ID attached to RDS"
  value       = module.rds_sg.sg_id
}

output "env_file_snippet" {
  description = "Paste this into apps/api/.env.local"
  sensitive   = true
  value       = <<-ENV
    DATABASE_HOST=${module.rds.endpoint}
    DATABASE_PORT=${module.rds.port}
    DATABASE_NAME=asteai
    DATABASE_USER=asteai_app
    DATABASE_PASSWORD=
    DATABASE_IAM_AUTH=true
    DATABASE_SSL=true
    DATABASE_SSL_CERT=/tmp/rds-ap-south-1-bundle.pem
    AWS_REGION=${var.aws_region}
  ENV
}
