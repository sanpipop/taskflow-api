variable "ssh_public_key" {
  description = "Ephemeral Jenkins public key used by the Ansible control process."
  type        = string
  sensitive   = true
}

variable "image_tag" {
  description = "Immutable application image tag produced from the Git commit."
  type        = string
  default     = "lab08-plan-only"
}

variable "enable_detailed_monitoring" {
  description = "Enable EC2 detailed monitoring. Disabled only for LocalStack Community, where MonitorInstances is not implemented."
  type        = bool
  default     = true
}
