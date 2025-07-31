// @ts-ignore
import { fetchWithProxy } from '../../utils/fetchWithProxy';
import { Request, Response } from 'express';
import { createServiceError, createAuthenticationError, ServiceError, AuthenticationError } from '../../types/errors';

export const updateConfluencePage = async (req: Request, res: Response): Promise<void> => {
  const { pageId, title, body, auth } = req.body;
  if (!pageId || !title || !body || !auth) {
    res.status(400).json({ error: 'Missing required fields: pageId, title, body, auth' });
    return;
  }
  try {
    const response = await fetchWithProxy(
      `${process.env.CONFLUENCE_URL}/wiki/rest/api/content/${pageId}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${auth.username}:${auth.token}`).toString('base64')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: pageId,
          type: 'page',
          title,
          body: { storage: { value: body, representation: 'storage' } },
          version: { number: 2 }, // You should fetch and increment the current version
        }),
      }
    );
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    res.json({ status: 'success', data });
  } catch (error: unknown) {
    if (error instanceof Error) {
      const serviceError = createServiceError(error.message, 'Confluence', 'updatePage');
      res.status(500).json({ error: serviceError.message, code: serviceError.code });
    } else {
      const serviceError = createServiceError('Unknown error occurred', 'Confluence', 'updatePage');
      res.status(500).json({ error: serviceError.message, code: serviceError.code });
    }
  }
};

export const testConfluenceConnection = async (req: Request, res: Response): Promise<void> => {
  const confluenceUrl = process.env.CONFLUENCE_URL;
  const username = process.env.CONFLUENCE_USER;
  const token = process.env.CONFLUENCE_TOKEN;
  if (!confluenceUrl || !username || !token) {
    res.status(500).json({ status: 'error', message: 'Missing Confluence environment variables' });
    return;
  }
  try {
    // Ping the current user endpoint as a simple health check
    const response = await fetchWithProxy(`${confluenceUrl}/wiki/rest/api/user/current`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${username}:${token}`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    res.json({ status: 'success', message: 'Connected to Confluence successfully' });
  } catch (error: unknown) {
    if (error instanceof Error) {
      const authError = createAuthenticationError(error.message, 'Confluence');
      res.status(500).json({ status: 'error', message: authError.message, code: authError.code });
    } else {
      const authError = createAuthenticationError('Unknown error occurred', 'Confluence');
      res.status(500).json({ status: 'error', message: authError.message, code: authError.code });
    }
  }
}; 