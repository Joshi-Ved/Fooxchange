# Fooxchange - Food YOLO Training Pipeline

Train a YOLOv8 model to detect food ingredients from camera images.
The trained ONNX model is exported to `public/models/food-yolo/` and used
by the camera scanner in the web app to suggest recipes.

---

## Quick Start

### 1. Python environment

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r training/requirements.txt
```

### 2. Prepare images

Organize your training images like this (one folder per ingredient class):

```
training_imageset/
  apple/
    001.jpg
  tomato/
    001.jpg
  onion/
    001.jpg
```

Folder names should match `food_classes.yaml` class names.
Free datasets: Kaggle Food-101, Fruits-360, or your own photos.

### 3. Prepare YOLO dataset

```powershell
python training/prepare_dataset.py --src training_imageset/archive --out training/yolo_dataset
```

### 4. Train the model

```powershell
# GPU recommended
python training/train_yolo.py --epochs 100 --batch 16

# CPU only
python training/train_yolo.py --epochs 50 --batch 8 --device cpu

# Quick sanity check (5 epochs)
python training/train_yolo.py --epochs 5 --batch 8 --imgsz 320
```

Training automatically exports the best ONNX model to `public/models/food-yolo/`.

### 5. Resume interrupted training

```powershell
python training/train_yolo.py --resume
```

### 6. Export only

```powershell
python training/train_yolo.py --export-only --weights runs/detect/food_yolo/weights/best.pt
```

---

## Web App Flow

1. User opens Camera Scanner
2. Model detects ingredients live with bounding boxes
3. User presses **Suggest Recipes** -> `/api/ai/from-image`
4. API matches ingredients to recipes with a match score
5. Results shown in camera overlay; tap recipe to open it

---

## Food Classes (88 classes in food_classes.yaml)

- Fruits: apple, banana, orange, mango, avocado, strawberry ...
- Vegetables: tomato, onion, garlic, carrot, broccoli, capsicum ...
- Proteins: chicken, egg, fish, paneer, tofu, lentils, chickpeas ...
- Grains & Dairy: rice, bread, pasta, cheese, yogurt, butter ...
- Spices: turmeric, cumin, coriander, cardamom, cinnamon ...
- Dishes: curry, biryani, pizza, sandwich, soup, fried_rice ...

---

## Model Size Guide

| Weights    | Params | Speed  | Use case             |
|------------|--------|--------|----------------------|
| yolov8n.pt | 3.2M   | Fastest| Mobile / CPU         |
| yolov8s.pt | 11.2M  | Fast   | Laptop (recommended) |
| yolov8m.pt | 25.9M  | Medium | Desktop GPU          |

Use `--weights yolov8s.pt` for better accuracy on laptops.

## Notes

- ONNX model runs in-browser via ONNX Runtime Web (no server calls).
- Labels from `prepare_dataset.py` are full-image placeholders.
  For better accuracy annotate real bounding boxes with LabelImg or Roboflow.
