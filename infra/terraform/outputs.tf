output "instance_address" {
  description = "Network address consumed by the dynamic Ansible inventory."
  value       = docker_container.ansible_host.name
}

output "compute_instance_id" {
  description = "LocalStack EC2 instance created by Terraform."
  value       = aws_instance.taskflow.id
}

output "security_group_id" {
  description = "Security group allowing the Taskflow API port."
  value       = aws_security_group.taskflow.id
}
