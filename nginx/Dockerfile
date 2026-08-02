FROM nginx:1.27-alpine

ARG ENABLE_SSL=false
ARG DOMAIN=localhost

RUN rm /etc/nginx/conf.d/default.conf

COPY nginx.conf /tmp/nginx.conf
COPY nginx.ssl.conf /tmp/nginx.ssl.conf

# Bake the right config in at build time so it survives container recreation —
# no more runtime "docker cp" patch needed. Rebuilding with the same
# ENABLE_SSL/DOMAIN build args (read from .env by docker compose) always
# reproduces the same config.
RUN if [ "$ENABLE_SSL" = "true" ]; then \
      sed "s/DOMAIN_PLACEHOLDER/$DOMAIN/g" /tmp/nginx.ssl.conf > /etc/nginx/conf.d/default.conf; \
    else \
      cp /tmp/nginx.conf /etc/nginx/conf.d/default.conf; \
    fi && \
    rm -f /tmp/nginx.conf /tmp/nginx.ssl.conf

# Volumes at runtime: /etc/letsencrypt (certs), /var/www/certbot (ACME challenges)

EXPOSE 80 443
