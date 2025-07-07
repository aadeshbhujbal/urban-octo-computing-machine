import axios from 'axios';
import { JiraProject, JiraVersion, JiraSprint, JiraIssue, JiraEpic } from '../types/jira';

const JIRA_URL = process.env.JIRA_URL;
const JIRA_USER = process.env.JIRA_USER;
const JIRA_TOKEN = process.env.JIRA_TOKEN;

export async function getReleasesFromJira(projectName?: string): Promise<JiraVersion[]> {
  if (!JIRA_URL || !JIRA_USER || !JIRA_TOKEN) {
    throw new Error('Jira credentials are not set in environment variables');
  }

  // 1. Get all projects
  const projectsResp = await axios.get(`${JIRA_URL}/rest/api/3/project`, {
    auth: { username: JIRA_USER, password: JIRA_TOKEN },
  });
  const projects = projectsResp.data as JiraProject[];

  // 2. Find project by name (case-insensitive)
  const project = projects.find((p) =>
    projectName ? p.name.toLowerCase() === projectName.toLowerCase() : true
  );
  if (!project) {
    throw new Error(`Project not found: ${projectName}`);
  }

  // 3. Get versions (releases) for the project
  const versionsResp = await axios.get(`${JIRA_URL}/rest/api/3/project/${project.key}/versions`, {
    auth: { username: JIRA_USER, password: JIRA_TOKEN },
  });
  const versions = versionsResp.data as JiraVersion[];

  // 4. Map to relevant fields
  return versions.map((version) => ({
    id: version.id,
    name: version.name,
    startDate: version.startDate,
    releaseDate: version.releaseDate,
    released: version.released,
    overdue: version.overdue,
  }));
}

export async function getSprintsFromJira(boardId: string): Promise<JiraSprint[]> {
  if (!JIRA_URL || !JIRA_USER || !JIRA_TOKEN) {
    throw new Error('Jira credentials are not set in environment variables');
  }
  const resp = await axios.get(`${JIRA_URL}/rest/agile/1.0/board/${boardId}/sprint`, {
    auth: { username: JIRA_USER, password: JIRA_TOKEN },
  });
  return ((resp.data as { values: JiraSprint[] }).values) || [];
}

export async function getIssuesFromJira(jql: string): Promise<JiraIssue[]> {
  if (!JIRA_URL || !JIRA_USER || !JIRA_TOKEN) {
    throw new Error('Jira credentials are not set in environment variables');
  }
  const resp = await axios.get(`${JIRA_URL}/rest/api/3/search`, {
    auth: { username: JIRA_USER, password: JIRA_TOKEN },
    params: { jql },
  });
  return ((resp.data as { issues: JiraIssue[] }).issues) || [];
}

export async function getEpicsFromJira(boardId: string): Promise<JiraEpic[]> {
  if (!JIRA_URL || !JIRA_USER || !JIRA_TOKEN) {
    throw new Error('Jira credentials are not set in environment variables');
  }
  const resp = await axios.get(`${JIRA_URL}/rest/agile/1.0/board/${boardId}/epic`, {
    auth: { username: JIRA_USER, password: JIRA_TOKEN },
  });
  return ((resp.data as { values: JiraEpic[] }).values) || [];
} 