export interface SkinDefinition {
  id: number;
  name: string;
  color: number;
}

export const SKINS: readonly SkinDefinition[] = [
  { id: 0, name: "Neon Blue", color: 0x7df9ff },
  { id: 1, name: "Peach", color: 0xffc98f },
  { id: 2, name: "Mint", color: 0x9fff9f },
  { id: 3, name: "Violet", color: 0xe4b5ff },
  { id: 4, name: "Coral", color: 0xff9ca8 },
  { id: 5, name: "Sunbeam", color: 0xffef96 },
  { id: 6, name: "Sky", color: 0xa8d0ff },
  { id: 7, name: "Aqua", color: 0xb4ffda },
  { id: 8, name: "Earth", color: 0x8b6a44 },
  { id: 9, name: "Chef", color: 0xf2f5f8 },
  { id: 10, name: "Mask", color: 0x2f2f3a }
];

const skinById = new Map<number, SkinDefinition>(SKINS.map((skin) => [skin.id, skin]));

export const DEFAULT_UNLOCKED_SKIN_IDS: readonly number[] = SKINS.map((skin) => skin.id);

export const getSkinColor = (skinId: number): number | null => {
  return skinById.get(skinId)?.color ?? null;
};

