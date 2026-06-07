# PostgreSQL Namespace（Schema）隔離：為什麼、做什麼、怎麼做

> **本文適用範圍（雙軌）**
>
> | 脈絡                        | 問題                                                               | 解法                                      |
> | --------------------------- | ------------------------------------------------------------------ | ----------------------------------------- |
> | 歷史參考：舊 V8 → 舊 V9     | 舊 V9 (Better Auth) 改動了 DB，舊 V8 壞掉                          | 用 `v8_legacy` namespace 讓舊 V8 獨立存活 |
> | **主教學線：新 V8 → 新 V9** | **新 V9 (Better Auth) 會在同一個 DB 新增資料表，可能與新 V8 衝突** | **用 namespace 把應用表與 Auth 表分開**   |
>
> 兩個情境，同一個解法。理解「為什麼需要 namespace」，就能預見並提前處理版本升級時的衝突。

---

## 0. 先理解：PostgreSQL 的 Schema（Namespace）是什麼

### 概念

PostgreSQL 的 **schema** 是資料庫內部的命名空間（namespace）。  
一個資料庫可以有多個 schema，每個 schema 裡可以有自己獨立的資料表、view、函式，彼此不互相干擾。

```
Neon 資料庫（同一個 DB）
├── public/              ← 預設 schema（namespace）
│   ├── users
│   ├── orders
│   └── menu_items
├── app/                 ← 自訂 schema（namespace）
│   ├── users
│   ├── orders
│   └── menu_items
└── auth/                ← Better Auth 專用 schema（namespace）
    ├── user
    ├── session
    ├── account
    └── verification
```

> **重點：** `public.users` 和 `app.users` 是兩張完全不同的表，即使名字相同也不衝突。

### 與其他概念對比

| 概念                | 類比             |
| ------------------- | ---------------- |
| PostgreSQL database | 整棟大樓         |
| PostgreSQL schema   | 大樓裡的各個房間 |
| 資料表（table）     | 房間裡的傢俱     |

不指定 schema 時，PostgreSQL 預設使用 `public`。所以大多數初學者的所有表都在 `public` 裡，這正是版本衝突的根源。

---

## 1. 為什麼要做（Why）

### 問題根源：多個版本共用同一個 `public` schema

當你在新 V8 建好下列資料表：

```sql
-- public schema（預設）
public.users       -- 應用的使用者
public.orders      -- 訂單
public.menu_items  -- 菜單
```

接著新 V9 導入 **Better Auth**，Better Auth 在初始化時會自動在資料庫建立自己所需的資料表：

```sql
-- Better Auth 預設也建在 public schema
public.user           -- Better Auth 的使用者表（名稱與你的 users 接近）
public.session        -- Better Auth 的 session 管理
public.account        -- OAuth 綁定帳號
public.verification   -- 驗證 token
```

這時會產生兩種問題：

**問題 A：命名衝突**  
Better Auth 的 `user` 表和你的 `users` 表只差一個 `s`，但語意完全不同，容易混淆查詢。

**問題 B：職責混用**  
應用資料（訂單、菜單）和身分驗證資料（session、OAuth）全部堆在 `public`，難以分辨哪些表屬於哪個系統，也讓未來的 migration 充滿風險。

**問題 C：版本升級破壞舊版**（歷史脈絡：舊 V8 → 舊 V9）  
舊 V9 改動 DB 結構後，舊 V8 依賴的表被破壞，導致舊 V8 無法正常啟動。

> **一句話總結：** 沒有 namespace 隔離，不同版本/不同系統的資料表全部擠在 `public`，升級一個版本就可能破壞另一個版本。

---

## 2. 做什麼（What）

### 核心策略：用 PostgreSQL schema 做命名空間隔離

把不同責任的資料表放進不同的 schema：

```
Neon 資料庫
├── public/（預設，盡量不放業務表）
├── app/（或 v8_legacy/）  ← 應用自己的業務表
│   ├── users
│   ├── orders
│   ├── menu_items
│   └── order_items
└── auth/（可選）           ← Better Auth 專用
    ├── user
    ├── session
    ├── account
    └── verification
```

### 對應到兩個教學脈絡

| 脈絡                    | 應用表放在           | Auth 表放在                  | 用途                       |
| ----------------------- | -------------------- | ---------------------------- | -------------------------- |
| 歷史：舊 V8 隔離        | `v8_legacy`          | `public`（Better Auth 預設） | 讓舊 V8 恢復可運行         |
| **主線：新 V8 → 新 V9** | `app`（或 `public`） | `auth`（Better Auth 指定）   | 提前隔離，避免未來升級衝突 |

### Drizzle 中如何指定 schema

