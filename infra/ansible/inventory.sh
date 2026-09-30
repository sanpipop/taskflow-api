#!/bin/sh
set -eu

host="$(terraform -chdir=infra/terraform output -raw instance_address)"

cat <<JSON
{
  "lab08": {
    "hosts": ["${host}"],
    "vars": {
      "ansible_user": "root",
      "ansible_port": 22,
      "ansible_ssh_private_key_file": "infra/ansible/.lab08_ssh",
      "ansible_ssh_common_args": "-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null"
    }
  }
}
JSON
