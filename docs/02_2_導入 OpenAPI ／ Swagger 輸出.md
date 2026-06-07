# 導入 OpenAPI ／ Swagger 輸出

建議前置閱讀：

- [02_0_API contract truth 的重要性與實作方式.md](/root/00_nsPrj/01_backEnd/06_elysia/00_demo01/00_teaching/02_0_API contract truth 的重要性與實作方式.md:1)
- [02_1_從目前 backend.ts 補齊 Elysia route schema 的實作步驟清單.md](/root/00*nsPrj/01_backEnd/06_elysia/00_demo01/00_teaching/02_1*從目前 backend.ts 補齊 Elysia route schema 的實作步驟清單.md:1)

這份文件是 API contract 主題的第二個落地步驟。

它建立在兩個前提上：

1. 已經先理解為什麼要有 API contract truth
2. 已經先把 `backend.ts` 的主要 route schema 補齊

也就是說，這份文件不是用來取代 route schema，而是要把：

`已經存在的 route schema，輸出成可閱讀、可測試、可分享的 API 文件。`

---

## 1. 先說結論

在這個專案裡，OpenAPI / Swagger 最適合扮演的角色不是：

- 另一份手寫 contract

而是：

- 從 Elysia route schema 自動輸出的文件層

所以順序應該是：

1. 先補 route schema
2. 再導入 OpenAPI / Swagger
3. 再進 `Drizzle + Neon`
4. 最後再進 `Better Auth`

---

## 2. 為什麼這一步要在資料庫之前做

因為當 route schema 已經補齊後，OpenAPI / Swagger 幾乎是最自然的下一步。

這一步先做，有三個好處：

### 好處一：把 API contract 從「程式內可讀」變成「團隊可讀」

route schema 本身是程式碼層的 truth。  
但不是每位協作者都會直接去看 `backend.ts`。

OpenAPI / Swagger 的價值是讓：

- 開發者
- 前端
- 助教
- 測試人員

都能快速看到目前 API 長什麼樣。

### 好處二：在大重構前先固定一份可觀察的 API 快照

之後當做：

- `Drizzle + Neon`
- `Better Auth`

就更容易對照：

- 哪些 API contract 沒變
- 哪些 API contract 真的有被設計性修改

### 好處三：降低教學心智負荷

可先透過 Swagger UI 理解 API 全貌，再回頭看 `backend.ts`。  
這通常比一開始直接讓在 route 程式中來回跳找資訊更容易進入狀況。

---

## 3. 這一步要達成的功能

最小目標有三個：

1. 專案可輸出 OpenAPI spec
2. 專案可開啟 Swagger UI 頁面
3. 輸出內容會反映目前 route schema

換句話說，這一步不是重新設計 API，而是：

`把既有 contract 變成可視化文件。`

---

## 4. 建議使用的做法

對這個專案而言，最自然的方式是：

- 導入 `@elysiajs/openapi`

原因：

- 它直接建立在 Elysia schema 之上
- 不需要另外維護一份獨立 API 文件
- 很符合本階段「降低心智負荷」的原則

---

## 5. 建議修改哪些檔案

### `package.json`

要改的地方：

- 新增 `@elysiajs/openapi`

背後邏輯：

- OpenAPI / Swagger 輸出屬於後端能力，安裝在根目錄即可

### `backend.ts`

要改的地方：

- 匯入 openapi plugin
- 在 `app` 初始化時註冊 plugin
- 補上基本文件資訊，例如：
  - title
  - version
  - description

背後邏輯：

- 這一步的重點是讓 route schema 被輸出成文件
- 不應再手動維護另一份 Swagger JSON

### `README.md`

要改的地方：

- 補上 Swagger / OpenAPI 的使用方式
- 說明文件頁面在哪裡

背後邏輯：

- 文件功能如果存在，但沒人知道怎麼開，教學價值會打折

---

## 6. 在 backend.ts 內要怎麼放

建議放在：

- `const app = new Elysia();`
- `staticPlugin(...)`

這一段附近一起初始化。

概念上會變成：

