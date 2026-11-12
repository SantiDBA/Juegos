export type ResourceKey = 'suministros' | 'materiales' | 'combustible' | 'minerales'

export type EntityKind = 'unit' | 'building' | 'resource'

export type UnitType =
  | 'ingeniero' | 'milicia' | 'granadero' | 'fusilero' | 'francotirador' | 'inf_mecanizada'
  | 'blindado' | 'cazacarros' | 'tanque' | 'canon' | 'mlrs' | 'dron' | 'tanque_autonomo'

export type BuildingType = 'ayuntamiento' | 'vivienda' | 'cuartel' | 'almacen' | 'fabrica' | 'torre'

export type ResourceNodeType = 'granja' | 'bosque' | 'petroleo' | 'mina'

export type Team = 'player' | 'enemy'

export interface Vec2 { x: number; z: number }

export interface Resources {
  suministros: number
  materiales: number
  combustible: number
  minerales: number
}

export interface Cost extends Partial<Resources> {
  pop?: number
}

export interface UnitDef {
  type: UnitType
  name: string
  hp: number
  speed: number
  range: number
  damage: number
  attackCooldown: number
  sight: number
  cost: Cost
  trainTime: number
  era: number
  role: 'economy' | 'infantry' | 'ranged' | 'vehicle'
  gatherRate?: number
  carry?: number
  counters?: string
}

export interface BuildingDef {
  type: BuildingType
  name: string
  hp: number
  size: { x: number; z: number }
  cost: Cost
  buildTime: number
  era: number
  popProvided?: number
  dropoff?: boolean
  produces?: UnitType[]
  attack?: { damage: number; range: number; cooldown: number }
}

export interface EraDef {
  id: number
  name: string
  years: string
  advanceCost: Cost
  advanceTime: number
}

export interface TechDef {
  id: string
  name: string
  era: number
  cost: Cost
  time: number
  desc: string
  effects: { attackPct?: number; hpPct?: number; speedPct?: number; gatherPct?: number; armorFlat?: number }
}

export interface PlayerBonuses {
  attackPct: number
  hpPct: number
  speedPct: number
  gatherPct: number
  armorFlat: number
}

export interface BaseEntity {
  id: number
  kind: EntityKind
  team: Team
  x: number
  z: number
  hp: number
  maxHp: number
  selected: boolean
  dead: boolean
}

export interface UnitEntity extends BaseEntity {
  kind: 'unit'
  utype: UnitType
  path: Vec2[]
  targetId?: number
  gatherTargetId?: number
  dropoffTargetId?: number
  carrying: Partial<Resources>
  carryAmount: number
  attackCd: number
  workCd: number
  state: 'idle' | 'move' | 'gather' | 'return' | 'attack' | 'build'
}

export interface BuildingEntity extends BaseEntity {
  kind: 'building'
  btype: BuildingType
  built: boolean
  buildProgress: number
  attackCd: number
  queue: { type: UnitType; remaining: number; total: number }[]
  rally?: Vec2
}

export interface ResourceEntity extends BaseEntity {
  kind: 'resource'
  rtype: ResourceNodeType
  amount: number
  maxAmount: number
  resource: ResourceKey
}

export type AnyEntity = UnitEntity | BuildingEntity | ResourceEntity
