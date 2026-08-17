const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true, minlength: 6, select: false },
    isVerified: { type: Boolean, default: false },

    // Signup OTP fields
    signupOtp: { type: String, select: false },
    signupOtpExpires: { type: Date },
    signupOtpAttempts: { type: Number, default: 0 },
    signupOtpLockUntil: { type: Date },
    signupOtpLastSentAt: { type: Date },

    // Forgot Password OTP fields
    resetOtp: { type: String, select: false },
    resetOtpExpires: { type: Date },
    resetOtpAttempts: { type: Number, default: 0 },
    resetOtpLockUntil: { type: Date },
    resetOtpLastSentAt: { type: Date },
  },
  { timestamps: true }
);

// Hash the password before saving, only if it changed
userSchema.pre("save", async function hashPassword(next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

module.exports = mongoose.model("User", userSchema);
