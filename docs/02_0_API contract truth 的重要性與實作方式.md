# API contract truth 的重要性與實作方式

建議前置閱讀：

- [00_專案迭代講義.md](/root/00_nsPrj/01_backEnd/06_elysia/00_demo01/00_teaching/00_專案迭代講義.md:1)
- [01_版本閱讀指南.md](/root/00_nsPrj/01_backEnd/06_elysia/00_demo01/00_teaching/01_版本閱讀指南.md:1)

這份講義要處理的問題是：

在這個專案裡，我們已經有一個很重要的 single source of truth，也就是 `shared/contracts.ts`。  
它負責讓前後端共享資料模型，例如：

- `MenuItem`
- `Order`
- `User`

但這還不夠。

因為真實系統除了要定義「資料物件長什麼樣」，還要定義：

- API 路徑是什麼
- 用 `GET`、`POST`、`PATCH` 還是 `DELETE`
- `params` 長什麼樣
- `query` 長什麼樣
- `body` 長什麼樣
- `response` 長什麼樣
- 哪些 status code 合法

這一層，就是 `API contract`。

因此，這份文件的核心主張是：

`在進入 Drizzle + Neon 的資料庫重構之前，應先把 API contract truth 的基礎框架補起來。`

---

## 1. 先說結論

對這個專案來說，最合理的順序不是：

- 先大改資料庫
- 之後才慢慢補 API contract

而是：

1. 先把 Elysia route schema 補齊
2. 讓 route schema 成為 API contract truth
3. 之後再輸出成 OpenAPI / Swagger 文件
4. 再進入 `Drizzle + Neon` 重構
5. 最後再接 `Better Auth`

原因很簡單：

`API contract truth` 不是額外加分項，而是後續重構時的護欄。

---

## 2. 為什麼這一步要先做

目前這個專案雖然已經有：

- `shared/contracts.ts`
- Elysia route
- 前後端分離

但在 API contract 這一層，仍然不夠完整。

原因是目前很多 route 只做到：

- 有路徑
- 有部分 `body` 或 `query` 驗證

但還沒有把整個 API contract 系統化成：

- `params`
- `query`
- `body`
- `response`
- 錯誤回應

都可被明確驗證與推導的狀態。

這會造成幾個問題：

### 問題一：前後端對 API 的理解容易靠默契維持

只靠人腦記住：

- `/api/orders/current` 要不要帶 query
- `/api/orders/:id` response 到底長怎樣
- 錯誤時回傳什麼格式

這在版本少時還能撐，但一旦開始重構資料層，就會很容易出錯。

### 問題二：重構資料來源時，API 形狀容易偷偷改掉

當把底層從：

- `JsonFileStore`

改成：

- `Drizzle + PostgreSQL`

如果 route 沒有完整 schema，常見狀況就是：

- 某個欄位名稱被改了
- 某個欄位型別變了
- 某個錯誤回應不一致

結果是資料庫雖然換成功了，但 API contract 卻變得不穩定。

### 問題三：Swagger 若太晚加，會變成事後補文件

若等到整輪重構快結束，才補 OpenAPI / Swagger，往往會變成：

- 先寫 API
- 再補文件

這樣 Swagger 就只是展示頁，而不是 contract 的自然輸出。

---

## 3. `shared/contracts.ts` 和 API contract truth 差在哪裡

這兩者很像，但不能混為一談。

### `shared/contracts.ts`

負責的是：

- 領域資料模型
- 前後端共享型別

例如：

- `MenuItem`
- `Order`
- `OrderResponse`

它回答的是：

`這個資料物件長什麼樣。`

### API contract truth

負責的是：

- HTTP 介面規格
- request / response 規格
- route 輸入輸出約束

它回答的是：

- 哪一條 API 存在
- 要怎麼呼叫
- 允許哪些輸入
- 會回哪些輸出

它回答的是：

`這個 API 要怎麼被正確地使用。`

所以，兩者的關係不是互相取代，而是：

- `shared/contracts.ts` 是資料模型 truth
- `Elysia route schema` 是 API contract truth

---

## 4. 為什麼 Elysia route schema 最適合當 API contract truth

在 Elysia 裡，最自然的做法不是另外維護一份獨立 contract 文件，而是：

`直接把 route schema 當成 API contract 的實作來源。`

也就是在 route 上定義：

- `params`
- `query`
- `body`
- `headers`
- `response`

