output "rds_endpoint" {
  description = "RDS endpoint — put this in DATABASE_HOST"
  value       = module.rds.endpoint
}

output "rds_port" {
  value = module.rds.port
}

output "rds_arn" {
  value = module.rds.arn
}

output "db_secret_arn" {
  description = "Secrets Manager ARN holding the master password"
  value       = module.db_secret.secret_arn
  sensitive   = true
}

output "env_file_snippet" {
  description = "Paste this into apps/api/.env.local"
  sensitive   = true
  value       = <<-ENV
    DATABASE_HOST=${module.rds.endpoint}
    DATABASE_PORT=${module.rds.port}
    DATABASE_NAME=asteai
    DATABASE_USER=asteai_root
    DATABASE_PASSWORD=${nonsensitive(module.db_secret.secret_arn)}
    DATABASE_SSL=true
  ENV
}

output "team_members_created" {
  value = module.team.members_granted
}

output "console_login_url" {
  value = module.team.console_login_url
}

output "console_passwords" {
  sensitive = true
  value     = module.team.console_passwords
}

output "access_keys" {
  sensitive = true
  value     = module.team.access_keys
}
