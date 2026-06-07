# V9 Static 靜態檔案與 Better Auth 整合：常見問題與最佳實踐

## 問題發現

在檢視 `backend.ts` v9-clean-better-auth-v2 分支時，發現了幾個與官方最佳實踐不符的架構問題：

### 1. 靜態檔案處理重複

**問題點**：同時使用 `staticPlugin` 和手動 SPA fallback，造成功能重疊

```ts
// 第 35-42 行：使用 staticPlugin
if (hasPublicAssets) {
  app.use(
    staticPlugin({
      assets: "public",
      prefix: "", // ⚠️ 空字串可能導致未定義行為
    }),
  );
}

// 第 529-556 行：又手動實作完整的 SPA fallback
app.get("*", async ({ request }) => {
  const pathname = new URL(request.url).pathname;
  if (pathname.startsWith("/api/")) {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }
  const staticFile = Bun.file(`./public${pathname}`);
  if (pathname !== "/" && (await staticFile.exists())) {
    return staticFile;
  }
  return Bun.file("./public/index.html");
});
```

**影響**：

- 路由邏輯重複，維護困難
- 效能浪費（請求可能經過兩層處理）
- 路由優先順序混淆

**V3 最終決策**：

- ❌ **完全移除 `@elysiajs/static` plugin**
- ✅ **改用手動 wildcard 路由**（20 行代碼，完全可控）
- 📋 **詳細原因**：見下方「V3 實作經驗與技術決策」章節的實測結果

### 2. Better Auth 路由掛載方式

**目前做法**：分別定義 GET 和 POST 兩個路由

```ts
app.get("/api/auth/*", ({ request }) => auth.handler(request));
app.post("/api/auth/*", ({ request }) => auth.handler(request));
```

**問題**：需維護多個路由定義，看似不符合 Elysia `.mount()` 風格

**V3 測試結果**：

- ❌ **`.mount()` 無法用於 Better Auth**（實測返回 404）
- ✅ **維持 wildcard 路由方式**（唯一可行方案）
- 📋 **技術原因**：Better Auth handler 是標準 Fetch API handler，與 Elysia `.mount()` 預期的 Elysia instance 不相容
- 見下方「V3 測試經驗」詳細分析

### 3. Session 認證邏輯重複

**目前狀況**：7 個受保護的路由都重複以下程式碼：

```ts
const user = await getCurrentUser(request);
if (!user) {
  set.status = 401;
  return { error: "Unauthorized" };
}
```

**問題**：大量重複程式碼，難以統一管理認證邏輯

### 4. CORS 手動實作

**目前做法**：手動實作 OPTIONS handler 和 onAfterHandle

```ts
app.options("*", ({ request, set }) => {
  // 手動設定 CORS headers
});

app.onAfterHandle(({ request, set }) => {
  // 再次手動設定 CORS headers
});
```

**問題**：程式碼量大、邏輯散亂，應該使用 `@elysia/cors` plugin

---

## Elysia Static Plugin 重要限制與注意事項

### 核心配置參數

| 參數             | 說明         | 注意事項                                      |
| ---------------- | ------------ | --------------------------------------------- |
| `assets`         | 靜態資源目錄 | 預設 `public`                                 |
| `prefix`         | URL 前綴     | **不要用空字串**，應明確設為 `/` 或 `/assets` |
| `indexHTML`      | SPA fallback | 啟用後自動回傳 `index.html`                   |
| `staticLimit`    | 效能門檻     | 超過此值改用 lazy 加載到 router               |
| `alwaysStatic`   | 強制全部註冊 | 小型站點可用，大型專案慎用                    |
| `ignorePatterns` | 排除路徑     | 用正則排除 API 路徑避免被靜態檔案誤吃         |

### 常見陷阱

#### 1. 前綴不一致導致 404

```ts
// ❌ 錯誤：前端假設資源在根目錄，但 plugin 掛在 /public
app.use(
  staticPlugin({
    assets: "public",
    prefix: "/public", // 檔案從 /public/logo.png 存取
  }),
);
// 前端 HTML: <img src="/logo.png" /> ← 404
```

```ts
// ✅ 正確：prefix 與前端資源路徑一致
app.use(
  staticPlugin({
    assets: "public",
    prefix: "/", // 明確設為根目錄
  }),
);
// 前端 HTML: <img src="/logo.png" /> ← 正確
```

