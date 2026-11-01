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
} from "@shared/contracts/replication/types";
import { api } from "../../lib/ipc-client";

export interface ReplicationClient {
  getOverview(): Promise<ReplicationOverview>;
  listDestinationCandidates(): Promise<DestinationCandidate[]>;
  listDestinations(): Promise<DestinationSummary[]>;
  getDestination(destinationId: string): Promise<DestinationDetail>;
  registerDestination(params: RegisterDestinationParams): Promise<DestinationDetail>;
  updateDestination(params: UpdateDestinationParams): Promise<DestinationDetail>;
  getAdoptionState(destinationId: string): Promise<AdoptionState>;
  startAdoption(destinationId: string): Promise<AdoptionState>;
  pauseAdoption(destinationId: string): Promise<AdoptionState>;
  resumeAdoption(destinationId: string): Promise<AdoptionState>;
  getPlan(): Promise<ReplicationPlan>;
  getCoverage(): Promise<CoverageSummary>;
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
    startAdoption: (destinationId) => api.replication.startAdoption(destinationId),
    pauseAdoption: (destinationId) => api.replication.pauseAdoption(destinationId),
    resumeAdoption: (destinationId) => api.replication.resumeAdoption(destinationId),
    getPlan: () => api.replication.getPlan(),
    getCoverage: () => api.replication.getCoverage(),
  };
}
