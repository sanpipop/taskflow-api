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

image_id="$(awslocal ec2 describe-images \
  --filters Name=name,Values=taskflow-lab08-ami \
  --query 'Images[0].ImageId' \
  --output text)"

if [ "${image_id}" = "None" ]; then
  awslocal ec2 register-image \
    --name taskflow-lab08-ami \
    --architecture x86_64 \
    --root-device-name /dev/sda1 \
    --virtualization-type hvm
fi
