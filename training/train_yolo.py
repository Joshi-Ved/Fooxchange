"""
Train a YOLOv8 model on food/ingredient images for Fooxchange.

Pipeline:
  1. Prepare dataset  : python training/prepare_dataset.py (see script)
  2. Train YOLO       : python training/train_yolo.py
  3. Export to ONNX   : automatically done at the end of training
  4. Copy to web app  : python training/train_yolo.py --export-only

Web integration:
  The exported ONNX model is copied to public/models/food-yolo/
  and used by the camera scanner via ONNX Runtime Web.

Usage:
  # Full training run (GPU recommended):
  python training/train_yolo.py --epochs 100 --batch 16

  # Fast test run:
  python training/train_yolo.py --epochs 5 --batch 8 --imgsz 320

  # Only export a previously trained model:
  python training/train_yolo.py --export-only --weights runs/detect/food_yolo/weights/best.pt

  # Resume interrupted training:
  python training/train_yolo.py --resume
"""

import argparse
import csv
import json
import shutil
import sys
from pathlib import Path


# ─────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────

def require_ultralytics():
    try:
        from ultralytics import YOLO  # noqa: F401
    except ImportError:
        sys.exit(
            "❌  Ultralytics not installed.\n"
            "    Run:  pip install -r training/requirements.txt"
        )


def export_to_onnx(weights: Path, imgsz: int) -> Path:
    """Export a trained YOLOv8 model to ONNX format."""
    from ultralytics import YOLO

    print(f"\n📦  Exporting {weights} → ONNX …")
    model = YOLO(str(weights))
    model.export(
        format="onnx",
        imgsz=imgsz,
        simplify=True,          # simplify ONNX graph (onnxsim)
        opset=17,               # opset 17 is widely supported
        dynamic=False,          # fixed input shape is faster in browser
        half=False,             # float32 for browser compatibility
    )
    onnx_path = weights.parent / (weights.stem + ".onnx")
    print(f"✅  ONNX model: {onnx_path}")
    return onnx_path


def load_names_from_yaml(yaml_path: Path) -> list[str]:
    try:
        import yaml
    except ImportError:
        sys.exit("❌  PyYAML not installed. Run: pip install pyyaml")

    if not yaml_path.exists():
        sys.exit(f"❌  YAML file not found: {yaml_path}")

    with open(yaml_path, "r", encoding="utf-8") as handle:
        data = yaml.safe_load(handle) or {}

    raw_names = data.get("names", {})
    if isinstance(raw_names, list):
        names = [str(name).strip() for name in raw_names]
    elif isinstance(raw_names, dict):
        names = [
            str(value).strip()
            for _, value in sorted(raw_names.items(), key=lambda item: int(item[0]))
        ]
    else:
        sys.exit(f"❌  Unsupported names structure in {yaml_path}")

    return [name for name in names if name]


def normalize_name(value: str) -> str:
    return value.strip().lower().replace("-", "_").replace(" ", "_")


def validate_class_consistency(data_yaml: Path, classes_yaml: Path, strict: bool = True) -> tuple[list[str], list[str]]:
    data_names = load_names_from_yaml(data_yaml)
    canonical_names = load_names_from_yaml(classes_yaml)

    normalized_data = [normalize_name(name) for name in data_names]
    normalized_canonical = [normalize_name(name) for name in canonical_names]

    missing_in_data = sorted(set(normalized_canonical) - set(normalized_data))
    extra_in_data = sorted(set(normalized_data) - set(normalized_canonical))

    if missing_in_data or extra_in_data:
        print("\n⚠️  Class taxonomy mismatch detected:")
        print(f"    data classes      : {len(normalized_data)}")
        print(f"    canonical classes : {len(normalized_canonical)}")
        if missing_in_data:
            print(f"    Missing in dataset (sample): {missing_in_data[:10]}")
        if extra_in_data:
            print(f"    Extra in dataset (sample)  : {extra_in_data[:10]}")

        if strict:
            sys.exit(
                "❌  Class mismatch would cause deployment drift/confusion. "
                "Rebuild dataset with canonical classes or pass --allow-class-mismatch to bypass."
            )

    return data_names, canonical_names


def read_training_metrics_csv(results_csv: Path) -> dict[str, float] | None:
    if not results_csv.exists():
        return None

    with open(results_csv, "r", encoding="utf-8") as handle:
        rows = list(csv.DictReader(handle))

    if not rows:
        return None

    last = rows[-1]
    metrics: dict[str, float] = {}
    for key in ["metrics/mAP50(B)", "metrics/mAP50-95(B)", "metrics/precision(B)", "metrics/recall(B)"]:
        try:
            metrics[key] = float(last.get(key, "nan"))
        except ValueError:
            metrics[key] = float("nan")
    return metrics


