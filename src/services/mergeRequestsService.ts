import { Gitlab } from '@gitbeaker/node';
import { endOfDay, startOfDay, format, subDays, getWeek, getMonth } from 'date-fns';
import { 
  MergeRequestsHeatmapOptions, 
  UserMergeRequestStats, 
  MergeRequestsHeatmapResult, 
  PushDetail,
  DailyContributions,
  ContributionRecord,
  DateString,
  MergeRequestDetail
} from '../types/mergeRequests';
import { normalize as normalizeString } from 'path';
import { fetchWithProxy } from '../utils/fetchWithProxy';

type GitlabInstance = InstanceType<typeof Gitlab>;

function sanitizeKey(key: unknown): string {
  return typeof key === 'string' ? key : String(key);
}

async function getUserMapping(api: GitlabInstance, groupId: string): Promise<Map<string, string>> {
  const mapping = new Map<string, string>();
  const members = await api.GroupMembers.all(groupId);
  
  for (const member of members) {
    if (member.name && member.username) {
      mapping.set(member.username.toLowerCase(), member.name);
    }
  }
  
  return mapping;
}

function calculateContributionScore(stats: UserMergeRequestStats): number {
  return (
    stats.commits * 2 +      // Each commit worth 2 points
    stats.mergeRequests * 3 + // Each MR worth 3 points
    stats.approvals * 1 +     // Each approval worth 1 point
    stats.comments * 0.5      // Each comment worth 0.5 points
  );
}

function calculateTeamMetrics(mrs: MergeRequestDetail[]): {
  averageReviewTime: number;
  mergeSuccessRate: number;
  reviewParticipation: number;
  codeChurnRate: number;
} {
  const totalMRs = mrs.length;
  if (totalMRs === 0) {
    return {
      averageReviewTime: 0,
      mergeSuccessRate: 0,
      reviewParticipation: 0,
      codeChurnRate: 0
    };
  }

  const mergedMRs = mrs.filter(mr => mr.state === 'merged').length;
  const reviewTimes = mrs.filter(mr => mr.review_time !== undefined).map(mr => mr.review_time!);
  const avgReviewTime = reviewTimes.length > 0 ? reviewTimes.reduce((timeA, timeB) => timeA + timeB, 0) / reviewTimes.length : 0;
  const participationRate = mrs.filter(mr => mr.reviewers.length > 0).length / totalMRs;
  
  // Code churn rate: (insertions + deletions) / number of MRs
  const totalChurn = mrs.reduce((sum, mr) => sum + (mr.size || 0), 0);
  const churnRate = totalChurn / totalMRs;

  return {
    averageReviewTime: avgReviewTime,
    mergeSuccessRate: (mergedMRs / totalMRs) * 100,
    reviewParticipation: participationRate * 100,
    codeChurnRate: churnRate
  };
}

function calculateContributionTrends(contributions: DailyContributions): {
  daily: Record<DateString, number>;
  weekly: Record<DateString, number>;
  monthly: Record<DateString, number>;
} {
  const daily: Record<DateString, number> = {};
  const weekly: Record<DateString, number> = {};
  const monthly: Record<DateString, number> = {};

  // Sort dates and process each day
  const dates = Object.keys(contributions).sort();
  for (const date of dates) {
    const dayTotal = Object.values(contributions[date]).reduce((sum, count) => sum + count, 0);
    daily[date] = dayTotal;

    const dateObj = new Date(date);
    const weekKey = `${dateObj.getFullYear()}-W${getWeek(dateObj)}`;
    const monthKey = `${dateObj.getFullYear()}-${getMonth(dateObj) + 1}`;

    weekly[weekKey] = (weekly[weekKey] || 0) + dayTotal;
    monthly[monthKey] = (monthly[monthKey] || 0) + dayTotal;
  }

  return { daily, weekly, monthly };
}

// Add interface for GitLab commit stats
interface GitLabCommitStats {
  additions: number;
  deletions: number;
  total: number;
  files?: number;
}

// Add interface for GitLab MR details
interface GitLabMRDetails {
  changes_count?: number;
  reviewers?: Array<{ username: string }>;
  labels?: string[];
  merged_at?: string;
}

