/**
 * Button Automation Framework - Main Exports
 *
 * This file exports all components, hooks, and utilities from the automation framework.
 * Import from this file for a clean API.
 */

// Core Provider
export {
  ButtonAutomationProvider,
  useButtonAutomation,
  useButtonAutomationOptional,
  type ButtonAutomationContext,
  type ButtonAutomationConfig,
  type ButtonAutomationState,
  type AutomationLogEntry,
  type AutomationPlan,
  type AutomationEvent,
  type AutomationEventCallback,
  type AutomationOptions,
} from "./ButtonAutomationProvider";

// Button Registry
export {
  ALL_BUTTONS,
  JOURNEY_BUTTONS,
  CARDIO_TWIN_BUTTONS,
  ATLAS_BUTTONS,
  INTAKE_BUTTONS,
  INTEROP_BUTTONS,
  REVIEW_BUTTONS,
  AQUAHEALTH_BUTTONS,
  ONCOLOGY_BUTTONS,
  AGENTS_BUTTONS,
  GLOBAL_BUTTONS,
  RESEARCH_BUTTONS,
  FOLLOWUP_BUTTONS,
  BUTTON_REGISTRY,
  getButtonById,
  getButtonsByCategory,
  getButtonsByProcess,
  getAutomatableButtons,
  getHighPriorityButtons,
  createButtonId,
  getButtonStatistics,
} from "./buttonRegistry";

// Automation Hooks and Utilities
export {
  useRegisterButtons,
  useRegisterButton,
  useAutomatedButtonHandler,
  useAutomatedFormHandler,
  useAutomatedNavigationHandler,
  useAutomatedApiHandler,
  withAutomation,
  createWorkflowAutomationPlan,
  PREDEFINED_PLANS,
} from "./useButtonAutomationRegistry";

// UI Components
export {
  AutomationPanel,
} from "./AutomationPanel";

export {
  AutomationDashboard,
} from "./AutomationDashboard";

export {
  AutomationToolbar,
  AutomationFloatingButton,
  AutomationStatusBadge,
} from "./AutomationToolbar";

export {
  AutomationShell,
  AutomationStatusBar,
  AutomationToggleButton,
  useAutomationShell,
} from "./AutomationShell";

// Journey Automation
export {
  JourneyAutomation,
} from "./JourneyAutomation";

export {
  journeyAutomationApi,
} from "./journeyAutomationApi";

// Task-automation hook (AutomationPhase / AutomationControl / AutomationTask /
// AutomationStep / AutomationState types live here)
export {
  useAutomation,
  type AutomationController,
} from "./useAutomation";

// Styles
import "./automation.css";
