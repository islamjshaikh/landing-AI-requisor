import { IntegrationProvider } from "@shared/integrations";
import { AsanaService } from "./asana-service";
import { JiraService } from "./jira-service";
import { MondayService } from "./monday-service";
import { SmartsheetService } from "./smartsheet-service";
import { BaseIntegrationService } from "./base-integration";

/**
 * Factory function to create integration service instances
 */
export function createIntegrationService(
  userId: string,
  provider: IntegrationProvider
): BaseIntegrationService {
  switch (provider) {
    case IntegrationProvider.SMARTSHEET:
      return new SmartsheetService(userId);
    case IntegrationProvider.ASANA:
      return new AsanaService(userId);
    case IntegrationProvider.MONDAY:
      return new MondayService(userId);
    case IntegrationProvider.JIRA:
      return new JiraService(userId);
    default:
      throw new Error(`Unsupported integration provider: ${provider}`);
  }
}