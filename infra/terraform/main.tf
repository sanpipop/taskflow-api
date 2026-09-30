resource "aws_security_group" "taskflow" {
  name        = "taskflow-lab08"
  description = "Taskflow API access on port 8080"

  ingress {
    description = "Taskflow API"
    from_port   = 8080
    to_port     = 8080
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/8"]
  }

  egress {
    description = "Private network access required by the lab workload"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["10.0.0.0/8"]
  }

  tags = {
    Name        = "taskflow-lab08"
    Environment = "lab"
  }
}

resource "aws_iam_role" "taskflow" {
  name = "taskflow-lab08-instance-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Service = "ec2.amazonaws.com"
      }
      Action = "sts:AssumeRole"
    }]
  })

  tags = {
    Name        = "taskflow-lab08"
    Environment = "lab"
  }
}

resource "aws_iam_instance_profile" "taskflow" {
  name = "taskflow-lab08-instance-profile"
  role = aws_iam_role.taskflow.name
}

resource "aws_instance" "taskflow" {
  ami                    = "ami-00000000000000000"
  instance_type          = "t3.micro"
  iam_instance_profile   = aws_iam_instance_profile.taskflow.name
  vpc_security_group_ids = [aws_security_group.taskflow.id]
  monitoring             = true
  ebs_optimized          = true

  root_block_device {
    encrypted   = true
    volume_size = 8
    volume_type = "gp3"
  }

  metadata_options {
    http_endpoint = "enabled"
    http_tokens   = "required"
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
