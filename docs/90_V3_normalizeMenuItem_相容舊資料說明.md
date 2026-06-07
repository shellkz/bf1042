# V3 `normalizeMenuItem()` 相容舊資料說明

本文件屬於補充講義，建議搭配下列主線講義一起閱讀：

- [00_專案迭代講義.md](/root/00_nsPrj/01_backEnd/06_elysia/00_demo01/00_teaching/00_專案迭代講義.md:1)
- [01_版本閱讀指南.md](/root/00_nsPrj/01_backEnd/06_elysia/00_demo01/00_teaching/01_版本閱讀指南.md:1)

本文以 `00_專案迭代講義` 中定義的 `V3 菜單內容升級版` 為準，對應檔案是：

- `backend_03.ts`
- `shared/contracts_02.ts`
- `store/Store_02.ts`
- `store/json/JsonFileStore_02.ts`

## 1. 先說明這一版的版本定位

`V3` 的目標不是增加新的點餐流程，而是把原本偏示範型的菜單資料模型，升級成更適合前端商品展示的內容模型。

在 `V2` 以前，菜單資料重點是：

- 有 `name`
- 有 `price`
- 有 `category`

這樣的資料夠做 API 示範，也夠完成基本點餐功能，但不夠支撐較完整的前端畫面。因為只靠這三個欄位，前端很難做出像商品卡片那樣的介面。

所以 `V3` 要解的問題是：

- 菜單需要描述文字
- 菜單需要圖片網址
- 既有 JSON 舊資料仍然要能讀

這就是 `normalizeMenuItem()` 出現的背景。

## 2. V3 到底改了哪些欄位

在講義版本對應中，`MenuItem` 看的是 [contracts_02.ts](/root/00_nsPrj/01_backEnd/06_elysia/00_demo01/shared/contracts_02.ts:1)。

```ts
export interface MenuItem {
  id: number;
  name: string;
  price: number;
  category: string;
  description: string;
  image_url: string;
}
```

和前一版相比，V3 新增了：

- `description`
- `image_url`

這兩個欄位的意義很明確：

- `description` 讓前端能顯示商品說明
- `image_url` 讓前端能顯示商品圖片

所以這一版不只是「多兩個屬性」，而是資料模型從後端示範型資料，往商品展示型資料前進。

## 3. 為什麼需要 `normalizeMenuItem()`

問題在於舊資料檔不會自動跟著升級。

假設 V2 時期的舊資料可能長這樣：

```json
{
  "id": 1,
  "name": "蛋餅",
  "price": 30,
  "category": "主食"
}
```

但 V3 要求的 `MenuItem` 已經變成：

```json
{
  "id": 1,
  "name": "蛋餅",
  "price": 30,
  "category": "主食",
  "description": "...",
  "image_url": "..."
}
```

如果系統直接把舊資料當成新資料來用，會產生幾個問題：

- `description` 是 `undefined`
- `image_url` 是 `undefined`
- 回傳給前端的資料形狀不一致
- 前端每個畫面都要額外判斷欄位是否存在

因此 V3 的策略不是強迫所有舊 JSON 手動重建，而是在 store 初始化時先把舊資料補齊，再交給系統後續流程使用。

## 4. `normalizeMenuItem()` 的實作

在 [JsonFileStore_02.ts](/root/00_nsPrj/01_backEnd/06_elysia/00_demo01/store/json/JsonFileStore_02.ts:65) 中，`normalizeMenuItem()` 長這樣：

```ts
function normalizeMenuItem(item: Partial<MenuItem>): MenuItem {
  return {
    id: item.id ?? 0,
    name: item.name ?? "",
    price: item.price ?? 0,
    category: item.category ?? "",
    description: item.description ?? "",
    image_url: item.image_url ?? "",
  };
}
```

這段實作可以拆成三層理解。

### 4.1 為什麼參數型別是 `Partial<MenuItem>`

因為輸入資料可能是舊版 JSON，不保證欄位完整。

`Partial<MenuItem>` 的意思是：

- 這個物件可以缺少某些欄位
- 呼叫者可以傳入不完整的 `MenuItem`

這非常符合 V3 的需求，因為它就是要接住舊資料。

如果這裡寫成：

```ts
function normalizeMenuItem(item: MenuItem): MenuItem
```

就失去相容舊資料的意義了，因為那代表進來之前資料就已經必須完整。

### 4.2 為什麼回傳型別是完整 `MenuItem`

這個函式的目的不是只做檢查，而是要把輸入轉成系統內部統一可用的標準資料。

也就是說，它的責任是：

- 接收不完整資料
- 補上缺少欄位
- 回傳完整結構

這樣後面的 store、API、前端都可以假設拿到的是完整 `MenuItem`。

### 4.3 為什麼用 `??`

例如：

```ts
description: item.description ?? ""
```

