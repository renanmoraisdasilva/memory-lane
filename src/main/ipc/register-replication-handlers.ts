import { ipcMain } from "electron";
import { REPLICATION_CHANNELS } from "@shared/contracts/replication/channels";
import {
  AdoptionDestinationParamsSchema,
  GetDestinationParamsSchema,
  RegisterDestinationParamsSchema,
  RunEventsParamsSchema,
  StartRunParamsSchema,
  UpdateDestinationParamsSchema,
  type AdoptionState,
  type CoverageSummary,
  type DestinationCandidate,
  type DestinationDetail,
  type DestinationSummary,
  type ReplicationOverview,
  type ReplicationPlan,
  type ReplicationRunState,
  type RunEventsPage,
} from "@shared/contracts/replication/types";
import {
  ApplyPromotionParamsSchema,
  RollbackPromotionParamsSchema,
  VerifyPromotionParamsSchema,
  type PromotionState,
} from "@shared/contracts/replication/promotion-types";
import type { Logger } from "../logging/types";
import type { AdoptionService } from "../modules/replication/application/adoption-service";
import type { DestinationService } from "../modules/replication/application/destination-service";
import type { PlanService } from "../modules/replication/application/plan-service";
import type { PromotionService } from "../modules/replication/application/promotion-service";
import type { RunService } from "../modules/replication/application/run-service";
import { respond } from "./respond";

export interface ReplicationIpcServices {
  destinationService: DestinationService;
  adoptionService: AdoptionService;
  planService: PlanService;
  runService: RunService;
  promotionService: PromotionService;
  logger: Logger;
}

type RunServices = Pick<
  ReplicationIpcServices,
  "planService" | "runService" | "promotionService" | "logger"
>;

function registerRunStateHandlers({
  planService,
  runService,
  promotionService,
  logger,
}: RunServices): void {
  ipcMain.handle(REPLICATION_CHANNELS.getOverview, (event) =>
    respond<ReplicationOverview>(event, REPLICATION_CHANNELS.getOverview, logger, async () => {
      const [overview, run] = await Promise.all([
        planService.getOverview(),
        runService.getRunSummary(),
      ]);
      return { ...overview, run };
    }),
  );

  ipcMain.handle(REPLICATION_CHANNELS.getPlan, (event) =>
    respond<ReplicationPlan>(event, REPLICATION_CHANNELS.getPlan, logger, () =>
      planService.getPlan(),
    ),
  );

  ipcMain.handle(REPLICATION_CHANNELS.getCoverage, (event) =>
    respond<CoverageSummary>(event, REPLICATION_CHANNELS.getCoverage, logger, () =>
      planService.getCoverage(),
    ),
  );

  ipcMain.handle(REPLICATION_CHANNELS.getRunState, (event) =>
    respond<ReplicationRunState | null>(event, REPLICATION_CHANNELS.getRunState, logger, () =>
      runService.getRunState(),
    ),
  );

  ipcMain.handle(REPLICATION_CHANNELS.startRun, (event, params: unknown) =>
    respond<ReplicationRunState>(event, REPLICATION_CHANNELS.startRun, logger, async () => {
      const state = await runService.start(StartRunParamsSchema.parse(params));
      await promotionService.closeRollbackWindow();
      return state;
    }),
  );

  ipcMain.handle(REPLICATION_CHANNELS.pauseRun, (event) =>
    respond<ReplicationRunState>(event, REPLICATION_CHANNELS.pauseRun, logger, () =>
      runService.pause(),
    ),
  );

  ipcMain.handle(REPLICATION_CHANNELS.resumeRun, (event) =>
    respond<ReplicationRunState>(event, REPLICATION_CHANNELS.resumeRun, logger, () =>
      runService.resume(),
    ),
  );

  ipcMain.handle(REPLICATION_CHANNELS.requestStop, (event) =>
    respond<ReplicationRunState>(event, REPLICATION_CHANNELS.requestStop, logger, () =>
      runService.requestStop(),
    ),
  );

  ipcMain.handle(REPLICATION_CHANNELS.replan, (event) =>
    respond<ReplicationRunState | null>(event, REPLICATION_CHANNELS.replan, logger, () =>
      runService.replanIfPaused(),
    ),
  );

  ipcMain.handle(REPLICATION_CHANNELS.getRunEvents, (event, params: unknown) =>
    respond<RunEventsPage>(event, REPLICATION_CHANNELS.getRunEvents, logger, () => {
      const parsed = RunEventsParamsSchema.parse(params);
      return runService.getEvents(parsed.runId, parsed.cursor ?? null, parsed.limit ?? 50);
    }),
  );

  ipcMain.handle(REPLICATION_CHANNELS.getPromotion, (event, params: unknown) =>
    respond<PromotionState>(event, REPLICATION_CHANNELS.getPromotion, logger, () => {
      const parsed = GetDestinationParamsSchema.parse(params);
      return promotionService.getState(parsed.destinationId);
    }),
  );

  ipcMain.handle(REPLICATION_CHANNELS.verifyPromotion, (event, params: unknown) =>
    respond<PromotionState>(event, REPLICATION_CHANNELS.verifyPromotion, logger, () => {
      const parsed = VerifyPromotionParamsSchema.parse(params);
      return promotionService.verify(parsed.destinationId, parsed.deep);
    }),
  );

  ipcMain.handle(REPLICATION_CHANNELS.applyPromotion, (event, params: unknown) =>
    respond<PromotionState>(event, REPLICATION_CHANNELS.applyPromotion, logger, () =>
      promotionService.apply(ApplyPromotionParamsSchema.parse(params)),
    ),
  );

  ipcMain.handle(REPLICATION_CHANNELS.rollbackPromotion, (event, params: unknown) =>
    respond<PromotionState>(event, REPLICATION_CHANNELS.rollbackPromotion, logger, () => {
      const parsed = RollbackPromotionParamsSchema.parse(params);
      return promotionService.rollback(parsed.promotionId, parsed.destinationId);
    }),
  );
}

