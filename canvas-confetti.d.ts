declare module "canvas-confetti" {
  export type CreateTypes = {
    particleCount?: number;
    angle?: number;
    spread?: number;
    startVelocity?: number;
    decay?: number;
    gravity?: number;
    drift?: number;
    scalar?: number;
    ticks?: number;
    origin?: {
      x?: number;
      y?: number;
    };
    colors?: string[];
    shapes?: Array<"square" | "circle">;
    zIndex?: number;
    disableForReducedMotion?: boolean;
  };

  export type ConfettiFunction = (options?: CreateTypes) => Promise<null> | null;

  const confetti: ConfettiFunction;
  export default confetti;
}
