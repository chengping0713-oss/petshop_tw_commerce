# PawPick 部署指南
## Google Cloud Run（後端）+ Firebase Hosting（前端）

---

## 架構總覽

```
使用者
  │
  ├─▶ Firebase Hosting（靜態前端）
  │     └─ index.html, admin.html
  │
  └─▶ Cloud Run（後端 API）
        └─ Node.js / Express / SQLite
              └─ Filestore NFS（持久化資料庫 + 圖片）
```

---

## 第一步：安裝工具

```bash
# 安裝 Google Cloud CLI
# macOS
brew install google-cloud-sdk

# Windows：下載安裝包
# https://cloud.google.com/sdk/docs/install

# 登入
gcloud auth login

# 設定你的專案（替換成你的專案 ID）
gcloud config set project 你的專案ID

# 安裝 Firebase CLI
npm install -g firebase-tools
firebase login
```

---

## 第二步：啟用 Google Cloud 服務

```bash
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  file.googleapis.com \
  secretmanager.googleapis.com
```

---

## 第三步：建立 Filestore（SQLite 持久化儲存）

> ⚠️ Filestore 每月約 USD $200（200GB 最小容量）
> 如果預算有限，可考慮改用 Turso（SQLite 雲端版，免費方案）或 PlanetScale

```bash
# 建立 Filestore 實例（約需 5 分鐘）
gcloud filestore instances create pawpick-storage \
  --zone=asia-east1-b \
  --tier=BASIC_HDD \
  --file-share=name=data,capacity=1TB \
  --network=name=default

# 查詢 Filestore IP
gcloud filestore instances describe pawpick-storage --zone=asia-east1-b
# 記下 ipAddresses 的值
```

---

## 第四步：設定 Secret Manager（環境變數）

```bash
# 建立 JWT Secret（自動產生強密碼）
JWT_SECRET=$(openssl rand -base64 32)
echo -n "$JWT_SECRET" | gcloud secrets create JWT_SECRET --data-file=-

# 若之後要更新
echo -n "新密碼" | gcloud secrets versions add JWT_SECRET --data-file=-
```

---

## 第五步：建立 Docker Image 並推送

```bash
# 設定 Artifact Registry
gcloud artifacts repositories create pawpick \
  --repository-format=docker \
  --location=asia-east1

# 設定 Docker 認證
gcloud auth configure-docker asia-east1-docker.pkg.dev

# 在專案根目錄（有 Dockerfile 的地方）執行：
cd /你的專案路徑

# Build 並推送 Image
IMAGE="asia-east1-docker.pkg.dev/你的專案ID/pawpick/backend:latest"

docker build -t $IMAGE .
docker push $IMAGE
```

---

## 第六步：部署到 Cloud Run

```bash
# 取得 Filestore IP（把 FILESTORE_IP 替換成實際 IP）
FILESTORE_IP="10.x.x.x"

gcloud run deploy pawpick-backend \
  --image=asia-east1-docker.pkg.dev/你的專案ID/pawpick/backend:latest \
  --region=asia-east1 \
  --platform=managed \
  --allow-unauthenticated \
  --port=3000 \
  --memory=512Mi \
  --cpu=1 \
  --min-instances=0 \
  --max-instances=3 \
  --set-env-vars="NODE_ENV=production,DB_PATH=/mnt/data/pawpick.db,UPLOAD_PATH=/mnt/data/uploads,FRONTEND_URL=https://你的專案ID.web.app" \
  --set-secrets="JWT_SECRET=JWT_SECRET:latest" \
  --add-volume=name=nfs-data,type=nfs,location=$FILESTORE_IP:/data \
  --add-volume-mount=volume=nfs-data,mount-path=/mnt/data

# 部署完成後，記下服務的 URL（格式：https://pawpick-backend-xxxxxx-de.a.run.app）
```

---

## 第七步：初始化資料庫

```bash
# 取得 Cloud Run 服務 URL
SERVICE_URL=$(gcloud run services describe pawpick-backend --region=asia-east1 --format='value(status.url)')

# 方法一：在 Cloud Run Job 執行初始化
gcloud run jobs create pawpick-init-db \
  --image=asia-east1-docker.pkg.dev/你的專案ID/pawpick/backend:latest \
  --region=asia-east1 \
  --set-env-vars="NODE_ENV=production,DB_PATH=/mnt/data/pawpick.db" \
  --set-secrets="JWT_SECRET=JWT_SECRET:latest" \
  --add-volume=name=nfs-data,type=nfs,location=$FILESTORE_IP:/data \
  --add-volume-mount=volume=nfs-data,mount-path=/mnt/data \
  --command="node" \
  --args="scripts/initDB.js"

gcloud run jobs execute pawpick-init-db --region=asia-east1 --wait
```

---

## 第八步：更新綠界金流設定

```bash
# 更新 Cloud Run 環境變數（替換成你的實際 URL）
gcloud run services update pawpick-backend \
  --region=asia-east1 \
  --set-env-vars="ECPAY_RETURN_URL=https://你的CloudRun網址/api/payment/notify,ECPAY_RESULT_URL=https://你的CloudRun網址/api/payment/result,ECPAY_MERCHANT_ID=你的商店代號,ECPAY_HASH_KEY=你的HashKey,ECPAY_HASH_IV=你的HashIV"
```

---

## 第九步：部署前端到 Firebase Hosting

```bash
# 在專案根目錄
firebase init hosting
# 選擇你的 Firebase 專案
# public directory: public（把 index.html 和 admin.html 放進 public 資料夾）

# 建立 public 資料夾並放入前端檔案
mkdir public
cp index.html admin.html public/

# 修改前端的 API_URL（指向 Cloud Run 服務）
# 在 index.html 和 admin.html 中，把 API base URL 改為 Cloud Run 的 URL

# 部署
firebase deploy --only hosting
```

---

## 部署後驗證

```bash
# 1. 健康檢查
curl https://你的CloudRun網址/api/health

# 2. 前台網址
open https://你的專案ID.web.app

# 3. 查看 Cloud Run 日誌
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=pawpick-backend" --limit=50
```

---

## 更新部署（之後修改程式碼）

```bash
# 重新 build 並推送
docker build -t $IMAGE .
docker push $IMAGE

# 更新 Cloud Run
gcloud run services update pawpick-backend \
  --image=$IMAGE \
  --region=asia-east1
```

---

## 費用估算（每月）

| 服務 | 費用 |
|------|------|
| Cloud Run | ~USD $5-20（依流量） |
| Filestore (1TB) | ~USD $204 |
| Firebase Hosting | 免費 |
| **合計** | **~USD $210-224** |

> 💡 **省錢替代方案**：若 Filestore 太貴，可改用 **Turso**（SQLite 雲端版，免費 9GB）
> 或將 SQLite 改為 **Cloud SQL PostgreSQL**（小型實例約 USD $10/月）

---

## 常見問題

**Q: Cloud Run 冷啟動慢怎麼辦？**
設定 `--min-instances=1` 保持一個實例常駐（會產生少量費用）

**Q: 圖片上傳後找不到？**
確認 `UPLOAD_PATH=/mnt/data/uploads` 且 Filestore 已正確掛載

**Q: 綠界收不到付款通知？**
確認 `ECPAY_RETURN_URL` 是公開 HTTPS 網址，且 Cloud Run 允許未驗證存取
