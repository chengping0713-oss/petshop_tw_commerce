# ================================
# PawPick Backend - Dockerfile
# ================================
FROM node:20-alpine

# 安裝必要套件（better-sqlite3 需要 python3 和 build tools）
RUN apk add --no-cache python3 make g++

WORKDIR /app

# 先複製 package.json，利用 Docker layer cache
COPY package.json ./
RUN npm install --production

# 複製所有原始碼
COPY . .

# 建立必要目錄
RUN mkdir -p /app/database /app/uploads

# 暴露 Port
EXPOSE 3000

# 健康檢查
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

# 啟動
CMD ["node", "server.js"]
