/**
 * Automation Shell - Wraps the application with automation capabilities
 * 
 * This component provides the ButtonAutomationProvider at the root level
 * and integrates automation controls into the application shell.
 */

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ButtonAutomationProvider, useButtonAutomation } from "./ButtonAutomationProvider";
import { ALL_BUTTONS } from "./buttonRegistry";
import { PREDEFINED_PLANS } from "./useButtonAutomationRegistry";
import { AutomationDashboard } from "./AutomationDashboard";
import { AutomationToolbar } from "./AutomationToolbar";

export interface AutomationShellProps {
  children: React.ReactNode;
  showDashboard?: boolean;
  showToolbar?: boolean;
}

/**
 * Main Automation Shell that wraps the application
 */
export function AutomationShell({
  children,
  showDashboard: initialShowDashboard = false,
  showToolbar: initialShowToolbar = true,
}: AutomationShellProps) {
  const [showDashboard, setShowDashboard] = useState(initialShowDashboard);
  const [showToolbar, setShowToolbar] = useState(initialShowToolbar);
  
  return (
    <ButtonAutomationProvider>
      <AutomationShellInner 
        setShowDashboard={setShowDashboard}
        setShowToolbar={setShowToolbar}
      >
        {children}
      </AutomationShellInner>
      
      {/* Automation Dashboard Modal */}
      {showDashboard && (
        <div className="automation-dashboard-modal">
          <AutomationDashboard />
          <button 
            className="automation-dashboard-close" 
            onClick={() => setShowDashboard(false)}
          >
            Close Dashboard
          </button>
        </div>
      )}
      
      {/* Automation Toolbar */}
      {showToolbar && <AutomationToolbar onDashboardClick={() => setShowDashboard(true)} />}
    </ButtonAutomationProvider>
  );
}

/**
 * Inner shell component that handles automation state and provides context
 */
function AutomationShellInner({
  children,
  setShowDashboard,
  setShowToolbar,
}: {
  children: React.ReactNode;
  setShowDashboard: React.Dispatch<React.SetStateAction<boolean>>;
  setShowToolbar: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const navigate = useNavigate();
  const automation = useButtonAutomation();
  
  // Initialize automation with all predefined buttons
  useEffect(() => {
    // Register all buttons from the registry
    ALL_BUTTONS.forEach(button => {
      automation.registerButton(button);
    });
    
    // Set the navigation function
    automation.setNavigate(navigate);
    
    // Load predefined plans
    Object.values(PREDEFINED_PLANS).forEach(plan => {
      automation.createPlan(plan);
    });
    
    // Cleanup on unmount
    return () => {
      ALL_BUTTONS.forEach(button => {
        automation.unregisterButton(button.id);
      });
    };
  }, [automation, navigate]);
  
  // Global keyboard shortcuts for automation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + Shift + A = Toggle automation dashboard
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "A") {
        e.preventDefault();
        setShowDashboard(prev => !prev);
      }
      
      // Ctrl/Cmd + Shift + T = Toggle automation toolbar
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "T") {
        e.preventDefault();
        setShowToolbar(prev => !prev);
      }
      
      // Ctrl/Cmd + Shift + S = Stop automation
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "S") {
        e.preventDefault();
        automation.stopAutomation();
      }
      
      // Ctrl/Cmd + Shift + P = Pause/Resume automation
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "P") {
        e.preventDefault();
        if (automation.state.status === "paused") {
          automation.resumeAutomation();
        } else {
          automation.pauseAutomation();
        }
      }
    };
    
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [automation, setShowDashboard, setShowToolbar]);
  
  return <>{children}</>;
}

/**
 * Hook to control automation shell from components
 */
export function useAutomationShell() {
  const automation = useButtonAutomation();
  
  return {
    // Automation state
    isRunning: automation.state.isRunning,
    status: automation.state.status,
    progress: automation.state.progress,
    
    // Automation controls
    startAutomation: automation.startAutomation,
    pauseAutomation: automation.pauseAutomation,
    resumeAutomation: automation.resumeAutomation,
    stopAutomation: automation.stopAutomation,
    resetAutomation: automation.resetAutomation,
    
    // Button operations
    executeButton: automation.executeButton,
    getButton: automation.getButton,
    getButtonsByCategory: automation.getButtonsByCategory,
    getButtonsByProcess: automation.getButtonsByProcess,
    
    // Plan operations
    plans: automation.plans,
    createPlan: automation.createPlan,
    deletePlan: automation.deletePlan,
    
    // Statistics
    statistics: {
      totalButtons: Object.keys(automation.buttons).length,
      automatableButtons: Object.values(automation.buttons)
        .filter(b => b.automationEnabled).length,
      completed: automation.state.completedButtons.length,
      failed: automation.state.failedButtons.length,
    },
  };
}

/**
 * Component to add automation controls to the top bar
 */
export function AutomationStatusBar() {
  const automation = useButtonAutomation();
  
  if (!automation.state.isRunning && automation.state.completedButtons.length === 0) {
    return null;
  }
  
  return (
    <div className="automation-status-bar">
      <div className="automation-status-bar__content">
        {automation.state.isRunning ? (
          <>
            <span className="automation-status-bar__icon automation-status-bar__icon--running">
              ▶
            </span>
            <span>Automation Running</span>
            <span className="automation-status-bar__progress">
              {automation.state.progress}% Complete
            </span>
            <button 
              className="automation-status-bar__btn" 
              onClick={() => automation.pauseAutomation()}
            >
              Pause
            </button>
            <button 
              className="automation-status-bar__btn automation-status-bar__btn--danger" 
              onClick={() => automation.stopAutomation()}
            >
              Stop
            </button>
          </>
        ) : automation.state.status === "paused" ? (
          <>
            <span className="automation-status-bar__icon automation-status-bar__icon--paused">
              ⏸
            </span>
            <span>Automation Paused</span>
            <button 
              className="automation-status-bar__btn automation-status-bar__btn--primary" 
              onClick={() => automation.resumeAutomation()}
            >
              Resume
            </button>
            <button 
              className="automation-status-bar__btn" 
              onClick={() => automation.stopAutomation()}
            >
              Stop
            </button>
          </>
        ) : automation.state.completedButtons.length > 0 ? (
          <>
            <span className="automation-status-bar__icon automation-status-bar__icon--completed">
              ✓
            </span>
            <span>Automation Completed</span>
            <span className="automation-status-bar__summary">
              {automation.state.completedButtons.length} completed, 
              {automation.state.failedButtons.length} failed
            </span>
            <button 
              className="automation-status-bar__btn" 
              onClick={() => automation.resetAutomation()}
            >
              Clear
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Quick access button to toggle automation dashboard
 */
export function AutomationToggleButton() {
  const [showDashboard, setShowDashboard] = useState(false);
  
  return (
    <>
      <button 
        className="automation-toggle-btn" 
        onClick={() => setShowDashboard(prev => !prev)}
        title="Toggle Automation Dashboard (Ctrl+Shift+A)"
      >
        <span className="automation-toggle-btn__icon">⚡</span>
        <span className="automation-toggle-btn__label">Automation</span>
      </button>
      
      {showDashboard && (
        <div className="automation-dashboard-modal">
          <AutomationDashboard />
          <button 
            className="automation-dashboard-close" 
            onClick={() => setShowDashboard(false)}
          >
            Close
          </button>
        </div>
      )}
    </>
  );
}
