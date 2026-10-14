# Button Automation Framework for CLINICASE - ONCOTWIN

## Overview

The Button Automation Framework is a comprehensive system that enables automation of all button interactions across every process in the CLINICASE - ONCOTWIN application. This framework provides:

- **Complete Button Coverage**: Every button in every workflow can be automated
- **Centralized Management**: Manage all automation through a unified dashboard
- **Flexible Execution**: Run individual buttons, predefined sequences, or entire workflows
- **Real-time Monitoring**: Track automation progress and execution logs
- **Safety Controls**: Built-in safeguards for destructive actions and confirmations
- **Backend Integration**: Server-side automation support via REST API

## Architecture

The automation framework consists of several key components:

### 1. Core Provider (`ButtonAutomationProvider.tsx`)

The central state management component that provides:
- Button registration and discovery
- Automation execution engine
- State management and event system
- Error handling and retry logic

### 2. Button Registry (`buttonRegistry.ts`)

A comprehensive registry of all buttons across every process:
- **Journey Workflow**: 12 buttons for evidence journey management
- **Cardio Twin**: 10 buttons for cardiovascular analysis
- **Atlas**: 11 buttons for evidence fusion and exploration
- **Intake & Cases**: 9 buttons for case management
- **Interoperability**: 9 buttons for data exchange
- **Review & Safety**: 8 buttons for review processes
- **AquaHealth**: 9 buttons for environmental health data
- **Oncology**: 6 buttons for oncology workflows
- **AI Agents**: 5 buttons for AI agent management
- **Global Utilities**: 6 buttons for global functions
- **Research**: 7 buttons for research and analytics
- **Follow-up**: 5 buttons for follow-up workflows

**Total: 107 buttons across 12 categories**

### 3. Automation Dashboard (`AutomationDashboard.tsx`)

A full-featured web interface for:
- Browsing and filtering all automatable buttons
- Creating and managing automation plans
- Monitoring execution in real-time
- Viewing execution logs and statistics

### 4. Automation Controls (`AutomationToolbar.tsx`, `AutomationShell.tsx`)

Floating controls and integration points:
- Compact status indicators
- Quick action buttons
- Global keyboard shortcuts
- Embeddable status badges

### 5. Backend API (`backend/app/api/core__app_api__automation.py`)

REST API endpoints for server-side automation:
- Button and plan management
- Execution control
- State monitoring
- Statistics and analytics

## Installation

### Frontend Integration

1. **Wrap your application with the AutomationShell**:

```tsx
// main.tsx or App.tsx
import { AutomationShell } from './automation/AutomationShell';

function App() {
  return (
    <AutomationShell showToolbar={true}>
      <YourApp />
    </AutomationShell>
  );
}
```

2. **Import automation styles**:

```tsx
import './automation/automation.css';
```

### Backend Integration

1. **Mount the automation router**:

```python
# main.py
from app.api.automation import router as automation_router

app.include_router(automation_router)
```

2. **Run migrations** (if using database storage):

```bash
alembic revision --autogenerate -m "Add automation tables"
alembic upgrade head
```

## Usage

### Basic Button Automation

#### Method 1: Using the useAutomatedButtonHandler Hook

```tsx
import { useAutomatedButtonHandler } from './automation/useButtonAutomationRegistry';

function MyComponent() {
  const { handleClick, isAutomatable, isRunning } = useAutomatedButtonHandler(
    'my_button_id',
    () => {
      // Your button click handler
      console.log('Button clicked!');
      doSomething();
    },
    {
      category: 'my_category',
      process: 'my_process',
      priority: 'high',
      requiresConfirmation: false,
    }
  );

  return (
    <button onClick={handleClick} disabled={isRunning}>
      {isRunning ? 'Running...' : 'Click Me'}
    </button>
  );
}
```

#### Method 2: Using Button Registry with Existing Components

```tsx
import { withAutomation } from './automation/useButtonAutomationRegistry';
import { Button } from './components/Button';

// Wrap your existing button component
const AutomatedButton = withAutomation(Button, {
  id: 'submit_form',
  label: 'Submit Form',
  actionType: 'submit',
  category: 'forms',
  process: 'submission',
  priority: 'high',
  automationEnabled: true,
  callback: () => console.log('Form submitted!'),
});

function MyForm() {
  return <AutomatedButton onClick={() => submitForm()} />;
}
```

