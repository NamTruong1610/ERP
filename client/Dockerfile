# ---- Build stage: compile the Vite app to static assets ----
FROM node:22-slim AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
# Vite inlines VITE_* vars at build time. baseURL is '/api/v2' (same-origin),
# so nothing to inject here — but any VITE_ vars you add later must be passed
# as build args, not runtime env, since the bundle is frozen at this step.
RUN npm run build

# ---- Serve stage: nginx serves the assets and proxies /api ----
FROM nginx:1.27-alpine

# nginx's entrypoint runs envsubst over /etc/nginx/templates/*.template at
# container start and writes the result to /etc/nginx/conf.d/. That's how
# ${API_UPSTREAM} resolves per-environment without baking it into the image.
COPY nginx.conf /etc/nginx/templates/default.conf.template

COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
# Base image CMD already starts nginx after the template substitution.