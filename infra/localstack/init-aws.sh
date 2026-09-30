#!/bin/sh
set -eu

awslocal s3api head-bucket --bucket taskflow-lab08-state 2>/dev/null || \
  awslocal s3api create-bucket --bucket taskflow-lab08-state

awslocal s3api put-bucket-versioning \
  --bucket taskflow-lab08-state \
  --versioning-configuration Status=Enabled

awslocal s3api put-bucket-encryption \
  --bucket taskflow-lab08-state \
  --server-side-encryption-configuration \
  '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
