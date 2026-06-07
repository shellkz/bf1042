// index.ts - 早餐店 API 使用 Elysia 寫法
import { Elysia, t } from "elysia";
import toTaipeiDateTime, {
  TAIPEI_TIME_ZONE,
  taipeiDateTimeFormatter,
} from "../util";

// 定義類型
interface MenuItem {
  id: number;
  name: string;
  price: number;
  category: string;
}

interface OrderItem {
  item: MenuItem;
  qty: number;
}

interface Order {
  id: number;
  items: OrderItem[];
  total: number;
  status: string;
  createdAt: string;
}

interface OrderResponse extends Order {
  createdAtTaipei: string;
}

// 模擬數據
const menu: MenuItem[] = [
  { id: 1, name: "蛋餅", price: 30, category: "主食" },
  { id: 2, name: "鮮奶茶", price: 50, category: "飲料" },
  { id: 3, name: "蔥油餅", price: 25, category: "主食" },
  { id: 4, name: "豆漿", price: 20, category: "飲料" },
];

const orders: Order[] = [];
let orderIdCounter = 0;

function toOrderResponse(order: Order): OrderResponse {
  return {
    ...order,
    createdAtTaipei: toTaipeiDateTime(order.createdAt),
  };
}

// 根據訂單內目前所有品項與數量，重新計算整張訂單的總金額。
function calculateOrderTotal(items: OrderItem[]): number {
  return items.reduce((sum, orderItem) => {
    return sum + orderItem.item.price * orderItem.qty;
  }, 0);
}

// 從環境變量獲取配置
const port = parseInt(process.env.PORT || "3000");
const host = process.env.HOST || "localhost";

// 創建 Elysia 應用
const app = new Elysia();

// 請求記錄中間件
app.onRequest(({ request }) => {
  console.log(
    `[${toTaipeiDateTime(new Date().toISOString())}] ${request.method} ${new URL(request.url).pathname}`,
  );
});

// 根路由
app.get("/", () => new Response("Welcome to Bun!"));

// 菜單路由
app.get("/api/menu", () => ({ data: menu }));
app.put(
  "/api/menu",
  ({ body, set }) => {
    const newMenuItem: MenuItem = {
      id: Math.max(0, ...menu.map((item) => item.id)) + 1,
      name: body.name,
      price: body.price,
      category: body.category,
    };

    menu.push(newMenuItem);
    set.status = 201;
    return { data: newMenuItem };
  },
  {
    body: t.Object({
      name: t.String({ minLength: 1 }),
      price: t.Number({ minimum: 0 }),
      category: t.String({ minLength: 1 }),
    }),
  },
);

app.patch(
  "/api/menu/:id",
  ({ params, body, set }) => {
    const menuId = parseInt(params.id);
    if (Number.isNaN(menuId)) {
      set.status = 400;
      return { error: "Invalid menu id" };
    }

    const menuItem = menu.find((item) => item.id === menuId);
    if (!menuItem) {
      set.status = 404;
      return { error: "Menu item not found" };
    }

    menuItem.name = body.name ?? menuItem.name;
    menuItem.price = body.price ?? menuItem.price;
    menuItem.category = body.category ?? menuItem.category;

    return { data: menuItem };
  },
  {
    body: t.Object({
      name: t.Optional(t.String({ minLength: 1 })),
      price: t.Optional(t.Number({ minimum: 0 })),
      category: t.Optional(t.String({ minLength: 1 })),
    }),
  },
);

app.delete("/api/menu/:id", ({ params, set }) => {
  const menuId = parseInt(params.id);
  if (Number.isNaN(menuId)) {
    set.status = 400;
    return { error: "Invalid menu id" };
  }

  const targetIndex = menu.findIndex((item) => item.id === menuId);
  if (targetIndex === -1) {
    set.status = 404;
    return { error: "Menu item not found" };
  }

  const [deletedItem] = menu.splice(targetIndex, 1);
  return { data: deletedItem };
});

// 訂單列表路由
app.get("/api/orders", () => ({ data: orders.map(toOrderResponse) }));

// 創建新訂單
app.post(
  "/api/orders",
  () => {
    const newOrder: Order = {
      id: ++orderIdCounter,
      items: [],
      total: 0,
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    orders.push(newOrder);
    return { data: toOrderResponse(newOrder) };
  },
  { response: { status: 201 } },
);

// 獲取單筆訂單
app.get("/api/orders/:id", ({ params, set }) => {
  const orderId = parseInt(params.id);
  const order = orders.find((o) => o.id === orderId);

  if (!order) {
    set.status = 404;
    return { error: "Order not found" };
  }
  return { data: toOrderResponse(order) };
});

// 更新訂單項目
app.patch(
  "/api/orders/:id",
  async ({ params, body, set }) => {
    // 先確認訂單是否存在，找不到就直接回傳 404。
    const orderId = parseInt(params.id);
    const order = orders.find((o) => o.id === orderId);

    if (!order) {
      set.status = 404;
      return { error: "Order not found" };
    }

    // body 已由 Elysia 自動驗證，直接解構使用
    const { itemId, qty } = body;

    // 先確認該菜單項目存在於 menu 中，否則無法新增或更新。
    const menuItem = menu.find((m) => m.id === itemId);
    if (!menuItem) {
      set.status = 404;
      return { error: "Menu item not found" };
    }

    // 透過 itemId 尋找訂單中是否已有相同菜單。
    const existingItemIndex = order.items.findIndex(
      (orderItem) => orderItem.item.id === itemId,
    );

    // 已存在的品項改成新的 qty；若 qty 為 0 就從訂單中刪除。
    if (existingItemIndex !== -1) {
      // 先取出既有訂單項目，讓 TypeScript 能確認這筆資料不是 undefined。
      const existingOrderItem = order.items[existingItemIndex];

      if (!existingOrderItem) {
        set.status = 500;
        return { error: "Order item not found" };
      }

      if (qty === 0) {
        order.items.splice(existingItemIndex, 1);
      } else {
        existingOrderItem.qty = qty;
      }
    } else if (qty > 0) {
      // 原本不存在的品項，且 qty 大於 0，則新增一筆訂單明細。
      order.items.push({ item: menuItem, qty });
    }

    // 不論是新增、修改或刪除，都依最新 items 重新計算 total。
    order.total = calculateOrderTotal(order.items);

    return { data: toOrderResponse(order) };
  },
  {
    body: t.Object({
      itemId: t.Integer({ minimum: 1 }),
      qty: t.Integer({ minimum: 0 }),
    }),
  },
);

// 健康檢查路由
app.get("/health", () => ({ status: "ok" }));

// 全局錯誤處理
app.onError(({ error, set, code }) => {
  // 處理 Elysia 驗證錯誤
  if (code === "VALIDATION") {
    set.status = 400;
    return {
      error: "Validation failed",
      message:
        "itemId must be a positive integer and qty must be a non-negative integer",
    };
  }

  // 其他未知錯誤
  set.status = 500;
  return { error: "Internal server error" };
});

// 啟動服務器
app.listen(port, () => {
  console.log(`🍳 早餐店 API 運行在 http://${host}:${port}`);
  console.log(`📋 菜單: http://${host}:${port}/api/menu`);
  console.log(`📦 訂單: http://${host}:${port}/api/orders`);
});
