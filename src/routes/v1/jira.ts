import { Router } from 'express';
import { getReleases, getSprints, getIssues, getEpics } from '../../controllers/v1/jiraController';

const router = Router();

router.get('/releases', getReleases);
router.get('/sprints', getSprints);
router.get('/issues', getIssues);
router.get('/epics', getEpics);

export default router; 