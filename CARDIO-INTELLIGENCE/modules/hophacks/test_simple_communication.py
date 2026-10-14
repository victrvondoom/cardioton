#!/usr/bin/env python3
"""
Simple test of inter-agent communication without API calls
"""

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'src'))

from agent_communication import create_agent_communicator, MessageType, get_message_bus
import time

def test_simple_communication():
    """Test basic agent communication without API dependencies"""
    print("🤖 Testing Simple Agent Communication")
    print("=" * 40)
    
    # Create communicators for different agents
    speaker_agent = create_agent_communicator("SpeakerAgent")
    pdf_agent = create_agent_communicator("PDFAgent")
    billing_agent = create_agent_communicator("BillingAgent")
    
    # Set up listeners
    def on_speaker_complete(message):
        print(f"📄 PDFAgent received: {message.message_type.value}")
        print(f"   Patient ID: {message.data.get('patient_id')}")
        print(f"   Status: {message.data.get('status')}")
        
        # PDF agent responds
        pdf_agent.send_message(
            MessageType.PDF_GENERATION_READY,
            {
                'patient_id': message.data.get('patient_id'),
                'pdf_path': f"/generated/{message.data.get('patient_id')}.pdf",
                'status': 'ready'
            }
        )
    
    def on_pdf_ready(message):
        print(f"📋 BillingAgent received: {message.message_type.value}")
        print(f"   PDF Path: {message.data.get('pdf_path')}")
        print(f"   Status: {message.data.get('status')}")
    
    # Set up the communication chain
    pdf_agent.listen_for(MessageType.SPEAKER_IDENTIFICATION_COMPLETE, on_speaker_complete)
    billing_agent.listen_for(MessageType.PDF_GENERATION_READY, on_pdf_ready)
    
    print("🔗 Communication chain set up:")
    print("   SpeakerAgent → PDFAgent → BillingAgent")
    print()
    
    # Simulate speaker identification completion
    print("🎤 SpeakerAgent: Processing audio...")
    time.sleep(0.5)
    
    speaker_agent.send_message(
        MessageType.SPEAKER_IDENTIFICATION_COMPLETE,
        {
            'patient_id': 'patient_123',
            'speakers': ['Doctor', 'Patient'],
            'status': 'success'
        }
    )
    
    # Wait for messages to propagate
    time.sleep(1)
    
    # Check message history
    message_bus = get_message_bus()
    recent_messages = message_bus.get_recent_messages(limit=10)
    
    print("\n📨 Message Flow:")
    for i, msg in enumerate(recent_messages, 1):
        print(f"  {i}. {msg.sender_agent} → {msg.message_type.value}")
        print(f"     Data: {msg.data}")
        print()
    
    print("✅ Communication Test Complete!")
    print(f"   Total messages: {len(recent_messages)}")
    print(f"   Agents involved: {len(set(msg.sender_agent for msg in recent_messages))}")

if __name__ == "__main__":
    test_simple_communication()
