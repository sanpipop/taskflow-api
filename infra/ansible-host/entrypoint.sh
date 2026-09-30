#!/bin/sh
set -eu

test -n "${SSH_PUBLIC_KEY:-}"
printf '%s\n' "${SSH_PUBLIC_KEY}" > /root/.ssh/authorized_keys
chmod 600 /root/.ssh/authorized_keys

exec /usr/sbin/sshd -D -e
