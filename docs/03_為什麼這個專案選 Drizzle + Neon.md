# 為什麼這個專案選 Drizzle + Neon

建議前置閱讀：

- [02_0_API contract truth 的重要性與實作方式.md](/root/00_nsPrj/01_backEnd/06_elysia/00_demo01/00_teaching/02_0_API contract truth 的重要性與實作方式.md:1)
- [02_2_導入 OpenAPI ／ Swagger 輸出.md](/root/00*nsPrj/01_backEnd/06_elysia/00_demo01/00_teaching/02_2*導入 OpenAPI ／ Swagger 輸出.md:1)

這份講義的目的，是說明這個專案在「從 JSON 檔案升級到正式資料庫架構」時，為什麼決定採用：

- ORM：`Drizzle`
- Serverless PostgreSQL：`Neon`

這不是在說 `Prisma` 或 `Supabase` 不好，而是針對目前這個專案的教學目標、技術脈絡與後續擴充方向，`Drizzle + Neon` 會是更合適的組合。

依目前新的教學順序，這份文件的定位是：

- 先把 API contract truth 的基礎框架補起來
- 先決定資料層升級方案
- 先把資料庫基礎打好
- 後續再接 `Better Auth`

補充：本講義中的服務方案、免費額度與限制，係根據 **2026 年 4 月 16 日** 查到的官方資訊整理。這些方案日後可能調整，因此正式上課前仍應再確認一次官方頁面。

---

## 1. 先說結論

如果這個專案接下來要走的路線是：

- 把 `data/store.json` 換成正式資料庫
- 引進 ORM 與 migration
- 後續再接 `Better Auth`
- 並且使用雲端 Serverless PostgreSQL

那麼最建議的選擇是：

- `Drizzle` 負責資料模型、查詢與 migration
- `Neon` 提供 Serverless PostgreSQL

原因可以濃縮成一句話：

`Drizzle` 比較適合拿來教「資料模型、SQL 與 migration 的真實樣貌」，`Neon` 則是目前最適合教學用途的 Serverless PostgreSQL 免費方案之一。

也就是說，這份文件回答的是：

`在 API contract truth 先就位之後，資料庫這一步為什麼要選 Drizzle + Neon。`

---

## 2. 這次選型的判準是什麼

這個專案不是單純做出功能而已，而是要兼顧教學。因此選型標準不只是「哪個工具最紅」，而是看下面幾件事：

1. 是否容易和目前的 `TypeScript + Elysia` 技術棧整合
2. 是否能支援後續的 `Better Auth`
3. 是否能讓理解資料模型、關聯與 migration
4. 是否不會因平台限制，讓上課時一直卡在冷啟動、額度不足或帳號問題
5. 是否能從教學專案平順走向較正式的系統架構

---

## 3. 為什麼 ORM 選 Drizzle，而不是 Prisma

## 先承認一件事

如果只看「初學者第一次接 ORM，有沒有比較快做出 CRUD」，`Prisma` 的確通常比較容易上手。

這是因為 Prisma 有幾個對新手很友善的特性：

- 有獨立的 `schema.prisma`
- model 語法清楚
- Prisma Client API 體驗一致
- Prisma Studio 很適合展示資料表內容

也就是說，若課程設計上擔心「會不會比較難學」，這個擔心不是沒道理。

但是，這個專案最後仍然比較適合 `Drizzle`，因為本課程要教的不是只有 CRUD，而是更完整的資料層觀念。

---

## 4. Drizzle 比較適合這個專案的原因

### 原因一：它和目前的 TypeScript 專案更一致

`Drizzle` 的 schema、table 定義、query 都直接寫在 TypeScript 裡。

這對目前這個專案很有利，因為專案本來就是：

- `backend.ts`
- `shared/contracts.ts`
- `store/*.ts`

這種以 TypeScript 為主體的結構。

換句話說，不需要先切換到另一套專門的 ORM DSL，再回來理解 TypeScript 程式。整體心智模型比較一致。

官方文件：

- https://orm.drizzle.team/docs/overview
- https://orm.drizzle.team/docs/sql-schema-declaration

### 原因二：它更接近 SQL 與真實資料庫思維

`Drizzle` 常被視為 SQL-first / TypeScript-first 的 ORM。

這代表它不像某些 ORM 會把資料庫細節包得太深，而是讓仍然看得到：

- 欄位型別
- foreign key
- relation
- migration
- SQL 與 schema 之間的對應

這對教學是好事，因為比較容易理解：

- 為什麼需要主鍵
- 為什麼要做 migration
- 為什麼資料表關聯不是憑空出現

如果課程目標是「理解系統如何從 JSON 檔案成長成正式資料庫架構」，那這種透明度反而是優點。

官方文件：

- https://orm.drizzle.team/docs/migrations
- https://orm.drizzle.team/docs/relations

