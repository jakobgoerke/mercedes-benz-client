/**
 * One-shot: pull the compiled `_pb2.py` modules from mbapi2020, extract each
 * FileDescriptorProto embedded in the `AddSerializedFile(b'...')` call, wrap
 * them in a FileDescriptorSet, and write the result to src/proto/descriptors.bin.
 *
 * Run: `yarn gen:proto`. Commit the resulting binary.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import protobuf from 'protobufjs';
import descriptor from 'protobufjs/ext/descriptor';

const SOURCE_BASE = 'https://raw.githubusercontent.com/ReneNulschDE/mbapi2020/master/custom_components/mbapi2020/proto';

// FieldDescriptorProto TYPE_* enum values (subset).
const TYPE = {
  DOUBLE: 1,
  FLOAT: 2,
  INT64: 3,
  UINT64: 4,
  INT32: 5,
  BOOL: 8,
  STRING: 9,
  MESSAGE: 11,
  BYTES: 12,
  UINT32: 13,
  ENUM: 14,
} as const;

const LABEL_OPTIONAL = 1;
const LABEL_REPEATED = 3;

// Minimal google well-known types referenced as field types in the mbapi protos.
const wellKnownWrappers = (() => {
  const scalar = (name: string, type: number) => ({
    name,
    field: [{ name: 'value', number: 1, type, label: 1 /* LABEL_OPTIONAL */ }],
  });
  return {
    name: 'google/protobuf/wrappers.proto',
    package: 'google.protobuf',
    syntax: 'proto3',
    messageType: [
      scalar('DoubleValue', TYPE.DOUBLE),
      scalar('FloatValue', TYPE.FLOAT),
      scalar('Int64Value', TYPE.INT64),
      scalar('UInt64Value', TYPE.UINT64),
      scalar('Int32Value', TYPE.INT32),
      scalar('UInt32Value', TYPE.UINT32),
      scalar('BoolValue', TYPE.BOOL),
      scalar('StringValue', TYPE.STRING),
      scalar('BytesValue', TYPE.BYTES),
    ],
  };
})();

const wellKnownTimestamp = {
  name: 'google/protobuf/timestamp.proto',
  package: 'google.protobuf',
  syntax: 'proto3',
  messageType: [
    {
      name: 'Timestamp',
      field: [
        { name: 'seconds', number: 1, type: TYPE.INT64, label: 1 },
        { name: 'nanos', number: 2, type: TYPE.INT32, label: 1 },
      ],
    },
  ],
};

const wellKnownAny = {
  name: 'google/protobuf/any.proto',
  package: 'google.protobuf',
  syntax: 'proto3',
  messageType: [
    {
      name: 'Any',
      field: [
        { name: 'type_url', number: 1, type: TYPE.STRING, label: LABEL_OPTIONAL },
        { name: 'value', number: 2, type: TYPE.BYTES, label: LABEL_OPTIONAL },
      ],
    },
  ],
};

const wellKnownStruct = {
  name: 'google/protobuf/struct.proto',
  package: 'google.protobuf',
  syntax: 'proto3',
  messageType: [
    {
      name: 'Struct',
      field: [
        {
          name: 'fields',
          number: 1,
          type: TYPE.MESSAGE,
          typeName: '.google.protobuf.Struct.FieldsEntry',
          label: LABEL_REPEATED,
        },
      ],
      nestedType: [
        {
          name: 'FieldsEntry',
          field: [
            { name: 'key', number: 1, type: TYPE.STRING, label: LABEL_OPTIONAL },
            { name: 'value', number: 2, type: TYPE.MESSAGE, typeName: '.google.protobuf.Value', label: LABEL_OPTIONAL },
          ],
          options: { mapEntry: true },
        },
      ],
    },
    {
      name: 'Value',
      field: [
        { name: 'null_value', number: 1, type: TYPE.ENUM, typeName: '.google.protobuf.NullValue', label: LABEL_OPTIONAL, oneofIndex: 0 },
        { name: 'number_value', number: 2, type: TYPE.DOUBLE, label: LABEL_OPTIONAL, oneofIndex: 0 },
        { name: 'string_value', number: 3, type: TYPE.STRING, label: LABEL_OPTIONAL, oneofIndex: 0 },
        { name: 'bool_value', number: 4, type: TYPE.BOOL, label: LABEL_OPTIONAL, oneofIndex: 0 },
        { name: 'struct_value', number: 5, type: TYPE.MESSAGE, typeName: '.google.protobuf.Struct', label: LABEL_OPTIONAL, oneofIndex: 0 },
        { name: 'list_value', number: 6, type: TYPE.MESSAGE, typeName: '.google.protobuf.ListValue', label: LABEL_OPTIONAL, oneofIndex: 0 },
      ],
      oneofDecl: [{ name: 'kind' }],
    },
    {
      name: 'ListValue',
      field: [{ name: 'values', number: 1, type: TYPE.MESSAGE, typeName: '.google.protobuf.Value', label: LABEL_REPEATED }],
    },
  ],
  enumType: [
    {
      name: 'NullValue',
      value: [{ name: 'NULL_VALUE', number: 0 }],
    },
  ],
};