function initializeContributionRecord(): ContributionRecord {
  return Object.create(null) as ContributionRecord;
}

// Add helper functions for name matching
function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function getNameParts(name: string): string[] {
  return name.toLowerCase().split(/\W+/).filter(Boolean);
}

function findClosestName(name: string, nameList: string[], threshold = 80): string | undefined {
  const normalizedName = normalizeName(name);
  const nameParts = getNameParts(name);
  
  let bestMatch: string | undefined;
  let bestScore = 0;
  
  for (const fullName of nameList) {
    const normalizedFullName = normalizeName(fullName);
    const fullNameParts = getNameParts(fullName);
    
    // Exact match after normalization
    if (normalizedName === normalizedFullName) {
      return fullName;
    }
    
    // All parts match
    if (nameParts.every(part => fullNameParts.includes(part)) || 
        fullNameParts.every(part => nameParts.includes(part))) {
      return fullName;
    }
    
    // Substring match
    if (normalizedName.includes(normalizedFullName) || normalizedFullName.includes(normalizedName)) {
      const score = calculateLevenshteinDistance(normalizedName, normalizedFullName);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = fullName;
      }
    }
  }
  
  // If no match found yet, try Levenshtein distance
  if (!bestMatch) {
    for (const fullName of nameList) {
      const score = calculateLevenshteinDistance(normalizedName, normalizeName(fullName));
      if (score > bestScore) {
        bestScore = score;
        bestMatch = fullName;
      }
    }
  }
  
  return bestScore >= threshold ? bestMatch : undefined;
}

function calculateLevenshteinDistance(s1: string, s2: string): number {
  const track = Array(s2.length + 1).fill(null).map(() =>
    Array(s1.length + 1).fill(null));
  
  for (let i = 0; i <= s1.length; i += 1) {
    track[0][i] = i;
  }
  for (let j = 0; j <= s2.length; j += 1) {
    track[j][0] = j;
  }
  
  for (let j = 1; j <= s2.length; j += 1) {
    for (let i = 1; i <= s1.length; i += 1) {
      const indicator = s1[i - 1] === s2[j - 1] ? 0 : 1;
      track[j][i] = Math.min(
        track[j][i - 1] + 1, // deletion
        track[j - 1][i] + 1, // insertion
        track[j - 1][i - 1] + indicator // substitution
      );
    }
  }
  
  const maxLength = Math.max(s1.length, s2.length);
  const distance = track[s2.length][s1.length];
  return ((maxLength - distance) / maxLength) * 100;
}

/**
 * Check if username is a bot (Python equivalent)
 * Python: def is_bot(username):
 */
function isBot(username: string): boolean {
  const botKeywords = ['bot', 'security', 'system', 'pipeline', 'ci', 'auto'];
  return botKeywords.some(keyword => username.toLowerCase().includes(keyword));
}

/**
 * Get default branch for a project (Python equivalent)
 * Python: def get_default_branch(project):
 */
function getDefaultBranch(project: any): string {
  return project.default_branch || 'main';
}

/**
 * Check if comment is meaningful (Python equivalent)
 * Python: def is_meaningful_comment(text):
 */
function isMeaningfulComment(text: string): boolean {
  if (!text || text.trim().length < 5) {
    return false;
  }
  
  const textLower = text.toLowerCase().trim();
  
  // Define meaningless comments to filter out
  const meaninglessComments = [
    "thank you", "thanks", "lgtm", "looks good", "good", "+1", 
    "approved", "ship it", "merge it", "nice", "ok", "okay", 
    "sounds good", "sg", "r+", "👍", "thumbs up", "approved"
  ];
  
  // Check against our list of meaningless comments
  for (const phrase of meaninglessComments) {
    if (textLower === phrase || 
        textLower.startsWith(phrase + " ") || 
        textLower.endsWith(" " + phrase)) {
      return false;
    }
  }
  
  // Check if it's just a short comment (less than 15 chars) without specific content
  if (textLower.length < 15 && 
      !["bug", "fix", "issue", "error", "change", "update"].some(keyword => textLower.includes(keyword))) {
    return false;
  }
  
  return true;
}

interface GitLabProject {
  id: number;
  name?: string;
  default_branch?: string;
}

