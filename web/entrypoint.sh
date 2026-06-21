#!/bin/sh
API_URL="${VITE_API_URL:-http://localhost:82/cyclo-api}"

find /usr/share/nginx/html -type f \( -name "*.js" -o -name "*.html" \) | while read -r file; do
    sed -i "s|__VITE_API_URL__|${API_URL}|g" "$file"
done

exec "$@"
