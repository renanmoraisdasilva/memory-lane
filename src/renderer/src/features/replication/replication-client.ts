import type {
  AdoptionState,
  CoverageSummary,
  DestinationCandidate,
  DestinationDetail,
  DestinationSummary,
  RegisterDestinationParams,
  ReplicationOverview,
  ReplicationPlan,
  ReplicationRunState,
  RunEventsPage,
  RunEventsParams,
  StartRunParams,
  UpdateDestinationParams,
} from "@shared/contracts/replication/types";
import type {
  ApplyPromotionParams,
  PromotionState,
  RollbackPromotionParams,
  VerifyPromotionParams,
} from "@shared/contracts/replication/promotion-types";
import { api } from "../../lib/ipc-client";

export interface ReplicationClient {
  getOverview(): Promise<ReplicationOverview>;
  listDestinationCandidates(): Promise<DestinationCandidate[]>;
  listDestinations(): Promise<DestinationSummary[]>;
  getDestination(destinationId: string): Promise<DestinationDetail>;
  registerDestination(params: RegisterDestinationParams): Promise<DestinationDetail>;
  updateDestination(params: UpdateDestinationParams): Promise<DestinationDetail>;
  getAdoptionState(destinationId: string): Promise<AdoptionState>;
  getActiveAdoptions(): Promise<AdoptionState[]>;
  startAdoption(destinationId: string): Promise<AdoptionState>;
  pauseAdoption(destinationId: string): Promise<AdoptionState>;
  resumeAdoption(destinationId: string): Promise<AdoptionState>;
  getPlan(): Promise<ReplicationPlan>;
  getCoverage(): Promise<CoverageSummary>;
  getRunState(): Promise<ReplicationRunState | null>;
  startRun(params: StartRunParams): Promise<ReplicationRunState>;
  pauseRun(): Promise<ReplicationRunState>;
  resumeRun(): Promise<ReplicationRunState>;
  requestStop(): Promise<ReplicationRunState>;
  replan(): Promise<ReplicationRunState | null>;
  getRunEvents(params: RunEventsParams): Promise<RunEventsPage>;
  getPromotion(destinationId: string): Promise<PromotionState>;
  verifyPromotion(params: VerifyPromotionParams): Promise<PromotionState>;
  applyPromotion(params: ApplyPromotionParams): Promise<PromotionState>;
  rollbackPromotion(params: RollbackPromotionParams): Promise<PromotionState>;
}

export function createReplicationClient(): ReplicationClient {
  return {
    getOverview: () => api.replication.getOverview(),
    listDestinationCandidates: () => api.replication.listDestinationCandidates(),
    listDestinations: () => api.replication.listDestinations(),
    getDestination: (destinationId) => api.replication.getDestination(destinationId),
    registerDestination: (params) => api.replication.registerDestination(params),
    updateDestination: (params) => api.replication.updateDestination(params),
    getAdoptionState: (destinationId) => api.replication.getAdoptionState(destinationId),
    getActiveAdoptions: () => api.replication.getActiveAdoptions(),
    startAdoption: (destinationId) => api.replication.startAdoption(destinationId),
    pauseAdoption: (destinationId) => api.replication.pauseAdoption(destinationId),
    resumeAdoption: (destinationId) => api.replication.resumeAdoption(destinationId),
    getPlan: () => api.replication.getPlan(),
    getCoverage: () => api.replication.getCoverage(),
    getRunState: () => api.replication.getRunState(),
    startRun: (params) => api.replication.startRun(params),
    pauseRun: () => api.replication.pauseRun(),
    resumeRun: () => api.replication.resumeRun(),
    requestStop: () => api.replication.requestStop(),
    replan: () => api.replication.replan(),
    getRunEvents: (params) => api.replication.getRunEvents(params),
    getPromotion: (destinationId) => api.replication.getPromotion(destinationId),
    verifyPromotion: (params) => api.replication.verifyPromotion(params),
    applyPromotion: (params) => api.replication.applyPromotion(params),
    rollbackPromotion: (params) => api.replication.rollbackPromotion(params),
  };
}
