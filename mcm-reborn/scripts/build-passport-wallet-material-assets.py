"""Extract the passport-wallet PBR maps and build its reviewed exterior mask.

This is a one-time asset-authoring helper, not an application runtime dependency.
It requires Pillow and NumPy and intentionally fails if the source GLB layout or
the resulting mask coverage changes outside the reviewed bounds.
"""

from __future__ import annotations

import hashlib
import io
import json
import struct
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter


APP_ROOT = Path(__file__).resolve().parents[1]
MODEL_PATH = APP_ROOT / "public/assets/models/reborn-passport-wallet.glb"
OUTPUT_DIR = APP_ROOT / "public/assets/models/reborn-passport-wallet"

GLB_JSON_CHUNK = 0x4E4F534A
GLB_BIN_CHUNK = 0x004E4942
EXPECTED_TEXTURE_SIZE = (2048, 2048)


def read_glb(path: Path) -> tuple[dict, bytes]:
    data = path.read_bytes()
    if len(data) < 20:
        raise RuntimeError("Passport-wallet GLB is truncated")

    magic, version, declared_length = struct.unpack_from("<4sII", data, 0)
    if magic != b"glTF" or version != 2 or declared_length != len(data):
        raise RuntimeError("Passport-wallet GLB header is invalid")

    json_chunk: bytes | None = None
    binary_chunk: bytes | None = None
    cursor = 12
    while cursor < len(data):
        chunk_length, chunk_type = struct.unpack_from("<II", data, cursor)
        cursor += 8
        chunk = data[cursor : cursor + chunk_length]
        cursor += chunk_length
        if chunk_type == GLB_JSON_CHUNK:
            json_chunk = chunk
        elif chunk_type == GLB_BIN_CHUNK:
            binary_chunk = chunk

    if json_chunk is None or binary_chunk is None:
        raise RuntimeError("Passport-wallet GLB must contain JSON and BIN chunks")
    return json.loads(json_chunk.rstrip(b"\x00 \t\r\n")), binary_chunk


def embedded_image(document: dict, binary: bytes, texture_index: int) -> bytes:
    texture = document["textures"][texture_index]
    image = document["images"][texture["source"]]
    view = document["bufferViews"][image["bufferView"]]
    start = int(view.get("byteOffset", 0))
    end = start + int(view["byteLength"])
    payload = binary[start:end]
    if not payload.startswith(b"\xff\xd8\xff"):
        raise RuntimeError("Expected an embedded JPEG texture")
    return payload


def save_jpeg(payload: bytes, filename: str) -> Image.Image:
    image = Image.open(io.BytesIO(payload)).convert("RGB")
    if image.size != EXPECTED_TEXTURE_SIZE:
        raise RuntimeError(f"Unexpected {filename} size: {image.size}")
    (OUTPUT_DIR / filename).write_bytes(payload)
    return image


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> None:
    document, binary = read_glb(MODEL_PATH)
    materials = document.get("materials", [])
    if len(materials) != 1 or materials[0].get("name") != "Material_0":
        raise RuntimeError("The reviewed mask only supports the single Material_0 GLB")

    material = materials[0]
    pbr = material["pbrMetallicRoughness"]
    base_payload = embedded_image(document, binary, pbr["baseColorTexture"]["index"])
    normal_payload = embedded_image(document, binary, material["normalTexture"]["index"])
    metallic_payload = embedded_image(
        document,
        binary,
        pbr["metallicRoughnessTexture"]["index"],
    )

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    base = save_jpeg(base_payload, "original-base-color.jpg")
    save_jpeg(normal_payload, "original-normal.jpg")
    metallic_roughness = save_jpeg(
        metallic_payload,
        "original-metallic-roughness.jpg",
    )

    base_pixels = np.asarray(base, dtype=np.int16)
    mr_pixels = np.asarray(metallic_roughness, dtype=np.int16)
    red = base_pixels[:, :, 0]
    green = base_pixels[:, :, 1]
    blue = base_pixels[:, :, 2]
    metallic = mr_pixels[:, :, 2]

    # The reviewed source atlas uses saturated red for replaceable exterior,
    # magenta for zipper tape, pale yellow for hardware and dark pixels for
    # stitching/logos. Preserve the latter three groups deterministically.
    safe_red = np.maximum(red, 1)
    exterior = (
        (red >= 70)
        & ((red - green) >= 35)
        & ((blue / safe_red) <= 0.48)
        & (metallic < 96)
    )
    hardware = metallic >= 128
    zipper = (
        (red >= 70)
        & (blue >= 55)
        & ((blue / safe_red) > 0.48)
        & ((red - green) >= 20)
        & ~hardware
    )

    # Erode two UV pixels and soften one pixel so mipmaps cannot bleed a new
    # material into the original zipper/hardware boundaries.
    mask = Image.fromarray((exterior.astype(np.uint8) * 255), mode="L")
    mask = mask.filter(ImageFilter.MinFilter(5)).filter(
        ImageFilter.GaussianBlur(radius=1.0)
    )
    mask.save(OUTPUT_DIR / "exterior-mask.png", optimize=True)

    mask_pixels = np.asarray(mask)
    material_ids = np.zeros((*EXPECTED_TEXTURE_SIZE[::-1], 3), dtype=np.uint8)
    material_ids[mask_pixels >= 128] = (239, 68, 68)  # replaceable exterior
    material_ids[zipper] = (214, 53, 142)  # zipper / trim retained in MVP
    material_ids[hardware] = (242, 184, 72)  # metallic hardware retained
    Image.fromarray(material_ids, mode="RGB").save(
        OUTPUT_DIR / "material-id-map.png",
        optimize=True,
    )

    exterior_coverage = float(np.mean(mask_pixels >= 128))
    hardware_coverage = float(np.mean(hardware))
    if not 0.75 <= exterior_coverage <= 0.90:
        raise RuntimeError(
            f"Exterior mask coverage {exterior_coverage:.4f} is outside reviewed bounds"
        )
    if not 0.002 <= hardware_coverage <= 0.02:
        raise RuntimeError(
            f"Hardware coverage {hardware_coverage:.4f} is outside reviewed bounds"
        )

    manifest = {
        "schemaVersion": "MCM_PASSPORT_WALLET_MATERIAL_MAP_V1",
        "sourceGlb": {
            "path": MODEL_PATH.name,
            "sha256": sha256(MODEL_PATH),
        },
        "atlasSize": list(EXPECTED_TEXTURE_SIZE),
        "exteriorMask": {
            "path": "exterior-mask.png",
            "sha256": sha256(OUTPUT_DIR / "exterior-mask.png"),
            "replaceableCoverage": round(exterior_coverage, 6),
            "meaning": "white=replaceable exterior; black=preserve original",
        },
        "materialIdMap": {
            "path": "material-id-map.png",
            "sha256": sha256(OUTPUT_DIR / "material-id-map.png"),
            "colors": {
                "#ef4444": "BODY_EXTERIOR_REPLACE",
                "#d6358e": "ZIPPER_OR_TRIM_KEEP",
                "#f2b848": "HARDWARE_KEEP",
                "#000000": "DETAIL_OR_UNUSED_KEEP",
            },
        },
        "originalMaps": {
            name: sha256(OUTPUT_DIR / name)
            for name in (
                "original-base-color.jpg",
                "original-normal.jpg",
                "original-metallic-roughness.jpg",
            )
        },
    }
    (OUTPUT_DIR / "material-assets.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    print(
        f"Wrote passport-wallet material assets: exterior={exterior_coverage:.2%}, "
        f"hardware={hardware_coverage:.2%}"
    )


if __name__ == "__main__":
    main()
