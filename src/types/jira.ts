export interface JiraProject {
  id: string;
  key: string;
  name: string;
}

export interface JiraVersion {
  id: string;
  name: string;
  startDate?: string;
  releaseDate?: string;
  released?: boolean;
  overdue?: boolean;
}

export interface JiraSprint {
  id: number;
  name: string;
  state: string;
  startDate?: string;
  endDate?: string;
  completeDate?: string;
  originBoardId?: number;
}

export interface JiraIssue {
  id: string;
  key: string;
  fields: Record<string, any>;
}

export interface JiraEpic {
  id: number;
  name: string;
  summary?: string;
  done?: boolean;
} 