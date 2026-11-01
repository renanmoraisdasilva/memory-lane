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
  UpdateDestinationParams,
} from "./types";

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
}
