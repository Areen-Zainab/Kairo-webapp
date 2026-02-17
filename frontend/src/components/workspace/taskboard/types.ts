export type TaskStatus = 'todo' | 'in-progress' | 'review' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskView = 'kanban' | 'list' | 'calendar';
export type TaskScope = 'global' | 'personal';

export interface TaskAssignee {
  id: string;
  name: string;
  email: string;
  avatar: string;
  profilePictureUrl?: string;
  role: 'admin' | 'manager' | 'member';
}

export interface TaskProject {
  id: string;
  name: string;
  color: string;
  description?: string;
}

export interface TaskTag {
  id: string;
  name: string;
  color: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignees: TaskAssignee[];
  assignee?: string; // Single assignee name for backend compatibility
  project?: TaskProject; // Optional - only present if task created from meeting action item
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

export interface TaskFilter {
  assignee?: string;
  priority?: TaskPriority;
  status?: TaskStatus;
  project?: string;
  tags?: string[];
  dueDate?: {
    start?: string;
    end?: string;
  };
  search?: string;
}

export interface TaskSort {
  field: 'dueDate' | 'createdAt' | 'priority' | 'title';
  direction: 'asc' | 'desc';
}

export interface KanbanColumn {
  id: TaskStatus;
  title: string;
  tasks: Task[];
  color: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  time?: string;
  task: Task;
  type: 'due' | 'created' | 'updated';
}

export interface TaskBoardState {
  tasks: Task[];
  filteredTasks: Task[];
  view: TaskView;
  scope: TaskScope;
  filters: TaskFilter;
  sort: TaskSort;
  selectedTask: Task | null;
  isLoading: boolean;
  error: string | null;
}
