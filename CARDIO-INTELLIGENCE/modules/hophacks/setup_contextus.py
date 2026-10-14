#!/usr/bin/env python3
"""
Contextus Setup Script for ScribeMD
Helps you get started with Contextus AI Second Brain integration
"""

import os
import requests
import json
from dotenv import load_dotenv

def setup_contextus():
    """
    Interactive setup for Contextus integration.
    """
    print("🤖 Contextus AI Second Brain Setup for ScribeMD")
    print("=" * 60)
    
    # Load environment variables
    load_dotenv()
    
    # Get collection ID
    collection_id = os.getenv("CONTEXTUS_COLLECTION_ID")
    if not collection_id:
        print("❌ CONTEXTUS_COLLECTION_ID not found in environment variables")
        print("\n📋 Setup Steps:")
        print("1. Go to https://www.contextus.space/login")
        print("2. Create a new Collection")
        print("3. Copy the Collection ID")
        print("4. Add it to your .env file:")
        print("   echo 'CONTEXTUS_COLLECTION_ID=your-collection-id-here' >> .env")
        print("\n🔄 Run this script again after setting up your Collection ID")
        return False
    
    print(f"✅ Found Collection ID: {collection_id}")
    
    # Test connection
    print("\n🔗 Testing Contextus connection...")
    try:
        response = requests.get(f"https://www.contextus.space/v1/catalog?collection_id={collection_id}")
        if response.status_code == 200:
            print("✅ Connection successful!")
        else:
            print(f"❌ Connection failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Connection error: {e}")
        return False
    
    # Create a test project
    print("\n🏗️  Creating test project...")
    try:
        project_data = {
            "collection_id": collection_id,
            "label": "ScribeMD Test Project",
            "metadata": {
                "app": "ScribeMD",
                "version": "1.0",
                "description": "Medical billing automation with AI Second Brain"
            },
            "artifacts": [{
                "type": "setup",
                "title": "Initial Setup",
                "data": {
                    "setup_date": "2024-01-01",
                    "features": [
                        "AI-powered transcript processing",
                        "Medical code generation",
                        "Context-aware learning",
                        "Patient-specific AI agents"
                    ]
                }
            }]
        }
        
        response = requests.post("https://www.contextus.space/v1/projects", json=project_data)
        if response.status_code == 200:
            result = response.json()
            project_id = result.get("project_id")
            print(f"✅ Test project created: {project_id}")
            
            # Save project ID to .env
            with open(".env", "a") as f:
                f.write(f"\nCONTEXTUS_TEST_PROJECT_ID={project_id}\n")
            
            print(f"✅ Project ID saved to .env file")
            return True
        else:
            print(f"❌ Failed to create project: {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Error creating project: {e}")
        return False

def test_ai_agent():
    """
    Test the AI agent functionality.
    """
    print("\n🧠 Testing AI Agent...")
    
    load_dotenv()
    project_id = os.getenv("CONTEXTUS_TEST_PROJECT_ID")
    collection_id = os.getenv("CONTEXTUS_COLLECTION_ID")
    
    if not project_id or not collection_id:
        print("❌ Missing project or collection ID")
        return False
    
    try:
        # Test query
        response = requests.post(
            f"https://www.contextus.space/v1/projects/{project_id}/query",
            json={"q": "What is this project about?"}
        )
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ AI Agent Response: {result.get('response', 'No response')}")
            return True
        else:
            print(f"❌ AI Agent test failed: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ AI Agent test error: {e}")
        return False

def show_integration_guide():
    """
    Show integration guide for using Contextus with ScribeMD.
    """
    print("\n📚 Integration Guide")
    print("=" * 60)
    print("1. Enhanced API Endpoints:")
    print("   POST /api/enhanced-generate-claim")
    print("   GET  /api/patient-context/<patient_id>")
    print("   POST /api/ai-agent-query")
    print("   GET  /api/ai-insights/<patient_id>")
    
    print("\n2. Key Features:")
    print("   ✅ AI Second Brain for each patient")
    print("   ✅ Context-aware medical coding")
    print("   ✅ Learning from historical data")
    print("   ✅ AI agent queries")
    print("   ✅ Intelligent insights")
    
    print("\n3. Usage Example:")
    print("""
   # Enhanced claim generation
   curl -X POST http://localhost:5000/api/enhanced-generate-claim \\
     -H "Content-Type: application/json" \\
     -d '{
       "transcript": "Doctor: Good morning, John. What brings you in today?",
       "form_type": "cms1500",
       "patient_id": "patient_123",
       "patient_name": "John Doe",
       "doctor_id": "doctor_456"
     }'
   
   # Query AI agent
   curl -X POST http://localhost:5000/api/ai-agent-query \\
     -H "Content-Type: application/json" \\
     -d '{
       "query": "What are the most common diagnoses for this patient?",
       "patient_id": "patient_123"
     }'
   """)
    
    print("\n4. Next Steps:")
    print("   - Run: python src/contextus_enhanced_app.py")
    print("   - Test the enhanced endpoints")
    print("   - Integrate with your frontend")
    print("   - Customize AI agents for your needs")

def main():
    """
    Main setup function.
    """
    print("🚀 Starting Contextus setup...")
    
    # Setup Contextus
    if setup_contextus():
        print("\n✅ Contextus setup completed successfully!")
        
        # Test AI agent
        if test_ai_agent():
            print("✅ AI Agent test passed!")
        else:
            print("⚠️  AI Agent test failed, but setup is complete")
        
        # Show integration guide
        show_integration_guide()
        
        print("\n🎉 You're ready to use Contextus with ScribeMD!")
        print("Run: python src/contextus_enhanced_app.py")
        
    else:
        print("\n❌ Setup failed. Please check the error messages above.")
        print("Make sure you have a valid Contextus Collection ID.")

if __name__ == "__main__":
    main()
