import { useEffect, useState } from "react";
import api from "../lib/api";
import copy from "../content/copy";
import ProductCard from "../components/ProductCard";
import JerseyNumber from "../components/JerseyNumber";

const KIT_TYPES = ["all", "home", "away", "third", "retro", "goalkeeper", "anthem"];

export default function Home() {
  const [products, setProducts] = useState([]);
  const [filter, setFilter] = useState("all");
  const [status, setStatus] = useState("loading"); // loading | ready | error

  useEffect(() => {
    api
      .get("/products", { params: filter === "all" ? {} : { kitType: filter } })
      .then((res) => {
        setProducts(res.data.products);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, [filter]);

  return (
    <div>
      {/* Hero */}
      <section className="bg-pitch text-chalk">
        <div className="max-w-6xl mx-auto px-6 py-20 md:py-28 grid md:grid-cols-[1fr_auto] gap-10 items-center">
          <div>
            <p className="uppercase tracking-widest2 text-gold text-sm mb-4">{copy.hero.eyebrow}</p>
            <h1 className="font-display text-5xl md:text-7xl leading-[0.95] mb-6">
              {copy.hero.headline}
            </h1>
            <p className="text-chalk/80 max-w-lg mb-8 leading-relaxed">{copy.hero.subhead}</p>
            <div className="flex flex-wrap gap-4">
              <a
                href="#collection"
                className="px-6 py-3 bg-gold text-charcoal font-semibold rounded-sm hover:bg-chalk transition-colors"
              >
                {copy.hero.ctaPrimary}
              </a>
              <a
                href="#collection"
                className="px-6 py-3 border border-chalk/40 rounded-sm hover:border-gold hover:text-gold transition-colors"
              >
                {copy.hero.ctaSecondary}
              </a>
            </div>
          </div>
          {/* <JerseyNumber number="10" size="lg" /> */}
        </div>

        {/* trust bar */}
        <div className="border-t border-chalk/10">
          <div className="max-w-6xl mx-auto px-6 py-4 flex flex-wrap gap-x-8 gap-y-2 text-xs uppercase tracking-wide text-chalk/70">
            {copy.trustBar.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Collection */}
      <section id="collection" className="max-w-6xl mx-auto px-6 py-16">
        <div className="flex items-end justify-between flex-wrap gap-4 mb-8">
          <div>
            <h2 className="font-display text-3xl">{copy.shop.heading}</h2>
            <p className="text-charcoal/60">{copy.shop.subheading}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            {KIT_TYPES.map((type) => (
              <button
                key={type}
                onClick={() => setFilter(type)}
                className={`px-3 py-1.5 text-xs uppercase tracking-wide rounded-sm border transition-colors ${
                  filter === type
                    ? "bg-pitch text-chalk border-pitch"
                    : "border-charcoal/20 text-charcoal/70 hover:border-pitch"
                }`}
              >
                {type === "all" ? copy.shop.filterAll : type}
              </button>
            ))}
          </div>
        </div>

        {status === "loading" && <p className="text-charcoal/60">Loading the collection…</p>}
        {status === "error" && (
          <p className="text-claret">
            Couldn&apos;t reach the store right now. Make sure the backend API is running.
          </p>
        )}
        {status === "ready" && products.length === 0 && (
          <p className="text-charcoal/60">{copy.shop.emptyState}</p>
        )}

        {status === "ready" && products.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {products.map((product) => (
              <ProductCard key={product._id} product={product} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
