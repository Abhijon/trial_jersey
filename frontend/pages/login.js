import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { useAuth } from "../context/AuthContext";
import copy from "../content/copy";
import PasswordInput from "../components/PasswordInput";

export default function Login() {
  const { login } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(form.email, form.password);
      router.push("/");
    } catch (err) {
      setError(err?.response?.data?.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-md mx-auto px-6 py-20">
      <h1 className="font-display text-4xl mb-2">{copy.auth.loginHeading}</h1>
      <p className="text-charcoal/60 mb-8">{copy.auth.loginSubheading}</p>

      <form onSubmit={handleSubmit} className="space-y-5">
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
          <PasswordInput
            required
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </div>

        {error && <p className="text-claret text-sm">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3 bg-pitch text-chalk font-semibold rounded-sm hover:bg-pitch-dark transition-colors disabled:opacity-60"
        >
          {submitting ? "Logging in…" : copy.auth.loginButton}
        </button>
      </form>

      <p className="text-sm text-charcoal/60 mt-6">
        <Link href="/signup" className="text-pitch underline">
          {copy.auth.switchToSignup}
        </Link>
      </p>
    </div>
  );
}
