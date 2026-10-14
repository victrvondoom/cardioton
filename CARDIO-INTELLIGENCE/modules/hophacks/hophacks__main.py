#!/usr/bin/env python3
"""
Main entry point for MedRelay
"""

import os
import sys

from dotenv import load_dotenv

# Add src directory to Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

# Load environment variables
load_dotenv()

def main():
    """Main entry point"""
    print("MedRelay - Medical Billing Automation")
    print("=" * 50)
    
    # Check for API key
    api_key = os.getenv('GEMINI_API_KEY')
    if not api_key or api_key == 'your_gemini_api_key_here':
        print("⚠️  Warning: GEMINI_API_KEY not set in .env file")
        print("   The AI features will not work without a valid API key")
        print("   Please add your Gemini API key to the .env file")
        print()
    
    print("\nStarting MedRelay server...")
    print("Open your browser and navigate to: http://localhost:5001")
    print("Press Ctrl+C to stop the server")
    print("=" * 50)
    
    # Import and run the Flask app
    try:
        from app import app
        app.run(debug=True, host='0.0.0.0', port=5001)
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
