#!/usr/bin/env python3
"""
Test regular billing to see if it creates Contextus projects
"""

import requests
import json

def test_regular_billing():
    """Test if regular billing creates Contextus projects."""
    
    print("🧪 Testing Regular Billing with Contextus Integration")
    print("=" * 60)
    
    # Test regular billing (should create Contextus project)
    billing_data = {
        "transcript": "Doctor: Good morning, Mike. How are you feeling today? Patient: I have a sore throat and fever. Doctor: Let me check your temperature and examine your throat.",
        "form_type": "cms1500"
    }
    
    print("📝 Testing regular /generate-claim endpoint...")
    print(f"   Transcript: {billing_data['transcript'][:50]}...")
    
    try:
        response = requests.post(
            "http://localhost:5000/generate-claim",
            json=billing_data,
            headers={"Content-Type": "application/json"}
        )
        
        print(f"   Status Code: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Regular billing successful!")
            print(f"   AI Agent Used: {result.get('ai_agent_used', 'Unknown')}")
            print(f"   Patient Context Used: {result.get('patient_context_used', False)}")
            print(f"   Project ID: {result.get('project_id', 'None')}")
            print(f"   Visit ID: {result.get('visit_id', 'None')}")
        else:
            print(f"❌ Regular billing failed: {response.status_code}")
            try:
                error_data = response.json()
                print(f"   Error: {error_data.get('error', 'Unknown error')}")
            except:
                print(f"   Response: {response.text}")
                
    except Exception as e:
        print(f"❌ Error testing regular billing: {e}")
    
    print(f"\n🎯 Expected Result:")
    print(f"   - Should use MedicalBillingAgent")
    print(f"   - Should create Contextus project")
    print(f"   - Should show patient_context_used: true")
    print(f"   - Should show project_id")

if __name__ == "__main__":
    test_regular_billing()