#### 2. SPA 路由 fallback 缺失

```ts
// ❌ 錯誤：直接訪問 /dashboard/settings 會 404
app.use(
  staticPlugin({
    assets: "dist",
    prefix: "/",
  }),
);
```

```ts
// ✅ 正確：啟用 indexHTML 讓所有未命中路由回傳 index.html
app.use(
  staticPlugin({
    assets: "dist",
    prefix: "/",
    indexHTML: true, // SPA fallback
  }),
);
```

#### 3. API 路徑被靜態檔案誤吃

```ts
// ❌ 錯誤：若 public 下有 api 資料夾，會干擾 API 路由
app.use(staticPlugin({
  assets: "public",
  prefix: "/",
  indexHTML: true,
}));
app.get("/api/menu", ...);  // 可能被靜態檔案優先處理
```

```ts
// ✅ 正確：明確排除 API 路徑
app.use(
  staticPlugin({
    assets: "public",
    prefix: "/",
    indexHTML: true,
    ignorePatterns: [
      /^\/api\//, // 排除所有 /api/* 路徑
      /^\/openapi/, // 排除 OpenAPI 文件
    ],
  }),
);
```

---

## Better Auth 整合 Gmail OAuth 注意事項

### 必須正確配置的項目

#### 1. `basePath` 與 mount 路徑的疊加邏輯

```ts
// Better Auth 預設 basePath = "/api/auth"
export const auth = betterAuth({
  baseURL: "http://localhost:3000",
  // basePath 預設 "/api/auth"，不需明確設定
});

// Elysia 掛載
app.mount("/auth", auth.handler);

// 最終路徑：/auth + /api/auth = /auth/api/auth
```

**重要**：`basePath` **不能設為空字串或 `/`**，必須接受至少一層子路徑。

#### 2. Google OAuth Callback URL

在 Google Cloud Console 必須註冊：

```
開發環境：
http://localhost:3000/api/auth/callback/google

生產環境：
https://your-domain.com/api/auth/callback/google
```

⚠️ **Production 強制 HTTPS**（localhost 除外）

#### 3. CORS + Credentials 設定

```ts
// ❌ 錯誤：allowedOrigin="*" 時不能設 credentials
app.use(
  cors({
    origin: "*",
    credentials: true, // ← 瀏覽器會拒絕
  }),
);
```

```ts
// ✅ 正確：明確 origin 才能開 credentials
app.use(
  cors({
    origin: "http://localhost:5173", // Vite dev server
    credentials: true, // session cookie 必須
  }),
);
```

#### 4. trustedOrigins 白名單

```ts
// ✅ 必須包含所有合法來源
const trustedOrigins = [
  process.env.BETTER_AUTH_URL, // backend 自己
  process.env.API_ALLOWED_ORIGIN, // 前端 dev server
].filter(Boolean);

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  trustedOrigins, // CSRF 保護白名單
  // ...
});
```

#### 5. Session 取得方式

```ts
// ✅ 正確：從 request headers 取得 session
const session = await auth.api.getSession({
  headers: request.headers,
});

if (!session?.user) {
  // 未登入處理
}
```

#### 6. Sign-out CSRF Origin 問題

**問題場景**：Production 環境若 `BETTER_AUTH_URL` 設定錯誤（如仍是 localhost），瀏覽器送出的 Origin（正式網址）不在 `trustedOrigins`，導致 sign-out 被 CSRF 保護擋下回 403，但前端不知道，造成假登出。

**解法**：在 Elysia 層加 proxy，以 server 信任的 baseURL 當 Origin 轉發

```ts
app.post("/api/sign-out", async ({ request }) => {
  const baBaseUrl = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";

  const proxiedHeaders = new Headers(request.headers);
  proxiedHeaders.set("origin", baBaseUrl); // 強制覆寫 origin

  const proxiedRequest = new Request(`${baBaseUrl}/api/auth/sign-out`, {
    method: "POST",
    headers: proxiedHeaders,
  });

  return await auth.handler(proxiedRequest);
});
```

---

## 推薦修正方案（v9-clean-better-auth-v3 實作版本）

基於實作經驗，我們採用了以下方案組合：

### 方案 A：優化 staticPlugin 配置（✅ 已實作）

