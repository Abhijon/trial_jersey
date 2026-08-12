import Link from "next/link";

export default function ProductCard({ product }) {
  return (
    <Link
      href={`/product/${product._id}`}
      className="group block bg-white border border-charcoal/10 rounded-sm overflow-hidden hover:border-gold transition-colors"
    >
      <div className="aspect-[3/4] bg-pitch-light overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={product.image}
          alt={`${product.name} jersey`}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
      </div>
      <div className="p-4">
        <p className="text-xs uppercase tracking-widest2 text-gold font-semibold mb-1">
          {product.kitType} · {product.season}
        </p>
        <h3 className="font-display text-lg leading-tight mb-1">{product.name}</h3>
        <p className="text-charcoal/70 text-sm">
          {product.currency === "USD" ? "$" : product.currency} {product.price.toFixed(2)}
        </p>
      </div>
    </Link>
  );
}
