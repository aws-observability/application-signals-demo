output "postgres_endpoint" {
  value = module.db.db_instance_endpoint
}

output "documentdb_endpoint" {
  value = aws_docdb_cluster.service.endpoint
}