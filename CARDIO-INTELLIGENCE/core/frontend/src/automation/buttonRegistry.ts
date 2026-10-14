/**
 * Comprehensive Button Registry for CLINICASE - ONCOTWIN
 * 
 * This file contains the complete registry of all buttons across every process
 * in the application. Each button is configured for automation capabilities.
 */

import type { ButtonAutomationConfig } from "./ButtonAutomationProvider";

// ============================================================================
// JOURNEY WORKFLOW BUTTONS
// ============================================================================

// Journey intake and progression buttons
export const JOURNEY_BUTTONS: ButtonAutomationConfig[] = [
  {
    id: "journey_start_new",
    label: "Start New Journey",
    actionType: "navigate",
    category: "journey",
    process: "intake",
    priority: "high",
    automationEnabled: true,
    payload: { path: "/journey/new" },
  },
  {
    id: "journey_next_step",
    label: "Continue to Next Step",
    actionType: "workflow_step",
    category: "journey",
    process: "progression",
    priority: "high",
    automationEnabled: true,
  },
  {
    id: "journey_previous_step",
    label: "Go Back to Previous Step",
    actionType: "workflow_step",
    category: "journey",
    process: "progression",
    priority: "medium",
    automationEnabled: true,
  },
  {
    id: "journey_save_progress",
    label: "Save Current Progress",
    actionType: "api_call",
    category: "journey",
    process: "save",
    priority: "high",
    automationEnabled: true,
  },
  {
    id: "journey_submit_mapping",
    label: "Submit Field Mappings",
    actionType: "submit",
    category: "journey",
    process: "mapping",
    priority: "high",
    automationEnabled: true,
    requiresConfirmation: false,
  },
  {
    id: "journey_accept_all_mappings",
    label: "Accept All Mappings",
    actionType: "submit",
    category: "journey",
    process: "mapping",
    priority: "high",
    automationEnabled: true,
    requiresConfirmation: true,
    isDestructive: false,
  },
  {
    id: "journey_reject_all_mappings",
    label: "Reject All Mappings",
    actionType: "reset",
    category: "journey",
    process: "mapping",
    priority: "medium",
    automationEnabled: true,
    requiresConfirmation: true,
    isDestructive: true,
  },
  {
    id: "journey_generate_fhir",
    label: "Generate FHIR Bundle",
    actionType: "data_processing",
    category: "journey",
    process: "standardization",
    priority: "high",
    automationEnabled: true,
  },
  {
    id: "journey_validate_fhir",
    label: "Validate FHIR Bundle",
    actionType: "api_call",
    category: "journey",
    process: "validation",
    priority: "high",
    automationEnabled: true,
  },
  {
    id: "journey_export_passport",
    label: "Export Evidence Passport",
    actionType: "export",
    category: "journey",
    process: "export",
    priority: "medium",
    automationEnabled: true,
  },
  {
    id: "journey_import_evidence",
    label: "Import Evidence",
    actionType: "import",
    category: "journey",
    process: "import",
    priority: "medium",
    automationEnabled: true,
  },
  {
    id: "journey_reset",
    label: "Reset Journey",
    actionType: "reset",
    category: "journey",
    process: "reset",
    priority: "low",
    automationEnabled: true,
    requiresConfirmation: true,
    isDestructive: true,
  },
  {
    id: "journey_open_case",
    label: "Open Journey Case",
    actionType: "navigate",
    category: "journey",
    process: "navigation",
    priority: "high",
    automationEnabled: true,
    payload: { path: "/journey" },
  },
];

// ============================================================================
// CARDIO TWIN BUTTONS
// ============================================================================

