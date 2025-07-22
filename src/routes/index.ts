import { Router } from 'express';
import textAnalyticsRoutes from './v1/textAnalytics';
import htmlReportRoutes from './v1/htmlReport';
import confluenceRoutes from './v1/confluence';
import csvExportRoutes from './v1/csvExport';
import mergeRequestsRoutes from './v1/mergeRequests';

const router = Router();

router.use('/api/v1/text', textAnalyticsRoutes);
router.use('/api/v1/reports', htmlReportRoutes);
router.use('/api/v1/confluence', confluenceRoutes);
router.use('/api/v1/csv', csvExportRoutes);
router.use('/api/v1/merge-requests', mergeRequestsRoutes);

export default router; 