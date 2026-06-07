// index.ts - 早餐店 API 使用 Bun.serve routes 寫法
import toTaipeiDateTime, {
  TAIPEI_TIME_ZONE,
  taipeiDateTimeFormatter,
} from "../util";
import { z } from "zod";

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

const patchOrderBodySchema = z.object({
  itemId: z.number().int().positive(),
  qty: z.number().int().nonnegative(),
});

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

// 請求記錄函數
function logRequest(req: Request) {
  console.log(
    `[${toTaipeiDateTime(new Date().toISOString())}] ${req.method} ${new URL(req.url).pathname}`,
  );
}

// 創建服務器，使用 routes 物件
const server = Bun.serve({
  port,
  hostname: host,
  routes: {
    "/": {
      GET: (req) => {
        logRequest(req);
        return new Response("Welcome to Bun!");
      },
    },
    "/api/menu": {
      GET: (req) => {
        logRequest(req);
        return Response.json({ data: menu });
      },
    },
    "/api/orders": {
      GET: (req) => {
        logRequest(req);
        return Response.json({ data: orders.map(toOrderResponse) });
      },
      POST: (req) => {
        logRequest(req);
        const newOrder: Order = {
          id: ++orderIdCounter,
          items: [],
          total: 0,
          status: "pending",
          createdAt: new Date().toISOString(),
        };
        orders.push(newOrder);
        return Response.json(
          { data: toOrderResponse(newOrder) },
          { status: 201 },
        );
      },
    },
    "/api/orders/:id": {
      GET: (req) => {
        logRequest(req);
        const orderId = parseInt(req.params.id);
        const order = orders.find((o) => o.id === orderId);

        if (!order) {
          return Response.json({ error: "Order not found" }, { status: 404 });
        }
        return Response.json({ data: toOrderResponse(order) });
      },
      PATCH: async (req) => {
        // 先確認訂單是否存在，找不到就直接回傳 404。
        logRequest(req);
        const orderId = parseInt(req.params.id);
        const order = orders.find((o) => o.id === orderId);

        if (!order) {
          return Response.json({ error: "Order not found" }, { status: 404 });
        }

        // 解析 request body，若不是合法 JSON 就回傳 400。
        let rawBody: unknown;
        try {
          rawBody = await req.json();
        } catch {
          return Response.json({ error: "Invalid JSON body" }, { status: 400 });
        }

        // 用 zod 在同一個 schema 中同時驗證結構與數值條件。
        const parsedBody = patchOrderBodySchema.safeParse(rawBody);
        if (!parsedBody.success) {
          return Response.json(
            {
              error:
                "itemId must be a positive integer and qty must be a non-negative integer",
            },
            { status: 400 },
          );
        }
        const { itemId, qty } = parsedBody.data;

        // 先確認該菜單項目存在於 menu 中，否則無法新增或更新。
        const menuItem = menu.find((m) => m.id === itemId);
        if (!menuItem) {
          return Response.json(
            { error: "Menu item not found" },
            { status: 404 },
          );
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
            return Response.json(
              { error: "Order item not found" },
              { status: 500 },
            );
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

        return Response.json({ data: toOrderResponse(order) });
      },
    },
    "/health": {
      GET: (req) => {
        logRequest(req);
        return Response.json({ status: "ok" });
      },
    },
  },
  // 當沒有匹配的路由時，fallback 處理
  fetch(req) {
    logRequest(req);
    return Response.json({ error: "Not found" }, { status: 404 });
  },
});

console.log(`🍳 早餐店 API 運行在 http://${host}:${port}`);
console.log(`📋 菜單: http://${host}:${port}/api/menu`);
console.log(`📦 訂單: http://${host}:${port}/api/orders`);
