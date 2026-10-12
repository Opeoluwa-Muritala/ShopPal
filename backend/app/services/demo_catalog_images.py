"""Exact Droid demo image sources from the owner-approved import pack.

Bumpa's imported demo image paths returned 403 in live checks. These are
only the original illustrative images supplied for those same demo titles.
TODO(DROID_BUMPA_IMAGES): remove this fallback once the store images are
publicly fetchable. Never replace another merchant's product photographs.
"""

from uuid import UUID

DROID_DEMO_MERCHANT = UUID("c838c61f-9098-4f75-88f6-6b7a5d96ac19")
DEMO_IMAGES: dict[str, str] = {
    "Demo - Calvin Klein CK One - demo sample 1": "https://cdn.dummyjson.com/product-images/fragrances/calvin-klein-ck-one/1.webp",
    "Demo - Chanel Coco Noir Eau De - demo sample 1": "https://cdn.dummyjson.com/product-images/fragrances/chanel-coco-noir-eau-de/1.webp",
    "Demo - Dior J'adore - demo sample 1": "https://cdn.dummyjson.com/product-images/fragrances/dior-j'adore/1.webp",
    "Demo - Dolce Shine Eau de - demo sample 1": "https://cdn.dummyjson.com/product-images/fragrances/dolce-shine-eau-de/1.webp",
    "Demo - Gucci Bloom Eau de - demo sample 1": "https://cdn.dummyjson.com/product-images/fragrances/gucci-bloom-eau-de/1.webp",
    "Demo - Calvin Klein CK One - demo sample 2": "https://cdn.dummyjson.com/product-images/fragrances/calvin-klein-ck-one/1.webp",
    "Demo - Chanel Coco Noir Eau De - demo sample 2": "https://cdn.dummyjson.com/product-images/fragrances/chanel-coco-noir-eau-de/1.webp",
    "Demo - Dior J'adore - demo sample 2": "https://cdn.dummyjson.com/product-images/fragrances/dior-j'adore/1.webp",
    "Demo - Dolce Shine Eau de - demo sample 2": "https://cdn.dummyjson.com/product-images/fragrances/dolce-shine-eau-de/1.webp",
    "Demo - Gucci Bloom Eau de - demo sample 2": "https://cdn.dummyjson.com/product-images/fragrances/gucci-bloom-eau-de/1.webp",
    "Demo - Attitude Super Leaves Hand Soap - demo sample 1": "https://cdn.dummyjson.com/product-images/skin-care/attitude-super-leaves-hand-soap/1.webp",
    "Demo - Olay Ultra Moisture Shea Butter Body Wash - demo sample 1": "https://cdn.dummyjson.com/product-images/skin-care/olay-ultra-moisture-shea-butter-body-wash/1.webp",
    "Demo - Vaseline Men Body and Face Lotion - demo sample 1": "https://cdn.dummyjson.com/product-images/skin-care/vaseline-men-body-and-face-lotion/1.webp",
    "Demo - Attitude Super Leaves Hand Soap - demo sample 2": "https://cdn.dummyjson.com/product-images/skin-care/attitude-super-leaves-hand-soap/1.webp",
    "Demo - Olay Ultra Moisture Shea Butter Body Wash - demo sample 2": "https://cdn.dummyjson.com/product-images/skin-care/olay-ultra-moisture-shea-butter-body-wash/1.webp",
    "Demo - Vaseline Men Body and Face Lotion - demo sample 2": "https://cdn.dummyjson.com/product-images/skin-care/vaseline-men-body-and-face-lotion/1.webp",
    "Demo - Attitude Super Leaves Hand Soap - demo sample 3": "https://cdn.dummyjson.com/product-images/skin-care/attitude-super-leaves-hand-soap/1.webp",
    "Demo - Olay Ultra Moisture Shea Butter Body Wash - demo sample 3": "https://cdn.dummyjson.com/product-images/skin-care/olay-ultra-moisture-shea-butter-body-wash/1.webp",
    "Demo - Vaseline Men Body and Face Lotion - demo sample 3": "https://cdn.dummyjson.com/product-images/skin-care/vaseline-men-body-and-face-lotion/1.webp",
    "Demo - Attitude Super Leaves Hand Soap - demo sample 4": "https://cdn.dummyjson.com/product-images/skin-care/attitude-super-leaves-hand-soap/1.webp",
    "Demo - Blue Frock": "https://cdn.dummyjson.com/product-images/tops/blue-frock/1.webp",
    "Demo - Girl Summer Dress": "https://cdn.dummyjson.com/product-images/tops/girl-summer-dress/1.webp",
    "Demo - Gray Dress": "https://cdn.dummyjson.com/product-images/tops/gray-dress/1.webp",
    "Demo - Short Frock": "https://cdn.dummyjson.com/product-images/tops/short-frock/1.webp",
    "Demo - Tartan Dress": "https://cdn.dummyjson.com/product-images/tops/tartan-dress/1.webp",
    "Demo - Black Women's Gown": "https://cdn.dummyjson.com/product-images/womens-dresses/black-women's-gown/1.webp",
    "Demo - Corset Leather With Skirt": "https://cdn.dummyjson.com/product-images/womens-dresses/corset-leather-with-skirt/1.webp",
    "Demo - Corset With Black Skirt": "https://cdn.dummyjson.com/product-images/womens-dresses/corset-with-black-skirt/1.webp",
    "Demo - Dress Pea": "https://cdn.dummyjson.com/product-images/womens-dresses/dress-pea/1.webp",
    "Demo - Marni Red & Black Suit": "https://cdn.dummyjson.com/product-images/womens-dresses/marni-red-&-black-suit/1.webp",
    "Demo - Black Sun Glasses": "https://cdn.dummyjson.com/product-images/sunglasses/black-sun-glasses/1.webp",
    "Demo - Classic Sun Glasses": "https://cdn.dummyjson.com/product-images/sunglasses/classic-sun-glasses/1.webp",
    "Demo - Green and Black Glasses": "https://cdn.dummyjson.com/product-images/sunglasses/green-and-black-glasses/1.webp",
    "Demo - Party Glasses": "https://cdn.dummyjson.com/product-images/sunglasses/party-glasses/1.webp",
    "Demo - Sunglasses": "https://cdn.dummyjson.com/product-images/sunglasses/sunglasses/1.webp",
    "Demo - Blue Women's Handbag": "https://cdn.dummyjson.com/product-images/womens-bags/blue-women's-handbag/1.webp",
    "Demo - Heshe Women's Leather Bag": "https://cdn.dummyjson.com/product-images/womens-bags/heshe-women's-leather-bag/1.webp",
    "Demo - Prada Women Bag": "https://cdn.dummyjson.com/product-images/womens-bags/prada-women-bag/1.webp",
    "Demo - White Faux Leather Backpack": "https://cdn.dummyjson.com/product-images/womens-bags/white-faux-leather-backpack/1.webp",
    "Demo - Women Handbag Black": "https://cdn.dummyjson.com/product-images/womens-bags/women-handbag-black/1.webp"
}


def demo_image_url(merchant_id: UUID, product_name: str | None) -> str | None:
    if merchant_id != DROID_DEMO_MERCHANT:
        return None
    return DEMO_IMAGES.get(product_name or "")