/**
 * Get contribution data (Python equivalent)
 * Python: def get_contribution_data(gl, group_id, start_date, end_date, user_mapping):
 */
export async function getContributionData(
  api: GitlabInstance,
  groupId: string,
  startDate: string,
  endDate: string,
  userMapping: Map<string, string>
): Promise<{
  contributions: Record<string, { pushes: number; mergeRequests: number }>;
  userPushes: Record<string, number>;
  userMergeRequests: Record<string, number>;
  userPushDetails: Record<string, PushDetail[]>;
}> {
  const group = await api.Groups.show(groupId);
  const groupProjects = await api.Groups.projects(groupId);
  
  const contributions: Record<string, { pushes: number; mergeRequests: number }> = {};
  const userPushes: Record<string, number> = {};
  const userMergeRequests: Record<string, number> = {};
  const userPushDetails: Record<string, PushDetail[]> = {};
  
  for (const groupProject of groupProjects) {
    const project = await api.Projects.show(groupProject.id);
    const defaultBranch = getDefaultBranch(project);
    
    // Fetch push events (GitLab API doesn't have direct events endpoint, so we'll use commits)
    try {
      const commits = await api.Commits.all(project.id, {
        since: startDate,
        until: endDate,
        ref_name: defaultBranch
      });
      
      for (const commit of commits) {
        const commitDate = new Date(commit.created_at);
        const dateStr = commitDate.toISOString().split('T')[0];
        
        if (!contributions[dateStr]) {
          contributions[dateStr] = { pushes: 0, mergeRequests: 0 };
        }
        
        contributions[dateStr].pushes++;
        
        const authorName = userMapping.get((commit.author_name as string)?.toLowerCase() || '') || (commit.author_name as string) || 'Unknown';
        userPushes[authorName] = (userPushes[authorName] || 0) + 1;
        
        if (!userPushDetails[authorName]) {
          userPushDetails[authorName] = [];
        }
        
        userPushDetails[authorName].push({
          sha: commit.id,
          message: commit.message || '',
          date: format(new Date(commit.created_at), 'yyyy-MM-dd\'T\'HH:mm:ss\'Z\''),
          project: project.name || 'unknown',
          branch: defaultBranch,
          filesChanged: undefined,
          insertions: undefined,
          deletions: undefined
        });
      }
    } catch (error) {
      console.error(`Error fetching commits for project ${project.id}:`, error);
    }
    
    // Fetch merge requests
    try {
      const mergeRequests = await api.MergeRequests.all({
        projectId: project.id,
        createdAfter: startOfDay(new Date(startDate)).toISOString(),
        createdBefore: endOfDay(new Date(endDate)).toISOString(),
        perPage: 100,
      });
      
      for (const mr of mergeRequests) {
        const mrDate = new Date(mr.created_at);
        const dateStr = mrDate.toISOString().split('T')[0];
        
        if (!contributions[dateStr]) {
          contributions[dateStr] = { pushes: 0, mergeRequests: 0 };
        }
        
        contributions[dateStr].mergeRequests++;
        
        const authorName = userMapping.get((mr.author as any)?.username?.toLowerCase() || '') || (mr.author as any)?.name || 'Unknown';
        userMergeRequests[authorName] = (userMergeRequests[authorName] || 0) + 1;
      }
    } catch (error) {
      console.error(`Error fetching merge requests for project ${project.id}:`, error);
    }
  }
  
  return { contributions, userPushes, userMergeRequests, userPushDetails };
}

