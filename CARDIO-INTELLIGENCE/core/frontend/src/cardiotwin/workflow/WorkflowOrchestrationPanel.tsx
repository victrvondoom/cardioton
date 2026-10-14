/**
 * Workflow Orchestration Panel
 *
 * Component for visualizing and managing multi-agent workflows in CardioTwin
 * Integrates with SafetyConnect-main inspired workflow orchestration service
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { cardio, WorkflowDefinition, WorkflowInstance, WorkflowEvent } from '../core__src_cardiotwin__api';

// =============================================================================
// Types
// =============================================================================

interface WorkflowState {
  loading: boolean;
  error: string | null;
  definitions: WorkflowDefinition[];
  instances: WorkflowInstance[];
  selectedInstance: WorkflowInstance | null;
  events: WorkflowEvent[];
  isRefreshing: boolean;
  autoRefresh: boolean;
}

interface WorkflowOrchestrationPanelProps {
  cardiacCaseId?: string;
  onWorkflowComplete?: (instance: WorkflowInstance) => void;
  onError?: (error: string) => void;
  className?: string;
}

// =============================================================================
// Helper Functions
// =============================================================================

const STATUS_COLORS: Record<string, string> = {
  queued: 'bg-blue-500/20 border-blue-500 text-blue-400',
  running: 'bg-cyan-500/20 border-cyan-500 text-cyan-400',
  completed: 'bg-green-500/20 border-green-500 text-green-400',
  failed: 'bg-red-500/20 border-red-500 text-red-400',
  canceled: 'bg-gray-500/20 border-gray-500 text-gray-400',
  awaiting_review: 'bg-yellow-500/20 border-yellow-500 text-yellow-400',
};

const STATUS_ICONS: Record<string, string> = {
  queued: '⏳',
  running: '▶️',
  completed: '✅',
  failed: '❌',
  canceled: '⏹️',
  awaiting_review: '👀',
};

const SEVERITY_COLORS: Record<string, string> = {
  info: 'text-blue-400',
  warning: 'text-yellow-400',
  error: 'text-red-400',
};

const getWorkflowTypeIcon = (type: string) => {
  const icons: Record<string, string> = {
    cardiac_case: '🫀',
    evidence_continuity: '🔍',
    imaging_analysis: '📷',
    clinical_extraction: '📝',
    simulation: '🎯',
    default: '⚙️',
  };
  return icons[type.toLowerCase()] || icons.default;
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleString();
};

const formatDuration = (startedAt: string, completedAt?: string) => {
  if (!startedAt) return 'N/A';

  const start = new Date(startedAt);
  const end = completedAt ? new Date(completedAt) : new Date();
  const diff = (end.getTime() - start.getTime()) / 1000; // seconds

  if (diff < 60) return `${Math.round(diff)}s`;
  if (diff < 3600) return `${Math.round(diff / 60)}m`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h`;
  return `${Math.round(diff / 86400)}d`;
};

// =============================================================================
// Component: Workflow Definition Card
// =============================================================================

const WorkflowDefinitionCard: React.FC<{
  definition: WorkflowDefinition;
  onStart: (definition: WorkflowDefinition) => void;
  selectedInstance?: WorkflowInstance | null;
  cardiacCaseId?: string;
}> = ({ definition, onStart, selectedInstance, cardiacCaseId }) => {
  const isRunning = selectedInstance?.definition_id === definition.id &&
                    selectedInstance?.status === 'running';

  return (
    <div className={`p-4 rounded-lg bg-black/30 border border-white/5 hover:bg-black/40 transition-colors ${
      isRunning ? 'ring-2 ring-cyan-500/30' : ''
    }`}>
      <div className="flex items-center justify-between gap-4 mb-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{getWorkflowTypeIcon(definition.workflow_type)}</span>
          <div>
            <div className="font-medium">{definition.name}</div>
            <div className="text-xs text-gray-400">{definition.workflow_type}</div>
          </div>
        </div>
        <button
          onClick={() => onStart(definition)}
          disabled={!cardiacCaseId}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            !cardiacCaseId
              ? 'bg-gray-500/20 text-gray-400 cursor-not-allowed'
              : isRunning
                ? 'bg-cyan-500/20 text-cyan-400 cursor-default'
                : 'bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 cursor-pointer'
          }`}
        >
          {isRunning ? 'Running...' : 'Start Workflow'}
        </button>
      </div>
      <div className="text-sm text-gray-300 mb-3 line-clamp-2">
        {definition.description}
      </div>
      <div className="flex flex-wrap gap-1 text-xs">
        <span className="px-2 py-0.5 rounded bg-white/5">
          {definition.stages.length} stages
        </span>
        {definition.stages.some(s => s.required) && (
          <span className="px-2 py-0.5 rounded bg-yellow-500/10 text-yellow-400">
            Required stages
          </span>
        )}
      </div>
    </div>
  );
};

// =============================================================================
// Component: Workflow Instance Card
// =============================================================================

const WorkflowInstanceCard: React.FC<{
  instance: WorkflowInstance;
  onSelect: () => void;
  isSelected: boolean;
  definition?: WorkflowDefinition;
}> = ({ instance, onSelect, isSelected, definition }) => {
  const status = instance.status || 'unknown';
  const colorClass = STATUS_COLORS[status] || STATUS_COLORS.queued;
  const icon = STATUS_ICONS[status] || STATUS_ICONS.queued;

  return (
    <div
      onClick={onSelect}
      className={`p-4 rounded-lg border cursor-pointer transition-all ${
        isSelected
          ? 'bg-white/5 ring-2 ring-white/30 border-white/20'
          : 'bg-black/30 border-white/5 hover:bg-black/40'
      }`}
    >
      <div className="flex items-center justify-between gap-4 mb-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{getWorkflowTypeIcon(definition?.workflow_type || instance.status)}</span>
          <div>
            <div className="font-medium">
              {definition?.name || `Workflow ${instance.id.slice(0, 8)}`}
            </div>
            <div className="text-xs text-gray-400">
              {definition?.workflow_type || 'Unknown Type'}
            </div>
          </div>
        </div>
        <div className={`px-3 py-1.5 rounded-full text-xs font-medium ${colorClass}`}>
          {icon} {status.replace('_', ' ')}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-3 text-xs">
        <div>
          <div className="text-gray-400">Progress</div>
          <div className="font-medium">{Math.round(instance.progress * 100)}%</div>
        </div>
        <div>
          <div className="text-gray-400">Duration</div>
          <div className="font-medium">
            {formatDuration(instance.started_at, instance.completed_at)}
          </div>
        </div>
        <div>
          <div className="text-gray-400">Current Stage</div>
          <div className="font-medium truncate">
            {instance.current_stage || 'Starting...'}
          </div>
        </div>
      </div>

      <div className="text-xs text-gray-400">
        Started: {formatDate(instance.started_at)}
        {instance.completed_at && (
          <>, Completed: {formatDate(instance.completed_at)}</>
        )}
      </div>

      {instance.error && (
        <div className="mt-3 p-2 rounded bg-red-500/10 border border-red-500/30">
          <div className="text-xs text-red-400 truncate">{instance.error}</div>
        </div>
      )}
    </div>
  );
};

// =============================================================================
// Component: Event List
// =============================================================================

const EventList: React.FC<{
  events: WorkflowEvent[];
  className?: string;
}> = ({ events, className }) => {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  if (events.length === 0) {
    return (
      <div className={`p-4 rounded-lg bg-white/5 border border-white/5 text-center ${className}`}>
        <div className="text-gray-400 text-2xl mb-2">ℹ️</div>
        <div className="text-sm text-gray-400">No events yet</div>
        <div className="text-xs text-gray-500">Events will appear when workflow progresses</div>
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {events.slice().reverse().map((event) => {
        // Events carry no id: identify them by when, what and where they happened.
        const eventKey = `${event.timestamp}|${event.type}|${event.stage ?? ''}|${event.message}`;
        const isExpanded = expanded[eventKey];
        const severityColor = SEVERITY_COLORS[event.severity || 'info'];
        const hasMetadata = event.metadata && Object.keys(event.metadata).length > 0;

        return (
          <div
            key={eventKey}
            className={`p-3 rounded-lg border border-white/5 bg-white/2 hover:bg-white/5 transition-colors ${
              isExpanded ? 'ring-1 ring-white/20' : ''
            }`}
            onClick={() => setExpanded(prev => ({ ...prev, [eventKey]: !prev[eventKey] }))}
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="text-lg">
                  {event.severity === 'error' ? '❌' :
                   event.severity === 'warning' ? '⚠️' : 'ℹ️'}
                </span>
                <div>
                  <div className="font-medium text-sm">{event.type}</div>
                  <div className="text-xs text-gray-400">
                    {event.stage || 'Workflow'} · {formatDate(event.timestamp)}
                  </div>
                </div>
              </div>
              <div className={`text-xs ${severityColor} font-medium`}>
                {event.severity?.toUpperCase() || 'INFO'}
              </div>
            </div>

            <div className="mt-2 text-sm text-gray-300">
              {event.message}
            </div>

            {isExpanded && hasMetadata && (
              <div className="mt-3 p-2 rounded bg-black/20 text-xs font-mono">
                <pre className="text-white/70">
                  {JSON.stringify(event.metadata, null, 2)}
                </pre>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// =============================================================================
// Component: Stage Progress
// =============================================================================

const StageProgress: React.FC<{
  instance: WorkflowInstance;
  definition?: WorkflowDefinition;
  className?: string;
}> = ({ instance, definition, className }) => {
  if (!definition) return null;

  const currentStageIndex = definition.stages.findIndex(s => s.id === instance.current_stage);

  return (
    <div className={`p-4 rounded-lg bg-black/30 border border-white/5 ${className}`}>
      <h4 className="font-medium mb-4">
        Stage Progress ({currentStageIndex + 1}/{definition.stages.length})
      </h4>

      <div className="space-y-3">
        {definition.stages.map((stage, idx) => {
          const isCurrent = stage.id === instance.current_stage;
          const isCompleted = idx < currentStageIndex;
          const isFailed = instance.status === 'failed' && isCurrent;
          const isUpcoming = idx > currentStageIndex;

          let statusIcon = isCompleted ? '✅' : isCurrent ? '▶️' : isFailed ? '❌' : '⏳';
          let statusText = isCompleted ? 'Completed' : isCurrent ? 'Current' : isFailed ? 'Failed' : 'Pending';
          let statusColor = isCompleted ? 'text-green-400' :
                           isCurrent ? 'text-cyan-400' :
                           isFailed ? 'text-red-400' : 'text-gray-400';

          return (
            <div
              key={stage.id}
              className={`p-3 rounded-lg transition-colors ${
                isCompleted ? 'bg-green-500/5 border border-green-500/20' :
                isCurrent ? 'bg-cyan-500/5 border border-cyan-500/30' :
                isUpcoming ? 'bg-white/2 border border-white/5' :
                'bg-red-500/5 border border-red-500/20'
              }`}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-lg">{statusIcon}</span>
                  <div>
                    <div className={`font-medium ${statusColor}`}>{stage.name}</div>
                    <div className="text-xs text-gray-400">
                      {stage.description}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-sm ${statusColor} font-medium`}>
                    {statusText}
                  </div>
                  {stage.agent && (
                    <div className="text-xs text-gray-400">
                      Agent: {stage.agent}
                    </div>
                  )}
                </div>
              </div>

              {isCurrent && stage.dependencies && stage.dependencies.length > 0 && (
                <div className="mt-2 text-xs text-cyan-400">
                  Dependencies: {stage.dependencies.join(', ')}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 pt-3 border-t border-white/5">
        <div className="text-sm">
          <span className="text-gray-400">Overall Progress:</span>
          <span className="ml-2 font-bold text-cyan-400">
            {Math.round(instance.progress * 100)}%
          </span>
        </div>
        <div className="w-full bg-white/5 rounded-full h-2 mt-2">
          <div
            className="bg-cyan-500 h-2 rounded-full transition-all"
            style={{ width: `${instance.progress * 100}%` }}
          ></div>
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// Component: Instance Detail Panel
// =============================================================================

const InstanceDetailPanel: React.FC<{
  instance: WorkflowInstance;
  definition?: WorkflowDefinition;
  events: WorkflowEvent[];
  onClose: () => void;
  onCancel: () => void;
  onRetry: () => void;
}> = ({ instance, definition, events, onClose, onCancel, onRetry }) => {
  const canCancel = instance.status === 'running' || instance.status === 'queued';
  const canRetry = instance.status === 'failed' || instance.status === 'canceled';

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="w-full max-w-3xl max-h-[90vh] bg-black/50 rounded-xl border border-white/10 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-white/5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">
              {getWorkflowTypeIcon(definition?.workflow_type || instance.status)}
            </span>
            <div>
              <h2 className="font-medium">
                {definition?.name || `Workflow ${instance.id.slice(0, 8)}`}
              </h2>
              <div className="text-xs text-gray-400">
                {definition?.workflow_type || 'Workflow'} · {instance.id.slice(0, 16)}...
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {canCancel && (
              <button
                onClick={onCancel}
                className="px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 text-sm transition-colors"
              >
                Cancel
              </button>
            )}
            {canRetry && (
              <button
                onClick={onRetry}
                className="px-3 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 text-sm transition-colors"
              >
                Retry
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white transition-colors"
            >
              ✕ Close
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 overflow-y-auto max-h-[calc(90vh-120px)]">
          {/* Status Banner */}
          <div className={`p-3 rounded-lg ${STATUS_COLORS[instance.status || 'queued']} flex items-center gap-3`}>
            <span className="text-2xl">{STATUS_ICONS[instance.status || 'queued']}</span>
            <div>
              <div className="font-bold">
                {instance.status?.replace('_', ' ').toUpperCase() || 'UNKNOWN'}
              </div>
              <div className="text-sm">
                {instance.error ? `Error: ${instance.error}` :
                 instance.completed_at ? `Completed at ${formatDate(instance.completed_at)}` :
                 `Running since ${formatDate(instance.started_at)}`}
              </div>
            </div>
          </div>

          {/* Metadata */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 rounded-lg bg-white/5">
              <div className="text-xs text-gray-400">Workflow ID</div>
              <div className="font-mono text-sm truncate">{instance.id}</div>
            </div>
            <div className="p-3 rounded-lg bg-white/5">
              <div className="text-xs text-gray-400">Definition ID</div>
              <div className="font-mono text-sm truncate">{instance.definition_id}</div>
            </div>
            <div className="p-3 rounded-lg bg-white/5">
              <div className="text-xs text-gray-400">Cardiac Case</div>
              <div className="font-mono text-sm truncate">{instance.cardiac_case_id}</div>
            </div>
            <div className="p-3 rounded-lg bg-white/5">
              <div className="text-xs text-gray-400">Duration</div>
              <div className="text-sm">
                {formatDuration(instance.started_at, instance.completed_at)}
              </div>
            </div>
          </div>

          {/* Stage Progress */}
          {definition && (
            <StageProgress instance={instance} definition={definition} />
          )}

          {/* Events */}
          <div className="p-4 rounded-lg bg-white/2 border border-white/5">
            <h3 className="font-medium mb-3 flex items-center gap-2">
              <span>📜</span> Event History ({events.length})
            </h3>
            <EventList events={events} />
          </div>

          {/* Inputs/Outputs */}
          {(instance.inputs || instance.outputs) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {instance.inputs && Object.keys(instance.inputs).length > 0 && (
                <div className="p-4 rounded-lg bg-white/2 border border-white/5">
                  <h3 className="font-medium mb-3 flex items-center gap-2">
                    <span>📥</span> Inputs
                  </h3>
                  <pre className="text-xs text-white/70 overflow-x-auto">
                    {JSON.stringify(instance.inputs, null, 2)}
                  </pre>
                </div>
              )}
              {instance.outputs && Object.keys(instance.outputs).length > 0 && (
                <div className="p-4 rounded-lg bg-white/2 border border-white/5">
                  <h3 className="font-medium mb-3 flex items-center gap-2">
                    <span>📤</span> Outputs
                  </h3>
                  <pre className="text-xs text-white/70 overflow-x-auto">
                    {JSON.stringify(instance.outputs, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/5 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// Component: Workflow Definition List
// =============================================================================

const WorkflowDefinitionList: React.FC<{
  definitions: WorkflowDefinition[];
  onStart: (definition: WorkflowDefinition) => void;
  selectedInstance?: WorkflowInstance | null;
  cardiacCaseId?: string;
  className?: string;
}> = ({ definitions, onStart, selectedInstance, cardiacCaseId, className }) => {
  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xl">📋</span>
        <span className="font-medium">Available Workflows ({definitions.length})</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {definitions.map((definition) => (
          <WorkflowDefinitionCard
            key={definition.id}
            definition={definition}
            onStart={onStart}
            selectedInstance={selectedInstance}
            cardiacCaseId={cardiacCaseId}
          />
        ))}
      </div>
    </div>
  );
};

// =============================================================================
// Main Component: WorkflowOrchestrationPanel
// =============================================================================

const WorkflowOrchestrationPanel: React.FC<WorkflowOrchestrationPanelProps> = ({
  cardiacCaseId,
  onWorkflowComplete,
  onError,
  className,
}) => {
  const [state, setState] = useState<WorkflowState>({
    loading: true,
    error: null,
    definitions: [],
    instances: [],
    selectedInstance: null,
    events: [],
    isRefreshing: false,
    autoRefresh: true,
  });

  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));

      // Fetch definitions and instances in parallel
      const [definitions, instances] = await Promise.all([
        cardio.listWorkflows(),
        cardiacCaseId
          ? cardio.listWorkflowInstances(cardiacCaseId)
          : cardio.listWorkflowInstances(),
      ]);

      setState(prev => ({
        ...prev,
        loading: false,
        definitions: definitions.workflows || [],
        instances: instances.instances || [],
        isRefreshing: false,
      }));
    } catch (error) {
      console.error('Error fetching workflow data:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load workflow data';
      setState(prev => ({
        ...prev,
        loading: false,
        error: errorMessage,
        isRefreshing: false,
      }));
      onError?.(errorMessage);
    }
  }, [cardiacCaseId, onError]);

  // Fetch events for selected instance
  const fetchEvents = useCallback(async (instanceId: string) => {
    try {
      const events = await cardio.getWorkflowEvents(instanceId);
      setState(prev => ({
        ...prev,
        events: events.events || [],
      }));
    } catch (error) {
      console.error('Error fetching events:', error);
    }
  }, []);

  // Initial fetch and auto-refresh
  useEffect(() => {
    fetchData();

    if (state.autoRefresh) {
      refreshIntervalRef.current = setInterval(fetchData, 15000); // Refresh every 15 seconds
    }

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [fetchData, state.autoRefresh]);

  // Refetch when cardiacCaseId changes
  useEffect(() => {
    fetchData();
  }, [cardiacCaseId, fetchData]);

  // Handle instance selection
  const handleInstanceSelect = useCallback((instance: WorkflowInstance) => {
    setState(prev => ({
      ...prev,
      selectedInstance: instance,
    }));
    fetchEvents(instance.id);
  }, [fetchEvents]);

  // Handle starting workflow
  const handleStartWorkflow = useCallback(async (definition: WorkflowDefinition) => {
    if (!cardiacCaseId) {
      onError?.('No cardiac case ID provided');
      return;
    }

    try {
      setState(prev => ({ ...prev, isRefreshing: true }));

      const instance = await cardio.startWorkflow(definition.id, cardiacCaseId);

      setState(prev => ({
        ...prev,
        isRefreshing: false,
        instances: [instance, ...prev.instances],
        selectedInstance: instance,
      }));

      fetchEvents(instance.id);
      onWorkflowComplete?.(instance);
    } catch (error) {
      console.error('Error starting workflow:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to start workflow';
      setState(prev => ({
        ...prev,
        isRefreshing: false,
        error: errorMessage,
      }));
      onError?.(errorMessage);
    }
  }, [cardiacCaseId, fetchEvents, onError, onWorkflowComplete]);

  // Handle canceling workflow
  const handleCancelWorkflow = useCallback(async () => {
    if (!state.selectedInstance) return;

    try {
      const instance = await cardio.cancelWorkflow(state.selectedInstance.id);

      setState(prev => ({
        ...prev,
        instances: prev.instances.map(i =>
          i.id === instance.id ? instance : i
        ),
        selectedInstance: instance,
      }));

      fetchEvents(instance.id);
    } catch (error) {
      console.error('Error canceling workflow:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to cancel workflow';
      onError?.(errorMessage);
    }
  }, [state.selectedInstance, fetchEvents, onError]);

  // Handle retrying workflow
  const handleRetryWorkflow = useCallback(async () => {
    if (!state.selectedInstance) return;

    try {
      const instance = await cardio.startWorkflow(
        state.selectedInstance.definition_id,
        state.selectedInstance.cardiac_case_id
      );

      setState(prev => ({
        ...prev,
        instances: prev.instances.map(i =>
          i.id === instance.id ? instance : i
        ),
        selectedInstance: instance,
      }));

      fetchEvents(instance.id);
    } catch (error) {
      console.error('Error retrying workflow:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to retry workflow';
      onError?.(errorMessage);
    }
  }, [state.selectedInstance, fetchEvents, onError]);

  // Handle refresh
  const handleRefresh = useCallback(() => {
    setState(prev => ({ ...prev, isRefreshing: true }));
    fetchData();
  }, [fetchData]);

  // Handle auto-refresh toggle
  const handleAutoRefreshToggle = useCallback((enabled: boolean) => {
    setState(prev => ({ ...prev, autoRefresh: enabled }));

    if (enabled && !refreshIntervalRef.current) {
      refreshIntervalRef.current = setInterval(fetchData, 15000);
    } else if (!enabled && refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = null;
    }
  }, [fetchData]);

  // Close detail panel
  const handleCloseDetail = useCallback(() => {
    setState(prev => ({
      ...prev,
      selectedInstance: null,
    }));
  }, []);

  // Get definition for instance
  const getDefinitionForInstance = useCallback((instance: WorkflowInstance) => {
    return state.definitions.find(d => d.id === instance.definition_id);
  }, [state.definitions]);

  // Compute statistics
  const activeInstances = state.instances.filter(i => i.status === 'running' || i.status === 'queued');
  const completedInstances = state.instances.filter(i => i.status === 'completed');
  const failedInstances = state.instances.filter(i => i.status === 'failed');

  // Filter instances by cardiac case
  const caseInstances = cardiacCaseId
    ? state.instances.filter(i => i.cardiac_case_id === cardiacCaseId)
    : state.instances;

  return (
    <div className={`w-full ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-4 p-4 rounded-lg bg-black/30 border border-white/5">
        <div className="flex items-center gap-3">
          <span className="text-2xl">⚙️</span>
          <div>
            <h2 className="text-lg font-medium text-white">Workflow Orchestration</h2>
            <p className="text-sm text-gray-400">
              Multi-agent cardiovascular workflow management
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex gap-2">
            <button
              onClick={handleRefresh}
              disabled={state.isRefreshing}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Refresh workflows"
            >
              {state.isRefreshing ? '↻' : '↻'}
            </button>

            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={state.autoRefresh}
                onChange={(e) => handleAutoRefreshToggle(e.target.checked)}
                className="w-4 h-4 rounded border-white/20"
              />
              <span className="text-gray-300">Auto-refresh (15s)</span>
            </label>
          </div>
        </div>
      </div>

      {/* Error State */}
      {state.error && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 mb-4">
          <div className="flex items-center gap-3">
            <span className="text-xl">⚠️</span>
            <div>
              <h3 className="font-medium mb-1">Workflow Error</h3>
              <p className="text-sm">{state.error}</p>
            </div>
          </div>
          <button
            onClick={handleRefresh}
            className="mt-4 px-4 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 text-sm transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading State */}
      {state.loading && !state.error && (
        <div className="p-8 rounded-lg bg-white/5 border border-white/5 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white/30 mx-auto mb-4"></div>
          <p className="text-gray-300">Loading workflows...</p>
        </div>
      )}

      {/* Main Content */}
      {!state.loading && !state.error && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Left Column: Workflow Definitions */}
          <div className="space-y-4">
            <WorkflowDefinitionList
              definitions={state.definitions}
              onStart={handleStartWorkflow}
              selectedInstance={state.selectedInstance}
              cardiacCaseId={cardiacCaseId}
            />
          </div>

          {/* Right Column: Active Instances */}
          <div className="space-y-4">
            {/* Instance Statistics */}
            <div className="grid grid-cols-3 gap-2 p-4 rounded-lg bg-black/30 border border-white/5">
              <div className="text-center p-3 rounded-lg bg-white/5">
                <div className="text-xl font-bold text-cyan-400">{activeInstances.length}</div>
                <div className="text-xs text-gray-400">Active</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-white/5">
                <div className="text-xl font-bold text-green-400">{completedInstances.length}</div>
                <div className="text-xs text-gray-400">Completed</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-white/5">
                <div className="text-xl font-bold text-red-400">{failedInstances.length}</div>
                <div className="text-xs text-gray-400">Failed</div>
              </div>
            </div>

            {/* Instance List */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">📜</span>
                <span className="font-medium">
                  Workflow Instances ({caseInstances.length})
                </span>
              </div>

              {caseInstances.length > 0 ? (
                <div className="space-y-2">
                  {caseInstances
                    .slice()
                    .sort((a, b) =>
                      new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
                    )
                    .map((instance) => (
                      <WorkflowInstanceCard
                        key={instance.id}
                        instance={instance}
                        onSelect={() => handleInstanceSelect(instance)}
                        isSelected={state.selectedInstance?.id === instance.id}
                        definition={getDefinitionForInstance(instance)}
                      />
                    ))}
                </div>
              ) : (
                <div className="p-4 rounded-lg bg-white/5 border border-white/5 text-center text-gray-400">
                  <div className="text-2xl mb-2">📋</div>
                  <div>No workflow instances yet</div>
                  <div className="text-xs text-gray-500 mt-1">
                    Start a workflow to begin processing
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!state.loading && !state.error && state.definitions.length === 0 && (
        <div className="p-8 rounded-lg bg-white/5 border border-white/5 text-center">
          <div className="text-4xl mb-4">⚙️</div>
          <h3 className="text-lg font-medium mb-2">No Workflows Available</h3>
          <p className="text-sm text-gray-400 mb-4">
            No workflow definitions found in the system.
          </p>
          <button
            onClick={handleRefresh}
            className="px-4 py-2 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 text-sm transition-colors"
          >
            Refresh
          </button>
        </div>
      )}

      {/* Detail Panel */}
      {state.selectedInstance && (
        <InstanceDetailPanel
          instance={state.selectedInstance}
          definition={getDefinitionForInstance(state.selectedInstance)}
          events={state.events}
          onClose={handleCloseDetail}
          onCancel={handleCancelWorkflow}
          onRetry={handleRetryWorkflow}
        />
      )}
    </div>
  );
};

export default WorkflowOrchestrationPanel;
