export const getMissionStartInDays = (startDate?: string | null): number => {
  if (!startDate) return 99;
  const startMs = new Date(startDate).getTime();
  if (Number.isNaN(startMs)) return 99;
  return Math.ceil((startMs - Date.now()) / 86400000);
};

export const isMissionUrgent = (startDate?: string | null): boolean => {
  return getMissionStartInDays(startDate) <= 3;
};

export const summarizeDeleteSettlements = (
  missionIds: string[],
  results: PromiseSettledResult<void>[]
): { successCount: number; failedIds: string[] } => {
  let successCount = 0;
  const failedIds: string[] = [];

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      successCount += 1;
      return;
    }
    failedIds.push(missionIds[index] || `unknown-${index}`);
  });

  return { successCount, failedIds };
};
