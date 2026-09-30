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
