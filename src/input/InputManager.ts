import { CleanupManager } from "../lifecycle/CleanupManager";
import { PlayerId, PlayerInputState } from "../game/types";

type ControlMode = "none" | "keyboard" | "gamepad";

interface KeyboardBinding {
  left: string;
  right: string;
  jump: string;
  ability: string;
}

interface PlayerSlot {
  mode: ControlMode;
  state: PlayerInputState;
}

const KEYBOARD_BINDINGS: Record<PlayerId, KeyboardBinding> = {
  0: { left: "KeyA", right: "KeyD", jump: "KeyW", ability: "KeyQ" },
  1: { left: "ArrowLeft", right: "ArrowRight", jump: "ArrowUp", ability: "Slash" },
  2: { left: "KeyJ", right: "KeyL", jump: "KeyI", ability: "KeyU" },
  3: { left: "KeyY", right: "KeyH", jump: "KeyG", ability: "KeyT" }
};

const PLAYER_IDS: readonly PlayerId[] = [0, 1, 2, 3];
type KeyboardAction = keyof KeyboardBinding;
const GAMEPAD_AXIS_DEADZONE = 0.35;

const createDefaultState = (): PlayerInputState => ({
  left: false,
  right: false,
  jump: false,
  ability: false,
  joined: false
});

export class InputManager {
  private readonly cleanup = new CleanupManager();
  private readonly keyLookup: Record<string, { playerId: PlayerId; action: KeyboardAction }> = {};
  private readonly slots: Record<PlayerId, PlayerSlot> = {
    0: { mode: "none", state: createDefaultState() },
    1: { mode: "none", state: createDefaultState() },
    2: { mode: "none", state: createDefaultState() },
    3: { mode: "none", state: createDefaultState() }
  };
  private readonly stateView: Record<PlayerId, PlayerInputState> = {
    0: createDefaultState(),
    1: createDefaultState(),
    2: createDefaultState(),
    3: createDefaultState()
  };
  private readonly gamepadAssignments = new Map<number, PlayerId>();

  constructor() {
    for (const playerId of PLAYER_IDS) {
      const binding = KEYBOARD_BINDINGS[playerId];
      this.keyLookup[binding.left] = { playerId, action: "left" };
      this.keyLookup[binding.right] = { playerId, action: "right" };
      this.keyLookup[binding.jump] = { playerId, action: "jump" };
      this.keyLookup[binding.ability] = { playerId, action: "ability" };
    }
    this.cleanup.addEventListener(window, "keydown", this.onKeyDown);
    this.cleanup.addEventListener(window, "keyup", this.onKeyUp);
    this.cleanup.addEventListener(window, "gamepaddisconnected", this.onGamepadDisconnected);
    this.cleanup.addEventListener(window, "blur", this.onBlur);
    this.cleanup.addDocumentListener(document, "visibilitychange", this.onVisibilityChange);
  }

  private releaseTransientInputs(): void {
    for (const playerId of PLAYER_IDS) {
      const state = this.slots[playerId].state;
      state.left = false;
      state.right = false;
      state.jump = false;
      state.ability = false;
    }
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    const match = this.keyLookup[event.code];
    if (match === undefined) {
      return;
    }
    event.preventDefault();

    const { playerId, action } = match;
    const slot = this.slots[playerId];
    if (slot.mode === "gamepad") {
      return;
    }

    slot.mode = "keyboard";
    slot.state.joined = true;
    slot.state[action] = true;
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    const match = this.keyLookup[event.code];
    if (match === undefined) {
      return;
    }
    event.preventDefault();

    const { playerId, action } = match;
    const slot = this.slots[playerId];
    if (slot.mode !== "keyboard") {
      return;
    }

    slot.state[action] = false;
  };

  private readonly onGamepadDisconnected = (event: GamepadEvent): void => {
    const playerId = this.gamepadAssignments.get(event.gamepad.index);
    if (playerId === undefined) {
      return;
    }
    const slot = this.slots[playerId];
    slot.mode = "none";
    slot.state.left = false;
    slot.state.right = false;
    slot.state.jump = false;
    slot.state.ability = false;
    slot.state.joined = false;
    this.gamepadAssignments.delete(event.gamepad.index);
  };

  private readonly onBlur = (): void => {
    this.releaseTransientInputs();
  };

  private readonly onVisibilityChange = (): void => {
    if (document.visibilityState !== "visible") {
      this.releaseTransientInputs();
    }
  };

  private assignGamepad(index: number): PlayerId | null {
    for (const playerId of PLAYER_IDS) {
      const slot = this.slots[playerId];
      if (slot.mode === "none") {
        slot.mode = "gamepad";
        slot.state.joined = true;
        this.gamepadAssignments.set(index, playerId);
        return playerId;
      }
    }
    return null;
  }

  update(): void {
    const gamepads = navigator.getGamepads();
    for (const gamepad of gamepads) {
      if (gamepad === null) {
        continue;
      }

      let playerId = this.gamepadAssignments.get(gamepad.index);
      const axisX = gamepad.axes[0] ?? 0;
      const left = axisX < -GAMEPAD_AXIS_DEADZONE || (gamepad.buttons[14]?.pressed ?? false);
      const right = axisX > GAMEPAD_AXIS_DEADZONE || (gamepad.buttons[15]?.pressed ?? false);
      const jump = gamepad.buttons[0]?.pressed ?? false;
      const ability = gamepad.buttons[1]?.pressed ?? false;

      if (playerId === undefined && (left || right || jump || ability)) {
        playerId = this.assignGamepad(gamepad.index) ?? undefined;
      }
      if (playerId === undefined) {
        continue;
      }

      const slot = this.slots[playerId];
      if (slot.mode !== "gamepad") {
        continue;
      }
      slot.state.left = left;
      slot.state.right = right;
      slot.state.jump = jump;
      slot.state.ability = ability;
    }
  }

  getPlayerStates(): Record<PlayerId, PlayerInputState> {
    this.stateView[0].left = this.slots[0].state.left;
    this.stateView[0].right = this.slots[0].state.right;
    this.stateView[0].jump = this.slots[0].state.jump;
    this.stateView[0].ability = this.slots[0].state.ability;
    this.stateView[0].joined = this.slots[0].state.joined;
    this.stateView[1].left = this.slots[1].state.left;
    this.stateView[1].right = this.slots[1].state.right;
    this.stateView[1].jump = this.slots[1].state.jump;
    this.stateView[1].ability = this.slots[1].state.ability;
    this.stateView[1].joined = this.slots[1].state.joined;
    this.stateView[2].left = this.slots[2].state.left;
    this.stateView[2].right = this.slots[2].state.right;
    this.stateView[2].jump = this.slots[2].state.jump;
    this.stateView[2].ability = this.slots[2].state.ability;
    this.stateView[2].joined = this.slots[2].state.joined;
    this.stateView[3].left = this.slots[3].state.left;
    this.stateView[3].right = this.slots[3].state.right;
    this.stateView[3].jump = this.slots[3].state.jump;
    this.stateView[3].ability = this.slots[3].state.ability;
    this.stateView[3].joined = this.slots[3].state.joined;
    return this.stateView;
  }

  getJoinedPlayers(): PlayerId[] {
    const joined: PlayerId[] = [];
    for (const playerId of PLAYER_IDS) {
      if (this.slots[playerId].state.joined) {
        joined.push(playerId);
      }
    }
    return joined;
  }

  destroy(): void {
    this.cleanup.cleanup();
    this.gamepadAssignments.clear();
  }
}
