FROM nginxinc/nginx-unprivileged:alpine

# Copy built static files
COPY dist/ /usr/share/nginx/html/

# Entrypoint just starts nginx — config is mounted via ConfigMap in production
COPY entrypoint.sh /entrypoint.sh

USER 0
RUN chmod +x /entrypoint.sh
USER 1001

EXPOSE 8080

ENTRYPOINT ["/entrypoint.sh"]
