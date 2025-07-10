import { Request, Response } from 'express';
// @ts-ignore
import { Parser } from 'json2csv';

export const exportMergeRequestsCsv = async (req: Request, res: Response): Promise<void> => {
  const data = req.body.data;
  if (!Array.isArray(data) || data.length === 0) {
    res.status(400).json({ error: 'Missing or invalid data array in request body.' });
    return;
  }
  try {
    const parser = new Parser();
    const csv = parser.parse(data);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="merge_requests.csv"');
    res.send(csv);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}; 