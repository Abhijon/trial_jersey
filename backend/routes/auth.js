const express = require("express");
const jwt = require("jsonwebtoken");
const { body, validationResult } = require("express-validator");
const User = require("../models/User");
const requireAuth = require("../middleware/auth");
const { sendSignupOtp, sendResetPasswordOtp } = require("../config/sendgrid");
const { sendEmailViaQueue } = require("../config/rabbitmq");

const router = express.Router();

const COOLDOWN_SECONDS = 60; // 60 seconds between resend requests
const LOCK_DURATION_MS = 60 * 60 * 1000; // 1 hour lock after 3 failed attempts
const OTP_EXPIRY_MS = 10 * 60 * 1000; // OTP valid for 10 minutes

function generateOTP() {
  const isStaticOtpEnabled = process.env.USE_STATIC_OTP === "true" || process.env.STATIC_OTP_ENABLED === "true";
  if (isStaticOtpEnabled) {
    return process.env.STATIC_OTP || "1234";
  }
  return Math.floor(1000 + Math.random() * 9000).toString();
}

function signToken(user) {
  return jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
}

function publicUser(user) {
  return { id: user._id, name: user.name, email: user.email };
}

function getLockRemainingMinutes(lockUntil) {
  const diffMs = lockUntil.getTime() - Date.now();
  if (diffMs <= 0) return 0;
  const minutes = Math.ceil(diffMs / (60 * 1000));
  return minutes;
}

function getCooldownRemainingSeconds(lastSentAt) {
  if (!lastSentAt) return 0;
  const elapsedMs = Date.now() - lastSentAt.getTime();
  const cooldownMs = COOLDOWN_SECONDS * 1000;
  if (elapsedMs >= cooldownMs) return 0;
  return Math.ceil((cooldownMs - elapsedMs) / 1000);
}

// ---------------------------------------------------------------------------
// 1. SIGNUP & EMAIL OTP VERIFICATION
// ---------------------------------------------------------------------------

// POST /api/auth/signup - Step 1: Register details and send OTP via SendGrid
router.post(
  "/signup",
  [
    body("name").trim().notEmpty().withMessage("Name is required"),
    body("email").isEmail().withMessage("A valid email is required"),
    body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg });
    }

    try {
      const { name, email, password } = req.body;
      const normalizedEmail = email.toLowerCase();

      let user = await User.findOne({ email: normalizedEmail }).select("+signupOtp");

      const isNewUser = !user;

      // If user exists and is already verified
      if (user && user.isVerified) {
        return res.status(409).json({ message: "An account with this email already exists." });
      }

      // If user exists but is unverified
      if (user && !user.isVerified) {
        // Check lock status
        if (user.signupOtpLockUntil && user.signupOtpLockUntil > Date.now()) {
          const mins = getLockRemainingMinutes(user.signupOtpLockUntil);
          return res.status(429).json({
            message: `Account is locked due to 3 failed OTP attempts. Please try again in ${mins} minute(s).`,
            isLocked: true,
            lockRemainingMinutes: mins,
          });
        }

        // Check cooling period
        const cooldownRemaining = getCooldownRemainingSeconds(user.signupOtpLastSentAt);
        if (cooldownRemaining > 0) {
          return res.status(429).json({
            message: `Please wait ${cooldownRemaining} second(s) before requesting a new OTP.`,
            cooldownRemaining,
          });
        }

        user.name = name;
        user.password = password; // Will be hashed by pre-save
        user.signupOtpLockUntil = undefined;
      } else {
        // New user registration
        user = new User({
          name,
          email: normalizedEmail,
          password,
          isVerified: false,
        });
      }

      // Common OTP generation & dispatch for both new and existing unverified users
      const otp = generateOTP();
      user.signupOtp = otp;
      user.signupOtpExpires = new Date(Date.now() + OTP_EXPIRY_MS);
      user.signupOtpLastSentAt = new Date();
      user.signupOtpAttempts = 0;

      await user.save();
      await sendEmailViaQueue({ type: "SIGNUP_OTP", email: user.email, otp });

      return res.status(isNewUser ? 201 : 200).json({
        message: "Verification OTP has been sent to your email.",
        email: user.email,
        requiresOtp: true,
      });
    } catch (err) {
      console.error("Signup Error:", err);
      res.status(500).json({ message: "Could not initiate registration", error: err.message });
    }
  }
);