export async function getMergeRequestsHeatmap(options: MergeRequestsHeatmapOptions): Promise<MergeRequestsHeatmapResult> {
  const { groupId, startDate, endDate } = options;
  const token = process.env.GITLAB_TOKEN;
  if (!token) throw new Error('GITLAB_TOKEN not set in environment');

  const api = new Gitlab({
    token,
    host: process.env.GITLAB_HOST || 'https://gitlab.com',
  });

  // Get user mapping first
  const userMapping = await getUserMapping(api, groupId);

  // Get all projects in the group
  const groupProjects = await api.Groups.projects(groupId, { perPage: 100 });
  const userStatistics: Record<string, UserMergeRequestStats> = {};
  let totalMergeRequests = 0;
  let totalCommits = 0;
  let totalApprovals = 0;
  let totalComments = 0;

  // Track contributions by date
  const dailyContributions: DailyContributions = {};
  const userPushDetails: Record<string, PushDetail[]> = {};
  const mergeRequestDetails: MergeRequestDetail[] = [];

  for (const project of groupProjects) {
    // Get contribution data
    const { contributions, userPushDetails: contributionUserPushDetails } = await getContributionData(api, groupId, startDate, endDate, userMapping);
    
    // Merge contribution data
    for (const [date, users] of Object.entries(contributions)) {
      if (!dailyContributions[date]) {
        dailyContributions[date] = initializeContributionRecord();
      }
      for (const [user, count] of Object.entries(users)) {
        dailyContributions[date][user] = (dailyContributions[date][user] || 0) + count;
      }
    }

    // Merge push details
    for (const [user, details] of Object.entries(contributionUserPushDetails)) {
      if (!userPushDetails[user]) {
        userPushDetails[user] = [];
      }
      userPushDetails[user].push(...details);
    }

    // Get all merge requests in the date range
    const mergeRequests = await api.MergeRequests.all({
      projectId: project.id,
      createdAfter: startOfDay(new Date(startDate)).toISOString(),
      createdBefore: endOfDay(new Date(endDate)).toISOString(),
      perPage: 100,
    });
    totalMergeRequests += mergeRequests.length;

    for (const mergeRequest of mergeRequests) {
      const username = sanitizeKey(typeof mergeRequest.author?.username === 'string' ? mergeRequest.author.username : 'unknown');
      const authorName = typeof mergeRequest.author?.name === 'string' ? mergeRequest.author.name : username;
      const name = userMapping.get(username.toLowerCase()) || authorName;
      
      if (!userStatistics[username]) {
        userStatistics[username] = {
          username,
          name: String(name), // Ensure string type
          commits: 0,
          mergeRequests: 0,
          approvals: 0,
          comments: 0,
          lastActiveDate: format(new Date(mergeRequest.created_at), 'yyyy-MM-dd')
        };
      }
      userStatistics[username].mergeRequests++;

      // Update last active date if this MR is more recent
      const mergeRequestDate = new Date(mergeRequest.created_at);
      const lastActive = new Date(userStatistics[username].lastActiveDate!);
      if (mergeRequestDate > lastActive) {
        userStatistics[username].lastActiveDate = format(mergeRequestDate, 'yyyy-MM-dd');
      }

      // Commits in MR
      const commits = await api.MergeRequests.commits(project.id, mergeRequest.iid);
      userStatistics[username].commits += commits.length;
      totalCommits += commits.length;

      // Get MR details including diff stats
      try {
        const mergeRequestDetailData = await api.MergeRequests.show(project.id, mergeRequest.iid) as GitLabMRDetails;
        const reviewers = (mergeRequestDetailData.reviewers || []).map(reviewer => reviewer.username).filter((username): username is string => typeof username === 'string');
        const labels = (mergeRequestDetailData.labels || []).filter((label): label is string => typeof label === 'string');
        
        let reviewTime = undefined;
        if (mergeRequestDetailData.merged_at) {
          reviewTime = (new Date(mergeRequestDetailData.merged_at).getTime() - new Date(mergeRequest.created_at).getTime()) / (1000 * 60 * 60);
        }

        mergeRequestDetails.push({
          id: mergeRequest.iid.toString(),
          title: mergeRequest.title || '',
          state: mergeRequest.state || 'unknown',
          created_at: format(new Date(mergeRequest.created_at), 'yyyy-MM-dd\'T\'HH:mm:ss\'Z\''),
          updated_at: format(new Date(mergeRequest.updated_at), 'yyyy-MM-dd\'T\'HH:mm:ss\'Z\''),
          merged_at: mergeRequest.merged_at ? format(new Date(mergeRequest.merged_at), 'yyyy-MM-dd\'T\'HH:mm:ss\'Z\'') : undefined,
          closed_at: mergeRequest.closed_at ? format(new Date(mergeRequest.closed_at), 'yyyy-MM-dd\'T\'HH:mm:ss\'Z\'') : undefined,
          author: String(name), // Ensure string type
          assignee: typeof mergeRequest.assignee?.username === 'string' ? mergeRequest.assignee.username : undefined,
          reviewers,
          labels,
          branch: typeof mergeRequest.source_branch === 'string' ? mergeRequest.source_branch : 'unknown',
          target_branch: typeof mergeRequest.target_branch === 'string' ? mergeRequest.target_branch : 'main',
          approval_duration: mergeRequest.merged_at ? (new Date(mergeRequest.merged_at).getTime() - new Date(mergeRequest.created_at).getTime()) / (1000 * 60 * 60) : undefined,
          review_time: reviewTime,
          size: typeof mergeRequestDetailData.changes_count === 'number' ? mergeRequestDetailData.changes_count : undefined,
          complexity: typeof mergeRequestDetailData.changes_count === 'number' ? Math.log2(mergeRequestDetailData.changes_count) : undefined
        });
      } catch (error) {
        console.error(`Error fetching MR details for ${mergeRequest.iid}:`, error);
      }

      // Approvals
      try {
        const approvals = await api.MergeRequestApprovals.approvalState(project.id, mergeRequest.iid);
        if (approvals.approved_by && Array.isArray(approvals.approved_by)) {
          for (const approver of approvals.approved_by) {
            const approverUsername = sanitizeKey(typeof approver.user?.username === 'string' ? approver.user.username : 'unknown');
            const approverDisplayName = typeof approver.user?.name === 'string' ? approver.user.name : approverUsername;
            const approverName = userMapping.get(approverUsername.toLowerCase()) || approverDisplayName;
            if (!userStatistics[approverUsername]) {
              userStatistics[approverUsername] = {
                username: approverUsername,
                name: String(approverName),
                commits: 0,
                mergeRequests: 0,
                approvals: 0,
                comments: 0,
                lastActiveDate: format(new Date(), 'yyyy-MM-dd')
              };
            }
            userStatistics[approverUsername].approvals++;
            totalApprovals++;
          }
        }
      } catch {}

      // Comments
      const notes = await api.MergeRequestNotes.all(project.id, mergeRequest.iid);
      for (const note of notes) {
        if (note.author && !note.system && !isBot(note.author.username)) {
          // Only count meaningful comments
          if (!isMeaningfulComment(note.body)) {
            continue;
          }

          const noteUsername = sanitizeKey(typeof note.author.username === 'string' ? note.author.username : 'unknown');
          const noteDisplayName = typeof note.author.name === 'string' ? note.author.name : noteUsername;
          const noteName = userMapping.get(noteUsername.toLowerCase()) || noteDisplayName;
          if (!userStatistics[noteUsername]) {
            userStatistics[noteUsername] = {
              username: noteUsername,
              name: String(noteName),
              commits: 0,
              mergeRequests: 0,
              approvals: 0,
              comments: 0,
              lastActiveDate: format(new Date(note.created_at), 'yyyy-MM-dd')
            };
          }
          userStatistics[noteUsername].comments++;
          totalComments++;

          // Update last active date if this comment is more recent
          const noteDate = new Date(note.created_at);
          const lastActive = new Date(userStatistics[noteUsername].lastActiveDate!);
          if (noteDate > lastActive) {
            userStatistics[noteUsername].lastActiveDate = format(noteDate, 'yyyy-MM-dd');
        }
      }
    }
  }
  }

  // Calculate contribution scores
  for (const userStat of Object.values(userStatistics)) {
    userStat.contributionScore = calculateContributionScore(userStat);
  }

  // Calculate contribution trends
  const contributionTrends = calculateContributionTrends(dailyContributions);

  // Calculate team metrics
  const teamMetrics = calculateTeamMetrics(mergeRequestDetails);

  return {
    users: Object.values(userStatistics),
    totalMergeRequests,
    totalCommits,
    totalApprovals,
    totalComments,
    dailyContributions,
    userPushDetails,
    contributionTrends,
    teamMetrics
  };
}

