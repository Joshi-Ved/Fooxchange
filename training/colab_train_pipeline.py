"""
Google Colab-friendly end-to-end training pipeline for Fooxchange YOLO.

What this script does:
  1. Builds train/val/test from training_imageset.
  2. Trains YOLOv8 on GPU (if available).
  3. Evaluates on test split.
  4. Exports ONNX and writes class manifest.

Example (inside repo root in Colab):
  python training/colab_train_pipeline.py \
    --src training_imageset \
    --epochs 120 \
    --batch 16 \
    --imgsz 640 \
    --weights yolov8s.pt \
    --name food_yolo_colab
"""

import argparse
import shlex
import subprocess
import sys
from pathlib import Path


def run_cmd(parts: list[str]) -> None:
    print("\n$ " + " ".join(shlex.quote(part) for part in parts))
    subprocess.run(parts, check=True)


def main() -> None:
    parser = argparse.ArgumentParser(description="Fooxchange Colab YOLO training pipeline")

    parser.add_argument("--src", default="training_imageset", help="Source image root (new images included)")
    parser.add_argument("--out", default="training/yolo_dataset", help="Prepared YOLO dataset output")
    parser.add_argument("--classes", default="training/food_classes.yaml", help="Canonical class list")

    parser.add_argument("--val", type=float, default=0.1, help="Validation split fraction")
    parser.add_argument("--test", type=float, default=0.1, help="Test split fraction")
    parser.add_argument("--max-per-class", type=int, default=None, help="Optional class balancing cap")
    parser.add_argument("--seed", type=int, default=42, help="Random seed for split sampling")

    parser.add_argument("--epochs", type=int, default=120, help="Training epochs")
    parser.add_argument("--batch", type=int, default=16, help="Batch size")
    parser.add_argument("--imgsz", type=int, default=640, help="Image size")
    parser.add_argument("--weights", default="yolov8s.pt", help="Initial model weights")
    parser.add_argument("--workers", type=int, default=2, help="Data loader workers")
    parser.add_argument("--patience", type=int, default=20, help="Early stop patience")
    parser.add_argument("--lr0", type=float, default=0.01, help="Initial learning rate")
    parser.add_argument("--close-mosaic", type=int, default=15, help="Close mosaic in final epochs")
    parser.add_argument("--project", default="runs/detect", help="Training output project")
    parser.add_argument("--name", default="food_yolo_colab", help="Training run name")
    parser.add_argument("--min-map50", type=float, default=0.35, help="Train quality gate")

    parser.add_argument(
        "--allow-class-mismatch",
        action="store_true",
        help="Bypass strict class consistency checks",
    )
    parser.add_argument(
        "--skip-web-copy",
        action="store_true",
        help="Skip copy to public/models (recommended in Colab unless you need it)",
    )

    args = parser.parse_args()

    root = Path.cwd()
    if not (root / "training" / "prepare_dataset.py").exists():
        sys.exit(
            "❌ Run this from the repository root where training/prepare_dataset.py exists."
        )

    prep_cmd = [
        sys.executable,
        "training/prepare_dataset.py",
        "--src",
        args.src,
        "--out",
        args.out,
        "--val",
        str(args.val),
        "--test",
        str(args.test),
        "--classes",
        args.classes,
        "--seed",
        str(args.seed),
    ]
    if args.max_per_class is not None:
        prep_cmd.extend(["--max-per-class", str(args.max_per_class)])

    train_cmd = [
        sys.executable,
        "training/train_yolo.py",
        "--data",
        f"{args.out}/dataset.yaml",
        "--classes",
        args.classes,
        "--epochs",
        str(args.epochs),
        "--batch",
        str(args.batch),
        "--imgsz",
        str(args.imgsz),
        "--weights",
        args.weights,
        "--workers",
        str(args.workers),
        "--patience",
        str(args.patience),
        "--lr0",
        str(args.lr0),
        "--close-mosaic",
        str(args.close_mosaic),
        "--project",
        args.project,
        "--name",
        args.name,
        "--min-map50",
        str(args.min_map50),
    ]

    if args.allow_class_mismatch:
        train_cmd.append("--allow-class-mismatch")
    if args.skip_web_copy:
        train_cmd.append("--skip-web-copy")

    print("\n🍕 Fooxchange Colab pipeline starting")
    run_cmd(prep_cmd)
    run_cmd(train_cmd)

    run_dir = root / args.project / args.name
    print("\n✅ Pipeline complete")
    print(f"Run artifacts: {run_dir}")
    print(f"Best weights: {run_dir / 'weights' / 'best.pt'}")
    print(f"Test metrics: {run_dir / 'test_metrics.json'}")


if __name__ == "__main__":
    main()
