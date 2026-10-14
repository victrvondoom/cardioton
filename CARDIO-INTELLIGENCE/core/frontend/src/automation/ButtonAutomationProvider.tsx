import { createContext, useContext, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

/**
 * Comprehensive Button Automation Framework for CLINICASE - ONCOTWIN
 * 
 * This provider enables automation of all button interactions across every process
 * in the application, including:
 * - Form submissions
 * - Navigation actions
 * - Data processing triggers
 * - Modal/dialog controls
 * - Workflow progression
 * - API calls and data fetching
 */

// Types for button automation
export type ButtonActionType = 
  | "navigate"
  | "submit"
  | "api_call"
  | "modal_open"
  | "modal_close"
  | "workflow_step"
  | "data_processing"
  | "filter_change"
  | "selection"
  | "export"
  | "import"
  | "reset"
  | "delete"
  | "custom";

export interface ButtonAutomationConfig {
  id: string;                          // Unique button identifier
  label: string;                      // Human-readable label
  actionType: ButtonActionType;       // Type of action this button performs
  category: string;                   // Process category (e.g., "journey", "cardiotwin", "intake")
  process: string;                    // Specific process name
  priority: "low" | "medium" | "high"; // Automation priority
  isDestructive?: boolean;           // Whether action is destructive
  requiresConfirmation?: boolean;    // Whether action needs confirmation
  automationEnabled: boolean;         // Whether this button can be automated
  conditions?: Record<string, any>;   // Conditions for automation
  payload?: Record<string, any>;      // Data payload for the action
  callback?: (data?: any) => void;    // Callback function
  validation?: (data?: any) => boolean; // Validation function
}

export interface ButtonAutomationState {
  isRunning: boolean;
  currentButtonId: string | null;
  completedButtons: string[];
  failedButtons: string[];
  executionLog: AutomationLogEntry[];
  status: "idle" | "running" | "paused" | "completed" | "failed" | "cancelled";
  progress: number;
  totalButtons: number;
  startedAt?: number | null;
  finishedAt?: number | null;
}

export interface AutomationLogEntry {
  timestamp: number;
  buttonId: string;
  action: string;
  status: "started" | "completed" | "failed";
  duration?: number;
  error?: string;
  data?: any;
}

export interface AutomationPlan {
  id: string;
  name: string;
  description: string;
  buttonSequence: string[];           // Ordered list of button IDs to automate
  categories: string[];              // Process categories involved
  estimatedDuration: number;         // Estimated duration in seconds
  preConditions?: Record<string, any>;
  postConditions?: Record<string, any>;
}

export interface ButtonAutomationContext {
  // Button registry
  buttons: Record<string, ButtonAutomationConfig>;
  registerButton: (config: ButtonAutomationConfig) => void;
  unregisterButton: (id: string) => void;
  getButton: (id: string) => ButtonAutomationConfig | undefined;
  
  // Automation state
  state: ButtonAutomationState;
  
  // Automation plans
  plans: AutomationPlan[];
  createPlan: (plan: Omit<AutomationPlan, "id">) => string;
  deletePlan: (planId: string) => void;
  
  // Automation controls
  startAutomation: (buttonIds: string[] | AutomationPlan, options?: AutomationOptions) => Promise<boolean>;
  pauseAutomation: () => void;
  resumeAutomation: () => void;
  stopAutomation: () => void;
  resetAutomation: () => void;
  
  // Individual button actions
  executeButton: (buttonId: string, overridePayload?: any) => Promise<boolean>;
  
  // Event listeners
  on: (event: AutomationEvent, callback: AutomationEventCallback) => () => void;
  
  // Utility functions
  getButtonsByCategory: (category: string) => ButtonAutomationConfig[];
  getButtonsByProcess: (process: string) => ButtonAutomationConfig[];
  canAutomate: (buttonId: string) => boolean;
  
  // Navigation wiring (used by the execution engine for "navigate" actions)
  setNavigate: (navigate: (path: string) => void) => void;
}

export type AutomationEvent = 
  | "automation_started"
  | "automation_paused"
  | "automation_resumed"
  | "automation_completed"
  | "automation_failed"
  | "automation_stopped"
  | "button_started"
  | "button_completed"
  | "button_failed"
  | "plan_created"
  | "plan_deleted"
  | "automation_reset";

export type AutomationEventCallback = (data: any) => void;

export interface AutomationOptions {
  delayBetweenActions?: number;      // Delay between button actions in ms
  skipConfirmations?: boolean;       // Skip confirmation dialogs
  continueOnError?: boolean;        // Continue automation even if a button fails
  maxRetries?: number;               // Maximum retries for failed actions
  timeout?: number;                  // Timeout for individual actions in ms
  onProgress?: (progress: number, current: string, total: number) => void;
  onError?: (error: Error, buttonId: string) => void;
  onComplete?: (completed: string[], failed: string[]) => void;
}

// Default automation options
const DEFAULT_OPTIONS: AutomationOptions = {
  delayBetweenActions: 1000,
  skipConfirmations: false,
  continueOnError: false,
  maxRetries: 3,
  timeout: 30000,
};

// Create context
const ButtonAutomationContext = createContext<ButtonAutomationContext | null>(null);

// Event emitter for automation events
class AutomationEventEmitter {
  private listeners: Map<AutomationEvent, Set<AutomationEventCallback>> = new Map();
  
  emit(event: AutomationEvent, data: any) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in automation event listener for ${event}:`, error);
        }
      });
    }
  }
  
  on(event: AutomationEvent, callback: AutomationEventCallback): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
    
    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }
  
  clear() {
    this.listeners.clear();
  }
}

// Button execution engine
class ButtonExecutionEngine {
  private buttonRegistry: Record<string, ButtonAutomationConfig>;
  private eventEmitter: AutomationEventEmitter;
  private navigate: (path: string) => void;
  
  constructor(
    buttonRegistry: Record<string, ButtonAutomationConfig>,
    eventEmitter: AutomationEventEmitter,
    navigate: (path: string) => void
  ) {
    this.buttonRegistry = buttonRegistry;
    this.eventEmitter = eventEmitter;
    this.navigate = navigate;
  }
  
  async executeButton(buttonId: string, overridePayload?: any, _options?: AutomationOptions): Promise<boolean> {
    const button = this.buttonRegistry[buttonId];
    if (!button) {
      throw new Error(`Button not found: ${buttonId}`);
    }
    
    const startTime = Date.now();
    
    try {
      // Emit button started event
      this.eventEmitter.emit("button_started", { buttonId, button });
      
      // Check if button can be automated
      if (!button.automationEnabled) {
        throw new Error(`Button ${buttonId} does not support automation`);
      }
      
      // Validate preconditions if they exist
      if (button.validation && !button.validation(overridePayload)) {
        throw new Error(`Validation failed for button ${buttonId}`);
      }
      
      // Execute the appropriate action based on action type
      const payload = overridePayload || button.payload || {};
      
      switch (button.actionType) {
        case "navigate":
          this.navigate(payload.path || "/");
          break;
          
        case "submit":
          // For form submissions, we would typically trigger the form's onSubmit
          if (button.callback) {
            button.callback(payload);
          }
          break;
          
        case "api_call":
          // Execute API call
          if (button.callback) {
            await button.callback(payload);
          }
          break;
          
        case "modal_open":
        case "modal_close":
          if (button.callback) {
            button.callback(payload);
          }
          break;
          
        case "workflow_step":
          if (button.callback) {
            await button.callback(payload);
          }
          break;
          
        case "data_processing":
          if (button.callback) {
            await button.callback(payload);
          }
          break;
          
        case "filter_change":
        case "selection":
        case "export":
        case "import":
        case "reset":
        case "delete":
        case "custom":
          if (button.callback) {
            await button.callback(payload);
          }
          break;
          
        default:
          throw new Error(`Unknown action type: ${button.actionType}`);
      }
      
      // Emit button completed event
      this.eventEmitter.emit("button_completed", { 
        buttonId, 
        duration: Date.now() - startTime 
      });
      
      return true;
      
    } catch (error) {
      // Emit button failed event
      this.eventEmitter.emit("button_failed", { 
        buttonId, 
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime
      });
      
      throw error;
    }
  }
  
  async executeButtonWithRetry(
    buttonId: string, 
    overridePayload: any, 
    options: AutomationOptions,
    attempt: number = 1
  ): Promise<boolean> {
    const mergedOptions = { ...DEFAULT_OPTIONS, ...options };
    
    try {
      return await this.executeButton(buttonId, overridePayload, options);
    } catch (error) {
      if (attempt >= (mergedOptions.maxRetries || 3)) {
        throw error;
      }
      
      // Exponential backoff
      const delay = Math.pow(2, attempt) * 100;
      await new Promise(resolve => setTimeout(resolve, delay));
      
      return this.executeButtonWithRetry(buttonId, overridePayload, options, attempt + 1);
    }
  }
}

// Main provider component
export function ButtonAutomationProvider({ children }: { children: ReactNode }) {
  const [buttons, setButtons] = useState<Record<string, ButtonAutomationConfig>>({});
  const [state, setState] = useState<ButtonAutomationState>({
    isRunning: false,
    currentButtonId: null,
    completedButtons: [],
    failedButtons: [],
    executionLog: [],
    status: "idle",
    progress: 0,
    totalButtons: 0,
  });
  
  const [plans, setPlans] = useState<AutomationPlan[]>([]);
  const navigateRef = useRef<((path: string) => void) | null>(null);
  
  const eventEmitter = useMemo(() => new AutomationEventEmitter(), []);
  const executionEngine = useRef<ButtonExecutionEngine | null>(null);
  
  // Refs for current automation state
  const isRunningRef = useRef(false);
  const shouldStopRef = useRef(false);
  const shouldPauseRef = useRef(false);
  const currentAutomationRef = useRef<{ 
    buttonIds: string[]; 
    options: AutomationOptions;
    startTime: number;
  } | null>(null);
  
  // Initialize execution engine
  useEffect(() => {
    if (navigateRef.current) {
      executionEngine.current = new ButtonExecutionEngine(
        buttons, 
        eventEmitter, 
        navigateRef.current
      );
    }
  }, [buttons, eventEmitter]);
  
  // Event listeners for state changes
  useEffect(() => {
    const unsubscribeStart = eventEmitter.on("automation_started", () => {
      setState(prev => ({ ...prev, status: "running", isRunning: true }));
    });
    
    const unsubscribePause = eventEmitter.on("automation_paused", () => {
      setState(prev => ({ ...prev, status: "paused" }));
    });
    
    const unsubscribeResume = eventEmitter.on("automation_resumed", () => {
      setState(prev => ({ ...prev, status: "running" }));
    });
    
    const unsubscribeComplete = eventEmitter.on("automation_completed", (data) => {
      setState(prev => ({
        ...prev,
        status: "completed",
        isRunning: false,
        completedButtons: data.completed || [],
        failedButtons: data.failed || [],
        progress: 100,
        finishedAt: Date.now(),
      }));
      
      // Log completion
      addLogEntry({
        timestamp: Date.now(),
        buttonId: "automation",
        action: "automation_completed",
        status: "completed",
        data: data,
      });
    });
    
    const unsubscribeFailed = eventEmitter.on("automation_failed", (data) => {
      setState(prev => ({
        ...prev,
        status: "failed",
        isRunning: false,
        failedButtons: data.failedButtons || [],
      }));
      
      addLogEntry({
        timestamp: Date.now(),
        buttonId: "automation",
        action: "automation_failed",
        status: "failed",
        error: data.error,
        data: data,
      });
    });
    
    const unsubscribeStopped = eventEmitter.on("automation_stopped", () => {
      setState(prev => ({
        ...prev,
        status: "cancelled",
        isRunning: false,
      }));
    });
    
    const unsubscribeButtonStarted = eventEmitter.on("button_started", (data) => {
      setState(prev => ({
        ...prev,
        currentButtonId: data.buttonId,
        progress: Math.round((prev.completedButtons.length + 1) / Math.max(1, prev.totalButtons) * 100),
      }));
      
      addLogEntry({
        timestamp: Date.now(),
        buttonId: data.buttonId,
        action: "button_started",
        status: "started",
        data: data,
      });
    });
    
    const unsubscribeButtonCompleted = eventEmitter.on("button_completed", (data) => {
      setState(prev => ({
        ...prev,
        completedButtons: [...prev.completedButtons, data.buttonId],
        currentButtonId: null,
        progress: Math.round((prev.completedButtons.length + 1) / Math.max(1, prev.totalButtons) * 100),
      }));
      
      addLogEntry({
        timestamp: Date.now(),
        buttonId: data.buttonId,
        action: "button_completed",
        status: "completed",
        duration: data.duration,
        data: data,
      });
    });
    
    const unsubscribeButtonFailed = eventEmitter.on("button_failed", (data) => {
      setState(prev => ({
        ...prev,
        failedButtons: [...prev.failedButtons, data.buttonId],
        currentButtonId: null,
      }));
      
      addLogEntry({
        timestamp: Date.now(),
        buttonId: data.buttonId,
        action: "button_failed",
        status: "failed",
        error: data.error,
        duration: data.duration,
        data: data,
      });
    });
    
    return () => {
      unsubscribeStart();
      unsubscribePause();
      unsubscribeResume();
      unsubscribeComplete();
      unsubscribeFailed();
      unsubscribeStopped();
      unsubscribeButtonStarted();
      unsubscribeButtonCompleted();
      unsubscribeButtonFailed();
    };
  }, [eventEmitter, state.totalButtons]);
  
  const addLogEntry = useCallback((entry: AutomationLogEntry) => {
    setState(prev => ({
      ...prev,
      executionLog: [...prev.executionLog, entry],
    }));
  }, []);
  
  // Button registry functions
  const registerButton = useCallback((config: ButtonAutomationConfig) => {
    setButtons(prev => {
      const newButtons = { ...prev, [config.id]: config };
      return newButtons;
    });
  }, []);
  
  const unregisterButton = useCallback((id: string) => {
    setButtons(prev => {
      const newButtons = { ...prev };
      delete newButtons[id];
      return newButtons;
    });
  }, []);
  
  const getButton = useCallback((id: string) => {
    return buttons[id];
  }, [buttons]);
  
  const getButtonsByCategory = useCallback((category: string) => {
    return Object.values(buttons).filter(button => button.category === category);
  }, [buttons]);
  
  const getButtonsByProcess = useCallback((process: string) => {
    return Object.values(buttons).filter(button => button.process === process);
  }, [buttons]);
  
  const canAutomate = useCallback((buttonId: string) => {
    const button = buttons[buttonId];
    return button ? button.automationEnabled : false;
  }, [buttons]);
  
  // Automation plan functions
  const createPlan = useCallback((plan: Omit<AutomationPlan, "id">): string => {
    const newPlan: AutomationPlan = {
      ...plan,
      id: `plan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };
    
    setPlans(prev => [...prev, newPlan]);
    eventEmitter.emit("plan_created", newPlan);
    return newPlan.id;
  }, [eventEmitter]);
  
  const deletePlan = useCallback((planId: string) => {
    setPlans(prev => prev.filter(plan => plan.id !== planId));
    eventEmitter.emit("plan_deleted", { planId });
  }, [eventEmitter]);
  
  // Navigation function (to be set by components)
  const setNavigate = useCallback((navigate: (path: string) => void) => {
    navigateRef.current = navigate;
    
    // Recreate execution engine with new navigate function
    executionEngine.current = new ButtonExecutionEngine(
      buttons, 
      eventEmitter, 
      navigate
    );
  }, [buttons, eventEmitter]);
  
  // Individual button execution
  const executeButton = useCallback(async (buttonId: string, overridePayload?: any) => {
    if (!executionEngine.current) {
      throw new Error("Execution engine not initialized. Ensure navigate is set.");
    }
    
    if (!buttons[buttonId]) {
      throw new Error(`Button ${buttonId} not found`);
    }
    
    return executionEngine.current.executeButton(buttonId, overridePayload, DEFAULT_OPTIONS);
  }, [buttons]);
  
  // Main automation function
  const startAutomation = useCallback(async (
    buttonIdsOrPlan: string[] | AutomationPlan, 
    options: AutomationOptions = {}
  ): Promise<boolean> => {
    if (isRunningRef.current) {
      console.warn("Automation is already running");
      return false;
    }
    
    if (shouldStopRef.current) {
      shouldStopRef.current = false;
    }
    
    if (shouldPauseRef.current) {
      shouldPauseRef.current = false;
    }
    
    const mergedOptions = { ...DEFAULT_OPTIONS, ...options };
    
    // Extract button IDs from plan or use direct array
    const buttonIds = Array.isArray(buttonIdsOrPlan) 
      ? buttonIdsOrPlan 
      : buttonIdsOrPlan.buttonSequence;
    
    // Filter out invalid buttons
    const validButtonIds = buttonIds.filter(id => buttons[id] && buttons[id].automationEnabled);
    
    if (validButtonIds.length === 0) {
      throw new Error("No valid buttons to automate");
    }
    
    // Set up automation state
    isRunningRef.current = true;
    shouldStopRef.current = false;
    shouldPauseRef.current = false;
    
    currentAutomationRef.current = {
      buttonIds: validButtonIds,
      options: mergedOptions,
      startTime: Date.now(),
    };
    
    setState(prev => ({
      ...prev,
      isRunning: true,
      currentButtonId: null,
      completedButtons: [],
      failedButtons: [],
      status: "running",
      progress: 0,
      totalButtons: validButtonIds.length,
      startedAt: Date.now(),
      finishedAt: null,
    }));
    
    eventEmitter.emit("automation_started", { buttonIds: validButtonIds });
    
    // Execute buttons in sequence
    for (let i = 0; i < validButtonIds.length; i++) {
      const buttonId = validButtonIds[i];
      
      // Check for pause or stop
      if (shouldStopRef.current) {
        eventEmitter.emit("automation_stopped", {
          completed: validButtonIds.slice(0, i),
          remaining: validButtonIds.slice(i),
        });
        return false;
      }
      
      if (shouldPauseRef.current) {
        eventEmitter.emit("automation_paused", {
          currentButtonId: buttonId,
          completed: validButtonIds.slice(0, i),
          remaining: validButtonIds.slice(i),
        });
        
        // Wait for resume
        while (shouldPauseRef.current && !shouldStopRef.current) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        if (shouldStopRef.current) {
          eventEmitter.emit("automation_stopped", {
            completed: validButtonIds.slice(0, i),
            remaining: validButtonIds.slice(i),
          });
          return false;
        }
      }
      
      try {
        // Execute with retry logic
        if (!executionEngine.current) {
          throw new Error("Execution engine not available");
        }
        
        const success = await executionEngine.current.executeButtonWithRetry(
          buttonId,
          undefined,
          mergedOptions,
          1
        );
        
        if (!success && !mergedOptions.continueOnError) {
          eventEmitter.emit("automation_failed", {
            buttonId,
            error: `Button execution failed: ${buttonId}`,
            completed: validButtonIds.slice(0, i),
            failed: [buttonId],
          });
          return false;
        }
        
        // Add delay between actions
        if (i < validButtonIds.length - 1 && mergedOptions.delayBetweenActions) {
          await new Promise(resolve => setTimeout(
            resolve, 
            mergedOptions.delayBetweenActions
          ));
        }
        
      } catch (error) {
        if (!mergedOptions.continueOnError) {
          eventEmitter.emit("automation_failed", {
            buttonId,
            error: error instanceof Error ? error.message : String(error),
            completed: validButtonIds.slice(0, i),
            failed: [buttonId],
          });
          return false;
        } else {
          // Continue on error - just log it
          console.warn(`Button ${buttonId} failed but continuing:`, error);
        }
      }
    }
    
    // Automation completed
    isRunningRef.current = false;
    eventEmitter.emit("automation_completed", {
      completed: validButtonIds,
      failed: state.failedButtons,
      duration: Date.now() - (currentAutomationRef.current?.startTime || Date.now()),
    });
    
    currentAutomationRef.current = null;
    return true;
    
  }, [buttons, state.failedButtons, eventEmitter]);
  
  const pauseAutomation = useCallback(() => {
    shouldPauseRef.current = true;
    eventEmitter.emit("automation_paused", {});
  }, [eventEmitter]);
  
  const resumeAutomation = useCallback(() => {
    shouldPauseRef.current = false;
    eventEmitter.emit("automation_resumed", {});
  }, [eventEmitter]);
  
  const stopAutomation = useCallback(() => {
    shouldStopRef.current = true;
    isRunningRef.current = false;
    eventEmitter.emit("automation_stopped", {});
  }, [eventEmitter]);
  
  const resetAutomation = useCallback(() => {
    shouldStopRef.current = false;
    shouldPauseRef.current = false;
    isRunningRef.current = false;
    currentAutomationRef.current = null;
    
    setState({
      isRunning: false,
      currentButtonId: null,
      completedButtons: [],
      failedButtons: [],
      executionLog: [],
      status: "idle",
      progress: 0,
      totalButtons: 0,
      startedAt: null,
      finishedAt: null,
    });
    
    eventEmitter.emit("automation_reset", {});
  }, [eventEmitter]);
  
  // Event listener subscription
  const on = useCallback((
    event: AutomationEvent, 
    callback: AutomationEventCallback
  ): (() => void) => {
    return eventEmitter.on(event, callback);
  }, [eventEmitter]);
  
  // Context value
  const contextValue = useMemo(() => ({
    buttons,
    registerButton,
    unregisterButton,
    getButton,
    state,
    plans,
    createPlan,
    deletePlan,
    startAutomation,
    pauseAutomation,
    resumeAutomation,
    stopAutomation,
    resetAutomation,
    executeButton,
    on,
    getButtonsByCategory,
    getButtonsByProcess,
    canAutomate,
    setNavigate, // Expose setNavigate for components to set the navigation function
  }), [
    buttons,
    registerButton,
    unregisterButton,
    getButton,
    state,
    plans,
    createPlan,
    deletePlan,
    startAutomation,
    pauseAutomation,
    resumeAutomation,
    stopAutomation,
    resetAutomation,
    executeButton,
    on,
    getButtonsByCategory,
    getButtonsByProcess,
    canAutomate,
  ]);
  
  return (
    <ButtonAutomationContext.Provider value={contextValue}>
      {children}
    </ButtonAutomationContext.Provider>
  );
}

// Hook to use the automation context
export function useButtonAutomation(): ButtonAutomationContext {
  const context = useContext(ButtonAutomationContext);
  if (!context) {
    throw new Error("useButtonAutomation must be used within a ButtonAutomationProvider");
  }
  return context;
}

// Optional hook with null check
export function useButtonAutomationOptional(): ButtonAutomationContext | null {
  return useContext(ButtonAutomationContext);
}
