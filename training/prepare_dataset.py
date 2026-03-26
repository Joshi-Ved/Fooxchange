import argparse
import random
import re
import shutil
from collections import Counter, defaultdict
from pathlib import Path

import yaml


IMAGE_SUFFIXES = {'.jpg', '.jpeg', '.png', '.bmp', '.webp'}
NEGATIVE_FOLDER_MARKERS = (
    'non_food',
    'non-food',
    'negative',
    'negatives',
    'background',
    'distractor',
    'noise',
)
IGNORED_LABEL_PREFIXES = (
    'archive',
    'train',
    'training',
    'test',
    'testing',
    'val',
    'valid',
    'validation',
    'images',
    'labels',
    'fruit',
    'fruits',
    'dataset',
)
EXACT_ALIASES = {
    'tomatoe': 'tomato',
    'tomatoes': 'tomato',
    'grape': 'grapes',
    'grapes_green': 'grapes',
    'grapes_red': 'grapes',
    'green_chilly': 'green_chili',
    'green_chillies': 'green_chili',
    'green_chilli': 'green_chili',
    'green_chillis': 'green_chili',
    'red_chilly': 'red_chili',
    'red_chillies': 'red_chili',
    'red_chilli': 'red_chili',
    'red_chillis': 'red_chili',
    'bell_pepper': 'capsicum',
    'sweet_pepper': 'capsicum',
    'capsicums': 'capsicum',
    'hot_pepper': 'red_chili',
    'chili_pepper': 'red_chili',
    'chilli_pepper': 'red_chili',
    'milk_packet': 'milk',
    'glass_of_milk': 'milk',
    'bottle_of_milk': 'milk',
    'woman_drinks_glass_of_milk': 'milk',
    'haldi': 'turmeric',
    'jeera': 'cumin',
    'coriander_leaf': 'coriander',
    'coriander_leaves': 'coriander',
    'cilantro': 'coriander',
    'aubergine': 'eggplant',
}
TOKEN_ALIASES = {
    'apple': 'apple',
    'banana': 'banana',
    'orange': 'orange',
    'lemon': 'lemon',
    'lime': 'lime',
    'mango': 'mango',
    'pineapple': 'pineapple',
    'strawberry': 'strawberry',
    'grape': 'grapes',
    'watermelon': 'watermelon',
    'pear': 'pear',
    'peach': 'peach',
    'cherry': 'cherry',
    'kiwi': 'kiwi',
    'avocado': 'avocado',
    'coconut': 'coconut',
    'pomegranate': 'pomegranate',
    'papaya': 'papaya',
    'tomato': 'tomato',
    'potato': 'potato',
    'onion': 'onion',
    'garlic': 'garlic',
    'ginger': 'ginger',
    'carrot': 'carrot',
    'broccoli': 'broccoli',
    'spinach': 'spinach',
    'cabbage': 'cabbage',
    'capsicum': 'capsicum',
    'pepper': 'capsicum',
    'chili': 'green_chili',
    'chilli': 'green_chili',
    'cucumber': 'cucumber',
    'eggplant': 'eggplant',
    'pea': 'peas',
    'corn': 'corn',
    'mushroom': 'mushroom',
    'cauliflower': 'cauliflower',
    'celery': 'celery',
    'asparagus': 'asparagus',
    'zucchini': 'zucchini',
    'pumpkin': 'pumpkin',
    'radish': 'radish',
    'beet': 'beetroot',
    'beetroot': 'beetroot',
    'lettuce': 'lettuce',
    'sweet_potato': 'sweet_potato',
    'okra': 'okra',
    'bitter_gourd': 'bitter_gourd',
    'chicken': 'chicken',
    'egg': 'egg',
    'fish': 'fish',
    'shrimp': 'shrimp',
    'beef': 'beef',
    'lamb': 'lamb',
    'tofu': 'tofu',
    'paneer': 'paneer',
    'lentil': 'lentils',
    'chickpea': 'chickpeas',
    'kidney_bean': 'kidney_beans',
    'black_bean': 'black_beans',
    'rice': 'rice',
    'bread': 'bread',
    'flour': 'flour',
    'pasta': 'pasta',
    'oat': 'oats',
    'milk': 'milk',
    'yogurt': 'yogurt',
    'butter': 'butter',
    'cheese': 'cheese',
    'cream': 'cream',
    'turmeric': 'turmeric',
    'haldi': 'turmeric',
    'cumin': 'cumin',
    'jeera': 'cumin',
    'coriander': 'coriander',
    'cardamom': 'cardamom',
    'cinnamon': 'cinnamon',
    'clove': 'cloves',
    'salt': 'salt',
    'sugar': 'sugar',
    'oil': 'oil',
    'soy_sauce': 'soy_sauce',
    'curry': 'curry',
    'biryani': 'biryani',
    'pizza': 'pizza',
    'sandwich': 'sandwich',
    'salad': 'salad',
    'soup': 'soup',
    'cake': 'cake',
    'donut': 'donut',
    'hot_dog': 'hot_dog',
    'fried_rice': 'fried_rice',
}


