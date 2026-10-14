#!/usr/bin/env python3
"""
Test script for MedRelay application
"""

import json
import requests
import time
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def test_health_endpoint():
    """Test the health endpoint"""
    try:
        response = requests.get('http://localhost:5000/health')
        if response.status_code == 200:
            print("✓ Health endpoint working")
            return True
        else:
            print(f"✗ Health endpoint failed: {response.status_code}")
            return False
    except requests.exceptions.ConnectionError:
        print("✗ Cannot connect to server. Make sure the app is running.")
        return False

def test_generate_claim():
    """Test the generate claim endpoint"""
    test_transcript = """
    Doctor: Good morning, Sarah. What brings you in today?
    Patient: I've been having a sore throat and fever for the past few days.
    Doctor: Let me examine you. I can see some redness in your throat. I'll do a rapid strep test to check for strep throat.
    Patient: Okay, that sounds good.
    Doctor: The test came back positive for strep throat. I'll prescribe you some antibiotics and recommend rest and fluids.
    Patient: Thank you, doctor.
    """
    
    try:
        response = requests.post(
            'http://localhost:5000/generate-claim',
            json={'transcript': test_transcript},
            headers={'Content-Type': 'application/json'}
        )
        
        if response.status_code == 200:
            print("✓ Generate claim endpoint working")
            # Save the PDF for inspection
            with open('test_output.pdf', 'wb') as f:
                f.write(response.content)
            print("✓ PDF generated and saved as test_output.pdf")
            return True
        else:
            print(f"✗ Generate claim failed: {response.status_code}")
            try:
                error_data = response.json()
                print(f"Error: {error_data.get('error', 'Unknown error')}")
            except:
                print(f"Response: {response.text}")
            return False
    except requests.exceptions.ConnectionError:
        print("✗ Cannot connect to server. Make sure the app is running.")
        return False

def main():
    """Main test function"""
    print("MedRelay Test Suite")
    print("=" * 50)
    
    # Check if API key is set
    api_key = os.getenv('GEMINI_API_KEY')
    if not api_key or api_key == 'your_gemini_api_key_here':
        print("⚠️  Warning: GEMINI_API_KEY not set in .env file")
        print("   The AI features will not work without a valid API key")
        print("   Please add your Gemini API key to the .env file")
        print()
    
    # Test health endpoint
    if not test_health_endpoint():
        print("\n❌ Health check failed. Make sure the app is running:")
        print("   python app.py")
        return
    
    # Test generate claim endpoint
    if test_generate_claim():
        print("\n✅ All tests passed!")
    else:
        print("\n❌ Some tests failed. Check the error messages above.")

if __name__ == "__main__":
    main()
