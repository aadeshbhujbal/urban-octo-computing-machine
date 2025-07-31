import { Request, Response } from 'express';
import { getSprintsFromJira, getReleasesFromJira } from '../../services/jiraService';
import { piPlanningSummaryService } from '../../services/piPlanningService';
import { getVelocitySummary } from '../../services/velocityService';
import { getCurrentSprintObjectives } from '../../services/sprintService';

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
    console.log(`[DEBUG] Fetching releases for project: ${project}`);
    const jiraReleases = await getReleasesFromJira(project as string);
    console.log(`[DEBUG] Found ${jiraReleases.length} releases for project ${project}`);
    
    let currentJiraRelease = null;
    if (jiraReleases && jiraReleases.length > 0) {
      currentJiraRelease = jiraReleases.find(release => !release.released) || jiraReleases[jiraReleases.length - 1];
      console.log(`[DEBUG] Selected release: ${currentJiraRelease?.name} (released: ${currentJiraRelease?.released})`);
    } else {
      console.log(`[DEBUG] No releases found for project ${project}`);
    }

    // 3. PI Planning current sprints - use current sprint dates if no PI dates provided
    let piSummary = null;
    let currentPiSprints: Array<{
      id: number;
      name?: string;
      startDate?: string;
      endDate?: string;
      state?: string;
    }> = [];
    let currentPI = null;
    
    // Use current sprint dates for PI Planning if no PI dates provided
    let piStartDateToUse = piStartDate as string;
    let piEndDateToUse = piEndDate as string;
    
    if (!piStartDateToUse || !piEndDateToUse) {
      // Use current sprint dates if available
      if (currentJiraSprint && currentJiraSprint.startDate && currentJiraSprint.endDate) {
        piStartDateToUse = currentJiraSprint.startDate.split('T')[0]; // Extract date part only
        piEndDateToUse = currentJiraSprint.endDate.split('T')[0]; // Extract date part only
        console.log(`[DEBUG] Using current sprint dates for PI Planning: ${piStartDateToUse} to ${piEndDateToUse}`);
      } else {
        // Fallback to current quarter if no current sprint
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();
        
        // Calculate current quarter
        const quarter = Math.floor(currentMonth / 3) + 1;
        const quarterStartMonth = (quarter - 1) * 3;
        
        piStartDateToUse = `${currentYear}-${String(quarterStartMonth + 1).padStart(2, '0')}-01`;
        piEndDateToUse = `${currentYear}-${String(quarterStartMonth + 3).padStart(2, '0')}-${new Date(currentYear, quarterStartMonth + 3, 0).getDate()}`;
        
        console.log(`[DEBUG] Using default quarter dates for PI Planning: ${piStartDateToUse} to ${piEndDateToUse}`);
      }
    }
    
    try {
      piSummary = await piPlanningSummaryService({
        project: project as string,
        boardId: boardId as string,
        piStartDate: piStartDateToUse,
        piEndDate: piEndDateToUse,
      });
      currentPiSprints = piSummary?.currentSprints || [];
      currentPI = piSummary || null;
      console.log(`[DEBUG] PI Planning summary generated with ${currentPiSprints.length} current sprints`);
    } catch (piError) {
      console.error('Error fetching PI Planning data:', piError);
      // Continue with empty PI data
    }

    // 4. Velocity current sprint
    const velocitySummary = await getVelocitySummary({ boardId: boardId as string, numSprints: 1 });
    const currentVelocitySprint = velocitySummary.sprints.length > 0 ? velocitySummary.sprints[0] : null;

    // 5. Current Sprint Objectives
    let currentSprintObjectives = null;
    try {
      currentSprintObjectives = await getCurrentSprintObjectives(boardId as string);
    } catch (objectivesError) {
      console.error('Error fetching sprint objectives:', objectivesError);
      // Continue with empty objectives data
    }

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
      sprintObjectives: currentSprintObjectives,
    });
  } catch (error) {
    console.error('Error in getCurrentSummary:', error);
    res.status(500).json({ error: (error as Error).message });
  }
} 