這裡用的是 nullish coalescing，而不是 `||`。

原因是：

- `??` 只在值是 `null` 或 `undefined` 時補預設值
- `||` 會把空字串、`0` 也視為假值一起覆蓋

對資料正規化來說，`??` 更精準。

## 5. V3 中 `normalizeMenuItem()` 兼容了哪些資料

### 5.1 舊版 `menu` 裡缺少新欄位的資料

例如舊版：

```json
{
  "id": 1,
  "name": "蛋餅",
  "price": 30,
  "category": "主食"
}
```

經過 `normalizeMenuItem()` 之後，記憶體內會變成：

```json
{
  "id": 1,
  "name": "蛋餅",
  "price": 30,
  "category": "主食",
  "description": "",
  "image_url": ""
}
```

### 5.2 舊版 `orders[].items[].item` 裡的菜單快照

這一點比 `menu` 主表更容易被忽略。

訂單裡面存的不是只有 `itemId`，而是整個 `MenuItem` 快照。所以就算把 `menu` 主表補齊，如果訂單內嵌的 `item` 還是舊格式，`GET /api/orders` 一樣會回傳不完整資料。

V3 的實作有處理這件事，這是正確的設計。

## 6. `normalizeMenuItem()` 的呼叫過程

這一段是整份說明的核心。下面用講義的 V3 映射來描述。

## 6.1 後端啟動前會先做 `store.init()`

在 [backend_03.ts](/root/00_nsPrj/01_backEnd/06_elysia/00_demo01/backend_03.ts:210)：

```ts
await store.init();
```

也就是說，資料相容不是等 API 被呼叫時才做，而是在 server 啟動前先處理。

## 6.2 `init()` 會讀取 JSON 檔案

在 [JsonFileStore_02.ts](/root/00_nsPrj/01_backEnd/06_elysia/00_demo01/store/json/JsonFileStore_02.ts:89) 開始：

```ts
const file = Bun.file(this.dataFilePath);
```

接著：

```ts
const rawText = await file.text();
const parsed = JSON.parse(rawText) as Partial<DataStore>;
```

這時候拿到的 `parsed` 仍然可能包含舊格式資料。

## 6.3 先檢查最外層結構是否合法

```ts
if (!Array.isArray(parsed.menu) || !Array.isArray(parsed.orders)) {
  throw new Error("Invalid store schema");
}
```

這一步只保證：

- `parsed.menu` 是陣列
- `parsed.orders` 是陣列

真正把欄位補齊的工作，還沒開始，下一步才是 `normalizeMenuItem()` 的責任。

## 6.4 載入 `menu` 時逐筆呼叫 `normalizeMenuItem()`

在 [JsonFileStore_02.ts](/root/00_nsPrj/01_backEnd/06_elysia/00_demo01/store/json/JsonFileStore_02.ts:107)：

```ts
menu: parsed.menu.map((item) => normalizeMenuItem(item)),
```

流程可以理解成：

```txt
parsed.menu 裡的每一筆舊資料
-> normalizeMenuItem(item)
-> 補成完整 MenuItem
-> 放進新的 menu 陣列
```

這樣 `this.menu` 裡的資料，在進入 store 記憶體之前，就已經是完整格式。

## 6.5 載入 `orders` 時，也對內嵌的 `orderItem.item` 呼叫一次

在 [JsonFileStore_02.ts](/root/00_nsPrj/01_backEnd/06_elysia/00_demo01/store/json/JsonFileStore_02.ts:109) 到 [113](/root/00_nsPrj/01_backEnd/06_elysia/00_demo01/store/json/JsonFileStore_02.ts:109)：

```ts
orders: parsed.orders.map((order) => ({
  ...order,
  items: order.items.map((orderItem) => ({
    ...orderItem,
    item: normalizeMenuItem(orderItem.item),
  })),
})),
```

這代表：

- 每筆訂單都會被走訪
- 每筆訂單裡的每個 `orderItem` 都會被走訪
- `orderItem.item` 再被交給 `normalizeMenuItem()`

流程如下：

```txt
parsed.orders
-> 每個 order
-> order.items
-> 每個 orderItem.item
-> normalizeMenuItem(orderItem.item)
-> 補成完整 MenuItem
```

這樣 `GET /api/orders` 才不會回傳一半新格式、一半舊格式的資料。

## 6.6 正規化完成後，才交給 `applyStore()`

整包資料會傳進：

```ts
this.applyStore({
  menu: ...,
  orders: ...,
  menuIdCounter: parsed.menuIdCounter ?? 0,
  orderIdCounter: parsed.orderIdCounter ?? 0,
});
```

也就是說，真正放進 store 記憶體裡的資料，已經不是原始 JSON，而是補齊過的新版本資料。

## 6.7 後續 API 路由直接使用這份已正規化的資料

