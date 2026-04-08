FROM ghcr.io/vroom-project/vroom-docker:v1.15.0

RUN if command -v apk >/dev/null 2>&1; then \
      apk add --no-cache curl ca-certificates; \
    elif command -v apt-get >/dev/null 2>&1; then \
      apt-get update \
      && apt-get install -y --no-install-recommends curl ca-certificates \
      && rm -rf /var/lib/apt/lists/*; \
    else \
      echo "Unsupported base image: no known package manager found" >&2; \
      exit 1; \
    fi

COPY vroom/config.yml /conf/config.yml

EXPOSE 3000
