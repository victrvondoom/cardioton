#!/usr/bin/env python3
"""
Run script for MedRelay
"""

import os
import sys
from dotenv import load_dotenv

def check_requirements():
    """Check if all requirements are met"""
    print("Checking requirements...")
    
    # Load environment variables
    load_dotenv()
    
    # Check for API key
    api_key = os.getenv('GEMINI_API_KEY')
    if not api_key or api_key == 'your_gemini_api_key_here':
        print("⚠️  Warning: GEMINI_API_KEY not set in .env file")
        print("   The AI features will not work without a valid API key")
        print("   Please add your Gemini API key to the .env file")
        print()
    
    # Check if required files exist
    required_files = ['src/app.py', 'src/pdf_generator_direct.py', 'src/code_lookup.py', 'src/templates/index.html']
    for file in required_files:
        if not os.path.exists(file):
            print(f"✗ Missing required file: {file}")
            return False
    
    print("✓ All required files present")
    return True

def main():
    """Main run function"""
    print("MedRelay - Medical Billing Automation")
    print("=" * 50)
    
    if not check_requirements():
        print("❌ Requirements check failed. Please fix the issues above.")
        sys.exit(1)
    
    print("\nStarting MedRelay server...")
    print("Open your browser and navigate to: http://localhost:5000")
    print("Press Ctrl+C to stop the server")
    print("=" * 50)
    
    # Import and run the Flask app
    try:
        sys.path.append('src')
        from app import app
        app.run(debug=True, host='0.0.0.0', port=5000)
    except ImportError as e:
        print(f"❌ Error importing app: {e}")
        print("Make sure all dependencies are installed: pip install -r requirements.txt")
        sys.exit(1)
    except KeyboardInterrupt:
        print("\n\n👋 MedRelay server stopped. Goodbye!")
    except Exception as e:
        print(f"❌ Error running server: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
