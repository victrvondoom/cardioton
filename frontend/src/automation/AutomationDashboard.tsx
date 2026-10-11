import { useCallback, useMemo, useState } from "react";
import { Play, Pause, StopCircle, RotateCcw, Plus, Trash2, Search, Filter, Layers, Clock, CheckCircle2, XCircle, AlertTriangle, Zap, List, Grid3X3, MoreVertical } from "lucide-react";
import { useButtonAutomation } from "./ButtonAutomationProvider";
import { ALL_BUTTONS, getButtonStatistics } from "./buttonRegistry";
import type { ButtonAutomationConfig } from "./ButtonAutomationProvider";
import "./automation.css";

export function AutomationDashboard() {
  const automation = useButtonAutomation();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedProcess, setSelectedProcess] = useState<string>("all");
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [showCreatePlan, setShowCreatePlan] = useState(false);
  const [newPlanName, setNewPlanName] = useState("");
  const [newPlanDescription, setNewPlanDescription] = useState("");
  const [selectedButtonsForPlan, setSelectedButtonsForPlan] = useState<string[]>([]);
  const [showPlanDetails, setShowPlanDetails] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  
  const statistics = getButtonStatistics();
  
  // Filter buttons based on search and filters
  const filteredButtons = useMemo(() => {
    let result = ALL_BUTTONS;
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(button => 
        button.id.toLowerCase().includes(query) ||
        button.label.toLowerCase().includes(query) ||
        button.category.toLowerCase().includes(query) ||
        button.process.toLowerCase().includes(query)
      );
    }
    
    if (selectedCategory !== "all") {
      result = result.filter(button => button.category === selectedCategory);
    }
    
    if (selectedProcess !== "all") {
      result = result.filter(button => button.process === selectedProcess);
    }
    
    return result;
  }, [searchQuery, selectedCategory, selectedProcess]);
  
  // Get unique categories and processes
  const categories = useMemo(() => [
    "all",
    ...Array.from(new Set(ALL_BUTTONS.map(b => b.category)))
  ], []);
  
  const processes = useMemo(() => [
    "all",
    ...Array.from(new Set(ALL_BUTTONS.map(b => b.process)))
  ], []);
  
  // Toggle button selection for plan creation
  const toggleButtonSelection = useCallback((buttonId: string) => {
    setSelectedButtonsForPlan(prev => {
      const index = prev.indexOf(buttonId);
      if (index === -1) {
        return [...prev, buttonId];
      } else {
        return prev.filter(id => id !== buttonId);
      }
    });
  }, []);
  
  // Create a new automation plan
  const createPlan = useCallback(() => {
    if (!newPlanName.trim() || selectedButtonsForPlan.length === 0) return;
    
    const planId = automation.createPlan({
      name: newPlanName,
      description: newPlanDescription,
      buttonSequence: selectedButtonsForPlan,
      categories: Array.from(new Set(
        selectedButtonsForPlan.map(id => {
          const button = ALL_BUTTONS.find(b => b.id === id);
          return button?.category || "unknown";
        })
      )),
      estimatedDuration: selectedButtonsForPlan.length * 2, // 2 seconds per button
    });
    
    // Reset form
    setNewPlanName("");
    setNewPlanDescription("");
    setSelectedButtonsForPlan([]);
    setShowCreatePlan(false);
    setSelectedPlan(planId);
    
  }, [automation, newPlanName, newPlanDescription, selectedButtonsForPlan]);
  
  // Run the selected plan
  const runSelectedPlan = useCallback(async () => {
    if (!selectedPlan) return;
    
    const plan = automation.plans.find(p => p.id === selectedPlan);
    if (!plan) return;
    
    try {
      const success = await automation.startAutomation(plan, {
        delayBetweenActions: 1500,
        continueOnError: false,
        onProgress: (progress, current, total) => {
          console.log(`Progress: ${progress}% - ${current} (${total})`);
        },
      });
      
      if (!success) {
        console.warn("Automation was stopped or failed");
      }
    } catch (error) {
      console.error("Error running automation:", error);
    }
  }, [automation, selectedPlan, automation.plans]);
  
  // Run individual button
  const runButton = useCallback(async (buttonId: string) => {
    try {
      const success = await automation.executeButton(buttonId);
      if (!success) {
        console.warn(`Button ${buttonId} failed`);
      }
    } catch (error) {
      console.error(`Error executing button ${buttonId}:`, error);
    }
  }, [automation]);
  
  // Toggle section expansion
  const toggleSection = useCallback((section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  }, []);
  
  // Group buttons by category for organized view
  const buttonsByCategory = useMemo(() => {
    const grouped: Record<string, typeof ALL_BUTTONS> = {};
    filteredButtons.forEach(button => {
      if (!grouped[button.category]) {
        grouped[button.category] = [];
      }
      grouped[button.category].push(button);
    });
    return grouped;
  }, [filteredButtons]);
  
  // Check if button is selected for plan
  const isButtonSelected = useCallback((buttonId: string) => {
    return selectedButtonsForPlan.includes(buttonId);
  }, [selectedButtonsForPlan]);
  
  // Reset automation state
  const resetAutomation = useCallback(() => {
    automation.resetAutomation();
  }, [automation]);
  
  // Get button status from automation state
  const getButtonStatus = useCallback((buttonId: string) => {
    if (automation.state.completedButtons.includes(buttonId)) {
      return "completed";
    }
    if (automation.state.failedButtons.includes(buttonId)) {
      return "failed";
    }
    if (automation.state.currentButtonId === buttonId) {
      return "running";
    }
    return "pending";
  }, [automation.state]);
  
  return (
    <div className="automation-dashboard">
      <header className="automation-dashboard__header">
        <div className="automation-dashboard__header-left">
          <h1>
            <Zap size={24} />
            <span>Button Automation Dashboard</span>
          </h1>
          <p className="automation-dashboard__subtitle">
            Automate all processes across every workflow in CLINICASE - ONCOTWIN
          </p>
        </div>
        
        <div className="automation-dashboard__header-right">
          <div className="automation-dashboard__stats">
            <span className="automation-stat">
              <span className="automation-stat__value">{statistics.total}</span>
              <span className="automation-stat__label">Total Buttons</span>
            </span>
            <span className="automation-stat">
              <span className="automation-stat__value">{statistics.automatable}</span>
              <span className="automation-stat__label">Automatable</span>
            </span>
            <span className="automation-stat">
              <span className="automation-stat__value">{statistics.highPriority}</span>
              <span className="automation-stat__label">High Priority</span>
            </span>
            <span className="automation-stat">
              <span className="automation-stat__value">{automation.plans.length}</span>
              <span className="automation-stat__label">Automation Plans</span>
            </span>
          </div>
          
          <div className="automation-dashboard__controls">
            <button 
              className="automation-btn automation-btn--primary"
              onClick={() => setShowCreatePlan(true)}
              disabled={automation.state.isRunning}
            >
              <Plus size={16} /> Create Automation Plan
            </button>
            
            <button 
              className="automation-btn"
              onClick={resetAutomation}
              disabled={!automation.state.isRunning && automation.state.completedButtons.length === 0}
            >
              <RotateCcw size={16} /> Reset
            </button>
          </div>
        </div>
      </header>

      {/* Automation State Indicator */}
      <div className="automation-dashboard__state">
        <div className={`automation-state-indicator automation-state-indicator--${automation.state.status}`}>
          <span className="automation-state-indicator__icon">
            {automation.state.status === "running" ? (
              <Zap size={18} />
            ) : automation.state.status === "completed" ? (
              <CheckCircle2 size={18} />
            ) : automation.state.status === "failed" ? (
              <XCircle size={18} />
            ) : automation.state.status === "cancelled" ? (
              <StopCircle size={18} />
            ) : (
              <Clock size={18} />
            )}
          </span>
          <span className="automation-state-indicator__text">
            {automation.state.isRunning ? "Automation Running" : 
             automation.state.status === "completed" ? "Automation Completed" :
             automation.state.status === "failed" ? "Automation Failed" :
             automation.state.status === "cancelled" ? "Automation Stopped" : "Ready"}
          </span>
          
          {automation.state.isRunning && (
            <div className="automation-state-indicator__controls">
              <button 
                className="automation-btn-icon" 
                onClick={() => automation.pauseAutomation()}
                title="Pause"
              >
                <Pause size={16} />
              </button>
              <button 
                className="automation-btn-icon" 
                onClick={() => automation.stopAutomation()}
                title="Stop"
              >
                <StopCircle size={16} />
              </button>
            </div>
          )}
          
          {automation.state.status === "paused" && (
            <button 
              className="automation-btn automation-btn--primary" 
              onClick={() => automation.resumeAutomation()}
            >
              <Play size={16} /> Resume
            </button>
          )}
          
          {automation.state.progress > 0 && (
            <div className="automation-progress-bar">
              <div 
                className="automation-progress-bar__fill"
                style={{ width: `${automation.state.progress}%` }}
              />
              <span className="automation-progress-bar__text">
                {automation.state.progress}% Complete
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="automation-dashboard__filters">
        <div className="automation-filter">
          <Search size={16} className="automation-filter__icon" />
          <input
            type="text"
            placeholder="Search buttons..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="automation-filter__input"
          />
        </div>
        
        <div className="automation-filter">
          <Filter size={16} className="automation-filter__icon" />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="automation-filter__select"
          >
            {categories.map(category => (
              <option key={category} value={category}>
                {category === "all" ? "All Categories" : category}
              </option>
            ))}
          </select>
        </div>
        
        <div className="automation-filter">
          <Layers size={16} className="automation-filter__icon" />
          <select
            value={selectedProcess}
            onChange={(e) => setSelectedProcess(e.target.value)}
            className="automation-filter__select"
          >
            {processes.map(process => (
              <option key={process} value={process}>
                {process === "all" ? "All Processes" : process}
              </option>
            ))}
          </select>
        </div>
        
        <div className="automation-filter">
          <MoreVertical size={16} className="automation-filter__icon" />
          <select
            value={viewMode}
            onChange={(e) => setViewMode(e.target.value as "list" | "grid")}
            className="automation-filter__select"
          >
            <option value="list">List View</option>
            <option value="grid">Grid View</option>
          </select>
        </div>
      </div>

      {/* Results Count */}
      <div className="automation-results-count">
        {filteredButtons.length} buttons found
        {searchQuery && <span> for "{searchQuery}"</span>}
        {selectedCategory !== "all" && <span>, filtered by category: {selectedCategory}</span>}
        {selectedProcess !== "all" && <span>, filtered by process: {selectedProcess}</span>}
      </div>

      {/* View Toggle */}
      <div className="automation-view-toggle">
        <button 
          className={`automation-view-toggle__btn ${viewMode === "list" ? "active" : ""}`}
          onClick={() => setViewMode("list")}
        >
          <List size={16} /> List
        </button>
        <button 
          className={`automation-view-toggle__btn ${viewMode === "grid" ? "active" : ""}`}
          onClick={() => setViewMode("grid")}
        >
          <Grid3X3 size={16} /> Grid
        </button>
      </div>

      {/* Buttons List */}
      <div className={`automation-buttons-container ${viewMode}`}>
        {Object.entries(buttonsByCategory).map(([category, categoryButtons]) => (
          <div key={category} className="automation-button-group">
            <div 
              className="automation-button-group__header"
              onClick={() => toggleSection(category)}
            >
              <h3>
                <span className="automation-button-group__category">{category}</span>
                <span className="automation-button-group__count">{categoryButtons.length} buttons</span>
              </h3>
              <button className="automation-button-group__toggle">
                {expandedSections[category] ? "−" : "+"}
              </button>
            </div>
            
            {expandedSections[category] !== false && (
              <div className={`automation-button-group__buttons ${viewMode}`}>
                {categoryButtons.map(button => {
                  const status = getButtonStatus(button.id);
                  const isSelected = isButtonSelected(button.id);
                  
                  return (
                    <div 
                      key={button.id} 
                      className={`automation-button-card ${viewMode} ${status} ${isSelected ? "selected" : ""}`}
                    >
                      <div className="automation-button-card__header">
                        <input
                          type="checkbox"
                          id={`button-select-${button.id}`}
                          checked={isSelected}
                          onChange={() => toggleButtonSelection(button.id)}
                          disabled={automation.state.isRunning}
                          className="automation-button-card__checkbox"
                        />
                        <label htmlFor={`button-select-${button.id}`} className="automation-button-card__label">
                          {button.label}
                        </label>
                      </div>
                      
                      <div className="automation-button-card__meta">
                        <span className="automation-button-card__meta-item">
                          <span className="automation-meta-label">ID:</span>
                          <code>{button.id}</code>
                        </span>
                        <span className="automation-button-card__meta-item">
                          <span className="automation-meta-label">Process:</span>
                          <span>{button.process}</span>
                        </span>
                        <span className={`automation-button-card__priority automation-priority--${button.priority}`}>
                          {button.priority}
                        </span>
                        <span className={`automation-button-card__automation ${button.automationEnabled ? "enabled" : "disabled"}`}>
                          {button.automationEnabled ? "Auto" : "Manual"}
                        </span>
                      </div>
                      
                      <div className="automation-button-card__actions">
                        <button 
                          className="automation-button-card__action-btn"
                          onClick={() => runButton(button.id)}
                          disabled={!button.automationEnabled || automation.state.isRunning}
                          title="Run Button"
                        >
                          <Play size={14} />
                        </button>
                        
                        {button.requiresConfirmation && (
                          <span className="automation-button-card__warning" title="Requires confirmation">
                            <AlertTriangle size={14} />
                          </span>
                        )}
                        
                        {button.isDestructive && (
                          <span className="automation-button-card__warning" title="Destructive action">
                            ⚠️
                          </span>
                        )}
                        
                        <span className={`automation-button-card__status automation-status--${status}`}>
                          {status === "running" ? "Running..." : 
                           status === "completed" ? "✓" :
                           status === "failed" ? "✗" : ""}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Automation Plans Section */}
      <div className="automation-dashboard__section">
        <div className="automation-dashboard__section-header">
          <h2>Automation Plans</h2>
          <p>Pre-configured sequences of button actions for common workflows</p>
        </div>
        
        <div className="automation-plans-grid">
          {automation.plans.length === 0 ? (
            <div className="automation-empty-state">
              <p>No automation plans created yet.</p>
              <button 
                className="automation-btn automation-btn--primary"
                onClick={() => setShowCreatePlan(true)}
              >
                <Plus size={16} /> Create Your First Plan
              </button>
            </div>
          ) : (
            automation.plans.map(plan => (
              <div 
                key={plan.id} 
                className={`automation-plan-card ${selectedPlan === plan.id ? "selected" : ""}`}
                onClick={() => setSelectedPlan(plan.id)}
              >
                <div className="automation-plan-card__header">
                  <h3>{plan.name}</h3>
                  <span className="automation-plan-card__id">{plan.id}</span>
                </div>
                <p className="automation-plan-card__description">{plan.description}</p>
                <div className="automation-plan-card__meta">
                  <span className="automation-plan-meta">
                    <List size={14} /> {plan.buttonSequence.length} buttons
                  </span>
                  <span className="automation-plan-meta">
                    <Layers size={14} /> {plan.categories.length} categories
                  </span>
                  <span className="automation-plan-meta">
                    <Clock size={14} /> ~{plan.estimatedDuration}s
                  </span>
                </div>
                <div className="automation-plan-card__actions">
                  <button 
                    className="automation-plan-card__action"
                    onClick={(e) => {
                      e.stopPropagation();
                      runSelectedPlan();
                    }}
                    disabled={automation.state.isRunning}
                  >
                    <Play size={14} /> Run
                  </button>
                  <button 
                    className="automation-plan-card__action"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowPlanDetails(true);
                    }}
                  >
                    <MoreVertical size={14} /> Details
                  </button>
                  <button 
                    className="automation-plan-card__action automation-plan-card__action--danger"
                    onClick={(e) => {
                      e.stopPropagation();
                      automation.deletePlan(plan.id);
                    }}
                  >
                    <Trash2 size={14} /> Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Create Plan Modal */}
      {showCreatePlan && (
        <div className="automation-modal-overlay" onClick={() => setShowCreatePlan(false)}>
          <div className="automation-modal" onClick={e => e.stopPropagation()}>
            <div className="automation-modal__header">
              <h2>Create Automation Plan</h2>
              <button className="automation-modal__close" onClick={() => setShowCreatePlan(false)}>
                ×
              </button>
            </div>
            
            <div className="automation-modal__body">
              <div className="automation-form-group">
                <label htmlFor="plan-name">Plan Name *</label>
                <input
                  type="text"
                  id="plan-name"
                  value={newPlanName}
                  onChange={(e) => setNewPlanName(e.target.value)}
                  placeholder="e.g., Complete Journey Workflow"
                  className="automation-form-input"
                />
              </div>
              
              <div className="automation-form-group">
                <label htmlFor="plan-description">Description</label>
                <textarea
                  id="plan-description"
                  value={newPlanDescription}
                  onChange={(e) => setNewPlanDescription(e.target.value)}
                  placeholder="Describe what this automation plan does"
                  rows={3}
                  className="automation-form-input"
                />
              </div>
              
              <div className="automation-form-group">
                <label>Select Buttons to Automate</label>
                <p className="automation-form-hint">
                  Select the buttons that should be executed in sequence
                </p>
                
                <div className="automation-button-selector">
                  <div className="automation-button-selector__controls">
                    <button 
                      className="automation-btn automation-btn--secondary"
                      onClick={() => {
                        const allAutomatable = ALL_BUTTONS
                          .filter(b => b.automationEnabled)
                          .map(b => b.id);
                        setSelectedButtonsForPlan(allAutomatable);
                      }}
                    >
                      Select All Automatable
                    </button>
                    <button 
                      className="automation-btn automation-btn--secondary"
                      onClick={() => setSelectedButtonsForPlan([])}
                    >
                      Clear Selection
                    </button>
                  </div>
                  
                  <div className="automation-button-selector__categories">
                    {categories.slice(1).map(category => {
                      const categoryButtons = ALL_BUTTONS.filter(b => b.category === category);
                      const allSelected = categoryButtons.every(b => selectedButtonsForPlan.includes(b.id));
                      const someSelected = categoryButtons.some(b => selectedButtonsForPlan.includes(b.id));
                      
                      return (
                        <details key={category} className="automation-category-selector">
                          <summary>
                            <input
                              type="checkbox"
                              checked={allSelected}
                              ref={el => {
                                if (el) el.indeterminate = someSelected && !allSelected;
                              }}
                              onChange={(e) => {
                                e.preventDefault();
                                if (allSelected) {
                                  setSelectedButtonsForPlan(prev => 
                                    prev.filter(id => !categoryButtons.some(b => b.id === id))
                                  );
                                } else {
                                  setSelectedButtonsForPlan(prev => [
                                    ...prev,
                                    ...categoryButtons.filter(b => b.automationEnabled).map(b => b.id)
                                  ]);
                                }
                              }}
                              onClick={e => e.stopPropagation()}
                            />
                            <span>{category} ({categoryButtons.length} buttons)</span>
                          </summary>
                          <div className="automation-category-buttons">
                            {categoryButtons.map(button => (
                              <label key={button.id} className="automation-button-checkbox">
                                <input
                                  type="checkbox"
                                  checked={selectedButtonsForPlan.includes(button.id)}
                                  onChange={() => toggleButtonSelection(button.id)}
                                  disabled={!button.automationEnabled}
                                />
                                <span className="automation-button-checkbox__label">
                                  <span className="automation-button-checkbox__name">{button.label}</span>
                                  <span className="automation-button-checkbox__id">{button.id}</span>
                                </span>
                              </label>
                            ))}
                          </div>
                        </details>
                      );
                    })}
                  </div>
                </div>
                
                <div className="automation-selection-summary">
                  <span>Selected: {selectedButtonsForPlan.length} buttons</span>
                  {selectedButtonsForPlan.length > 0 && (
                    <button 
                      className="automation-btn automation-btn--text"
                      onClick={() => setSelectedButtonsForPlan([])}
                    >
                      Clear All
                    </button>
                  )}
                </div>
              </div>
            </div>
            
            <div className="automation-modal__footer">
              <button 
                className="automation-btn automation-btn--secondary"
                onClick={() => setShowCreatePlan(false)}
              >
                Cancel
              </button>
              <button 
                className="automation-btn automation-btn--primary"
                onClick={createPlan}
                disabled={!newPlanName.trim() || selectedButtonsForPlan.length === 0}
              >
                <Plus size={16} /> Create Plan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Plan Details Modal */}
      {showPlanDetails && selectedPlan && (
        <div className="automation-modal-overlay" onClick={() => setShowPlanDetails(false)}>
          <div className="automation-modal automation-modal--large" onClick={e => e.stopPropagation()}>
            <div className="automation-modal__header">
              <h2>Automation Plan Details</h2>
              <button className="automation-modal__close" onClick={() => setShowPlanDetails(false)}>
                ×
              </button>
            </div>
            
            <div className="automation-modal__body">
              {(() => {
                const plan = automation.plans.find(p => p.id === selectedPlan);
                if (!plan) return <p>Plan not found</p>;
                
                const buttonsInPlan = plan.buttonSequence
                  .map(id => ALL_BUTTONS.find(b => b.id === id))
                  .filter((b): b is ButtonAutomationConfig => Boolean(b));
                
                return (
                  <div className="automation-plan-details">
                    <div className="automation-plan-details__header">
                      <h3>{plan.name}</h3>
                      <p className="automation-plan-details__id">ID: {plan.id}</p>
                      <p className="automation-plan-details__description">{plan.description}</p>
                    </div>
                    
                    <div className="automation-plan-details__stats">
                      <div className="automation-stat">
                        <span className="automation-stat__value">{buttonsInPlan.length}</span>
                        <span className="automation-stat__label">Buttons</span>
                      </div>
                      <div className="automation-stat">
                        <span className="automation-stat__value">{plan.categories.length}</span>
                        <span className="automation-stat__label">Categories</span>
                      </div>
                      <div className="automation-stat">
                        <span className="automation-stat__value">{plan.estimatedDuration}s</span>
                        <span className="automation-stat__label">Estimated Time</span>
                      </div>
                    </div>
                    
                    <div className="automation-plan-details__categories">
                      <h4>Categories</h4>
                      <div className="automation-category-tags">
                        {plan.categories.map(category => (
                          <span key={category} className="automation-category-tag">
                            {category}
                          </span>
                        ))}
                      </div>
                    </div>
                    
                    <div className="automation-plan-details__sequence">
                      <h4>Button Sequence</h4>
                      <ol className="automation-button-sequence">
                        {buttonsInPlan.map((button, index) => (
                          <li key={button.id} className="automation-button-sequence__item">
                            <span className="automation-button-sequence__number">{index + 1}</span>
                            <div className="automation-button-sequence__info">
                              <strong>{button.label}</strong>
                              <code>{button.id}</code>
                              <span className="automation-button-sequence__meta">
                                {button.category} / {button.process}
                              </span>
                            </div>
                            <span className={`automation-button-sequence__priority automation-priority--${button.priority}`}>
                              {button.priority}
                            </span>
                          </li>
                        ))}
                      </ol>
                    </div>
                    
                    <div className="automation-plan-details__actions">
                      <button 
                        className="automation-btn automation-btn--primary"
                        onClick={() => {
                          setShowPlanDetails(false);
                          runSelectedPlan();
                        }}
                      >
                        <Play size={16} /> Run Plan
                      </button>
                      <button 
                        className="automation-btn automation-btn--secondary"
                        onClick={() => {
                          // Edit plan functionality could be added here
                          setShowPlanDetails(false);
                        }}
                      >
                        Edit Plan
                      </button>
                      <button 
                        className="automation-btn automation-btn--danger"
                        onClick={() => {
                          automation.deletePlan(plan.id);
                          setShowPlanDetails(false);
                          setSelectedPlan(null);
                        }}
                      >
                        <Trash2 size={16} /> Delete Plan
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Execution Log */}
      {automation.state.executionLog.length > 0 && (
        <div className="automation-dashboard__section">
          <div className="automation-dashboard__section-header">
            <h2>Execution Log</h2>
            <button 
              className="automation-btn automation-btn--text"
              onClick={() => automation.resetAutomation()}
            >
              Clear Log
            </button>
          </div>
          
          <div className="automation-execution-log">
            <table className="automation-log-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Button</th>
                  <th>Action</th>
                  <th>Status</th>
                  <th>Duration</th>
                  <th>Error</th>
                </tr>
              </thead>
              <tbody>
                {automation.state.executionLog.slice().reverse().map((entry, index) => (
                  <tr key={index} className={`automation-log-entry automation-log-entry--${entry.status}`}>
                    <td>
                      {new Date(entry.timestamp).toLocaleTimeString()}
                    </td>
                    <td>
                      <code>{entry.buttonId}</code>
                    </td>
                    <td>{entry.action}</td>
                    <td>
                      <span className={`automation-status-badge automation-status-badge--${entry.status}`}>
                        {entry.status}
                      </span>
                    </td>
                    <td>
                      {entry.duration ? `${Math.round(entry.duration)}ms` : "-"}
                    </td>
                    <td>
                      {entry.error || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <footer className="automation-dashboard__footer">
        <p>Button Automation Framework v1.0.0</p>
        <p>Total: {statistics.total} buttons across {categories.length - 1} categories</p>
      </footer>
    </div>
  );
}
