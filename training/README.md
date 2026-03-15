# Training (YOLOv8) quick start

This folder provides a minimal workflow to train an object detector from a class-folder dataset (useful when images contain a single centered object).

Steps:

1. Install Python 3.10+ and create a virtualenv.

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r training/requirements.txt
```

2. Unzip your dataset into the repository root as `training_imageset/` where each class is a folder, e.g. `training_imageset/apple/*.jpg`.

3. Prepare the YOLO dataset (creates `training/yolo_dataset`):

```powershell
python training/prepare_dataset.py --src training_imageset --out training/yolo_dataset
```

4. Train with YOLOv8 (works offline after first `yolov8n.pt` download):

```powershell
python training/train_yolo.py --data training/yolo_dataset/dataset.yaml --epochs 50
```

Notes:
- This creates a simple single-bbox label per image. For robust detection you should annotate true bounding boxes with a labeling tool (LabelImg, CVAT, Roboflow) and replace the generated labels.
- After training you can export the model to different formats with Ultralytics: `model.export(format=['onnx','tf','tflite','torchscript','coreml','tfjs'])`.
