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