export const CARDIO_TWIN_BUTTONS: ButtonAutomationConfig[] = [
  {
    id: "cardiotwin_open_3d",
    label: "Open 3D Heart Viewer",
    actionType: "navigate",
    category: "cardiotwin",
    process: "visualization",
    priority: "high",
    automationEnabled: true,
    payload: { path: "/cardiotwin" },
  },
  {
    id: "cardiotwin_open_hemo",
    label: "Open Hemodynamic Twin",
    actionType: "navigate",
    category: "cardiotwin",
    process: "visualization",
    priority: "high",
    automationEnabled: true,
    payload: { path: "/cardiotwin/hemo" },
  },
  {
    id: "cardiotwin_open_intelligence",
    label: "Open Cardiovascular Intelligence",
    actionType: "navigate",
    category: "cardiotwin",
    process: "visualization",
    priority: "high",
    automationEnabled: true,
    payload: { path: "/cardiotwin/intelligence" },
  },
  {
    id: "cardiotwin_open_atlas",
    label: "Open CardioTwin Atlas",
    actionType: "navigate",
    category: "cardiotwin",
    process: "visualization",
    priority: "high",
    automationEnabled: true,
    payload: { path: "/cardiotwin/atlas" },
  },
  {
    id: "cardiotwin_open_evaluation",
    label: "Open Model Evaluation",
    actionType: "navigate",
    category: "cardiotwin",
    process: "evaluation",
    priority: "medium",
    automationEnabled: true,
    payload: { path: "/cardiotwin/evaluation" },
  },
  {
    id: "cardiotwin_run_analysis",
    label: "Run Cardiovascular Analysis",
    actionType: "data_processing",
    category: "cardiotwin",
    process: "analysis",
    priority: "high",
    automationEnabled: true,
  },
  {
    id: "cardiotwin_replay_history",
    label: "Replay Historical Evidence",
    actionType: "data_processing",
    category: "cardiotwin",
    process: "replay",
    priority: "medium",
    automationEnabled: true,
  },
  {
    id: "cardiotwin_ablation_test",
    label: "Run Modality Ablation Test",
    actionType: "data_processing",
    category: "cardiotwin",
    process: "validation",
    priority: "medium",
    automationEnabled: true,
  },
  {
    id: "cardiotwin_export_results",
    label: "Export Analysis Results",
    actionType: "export",
    category: "cardiotwin",
    process: "export",
    priority: "medium",
    automationEnabled: true,
  },
  {
    id: "cardiotwin_reset_view",
    label: "Reset View",
    actionType: "reset",
    category: "cardiotwin",
    process: "visualization",
    priority: "low",
    automationEnabled: true,
  },
  {
    id: "cardiotwin_toggle_anatomy",
    label: "Toggle Anatomy View",
    actionType: "selection",
    category: "cardiotwin",
    process: "visualization",
    priority: "low",
    automationEnabled: true,
  },
];

// ============================================================================
// ATLAS BUTTONS
// ============================================================================

export const ATLAS_BUTTONS: ButtonAutomationConfig[] = [
  {
    id: "atlas_open_fusion",
    label: "Open Evidence Fusion",
    actionType: "modal_open",
    category: "atlas",
    process: "fusion",
    priority: "high",
    automationEnabled: true,
  },
  {
    id: "atlas_open_graph",
    label: "Open Evidence Graph",
    actionType: "modal_open",
    category: "atlas",
    process: "visualization",
    priority: "high",
    automationEnabled: true,
  },
  {
    id: "atlas_open_copilot",
    label: "Open Cardio Copilot",
    actionType: "modal_open",
    category: "atlas",
    process: "ai_assistance",
    priority: "medium",
    automationEnabled: true,
  },
  {
    id: "atlas_open_sandbox",
    label: "Open Twin Sandbox",
    actionType: "modal_open",
    category: "atlas",
    process: "sandbox",
    priority: "medium",
    automationEnabled: true,
  },
  {
    id: "atlas_reconstruct_sources",
    label: "Reconstruct Imported Sources",
    actionType: "data_processing",
    category: "atlas",
    process: "import",
    priority: "high",
    automationEnabled: true,
  },
  {
    id: "atlas_add_transcript",
    label: "Add Patient Transcript",
    actionType: "submit",
    category: "atlas",
    process: "data_entry",
    priority: "medium",
    automationEnabled: true,
  },
  {
    id: "atlas_ask_question",
    label: "Ask Twin Question",
    actionType: "api_call",
    category: "atlas",
    process: "query",
    priority: "medium",
    automationEnabled: true,
  },
  {
    id: "atlas_filter_evidence",
    label: "Filter Evidence",
    actionType: "filter_change",
    category: "atlas",
    process: "filtering",
    priority: "low",
    automationEnabled: true,
  },
  {
    id: "atlas_select_evidence",
    label: "Select Evidence Node",
    actionType: "selection",
    category: "atlas",
    process: "selection",
    priority: "low",
    automationEnabled: true,
  },
  {
    id: "atlas_toggle_layer",
    label: "Toggle Spatial Layer",
    actionType: "selection",
    category: "atlas",
    process: "visualization",
    priority: "low",
    automationEnabled: true,
  },
  {
    id: "atlas_clear_selection",
    label: "Clear Evidence Selection",
    actionType: "reset",
    category: "atlas",
    process: "selection",
    priority: "low",
    automationEnabled: true,
  },
];