### Creating Automation Plans

#### Programmatic Plan Creation

```tsx
import { useButtonAutomation } from './automation/ButtonAutomationProvider';

function AutomationControl() {
  const automation = useButtonAutomation();

  const runCompleteWorkflow = async () => {
    const buttonSequence = [
      'journey_start_new',
      'journey_submit_mapping',
      'journey_accept_all_mappings',
      'journey_generate_fhir',
      'journey_validate_fhir',
      'journey_export_passport',
    ];

    const success = await automation.startAutomation(buttonSequence, {
      delayBetweenActions: 2000,  // 2 seconds between actions
      continueOnError: false,     // Stop on first error
      skipConfirmations: true,    // Skip confirmation dialogs
      onProgress: (progress, current, total) => {
        console.log(`Progress: ${progress}% - ${current} (${total})`);
      },
    });

    if (success) {
      console.log('Automation completed successfully!');
    } else {
      console.log('Automation failed or was stopped');
    }
  };

  return (
    <button onClick={runCompleteWorkflow}>
      Run Complete Workflow
    </button>
  );
}
```

#### Using Predefined Plans

```tsx
import { useButtonAutomation, PREDEFINED_PLANS } from './automation/useButtonAutomationRegistry';

function QuickAutomation() {
  const automation = useButtonAutomation();

  // Use a predefined plan
  const runJourneyWorkflow = async () => {
    await automation.startAutomation(PREDEFINED_PLANS.completeJourney);
  };

  return (
    <button onClick={runJourneyWorkflow}>
      Run Journey Workflow
    </button>
  );
}
```

### Accessing Automation State

```tsx
import { useButtonAutomation } from './automation/ButtonAutomationProvider';

function AutomationStatus() {
  const automation = useButtonAutomation();

  return (
    <div>
      <p>Status: {automation.state.status}</p>
      <p>Progress: {automation.state.progress}%</p>
      <p>Completed: {automation.state.completedButtons.length}</p>
      <p>Failed: {automation.state.failedButtons.length}</p>
    </div>
  );
}
```

### Using the Dashboard

The automation dashboard provides a comprehensive UI for managing automation:

```tsx
import { AutomationDashboard } from './automation/AutomationDashboard';

function AdminPanel() {
  return <AutomationDashboard />;
}
```

Or use the toggle button:

```tsx
import { AutomationToggleButton } from './automation/AutomationShell';

function AppHeader() {
  return (
    <header>
      <h1>My App</h1>
      <AutomationToggleButton />
    </header>
  );
}
```

### Keyboard Shortcuts

The framework provides global keyboard shortcuts:

- **Ctrl/Cmd + Shift + A**: Toggle Automation Dashboard
- **Ctrl/Cmd + Shift + T**: Toggle Automation Toolbar
- **Ctrl/Cmd + Shift + S**: Stop current automation
- **Ctrl/Cmd + Shift + P**: Pause/Resume automation

## Button Registry

### Button Configuration

Each button in the registry has the following configuration:

```typescript
{
  id: string;                    // Unique identifier
  label: string;                // Human-readable label
  actionType: ButtonActionType; // Type of action
  category: string;             // Process category
  process: string;              // Specific process
  priority: 'low' | 'medium' | 'high'; // Execution priority
  automationEnabled: boolean;   // Can be automated
  isDestructive?: boolean;     // Destructive action flag
  requiresConfirmation?: boolean; // Needs confirmation
  conditions?: Record<string, any>; // Execution conditions
  payload?: Record<string, any>; // Action payload
  callback?: (data?: any) => void; // Action handler
  validation?: (data?: any) => boolean; // Validation function
}
```

### Action Types

The framework supports the following action types:

| Type | Description | Use Case |
|------|-------------|----------|
| `navigate` | Navigation between pages | Opening different views |
| `submit` | Form submission | Submitting forms |
| `api_call` | API request | Fetching/updating data |
| `modal_open` | Open modal/dialog | Showing dialogs |
| `modal_close` | Close modal/dialog | Hiding dialogs |
| `workflow_step` | Workflow progression | Moving to next step |
| `data_processing` | Data transformation | Processing data |
| `filter_change` | Filter modification | Changing filters |
| `selection` | Item selection | Selecting items |
| `export` | Data export | Exporting data |
| `import` | Data import | Importing data |
| `reset` | Reset/clear | Clearing states |
| `delete` | Item deletion | Deleting items |
| `custom` | Custom action | Special cases |

