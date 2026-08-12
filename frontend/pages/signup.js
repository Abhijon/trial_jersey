import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { useAuth } from "../context/AuthContext";
import copy from "../content/copy";

export default function Signup() {
  const { signup } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await signup(form.name, form.email, form.password);
      router.push("/");
    } catch (err) {
      setError(err?.response?.data?.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-md mx-auto px-6 py-20">
      <h1 className="font-display text-4xl mb-2">{copy.auth.signupHeading}</h1>
      <p className="text-charcoal/60 mb-8">{copy.auth.signupSubheading}</p>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium mb-1">{copy.auth.nameLabel}</label>
          <input
            type="text"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full border border-charcoal/20 rounded-sm px-3 py-2 focus:border-pitch"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{copy.auth.emailLabel}</label>
          <input
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="w-full border border-charcoal/20 rounded-sm px-3 py-2 focus:border-pitch"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{copy.auth.passwordLabel}</label>
          <input
            type="password"
            required
            minLength={6}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="w-full border border-charcoal/20 rounded-sm px-3 py-2 focus:border-pitch"
          />
        </div>

        {error && <p className="text-claret text-sm">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3 bg-pitch text-chalk font-semibold rounded-sm hover:bg-pitch-dark transition-colors disabled:opacity-60"
        >
          {submitting ? "Creating account…" : copy.auth.signupButton}
        </button>
      </form>

      <p className="text-sm text-charcoal/60 mt-6">
        <Link href="/login" className="text-pitch underline">
          {copy.auth.switchToLogin}
        </Link>
      </p>
    </div>
  );
}
