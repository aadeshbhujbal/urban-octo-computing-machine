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

type GitlabInstance = InstanceType<typeof Gitlab>;

function safeKey(key: unknown): string {
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
  const avgReviewTime = reviewTimes.length > 0 ? reviewTimes.reduce((a, b) => a + b, 0) / reviewTimes.length : 0;
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

function isBot(username: string): boolean {
  const botKeywords = ['bot', 'security', 'system', 'pipeline', 'ci', 'auto'];
  return botKeywords.some(keyword => username.toLowerCase().includes(keyword));
}

function isMeaningfulComment(text: string): boolean {
  const meaninglessComments = [
    'thank you', 'thanks', 'lgtm', 'looks good', 'good', '+1',
    'approved', 'ship it', 'merge it', 'nice', 'ok', 'okay',
    'sounds good', 'sg', 'r+', '👍', 'thumbs up', 'approved'
  ];
  
  if (!text || text.trim().length < 5) {
    return false;
  }
  
  const textLower = text.toLowerCase().trim();
  
  // Check against meaningless comments
  if (meaninglessComments.some(phrase => 
    textLower === phrase || 
    textLower.startsWith(phrase + ' ') || 
    textLower.endsWith(' ' + phrase))) {
    return false;
  }
  
  // Check if it's just a short comment without specific content
  if (textLower.length < 15 && 
      !['bug', 'fix', 'issue', 'error', 'change', 'update']
        .some(keyword => textLower.includes(keyword))) {
    return false;
  }
  
  return true;
}

async function getContributionData(api: GitlabInstance, project: any, startDate: string, endDate: string): Promise<{
  contributions: DailyContributions;
  pushDetails: Record<string, PushDetail[]>;
}> {
  const contributions: DailyContributions = {};
  const pushDetails: Record<string, PushDetail[]> = {};

  // Get default branch
  const defaultBranch = project.default_branch || 'main';

  // Get all commits in date range
  const commits = await api.Commits.all(project.id, {
    since: startOfDay(new Date(startDate)).toISOString(),
    until: endOfDay(new Date(endDate)).toISOString(),
    ref_name: defaultBranch // Only count commits to default branch
  });

  for (const commit of commits) {
    if (!commit.author_name || isBot(commit.author_name)) continue;

    const date = format(new Date(commit.created_at), 'yyyy-MM-dd');
    const author = commit.author_name.toLowerCase();

    // Initialize contribution record if needed
    if (!contributions[date]) {
      contributions[date] = initializeContributionRecord();
    }
    contributions[date][author] = (contributions[date][author] || 0) + 1;

    // Get commit details including diff stats
    try {
      const commitDetails = await api.Commits.show(project.id, commit.id);
      const stats = commitDetails.stats as GitLabCommitStats;
      
      if (!pushDetails[author]) {
        pushDetails[author] = [];
      }
      pushDetails[author].push({
        sha: commit.id,
        message: commit.message,
        date: format(new Date(commit.created_at), 'yyyy-MM-dd\'T\'HH:mm:ss\'Z\''),
        project: project.name || 'unknown',
        branch: typeof commit.ref === 'string' ? commit.ref : undefined,
        filesChanged: stats?.files,
        insertions: stats?.additions,
        deletions: stats?.deletions
      });
    } catch (error) {
      console.error(`Error fetching commit details for ${commit.id}:`, error);
      if (!pushDetails[author]) {
        pushDetails[author] = [];
      }
      pushDetails[author].push({
        sha: commit.id,
        message: commit.message,
        date: format(new Date(commit.created_at), 'yyyy-MM-dd\'T\'HH:mm:ss\'Z\''),
        project: project.name || 'unknown'
      });
    }
  }

  return { contributions, pushDetails };
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
  const projects = await api.Groups.projects(groupId, { perPage: 100 });
  const userStats: Record<string, UserMergeRequestStats> = {};
  let totalMergeRequests = 0;
  let totalCommits = 0;
  let totalApprovals = 0;
  let totalComments = 0;

  // Track contributions by date
  const dailyContributions: DailyContributions = {};
  const userPushDetails: Record<string, PushDetail[]> = {};
  const mergeRequestDetails: MergeRequestDetail[] = [];

  for (const project of projects) {
    // Get contribution data
    const { contributions, pushDetails } = await getContributionData(api, project, startDate, endDate);
    
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
    for (const [user, details] of Object.entries(pushDetails)) {
      if (!userPushDetails[user]) {
        userPushDetails[user] = [];
      }
      userPushDetails[user].push(...details);
    }

    // Get all merge requests in the date range
    const mrs = await api.MergeRequests.all({
      projectId: project.id,
      createdAfter: startOfDay(new Date(startDate)).toISOString(),
      createdBefore: endOfDay(new Date(endDate)).toISOString(),
      perPage: 100,
    });
    totalMergeRequests += mrs.length;

    for (const mr of mrs) {
      const username = safeKey(typeof mr.author?.username === 'string' ? mr.author.username : 'unknown');
      const authorName = typeof mr.author?.name === 'string' ? mr.author.name : username;
      const name = userMapping.get(username.toLowerCase()) || authorName;
      
      if (!userStats[username]) {
        userStats[username] = {
          username,
          name: String(name), // Ensure string type
          commits: 0,
          mergeRequests: 0,
          approvals: 0,
          comments: 0,
          lastActiveDate: format(new Date(mr.created_at), 'yyyy-MM-dd')
        };
      }
      userStats[username].mergeRequests++;

      // Update last active date if this MR is more recent
      const mrDate = new Date(mr.created_at);
      const lastActive = new Date(userStats[username].lastActiveDate!);
      if (mrDate > lastActive) {
        userStats[username].lastActiveDate = format(mrDate, 'yyyy-MM-dd');
      }

      // Commits in MR
      const commits = await api.MergeRequests.commits(project.id, mr.iid);
      userStats[username].commits += commits.length;
      totalCommits += commits.length;

      // Get MR details including diff stats
      try {
        const mrDetails = await api.MergeRequests.show(project.id, mr.iid) as GitLabMRDetails;
        const reviewers = (mrDetails.reviewers || []).map(r => r.username).filter((u): u is string => typeof u === 'string');
        const labels = (mrDetails.labels || []).filter((l): l is string => typeof l === 'string');
        
        let reviewTime = undefined;
        if (mrDetails.merged_at) {
          reviewTime = (new Date(mrDetails.merged_at).getTime() - new Date(mr.created_at).getTime()) / (1000 * 60 * 60);
        }

        mergeRequestDetails.push({
          id: mr.iid.toString(),
          title: mr.title || '',
          state: mr.state || 'unknown',
          created_at: format(new Date(mr.created_at), 'yyyy-MM-dd\'T\'HH:mm:ss\'Z\''),
          updated_at: format(new Date(mr.updated_at), 'yyyy-MM-dd\'T\'HH:mm:ss\'Z\''),
          merged_at: mr.merged_at ? format(new Date(mr.merged_at), 'yyyy-MM-dd\'T\'HH:mm:ss\'Z\'') : undefined,
          closed_at: mr.closed_at ? format(new Date(mr.closed_at), 'yyyy-MM-dd\'T\'HH:mm:ss\'Z\'') : undefined,
          author: String(name), // Ensure string type
          assignee: typeof mr.assignee?.username === 'string' ? mr.assignee.username : undefined,
          reviewers,
          labels,
          branch: typeof mr.source_branch === 'string' ? mr.source_branch : 'unknown',
          target_branch: typeof mr.target_branch === 'string' ? mr.target_branch : 'main',
          approval_duration: mr.merged_at ? (new Date(mr.merged_at).getTime() - new Date(mr.created_at).getTime()) / (1000 * 60 * 60) : undefined,
          review_time: reviewTime,
          size: typeof mrDetails.changes_count === 'number' ? mrDetails.changes_count : undefined,
          complexity: typeof mrDetails.changes_count === 'number' ? Math.log2(mrDetails.changes_count) : undefined
        });
      } catch (error) {
        console.error(`Error fetching MR details for ${mr.iid}:`, error);
      }

      // Approvals
      try {
        const approvals = await api.MergeRequestApprovals.approvalState(project.id, mr.iid);
        if (approvals.approved_by && Array.isArray(approvals.approved_by)) {
          for (const approver of approvals.approved_by) {
            const approverUsername = safeKey(typeof approver.user?.username === 'string' ? approver.user.username : 'unknown');
            const approverDisplayName = typeof approver.user?.name === 'string' ? approver.user.name : approverUsername;
            const approverName = userMapping.get(approverUsername.toLowerCase()) || approverDisplayName;
            if (!userStats[approverUsername]) {
              userStats[approverUsername] = {
                username: approverUsername,
                name: String(approverName),
                commits: 0,
                mergeRequests: 0,
                approvals: 0,
                comments: 0,
                lastActiveDate: format(new Date(), 'yyyy-MM-dd')
              };
            }
            userStats[approverUsername].approvals++;
            totalApprovals++;
          }
        }
      } catch {}

      // Comments
      const notes = await api.MergeRequestNotes.all(project.id, mr.iid);
      for (const note of notes) {
        if (note.author && !note.system && !isBot(note.author.username)) {
          // Only count meaningful comments
          if (!isMeaningfulComment(note.body)) {
            continue;
          }

          const noteUsername = safeKey(typeof note.author.username === 'string' ? note.author.username : 'unknown');
          const noteDisplayName = typeof note.author.name === 'string' ? note.author.name : noteUsername;
          const noteName = userMapping.get(noteUsername.toLowerCase()) || noteDisplayName;
          if (!userStats[noteUsername]) {
            userStats[noteUsername] = {
              username: noteUsername,
              name: String(noteName),
              commits: 0,
              mergeRequests: 0,
              approvals: 0,
              comments: 0,
              lastActiveDate: format(new Date(note.created_at), 'yyyy-MM-dd')
            };
          }
          userStats[noteUsername].comments++;
          totalComments++;

          // Update last active date if this comment is more recent
          const noteDate = new Date(note.created_at);
          const lastActive = new Date(userStats[noteUsername].lastActiveDate!);
          if (noteDate > lastActive) {
            userStats[noteUsername].lastActiveDate = format(noteDate, 'yyyy-MM-dd');
          }
        }
      }
    }
  }

  // Calculate contribution scores
  for (const stats of Object.values(userStats)) {
    stats.contributionScore = calculateContributionScore(stats);
  }

  // Calculate contribution trends
  const contributionTrends = calculateContributionTrends(dailyContributions);

  // Calculate team metrics
  const teamMetrics = calculateTeamMetrics(mergeRequestDetails);

  return {
    users: Object.values(userStats),
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

export async function getMergeRequestsAnalytics(options: MergeRequestsHeatmapOptions): Promise<any[]> {
  const { groupId, startDate, endDate } = options;
  const token = process.env.GITLAB_TOKEN;
  if (!token) throw new Error('GITLAB_TOKEN not set in environment');

  const api = new Gitlab({
    token,
    host: process.env.GITLAB_HOST || 'https://gitlab.com',
  });

  // Get all projects in the group
  const projects = await api.Groups.projects(groupId, { perPage: 100 });
  const analytics: any[] = [];

  for (const project of projects) {
    // Get all merge requests in the date range
    const mrs = await api.MergeRequests.all({
      projectId: project.id,
      createdAfter: startOfDay(new Date(startDate)).toISOString(),
      createdBefore: endOfDay(new Date(endDate)).toISOString(),
      perPage: 100,
    });
    for (const mr of mrs) {
      const author = (mr.author && typeof mr.author.name === 'string') ? mr.author.name : 'Unknown';
      const created_at = format(new Date(mr.created_at), 'yyyy-MM-dd\'T\'HH:mm:ss\'Z\'');
      const updated_at = format(new Date(mr.updated_at), 'yyyy-MM-dd\'T\'HH:mm:ss\'Z\'');
      let approval_duration = null;
      if (mr.state === 'merged' && mr.merged_at) {
        approval_duration = (new Date(mr.merged_at).getTime() - new Date(mr.created_at).getTime()) / (1000 * 60 * 60); // hours
      }
      // Commits
      let last_commit_to_merge = null;
      try {
        const commits = await api.MergeRequests.commits(project.id, mr.iid);
        if (commits && commits.length > 0) {
          const last_commit_date = new Date(commits[0].created_at);
          last_commit_to_merge = (new Date(updated_at).getTime() - last_commit_date.getTime()) / (1000 * 60 * 60); // hours
        }
      } catch {}
      analytics.push({
        id: mr.iid,
        status: mr.state,
        title: mr.title,
        author,
        created_at,
        updated_at,
        project: project.name || 'unknown',
        approval_duration,
        last_commit_to_merge,
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
  } catch (error: any) {
    return { status: 'error', message: error.message };
  }
} 