在 Drizzle 定義資料表時，只需在 `pgTable` 第一個參數前加上 `pgSchema`：

```typescript
// 定義 namespace
import { pgSchema } from "drizzle-orm/pg-core";
const appSchema = pgSchema("app");

// 在 namespace 下建立表
export const users = appSchema.table("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  // ...
});
```

Better Auth 也提供設定，可以指定它建表的目標 schema：

```typescript
// Better Auth 設定（新 V9）
const auth = betterAuth({
  database: { ... },
  // 指定 Better Auth 把 auth 相關表建在 auth schema
  databaseSchema: "auth",
});
```

---

## 3. 怎麼做（How）

### 情境 A：歷史參考 — 舊 V8 從舊 V9 的破壞中恢復

#### A-1. 建立舊 V8 專用表

使用初始化腳本，在 `v8_legacy` namespace 下建立資料表：

```bash
bun run v8:db:setup
```

腳本對應：`scripts/setup-v8-legacy-db.ts`

#### A-2. 啟動舊 V8 入口

```bash
PORT=3010 V8_DB_SCHEMA=v8_legacy bun run dev:v8
```

- `PORT=3010`：避免與主線 3000 衝突
- `V8_DB_SCHEMA=v8_legacy`：指定舊 V8 使用哪個 namespace

#### A-3. 最小 smoke test

```bash
curl -s http://localhost:3010/health
curl -s -X POST http://localhost:3010/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@example.com","password":"1234"}'
curl -s "http://localhost:3010/api/menu"
```

---

### 情境 B：主教學線 — 新 V8 → 新 V9 的正確做法

#### B-1. 新 V8 建表時就指定 schema（提前規劃）

在 `legacy/v8/db/schema.ts`（或主線的 Drizzle schema 檔）：

```typescript
import { pgSchema, text, serial } from "drizzle-orm/pg-core";

// 應用表放在 "app" namespace
const appSchema = pgSchema("app");

export const users = appSchema.table("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
});

export const orders = appSchema.table("orders", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  // ...
});
```

#### B-2. drizzle.config.ts 指定 schema

```typescript
// drizzle.config.ts
export default defineConfig({
  schema: "./db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! },
  // 確保 migration 只操作 app schema
  schemaFilter: ["app"],
});
```

#### B-3. 新 V9 導入 Better Auth 時，指定 auth schema

```typescript
// auth/index.ts（新 V9）
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    // Better Auth 的表建在 auth namespace
    schema: { usersTable: authSchema.table(...) },
  }),
});
```

#### B-4. 環境變數管理 namespace 名稱

```bash
# .env
DATABASE_URL=postgresql://...
APP_DB_SCHEMA=app      # 應用業務表的 namespace
AUTH_DB_SCHEMA=auth    # Better Auth 的 namespace
```

---

## 4. 設計決策重點

### 為什麼不全部放 `public`？

`public` 是 PostgreSQL 的預設 schema，所有工具（Better Auth、Drizzle、直接 psql）預設都寫 `public`。  
當多個系統共用同一個 DB，`public` 很快就會變成「萬物混雜的垃圾桶」，命名衝突、職責不清、升級破壞——都是後果。

### 為什麼不用多個資料庫？

Neon free tier 只有一個資料庫，無法建多個 DB。  
即使可以建，schema 隔離在同一個 DB 內就能達成目的，不需要額外的連線管理成本。

### 為什麼舊 V8 維持 `userId:number`，不改成 string？

舊 V8 保持原始設計，作為教學對照：

- 新 V7 以後改用 `userId:string`（補零 ID，如 `"0001"`）
- 兩者並列，學生可以清楚看到「身分識別型別的演進」

---

## 5. 教學收益總結

這份改造適合教學示範三件事：

1. **版本與資料庫不同步時**，如何用最小破壞恢復可運行狀態。
2. **PostgreSQL namespace 的通用價值**：不論是多版本並行、還是引入第三方 Auth，都適用同一套隔離思路。
3. **為什麼架構分層**（入口、store、contract、schema）能大幅降低升級風險：改一個版本，不會炸掉另一個版本。

> **跨版本通用原則：**  
> 只要「同一個 Neon DB」被「多個版本或多個系統」共用，就應該考慮 PostgreSQL namespace 隔離。  
> 新 V8 → 新 V9 面對的是同一個問題，用同一個解法。

---

## 6. 常見誤區

1. 直接用舊 V8 程式連現有 V9 表。
2. 在同一個 port 同時跑多個版本後端。
3. 以為 `ENOENT` 或執行中斷碼（137/143）一定是業務邏輯錯誤。

建議口訣：

`先隔離（schema/port）再驗證（smoke test），最後才談邏輯修補。`
