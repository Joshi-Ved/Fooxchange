"""Train a YOLOv8 model using Ultralytics.

Usage:
    python train_yolo.py --data training/yolo_dataset/dataset.yaml --epochs 50
"""
import argparse
from pathlib import Path


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--data', default='training/yolo_dataset/dataset.yaml', help='Path to dataset.yaml')
    p.add_argument('--epochs', type=int, default=50)
    p.add_argument('--imgsz', type=int, default=640)
    args = p.parse_args()

    try:
        from ultralytics import YOLO
    except Exception as e:
        raise SystemExit('Ultralytics package not installed. Run: pip install -r training/requirements.txt')

    model = YOLO('yolov8n.pt')
    print(f"Starting training: data={args.data} epochs={args.epochs} imgsz={args.imgsz}")
    model.train(data=args.data, epochs=args.epochs, imgsz=args.imgsz)


if __name__ == '__main__':
    main()
