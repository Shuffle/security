import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

function patchFile(filePath, replacements) {
  const fullPath = path.join(rootDir, filePath);
  if (!fs.existsSync(fullPath)) {
    return;
  }
  let content = fs.readFileSync(fullPath, 'utf8');
  let changed = false;

  for (const [target, replacement] of replacements) {
    if (content.includes(target)) {
      content = content.replaceAll(target, replacement);
      changed = true;
    }
  }

  if (changed) {
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`[patch-capacitor] Successfully patched: ${filePath}`);
  }
}

// 1. Patch @capacitor/push-notifications
patchFile(
  'node_modules/@capacitor/push-notifications/ios/Sources/PushNotificationsPlugin/PushNotificationsHandler.swift',
  [
    [
      'self.plugin?.getConfig().getArray("presentationOptions")',
      '(self.plugin?.getConfig() as? PluginConfig)?.getArray("presentationOptions")'
    ],
    [
      'JSTypes.coerceDictionaryToJSObject(request.content.userInfo)',
      '(request.content.userInfo as? JSObject)'
    ]
  ]
);

patchFile(
  'node_modules/@capacitor/push-notifications/ios/Sources/PushNotificationsPlugin/PushNotificationsPlugin.swift',
  [
    [
      'call.getArray("notifications", JSObject.self)',
      '(call.getArray("notifications") as? [JSObject])'
    ]
  ]
);

// 2. Patch @capacitor/local-notifications
patchFile(
  'node_modules/@capacitor/local-notifications/ios/Sources/LocalNotificationsPlugin/LocalNotificationsHandler.swift',
  [
    [
      'self.plugin?.getConfig().getArray("presentationOptions")',
      '(self.plugin?.getConfig() as? PluginConfig)?.getArray("presentationOptions")'
    ],
    [
      'JSTypes.coerceDictionaryToJSObject(request.content.userInfo)',
      '(request.content.userInfo as? JSObject)'
    ]
  ]
);

patchFile(
  'node_modules/@capacitor/local-notifications/ios/Sources/LocalNotificationsPlugin/LocalNotificationsPlugin.swift',
  [
    [
      'call.getArray("notifications", JSObject.self)',
      '(call.getArray("notifications") as? [JSObject])'
    ],
    [
      'call.getArray("types", JSObject.self)',
      '(call.getArray("types") as? [JSObject])'
    ]
  ]
);

console.log('[patch-capacitor] Plugin patches applied.');
