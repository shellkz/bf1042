# 從目前 backend.ts 補齊 Elysia route schema 的實作步驟清單

這份文件是 [02_0_API contract truth 的重要性與實作方式](</root/00_nsPrj/01_backEnd/06_elysia/00_demo01/00_teaching/02_0_API contract truth 的重要性與實作方式.md:1>) 的實作篇。

建議前置閱讀：

- [00\_專案迭代講義.md](/root/00_nsPrj/01_backEnd/06_elysia/00_demo01/00_teaching/00_專案迭代講義.md:1)
- [02_0_API contract truth 的重要性與實作方式.md](/root/00_nsPrj/01_backEnd/06_elysia/00_demo01/00_teaching/02_0_API contract truth 的重要性與實作方式.md:1)

它要處理的不是 ORM、不是資料庫，也不是 auth，而是先把目前 `backend.ts` 的 API 邊界補完整，讓 route schema 成為真正的 API contract truth。

---

## 1. 這一步要達成的功能

這次調整的目標是：

1. 讓每條主要 route 都有明確的 `params / query / body / response`
2. 讓成功回應與錯誤回應格式更一致
3. 讓後續 `Drizzle + Neon` 重構時，有穩定的 API 邊界可依循

換句話說，這一步不是改功能，而是：

`先把 API 的形狀固定下來。`

---

## 2. 目前 backend.ts 的狀態

目前的 `backend.ts` 已經有部分 schema，但還不完整。

已經做得不錯的地方：

- 多數 route 已有 `body` 或 `query` 驗證
- 動態路徑多半已有 `params` 驗證

目前仍缺的地方：

- 很多 route 沒有明確 `response` schema
- 錯誤回應沒有制度化
- 菜單與訂單 API 的成功回應格式雖然大致一致，但沒有被完整宣告成 contract
- `login`、`orders` 等 route 的不同 status code 沒有清楚對應 schema

---

## 3. 建議的實作原則

### 原則一：先補齊，不先重構

這一輪不要急著拆 route 檔、不要急著改資料層。

先做的事情只有：

- 補 schema
- 補 response
- 統一錯誤格式

原因是先把 contract 穩住，比先把程式拆漂亮更重要。

### 原則二：先以目前行為為準，不要在這一步偷改 API 設計

例如：

- `/api/orders/current?userId=...`
- `/api/orders/history?userId=...`

這種設計雖然之後會被 auth 重構掉，但在這一輪仍應先如實定義成 schema，不要在這一步就順手改掉。

原因是：

- 這一步是在固定目前 contract
- 不是在提前做下一步的 auth 重構

### 原則三：成功回應與錯誤回應要分別定義

不要只定義 happy path。

如果某條 route 可能回：

- `200`
- `201`
- `400`
- `401`
- `403`
- `404`
- `409`

那就應該盡量把這些情況的 response schema 一起補齊。

---

## 4. 建議先補的共用 schema

這一步可以先從 `shared/contracts.ts` 或 `backend.ts` 內的局部常數開始整理。

最值得先抽的共用結構有：

### 成功回應

- `ApiDataResponse<MenuItem>`
- `ApiDataResponse<MenuItem[]>`
- `ApiDataResponse<OrderResponse>`
- `ApiDataResponse<OrderResponse[]>`
- `ApiDataResponse<OrderResponse | null>`
- `ApiDataResponse<Omit<User, "password">>`

### 錯誤回應

- `ApiErrorResponse`

例如常見錯誤：

- `{ error: "Invalid credentials" }`
- `{ error: "User not found" }`
- `{ error: "Order not found" }`
- `{ error: "Forbidden" }`

建議做法是：

- 先接受目前錯誤訊息字串仍不完全統一
- 但 response shape 至少先統一成 `ApiErrorResponse`

---

## 5. 建議的修改順序

### 步驟 1：先補 `/api/auth/login`

原因：

- 結構簡單
- 很適合建立「成功 + 失敗 response 都要有 schema」的範例

要補的內容：

- `body`
- `response`
  - `200`
  - `401`

### 步驟 2：補菜單 API

包含：

- `GET /api/menu`
- `POST /api/menu`
- `PATCH /api/menu/:id`
- `DELETE /api/menu/:id`

要補的內容：

- `response` schema
- 找不到資料時的 `404`
- 建立成功時的 `201`

### 步驟 3：補訂單查詢 API

包含：

- `GET /api/orders`
- `GET /api/orders/current`
- `GET /api/orders/history`
- `GET /api/orders/:id`

這一步最重要的是：

- `query` 已有的要保留
- `response` 補完整
- `403 / 404` 補齊

### 步驟 4：補訂單操作 API

包含：