type DestinationServices = Pick<
  ReplicationIpcServices,
  "destinationService" | "adoptionService" | "runService" | "promotionService" | "logger"
>;

function registerDestinationHandlers({
  destinationService,
  adoptionService,
  runService,
  promotionService,
  logger,
}: DestinationServices): void {
  ipcMain.handle(REPLICATION_CHANNELS.getAdoptionState, (event, params: unknown) =>
    respond<AdoptionState>(event, REPLICATION_CHANNELS.getAdoptionState, logger, () => {
      const parsed = AdoptionDestinationParamsSchema.parse(params);
      return adoptionService.getState(parsed.destinationId);
    }),
  );

  ipcMain.handle(REPLICATION_CHANNELS.getActiveAdoptions, (event) =>
    respond<AdoptionState[]>(event, REPLICATION_CHANNELS.getActiveAdoptions, logger, () =>
      adoptionService.listActive(),
    ),
  );

  ipcMain.handle(REPLICATION_CHANNELS.startAdoption, (event, params: unknown) =>
    respond<AdoptionState>(event, REPLICATION_CHANNELS.startAdoption, logger, async () => {
      const parsed = AdoptionDestinationParamsSchema.parse(params);
      const state = await adoptionService.start(parsed.destinationId);
      await promotionService.closeRollbackWindow();
      return state;
    }),
  );

  ipcMain.handle(REPLICATION_CHANNELS.pauseAdoption, (event, params: unknown) =>
    respond<AdoptionState>(event, REPLICATION_CHANNELS.pauseAdoption, logger, () => {
      const parsed = AdoptionDestinationParamsSchema.parse(params);
      return adoptionService.pause(parsed.destinationId);
    }),
  );

  ipcMain.handle(REPLICATION_CHANNELS.resumeAdoption, (event, params: unknown) =>
    respond<AdoptionState>(event, REPLICATION_CHANNELS.resumeAdoption, logger, async () => {
      const parsed = AdoptionDestinationParamsSchema.parse(params);
      const state = await adoptionService.resume(parsed.destinationId);
      await promotionService.closeRollbackWindow();
      return state;
    }),
  );

  ipcMain.handle(REPLICATION_CHANNELS.listDestinationCandidates, (event) =>
    respond<DestinationCandidate[]>(
      event,
      REPLICATION_CHANNELS.listDestinationCandidates,
      logger,
      () => destinationService.listCandidates(),
    ),
  );

  ipcMain.handle(REPLICATION_CHANNELS.listDestinations, (event) =>
    respond<DestinationSummary[]>(event, REPLICATION_CHANNELS.listDestinations, logger, () =>
      destinationService.list(),
    ),
  );

  ipcMain.handle(REPLICATION_CHANNELS.getDestination, (event, params: unknown) =>
    respond<DestinationDetail>(event, REPLICATION_CHANNELS.getDestination, logger, () => {
      const parsed = GetDestinationParamsSchema.parse(params);
      return destinationService.getByDestinationId(parsed.destinationId);
    }),
  );

  ipcMain.handle(REPLICATION_CHANNELS.registerDestination, (event, params: unknown) =>
    respond<DestinationDetail>(
      event,
      REPLICATION_CHANNELS.registerDestination,
      logger,
      async () => {
        const destination = await destinationService.register(
          RegisterDestinationParamsSchema.parse(params),
        );
        await promotionService.closeRollbackWindow();
        await runService.onDestinationAdded();
        return destination;
      },
    ),
  );

  ipcMain.handle(REPLICATION_CHANNELS.updateDestination, (event, params: unknown) =>
    respond<DestinationDetail>(event, REPLICATION_CHANNELS.updateDestination, logger, async () => {
      const destination = await destinationService.update(
        UpdateDestinationParamsSchema.parse(params),
      );
      await promotionService.closeRollbackWindow();
      await runService.replanIfPaused();
      return destination;
    }),
  );
}

export function registerReplicationHandlers(services: ReplicationIpcServices): void {
  registerRunStateHandlers(services);
  registerDestinationHandlers(services);
}
