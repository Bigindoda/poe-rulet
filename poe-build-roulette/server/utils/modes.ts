export const ROULETTE_MODES = ['classic', 'chaos', 'streamers'] as const;

export type RouletteMode = (typeof ROULETTE_MODES)[number];

export const DEFAULT_ROULETTE_MODE: RouletteMode = 'classic';

export const MODE_LABELS: Record<RouletteMode, string> = {
  classic: 'Classic',
  chaos: 'Chaos',
  streamers: 'Streamers',
};

export function parseMode(value: unknown): RouletteMode {
  return typeof value === 'string' && (ROULETTE_MODES as readonly string[]).includes(value)
    ? (value as RouletteMode)
    : DEFAULT_ROULETTE_MODE;
}
