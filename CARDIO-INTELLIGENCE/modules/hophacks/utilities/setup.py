#!/usr/bin/env python3
"""
Setup script for MedRelay
"""

import os
import subprocess
import sys

def install_requirements():
    """Install required packages"""
    print("Installing required packages...")
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"])
        print("✓ Requirements installed successfully")
    except subprocess.CalledProcessError as e:
        print(f"✗ Error installing requirements: {e}")
        return False
    return True

def create_env_file():
    """Create .env file if it doesn't exist"""
    if not os.path.exists('.env'):
        print("Creating .env file...")
        with open('.env', 'w') as f:
            f.write("GEMINI_API_KEY=your_gemini_api_key_here\n")
        print("✓ .env file created. Please add your Gemini API key.")
    else:
        print("✓ .env file already exists")

def main():
    """Main setup function"""
    print("MedRelay Setup")
    print("=" * 50)
    
    # Install requirements
    if not install_requirements():
        sys.exit(1)
    
    # Create .env file
    create_env_file()
    
    print("\n" + "=" * 50)
    print("Setup complete!")
    print("\nNext steps:")
    print("1. Add your Gemini API key to the .env file")
    print("2. Run: python app.py")
    print("3. Open http://localhost:5000 in your browser")

if __name__ == "__main__":
    main()