### Categories and Processes

The system organizes buttons into categories and processes for easy filtering:

#### Categories
- `journey` - Evidence journey workflows
- `cardiotwin` - Cardiovascular twin operations
- `atlas` - Atlas and evidence fusion
- `intake` - Patient intake and case management
- `interop` - Interoperability and data exchange
- `review` - Review and safety processes
- `aquahealth` - Environmental health data
- `oncology` - Oncology workflows
- `agents` - AI agent management
- `global` - Global application functions
- `research` - Research and analytics
- `followup` - Follow-up and retest workflows

#### Processes
Each category contains multiple processes. For example, the `journey` category includes:
- `intake` - Starting new journeys
- `progression` - Moving between steps
- `mapping` - Field mapping operations
- `standardization` - FHIR generation
- `validation` - Data validation
- `export` - Export operations

## Automation Plans

### Predefined Plans

The framework includes several predefined automation plans:

1. **Complete Evidence Journey** (`completeJourney`)
   - Automates the entire evidence journey from intake to validation
   - Buttons: journey_start_new, journey_next_step, journey_submit_mapping, journey_accept_all_mappings, journey_generate_fhir, journey_validate_fhir, journey_export_passport

2. **Cardiovascular Analysis** (`cardiovascularAnalysis`)
   - Runs complete cardiovascular analysis and generates reports
   - Buttons: cardiotwin_open_3d, cardiotwin_run_analysis, cardiotwin_replay_history, cardiotwin_ablation_test, cardiotwin_export_results

3. **Interoperability Testing** (`interopTesting`)
   - Tests the complete interop workflow
   - Buttons: interop_map_fields, interop_validate_mapping, interop_generate_fhir, interop_send_to_system_b, interop_round_trip_test, interop_verify_semantics

4. **Evidence Review** (`evidenceReview`)
   - Automates the evidence review process
   - Buttons: review_open_queue, review_approve_item, review_mark_as_reviewed

5. **Bulk Intake** (`bulkIntake`)
   - Handles bulk import and processing of patient cases
   - Buttons: intake_bulk_import, intake_upload_scan, intake_process_scan, cases_list_all

6. **Atlas Exploration** (`atlasExploration`)
   - Automates exploration of the CardioTwin Atlas
   - Buttons: atlas_open_fusion, atlas_open_graph, atlas_reconstruct_sources, atlas_add_transcript, atlas_ask_question

### Creating Custom Plans

```typescript
import { createWorkflowAutomationPlan } from './automation/useButtonAutomationRegistry';

const myCustomPlan = createWorkflowAutomationPlan(
  'My Custom Workflow',
  'Description of what this plan does',
  [
    'journey_start_new',
    'intake_upload_scan',
    'cardiotwin_run_analysis',
    'journey_generate_fhir',
  ]
);

// Register the plan
automation.createPlan(myCustomPlan);
```

## REST API

### Endpoints

#### Button Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/automation/buttons` | List all registered buttons |
| GET | `/api/automation/buttons/{button_id}` | Get specific button |
| POST | `/api/automation/buttons` | Register new button |
| DELETE | `/api/automation/buttons/{button_id}` | Unregister button |

#### Plan Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/automation/plans` | List all automation plans |
| GET | `/api/automation/plans/{plan_id}` | Get specific plan |
| POST | `/api/automation/plans` | Create new plan |
| DELETE | `/api/automation/plans/{plan_id}` | Delete plan |

#### Execution Control

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/automation/execute` | Start automation execution |
| POST | `/api/automation/execute/plan/{plan_id}` | Execute specific plan |
| POST | `/api/automation/execute/category/{category}` | Execute category buttons |
| POST | `/api/automation/bulk-execute` | Bulk execution with filters |
| POST | `/api/automation/pause` | Pause current automation |
| POST | `/api/automation/resume` | Resume paused automation |
| POST | `/api/automation/stop` | Stop current automation |
| POST | `/api/automation/reset` | Reset automation state |

#### State and Monitoring

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/automation/state` | Get current automation state |
| GET | `/api/automation/statistics` | Get automation statistics |