### 原因三：它和 Neon 的整合路徑很直接

本課程已決定使用 Serverless PostgreSQL，而 `Drizzle + Neon` 是一條官方文件明確、案例很多的組合。

官方文件：

- https://orm.drizzle.team/docs/get-started/neon-new
- https://orm.drizzle.team/docs/get-started-postgresql

這表示在教學時，不需要花太多力氣去處理「這個 ORM 與這個 serverless driver 到底是不是最佳搭配」的額外不確定性。

### 原因四：後續接 Better Auth 比較自然

後面若要接 `Better Auth`，本質上需要的是：

- 正式資料庫
- migration
- user / account / session 類資料表

`Drizzle` 本來就很適合和這種「schema 漸進擴充」的情境搭配。

對這個專案來說，資料層先用 `Drizzle` 整理好，後面接 auth 會比現在的 JSON store 乾淨很多。

---

## 5. 那 Prisma 的優勢在哪裡

雖然本專案不選 Prisma，但仍應該知道 Prisma 的優點。

### 優點一：初學者通常更快進入狀況

Prisma 的 model 定義與 client 體驗，對很多開發者來說比 SQL-first 風格更容易接受。

官方文件：

- https://www.prisma.io/docs/orm/prisma-schema/overview
- https://www.prisma.io/docs/orm/overview/introduction/what-is-prisma

### 優點二：Prisma Studio 很適合教學展示

在課堂上直接打開資料表內容、看 relation 與資料列，非常方便。

### 優點三：若課程只重視應用層 CRUD，學習阻力可能較小

如果這門課的目標是「快速做出後端 API」，而不是強調資料庫與 migration 的細節，那 Prisma 會是很有競爭力的選項。

---

## 6. 這個專案為什麼最後沒有選 Prisma

不是因為 Prisma 不好，而是因為它不完全符合這個專案此刻最重要的教學目標。

這個專案目前正要從：

- JSON 檔案儲存
- 自製 store

進入：

- 正式資料表
- migration
- 雲端 PostgreSQL
- 後續接 Better Auth

在這個過程中，讓更接近資料庫本體與 SQL 思維，比讓先得到一個很順手的 ORM API，更有長期價值。

因此不是「Drizzle 比 Prisma 簡單」，而是：

`Drizzle 更適合拿來教這個階段該學的東西。`

---

## 7. 怎麼回應「會不會學不起來」這個擔心

這個擔心是合理的，但可以透過教學設計解掉，而不一定需要改選 Prisma。

比較精確地說：

- `Prisma` 比較會幫使用者把很多細節藏起來
- `Drizzle` 則比較要求開發者知道自己在定義什麼

所以真正的問題不是 `Drizzle` 太難，而是：

### 是否已先搭好鷹架

例如可以先提供：

- 已建好的 schema 檔
- 已寫好的 migration script
- 一兩個完整 CRUD 範例
- `menu`、`orders`、`order_items` 的資料表對照圖

只要這些基礎鷹架先存在，其實不需要從零硬背 Drizzle API，而是沿著既有範例修改。

所以我的判斷是：

`這個擔心有道理，但不足以成為放棄 Drizzle 的理由。`

---

## 8. 為什麼資料庫服務選 Neon，而不是其他雲端 PostgreSQL

本課程已確定採用：

- PostgreSQL
- 雲端
- Serverless

在這個前提下，`Neon` 是目前最適合這個專案教學場景的首選。

---

## 9. Neon 適合教學的原因

### 原因一：它本來就是以 Serverless Postgres 為核心定位

Neon 的產品定位很清楚，就是把 PostgreSQL 做成適合現代雲端與 serverless 環境使用的形式。

官方文件：

- https://neon.com/docs/introduction/serverless

這和本課程目前的需求非常吻合，不需要再額外解釋太多平台轉譯邏輯。

### 原因二：免費方案對教學 demo 通常夠用

根據 2026 年 4 月 16 日查到的官方定價頁，Neon 免費方案重點包括：

- `0.5 GB` 儲存空間
- `100 CU hours`
- 可建立多個 project
- 免信用卡即可開始

對這個早餐店專案來說，這種資料量綽綽有餘。

官方頁面：

- https://neon.com/pricing

### 原因三：和 Drizzle 的文件與社群脈絡很順

這一點對教學非常重要。

如果 ORM 與 DB 平台本來就是常見搭配，課程中會少掉很多「奇怪的整合問題」。

Drizzle 官方本身就直接提供 Neon 起手式，這會降低教學摩擦。

### 原因四：冷啟動存在，但通常還在可接受範圍

Neon free plan 的 compute 會自動 scale to zero。

這代表閒置一段時間後，第一次查詢會有喚醒延遲。但 Neon 官方文件對這件事有明確說明，而且這種延遲通常仍在教學 demo 可以接受的範圍。

官方文件：

