import fs from 'node:fs';
import path from 'node:path';
import protobuf from 'protobufjs';
import descriptor from 'protobufjs/ext/descriptor';

const descriptorPath = path.join(__dirname, 'descriptors.bin');
const descriptorBytes = fs.readFileSync(descriptorPath);

/**
 * `protobufjs/ext/descriptor` patches `FileDescriptorSet` onto its default
 * export and `fromDescriptor` onto `protobuf.Root` at runtime — neither is
 * declared in protobufjs' own types, so we describe just the two calls we
 * make instead of casting the whole module to `any`.
 */
interface DescriptorExtModule {
  FileDescriptorSet: protobuf.Type;
}
interface RootWithFromDescriptor {
  fromDescriptor(set: protobuf.Message): protobuf.Root;
}

const { FileDescriptorSet } = descriptor as unknown as DescriptorExtModule;
const set = FileDescriptorSet.decode(descriptorBytes);
const root = (protobuf.Root as unknown as RootWithFromDescriptor).fromDescriptor(set);

// protobufjs' fromDescriptor leaves map fields as repeated `{key,value}`
// message fields. Convert them to real MapFields so consumers can use
// plain object access (map[key]) and toObject() returns a proper object.
function convertMaps(ns: protobuf.Namespace): void {
  for (const nested of ns.nestedArray) {
    if (nested instanceof protobuf.Type) {
      convertMaps(nested);
      for (const [fieldName, field] of Object.entries(nested.fields)) {
        if (!field.repeated) continue;
        const resolved = field.resolve().resolvedType;
        if (!(resolved instanceof protobuf.Type)) continue;
        const entryOptions = resolved.options as { map_entry?: boolean; mapEntry?: boolean } | undefined;
        if (!entryOptions?.map_entry && !entryOptions?.mapEntry) continue;
        const keyField = resolved.fields.key;
        const valueField = resolved.fields.value;
        if (!keyField || !valueField) continue;

        nested.remove(field);
        const valueType =
          valueField.resolvedType instanceof protobuf.Type || valueField.resolvedType instanceof protobuf.Enum
            ? valueField.resolvedType.fullName
            : valueField.type;
        const mapField = new protobuf.MapField(fieldName, field.id, keyField.type, valueType);
        nested.add(mapField);
      }
    } else if (nested instanceof protobuf.Namespace) {
      convertMaps(nested);
    }
  }
}
convertMaps(root);
root.resolveAll();

export const PushMessage = root.lookupType('proto.PushMessage');
export const ClientMessage = root.lookupType('proto.ClientMessage');
export const VEPUpdate = root.lookupType('proto.VEPUpdate');
export const VEPUpdatesByVIN = root.lookupType('proto.VEPUpdatesByVIN');
export const VehicleAttributeStatus = root.lookupType('proto.VehicleAttributeStatus');
export const AssignedVehicles = root.lookupType('proto.AssignedVehicles');
export const VehicleStatusUpdates = root.lookupType('proto.VehicleStatusUpdates');
export const VehicleStatusUpdate = root.lookupType('proto.VehicleStatusUpdate');

/**
 * Shapes for the plain objects `*.decode()` returns above. protobufjs types
 * every decoded message as `{ [k: string]: any }` since the schema is loaded
 * at runtime from `descriptors.bin` rather than generated — these interfaces
 * exist purely so the rest of the codebase isn't sprinkled with `any`.
 * `.decode()` calls still need one boundary cast to these types; nothing
 * here is checked against the actual wire schema.
 */

/** protobufjs' representation of an int64 field that doesn't fit in a JS `number`. */
export interface LongLike {
  toNumber(): number;
}

/**
 * A single VEP attribute. `attribute_type` names whichever of the ~73
 * `oneof attribute_type` value fields (`int_value`, `bool_value`,
 * `park_collision_activation_status`, ...) was set on the wire; look it up
 * by that name (`status[status.attribute_type]`) rather than enumerating
 * all 73 fields here.
 */
export interface DecodedAttributeStatus {
  attribute_type?: string;
  status?: number;
  timestamp_in_ms?: number | LongLike;
  [oneofValueField: string]: unknown;
}

export interface DecodedVEPUpdate {
  vin: string;
  sequence_number?: number;
  full_update?: boolean;
  emit_timestamp_in_ms?: number | LongLike;
  emit_timestamp?: number | LongLike;
  attributes?: Record<string, DecodedAttributeStatus>;
}

export interface DecodedVEPUpdatesByVIN {
  sequence_number?: number;
  updates?: Record<string, DecodedVEPUpdate>;
}

export interface DecodedAssignedVehicles {
  vins?: string[];
}

/**
 * A single attribute inside a `VehicleStatusUpdate` — unlike `VEPUpdate`'s
 * attributes (a map keyed by name, with `oneof attribute_type` picking the
 * value's wire type), each attribute here is its own optional message field
 * declared directly on `VehicleStatusUpdate` (e.g. `ignitionstate`,
 * `odo`, `position_lat`) wrapping a typed `{ value, metadata }` shape.
 * Field presence (not a discriminator) says whether it was sent.
 */
export interface DecodedVehicleStatusAttribute {
  value?: unknown;
}

/**
 * Decoded `VehicleStatusUpdate`. Only fields actually present on the wire
 * appear as own properties (protobufjs proto3 message-field presence), so
 * `Object.keys()` on this is exactly "what did the backend send this time" —
 * mirrors the `attribute_type` presence check used for `DecodedVEPUpdate`.
 * Field names are Mercedes' own (verbatim, mixed casing) and mostly — but
 * not always — match the `VEPUpdate` attribute keys of the same concept
 * (e.g. `ignitionstate` matches; `position_lat` vs. `positionLat` doesn't).
 */
export interface DecodedVehicleStatusUpdate {
  fin_or_vin?: string;
  full_update?: boolean;
  [attributeField: string]: DecodedVehicleStatusAttribute | string | boolean | undefined;
}

export interface DecodedVehicleStatusUpdates {
  sequence_number?: number | LongLike;
  vehicle_status_updates?: Record<string, DecodedVehicleStatusUpdate>;
}

interface DecodedSequencedAck {
  sequence_number?: number | LongLike;
}

/** The subset of `PushMessage`'s `oneof push_msg_type` cases this client handles. */
export interface DecodedPushMessage {
  assigned_vehicles?: DecodedAssignedVehicles;
  vepUpdates?: DecodedVEPUpdatesByVIN;
  vepUpdate?: DecodedVEPUpdate;
  apptwin_command_status_updates_by_vin?: DecodedSequencedAck;
  service_status_updates?: DecodedSequencedAck;
  apptwin_pending_command_request?: unknown;
  vehicle_status_updates?: DecodedVehicleStatusUpdates;
}