例如在 [backend_03.ts](/root/00_nsPrj/01_backEnd/06_elysia/00_demo01/backend_03.ts:60)：

```ts
app.get("/api/menu", () => ({ data: store.getMenu() }));
```

在 [backend_03.ts](/root/00_nsPrj/01_backEnd/06_elysia/00_demo01/backend_03.ts:128)：

```ts
app.get("/api/orders", () => ({
  data: store.getOrders().map(toOrderResponse),
}));
```

因為相容舊資料的工作已經在 `init()` 做完，所以 API 層不用再重複處理欄位缺失。

## 7. `backend_03.ts`、`Store_02.ts` 在這版扮演什麼角色

### 7.1 `backend_03.ts`

這一版的後端路由 schema 已經接受新的欄位。

例如建立菜單時，在 [backend_03.ts](/root/00_nsPrj/01_backEnd/06_elysia/00_demo01/backend_03.ts:70) 到 [76](/root/00_nsPrj/01_backEnd/06_elysia/00_demo01/backend_03.ts:70)：

```ts
body: t.Object({
  name: t.String({ minLength: 1 }),
  price: t.Integer({ minimum: 0 }),
  category: t.String({ minLength: 1 }),
  description: t.String({ minLength: 1 }),
  image_url: t.String({ minLength: 1 }),
}),
```

這代表 V3 不只資料檔升級，連 API 請求格式也一起升級。

### 7.2 `Store_02.ts`

在 [Store_02.ts](/root/00_nsPrj/01_backEnd/06_elysia/00_demo01/store/Store_02.ts:10) 之後，`createMenuItem()` 和 `updateMenuItem()` 的介面也已經納入：

- `description`
- `image_url`

也就是說，V3 的升級不是單點修改，而是：

- contract 升級
- store interface 升級
- JSON store 升級
- backend route schema 升級

這才是完整版本迭代。

## 8. `normalizeMenuItem()` 的設計價值

這個函式的價值，不只是「補空字串」。

它真正的價值是把相容舊資料的責任集中在資料載入邊界，而不是把這個負擔散落到整個系統。

如果沒有它，後面很多地方都會被迫寫防守邏輯：

- 前端顯示圖片前要先判斷 `image_url`
- 前端顯示描述前要先判斷 `description`
- API 回傳前可能還要再清洗一次資料

有了 `normalizeMenuItem()` 之後，系統只要在初始化階段做一次補齊，後面就都能假設 `MenuItem` 是完整的。

這是非常典型的「把資料遷移與相容性處理集中在邊界」的做法。

## 9. 這一版還有一個重要搭配：預設菜單內容升級

在 [JsonFileStore_02.ts](/root/00_nsPrj/01_backEnd/06_elysia/00_demo01/store/json/JsonFileStore_02.ts:16) 開始的 `defaultMenu` 裡，可以看到預設資料不再只是：

- 品名
- 價格
- 分類

而是已經帶有：

- `description`
- `image_url`

這代表 V3 不只修改型別，也同步升級範例資料，讓系統在沒有既有資料檔時，初始化就能直接產生適合展示的菜單內容。

## 10. 需要注意的一個現況

若直接看 repo 目前未加版本後綴的正式入口，會發現有些 import 並沒有完全和講義的版本檔案一一綁定。

例如：

- `backend_03.ts` 目前 import 的是未加後綴的 `./shared/contracts.ts`
- `Store_02.ts` 目前 import 的也是未加後綴的 `../shared/contracts.ts`

這表示專案中的版本檔，比較像是「保留下來的演進快照」，而不是每一版都能獨立直接執行的完全隔離分支。

但若按照 `00_專案迭代講義` 的版本定義來理解，`V3` 要講的重點仍然是這一組：

- `backend_03.ts`
- `shared/contracts_02.ts`
- `store/Store_02.ts`
- `store/json/JsonFileStore_02.ts`

而 `normalizeMenuItem()` 的確應該以 `JsonFileStore_02.ts` 為準來說明。

## 11. 總結

在講義定義的 `V3` 裡，`normalizeMenuItem()` 的角色可以一句話概括：

> 它是在 JSON store 讀取舊資料時，把不完整的舊版 `MenuItem` 補齊成新版完整 `MenuItem` 的資料升級函式。

它的呼叫流程是：

```txt
backend_03.ts
-> store.init()
-> JsonFileStore_02.init()
-> JSON.parse()
-> parsed.menu.map(normalizeMenuItem)
-> parsed.orders[].items[].item 也呼叫 normalizeMenuItem
-> applyStore()
-> store.getMenu() / store.getOrders()
-> API 回傳完整新格式資料
```

所以這個函式的核心價值不只是補欄位，而是讓 V3 可以在「擴充資料模型」的同時，又不會因為舊資料格式不足而讓系統中斷。
