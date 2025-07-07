import { Request, Response } from 'express';

export const healthCheck = async (req: Request, res: Response) => {
  // In the future, add real checks for Jira, Confluence, GitLab, etc.
  res.json({
    service: 'ok',
    integrations: {
      jira: 'pending',
      confluence: 'pending',
      gitlab: 'pending',
    },
    timestamp: new Date().toISOString(),
  });
}; 