import { MapData } from "../map/MapSchema";
import {
  ActivePowerupPickup,
  Decoy,
  EffectState,
  Mine,
  POWERUP_TYPES,
  PlayerEntity,
  PlayerId,
  PowerupType
} from "../types";

const PLAYER_IDS: readonly PlayerId[] = [0, 1, 2, 3];

export class PowerupSystem {
  private static readonly PICKUP_TTL_MS = 30000;
  private static readonly USE_COOLDOWN_MS: Record<PowerupType, number> = {
    HyperDash: 550,
    BlinkStep: 450,
    BounceBurst: 420,
    WarpGate: 900,
    IceMine: 700,
    TagShield: 500,
    PhaseCloak: 550,
    ScoreSurge: 500,
    LowGrav: 500,
    SwapZap: 850,
    TimeCrush: 700,
    DecoyClone: 650,
    RocketHop: 450,
    EMPBurst: 800
  };
  private static readonly SPAWN_WEIGHTS: Record<PowerupType, number> = {
    HyperDash: 2.2,
    BlinkStep: 2.6,
    BounceBurst: 3.2,
    WarpGate: 3.2,
    IceMine: 0.8,
    TagShield: 1.5,
    PhaseCloak: 1.0,
    ScoreSurge: 0.9,
    LowGrav: 2.1,
    SwapZap: 1.1,
    TimeCrush: 0.8,
    DecoyClone: 0.7,
    RocketHop: 2.4,
    EMPBurst: 0.7
  };
  private static readonly EFFECT_DURATIONS_MS: Record<
    "HyperDash" | "TagShield" | "PhaseCloak" | "ScoreSurge" | "LowGrav" | "TimeCrush",
    number
  > = {
    HyperDash: 3000,
    TagShield: 2600,
    PhaseCloak: 2600,
    ScoreSurge: 3200,
    LowGrav: 3400,
    TimeCrush: 2800
  };
  private seed: number;
  private spawnTimerMs = 0;
  private pickupId = 1;
  private readonly pickups: ActivePowerupPickup[] = [];
  private readonly effects: EffectState[] = [];
  private readonly mines: Mine[] = [];
  private readonly decoys: Decoy[] = [];
  private readonly squaredMineRadius = 24 * 24;

  constructor(seed = 321) {
    this.seed = seed;
  }