#### Journey Automation

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/automation/journey/{job_id}/automate` | Get journey automation state |
| POST | `/api/automation/journey/{job_id}/advance` | Advance journey step |

### API Examples

#### Start Automation

```bash
curl -X POST http://localhost:8000/api/automation/execute \
  -H "Content-Type: application/json" \
  -d '{
    "button_ids": ["journey_start_new", "intake_upload_scan"],
    "delay_between_actions": 2000,
    "continue_on_error": false,
    "skip_confirmations": true,
    "max_retries": 3,
    "timeout": 30000
  }'
```

#### Create Automation Plan

```bash
curl -X POST http://localhost:8000/api/automation/plans \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Daily Data Processing",
    "description": "Process all new patient data",
    "button_sequence": [
      "intake_new_case",
      "intake_upload_scan",
      "intake_process_scan",
      "journey_submit_mapping"
    ],
    "categories": ["intake", "journey"],
    "estimated_duration": 30
  }'
```

#### Get Automation State

```bash
curl http://localhost:8000/api/automation/state
```

#### Get Statistics

```bash
curl http://localhost:8000/api/automation/statistics
```

## Safety Features

### Confirmation Handling

The framework respects button configurations that require confirmation:

- **requiresConfirmation**: Buttons marked with this flag will prompt for user confirmation unless `skipConfirmations` option is set
- **isDestructive**: Destructive actions are highlighted and handled with extra care

### Error Handling

- **Automatic Retries**: Configurable retry count for failed actions
- **Graceful Degradation**: System continues running even if individual buttons fail (configurable)
- **Detailed Logging**: Comprehensive execution logs for debugging
- **State Preservation**: Current state is preserved across navigation and page refreshes

### Validation

- **Pre-execution Validation**: Buttons can define validation functions that must pass before execution
- **Condition Checking**: Pre-conditions for automation plans are verified before execution
- **Post-execution Verification**: Post-conditions can be checked after plan execution

## Performance Optimization

### Execution Options

The automation framework provides several options for optimizing execution:

- **delayBetweenActions**: Control the delay between button executions (default: 1000ms)
- **continueOnError**: Continue automation even if individual buttons fail
- **maxRetries**: Number of retry attempts for failed actions (default: 3)
- **timeout**: Maximum time for individual actions (default: 30000ms)
- **skipConfirmations**: Skip all confirmation dialogs during automation

### Parallel Execution

While the current implementation executes buttons sequentially for safety, future enhancements could include:

```typescript
// Parallel execution of independent buttons
await automation.startAutomation(buttonSequence, {
  parallelExecution: true,
  maxConcurrent: 3,  // Maximum concurrent executions
});
```

### Caching and Batching

For improved performance with large automation sequences:

- **Batch Processing**: Group similar operations together
- **Caching**: Cache frequently used button configurations
- **Preloading**: Preload button data before execution

## Monitoring and Analytics

### Real-time Monitoring

The framework provides real-time monitoring through:

1. **State Updates**: Current execution state is updated in real-time
2. **Progress Tracking**: Progress percentage is calculated and updated
3. **Execution Logs**: Detailed logs of all executions with timestamps
4. **Performance Metrics**: Duration tracking for each action

### Execution Log Format

```json
{
  "timestamp": 1234567890.123,
  "buttonId": "journey_submit_mapping",
  "action": "execute",
  "status": "completed",
  "duration": 1523,
  "error": null,
  "data": {
    "action_type": "submit",
    "category": "journey"
  }
}
```

### Statistics Dashboard

The statistics endpoint provides comprehensive metrics:

```json
{
  "total_buttons": 107,
  "automatable_buttons": 95,
  "total_plans": 5,
  "by_category": {
    "journey": 12,
    "cardiotwin": 10,
    "atlas": 11,
    "..."
  },
  "by_process": {
    "intake": 5,
    "mapping": 3,
    "validation": 4,
    "..."
  },
  "by_priority": {
    "high": 45,
    "medium": 35,
    "low": 27
  }
}
```

## Integration with Existing Components

### AppShell Integration

The automation framework integrates seamlessly with the existing AppShell:

```tsx
// frontend/src/components/AppShell.tsx
import { AutomationStatusBar, useAutomationShell } from '../automation/AutomationShell';

