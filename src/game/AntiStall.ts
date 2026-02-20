import { TagSystem } from "./TagSystem";
import { PlayerId } from "./types";

export class AntiStall {
  private elapsedMs = 0;
  private readonly sortedPlayers: PlayerId[] = [];

  update(deltaMs: number, joinedPlayers: PlayerId[], tagSystem: TagSystem): PlayerId | null {
    this.elapsedMs += deltaMs;
    if (this.elapsedMs < 20000 || joinedPlayers.length <= 1) {
      return null;
    }

    this.elapsedMs = 0;
    const totalWindowMs = tagSystem.getWindowTotal(joinedPlayers);

    if (totalWindowMs <= 0) {
      tagSystem.resetWindowHoldTimes();
      return null;
    }

    const currentIt = tagSystem.getItPlayerId();
    const itRatio = tagSystem.getWindowHoldTime(currentIt) / totalWindowMs;
    if (itRatio <= 0.5) {
      tagSystem.resetWindowHoldTimes();
      return null;
    }

    this.sortedPlayers.length = 0;
    for (const playerId of joinedPlayers) {
      this.sortedPlayers.push(playerId);
    }
    this.sortedPlayers.sort((a, b) => a - b);

    let lowestOpponent: PlayerId | null = null;
    let lowestHold = Number.POSITIVE_INFINITY;

    for (const playerId of this.sortedPlayers) {
      if (playerId === currentIt) {
        continue;
      }
      const holdTime = tagSystem.getWindowHoldTime(playerId);
      if (holdTime < lowestHold) {
        lowestHold = holdTime;
        lowestOpponent = playerId;
      }
    }

    tagSystem.resetWindowHoldTimes();
    if (lowestOpponent === null) {
      return null;
    }

    return tagSystem.forceAssignIt(lowestOpponent) ? lowestOpponent : null;
  }
}