// ============================================================================
// INTAKE AND CASE MANAGEMENT BUTTONS
// ============================================================================

export const INTAKE_BUTTONS: ButtonAutomationConfig[] = [
  {
    id: "intake_new_case",
    label: "Create New Case",
    actionType: "navigate",
    category: "intake",
    process: "creation",
    priority: "high",
    automationEnabled: true,
    payload: { path: "/intake" },
  },
  {
    id: "intake_submit_case",
    label: "Submit New Case",
    actionType: "submit",
    category: "intake",
    process: "creation",
    priority: "high",
    automationEnabled: true,
  },
  {
    id: "intake_bulk_import",
    label: "Bulk Import Cases",
    actionType: "navigate",
    category: "intake",
    process: "import",
    priority: "high",
    automationEnabled: true,
    payload: { path: "/cases/bulk-import" },
  },
  {
    id: "intake_upload_scan",
    label: "Upload Scan",
    actionType: "submit",
    category: "intake",
    process: "upload",
    priority: "high",
    automationEnabled: true,
  },
  {
    id: "intake_process_scan",
    label: "Process Uploaded Scan",
    actionType: "data_processing",
    category: "intake",
    process: "processing",
    priority: "high",
    automationEnabled: true,
  },
  {
    id: "cases_list_all",
    label: "List All Cases",
    actionType: "navigate",
    category: "intake",
    process: "navigation",
    priority: "medium",
    automationEnabled: true,
    payload: { path: "/cases" },
  },
  {
    id: "cases_filter",
    label: "Filter Cases",
    actionType: "filter_change",
    category: "intake",
    process: "filtering",
    priority: "low",
    automationEnabled: true,
  },
  {
    id: "cases_delete",
    label: "Delete Case",
    actionType: "delete",
    category: "intake",
    process: "management",
    priority: "low",
    automationEnabled: true,
    requiresConfirmation: true,
    isDestructive: true,
  },
  {
    id: "cases_export",
    label: "Export Cases",
    actionType: "export",
    category: "intake",
    process: "export",
    priority: "medium",
    automationEnabled: true,
  },
];

// ============================================================================
// INTEROPERABILITY BUTTONS
// ============================================================================

