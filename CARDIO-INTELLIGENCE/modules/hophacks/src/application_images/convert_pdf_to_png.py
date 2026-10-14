#!/usr/bin/env python3
"""
Convert PDF to PNG images using pdftoppm
"""

import os
import subprocess
import sys

def convert_pdf_to_png(pdf_path, output_prefix, dpi=300):
    """
    Convert PDF to PNG images using pdftoppm
    
    Args:
        pdf_path (str): Path to the PDF file
        output_prefix (str): Prefix for output PNG files
        dpi (int): DPI resolution (default 300)
    """
    
    if not os.path.exists(pdf_path):
        print(f"❌ PDF file not found: {pdf_path}")
        return False
    
    print(f"Converting {pdf_path} to PNG images...")
    print(f"Output prefix: {output_prefix}")
    print(f"DPI: {dpi}")
    print("-" * 50)
    
    try:
        # Run pdftoppm command
        cmd = [
            'pdftoppm',
            '-png',
            '-r', str(dpi),
            pdf_path,
            output_prefix
        ]
        
        print(f"Running: {' '.join(cmd)}")
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        
        print("✓ Conversion completed successfully!")
        
        # List the generated files
        base_name = os.path.splitext(os.path.basename(pdf_path))[0]
        png_files = []
        
        for i in range(1, 10):  # Check for up to 10 pages
            png_file = f"{output_prefix}-{i:02d}.png"
            if os.path.exists(png_file):
                png_files.append(png_file)
            else:
                break
        
        if png_files:
            print(f"\nGenerated {len(png_files)} PNG files:")
            for png_file in png_files:
                file_size = os.path.getsize(png_file)
                print(f"  ✓ {png_file} ({file_size:,} bytes)")
        else:
            print("❌ No PNG files were generated")
            return False
        
        return True
        
    except subprocess.CalledProcessError as e:
        print(f"❌ Error running pdftoppm: {e}")
        print(f"Error output: {e.stderr}")
        return False
    except FileNotFoundError:
        print("❌ pdftoppm not found. Please install poppler-utils:")
        print("  Ubuntu/Debian: sudo apt-get install poppler-utils")
        print("  macOS: brew install poppler")
        print("  Windows: Download from https://poppler.freedesktop.org/")
        return False
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        return False

def main():
    """Main function"""
    print("PDF to PNG Converter")
    print("=" * 50)
    
    # Set up paths
    pdf_path = "tricare.pdf"
    output_prefix = "tricare-page"
    dpi = 300
    
    # Check if we're in the right directory
    if not os.path.exists(pdf_path):
        print(f"❌ PDF file not found: {pdf_path}")
        print("Please run this script from the application_images directory")
        return
    
    # Convert PDF to PNG
    if convert_pdf_to_png(pdf_path, output_prefix, dpi):
        print("\n✅ Conversion completed successfully!")
        print("\nNext steps:")
        print("1. Update pdf_generator.py to use 'tricare-page-01.png' as background")
        print("2. Run extract_coords.py on tricare.pdf to get new coordinates")
        print("3. Test the updated system")
    else:
        print("\n❌ Conversion failed. Check the error messages above.")

if __name__ == "__main__":
    main()
