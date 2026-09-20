import { getLawContextProvider, isContextProviderEnabled } from "../../config";
import {
  evaluateContextProviderBudget,
  recordContextProviderTelemetry,
  type ContextProviderTelemetrySink
} from "../../guards";
import type {
  ContextProviderType,
  ContextResearchProviderSearchOptions
} from "../../types";
import type { NationalLawProviderStatus } from "./types";

type NationalLawProviderType = Extract<
  ContextProviderType,
  "law" | "ordinance"
>;

type NationalLawProviderPreflightOptions = {
  budgetSnapshot: ContextResearchProviderSearchOptions["budgetSnapshot"];
  env: NodeJS.ProcessEnv;
  operation: "fetchById" | "search";
  providerType: NationalLawProviderType;
  telemetry?: ContextProviderTelemetrySink;
};

type NationalLawProviderPreflight =
  | {
      allowed: true;
    }
  | {
      allowed: false;
      notFoundReason: string;
      status: NationalLawProviderStatus;
    };

export function getNationalLawProviderPreflight(
  options: NationalLawProviderPreflightOptions
): NationalLawProviderPreflight {
  if (
    !isContextProviderEnabled(options.providerType, options.env) ||
    getLawContextProvider(options.env) !== "national-law-api"
  ) {
    recordContextProviderTelemetry(options.telemetry, {
      operation: options.operation,
      providerType: options.providerType,
      reason: "disabled_or_missing_credentials",
      status: "disabled"
    });
    return {
      allowed: false,
      notFoundReason: "PROVIDER_DISABLED",
      status: "PROVIDER_DISABLED"
    };
  }

  if (!options.env.LAW_OC) {
    recordContextProviderTelemetry(options.telemetry, {
      operation: options.operation,
      providerType: options.providerType,
      reason: "missing_credentials",
      status: "disabled"
    });
    return {
      allowed: false,
      notFoundReason: "LAW_OC_REQUIRED",
      status: "MISSING_CREDENTIALS"
    };
  }

  const budget = evaluateContextProviderBudget(
    options.budgetSnapshot,
    options.env
  );
  if (!budget.allowed) {
    recordContextProviderTelemetry(options.telemetry, {
      operation: options.operation,
      providerType: options.providerType,
      reason: budget.reason ?? "budget_guard_blocked",
      status: "disabled"
    });
    return {
      allowed: false,
      notFoundReason: budget.reason ?? "BUDGET_GUARD_BLOCKED",
      status: "PROVIDER_DISABLED"
    };
  }

  return { allowed: true };
}
