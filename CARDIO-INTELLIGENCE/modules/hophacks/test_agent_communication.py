#!/usr/bin/env python3
"""
Test script to demonstrate inter-agent communication
"""

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'src'))

from agent_communication import create_agent_communicator, MessageType, get_message_bus
from ai_agents import SpeakerIdentificationAgent, MedicalBillingAgent
import time

def test_agent_communication():
    """Test the inter-agent communication system"""
    print("🤖 Testing Inter-Agent Communication System")
    print("=" * 50)
    
    # Create agents
    speaker_agent = SpeakerIdentificationAgent()
    billing_agent = MedicalBillingAgent()
    
    # Test transcript
    test_transcript = """
    Doctor: Good morning, how are you feeling today?
    Patient: I've been having chest pain for the past few days.
    Doctor: Can you describe the pain? Is it sharp or dull?
    Patient: It's more of a pressure feeling, like something heavy on my chest.
    Doctor: I see. Let me examine you and we'll run some tests.
    """
    
    print(f"📝 Test Transcript:")
    print(test_transcript)
    print("\n" + "=" * 50)
    
    # Process transcript with speaker identification
    print("🎤 Processing with SpeakerIdentificationAgent...")
    formatted_transcript = speaker_agent.identify_speakers(test_transcript, "test_patient_123")
    
    print(f"✅ Formatted Transcript:")
    print(formatted_transcript)
    print("\n" + "=" * 50)
    
    # Wait a moment for messages to be processed
    time.sleep(1)
    
    # Check message bus status
    message_bus = get_message_bus()
    recent_messages = message_bus.get_recent_messages(limit=5)
    
    print("📨 Recent Messages:")
    for msg in recent_messages:
        print(f"  - {msg.sender_agent}: {msg.message_type.value}")
        print(f"    Data: {msg.data}")
        print()
    
    # Check agent status
    print("📊 Agent Status:")
    status = speaker_agent.communicator.get_agent_status()
    for agent, info in status.items():
        print(f"  - {agent}: {info['message_count']} messages, last activity: {info['last_activity']}")
    
    print("\n✅ Agent Communication Test Complete!")

if __name__ == "__main__":
    test_agent_communication()
