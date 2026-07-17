/**
 * Enumerated VEP attribute values.
 *
 * The integer members below are the canonical Mercedes VSU proto values,
 * mirrored verbatim from the `mbapi2020` Home Assistant integration's
 * `vsu_enums.py` (itself generated from the proto definitions). Member names
 * drop the redundant enum-name prefix the proto carries (`IGNITIONSTATE_ON`
 * → `ON`) but keep Mercedes' UPPER_SNAKE spelling so a value is greppable
 * back to its source.
 *
 * These are the multi-valued status attributes only. Binary flags arrive over
 * the wire as `bool_value` (see `AttributeValue`) and are typed as `boolean`;
 * pure measurements stay `number`. Gaps in the integer sequence (e.g.
 * `IgnitionState` has no 3) are gaps in the proto, not omissions here.
 */

export enum VehiclePositionErrorCode {
  UNKNOWN = 0,
  SERVICE_INACTIVE = 1,
  TRACKING_INACTIVE = 2,
  PARKED = 3,
  IGNITION_ON = 4,
  OK = 5,
}

export enum IgnitionState {
  LOCK = 0,
  OFF = 1,
  ACCESSORY = 2,
  ON = 4,
  START = 5,
}

export enum StarterBatteryState {
  GREEN = 0,
  YELLOW = 1,
  RED = 2,
  ORANGE = 3,
  GREEN_YELLOW = 4,
}

export enum DoorStatusOverall {
  ANY_DOOR_OPEN = 0,
  ALL_DOORS_CLOSED = 1,
  UNKNOWN = 3,
}

export enum DoorLockStatusVehicle {
  UNLOCKED = 0,
  INTERNAL_LOCKED = 1,
  EXTERNAL_LOCKED = 2,
  SELECTIVE_UNLOCKED = 3,
}

export enum WindowStatus {
  INTERMEDIATE = 0,
  COMPLETELY_OPENED = 1,
  COMPLETELY_CLOSED = 2,
  AIRING_POSITION = 3,
}

export enum WindowStatusOverall {
  OPEN = 0,
  CLOSED = 1,
  COMPLETELY_OPEN = 2,
  AIRING = 3,
}

export enum WindowStatusBlind {
  INTERMEDIATE = 0,
  COMPLETELY_OPENED = 1,
  COMPLETELY_CLOSED = 2,
}

export enum SunroofStatus {
  CLOSED = 0,
  COMPLETE_OPEN = 1,
  LIFTING_OPEN = 2,
  RUNNING = 3,
}

export enum SunroofStatusBlind {
  INTERMEDIATE = 0,
  COMPLETELY_OPENED = 1,
  COMPLETELY_CLOSED = 2,
  OPENING = 3,
}

export enum SunroofEvent {
  NONE = 0,
  RAIN_LIFT_POSITION = 1,
  AUTOMATIC_LIFT_POSITION = 2,
  VENTILATION_POSITION = 3,
}

export enum RooftopStatus {
  UNLOCKED = 0,
  OPEN_AND_LOCKED = 1,
  CLOSED_AND_LOCKED = 2,
}

export enum ChargingStatus {
  CHARGING = 0,
  END_OF_CHARGE = 1,
  CHARGE_BREAK = 2,
  CHARGE_CABLE_UNPLUGGED = 3,
  CHARGING_ERROR = 4,
  SLOW_CHARGING = 5,
  FAST_CHARGING = 6,
  DISCHARGING = 7,
  NO_CHARGING = 8,
  SLOW_CHARGING_AFTER_REACHING_TRIP_TARGET = 9,
  CHARGING_AFTER_REACHING_TRIP_TARGET = 10,
  FAST_CHARGING_AFTER_REACHING_TRIP_TARGET = 11,
  COMMUNICATION_WITH_EVSE_ACTIVE_NO_ENERGY_FLOW = 12,
  AC_CHARGING_ACTIVE = 13,
  DC_CHARGING_ACTIVE = 14,
  SOH_BATTERY_CALIBRATION_ACTIVE = 15,
  UNKNOWN = 16,
}

export enum ChargingErrorDetails {
  NO_ERROR = 0,
  INLET_UNLOCK_ERROR = 1,
  EVSE_DEFECT_CHANGE_CHARGING_STATION = 2,
  EVSE_DEFECT_MALFUNCTION_OF_CHARGING_STATION = 3,
  CHARGE_TYPE_NOT_AVAILABLE = 4,
  CHADEMO_INLET_UNLOCK_ERROR = 5,
  DC_INTERNAL_COMPONENT_DEFECT = 6,
  AC_INTERNAL_COMPONENT_DEFECT = 7,
  AUTHORIZATION_FAILED = 8,
  MESSAGE_9_RESERVED = 9,
  MESSAGE_10_RESERVED = 10,
  MESSAGE_11_RESERVED = 11,
  MESSAGE_12_RESERVED = 12,
  MESSAGE_13_RESERVED = 13,
  NO_INFO_OR_ERROR_MESSAGE = 14,
  CHARGING_SYSTEM_DEFECT = 15,
  DC_CHARGING_DEFECT = 16,
  AC_CHARGING_DEFECT = 17,
  REPLUG_CHARGING_CABLE = 18,
  EVSE_DOES_NOT_RESPOND_RECONNECT = 19,
  EVSE_DOES_NOT_RESPOND_USE_OTHER_AUTHENTIFICATION = 20,
  EVSE_DOES_NOT_RESPOND_EVSE_DEFECT = 21,
  EVSE_DOES_NOT_RESPOND_TRY_OTHER_EVSE = 22,
  EV_INITIATED_SHUTDOWN_LONG_TIME_USAGE_LIMIT_REACHED = 23,
  NO_VALID_PLUG_AND_CHARGE_CERTIFICATE_AVAILABLE = 24,
  UNKNOWN_CHARGING_ERROR_OCCURRED = 25,
  NACS_ERROR_CHARGING_STATION_NOT_COMPATIBLE = 26,
  PLAYPROTECTION_ACTIVE = 27,
}

