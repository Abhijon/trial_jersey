import Link from "next/link";
import { useAuth } from "../context/AuthContext";
import copy from "../content/copy";

export default function Navbar() {
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-40 bg-pitch text-chalk border-b border-gold/30">
      <nav className="max-w-6xl mx-auto flex items-center justify-between px-6 py-4">
        <Link href="/" className="font-display text-2xl tracking-widest2 text-chalk">
          {copy.brand.name}
          {/* <span className="text-gold">.</span> */}
        </Link>

        <div className="flex items-center gap-6 text-sm font-medium">
          <Link href="/" className="hover:text-gold transition-colors">
            {copy.nav.shop}
          </Link>

          {user ? (
            <>
              <Link href="/orders" className="hover:text-gold transition-colors">
                {copy.nav.orders}
              </Link>
              <span className="text-chalk/60 hidden sm:inline">Hi, {user.name.split(" ")[0]}</span>
              <button
                onClick={logout}
                className="px-4 py-2 border border-gold text-gold hover:bg-gold hover:text-charcoal transition-colors rounded-sm"
              >
                {copy.nav.logout}
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="hover:text-gold transition-colors">
                {copy.nav.login}
              </Link>
              <Link
                href="/signup"
                className="px-4 py-2 bg-gold text-charcoal font-semibold hover:bg-chalk transition-colors rounded-sm"
              >
                {copy.nav.signup}
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