def normalize_label(value: str) -> str:
    normalized = value.strip().lower()
    normalized = re.sub(r'[^a-z0-9]+', '_', normalized)
    normalized = re.sub(r'_+', '_', normalized).strip('_')
    return normalized


def load_allowed_classes(classes_path: str | None) -> list[str] | None:
    if not classes_path:
        return None

    path = Path(classes_path)
    if not path.exists():
        raise SystemExit(f"Classes file not found: {path}")

    with open(path, 'r', encoding='utf-8') as handle:
        data = yaml.safe_load(handle) or {}

    raw_names = data.get('names', {})
    if isinstance(raw_names, dict):
        ordered_items = sorted(raw_names.items(), key=lambda item: int(item[0]))
        return [normalize_label(name) for _, name in ordered_items]
    if isinstance(raw_names, list):
        return [normalize_label(name) for name in raw_names]
    raise SystemExit(f"Unsupported names structure in classes file: {path}")


def is_ignored_candidate(label: str) -> bool:
    if not label:
        return True

    return any(
        label == prefix or label.startswith(f'{prefix}_')
        for prefix in IGNORED_LABEL_PREFIXES
    )


def resolve_label(candidate: str, allowed_classes: set[str] | None) -> str | None:
    normalized = normalize_label(candidate)
    if not normalized or is_ignored_candidate(normalized):
        return None

    normalized = EXACT_ALIASES.get(normalized, normalized)

    if allowed_classes is None:
        return normalized

    if normalized in allowed_classes:
        return normalized

    singular = normalized[:-1] if normalized.endswith('s') else normalized
    plural = f'{normalized}s' if not normalized.endswith('s') else normalized

    if singular in allowed_classes:
        return singular
    if plural in allowed_classes:
        return plural

    tokens = [token for token in normalized.split('_') if token]
    if 'powder' in tokens and 'chili' in tokens:
        return 'red_chili' if 'red_chili' in allowed_classes else None
    if 'powder' in tokens and 'chilli' in tokens:
        return 'red_chili' if 'red_chili' in allowed_classes else None
    if 'green' in tokens and ('chili' in tokens or 'chilli' in tokens):
        return 'green_chili' if 'green_chili' in allowed_classes else None
    if 'red' in tokens and ('chili' in tokens or 'chilli' in tokens):
        return 'red_chili' if 'red_chili' in allowed_classes else None

    for index in range(len(tokens)):
        joined = '_'.join(tokens[index:])
        alias = TOKEN_ALIASES.get(joined)
        if alias and alias in allowed_classes:
            return alias

    for token in tokens:
        alias = TOKEN_ALIASES.get(token)
        if alias and alias in allowed_classes:
            return alias

    return None