- `POST /api/orders`
- `PATCH /api/orders/:id`
- `POST /api/orders/:id/submit`

這一步最重要的是：

- `201` 與 `200` 的差異要清楚
- `400 / 403 / 404 / 409` 補齊

---

## 6. 依目前 backend.ts，哪些地方最該先補

以下是目前最值得優先處理的區塊：

### `app.get("/api/menu")`

目前問題：

- 沒有明確 `response`

建議補上：

- `200: ApiDataResponse<MenuItem[]>`

### `app.post("/api/auth/login")`

目前問題：

- 有 `body`
- 但缺完整 `response`

建議補上：

- `200: ApiDataResponse<SafeUser>`
- `401: ApiErrorResponse`

### `app.get("/api/orders")`

目前問題：

- 沒有 `response`

建議補上：

- `200: ApiDataResponse<OrderResponse[]>`

### `app.get("/api/orders/current")`

目前問題：

- 有 `query`
- 缺 `response`

建議補上：

- `200: ApiDataResponse<OrderResponse | null>`
- `404: ApiErrorResponse`

### `app.get("/api/orders/history")`

目前問題：

- 有 `query`
- 缺 `response`

建議補上：

- `200: ApiDataResponse<OrderResponse[]>`
- `404: ApiErrorResponse`

### `app.get("/api/orders/:id")`

目前問題：

- 有 `params`、`query`
- 缺 `response`

建議補上：

- `200: ApiDataResponse<OrderResponse>`
- `403: ApiErrorResponse`
- `404: ApiErrorResponse`

### `app.patch("/api/orders/:id")`

目前問題：

- 有 `body`
- 缺 `params`
- 缺 `response`

建議補上：

- `params`
- `200: ApiDataResponse<OrderResponse>`
- `403 / 404 / 409 / 500: ApiErrorResponse`

### `app.post("/api/orders/:id/submit")`

目前問題：

- 已有 `params` 與 `body`
- 缺 `response`

建議補上：

- `200: ApiDataResponse<OrderResponse>`
- `400 / 403 / 404 / 409 / 500: ApiErrorResponse`

---

## 7. 實作時建議怎麼寫

## 7.0 執行進度：三層架構實踐完成

### ✅ 已完成項目（2025-01 session）

經過逐步重構，已確認以下 API 層 schema 已正確遷移至 route-schemas.ts：

| Schema 名稱              | 原位置       | 新位置           | 狀態    |
| ------------------------ | ------------ | ---------------- | ------- |
| `apiErrorResponseSchema` | contracts.ts | route-schemas.ts | ✅ 已移 |
| `orderResponseSchema`    | contracts.ts | route-schemas.ts | ✅ 已移 |
| `OrderResponse` type     | contracts.ts | route-schemas.ts | ✅ 已移 |
| `ApiErrorResponse` type  | contracts.ts | route-schemas.ts | ✅ 已移 |

**業務層 (contracts.ts) 保留**：

- menuItemSchema、orderSchema、userSchema、sessionUserSchema 等業務實體
- 移除後只剩「業務定義」，0 個 API 層定義

**API 層 (route-schemas.ts) 新增**：

- 所有 Request schema（13 個 body/query/params）
- 所有 Response schema（7 個 envelope）
- 轉換函數 toOrderResponse()
- 錯誤回應 apiErrorResponseSchema

**實施層 (backend.ts) 穩定**：

- 移除所有 inline schema 定義
- 單一入口 import：route-schemas.ts
- 無修改需要

### ✅ 驗證結果

```bash
$ bun run build:backend
Bundled 503 modules in 126ms
backend.js  1.84 MB  (entry point)
✅ 無 TypeScript 錯誤
```

### ✅ 已完成項目（2026-05 session）：User / SessionUser 一次到位分層

本次採用「不留過渡別名」策略，直接完成語意拆分：

1. `contracts.ts` 新增 `userSchema`（完整使用者資料）
2. `sessionUserSchema` 改由 `userSchema.pick({ id, email, name })` 派生
3. 移除 `type User = SessionUser` 別名，避免語意污染
4. 認證層與 API 回應維持 `SessionUser` 最小公開面（不暴露 password）

這樣做的核心價值是：

- **User** 負責「資料主體」與個資欄位
- **SessionUser** 負責「已驗證身份」與 API 傳輸欄位

後續若導入註冊、個資修改、角色權限，只需擴充 `userSchema`，不會衝擊既有 API session 契約。

### ✅ 已完成項目（2026-05 session）：Auth 轉換邊界一致化

為了避免在多個 Auth 實作內重複寫投影邏輯，本次同步完成：

1. Auth 內部快取/資料模型統一使用 `User`
2. 對外 API / 介面統一回傳 `SessionUser`
3. `toSessionUser` 收斂為單一轉換函數（auth/user-mapper.ts）