export const INTEROP_BUTTONS: ButtonAutomationConfig[] = [
  {
    id: "interop_open_workbench",
    label: "Open Interop Workbench",
    actionType: "navigate",
    category: "interop",
    process: "navigation",
    priority: "high",
    automationEnabled: true,
    payload: { path: "/interop" },
  },
  {
    id: "interop_map_fields",
    label: "Map Source Fields",
    actionType: "submit",
    category: "interop",
    process: "mapping",
    priority: "high",
    automationEnabled: true,
  },
  {
    id: "interop_validate_mapping",
    label: "Validate Field Mapping",
    actionType: "api_call",
    category: "interop",
    process: "validation",
    priority: "high",
    automationEnabled: true,
  },
  {
    id: "interop_generate_fhir",
    label: "Generate FHIR Resource",
    actionType: "data_processing",
    category: "interop",
    process: "generation",
    priority: "high",
    automationEnabled: true,
  },
  {
    id: "interop_send_to_system_b",
    label: "Send to System B",
    actionType: "api_call",
    category: "interop",
    process: "exchange",
    priority: "high",
    automationEnabled: true,
  },
  {
    id: "interop_round_trip_test",
    label: "Run Round-Trip Test",
    actionType: "api_call",
    category: "interop",
    process: "validation",
    priority: "high",
    automationEnabled: true,
  },
  {
    id: "interop_verify_semantics",
    label: "Verify Semantic Integrity",
    actionType: "api_call",
    category: "interop",
    process: "validation",
    priority: "high",
    automationEnabled: true,
  },
  {
    id: "interop_open_oah_bridge",
    label: "Open OAH Bridge",
    actionType: "navigate",
    category: "interop",
    process: "navigation",
    priority: "medium",
    automationEnabled: true,
    payload: { path: "/oah-bridge" },
  },
  {
    id: "interop_explore_context",
    label: "Explore Real-World Context",
    actionType: "navigate",
    category: "interop",
    process: "navigation",
    priority: "medium",
    automationEnabled: true,
    payload: { path: "/oah-bridge" },
  },
];

// ============================================================================
// REVIEW AND SAFETY BUTTONS
// ============================================================================

export const REVIEW_BUTTONS: ButtonAutomationConfig[] = [
  {
    id: "review_open_queue",
    label: "Open Review Queue",
    actionType: "navigate",
    category: "review",
    process: "navigation",
    priority: "high",
    automationEnabled: true,
    payload: { path: "/aquahealth/review" },
  },
  {
    id: "review_approve_item",
    label: "Approve Review Item",
    actionType: "submit",
    category: "review",
    process: "approval",
    priority: "high",
    automationEnabled: true,
    requiresConfirmation: true,
  },
  {
    id: "review_reject_item",
    label: "Reject Review Item",
    actionType: "submit",
    category: "review",
    process: "rejection",
    priority: "high",
    automationEnabled: true,
    requiresConfirmation: true,
  },
  {
    id: "review_skip_item",
    label: "Skip Review Item",
    actionType: "submit",
    category: "review",
    process: "skipping",
    priority: "medium",
    automationEnabled: true,
    requiresConfirmation: false,
  },
  {
    id: "review_accept_suggestion",
    label: "Accept AI Suggestion",
    actionType: "submit",
    category: "review",
    process: "approval",
    priority: "medium",
    automationEnabled: true,
  },
  {
    id: "review_reject_suggestion",
    label: "Reject AI Suggestion",
    actionType: "submit",
    category: "review",
    process: "rejection",
    priority: "medium",
    automationEnabled: true,
  },
  {
    id: "review_mark_as_reviewed",
    label: "Mark as Reviewed",
    actionType: "submit",
    category: "review",
    process: "completion",
    priority: "high",
    automationEnabled: true,
  },
  {
    id: "review_open_safety_eval",
    label: "Open Safety Evaluation",
    actionType: "navigate",
    category: "review",
    process: "navigation",
    priority: "medium",
    automationEnabled: true,
    payload: { path: "/aquahealth/evaluation" },
  },
];

// ============================================================================
// AQUAHEALTH BUTTONS
// ============================================================================

