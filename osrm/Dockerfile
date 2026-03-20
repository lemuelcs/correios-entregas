FROM ghcr.io/project-osrm/osrm-backend:latest

USER root

RUN apk add --no-cache curl ca-certificates

COPY osrm/entrypoint.sh /usr/local/bin/osrm-entrypoint.sh

RUN chmod +x /usr/local/bin/osrm-entrypoint.sh

EXPOSE 5000

ENTRYPOINT ["/usr/local/bin/osrm-entrypoint.sh"]
