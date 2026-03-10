import type { SealedProductType } from "./types";

export type PokemonGalleryTypeOption = {
  key: string;
  label: string;
  canonicalType: SealedProductType;
};

const TYPE_RULES: Array<PokemonGalleryTypeOption & { patterns: RegExp[] }> = [
  {
    key: "ULTRA_PREMIUM_COLLECTION",
    label: "Ultra-Premium Collection",
    canonicalType: "COLLECTION_BOX",
    patterns: [/ultra[-\s]?premium collection/i],
  },
  {
    key: "PREMIUM_COLLECTION",
    label: "Premium Collection",
    canonicalType: "COLLECTION_BOX",
    patterns: [/premium collection/i],
  },
  {
    key: "PREMIUM_BOX",
    label: "Premium Box",
    canonicalType: "COLLECTION_BOX",
    patterns: [/premium box/i],
  },
  {
    key: "BOOSTER_BOX",
    label: "Booster Box",
    canonicalType: "BOOSTER_BOX",
    patterns: [/booster box/i],
  },
  {
    key: "BOOSTER_BUNDLE",
    label: "Booster Bundle",
    canonicalType: "OTHER",
    patterns: [/booster bundle/i],
  },
  {
    key: "POKEMON_CENTER_ETB",
    label: "Pokemon Center ETB",
    canonicalType: "ELITE_TRAINER_BOX",
    patterns: [/pokemon center.*elite trainer box/i, /pokemon center.*\betb\b/i],
  },
  {
    key: "ELITE_TRAINER_BOX",
    label: "Elite Trainer Box",
    canonicalType: "ELITE_TRAINER_BOX",
    patterns: [/elite trainer box/i, /\betb\b/i],
  },
  {
    key: "BUILD_BATTLE_STADIUM",
    label: "Build & Battle Stadium",
    canonicalType: "COLLECTION_BOX",
    patterns: [/build\s*(?:&|and)\s*battle stadium/i],
  },
  {
    key: "BUILD_BATTLE_BOX",
    label: "Build & Battle Box",
    canonicalType: "COLLECTION_BOX",
    patterns: [/build\s*(?:&|and)\s*battle box/i],
  },
  {
    key: "LEAGUE_BATTLE_DECK",
    label: "League Battle Deck",
    canonicalType: "OTHER",
    patterns: [/league battle deck/i],
  },
  {
    key: "BATTLE_DECK",
    label: "Battle Deck",
    canonicalType: "OTHER",
    patterns: [/battle deck/i],
  },
  {
    key: "BATTLE_ACADEMY",
    label: "Battle Academy",
    canonicalType: "OTHER",
    patterns: [/battle academy/i],
  },
  {
    key: "TRAINERS_TOOLKIT",
    label: "Trainer's Toolkit",
    canonicalType: "OTHER",
    patterns: [/trainer'?s toolkit/i, /trainers toolkit/i],
  },
  {
    key: "BOOSTER_PACK",
    label: "Booster Pack",
    canonicalType: "BLISTER",
    patterns: [/booster pack/i, /sleeved booster/i],
  },
  {
    key: "BLISTER",
    label: "Blister",
    canonicalType: "BLISTER",
    patterns: [/checklane blister/i, /three[-\s]?pack blister/i, /blister/i],
  },
  {
    key: "MINI_TIN",
    label: "Mini Tin",
    canonicalType: "TIN",
    patterns: [/mini tin/i],
  },
  {
    key: "TIN",
    label: "Tin",
    canonicalType: "TIN",
    patterns: [/\btin\b/i],
  },
  {
    key: "BINDER_COLLECTION",
    label: "Binder Collection",
    canonicalType: "COLLECTION_BOX",
    patterns: [/binder collection/i],
  },
  {
    key: "POSTER_COLLECTION",
    label: "Poster Collection",
    canonicalType: "COLLECTION_BOX",
    patterns: [/poster collection/i],
  },
  {
    key: "FIGURE_COLLECTION",
    label: "Figure Collection",
    canonicalType: "COLLECTION_BOX",
    patterns: [/figure collection/i],
  },
  {
    key: "PIN_COLLECTION",
    label: "Pin Collection",
    canonicalType: "COLLECTION_BOX",
    patterns: [/pin collection/i],
  },
  {
    key: "PLAYMAT_COLLECTION",
    label: "Playmat Collection",
    canonicalType: "COLLECTION_BOX",
    patterns: [/playmat collection/i],
  },
  {
    key: "LUNCHBOX",
    label: "Lunchbox",
    canonicalType: "OTHER",
    patterns: [/lunchbox/i],
  },
  {
    key: "ACCESSORY_POUCH",
    label: "Accessory Pouch",
    canonicalType: "OTHER",
    patterns: [/accessory pouch/i],
  },
  {
    key: "PORTFOLIO",
    label: "Portfolio",
    canonicalType: "OTHER",
    patterns: [/mini portfolio/i, /\bportfolio\b/i],
  },
  {
    key: "CALENDAR",
    label: "Calendar",
    canonicalType: "OTHER",
    patterns: [/calendar/i],
  },
  {
    key: "COLLECTION_BOX",
    label: "Collection Box",
    canonicalType: "COLLECTION_BOX",
    patterns: [/ex box/i, /\bv box\b/i, /collection/i, /\bbox\b/i],
  },
];

export const DEFAULT_GALLERY_TYPE_OPTIONS: PokemonGalleryTypeOption[] = [
  { key: "BOOSTER_BOX", label: "Booster Box", canonicalType: "BOOSTER_BOX" },
  { key: "BOOSTER_BUNDLE", label: "Booster Bundle", canonicalType: "OTHER" },
  { key: "ELITE_TRAINER_BOX", label: "Elite Trainer Box", canonicalType: "ELITE_TRAINER_BOX" },
  { key: "POKEMON_CENTER_ETB", label: "Pokemon Center ETB", canonicalType: "ELITE_TRAINER_BOX" },
  { key: "BOOSTER_PACK", label: "Booster Pack", canonicalType: "BLISTER" },
  { key: "BLISTER", label: "Blister", canonicalType: "BLISTER" },
  { key: "COLLECTION_BOX", label: "Collection Box", canonicalType: "COLLECTION_BOX" },
  { key: "TIN", label: "Tin", canonicalType: "TIN" },
  { key: "OTHER", label: "Other", canonicalType: "OTHER" },
];

export function classifyPokemonGalleryProduct(name: string): PokemonGalleryTypeOption {
  for (const rule of TYPE_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(name))) {
      return {
        key: rule.key,
        label: rule.label,
        canonicalType: rule.canonicalType,
      };
    }
  }

  return {
    key: "OTHER",
    label: "Other",
    canonicalType: "OTHER",
  };
}