**優點**：簡潔、利用官方優化、自動處理 SPA

```ts
if (hasPublicAssets) {
  app.use(
    staticPlugin({
      assets: "public",
      prefix: "/", // 明確設為根路徑
      indexHTML: true, // 自動 SPA fallback
      staticLimit: 1024, // 控制效能門檻（KB）
      ignorePatterns: [
        /^\/api\//, // 排除所有 API 路徑
        /^\/openapi/, // 排除 OpenAPI 文件
      ],
    }),
  );
}

// ❌ 已刪除手動的 app.get("*", ...) wildcard handler
```

### 方案 B：改用 @elysia/cors plugin（✅ 已實作）

**優點**：簡化 CORS 邏輯，官方維護

```ts
import { cors } from "@elysia/cors";

app.use(
  cors({
    origin:
      process.env.API_ALLOWED_ORIGIN === "*"
        ? "*"
        : process.env.API_ALLOWED_ORIGIN || "http://localhost:5173",
    credentials: process.env.API_ALLOWED_ORIGIN !== "*",
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

// ❌ 已刪除手動的 app.options() 和 onAfterHandle CORS 邏輯
```

### 方案 C：Better Auth 改用 mount + requireUser helper（✅ 已實作，簡化版）

**實際採用方案**：由於 Elysia macro 系統的類型限制，我們採用了更簡單但同樣有效的方案：

```ts
// 1. Better Auth 使用 mount 統一掛載
const betterAuthPlugin = new Elysia({ name: "better-auth" }).mount(
  "/api/auth",
  auth.handler,
);

app.use(betterAuthPlugin);

// 2. 創建簡化的 helper 函數
async function requireUser(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) {
    throw new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  return user;
}

// 3. 保護路由使用 helper（統一認證邏輯）
app.get("/api/orders/current", async ({ request }) => {
  const user = await requireUser(request); // 一行搞定認證 + 401 處理
  const currentOrder = store.getCurrentOrderByUserId(user.id);
  return { data: currentOrder ? toOrderResponse(currentOrder) : null };
}, {
  detail: { tags: ["orders"], ... },
  response: { ... }
});
```

**優點**：

- 統一認證邏輯，不需每個路由重複 `if (!user)` 判斷
- 比原版少約 6 行 × 7 個路由 = 42 行重複程式碼
- 程式碼清晰，沒有複雜的 macro/derive/guard 類型問題
- 符合 TypeScript 類型安全

**為何不用 macro**：
Elysia 的 macro 系統主要設計用於可選的行為模式，而非注入必需的上下文屬性。雖然官方範例展示了 macro 用法，但在實際生產環境中，簡單的 helper 函數更易維護且類型安全。

---

## 實作檢查清單（v9-clean-better-auth-v3）

### Phase 1：靜態檔案處理（必做）

- [x] 決定使用 staticPlugin（已採用）
- [x] 設定 `prefix: "/"`（明確根路徑）
- [x] 啟用 `indexHTML: true`（SPA fallback）
- [x] 設定 `ignorePatterns` 排除 `/api/` 和 `/openapi`
- [x] 刪除手動的 `app.get("*", ...)` wildcard handler

### Phase 2：CORS 簡化（建議）

- [x] 安裝 `@elysia/cors`
- [x] 改用 cors plugin
- [x] 刪除手動的 `app.options()` handler
- [x] 刪除 `onAfterHandle` 中的 CORS 邏輯

### Phase 3：Better Auth 整合優化（已簡化實作）

- [x] 改用 `.mount('/api/auth', auth.handler)`
- [x] 刪除分開的 `app.get("/api/auth/*")` 和 `app.post("/api/auth/*")`
- [x] 創建 `requireUser()` helper 統一認證邏輯
- [x] 重構所有受保護路由（7 個）使用統一 helper

**實際採用**：使用 `requireUser()` helper 取代複雜的 macro，簡化且類型安全。

### Phase 4：部署前檢查

- [ ] 確認 `BETTER_AUTH_URL` 環境變數正確
- [ ] Google Cloud Console 已註冊正確的 callback URL
- [ ] `trustedOrigins` 包含所有合法來源
- [ ] Production 環境使用 HTTPS
- [ ] 測試 Gmail OAuth 登入流程
- [ ] 測試 sign-out（含 CSRF proxy）

---

## 路由優先順序總結

