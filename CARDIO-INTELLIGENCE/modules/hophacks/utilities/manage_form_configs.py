#!/usr/bin/env python3
"""
Utility script to manage form field configurations
"""

import json
import os
import sys
from pathlib import Path

def list_form_configs():
    """List all available form configurations"""
    config_dir = Path("form_configs")
    if not config_dir.exists():
        print("No form_configs directory found")
        return
    
    print("Available Form Configurations:")
    print("=" * 50)
    
    for file in config_dir.glob("*_field_mapping.json"):
        try:
            with open(file, 'r') as f:
                config = json.load(f)
            print(f"📄 {file.stem}")
            print(f"   Form: {config.get('form_name', 'Unknown')}")
            print(f"   Template: {config.get('pdf_template', 'Unknown')}")
            print(f"   Description: {config.get('description', 'No description')}")
            print()
        except Exception as e:
            print(f"❌ Error reading {file}: {e}")

def show_field_mapping(config_name):
    """Show the field mapping for a specific form"""
    config_file = Path(f"form_configs/{config_name}_field_mapping.json")
    if not config_file.exists():
        print(f"❌ Configuration file not found: {config_file}")
        return
    
    try:
        with open(config_file, 'r') as f:
            config = json.load(f)
        
        print(f"Field Mapping for: {config.get('form_name', 'Unknown')}")
        print("=" * 60)
        
        def print_mapping(mapping, indent=0):
            for key, value in mapping.items():
                if isinstance(value, dict):
                    print(" " * indent + f"📁 {key}:")
                    print_mapping(value, indent + 2)
                else:
                    print(" " * indent + f"• {key}: {value}")
        
        print_mapping(config.get('field_mapping', {}))
        
        if 'special_fields' in config:
            print("\n🔧 Special Fields:")
            print_mapping(config['special_fields'])
            
    except Exception as e:
        print(f"❌ Error reading configuration: {e}")

def edit_field_mapping(config_name):
    """Open the field mapping file for editing"""
    config_file = Path(f"form_configs/{config_name}_field_mapping.json")
    if not config_file.exists():
        print(f"❌ Configuration file not found: {config_file}")
        return
    
    print(f"📝 Opening {config_file} for editing...")
    print("You can edit the field mappings in your preferred editor.")
    print("The file will be automatically reloaded when you save changes.")
    
    # Try to open with default editor
    try:
        if sys.platform == "win32":
            os.system(f"notepad {config_file}")
        elif sys.platform == "darwin":
            os.system(f"open -e {config_file}")
        else:
            os.system(f"nano {config_file}")
    except Exception as e:
        print(f"Could not open editor automatically: {e}")
        print(f"Please manually edit: {config_file}")

def discover_and_create_mapping(pdf_path, form_name):
    """Discover fields from a PDF and create a basic mapping"""
    print(f"🔍 Discovering fields in: {pdf_path}")
    
    # Add src directory to Python path
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))
    
    try:
        from pdf_generator_direct import PDFGeneratorDirect
        
        generator = PDFGeneratorDirect(pdf_template_path=pdf_path)
        fields = generator.discover_form_fields()
        
        if not fields:
            print("❌ No fields found in the PDF")
            return
        
        # Create basic mapping structure
        mapping = {
            "form_name": form_name,
            "pdf_template": pdf_path,
            "description": f"Auto-generated mapping for {form_name} with {len(fields)} fields",
            "field_mapping": {},
            "special_fields": {}
        }
        
        # Group fields by common patterns
        patient_fields = {}
        provider_fields = {}
        diagnosis_fields = {}
        procedure_fields = {}
        other_fields = {}
        
        for field in fields:
            name = field['name'].lower()
            if any(word in name for word in ['patient', 'name', 'dob', 'ssn', 'address']):
                patient_fields[field['name']] = field['name']
            elif any(word in name for word in ['provider', 'doctor', 'physician', 'npi', 'tax']):
                provider_fields[field['name']] = field['name']
            elif any(word in name for word in ['diagnosis', 'diag']):
                diagnosis_fields[field['name']] = field['name']
            elif any(word in name for word in ['cpt', 'procedure', 'service', 'charge']):
                procedure_fields[field['name']] = field['name']
            else:
                other_fields[field['name']] = field['name']
        
        if patient_fields:
            mapping['field_mapping']['patient'] = patient_fields
        if provider_fields:
            mapping['field_mapping']['provider'] = provider_fields
        if diagnosis_fields:
            mapping['field_mapping']['diagnoses'] = diagnosis_fields
        if procedure_fields:
            mapping['field_mapping']['procedures'] = procedure_fields
        if other_fields:
            mapping['special_fields'] = other_fields
        
        # Save the mapping
        output_file = f"form_configs/{form_name.lower().replace(' ', '_')}_field_mapping.json"
        with open(output_file, 'w') as f:
            json.dump(mapping, f, indent=2)
        
        print(f"✅ Created field mapping: {output_file}")
        print(f"📊 Found {len(fields)} total fields")
        print(f"   - Patient fields: {len(patient_fields)}")
        print(f"   - Provider fields: {len(provider_fields)}")
        print(f"   - Diagnosis fields: {len(diagnosis_fields)}")
        print(f"   - Procedure fields: {len(procedure_fields)}")
        print(f"   - Other fields: {len(other_fields)}")
        
    except Exception as e:
        print(f"❌ Error discovering fields: {e}")
        import traceback
        traceback.print_exc()

def main():
    """Main function"""
    if len(sys.argv) < 2:
        print("Form Configuration Manager")
        print("=" * 30)
        print("Usage:")
        print("  python manage_form_configs.py list                    - List all configurations")
        print("  python manage_form_configs.py show <config_name>      - Show field mapping")
        print("  python manage_form_configs.py edit <config_name>      - Edit field mapping")
        print("  python manage_form_configs.py discover <pdf_path> <form_name> - Create new mapping")
        print()
        print("Examples:")
        print("  python manage_form_configs.py list")
        print("  python manage_form_configs.py show tricare")
        print("  python manage_form_configs.py edit cms1500")
        print("  python manage_form_configs.py discover src/application_images/new_form.pdf 'New Form'")
        return
    
    command = sys.argv[1]
    
    if command == "list":
        list_form_configs()
    elif command == "show" and len(sys.argv) > 2:
        show_field_mapping(sys.argv[2])
    elif command == "edit" and len(sys.argv) > 2:
        edit_field_mapping(sys.argv[2])
    elif command == "discover" and len(sys.argv) > 3:
        discover_and_create_mapping(sys.argv[2], sys.argv[3])
    else:
        print("❌ Invalid command or missing arguments")
        print("Use 'python manage_form_configs.py' for help")

if __name__ == "__main__":
    main()
