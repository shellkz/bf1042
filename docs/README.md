# `00_teaching` 講義閱讀索引

本資料夾收錄的是本專案的課堂講義、版本說明與補充文件。  
建議不要直接照檔名字面順序亂讀，而是依照下面的主線閱讀。

---

## 1. 主線閱讀順序

若是第一次閱讀這組教材，建議依序閱讀：

1. [00\_專案迭代講義.md](/root/00_nsPrj/01_backEnd/06_elysia/00_demo01/00_teaching/00_專案迭代講義.md:1)
   用來理解整個專案從 V1 到 V9 的版本脈絡與演進理由。

2. [01\_版本閱讀指南.md](/root/00_nsPrj/01_backEnd/06_elysia/00_demo01/00_teaching/01_版本閱讀指南.md:1)
   用來理解這個專案如何對照不同版本快照檔，避免讀 code 時迷路。

3. [01\_前端分離開發、整合進後端的作法.md](/root/00_nsPrj/01_backEnd/06_elysia/00_demo01/00_teaching/01_前端分離開發、整合進後端的作法.md:1)
   用來理解本專案目前的前後端開發與部署方式。

4. [02_0_API contract truth 的重要性與實作方式.md](/root/00_nsPrj/01_backEnd/06_elysia/00_demo01/00_teaching/02_0_API contract truth 的重要性與實作方式.md:1)
   進入 API contract 主題，理解為什麼要先固定 API 邊界。

5. [02_1_從目前 backend.ts 補齊 Elysia route schema 的實作步驟清單.md](/root/00*nsPrj/01_backEnd/06_elysia/00_demo01/00_teaching/02_1*從目前 backend.ts 補齊 Elysia route schema 的實作步驟清單.md:1)
   把 API contract truth 真正落到 route schema。

6. [02_4_Schema一致性設計\_Zod與Drizzle多層架構.md](./02_4_Schema一致性設計_Zod與Drizzle多層架構.md)
   解決 schema 散落三個地方的問題；討論為什麼 Drizzle schema 不該是 API contract 的 single source，以及如何用 Zod 統一業務層定義。

7. [02_2_導入 OpenAPI ／ Swagger 輸出.md](/root/00*nsPrj/01_backEnd/06_elysia/00_demo01/00_teaching/02_2*導入 OpenAPI ／ Swagger 輸出.md:1)
   把 route schema 輸出成可閱讀、可驗證的 API 文件。

8. [02*3_V7_Render*首次部署教案手冊.md](/root/00_nsPrj/01_backEnd/06_elysia/00_demo01/00_teaching/02_3_V7_Render_首次部署教案手冊.md:1)
   在 V7 結尾先完成第一次 Render 部署，建立平台操作感與驗證習慣。

9. [02*3_V7_Render*首次部署教案手冊.md](/root/00_nsPrj/01_backEnd/06_elysia/00_demo01/00_teaching/02_3_V7_Render_首次部署教案手冊.md:1)
   在 V7 結尾先完成第一次 Render 部署，建立平台操作感與驗證習慣。

10. [03_為什麼這個專案選 Drizzle + Neon.md](/root/00*nsPrj/01_backEnd/06_elysia/00_demo01/00_teaching/03*為什麼這個專案選 Drizzle + Neon.md:1)
    說明為什麼資料層升級選擇 `Drizzle + Neon`。

11. [03*1_Drizzle+Neon*註冊與升級實作步驟清單.md](/root/00_nsPrj/01_backEnd/06_elysia/00_demo01/00_teaching/03_1_Drizzle+Neon_註冊與升級實作步驟清單.md:1)
    正式進入 V8 的資料庫升級實作。

12. [03*2_V8*合併主線與*Render*最小部署*CI_CD*教案手冊.md](/root/00_nsPrj/01_backEnd/06_elysia/00_demo01/00_teaching/03_2_V8_合併主線與_Render_最小部署_CI_CD_教案手冊.md:1)
    在 V8 完成後，補講「相對 V7 多了哪些部署調整」，並建立 V8 的主線治理與 CI/CD。

13. [03*3_GitHub_PR*模板與審查清單.md](/root/00_nsPrj/01_backEnd/06_elysia/00_demo01/00_teaching/03_3_GitHub_PR_模板與審查清單.md:1)
    提供課堂可直接套用的 PR 描述格式與審查流程。