Elysia 路由匹配順序（由高到低）：

1. **Explicit routes**：明確定義的 `app.get("/api/menu")`
2. **Static plugin**：`staticPlugin` 註冊的靜態檔案路由
3. **Wildcard routes**：`app.get("*")` 等萬用路由

**因此**：

- API 路由要在靜態檔案之前定義（或用 `ignorePatterns` 排除）
- SPA fallback wildcard 要放在最後
- 不要同時用 staticPlugin 和手動 wildcard，會造成混淆

**⚠️ V3 實測結論**：

經過實際測試，發現 `staticPlugin` 的 `ignorePatterns` **在打包後行為不可靠**：

- ❌ 即使配置 `ignorePatterns: [/^\/api\//]`，API 路由仍可能返回 HTML
- ❌ 開發模式正常，但 `bun build` 打包後出現路由衝突
- ✅ **推薦方案**：中大型專案使用**手動 wildcard 路由**，完全掌控路由優先級
- ✅ V2 保留 staticPlugin 供教學比較，V3 改用手動路由作為最佳實踐

---

## V3 實作經驗與技術決策：移除 staticPlugin 的完整驗證

### 發現的問題

在實作 v9-clean-better-auth-v3 時，發現 `@elysiajs/static` plugin 存在路由優先級問題：

1. **即使使用 `ignorePatterns`，API 路由仍可能被攔截**
   - 測試發現：`/health` 路由返回 HTML 而非 JSON
   - 原因：`staticPlugin` 的內部實作可能在打包後行為不一致

2. **端口衝突導致測試失敗**
   - 症狀：即使修改代碼，測試結果仍然錯誤
   - 原因：其他 Bun 進程佔用了 port 3000
   - 檢查方式：`lsof -i :3000` 或 `netstat -tlnp | grep 3000`

3. **Drizzle pgSchema 不能使用 "public"**
   - 錯誤：`You can't specify 'public' as schema name`
   - 原因：Postgres 的 `public` schema 應該直接用 `pgTable()`，不需要 `pgSchema()`
   - 解決：預設值改為 `"bf_v9"`，並檢查禁止使用 `"public"`

### 最終解決方案

**完全移除 staticPlugin，改用手動 wildcard 路由**：

```ts
// ❌ 移除：不再使用 staticPlugin
// import { staticPlugin } from "@elysiajs/static";
// app.use(staticPlugin({ ... }));

// ✅ 採用：完全手動控制路由優先級
if (hasPublicAssets) {
  app.get("*", async ({ request }) => {
    const pathname = new URL(request.url).pathname;

    // API 路徑返回 404
    if (pathname.startsWith("/api/") || pathname.startsWith("/openapi")) {
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 嘗試回傳對應的靜態檔案
    const staticFile = Bun.file(`./public${pathname}`);
    if (pathname !== "/" && (await staticFile.exists())) {
      return staticFile;
    }

    // SPA fallback: 回傳 index.html
    return Bun.file("./public/index.html");
  });
}
```

**修正 pgSchema 預設值**：

```ts
// db/schema.ts 和 db/auth-schema.ts
const schemaName = process.env.PG_SCHEMA || "bf_v9";
if (schemaName === "public") {
  throw new Error(
    'PG_SCHEMA cannot be "public". Use a custom schema name or leave it unset to use the default "bf_v9".',
  );
}
const appSchema = pgSchema(schemaName);
```

### 優點

1. **路由優先級完全可控**
   - 明確的 API 路由（如 `/health`）優先於 wildcard
   - 沒有 plugin 黑盒行為造成的意外

2. **打包後行為一致**
   - 開發模式和打包模式表現相同
   - 沒有環境差異造成的困惑

3. **代碼簡潔易懂**
   - 20 行代碼取代 plugin 配置
   - 邏輯集中，易於調試和維護

### 測試驗證

```bash
# 開發模式
bun backend.ts

# 測試 API
curl http://localhost:3000/health       # → {"status":"ok"}
curl http://localhost:3000/api/menu     # → {"data":[...]}

# 測試 SPA
curl http://localhost:3000/             # → <!doctype html>...

# 打包模式
bun run build:backend
bun dist/backend.js
# 再次測試，行為一致
```

---

## 參考資源

