export const REPLICATION_CHANNELS = {
  getOverview: "replication:get-overview",
  listDestinationCandidates: "replication:list-destination-candidates",
  listDestinations: "replication:list-destinations",
  getDestination: "replication:get-destination",
  registerDestination: "replication:register-destination",
  updateDestination: "replication:update-destination",
  getAdoptionState: "replication:get-adoption-state",
  startAdoption: "replication:start-adoption",
  pauseAdoption: "replication:pause-adoption",
  resumeAdoption: "replication:resume-adoption",
  getPlan: "replication:get-plan",
  getCoverage: "replication:get-coverage",
} as const;
