FROM node:20-alpine AS builder

WORKDIR /app

ARG CACHE_BUST=1
RUN echo "Cache bust token: ${CACHE_BUST}"

COPY package.json package-lock.json* ./
RUN npm ci

COPY index.html tsconfig.json vite.config.ts ./
COPY public/ public/
COPY src/ src/

ARG VITE_API_URL=""
ARG VITE_ENABLE_PWA="true"
ARG VITE_APP_VERSION="dev"
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_ENABLE_PWA=${VITE_ENABLE_PWA}
ENV VITE_APP_VERSION=${VITE_APP_VERSION}

RUN rm -rf dist && VITE_BUILD_TIMESTAMP="$(date -u +'%Y-%m-%dT%H:%M:%SZ')" npm run build

FROM nginx:1.25-alpine

# Copy built app
COPY --from=builder /app/dist /usr/share/nginx/html

# Nginx config for SPA + API proxy
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
