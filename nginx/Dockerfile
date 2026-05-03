# Stage 1: Build web app
FROM node:20-alpine AS web-builder
WORKDIR /web
ARG VITE_GOOGLE_CLIENT_ID=""
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID
COPY web/package*.json ./
RUN npm install
COPY web/ .
RUN npm run build

# Stage 2: Nginx serves static files + proxies API
FROM nginx:1.25-alpine
COPY --from=web-builder /web/dist /usr/share/nginx/html
COPY nginx/nginx.conf /etc/nginx/nginx.conf
RUN mkdir -p /var/log/nginx
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost/health || exit 1
CMD ["nginx", "-g", "daemon off;"]
