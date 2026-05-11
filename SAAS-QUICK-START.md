# 🚀 SaaS 快速啟動指南

## 目標
將 Crypto Fund Flow 部署為 SaaS 應用，用戶通過 URL 訪問，源代碼完全隱藏。

---

## 5 分鐘快速啟動

### 1️⃣ 準備環境
```bash
# 確保已安裝
- Node.js 18+
- Docker & Docker Compose
- Git
```

### 2️⃣ 配置環境變量
```bash
# 複製示例文件
cp .env.example .env.local

# 編輯配置（根據需要）
nano .env.local
```

### 3️⃣ 構建和部署
```bash
# 方式 A：使用快速部署腳本
chmod +x deploy.sh
./deploy.sh

# 方式 B：手動部署
npm run build
docker-compose up -d
```

### 4️⃣ 驗證
```bash
# 檢查應用是否運行
curl http://localhost:3000

# 或在瀏覽器中訪問
http://localhost:3000
```

---

## 📦 部署到生產環境

### 選項 1：自己的服務器

**VPS 提供商推薦**：
- DigitalOcean ($5/月)
- Linode ($5/月)
- AWS EC2 ($0.5-2/月)
- Vultr ($2.5/月)

**部署步驟**：
```bash
# 1. SSH 連接到服務器
ssh user@your-server.com

# 2. 克隆項目
git clone <repo-url>
cd my-react-app

# 3. 設置環境變量
nano .env.local

# 4. 啟動應用
docker-compose up -d

# 5. 配置域名（Nginx）
# 參考 DEPLOYMENT.md
```

### 選項 2：Vercel（最簡單）

```bash
# 1. 推送到 GitHub
git push

# 2. 訪問 https://vercel.com
# 3. 導入項目
# 4. 設置環境變量
# 5. 部署完成！
```

**優勢**：
- ✅ 自動 HTTPS
- ✅ 全球 CDN
- ✅ 自動部署
- ✅ 免費額度

---

## 🔒 安全檢查清單

確保部署前完成以下檢查：

- [ ] `.env.local` 已添加到 `.gitignore`（不上傳敏感信息）
- [ ] `.env.local` 在服務器上正確配置
- [ ] HTTPS/SSL 已啟用
- [ ] 源代碼不在 `dist/` 文件中
- [ ] `docker-compose up -d` 成功運行
- [ ] 應用可通過 URL 訪問
- [ ] 訪問代碼後查看源碼時看不到 JavaScript 邏輯
- [ ] 健康檢查通過（`curl http://localhost:3000`）

---

## 🌐 配置域名

### 使用 Nginx

```nginx
# /etc/nginx/sites-available/crypto-fund-flow

server {
    listen 80;
    server_name yourapp.com www.yourapp.com;
    
    # 重定向到 HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourapp.com www.yourapp.com;
    
    # SSL 證書（使用 Let's Encrypt）
    ssl_certificate /etc/letsencrypt/live/yourapp.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourapp.com/privkey.pem;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        
        # WebSocket 支持（如果需要）
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

啟用站點：
```bash
sudo ln -s /etc/nginx/sites-available/crypto-fund-flow /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 獲取 SSL 證書

```bash
# 安裝 Certbot
sudo apt-get install certbot python3-certbot-nginx

# 獲取證書
sudo certbot certonly --nginx -d yourapp.com -d www.yourapp.com

# 自動續期
sudo systemctl enable certbot.timer
```

---

## 📊 監控應用

### 查看日誌
```bash
# 應用日誌
docker logs -f my-react-app-crypto-fund-flow-1

# 系統日誌
journalctl -u docker -f
```

### 健康檢查
```bash
# 定期監控應用狀態
curl -I https://yourapp.com

# 檢查響應時間
time curl https://yourapp.com
```

---

## 🔧 常見故障排除

### 問題：Docker 容器無法啟動

```bash
# 檢查日誌
docker-compose logs

# 重新構建
docker-compose down
docker-compose up --build
```

### 問題：域名無法訪問

```bash
# 檢查 DNS 設置
nslookup yourapp.com

# 檢查防火牆
sudo ufw allow 80
sudo ufw allow 443
```

### 問題：性能緩慢

```bash
# 增加服務器資源
# 檢查 Docker 資源使用
docker stats

# 優化緩存
# 在 crypto-fund-flow.jsx 中增加 API 緩存
```

---

## 📈 擴展應用

### 添加數據庫
```bash
# 如果需要保存用戶數據
docker-compose.yml 中添加 PostgreSQL 服務
```

### 添加認證
```bash
# 保護應用免於未授權訪問
# 使用 NextAuth、Auth0 或 OAuth
```

### 添加分析
```javascript
// 在 crypto-fund-flow.jsx 中
if (import.meta.env.VITE_ANALYTICS_ID) {
  // 集成 Google Analytics 或 Mixpanel
}
```

---

## 💰 成本估算

| 服務 | 成本 | 備註 |
|------|------|------|
| VPS (DigitalOcean) | $5-20/月 | 1GB-2GB 內存 |
| 域名 | $10-15/年 | .com 域名 |
| SSL 證書 | 免費 | Let's Encrypt |
| CDN (可選) | $0-20/月 | Cloudflare 免費 |
| **總計** | **$10-30/月** | 完全自主託管 |

---

## ✅ 部署完成清單

- [ ] 應用在生產環境中運行
- [ ] HTTPS 已啟用
- [ ] 域名指向應用
- [ ] 備份和恢復計劃已制定
- [ ] 日誌記錄和監控已配置
- [ ] 自動更新策略已規劃
- [ ] 用戶反饋系統已設置

---

## 📞 獲得幫助

查看完整部署指南：[DEPLOYMENT.md](./DEPLOYMENT.md)

常見問題：[FAQ](./FAQ.md)
