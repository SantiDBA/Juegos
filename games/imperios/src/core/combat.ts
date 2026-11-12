

export type CombatClass = 'infanteria' | 'tirador' | 'caballeria' | 'blindado' | 'artilleria' | 'aereo' | 'edificio' | 'civil'

export interface AttackProfile {
  base: number
  bonusVs: Partial<Record<CombatClass, number>>
}

export interface DefenseProfile {
  combatClass: CombatClass[]
  armor: Partial<Record<CombatClass, number>>
}

export function computeDamage(a: AttackProfile, target: DefenseProfile): number {
  let dmg = a.base
  for (const cls of target.combatClass) {
    dmg += a.bonusVs[cls] ?? 0
    dmg -= target.armor[cls] ?? 0
  }
  return Math.max(1, dmg)
}

export const UNIT_COMBAT: Record<string, { attack: AttackProfile; defense: DefenseProfile }> = {
  ingeniero: {
    attack: { base: 4, bonusVs: {} },
    defense: { combatClass: ['civil'], armor: {} },
  },
  milicia: {
    attack: { base: 9, bonusVs: { infanteria: 4 } },
    defense: { combatClass: ['infanteria'], armor: { tirador: 1 } },
  },
  lancero: {
    attack: { base: 7, bonusVs: { caballeria: 12, blindado: 8 } },
    defense: { combatClass: ['infanteria'], armor: { tirador: 1 } },
  },
  jinete: {
    attack: { base: 8, bonusVs: { tirador: 5, artilleria: 6 } },
    defense: { combatClass: ['caballeria'], armor: { infanteria: 1 } },
  },
  fusilero: {
    attack: { base: 8, bonusVs: { infanteria: 5 } },
    defense: { combatClass: ['tirador'], armor: {} },
  },
  husar: {
    attack: { base: 11, bonusVs: { tirador: 7, artilleria: 9 } },
    defense: { combatClass: ['caballeria'], armor: { infanteria: 1 } },
  },
  granadero: {
    attack: { base: 10, bonusVs: { infanteria: 6, edificio: 10 } },
    defense: { combatClass: ['infanteria'], armor: { tirador: 1 } },
  },
  canon: {
    attack: { base: 18, bonusVs: { edificio: 14, infanteria: 6 } },
    defense: { combatClass: ['artilleria'], armor: {} },
  },
  inf_mecanizada: {
    attack: { base: 12, bonusVs: { infanteria: 6, tirador: 3 } },
    defense: { combatClass: ['infanteria'], armor: { tirador: 2 } },
  },
  cazacarros: {
    attack: { base: 10, bonusVs: { blindado: 22, caballeria: 10 } },
    defense: { combatClass: ['infanteria'], armor: { tirador: 1 } },
  },
  blindado: {
    attack: { base: 16, bonusVs: { tirador: 6, infanteria: 4 } },
    defense: { combatClass: ['blindado'], armor: { infanteria: 3, tirador: 4 } },
  },
  tanque: {
    attack: { base: 22, bonusVs: { tirador: 8, artilleria: 10, edificio: 6 } },
    defense: { combatClass: ['blindado'], armor: { tirador: 6, infanteria: 3 } },
  },
  obus: {
    attack: { base: 26, bonusVs: { edificio: 18, infanteria: 8 } },
    defense: { combatClass: ['artilleria'], armor: {} },
  },
  francotirador: {
    attack: { base: 20, bonusVs: { tirador: 12, infanteria: 6 } },
    defense: { combatClass: ['tirador'], armor: {} },
  },
  inf_exo: {
    attack: { base: 16, bonusVs: { infanteria: 8, blindado: 5 } },
    defense: { combatClass: ['infanteria'], armor: { tirador: 3, infanteria: 2 } },
  },
  tanque_autonomo: {
    attack: { base: 26, bonusVs: { blindado: 10, artilleria: 12, tirador: 10 } },
    defense: { combatClass: ['blindado'], armor: { tirador: 8, infanteria: 5 } },
  },
  dron: {
    attack: { base: 18, bonusVs: { artilleria: 12, infanteria: 8, edificio: 4 } },
    defense: { combatClass: ['aereo'], armor: {} },
  },
  mlrs: {
    attack: { base: 30, bonusVs: { edificio: 22, artilleria: 12 } },
    defense: { combatClass: ['artilleria'], armor: {} },
  },
}
