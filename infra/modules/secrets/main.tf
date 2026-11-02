# modules/secrets/main.tf
# Creates a Secrets Manager secret with a randomly generated password.
# The password is generated once and never changed by Tofu (ignore_changes).

resource "random_password" "master" {
  length           = 32
  special          = true
  override_special = "!#$%^&*()-_=+[]{}|;:,.<>?"
  # Exclude characters that cause psql connection string escaping issues
  min_upper   = 4
  min_lower   = 4
  min_numeric = 4
  min_special = 2
}

resource "aws_secretsmanager_secret" "this" {
  name                    = var.secret_name
  description             = var.description
  recovery_window_in_days = 7
}

resource "aws_secretsmanager_secret_version" "this" {
  secret_id     = aws_secretsmanager_secret.this.id
  secret_string = random_password.master.result

  lifecycle {
    # Never rotate via Tofu — use AWS Secrets Manager rotation if needed
    ignore_changes = [secret_string]
  }
}
