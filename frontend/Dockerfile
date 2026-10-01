# syntax=docker/dockerfile:1.7
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime
# Upstream for /api proxying; overridden per environment (compose / Helm).
ENV API_GATEWAY_URL=http://api-gateway:8080 \
    NGINX_RESOLVER=127.0.0.11 \
    NGINX_ENVSUBST_FILTER="^(API_GATEWAY_URL|NGINX_RESOLVER)$"
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1
