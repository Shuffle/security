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
    if (typeof target === 'string') {
      if (content.includes(target)) {
        content = content.replaceAll(target, replacement);
        changed = true;
      }
    } else if (target instanceof RegExp) {
      if (target.test(content)) {
        content = content.replace(target, replacement);
        changed = true;
      }
    }
  }

  if (changed) {
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`[patch-capacitor] Successfully patched: ${filePath}`);
  }
}

// 1. Patch @capacitor/push-notifications: PushNotificationsHandler.swift
const pushHandlerFile = 'node_modules/@capacitor/push-notifications/ios/Sources/PushNotificationsPlugin/PushNotificationsHandler.swift';
const pushHandlerFullPath = path.join(rootDir, pushHandlerFile);
if (fs.existsSync(pushHandlerFullPath)) {
  const pushHandlerContent = `import Capacitor
import UserNotifications

public class PushNotificationsHandler: NSObject, NotificationHandlerProtocol {
    public weak var plugin: CAPPlugin?
    var notificationRequestLookup = [String: JSObject]()

    public func requestPermissions(with completion: ((Bool, Error?) -> Void)? = nil) {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { granted, error in
            completion?(granted, error)
        }
    }

    public func checkPermissions(with completion: ((UNAuthorizationStatus) -> Void)? = nil) {
        UNUserNotificationCenter.current().getNotificationSettings { settings in
            completion?(settings.authorizationStatus)
        }
    }

    public func willPresent(notification: UNNotification) -> UNNotificationPresentationOptions {
        let notificationData = makeNotificationRequestJSObject(notification.request)
        self.plugin?.notifyListeners("pushNotificationReceived", data: notificationData)

        if let options = notificationRequestLookup[notification.request.identifier] {
            let silent = options["silent"] as? Bool ?? false

            if silent {
                return UNNotificationPresentationOptions.init(rawValue: 0)
            }
        }

        if let optionsString = self.plugin?.getConfig().getString("presentationOptions") {
            var presentationOptions = UNNotificationPresentationOptions.init()
            let optionsArray = optionsString.components(separatedBy: ",")

            optionsArray.forEach { rawOption in
                let option = rawOption.trimmingCharacters(in: .whitespaces)
                switch option {
                case "banner":
                    presentationOptions.insert(.banner)
                case "list":
                    presentationOptions.insert(.list)
                case "alert":
                    presentationOptions.insert(.banner)
                    presentationOptions.insert(.list)
                case "badge":
                    presentationOptions.insert(.badge)
                case "sound":
                    presentationOptions.insert(.sound)
                default:
                    print("Unrecognized presentation option: \\(option)")
                }
            }

            return presentationOptions
        }

        return []
    }

    public func didReceive(response: UNNotificationResponse) {
        var data = JSObject()

        let originalNotificationRequest = response.notification.request
        let actionId = response.actionIdentifier

        if actionId == UNNotificationDefaultActionIdentifier {
            data["actionId"] = "tap"
        } else if actionId == UNNotificationDismissActionIdentifier {
            data["actionId"] = "dismiss"
        } else {
            data["actionId"] = actionId
        }

        if let inputType = response as? UNTextInputNotificationResponse {
            data["inputValue"] = inputType.userText
        }

        data["notification"] = makeNotificationRequestJSObject(originalNotificationRequest)

        self.plugin?.notifyListeners("pushNotificationActionPerformed", data: data, retainUntilConsumed: true)

    }

    func makeNotificationRequestJSObject(_ request: UNNotificationRequest) -> JSObject {
        var dataObj = JSObject()
        for (k, v) in request.content.userInfo {
            if let key = k as? String {
                if let val = v as? JSValue {
                    dataObj[key] = val
                } else {
                    dataObj[key] = "\\(v)"
                }
            }
        }
        return [
            "id": request.identifier,
            "title": request.content.title,
            "subtitle": request.content.subtitle,
            "badge": request.content.badge ?? 1,
            "body": request.content.body,
            "data": dataObj
        ]
    }
}
`;
  fs.writeFileSync(pushHandlerFullPath, pushHandlerContent, 'utf8');
  console.log(`[patch-capacitor] Overwrote: ${pushHandlerFile}`);
}

