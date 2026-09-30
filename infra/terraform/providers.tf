provider "aws" {
  access_key                  = "test"
  secret_key                  = "test"
  region                      = "us-east-1"
  skip_credentials_validation = true
  skip_metadata_api_check     = true
  skip_requesting_account_id  = true

  endpoints {
    ec2 = "http://taskflow-localstack:4566"
    iam = "http://taskflow-localstack:4566"
  }
}

provider "docker" {
  host = "unix:///var/run/docker.sock"
}
