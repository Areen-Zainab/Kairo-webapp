# TaskBoard Components

This directory contains all the components for the Kairo workspace TaskBoard feature, providing a comprehensive task management system with multiple views and advanced filtering capabilities.

## Components Structure

### Core Components

- **TaskCard.tsx** - Individual task card component with metadata display and hover actions
- **KanbanBoard.tsx** - Drag-and-drop Kanban board with column management
- **ListView.tsx** - Tabular list view with sorting and filtering
- **CalendarView.tsx** - Calendar-based task visualization
- **TaskFilters.tsx** - Advanced filtering and sorting controls
- **types.ts** - TypeScript type definitions for the taskboard system

### Modals

- **TaskDetailModal.tsx** - Comprehensive task detail modal with meeting context integration

## Features

### Views
- **Kanban View**: Drag-and-drop task management with status columns
- **List View**: Tabular display with sortable columns
- **Calendar View**: Timeline-based task visualization

### Filtering & Sorting
- Filter by assignee, priority, status, project, tags, and due date
- Search across task titles, descriptions, and assignees
- Sort by due date, creation date, priority, or title
- Clear all filters functionality

### Task Management
- Create, edit, and delete tasks
- Change task status and priority
- Assign tasks to team members
- Add tags and project associations
- Set due dates and track overdue tasks

### Meeting Context Integration
- Link tasks to meeting transcripts
- Display meeting decisions and notes
- Show context snippets from meetings

### Role-Based Access
- Global view: See all workspace tasks
- Personal view: See only assigned tasks
- Admin/manager visibility controls

### Responsive Design
- Mobile and tablet optimized
- Touch-friendly interactions
- Accessible keyboard navigation
- ARIA labels for screen readers

## Usage

```tsx
import TaskBoard from '../pages/workspace/TaskBoard';

// The TaskBoard component handles all state management internally
<TaskBoard />
```

## Data Structure

Tasks follow this structure:
```typescript
interface Task {
  id: string;
  title: string;
  description: string;
  status: 'todo' | 'in-progress' | 'review' | 'done';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assignees: TaskAssignee[];
  project: TaskProject;
  tags: TaskTag[];
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: TaskAssignee;
  meetingContext?: {
    meetingId: string;
    meetingTitle: string;
    transcriptSnippet?: string;
    decisions?: string[];
    notes?: string[];
  };
  subtasks?: Task[];
  estimatedHours?: number;
  actualHours?: number;
  isOverdue?: boolean;
}
```

## Styling

The components use Tailwind CSS with dark mode support, following the existing Kairo design system:
- Consistent color palette
- Responsive breakpoints
- Dark/light theme toggle
- Hover and focus states
- Smooth transitions

## Accessibility

- Keyboard navigation support
- ARIA labels and roles
- Screen reader compatibility
- High contrast mode support
- Focus management

## Future Enhancements

- Real-time collaboration
- Bulk task operations
- Advanced reporting
- Integration with external tools (Trello, Jira, Google Calendar)
- Custom field support
- Time tracking integration
