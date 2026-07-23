# DentaCore backend — Node/Express + Prisma v7
# Single stage kept deliberately simple; add a prune stage later if image
# size actually matters. Debian slim (not alpine) avoids Prisma's musl/OpenSSL
# headaches.
FROM node:22-slim

# Prisma needs OpenSSL present at runtime for its query engine
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install deps first for layer caching. Keep dev deps: the container needs the
# prisma CLI at start to run `migrate deploy`.
COPY package*.json ./
RUN npm ci

# Prisma schema + config must be present before generate
COPY prisma.config.ts ./
COPY prisma ./prisma
RUN npx prisma generate

# App source
COPY . .

# Drop root
USER node

EXPOSE 5500

# Apply pending migrations, then boot. `migrate deploy` (never `migrate dev`)
# is the production/CI-safe command — it only applies committed migrations.
CMD ["sh", "-c", "npx prisma migrate deploy && node index.js"]
