#!/usr/bin/env python3
"""
Reusable builder for `photo-set` Spot the Difference stages.

Usage:
  python build_photo_set.py <config.json>

Expected config.json shape:
{
  "stageId": "museum",
  "titleKo": "사라진 공룡 박물관",
  "exportPrefix": "MUSEUM",
  "seed": 20261127,
  "baseImage": "path/to/base.jpg",
  "sources": {
    "va": "path/to/var_a.jpg",
    "vb": "path/to/var_b.jpg"
  },
  "outDir": "d:/workspace/possiblemission/assets/images/spot-museum",
  "thumbPath": "d:/workspace/possiblemission/assets/images/spot-museum.jpg",
  "manifestPath": "d:/workspace/possiblemission/js/games/spot-museum-manifest.js",
  "imageCount": 20,
  "minPairDiffs": 9,
  "regions": [
    {
      "id": "dino_horn",
      "label": "티라노 이빨 장식",
      "box": [0.10, 0.12, 0.24, 0.30],
      "variants": ["va", "vb"],
      "subtle": false
    }
  ]
}
"""
import json
import os
import random
import sys
import numpy as np
from PIL import Image, ImageFilter

TARGET_W, TARGET_H = 1200, 896


def assert_disjoint_regions(regions):
    def to_union(spec):
        if isinstance(spec, dict):
            vals = list(spec.values())
            return (
                min(b[0] for b in vals),
                min(b[1] for b in vals),
                max(b[2] for b in vals),
                max(b[3] for b in vals),
            )
        return tuple(spec)

    boxes = [(r["id"], to_union(r["box"])) for r in regions]
    for i in range(len(boxes)):
        id_a, a = boxes[i]
        if not (0.0 <= a[0] < a[2] <= 1.0 and 0.0 <= a[1] < a[3] <= 1.0):
            raise ValueError(f"Invalid normalized box for {id_a}: {a}")
        for j in range(i + 1, len(boxes)):
            id_b, b = boxes[j]
            ox = min(a[2], b[2]) - max(a[0], b[0])
            oy = min(a[3], b[3]) - max(a[1], b[1])
            if ox > 0.0005 and oy > 0.0005:
                raise ValueError(f"Overlapping boxes: {id_a} {a} vs {id_b} {b}")


def build_patch_mask(box, src_arr, base_arr, W, H):
    x0, y0, x1, y1 = box
    px0, py0, px1, py1 = int(round(x0 * W)), int(round(y0 * H)), int(round(x1 * W)), int(round(y1 * H))
    pw, ph = px1 - px0, py1 - py0

    dist = np.linalg.norm(src_arr[py0:py1, px0:px1] - base_arr[py0:py1, px0:px1], axis=2)
    core = (dist > 26.0).astype(np.uint8) * 255
    mask_img = (
        Image.fromarray(core, mode="L")
        .filter(ImageFilter.MaxFilter(13))
        .filter(ImageFilter.MinFilter(3))
        .filter(ImageFilter.GaussianBlur(2.5))
    )
    alpha = np.asarray(mask_img, dtype=np.float32) / 255.0

    feather = 6
    wx = np.ones(pw, dtype=np.float32)
    wy = np.ones(ph, dtype=np.float32)
    if px0 > 4:
        wx[:feather] = np.linspace(0, 1, feather)
    if px1 < W - 4:
        wx[-feather:] = np.linspace(1, 0, feather)
    if py0 > 4:
        wy[:feather] = np.linspace(0, 1, feather)
    if py1 < H - 4:
        wy[-feather:] = np.linspace(1, 0, feather)
    alpha *= wy[:, None] * wx[None, :]
    return px0, py0, px1, py1, np.clip(alpha, 0.0, 1.0)


def hamming(a, b):
    return sum(1 for x, y in zip(a, b) if x != y)


