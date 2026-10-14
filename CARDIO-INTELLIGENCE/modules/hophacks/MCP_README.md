# MedRelay MCP Server

This MCP (Model Context Protocol) server exposes your MedRelay AI agents as standardized tools that can be used by other AI models like Claude Desktop, GPT-4, or any MCP-compatible client.

## What This Gives You

### 🤖 **AI Model Integration**
- **Claude Desktop** can directly use your medical billing tools
- **GPT-4** can access your prior authorization form finder
- **Any MCP client** can leverage your specialized medical AI

### 🛠️ **Available Tools**

1. **`find_prior_auth_forms`**
   - Find prior authorization forms for any state
   - Uses your web scraping and local form database
   - Returns both local and online form suggestions

2. **`generate_medical_billing`**
   - Generate medical billing forms from clinical transcripts
   - Uses your medical billing AI agent
   - Supports CMS-1500, CMS-1450, and other forms

3. **`get_cms_guidance`**
   - Get expert guidance on CMS form completion
   - Medical coding assistance
   - Billing compliance help

4. **`web_scrape_medical_forms`**
   - Search state websites for medical forms
   - Real-time form discovery
   - Official government form sources

## Setup Instructions

### 1. Install MCP Dependencies
```bash
pip install -r requirements_mcp.txt
```

### 2. Test the MCP Server
```bash
python hophacks__mcp_server.py
```

### 3. Configure Claude Desktop
Add to your Claude Desktop MCP configuration:

```json
{
  "mcpServers": {
    "medrelay-ai-agents": {
      "command": "python",
      "args": ["hophacks__mcp_server.py"],
      "cwd": "/path/to/your/HopHacks",
      "env": {
        "PYTHONPATH": "/path/to/your/HopHacks/src"
      }
    }
  }
}
```

## Example Usage

### In Claude Desktop:
```
"Find prior authorization forms for a patient in Maryland"
```

### In GPT-4 with MCP:
```
"Generate a CMS-1500 form for this patient transcript: [transcript]"
```

### In Any MCP Client:
```python
# Your AI agents are now available as tools
result = await call_tool("find_prior_auth_forms", {
    "patient_state": "MD",
    "transcript": "Patient needs prior auth for MRI scan"
})
```

## Benefits for Your Medical Billing App

### 🔄 **Reusability**
- Your AI agents work in multiple contexts
- Not just limited to your web app
- Can be used by other developers

### 📈 **Enhanced Capabilities**
- AI models can combine your tools with others
- More powerful medical AI workflows
- Better integration with EHR systems

### 🏥 **Medical Industry Integration**
- Connect to Epic, Cerner, Allscripts
- Integrate with insurance APIs
- Link to medical coding databases

### 🚀 **Future-Proofing**
- Standardized AI tool interface
- Easy to add new capabilities
- Compatible with emerging AI platforms

## Advanced Use Cases

### 1. **Multi-Agent Workflows**
```
Claude Desktop → Your Prior Auth Tool → Insurance API → EHR System
```

### 2. **Automated Billing Pipeline**
```
Patient Transcript → Your Billing Agent → CMS Forms → Insurance Submission
```

### 3. **Medical Coding Assistant**
```
Procedure Description → Your CMS Agent → ICD-10 Codes → Billing Codes
```

## Next Steps

1. **Test the MCP server** with your existing agents
2. **Configure Claude Desktop** to use your tools
3. **Add more specialized tools** (EHR integration, insurance APIs)
4. **Create medical workflows** that combine multiple tools
5. **Share with other developers** in the medical AI space

Your MedRelay AI agents are now part of the broader AI ecosystem! 🎉