1. 建立 app
2. 掛 static plugin
3. 掛 openapi plugin
4. 再宣告 routes

原因：

- 這樣整體初始化順序最清楚
- route 定義之後，openapi plugin 才能完整收集 schema

---

## 7. 導入後要驗證什麼

導入完成後，至少要檢查下面幾點：

### 檢查一：Swagger UI 是否打得開

例如常見路徑會是：

- `/swagger`
- `/openapi`

實際路徑依 plugin 設定為準。

### 檢查二：OpenAPI JSON 是否可讀取

通常會有對應的 JSON spec 路徑。

這很重要，因為未來若要：

- 產生 typed client
- 做 API 測試
- 交給其他工具讀取

都會用到 JSON spec。

### 檢查三：每條主要 route 是否真的有輸出 schema

尤其要看：

- `/api/auth/login`
- `/api/menu`
- `/api/orders`
- `/api/orders/current`
- `/api/orders/history`
- `/api/orders/:id`
- `/api/orders/:id/submit`

如果某些 route 文件資訊不完整，通常不是 openapi plugin 的問題，而是 route schema 還沒補齊。

---

## 8. 這一步最常見的誤區

### 誤區一：把 Swagger 當成 contract source

不建議。

真正的 source 應該是：

- Elysia route schema

Swagger 應該只是輸出。

### 誤區二：route schema 還沒補齊，就急著追 Swagger 頁面漂亮

如果 route schema 本身不完整，Swagger 再漂亮也只是把不完整的 contract 顯示出來而已。

所以優先順序應該永遠是：

- 先 schema
- 再輸出

### 誤區三：把這一步拖到資料庫重構之後

可以做，但不划算。

因為這樣就會少掉一個在重構前觀察 API 邊界的穩定視窗。

---

## 9. 這一步和後面兩步的關係

### 和 `Drizzle + Neon` 的關係

當 OpenAPI / Swagger 已經到位後，做資料庫重構時更容易確定：

- 我現在改的是資料來源
- 不是不小心把 API 契約也一起改了

### 和 `Better Auth` 的關係

等之後進 auth 重構時，Swagger / OpenAPI 也能幫助更清楚看到：

- 哪些 route 因 auth 被調整
- 哪些 query/body 被拿掉
- 哪些 response 形狀改了

---

## 10. 建議的教學順序

若依目前新的主線，最自然的順序是：

1. 先講 API contract truth 為什麼重要
2. 再補 `backend.ts` 的 route schema
3. 再導入 OpenAPI / Swagger 輸出
4. 再開始 `Drizzle + Neon`
5. 最後才是 `Better Auth`

這樣會比較容易理解：

- contract 是什麼
- 為什麼先補 schema
- 為什麼 Swagger 只是輸出，不是來源

---

## 11. 一句話總結

在這個專案裡，OpenAPI / Swagger 最適合扮演的角色不是另一份手寫 API 規格，而是：

`把已經存在的 Elysia route schema，輸出成可閱讀、可分享、可驗證的文件層。`

---

## 12. 自動化檢查與人工 review 的分工

導入 OpenAPI / Swagger 之後，很容易以為：

- 既然文件是自動生成的
- 那只要能生成，就代表品質沒問題

這個想法不夠精確。

更合理的理解是：

- 自動化工具適合做「規格完整性」檢查
- 人工 review 才能做「設計品質」檢查

### 自動化工具擅長檢查什麼

例如：

- OpenAPI JSON 能不能成功生成
- schema 結構是否合法
- `params / query / body / response` 是否存在
- `summary`、`tags` 是否缺漏
- 某些規則是否不一致

這些屬於：

- 結構正確性
- 規則一致性
- 低階、重複、可規則化的問題

### 自動化工具不擅長檢查什麼

例如：

- API 設計本身是否合理
- `summary` 雖然有寫，但是否真的清楚
- 某個錯誤碼是否符合業務語意
- response 欄位雖然合法，但是否冗餘或容易誤解
- 這份文件是否真的適合課堂閱讀

這些屬於：

- 設計判斷
- 命名品質
- 教學可讀性
- 語意品質

