#!/usr/bin/env python3
"""
Utility script to discover form fields in a PDF template
"""

import sys
import os
import json

# Add src directory to Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from pdf_generator_direct import PDFGeneratorDirect

def discover_fields(pdf_path):
    """Discover all form fields in a PDF"""
    print(f"Discovering form fields in: {pdf_path}")
    print("=" * 60)
    
    try:
        generator = PDFGeneratorDirect(pdf_template_path=pdf_path)
        fields = generator.discover_form_fields()
        
        if not fields:
            print("No form fields found in the PDF.")
            return
        
        print(f"Found {len(fields)} form fields:")
        print()
        
        for i, field in enumerate(fields, 1):
            print(f"{i:2d}. Field Name: {field['name']}")
            print(f"    Type: {field['type']}")
            print(f"    Current Value: {field['value']}")
            print(f"    Rectangle: {field['rect']}")
            print()
        
        # Save to JSON file
        output_file = "discovered_fields.json"
        with open(output_file, 'w') as f:
            json.dump(fields, f, indent=2, default=str)
        
        print(f"Fields saved to: {output_file}")
        
    except Exception as e:
        print(f"Error: {e}")

def main():
    """Main function"""
    if len(sys.argv) != 2:
        print("Usage: python discover_fields.py <pdf_path>")
        print("Example: python discover_fields.py ../src/application_images/tricare.pdf")
        sys.exit(1)
    
    pdf_path = sys.argv[1]
    if not os.path.exists(pdf_path):
        print(f"Error: PDF file not found: {pdf_path}")
        sys.exit(1)
    
    discover_fields(pdf_path)

if __name__ == "__main__":
    main()
