#!/usr/bin/env python3
"""
Test the enhanced endpoints to see Contextus integration in action
"""

import requests
import json

def test_enhanced_endpoints():
    """Test the enhanced endpoints that create Contextus projects."""
    
    base_url = "http://localhost:5000"
    
    print("🧪 Testing Enhanced Endpoints with Contextus Integration")
    print("=" * 60)
    
    # Test 1: Enhanced Claim Generation
    print("\n1️⃣ Testing Enhanced Claim Generation")
    print("-" * 40)
    
    enhanced_claim_data = {
        "transcript": "Doctor: Good morning, Sarah. What brings you in today? Patient: I've been having chest pain for the past week. Doctor: Let me examine you and we'll run some tests.",
        "form_type": "cms1500",
        "patient_id": "sarah_001",
        "patient_name": "Sarah Johnson",
        "doctor_id": "doc_001"
    }
    
    try:
        response = requests.post(
            f"{base_url}/api/enhanced-generate-claim",
            json=enhanced_claim_data,
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Enhanced claim generation successful!")
            print(f"   AI Agent: {result.get('ai_agent_used', 'Unknown')}")
            print(f"   Patient Context Used: {result.get('patient_context_used', False)}")
            print(f"   Project ID: {result.get('contextus_project_id', 'None')}")
        else:
            print(f"❌ Enhanced claim generation failed: {response.status_code}")
            print(f"   Response: {response.text}")
            
    except Exception as e:
        print(f"❌ Error testing enhanced claim generation: {e}")
    
    # Test 2: AI Agent Query
    print("\n2️⃣ Testing AI Agent Query")
    print("-" * 40)
    
    query_data = {
        "query": "What are the most common diagnoses for this patient?",
        "patient_id": "sarah_001"
    }
    
    try:
        response = requests.post(
            f"{base_url}/api/ai-agent-query",
            json=query_data,
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ AI Agent query successful!")
            print(f"   Query: {result.get('query', 'Unknown')}")
            print(f"   Response: {result.get('response', 'No response')[:100]}...")
            print(f"   Project ID: {result.get('project_id', 'None')}")
        else:
            print(f"❌ AI Agent query failed: {response.status_code}")
            print(f"   Response: {response.text}")
            
    except Exception as e:
        print(f"❌ Error testing AI agent query: {e}")
    
    # Test 3: AI Insights
    print("\n3️⃣ Testing AI Insights")
    print("-" * 40)
    
    try:
        response = requests.get(
            f"{base_url}/api/ai-insights/sarah_001",
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ AI Insights successful!")
            print(f"   Patient: {result.get('patient_name', 'Unknown')}")
            print(f"   Project ID: {result.get('project_id', 'None')}")
            print(f"   Billing Patterns: {len(result.get('billing_patterns', {}))}")
            print(f"   AI Recommendations: {len(result.get('ai_recommendations', []))}")
        else:
            print(f"❌ AI Insights failed: {response.status_code}")
            print(f"   Response: {response.text}")
            
    except Exception as e:
        print(f"❌ Error testing AI insights: {e}")
    
    print(f"\n🎯 Summary:")
    print(f"   - Enhanced endpoints create Contextus projects automatically")
    print(f"   - Each patient gets their own AI Second Brain")
    print(f"   - The system learns from each interaction")
    print(f"   - Check your Contextus collection to see new projects!")

if __name__ == "__main__":
    test_enhanced_endpoints()
