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