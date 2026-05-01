/**
 * Duty Calculation hooks.
 *
 * Both endpoints are pure mutations — there is nothing to cache and no
 * list to invalidate. We just wrap the API client so callers get the
 * standard mutation ergonomics (isPending, mutate, mutateAsync, error).
 */
import { useMutation } from '@tanstack/react-query';
import {
  dutyCalculationApi,
  DutyCalcRequest,
} from '../api/client';

export function useDutyCalculate() {
  return useMutation({
    mutationFn: (body: DutyCalcRequest) => dutyCalculationApi.calculate(body),
  });
}

export function useAIDutyCalculate() {
  return useMutation({
    mutationFn: (body: DutyCalcRequest) => dutyCalculationApi.calculateAI(body),
  });
}