def extract_candidates(image_path: Path, root: Path) -> list[str]:
    relative_parts = image_path.relative_to(root).parts
    directory_parts = list(relative_parts[:-1])
    candidates: list[str] = []
    seen: set[str] = set()

    for directory_name in reversed(directory_parts):
        normalized = normalize_label(directory_name)
        if normalized in seen or is_ignored_candidate(normalized):
            continue
        candidates.append(directory_name)
        seen.add(normalized)

    file_stem = normalize_label(image_path.stem)
    if file_stem and file_stem not in seen:
        candidates.append(image_path.stem)

    return candidates


def iter_images(root: Path):
    for path in root.rglob('*'):
        if path.is_file() and path.suffix.lower() in IMAGE_SUFFIXES:
            yield path


def is_negative_image(image_path: Path, root: Path) -> bool:
    relative_parts = image_path.relative_to(root).parts[:-1]
    for part in relative_parts:
        normalized = normalize_label(part)
        if any(marker in normalized for marker in NEGATIVE_FOLDER_MARKERS):
            return True
    return False


def load_existing_yolo_label(image_path: Path) -> list[str] | None:
    label_path = image_path.with_suffix('.txt')
    if not label_path.exists():
        return None

    lines: list[str] = []
    with open(label_path, 'r', encoding='utf-8') as handle:
        for raw in handle:
            stripped = raw.strip()
            if not stripped:
                continue
            parts = stripped.split()
            if len(parts) != 5:
                continue
            lines.append(stripped)

    return lines


def split_items(items: list[Path], val_frac: float, test_frac: float):
    total = len(items)
    n_test = int(total * test_frac)
    n_val = int(total * val_frac)
    n_train = total - n_val - n_test

    return {
        'train': items[:n_train],
        'val': items[n_train:n_train + n_val],
        'test': items[n_train + n_val:],
    }


