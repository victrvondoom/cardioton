import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useButtonAutomation } from "./ButtonAutomationProvider";
import { type AutomationPlan, type ButtonAutomationConfig } from "./ButtonAutomationProvider";
import { getButtonById } from "./buttonRegistry";

/**
 * Hook for automatically registering buttons in a component
 * 
 * This hook allows components to register their buttons with the automation
 * framework, making them available for automation.
 */
export function useRegisterButtons(buttonConfigs: ButtonAutomationConfig[]) {
  const automation = useButtonAutomation();
  
  useEffect(() => {
    // Register all buttons
    buttonConfigs.forEach(config => {
      automation.registerButton(config);
    });
    
    // Cleanup function to unregister buttons
    return () => {
      buttonConfigs.forEach(config => {
        automation.unregisterButton(config.id);
      });
    };
  }, [automation, buttonConfigs]);
}

/**
 * Hook for registering a single button
 */
export function useRegisterButton(config: ButtonAutomationConfig) {
  const automation = useButtonAutomation();
  
  useEffect(() => {
    automation.registerButton(config);
    return () => {
      automation.unregisterButton(config.id);
    };
  }, [automation, config]);
}

/**
 * Hook for creating button handlers that support automation
 * 
 * This creates a button click handler that can be automated and also
 * works normally when clicked manually.
 */
export function useAutomatedButtonHandler(
  buttonId: string,
  onClick: () => void | Promise<void>,
  options?: {
    actionType?: ButtonAutomationConfig["actionType"];
    category?: string;
    process?: string;
    priority?: ButtonAutomationConfig["priority"];
    requiresConfirmation?: boolean;
    isDestructive?: boolean;
    automationEnabled?: boolean;
    payload?: Record<string, any>;
    validation?: (data?: any) => boolean;
  }
) {
  const automation = useButtonAutomation();
  
  // Create the button configuration
  const buttonConfig: ButtonAutomationConfig = {
    id: buttonId,
    label: buttonId.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()),
    actionType: options?.actionType || "custom",
    category: options?.category || "global",
    process: options?.process || "custom",
    priority: options?.priority || "medium",
    automationEnabled: options?.automationEnabled !== undefined 
      ? options.automationEnabled 
      : true,
    requiresConfirmation: options?.requiresConfirmation,
    isDestructive: options?.isDestructive,
    payload: options?.payload,
    callback: onClick,
    validation: options?.validation,
  };
  
  // Register the button
  useEffect(() => {
    automation.registerButton(buttonConfig);
    return () => {
      automation.unregisterButton(buttonId);
    };
  }, [automation, buttonId, buttonConfig]);
  
  // Create the click handler
  const handleClick = async (_overridePayload?: any) => {
    // If automation is running this button, let it handle it
    if (automation.state.isRunning && automation.state.currentButtonId === buttonId) {
      // The automation framework will call the callback directly
      return;
    }
    
    // Otherwise, execute normally
    try {
      const result = onClick();
      if (result instanceof Promise) {
        await result;
      }
    } catch (error) {
      console.error(`Error in button handler for ${buttonId}:`, error);
      throw error;
    }
  };
  
  return {
    handleClick,
    isRegistered: automation.getButton(buttonId) !== undefined,
    isAutomatable: automation.canAutomate(buttonId),
    isRunning: automation.state.isRunning && automation.state.currentButtonId === buttonId,
    status: automation.state.isRunning && automation.state.currentButtonId === buttonId ? "running" :
           automation.state.completedButtons.includes(buttonId) ? "completed" :
           automation.state.failedButtons.includes(buttonId) ? "failed" : "idle",
  };
}

/**
 * Hook for creating form submission handlers that support automation
 */
