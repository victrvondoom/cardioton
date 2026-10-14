import json
from pathlib import Path

import matplotlib.pyplot as plt
from PIL import Image
from matplotlib.patches import Polygon, Rectangle


# ---------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------

PROJECT_ROOT = Path(__file__).resolve().parents[1]

ANNOTATION_FILE = (
    PROJECT_ROOT
    / "data"
    / "raw"
    / "arcade"
    / "arcade"
    / "stenosis"
    / "train"
    / "annotations"
    / "train.json"
)

IMAGE_DIR = (
    PROJECT_ROOT
    / "data"
    / "raw"
    / "arcade"
    / "arcade"
    / "stenosis"
    / "train"
    / "images"
)

OUTPUT_DIR = (
    PROJECT_ROOT
    / "data"
    / "processed"
    / "arcade_preview"
)


# ---------------------------------------------------------------------
# Load COCO annotations
# ---------------------------------------------------------------------

def load_annotations():
    with open(ANNOTATION_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


# ---------------------------------------------------------------------
# Find images containing stenosis
# ---------------------------------------------------------------------

def get_stenosis_annotations(dataset):
    stenosis_category_id = next(
        category["id"]
        for category in dataset["categories"]
        if category["name"].lower() == "stenosis"
    )

    image_lookup = {
        image["id"]: image
        for image in dataset["images"]
    }

    stenosis_annotations = [
        annotation
        for annotation in dataset["annotations"]
        if annotation["category_id"] == stenosis_category_id
    ]

    return image_lookup, stenosis_annotations


# ---------------------------------------------------------------------
# Visualize one image
# ---------------------------------------------------------------------

def visualize_image(image_info, annotations, output_path):
    image_path = IMAGE_DIR / image_info["file_name"]

    if not image_path.exists():
        raise FileNotFoundError(
            f"Image not found: {image_path}"
        )

    image = Image.open(image_path).convert("RGB")

    fig, ax = plt.subplots(figsize=(8, 8))

    ax.imshow(image)

    for annotation in annotations:
        # COCO polygon format:
        # [x1, y1, x2, y2, ...]
        segmentation = annotation.get("segmentation", [])

        for polygon_data in segmentation:
            points = [
                (polygon_data[i], polygon_data[i + 1])
                for i in range(0, len(polygon_data), 2)
            ]

            polygon = Polygon(
                points,
                closed=True,
                fill=False,
                linewidth=2,
                label="Stenosis",
            )

            ax.add_patch(polygon)

        # Also show the bounding box.
        bbox = annotation.get("bbox")

        if bbox:
            x, y, width, height = bbox

            rectangle = Rectangle(
                (x, y),
                width,
                height,
                fill=False,
                linewidth=1,
                linestyle="--",
            )

            ax.add_patch(rectangle)

    ax.set_title(
        f"ARCADE — Image {image_info['id']} — "
        f"{len(annotations)} stenosis annotation(s)"
    )

    ax.axis("off")

    # Avoid duplicate legend entries.
    handles, labels = ax.get_legend_handles_labels()

    if handles:
        ax.legend(handles[:1], labels[:1])

    plt.tight_layout()
    plt.savefig(output_path, dpi=150, bbox_inches="tight")
    plt.close(fig)


# ---------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------

def main():
    print("=" * 70)
    print("CARDIOINSPECTION — ARCADE VISUALIZATION")
    print("=" * 70)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    dataset = load_annotations()

    image_lookup, stenosis_annotations = get_stenosis_annotations(
        dataset
    )

    # Group annotations by image.
    annotations_by_image = {}

    for annotation in stenosis_annotations:
        image_id = annotation["image_id"]

        annotations_by_image.setdefault(
            image_id,
            []
        ).append(annotation)

    # Select three representative images.
    selected_image_ids = list(annotations_by_image.keys())[:3]

    print(f"Total images: {len(dataset['images'])}")
    print(f"Total annotations: {len(dataset['annotations'])}")
    print(f"Stenosis annotations: {len(stenosis_annotations)}")
    print()
    print("Selected images:")

    for image_id in selected_image_ids:
        image_info = image_lookup[image_id]
        annotations = annotations_by_image[image_id]

        output_path = (
            OUTPUT_DIR
            / f"arcade_{image_id}_stenosis.png"
        )

        visualize_image(
            image_info,
            annotations,
            output_path,
        )

        print(
            f"  Image {image_id}: "
            f"{len(annotations)} stenosis annotation(s)"
        )
        print(f"    Saved: {output_path}")

        for annotation in annotations:
            print(
                f"    bbox={annotation.get('bbox')}, "
                f"area={annotation.get('area')}"
            )

    print()
    print("Visualization complete.")


if __name__ == "__main__":
    main()