def prepare_dataset(
    src_dir: str,
    out_dir: str,
    val_frac=0.1,
    test_frac=0.1,
    classes_path: str | None = None,
    max_per_class: int | None = None,
    seed: int = 42,
):
    src = Path(src_dir)
    out = Path(out_dir)
    if not src.exists():
        raise SystemExit(f"Source directory not found: {src}")

    random.seed(seed)
    allowed_classes_list = load_allowed_classes(classes_path)
    allowed_classes = set(allowed_classes_list) if allowed_classes_list else None

    grouped_images: dict[str, list[Path]] = defaultdict(list)
    negative_images: list[Path] = []
    unresolved_images: list[Path] = []

    for image_path in iter_images(src):
        if is_negative_image(image_path, src):
            negative_images.append(image_path)
            continue

        resolved_label = None
        for candidate in extract_candidates(image_path, src):
            resolved_label = resolve_label(candidate, allowed_classes)
            if resolved_label:
                break

        if resolved_label is None:
            unresolved_images.append(image_path)
            continue

        grouped_images[resolved_label].append(image_path)

    if not grouped_images:
        raise SystemExit(
            f"No labeled images found under {src}. Check folder names or pass --classes."
        )

    if max_per_class is not None and max_per_class > 0:
        for class_name, image_paths in grouped_images.items():
            random.shuffle(image_paths)
            grouped_images[class_name] = image_paths[:max_per_class]

    class_names = (
        [name for name in allowed_classes_list or [] if name in grouped_images]
        if allowed_classes_list
        else sorted(grouped_images)
    )
    class_to_idx = {class_name: index for index, class_name in enumerate(class_names)}

    split_buckets = {
        'train': [],
        'val': [],
        'test': [],
    }

    for class_name in class_names:
        image_paths = grouped_images[class_name]
        random.shuffle(image_paths)
        for split_name, split_items_list in split_items(image_paths, val_frac, test_frac).items():
            split_buckets[split_name].extend((path, class_name) for path in split_items_list)

    if negative_images:
        random.shuffle(negative_images)
        negative_splits = split_items(negative_images, val_frac, test_frac)
        for split_name, split_items_list in negative_splits.items():
            split_buckets[split_name].extend((path, None) for path in split_items_list)

    for split_name in split_buckets:
        random.shuffle(split_buckets[split_name])
        (out / split_name / 'images').mkdir(parents=True, exist_ok=True)
        (out / split_name / 'labels').mkdir(parents=True, exist_ok=True)

    copied_counts = Counter()
    for split_name, items in split_buckets.items():
        for src_path, class_name in items:
            label_prefix = class_name or 'negative'
            unique_name = f"{label_prefix}_{src_path.stem}{src_path.suffix.lower()}"
            unique_stem = f"{label_prefix}_{src_path.stem}"
            dst_img = out / split_name / 'images' / unique_name
            suffix_index = 1
            while dst_img.exists():
                unique_name = f"{label_prefix}_{src_path.stem}_{suffix_index}{src_path.suffix.lower()}"
                unique_stem = f"{label_prefix}_{src_path.stem}_{suffix_index}"
                dst_img = out / split_name / 'images' / unique_name
                suffix_index += 1

            shutil.copyfile(src_path, dst_img)

            label_path = out / split_name / 'labels' / f'{unique_stem}.txt'
            with open(label_path, 'w', encoding='utf-8') as handle:
                if class_name is None:
                    # Empty label file = explicit background/negative sample.
                    pass
                else:
                    cls_idx = class_to_idx[class_name]
                    existing_lines = load_existing_yolo_label(src_path)
                    if existing_lines:
                        remapped_lines: list[str] = []
                        for raw_line in existing_lines:
                            parts = raw_line.split()
                            if len(parts) != 5:
                                continue
                            remapped_lines.append(
                                f"{cls_idx} {parts[1]} {parts[2]} {parts[3]} {parts[4]}"
                            )

                        if remapped_lines:
                            handle.write('\n'.join(remapped_lines) + '\n')
                        else:
                            handle.write(f"{cls_idx} 0.5 0.5 0.9 0.9\n")
                    else:
                        # Fallback for classification-only datasets lacking box labels.
                        handle.write(f"{cls_idx} 0.5 0.5 0.9 0.9\n")

            if class_name is not None:
                copied_counts[class_name] += 1

    with open(out / 'classes.txt', 'w', encoding='utf-8') as handle:
        for class_name in class_names:
            handle.write(class_name + '\n')

    dataset_yaml = out / 'dataset.yaml'
    names_block = '\n  '.join(f'{index}: {name}' for index, name in enumerate(class_names))
    content = f"""path: {out.as_posix()}
train: train/images
val: val/images
test: test/images

nc: {len(class_names)}
names:
  {names_block}
"""
    with open(dataset_yaml, 'w', encoding='utf-8') as handle:
        handle.write(content)

    unresolved_preview = [path.relative_to(src).as_posix() for path in unresolved_images[:20]]
    print(f"Prepared dataset in: {out}")
    print(f"Resolved classes: {class_names}")
    print(f"Per-class counts: {dict(sorted(copied_counts.items()))}")
    print(
        f"Train/Val/Test sizes: "
        f"{len(split_buckets['train'])}/{len(split_buckets['val'])}/{len(split_buckets['test'])}"
    )
    print(f"Background/negative images included: {len(negative_images)}")
    print(f"Unresolved images skipped: {len(unresolved_images)}")
    if unresolved_preview:
        print(f"Unresolved sample: {unresolved_preview}")


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--src', default='training_imageset', help='Source root with class folders')
    p.add_argument('--out', default='training/yolo_dataset', help='Output dataset folder')
    p.add_argument('--val', type=float, default=0.1)
    p.add_argument('--test', type=float, default=0.1)
    p.add_argument('--classes', default='training/food_classes.yaml', help='Optional YAML file with canonical class names')
    p.add_argument('--max-per-class', type=int, default=None, help='Optional cap on images copied per resolved class')
    p.add_argument('--seed', type=int, default=42, help='Random seed for dataset sampling')
    args = p.parse_args()
    prepare_dataset(
        args.src,
        args.out,
        args.val,
        args.test,
        args.classes,
        args.max_per_class,
        args.seed,
    )


if __name__ == '__main__':
    main()
