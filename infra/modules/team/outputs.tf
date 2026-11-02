output "members_granted" {
  description = "IAM usernames created"
  value       = [for m in aws_iam_user.member : m.name]
}

output "console_passwords" {
  description = "One-time console passwords — share securely, they expire on first login"
  sensitive   = true
  value = {
    for name, profile in aws_iam_user_login_profile.member :
    name => profile.password
  }
}

output "access_keys" {
  description = "Programmatic access keys for members with create_access_key = true"
  sensitive   = true
  value = {
    for name, key in aws_iam_access_key.member : name => {
      access_key_id     = key.id
      secret_access_key = key.secret
    }
  }
}

output "console_login_url" {
  description = "AWS console login URL for your account"
  value       = "https://${var.account_id}.signin.aws.amazon.com/console"
}
