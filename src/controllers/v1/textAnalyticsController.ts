// @ts-ignore
import natural from 'natural';
import { Request, Response } from 'express';

export const extractKeyPhrases = async (req: Request, res: Response): Promise<void> => {
  const texts: string[] = req.body.texts || [];
  if (!Array.isArray(texts) || texts.length === 0) {
    res.status(400).json({ error: 'Missing or invalid texts array in request body.' });
    return;
  }

  // Use natural's TfIdf for simple key phrase extraction
  const tfidf = new natural.TfIdf();
  texts.forEach(text => tfidf.addDocument(text));

  const keyPhrases: string[][] = [];
  texts.forEach((text, i) => {
    const terms = tfidf.listTerms(i)
      .slice(0, 10) // top 10 terms
      .map((item: any) => item.term);
    keyPhrases.push(terms);
  });

  res.json({ keyPhrases });
}; 