export function useAutomatedFormHandler(
  formId: string,
  onSubmit: (data: any) => void | Promise<void>,
  options?: {
    category?: string;
    process?: string;
    priority?: ButtonAutomationConfig["priority"];
    requiresConfirmation?: boolean;
    validation?: (data?: any) => boolean;
  }
) {
  const automation = useButtonAutomation();
  
  const buttonConfig: ButtonAutomationConfig = {
    id: `${formId}_submit`,
    label: `${formId.replace(/_/g, " ")} Submit`,
    actionType: "submit",
    category: options?.category || "global",
    process: options?.process || "form_submission",
    priority: options?.priority || "high",
    automationEnabled: true,
    requiresConfirmation: options?.requiresConfirmation,
    isDestructive: false,
    callback: onSubmit,
    validation: options?.validation,
  };
  
  // Register the button
  useEffect(() => {
    automation.registerButton(buttonConfig);
    return () => {
      automation.unregisterButton(buttonConfig.id);
    };
  }, [automation, buttonConfig]);
  
  const handleSubmit = async (data: any, event?: React.FormEvent) => {
    if (event) {
      event.preventDefault();
    }
    
    // If this is being called by automation, it will handle the execution
    if (automation.state.isRunning && automation.state.currentButtonId === buttonConfig.id) {
      return;
    }
    
    // Otherwise, execute the submission
    try {
      const result = onSubmit(data);
      if (result instanceof Promise) {
        await result;
      }
    } catch (error) {
      console.error(`Error in form submission for ${formId}:`, error);
      throw error;
    }
  };
  
  return {
    handleSubmit,
    buttonId: buttonConfig.id,
    isAutomatable: automation.canAutomate(buttonConfig.id),
    isRunning: automation.state.isRunning && automation.state.currentButtonId === buttonConfig.id,
  };
}

/**
 * Hook for creating navigation button handlers that support automation
 */
export function useAutomatedNavigationHandler(
  buttonId: string,
  path: string,
  options?: {
    category?: string;
    process?: string;
    priority?: ButtonAutomationConfig["priority"];
    requiresConfirmation?: boolean;
  }
) {
  const automation = useButtonAutomation();
  const navigate = useNavigate();
  
  const buttonConfig: ButtonAutomationConfig = {
    id: buttonId,
    label: buttonId.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()),
    actionType: "navigate",
    category: options?.category || "navigation",
    process: options?.process || "routing",
    priority: options?.priority || "medium",
    automationEnabled: true,
    requiresConfirmation: options?.requiresConfirmation,
    isDestructive: false,
    payload: { path },
    callback: () => navigate(path),
  };
  
  // Register the button and set navigation
  useEffect(() => {
    automation.registerButton(buttonConfig);
    automation.setNavigate(navigate);
    return () => {
      automation.unregisterButton(buttonId);
    };
  }, [automation, buttonId, buttonConfig, navigate]);
  
  const handleClick = () => {
    if (automation.state.isRunning && automation.state.currentButtonId === buttonId) {
      return;
    }
    navigate(path);
  };
  
  return {
    handleClick,
    isAutomatable: automation.canAutomate(buttonId),
    isRunning: automation.state.isRunning && automation.state.currentButtonId === buttonId,
  };
}

/**
 * Hook for creating API call button handlers that support automation
 */
export function useAutomatedApiHandler(
  buttonId: string,
  apiCall: () => Promise<any>,
  options?: {
    category?: string;
    process?: string;
    priority?: ButtonAutomationConfig["priority"];
    requiresConfirmation?: boolean;
    isDestructive?: boolean;
    payload?: Record<string, any>;
  }
) {
  const automation = useButtonAutomation();
  
  const buttonConfig: ButtonAutomationConfig = {
    id: buttonId,
    label: buttonId.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()),
    actionType: "api_call",
    category: options?.category || "api",
    process: options?.process || "data_fetching",
    priority: options?.priority || "high",
    automationEnabled: true,
    requiresConfirmation: options?.requiresConfirmation,
    isDestructive: options?.isDestructive || false,
    payload: options?.payload,
    callback: apiCall,
  };
  
  // Register the button
  useEffect(() => {
    automation.registerButton(buttonConfig);
    return () => {
      automation.unregisterButton(buttonId);
    };
  }, [automation, buttonId, buttonConfig]);
  
  const handleClick = async () => {
    if (automation.state.isRunning && automation.state.currentButtonId === buttonId) {
      return;
    }
    
    try {
      await apiCall();
    } catch (error) {
      console.error(`Error in API call for ${buttonId}:`, error);
      throw error;
    }
  };
  
  return {
    handleClick,
    isAutomatable: automation.canAutomate(buttonId),
    isRunning: automation.state.isRunning && automation.state.currentButtonId === buttonId,
  };
}

/**
 * Hook for wrapping existing button components with automation support
 * 
 * This allows existing button components to be enhanced with automation
 * without modifying their implementation.
 */
