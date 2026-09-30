resource "aws_security_group" "taskflow" {
  name        = "taskflow-lab08"
  description = "Taskflow API access on port 8080"

  # Lab 08 first run intentionally demonstrates a real IaC finding.
  # This public CIDR will be restricted after tfsec and Checkov block the build.
  ingress {
    description = "Taskflow API"
    from_port   = 8080
    to_port     = 8080
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "taskflow-lab08"
    Environment = "lab"
  }
}

resource "aws_instance" "taskflow" {
  ami                    = "ami-00000000000000000"
  instance_type          = "t3.micro"
  vpc_security_group_ids = [aws_security_group.taskflow.id]

  # Encryption is intentionally omitted for the first security-scan evidence.
  root_block_device {
    volume_size = 8
    volume_type = "gp3"
  }

  tags = {
    Name        = "taskflow-lab08"
    Environment = "lab"
  }
}

resource "docker_image" "ansible_host" {
  name = "taskflow-ansible-host:lab08"

  build {
    context = "${path.module}/../ansible-host"
  }
}

resource "docker_container" "ansible_host" {
  name  = "taskflow-lab08-host"
  image = docker_image.ansible_host.image_id

  env = ["SSH_PUBLIC_KEY=${var.ssh_public_key}"]

  networks_advanced {
    name = "jenkins-net"
  }

  volumes {
    host_path      = "/var/run/docker.sock"
    container_path = "/var/run/docker.sock"
  }
}
