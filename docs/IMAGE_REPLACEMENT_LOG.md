# Product image replacement

The project owner supplied a second archive named `products.zip` containing 123 files named `product-###.jpg`. Those files were copied into `frontend/images/products/` using the exact same filenames; no product image filenames were changed. Existing images for the other catalog IDs remain in place.

The frontend uses `object-fit: contain` for product-card and detail images so portrait/landscape source images are displayed without cropping.