- https://neon.com/docs/introduction/compute-lifecycle
- https://neon.com/docs/introduction/scale-to-zero

---

## 10. Neon 的代價是什麼

選 Neon 不是沒有代價，主要是下面幾點：

### 代價一：有冷啟動

如果資料庫閒置後被暫停，第一個請求不會像本機資料庫那樣立即回應。

### 代價二：免費方案不是給高負載正式服務用

雖然教學與 demo 足夠，但不應把 free plan 當成高可用正式環境。

### 代價三：課堂示範時要提醒「第一次慢是正常現象」

這點不難處理，但最好先說明，避免誤以為程式寫壞。

---

## 11. 為什麼不是 Supabase

`Supabase` 當然也很好，而且它本身也是建立在 PostgreSQL 之上。

官方文件：

- https://supabase.com/docs/guides/database/overview

但在這個專案裡，Supabase 有兩個教學上的問題。

### 原因一：它太完整，反而容易分散焦點

Supabase 不只是資料庫，還包含：

- Auth
- Storage
- Realtime
- Edge Functions

如果這門課後面要教的是 `Better Auth`，那就很容易搞混：

- 目前用的是 Supabase Auth 嗎？
- 還是 Better Auth？
- 哪個才是登入系統主體？

對教學來說，工具越完整，不一定越好；有時反而會讓主線變模糊。

### 原因二：免費方案限制對長期教學專案不一定最友善

依 2026 年 4 月 16 日查到的官方資訊，Supabase Free 有幾個要注意的點：

- 只允許少量 active free projects
- 資料庫超過免費上限會進入限制狀態
- 低活動專案可能被 pause

官方頁面：

- https://supabase.com/docs/guides/platform/billing-on-supabase
- https://supabase.com/docs/guides/platform/database-size

這不代表 Supabase 不能教學，而是若課堂當前只想專注在：

- PostgreSQL
- ORM
- 後續 Better Auth

那 `Supabase` 會比 `Neon` 多出一些不必要的背景設定與概念干擾。

---

## 12. 為什麼不是 Render Postgres

`Render` 的 free PostgreSQL 的確可以用，但對教學主線不太理想。

根據官方文件，Render free Postgres 的重點限制包括：

- 只有 `1 GB`
- free database `30 天後會過期`
- 不支援 backup

官方頁面：

- https://render.com/docs/free

其中最麻煩的不是容量，而是：

`30 天過期`

這對課堂作業、助教驗收、學期中反覆重開專案都不太友善。

---

## 13. 如果之後要接 Better Auth，Drizzle + Neon 的好處是什麼

當資料層先升級成：

- PostgreSQL
- Drizzle schema
- migration

之後要接 Better Auth 時，會比較順的原因是：

1. 已經有正式資料庫，不需要再另外補 auth storage
2. 已經有 migration 流程，新增 auth tables 比較自然
3. 可清楚區分：
   - 業務資料表
   - auth 相關資料表
4. 系統不再依賴 JSON 檔與示範帳密資料

也就是說，`Drizzle + Neon` 不只是為了現在能查資料，更是為了替後面的 auth 架構鋪路。

---

## 14. 這個決策最適合怎麼教

如果要在課堂上講這個決策，最適合強調的不是「哪個工具比較潮」，而是：

### 第一個重點

工具選型要看「這一階段要教什麼」。

如果這一階段要教的是：

- 資料表
- 關聯
- migration
- 真實資料庫

那麼 `Drizzle` 會比只追求 CRUD 舒適度更適合。

### 第二個重點

平台選型要看「免費方案會不會妨礙教學」。

`Neon` 的優點不是功能最多，而是：

- 免費額度夠 demo
- 和 Serverless Postgres 主題一致
- 與 Drizzle 整合自然

### 第三個重點

現在選 `Drizzle + Neon`，不是終點，而是為後面的 `Better Auth` 與正式系統架構鋪路。

換句話說，這份文件是新的「第二步」，而不是 auth 討論的附屬補充。

---

## 15. 一句話總結

如果這個專案下一步要從 JSON store 走向正式資料庫，並準備後續接 Better Auth，那麼：

`Drizzle` 最適合拿來教資料模型與 migration，`Neon` 最適合拿來提供教學用的 Serverless PostgreSQL 環境。

接下來才會進入下一份文件，也就是：資料庫升級完成後，如何再導入 `Better Auth + Google provider`。

建議接著閱讀：

- [03*1_Drizzle+Neon*註冊與升級實作步驟清單.md](/root/00_nsPrj/01_backEnd/06_elysia/00_demo01/00_teaching/03_1_Drizzle+Neon_註冊與升級實作步驟清單.md:1)
- [04_Elysia + Better Auth + Google provider 實作步驟清單.md](/root/00_nsPrj/01_backEnd/06_elysia/00_demo01/00_teaching/04_Elysia + Better Auth + Google provider 實作步驟清單.md:1)
