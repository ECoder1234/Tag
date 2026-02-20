import { MapData } from "./map/MapSchema";
import { clamp } from "../util/RuntimeGuard";
import { PlayerEntity, PlayerInputState } from "./types";

export class Physics {
  static readonly gravity = 1800;
  static readonly moveSpeed = 172;
  static readonly jumpSpeed = 520;
  static readonly groundAcceleration = 1900;
  static readonly airAcceleration = 1060;
  static readonly groundDeceleration = 2300;
  static readonly airDeceleration = 760;
  static readonly coyoteTimeMs = 110;
  static readonly jumpBufferMs = 110;
  static readonly maxFallSpeed = 980;
  static readonly fallGravityMultiplier = 1.15;
  static readonly jumpCutGravityMultiplier = 1.55;
  static readonly jumpReleaseDamp = 0.9;
  private static readonly maxMoveStepPx = 2;
  private static readonly solidCache = new WeakMap<MapData, Set<number>>();
  private static cachedMap: MapData | null = null;
  private static cachedTileSize = 16;
  private static cachedGridWidth = 0;
  private static cachedGridHeight = 0;
  private static cachedWorldWidth = 0;
  private static cachedWorldHeight = 0;

  private static getSolidSet(map: MapData): Set<number> {
    const cached = this.solidCache.get(map);
    if (cached !== undefined) {
      return cached;
    }

    const set = new Set<number>();
    for (const tile of map.solidTiles) {
      set.add(tile.y * map.gridWidth + tile.x);
    }
    this.solidCache.set(map, set);
    return set;
  }

  private static hasSolidAt(map: MapData, tileX: number, tileY: number): boolean {
    if (tileX < 0 || tileX >= this.cachedGridWidth || tileY < 0 || tileY >= this.cachedGridHeight) {
      return false;
    }
    return this.getSolidSet(map).has(tileY * this.cachedGridWidth + tileX);
  }

  private static collides(map: MapData, x: number, y: number, width: number, height: number): boolean {
    const halfWidth = width * 0.5;
    const invTileSize = 1 / this.cachedTileSize;
    const left = Math.floor((x - halfWidth) * invTileSize);
    const right = Math.floor((x + halfWidth - 1) * invTileSize);
    const top = Math.floor((y - height) * invTileSize);
    const bottom = Math.floor((y - 1) * invTileSize);

    for (let tileY = top; tileY <= bottom; tileY += 1) {
      for (let tileX = left; tileX <= right; tileX += 1) {
        if (this.hasSolidAt(map, tileX, tileY)) {
          return true;
        }
      }
    }
    return false;
  }

  private static resolveHorizontal(entity: PlayerEntity, map: MapData, deltaSec: number): void {
    const deltaX = entity.velocity.x * deltaSec;
    if (deltaX === 0) {
      return;
    }

    const direction = Math.sign(deltaX);
    const steps = Math.max(1, Math.ceil(Math.abs(deltaX) / this.maxMoveStepPx));
    const step = deltaX / steps;

    for (let index = 0; index < steps; index += 1) {
      const x = entity.position.x;
      const candidate = x + step;
      if (this.collides(map, candidate, entity.position.y, entity.width, entity.height)) {
        entity.position.x = x;
        entity.velocity.x = 0;
        return;
      }
      entity.position.x = candidate;
    }

    entity.position.x = clamp(entity.position.x, entity.width / 2, this.cachedWorldWidth - entity.width / 2);
    if (direction !== Math.sign(entity.velocity.x) && entity.velocity.x !== 0) {
      entity.velocity.x = 0;
    }
  }

