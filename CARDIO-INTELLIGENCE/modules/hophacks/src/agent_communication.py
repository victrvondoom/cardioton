#!/usr/bin/env python3
"""
Inter-Agent Communication System
Simple message bus for agent coordination without direct dependencies
"""

import threading
import time
from typing import Dict, List, Callable, Any
from dataclasses import dataclass
from enum import Enum


class MessageType(Enum):
    """Types of messages agents can send"""
    SPEAKER_IDENTIFICATION_COMPLETE = "speaker_identification_complete"
    TRANSCRIPT_PROCESSING_COMPLETE = "transcript_processing_complete"
    PDF_GENERATION_READY = "pdf_generation_ready"
    PDF_GENERATION_COMPLETE = "pdf_generation_complete"
    FORM_VALIDATION_COMPLETE = "form_validation_complete"
    CONTEXTUS_LEARNING_UPDATE = "contextus_learning_update"
    CHATBOT_CONTEXT_UPDATE = "chatbot_context_update"
    ERROR_OCCURRED = "error_occurred"


@dataclass
class AgentMessage:
    """Message structure for inter-agent communication"""
    message_type: MessageType
    sender_agent: str
    data: Dict[str, Any]
    timestamp: float
    message_id: str


class AgentMessageBus:
    """Simple message bus for agent communication"""
    
    def __init__(self):
        self.subscribers: Dict[MessageType, List[Callable]] = {}
        self.message_history: List[AgentMessage] = []
        self.lock = threading.Lock()
        self.message_counter = 0
    
    def subscribe(self, message_type: MessageType, callback: Callable[[AgentMessage], None]):
        """Subscribe to a specific message type"""
        with self.lock:
            if message_type not in self.subscribers:
                self.subscribers[message_type] = []
            self.subscribers[message_type].append(callback)
    
    def publish(self, message_type: MessageType, sender_agent: str, data: Dict[str, Any] = None):
        """Publish a message to all subscribers"""
        if data is None:
            data = {}
        
        message = AgentMessage(
            message_type=message_type,
            sender_agent=sender_agent,
            data=data,
            timestamp=time.time(),
            message_id=f"{sender_agent}_{self.message_counter}"
        )
        
        with self.lock:
            self.message_counter += 1
            self.message_history.append(message)
            
            # Notify subscribers
            if message_type in self.subscribers:
                for callback in self.subscribers[message_type]:
                    try:
                        callback(message)
                    except Exception as e:
                        print(f"Error in message callback from {sender_agent}: {e}")
    
    def get_messages_for_agent(self, agent_name: str, message_type: MessageType = None) -> List[AgentMessage]:
        """Get messages for a specific agent"""
        with self.lock:
            if message_type:
                return [msg for msg in self.message_history 
                       if msg.sender_agent == agent_name and msg.message_type == message_type]
            return [msg for msg in self.message_history if msg.sender_agent == agent_name]
    
    def get_recent_messages(self, message_type: MessageType = None, limit: int = 10) -> List[AgentMessage]:
        """Get recent messages, optionally filtered by type"""
        with self.lock:
            messages = self.message_history[-limit:] if limit else self.message_history
            if message_type:
                return [msg for msg in messages if msg.message_type == message_type]
            return messages


# Global message bus instance
message_bus = AgentMessageBus()