// POST /api/auth/verify-signup-otp - Step 2: Verify Signup OTP
router.post(
  "/verify-signup-otp",
  [
    body("email").isEmail().withMessage("Valid email required"),
    body("otp").trim().notEmpty().withMessage("OTP code is required"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg });
    }

    try {
      const { email, otp } = req.body;
      const user = await User.findOne({ email: email.toLowerCase() }).select("+signupOtp");

      if (!user) {
        return res.status(404).json({ message: "Account not found." });
      }

      if (user.isVerified) {
        return res.status(400).json({ message: "Account is already verified. Please log in." });
      }

      // Check 1-hour account lock
      if (user.signupOtpLockUntil && user.signupOtpLockUntil > Date.now()) {
        const mins = getLockRemainingMinutes(user.signupOtpLockUntil);
        return res.status(429).json({
          message: `Account is locked due to 3 failed OTP attempts. Please try again in ${mins} minute(s).`,
          isLocked: true,
          lockRemainingMinutes: mins,
        });
      }

      // Check OTP expiry
      if (!user.signupOtpExpires || user.signupOtpExpires < Date.now()) {
        return res.status(400).json({ message: "OTP code has expired. Please request a new OTP." });
      }

      // Check OTP match
      if (user.signupOtp !== otp.trim()) {
        user.signupOtpAttempts = (user.signupOtpAttempts || 0) + 1;

        if (user.signupOtpAttempts >= 3) {
          user.signupOtpLockUntil = new Date(Date.now() + LOCK_DURATION_MS);
          user.signupOtpAttempts = 0;
          user.signupOtp = undefined;
          user.signupOtpExpires = undefined;
          await user.save();

          return res.status(429).json({
            message: "3 incorrect attempts. Account locked for 1 hour.",
            isLocked: true,
            lockRemainingMinutes: 60,
          });
        }

        await user.save();
        const remainingAttempts = 3 - user.signupOtpAttempts;
        return res.status(400).json({
          message: `Invalid OTP code. You have ${remainingAttempts} attempt(s) remaining.`,
          remainingAttempts,
        });
      }

      // OTP is valid! Complete verification
      user.isVerified = true;
      user.signupOtp = undefined;
      user.signupOtpExpires = undefined;
      user.signupOtpAttempts = 0;
      user.signupOtpLockUntil = undefined;
      await user.save();

      const token = signToken(user);
      res.json({
        message: "Email verified successfully!",
        token,
        user: publicUser(user),
      });
    } catch (err) {
      console.error("Verify Signup OTP Error:", err);
      res.status(500).json({ message: "Failed to verify OTP", error: err.message });
    }
  }
);

// POST /api/auth/resend-signup-otp - Resend Signup OTP with cooling period
router.post(
  "/resend-signup-otp",
  [body("email").isEmail().withMessage("Valid email required")],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg });
    }

    try {
      const { email } = req.body;
      const user = await User.findOne({ email: email.toLowerCase() });

      if (!user) {
        return res.status(404).json({ message: "Account not found." });
      }

      if (user.isVerified) {
        return res.status(400).json({ message: "Account is already verified." });
      }

      // Check lock status
      if (user.signupOtpLockUntil && user.signupOtpLockUntil > Date.now()) {
        const mins = getLockRemainingMinutes(user.signupOtpLockUntil);
        return res.status(429).json({
          message: `Account is locked due to 3 failed attempts. Try again in ${mins} minute(s).`,
          isLocked: true,
          lockRemainingMinutes: mins,
        });
      }

      // Check cooling period
      const cooldownRemaining = getCooldownRemainingSeconds(user.signupOtpLastSentAt);
      if (cooldownRemaining > 0) {
        return res.status(429).json({
          message: `Please wait ${cooldownRemaining} second(s) before requesting another OTP.`,
          cooldownRemaining,
        });
      }

      const otp = generateOTP();
      user.signupOtp = otp;
      user.signupOtpExpires = new Date(Date.now() + OTP_EXPIRY_MS);
      user.signupOtpLastSentAt = new Date();
      await user.save();

      await sendEmailViaQueue({ type: "SIGNUP_OTP", email: user.email, otp });

      res.json({ message: "A new OTP code has been sent to your email." });
    } catch (err) {
      console.error("Resend Signup OTP Error:", err);
      res.status(500).json({ message: "Could not resend OTP", error: err.message });
    }
  }
);

