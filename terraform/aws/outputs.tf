output "cloudmart_url" { value = "http://${aws_lb.this.dns_name}" }
output "rds_endpoint" { value = aws_db_instance.mysql.address }
output "backend_ecr" { value = aws_ecr_repository.backend.repository_url }
output "frontend_ecr" { value = aws_ecr_repository.frontend.repository_url }
