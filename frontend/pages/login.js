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
  const [isUnverified, setIsUnverified] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setIsUnverified(false);
    setSubmitting(true);

    try {
      await login(form.email, form.password);
      router.push("/");
    } catch (err) {
      const msg = err?.response?.data?.message || "Something went wrong. Please try again.";
      setError(msg);
      if (err?.response?.data?.isUnverified) {
        setIsUnverified(true);
      }
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
          <div className="flex justify-between items-center mb-1">
            <label className="text-sm font-medium">{copy.auth.passwordLabel}</label>
            <Link href="/forgot-password" className="text-xs text-pitch hover:underline">
              Forgot password?
            </Link>
          </div>
          <PasswordInput
            required
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </div>

        {error && (
          <div className="p-3 bg-red-50 text-claret text-sm rounded border border-red-200">
            {error}
            {isUnverified && (
              <p className="mt-2 text-xs font-semibold">
                Please check your inbox for the OTP code or complete sign up again to receive a new OTP.
              </p>
            )}
          </div>
        )}

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
