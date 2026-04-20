import fs from 'node:fs';
import path from 'node:path';
import protobuf from 'protobufjs';
import descriptor from 'protobufjs/ext/descriptor';

const descriptorPath = path.join(__dirname, 'descriptors.bin');
const descriptorBytes = fs.readFileSync(descriptorPath);

// biome-ignore lint/suspicious/noExplicitAny: runtime type from protobufjs ext
const set = (descriptor as any).FileDescriptorSet.decode(descriptorBytes);
// biome-ignore lint/suspicious/noExplicitAny: runtime type from protobufjs ext
const root: protobuf.Root = (protobuf.Root as any).fromDescriptor(set);

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