// Add enum for MR status
export enum MergeRequestStatus {
  Opened = 'opened',
  Closed = 'closed',
  Merged = 'merged',
  Locked = 'locked',
}

export interface MergeRequestAnalytics {
  id: number;
  status: MergeRequestStatus;
  title: string;
  author: string;
  created_at: string;
  updated_at: string;
  project: string;
  approval_duration: number | null;
  last_commit_to_merge: number | null;
}

export async function getMergeRequestsAnalytics(options: MergeRequestsHeatmapOptions): Promise<MergeRequestAnalytics[]> {
  const { groupId, startDate, endDate } = options;
  const token = process.env.GITLAB_TOKEN;
  if (!token) throw new Error('GITLAB_TOKEN not set in environment');

  const api = new Gitlab({
    token,
    host: process.env.GITLAB_HOST || 'https://gitlab.com',
  });

  // Get all projects in the group
  const groupProjects = await api.Groups.projects(groupId, { perPage: 100 });
  const analytics: MergeRequestAnalytics[] = [];

  for (const project of groupProjects) {
    // Get all merge requests in the date range
    const mergeRequests = await api.MergeRequests.all({
      projectId: project.id,
      createdAfter: startOfDay(new Date(startDate)).toISOString(),
      createdBefore: endOfDay(new Date(endDate)).toISOString(),
      perPage: 100,
    });
    for (const mergeRequest of mergeRequests) {
      const author = (mergeRequest.author && typeof mergeRequest.author.name === 'string') ? mergeRequest.author.name : 'Unknown';
      const createdAt = format(new Date(mergeRequest.created_at), 'yyyy-MM-dd\'T\'HH:mm:ss\'Z\'');
      const updatedAt = format(new Date(mergeRequest.updated_at), 'yyyy-MM-dd\'T\'HH:mm:ss\'Z\'');
      let approvalDuration: number | null = null;
      if (mergeRequest.state === MergeRequestStatus.Merged && mergeRequest.merged_at) {
        approvalDuration = (new Date(mergeRequest.merged_at).getTime() - new Date(mergeRequest.created_at).getTime()) / (1000 * 60 * 60); // hours
      }
      // Commits
      let lastCommitToMerge: number | null = null;
      try {
        const commits = await api.MergeRequests.commits(project.id, mergeRequest.iid);
        if (commits && commits.length > 0) {
          const lastCommitDate = new Date(commits[0].created_at);
          lastCommitToMerge = (new Date(updatedAt).getTime() - lastCommitDate.getTime()) / (1000 * 60 * 60); // hours
        }
      } catch {}
      analytics.push({
        id: mergeRequest.iid,
        status: mergeRequest.state as MergeRequestStatus,
        title: mergeRequest.title,
        author,
        created_at: createdAt,
        updated_at: updatedAt,
        project: project.name || 'unknown',
        approval_duration: approvalDuration,
        last_commit_to_merge: lastCommitToMerge,
      });
    }
  }
  return analytics;
}

