// @ts-ignore
import axios from 'axios';
import { Request, Response } from 'express';

export const updateConfluencePage = async (req: Request, res: Response): Promise<void> => {
  const { pageId, title, body, auth } = req.body;
  if (!pageId || !title || !body || !auth) {
    res.status(400).json({ error: 'Missing required fields: pageId, title, body, auth' });
    return;
  }
  try {
    const response = await axios.put(
      `https://your-domain.atlassian.net/wiki/rest/api/content/${pageId}`,
      {
        id: pageId,
        type: 'page',
        title,
        body: { storage: { value: body, representation: 'storage' } },
        version: { number: 2 }, // You should fetch and increment the current version
      },
      {
        headers: {
          'Authorization': `Basic ${Buffer.from(`${auth.username}:${auth.token}`).toString('base64')}`,
          'Content-Type': 'application/json',
        },
      }
    );
    res.json({ status: 'success', data: response.data });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}; 