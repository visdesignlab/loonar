#!/bin/sh
# entrypoint.sh

set -x

envsubst '$SSL_CERT_FILE $SSL_KEY_FILE $SSL_TARGET_MOUNTED_DIRECTORY' < /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf

# Check the result of envsubst
if [ $? -ne 0 ]; then
    echo "Error: envsubst failed to substitute variables."
    exit 1
fi

# Ensure SSL certificates exist, otherwise generate a self-signed fallback
CERT_PATH="${SSL_TARGET_MOUNTED_DIRECTORY}/${SSL_CERT_FILE}"
KEY_PATH="${SSL_TARGET_MOUNTED_DIRECTORY}/${SSL_KEY_FILE}"

if [ ! -f "$CERT_PATH" ] || [ ! -f "$KEY_PATH" ]; then
    echo "SSL Certificates not found at ${CERT_PATH} or ${KEY_PATH}. Generating self-signed fallback..."
    mkdir -p "${SSL_TARGET_MOUNTED_DIRECTORY}"
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout "$KEY_PATH" \
        -out "$CERT_PATH" \
        -subj "/C=US/ST=State/L=City/O=Organization/OU=Department/CN=localhost"
    echo "Fallback certificates generated."
fi

# Print the final nginx.conf for debugging purposes
echo "Generated /etc/nginx/nginx.conf:"
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