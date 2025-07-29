import { Request, Response } from 'express';
import { getSprintsFromJira, getReleasesFromJira } from '../../services/jiraService';
import { piPlanningSummaryService } from '../../services/piPlanningService';
import { getVelocitySummary } from '../../services/velocityService';

export async function getCurrentSummary(req: Request, res: Response) {
  try {
    const { project, boardId, piStartDate, piEndDate } = req.query;
    if (!project || !boardId) {
      return res.status(400).json({ error: 'Missing required query params: project, boardId' });
    }

    // 1. Current Jira Sprint
    const jiraSprints = await getSprintsFromJira(boardId as string, 'active');
    const currentJiraSprint = jiraSprints.length > 0 ? jiraSprints[0] : null;

    // 2. Current Jira Release (latest unreleased, or most recent released)
    const jiraReleases = await getReleasesFromJira(project as string);
    let currentJiraRelease = null;
    if (jiraReleases && jiraReleases.length > 0) {
      currentJiraRelease = jiraReleases.find(r => !r.released) || jiraReleases[jiraReleases.length - 1];
    }

    // 3. PI Planning current sprints
    let piSummary = null;
    if (piStartDate && piEndDate) {
      piSummary = await piPlanningSummaryService({
        project: project as string,
        boardId: boardId as string,
        piStartDate: piStartDate as string,
        piEndDate: piEndDate as string,
      });
    }
    const currentPiSprints = piSummary?.currentSprints || [];
    const currentPI = piSummary || null;

    // 4. Velocity current sprint
    const velocitySummary = await getVelocitySummary({ boardId: boardId as string, numSprints: 1 });
    const currentVelocitySprint = velocitySummary.sprints.length > 0 ? velocitySummary.sprints[0] : null;

    res.json({
      jira: {
        currentRelease: currentJiraRelease,
        currentSprint: currentJiraSprint,
      },
      piPlanning: {
        currentSprints: currentPiSprints,
        currentPI,
      },
      velocity: {
        currentSprint: currentVelocitySprint,
        latestSprintEfficiency: velocitySummary.latestSprintEfficiency,
      },
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
} 