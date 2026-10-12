/**
 * Evidence Continuity Dashboard
 *
 * Primary component for visualizing and managing the Cardiac Evidence Continuity Engine
 * Provides a unified view of evidence graphs, validation results, and inconsistency detections
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  EvidenceNode,
  EvidenceEdge,
  EvidenceValidationResult,
  TemporalAlignmentIssue,
  CrossModalityContradiction,
} from '../api';
import { cardio } from '../api';

// =============================================================================
// Types
// =============================================================================

interface EvidenceContinuityState {
  loading: boolean;
  error: string | null;
  nodes: EvidenceNode[];
  edges: EvidenceEdge[];
  validationResult: EvidenceValidationResult | null;
  temporalIssues: TemporalAlignmentIssue[];
  contradictions: CrossModalityContradiction[];
  inconsistencies: Array<{
    id: string;
    type: string;
    severity: string;
    description: string;
    involved_nodes: string[];
    suggested_resolution: string;
    confidence: number;
  }>;
  confidenceScore: {
    score: number;
    method: string;
    components: Record<string, number>;
    interpretation: string;
    recommendations: string[];
  } | null;
  selectedNode: EvidenceNode | null;
  selectedEdge: EvidenceEdge | null;
  selectedCaseId: string;
}

interface EvidenceContinuityDashboardProps {
  cardiacCaseId: string;
  onNodeSelect?: (node: EvidenceNode) => void;
  onInconsistencyDetected?: (inconsistencies: any[]) => void;
  className?: string;
}

// =============================================================================
// Helper Functions
// =============================================================================

const SEVERITY_COLORS = {
  critical: 'bg-red-500/20 border-red-500 text-red-600',
  high: 'bg-orange-500/20 border-orange-500 text-orange-600',
  medium: 'bg-yellow-500/20 border-yellow-500 text-yellow-600',
  low: 'bg-blue-500/20 border-blue-500 text-blue-600',
  info: 'bg-gray-500/20 border-gray-500 text-gray-600',
};

const NODE_TYPE_ICONS: Record<string, string> = {
  ecg: '⚡',
  imaging: '📷',
  clinical_note: '📝',
  lab: '🧪',
  model_prediction: '🤖',
  digital_twin: '🫀',
  clinician_review: '👨‍⚕️',
  observation: '👁️',
  default: '📌',
};

const NODE_TYPE_COLORS: Record<string, string> = {
  ecg: 'bg-purple-500/20 border-purple-500',
  imaging: 'bg-green-500/20 border-green-500',
  clinical_note: 'bg-blue-500/20 border-blue-500',
  lab: 'bg-orange-500/20 border-orange-500',
  model_prediction: 'bg-cyan-500/20 border-cyan-500',
  digital_twin: 'bg-red-500/20 border-red-500',
  clinician_review: 'bg-yellow-500/20 border-yellow-500',
  observation: 'bg-indigo-500/20 border-indigo-500',
  default: 'bg-gray-500/20 border-gray-500',
};

const getNodeTypeInfo = (nodeType: string) => ({
  icon: NODE_TYPE_ICONS[nodeType] || NODE_TYPE_ICONS.default,
  colorClass: NODE_TYPE_COLORS[nodeType] || NODE_TYPE_COLORS.default,
  shortName: nodeType.replace('_', ' '),
});

const getSeverityColor = (severity: string) => {
  const lowerSeverity = severity.toLowerCase();
  return SEVERITY_COLORS[lowerSeverity] || SEVERITY_COLORS.info;
};

const confidenceToColor = (confidence: number) => {
  if (confidence >= 0.8) return 'text-green-500';
  if (confidence >= 0.6) return 'text-yellow-500';
  if (confidence >= 0.4) return 'text-orange-500';
  return 'text-red-500';
};

// =============================================================================
// Component: Node Card
// =============================================================================

const NodeCard: React.FC<{
  node: EvidenceNode;
  isSelected: boolean;
  onClick: () => void;
  issues?: Array<{ type: string; severity: string; message: string }>;
}> = ({ node, isSelected, onClick, issues = [] }) => {
  const typeInfo = getNodeTypeInfo(node.node_type || 'default');
  const hasIssues = issues.length > 0;
  const highestSeverity = issues.reduce((max, issue) => {
    const severityOrder = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };
    return (severityOrder[issue.severity] || 0) > (severityOrder[max] || 0) ? issue.severity : max;
  }, '');

  return (
    <div
      onClick={onClick}
      className={`
        ${typeInfo.colorClass}
        ${isSelected ? 'ring-2 ring-white/50' : ''}
        ${hasIssues ? 'border-2 ' + getSeverityColor(highestSeverity) : 'border'}
        p-4 rounded-lg cursor-pointer transition-all duration-200
        hover:shadow-lg hover:scale-[1.02]
        ${hasIssues ? 'animate-pulse-subtle' : ''}
      `}
      title={`Node: ${node.id}\nType: ${node.node_type}\nConfidence: ${node.confidence}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">{typeInfo.icon}</span>
            <span className="font-medium text-sm truncate">{node.summary || node.entity_type}</span>
          </div>
          <div className="text-xs text-gray-400 space-y-1">
            <div>
              <span className="font-mono">ID: {node.id.slice(0, 8)}...</span>
            </div>
            <div>
              Entity: {node.entity_type} | Source: {node.source}
            </div>
            {node.observation_time && (
              <div>Time: {new Date(node.observation_time).toLocaleString()}</div>
            )}
            <div className="flex items-center gap-2">
              <span
                className={`font-mono text-xs ${confidenceToColor(node.confidence)}`}
              >
                Confidence: {(node.confidence * 100).toFixed(0)}%
              </span>
              <span className="font-mono text-xs text-gray-400">
                Quality: {(node.quality_score * 100).toFixed(0)}%
              </span>
            </div>
          </div>
        </div>
        {hasIssues && (
          <div className="flex-shrink-0">
            <div className={`px-2 py-1 rounded-full text-xs font-bold ${getSeverityColor(highestSeverity)}`}>
              {highestSeverity.toUpperCase()}
            </div>
          </div>
        )}
      </div>
      {hasIssues && (
        <div className="mt-2 pt-2 border-t border-white/10">
          {issues.slice(0, 2).map((issue, idx) => (
            <div key={idx} className={`text-xs ${getSeverityColor(issue.severity)} truncate`}>
              {issue.message}
            </div>
          ))}
          {issues.length > 2 && (
            <div className="text-xs text-gray-400">+{issues.length - 2} more issues</div>
          )}
        </div>
      )}
    </div>
  );
};

// =============================================================================
// Component: Edge Connection
// =============================================================================

const EdgeConnection: React.FC<{
  edge: EvidenceEdge;
  sourceNode: EvidenceNode;
  targetNode: EvidenceNode;
  isSelected: boolean;
  onClick: () => void;
}> = ({ edge, sourceNode, targetNode, isSelected, onClick }) => {
  const sourceType = getNodeTypeInfo(sourceNode.node_type || 'default');
  const targetType = getNodeTypeInfo(targetNode.node_type || 'default');
  const consistencyStatus = edge.consistency_status || 'valid';

  const getEdgeColor = () => {
    if (consistencyStatus === 'inconsistent') return 'border-red-400';
    if (consistencyStatus === 'warning') return 'border-yellow-400';
    if (edge.confidence < 0.6) return 'border-orange-400';
    return 'border-green-400/50';
  };

  return (
    <div
      onClick={onClick}
      className={`
        p-3 rounded-lg border ${getEdgeColor()}
        ${isSelected ? 'bg-white/5 ring-1 ring-white/30' : 'bg-white/2'}
        cursor-pointer transition-all duration-200
        hover:bg-white/10
      `}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg">{sourceType.icon}</span>
        <span className="text-gray-400">→</span>
        <span className="text-lg">{targetType.icon}</span>
      </div>
      <div className="text-xs text-gray-300">
        {edge.relationship}
      </div>
      <div className="text-xs text-gray-400 font-mono">
        Confidence: {(edge.confidence * 100).toFixed(0)}%
      </div>
      {consistencyStatus !== 'valid' && (
        <div className={`text-xs font-bold mt-1 ${consistencyStatus === 'inconsistent' ? 'text-red-400' : 'text-yellow-400'}`}>
          {consistencyStatus.toUpperCase()}
        </div>
      )}
    </div>
  );
};

// =============================================================================
// Component: Validation Badge
// =============================================================================

interface ValidationBadgeProps {
  isValid: boolean;
  score?: number;
  size?: 'sm' | 'md' | 'lg';
}

const ValidationBadge: React.FC<ValidationBadgeProps> = ({ isValid, score, size = 'md' }) => {
  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base',
  };

  if (score !== undefined) {
    const color = isValid
      ? (score >= 0.8 ? 'bg-green-500/20 border-green-500 text-green-400' :
         score >= 0.6 ? 'bg-yellow-500/20 border-yellow-500 text-yellow-400' :
         'bg-red-500/20 border-red-500 text-red-400')
      : isValid
        ? 'bg-green-500/20 border-green-500 text-green-400'
        : 'bg-red-500/20 border-red-500 text-red-400';

    return (
      <div className={`rounded-full font-bold ${color} ${sizeClasses[size]}`}>
        {score !== undefined ? `${Math.round(score * 100)}%` : isValid ? '✓ Valid' : '✗ Invalid'}
      </div>
    );
  }

  return (
    <div className={`rounded-full font-bold ${isValid ? 'bg-green-500/20 border-green-500 text-green-400' : 'bg-red-500/20 border-red-500 text-red-400'} ${sizeClasses[size]}`}>
      {isValid ? '✓ Valid' : '✗ Invalid'}
    </div>
  );
};

// =============================================================================
// Component: Inconsistency List
// =============================================================================

interface InconsistencyListProps {
  inconsistencies: Array<{
    id: string;
    type: string;
    severity: string;
    description: string;
    involved_nodes: string[];
    suggested_resolution: string;
    confidence: number;
  }>;
  nodes: EvidenceNode[];
  onNodeNavigate: (nodeId: string) => void;
}

const InconsistencyList: React.FC<InconsistencyListProps> = ({ inconsistencies, nodes, onNodeNavigate }) => {
  if (inconsistencies.length === 0) {
    return (
      <div className="p-4 rounded-lg bg-green-500/5 border border-green-500/20 text-center">
        <div className="text-green-400 text-2xl mb-2">✓</div>
        <div className="text-sm text-green-300">No inconsistencies detected</div>
        <div className="text-xs text-green-200/50">Evidence graph is temporally consistent</div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {inconsistencies.map((inc) => {
        const involvedNodeNames = inc.involved_nodes
          .map(id => nodes.find(n => n.id === id)?.summary || `Node ${id.slice(0, 8)}`)
          .join(', ');

        return (
          <div
            key={inc.id}
            className={`
              p-4 rounded-lg border ${getSeverityColor(inc.severity)}
              bg-white/2 hover:bg-white/5 transition-colors
            `}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <span className={`px-2 py-1 rounded text-xs font-bold ${getSeverityColor(inc.severity)}`}>
                    {inc.type}
                  </span>
                  <span className={`font-medium ${confidenceToColor(inc.confidence)}`}>
                    Confidence: {(inc.confidence * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="text-sm text-gray-200 mb-2">{inc.description}</div>
                <div className="text-xs text-gray-400 mb-2">
                  Involved: {involvedNodeNames}
                </div>
                {inc.suggested_resolution && (
                  <div className="text-xs text-cyan-400">
                    Resolution: {inc.suggested_resolution}
                  </div>
                )}
              </div>
              <button
                onClick={() => onNodeNavigate(inc.involved_nodes[0])}
                className="text-cyan-400 hover:text-cyan-300 text-2xl transition-colors"
                title="Navigate to node"
              >
                ➡️
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// =============================================================================
// Component: Evidence Graph Visualization
// =============================================================================

const EvidenceGraphVisualization: React.FC<{
  nodes: EvidenceNode[];
  edges: EvidenceEdge[];
  validationResult: EvidenceValidationResult | null;
  onNodeSelect: (node: EvidenceNode) => void;
  selectedNode: EvidenceNode | null;
  inconsistencies: any[];
  className?: string;
}> = ({ nodes, edges, validationResult, onNodeSelect, selectedNode, inconsistencies, className }) => {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // Group nodes by type
  const nodesByType = useMemo(() => {
    const grouped: Record<string, EvidenceNode[]> = {};
    nodes.forEach(node => {
      const type = node.node_type || 'other';
      if (!grouped[type]) grouped[type] = [];
      grouped[type].push(node);
    });
    return grouped;
  }, [nodes]);

  // Get issues for each node
  const nodeIssues = useMemo(() => {
    const issues: Record<string, any[]> = {};
    if (validationResult) {
      validationResult.issues.forEach(issue => {
        if (issue.node_id) {
          if (!issues[issue.node_id]) issues[issue.node_id] = [];
          issues[issue.node_id].push(issue);
        }
      });
    }
    return issues;
  }, [validationResult]);

  return (
    <div className={className}>
      <div className="flex items-center justify-between gap-4 mb-6">
        <h3 className="text-lg font-medium text-white/80">
          Evidence Graph ({nodes.length} nodes, {edges.length} relationships)
        </h3>
        <ValidationBadge
          isValid={validationResult?.is_valid ?? true}
          score={validationResult?.consistency_score}
          size="sm"
        />
      </div>

      {/* Grouped by Type */}
      <div className="space-y-4">
        {Object.entries(nodesByType).map(([type, typeNodes]) => {
          const typeInfo = getNodeTypeInfo(type);
          const typeIssues = typeNodes.flatMap(n => nodeIssues[n.id] || []);
          const hasIssues = typeIssues.length > 0;

          return (
            <div key={type} className="space-y-2">
              <div
                onClick={() => setExpanded(prev => ({ ...prev, [type]: !prev[type] }))}
                className="flex items-center gap-2 cursor-pointer select-none"
              >
                <span className="text-xl">{typeInfo.icon}</span>
                <span className="font-medium text-sm text-white/70">{typeInfo.shortName}</span>
                <span className="text-xs text-gray-400">{typeNodes.length} nodes</span>
                {hasIssues && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-500/20 text-red-400">
                    {typeIssues.length} issues
                  </span>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpanded(prev => ({ ...prev, [type]: !prev[type] }));
                  }}
                  className="ml-auto text-gray-400 hover:text-white transition-colors"
                >
                  {expanded[type] ? '▼' : '▶'}
                </button>
              </div>

              {expanded[type] && (
                <div className="pl-6 space-y-2">
                  {typeNodes.map(node => (
                    <NodeCard
                      key={node.id}
                      node={node}
                      isSelected={selectedNode?.id === node.id}
                      onClick={() => onNodeSelect(node)}
                      issues={nodeIssues[node.id] || []}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Relationships */}
      {edges.length > 0 && (
        <div className="mt-6 pt-4 border-t border-white/5">
          <h4 className="text-sm font-medium text-white/60 mb-3">
            Evidence Relationships ({edges.length})
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {edges.map(edge => {
              const sourceNode = nodes.find(n => n.id === edge.source_node_id);
              const targetNode = nodes.find(n => n.id === edge.target_node_id);
              return sourceNode && targetNode ? (
                <EdgeConnection
                  key={edge.id}
                  edge={edge}
                  sourceNode={sourceNode}
                  targetNode={targetNode}
                  isSelected={false}
                  onClick={() => {}}
                />
              ) : null;
            })}
          </div>
        </div>
      )}
    </div>
  );
};

// =============================================================================
// Component: Validation Results Panel
// =============================================================================

const ValidationResultsPanel: React.FC<{
  validationResult: EvidenceValidationResult | null;
  temporalIssues: TemporalAlignmentIssue[];
  contradictions: CrossModalityContradiction[];
  confidenceScore: any;
  className?: string;
}> = ({ validationResult, temporalIssues, contradictions, confidenceScore, className }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'temporal' | 'contradictions' | 'confidence'>('overview');

  const tabs = [
    { id: 'overview' as const, label: 'Overview', count: validationResult?.issues.length || 0 },
    { id: 'temporal' as const, label: 'Temporal', count: temporalIssues.length },
    { id: 'contradictions' as const, label: 'Contradictions', count: contradictions.length },
    { id: 'confidence' as const, label: 'Confidence', count: confidenceScore ? 1 : 0 },
  ];

  return (
    <div className={className}>
      <div className="p-4 rounded-lg bg-black/30 border border-white/5">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xl">🔍</span>
          <span className="font-medium">Validation Results</span>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                px-3 py-1.5 rounded text-sm font-medium transition-all
                ${activeTab === tab.id
                  ? 'bg-white/10 text-white border border-white/20'
                  : 'text-gray-400 hover:bg-white/5 hover:text-white/80'
                }
              `}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 text-xs">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="min-h-[200px]">
          {activeTab === 'overview' && (
            <div className="space-y-4">
              {validationResult ? (
                <>
                  <div className="flex items-center gap-4">
                    <div className="p-4 rounded-lg bg-white/5">
                      <div className="text-3xl font-bold text-center">
                        {(validationResult.consistency_score * 100).toFixed(1)}%
                      </div>
                      <div className="text-xs text-center text-gray-400">
                        Consistency Score
                      </div>
                    </div>
                    <ValidationBadge
                      isValid={validationResult.is_valid}
                      score={validationResult.consistency_score}
                      size="lg"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 rounded-lg bg-white/5">
                      <div className="text-sm text-gray-400">Total Issues</div>
                      <div className="text-2xl font-bold">{validationResult.issues.length}</div>
                    </div>
                    <div className="p-3 rounded-lg bg-white/5">
                      <div className="text-sm text-gray-400">Critical</div>
                      <div className="text-2xl font-bold text-red-500">
                        {validationResult.issues.filter(i => i.severity === 'critical').length}
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-white/5">
                      <div className="text-sm text-gray-400">High</div>
                      <div className="text-2xl font-bold text-orange-500">
                        {validationResult.issues.filter(i => i.severity === 'high').length}
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-white/5">
                      <div className="text-sm text-gray-400">Medium/Low</div>
                      <div className="text-2xl font-bold text-yellow-500">
                        {validationResult.issues.filter(i => ['medium', 'low'].includes(i.severity)).length}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {validationResult.issues.slice(0, 5).map((issue, idx) => (
                      <div
                        key={idx}
                        className={`p-3 rounded-lg border ${getSeverityColor(issue.severity)} bg-white/2`}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 rounded text-xs ${getSeverityColor(issue.severity)}`}>
                            {issue.severity}
                          </span>
                          <span className="text-sm font-medium">{issue.type}</span>
                        </div>
                        <div className="text-sm text-gray-300 mt-1">{issue.message}</div>
                        {issue.node_id && (
                          <div className="text-xs text-gray-400 font-mono mt-1">
                            Node: {issue.node_id.slice(0, 16)}...
                          </div>
                        )}
                      </div>
                    ))}
                    {validationResult.issues.length > 5 && (
                      <div className="text-center text-sm text-gray-400">
                        +{validationResult.issues.length - 5} more issues
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <div className="text-4xl mb-2">✓</div>
                  <div>All validations passed</div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'temporal' && (
            <div className="space-y-3">
              {temporalIssues.length > 0 ? (
                temporalIssues.map((issue, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-lg border ${getSeverityColor(issue.severity)} bg-white/2`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">⏱️</span>
                      <span className={`px-2 py-1 rounded text-xs ${getSeverityColor(issue.severity)}`}>
                        {issue.severity}
                      </span>
                    </div>
                    <div className="text-sm text-gray-200">{issue.description}</div>
                    <div className="text-xs text-gray-400 mt-2">
                      Nodes: {issue.node_ids.slice(0, 3).join(', ')}{issue.node_ids.length > 3 && '...'}
                    </div>
                    {issue.suggested_resolution && (
                      <div className="text-xs text-cyan-400 mt-2">
                        {issue.suggested_resolution}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-green-400">
                  <div className="text-4xl mb-2">✓</div>
                  <div>No temporal alignment issues detected</div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'contradictions' && (
            <div className="space-y-3">
              {contradictions.length > 0 ? (
                contradictions.map((contradiction, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-lg border ${getSeverityColor(contradiction.severity)} bg-white/2`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">⚠️</span>
                      <span className={`px-2 py-1 rounded text-xs ${getSeverityColor(contradiction.severity)}`}>
                        {contradiction.severity}
                      </span>
                    </div>
                    <div className="text-sm text-gray-200">{contradiction.description}</div>
                    <div className="text-xs text-gray-400 mt-2">
                      Modalities: {contradiction.modalities.join(', ')}
                    </div>
                    <div className="text-xs text-gray-400">
                      Nodes: {contradiction.node_ids.slice(0, 3).join(', ')}{contradiction.node_ids.length > 3 && '...'}
                    </div>
                    {contradiction.suggested_resolution && (
                      <div className="text-xs text-cyan-400 mt-2">
                        {contradiction.suggested_resolution}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-green-400">
                  <div className="text-4xl mb-2">✓</div>
                  <div>No cross-modality contradictions detected</div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'confidence' && confidenceScore && (
            <div className="space-y-4">
              <div className="text-center">
                <div className="text-5xl font-bold">
                  {Math.round(confidenceScore.score * 100)}%
                </div>
                <div className="text-sm text-gray-400">Overall Confidence Score</div>
                <div className="text-xs text-gray-500 mt-1">
                  Method: {confidenceScore.method}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {Object.entries(confidenceScore.components).map(([key, value]) => (
                  <div key={key} className="p-3 rounded-lg bg-white/5">
                    <div className="text-xs text-gray-400 truncate">
                      {key.replace('_', ' ')}
                    </div>
                    <div className="text-xl font-bold">
                      {Math.round((value as number) * 100)}%
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-3 rounded-lg bg-white/5">
                <div className="text-sm font-medium mb-2">Interpretation:</div>
                <div className="text-sm text-gray-300">{confidenceScore.interpretation}</div>
              </div>

              {confidenceScore.recommendations.length > 0 && (
                <div className="p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                  <div className="text-sm font-medium mb-2 text-cyan-400">Recommendations:</div>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    {confidenceScore.recommendations.map((rec: string, idx: number) => (
                      <li key={idx} className="text-cyan-300">{rec}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// Component: Summary Statistics
// =============================================================================

const SummaryStatistics: React.FC<{
  nodes: EvidenceNode[];
  edges: EvidenceEdge[];
  validationResult: EvidenceValidationResult | null;
  inconsistencies: any[];
  confidenceScore: any;
  temporalIssues: TemporalAlignmentIssue[];
  contradictions: CrossModalityContradiction[];
  className?: string;
}> = ({ nodes, edges, validationResult, inconsistencies, confidenceScore, temporalIssues, contradictions, className }) => {
  const stats = [
    {
      label: 'Total Nodes',
      value: nodes.length,
      icon: '📊',
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
    },
    {
      label: 'Relationships',
      value: edges.length,
      icon: '🔗',
      color: 'text-green-400',
      bg: 'bg-green-500/10',
    },
    {
      label: 'Inconsistencies',
      value: inconsistencies.length,
      icon: '⚠️',
      color: inconsistencies.length > 0 ? 'text-red-400' : 'text-green-400',
      bg: inconsistencies.length > 0 ? 'bg-red-500/10' : 'bg-green-500/10',
    },
    {
      label: 'Temporal Issues',
      value: temporalIssues.length,
      icon: '⏱️',
      color: temporalIssues.length > 0 ? 'text-orange-400' : 'text-green-400',
      bg: temporalIssues.length > 0 ? 'bg-orange-500/10' : 'bg-green-500/10',
    },
    {
      label: 'Contradictions',
      value: contradictions.length,
      icon: '🔄',
      color: contradictions.length > 0 ? 'text-yellow-400' : 'text-green-400',
      bg: contradictions.length > 0 ? 'bg-yellow-500/10' : 'bg-green-500/10',
    },
    {
      label: 'Confidence Score',
      value: confidenceScore ? `${Math.round(confidenceScore.score * 100)}%` : 'N/A',
      icon: '✨',
      color: confidenceScore?.score && confidenceScore.score >= 0.8 ? 'text-green-400' : confidenceScore?.score && confidenceScore.score >= 0.6 ? 'text-yellow-400' : 'text-red-400',
      bg: confidenceScore?.score && confidenceScore.score >= 0.8 ? 'bg-green-500/10' : confidenceScore?.score && confidenceScore.score >= 0.6 ? 'bg-yellow-500/10' : 'bg-red-500/10',
    },
  ];

  return (
    <div className={className}>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className={`p-3 rounded-lg ${stat.bg} border border-white/5`}
          >
            <div className="text-xl mb-1">{stat.icon}</div>
            <div className={`text-lg font-bold ${stat.color}`}>
              {stat.value}
            </div>
            <div className="text-xs text-gray-400 truncate">{stat.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

// =============================================================================
// Main Component: EvidenceContinuityDashboard
// =============================================================================

const EvidenceContinuityDashboard: React.FC<EvidenceContinuityDashboardProps> = ({
  cardiacCaseId,
  onNodeSelect,
  onInconsistencyDetected,
  className,
}) => {
  const [state, setState] = useState<EvidenceContinuityState>({
    loading: true,
    error: null,
    nodes: [],
    edges: [],
    validationResult: null,
    temporalIssues: [],
    contradictions: [],
    inconsistencies: [],
    confidenceScore: null,
    selectedNode: null,
    selectedEdge: null,
    selectedCaseId: cardiacCaseId,
  });

  const [activeView, setActiveView] = useState<'graph' | 'validation' | 'inconsistencies'>('graph');
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Fetch data
  const fetchData = useCallback(async () => {
    if (!cardiacCaseId) {
      setState(prev => ({ ...prev, loading: false, error: 'No cardiac case ID provided' }));
      return;
    }

    try {
      setState(prev => ({ ...prev, loading: true, error: null }));

      // Fetch evidence graph
      const graph = await cardio.getEvidenceGraph(cardiacCaseId);

      // Validate evidence
      const validationResult = await cardio.validateEvidence(cardiacCaseId, 'full');

      // Check temporal alignment
      const temporalResult = await cardio.validateTemporalAlignment(cardiacCaseId);

      // Detect contradictions
      const contradictionResult = await cardio.detectContradictions(cardiacCaseId);

      // Detect inconsistencies
      const inconsistencyResult = await cardio.detectInconsistencies(cardiacCaseId);

      // Compute confidence score
      const confidenceResult = await cardio.computeConfidenceScore(cardiacCaseId);

      setState({
        loading: false,
        error: null,
        nodes: graph.nodes || [],
        edges: graph.edges || [],
        validationResult,
        temporalIssues: temporalResult.issues || [],
        contradictions: contradictionResult.contradictions || [],
        inconsistencies: inconsistencyResult.inconsistencies || [],
        confidenceScore: confidenceResult,
        selectedNode: null,
        selectedEdge: null,
        selectedCaseId: cardiacCaseId,
      });

      // Notify parent of inconsistencies
      if (inconsistencyResult.inconsistencies && inconsistencyResult.inconsistencies.length > 0) {
        onInconsistencyDetected?.(inconsistencyResult.inconsistencies);
      }
    } catch (error) {
      console.error('Error fetching evidence continuity data:', error);
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to load evidence continuity data',
      }));
    }
  }, [cardiacCaseId, onInconsistencyDetected]);

  // Initial fetch and auto-refresh
  useEffect(() => {
    fetchData();

    const refreshInterval = setInterval(() => {
      if (autoRefresh) {
        fetchData();
      }
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(refreshInterval);
  }, [fetchData, autoRefresh]);

  // Refetch when cardiacCaseId changes
  useEffect(() => {
    fetchData();
  }, [cardiacCaseId, fetchData]);

  // Handle node selection
  const handleNodeSelect = useCallback((node: EvidenceNode) => {
    setState(prev => ({ ...prev, selectedNode: node }));
    onNodeSelect?.(node);
  }, [onNodeSelect]);

  // Handle node navigation from inconsistencies
  const handleNavigateToNode = useCallback((nodeId: string) => {
    const node = state.nodes.find(n => n.id === nodeId);
    if (node) {
      handleNodeSelect(node);
      // Scroll to node if needed
      const element = document.getElementById(`node-${node.id}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [state.nodes, handleNodeSelect]);

  // Handle refresh
  const handleRefresh = useCallback(() => {
    fetchData();
  }, [fetchData]);

  // Memoized views
  const views = [
    { id: 'graph' as const, label: 'Evidence Graph', icon: '📊' },
    { id: 'validation' as const, label: 'Validation Results', icon: '🔍' },
    { id: 'inconsistencies' as const, label: 'Inconsistencies', icon: '⚠️' },
  ];

  // Compute statistics
  const hasIssues = state.inconsistencies.length > 0 ||
                    state.temporalIssues.length > 0 ||
                    state.contradictions.length > 0 ||
                    (state.validationResult && !state.validationResult.is_valid);

  return (
    <div className={`w-full ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-6 p-4 rounded-lg bg-black/30 border border-white/5">
        <div className="flex items-center gap-4">
          <span className="text-2xl">🫀</span>
          <div>
            <h2 className="text-lg font-medium text-white">
              Cardiac Evidence Continuity Engine
            </h2>
            <p className="text-sm text-gray-400">
              Case: {cardiacCaseId}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <ValidationBadge
            isValid={!hasIssues}
            score={state.confidenceScore?.score}
          />

          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-colors text-sm"
              title="Refresh data"
            >
              ↻
            </button>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="w-4 h-4 rounded border-white/20"
              />
              <span className="text-gray-300">Auto-refresh (30s)</span>
            </label>
          </div>
        </div>
      </div>

      {/* Summary Statistics */}
      <SummaryStatistics
        nodes={state.nodes}
        edges={state.edges}
        validationResult={state.validationResult}
        inconsistencies={state.inconsistencies}
        confidenceScore={state.confidenceScore}
        temporalIssues={state.temporalIssues}
        contradictions={state.contradictions}
        className="mb-6"
      />

      {/* Error State */}
      {state.error && (
        <div className="p-6 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 mb-6">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <h3 className="font-medium mb-1">Error Loading Data</h3>
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
          <p className="text-gray-300">Loading evidence continuity data...</p>
        </div>
      )}

      {/* Main Content */}
      {!state.loading && !state.error && (
        <>
          {/* View Tabs */}
          <div className="flex gap-1 mb-6">
            {views.map((view) => (
              <button
                key={view.id}
                onClick={() => setActiveView(view.id)}
                className={`
                  px-4 py-2 rounded-lg text-sm font-medium transition-all
                  ${activeView === view.id
                    ? 'bg-white/10 text-white border border-white/20'
                    : 'text-gray-400 hover:bg-white/5 hover:text-white/80'
                  }
                `}
              >
                <span className="mr-2">{view.icon}</span>
                {view.label}
              </button>
            ))}
          </div>

          {/* Active View Content */}
          <div className="min-h-[400px]">
            {activeView === 'graph' && (
              <EvidenceGraphVisualization
                nodes={state.nodes}
                edges={state.edges}
                validationResult={state.validationResult}
                onNodeSelect={handleNodeSelect}
                selectedNode={state.selectedNode}
                inconsistencies={state.inconsistencies}
              />
            )}

            {activeView === 'validation' && (
              <ValidationResultsPanel
                validationResult={state.validationResult}
                temporalIssues={state.temporalIssues}
                contradictions={state.contradictions}
                confidenceScore={state.confidenceScore}
              />
            )}

            {activeView === 'inconsistencies' && (
              <div className="p-4 rounded-lg bg-black/30 border border-white/5">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-xl">⚠️</span>
                  <span className="font-medium">Detected Inconsistencies</span>
                </div>

                <InconsistencyList
                  inconsistencies={state.inconsistencies}
                  nodes={state.nodes}
                  onNodeNavigate={handleNavigateToNode}
                />
              </div>
            )}
          </div>

          {/* Selected Node Details */}
          {state.selectedNode && (
            <div className="mt-6 p-4 rounded-lg bg-black/30 border border-orange-500/30">
              <div className="flex items-center justify-between gap-4 mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">
                    {getNodeTypeInfo(state.selectedNode.node_type || 'default').icon}
                  </span>
                  <div>
                    <h3 className="font-medium">Selected Evidence Node</h3>
                    <p className="text-sm text-gray-400">
                      ID: {state.selectedNode.id.slice(0, 16)}...
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setState(prev => ({ ...prev, selectedNode: null }))}
                  className="text-gray-400 hover:text-white text-2xl transition-colors"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="space-y-3">
                  <div>
                    <span className="text-gray-400">Type:</span>
                    <span className="ml-2 font-medium">{state.selectedNode.node_type || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Entity:</span>
                    <span className="ml-2 font-medium">{state.selectedNode.entity_type}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Source:</span>
                    <span className="ml-2 font-medium">{state.selectedNode.source}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Provenance:</span>
                    <span className="ml-2 font-medium">{state.selectedNode.provenance}</span>
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <span className="text-gray-400">Confidence:</span>
                    <span className={`ml-2 font-medium ${confidenceToColor(state.selectedNode.confidence)}`}>
                      {(state.selectedNode.confidence * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400">Quality:</span>
                    <span className="ml-2 font-medium">
                      {(state.selectedNode.quality_score * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400">Clinical Relevance:</span>
                    <span className="ml-2 font-medium">
                      {(state.selectedNode.clinical_relevance * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400">Version:</span>
                    <span className="ml-2 font-medium font-mono">{state.selectedNode.version}</span>
                  </div>
                </div>
              </div>

              {state.selectedNode.observation_time && (
                <div className="mt-4 pt-3 border-t border-white/5">
                  <div className="text-sm">
                    <span className="text-gray-400">Observation Time:</span>
                    <span className="ml-2 font-medium">
                      {new Date(state.selectedNode.observation_time).toLocaleString()}
                    </span>
                  </div>
                </div>
              )}

              {state.selectedNode.summary && (
                <div className="mt-4 pt-3 border-t border-white/5">
                  <div className="text-sm">
                    <span className="text-gray-400">Summary:</span>
                    <p className="mt-1 text-white/80">{state.selectedNode.summary}</p>
                  </div>
                </div>
              )}

              {Object.keys(state.selectedNode.data || {}).length > 0 && (
                <div className="mt-4 pt-3 border-t border-white/5">
                  <div className="text-sm">
                    <span className="text-gray-400">Data:</span>
                    <pre className="mt-2 p-3 rounded-lg bg-black/40 text-xs text-white/70 overflow-x-auto">
                      {JSON.stringify(state.selectedNode.data, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Empty State */}
      {!state.loading && !state.error && state.nodes.length === 0 && (
        <div className="p-8 rounded-lg bg-white/5 border border-white/5 text-center">
          <div className="text-4xl mb-4">🫀</div>
          <h3 className="text-lg font-medium mb-2">No Evidence Data</h3>
          <p className="text-sm text-gray-400 mb-4">
            No evidence nodes found for this cardiac case.
          </p>
          <p className="text-xs text-gray-500 mb-4">
            The Evidence Continuity Engine requires evidence data to validate consistency.
          </p>
          <button
            onClick={handleRefresh}
            className="px-4 py-2 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 text-sm transition-colors"
          >
            Refresh
          </button>
        </div>
      )}
    </div>
  );
};

// Add CSS for animations
const styles = document.createElement('style');
styles.textContent = `
  @keyframes pulse-subtle {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
  }
  .animate-pulse-subtle {
    animation: pulse-subtle 2s ease-in-out infinite;
  }
`;
document.head.appendChild(styles);

export default EvidenceContinuityDashboard;
