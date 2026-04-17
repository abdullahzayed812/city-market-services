import { ApiClient } from './ApiClient';

export interface ScenarioResult {
  scenarioName: string;
  success: boolean;
  durationMs: number;
  totalRequests: number;
  successRequests: number;
  failedRequests: number;
  details?: any;
}

export abstract class Scenario {
  abstract getName(): string;
  abstract run(apiClient: ApiClient, config: any): Promise<ScenarioResult>;

  protected createResult(
    success: boolean,
    startTime: number,
    totalRequests: number,
    successRequests: number,
    failedRequests: number,
    details?: any
  ): ScenarioResult {
    return {
      scenarioName: this.getName(),
      success,
      durationMs: Date.now() - startTime,
      totalRequests,
      successRequests,
      failedRequests,
      details,
    };
  }
}
