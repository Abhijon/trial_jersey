// All the words on the site, kept in one place so they're easy to tweak
// without hunting through components.

const copy = {
  brand: {
    name: "Trial",
    domain: "trail.com",
    tagline: "Wear the badge, not just the colour.",
  },

  nav: {
    shop: "Shop",
    orders: "My Orders",
    login: "Log In",
    signup: "Sign Up",
    logout: "Log Out",
  },

  hero: {
    eyebrow: "2026/27 COLLECTION",
    headline: "Every stitch has a story",
    subhead:
      "Match-grade football jerseys, made the way the club actually wears them. No knock-offs, no shortcuts — just the kit, done right.",
    ctaPrimary: "Shop the Collection",
    ctaSecondary: "Find Your Size",
  },

  trustBar: [
    "Match-grade fabric",
    "Free returns within 30 days",
    "Numbers & names, done properly",
    "Authenticity you can check",
  ],

  shop: {
    heading: "The Collection",
    subheading: "Home, away, retro, and the shirts you only hear about second-hand.",
    emptyState: "No jerseys match that filter yet. Try clearing it and browsing everything.",
    filterAll: "All Kits",
  },

  product: {
    sizeLabel: "Select Size",
    sizeGuideLink: "Size guide",
    addToCart: "Add to Order",
    outOfStock: "Currently Out of Stock",
    descriptionHeading: "The Details",
    careHeading: "Care Instructions",
    careText:
      "Cold wash, inside out, no tumble dry. Treat the badge like you'd treat the win — carefully.",
  },

  auth: {
    loginHeading: "Welcome back.",
    loginSubheading: "Log in to pick up your order where you left off.",
    signupHeading: "Join the squad.",
    signupSubheading: "Create an account to track orders and save your kit sizes.",
    nameLabel: "Full Name",
    emailLabel: "Email",
    passwordLabel: "Password",
    loginButton: "Log In",
    signupButton: "Create Account",
    switchToSignup: "New here? Create an account",
    switchToLogin: "Already have an account? Log in",
  },

  orders: {
    heading: "My Orders",
    subheading: "Everything you've picked up from Trail, in one place.",
    emptyState: "No orders yet. When you place one, it'll show up here.",
    emptyCta: "Browse the Collection",
    placedOn: "Placed on",
    status: "Status",
  },

  footer: {
    about:
      "trailis an independent kit shop for people who take their club colours seriously. Founded on the terraces, built for match day.",
    shopHeading: "Shop",
    helpHeading: "Help",
    helpLinks: ["Size Guide", "Shipping & Returns", "Track an Order", "Contact Us"],
    copyright: `© ${new Date().getFullYear()} Trail.com — All rights reserved.`,
  },
};

export default copy;
