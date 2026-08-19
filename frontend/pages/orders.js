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
        // Ensure only successfully paid and placed orders are shown
        const placedOrders = (res.data.orders || []).filter(
          (order) => order.paymentStatus === "paid" || order.status === "placed"
        );
        setOrders(placedOrders);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, [user, loading, router]);

  if (loading || status === "loading") {
    return <p className="max-w-4xl mx-auto px-6 py-16">Loading your orders…</p>;
  }

  const formatPrice = (val) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(val);

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
          <div key={order._id} className="border border-charcoal/10 rounded-sm p-5 bg-white shadow-sm">
            <div className="flex justify-between items-center mb-3 text-sm text-charcoal/60 pb-3 border-b border-charcoal/10">
              <span>
                {copy.orders.placedOn} {new Date(order.createdAt).toLocaleDateString("en-IN", { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
              <span className="uppercase tracking-wide text-gold font-semibold text-xs px-2.5 py-1 bg-gold/10 border border-gold/30 rounded">
                Placed
              </span>
            </div>

            <ul className="mb-4 space-y-2">
              {order.items.map((item, idx) => (
                <li key={idx} className="flex justify-between items-center text-sm">
                  <span>
                    <span className="font-semibold">{item.quantity}×</span> {item.name}{" "}
                    <span className="text-charcoal/50">(Size {item.size})</span>
                  </span>
                  <span className="font-mono font-medium">{formatPrice(item.price * item.quantity)}</span>
                </li>
              ))}
            </ul>

            <div className="flex justify-end items-center pt-3 border-t border-charcoal/10">
              <div className="font-bold text-lg text-pitch">
                Total: {formatPrice(order.total)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
