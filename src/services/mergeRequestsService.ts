import { Gitlab } from '@gitbeaker/node';
import { endOfDay, startOfDay } from 'date-fns';
import { MergeRequestsHeatmapOptions, UserMergeRequestStats, MergeRequestsHeatmapResult } from '../types/mergeRequests';

function safeKey(key: unknown): string {
  return typeof key === 'string' ? key : String(key);
}

export async function getMergeRequestsHeatmap(options: MergeRequestsHeatmapOptions): Promise<MergeRequestsHeatmapResult> {
  const { groupId, startDate, endDate } = options;
  const token = process.env.GITLAB_TOKEN;
  if (!token) throw new Error('GITLAB_TOKEN not set in environment');

  const api = new Gitlab({
    token,
    host: process.env.GITLAB_HOST || 'https://gitlab.com',
  });

  // Get all projects in the group
  const projects = await api.Groups.projects(groupId, { perPage: 100 });
  const userStats: { [username: string]: UserMergeRequestStats } = {};
  let totalMergeRequests = 0;
  let totalCommits = 0;
  let totalApprovals = 0;
  let totalComments = 0;

  for (const project of projects) {
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
      const name = typeof mr.author?.name === 'string' ? mr.author.name : username;
      if (!userStats[username]) {
        userStats[username] = { username, name, commits: 0, mergeRequests: 0, approvals: 0, comments: 0 };
      }
      userStats[username].mergeRequests++;
      // Commits in MR
      const commits = await api.MergeRequests.commits(project.id, mr.iid);
      userStats[username].commits += commits.length;
      totalCommits += commits.length;
      // Approvals
      try {
        const approvals = await api.MergeRequestApprovals.approvalState(project.id, mr.iid);
        if (approvals.approved_by && Array.isArray(approvals.approved_by)) {
          for (const approver of approvals.approved_by) {
            const approverUsername = safeKey(typeof approver.user?.username === 'string' ? approver.user.username : 'unknown');
            const approverName = typeof approver.user?.name === 'string' ? approver.user.name : approverUsername;
            if (!userStats[approverUsername]) {
              userStats[approverUsername] = { username: approverUsername, name: approverName, commits: 0, mergeRequests: 0, approvals: 0, comments: 0 };
            }
            userStats[approverUsername].approvals++;
            totalApprovals++;
          }
        }
      } catch {}
      // Comments
      const notes = await api.MergeRequestNotes.all(project.id, mr.iid);
      for (const note of notes) {
        if (note.author) {
          const noteUsername = safeKey(typeof note.author.username === 'string' ? note.author.username : 'unknown');
          const noteName = typeof note.author.name === 'string' ? note.author.name : noteUsername;
          if (!userStats[noteUsername]) {
            userStats[noteUsername] = { username: noteUsername, name: noteName, commits: 0, mergeRequests: 0, approvals: 0, comments: 0 };
          }
          userStats[noteUsername].comments++;
          totalComments++;
        }
      }
    }
  }

  return {
    users: Object.values(userStats),
    totalMergeRequests,
    totalCommits,
    totalApprovals,
    totalComments,
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
      const created_at = mr.created_at;
      const updated_at = mr.updated_at;
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
        project: project.name,
        approval_duration,
        last_commit_to_merge,
      });
    }
  }
  return analytics;
}

export {} 