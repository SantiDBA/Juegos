import type { BuildingDef, EraDef, ResourceKey, Resources, TechDef, UnitDef } from './types'

export const MAP_SIZE = 180
export const TILE = 2
export const GRID = MAP_SIZE / TILE

export const START_RESOURCES: Resources = {
  suministros: 300,
  materiales: 300,
  combustible: 120,
  minerales: 120,
}

export const ERAS: EraDef[] = [
  { id: 1, name: 'Era del Vapor', years: '1800-1870', advanceCost: {}, advanceTime: 0 },
  { id: 2, name: 'Era del Acero', years: '1870-1945', advanceCost: { suministros: 500, combustible: 200 }, advanceTime: 45 },
  { id: 3, name: 'Era del Motor', years: '1945-2000', advanceCost: { suministros: 700, combustible: 450, minerales: 200 }, advanceTime: 60 },
  { id: 4, name: 'Era Autónoma', years: '2000-2100', advanceCost: { combustible: 800, minerales: 700, suministros: 400 }, advanceTime: 75 },
]

export const UNIT_DEFS: Record<string, UnitDef> = {
  ingeniero: {
    type: 'ingeniero', name: 'Ingeniero', hp: 45, speed: 5.2, range: 1.6, damage: 4, attackCooldown: 1.2,
    sight: 18, cost: { suministros: 50 }, trainTime: 16, era: 1, role: 'economy', gatherRate: 10, carry: 20,
  },
  milicia: {
    type: 'milicia', name: 'Milicia Industrial', hp: 70, speed: 5.0, range: 1.7, damage: 9, attackCooldown: 1.1,
    sight: 16, cost: { suministros: 60, materiales: 20 }, trainTime: 18, era: 1, role: 'infantry',
    counters: 'Económica y versátil; débil ante fuego a distancia.',
  },
  fusilero: {
    type: 'fusilero', name: 'Fusilero', hp: 55, speed: 4.8, range: 8.5, damage: 8, attackCooldown: 1.4,
    sight: 20, cost: { suministros: 55, combustible: 25 }, trainTime: 22, era: 2, role: 'ranged',
    counters: 'Fuerte vs infantería; débil ante vehículos.',
  },
  blindado: {
    type: 'blindado', name: 'Blindado Ligero', hp: 170, speed: 6.6, range: 2.0, damage: 16, attackCooldown: 1.5,
    sight: 18, cost: { combustible: 90, materiales: 60 }, trainTime: 30, era: 2, role: 'vehicle',
    counters: 'Rápido y fuerte vs fusileros; débil ante concentración y artillería.',
  },
  granadero: {
    type: 'granadero', name: 'Granadero', hp: 85, speed: 4.6, range: 2.2, damage: 10, attackCooldown: 1.5,
    sight: 15, cost: { suministros: 70, materiales: 30 }, trainTime: 22, era: 1, role: 'infantry',
    counters: 'Fuerte vs infantería y edificios; débil a distancia.',
  },
  canon: {
    type: 'canon', name: 'Cañón de Asedio', hp: 120, speed: 2.8, range: 14, damage: 18, attackCooldown: 2.8,
    sight: 18, cost: { materiales: 120, combustible: 60 }, trainTime: 32, era: 2, role: 'vehicle',
    counters: 'Devastador vs edificios e infantería; muy lento y vulnerable de cerca.',
  },
  francotirador: {
    type: 'francotirador', name: 'Francotirador', hp: 45, speed: 4.4, range: 13, damage: 20, attackCooldown: 2.2,
    sight: 24, cost: { suministros: 80, combustible: 40 }, trainTime: 26, era: 3, role: 'ranged',
    counters: 'Alcance extremo vs tiradores e infantería; muy frágil.',
  },
  inf_mecanizada: {
    type: 'inf_mecanizada', name: 'Infantería Mecanizada', hp: 120, speed: 5.6, range: 8, damage: 12, attackCooldown: 1.2,
    sight: 20, cost: { suministros: 90, combustible: 60 }, trainTime: 26, era: 3, role: 'infantry',
    counters: 'Versátil y rápida; débil ante blindados y artillería.',
  },
  tanque: {
    type: 'tanque', name: 'Tanque Medio', hp: 320, speed: 5.2, range: 6.5, damage: 22, attackCooldown: 1.9,
    sight: 18, cost: { combustible: 160, materiales: 120 }, trainTime: 38, era: 3, role: 'vehicle',
    counters: 'Dominante en campo abierto; débil ante cazacarros.',
  },
  cazacarros: {
    type: 'cazacarros', name: 'Cazacarros', hp: 200, speed: 5.8, range: 8, damage: 10, attackCooldown: 1.8,
    sight: 20, cost: { combustible: 120, materiales: 90 }, trainTime: 32, era: 3, role: 'vehicle',
    counters: 'Destructor de blindados; poca utilidad contra infantería.',
  },
  tanque_autonomo: {
    type: 'tanque_autonomo', name: 'Tanque Autónomo', hp: 420, speed: 5.6, range: 8.5, damage: 26, attackCooldown: 1.6,
    sight: 22, cost: { combustible: 260, minerales: 200 }, trainTime: 45, era: 4, role: 'vehicle',
    counters: 'Élite versátil; caro y lento de producir.',
  },
  dron: {
    type: 'dron', name: 'Dron de Ataque', hp: 90, speed: 8.5, range: 7, damage: 18, attackCooldown: 1.3,
    sight: 26, cost: { combustible: 100, minerales: 80 }, trainTime: 24, era: 4, role: 'ranged',
    counters: 'Rápido y aéreo; frágil ante concentración de fuego.',
  },
  mlrs: {
    type: 'mlrs', name: 'Lanzacohetes Múltiple', hp: 160, speed: 3.2, range: 18, damage: 30, attackCooldown: 3.2,
    sight: 22, cost: { combustible: 200, minerales: 160 }, trainTime: 40, era: 4, role: 'vehicle',
    counters: 'Artillería de largo alcance; indefenso de cerca.',
  },
}

