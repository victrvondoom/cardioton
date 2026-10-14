#!/usr/bin/env python3
"""
Test script to check Contextus collection and create projects for all users
"""

import os
import requests
from dotenv import load_dotenv

def test_contextus_collection():
    """Check what's in the Contextus collection and create projects for users."""
    
    load_dotenv()
    collection_id = os.getenv("CONTEXTUS_COLLECTION_ID")
    
    print("🔍 Checking Contextus Collection")
    print("=" * 50)
    print(f"Collection ID: {collection_id}")
    
    # Test creating projects for different users
    test_users = [
        {"patient_id": "user_001", "patient_name": "Alice Johnson", "doctor_id": "doc_001"},
        {"patient_id": "user_002", "patient_name": "Bob Wilson", "doctor_id": "doc_001"},
        {"patient_id": "user_003", "patient_name": "Carol Davis", "doctor_id": "doc_001"},
        {"patient_id": "user_004", "patient_name": "David Brown", "doctor_id": "doc_001"},
    ]
    
    print(f"\n📝 Creating test projects for {len(test_users)} users...")
    
    for user in test_users:
        try:
            # Create a test project
            project_data = {
                "collection_id": collection_id,
                "label": f"Medical Billing - {user['patient_name']}",
                "metadata": {
                    "patient_id": user["patient_id"],
                    "patient_name": user["patient_name"],
                    "doctor_id": user["doctor_id"],
                    "created_at": "2024-01-01T00:00:00Z",
                    "project_type": "medical_billing",
                    "status": "active"
                },
                "artifacts": [{
                    "type": "patient_profile",
                    "title": f"Patient Profile - {user['patient_name']}",
                    "data": {
                        "patient_id": user["patient_id"],
                        "name": user["patient_name"],
                        "doctor_id": user["doctor_id"],
                        "billing_history": [],
                        "common_diagnoses": [],
                        "common_procedures": []
                    }
                }]
            }
            
            response = requests.post(
                "https://www.contextus.space/v1/projects", 
                json=project_data
            )
            
            if response.status_code == 200:
                result = response.json()
                project_id = result.get("project_id")
                print(f"✅ Created project for {user['patient_name']}: {project_id}")
            else:
                print(f"❌ Failed to create project for {user['patient_name']}: {response.status_code}")
                print(f"   Response: {response.text}")
                
        except Exception as e:
            print(f"❌ Error creating project for {user['patient_name']}: {e}")
    
    print(f"\n🎯 Now test the enhanced endpoints to see Contextus integration:")
    print(f"1. POST /api/enhanced-generate-claim")
    print(f"2. POST /api/ai-agent-query") 
    print(f"3. GET /api/ai-insights/<patient_id>")

if __name__ == "__main__":
    test_contextus_collection()