export async function testGitlabConnection(): Promise<{ status: string; message: string }> {
  const token = process.env.GITLAB_TOKEN;
  const host = process.env.GITLAB_HOST || 'https://gitlab.com';
  if (!token) return { status: 'error', message: 'Missing GitLab token' };
  try {
    const api = new Gitlab({ token, host });
    // Ping the /user endpoint
    await api.Users.current();
    return { status: 'success', message: 'Connected to GitLab successfully' };
  } catch (error: unknown) {
    if (error instanceof Error) {
      return { status: 'error', message: error.message };
    } else {
      return { status: 'error', message: 'Unknown error occurred' };
    }
  }
}

/**
 * Get unique members for a sprint (Python equivalent)
 * Python: def get_unique_members(self, board_id, sprint_id):
 */
export async function getUniqueMembers(boardId: string, sprintId: number): Promise<Array<{ name: string; email: string }>> {
  try {
    const credentials = {
      url: process.env.JIRA_URL!,
      user: process.env.JIRA_USER!,
      token: process.env.JIRA_TOKEN!
    };

    const response = await fetchWithProxy(`${credentials.url}/rest/agile/1.0/board/${boardId}/sprint/${sprintId}/issue`, {
      auth: { username: credentials.user, password: credentials.token },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch sprint issues: ${response.status}`);
    }

    const data = await response.json() as { issues: Array<{ fields: { assignee?: { displayName: string; emailAddress: string }; labels?: string[] } }> };
    
    const memberIssues = new Map<string, { details: { name: string; email: string } | null; hasCommitRequired: boolean }>();

    for (const issue of data.issues) {
      const assignee = issue.fields.assignee;
      if (assignee) {
        const email = assignee.emailAddress;
        const hasCommitRequired = !issue.fields.labels?.includes('no_commit_required');
        
        memberIssues.set(email, {
          details: { name: assignee.displayName, email },
          hasCommitRequired
        });
      }
    }

    const validMembers = Array.from(memberIssues.values())
      .filter(member => member.hasCommitRequired && member.details)
      .map(member => member.details!)
      .sort((a, b) => a.name.localeCompare(b.name));

    return validMembers;
  } catch (error) {
    console.error(`Error getting unique members for sprint ${sprintId}:`, error);
    return [];
  }
}

/**
 * Process merge request (Python equivalent)
 * Python: def process_merge_request(args):
 */
export async function processMergeRequest(
  api: GitlabInstance,
  projectId: number,
  mergeRequestId: number,
  sprintStart: Date,
  sprintEnd: Date,
  projectCache: Map<number, string>
): Promise<{
  id: number;
  status: string;
  title: string;
  author: string;
  created_at: Date;
  updated_at: Date;
  project: string;
  approvers: string;
  source_branch: string;
  target_branch: string;
  approval_duration: number | null;
  last_commit_date: Date | null;
  last_commit_to_merge: number | null;
} | null> {
  try {
    const project = await api.Projects.show(projectId);
    const mr = await api.MergeRequests.show(projectId, mergeRequestId);

    const created_at = new Date(mr.created_at);
    if (!(sprintStart <= created_at && created_at <= sprintEnd)) {
      console.log(`Skipping MR ${mr.iid}: Created at ${created_at}, outside of sprint range`);
      return null;
    }

    const updated_at = new Date(mr.updated_at);
    
    // Handle cases where author information might be missing
    let author_name = "Unknown";
    if (mr.author) {
      if (typeof mr.author === 'object' && 'name' in mr.author) {
        author_name = (mr.author as any).name;
      } else if (typeof mr.author === 'object' && 'displayName' in mr.author) {
        author_name = (mr.author as any).displayName;
      }
    }

    let approval_duration: number | null = null;
    if (mr.state === 'merged' && mr.merged_at) {
      const merged_at = new Date(mr.merged_at);
      approval_duration = (merged_at.getTime() - created_at.getTime()) / (1000 * 60 * 60);
    }

    const commits = await api.MergeRequests.commits(projectId, mergeRequestId);
    let last_commit_date: Date | null = null;
    let last_commit_to_merge: number | null = null;
    
    if (commits && commits.length > 0) {
      last_commit_date = new Date(commits[0].created_at);
      last_commit_to_merge = (updated_at.getTime() - last_commit_date.getTime()) / (1000 * 60 * 60);
    }

    const project_name = projectCache.get(projectId) || project.name;
    if (!projectCache.has(projectId)) {
      projectCache.set(projectId, project_name);
    }

    // Get approvers
    let approvers = '';
    try {
      const approvalState = await api.MergeRequestApprovals.approvalState(projectId, mergeRequestId);
      if (approvalState.approved_by && Array.isArray(approvalState.approved_by)) {
        approvers = approvalState.approved_by
          .map((approver: any) => approver.user?.name || approver.user?.displayName || 'Unknown')
          .join(', ');
      }
    } catch (error) {
      console.error(`Error fetching approvers for MR ${mergeRequestId}:`, error);
    }

    return {
      id: mr.iid,
      status: mr.state,
      title: mr.title,
      author: author_name,
      created_at,
      updated_at,
      project: project_name,
      approvers,
      source_branch: mr.source_branch,
      target_branch: mr.target_branch,
      approval_duration,
      last_commit_date,
      last_commit_to_merge
    };
  } catch (error) {
    console.error(`Error processing merge request ${mergeRequestId}:`, error);
    return null;
  }
}

// Dashboard data creation removed - should be handled by frontend