/**
 * Tiny bus that keeps the charts of a multi-chart layout in sync:
 * crosshair (vertical line follows the mouse in every chart) and visible time range.
 */

export interface TimeRange {
  from: number;
  to: number;
}

interface SyncTarget {
  /** time = null clears the crosshair */
  onCrosshair: (time: number | null) => void;
  onRange: (range: TimeRange) => void;
}

const targets = new Map<string, SyncTarget>();
/** Set while a broadcast is being applied so targets never re-emit it */
let applying = false;

function broadcast(fromId: string, fn: (t: SyncTarget) => void) {
  if (applying) return;
  applying = true;
  try {
    targets.forEach((t, id) => {
      if (id !== fromId) fn(t);
    });
  } finally {
    applying = false;
  }
}

export const chartSync = {
  register(id: string, target: SyncTarget): () => void {
    targets.set(id, target);
    return () => {
      if (targets.get(id) === target) targets.delete(id);
    };
  },
  crosshair(fromId: string, time: number | null) {
    broadcast(fromId, (t) => t.onCrosshair(time));
  },
  range(fromId: string, range: TimeRange) {
    broadcast(fromId, (t) => t.onRange(range));
  },
};
