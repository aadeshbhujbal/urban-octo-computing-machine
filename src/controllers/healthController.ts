import { Request, Response } from 'express';
import { fetchWithProxy } from '../utils/fetchWithProxy';

export const healthCheck = async (req: Request, res: Response): Promise<void> => {
  // Basic health check - just service status
  res.json({
    status: 'Healthy',
    timestamp: new Date().toISOString(),
    service: 'Node Microservice',
    version: '1.0.0'
  });
};

export const statusCheck = async (req: Request, res: Response): Promise<void> => {
  // Check Jira
  let jiraStatus = 'ok';
  try {
    const jiraUrl = process.env.JIRA_URL;
    const jiraUser = process.env.JIRA_USER;
    const jiraToken = process.env.JIRA_TOKEN;
    if (!jiraUrl || !jiraUser || !jiraToken) throw new Error('Missing Jira env vars');
    const response = await fetchWithProxy(`${jiraUrl}/rest/api/3/myself`, {
      method: 'GET',
      auth: { username: jiraUser, password: jiraToken },
      timeout: 5000,
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  } catch (err) {
    jiraStatus = (err as Error).message || 'error';
  }

  // Check Confluence
  let confluenceStatus = 'ok';
  try {
    const confluenceUrl = process.env.CONFLUENCE_URL;
    const jiraUser = process.env.JIRA_USER;
    const jiraToken = process.env.JIRA_TOKEN;
    if (!confluenceUrl || !jiraUser || !jiraToken) throw new Error('Missing Confluence env vars');
    const response = await fetchWithProxy(`${confluenceUrl}/wiki/rest/api/user/current`, {
      method: 'GET',
      auth: { username: jiraUser, password: jiraToken },
      timeout: 5000,
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  } catch (err) {
    confluenceStatus = (err as Error).message || 'error';
  }

  // Check GitLab
  let gitlabStatus = 'ok';
  try {
    const gitlabToken = process.env.GITLAB_TOKEN;
    const gitlabHost = process.env.GITLAB_HOST || 'https://gitlab.com';
    if (!gitlabToken) throw new Error('Missing GitLab token');
    
    // Use native fetch for GitLab to avoid proxy
    const response = await fetch(`${gitlabHost}/api/v4/user`, {
      method: 'GET',
      headers: { 
        'PRIVATE-TOKEN': gitlabToken,
        'Content-Type': 'application/json'
      },
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  } catch (err) {
    gitlabStatus = (err as Error).message || 'error';
  }

  // System parameters
  const memoryUsage = process.memoryUsage();
  const system = {
    uptimeSeconds: process.uptime(),
    memory: {
      rss: memoryUsage.rss,
      heapTotal: memoryUsage.heapTotal,
      heapUsed: memoryUsage.heapUsed,
      external: memoryUsage.external,
    },
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    timestamp: new Date().toISOString(),
  };

  // Overall status
  const overall = jiraStatus === 'ok' && confluenceStatus === 'ok' && gitlabStatus === 'ok' ? 'ok' : 'degraded';
  res.json({
    status: overall,
    jira: jiraStatus,
    confluence: confluenceStatus,
    gitlab: gitlabStatus,
    system,
  });
}; 