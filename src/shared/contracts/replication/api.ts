import type { IpcResult } from "../ipc";
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
} from "./types";
import type {
  ApplyPromotionParams,
  PromotionState,
  RollbackPromotionParams,
  VerifyPromotionParams,
} from "./promotion-types";

export interface ReplicationApi {
  getOverview(): Promise<IpcResult<ReplicationOverview>>;
  listDestinationCandidates(): Promise<IpcResult<DestinationCandidate[]>>;
  listDestinations(): Promise<IpcResult<DestinationSummary[]>>;
  getDestination(destinationId: string): Promise<IpcResult<DestinationDetail>>;
  registerDestination(params: RegisterDestinationParams): Promise<IpcResult<DestinationDetail>>;
  updateDestination(params: UpdateDestinationParams): Promise<IpcResult<DestinationDetail>>;
  getAdoptionState(destinationId: string): Promise<IpcResult<AdoptionState>>;
  startAdoption(destinationId: string): Promise<IpcResult<AdoptionState>>;
  pauseAdoption(destinationId: string): Promise<IpcResult<AdoptionState>>;
  resumeAdoption(destinationId: string): Promise<IpcResult<AdoptionState>>;
  getPlan(): Promise<IpcResult<ReplicationPlan>>;
  getCoverage(): Promise<IpcResult<CoverageSummary>>;
  getRunState(): Promise<IpcResult<ReplicationRunState | null>>;
  startRun(params: StartRunParams): Promise<IpcResult<ReplicationRunState>>;
  pauseRun(): Promise<IpcResult<ReplicationRunState>>;
  resumeRun(): Promise<IpcResult<ReplicationRunState>>;
  requestStop(): Promise<IpcResult<ReplicationRunState>>;
  replan(): Promise<IpcResult<ReplicationRunState | null>>;
  getRunEvents(params: RunEventsParams): Promise<IpcResult<RunEventsPage>>;
  getPromotion(destinationId: string): Promise<IpcResult<PromotionState>>;
  verifyPromotion(params: VerifyPromotionParams): Promise<IpcResult<PromotionState>>;
  applyPromotion(params: ApplyPromotionParams): Promise<IpcResult<PromotionState>>;
  rollbackPromotion(params: RollbackPromotionParams): Promise<IpcResult<PromotionState>>;
}
