# Form Configuration Directory

This directory contains field mappings and configurations for different PDF forms used by MedRelay.

## Files

### Field Discovery Results
- `tricare_fields.json` - Raw field discovery results for Tricare form (38 fields)
- `cms1500_fields.json` - Raw field discovery results for CMS-1500 form (270 fields)

### Field Mappings
- `tricare_field_mapping.json` - Organized field mapping for Tricare form
- `cms1500_field_mapping.json` - Organized field mapping for CMS-1500 form

## Usage

### Managing Form Configurations

Use the `manage_form_configs.py` utility to work with form configurations:

```bash
# List all available configurations
python utilities/manage_form_configs.py list

# Show field mapping for a specific form
python utilities/manage_form_configs.py show tricare

# Edit field mapping (opens in your default editor)
python utilities/manage_form_configs.py edit cms1500

# Discover fields from a new PDF and create mapping
python utilities/manage_form_configs.py discover path/to/new_form.pdf "New Form Name"
```

### Field Mapping Structure

Each field mapping file contains:

```json
{
  "form_name": "Human-readable form name",
  "pdf_template": "Path to PDF template file",
  "description": "Description of the form",
  "field_mapping": {
    "patient": {
      "name": "PDF Field Name",
      "dob": "Date of Birth Field Name"
    },
    "provider": {
      "name": "Provider Name Field",
      "npi": "NPI Field Name"
    }
  },
  "special_fields": {
    "custom_field": "PDF Field Name"
  }
}
```

### Adding New Forms

1. **Discover Fields**: Run the field discovery utility on your new PDF
2. **Create Mapping**: Use the manage utility to create a basic mapping
3. **Edit Mapping**: Manually edit the mapping to organize fields logically
4. **Test**: Update your PDF generator to use the new mapping

### Field Naming Conventions

- Use descriptive names that match your data structure
- Group related fields under logical categories (patient, provider, procedures, etc.)
- Keep special fields separate for form-specific requirements
- Use consistent naming across different form types when possible

## Integration

The PDF generator can be configured to use different form mappings by specifying the mapping file path. This allows you to support multiple form types with the same underlying data structure.