這樣的好處是：

### 好處一：同一份定義同時服務三件事

1. runtime validation
2. TypeScript type inference
3. OpenAPI schema generation

這正是降低心智負荷最重要的地方：

`不要維護三份不同但看起來很像的規格。`

### 好處二：它比手寫 Swagger 更接近真實執行行為

因為 route schema 不是展示文件，而是實際參與執行的規則。

也就是說，它不是「寫給人看」而已，而是：

- request 進來時會被驗證
- response 形狀可以被限制
- 型別可以直接推導給前端或測試程式

### 好處三：對重構最友善

之後若改用：

- store
- ORM
- database
- auth

都可以盡量不動 contract，或至少知道自己動到了哪裡。

---

## 5. 文件層和實作層應如何分工

這一點非常重要。

### 文件層

文件層適合使用：

- OpenAPI
- Swagger UI

它的角色是：

- 給人閱讀
- 給測試與整合工具使用
- 給前端或第三方快速理解 API

### 實作層

實作層真正的 contract source 應該是：

- Elysia route schema

也就是說：

- Swagger 是 contract 的輸出
- route schema 才是 contract 的來源

這樣的分工才不會讓文件與實作逐漸分離。

---

## 6. 這個專案現階段最低成本的落地做法

如果以降低心智負荷為目標，這個階段不需要一次把所有工具都導入。

最務實的做法是：

### 第一步：先把 route schema 補齊

至少讓每一條主要 API 都明確定義：

- `params`
- `query`
- `body`
- `response`

這一步做完，其實就已經建立了 80% 的 API contract truth 基礎。

### 第二步：讓錯誤回應格式也一致

例如：

- `404`
- `400`
- `401`
- `403`
- `409`

都盡量回到一致的 `ApiErrorResponse`

這樣前端與測試程式更容易處理。

### 第三步：之後再接 OpenAPI / Swagger

等 route schema 足夠完整後，再把它輸出成文件。

這樣 Swagger 才會是「從 contract 生成」，而不是一份補寫的說明頁。

---

## 7. 為什麼這一步要排在 Drizzle + Neon 之前

這是這份講義最重要的結論。

因為接下來資料庫重構會改動很多東西：

- 查詢邏輯
- repository / store 實作
- 資料來源
- 部分欄位型別
- 錯誤處理

如果在這之前沒有先把 API contract 穩住，就很容易出現：

- 底層換掉了
- 前端也壞了
- 但到底是資料庫問題、ORM 問題，還是 API shape 問題，不容易分清楚

換句話說：

`API contract truth 先補起來，能把後面的重構邊界切得更清楚。`

它讓知道：

- 哪些變更只是資料層重構
- 哪些變更真的改到了 API 契約

這正是穩定成長的關鍵。

---

## 8. 這一步最適合怎麼教

如果要拿來上課，這一版很適合強調：

### 第一個重點

共享資料型別不等於完整 API 契約。

`shared/contracts.ts` 很重要，但它只解決了「物件長什麼樣」，還沒完整解決「API 怎麼互動」。

### 第二個重點

contract 最好要能同時服務：

- 文件
- 驗證
- 型別推導

而不是三套各寫各的。

### 第三個重點

真正降低心智負荷，不是少寫東西，而是減少重複維護。

route schema 的價值就在這裡。

---

## 9. 建議的實作順序

若依目前新的教學主線，最建議的順序是：

1. 先把 Elysia route schema 補齊
2. 讓 route schema 成為 API contract truth
3. 再導入 OpenAPI / Swagger 輸出
4. 再做 `Drizzle + Neon` 資料庫升級
5. 最後再做 `Better Auth + Google provider`

這樣的順序有一個很大的好處：

- 每一步都在降低下一步的混亂度

而不是：

- 每一步都把新的複雜度疊上去

---

## 10. 一句話總結

在這個專案裡，`shared/contracts.ts` 解決的是資料模型一致性；而在進入 `Drizzle + Neon` 之前，還要先補上另一個 single source of truth，也就是：

`以 Elysia route schema 為核心的 API contract truth。`

下一份建議接著閱讀：

- [02_1_從目前 backend.ts 補齊 Elysia route schema 的實作步驟清單.md](/root/00_nsPrj/01_backEnd/06_elysia/00_demo01/00_teaching/02_1_從目前 backend.ts 補齊 Elysia route schema 的實作步驟清單.md:1)
