export interface Position {
  latitude: number;
  longitude: number;
  heading?: number;
  timestamp: Date;
}

export type AttributeValue = number | string | boolean | null;

/** Typed map of all known VEP attribute keys (EU region, observed from live data). */
export interface VehicleAttributes {
  // --- Position ---
  positionLat: number | null;
  positionLong: number | null;
  positionHeading: number | null;
  vehiclePositionErrorCode: number | null;
  /** 1 = proximity calculation required before showing position */
  proximityCalculationForVehiclePositionRequired: number | null;
  trackingStateHU: number | null;

  // --- Ignition / Drive ---
  ignitionstate: number | null;
  parkbrakestatus: number | null;
  starterBatteryState: number | null;
  vtime: number | null;

  // --- Doors ---
  doorstatusfrontleft: number | null;
  doorstatusfrontright: number | null;
  doorstatusrearleft: number | null;
  doorstatusrearright: number | null;
  /** Aggregate door open/close status */
  doorStatusOverall: number | null;
  decklidstatus: number | null;
  engineHoodStatus: number | null;
  doorlockstatusfrontleft: number | null;
  doorlockstatusfrontright: number | null;
  doorlockstatusrearleft: number | null;
  doorlockstatusrearright: number | null;
  doorlockstatusdecklid: number | null;
  doorlockstatusvehicle: number | null;
  doorlockstatusgas: number | null;

  // --- Windows ---
  windowstatusfrontleft: number | null;
  windowstatusfrontright: number | null;
  windowstatusrearleft: number | null;
  windowstatusrearright: number | null;
  windowStatusOverall: number | null;
  windowStatusRearBlind: number | null;
  windowStatusRearLeftBlind: number | null;
  windowStatusRearRightBlind: number | null;
  flipWindowStatus: number | null;

  // --- Sunroof / Rooftop ---
  sunroofstatus: number | null;
  sunroofStatusFrontBlind: number | null;
  sunroofStatusRearBlind: number | null;
  sunroofEvent: number | null;
  sunroofEventActive: number | null;
  rooftopstatus: number | null;

  // --- Electric range & consumption ---
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
  hvBatteryThermalPropagationEvent: number | null;

  // --- Charging ---
  chargingactive: number | null;
  chargingstatus: number | null;
  chargingPower: number | null;
  chargingPowerEcoLimit: number | null;
  chargingErrorDetails: number | null;
  chargeCouplerACStatus: number | null;
  chargeCouplerDCStatus: number | null;
  chargeCouplerDCLockStatus: number | null;
  chargeFlapDCStatus: number | null;
  chargePrograms: number | null;
  selectedChargeProgram: number | null;
  smartCharging: number | null;
  bidirectionalChargingActive: number | null;
  endofchargetime: number | null;
  endofChargeTimeWeekday: number | null;
  socprofile: number | null;

  // --- Fuel / combustion (null on BEV) ---
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
  filterParticleLoading: number | null;
  hybridWarnings: number | null;

  // --- Tires ---
  tirepressureFrontLeft: number | null;
  tirepressureFrontRight: number | null;
  tirepressureRearLeft: number | null;
  tirepressureRearRight: number | null;
  tirePressureInnerRearLeft: number | null;
  tirePressureInnerRearRight: number | null;
  tirePressMeasTimestamp: number | null;
  tireMarkerFrontLeft: number | null;
  tireMarkerFrontRight: number | null;
  tireMarkerRearLeft: number | null;
  tireMarkerRearRight: number | null;
  tireMarkerInnerRearLeft: number | null;
  tireMarkerInnerRearRight: number | null;
  tiremarker: number | null;
  tirewarninglamp: number | null;
  tirewarningsrdk: number | null;
  tirewarningsprw: number | null;
  tireWarningLevelPrw: number | null;
  tireSensorAvailable: number | null;

  // --- Trip / odometer ---
  odo: number | null;
  distanceStart: number | null;
  distanceReset: number | null;
  averageSpeedStart: number | null;
  averageSpeedReset: number | null;
  drivenTimeStart: number | null;
  drivenTimeReset: number | null;

  // --- Preconditioning ---
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

  // --- Departure timers ---
  departuretime: number | null;
  departuretimesoc: number | null;
  departureTimeMode: number | null;
  departureTimeWeekday: number | null;
  weeklySetHU: number | null;
  weeklyProfile: number | null;

  // --- Warnings ---
  warningwashwater: number | null;
  warningbrakefluid: number | null;
  warningbrakeliningwear: number | null;
  warningcoolantlevellow: number | null;
  warningenginelight: number | null;
  vehicleHealthStatus: number | null;

  // --- Eco score ---
  ecoscoretotal: number | null;
  ecoscoreconst: number | null;
  ecoscoreaccel: number | null;
  ecoscorefreewhl: number | null;
  ecoscorebonusrange: number | null;

  // --- Service ---
  serviceintervaldays: number | null;
  serviceintervaldistance: number | null;

  // --- HU / system ---
  languageHU: number | null;
  timeFormatHU: number | null;
  temperatureUnitHU: number | null;
  temperaturePoints: number | null;
  speedUnitFromIC: number | null;
  tcuConnectionStateLowChannel: number | null;
  vehicleDataConnectionState: number | null;
}

export interface VehicleUpdate {
  vin: string;
  fullUpdate: boolean;
  emittedAt: Date;
  attributes: Partial<VehicleAttributes> & Record<string, AttributeValue>;
  position?: Position;
}
