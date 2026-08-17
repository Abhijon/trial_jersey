import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { useAuth } from "../context/AuthContext";
import PasswordInput from "../components/PasswordInput";

export default function ForgotPassword() {
  const { forgotPassword, resendResetOtp, resetPassword } = useAuth();
  const router = useRouter();

  // Step 1: Enter email, Step 2: Enter OTP + New Password + Confirm Password
  const [step, setStep] = useState(1);

  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [error, setError] = useState("");
  const [infoMsg, setInfoMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Cooling timer state (60 seconds)
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    let timer;
    if (cooldown > 0) {
      timer = setInterval(() => {
        setCooldown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [cooldown]);

  // Handle Step 1: Request Password Reset OTP
  async function handleRequestOtp(e) {
    e.preventDefault();
    setError("");
    setInfoMsg("");
    setSubmitting(true);

    try {
      const res = await forgotPassword(email);
      setInfoMsg(res.message || "Password reset OTP sent to your email.");
      setStep(2);
      setCooldown(60);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to process password reset request.");
    } finally {
      setSubmitting(false);
    }
  }

  // Handle Step 2: Verify OTP & Change Password
  async function handleResetPassword(e) {
    e.preventDefault();
    setError("");
    setInfoMsg("");

    if (!otp || otp.trim().length === 0) {
      setError("Please enter the 6-digit OTP code.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match. Please make sure both fields match.");
      return;
    }

    if (newPassword.length < 6) {
      setError("New password must be at least 6 characters long.");
      return;
    }

    setSubmitting(true);

    try {
      const res = await resetPassword(email, otp, newPassword, confirmPassword);
      setInfoMsg(res.message || "Password reset successful!");
      setTimeout(() => {
        router.push("/login");
      }, 2000);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to reset password.");
    } finally {
      setSubmitting(false);
    }
  }

  // Handle Resend Reset OTP
  async function handleResendOtp() {
    if (cooldown > 0) return;

    setError("");
    setInfoMsg("");
    setSubmitting(true);

    try {
      const res = await resendResetOtp(email);
      setInfoMsg(res.message || "A new password reset OTP has been sent to your email.");
      setCooldown(60);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to resend OTP.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-md mx-auto px-6 py-20">
      <h1 className="font-display text-4xl mb-2">Reset Password</h1>
      <p className="text-charcoal/60 mb-8">
        {step === 1
          ? "Enter your email address and we'll send you an OTP to reset your password."
          : `Enter the 6-digit OTP code sent to ${email} along with your new password.`}
      </p>

      {/* STEP 1: Email Form */}
      {step === 1 && (
        <form onSubmit={handleRequestOtp} className="space-y-5">
          {error && (
            <div className="p-3 bg-red-50 text-claret text-sm rounded border border-red-200">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-charcoal/20 rounded-sm px-3 py-2 focus:border-pitch"
              placeholder="you@example.com"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-pitch text-chalk font-semibold rounded-sm hover:bg-pitch-dark transition-colors disabled:opacity-60"
          >
            {submitting ? "Sending OTP…" : "Send Reset OTP"}
          </button>
        </form>
      )}

      {/* STEP 2: OTP & New Password Form */}
      {step === 2 && (
        <form onSubmit={handleResetPassword} className="space-y-5">
          {infoMsg && (
            <div className="p-3 bg-green-50 text-green-800 text-sm rounded border border-green-200">
              {infoMsg}
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 text-claret text-sm rounded border border-red-200">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">Enter Reset OTP</label>
            <input
              type="text"
              maxLength={6}
              required
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              className="w-full border border-charcoal/20 rounded-sm px-3 py-2 text-center font-mono text-2xl letter-spacing-2 focus:border-pitch"
              placeholder="1234"
            />
            <p className="text-xs text-charcoal/50 mt-1">
              Code expires in 10 minutes. 3 incorrect attempts will lock the password reset for 1 hour.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">New Password</label>
            <PasswordInput
              required
              minLength={6}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Confirm New Password</label>
            <PasswordInput
              required
              minLength={6}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-pitch text-chalk font-semibold rounded-sm hover:bg-pitch-dark transition-colors disabled:opacity-60"
          >
            {submitting ? "Resetting Password…" : "Reset Password"}
          </button>

          <div className="pt-2 flex justify-between items-center text-sm">
            <button
              type="button"
              onClick={() => {
                setStep(1);
                setError("");
                setInfoMsg("");
              }}
              className="text-charcoal/70 hover:underline"
            >
              ← Change email
            </button>

            <button
              type="button"
              disabled={cooldown > 0 || submitting}
              onClick={handleResendOtp}
              className="text-pitch font-medium disabled:opacity-50 hover:underline"
            >
              {cooldown > 0 ? `Resend OTP in ${cooldown}s` : "Resend OTP"}
            </button>
          </div>
        </form>
      )}

      <p className="text-sm text-charcoal/60 mt-6 text-center">
        Remembered your password?{" "}
        <Link href="/login" className="text-pitch underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
