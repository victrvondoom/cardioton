from fpdf import FPDF
from PIL import Image

# --- Configuration ---

# This is the map you will edit to fine-tune the coordinates.
# The format is "field_name": (x_in_mm, y_in_mm)
COORDINATE_MAP = {
    # Patient Information (Box 1-6)
    "patient_name": (50, 50),
    "patient_dob": (200, 50),
    "patient_address": (50, 70),
    "patient_city_state_zip": (50, 90),
    "patient_phone": (200, 90),
    "patient_sex": (300, 50),  # This might be off the page, for testing
    "patient_medicare_id": (50, 110),
    # Provider Information (Box 24-33)
    "provider_name": (50, 200),
    "provider_npi": (200, 200),
}

BACKGROUND_IMAGE_PATH = "page-1.png"
OUTPUT_PDF_PATH = "coordinate_test.pdf"

# --- Script Logic ---


def create_coordinate_test_pdf():
    """
    Generates a PDF with a background image and places text labels at
    specified coordinates for visual testing.
    """
    try:
        # Get the dimensions of the background image in pixels
        with Image.open(BACKGROUND_IMAGE_PATH) as img:
            img_width_px, img_height_px = img.size

        # Convert pixel dimensions to millimeters (assuming 300 DPI, common for print)
        # Standard Letter size is 8.5x11 inches or 215.9x279.4 mm.
        # This conversion makes the PDF page size match the image size.
        dpi = 300
        page_width_mm = (img_width_px * 25.4) / dpi
        page_height_mm = (img_height_px * 25.4) / dpi

    except FileNotFoundError:
        print(f"Error: The background image '{BACKGROUND_IMAGE_PATH}' was not found.")
        print("Please make sure the image is in the same directory as the script.")
        return

    # Create a PDF object with the exact dimensions of the image
    # 'P' for Portrait, 'mm' for millimeters, and a custom format
    pdf = FPDF(orientation="P", unit="mm", format=(page_width_mm, page_height_mm))
    pdf.add_page()

    # Add the background image, covering the whole page
    pdf.image(BACKGROUND_IMAGE_PATH, x=0, y=0, w=page_width_mm, h=page_height_mm)

    # Set font and color for the coordinate labels
    pdf.set_font("Helvetica", size=8)
    pdf.set_text_color(255, 0, 0)  # Red color for visibility

    # Iterate through the coordinate map and place labels
    for key, (x, y) in COORDINATE_MAP.items():
        pdf.set_xy(x, y)
        pdf.cell(0, 0, txt=key)

    # Save the PDF to a file
    pdf.output(OUTPUT_PDF_PATH)
    print(f"Successfully created '{OUTPUT_PDF_PATH}'.")
    print("Open the file to check your coordinate placements.")


if __name__ == "__main__":
    create_coordinate_test_pdf()
