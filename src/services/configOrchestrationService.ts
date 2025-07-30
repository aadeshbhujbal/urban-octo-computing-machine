import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { piPlanningSummaryService } from './piPlanningService';
import { getMergeRequestsHeatmap } from './mergeRequestsService';
import { getVelocitySummary } from './velocityService';
// import { piPlanningSummaryService } from './piPlanningService';
// import { getMergeRequestsHeatmap } from './mergeRequestsService';
// import { getVelocitySummary } from './velocityService';

export interface SosConfigRow {
  Project: string;
  ConfluencePageName: string;
  ConfluencePageID: string;
  PortfolioJIRAProjectID: string;
  PIStartDate: string;
  PIEndDate: string;
  IncludedSprintName: string;
  ExcludedSprintName: string;
  CodePageUrl: string;
  DodPageUrl: string;
  CodePageTitle: string;
  DodPageTitle: string;
  JiraBoardId: string;
  GitlabDashboardUrl: string;
  JiraTeamName: string;
  SprintFilter: string;
}

export interface OrchestrationResult {
  project: string;
  piSummary?: unknown;
  mergeRequests?: unknown;
  velocity?: unknown;
  error?: string;
  // Add more as needed
}

export async function runConfigOrchestration(): Promise<OrchestrationResult[]> {
  const csvFilePath = path.resolve(__dirname, '../../pytonode-main/pytonode-main/sos_config_5.csv');
  const csvFileContent = fs.readFileSync(csvFilePath, 'utf-8');
  const configRecords: SosConfigRow[] = parse(csvFileContent, {
    columns: true,
    skip_empty_lines: true,
    delimiter: '|',
  });

  const orchestrationResults: OrchestrationResult[] = [];
  for (const configRow of configRecords) {
    try {
      const [piPlanningSummary, mergeRequestsData, velocityData] = await Promise.all([
        piPlanningSummaryService({
          project: configRow.Project,
          boardId: configRow.JiraBoardId,
          piStartDate: configRow.PIStartDate,
          piEndDate: configRow.PIEndDate,
        }),
        getMergeRequestsHeatmap({
          groupId: configRow.GitlabDashboardUrl,
          startDate: configRow.PIStartDate,
          endDate: configRow.PIEndDate,
        }),
        getVelocitySummary({
          boardId: configRow.JiraBoardId,
          numSprints: 6,
          year: configRow.PIStartDate ? new Date(configRow.PIStartDate).getFullYear() : undefined,
          sprintPrefix: configRow.IncludedSprintName || undefined,
        }),
      ]);
      orchestrationResults.push({
        project: configRow.Project,
        piSummary: piPlanningSummary,
        mergeRequests: mergeRequestsData,
        velocity: velocityData,
      });
    } catch (error) {
      orchestrationResults.push({
        project: configRow.Project,
        error: (error as Error).message,
      });
    }
  }
  return orchestrationResults;
} 