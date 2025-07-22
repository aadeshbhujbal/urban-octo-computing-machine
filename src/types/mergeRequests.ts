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
  contributionScore?: number;  // Added from Python
  lastActiveDate?: string;     // Added from Python
}

export interface PushDetail {
  sha: string;
  message: string;
  date: string;
  project: string;
  branch?: string;            // Added from Python
  filesChanged?: number;      // Added from Python
  insertions?: number;        // Added from Python
  deletions?: number;         // Added from Python
}

// Contribution tracking
export type ContributionCount = number;
export type Username = string;
export type DateString = string;

export interface ContributionRecord {
  [username: Username]: ContributionCount;
}

export interface DailyContributions {
  [date: DateString]: ContributionRecord;
}

// Added from Python implementation
export interface MergeRequestDetail {
  id: string;
  title: string;
  state: string;
  created_at: string;
  updated_at: string;
  merged_at?: string;
  closed_at?: string;
  author: string;
  assignee?: string;
  reviewers: string[];
  labels: string[];
  branch: string;
  target_branch: string;
  approval_duration?: number;
  review_time?: number;
  last_commit_to_merge?: number;
  size?: number;
  complexity?: number;
}

export interface MergeRequestsHeatmapResult {
  users: UserMergeRequestStats[];
  totalMergeRequests: number;
  totalCommits: number;
  totalApprovals: number;
  totalComments: number;
  dailyContributions: DailyContributions;
  userPushDetails: Record<string, PushDetail[]>;
  // Added from Python implementation
  contributionTrends?: {
    daily: Record<DateString, number>;
    weekly: Record<DateString, number>;
    monthly: Record<DateString, number>;
  };
  teamMetrics?: {
    averageReviewTime: number;
    mergeSuccessRate: number;
    reviewParticipation: number;
    codeChurnRate: number;
  };
} 