export function AppShell() {
  const { children } = useAppShellProps();
  const automation = useAutomationShell();

  return (
    <div className="app-shell">
      <TopBar />
      <Sidenav />
      <main>
        <RouteBoundary>
          {children}
        </RouteBoundary>
      </main>
      <FAB />
      <SearchPalette />
      
      {/* Add automation status bar */}
      <AutomationStatusBar />
      
      {/* Add automation controls to sidebar */}
      <AutomationToggleButton />
    </div>
  );
}
```

### Workflow Navigation Integration

```tsx
// frontend/src/workflow/WorkflowNavigation.tsx
import { AutomationToggleButton } from '../automation/AutomationShell';

export function WorkflowNavigation() {
  // ... existing code

  return (
    <div className="workspace-strip">
      {/* ... existing strip content */}
      
      {/* Add automation toggle */}
      <AutomationToggleButton />
    </div>
  );
}
```

### Button Component Integration

Existing button components can be enhanced with automation support:

```tsx
// Example: Enhanced button component
import { useAutomatedButtonHandler } from '../automation/useButtonAutomationRegistry';

export function Button({ 
  children, 
  onClick, 
  automationId, 
  ...props 
}) {
  const { handleClick, isAutomatable, isRunning, status } = useAutomatedButtonHandler(
    automationId || `button_${Math.random().toString(36).substr(2, 9)}`,
    onClick,
    {
      category: props.category,
      process: props.process,
      priority: props.priority || 'medium',
    }
  );

  return (
    <button 
      onClick={handleClick} 
      disabled={props.disabled || isRunning}
      className={`btn ${props.className} ${status}`}
      {...props}
    >
      {isAutomatable && <span className="automation-badge">⚡</span>}
      {children}
    </button>
  );
}
```

## Best Practices

### Button Naming Convention

Use clear, descriptive names for button IDs:

- **Format**: `{category}_{process}_{action}`
- **Examples**: `journey_submit_mapping`, `cardiotwin_run_analysis`, `interop_validate_mapping`
- **Avoid**: Generic names like `button1`, `submit`, `action`

### Error Handling

Always handle errors gracefully in button callbacks:

```typescript
const handleButtonClick = async () => {
  try {
    await performAction();
    return true;
  } catch (error) {
    console.error('Button action failed:', error);
    // Optionally show user-friendly error message
    return false;
  }
};
```

### Validation

Add validation to ensure buttons can only be executed when appropriate:

```typescript
const buttonConfig = {
  id: 'journey_submit_mapping',
  label: 'Submit Mappings',
  actionType: 'submit',
  category: 'journey',
  process: 'mapping',
  automationEnabled: true,
  validation: (data) => {
    // Only allow submission if there are mappings to submit
    return data && data.mappings && data.mappings.length > 0;
  },
  callback: submitMappings,
};
```

### Priority Management

Use priorities to control execution order and importance:

- **High Priority**: Critical actions that must complete successfully
- **Medium Priority**: Important actions that should complete
- **Low Priority**: Optional actions that can fail without affecting workflow

### Confirmation Handling

For destructive actions, always require confirmation:

```typescript
const deleteButtonConfig = {
  id: 'cases_delete',
  label: 'Delete Case',
  actionType: 'delete',
  category: 'intake',
  process: 'management',
  automationEnabled: true,
  requiresConfirmation: true,
  isDestructive: true,
  callback: deleteCase,
};
```

## Troubleshooting

### Common Issues

1. **Buttons Not Appearing in Dashboard**
   - Ensure buttons are properly registered with `useRegisterButtons` or `useRegisterButton`
   - Check that `automationEnabled: true` is set
   - Verify button IDs are unique

2. **Automation Not Starting**
   - Check that navigation function is set with `automation.setNavigate(navigate)`
   - Verify buttons are registered before starting automation
   - Ensure no validation failures are preventing execution

3. **Actions Not Executing**
   - Verify callback functions are properly defined
   - Check that buttons have correct actionType
   - Ensure button conditions are met

4. **Confirmation Dialogs Blocking Automation**
   - Set `skipConfirmations: true` in execution options
   - Or configure buttons with `requiresConfirmation: false`

5. **Destructive Actions Skipped**
   - Set `skipConfirmations: true` and ensure `isDestructive: false` or handle appropriately
   - Be cautious with destructive automation

### Debugging Tools

1. **Execution Logs**
   - Check the execution log in the dashboard for detailed error information
   - Each log entry includes timestamp, button ID, action, status, and duration

2. **Console Logging**
   - Enable debug logging for detailed execution tracing
   - Set `DEBUG_AUTOMATION=true` environment variable

3. **State Inspection**
   - Use the automation state endpoint to inspect current state
   - Check the automation dashboard for real-time state

4. **Button Testing**
   - Test individual buttons manually before adding to automation plans
   - Use the dashboard to run single buttons

## Future Enhancements

### Planned Features

1. **Parallel Execution**: Execute independent buttons concurrently
2. **Schedule Automation**: Schedule automation to run at specific times
3. **Conditional Logic**: Add if/then/else logic to automation plans
4. **Looping**: Support for repeated execution of button sequences
5. **Variable Support**: Support for variables and dynamic data in automation
6. **Event Triggers**: Trigger automation based on application events
7. **Cross-Device Sync**: Sync automation state across multiple devices
8. **Advanced Analytics**: Enhanced monitoring and analytics dashboard

### Performance Improvements

1. **Lazy Loading**: Load button configurations on demand
2. **Web Workers**: Use web workers for background automation
3. **Optimized Rendering**: Virtualize large button lists
4. **Caching**: Cache automation state and configurations

### Integration Enhancements

1. **CLI Interface**: Command-line interface for automation
2. **WebSocket Support**: Real-time updates via WebSocket
3. **GraphQL API**: GraphQL interface for automation queries
4. **Desktop App**: Standalone desktop application for automation management

## API Reference

### Frontend API

#### useButtonAutomation()

Returns the complete automation context with all available methods and state.

#### useRegisterButtons(configs: ButtonAutomationConfig[])

Hook for registering multiple buttons at once.

#### useRegisterButton(config: ButtonAutomationConfig)

Hook for registering a single button.

#### useAutomatedButtonHandler(buttonId, onClick, options?)

Creates an automated button click handler.

#### useAutomatedFormHandler(formId, onSubmit, options?)

Creates an automated form submission handler.

#### useAutomatedNavigationHandler(buttonId, path, options?)

Creates an automated navigation handler.

#### useAutomatedApiHandler(buttonId, apiCall, options?)

Creates an automated API call handler.

#### withAutomation(Component, config)

Higher-order component for adding automation to existing components.

### Backend API

#### GET /api/automation/state

Get current automation state.

**Response**: `AutomationState` object

#### GET /api/automation/statistics

Get automation system statistics.

**Response**: `AutomationStatistics` object

#### GET /api/automation/buttons

List all registered buttons.

**Query Parameters**:
- `category`: Filter by category
- `process`: Filter by process
- `automatable`: Filter by automation enabled

**Response**: Array of `ButtonAutomationConfig` objects

#### POST /api/automation/execute

Start automation execution.

**Request Body**: `AutomationExecutionRequest`

**Response**: `AutomationExecutionResponse`

#### POST /api/automation/execute/plan/{plan_id}

Execute a specific automation plan.

**Request Body**: Execution options object

**Response**: `AutomationExecutionResponse`

#### POST /api/automation/pause

Pause the current automation.

#### POST /api/automation/resume

Resume a paused automation.

#### POST /api/automation/stop

Stop the current automation.

#### POST /api/automation/reset

Reset automation state.

## Examples

### Complete Evidence Journey Automation

```typescript
import { useButtonAutomation, PREDEFINED_PLANS } from './automation/useButtonAutomationRegistry';

