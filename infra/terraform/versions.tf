terraform {
  required_version = ">= 1.13.0, < 2.0.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "6.14.1"
    }
    docker = {
      source  = "kreuzwerker/docker"
      version = "3.6.2"
    }
  }

  backend "s3" {
    bucket                      = "taskflow-lab08-state"
    key                         = "taskflow/dev/terraform.tfstate"
    region                      = "us-east-1"
    endpoints                   = { s3 = "http://taskflow-localstack:4566" }
    use_path_style              = true
    skip_credentials_validation = true
    skip_metadata_api_check     = true
    skip_region_validation      = true
    skip_requesting_account_id  = true
  }
}
