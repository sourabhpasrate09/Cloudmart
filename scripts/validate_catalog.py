from pathlib import Path
import json,re,sys
root=Path(__file__).resolve().parents[1]; front=root/"frontend"
text=(front/"product-data.js").read_text(encoding="utf-8")
m=re.search(r"window\.CLOUDMART_PRODUCT_DATA=(.*);\s*$",text,re.S); data=json.loads(m.group(1))
assert len(data)==311 and list(map(int,data))==list(range(1,312))
assert all((front/p["image"]).exists() for p in data.values())
assert len(list(front.glob("product-*.html")))==311
print("Catalog OK: 311 products, 311 detail pages, all images present.")
