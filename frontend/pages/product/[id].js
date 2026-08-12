import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import api from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import copy from "../../content/copy";

export default function ProductDetail() {
  const router = useRouter();
  const { id } = router.query;
  const { user } = useAuth();

  const [product, setProduct] = useState(null);
  const [size, setSize] = useState("");
  const [status, setStatus] = useState("loading");
  const [orderMessage, setOrderMessage] = useState("");
  const [placing, setPlacing] = useState(false);

  useEffect(() => {
    if (!id) return;
    api
      .get(`/products/${id}`)
      .then((res) => {
        setProduct(res.data.product);
        setSize(res.data.product.sizes[0]);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, [id]);

  async function handleAddToOrder() {
    if (!user) {
      router.push("/login");
      return;
    }
    setPlacing(true);
    setOrderMessage("");
    try {
      await api.post("/orders", {
        items: [{ productId: product._id, size, quantity: 1 }],
      });
      setOrderMessage("Added to your order. Check My Orders to see it.");
    } catch (err) {
      setOrderMessage(err?.response?.data?.message || "Could not place the order.");
    } finally {
      setPlacing(false);
    }
  }

  if (status === "loading") return <p className="max-w-6xl mx-auto px-6 py-16">Loading…</p>;
  if (status === "error" || !product)
    return <p className="max-w-6xl mx-auto px-6 py-16 text-claret">Jersey not found.</p>;

  return (
    <div className="max-w-6xl mx-auto px-6 py-12 grid md:grid-cols-2 gap-12">
      <div className="aspect-[3/4] bg-pitch-light rounded-sm overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={product.image} alt={`${product.name} jersey`} className="w-full h-full object-cover" />
      </div>

      <div>
        <p className="text-xs uppercase tracking-widest2 text-gold font-semibold mb-2">
          {product.kitType} · {product.season}
        </p>
        <h1 className="font-display text-4xl mb-3">{product.name}</h1>
        <p className="text-2xl mb-6">
          {product.currency === "USD" ? "$" : product.currency} {product.price.toFixed(2)}
        </p>

        <div className="mb-6">
          <h2 className="text-sm font-semibold mb-2">{copy.product.descriptionHeading}</h2>
          <p className="text-charcoal/70 leading-relaxed">{product.description}</p>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-semibold mb-2">{copy.product.sizeLabel}</label>
          <div className="flex flex-wrap gap-2">
            {product.sizes.map((s) => (
              <button
                key={s}
                onClick={() => setSize(s)}
                className={`px-4 py-2 border rounded-sm text-sm transition-colors ${
                  size === s
                    ? "bg-pitch text-chalk border-pitch"
                    : "border-charcoal/20 hover:border-pitch"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleAddToOrder}
          disabled={placing || product.stock === 0}
          className="w-full md:w-auto px-8 py-3 bg-gold text-charcoal font-semibold rounded-sm hover:bg-pitch hover:text-chalk transition-colors disabled:opacity-60"
        >
          {product.stock === 0
            ? copy.product.outOfStock
            : placing
            ? "Adding…"
            : copy.product.addToCart}
        </button>

        {orderMessage && <p className="mt-4 text-sm text-charcoal/80">{orderMessage}</p>}

        <div className="mt-10 pt-6 border-t border-charcoal/10">
          <h2 className="text-sm font-semibold mb-2">{copy.product.careHeading}</h2>
          <p className="text-charcoal/60 text-sm leading-relaxed">{copy.product.careText}</p>
        </div>
      </div>
    </div>
  );
}
