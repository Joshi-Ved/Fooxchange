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


def build_class_manifest(classes_yaml: Path, out_dir: Path):
    """Write a classes.json manifest consumed by the web app."""
    try:
        import yaml  # pip install pyyaml (included in ultralytics)
    except ImportError:
        sys.exit("❌  PyYAML not installed. Run: pip install pyyaml")

    with open(classes_yaml) as f:
        data = yaml.safe_load(f)

    names: dict = data.get("names", {})
    manifest = {
        "version": "1.0",
        "model": "food-yolo-v8n",
        "classes": {str(k): v for k, v in names.items()},
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
        default="yolov8n.pt",
        help="Starting weights: yolov8n.pt | yolov8s.pt | yolov8m.pt | path/to/custom.pt",
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

    args = parser.parse_args()

    require_ultralytics()

    # ── Locate weights for export-only mode ──────────────────────────────────
    if args.export_only:
        weights_path = Path(args.weights)
        if not weights_path.exists():
            # Try the default training output location
            weights_path = Path(args.project) / args.name / "weights" / "best.pt"
        if not weights_path.exists():
            sys.exit(f"❌  No weights found. Pass --weights <path/to/best.pt>")
    else:
        # ── Training ──────────────────────────────────────────────────────────
        data_yaml = Path(args.data)
        if not data_yaml.exists():
            sys.exit(
                f"❌  Dataset yaml not found: {data_yaml}\n"
                f"    Run prepare_dataset.py first:\n"
                f"      python training/prepare_dataset.py "
                f"--src training_imageset/archive --out training/yolo_dataset"
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
            project=args.project,
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
            mixup=0.1,     # mixup augmentation
            # Logging
            verbose=True,
            save=True,
            save_period=10,  # save checkpoint every 10 epochs
        )

        # Best weights path after training
        weights_path = Path(args.project) / args.name / "weights" / "best.pt"

    # ── Export ────────────────────────────────────────────────────────────────
    if not weights_path.exists():
        print(f"⚠️  best.pt not found at {weights_path}; using last.pt")
        weights_path = weights_path.parent / "last.pt"

    onnx_path = export_to_onnx(weights_path, args.imgsz)

    # ── Write class manifest ──────────────────────────────────────────────────
    temp_manifest_dir = Path(args.project) / args.name
    manifest_path = build_class_manifest(Path(args.classes), temp_manifest_dir)

    # ── Copy to public/ for the web app ──────────────────────────────────────
    copy_to_public(onnx_path, manifest_path)

    print("\n🎉  Done! Model is ready to use in the camera scanner.")
    print("    Run the Next.js dev server and open the camera scanner to test.")


if __name__ == "__main__":
    main()
