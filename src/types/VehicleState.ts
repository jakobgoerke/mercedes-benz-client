import type {
  ChargeCouplerLockStatus,
  ChargeCouplerStatus,
  ChargeFlapStatus,
  ChargingErrorDetails,
  ChargingStatus,
  DepartureTimeMode,
  DoorLockStatusVehicle,
  DoorStatusOverall,
  FilterParticleLoading,
  HvBatteryThermalPropagationEvent,
  HybridWarnings,
  IgnitionState,
  LanguageHU,
  RooftopStatus,
  SelectedChargeProgram,
  StarterBatteryState,
  SunroofEvent,
  SunroofStatus,
  SunroofStatusBlind,
  TcuConnectionStateLowChannel,
  TireMarker,
  TireSensorAvailable,
  TireWarningLamp,
  TireWarningLevelPrw,
  TireWarningsRdk,
  VehicleHealthStatus,
  VehiclePositionErrorCode,
  WindowStatus,
  WindowStatusBlind,
  WindowStatusOverall,
} from './enums';

export interface Position {
  latitude: number;
  longitude: number;
  heading?: number;
  timestamp: Date;
}

/**
 * Most VEP attributes decode to a scalar. A minority (~27 of the 73 known
 * `attribute_type` oneof cases — schedules, histograms, tariff tables, etc.)
 * carry a structured sub-message instead; those decode to a plain object
 * rather than being dropped.
 */
export type AttributeValue = number | string | boolean | null | Record<string, unknown>;

/**
 * Field names below are copied verbatim from the VEP wire attribute keys
 * (EU region, observed from live data) — casing is Mercedes' own and
 * intentionally inconsistent (`doorstatusfrontleft` vs. `doorStatusOverall`).
 * `VehicleEventStream` populates `VehicleUpdate.attributes` directly from
 * those wire keys with no translation layer, so renaming a field here would
 * desync the type from the runtime object it describes — don't.
 *
 * Split into one interface per VEP domain purely so each group is easy to
 * scan; `VehicleAttributes` below composes them back into the single flat
 * map that actually exists at runtime.
 */
export interface PositionAttributes {
  positionLat: number | null;
  positionLong: number | null;
  positionHeading: number | null;
  vehiclePositionErrorCode: VehiclePositionErrorCode | null;
  /** 1 = proximity calculation required before showing position */
  proximityCalculationForVehiclePositionRequired: number | null;
  trackingStateHU: number | null;
}

export interface IgnitionAttributes {
  ignitionstate: IgnitionState | null;
  parkbrakestatus: number | null;
  starterBatteryState: StarterBatteryState | null;
  vtime: number | null;
}

export interface DoorAttributes {
  doorstatusfrontleft: number | null;
  doorstatusfrontright: number | null;
  doorstatusrearleft: number | null;
  doorstatusrearright: number | null;
  /** Aggregate door open/close status */
  doorStatusOverall: DoorStatusOverall | null;
  decklidstatus: number | null;
  engineHoodStatus: number | null;
  /** true = unlocked, false = locked (per-door actuator state; observed from live data) */
  doorlockstatusfrontleft: boolean | null;
  doorlockstatusfrontright: boolean | null;
  doorlockstatusrearleft: boolean | null;
  doorlockstatusrearright: boolean | null;
  doorlockstatusdecklid: boolean | null;
  /** Aggregate lock state enum */
  doorlockstatusvehicle: DoorLockStatusVehicle | null;
  doorlockstatusgas: boolean | null;
}

export interface WindowAttributes {
  windowstatusfrontleft: WindowStatus | null;
  windowstatusfrontright: WindowStatus | null;
  windowstatusrearleft: WindowStatus | null;
  windowstatusrearright: WindowStatus | null;
  windowStatusOverall: WindowStatusOverall | null;
  windowStatusRearBlind: WindowStatusBlind | null;
  windowStatusRearLeftBlind: WindowStatusBlind | null;
  windowStatusRearRightBlind: WindowStatusBlind | null;
  flipWindowStatus: number | null;
}

export interface SunroofAttributes {
  sunroofstatus: SunroofStatus | null;
  sunroofStatusFrontBlind: SunroofStatusBlind | null;
  sunroofStatusRearBlind: SunroofStatusBlind | null;
  sunroofEvent: SunroofEvent | null;
  sunroofEventActive: number | null;
  rooftopstatus: RooftopStatus | null;
}

export interface ElectricRangeAttributes {
  /** State of charge (%) */
  soc: number | null;
  maxSoc: number | null;
  minSoc: number | null;
  maxSocUpperLimit: number | null;
  maxSocLowerLimit: number | null;
  minSocUpperLimit: number | null;
  minSocLowerLimit: number | null;
  rangeelectric: number | null;
  rangeElectricWltp: number | null;
  overallRange: number | null;
  maxrange: number | null;
  electricalRangeSkipIndication: number | null;
  electricconsumptionstart: number | null;
  electricconsumptionreset: number | null;
  electricRatioStart: number | null;
  electricRatioReset: number | null;
  distanceElectricalStart: number | null;
  distanceElectricalReset: number | null;
  distanceZEStart: number | null;
  distanceZEReset: number | null;
  drivenTimeZEStart: number | null;
  drivenTimeZEReset: number | null;
  evRangeAssistDriveOnSOC: number | null;
  evRangeAssistDriveOnTime: number | null;
  hvBatteryThermalPropagationEvent: HvBatteryThermalPropagationEvent | null;
}

