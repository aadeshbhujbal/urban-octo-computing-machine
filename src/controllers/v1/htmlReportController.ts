// @ts-ignore
import ejs from 'ejs';
import { Request, Response } from 'express';

export const generateHtmlReport = async (req: Request, res: Response): Promise<void> => {
  const data = req.body.data || {};
  // Simple EJS template for demonstration
  const template = `
    <html>
      <head><title>Dashboard Report</title></head>
      <body>
        <h1>Dashboard Report</h1>
        <pre><%= JSON.stringify(data, null, 2) %></pre>
      </body>
    </html>
  `;
  const html = ejs.render(template, { data });
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
}; 