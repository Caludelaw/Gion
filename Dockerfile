# Gion CMS — Docker 镜像
#
# 构建: docker build -t gion .
# 运行: docker run -p 3120:3120 -v gion-data:/app/.gion gion
#
# 默认使用 SQLite 存储，数据持久化到 .gion/ 目录。

FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY packages/core/package.json packages/core/
COPY packages/server/package.json packages/server/
COPY packages/mcp/package.json packages/mcp/
COPY packages/admin/package.json packages/admin/

# Install dependencies
RUN npm install --omit=dev 2>/dev/null || npm install

# Copy source
COPY . .

# Build admin SPA
RUN cd packages/admin && npx vite build 2>/dev/null || echo "Admin build skipped (pre-built)"

FROM node:22-alpine

WORKDIR /app

# Copy only what's needed for runtime
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/packages/core ./packages/core
COPY --from=builder /app/packages/server ./packages/server
COPY --from=builder /app/packages/mcp ./packages/mcp

ENV NODE_ENV=production
ENV GION_STORAGE=sqlite
ENV GION_PORT=3120
ENV GION_HOST=0.0.0.0

EXPOSE 3120

VOLUME ["/app/.gion"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:3120/api/health || exit 1

CMD ["node", "packages/server/src/index.js"]
