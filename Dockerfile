# --- Build aşaması: Frontend ---
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY client/package.json client/package-lock.json ./client/
RUN cd client && npm ci

COPY client/ ./client/
RUN cd client && npm run build

# --- Production aşaması ---
FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY server/ ./server/
COPY .env.example ./.env.example
COPY --from=builder /app/client/dist ./client/dist

RUN mkdir -p server/uploads/digital server/uploads/receipts server/uploads/thesis

EXPOSE 3001

CMD ["node", "server/index.js"]