  private random(): number {
    this.seed = (1664525 * this.seed + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }

  private randomPowerup(): PowerupType {
    const index = Math.floor(this.random() * POWERUP_TYPES.length);
    /* c8 ignore next 3 -- guarded fallback for empty compile-time constant list */
    const selected = POWERUP_TYPES[index] ?? POWERUP_TYPES[0];
    if (selected === undefined) {
      throw new Error("No powerups configured");
    }
    return selected;
  }

  private pickSpawnPowerupType(): PowerupType {
    const activeTypes = new Set<PowerupType>(this.pickups.map((pickup) => pickup.type));
    const candidates = POWERUP_TYPES.filter((type) => !activeTypes.has(type));
    if (candidates.length === 0) {
      return this.randomPowerup();
    }
    let totalWeight = 0;
    for (const type of candidates) {
      totalWeight += PowerupSystem.SPAWN_WEIGHTS[type];
    }
    if (totalWeight <= 0) {
      return candidates[0] ?? this.randomPowerup();
    }
    let roll = this.random() * totalWeight;
    for (const type of candidates) {
      roll -= PowerupSystem.SPAWN_WEIGHTS[type];
      if (roll <= 0) {
        return type;
      }
    }
    return candidates[candidates.length - 1] ?? this.randomPowerup();
  }

  private spawnPickup(map: MapData): void {
    if (this.pickups.length >= 3) {
      return;
    }

    const spawnIndex = Math.floor(this.random() * map.spawnTiles.length);
    const tile = map.spawnTiles[spawnIndex] ?? map.spawnTiles[0];
    /* c8 ignore next 2 -- map schema guarantees at least one spawn tile */
    if (tile === undefined) {
      return;
    }
    this.pickups.push({
      id: this.pickupId,
      type: this.pickSpawnPowerupType(),
      position: {
        x: tile.x * map.tileSize + map.tileSize / 2,
        y: tile.y * map.tileSize - 8
      },
      ttlMs: PowerupSystem.PICKUP_TTL_MS
    });
    this.pickupId += 1;
  }

  private upsertEffect(ownerId: PlayerId, type: PowerupType, remainingMs: number): void {
    for (let index = 0; index < this.effects.length; index += 1) {
      const effect = this.effects[index];
      if (effect !== undefined && effect.ownerId === ownerId && effect.type === type) {
        effect.remainingMs = remainingMs;
        return;
      }
    }
    this.effects.push({ ownerId, type, remainingMs });
  }

  private resetModifiers(players: Record<PlayerId, PlayerEntity>): void {
    for (const playerId of PLAYER_IDS) {
      const modifiers = players[playerId].modifiers;
      modifiers.speedMultiplier = 1;
      modifiers.gravityMultiplier = 1;
      modifiers.slowMultiplier = 1;
      modifiers.shielded = false;
      modifiers.phased = false;
      modifiers.scoreSurge = false;
    }
  }

  private applyEffects(players: Record<PlayerId, PlayerEntity>): void {
    this.resetModifiers(players);

    for (const effect of this.effects) {
      const owner = players[effect.ownerId];
      switch (effect.type) {
        case "HyperDash":
          owner.modifiers.speedMultiplier *= 1.8;
          break;
        case "TagShield":
          owner.modifiers.shielded = true;
          break;
        case "PhaseCloak":
          owner.modifiers.phased = true;
          break;
        case "ScoreSurge":
          owner.modifiers.scoreSurge = true;
          break;
        case "LowGrav":
          owner.modifiers.gravityMultiplier *= 0.6;
          break;
        case "TimeCrush":
          for (const playerId of PLAYER_IDS) {
            if (playerId !== effect.ownerId) {
              players[playerId].modifiers.slowMultiplier *= 0.75;
            }
          }
          break;
        /* c8 ignore next 2 -- exhaustive by PowerupType union */
        default:
          break;
      }
    }
  }

  private updateMineImpacts(deltaMs: number, players: Record<PlayerId, PlayerEntity>): void {
    for (let index = this.mines.length - 1; index >= 0; index -= 1) {
      const mine = this.mines[index];
      /* c8 ignore next 3 -- defensive sparse-array guard */
      if (mine === undefined) {
        continue;
      }
      mine.ttlMs -= deltaMs;
      if (mine.ttlMs <= 0) {
        this.mines.splice(index, 1);
        continue;
      }

      for (const playerId of PLAYER_IDS) {
        if (playerId === mine.ownerId) {
          continue;
        }
        const player = players[playerId];
        const dx = player.position.x - mine.position.x;
        const dy = player.position.y - mine.position.y;
        if (dx * dx + dy * dy <= this.squaredMineRadius) {
          this.upsertEffect(playerId, "TimeCrush", 1000);
          this.mines.splice(index, 1);
          break;
        }
      }
    }
  }

  private updateDecoys(deltaMs: number): void {
    for (let index = this.decoys.length - 1; index >= 0; index -= 1) {
      const decoy = this.decoys[index];
      /* c8 ignore next 3 -- defensive sparse-array guard */
      if (decoy === undefined) {
        continue;
      }
      decoy.ttlMs -= deltaMs;
      if (decoy.ttlMs <= 0) {
        this.decoys.splice(index, 1);
      }
    }
  }

  private pickUp(players: Record<PlayerId, PlayerEntity>): void {
    for (let index = this.pickups.length - 1; index >= 0; index -= 1) {
      const pickup = this.pickups[index];
      /* c8 ignore next 3 -- defensive sparse-array guard */
      if (pickup === undefined) {
        continue;
      }
      let consumed = false;
      for (const playerId of PLAYER_IDS) {
        const player = players[playerId];
        if (player.activePowerup !== null) {
          continue;
        }
        const dx = Math.abs(player.position.x - pickup.position.x);
        const dy = Math.abs(player.position.y - pickup.position.y);
        if (dx <= 14 && dy <= 20) {
          player.activePowerup = pickup.type;
          consumed = true;
          break;
        }
      }
      if (consumed) {
        this.pickups.splice(index, 1);
      }
    }
  }

  private updatePickupLifetimes(deltaMs: number): void {
    for (let index = this.pickups.length - 1; index >= 0; index -= 1) {
      const pickup = this.pickups[index];
      if (pickup === undefined) {
        continue;
      }
      pickup.ttlMs -= deltaMs;
      if (pickup.ttlMs <= 0) {
        this.pickups.splice(index, 1);
      }
    }
  }

  update(deltaMs: number, players: Record<PlayerId, PlayerEntity>, map: MapData): void {
    this.updatePickupLifetimes(deltaMs);

    this.spawnTimerMs += deltaMs;
    while (this.spawnTimerMs >= 8000) {
      this.spawnTimerMs -= 8000;
      this.spawnPickup(map);
    }

    for (let index = this.effects.length - 1; index >= 0; index -= 1) {
      const effect = this.effects[index];
      /* c8 ignore next 3 -- defensive sparse-array guard */
      if (effect === undefined) {
        continue;
      }
      effect.remainingMs -= deltaMs;
      if (effect.remainingMs <= 0) {
        this.effects.splice(index, 1);
      }
    }

    this.updateMineImpacts(deltaMs, players);
    this.updateDecoys(deltaMs);

    for (const playerId of PLAYER_IDS) {
      players[playerId].powerupCooldown = Math.max(0, players[playerId].powerupCooldown - deltaMs);
    }

    this.applyEffects(players);
    this.pickUp(players);
  }

  tryUsePowerup(
    playerId: PlayerId,
    players: Record<PlayerId, PlayerEntity>,
    currentIt: PlayerId,
    map?: MapData
  ): PlayerId {
    const player = players[playerId];
    const powerup = player.activePowerup;
    if (powerup === null || player.powerupCooldown > 0) {
      return currentIt;
    }

    player.activePowerup = null;
    player.powerupCooldown = PowerupSystem.USE_COOLDOWN_MS[powerup];

    switch (powerup) {
      case "HyperDash":
      case "TagShield":
      case "PhaseCloak":
      case "ScoreSurge":
      case "LowGrav":
        this.upsertEffect(playerId, powerup, PowerupSystem.EFFECT_DURATIONS_MS[powerup]);
        break;
      case "BlinkStep":
        player.position.x += player.facing * 64;
        player.position.x = Math.max(8, Math.min(632, player.position.x));
        break;
      case "BounceBurst":
        player.velocity.y = Math.min(player.velocity.y, -760);
        player.velocity.x += player.facing * 85;
        break;
      case "WarpGate": {
        if (map !== undefined && map.spawnTiles.length > 0) {
          const spawnIndex = Math.floor(this.random() * map.spawnTiles.length);
          const tile = map.spawnTiles[spawnIndex] ?? map.spawnTiles[0];
          if (tile !== undefined) {
            player.position.x = tile.x * map.tileSize + map.tileSize / 2;
            player.position.y = tile.y * map.tileSize - 8;
            player.velocity.x = 0;
            player.velocity.y = 0;
          }
        } else {
          player.position.x = Math.max(8, Math.min(632, player.position.x + player.facing * 120));
        }
        break;
      }
      case "IceMine":
        this.mines.push({
          ownerId: playerId,
          position: { x: player.position.x, y: player.position.y },
          radius: 24,
          ttlMs: 6000
        });
        break;
      case "SwapZap": {
        const itPlayer = players[currentIt];
        const swapX = player.position.x;
        const swapY = player.position.y;
        player.position.x = itPlayer.position.x;
        player.position.y = itPlayer.position.y;
        itPlayer.position.x = swapX;
        itPlayer.position.y = swapY;
        return playerId;
      }
      case "TimeCrush":
        this.upsertEffect(playerId, "TimeCrush", PowerupSystem.EFFECT_DURATIONS_MS.TimeCrush);
        break;
      case "DecoyClone":
        this.decoys.push({
          ownerId: playerId,
          position: { x: player.position.x + player.facing * 20, y: player.position.y },
          ttlMs: 5000
        });
        break;
      case "RocketHop":
        player.velocity.y = -700;
        break;
      case "EMPBurst":
        for (let index = this.effects.length - 1; index >= 0; index -= 1) {
          const effect = this.effects[index];
          if (effect !== undefined && effect.ownerId !== playerId) {
            this.effects.splice(index, 1);
          }
        }
        break;
    }

    return currentIt;
  }

  clearRound(players: Record<PlayerId, PlayerEntity>): void {
    this.spawnTimerMs = 0;
    this.pickups.length = 0;
    this.effects.length = 0;
    this.mines.length = 0;
    this.decoys.length = 0;

    for (const playerId of PLAYER_IDS) {
      players[playerId].activePowerup = null;
      players[playerId].powerupCooldown = 0;
      const modifiers = players[playerId].modifiers;
      modifiers.speedMultiplier = 1;
      modifiers.gravityMultiplier = 1;
      modifiers.slowMultiplier = 1;
      modifiers.shielded = false;
      modifiers.phased = false;
      modifiers.scoreSurge = false;
    }
  }

  getPickups(): readonly ActivePowerupPickup[] {
    return this.pickups;
  }
}