這個做法可以確保：

- DemoAuth 與 PgAuth 的行為一致
- 未來新增 OAuth / Better Auth adapter 時，仍維持同一條輸出邊界
- 敏感欄位（如 password）不會因程式複製貼上而意外流向 API

---

## 7. 實作時建議怎麼寫

### 做法一：先建立共用 response schema 常數

例如在 `backend.ts` 檔案前段建立：

- `apiErrorResponseSchema`
- `menuItemSchema`
- `orderResponseSchema`

好處：

- 避免每條 route 都重複寫一份
- 之後接 OpenAPI 時也比較乾淨

### 做法二：優先讓 response schema 可讀

如果 schema 太長，可抽成命名常數，不要全塞在 route 內。

原因：

- 這一輪重點是 contract 清楚
- 不是追求一行寫完

### 做法三：不要一次追求 100% 完美抽象

先做到：

- schema 完整
- route 可讀
- 成功與錯誤路徑可被描述

就已經足夠。

---

## 7.1 補充：建立 route-schemas.ts 作為 API Contract 的唯一出口

這一段是進入下一輪維護時很常見的重構點，特別適合在 route schema 補齊後做。

### 為什麼要做

核心想法是**分層清楚，減少協作者的認知負擔**：

1. 前端開發者呼叫 API 時，只需看 `route-schemas.ts` 就能完整理解：
   - 可以發送什麼欄位？（request body/query/params）
   - 會收到什麼格式？（response envelope）
   - 有什麼內部轉換邏輯？（toOrderResponse 等）

2. backend.ts 只專注於業務流程，不應跨層直接依賴 contracts.ts 或包含 schema 宣告

3. 避免「同一個 schema 定義分散在多個檔案」造成的維護困擾

具體來說，當 `backend.ts` 同時包含：

- 路由流程
- middleware
- request schema 宣告（body/query/params）
- response schema 宣告（envelope）
- 轉換函數（toOrderResponse）

檔案會變得冗長且難以閱讀，協作者無法快速定位 API 契約所在。

### 做什麼

建立明確的三層分工，**所有 API 層面的定義都集中到 route-schemas.ts**：

| 檔案層次                          | 職責                    | 範例                                                    |
| --------------------------------- | ----------------------- | ------------------------------------------------------- |
| **contracts.ts（第 1 事實）**     | 業務型別定義            | Order、OrderResponse、MenuItem                          |
|                                   | 核心 schema             | menuItemSchema、orderResponseSchema                     |
| **route-schemas.ts（第 2 事實）** | **Request schema**      | loginBodySchema、createMenuItemBodySchema 等            |
|                                   | **Query/Params schema** | getOrderByIdParamsSchema、getOrderCurrentQuerySchema 等 |
|                                   | **Response schema**     | orderResponseEnvelopeSchema、menuItemResponseSchema 等  |
|                                   | type re-export          | export type { Order, OrderResponse }                    |
|                                   | 業務層 ↔ API 層轉換函數 | toOrderResponse()                                       |
|                                   | 錯誤回應 schema         | apiErrorResponseSchema                                  |
| **backend.ts（路由層）**          | 路由行為                | app.get(), app.post()                                   |
|                                   | **單一入口 import**     | 只從 route-schemas.ts                                   |
|                                   | 業務流程                | 登入驗證、訂單建立等                                    |

### 怎麼做

建議步驟：

1. **在 route-schemas.ts 中定義所有 request/response schema**：
   - 建立清楚的分組註解區隔 Request / Response
   - 使用清晰的命名約定：
     - Request: `{actionVerb}{Resource}{Type}Schema`（例如 `loginBodySchema`、`updateMenuItemParamsSchema`）
     - Response: `{Resource}{ResponseType}Schema`（例如 `orderResponseEnvelopeSchema`、`menuListResponseSchema`）
   - 按 route 路徑分組，方便查找

   範例命名：

   ```ts
   // POST /api/auth/login
   export const loginBodySchema = z.object({ ... });

   // PATCH /api/menu/:id
   export const updateMenuItemParamsSchema = z.object({ ... });
   export const updateMenuItemBodySchema = z.object({ ... });

   // GET /api/orders/:id
   export const getOrderByIdParamsSchema = z.object({ ... });
   export const getOrderByIdQuerySchema = z.object({ ... });
   ```

2. **在 route-schemas.ts 內**：
   - import Order/OrderResponse type 與業務 schema 來自 contracts.ts
   - **定義並 export**：
     - 所有 request schema（body、query、params）
     - 所有 response envelope schema
     - toOrderResponse() 函數
     - apiErrorResponseSchema
   - **re-export** Order、OrderResponse type