def main(cfg_path):
    with open(cfg_path, "r", encoding="utf-8") as f:
        cfg = json.load(f)

    regions = cfg["regions"]
    if len(regions) < 18:
        raise ValueError(f"Expected >= 18 regions, got {len(regions)}")
    assert_disjoint_regions(regions)

    base_img = Image.open(cfg["baseImage"]).convert("RGB").resize((TARGET_W, TARGET_H), Image.Resampling.LANCZOS)
    W, H = base_img.size
    base_arr = np.asarray(base_img, dtype=np.float32)
    src_arrs = {
        k: np.asarray(Image.open(p).convert("RGB").resize((W, H), Image.Resampling.LANCZOS), dtype=np.float32)
        for k, p in cfg["sources"].items()
    }

    patches = {}
    region_meta = []
    for r_idx, reg in enumerate(regions):
        all_xs, all_ys = [], []
        box_spec = reg["box"]
        for v_idx, src_key in enumerate(reg["variants"], start=1):
            box = box_spec[src_key] if isinstance(box_spec, dict) else box_spec
            src_arr = src_arrs[src_key]
            px0, py0, px1, py1, alpha = build_patch_mask(box, src_arr, base_arr, W, H)
            patches[(r_idx, v_idx)] = (px0, py0, px1, py1, alpha, src_arr[py0:py1, px0:px1])
            dist = np.linalg.norm(src_arr[py0:py1, px0:px1] - base_arr[py0:py1, px0:px1], axis=2) * alpha
            ys, xs = np.where(dist > 28.0)
            if len(xs) > 0:
                all_xs.append(px0 + xs)
                all_ys.append(py0 + ys)
        if not all_xs:
            raise ValueError(f"No visible pixel difference detected for region {reg['id']}")
        xs_cat = np.concatenate(all_xs)
        ys_cat = np.concatenate(all_ys)
        cx = float(xs_cat.mean() / W)
        cy = float(ys_cat.mean() / H)
        dists = np.hypot(xs_cat / W - cx, (ys_cat / H - cy) * (H / W))
        r_val = float(max(0.050, min(0.088, np.percentile(dists, 90) + 0.012)))
        box_union = box_spec if not isinstance(box_spec, dict) else (
            min(b[0] for b in box_spec.values()),
            min(b[1] for b in box_spec.values()),
            max(b[2] for b in box_spec.values()),
            max(b[3] for b in box_spec.values()),
        )
        region_meta.append({
            "id": reg["id"],
            "label": reg["label"],
            "x": round(cx, 4),
            "y": round(cy, 4),
            "r": round(r_val, 4),
            "box": [round(v, 4) for v in box_union],
            "subtle": bool(reg.get("subtle", False)),
        })

    image_count = int(cfg.get("imageCount", 20))
    min_required = int(cfg.get("minPairDiffs", 9))
    rng = random.Random(int(cfg.get("seed", 20261127)))
    arities = [1 + len(r["variants"]) for r in regions]

    vectors = [[0] * len(regions)]
    while len(vectors) < image_count:
        best_cand = None
        best_score = (-1, -1)
        for _ in range(1000):
            cand = [rng.randrange(k) for k in arities]
            changes = sum(1 for x in cand if x != 0)
            if changes < max(6, min_required - 2) or changes > min(len(regions) - 4, 13):
                continue
            dists = [hamming(cand, v) for v in vectors]
            score = (min(dists), sum(dists))
            if score > best_score:
                best_score = score
                best_cand = cand
        vectors.append(best_cand)

    min_pair = min(hamming(vectors[i], vectors[j]) for i in range(image_count) for j in range(i + 1, image_count))
    max_pair = max(hamming(vectors[i], vectors[j]) for i in range(image_count) for j in range(i + 1, image_count))
    if min_pair < min_required:
        raise RuntimeError(f"Pair min diff {min_pair} < required {min_required}")

    out_dir = cfg["outDir"]
    os.makedirs(out_dir, exist_ok=True)
    stage_id = cfg["stageId"]

    image_entries = []
    rendered = []
    for idx, vec in enumerate(vectors, start=1):
        canvas = base_arr.copy()
        for r_idx, state in enumerate(vec):
            if state == 0:
                continue
            px0, py0, px1, py1, alpha, patch_rgb = patches[(r_idx, state)]
            a3 = alpha[:, :, None]
            canvas[py0:py1, px0:px1] = canvas[py0:py1, px0:px1] * (1.0 - a3) + patch_rgb * a3
        out_u8 = np.clip(np.round(canvas), 0, 255).astype(np.uint8)
        fname = f"{stage_id}-{idx:02d}.jpg"
        Image.fromarray(out_u8, mode="RGB").save(os.path.join(out_dir, fname), format="JPEG", quality=88, optimize=True)
        rendered.append(out_u8.astype(np.float32))
        image_entries.append({"src": f"./assets/images/spot-{stage_id}/{fname}", "states": vec})

    if cfg.get("thumbPath"):
        os.makedirs(os.path.dirname(cfg["thumbPath"]), exist_ok=True)
        base_img.save(cfg["thumbPath"], format="JPEG", quality=88, optimize=True)

    for r_idx, meta in enumerate(region_meta):
        cx, cy = int(meta["x"] * W), int(meta["y"] * H)
        rad = int(meta["r"] * W * 0.7)
        x0, x1 = max(0, cx - rad), min(W, cx + rad)
        y0, y1 = max(0, cy - rad), min(H, cy + rad)
        worst = 999.0
        for i in range(image_count):
            for j in range(i + 1, image_count):
                if vectors[i][r_idx] != vectors[j][r_idx]:
                    d = np.linalg.norm(rendered[i][y0:y1, x0:x1] - rendered[j][y0:y1, x0:x1], axis=2).mean()
                    worst = min(worst, d)
        print(f"{meta['id']:16s}: center=({meta['x']:.3f},{meta['y']:.3f}) r={meta['r']:.3f} worst_l2={worst:.2f}")

    prefix = cfg.get("exportPrefix", stage_id.upper())
    manifest_js = f"""/**
 * Auto-generated manifest for the {image_count}-image {cfg.get('titleKo', stage_id)} Spot-the-Difference pool.
 * Picking any 2 images (i !== j) guarantees at least {min_pair} distinct differences.
 */
export const {prefix}_REGIONS = {json.dumps(region_meta, ensure_ascii=False, indent=2)};

export const {prefix}_IMAGES = {json.dumps(image_entries, ensure_ascii=False, indent=2)};
"""
    os.makedirs(os.path.dirname(cfg["manifestPath"]), exist_ok=True)
    with open(cfg["manifestPath"], "w", encoding="utf-8") as f:
        f.write(manifest_js)

    print(f"Done! stage={stage_id}, images={image_count}, min_pair={min_pair}, max_pair={max_pair}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python build_photo_set.py <config.json>", file=sys.stderr)
        sys.exit(2)
    main(sys.argv[1])
