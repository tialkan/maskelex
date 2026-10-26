# apps/web/deploy/Dockerfile (MASTER 4.10). Depo kökünden: docker build -f apps/web/deploy/Dockerfile .
FROM node:22-alpine AS derleme
WORKDIR /src
RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile && pnpm --filter @maskelex/web build

FROM nginx:alpine
COPY apps/web/deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY apps/web/deploy/security-headers.conf /etc/nginx/security-headers.conf
COPY --from=derleme /src/apps/web/dist /usr/share/nginx/html
EXPOSE 8080