function CompleteJourneyAutomation() {
  const automation = useButtonAutomation();

  const runCompleteJourney = async () => {
    try {
      // Method 1: Use predefined plan
      const result = await automation.startAutomation(
        PREDEFINED_PLANS.completeJourney,
        {
          delayBetweenActions: 2000,
          continueOnError: false,
          skipConfirmations: true,
          onProgress: (progress, current, total) => {
            console.log(`Journey Progress: ${progress}%`);
          },
          onError: (error, buttonId) => {
            console.error(`Error executing ${buttonId}:`, error);
          },
        }
      );

      if (result.success) {
        showSuccessMessage('Evidence journey completed successfully!');
      } else {
        showErrorMessage('Evidence journey failed');
      }
    } catch (error) {
      showErrorMessage(`Automation failed: ${error.message}`);
    }
  };

  return (
    <div>
      <h2>Evidence Journey Automation</h2>
      <p>Automate the entire evidence journey workflow</p>
      
      <button onClick={runCompleteJourney}>
        Run Complete Journey
      </button>
      
      <div>
        <h3>Status</h3>
        <p>Running: {automation.state.isRunning ? 'Yes' : 'No'}</p>
        <p>Progress: {automation.state.progress}%</p>
        <p>Completed: {automation.state.completedButtons.length} buttons</p>
      </div>
    </div>
  );
}
```

### Category-based Automation

```typescript
import { useButtonAutomation } from './automation/ButtonAutomationProvider';

