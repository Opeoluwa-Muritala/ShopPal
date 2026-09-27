"""Validation and normalization for vendor-supplied product images."""

from __future__ import annotations

import io
import warnings

from PIL import Image, ImageOps, UnidentifiedImageError

MAX_PRODUCT_IMAGE_UPLOAD_BYTES = 8 * 1024 * 1024
MAX_PRODUCT_IMAGE_PIXELS = 25_000_000
MAX_PRODUCT_IMAGE_DIMENSION = 1600
MAX_COMPRESSED_IMAGE_BYTES = 5 * 1024 * 1024
ALLOWED_IMAGE_FORMATS = {"JPEG", "PNG", "WEBP"}
ALLOWED_UPLOAD_MIME_TYPES = {"image/jpeg", "image/png", "image/webp"}
FORMAT_MIME_TYPES = {
    "JPEG": "image/jpeg",
    "PNG": "image/png",
    "WEBP": "image/webp",
}


class ProductImageError(ValueError):
    """Raised when an uploaded product image is unsafe or unsupported."""


def compress_product_image(content: bytes, declared_mime_type: str | None) -> bytes:
    """Decode, validate, orient, resize, and re-encode an image as metadata-free JPEG."""
    if not content:
        raise ProductImageError("Image file is empty")
    if len(content) > MAX_PRODUCT_IMAGE_UPLOAD_BYTES:
        raise ProductImageError("Image exceeds the 8MB upload limit")
    normalized_mime = (declared_mime_type or "").split(";", 1)[0].strip().lower()
    if normalized_mime not in ALLOWED_UPLOAD_MIME_TYPES:
        raise ProductImageError("Only JPEG, PNG, and WebP images are accepted")

    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(content)) as source:
                if source.format not in ALLOWED_IMAGE_FORMATS:
                    raise ProductImageError(
                        "Image content does not match an accepted image format"
                    )
                if FORMAT_MIME_TYPES[source.format] != normalized_mime:
                    raise ProductImageError(
                        "Declared image type does not match the file content"
                    )
                if source.width * source.height > MAX_PRODUCT_IMAGE_PIXELS:
                    raise ProductImageError("Image dimensions are too large")
                source.load()
                image = ImageOps.exif_transpose(source)
                if image.mode in {"RGBA", "LA"} or (
                    image.mode == "P" and "transparency" in image.info
                ):
                    rgba = image.convert("RGBA")
                    background = Image.new("RGB", rgba.size, "white")
                    background.paste(rgba, mask=rgba.getchannel("A"))
                    image = background
                else:
                    image = image.convert("RGB")
                image.thumbnail(
                    (MAX_PRODUCT_IMAGE_DIMENSION, MAX_PRODUCT_IMAGE_DIMENSION),
                    Image.Resampling.LANCZOS,
                )
                output = io.BytesIO()
                image.save(output, format="JPEG", quality=82, optimize=True)
    except ProductImageError:
        raise
    except (Image.DecompressionBombError, Image.DecompressionBombWarning) as exc:
        raise ProductImageError("Image dimensions are too large") from exc
    except (UnidentifiedImageError, OSError, SyntaxError, ValueError) as exc:
        raise ProductImageError("Image file is corrupt or unsupported") from exc

    compressed = output.getvalue()
    if len(compressed) > MAX_COMPRESSED_IMAGE_BYTES:
        raise ProductImageError("Compressed image remains too large")
    return compressed
