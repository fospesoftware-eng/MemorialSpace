import type { Request } from "express";

/**
 * Bounded pagination helper. Every list endpoint must cap its result set so
 * a single request can't OOM the server or saturate the database. Defaults
 * are conservative; callers can raise the ceiling per-endpoint if they have
 * a real reason to.
 */
export interface PageParams {
  limit: number;
  offset: number;
}

export function readPage(
  req: Request,
  opts: { defaultLimit?: number; maxLimit?: number } = {},
): PageParams {
  const defaultLimit = opts.defaultLimit ?? 100;
  const maxLimit = opts.maxLimit ?? 500;
  const rawLimit = Number(req.query.limit);
  const rawOffset = Number(req.query.offset);
  const limit = Number.isFinite(rawLimit) && rawLimit > 0
    ? Math.min(Math.floor(rawLimit), maxLimit)
    : defaultLimit;
  const offset = Number.isFinite(rawOffset) && rawOffset >= 0
    ? Math.floor(rawOffset)
    : 0;
  return { limit, offset };
}