3. **在 backend.ts 中**：
   - **移除** z.object() 的任何 inline schema 定義
   - **移除** Order/OrderResponse 的直接 import（改由 route-schemas.ts re-export）
   - **改為** 只從 route-schemas.ts import：
     - 所有 request schema（loginBodySchema 等）
     - 所有 response schema（menuItemResponseSchema 等）
     - toOrderResponse 函數
     - apiErrorResponseSchema

   重點：backend.ts 的 import 區塊應該**清晰且集中**，所有 API 相關的東西都來自 route-schemas.ts：

   ```ts
   import {
     // Request schemas
     loginBodySchema,
     createMenuItemBodySchema,
     updateMenuItemParamsSchema,
     updateMenuItemBodySchema,
     // Response schemas
     loginResponseSchema,
     menuItemResponseSchema,
     // Utilities
     toOrderResponse,
   } from "./shared/route-schemas.ts";
   ```

4. **驗證**：
   - `bun run build:backend` 無錯誤 ✅
   - `bun dev --host` 測試主要 route：
     - `POST /api/auth/login` 驗證 body validation
     - `GET /api/menu` 無 schema
     - `POST /api/orders/:id/submit` 驗證複合 params/body
   - 檔案結構清楚，協作者能快速定位

### 原則

> **route-schemas.ts 是「API 層的單一事實來源」**
>
> - 如果協作者需要理解某條 API 的契約，只需看 route-schemas.ts 一個檔案
> - backend.ts 是流程層，只看 route 的業務邏輯
> - contracts.ts 是業務層，定義最底層的型別與驗證

---

## 8. 這一步做完後會得到什麼

完成後，完成後將得到三個直接收益：

1. route 的輸入輸出邊界變清楚
2. 前端與測試不再只靠口頭默契理解 API
3. 後續做 `Drizzle + Neon` 時，比較能確定自己只是在換資料來源，而不是偷偷改 API

---

## 9. 這一步之後接哪一步

這一輪完成後，下一步不是立刻進 auth，而是：

1. 先導入 OpenAPI / Swagger 輸出
2. 再進入 `Drizzle + Neon`

原因是：

- route schema 補齊後，最自然的下一步就是把 contract 輸出成文件
- 等 contract 與文件層都穩住，再進資料庫重構，風險最低

---

## 10. 使用者管理 API 的設計概念（V9 後階段實作）

> **本節只建立概念，V9 導入 Better Auth 後才實作。**

### 為何現在不做

V9 階段將使用 Better Auth + Google OAuth，登入/登出/session 驗證全部交由 Better Auth 處理。
這意味著：

- 不再需要 `/api/auth/login` 手動驗密碼
- 不再需要應用層自己管理 password hash
- 使用者的「完整資料（User）」由 Better Auth 的資料表負責儲存

因此，使用者 profile 的讀取/修改 API 應在 V9 auth 穩定後才建立，避免設計浪費。

### 應建立的 API 邊界

| API                      | 方法    | 職責                                    | 回傳型別                       |
| ------------------------ | ------- | --------------------------------------- | ------------------------------ |
| `/api/users/me`          | `GET`   | 取得目前登入者的公開 profile            | `SessionUser`（不含 password） |
| `/api/users/me`          | `PATCH` | 更新個人資料（name、birthday、address） | `SessionUser`                  |
| `/api/users/me/password` | `PATCH` | 更換密碼（email/password 模式才需要）   | 僅 `{ ok: true }`              |

> Better Auth + Google OAuth 時，`/api/users/me/password` 可省略（無本地密碼）。

### 分層原則

```
Better Auth DB User（含 emailVerified / image / createdAt 等）
       ↓ toSessionUser()
SessionUser（id / email / name）→ API 對外回傳
```

**API 永遠只回 SessionUser，不回完整 User（不洩漏 password、敏感欄位）。**

這個規則在 `shared/contracts.ts` 的分層中已體現：

- `userSchema`：完整使用者資料模型（業務/資料層，不對外）
- `sessionUserSchema`：API 回傳的最小安全投影

---

## 11. 一句話總結

這份實作清單的目的，不是先改功能，而是先把目前 `backend.ts` 的每一條主要 route 補成真正可驗證、可推導、可輸出的 API contract。

下一份建議接著閱讀：

- [02_2_導入 OpenAPI ／ Swagger 輸出.md](/root/00*nsPrj/01_backEnd/06_elysia/00_demo01/00_teaching/02_2*導入 OpenAPI ／ Swagger 輸出.md:1)
- [03_為什麼這個專案選 Drizzle + Neon.md](/root/00*nsPrj/01_backEnd/06_elysia/00_demo01/00_teaching/03*為什麼這個專案選 Drizzle + Neon.md:1)
