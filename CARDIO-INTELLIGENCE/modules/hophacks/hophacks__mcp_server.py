#!/usr/bin/env python3
"""
MCP Server for MedRelay Medical Billing AI Agents
This makes your AI agents available as standardized tools for other AI models
"""

import asyncio
import json
import sys
from typing import Any, Dict, List, Optional
from mcp.server import Server
from mcp.server.models import InitializationOptions
from mcp.server.stdio import stdio_server
from mcp.types import (
    CallToolRequest,
    CallToolResult,
    ListToolsRequest,
    ListToolsResult,
    Tool,
    TextContent,
    ImageContent,
)

# Import your existing agents
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from prior_auth_agent import PriorAuthAgent
from ai_agents import create_medical_billing_agent, create_cms_assistant_agent

# Initialize your existing agents
prior_auth_agent = PriorAuthAgent()
medical_billing_agent = create_medical_billing_agent()
cms_assistant_agent = create_cms_assistant_agent()

# Create MCP server
server = Server("medrelay-ai-agents")

@server.list_tools()
async def list_tools() -> List[Tool]:
    """List all available medical AI tools"""
    return [
        Tool(
            name="find_prior_auth_forms",
            description="Find prior authorization forms for a specific state",
            inputSchema={
                "type": "object",
                "properties": {
                    "patient_state": {
                        "type": "string",
                        "description": "Patient's state (e.g., 'MD', 'CA', 'Texas')"
                    },
                    "transcript": {
                        "type": "string", 
                        "description": "Optional clinical transcript for context"
                    }
                },
                "required": ["patient_state"]
            }
        ),
        Tool(
            name="generate_medical_billing",
            description="Generate medical billing forms from clinical transcript",
            inputSchema={
                "type": "object",
                "properties": {
                    "transcript": {
                        "type": "string",
                        "description": "Clinical transcript or conversation"
                    },
                    "patient_info": {
                        "type": "object",
                        "description": "Patient information (name, DOB, insurance, etc.)"
                    },
                    "form_type": {
                        "type": "string",
                        "description": "Type of form to generate (CMS-1500, CMS-1450, etc.)"
                    }
                },
                "required": ["transcript"]
            }
        ),
        Tool(
            name="get_cms_guidance",
            description="Get guidance on CMS form completion and medical coding",
            inputSchema={
                "type": "object",
                "properties": {
                    "question": {
                        "type": "string",
                        "description": "Question about CMS forms, medical coding, or billing"
                    },
                    "form_context": {
                        "type": "string",
                        "description": "Optional context about the specific form being worked on"
                    }
                },
                "required": ["question"]
            }
        ),
        Tool(
            name="web_scrape_medical_forms",
            description="Search and scrape medical forms from state websites",
            inputSchema={
                "type": "object",
                "properties": {
                    "state": {
                        "type": "string",
                        "description": "State to search for forms"
                    },
                    "form_type": {
                        "type": "string",
                        "description": "Type of form to search for (prior_auth, billing, etc.)"
                    }
                },
                "required": ["state"]
            }
        )
    ]

@server.call_tool()
async def call_tool(name: str, arguments: Dict[str, Any]) -> List[TextContent]:
    """Execute the requested medical AI tool"""
    
    try:
        if name == "find_prior_auth_forms":
            patient_state = arguments.get("patient_state")
            transcript = arguments.get("transcript", "")
            
            result = prior_auth_agent.select_prior_auth_form(patient_state, transcript)
            
            return [TextContent(
                type="text",
                text=json.dumps({
                    "success": result.get("success", False),
                    "state": result.get("state"),
                    "forms_found": len(result.get("forms", [])),
                    "forms": result.get("forms", []),
                    "message": result.get("message", "")
                }, indent=2)
            )]
            
        elif name == "generate_medical_billing":
            transcript = arguments.get("transcript")
            patient_info = arguments.get("patient_info", {})
            form_type = arguments.get("form_type", "CMS-1500")
            
            # Use your medical billing agent
            result = medical_billing_agent.process_transcript(transcript, patient_info)
            
            return [TextContent(
                type="text",
                text=json.dumps({
                    "success": True,
                    "form_type": form_type,
                    "generated_data": result,
                    "message": "Medical billing form data generated successfully"
                }, indent=2)
            )]
            
        elif name == "get_cms_guidance":
            question = arguments.get("question")
            form_context = arguments.get("form_context", "")
            
            # Use your CMS assistant agent
            answer = cms_assistant_agent.answer_question(question, form_context)
            
            return [TextContent(
                type="text",
                text=json.dumps({
                    "success": True,
                    "question": question,
                    "answer": answer,
                    "form_context": form_context
                }, indent=2)
            )]
            
        elif name == "web_scrape_medical_forms":
            state = arguments.get("state")
            form_type = arguments.get("form_type", "prior_auth")
            
            # Use the web scraping functionality
            forms = prior_auth_agent._web_scrape_prior_auth_forms(state)
            
            return [TextContent(
                type="text",
                text=json.dumps({
                    "success": True,
                    "state": state,
                    "form_type": form_type,
                    "forms_found": len(forms),
                    "forms": forms
                }, indent=2)
            )]
            
        else:
            return [TextContent(
                type="text",
                text=json.dumps({
                    "success": False,
                    "error": f"Unknown tool: {name}"
                })
            )]
            
    except Exception as e:
        return [TextContent(
            type="text",
            text=json.dumps({
                "success": False,
                "error": str(e)
            })
        )]

async def main():
    """Run the MCP server"""
    async with stdio_server() as (read_stream, write_stream):
        await server.run(
            read_stream,
            write_stream,
            InitializationOptions(
                server_name="medrelay-ai-agents",
                server_version="1.0.0"
            )
        )

if __name__ == "__main__":
    asyncio.run(main())