// ---------------------------------------------------------------------------
// 2. LOGIN WITH VERIFICATION CHECK
// ---------------------------------------------------------------------------

// POST /api/auth/login
router.post(
  "/login",
  [
    body("email").isEmail().withMessage("A valid email is required"),
    body("password").notEmpty().withMessage("Password is required"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg });
    }

    try {
      const { email, password } = req.body;

      const user = await User.findOne({ email: email.toLowerCase() }).select("+password");
      if (!user) {
        return res.status(401).json({ message: "Incorrect email or password" });
      }

      const match = await user.comparePassword(password);
      if (!match) {
        return res.status(401).json({ message: "Incorrect email or password" });
      }

      // Require email verification before allowing access
      if (!user.isVerified) {
        return res.status(403).json({
          message: "Please verify your email address to access your account.",
          isUnverified: true,
          email: user.email,
        });
      }

      const token = signToken(user);
      res.json({ token, user: publicUser(user) });
    } catch (err) {
      res.status(500).json({ message: "Could not log in", error: err.message });
    }
  }
);

// ---------------------------------------------------------------------------
// 3. FORGOT PASSWORD & RESET OTP FLOW
// ---------------------------------------------------------------------------

// POST /api/auth/forgot-password - Step 1: Request OTP for password reset
router.post(
  "/forgot-password",
  [body("email").isEmail().withMessage("A valid email is required")],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg });
    }

    try {
      const { email } = req.body;
      const user = await User.findOne({ email: email.toLowerCase() }).select("+resetOtp");

      // For security, if email does not exist, return generic success message
      if (!user) {
        return res.json({
          message: "If an account with that email exists, an OTP has been sent to reset your password.",
          email,
        });
      }

      // Check 1-hour reset lock status
      if (user.resetOtpLockUntil && user.resetOtpLockUntil > Date.now()) {
        const mins = getLockRemainingMinutes(user.resetOtpLockUntil);
        return res.status(429).json({
          message: `Account is locked for password reset due to 3 failed attempts. Please try again in ${mins} minute(s).`,
          isLocked: true,
          lockRemainingMinutes: mins,
        });
      }

      // Check cooling period
      const cooldownRemaining = getCooldownRemainingSeconds(user.resetOtpLastSentAt);
      if (cooldownRemaining > 0) {
        return res.status(429).json({
          message: `Please wait ${cooldownRemaining} second(s) before requesting another reset OTP.`,
          cooldownRemaining,
        });
      }

      const otp = generateOTP();
      user.resetOtp = otp;
      user.resetOtpExpires = new Date(Date.now() + OTP_EXPIRY_MS);
      user.resetOtpLastSentAt = new Date();
      user.resetOtpAttempts = 0;
      await user.save();

      await sendEmailViaQueue({ type: "RESET_OTP", email: user.email, otp });

      res.json({
        message: "Password reset OTP sent to your email.",
        email: user.email,
      });
    } catch (err) {
      console.error("Forgot Password Error:", err);
      res.status(500).json({ message: "Could not process password reset request", error: err.message });
    }
  }
);