def infer_manifest_model_name(weights_arg: str) -> str:
    stem = Path(weights_arg).name.lower()
    if "yolov8s" in stem:
        return "food-yolo-v8s"
    if "yolov8m" in stem:
        return "food-yolo-v8m"
    if "yolov8l" in stem:
        return "food-yolo-v8l"
    if "yolov8x" in stem:
        return "food-yolo-v8x"
    return "food-yolo-v8n"


def build_class_manifest(manifest_source: Path, out_dir: Path, model_name: str):
    """Write a classes.json manifest consumed by the web app."""
    try:
        import yaml  # pip install pyyaml (included in ultralytics)
    except ImportError:
        sys.exit("❌  PyYAML not installed. Run: pip install pyyaml")

    with open(manifest_source) as f:
        data = yaml.safe_load(f)

    raw_names = data.get("names", {})
    if isinstance(raw_names, list):
        names = {str(index): name for index, name in enumerate(raw_names)}
    elif isinstance(raw_names, dict):
        names = {str(key): value for key, value in sorted(raw_names.items(), key=lambda item: int(item[0]))}
    else:
        sys.exit(f"❌  Unsupported names structure in {manifest_source}")

    manifest = {
        "version": "1.0",
        "model": model_name,
        "classes": names,
        "nc": data.get("nc", len(names)),
    }

    out_dir.mkdir(parents=True, exist_ok=True)
    manifest_path = out_dir / "classes.json"
    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2)

    print(f"📝  Class manifest: {manifest_path}")
    return manifest_path


def copy_to_public(onnx_path: Path, manifest_path: Path):
    """Copy ONNX model + manifest to public/models/food-yolo/ for the web app."""
    # Determine project root (two levels up from training/)
    project_root = Path(__file__).parent.parent
    dest_dir = project_root / "public" / "models" / "food-yolo"
    dest_dir.mkdir(parents=True, exist_ok=True)

    dest_onnx = dest_dir / "food_yolo.onnx"
    dest_manifest = dest_dir / "classes.json"

    shutil.copy2(onnx_path, dest_onnx)
    shutil.copy2(manifest_path, dest_manifest)

    print(
        f"\n🚀  Model copied to web app:\n"
        f"    {dest_onnx}\n"
        f"    {dest_manifest}\n"
        f"\n    The camera scanner will auto-detect and use this model."
    )


