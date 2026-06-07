import { useEffect, useState, useMemo } from "react";
import "./App.css";
import type {
  ApiDataResponse,
  MenuItem,
  Order,
  SessionUser,
} from "../../shared/contracts.ts";

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

function buildApiUrl(path: string) {
  return `${apiBaseUrl}${path}`;
}

export default function App() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [authError, setAuthError] = useState("");
  const [isGoogleSigningIn, setIsGoogleSigningIn] = useState(false);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [orderId, setOrderId] = useState<number | null>(null);
  const [historyOrders, setHistoryOrders] = useState<Order[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [cartQtyByItemId, setCartQtyByItemId] = useState<
    Record<number, number>
  >({});
  const [cartTotal, setCartTotal] = useState(0);
  const [activeItemId, setActiveItemId] = useState<number | null>(null);
  const [actionError, setActionError] = useState("");
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isClearingCart, setIsClearingCart] = useState(false);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);

  type RatingState = { stars: number; comment: string; submitted: boolean; error: string };
  const [ratingByOrderId, setRatingByOrderId] = useState<Record<number, RatingState>>({});
  type DailyReport = { date: string; totalOrders: number; totalRevenue: number; topItems: { name: string; totalQty: number; totalRevenue: number }[] };
  const [report, setReport] = useState<DailyReport | null>(null);
  const [reportDate, setReportDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState("");
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [allOrdersLoading, setAllOrdersLoading] = useState(false);
  const [markReadyError, setMarkReadyError] = useState("");
  const [callOrderError, setCallOrderError] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminRoles, setAdminRoles] = useState<string[]>(["customer"]);
  const [adminRoleLoading, setAdminRoleLoading] = useState(false);
  const [adminRoleError, setAdminRoleError] = useState("");
  const [adminRoleSuccess, setAdminRoleSuccess] = useState("");

  // 有員工角色且無 admin：只顯示工作面板，隱藏菜單/購物車/訂單歷史
  const isWorkerOnly =
    user !== null &&
    !user.roles.includes("admin") &&
    (user.roles.includes("chef") ||
      user.roles.includes("staff") ||
      user.roles.includes("owner"));

  function syncCartFromOrder(order: Order) {
    const nextQtyByItemId = order.items.reduce(
      (acc, orderItem) => {
        acc[orderItem.item.id] = orderItem.qty;
        return acc;
      },
      {} as Record<number, number>,
    );

    setCartQtyByItemId(nextQtyByItemId);
    setCartTotal(order.total);
  }

  function resetCartState() {
    setOrderId(null);
    setCartQtyByItemId({});
    setCartTotal(0);
    setIsCartOpen(false);
  }

  async function loadCurrentOrder(): Promise<Order | null> {
    const response = await fetch(buildApiUrl("/api/orders/current"), {
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error(`Load current order failed: HTTP ${response.status}`);
    }

    const payload = (await response.json()) as ApiDataResponse<Order | null>;
    const currentOrder = payload?.data;

    if (!currentOrder) {
      resetCartState();
      return null;
    }

    setOrderId(currentOrder.id);
    syncCartFromOrder(currentOrder);
    return currentOrder;
  }

  async function loadOrderHistory(): Promise<void> {
    setHistoryLoading(true);

    try {
      const response = await fetch(buildApiUrl("/api/orders/history"), {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(`Load history failed: HTTP ${response.status}`);
      }

      const payload = (await response.json()) as ApiDataResponse<Order[]>;
      const orders = Array.isArray(payload?.data) ? payload.data : [];
      setHistoryOrders(orders);

      // 載入每筆訂單的已存評分
      const results = await Promise.allSettled(
        orders.map(async (order) => {
          const res = await fetch(buildApiUrl(`/api/orders/${order.id}/rating`), {
            credentials: "include",
          });
          if (!res.ok) return null;
          const data = (await res.json()) as { data?: { stars: number; comment?: string | null } | null };
          return data?.data ? { orderId: order.id, stars: data.data.stars, comment: data.data.comment ?? "" } : null;
        }),
      );

      const preloaded: Record<number, RatingState> = {};
      for (const r of results) {
        if (r.status === "fulfilled" && r.value) {
          preloaded[r.value.orderId] = { stars: r.value.stars, comment: r.value.comment, submitted: true, error: "" };
        }
      }
      setRatingByOrderId(preloaded);
    } finally {
      setHistoryLoading(false);
    }
  }

  async function fetchReport(date: string): Promise<void> {
    setReportLoading(true);
    setReportError("");
    try {
      const res = await fetch(buildApiUrl(`/api/reports/daily?date=${date}`), { credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { data: DailyReport };
      setReport(data.data);
    } catch {
      setReportError("報表載入失敗，請稍後再試");
    } finally {
      setReportLoading(false);
    }
  }

  async function loadAllOrders(): Promise<void> {
    setAllOrdersLoading(true);
    try {
      const res = await fetch(buildApiUrl("/api/orders"), { credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const payload = (await res.json()) as ApiDataResponse<Order[]>;
      setAllOrders(Array.isArray(payload?.data) ? payload.data : []);
    } finally {
      setAllOrdersLoading(false);
    }
  }

  async function callOrder(orderId: number): Promise<void> {
    setCallOrderError("");
    try {
      const res = await fetch(buildApiUrl(`/api/orders/${orderId}/call`), {
        method: "PATCH",
        credentials: "include",
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setCallOrderError(body.error ?? `叫號失敗（HTTP ${res.status}）`);
        return;
      }
      await loadAllOrders();
    } catch {
      setCallOrderError("網路錯誤，請稍後再試");
    }
  }

  async function assignRoleByEmail(): Promise<void> {
    setAdminRoleError("");
    setAdminRoleSuccess("");
    if (!adminEmail || adminRoles.length === 0) return;
    setAdminRoleLoading(true);
    try {
      const res = await fetch(buildApiUrl("/api/admin/users/by-email/roles"), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: adminEmail, roles: adminRoles }),
      });
      const data = (await res.json()) as { data?: { email: string; roles: string[] }; error?: string };
      if (!res.ok) {
        setAdminRoleError(data.error ?? `失敗（HTTP ${res.status}）`);
        return;
      }
      setAdminRoleSuccess(`已將 ${data.data?.email} 的角色設為：${data.data?.roles.join(", ")}`);
      setAdminEmail("");
      setAdminRoles(["customer"]);
    } catch {
      setAdminRoleError("網路錯誤，請稍後再試");
    } finally {
      setAdminRoleLoading(false);
    }
  }

  async function markOrderReady(orderId: number): Promise<void> {
    setMarkReadyError("");
    try {
      const res = await fetch(buildApiUrl(`/api/orders/${orderId}/ready`), {
        method: "PATCH",
        credentials: "include",
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setMarkReadyError(body.error ?? `標記失敗（HTTP ${res.status}）`);
        return;
      }
      await loadAllOrders();
    } catch {
      setMarkReadyError("網路錯誤，請稍後再試");
    }
  }

  async function refreshUserOrders(): Promise<void> {
    await Promise.all([loadCurrentOrder(), loadOrderHistory()]);
  }

  useEffect(() => {
    let mounted = true;

    // V9: 從 Better Auth session cookie 恢復登入狀態（不再用 localStorage）
    async function restoreSession() {
      try {
        const res = await fetch(buildApiUrl("/api/me"), {
          credentials: "include",
        });
        if (res.ok) {
          const data = (await res.json()) as { data?: SessionUser } | null;
          if (data?.data && mounted) {
            setUser(data.data);
          }
        }
      } catch {
        // session 無法取得，維持未登入狀態
      }
    }
    void restoreSession();

    async function loadMenu() {
      try {
        const response = await fetch(buildApiUrl("/api/menu"));
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const payload = (await response.json()) as ApiDataResponse<MenuItem[]>;
        const fetchedItems = Array.isArray(payload?.data) ? payload.data : [];

        if (mounted) {
          setItems(fetchedItems);
        }
      } catch (fetchError) {
        if (mounted) {
          setError("無法取得菜單資料，請稍後再試。");
          console.error(fetchError);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void loadMenu();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setHistoryOrders([]);
      setIsCartOpen(false);
      resetCartState();
      return;
    }

    const workerOnly =
      !user.roles.includes("admin") &&
      (user.roles.includes("chef") ||
        user.roles.includes("staff") ||
        user.roles.includes("owner"));

    if (!workerOnly) {
      void refreshUserOrders().catch((refreshError) => {
        setActionError("載入使用者訂單資料失敗，請稍後再試。");
        console.error(refreshError);
      });
    }

    if (user.roles.includes("chef") || user.roles.includes("staff") || user.roles.includes("owner") || user.roles.includes("admin")) {
      void loadAllOrders().catch(console.error);
    }
  }, [user]);

  const grouped = useMemo(() => {
    const groupedItems = items.reduce(
      (acc, item) => {
        const category = item?.category || "未分類";
        if (!acc[category]) {
          acc[category] = [];
        }
        acc[category].push(item);
        return acc;
      },
      {} as Record<string, MenuItem[]>,
    );

    const categories = Object.keys(groupedItems).sort((a, b) =>
      a.localeCompare(b, "zh-Hant"),
    );

    return { groupedItems, categories };
  }, [items]);

  const cartItemCount = useMemo(
    () => Object.values(cartQtyByItemId).reduce((sum, qty) => sum + qty, 0),
    [cartQtyByItemId],
  );

  const cartDetails = useMemo(() => {
    const itemById = new Map(items.map((item) => [item.id, item]));

    return Object.entries(cartQtyByItemId)
      .map(([itemIdText, qty]) => {
        const itemId = Number(itemIdText);
        const item = itemById.get(itemId);
        if (!item || qty <= 0) {
          return null;
        }

        return {
          itemId,
          qty,
          item,
          subtotal: item.price * qty,
        };
      })
      .filter((entry) => entry !== null);
  }, [cartQtyByItemId, items]);

  async function ensureOrder(): Promise<number> {
    if (!user) {
      throw new Error("Please login first");
    }

    if (orderId !== null) {
      return orderId;
    }

    const response = await fetch(buildApiUrl("/api/orders"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      if ([401, 403].includes(response.status)) {
        setUser(null);
        setAuthError("登入狀態已失效，請重新登入。");
        setActionError("登入狀態已失效，請重新登入。");
        setHistoryOrders([]);
        resetCartState();
        throw new Error(`Auth expired: HTTP ${response.status}`);
      }

      throw new Error(`Create order failed: HTTP ${response.status}`);
    }

    const payload = (await response.json()) as ApiDataResponse<Order>;
    const createdOrderId = payload?.data?.id;

    if (!createdOrderId) {
      throw new Error("Create order failed: invalid payload");
    }

    setOrderId(createdOrderId);
    return createdOrderId;
  }

  async function handleGoogleSignIn(): Promise<void> {
    setAuthError("");
    setIsGoogleSigningIn(true);
    try {
      // Better Auth 的 social sign-in 入口是 POST。
      // 先向後端取得導向 Google 同意頁的 URL，再切換瀏覽器位置。
      const callbackURL = window.location.origin;
      const response = await fetch(buildApiUrl("/api/auth/sign-in/social"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ provider: "google", callbackURL }),
      });

      if (!response.ok) {
        throw new Error(`Google sign-in failed: HTTP ${response.status}`);
      }

      const payload = (await response.json()) as { url?: string };
      if (!payload?.url) {
        throw new Error("Google sign-in failed: missing redirect URL");
      }

      window.location.href = payload.url;
    } catch {
      setAuthError("Google 登入啟動失敗，請稍後再試。");
      setIsGoogleSigningIn(false);
    }
  }

  async function handleLogout(): Promise<void> {
    // 使用 /api/sign-out（server-side proxy），避免 Better Auth CSRF 驗證
    // 因 BETTER_AUTH_URL 設定錯誤造成的假登出（403 被吃掉）。
    // 若登出失敗，顯示錯誤並中止，確保使用者知道 session 仍存在。
    try {
      const res = await fetch(buildApiUrl("/api/sign-out"), {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        setActionError(
          `登出失敗（HTTP ${res.status}），請重試或手動清除瀏覽器 Cookie。`,
        );
        return;
      }
    } catch {
      setActionError("登出時發生網路錯誤，請重試。");
      return;
    }
    setUser(null);
    setAuthError("");
    setActionError("");
    resetCartState();
  }

  async function addToCart(item: MenuItem): Promise<void> {
    setActionError("");
    setActiveItemId(item.id);

    try {
      if (!user) {
        throw new Error("Please login first");
      }

      const patchOrderItem = async (
        targetOrderId: number,
        qty: number,
      ): Promise<Order> => {
        const response = await fetch(
          buildApiUrl(`/api/orders/${targetOrderId}`),
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              itemId: item.id,
              qty,
            }),
          },
        );

        if (!response.ok) {
          throw new Error(`Update order failed: HTTP ${response.status}`);
        }

        const payload = (await response.json()) as ApiDataResponse<Order>;
        const updatedOrder = payload?.data;

        if (!updatedOrder) {
          throw new Error("Update order failed: invalid payload");
        }

        return updatedOrder;
      };

      const targetOrderId = await ensureOrder();
      const currentQty = cartQtyByItemId[item.id] ?? 0;
      const nextQty = currentQty + 1;

      try {
        const updatedOrder = await patchOrderItem(targetOrderId, nextQty);
        syncCartFromOrder(updatedOrder);
      } catch (firstTryError) {
        const firstTryMessage =
          firstTryError instanceof Error ? firstTryError.message : "";

        // 換帳號或舊訂單失效時，重新同步目前使用者訂單後再重試一次。
        if (
          firstTryMessage.includes("HTTP 403") ||
          firstTryMessage.includes("HTTP 404")
        ) {
          setOrderId(null);

          const recoveredOrder = await loadCurrentOrder();
          const retryOrderId = recoveredOrder?.id ?? (await ensureOrder());
          const recoveredQty =
            recoveredOrder?.items.find(
              (orderItem) => orderItem.item.id === item.id,
            )?.qty ?? 0;
          const retryQty = recoveredQty + 1;

          const retriedOrder = await patchOrderItem(retryOrderId, retryQty);
          syncCartFromOrder(retriedOrder);
          return;
        }

        throw firstTryError;
      }
    } catch (cartError) {
      if (
        cartError instanceof Error &&
        cartError.message.startsWith("Auth expired:")
      ) {
        return;
      }

      if (user) {
        try {
          const recoveredOrder = await loadCurrentOrder();
          const recoveredQty = recoveredOrder?.items.find(
            (orderItem) => orderItem.item.id === item.id,
          )?.qty;

          if (typeof recoveredQty === "number" && recoveredQty > 0) {
            return;
          }
        } catch (recoveryError) {
          console.error(recoveryError);
        }
      }

      setActionError("加入購物車失敗，請稍後再試。");
      console.error(cartError);
    } finally {
      setActiveItemId(null);
    }
  }

  async function clearCart(): Promise<void> {
    if (!user || orderId === null || cartDetails.length === 0) {
      return;
    }

    setActionError("");
    setIsClearingCart(true);

    try {
      for (const detail of cartDetails) {
        const response = await fetch(buildApiUrl(`/api/orders/${orderId}`), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            itemId: detail.itemId,
            qty: 0,
          }),
        });

        if (!response.ok) {
          throw new Error(`Clear cart failed: HTTP ${response.status}`);
        }
      }

      setCartQtyByItemId({});
      setCartTotal(0);
    } catch (clearError) {
      setActionError("清空購物車失敗，請稍後再試。");
      console.error(clearError);
    } finally {
      setIsClearingCart(false);
    }
  }

  async function submitOrder(): Promise<void> {
    if (!user || orderId === null || cartDetails.length === 0) {
      return;
    }

    setActionError("");
    setIsSubmittingOrder(true);

    try {
      const response = await fetch(
        buildApiUrl(`/api/orders/${orderId}/submit`),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({}),
        },
      );

      if (!response.ok) {
        throw new Error(`Submit order failed: HTTP ${response.status}`);
      }

      resetCartState();
      setIsCartOpen(false);
      await loadOrderHistory();
    } catch (submitError) {
      setActionError("送出訂單失敗，請稍後再試。");
      console.error(submitError);
    } finally {
      setIsSubmittingOrder(false);
    }
  }

  async function submitRating(orderId: number): Promise<void> {
    const state = ratingByOrderId[orderId];
    if (!state || state.stars === 0) return;

    try {
      const res = await fetch(buildApiUrl(`/api/orders/${orderId}/rating`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ stars: state.stars, comment: state.comment || undefined }),
      });

      if (res.status === 409) {
        setRatingByOrderId((prev) => ({
          ...prev,
          [orderId]: { ...state, error: "此訂單已評分", submitted: true },
        }));
        return;
      }

      if (!res.ok) {
        setRatingByOrderId((prev) => ({
          ...prev,
          [orderId]: { ...state, error: "評分失敗，請稍後再試" },
        }));
        return;
      }

      setRatingByOrderId((prev) => ({
        ...prev,
        [orderId]: { ...state, submitted: true, error: "" },
      }));
    } catch {
      setRatingByOrderId((prev) => ({
        ...prev,
        [orderId]: { ...state, error: "網路錯誤，請稍後再試" },
      }));
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-error m-4">
        <span>{error}</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-200">
      <div className="navbar bg-base-100 shadow-lg flex-col items-stretch gap-2 md:flex-row md:items-center">
        <div className="flex-1 w-full md:w-auto">
          <a className="btn btn-ghost normal-case text-2xl">
            🌅 U1224054 王淯霆
          </a>
        </div>
        <div className="flex-none w-full md:w-auto">
          <div className="flex flex-wrap gap-2 items-center md:justify-end">
            <div className="badge badge-outline">
              {user ? `已登入 ${user.name}` : "尚未登入"}
            </div>
            {user ? (
              <div className="badge badge-neutral">
                {user.roles.join(" / ")}
              </div>
            ) : null}
            {!isWorkerOnly ? (
              <>
                <div className="badge badge-primary">
                  {items.length} 個品項・{grouped.categories.length} 類
                </div>
                <div className="badge badge-secondary">
                  購物車 {cartItemCount} 件
                </div>
                <div className="badge badge-accent">總計 ${cartTotal}</div>
                <button
                  className="btn btn-sm btn-outline"
                  onClick={() => {
                    setIsCartOpen(true);
                  }}
                  disabled={!user}
                >
                  購物車明細
                </button>
              </>
            ) : null}
            {user ? (
              <button
                className="btn btn-sm"
                onClick={() => {
                  void handleLogout();
                }}
              >
                登出
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <main className="container mx-auto p-6">
        {!user ? (
          <section className="max-w-xl mx-auto card bg-base-100 shadow-md mb-8">
            <div className="card-body">
              <h2 className="card-title">使用 Google 帳號登入</h2>
              <p className="text-sm opacity-70">
                點擊下方按鈕，使用您的 Google 帳號登入後即可開始點餐。
              </p>
              {authError ? (
                <div className="alert alert-error">
                  <span>{authError}</span>
                </div>
              ) : null}
              <button
                className="btn btn-primary w-full"
                onClick={() => {
                  void handleGoogleSignIn();
                }}
                disabled={isGoogleSigningIn}
              >
                {isGoogleSigningIn ? "導向 Google 中..." : "使用 Google 登入"}
              </button>
            </div>
          </section>
        ) : null}

        {actionError ? (
          <div className="alert alert-warning mb-4">
            <span>{actionError}</span>
          </div>
        ) : null}

        {!isWorkerOnly && items.length === 0 ? (
          <div className="alert alert-info">
            <span>目前沒有菜單資料</span>
          </div>
        ) : null}

        {!isWorkerOnly && items.length > 0 ? (
          grouped.categories.map((category) => (
            <div key={category} className="mb-8">
              <h2 className="text-3xl font-bold mb-4 text-primary border-b-2 border-primary pb-2">
                {category}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(grouped.groupedItems[category] || []).map((item) => (
                  <div
                    key={item.id}
                    className="card bg-base-100 shadow-md hover:shadow-lg transition-shadow"
                  >
                    <figure className="h-44 overflow-hidden bg-base-300">
                      <img
                        src={item.image_url}
                        alt={item.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        onError={(event) => {
                          const target = event.currentTarget;
                          target.src =
                            "https://images.unsplash.com/photo-1526318896980-cf78c088247c?auto=format&fit=crop&w=800&q=80";
                        }}
                      />
                    </figure>
                    <div className="card-body">
                      <h3 className="card-title text-lg">{item.name}</h3>
                      <p className="text-sm opacity-80 line-clamp-2 min-h-[2.75rem]">
                        {item.description}
                      </p>
                      <div className="card-actions justify-between items-center">
                        <span className="text-xl font-bold text-success">
                          ${item.price}
                        </span>
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => {
                            void addToCart(item);
                          }}
                          disabled={activeItemId === item.id}
                        >
                          {activeItemId === item.id
                            ? "加入中..."
                            : `加入購物車${cartQtyByItemId[item.id] ? ` (${cartQtyByItemId[item.id]})` : ""}`}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        ) : null}

        {user && (user.roles.includes("chef") || user.roles.includes("owner") || user.roles.includes("admin")) ? (
          <section className="mt-10">
            <h2 className="text-2xl font-bold mb-4">廚師面板 — 待出餐訂單</h2>
            {markReadyError ? (
              <div className="alert alert-error mb-3"><span>{markReadyError}</span></div>
            ) : null}
            {allOrdersLoading ? (
              <div className="alert"><span>讀取中...</span></div>
            ) : (() => {
              const submittedOrders = allOrders.filter((o) => o.status === "submitted");
              if (submittedOrders.length === 0) {
                return <div className="alert alert-info"><span>目前沒有等待出餐的訂單。</span></div>;
              }
              return (
                <div className="space-y-3">
                  {submittedOrders.map((order) => (
                    <article key={order.id} className="card bg-base-100 shadow-sm border border-warning">
                      <div className="card-body p-4">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <h3 className="font-semibold">訂單 #{order.id}</h3>
                          <span className="badge badge-warning">備餐中</span>
                        </div>
                        <p className="text-sm opacity-70">送出時間：{order.submittedAt ?? order.createdAt}</p>
                        <ul className="text-sm list-disc pl-5 space-y-1">
                          {order.items.map((detail) => (
                            <li key={`chef-${order.id}-${detail.item.id}`}>
                              {detail.item.name} x {detail.qty}
                            </li>
                          ))}
                        </ul>
                        <p className="font-bold text-right">總額 ${order.total}</p>
                        <button
                          className="btn btn-sm btn-success w-full mt-2"
                          onClick={() => { void markOrderReady(order.id); }}
                        >
                          標記出餐
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              );
            })()}
          </section>
        ) : null}

        {user && (user.roles.includes("staff") || user.roles.includes("owner") || user.roles.includes("admin")) ? (
          <section className="mt-10">
            <h2 className="text-2xl font-bold mb-4">店員面板 — 待叫號訂單</h2>
            {callOrderError ? (
              <div className="alert alert-error mb-3"><span>{callOrderError}</span></div>
            ) : null}
            {allOrdersLoading ? (
              <div className="alert"><span>讀取中...</span></div>
            ) : (() => {
              const readyOrders = allOrders.filter((o) => o.status === "ready");
              if (readyOrders.length === 0) {
                return <div className="alert alert-info"><span>目前沒有待叫號的訂單。</span></div>;
              }
              return (
                <div className="space-y-3">
                  {readyOrders.map((order) => (
                    <article key={order.id} className="card bg-base-100 shadow-sm border border-info">
                      <div className="card-body p-4">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <h3 className="font-semibold">訂單 #{order.id}</h3>
                          <span className="badge badge-info">備餐完成</span>
                        </div>
                        <p className="text-sm opacity-70">送出時間：{order.submittedAt ?? order.createdAt}</p>
                        <ul className="text-sm list-disc pl-5 space-y-1">
                          {order.items.map((detail) => (
                            <li key={`staff-${order.id}-${detail.item.id}`}>
                              {detail.item.name} x {detail.qty}
                            </li>
                          ))}
                        </ul>
                        <p className="font-bold text-right">總額 ${order.total}</p>
                        <button
                          className="btn btn-sm btn-info w-full mt-2"
                          onClick={() => { void callOrder(order.id); }}
                        >
                          叫號
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              );
            })()}
          </section>
        ) : null}

        {user && (user.roles.includes("owner") || user.roles.includes("admin")) ? (
          <section className="mt-10">
            <h2 className="text-2xl font-bold mb-4">店長面板 — 每日報表</h2>
            <div className="flex gap-2 mb-4 items-center">
              <input
                type="date"
                className="input input-bordered input-sm"
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
              />
              <button
                className="btn btn-sm btn-primary"
                onClick={() => { void fetchReport(reportDate); }}
                disabled={reportLoading}
              >
                {reportLoading ? "查詢中..." : "查詢"}
              </button>
            </div>
            {reportError ? <div className="alert alert-error mb-3"><span>{reportError}</span></div> : null}
            {report ? (
              <div className="space-y-4">
                <div className="stats shadow w-full">
                  <div className="stat">
                    <div className="stat-title">總訂單數</div>
                    <div className="stat-value text-primary">{report.totalOrders}</div>
                    <div className="stat-desc">{report.date}</div>
                  </div>
                  <div className="stat">
                    <div className="stat-title">總營業額</div>
                    <div className="stat-value text-success">${report.totalRevenue}</div>
                    <div className="stat-desc">元</div>
                  </div>
                </div>
                {report.topItems.length > 0 ? (
                  <div className="card bg-base-100 shadow-sm">
                    <div className="card-body p-4">
                      <h3 className="font-semibold mb-2">Top 5 熱賣品項</h3>
                      <table className="table table-sm">
                        <thead>
                          <tr><th>品項</th><th className="text-right">數量</th><th className="text-right">小計</th></tr>
                        </thead>
                        <tbody>
                          {report.topItems.map((item, i) => (
                            <tr key={i}>
                              <td>{item.name}</td>
                              <td className="text-right">{item.totalQty}</td>
                              <td className="text-right">${item.totalRevenue}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="alert alert-info"><span>當日無訂單資料。</span></div>
                )}
              </div>
            ) : null}
          </section>
        ) : null}

        {user && user.roles.includes("admin") ? (
          <section className="mt-10">
            <h2 className="text-2xl font-bold mb-4">管理員面板 — 角色指派</h2>
            <div className="card bg-base-100 shadow-sm max-w-md">
              <div className="card-body">
                <div className="form-control mb-3">
                  <label className="label">
                    <span className="label-text">使用者 Email</span>
                  </label>
                  <input
                    type="email"
                    className="input input-bordered"
                    placeholder="user@example.com"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                  />
                </div>
                <div className="form-control mb-4">
                  <label className="label">
                    <span className="label-text">角色（可多選）</span>
                  </label>
                  <div className="flex flex-wrap gap-4">
                    {(["customer", "staff", "chef", "owner", "admin"] as const).map((role) => (
                      <label key={role} className="flex items-center gap-1 cursor-pointer">
                        <input
                          type="checkbox"
                          className="checkbox checkbox-sm"
                          checked={adminRoles.includes(role)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setAdminRoles((prev) => [...prev, role]);
                            } else {
                              setAdminRoles((prev) => prev.filter((r) => r !== role));
                            }
                          }}
                        />
                        <span className="text-sm">{role}</span>
                      </label>
                    ))}
                  </div>
                </div>
                {adminRoleError ? (
                  <div className="alert alert-error mb-2"><span>{adminRoleError}</span></div>
                ) : null}
                {adminRoleSuccess ? (
                  <div className="alert alert-success mb-2"><span>{adminRoleSuccess}</span></div>
                ) : null}
                <button
                  className="btn btn-primary w-full"
                  disabled={!adminEmail || adminRoles.length === 0 || adminRoleLoading}
                  onClick={() => { void assignRoleByEmail(); }}
                >
                  {adminRoleLoading ? "指派中..." : "指派角色"}
                </button>
              </div>
            </div>
          </section>
        ) : null}

        {user && !isWorkerOnly ? (
          <section className="mt-10">
            <h2 className="text-2xl font-bold mb-4">我的訂單歷史</h2>
            {historyLoading ? (
              <div className="alert">
                <span>讀取中...</span>
              </div>
            ) : historyOrders.length === 0 ? (
              <div className="alert alert-info">
                <span>目前尚無歷史訂單。</span>
              </div>
            ) : (
              <div className="space-y-3">
                {historyOrders.map((order) => (
                  <article
                    key={order.id}
                    className="card bg-base-100 shadow-sm border border-base-300"
                  >
                    <div className="card-body p-4">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <h3 className="font-semibold">訂單 #{order.id}</h3>
                        {order.status === "called" ? (
                          <span className="badge badge-success">可取餐</span>
                        ) : order.status === "ready" ? (
                          <span className="badge badge-info">備餐完成</span>
                        ) : (
                          <span className="badge badge-warning">備餐中</span>
                        )}
                      </div>
                      <p className="text-sm opacity-70">
                        建立時間：{order.createdAt}
                      </p>
                      <ul className="text-sm list-disc pl-5 space-y-1">
                        {order.items.map((detail) => (
                          <li key={`${order.id}-${detail.item.id}`}>
                            {detail.item.name} x {detail.qty}
                          </li>
                        ))}
                      </ul>
                      <p className="font-bold text-right">
                        總額 ${order.total}
                      </p>

                      {order.status === "called" && (() => {
                        const rs = ratingByOrderId[order.id];
                        if (rs?.submitted) {
                          return (
                            <div className="mt-2 text-sm text-success">
                              {rs.error ? rs.error : `已評分：${"★".repeat(rs.stars)}${"☆".repeat(5 - rs.stars)}`}
                            </div>
                          );
                        }
                        const stars = rs?.stars ?? 0;
                        return (
                          <div className="mt-3 border-t border-base-300 pt-2">
                            <p className="text-sm font-semibold mb-1">評分此訂單</p>
                            <div className="flex gap-1 mb-2">
                              {[1, 2, 3, 4, 5].map((n) => (
                                <button
                                  key={n}
                                  className={`text-xl ${n <= stars ? "text-warning" : "text-base-300"}`}
                                  onClick={() =>
                                    setRatingByOrderId((prev) => ({
                                      ...prev,
                                      [order.id]: { stars: n, comment: prev[order.id]?.comment ?? "", submitted: false, error: "" },
                                    }))
                                  }
                                >
                                  ★
                                </button>
                              ))}
                            </div>
                            <input
                              type="text"
                              placeholder="留言（選填）"
                              className="input input-bordered input-sm w-full mb-2"
                              value={rs?.comment ?? ""}
                              onChange={(e) =>
                                setRatingByOrderId((prev) => ({
                                  ...prev,
                                  [order.id]: { stars: prev[order.id]?.stars ?? 0, comment: e.target.value, submitted: false, error: "" },
                                }))
                              }
                            />
                            {rs?.error && <p className="text-error text-xs mb-1">{rs.error}</p>}
                            <button
                              className="btn btn-sm btn-primary w-full"
                              disabled={stars === 0}
                              onClick={() => { void submitRating(order.id); }}
                            >
                              送出評分
                            </button>
                          </div>
                        );
                      })()}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        ) : null}
      </main>

      {user && isCartOpen ? (
        <>
          <button
            className="fixed inset-0 bg-black/35"
            aria-label="close cart drawer"
            onClick={() => {
              setIsCartOpen(false);
            }}
          />
          <aside className="fixed right-0 top-0 h-full w-full max-w-md bg-base-100 shadow-2xl z-10 flex flex-col">
            <div className="p-4 border-b border-base-300 flex items-center justify-between">
              <h2 className="text-xl font-bold">購物車明細</h2>
              <button
                className="btn btn-sm btn-ghost"
                onClick={() => {
                  setIsCartOpen(false);
                }}
              >
                關閉
              </button>
            </div>

            <div className="p-4 flex-1 overflow-auto">
              {cartDetails.length === 0 ? (
                <div className="alert">
                  <span>購物車目前是空的。</span>
                </div>
              ) : (
                <ul className="space-y-3">
                  {cartDetails.map((detail) => (
                    <li
                      key={detail.itemId}
                      className="p-3 rounded-lg bg-base-200 flex items-center justify-between"
                    >
                      <div>
                        <p className="font-semibold">{detail.item.name}</p>
                        <p className="text-sm opacity-70">
                          單價 ${detail.item.price} x {detail.qty}
                        </p>
                      </div>
                      <p className="font-bold">${detail.subtotal}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="p-4 border-t border-base-300 space-y-3">
              <div className="flex items-center justify-between font-semibold">
                <span>總件數</span>
                <span>{cartItemCount}</span>
              </div>
              <div className="flex items-center justify-between text-lg font-bold">
                <span>總金額</span>
                <span>${cartTotal}</span>
              </div>
              <button
                className="btn btn-error btn-outline w-full"
                onClick={() => {
                  void clearCart();
                }}
                disabled={cartDetails.length === 0 || isClearingCart}
              >
                {isClearingCart ? "清空中..." : "清空購物車"}
              </button>
              <button
                className="btn btn-primary w-full"
                onClick={() => {
                  void submitOrder();
                }}
                disabled={cartDetails.length === 0 || isSubmittingOrder}
              >
                {isSubmittingOrder ? "送出中..." : "送出訂單"}
              </button>
            </div>
          </aside>
        </>
      ) : null}
    </div>
  );
}