14. [03*4_V8*合併與部署\_課堂評分Rubric.md](/root/00_nsPrj/01_backEnd/06_elysia/00_demo01/00_teaching/03_4_V8_合併與部署_課堂評分Rubric.md:1)
    提供助教評分標準，讓流程能力與 V8 的部署調整結果都可量化評估。

15. [04_Elysia + Better Auth + Google provider 實作步驟清單.md](/root/00_nsPrj/01_backEnd/06_elysia/00_demo01/00_teaching/04_Elysia + Better Auth + Google provider 實作步驟清單.md:1)
    當 V8 完成後，再進入 V9 的 auth 升級；完成後也應再補一次本版部署調整。

16. [04*5_V9_BetterAuth*導入建置計畫.md](./04_5_V9_BetterAuth_導入前置確認與實作步驟草案.md)
    在 feat/v8-clean-drizzle-neon-v2 的地基確認後，V9 導入 Better Auth 的完整建置計畫。包含總導入原則、Phase 0–6 分階段說明（為什麼／做什麼／怎麼做）、三方對齊檢查表、驗收矩陣與 rollback 預案。確認計畫後才進入實作。

---

## 2. 補充閱讀

以下文件偏向特定版本或特定問題的補充說明：

- [90*V3_normalizeMenuItem*相容舊資料說明.md](/root/00_nsPrj/01_backEnd/06_elysia/00_demo01/00_teaching/90_V3_normalizeMenuItem_相容舊資料說明.md:1)
  補充 V3 中 `normalizeMenuItem()` 的相容舊資料設計。

- [91*V5_V6*差異與決策說明.md](/root/00_nsPrj/01_backEnd/06_elysia/00_demo01/00_teaching/91_V5_V6_差異與決策說明.md:1)
  補充 V5 與 V6 的差異與教學決策邏輯。

---

## 3. 封存與導向

- [02_2_導入 OpenAPI ／ Swagger 輸出_01.md](/root/00*nsPrj/01_backEnd/06_elysia/00_demo01/00_teaching/02_2*導入 OpenAPI ／ Swagger 輸出*01.md:1)
  這是舊副本保留用的封存導向頁，正式內容請以 `02_2*導入 OpenAPI ／ Swagger 輸出.md` 為準。

---

## 4. 使用建議

1. 若是第一次接觸本專案，先看「主線閱讀順序」。
2. 若是要回頭查某一版為什麼這樣改，再看補充閱讀。
3. 若是從舊連結跳到帶 `_01` 的檔案，先確認它是不是封存頁。

---

## 5. 設計決策索引（快速查找）

以下是本課程中重複出現的核心決策，可跨講義查找：

| 決策主題                                      | 對應講義             |
| --------------------------------------------- | -------------------- |
| API contract single source of truth           | `02_0`               |
| 型別語意精確（SessionUser）與三層同步策略     | `02_0` § 3-1、3-2    |
| **Schema 一致性：Zod vs Drizzle 多層架構**    | **`02_4`**           |
| **為什麼 Drizzle 不該是 API contract source** | **`02_4` § 2**       |
| **正確的三層分工：Business / API / DB 層**    | **`02_4` § 3**       |
| 新舊 V7 架構對照與五大決策原則                | `04_2`               |
| 後端設計品質決定前端能做什麼                  | `04_2` § 7           |
| V7→V8→V9 升級路徑與實作紀錄                   | `04_1`               |
| 切新 branch 做改造（feat/v8-namespace 策略）  | `04_1` 實作紀錄 #004 |

---

## 6. 分支管理策略（Branch Strategy）

本專案的分支設計原則：

> **`main` = 完全測試通過、可信任的穩定狀態**

| 分支          | 語意                                          |
| ------------- | --------------------------------------------- |
| `main`        | 通過驗證的里程碑版本，學生 clone 後可直接使用 |
| `feat/*`      | 進行中的改造，不保證穩定                      |
| `v7-baseline` | 封存的舊 V7 快照，教學用對照                  |

工作流程：在 `feat/*` 上開發 → 確認功能完整、型別正確、build 成功 → PR → merge 回 `main`。

**為什麼要切新 branch 做每次改造**（以 `feat/v8-namespace` 為例）：

1. 保留「改造前」對照點，學生可 diff 看到最小改動
2. 改造過程透明，可回滾，可做 PR review
3. 改造步驟本身就是教材，diff = 實作說明書
