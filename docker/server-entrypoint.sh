#!/bin/bash
# entrypoint.sh

set -e  # Exit immediately if a command exits with a non-zero status

# Run database migrations
python manage.py makemigrations api --noinput
python manage.py migrate api --noinput

# Execute the command passed as arguments (CMD in Dockerfile)
exec "$@"
