#!/bin/sh
set -eu
# init-env generates hex credentials, allowing safe JSON interpolation.
case "$AWS_ACCESS_KEY_ID:$AWS_SECRET_ACCESS_KEY" in *[!a-f0-9:]*) echo 'Expected hex local S3 credentials' >&2; exit 1;; esac
umask 077
cat > /tmp/s3.json <<EOF
{"identities":[{"name":"vertical","credentials":[{"accessKey":"$AWS_ACCESS_KEY_ID","secretKey":"$AWS_SECRET_ACCESS_KEY"}],"actions":["Admin","Read","Write","List","Tagging"]},{"name":"anonymous","actions":["Read:vertical-media"]}]}
EOF
exec weed mini -dir=/data -ip=seaweedfs -ip.bind=0.0.0.0 -s3.config=/tmp/s3.json
