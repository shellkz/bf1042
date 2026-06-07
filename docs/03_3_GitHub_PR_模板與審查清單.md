# GitHub PR 模板與審查清單

本附件提供課堂可直接套用的 PR 模板。目標是讓在合併前同時完成技術審查與業務確認。

---

## 1. 為什麼要用 PR 模板

### 背後邏輯

- 避免 PR 內容寫得太隨意，導致 reviewer 難以判斷風險
- 讓每次合併都有可追蹤的驗證證據
- 把 PM/PO 核可納入流程，不只看程式可執行

### 要做什麼

每個 `feature/* -> main` PR，都使用同一份模板，填滿必要欄位後才可申請 merge。

---

## 2. 課堂版 PR 模板（可直接貼到 PR 描述）

```md
## 一、變更摘要（What）

- 本次要解決的問題：
- 本次主要變更：

## 二、為什麼現在要做（Why now）

- 目前限制：
- 若不處理的風險：

## 三、影響範圍（Impact）

- 影響 API：
- 影響資料表 / migration：
- 影響前端頁面：
- 可能破壞相容性：有 / 無（請說明）

## 四、驗證證據（Validation）

- build 結果：
- 測試結果：
- 手動驗證路徑：
- 截圖或 API 回應：

## 五、部署與回滾（Release）

- 部署前必要設定（env/secrets）：
- 是否需先跑 migration：
- 回滾方式：

## 六、合併前核可（Approval Gate）

- [ ] Reviewer approve（技術）
- [ ] PM/PO approve（業務）
- [ ] CI 全綠
```

---

## 3. Reviewer 審查清單

### 背後邏輯

審查不是找語法小錯，而是判斷「合併後主線是否仍可穩定部署」。

### 要做什麼

Reviewer 依序檢查：

1. 需求有被完整實作，且範圍合理
2. 變更不破壞既有 API 契約
3. migration 與資料相容風險可控
4. 驗證證據足夠，不是口頭保證
5. 回滾方式明確

---

## 4. PM/PO 核可清單

### 背後邏輯

技術正確不等於商務可上線。PM/PO 要確認的是功能是否符合教學章節目標與產品需求。

### 要做什麼

PM/PO 至少確認：

1. 功能符合當前版本目標（此處為 V8）
2. 不會影響下一節教學主線（V9）
3. 對外行為與講義描述一致
4. 上線風險可接受

---

## 5. 何時可以按下 Merge

只有三項同時成立才可 merge：

1. 技術 reviewer 已 approve
2. PM/PO 已確認可上線
3. CI 狀態全綠

若任一項未完成，PR 仍維持 open。

---

## 6. GitHub PR 通知說明（「Compare & pull request」）

### 現象

當你把新分支 push 到 GitHub 時，repo 首頁會出現通知：

```
feat/v8-clean-drizzle-neon had recent pushes 11 minutes ago
[Compare & pull request]
```

### 這是什麼意思

GitHub 自動偵測到：

- 新分支有最近的 commit
- 它與 default branch（`main`）有差異

GitHub 的設計是主動提醒：「這個分支與主線不同，你可能想要建立 **PR** 來檢視差異或合併。」

### 這不是錯誤

這是 GitHub 正常的協作機制，鼓勵 Code Review 流程。在團隊開發中很有用，但在個人專案可以忽視。

### 讓通知消失的方式

| 方式            | 說明                                                  | 適用情況                      |
| --------------- | ----------------------------------------------------- | ----------------------------- |
| **什麼都不做**  | 幾天後自動消失（GitHub 只保留最近活動的通知）         | ✅ 推薦（開發中的分支用）     |
| **建立 PR**     | 點「Compare & pull request」開 PR                     | 準備好做 code review 或合併時 |
| **刪除分支**    | `git push origin --delete feat/v8-clean-drizzle-neon` | 不需要保留時                  |
| **合併到 main** | 在 PR 裡 merge                                        | 功能完成且通過檢視時          |

### 目前推薦做法（開發階段）

如果分支仍在開發中（如 `feat/v8-clean-drizzle-neon` 尚未完成）：

**推薦：什麼都不做。** GitHub 會自動在幾天後收起通知。當功能完成且準備好合併時，才建立 PR 進行正式 code review 與合併。