function CategoryAutomation() {
  const automation = useButtonAutomation();

  const runCategoryAutomation = async (category: string) => {
    // Get all buttons in the specified category
    const categoryButtons = automation.getButtonsByCategory(category)
      .filter(b => b.automationEnabled)
      .map(b => b.id);

    if (categoryButtons.length === 0) {
      showWarningMessage(`No automatable buttons found in category: ${category}`);
      return;
    }

    const success = await automation.startAutomation(categoryButtons, {
      delayBetweenActions: 1500,
      continueOnError: true,
      maxRetries: 2,
    });

    if (success) {
      showSuccessMessage(`Category automation completed: ${category}`);
    }
  };

  const categories = Array.from(new Set(
    Object.values(automation.buttons).map(b => b.category)
  ));

  return (
    <div>
      <h2>Category Automation</h2>
      <p>Run all automatable buttons in a category</p>
      
      <div>
        {categories.map(category => (
          <button 
            key={category} 
            onClick={() => runCategoryAutomation(category)}
          >
            Run {category} Category
          </button>
        ))}
      </div>
    </div>
  );
}
```

### Custom Workflow Automation

```typescript
import { useButtonAutomation, createWorkflowAutomationPlan } from './automation/useButtonAutomationRegistry';

function CustomWorkflowAutomation() {
  const automation = useButtonAutomation();

  // Create a custom workflow plan
  const createCustomWorkflow = () => {
    const plan = createWorkflowAutomationPlan(
      'Custom Patient Processing',
      'Process new patient data through the system',
      [
        'intake_new_case',
        'intake_upload_scan',
        'intake_process_scan',
        'journey_start_new',
        'journey_submit_mapping',
        'journey_accept_all_mappings',
        'journey_generate_fhir',
        'journey_validate_fhir',
        'interop_send_to_system_b',
        'interop_round_trip_test',
      ]
    );

    // Register the plan
    const planId = automation.createPlan(plan);
    showSuccessMessage(`Custom workflow created: ${planId}`);
    
    // Optionally run it immediately
    automation.startAutomation(planId);
  };

  return (
    <div>
      <h2>Custom Workflow</h2>
      <p>Create and run custom automation workflows</p>
      
      <button onClick={createCustomWorkflow}>
        Create and Run Custom Workflow
      </button>
    </div>
  );
}
```

## Conclusion

The Button Automation Framework provides a powerful, flexible, and comprehensive solution for automating all button interactions across the entire CLINICASE - ONCOTWIN application. With support for every workflow, process, and use case, this framework enables:

- **Complete Automation**: Every button in every process can be automated
- **Flexible Control**: Run individual buttons, predefined plans, or custom sequences
- **Real-time Monitoring**: Track progress and execution in real-time
- **Safety First**: Built-in safeguards for destructive actions and confirmations
- **Easy Integration**: Simple integration with existing components
- **Scalable Architecture**: Designed to handle complex automation scenarios

This framework transforms the application from a manual interface to a highly automated, efficient system that can handle complex workflows with minimal user intervention.