const PB2_FILES = [
  'acp_pb2.py',
  'client_pb2.py',
  'cluster_pb2.py',
  'eventpush_pb2.py',
  'gogo_pb2.py',
  'protos_pb2.py',
  'service_activation_pb2.py',
  'user_events_pb2.py',
  'vehicle_commands_pb2.py',
  'vehicle_events_pb2.py',
  'vehicleapi_pb2.py',
  'vin_events_pb2.py',
];

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${url}: ${res.status}`);
  return await res.text();
}

/**
 * Extract the byte string passed to `AddSerializedFile(b'...')`. Supports
 * implicit string concatenation (`b'...' b'...'`) and both quote styles.
 */
function extractSerializedBytes(source: string): Buffer {
  const marker = 'AddSerializedFile(';
  const start = source.indexOf(marker);
  if (start === -1) throw new Error('AddSerializedFile call not found');
  let i = start + marker.length;

  const chunks: Buffer[] = [];
  while (i < source.length) {
    while (i < source.length && /\s/.test(source[i])) i++;
    if (source[i] === ')') break;
    if (source[i] !== 'b') throw new Error(`expected bytes literal at offset ${i}, got ${source.slice(i, i + 20)}`);
    i++;
    const quote = source[i];
    if (quote !== "'" && quote !== '"') throw new Error(`expected quote, got ${quote}`);
    i++;

    const bytes: number[] = [];
    while (i < source.length && source[i] !== quote) {
      if (source[i] === '\\') {
        i++;
        const c = source[i];
        switch (c) {
          case 'n':
            bytes.push(0x0a);
            i++;
            break;
          case 't':
            bytes.push(0x09);
            i++;
            break;
          case 'r':
            bytes.push(0x0d);
            i++;
            break;
          case '\\':
            bytes.push(0x5c);
            i++;
            break;
          case "'":
            bytes.push(0x27);
            i++;
            break;
          case '"':
            bytes.push(0x22);
            i++;
            break;
          case 'a':
            bytes.push(0x07);
            i++;
            break;
          case 'b':
            bytes.push(0x08);
            i++;
            break;
          case 'f':
            bytes.push(0x0c);
            i++;
            break;
          case 'v':
            bytes.push(0x0b);
            i++;
            break;
          case '0':
          case '1':
          case '2':
          case '3':
          case '4':
          case '5':
          case '6':
          case '7': {
            let digits = c;
            i++;
            while (digits.length < 3 && /[0-7]/.test(source[i])) {
              digits += source[i];
              i++;
            }
            bytes.push(parseInt(digits, 8));
            break;
          }
          case 'x': {
            i++;
            const hex = source.slice(i, i + 2);
            if (!/^[0-9a-fA-F]{2}$/.test(hex)) throw new Error(`bad \\x escape: ${hex}`);
            bytes.push(parseInt(hex, 16));
            i += 2;
            break;
          }
          default:
            throw new Error(`unknown escape: \\${c}`);
        }
      } else {
        bytes.push(source.charCodeAt(i));
        i++;
      }
    }
    if (source[i] !== quote) throw new Error('unterminated bytes literal');
    i++;
    chunks.push(Buffer.from(bytes));
  }
  return Buffer.concat(chunks);
}

async function main() {
  const files: Uint8Array[] = [];
  for (const name of PB2_FILES) {
    const url = `${SOURCE_BASE}/${name}`;
    process.stdout.write(`  fetching ${name} ... `);
    const py = await fetchText(url);
    const bytes = extractSerializedBytes(py);
    files.push(bytes);
    process.stdout.write(`${bytes.length} bytes\n`);
  }

  // biome-ignore lint/suspicious/noExplicitAny: runtime type from protobufjs ext
  const desc = descriptor as any;
  const FileDescriptorProto = desc.FileDescriptorProto as protobuf.Type;
  const FileDescriptorSet = desc.FileDescriptorSet as protobuf.Type;

  // Strip gogoproto extensions and options that reference google.protobuf.*
  // well-known types we don't ship. These only carry metadata — wire format
  // (the only thing we care about for decoding) is unaffected.
  //
  // Preserve `map_entry` on MessageOptions: protobufjs uses it to recognize
  // map fields, and dropping it turns maps into plain repeated sub-messages.
  // biome-ignore lint/suspicious/noExplicitAny: protobufjs descriptor types
  const sanitizeOptions = (opts: any) => {
    if (!opts) return undefined;
    if (opts.map_entry || opts.mapEntry) return { map_entry: true, mapEntry: true };
    return undefined;
  };
  // biome-ignore lint/suspicious/noExplicitAny: protobufjs descriptor types
  const stripOptions = (msg: any) => {
    if (!msg) return;
    const kept = sanitizeOptions(msg.options);
    if (kept) msg.options = kept;
    else delete msg.options;
    for (const f of msg.field || []) delete f.options;
    for (const e of msg.enumType || []) {
      delete e.options;
      for (const v of e.value || []) delete v.options;
    }
    for (const n of msg.nestedType || []) stripOptions(n);
    for (const x of msg.extensionRange || []) delete x.options;
  };

  const wellKnownFiles = [wellKnownWrappers, wellKnownTimestamp, wellKnownAny, wellKnownStruct];

  const parsed = files
    .map((buf) => FileDescriptorProto.toObject(FileDescriptorProto.decode(buf), { longs: Number, defaults: false }))
    // biome-ignore lint/suspicious/noExplicitAny: parsed descriptor
    .filter((f: any) => f.name !== 'gogo.proto')
    // biome-ignore lint/suspicious/noExplicitAny: parsed descriptor
    .map((f: any) => {
      delete f.options;
      f.dependency = (f.dependency || []).filter((d: string) => d !== 'gogo.proto');
      f.extension = [];
      for (const m of f.messageType || []) stripOptions(m);
      for (const e of f.enumType || []) {
        delete e.options;
        for (const v of e.value || []) delete v.options;
      }
      return f;
    });

  const set = FileDescriptorSet.fromObject({ file: [...wellKnownFiles, ...parsed] });
  const encoded = FileDescriptorSet.encode(set).finish();

  const outPath = path.resolve(__dirname, '..', 'src', 'proto', 'descriptors.bin');
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, encoded);
  console.log(`wrote ${outPath} (${encoded.length} bytes)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
