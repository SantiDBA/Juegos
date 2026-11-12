import type { BuildingDef, EraDef, ResourceKey, Resources, UnitDef } from './types'

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
    cost: { materiales: 150 }, buildTime: 28, era: 1, produces: ['milicia', 'fusilero'],
  },
  almacen: {
    type: 'almacen', name: 'Depósito', hp: 700, size: { x: 4, z: 4 },
    cost: { materiales: 80 }, buildTime: 16, era: 1, dropoff: true,
  },
}

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