// POST /api/auth/resend-reset-otp - Resend Reset OTP with cooling period
router.post(
  "/resend-reset-otp",
  [body("email").isEmail().withMessage("A valid email is required")],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg });
    }

    try {
      const { email } = req.body;
      const user = await User.findOne({ email: email.toLowerCase() });

      if (!user) {
        return res.status(404).json({ message: "Account not found." });
      }

      // Check lock status
      if (user.resetOtpLockUntil && user.resetOtpLockUntil > Date.now()) {
        const mins = getLockRemainingMinutes(user.resetOtpLockUntil);
        return res.status(429).json({
          message: `Account is locked for password reset due to 3 failed attempts. Try again in ${mins} minute(s).`,
          isLocked: true,
          lockRemainingMinutes: mins,
        });
      }

      // Check cooling period
      const cooldownRemaining = getCooldownRemainingSeconds(user.resetOtpLastSentAt);
      if (cooldownRemaining > 0) {
        return res.status(429).json({
          message: `Please wait ${cooldownRemaining} second(s) before requesting another OTP.`,
          cooldownRemaining,
        });
      }

      const otp = generateOTP();
      user.resetOtp = otp;
      user.resetOtpExpires = new Date(Date.now() + OTP_EXPIRY_MS);
      user.resetOtpLastSentAt = new Date();
      await user.save();

      await sendEmailViaQueue({ type: "RESET_OTP", email: user.email, otp });

      res.json({ message: "A new password reset OTP has been sent to your email." });
    } catch (err) {
      console.error("Resend Reset OTP Error:", err);
      res.status(500).json({ message: "Could not resend reset OTP", error: err.message });
    }
  }
);

// POST /api/auth/reset-password - Step 2: Verify OTP and update password
router.post(
  "/reset-password",
  [
    body("email").isEmail().withMessage("Valid email is required"),
    body("otp").trim().notEmpty().withMessage("OTP code is required"),
    body("newPassword").isLength({ min: 6 }).withMessage("New password must be at least 6 characters"),
    body("confirmPassword").custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error("Password confirmation does not match new password");
      }
      return true;
    }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg });
    }

    try {
      const { email, otp, newPassword } = req.body;
      const user = await User.findOne({ email: email.toLowerCase() }).select("+resetOtp +password");

      if (!user) {
        return res.status(404).json({ message: "Account not found." });
      }

      // Check 1-hour reset lock
      if (user.resetOtpLockUntil && user.resetOtpLockUntil > Date.now()) {
        const mins = getLockRemainingMinutes(user.resetOtpLockUntil);
        return res.status(429).json({
          message: `Account is locked for password reset due to 3 failed attempts. Please try again in ${mins} minute(s).`,
          isLocked: true,
          lockRemainingMinutes: mins,
        });
      }

      // Check OTP expiry
      if (!user.resetOtpExpires || user.resetOtpExpires < Date.now()) {
        return res.status(400).json({ message: "Reset OTP code has expired. Please request a new OTP." });
      }

      // Check OTP match
      if (user.resetOtp !== otp.trim()) {
        user.resetOtpAttempts = (user.resetOtpAttempts || 0) + 1;

        if (user.resetOtpAttempts >= 3) {
          user.resetOtpLockUntil = new Date(Date.now() + LOCK_DURATION_MS);
          user.resetOtpAttempts = 0;
          user.resetOtp = undefined;
          user.resetOtpExpires = undefined;
          await user.save();

          return res.status(429).json({
            message: "3 incorrect attempts. Account locked for 1 hour.",
            isLocked: true,
            lockRemainingMinutes: 60,
          });
        }

        await user.save();
        const remainingAttempts = 3 - user.resetOtpAttempts;
        return res.status(400).json({
          message: `Invalid OTP code. You have ${remainingAttempts} attempt(s) remaining.`,
          remainingAttempts,
        });
      }

      // OTP verified successfully! Update password
      user.password = newPassword; // Hashed via pre-save hook
      user.resetOtp = undefined;
      user.resetOtpExpires = undefined;
      user.resetOtpAttempts = 0;
      user.resetOtpLockUntil = undefined;
      await user.save();

      res.json({ message: "Password updated successfully! You can now log in with your new password." });
    } catch (err) {
      console.error("Reset Password Error:", err);
      res.status(500).json({ message: "Failed to reset password", error: err.message });
    }
  }
);

// GET /api/auth/me - confirms current token
router.get("/me", requireAuth, async (req, res) => {
  res.json({ user: publicUser(req.user) });
});

module.exports = router;