export const AQUAHEALTH_BUTTONS: ButtonAutomationConfig[] = [
  {
    id: "aquahealth_open_map",
    label: "Open AquaHealth Map",
    actionType: "navigate",
    category: "aquahealth",
    process: "navigation",
    priority: "medium",
    automationEnabled: true,
    payload: { path: "/aquahealth/map" },
  },
  {
    id: "aquahealth_open_observations",
    label: "Open Observations",
    actionType: "navigate",
    category: "aquahealth",
    process: "navigation",
    priority: "medium",
    automationEnabled: true,
    payload: { path: "/aquahealth/observations" },
  },
  {
    id: "aquahealth_new_observation",
    label: "Create New Observation",
    actionType: "navigate",
    category: "aquahealth",
    process: "creation",
    priority: "high",
    automationEnabled: true,
    payload: { path: "/aquahealth/observations/new" },
  },
  {
    id: "aquahealth_submit_observation",
    label: "Submit Observation",
    actionType: "submit",
    category: "aquahealth",
    process: "creation",
    priority: "high",
    automationEnabled: true,
  },
  {
    id: "aquahealth_open_trends",
    label: "Open Trends Analysis",
    actionType: "navigate",
    category: "aquahealth",
    process: "navigation",
    priority: "medium",
    automationEnabled: true,
    payload: { path: "/aquahealth/trends" },
  },
  {
    id: "aquahealth_open_one_health",
    label: "Open One Health Dashboard",
    actionType: "navigate",
    category: "aquahealth",
    process: "navigation",
    priority: "medium",
    automationEnabled: true,
    payload: { path: "/aquahealth/one-health" },
  },
  {
    id: "aquahealth_open_community",
    label: "Open Community Dashboard",
    actionType: "navigate",
    category: "aquahealth",
    process: "navigation",
    priority: "medium",
    automationEnabled: true,
    payload: { path: "/aquahealth/community" },
  },
  {
    id: "aquahealth_filter_observations",
    label: "Filter Observations",
    actionType: "filter_change",
    category: "aquahealth",
    process: "filtering",
    priority: "low",
    automationEnabled: true,
  },
  {
    id: "aquahealth_export_data",
    label: "Export AquaHealth Data",
    actionType: "export",
    category: "aquahealth",
    process: "export",
    priority: "medium",
    automationEnabled: true,
  },
];

// ============================================================================
// ONCOLOGY BUTTONS
// ============================================================================

export const ONCOLOGY_BUTTONS: ButtonAutomationConfig[] = [
  {
    id: "onco_open_module",
    label: "Open Oncology Module",
    actionType: "navigate",
    category: "oncology",
    process: "navigation",
    priority: "high",
    automationEnabled: true,
    payload: { path: "/onco" },
  },
  {
    id: "onco_open_twin",
    label: "Open OncoTwin",
    actionType: "navigate",
    category: "oncology",
    process: "navigation",
    priority: "high",
    automationEnabled: true,
    payload: { path: "/twin" },
  },
  {
    id: "onco_run_analysis",
    label: "Run Oncology Analysis",
    actionType: "data_processing",
    category: "oncology",
    process: "analysis",
    priority: "high",
    automationEnabled: true,
  },
  {
    id: "onco_generate_report",
    label: "Generate Oncology Report",
    actionType: "data_processing",
    category: "oncology",
    process: "reporting",
    priority: "medium",
    automationEnabled: true,
  },
  {
    id: "onco_open_demo",
    label: "Open Guided Twin Demo",
    actionType: "navigate",
    category: "oncology",
    process: "navigation",
    priority: "medium",
    automationEnabled: true,
    payload: { path: "/twin/demo" },
  },
  {
    id: "onco_open_overview",
    label: "Open Twin Overview",
    actionType: "navigate",
    category: "oncology",
    process: "navigation",
    priority: "medium",
    automationEnabled: true,
    payload: { path: "/twin/overview" },
  },
];

// ============================================================================
// AGENTS BUTTONS
// ============================================================================

