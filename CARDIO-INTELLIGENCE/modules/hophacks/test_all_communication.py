#!/usr/bin/env python3
"""
Test all 4 inter-agent communication patterns
"""

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'src'))

from agent_communication import create_agent_communicator, MessageType, get_message_bus
import time

def test_all_communication_patterns():
    """Test all 4 communication patterns"""
    print("🤖 Testing All 4 Inter-Agent Communication Patterns")
    print("=" * 60)
    
    # Create all agents
    speaker_agent = create_agent_communicator("SpeakerAgent")
    pdf_agent = create_agent_communicator("PDFAgent")
    chatbot_agent = create_agent_communicator("ChatbotAgent")
    contextus_agent = create_agent_communicator("ContextusAgent")
    validation_agent = create_agent_communicator("ValidationAgent")
    error_agent = create_agent_communicator("ErrorAgent")
    
    # Pattern 1: PDF → Chatbot Communication
    print("\n📄 Pattern 1: PDF → Chatbot Communication")
    print("-" * 40)
    
    def on_pdf_complete(message):
        print(f"💬 Chatbot: PDF generated!")
        print(f"   Patient: {message.data.get('patient_id')}")
        print(f"   Form: {message.data.get('form_type')}")
        print(f"   → Chatbot context updated with new form data")
    
    chatbot_agent.listen_for(MessageType.PDF_GENERATION_COMPLETE, on_pdf_complete)
    
    # Simulate PDF generation
    pdf_agent.send_message(
        MessageType.PDF_GENERATION_COMPLETE,
        {
            'patient_id': 'patient_123',
            'form_type': 'cms1500',
            'structured_data': {'patient': 'John Doe', 'diagnosis': 'Chest pain'},
            'pdf_path': '/generated/patient_123.pdf'
        }
    )
    
    time.sleep(0.5)
    
    # Pattern 2: Contextus Learning → All Agents
    print("\n🧠 Pattern 2: Contextus Learning → All Agents")
    print("-" * 40)
    
    def on_learning_update(message):
        print(f"📊 Agent: New learning patterns detected")
        print(f"   Patient: {message.data.get('project_id')}")
        print(f"   Patterns: {message.data.get('new_patterns')}")
        print(f"   → Agent can now use updated patient context")
    
    # All agents listen for learning updates
    for agent in [speaker_agent, pdf_agent, chatbot_agent, validation_agent]:
        agent.listen_for(MessageType.CONTEXTUS_LEARNING_UPDATE, on_learning_update)
    
    # Simulate Contextus learning
    contextus_agent.send_message(
        MessageType.CONTEXTUS_LEARNING_UPDATE,
        {
            'project_id': 'project_123',
            'form_type': 'cms1500',
            'new_patterns': {'common_diagnoses': {'M25.511': 3}, 'common_procedures': {'99213': 2}},
            'common_codes': {'icd10': {'M25.511': 3}, 'cpt': {'99213': 2}},
            'confidence_scores': {'diagnosis': 0.9, 'procedures': 0.85}
        }
    )
    
    time.sleep(0.5)
    
    # Pattern 3: Form Validation → PDF Generation
    print("\n✅ Pattern 3: Form Validation → PDF Generation")
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
            'form_type': 'cms1500',
            'is_valid': True,
            'validation_errors': [],
            'recommendations': ['Consider adding modifier codes']
        }
    )
    
    time.sleep(0.5)
    
    # Pattern 4: Error Handling → Recovery
    print("\n⚠️  Pattern 4: Error Handling → Recovery")
    print("-" * 40)
    
    def on_error(message):
        print(f"🚨 Agent: Error detected")
        print(f"   Type: {message.data.get('error_type')}")
        print(f"   Patient: {message.data.get('patient_id')}")
        print(f"   Suggestions: {message.data.get('recovery_suggestions')}")
        print(f"   → Agent can coordinate recovery strategies")
    
    # All agents listen for errors
    for agent in [speaker_agent, pdf_agent, chatbot_agent, contextus_agent, validation_agent]:
        agent.listen_for(MessageType.ERROR_OCCURRED, on_error)
    
    # Simulate different types of errors
    error_types = [
        ("contextus_logging_error", "Contextus API connection failed"),
        ("chatbot_error", "Gemini API rate limit exceeded"),
        ("pdf_generation_error", "PDF template not found"),
        ("validation_error", "Required field missing")
    ]
    
    for error_type, error_message in error_types:
        error_agent.send_message(
            MessageType.ERROR_OCCURRED,
            {
                'error_type': error_type,
                'error_message': error_message,
                'patient_id': 'patient_123',
                'recovery_suggestions': [
                    f"Check {error_type.replace('_', ' ')}",
                    "Retry with backoff",
                    "Use fallback method"
                ]
            }
        )
        time.sleep(0.3)
    
    time.sleep(0.5)
    
    # Show complete message flow
    message_bus = get_message_bus()
    recent_messages = message_bus.get_recent_messages(limit=20)
    
    print("\n📨 Complete Message Flow:")
    print("-" * 40)
    for i, msg in enumerate(recent_messages, 1):
        print(f"{i:2d}. {msg.sender_agent:15} → {msg.message_type.value}")
        if msg.data:
            key_data = {k: v for k, v in msg.data.items() 
                       if k in ['patient_id', 'form_type', 'is_valid', 'error_type', 'project_id']}
            if key_data:
                print(f"     Data: {key_data}")
    
    print(f"\n✅ All Communication Patterns Tested!")
    print(f"   Total messages: {len(recent_messages)}")
    print(f"   Agents involved: {len(set(msg.sender_agent for msg in recent_messages))}")
    print(f"   Message types: {len(set(msg.message_type.value for msg in recent_messages))}")

if __name__ == "__main__":
    test_all_communication_patterns()