export interface ChargingAttributes {
  chargingactive: number | null;
  chargingstatus: ChargingStatus | null;
  chargingPower: number | null;
  chargingPowerEcoLimit: number | null;
  chargingErrorDetails: ChargingErrorDetails | null;
  chargeCouplerACStatus: ChargeCouplerStatus | null;
  chargeCouplerDCStatus: ChargeCouplerStatus | null;
  chargeCouplerDCLockStatus: ChargeCouplerLockStatus | null;
  chargeFlapDCStatus: ChargeFlapStatus | null;
  chargePrograms: number | null;
  selectedChargeProgram: SelectedChargeProgram | null;
  smartCharging: number | null;
  bidirectionalChargingActive: number | null;
  endofchargetime: number | null;
  endofChargeTimeWeekday: number | null;
  socprofile: number | null;
}

/** Fuel / combustion attributes — null on BEVs. */
export interface FuelAttributes {
  gasTankLevel: number | null;
  gasTankLevelPercent: number | null;
  gasTankRange: number | null;
  tanklevelpercent: number | null;
  tankLevelAdBlue: number | null;
  rangeAdBlue: number | null;
  rangeliquid: number | null;
  liquidRangeSkipIndication: number | null;
  gasconsumptionstart: number | null;
  gasconsumptionreset: number | null;
  liquidconsumptionstart: number | null;
  liquidconsumptionreset: number | null;
  distanceGasStart: number | null;
  distanceGasReset: number | null;
  filterParticleLoading: FilterParticleLoading | null;
  hybridWarnings: HybridWarnings | null;
}

export interface TireAttributes {
  tirepressureFrontLeft: number | null;
  tirepressureFrontRight: number | null;
  tirepressureRearLeft: number | null;
  tirepressureRearRight: number | null;
  tirePressureInnerRearLeft: number | null;
  tirePressureInnerRearRight: number | null;
  tirePressMeasTimestamp: number | null;
  tireMarkerFrontLeft: TireMarker | null;
  tireMarkerFrontRight: TireMarker | null;
  tireMarkerRearLeft: TireMarker | null;
  tireMarkerRearRight: TireMarker | null;
  tireMarkerInnerRearLeft: TireMarker | null;
  tireMarkerInnerRearRight: TireMarker | null;
  tiremarker: TireMarker | null;
  tirewarninglamp: TireWarningLamp | null;
  tirewarningsrdk: TireWarningsRdk | null;
  tirewarningsprw: number | null;
  tireWarningLevelPrw: TireWarningLevelPrw | null;
  tireSensorAvailable: TireSensorAvailable | null;
}

export interface TripAttributes {
  odo: number | null;
  distanceStart: number | null;
  distanceReset: number | null;
  averageSpeedStart: number | null;
  averageSpeedReset: number | null;
  drivenTimeStart: number | null;
  drivenTimeReset: number | null;
}

export interface PreconditioningAttributes {
  precondState: number | null;
  precondActive: number | null;
  precondNow: number | null;
  precondNowError: number | null;
  precondError: number | null;
  precondDuration: number | null;
  precondAtDepartureDisable: number | null;
  precondatdeparture: number | null;
  precondSeatFrontLeft: number | null;
  precondSeatFrontRight: number | null;
  precondSeatRearLeft: number | null;
  precondSeatRearRight: number | null;
  remoteStartTemperature: number | null;
}

export interface DepartureTimerAttributes {
  departuretime: number | null;
  departuretimesoc: number | null;
  departureTimeMode: DepartureTimeMode | null;
  departureTimeWeekday: number | null;
  weeklySetHU: number | null;
  weeklyProfile: number | null;
}

export interface WarningAttributes {
  warningwashwater: number | null;
  warningbrakefluid: number | null;
  warningbrakeliningwear: number | null;
  warningcoolantlevellow: number | null;
  warningenginelight: number | null;
  vehicleHealthStatus: VehicleHealthStatus | null;
}

export interface EcoScoreAttributes {
  ecoscoretotal: number | null;
  ecoscoreconst: number | null;
  ecoscoreaccel: number | null;
  ecoscorefreewhl: number | null;
  ecoscorebonusrange: number | null;
}

export interface ServiceAttributes {
  serviceintervaldays: number | null;
  serviceintervaldistance: number | null;
}

/** Head-unit / connectivity attributes. */
export interface SystemAttributes {
  languageHU: LanguageHU | null;
  timeFormatHU: number | null;
  temperatureUnitHU: number | null;
  temperaturePoints: number | null;
  speedUnitFromIC: number | null;
  tcuConnectionStateLowChannel: TcuConnectionStateLowChannel | null;
  vehicleDataConnectionState: number | null;
}

/** Typed map of all known VEP attribute keys, grouped by domain above. */
export type VehicleAttributes = PositionAttributes &
  IgnitionAttributes &
  DoorAttributes &
  WindowAttributes &
  SunroofAttributes &
  ElectricRangeAttributes &
  ChargingAttributes &
  FuelAttributes &
  TireAttributes &
  TripAttributes &
  PreconditioningAttributes &
  DepartureTimerAttributes &
  WarningAttributes &
  EcoScoreAttributes &
  ServiceAttributes &
  SystemAttributes;

export interface VehicleUpdate {
  vin: string;
  fullUpdate: boolean;
  emittedAt: Date;
  attributes: Partial<VehicleAttributes> & Record<string, AttributeValue>;
  position?: Position;
}
