#!/usr/bin/env python3
"""
Contextus Demo for ScribeMD
Demonstrates AI Second Brain capabilities for medical billing
"""

import os
import json
import requests
from dotenv import load_dotenv

def demo_contextus_integration():
    """
    Demo the Contextus integration with ScribeMD.
    """
    print("🤖 Contextus AI Second Brain Demo for ScribeMD")
    print("=" * 60)
    
    # Load environment variables
    load_dotenv()
    
    collection_id = os.getenv("CONTEXTUS_COLLECTION_ID")
    if not collection_id:
        print("❌ Please set CONTEXTUS_COLLECTION_ID in your .env file")
        print("Get it from: https://www.contextus.space/login")
        return
    
    print(f"✅ Using Collection ID: {collection_id}")
    
    # Demo 1: Create a patient project
    print("\n📋 Demo 1: Creating Patient Project")
    print("-" * 40)
    
    patient_data = {
        "collection_id": collection_id,
        "label": "Medical Billing - John Smith",
        "metadata": {
            "patient_id": "patient_001",
            "patient_name": "John Smith",
            "doctor_id": "doctor_001",
            "created_at": "2024-01-01T10:00:00Z",
            "project_type": "medical_billing",
            "status": "active"
        },
        "artifacts": [{
            "type": "patient_profile",
            "title": "Patient Profile - John Smith",
            "data": {
                "patient_id": "patient_001",
                "name": "John Smith",
                "doctor_id": "doctor_001",
                "billing_history": [],
                "common_diagnoses": [],
                "common_procedures": []
            }
        }]
    }
    
    try:
        response = requests.post("https://www.contextus.space/v1/projects", json=patient_data)
        if response.status_code == 200:
            result = response.json()
            project_id = result.get("project_id")
            print(f"✅ Created project: {project_id}")
        else:
            print(f"❌ Failed to create project: {response.status_code}")
            return
    except Exception as e:
        print(f"❌ Error: {e}")
        return
    
    # Demo 2: Log a transcript processing session
    print("\n📝 Demo 2: Logging Transcript Processing")
    print("-" * 40)
    
    transcript = """
    Doctor: Good morning, John. What brings you in today?
    Patient: I've been having a sore throat and fever for the past few days.
    Doctor: Let me examine you. I can see some redness in your throat. 
    I'll do a rapid strep test to check for strep throat.
    Patient: Okay, that sounds good.
    Doctor: The test came back positive for strep throat. I'll prescribe 
    you some antibiotics and recommend rest and fluids.
    Patient: Thank you, doctor.
    """
    
    structured_data = {
        "patient": {
            "name": "John Smith",
            "dob": "1980-05-15",
            "address": "123 Main St, City, ST 12345"
        },
        "provider": {
            "name": "Dr. Johnson",
            "npi": "1234567890"
        },
        "diagnoses": [
            {"description": "Strep throat", "code": "J02.9"}
        ],
        "procedures": [
            {"description": "Office visit", "code": "99213", "charge": "150.00"},
            {"description": "Rapid strep test", "code": "87880", "charge": "35.00"}
        ]
    }
    
    processing_data = {
        "metadata": {
            "last_processing": "2024-01-01T10:30:00Z",
            "total_transcripts": 1,
            "form_types": ["cms1500"]
        },
        "artifacts": [{
            "type": "transcript_processing",
            "title": "Transcript Processing - 2024-01-01 10:30",
            "data": {
                "timestamp": "2024-01-01T10:30:00Z",
                "form_type": "cms1500",
                "transcript_preview": transcript[:200] + "...",
                "structured_data": structured_data,
                "ai_confidence": 0.95,
                "processing_notes": "Extracted 1 diagnosis(es); Extracted 2 procedure(s)"
            }
        }]
    }
    
    try:
        response = requests.post(
            f"https://www.contextus.space/v1/projects/{project_id}/write",
            json=processing_data
        )
        if response.status_code == 200:
            print("✅ Logged transcript processing session")
        else:
            print(f"❌ Failed to log processing: {response.status_code}")
    except Exception as e:
        print(f"❌ Error: {e}")
    
    # Demo 3: Query the AI agent
    print("\n🧠 Demo 3: Querying AI Agent")
    print("-" * 40)
    
    queries = [
        "What are the most common diagnoses for this patient?",
        "What procedures were performed in the last visit?",
        "What is the billing pattern for this patient?",
        "What recommendations do you have for improving the billing process?"
    ]
    
    for query in queries:
        try:
            response = requests.post(
                f"https://www.contextus.space/v1/projects/{project_id}/query",
                json={"q": query}
            )
            if response.status_code == 200:
                result = response.json()
                print(f"❓ Query: {query}")
                print(f"🤖 AI Response: {result.get('response', 'No response')}")
                print()
            else:
                print(f"❌ Query failed: {response.status_code}")
        except Exception as e:
            print(f"❌ Query error: {e}")
    
    # Demo 4: Get project context
    print("\n📊 Demo 4: Retrieving Project Context")
    print("-" * 40)
    
    try:
        # Get metadata
        metadata_response = requests.get(f"https://www.contextus.space/v1/projects/{project_id}/metadata")
        if metadata_response.status_code == 200:
            metadata = metadata_response.json()
            print("📋 Metadata:")
            print(json.dumps(metadata, indent=2))
        
        # Get artifacts
        artifacts_response = requests.get(f"https://www.contextus.space/v1/projects/{project_id}/artifacts")
        if artifacts_response.status_code == 200:
            artifacts = artifacts_response.json()
            print(f"\n📁 Artifacts ({len(artifacts)} items):")
            for i, artifact in enumerate(artifacts):
                print(f"  {i+1}. {artifact.get('title', 'Untitled')} ({artifact.get('type', 'unknown')})")
        
    except Exception as e:
        print(f"❌ Error retrieving context: {e}")
    
    # Demo 5: Use AI tools
    print("\n🛠️  Demo 5: Using AI Tools")
    print("-" * 40)
    
    try:
        # Use web search tool
        response = requests.post(
            f"https://www.contextus.space/v1/projects/{project_id}/use",
            json={
                "tool": "web_search",
                "input": {"query": "latest medical coding updates 2024"}
            }
        )
        if response.status_code == 200:
            result = response.json()
            print("🔍 Web Search Result:")
            print(f"Query: latest medical coding updates 2024")
            print(f"Result: {result.get('result', 'No result')[:200]}...")
        else:
            print(f"❌ Tool usage failed: {response.status_code}")
    except Exception as e:
        print(f"❌ Tool usage error: {e}")
    
    print("\n🎉 Demo completed!")
    print("=" * 60)
    print("Next steps:")
    print("1. Run: python src/contextus_enhanced_app.py")
    print("2. Test the enhanced API endpoints")
    print("3. Integrate with your frontend")
    print("4. Customize AI agents for your specific needs")

if __name__ == "__main__":
    demo_contextus_integration()
