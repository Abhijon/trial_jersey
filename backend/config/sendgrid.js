const sgMail = require("@sendgrid/mail");

if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

/**
 * Send OTP email via SendGrid
 * @param {string} to - Recipient email
 * @param {string} subject - Email subject
 * @param {string} title - Heading text inside the template
 * @param {string} messageText - Message explaining what the OTP is for
 * @param {string} otp - 6 digit OTP string
 */
async function sendOtpEmail(to, subject, title, messageText, otp) {
  const fromEmail = process.env.SENDGRID_FROM_EMAIL || "no-reply@trailjerseys.com";

  const isStaticOtpEnabled = process.env.USE_STATIC_OTP === "true" || process.env.STATIC_OTP_ENABLED === "true";
  if (isStaticOtpEnabled) {
    console.log(`[Static OTP Enabled] Bypassing SendGrid API. Static OTP for ${to}: ${otp}`);
    return true;
  }

  if (!process.env.SENDGRID_API_KEY) {
    console.warn(`[SendGrid Warning] SENDGRID_API_KEY is not set. Simulated OTP for ${to}: ${otp}`);
    return true;
  }

  const htmlContent = `
    <div style="font-family: 'Segoe UI', Helvetica, Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 30px; background-color: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb;">
      <h2 style="color: #111827; margin-top: 0; font-size: 22px; font-weight: 700; text-align: center;">${title}</h2>
      <p style="color: #4b5563; font-size: 15px; line-height: 1.5; text-align: center; margin-bottom: 24px;">${messageText}</p>
      
      <div style="background-color: #ffffff; border: 2px dashed #3b82f6; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 24px;">
        <span style="font-size: 36px; font-weight: 800; tracking: 8px; color: #1d4ed8; letter-spacing: 6px; display: inline-block;">${otp}</span>
      </div>

      <p style="color: #6b7280; font-size: 13px; text-align: center; margin-bottom: 8px;">
        This code is valid for <strong>10 minutes</strong>. Do not share this OTP with anyone.
      </p>
      <p style="color: #9ca3af; font-size: 11px; text-align: center; margin-top: 24px; border-top: 1px solid #e5e7eb; padding-top: 16px;">
        If you did not request this email, please ignore it or contact support.
      </p>
    </div>
  `;

  const msg = {
    to,
    from: fromEmail,
    subject,
    text: `${messageText} Your verification code is: ${otp}. It expires in 10 minutes.`,
    html: htmlContent,
  };

  try {
    await sgMail.send(msg);
    console.log(`[SendGrid] OTP email sent successfully to ${to}`);
    return true;
  } catch (error) {
    console.error(`[SendGrid Error] Failed to send email to ${to}:`, error.response ? error.response.body : error.message);
    throw new Error("Failed to send OTP email via SendGrid. Please check SendGrid credentials.");
  }
}

/**
 * Send Signup Verification OTP
 */
async function sendSignupOtp(to, otp) {
  return sendOtpEmail(
    to,
    "Verify your email address - Trail",
    "Welcome to Trail!",
    "Thank you for signing up. Please use the verification code below to activate your account:",
    otp
  );
}

/**
 * Send Password Reset OTP
 */
async function sendResetPasswordOtp(to, otp) {
  return sendOtpEmail(
    to,
    "Password Reset Request - Trail",
    "Reset Your Password",
    "We received a request to reset your password. Use the verification code below to proceed with resetting your password:",
    otp
  );
}

module.exports = {
  sendSignupOtp,
  sendResetPasswordOtp,
};
