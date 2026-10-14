/**
 * Automation Toolbar - Floating toolbar for quick access to automation controls
 */

import { useEffect, useRef, useState } from "react";
import { Play, Pause, StopCircle, RotateCcw, Plus, LayoutDashboard, List, X, Zap, Clock, CheckCircle2, XCircle } from "lucide-react";
import { useButtonAutomation } from "./ButtonAutomationProvider";

export interface AutomationToolbarProps {
  onDashboardClick?: () => void;
  position?: "left" | "right" | "top" | "bottom";
}

export function AutomationToolbar({ 
  onDashboardClick, 
  position = "right" 
}: AutomationToolbarProps) {
  const automation = useButtonAutomation();
  const [isExpanded, setIsExpanded] = useState(false);
  const [recentPlans, setRecentPlans] = useState<string[]>([]);
  const toolbarRef = useRef<HTMLDivElement>(null);
  
  // Track recent plans
  useEffect(() => {
    if (automation.plans.length > 0) {
      // Get the most recently created plans
      const recent = automation.plans
        .slice()
        .sort((a, b) => b.id.localeCompare(a.id))
        .slice(0, 3)
        .map(p => p.id);
      setRecentPlans(recent);
    }
  }, [automation.plans]);
  
  // Handle clicks outside the toolbar
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(event.target as Node)) {
        setIsExpanded(false);
      }
    };
    
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  
  // Quick run functions
  const runRecentPlan = (planId: string) => {
    const plan = automation.plans.find(p => p.id === planId);
    if (plan) {
      automation.startAutomation(plan);
      setIsExpanded(false);
    }
  };
  
  // Calculate progress color
  const getProgressColor = () => {
    if (automation.state.progress >= 75) return "#10b981"; // Green
    if (automation.state.progress >= 50) return "#f59e0b"; // Orange
    if (automation.state.progress >= 25) return "#f97316"; // Orange-Red
    return "#ef4444"; // Red
  };
  
  // Get status icon
  const getStatusIcon = () => {
    if (automation.state.status === "running") return <Play size={16} />;
    if (automation.state.status === "paused") return <Pause size={16} />;
    if (automation.state.status === "completed") return <CheckCircle2 size={16} />;
    if (automation.state.status === "failed") return <XCircle size={16} />;
    if (automation.state.status === "cancelled") return <StopCircle size={16} />;
    return <Zap size={16} />;
  };
  
  // Get status text
  const getStatusText = () => {
    if (automation.state.status === "running") return "Running";
    if (automation.state.status === "paused") return "Paused";
    if (automation.state.status === "completed") return "Completed";
    if (automation.state.status === "failed") return "Failed";
    if (automation.state.status === "cancelled") return "Stopped";
    return "Ready";
  };
  
  // Main toolbar rendering
  return (
    <div 
      className={`automation-toolbar automation-toolbar--${position} ${isExpanded ? "expanded" : ""}`}
      ref={toolbarRef}
    >
      {/* Compact toolbar button */}
      <div className="automation-toolbar__compact" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="automation-toolbar__status">
          <span className="automation-toolbar__status-icon">
            {getStatusIcon()}
          </span>
          <span className="automation-toolbar__status-text">{getStatusText()}</span>
        </div>
        
        {automation.state.progress > 0 && automation.state.status === "running" && (
          <div className="automation-toolbar__progress">
            <svg width="40" height="40" viewBox="0 0 40 40">
              <circle
                cx="20"
                cy="20"
                r="18"
                fill="none"
                stroke="#374151"
                strokeWidth="3"
              />
              <circle
                cx="20"
                cy="20"
                r="18"
                fill="none"
                stroke={getProgressColor()}
                strokeWidth="3"
                strokeDasharray={`${2 * Math.PI * 18}`}
                strokeDashoffset={`${2 * Math.PI * 18 * (1 - automation.state.progress / 100)}`}
                transform="rotate(-90 20 20)"
              />
              <text x="20" y="24" textAnchor="middle" fill="white" fontSize="10">
                {automation.state.progress}%
              </text>
            </svg>
          </div>
        )}
      </div>
      
      {/* Expanded toolbar */}
      {isExpanded && (
        <div className="automation-toolbar__expanded">
          
          {/* Status section */}
          <div className="automation-toolbar__section">
            <div className="automation-toolbar__section-header">
              <Zap size={14} />
              <span>Automation Status</span>
            </div>
            
            <div className="automation-toolbar__status-details">
              <div className="automation-toolbar__stat">
                <span className="automation-toolbar__stat-label">Status</span>
                <span className={`automation-toolbar__stat-value automation-status--${automation.state.status}`}>
                  {getStatusText()}
                </span>
              </div>
              
              <div className="automation-toolbar__stat">
                <span className="automation-toolbar__stat-label">Progress</span>
                <span className="automation-toolbar__stat-value">
                  {automation.state.progress}%
                </span>
              </div>
              
              <div className="automation-toolbar__stat">
                <span className="automation-toolbar__stat-label">Buttons</span>
                <span className="automation-toolbar__stat-value">
                  {automation.state.totalButtons}
                </span>
              </div>
              
              <div className="automation-toolbar__stat">
                <span className="automation-toolbar__stat-label">Completed</span>
                <span className="automation-toolbar__stat-value automation-stat--success">
                  {automation.state.completedButtons.length}
                </span>
              </div>
              
              {automation.state.failedButtons.length > 0 && (
                <div className="automation-toolbar__stat">
                  <span className="automation-toolbar__stat-label">Failed</span>
                  <span className="automation-toolbar__stat-value automation-stat--error">
                    {automation.state.failedButtons.length}
                  </span>
                </div>
              )}
            </div>
          </div>
          
          {/* Controls section */}
          <div className="automation-toolbar__section">
            <div className="automation-toolbar__section-header">
              <Clock size={14} />
              <span>Controls</span>
            </div>
            
            <div className="automation-toolbar__controls">
              {automation.state.status !== "running" ? (
                <button
                  className="automation-toolbar__control-btn automation-toolbar__control-btn--primary"
                  onClick={() => {
                    // Run all high priority buttons as a quick demo
                    const highPriorityButtons = Object.values(automation.buttons)
                      .filter(b => b.priority === "high" && b.automationEnabled)
                      .slice(0, 5)
                      .map(b => b.id);
                    
                    if (highPriorityButtons.length > 0) {
                      automation.startAutomation(highPriorityButtons);
                    }
                  }}
                  disabled={automation.state.isRunning}
                >
                  <Play size={14} /> Run High Priority
                </button>
              ) : (
                <button
                  className="automation-toolbar__control-btn automation-toolbar__control-btn--warning"
                  onClick={() => automation.pauseAutomation()}
                  disabled={automation.state.status !== "running"}
                >
                  <Pause size={14} /> Pause
                </button>
              )}
              
              {automation.state.status === "paused" && (
                <button
                  className="automation-toolbar__control-btn automation-toolbar__control-btn--primary"
                  onClick={() => automation.resumeAutomation()}
                >
                  <Play size={14} /> Resume
                </button>
              )}
              
              <button
                className="automation-toolbar__control-btn automation-toolbar__control-btn--danger"
                onClick={() => automation.stopAutomation()}
                disabled={!automation.state.isRunning && automation.state.status !== "paused"}
              >
                <StopCircle size={14} /> Stop
              </button>
              
              <button
                className="automation-toolbar__control-btn"
                onClick={() => automation.resetAutomation()}
                disabled={automation.state.completedButtons.length === 0 && 
                         automation.state.failedButtons.length === 0 && 
                         !automation.state.isRunning}
              >
                <RotateCcw size={14} /> Reset
              </button>
            </div>
          </div>
          
          {/* Quick actions section */}
          <div className="automation-toolbar__section">
            <div className="automation-toolbar__section-header">
              <Zap size={14} />
              <span>Quick Actions</span>
            </div>
            
            <div className="automation-toolbar__quick-actions">
              <button
                className="automation-toolbar__quick-action"
                onClick={() => onDashboardClick?.()}
              >
                <LayoutDashboard size={14} />
                <span>Open Dashboard</span>
              </button>
              
              <button
                className="automation-toolbar__quick-action"
                onClick={() => {
                  // Create a new quick automation plan
                  automation.createPlan({
                    name: `Quick Automation ${Date.now()}`,
                    description: "Quick automation created from toolbar",
                    buttonSequence: [],
                    categories: [],
                    estimatedDuration: 0,
                  });
                }}
              >
                <Plus size={14} />
                <span>New Plan</span>
              </button>
              
              <button
                className="automation-toolbar__quick-action"
                onClick={() => {
                  // List all automation plans
                  console.log("Available automation plans:", automation.plans);
                }}
              >
                <List size={14} />
                <span>List Plans</span>
              </button>
            </div>
          </div>
          
          {/* Recent plans section */}
          {recentPlans.length > 0 && (
            <div className="automation-toolbar__section">
              <div className="automation-toolbar__section-header">
                <Clock size={14} />
                <span>Recent Plans</span>
              </div>
              
              <div className="automation-toolbar__recent-plans">
                {recentPlans.map(planId => {
                  const plan = automation.plans.find(p => p.id === planId);
                  if (!plan) return null;
                  
                  return (
                    <button
                      key={planId}
                      className="automation-toolbar__recent-plan"
                      onClick={() => runRecentPlan(planId)}
                    >
                      <Play size={12} />
                      <span className="automation-toolbar__recent-plan-name">{plan.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          
          {/* Close button */}
          <div className="automation-toolbar__section">
            <button
              className="automation-toolbar__close"
              onClick={() => setIsExpanded(false)}
            >
              <X size={14} /> Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Mini floating automation button
 */
export function AutomationFloatingButton({ 
  onClick, 
  position = "bottom-right" 
}: {
  onClick?: () => void;
  position?: "top-left" | "top-right" | "bottom-left" | "bottom-right";
}) {
  const automation = useButtonAutomation();
  
  const getPositionClass = () => {
    return `automation-floating-btn automation-floating-btn--${position}`;
  };
  
  return (
    <button
      className={getPositionClass()}
      onClick={onClick || (() => {})}
      title="Automation Controls"
    >
      <div className="automation-floating-btn__content">
        <Zap size={20} />
        
        {automation.state.isRunning && (
          <div className="automation-floating-btn__indicator">
            <span className="automation-floating-btn__indicator-dot" />
          </div>
        )}
        
        {automation.state.progress > 0 && !automation.state.isRunning && (
          <div className="automation-floating-btn__progress">
            {automation.state.progress}%
          </div>
        )}
      </div>
    </button>
  );
}

/**
 * Automation status badge for embedding in headers
 */
export function AutomationStatusBadge() {
  const automation = useButtonAutomation();
  
  if (!automation.state.isRunning && automation.state.completedButtons.length === 0) {
    return null;
  }
  
  const getStatusClass = () => {
    if (automation.state.status === "running") return "automation-status-badge--running";
    if (automation.state.status === "paused") return "automation-status-badge--paused";
    if (automation.state.status === "completed") return "automation-status-badge--completed";
    if (automation.state.status === "failed") return "automation-status-badge--failed";
    return "automation-status-badge--idle";
  };
  
  return (
    <div className={`automation-status-badge ${getStatusClass()}`}>
      <span className="automation-status-badge__icon">
        {automation.state.status === "running" ? "▶" :
         automation.state.status === "paused" ? "⏸" :
         automation.state.status === "completed" ? "✓" :
         automation.state.status === "failed" ? "✗" : "⚡"}
      </span>
      <span className="automation-status-badge__text">
        {automation.state.isRunning ? "Running" :
         automation.state.status === "completed" ? "Completed" :
         automation.state.status === "failed" ? "Failed" : "Automation"}
      </span>
      {automation.state.progress > 0 && (
        <span className="automation-status-badge__progress">
          {automation.state.progress}%
        </span>
      )}
    </div>
  );
}