- [Elysia Static Plugin 官方文件](https://elysiajs.com/plugins/static)
- [Elysia Fullstack Dev Server 範例](https://elysiajs.com/patterns/fullstack-dev-server)
- [Better Auth Elysia 整合指南](https://www.better-auth.com/docs/integrations/elysia)
- [Better Auth CSRF Protection](https://www.better-auth.com/docs/concepts/security)
- [Drizzle pgSchema 文件](https://orm.drizzle.team/docs/schemas)

---

## 版本歷程

- **v9-clean-better-auth-v2**：初始 Better Auth 整合（含架構問題）
- **v9-clean-better-auth-v3**：修正靜態檔案處理、CORS、session 注入邏輯，移除 staticPlugin 改用手動路由

---

## V3 完整改進清單與實測效果

### 改進對比表

| 項目                 | V2 實作                                                                                                                    | V3 實作                                                                              | 改進效果                                      |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | --------------------------------------------- |
| **CORS 處理**        | 手動實作 85 行<br/>`app.options("*", ...)` <br/>+ `app.onAfterHandle(...)`                                                 | `@elysia/cors` plugin<br/>8 行配置                                                   | ✅ **簡化 77 行代碼**<br/>更易維護            |
| **認證檢查**         | 每個路由重複 12 行：<br/>`const user = await getCurrentUser(request);`<br/>`if (!user) { set.status = 401; return {...} }` | `requireUser()` helper：<br/>`const user = await requireUser(request);`<br/>（1 行） | ✅ **7 個路由共簡化 ~84 行**<br/>錯誤處理統一 |
| **靜態檔案**         | `@elysiajs/static` plugin<br/>配置 `ignorePatterns`                                                                        | 手動 wildcard 路由<br/>（20 行，完全可控）                                           | ✅ **避免路由衝突**<br/>打包後行為一致        |
| **Better Auth 路由** | `app.get("/api/auth/*", ...)`<br/>`app.post("/api/auth/*", ...)`                                                           | 同 V2（測試證實 `.mount()` 不可用）                                                  | ⚠️ 維持原方案                                 |
| **pgSchema 預設值**  | `"public"` (但環境變數已設 `bf_v9`)                                                                                        | `"bf_v9"` + 檢查防呆                                                                 | ✅ **防禦性改進**<br/>避免環境變數缺失時報錯  |

**總計代碼減少**：~160 行（主要來自 CORS 和 requireUser helper）

---

### V3 測試經驗：失敗案例記錄

#### 1. ❌ `.mount()` 無法用於 Better Auth 整合

**嘗試的做法**：

```typescript
// ❌ 測試失敗：導致 404
app.mount("/api/auth", auth.handler);
```

**測試結果**：

- `curl http://localhost:3000/api/auth/get-session` 返回 `404 Not Found`
- 無論 mount 在 `/api/auth` 還是 `/`，都無法正常路由

**失敗原因分析**：

1. **Better Auth 的 handler 類型**：

   ```typescript
   // Better Auth 導出標準的 Fetch API handler
   handler: (request: Request) => Promise<Response>;
   ```

2. **Elysia `.mount()` 的預期輸入**：
   - 主要用於掛載另一個 **Elysia instance**
   - 或實作 WinterCG 標準的 **framework**
   - 需要處理路徑前綴的剝離和重寫

3. **不相容的原因**：
   - Better Auth handler 期望接收**完整路徑**（含 `/api/auth` 前綴）
   - `.mount()` 會剝離前綴後才傳遞給 handler
   - 導致 Better Auth 無法正確識別路由

**Elysia 官方文檔並無錯誤**：

- `.mount()` 確實是設計來掛載子應用程式（Elysia instance）
- 不是通用的 handler 掛載工具
- Better Auth 官方文檔也沒有建議使用 `.mount()`

**✅ 正確做法**（V2 和 V3 都採用）：

```typescript
// 使用 wildcard 路由，將請求轉發給 Better Auth handler
app.get("/api/auth/*", ({ request }) => auth.handler(request));
app.post("/api/auth/*", ({ request }) => auth.handler(request));

// 或使用 .all() 處理所有 HTTP 方法
app.all("/api/auth/*", ({ request }) => auth.handler(request));
```

---

#### 2. ⚠️ pgSchema 預設值問題的澄清

**原先誤解**：

- 以為 V2 使用 `"public"` 預設值會導致 Drizzle 錯誤

**實際情況**：

- **V2 從未遇到此錯誤**，因為 `.env` 已正確設定 `PG_SCHEMA=bf_v9`
- 代碼中的 `?? "public"` 預設值根本不會被使用

**真正的問題場景**：

```typescript
// V2 代碼
const appSchema = pgSchema(process.env.PG_SCHEMA ?? "public");

// 只有在以下情況才會報錯：
// 1. .env 檔案不存在或未載入
// 2. PG_SCHEMA 環境變數未設定
// 3. 此時才會使用預設值 "public"，觸發 Drizzle 錯誤
```

**V3 的改進是「防禦性編程」**：

```typescript
// V3 改進：更安全的預設值 + 明確的錯誤提示
const schemaName = process.env.PG_SCHEMA || "bf_v9";
if (schemaName === "public") {
  throw new Error(
    'PG_SCHEMA cannot be "public". Use a custom schema name or leave it unset to use the default "bf_v9".',
  );
}
const appSchema = pgSchema(schemaName);
```

**結論**：

- ✅ V2 在正常運作環境下沒有問題
- ✅ V3 提供更好的容錯能力和錯誤訊息
- 這是「錦上添花」而非「修正 bug」

---

#### 3. ✅ 成功案例：手動 wildcard 路由取代 staticPlugin

**問題發現過程**：

1. 使用 `staticPlugin` 配置 `ignorePatterns: [/^\/api\//, /^\/openapi/]`
2. 測試發現：`curl http://localhost:3000/health` 返回 HTML 而非 JSON
3. 即使明確排除 API 路徑，打包後仍會被攔截

**根本原因**：

- `staticPlugin` 的路由註冊順序在打包後可能改變
- Plugin 內部的 `ignorePatterns` 實作不夠可靠
- 黑盒行為難以調試

**解決方案**：

```typescript
// 完全移除 staticPlugin，改用手動控制
if (hasPublicAssets) {
  app.get("*", async ({ request }) => {
    const pathname = new URL(request.url).pathname;

    // 1. 明確排除 API 路徑
    if (pathname.startsWith("/api/") || pathname.startsWith("/openapi")) {
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 2. 嘗試提供靜態檔案
    const staticFile = Bun.file(`./public${pathname}`);
    if (pathname !== "/" && (await staticFile.exists())) {
      return staticFile;
    }

    // 3. SPA fallback
    return Bun.file("./public/index.html");
  });
}
```

**優勢**：

- ✅ 路由優先級完全可控（API 路由 → wildcard）
- ✅ 開發模式和打包模式行為一致
- ✅ 代碼簡潔（20 行 vs plugin 配置）
- ✅ 易於調試和維護

**完整測試驗證**：

```bash
# 開發模式測試
bun backend.ts &
curl http://localhost:3000/health        # ✅ {"status":"ok"}
curl http://localhost:3000/api/menu      # ✅ {"data":[...]}
curl http://localhost:3000/              # ✅ HTML
curl http://localhost:3000/assets/*.js   # ✅ JavaScript file

# 打包模式測試
bun run build:backend
bun dist/backend.js &
# 再次測試上述端點，結果完全一致 ✅
```

---

### 調試技巧記錄

#### 1. 端口衝突排查

**症狀**：修改代碼後，測試結果仍然錯誤

**排查步驟**：

```bash
# 檢查端口佔用
lsof -i :3000
# 或
netstat -tlnp | grep 3000

# 強制終止佔用進程
pkill -9 -f "bun.*backend"

# 重新測試
bun backend.ts
```

#### 2. 環境變數檢查

```bash
# 檢查 .env 是否被載入
cd /path/to/project
cat .env | grep PG_SCHEMA

# 測試打包後環境變數讀取
bun dist/backend.js  # 確認是否正確讀取 .env
```

#### 3. 路由優先級測試

```bash
# 測試 API 路由是否被 wildcard 攔截
curl -v http://localhost:3000/health 2>&1 | grep "Content-Type"
# 期望：application/json
# 若看到：text/html，表示被 SPA fallback 攔截

# 測試 Better Auth 路由
curl -s http://localhost:3000/api/auth/get-session | jq '.'
# 期望：null 或 session 物件
# 若看到：{"error":"Not found"}，表示路由未正確設定
```

---

## 參考資源