export const AGENTS_BUTTONS: ButtonAutomationConfig[] = [
  {
    id: "agents_open_dashboard",
    label: "Open AI Agents Dashboard",
    actionType: "navigate",
    category: "agents",
    process: "navigation",
    priority: "medium",
    automationEnabled: true,
    payload: { path: "/agents" },
  },
  {
    id: "agents_activate_agent",
    label: "Activate AI Agent",
    actionType: "api_call",
    category: "agents",
    process: "activation",
    priority: "high",
    automationEnabled: true,
  },
  {
    id: "agents_deactivate_agent",
    label: "Deactivate AI Agent",
    actionType: "api_call",
    category: "agents",
    process: "deactivation",
    priority: "medium",
    automationEnabled: true,
  },
  {
    id: "agents_run_task",
    label: "Run Agent Task",
    actionType: "api_call",
    category: "agents",
    process: "execution",
    priority: "high",
    automationEnabled: true,
  },
  {
    id: "agents_monitor_progress",
    label: "Monitor Agent Progress",
    actionType: "api_call",
    category: "agents",
    process: "monitoring",
    priority: "medium",
    automationEnabled: true,
  },
];

// ============================================================================
// GLOBAL AND UTILITY BUTTONS
// ============================================================================

export const GLOBAL_BUTTONS: ButtonAutomationConfig[] = [
  {
    id: "global_search",
    label: "Global Search",
    actionType: "modal_open",
    category: "global",
    process: "search",
    priority: "medium",
    automationEnabled: true,
  },
  {
    id: "global_notifications",
    label: "Open Notifications",
    actionType: "navigate",
    category: "global",
    process: "navigation",
    priority: "low",
    automationEnabled: true,
    payload: { path: "/notifications" },
  },
  {
    id: "global_help",
    label: "Open Help",
    actionType: "modal_open",
    category: "global",
    process: "help",
    priority: "low",
    automationEnabled: true,
  },
  {
    id: "global_settings",
    label: "Open Settings",
    actionType: "modal_open",
    category: "global",
    process: "settings",
    priority: "low",
    automationEnabled: true,
  },
  {
    id: "global_dashboard",
    label: "Open Dashboard",
    actionType: "navigate",
    category: "global",
    process: "navigation",
    priority: "medium",
    automationEnabled: true,
    payload: { path: "/dashboard" },
  },
  {
    id: "global_architecture",
    label: "Open Architecture View",
    actionType: "navigate",
    category: "global",
    process: "navigation",
    priority: "low",
    automationEnabled: true,
    payload: { path: "/architecture" },
  },
];

// ============================================================================
// RESEARCH AND ANALYTICS BUTTONS
// ============================================================================

export const RESEARCH_BUTTONS: ButtonAutomationConfig[] = [
  {
    id: "research_open_lab",
    label: "Open Twin Research Lab",
    actionType: "navigate",
    category: "research",
    process: "navigation",
    priority: "medium",
    automationEnabled: true,
    payload: { path: "/twin/lab" },
  },
  {
    id: "research_open_ops",
    label: "Open Twin Operations",
    actionType: "navigate",
    category: "research",
    process: "navigation",
    priority: "medium",
    automationEnabled: true,
    payload: { path: "/twin/ops" },
  },
  {
    id: "research_open_cohorts",
    label: "Open Cohorts Dashboard",
    actionType: "navigate",
    category: "research",
    process: "navigation",
    priority: "medium",
    automationEnabled: true,
    payload: { path: "/cohorts" },
  },
  {
    id: "research_run_evaluation",
    label: "Run Evaluation Harness",
    actionType: "navigate",
    category: "research",
    process: "navigation",
    priority: "medium",
    automationEnabled: true,
    payload: { path: "/eval" },
  },
  {
    id: "research_open_roi",
    label: "Open ROI & Value Dashboard",
    actionType: "navigate",
    category: "research",
    process: "navigation",
    priority: "medium",
    automationEnabled: true,
    payload: { path: "/roi" },
  },
  {
    id: "research_open_compliance",
    label: "Open Compliance Dashboard",
    actionType: "navigate",
    category: "research",
    process: "navigation",
    priority: "medium",
    automationEnabled: true,
    payload: { path: "/compliance" },
  },
  {
    id: "research_open_industrialization",
    label: "Open Industrialization Dashboard",
    actionType: "navigate",
    category: "research",
    process: "navigation",
    priority: "medium",
    automationEnabled: true,
    payload: { path: "/industrialize" },
  },
];