export const BUILDING_DEFS: Record<string, BuildingDef> = {
  ayuntamiento: {
    type: 'ayuntamiento', name: 'Ayuntamiento', hp: 2200, size: { x: 8, z: 8 },
    cost: {}, buildTime: 0, era: 1, popProvided: 8, dropoff: true, produces: ['ingeniero'],
  },
  vivienda: {
    type: 'vivienda', name: 'Vivienda Obrera', hp: 500, size: { x: 4, z: 4 },
    cost: { materiales: 60 }, buildTime: 18, era: 1, popProvided: 10,
  },
  cuartel: {
    type: 'cuartel', name: 'Cuartel', hp: 1200, size: { x: 6, z: 6 },
    cost: { materiales: 150 }, buildTime: 28, era: 1, produces: ['milicia', 'granadero', 'fusilero', 'francotirador', 'inf_mecanizada'],
  },
  almacen: {
    type: 'almacen', name: 'Depósito', hp: 700, size: { x: 4, z: 4 },
    cost: { materiales: 80 }, buildTime: 16, era: 1, dropoff: true,
  },
  fabrica: {
    type: 'fabrica', name: 'Fábrica Militar', hp: 1600, size: { x: 8, z: 6 },
    cost: { materiales: 250, combustible: 100 }, buildTime: 40, era: 2,
    produces: ['canon', 'cazacarros', 'tanque', 'dron', 'mlrs', 'tanque_autonomo'],
  },
  torre: {
    type: 'torre', name: 'Torre Defensiva', hp: 900, size: { x: 3, z: 3 },
    cost: { materiales: 100 }, buildTime: 22, era: 1,
    attack: { damage: 12, range: 13, cooldown: 1.6 },
  },
}

export const TECHS: TechDef[] = [
  { id: 'cadena', name: 'Producción en Cadena', era: 1, cost: { suministros: 150, materiales: 100 }, time: 30, desc: '+20% recolección', effects: { gatherPct: 0.2 } },
  { id: 'bessemer', name: 'Acero Bessemer', era: 2, cost: { materiales: 250, minerales: 100 }, time: 40, desc: '+15% vida de unidades', effects: { hpPct: 0.15 } },
  { id: 'balistica', name: 'Balística', era: 2, cost: { suministros: 300, combustible: 150 }, time: 40, desc: '+15% de daño', effects: { attackPct: 0.15 } },
  { id: 'motor', name: 'Motor de Combustión', era: 3, cost: { combustible: 350, materiales: 200 }, time: 45, desc: '+15% velocidad', effects: { speedPct: 0.15 } },
  { id: 'blindaje', name: 'Blindaje Compuesto', era: 3, cost: { materiales: 400, minerales: 250 }, time: 45, desc: '+3 armadura a todas las unidades', effects: { armorFlat: 3 } },
  { id: 'ia_batalla', name: 'Inteligencia de Batalla', era: 4, cost: { minerales: 600, combustible: 600 }, time: 60, desc: '+20% daño y +10% velocidad', effects: { attackPct: 0.2, speedPct: 0.1 } },
]

export const RESOURCE_LABEL: Record<ResourceKey, string> = {
  suministros: 'Suministros',
  materiales: 'Materiales',
  combustible: 'Combustible',
  minerales: 'Minerales',
}

export const NODE_INFO: Record<string, { name: string; resource: ResourceKey; amount: number }> = {
  granja: { name: 'Granja', resource: 'suministros', amount: 500 },
  bosque: { name: 'Bosque', resource: 'materiales', amount: 450 },
  petroleo: { name: 'Pozo de combustible', resource: 'combustible', amount: 500 },
  mina: { name: 'Cantera mineral', resource: 'minerales', amount: 500 },
}

export const TEAM_COLORS = {
  player: 0x3c82f6,
  enemy: 0xd94b4b,
} as const
