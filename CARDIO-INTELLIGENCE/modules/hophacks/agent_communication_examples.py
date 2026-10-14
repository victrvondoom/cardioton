#!/usr/bin/env python3
"""
Examples of Inter-Agent Communication Patterns
Shows how agents can communicate for better coordination
"""

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'src'))

from agent_communication import create_agent_communicator, MessageType, get_message_bus
import time

def demonstrate_communication_patterns():
    """Demonstrate various inter-agent communication patterns"""
    print("🤖 Inter-Agent Communication Patterns")
    print("=" * 50)
    
    # Create agents
    speaker_agent = create_agent_communicator("SpeakerAgent")
    pdf_agent = create_agent_communicator("PDFAgent")
    chatbot_agent = create_agent_communicator("ChatbotAgent")
    contextus_agent = create_agent_communicator("ContextusAgent")
    validation_agent = create_agent_communicator("ValidationAgent")
    
    # Pattern 1: Speaker → PDF → Chatbot
    print("\n📋 Pattern 1: Speaker → PDF → Chatbot")
    print("-" * 40)
    
    def on_speaker_complete(message):
        print(f"📄 PDFAgent: Speaker identification complete")
        print(f"   Patient: {message.data.get('patient_id')}")
        print(f"   Speakers: {message.data.get('speakers')}")
        
        # PDF agent processes and notifies chatbot
        pdf_agent.send_message(
            MessageType.PDF_GENERATION_COMPLETE,
            {
                'patient_id': message.data.get('patient_id'),
                'form_type': 'cms1500',
                'structured_data': {'patient': 'John Doe', 'diagnosis': 'Chest pain'},
                'pdf_path': '/generated/patient_123.pdf'
            }
        )
    
    def on_pdf_complete(message):
        print(f"💬 ChatbotAgent: New PDF generated")
        print(f"   Form: {message.data.get('form_type')}")
        print(f"   Data: {message.data.get('structured_data')}")
        print(f"   → Chatbot now has updated context for better responses")
    
    pdf_agent.listen_for(MessageType.SPEAKER_IDENTIFICATION_COMPLETE, on_speaker_complete)
    chatbot_agent.listen_for(MessageType.PDF_GENERATION_COMPLETE, on_pdf_complete)
    
    # Simulate speaker identification
    speaker_agent.send_message(
        MessageType.SPEAKER_IDENTIFICATION_COMPLETE,
        {'patient_id': 'patient_123', 'speakers': ['Doctor', 'Patient']}
    )
    
    time.sleep(0.5)
    
    # Pattern 2: Contextus Learning → All Agents
    print("\n🧠 Pattern 2: Contextus Learning → All Agents")
    print("-" * 40)
    
    def on_learning_update(message):
        print(f"📊 All Agents: New learning patterns detected")
        print(f"   Patient: {message.data.get('patient_id')}")
        print(f"   Patterns: {message.data.get('new_patterns')}")
        print(f"   → All agents can now use updated patient context")
    
    # All agents listen for learning updates
    for agent in [speaker_agent, pdf_agent, chatbot_agent, validation_agent]:
        agent.listen_for(MessageType.CONTEXTUS_LEARNING_UPDATE, on_learning_update)
    
    # Simulate Contextus learning
    contextus_agent.send_message(
        MessageType.CONTEXTUS_LEARNING_UPDATE,
        {
            'patient_id': 'patient_123',
            'new_patterns': {'common_diagnoses': ['M25.511'], 'success_rate': 0.95},
            'confidence_scores': {'diagnosis': 0.9, 'procedures': 0.85}
        }
    )
    
    time.sleep(0.5)
    
    # Pattern 3: Error Handling → Recovery
    print("\n⚠️  Pattern 3: Error Handling → Recovery")
    print("-" * 40)
    
    def on_error(message):
        print(f"🚨 All Agents: Error detected")
        print(f"   Type: {message.data.get('error_type')}")
        print(f"   Patient: {message.data.get('patient_id')}")
        print(f"   Suggestions: {message.data.get('recovery_suggestions')}")
        print(f"   → Agents can coordinate recovery strategies")
    
    # All agents listen for errors
    for agent in [speaker_agent, pdf_agent, chatbot_agent, contextus_agent, validation_agent]:
        agent.listen_for(MessageType.ERROR_OCCURRED, on_error)
    
    # Simulate error
    validation_agent.send_message(
        MessageType.ERROR_OCCURRED,
        {
            'error_type': 'validation_error',
            'patient_id': 'patient_123',
            'error_message': 'Invalid diagnosis code',
            'recovery_suggestions': ['Check ICD-10 format', 'Verify code exists']
        }
    )
    
    time.sleep(0.5)
    
    # Pattern 4: Form Validation → PDF Generation
    print("\n✅ Pattern 4: Form Validation → PDF Generation")
    print("-" * 40)
    
    def on_validation_complete(message):
        print(f"📄 PDFAgent: Form validation complete")
        print(f"   Valid: {message.data.get('is_valid')}")
        print(f"   Errors: {message.data.get('validation_errors')}")
        if message.data.get('is_valid'):
            print(f"   → PDF generation can proceed safely")
        else:
            print(f"   → PDF generation should wait for fixes")
    
    pdf_agent.listen_for(MessageType.FORM_VALIDATION_COMPLETE, on_validation_complete)
    
    # Simulate validation
    validation_agent.send_message(
        MessageType.FORM_VALIDATION_COMPLETE,
        {
            'patient_id': 'patient_123',
            'is_valid': True,
            'validation_errors': [],
            'recommendations': ['Consider adding modifier codes']
        }
    )
    
    time.sleep(0.5)
    
    # Show message history
    message_bus = get_message_bus()
    recent_messages = message_bus.get_recent_messages(limit=10)
    
    print("\n📨 Complete Message Flow:")
    print("-" * 40)
    for i, msg in enumerate(recent_messages, 1):
        print(f"{i:2d}. {msg.sender_agent:15} → {msg.message_type.value}")
        if msg.data:
            key_data = {k: v for k, v in msg.data.items() if k in ['patient_id', 'form_type', 'is_valid', 'error_type']}
            if key_data:
                print(f"     Data: {key_data}")
    
    print(f"\n✅ Communication Patterns Demonstrated!")
    print(f"   Total messages: {len(recent_messages)}")
    print(f"   Agents involved: {len(set(msg.sender_agent for msg in recent_messages))}")

if __name__ == "__main__":
    demonstrate_communication_patterns()