// ============================================================================
// FOLLOW-UP AND RETEST BUTTONS
// ============================================================================

export const FOLLOWUP_BUTTONS: ButtonAutomationConfig[] = [
  {
    id: "followup_open_workbench",
    label: "Open Follow-up Workbench",
    actionType: "navigate",
    category: "followup",
    process: "navigation",
    priority: "high",
    automationEnabled: true,
    payload: { path: "/onehealth" },
  },
  {
    id: "followup_schedule_retest",
    label: "Schedule Retest",
    actionType: "submit",
    category: "followup",
    process: "scheduling",
    priority: "high",
    automationEnabled: true,
  },
  {
    id: "followup_mark_complete",
    label: "Mark Follow-up Complete",
    actionType: "submit",
    category: "followup",
    process: "completion",
    priority: "high",
    automationEnabled: true,
  },
  {
    id: "followup_open_notifications",
    label: "Open Notification Preferences",
    actionType: "navigate",
    category: "followup",
    process: "navigation",
    priority: "medium",
    automationEnabled: true,
    payload: { path: "/notifications" },
  },
  {
    id: "followup_export_followup",
    label: "Export Follow-up Data",
    actionType: "export",
    category: "followup",
    process: "export",
    priority: "medium",
    automationEnabled: true,
  },
];

// ============================================================================
// COMPREHENSIVE BUTTON COLLECTION
// ============================================================================

// All buttons in a single array for easy access
export const ALL_BUTTONS: ButtonAutomationConfig[] = [
  ...JOURNEY_BUTTONS,
  ...CARDIO_TWIN_BUTTONS,
  ...ATLAS_BUTTONS,
  ...INTAKE_BUTTONS,
  ...INTEROP_BUTTONS,
  ...REVIEW_BUTTONS,
  ...AQUAHEALTH_BUTTONS,
  ...ONCOLOGY_BUTTONS,
  ...AGENTS_BUTTONS,
  ...GLOBAL_BUTTONS,
  ...RESEARCH_BUTTONS,
  ...FOLLOWUP_BUTTONS,
];

// Create a registry map for quick lookup
export const BUTTON_REGISTRY: Record<string, ButtonAutomationConfig> = {};
ALL_BUTTONS.forEach(button => {
  BUTTON_REGISTRY[button.id] = button;
});

// Export utility functions
export function getButtonById(id: string): ButtonAutomationConfig | undefined {
  return BUTTON_REGISTRY[id];
}

export function getButtonsByCategory(category: string): ButtonAutomationConfig[] {
  return ALL_BUTTONS.filter(button => button.category === category);
}

export function getButtonsByProcess(process: string): ButtonAutomationConfig[] {
  return ALL_BUTTONS.filter(button => button.process === process);
}

export function getAutomatableButtons(): ButtonAutomationConfig[] {
  return ALL_BUTTONS.filter(button => button.automationEnabled);
}

export function getHighPriorityButtons(): ButtonAutomationConfig[] {
  return ALL_BUTTONS.filter(button => button.priority === "high" && button.automationEnabled);
}

export function createButtonId(category: string, process: string, action: string): string {
  return `${category}_${process}_${action}`.toLowerCase().replace(/\s+/g, "_");
}

export function getButtonStatistics(): {
  total: number;
  byCategory: Record<string, number>;
  byProcess: Record<string, number>;
  automatable: number;
  highPriority: number;
} {
  const byCategory: Record<string, number> = {};
  const byProcess: Record<string, number> = {};
  
  ALL_BUTTONS.forEach(button => {
    byCategory[button.category] = (byCategory[button.category] || 0) + 1;
    byProcess[button.process] = (byProcess[button.process] || 0) + 1;
  });
  
  return {
    total: ALL_BUTTONS.length,
    byCategory,
    byProcess,
    automatable: ALL_BUTTONS.filter(b => b.automationEnabled).length,
    highPriority: ALL_BUTTONS.filter(b => b.priority === "high" && b.automationEnabled).length,
  };
}
