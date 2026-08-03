export const toNum = (val: any): number | undefined => {
  return val && !isNaN(Number(val)) ? Number(val) : undefined;
};
