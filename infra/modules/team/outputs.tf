output "members_granted" {
  value = [for m in aws_iam_user.member : m.name]
}

output "console_passwords" {
  sensitive = true
  value     = { for n, p in aws_iam_user_login_profile.member : n => p.password }
}

output "access_keys" {
  sensitive = true
  value = {
    for n, k in aws_iam_access_key.member : n => {
      access_key_id     = k.id
      secret_access_key = k.secret
    }
  }
}

output "console_login_url" {
  value = "https://${var.account_id}.signin.aws.amazon.com/console"
}