// 2. Patch @capacitor/push-notifications: PushNotificationsPlugin.swift
patchFile(
  'node_modules/@capacitor/push-notifications/ios/Sources/PushNotificationsPlugin/PushNotificationsPlugin.swift',
  [
    [
      /guard let notifications = call\.getArray\("notifications"[^)]*\) else/g,
      'guard let notifications = (call.options["notifications"] as? [JSObject]) else'
    ],
    [
      /guard let notifications = \(call\.getArray\("notifications"\) as\? \[JSObject\]\) else/g,
      'guard let notifications = (call.options["notifications"] as? [JSObject]) else'
    ]
  ]
);

// 3. Patch @capacitor/local-notifications: LocalNotificationsHandler.swift
patchFile(
  'node_modules/@capacitor/local-notifications/ios/Sources/LocalNotificationsPlugin/LocalNotificationsHandler.swift',
  [
    [
      /if let optionsArray = [^\{]*presentationOptions[^\{]*\{/g,
      `if let optionsString = self.plugin?.getConfig().getString("presentationOptions") {\n            let optionsArray = optionsString.components(separatedBy: ",")`
    ],
    [
      /if let userInfo = JSTypes\.coerceDictionaryToJSObject\(request\.content\.userInfo\) \{/g,
      `var userInfoObj = JSObject()\n        for (k, v) in request.content.userInfo {\n            if let key = k as? String {\n                if let val = v as? JSValue { userInfoObj[key] = val } else { userInfoObj[key] = "\\(v)" }\n            }\n        }\n        if !userInfoObj.isEmpty {\n            let userInfo = userInfoObj`
    ],
    [
      /if let userInfo = \(request\.content\.userInfo as\? JSObject\) \{/g,
      `var userInfoObj = JSObject()\n        for (k, v) in request.content.userInfo {\n            if let key = k as? String {\n                if let val = v as? JSValue { userInfoObj[key] = val } else { userInfoObj[key] = "\\(v)" }\n            }\n        }\n        if !userInfoObj.isEmpty {\n            let userInfo = userInfoObj`
    ]
  ]
);

// 4. Patch @capacitor/local-notifications: LocalNotificationsPlugin.swift
patchFile(
  'node_modules/@capacitor/local-notifications/ios/Sources/LocalNotificationsPlugin/LocalNotificationsPlugin.swift',
  [
    [
      /guard let notifications = call\.getArray\("notifications", JSObject\.self\) else/g,
      'guard let notifications = (call.options["notifications"] as? [JSObject]) else'
    ],
    [
      /guard let notifications = \(call\.getArray\("notifications"\) as\? \[JSObject\]\) else/g,
      'guard let notifications = (call.options["notifications"] as? [JSObject]) else'
    ],
    [
      /guard let notifications = call\.getArray\("notifications", JSObject\.self\), notifications\.count > 0 else/g,
      'guard let notifications = (call.options["notifications"] as? [JSObject]), notifications.count > 0 else'
    ],
    [
      /guard let notifications = \(call\.getArray\("notifications"\) as\? \[JSObject\]\), notifications\.count > 0 else/g,
      'guard let notifications = (call.options["notifications"] as? [JSObject]), notifications.count > 0 else'
    ],
    [
      /guard let types = call\.getArray\("types", JSObject\.self\) else/g,
      'guard let types = (call.options["types"] as? [JSObject]) else'
    ],
    [
      /guard let types = \(call\.getArray\("types"\) as\? \[JSObject\]\) else/g,
      'guard let types = (call.options["types"] as? [JSObject]) else'
    ]
  ]
);

console.log('[patch-capacitor] Plugin patches applied successfully.');
