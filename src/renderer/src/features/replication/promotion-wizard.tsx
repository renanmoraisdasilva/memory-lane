import { useState } from "react";
import type { PromotionOldSourceFate, PromotionState } from "@shared/contracts/replication/types";
import {
  PromotionConfirmStep,
  PromotionExtrasStep,
  PromotionFatesStep,
  PromotionStepBar,
  PromotionStepFooter,
  PromotionVerifyStep,
} from "./promotion-steps";
import { usePromotionApply, usePromotionVerify } from "./use-replication";

export function PromotionWizard({
  state,
  destinationId,
  onApplied,
}: {
  state: PromotionState;
  destinationId: string;
  onApplied: (state: PromotionState) => void;
}): React.JSX.Element {
  const verify = usePromotionVerify();
  const apply = usePromotionApply();
  const [step, setStep] = useState(1);
  const [deep, setDeep] = useState(false);
  const [oldFate, setOldFate] = useState<PromotionOldSourceFate>("full_copy");
  const [fates, setFates] = useState<Record<string, boolean>>({});
  const [confirmed, setConfirmed] = useState(false);

  function applyPromotion(): void {
    void apply
      .mutateAsync({
        destinationId,
        deepVerify: deep,
        oldSourceFate: oldFate,
        partialFates: state.partialDestinations.map((destination) => ({
          destinationId: destination.destinationId,
          keep: fates[destination.destinationId] !== false,
        })),
        confirm: true,
      })
      .then(onApplied)
      .catch(() => undefined);
  }

  return (
    <>
      <PromotionStepBar step={step} />
      {step === 1 ? (
        <PromotionVerifyStep state={state} deep={deep} setDeep={setDeep} verify={verify} />
      ) : null}
      {step === 2 ? <PromotionExtrasStep state={state} /> : null}
      {step === 3 ? (
        <PromotionFatesStep
          state={state}
          oldFate={oldFate}
          setOldFate={setOldFate}
          fates={fates}
          setFates={setFates}
        />
      ) : null}
      {step === 4 ? (
        <PromotionConfirmStep
          state={state}
          confirmed={confirmed}
          setConfirmed={setConfirmed}
          apply={apply}
          onApply={applyPromotion}
        />
      ) : null}
      <PromotionStepFooter
        step={step}
        canAdvance={step !== 1 || state.verified}
        onBack={() => setStep(Math.max(1, step - 1))}
        onNext={() => setStep(step + 1)}
      />
    </>
  );
}
