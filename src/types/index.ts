export * from './mergeRequests';
export * from './velocity';
export * from './piPlanning';
export * from './jira';

// Merge Request Analytics Types
export interface MergeRequestsHeatmapOptions {
  groupId: string;
  startDate: string; // ISO date
  endDate: string;   // ISO date
}

export interface UserMergeRequestStats {
  username: string;
  name: string;
  commits: number;
  mergeRequests: number;
  approvals: number;
  comments: number;
}

export interface MergeRequestsHeatmapResult {
  users: UserMergeRequestStats[];
  totalMergeRequests: number;
  totalCommits: number;
  totalApprovals: number;
  totalComments: number;
}

// Velocity Analytics Types
export interface VelocitySummaryOptions {
  boardId: string;
  numSprints?: number;
  year?: number;
  sprintPrefix?: string;
}

export interface SprintVelocity {
  sprintId: number;
  sprintName: string;
  startDate: string;
  endDate: string;
  committed: number;
  completed: number;
  teamMembers: number;
  addedStoryPoints: number;
  efficiency: number;
}

export interface VelocitySummaryResult {
  sprints: SprintVelocity[];
  boardId: string;
  summary: string;
}

// PI Planning Analytics Types
export interface PiPlanningSummaryOptions {
  project: string;
  boardId: string;
  piStartDate: string;
  piEndDate: string;
}

export interface EpicAdvancedAnalytics {
  raid?: string;
  wsjf?: string;
  piScope?: string;
  progress?: string;
} 