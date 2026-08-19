import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import api from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import copy from "../../content/copy";
import { loadRazorpayScript } from "../../lib/razorpay";

export default function ProductDetail() {
  const router = useRouter();
  const { id } = router.query;
  const { user } = useAuth();

  const [product, setProduct] = useState(null);
  const [size, setSize] = useState("");
  const [status, setStatus] = useState("loading");
  const [orderMessage, setOrderMessage] = useState("");
  const [messageType, setMessageType] = useState("info"); // info | success | error
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

  async function handleBuyWithRazorpay() {
    if (!user) {
      router.push("/login");
      return;
    }
    setPlacing(true);
    setOrderMessage("");
    setMessageType("info");

    // Load Razorpay JS SDK dynamically
    const scriptLoaded = await loadRazorpayScript();
    if (!scriptLoaded) {
      setOrderMessage("Failed to load Razorpay checkout SDK. Please check internet connection.");
      setMessageType("error");
      setPlacing(false);
      return;
    }

    try {
      // Generate a client-side idempotency key to prevent duplicate orders on double-click
      const idempotencyKey = `${product._id}_${size}_${Date.now()}`;

      // 1. Create Razorpay Payment Order on Backend (order created with status 'pending')
      const res = await api.post("/payments/create-order", {
        items: [{ productId: product._id, size, quantity: 1 }],
        idempotencyKey,
      });

      const { razorpayOrderId, amount, currency, key } = res.data;

      // 2. Configure & Open Razorpay Modal
      const options = {
        key: key || "rzp_test_YOUR_KEY_ID",
        amount: amount,
        currency: currency || "INR",
        name: "Trail.com",
        description: `${product.name} (Size: ${size})`,
        image: product.image,
        order_id: razorpayOrderId,
        prefill: {
          name: user.name || user.fullName || "",
          email: user.email || "",
        },
        theme: {
          color: "#0f281e",
        },
        // TEST MODE: Only card payments enabled. Remove this block when switching to live keys.
        config: {
          display: {
            blocks: {
              banks: { name: "Pay via Card", instruments: [{ method: "card" }] },
            },
            sequence: ["block.banks"],
            preferences: { show_default_blocks: false },
          },
        },
        handler: async function (response) {
          try {
            setOrderMessage("Verifying payment with server...");
            setMessageType("info");

            // 3. Verify Payment Signature on Backend (only now order becomes 'placed' and paymentStatus 'paid')
            const verifyRes = await api.post("/payments/verify", {
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });

            if (verifyRes.data.success) {
              setOrderMessage("Payment successful! Order placed successfully. Redirecting to My Orders...");
              setMessageType("success");
              setTimeout(() => {
                router.push("/orders");
              }, 1500);
            } else {
              setOrderMessage("Payment failed");
              setMessageType("error");
              setPlacing(false);
            }
          } catch (verifyErr) {
            setOrderMessage("Payment failed");
            setMessageType("error");
            setPlacing(false);
          }
        },
        modal: {
          ondismiss: function () {
            setPlacing(false);
            setOrderMessage("Payment cancelled");
            setMessageType("error");
            if (razorpayOrderId) {
              api.post("/payments/cancel", { razorpayOrderId }).catch(() => {});
            }
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", function (response) {
        console.error("Payment failed:", response.error);
        setOrderMessage("Payment failed");
        setMessageType("error");
        setPlacing(false);
        if (razorpayOrderId) {
          api.post("/payments/fail", {
            razorpayOrderId,
            error: {
              code: response.error?.code,
              description: response.error?.description,
              source: response.error?.source,
            },
          }).catch(() => {});
        }
      });

      rzp.open();
    } catch (err) {
      console.error("Checkout error:", err);
      setOrderMessage(
        err?.response?.data?.message || "Payment failed"
      );
      setMessageType("error");
      setPlacing(false);
    }
  }

  if (status === "loading") return <p className="max-w-6xl mx-auto px-6 py-16">Loading…</p>;
  if (status === "error" || !product)
    return <p className="max-w-6xl mx-auto px-6 py-16 text-claret">Jersey not found.</p>;

  const formattedPrice = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(product.price);

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
        <p className="text-3xl font-bold mb-6 text-pitch">
          {formattedPrice}
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
          onClick={handleBuyWithRazorpay}
          disabled={placing || product.stock === 0}
          className="w-full md:w-auto px-8 py-3.5 bg-gold text-charcoal font-bold rounded-sm hover:bg-pitch hover:text-chalk transition-all shadow-md disabled:opacity-60 flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
          {product.stock === 0
            ? copy.product.outOfStock
            : placing
            ? "Processing..."
            : `Pay ${formattedPrice} with Razorpay`}
        </button>

        {orderMessage && (
          <div
            className={`mt-4 p-3 border rounded text-sm font-semibold ${
              messageType === "success"
                ? "bg-green-50 border-green-300 text-green-800"
                : messageType === "error"
                ? "bg-red-50 border-red-300 text-red-700"
                : "bg-pitch-light/30 border-pitch/20 text-pitch"
            }`}
          >
            {orderMessage}
          </div>
        )}

        <div className="mt-10 pt-6 border-t border-charcoal/10">
          <h2 className="text-sm font-semibold mb-2">{copy.product.careHeading}</h2>
          <p className="text-charcoal/60 text-sm leading-relaxed">{copy.product.careText}</p>
        </div>
      </div>
    </div>
  );
}