# ─────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Train YOLOv8 food detection model")

    # Data
    parser.add_argument(
        "--data",
        default="training/yolo_dataset/dataset.yaml",
        help="Path to dataset.yaml (created by prepare_dataset.py)",
    )
    parser.add_argument(
        "--classes",
        default="training/food_classes.yaml",
        help="Path to food_classes.yaml",
    )

    # Training hypers
    parser.add_argument("--epochs",   type=int, default=100,   help="Number of training epochs")
    parser.add_argument("--batch",    type=int, default=16,    help="Batch size (-1 = auto)")
    parser.add_argument("--imgsz",    type=int, default=640,   help="Input image size")
    parser.add_argument("--device",   default="",              help="Compute device: cpu | 0 | 0,1 (default: auto)")
    parser.add_argument("--workers",  type=int, default=4,     help="DataLoader workers")
    parser.add_argument("--patience", type=int, default=20,    help="Early-stop patience (epochs)")
    parser.add_argument("--lr0",      type=float, default=0.01, help="Initial learning rate")

    # Logging
    parser.add_argument("--project", default="runs/detect", help="Output project dir")
    parser.add_argument("--name",    default="food_yolo",   help="Experiment name")

    # Model
    parser.add_argument(
        "--weights",
        default="yolov8s.pt",
        help="Starting weights: yolov8n.pt | yolov8s.pt | yolov8m.pt | path/to/custom.pt",
    )
    parser.add_argument(
        "--close-mosaic",
        type=int,
        default=15,
        help="Disable mosaic augmentation for the final N epochs to improve localization precision",
    )

    # Modes
    parser.add_argument(
        "--resume",
        action="store_true",
        help="Resume from last checkpoint",
    )
    parser.add_argument(
        "--export-only",
        action="store_true",
        dest="export_only",
        help="Skip training; only export & copy an existing model",
    )
    parser.add_argument(
        "--allow-class-mismatch",
        action="store_true",
        help="Allow training/export even when dataset classes don't match canonical classes",
    )
    parser.add_argument(
        "--min-map50",
        type=float,
        default=0.35,
        help="Minimum mAP50 required to pass quality gate before deployment copy",
    )

    args = parser.parse_args()
    project_dir = Path(args.project).resolve()

    require_ultralytics()

    # ── Locate weights for export-only mode ──────────────────────────────────
    if args.export_only:
        weights_path = Path(args.weights)
        if not weights_path.exists():
            # Try the default training output location
            weights_path = project_dir / args.name / "weights" / "best.pt"
        if not weights_path.exists():
            sys.exit(f"❌  No weights found. Pass --weights <path/to/best.pt>")
    else:
        # ── Training ──────────────────────────────────────────────────────────
        data_yaml = Path(args.data)
        classes_yaml = Path(args.classes)
        if not data_yaml.exists():
            sys.exit(
                f"❌  Dataset yaml not found: {data_yaml}\n"
                f"    Run prepare_dataset.py first:\n"
                f"      python training/prepare_dataset.py "
                f"--src training_imageset/archive --out training/yolo_dataset"
            )

        validate_class_consistency(
            data_yaml=data_yaml,
            classes_yaml=classes_yaml,
            strict=not args.allow_class_mismatch,
        )

        print(
            f"\n🍕  Fooxchange Food YOLO Training\n"
            f"    Weights  : {args.weights}\n"
            f"    Data     : {data_yaml}\n"
            f"    Epochs   : {args.epochs}\n"
            f"    Batch    : {args.batch}\n"
            f"    Image sz : {args.imgsz}\n"
            f"    Device   : {args.device or 'auto'}\n"
        )

        from ultralytics import YOLO
        model = YOLO(args.weights)

        model.train(
            data=str(data_yaml),
            epochs=args.epochs,
            batch=args.batch,
            imgsz=args.imgsz,
            device=args.device if args.device else None,
            workers=args.workers,
            patience=args.patience,
            lr0=args.lr0,
            project=str(project_dir),
            name=args.name,
            resume=args.resume,
            # Augmentation tweaks for food images
            hsv_h=0.015,   # colour hue shift
            hsv_s=0.7,     # saturation
            hsv_v=0.4,     # brightness
            degrees=10,    # rotation (±10°)
            translate=0.1,
            scale=0.5,
            fliplr=0.5,
            mosaic=1.0,    # mosaic augmentation
            mixup=0.0,     # keep produce boundaries clean (less tomato/apple blending)
            close_mosaic=args.close_mosaic,
            # Logging
            verbose=True,
            save=True,
            save_period=10,  # save checkpoint every 10 epochs
        )

        # Best weights path after training
        weights_path = project_dir / args.name / "weights" / "best.pt"

        # Quick quality gate from final metrics row.
        results_csv = project_dir / args.name / "results.csv"
        metrics = read_training_metrics_csv(results_csv)
        if metrics is not None:
            map50 = metrics.get("metrics/mAP50(B)", float("nan"))
            map5095 = metrics.get("metrics/mAP50-95(B)", float("nan"))
            precision = metrics.get("metrics/precision(B)", float("nan"))
            recall = metrics.get("metrics/recall(B)", float("nan"))
            print(
                "\n📊 Final metrics summary:\n"
                f"    mAP50     : {map50:.4f}\n"
                f"    mAP50-95  : {map5095:.4f}\n"
                f"    Precision : {precision:.4f}\n"
                f"    Recall    : {recall:.4f}"
            )
            if map50 < args.min_map50:
                sys.exit(
                    f"❌  Quality gate failed: mAP50={map50:.4f} < {args.min_map50:.4f}. "
                    "Model not suitable for deployment yet."
                )

    # ── Export ────────────────────────────────────────────────────────────────
    if not weights_path.exists():
        print(f"⚠️  best.pt not found at {weights_path}; using last.pt")
        weights_path = weights_path.parent / "last.pt"

    onnx_path = export_to_onnx(weights_path, args.imgsz)

    # ── Write class manifest ──────────────────────────────────────────────────
    temp_manifest_dir = project_dir / args.name
    manifest_source = Path(args.data)
    if not manifest_source.exists():
        manifest_source = Path(args.classes)
    model_name = infer_manifest_model_name(args.weights)
    manifest_path = build_class_manifest(manifest_source, temp_manifest_dir, model_name)

    # ── Copy to public/ for the web app ──────────────────────────────────────
    copy_to_public(onnx_path, manifest_path)

    print("\n🎉  Done! Model is ready to use in the camera scanner.")
    print("    Run the Next.js dev server and open the camera scanner to test.")


if __name__ == "__main__":
    main()