export function withAutomation<T extends { onClick?: () => void }>(
  Component: React.ComponentType<T>,
  buttonConfig: ButtonAutomationConfig
) {
  return function WrappedComponent(props: T) {
    const automation = useButtonAutomation();
    
    useEffect(() => {
      automation.registerButton(buttonConfig);
      return () => {
        automation.unregisterButton(buttonConfig.id);
      };
    }, [automation, buttonConfig]);
    
    const handleClick = async () => {
      if (automation.state.isRunning && automation.state.currentButtonId === buttonConfig.id) {
        return;
      }
      
      if (buttonConfig.callback) {
        try {
          const result = buttonConfig.callback() as unknown;
          if (result instanceof Promise) {
            await result;
          }
        } catch (error) {
          console.error(`Error in automated button callback:`, error);
        }
      }
      
      if (props.onClick) {
        props.onClick();
      }
    };
    
    return <Component {...props as T} onClick={handleClick} />;
  };
}

/**
 * Utility function to create a comprehensive automation plan for a workflow
 */
export function createWorkflowAutomationPlan(
  workflowName: string,
  description: string,
  buttonIds: string[]
): AutomationPlan {
  // Validate that all button IDs exist
  const validButtonIds = buttonIds.filter(id => getButtonById(id) !== undefined);
  
  // Get categories from the buttons
  const categories = Array.from(new Set(
    validButtonIds.map(id => {
      const button = getButtonById(id);
      return button?.category || "unknown";
    })
  ));
  
  // Estimate duration based on button count and priorities
  const estimatedDuration = validButtonIds.reduce((total, id) => {
    const button = getButtonById(id);
    if (!button) return total;
    
    // High priority buttons take longer
    const delay = button.priority === "high" ? 2000 : 
                  button.priority === "medium" ? 1500 : 1000;
    return total + delay / 1000; // Convert to seconds
  }, 0);
  
  return {
    id: `plan_${workflowName.toLowerCase().replace(/\s+/g, "_")}_${Date.now()}`,
    name: workflowName,
    description,
    buttonSequence: validButtonIds,
    categories,
    estimatedDuration,
  };
}

/**
 * Predefined automation plans for common workflows
 */
export const PREDEFINED_PLANS = {
  // Complete evidence journey workflow
  completeJourney: createWorkflowAutomationPlan(
    "Complete Evidence Journey",
    "Automates the entire evidence journey from intake to validation",
    [
      "journey_start_new",
      "journey_next_step",
      "journey_submit_mapping",
      "journey_accept_all_mappings",
      "journey_generate_fhir",
      "journey_validate_fhir",
      "journey_export_passport",
    ]
  ),
  
  // Cardiovascular analysis workflow
  cardiovascularAnalysis: createWorkflowAutomationPlan(
    "Cardiovascular Analysis",
    "Runs complete cardiovascular analysis and generates reports",
    [
      "cardiotwin_open_3d",
      "cardiotwin_run_analysis",
      "cardiotwin_replay_history",
      "cardiotwin_ablation_test",
      "cardiotwin_export_results",
    ]
  ),
  
  // Interoperability testing workflow
  interopTesting: createWorkflowAutomationPlan(
    "Interoperability Testing",
    "Tests the complete interop workflow including mapping, generation, and validation",
    [
      "interop_map_fields",
      "interop_validate_mapping",
      "interop_generate_fhir",
      "interop_send_to_system_b",
      "interop_round_trip_test",
      "interop_verify_semantics",
    ]
  ),
  
  // Evidence review workflow
  evidenceReview: createWorkflowAutomationPlan(
    "Evidence Review",
    "Automates the evidence review process",
    [
      "review_open_queue",
      "review_approve_item",
      "review_mark_as_reviewed",
    ]
  ),
  
  // Bulk intake workflow
  bulkIntake: createWorkflowAutomationPlan(
    "Bulk Intake",
    "Handles bulk import and processing of patient cases",
    [
      "intake_bulk_import",
      "intake_upload_scan",
      "intake_process_scan",
      "cases_list_all",
    ]
  ),
  
  // Atlas exploration workflow
  atlasExploration: createWorkflowAutomationPlan(
    "Atlas Exploration",
    "Automates exploration of the CardioTwin Atlas",
    [
      "atlas_open_fusion",
      "atlas_open_graph",
      "atlas_reconstruct_sources",
      "atlas_add_transcript",
      "atlas_ask_question",
    ]
  ),
} as const;
