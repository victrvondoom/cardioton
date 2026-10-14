#!/usr/bin/env python3
"""
Demo script for MedRelay
This script demonstrates how to use the MedRelay API programmatically
"""

import json
import requests
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def demo_api_call():
    """Demonstrate API call to MedRelay"""
    
    # Sample clinical transcript
    sample_transcript = """
    Doctor: Good morning, Sarah. What brings you in today?
    Patient: I've been having a sore throat and fever for the past few days. I also have a headache.
    Doctor: Let me examine you. I can see some redness in your throat. I'll do a rapid strep test to check for strep throat.
    Patient: Okay, that sounds good.
    Doctor: The test came back positive for strep throat. I'll prescribe you some antibiotics and recommend rest and fluids.
    Patient: Thank you, doctor. When should I come back?
    Doctor: Follow up in a week if symptoms persist. Take the antibiotics as prescribed.
    Patient: Will do. Thank you.
    """
    
    print("MedRelay API Demo")
    print("=" * 50)
    print("Sample Transcript:")
    print(sample_transcript)
    print("\n" + "=" * 50)
    
    # Check if server is running
    try:
        response = requests.get('http://localhost:5000/health')
        if response.status_code != 200:
            print("❌ Server is not running. Please start the server first:")
            print("   python hophacks__main.py")
            return
    except requests.exceptions.ConnectionError:
        print("❌ Cannot connect to server. Please start the server first:")
        print("   python hophacks__main.py")
        return
    
    print("✓ Server is running")
    print("\nSending transcript to MedRelay API...")
    
    try:
        # Make API call
        response = requests.post(
            'http://localhost:5000/generate-claim',
            json={'transcript': sample_transcript},
            headers={'Content-Type': 'application/json'}
        )
        
        if response.status_code == 200:
            print("✓ Successfully generated CMS-1500 form!")
            
            # Save the PDF
            with open('demo_output.pdf', 'wb') as f:
                f.write(response.content)
            print("✓ PDF saved as 'demo_output.pdf'")
            
            # Show file size
            file_size = len(response.content)
            print(f"✓ File size: {file_size:,} bytes")
            
        else:
            print(f"❌ Error: {response.status_code}")
            try:
                error_data = response.json()
                print(f"Error message: {error_data.get('error', 'Unknown error')}")
            except:
                print(f"Response: {response.text}")
                
    except Exception as e:
        print(f"❌ Error making API call: {e}")

def show_usage():
    """Show usage instructions"""
    print("\n" + "=" * 50)
    print("Usage Instructions:")
    print("=" * 50)
    print("1. Start the server:")
    print("   python hophacks__main.py")
    print()
    print("2. Open your browser and go to:")
    print("   http://localhost:5000")
    print()
    print("3. Paste a clinical transcript and click 'Generate Claim Form'")
    print()
    print("4. Download the generated CMS-1500 PDF")
    print()
    print("Or use the API directly:")
    print("   python hophacks__utilities__demo.py")

if __name__ == "__main__":
    demo_api_call()
    show_usage()
