# ==============================================================================
# Dockerfile — פרויקט "ילדי היקר" (hasadna/dear_child)
# טופולוגיה מאוחדת ל-hasadna-k8s (D-26, D-38):
# - Stage 1: בניית ה-Frontend SPA (React + Vite)
# - Stage 2: בניית שרת ה-Backend (Node.js + TypeScript — REST API, MCP & ETL)
# - Stage 3: קונטיינר Production קל ובטוח (Non-Root) המגיש את /api/v1/*, /mcp וה-Frontend,
#            ומשמש גם להרצת K8s CronJob של ה-ETL (node dist/etl/run-sync.js)
# ==============================================================================

# --- Stage 1: Build Frontend ---
FROM node:22-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# --- Stage 2: Build Backend ---
FROM node:22-alpine AS backend-builder
WORKDIR /app/backend
COPY backend/package.json ./
RUN npm install
COPY backend/ ./
RUN npm run build && npm prune --omit=dev

# --- Stage 3: Production Runtime ---
FROM node:22-alpine AS production
WORKDIR /app/backend

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
ENV FRONTEND_STATIC_DIR=/app/frontend/dist

COPY --from=backend-builder /app/backend/package.json ./package.json
COPY --from=backend-builder /app/backend/node_modules ./node_modules
COPY --from=backend-builder /app/backend/dist ./dist
COPY --from=backend-builder /app/backend/src/db/migrations ./dist/db/migrations
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist

USER node
EXPOSE 3000

CMD ["node", "dist/server.js"]
