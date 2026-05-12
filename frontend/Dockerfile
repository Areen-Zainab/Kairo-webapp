# ──────────────── Frontend Dockerfile ────────────────

# Stage 1: Build the React app
FROM node:20-alpine AS build
WORKDIR /app

# Copy dependency files
COPY frontend/package*.json ./
RUN npm ci

# Copy source and build
COPY frontend/ ./
# Note: We pass the API URL at build time so the SPA knows where to call
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# Stage 2: Serve with Nginx
FROM nginx:alpine
# Copy the build output to Nginx's default directory
COPY --from=build /app/dist /usr/share/nginx/html
# Copy our custom nginx config
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
