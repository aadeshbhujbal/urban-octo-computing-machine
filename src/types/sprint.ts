export interface SprintData {
  sprintId: number;
  sprintName: string;
  startDate: string;
  endDate: string;
  sprintObjective: string;
  sprintStatus: string;
  storyPoints: {
    committed: number;
    completed: number;
    added: number;
    total: number;
  };
  teamMembers: number;
  efficiency: number;
}

export interface SprintSummaryOptions {
  boardId: string;
  sprintIds?: number[];
  state?: string; // active, closed, future
  startDate?: string;
  endDate?: string;
} 