class AgentCommunicator:
    """Helper class for agents to easily send and receive messages"""
    
    def __init__(self, agent_name: str):
        self.agent_name = agent_name
        self.message_bus = message_bus
    
    def send_message(self, message_type: MessageType, data: Dict[str, Any] = None):
        """Send a message to other agents"""
        self.message_bus.publish(message_type, self.agent_name, data)
        print(f"📤 {self.agent_name} sent {message_type.value}")
    
    def listen_for(self, message_type: MessageType, callback: Callable[[AgentMessage], None]):
        """Listen for specific message types"""
        self.message_bus.subscribe(message_type, callback)
        print(f"👂 {self.agent_name} listening for {message_type.value}")
    
    def wait_for_message(self, message_type: MessageType, timeout: float = 5.0) -> AgentMessage:
        """Wait for a specific message type with timeout"""
        received_message = None
        event = threading.Event()
        
        def message_handler(message: AgentMessage):
            nonlocal received_message
            received_message = message
            event.set()
        
        self.listen_for(message_type, message_handler)
        
        if event.wait(timeout):
            return received_message
        else:
            raise TimeoutError(f"Timeout waiting for {message_type.value}")
    
    def get_agent_status(self) -> Dict[str, Any]:
        """Get status of all agents based on recent messages"""
        recent_messages = self.message_bus.get_recent_messages(limit=20)
        agent_status = {}
        
        for message in recent_messages:
            agent = message.sender_agent
            if agent not in agent_status:
                agent_status[agent] = {
                    'last_activity': message.timestamp,
                    'last_message_type': message.message_type.value,
                    'message_count': 0
                }
            agent_status[agent]['message_count'] += 1
            agent_status[agent]['last_activity'] = max(
                agent_status[agent]['last_activity'], 
                message.timestamp
            )
        
        return agent_status


# Example usage patterns for different agents:

class SpeakerIdentificationAgent:
    """Example of how speaker identification agent would communicate"""
    
    def __init__(self):
        self.communicator = AgentCommunicator("SpeakerIdentificationAgent")
        self._setup_listeners()
    
    def _setup_listeners(self):
        """Set up message listeners"""
        pass  # This agent mainly sends messages
    
    def process_audio(self, audio_data: bytes, patient_id: str):
        """Process audio and notify other agents when complete"""
        try:
            # Process audio (existing logic)
            speakers = self._identify_speakers(audio_data)
            
            # Send completion message
            self.communicator.send_message(
                MessageType.SPEAKER_IDENTIFICATION_COMPLETE,
                {
                    'patient_id': patient_id,
                    'speakers': speakers,
                    'status': 'success'
                }
            )
            
        except Exception as e:
            # Send error message
            self.communicator.send_message(
                MessageType.ERROR_OCCURRED,
                {
                    'patient_id': patient_id,
                    'error': str(e),
                    'agent': 'SpeakerIdentificationAgent'
                }
            )
    
    def _identify_speakers(self, audio_data: bytes):
        """Mock speaker identification"""
        return ["Doctor", "Patient"]


class PDFGenerationAgent:
    """Example of how PDF generation agent would communicate"""
    
    def __init__(self):
        self.communicator = AgentCommunicator("PDFGenerationAgent")
        self._setup_listeners()
    
    def _setup_listeners(self):
        """Listen for speaker identification completion"""
        self.communicator.listen_for(
            MessageType.SPEAKER_IDENTIFICATION_COMPLETE,
            self._on_speaker_identification_complete
        )
    
    def _on_speaker_identification_complete(self, message: AgentMessage):
        """Handle speaker identification completion"""
        data = message.data
        patient_id = data.get('patient_id')
        speakers = data.get('speakers', [])
        
        print(f"📄 PDF Generation Agent: Speaker identification complete for patient {patient_id}")
        print(f"   Speakers identified: {speakers}")
        
        # Now we can safely generate PDF with speaker information
        self.generate_pdf(patient_id, speakers)
    
    def generate_pdf(self, patient_id: str, speakers: List[str]):
        """Generate PDF with speaker information"""
        print(f"📄 Generating PDF for patient {patient_id} with speakers: {speakers}")
        
        # Send completion message
        self.communicator.send_message(
            MessageType.PDF_GENERATION_READY,
            {
                'patient_id': patient_id,
                'speakers': speakers,
                'pdf_path': f"/generated/{patient_id}.pdf"
            }
        )


# Utility functions for easy integration
def create_agent_communicator(agent_name: str) -> AgentCommunicator:
    """Create a communicator for an agent"""
    return AgentCommunicator(agent_name)


def get_message_bus() -> AgentMessageBus:
    """Get the global message bus"""
    return message_bus
