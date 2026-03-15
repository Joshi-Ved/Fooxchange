import argparse
import os
import random
import shutil
from pathlib import Path


def prepare_dataset(src_dir: str, out_dir: str, val_frac=0.1, test_frac=0.1):
    src = Path(src_dir)
    out = Path(out_dir)
    if not src.exists():
        raise SystemExit(f"Source directory not found: {src}")

    # gather classes
    classes = [p.name for p in src.iterdir() if p.is_dir()]
    classes.sort()
    class_to_idx = {c: i for i, c in enumerate(classes)}

    # collect all images
    images = []
    for cls in classes:
        for p in (src / cls).glob('*'):
            if p.suffix.lower() in ('.jpg', '.jpeg', '.png', '.bmp'):
                images.append((p, cls))

    random.shuffle(images)
    n = len(images)
    n_test = int(n * test_frac)
    n_val = int(n * val_frac)
    n_train = n - n_val - n_test

    splits = {
        'train': images[:n_train],
        'val': images[n_train:n_train + n_val],
        'test': images[n_train + n_val:]
    }

    # prepare folders
    for split in splits:
        (out / split / 'images').mkdir(parents=True, exist_ok=True)
        (out / split / 'labels').mkdir(parents=True, exist_ok=True)

    # simple heuristic: single object per image -> bbox covers most of image (centered)
    for split, items in splits.items():
        for src_path, cls in items:
            dst_img = out / split / 'images' / src_path.name
            shutil.copyfile(src_path, dst_img)

            # create YOLO label with single bbox centered (x_c y_c w h in normalized coords)
            # width/height set to 0.9 of image by default
            label_path = out / split / 'labels' / (src_path.stem + '.txt')
            cls_idx = class_to_idx[cls]
            x_c = 0.5
            y_c = 0.5
            w = 0.9
            h = 0.9
            with open(label_path, 'w') as fh:
                fh.write(f"{cls_idx} {x_c} {y_c} {w} {h}\n")

    # write classes file and dataset yaml
    with open(out / 'classes.txt', 'w') as fh:
        for c in classes:
            fh.write(c + '\n')

    dataset_yaml = out / 'dataset.yaml'
    content = f"""
train: {out / 'train' / 'images'}
val: {out / 'val' / 'images'}
test: {out / 'test' / 'images'}

names:
  {\n.join([f'{i}: {c}' for i, c in enumerate(classes)])}
"""
    with open(dataset_yaml, 'w') as fh:
        fh.write(content)

    print(f"Prepared dataset in: {out}\nClasses: {classes}\nTrain/Val/Test sizes: {n_train}/{n_val}/{n_test}")


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--src', default='training_imageset', help='Source root with class folders')
    p.add_argument('--out', default='training/yolo_dataset', help='Output dataset folder')
    p.add_argument('--val', type=float, default=0.1)
    p.add_argument('--test', type=float, default=0.1)
    args = p.parse_args()
    prepare_dataset(args.src, args.out, args.val, args.test)


if __name__ == '__main__':
    main()