這一層仍然需要人工 review。

所以最合理的工作分工是：

1. 先讓工具攔掉結構性錯誤
2. 再由人工 review 檢查設計品質

也就是說，工具不是用來取代人工，而是用來讓人工 review 把注意力放在真正重要的地方。

---

## 13. 如果 review 發現品質不良，要改哪裡

這一點非常重要。

因為 OpenAPI / Swagger 在這個專案裡是「輸出層」，不是 contract source。

所以當 review 發現問題時，通常不應直接去改 Swagger 輸出結果，而是應該回頭改：

- route schema
- route metadata
- 共用資料型別

### 情況一：輸入或輸出 schema 不完整

例如：

- 少了 `query`
- 少了 `response`
- 錯誤回應沒有定義

應修改的地方：

- `backend.ts`

要改的內容：

- 該 route 的 `params / query / body / response`

背後邏輯：

- 這些資訊本來就屬於 route contract 的一部分

### 情況二：文件描述不清楚

例如：

- `summary` 太短
- `description` 看不懂
- `tags` 分類不合理

應修改的地方：

- `backend.ts`

要改的內容：

- 該 route 的 `detail.summary`
- `detail.description`
- `detail.tags`

背後邏輯：

- 這些 metadata 也是從 route 定義輸出到 OpenAPI

### 情況三：資料模型本身命名或欄位不清楚

例如：

- `OrderResponse` 的欄位名稱不夠直觀
- `ApiErrorResponse` 太模糊
- 某些共享型別不適合前後端共用

應修改的地方：

- `shared/contracts.ts`

必要時也可能連動：

- `backend.ts`
- `frontend/src/App.tsx`

背後邏輯：

- 這已經不是文件描述問題，而是資料模型本身的問題

### 情況四：OpenAPI 文件頁本身的標題、版本、說明不清楚

例如：

- API title 不夠明確
- version 沒更新
- 文件整體 description 過於模糊

應修改的地方：

- `backend.ts`

要改的內容：

- `openapi({...})` 內的 `documentation.info`

### 情況五：不知道怎麼使用文件頁

例如：

- 不知道 `/openapi` 在哪
- 不知道 `/openapi/json` 有什麼用

應修改的地方：

- `README.md`
- `00_teaching/02_2_導入 OpenAPI ／ Swagger 輸出.md`

背後邏輯：

- 這不是 contract 問題，而是操作說明與教學說明問題

---

## 14. 一個實務判斷原則

如果 review 發現問題，可以先用這個判斷方式：

### 問題是在「API 真正怎麼運作」嗎？

如果是，改：

- `backend.ts`
- 必要時改 `shared/contracts.ts`

### 問題是在「資料型別命名或模型設計」嗎？

如果是，改：

- `shared/contracts.ts`
- 必要時同步調整前後端使用處

### 問題是在「文件首頁或文件說明」嗎？

如果是，改：

- `backend.ts` 的 openapi config
- 或 `README.md`

### 問題只是在 Swagger UI 顯示結果不好看嗎？

先不要直接去改輸出結果。

應先追問：

- 是 schema 不完整？
- 是 metadata 不完整？
- 還是文件說明不完整？

通常 source 改對了，輸出自然會跟著變好。

---

## 15. 一句補充總結

OpenAPI / Swagger 可以自動生成文件，也可以配合工具做基本檢查；但當 review 發現品質不良時，真正該修改的地方通常不是文件輸出本身，而是：

- `backend.ts` 的 route schema 與 metadata
- `shared/contracts.ts` 的資料模型
- 必要時再補 `README.md` 或講義文件

下一份建議接著閱讀：

- [03_為什麼這個專案選 Drizzle + Neon.md](/root/00*nsPrj/01_backEnd/06_elysia/00_demo01/00_teaching/03*為什麼這個專案選 Drizzle + Neon.md:1)
- [03*1_Drizzle+Neon*註冊與升級實作步驟清單.md](/root/00_nsPrj/01_backEnd/06_elysia/00_demo01/00_teaching/03_1_Drizzle+Neon_註冊與升級實作步驟清單.md:1)
