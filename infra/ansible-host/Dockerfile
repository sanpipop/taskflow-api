FROM alpine:3.23.4

RUN apk add --no-cache openssh-server python3 \
    && ssh-keygen -A \
    && mkdir -p /root/.ssh \
    && chmod 700 /root/.ssh

COPY entrypoint.sh /usr/local/bin/lab08-entrypoint

EXPOSE 22

ENTRYPOINT ["/usr/local/bin/lab08-entrypoint"]
