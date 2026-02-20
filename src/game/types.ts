export type PlayerId = 0 | 1 | 2 | 3;

export interface Vector2 {
  x: number;
  y: number;
}

export interface PlayerInputState {
  left: boolean;
  right: boolean;
  jump: boolean;
  ability: boolean;
  joined: boolean;
}

export type PowerupType =
  | "HyperDash"
  | "BlinkStep"
  | "BounceBurst"
  | "WarpGate"
  | "IceMine"
  | "TagShield"
  | "PhaseCloak"
  | "ScoreSurge"
  | "LowGrav"
  | "SwapZap"
  | "TimeCrush"
  | "DecoyClone"
  | "RocketHop"
  | "EMPBurst";

export const POWERUP_TYPES: readonly PowerupType[] = [
  "HyperDash",
  "BlinkStep",
  "BounceBurst",
  "WarpGate",
  "IceMine",
  "TagShield",
  "PhaseCloak",
  "ScoreSurge",
  "LowGrav",
  "SwapZap",
  "TimeCrush",
  "DecoyClone",
  "RocketHop",
  "EMPBurst"
];

export interface PlayerModifiers {
  speedMultiplier: number;
  gravityMultiplier: number;
  slowMultiplier: number;
  shielded: boolean;
  phased: boolean;
  scoreSurge: boolean;
}

export interface PlayerEntity {
  id: PlayerId;
  isHuman: boolean;
  position: Vector2;
  velocity: Vector2;
  width: number;
  height: number;
  onGround: boolean;
  facing: -1 | 1;
  activePowerup: PowerupType | null;
  powerupCooldown: number;
  modifiers: PlayerModifiers;
  coyoteTimeMs: number;
  jumpBufferMs: number;
  jumpHeld: boolean;
}

export interface ActivePowerupPickup {
  id: number;
  type: PowerupType;
  position: Vector2;
  ttlMs: number;
}

export interface Mine {
  ownerId: PlayerId;
  position: Vector2;
  radius: number;
  ttlMs: number;
}

export interface EffectState {
  ownerId: PlayerId;
  type: PowerupType;
  remainingMs: number;
}

export interface Decoy {
  ownerId: PlayerId;
  position: Vector2;
  ttlMs: number;
}

export interface JumpLink {
  from: Vector2;
  to: Vector2;
}

export const createDefaultModifiers = (): PlayerModifiers => ({
  speedMultiplier: 1,
  gravityMultiplier: 1,
  slowMultiplier: 1,
  shielded: false,
  phased: false,
  scoreSurge: false
});