  private static resolveVertical(entity: PlayerEntity, map: MapData, deltaSec: number): void {
    const deltaY = entity.velocity.y * deltaSec;
    if (deltaY === 0) {
      return;
    }

    const direction = Math.sign(deltaY);
    entity.onGround = false;
    const steps = Math.max(1, Math.ceil(Math.abs(deltaY) / this.maxMoveStepPx));
    const step = deltaY / steps;

    for (let index = 0; index < steps; index += 1) {
      const y = entity.position.y;
      const candidate = y + step;
      if (this.collides(map, entity.position.x, candidate, entity.width, entity.height)) {
        if (direction > 0) {
          entity.onGround = true;
        }
        entity.position.y = y;
        entity.velocity.y = 0;
        return;
      }
      entity.position.y = candidate;
    }

    entity.position.y = clamp(entity.position.y, entity.height, this.cachedWorldHeight + entity.height);
  }

  static step(entity: PlayerEntity, input: PlayerInputState, map: MapData, deltaMs: number): void {
    if (this.cachedMap !== map) {
      this.cachedMap = map;
      this.cachedTileSize = map.tileSize;
      this.cachedGridWidth = map.gridWidth;
      this.cachedGridHeight = map.gridHeight;
      this.cachedWorldWidth = map.worldWidth;
      this.cachedWorldHeight = map.worldHeight;
    }
    const deltaSec = deltaMs / 1000;
    const horizontal = (input.left ? -1 : 0) + (input.right ? 1 : 0);
    const speedScale = entity.modifiers.speedMultiplier * entity.modifiers.slowMultiplier;
    const targetSpeed = horizontal * Physics.moveSpeed * speedScale;
    const acceleration = entity.onGround ? Physics.groundAcceleration : Physics.airAcceleration;
    const deceleration = entity.onGround ? Physics.groundDeceleration : Physics.airDeceleration;
    const speedDelta = targetSpeed - entity.velocity.x;
    if (horizontal !== 0) {
      const accelStep = acceleration * deltaSec;
      if (Math.abs(speedDelta) <= accelStep) {
        entity.velocity.x = targetSpeed;
      } else {
        entity.velocity.x += Math.sign(speedDelta) * accelStep;
      }
    } else {
      const decelStep = deceleration * deltaSec;
      if (Math.abs(entity.velocity.x) <= decelStep) {
        entity.velocity.x = 0;
      } else {
        entity.velocity.x -= Math.sign(entity.velocity.x) * decelStep;
      }
    }

    if (horizontal !== 0) {
      entity.facing = horizontal < 0 ? -1 : 1;
    }

    entity.coyoteTimeMs = Math.max(0, entity.coyoteTimeMs - deltaMs);
    entity.jumpBufferMs = Math.max(0, entity.jumpBufferMs - deltaMs);
    if (input.jump && !entity.jumpHeld) {
      entity.jumpBufferMs = Physics.jumpBufferMs;
    }
    entity.jumpHeld = input.jump;

    const canJump = entity.onGround || entity.coyoteTimeMs > 0;
    if (entity.jumpBufferMs > 0 && canJump) {
      entity.velocity.y = -Physics.jumpSpeed;
      entity.onGround = false;
      entity.coyoteTimeMs = 0;
      entity.jumpBufferMs = 0;
    }

    let gravityScale = entity.modifiers.gravityMultiplier * entity.modifiers.slowMultiplier;
    if (entity.velocity.y > 0) {
      gravityScale *= Physics.fallGravityMultiplier;
    } else if (!input.jump) {
      gravityScale *= Physics.jumpCutGravityMultiplier;
      if (entity.velocity.y < -Physics.jumpSpeed * 0.35) {
        entity.velocity.y *= Physics.jumpReleaseDamp;
      }
    }

    entity.velocity.y += Physics.gravity * gravityScale * deltaSec;
    entity.velocity.y = Math.min(entity.velocity.y, Physics.maxFallSpeed * entity.modifiers.slowMultiplier);

    this.resolveHorizontal(entity, map, deltaSec);
    this.resolveVertical(entity, map, deltaSec);

    const feetY = entity.position.y + 1;
    const grounded =
      entity.onGround ||
      this.collides(map, entity.position.x, feetY, entity.width, entity.height);
    entity.onGround = grounded;
    if (grounded) {
      entity.coyoteTimeMs = Physics.coyoteTimeMs;
    }
  }
}
