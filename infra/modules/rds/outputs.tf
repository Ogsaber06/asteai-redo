output "endpoint" { value = aws_db_instance.this.address }
output "port" { value = aws_db_instance.this.port }
output "resource_id" { value = aws_db_instance.this.resource_id }
output "arn" { value = aws_db_instance.this.arn }
output "master_username" { value = aws_db_instance.this.username }
output "db_name" { value = aws_db_instance.this.db_name }
