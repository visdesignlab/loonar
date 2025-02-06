#!/bin/sh
# entrypoint.sh

set -x

envsubst '$SSL_CERT_FILE $SSL_KEY_FILE $SSL_TARGET_MOUNTED_DIRECTORY' < /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf

# Check the result of envsubst
if [ $? -ne 0 ]; then
    echo "Error: envsubst failed to substitute variables."
    exit 1
fi

# Print the final nginx.conf for debugging purposes
echo "Generated /etc/nginx/nginx.conf:"
# cat /etc/nginx/nginx.conf


# Start NGINX with logging
echo "Starting NGINX..."
nginx -g 'daemon off;'

# If NGINX fails to start, print an error message
if [ $? -ne 0 ]; then
    echo "Error: NGINX failed to start."
    exit 1
fi

# Disable debugging after startup
set +x