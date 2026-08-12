# Trail.com — Premium Football Jerseys

A single-page style store: Next.js/React frontend, Node/Express + MongoDB
backend, JWT-based auth, and server-side order handling.

```
trail-com/
├── backend/     Node + Express + MongoDB API (auth, products, orders)
└── frontend/    Next.js + React + Tailwind SPA
```

## 1. Replace the dummy photos

All placeholder jersey images live in **one folder**:

```
frontend/public/images/products/
```

There are 8 SVG placeholders (colored jersey shapes with a number on them),
one per seed product. To use your real photos:

1. Drop your real jersey photos into that same folder (jpg/png/webp all work).
2. Open `backend/seed/products.js` and update each product's `image` field
   to point at your new filename, e.g. `/images/products/home-shirt-1.jpg`.
3. Re-run the seed script (`npm run seed` in `backend/`) to push the updated
   catalog into MongoDB.

You never need to touch any component code to swap photos — everything
reads the `image` field from the database.

## 2. Backend setup

```bash
cd backend
cp .env.example .env      # then fill in MONGO_URI and JWT_SECRET
npm install
npm run seed               # loads the 8 dummy jerseys into MongoDB
npm run dev                 # starts the API on http://localhost:5000
```

`JWT_SECRET` should be a long random string — generate one with:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### API routes
| Method | Route              | Auth required | Purpose                          |
|--------|---------------------|:--:|-----------------------------------|
| POST   | /api/auth/signup     |    | Create an account                 |
| POST   | /api/auth/login      |    | Log in, returns a JWT             |
| GET    | /api/auth/me         | ✅ | Confirm the current session       |
| GET    | /api/products         |    | Browse all jerseys (supports `?kitType=`) |
| GET    | /api/products/:id     |    | Single jersey detail              |
| POST   | /api/orders           | ✅ | Place an order (price is always recalculated server-side) |
| GET    | /api/orders           | ✅ | List the logged-in user's own orders |

Security notes:
- Passwords are hashed with bcrypt, never stored in plain text.
- Every order route is behind `middleware/auth.js`, which verifies the JWT
  and attaches the real user from the database — the client can never claim
  to be someone else or fake an order total.
- Order prices are always re-read from the database, never trusted from
  the frontend request.

## 3. Frontend setup

```bash
cd frontend
cp .env.local.example .env.local   # points at your backend URL
npm install
npm run dev                         # starts the site on http://localhost:3000
```

### Pages
- `/` — hero + full jersey collection with kit-type filters
- `/product/[id]` — jersey detail, size picker, add to order
- `/login`, `/signup` — auth forms
- `/orders` — the logged-in user's own order history (protected, redirects to `/login` if not signed in)

All site copy (headlines, buttons, empty states) lives in one file:
`frontend/content/copy.js` — edit it there and it updates everywhere.

## 4. What's intentionally left out for now

- Payment integration — orders are recorded but not charged. Wire in Stripe/Razorpay
  later inside `backend/routes/orders.js`.
- Admin panel for adding/editing products — for now, edit `backend/seed/products.js`
  and re-run `npm run seed`, or insert directly into MongoDB.
- Image upload/CDN — swap files directly into `frontend/public/images/products/`
  for now; move to S3/Cloudinary later if needed.
