# Campus Crypto Backend

## 功能
- 問卷回答存儲與查詢
- JWT 驗證（管理員 API）
- MongoDB 資料庫整合

## API 端點

### 問卷相關
- `POST /api/survey/submit` - 提交問卷回答
- `GET /api/survey/:taskId/responses` - 查詢任務回答（需 JWT）
- `GET /api/student/:address/surveys` - 查詢學生已提交問卷
- `GET /api/survey/:taskId/stats` - 統計回答數量（需 JWT）

## 環境設定

1. 複製環境變數檔案：
   ```bash
   cp .env.example .env
   ```

2. 編輯 `.env` 檔案：
   ```env
   PORT=3000
   MONGODB_URI=mongodb://localhost:27017/campus-crypto
   JWT_SECRET=your-secret-key-here
   ```

3. 安裝依賴：
   ```bash
   npm install
   ```

4. 啟動 MongoDB（如果使用本地）：
   ```bash
   mongod
   ```

5. 啟動伺服器：
   ```bash
   npm start
   # 或開發模式
   npm run dev
   ```

## 資料庫 Schema

### SurveyResponse
- `taskId`: 任務編號
- `studentAddress`: 學生錢包地址
- `answers`: 回答內容（JSON）
- `submittedAt`: 提交時間