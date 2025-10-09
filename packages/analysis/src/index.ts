export interface SegmentCandidate {
  start: number;
  end: number;
  energy: number;
  loudness: number;
  confidence: number;
}

export interface SegmentSelectionParams {
  targetDuration: number;
  minimumDuration?: number;
  maximumDuration?: number;
  candidates: SegmentCandidate[];
}

export interface SegmentSelectionResult {
  start: number;
  end: number;
  score: number;
  source: "spotify" | "analysis";
}

const defaultWeights = {
  energy: 0.45,
  loudness: 0.25,
  confidence: 0.2,
  durationFit: 0.1
};

export function selectBestSegment(
  params: SegmentSelectionParams,
  weights: typeof defaultWeights = defaultWeights
): SegmentSelectionResult | null {
  const { targetDuration, candidates, minimumDuration = targetDuration * 0.8, maximumDuration = targetDuration * 1.2 } = params;

  if (!candidates.length) {
    return null;
  }

  let best: SegmentSelectionResult | null = null;

  for (const candidate of candidates) {
    const score = scoreCandidate(candidate, params, weights, { minimumDuration, maximumDuration });
    if (score === null) {
      continue;
    }

    if (!best || score > best.score) {
      best = {
        start: candidate.start,
        end: candidate.end,
        score,
        source: "spotify"
      };
    }
  }

  return best;
}

export function scoreCandidate(
  candidate: SegmentCandidate,
  params: Pick<SegmentSelectionParams, "targetDuration">,
  weights: typeof defaultWeights = defaultWeights,
  bounds?: { minimumDuration: number; maximumDuration: number }
): number | null {
  const minimumDuration = bounds?.minimumDuration ?? params.targetDuration * 0.8;
  const maximumDuration = bounds?.maximumDuration ?? params.targetDuration * 1.2;
  const duration = candidate.end - candidate.start;
  if (duration < minimumDuration || duration > maximumDuration) {
    return null;
  }

  const durationFit = 1 - Math.min(1, Math.abs(duration - params.targetDuration) / params.targetDuration);
  return (
    candidate.energy * weights.energy +
    normalize(candidate.loudness) * weights.loudness +
    candidate.confidence * weights.confidence +
    durationFit * weights.durationFit
  );
}

function normalize(value: number, min = -60, max = 0) {
  const clamped = Math.min(Math.max(value, min), max);
  return (clamped - min) / (max - min);
}