export enum ChargeCouplerStatus {
  PLUGGED_BOTH_SIDES = 0,
  PLUGGED_VEHICLE_SIDE = 1,
  NOT_PLUGGED_VEHICLE_SIDE = 2,
  UNKNOWN = 3,
  UNKNOWN_DUE_DEFECT = 4,
}

export enum ChargeCouplerLockStatus {
  LOCKED = 0,
  UNLOCKED = 1,
  NOT_CLEAR = 2,
}

export enum ChargeFlapStatus {
  OPEN = 0,
  CLOSED = 1,
  FLAP_PRESSED = 2,
}

export enum SelectedChargeProgram {
  DEFAULT = 0,
  INSTANT = 1,
  HOME = 2,
  WORK = 3,
  AC_DC_STANDARD = 4,
  AC_DC_STANDARD_V1X_RANGE_ASSIST_MODE = 5,
  DC_CP_V2X_CHADEMO = 6,
  DC_CP_V2X_ISO_15118_20_DYNAMIC = 7,
  DC_CP_V2X_ISO_15118_20_SCHEDULED = 8,
  AC_DC_OPPORTUNITY_V1X = 9,
  AC_EV_TIMER = 10,
  AC_DC_DIN_ISO_15118_2_SCHEDULED = 11,
  AC_API_REMOTE_SCHEDULE = 12,
  AC_DC_BATTERY_CALIBRATION = 13,
}

export enum HvBatteryThermalPropagationEvent {
  NO_WARNING = 0,
  WARNING_1 = 1,
  WARNING_2 = 2,
}

export enum FilterParticleLoading {
  HIGH = 0,
  MEDIUM = 1,
  LOW = 2,
}

export enum HybridWarnings {
  NONE = 0,
  SEEK_SERVICE = 1,
  HIGH_VOLTAGE_FAULT = 2,
  POWER_TRAIN_FAULT = 3,
  STARTER_BATTERY = 4,
  STOP_VEHICLE = 5,
  PLUGIN_ONLY = 6,
  PLUGIN_STILL_ACTIVE = 7,
  POWER_REDUCE = 8,
  STOP_ENGINE_OFF = 9,
}

export enum TireMarker {
  NO_WARNING = 0,
  SOFT_WARNING = 1,
  LOW_PRESSURE = 2,
  DEFLATION = 3,
  MARK = 4,
}

export enum TireWarningLamp {
  NO_COMBI_MESSAGE = 0,
  CONSTANT_LIGHT = 1,
  BLINKING_THEN_CONSTANT = 2,
}

export enum TireWarningsRdk {
  NO_WARNING = 0,
  SOFT_WARNING = 1,
  LOW_PRESSURE = 2,
  DEFLATION = 3,
}

export enum TireWarningLevelPrw {
  NO_WARNING = 0,
  WARNING = 1,
  GO_TO_WORKSHOP = 2,
}

export enum TireSensorAvailable {
  ALL_LOCATED = 0,
  ONE_TO_THREE_MISSING = 1,
  ALL_MISSING = 2,
  SYSTEM_ERROR = 3,
  AUTOLOCATE_ERROR = 4,
}

export enum DepartureTimeMode {
  INACTIVE = 0,
  ADHOC_ACTIVE = 1,
  WEEKLYSET_ACTIVE = 2,
  TIMER_ACTV = 3,
  INTELLIGENT_DP_ACTV = 4,
}

export enum VehicleHealthStatus {
  GREEN = 0,
  YELLOW = 1,
  RED = 2,
}

export enum TcuConnectionStateLowChannel {
  UNKNOWN = 0,
  INITIALLY_CONNECTED = 1,
  RECONNECTED = 2,
  DISCONNECTED = 3,
  UNPLANNED_DISCONNECTED = 4,
}

export enum LanguageHU {
  GERMAN = 0,
  ENGLISH_IMP = 1,
  FRENCH = 2,
  ITALIAN = 3,
  SPANISH = 4,
  JAPANESE = 5,
  ENGLISH_MET = 6,
  DUTCH = 7,
  DANISH = 8,
  SWEDISH = 9,
  TURKISH = 10,
  PORTUGUESE = 11,
  RUSSIAN = 12,
  ARABIC = 13,
  CHINESE = 14,
  ENGLISH_AM = 15,
  TRAD_CHINESE = 16,
  KOREAN = 17,
  FINNISH = 18,
  POLISH = 19,
  CZECH = 20,
  PORTUGUESE_BRAZIL = 21,
  NORWEGIAN = 22,
  THAI = 23,
  INDONESIAN = 24,
  BULGARIAN = 25,
  SLOVAKIAN = 26,
  CROATIAN = 27,
  SERBIAN = 28,
  HUNGARIAN = 29,
  UKRAINIAN = 30,
  MALAYAN = 31,
  VIETNAMESE = 32,
  ROMANIAN = 33,
  TRAD_CHINESE_TW = 34,
  HEBREW = 35,
  GREEK = 36,
  SLOVENIAN = 37,
}
