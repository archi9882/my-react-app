# 🚀 Crypto Fund Flow - SaaS 部署指南

本應用採用 **SaaS 模式**部署。用戶無法訪問源代碼，只能通過您的服務器使用。

---

## 📋 部署前準備

### 1. 檢查環境變量
確保 `.env.local` 文件配置正確（不上傳到 Git）：

```bash
VITE_API_BASE_URL=https://api.coingecko.com/api/v3
VITE_APP_URL=https://yourapp.com
```

### 2. 構建應用

```bash
npm run build
# 輸出：dist/ 文件夾（已編譯，看不到源代碼）
```

---

## 🐳 方案 A：Docker 部署（推薦）

### 本地測試
```bash
docker-compose up --build
# 訪問：http://localhost:3000
```

### 部署到服務器

**1. 上傳到服務器**
```bash
# 在您的服務器上
git clone <repo-url>
cd my-react-app
```

**2. 設置環境變量**
```bash
# 編輯 .env.local（在服務器上）
nano .env.local
```

**3. 啟動 Docker 容器**
```bash
docker-compose up -d

# 檢查狀態
docker-compose ps
docker logs my-react-app-crypto-fund-flow-1
```

**4. 配置反向代理（Nginx）**

在服務器上配置 Nginx 將域名指向應用：

```nginx
server {
    listen 80;
    server_name yourapp.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

重啟 Nginx：
```bash
sudo systemctl restart nginx
```

---

## ☁️ 方案 B：Vercel 部署（快速）

### 部署步驟

1. **連接 GitHub**
   - 推送代碼到 GitHub
   - 訪問 [vercel.com](https://vercel.com)
   - 導入項目

2. **設置環境變量**
   - 在 Vercel 項目設置中添加 `.env.local` 變量
   - 不提交敏感信息到 Git

3. **自動部署**
   ```bash
   git push  # Vercel 自動部署
   ```

---

## 🟦 方案 C：Azure App Service 部署

### 部署步驟

```bash
# 1. 登錄 Azure
az login

# 2. 創建資源組
az group create --name myResourceGroup --location eastus

# 3. 創建 App Service Plan
az appservice plan create --name myPlan --resource-group myResourceGroup --sku B1 --is-linux

# 4. 創建 Web App
az webapp create --resource-group myResourceGroup --plan myPlan --name yourapp --runtime "node|18-lts"

# 5. 部署
az webapp deployment source config-zip --resource-group myResourceGroup --name yourapp --src dist.zip
```

---

## 🔒 安全考慮事項

### ✅ 已實施的保護

1. **源代碼隱藏**
   - 用戶只能訪問編譯後的 `/dist` 文件
   - 所有邏輯代碼被混淆和縮小

2. **環境變量保護**
   - `.env.local` 不上傳到 Git
   - 敏感信息只在服務器上存儲

3. **API 保護**
   - CoinGecko API 調用來自服務器端
   - 用戶看不到 API 密鑰

### 🛡️ 建議的額外措施

1. **HTTPS**
   - 使用 SSL 證書加密流量
   - 推薦使用 Let's Encrypt（免費）

2. **速率限制**
   ```javascript
   // 在 crypto-fund-flow.jsx 中添加
   const CACHE_DURATION = 60000; // 60 秒
   ```

3. **日誌監控**
   - 監控異常流量
   - 記錄 API 調用頻率

---

## 📊 監控和維護

### 檢查應用狀態
```bash
# Docker
docker ps
docker logs <container-id>

# 系統日誌
journalctl -u docker -f
```

### 更新應用
```bash
# 拉取最新代碼
git pull

# 重新構建和部署
docker-compose up -d --build
```

---

## 📞 常見問題

**Q: 用戶可以看到源代碼嗎？**
A: 不能。他們只能訪問編譯後的應用（瀏覽器無法反向工程）。

**Q: 如何限制訪問？**
A: 可以添加認證層（JWT、OAuth）或 IP 白名單。

**Q: 成本多少？**
A: 取決於服務器提供商。Docker 容器約 $5-20/月。

---

## 🔗 參考資源

- [Docker 官方文檔](https://docs.docker.com/)
- [Vercel 部署指南](https://vercel.com/docs)
- [Nginx 反向代理](https://nginx.org/en/docs/)
- [Let's Encrypt HTTPS](https://letsencrypt.org/)
