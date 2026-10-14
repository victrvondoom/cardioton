import json

import fitz  # pymupdf


def extract_form_fields_to_json(pdf_path, output_file=None):
    """
    Extract form field locations from PDF and return/save as JSON

    Args:
        pdf_path (str): Path to the PDF file
        output_file (str, optional): Path to save JSON output. If None, returns JSON string

    Returns:
        str: JSON string of form fields data
    """
    doc = fitz.open(pdf_path)
    form_fields = []
    total_pages = len(doc)  # Store page count before closing

    for page_num in range(total_pages):
        page = doc[page_num]
        widgets = page.widgets()  # Get form widgets

        for widget in widgets:
            field_info = {
                "page": page_num,
                "field_name": widget.field_name,
                "field_type": widget.field_type_string,
                "rect": {
                    "x0": widget.rect.x0,
                    "y0": widget.rect.y0,
                    "x1": widget.rect.x1,
                    "y1": widget.rect.y1,
                },
                "coordinates": {
                    "x": widget.rect.x0,
                    "y": widget.rect.y0,
                    "width": widget.rect.width,
                    "height": widget.rect.height,
                },
                "field_value": (
                    widget.field_value if hasattr(widget, "field_value") else None
                ),
            }
            form_fields.append(field_info)

    doc.close()

    # Create the final JSON structure
    result = {
        "pdf_file": pdf_path,
        "total_pages": total_pages,
        "total_form_fields": len(form_fields),
        "form_fields": form_fields,
    }

    # Convert to JSON string with pretty formatting
    json_output = json.dumps(result, indent=2, ensure_ascii=False)

    # Save to file if output_file is specified
    if output_file:
        with open(output_file, "w", encoding="utf-8") as f:
            f.write(json_output)
        print(f"Form fields data saved to: {output_file}")

    return json_output


# Usage examples:

# Method 1: Print JSON to console
pdf_path = "tricare.pdf"
json_data = extract_form_fields_to_json(pdf_path, "form_fields.json")

# Method 3: Parse JSON back to Python dict for further processing
import json

json_data = extract_form_fields_to_json(pdf_path)
parsed_data = json.loads(json_data)

# Access specific field data
for field in parsed_data["form_fields"]:
    print(f"Field: {field['field_name']}")
    print(f"Type: {field['field_type']}")
    print(f"Position: ({field['coordinates']['x']}, {field['coordinates']['y']})")
    print(f"Size: {field['coordinates']['width']} x {field['coordinates']['height']}")
    print("---")
