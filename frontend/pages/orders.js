import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import api from "../lib/api";
import { useAuth } from "../context/AuthContext";
import copy from "../content/copy";

export default function Orders() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState([]);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    api
      .get("/orders")
      .then((res) => {
        setOrders(res.data.orders);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, [user, loading, router]);

  if (loading || status === "loading") {
    return <p className="max-w-4xl mx-auto px-6 py-16">Loading your orders…</p>;
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-16">
      <h1 className="font-display text-4xl mb-2">{copy.orders.heading}</h1>
      <p className="text-charcoal/60 mb-10">{copy.orders.subheading}</p>

      {status === "error" && <p className="text-claret">Couldn&apos;t load your orders right now.</p>}

      {status === "ready" && orders.length === 0 && (
        <div className="text-center py-16 border border-dashed border-charcoal/20 rounded-sm">
          <p className="text-charcoal/60 mb-4">{copy.orders.emptyState}</p>
          <Link href="/" className="text-pitch underline">
            {copy.orders.emptyCta}
          </Link>
        </div>
      )}

      <div className="space-y-4">
        {orders.map((order) => (
          <div key={order._id} className="border border-charcoal/10 rounded-sm p-5">
            <div className="flex justify-between items-start mb-3 text-sm text-charcoal/60">
              <span>
                {copy.orders.placedOn} {new Date(order.createdAt).toLocaleDateString()}
              </span>
              <span className="uppercase tracking-wide text-gold font-semibold">
                {order.status}
              </span>
            </div>
            <ul className="mb-3 space-y-1">
              {order.items.map((item, idx) => (
                <li key={idx} className="text-sm">
                  {item.quantity} × {item.name} (Size {item.size}) — ${item.price.toFixed(2)}
                </li>
              ))}
            </ul>
            <div className="text-right font-semibold">Total: ${order.total.toFixed(2)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
