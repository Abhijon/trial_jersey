# Product images

Every jersey photo used on the site lives in this one folder — that's on
purpose, so you can find and swap them without digging through code.

Right now it contains 8 placeholder SVGs (colored jersey shapes with a
number on them) so the site has something to show before you have real
product photography.

## To use your real photos

1. Add your photos here (jpg, png, or webp all work fine).
2. Update the `image` field for each product in `backend/seed/products.js`
   to the new filename, e.g.:
   ```js
   image: "/images/products/home-shirt-front.jpg",
   ```
3. Re-run `npm run seed` from the `backend/` folder to push the change into
   MongoDB.

Recommended: shoot or crop photos to a 3:4 portrait ratio (e.g. 1200×1600px)
— that's the ratio the product cards and detail page are built around.
