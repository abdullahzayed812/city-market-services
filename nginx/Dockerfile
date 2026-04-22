FROM nginx:1.27-alpine

# Remove default config
RUN rm /etc/nginx/conf.d/default.conf

COPY nginx.conf /etc/nginx/conf.d/default.conf

# SSL config is mounted at runtime when HTTPS is enabled
# Volume: /etc/letsencrypt (certs), /var/www/certbot (ACME challenges)

EXPOSE 80 443
