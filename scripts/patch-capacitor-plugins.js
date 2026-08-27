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
  const pushHandlerContent = `import Foundation
import Capacitor
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

        if let config = self.plugin?.getConfig() {
            var presentationOptions = UNNotificationPresentationOptions.init()
            let configJson = config.getConfigJSON()
            var optionsArray: [String] = []
            if let arr = configJson["presentationOptions"] as? [String] {
                optionsArray = arr
            } else if let str = configJson["presentationOptions"] as? String {
                optionsArray = str.components(separatedBy: ",")
            }

            for rawOption in optionsArray {
                let option = rawOption.trimmingCharacters(in: CharacterSet.whitespaces)
                switch option {
                case "badge":
                    presentationOptions.insert(.badge)
                case "sound":
                    presentationOptions.insert(.sound)
                case "alert", "banner", "list":
                    presentationOptions.insert(.banner)
                    presentationOptions.insert(.list)
                default:
                    break
                }
            }

            if !presentationOptions.isEmpty {
                return presentationOptions
            }
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
const pushPluginFile = 'node_modules/@capacitor/push-notifications/ios/Sources/PushNotificationsPlugin/PushNotificationsPlugin.swift';
const pushPluginFullPath = path.join(rootDir, pushPluginFile);
if (fs.existsSync(pushPluginFullPath)) {
  const pushPluginContent = `import Foundation
import Capacitor
import UserNotifications

enum PushNotificationError: Error {
    case tokenParsingFailed
    case tokenRegistrationFailed
}

enum PushNotificationsPermissions: String {
    case prompt
    case denied
    case granted
}

@objc(PushNotificationsPlugin)
public class PushNotificationsPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "PushNotificationsPlugin"
    public let jsName = "PushNotifications"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "register", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "unregister", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "checkPermissions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestPermissions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getDeliveredNotifications", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "removeAllDeliveredNotifications", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "removeDeliveredNotifications", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "createChannel", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "listChannels", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "deleteChannel", returnType: CAPPluginReturnPromise)
    ]
    private let notificationDelegateHandler = PushNotificationsHandler()
    private var appDelegateRegistrationCalled: Bool = false

    override public func load() {
        self.bridge?.notificationRouter.pushNotificationHandler = self.notificationDelegateHandler
        self.notificationDelegateHandler.plugin = self

        NotificationCenter.default.addObserver(self,
                                               selector: #selector(self.didRegisterForRemoteNotificationsWithDeviceToken(notification:)),
                                               name: .capacitorDidRegisterForRemoteNotifications,
                                               object: nil)

        NotificationCenter.default.addObserver(self,
                                               selector: #selector(self.didFailToRegisterForRemoteNotificationsWithError(notification:)),
                                               name: .capacitorDidFailToRegisterForRemoteNotifications,
                                               object: nil)
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
    }

    /**
     * Register for push notifications
     */
    @objc func register(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            UIApplication.shared.registerForRemoteNotifications()
        }
        call.resolve()
    }

    /**
     * Unregister for remote notifications
     */
    @objc func unregister(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            UIApplication.shared.unregisterForRemoteNotifications()
            call.resolve()
        }
    }

    /**
     * Request notification permission
     */
    @objc override public func requestPermissions(_ call: CAPPluginCall) {
        self.notificationDelegateHandler.requestPermissions { granted, error in
            guard error == nil else {
                if let err = error {
                    call.reject(err.localizedDescription, nil, err, nil)
                    return
                }

                call.reject("unknown error in permissions request", nil, nil, nil)
                return
            }

            var result: PushNotificationsPermissions = .denied

            if granted {
                result = .granted
            }

            call.resolve(["receive": result.rawValue])
        }
    }

    /**
     * Check notification permission
     */
    @objc override public func checkPermissions(_ call: CAPPluginCall) {
        self.notificationDelegateHandler.checkPermissions { status in
            var result: PushNotificationsPermissions = .prompt

            switch status {
            case .notDetermined:
                result = .prompt
            case .denied:
                result = .denied
            case .ephemeral, .authorized, .provisional:
                result = .granted
            @unknown default:
                result = .prompt
            }

            call.resolve(["receive": result.rawValue])
        }
    }

    /**
     * Get notifications in Notification Center
     */
    @objc func getDeliveredNotifications(_ call: CAPPluginCall) {
        if !appDelegateRegistrationCalled {
            call.reject("event capacitorDidRegisterForRemoteNotifications not called. Visit https://capacitorjs.com/docs/apis/push-notifications for more information", nil, nil, nil)
            return
        }
        UNUserNotificationCenter.current().getDeliveredNotifications(completionHandler: { (notifications) in
            let ret = notifications.map({ (notification) -> [String: Any] in
                return self.notificationDelegateHandler.makeNotificationRequestJSObject(notification.request)
            })
            call.resolve([
                "notifications": ret
            ])
        })
    }

    /**
     * Remove specified notifications from Notification Center
     */
    @objc func removeDeliveredNotifications(_ call: CAPPluginCall) {
        if !appDelegateRegistrationCalled {
            call.reject("event capacitorDidRegisterForRemoteNotifications not called. Visit https://capacitorjs.com/docs/apis/push-notifications for more information", nil, nil, nil)
            return
        }
        guard let notifications = (call.options["notifications"] as? [JSObject]) else {
            call.reject("Must supply notifications to remove", nil, nil, nil)
            return
        }

        let ids = notifications.map { $0["id"] as? String ?? "" }
        UNUserNotificationCenter.current().removeDeliveredNotifications(withIdentifiers: ids)
        call.resolve()
    }

    /**
     * Remove all notifications from Notification Center
     */
    @objc func removeAllDeliveredNotifications(_ call: CAPPluginCall) {
        if !appDelegateRegistrationCalled {
            call.reject("event capacitorDidRegisterForRemoteNotifications not called. Visit https://capacitorjs.com/docs/apis/push-notifications for more information", nil, nil, nil)
            return
        }
        UNUserNotificationCenter.current().removeAllDeliveredNotifications()
        DispatchQueue.main.async(execute: {
            UIApplication.shared.applicationIconBadgeNumber = 0
        })
        call.resolve()
    }

    @objc func createChannel(_ call: CAPPluginCall) {
        call.unimplemented("Not available on iOS")
    }

    @objc func deleteChannel(_ call: CAPPluginCall) {
        call.unimplemented("Not available on iOS")
    }

    @objc func listChannels(_ call: CAPPluginCall) {
        call.unimplemented("Not available on iOS")
    }

    @objc public func didRegisterForRemoteNotificationsWithDeviceToken(notification: NSNotification) {
        appDelegateRegistrationCalled = true
        if let deviceToken = notification.object as? Data {
            let deviceTokenString = deviceToken.reduce("", {$0 + String(format: "%02X", $1)})
            notifyListeners("registration", data: [
                "value": deviceTokenString
            ])
        } else if let stringToken = notification.object as? String {
            notifyListeners("registration", data: [
                "value": stringToken
            ])
        } else {
            notifyListeners("registrationError", data: [
                "error": PushNotificationError.tokenParsingFailed.localizedDescription
            ])
        }
    }

    @objc public func didFailToRegisterForRemoteNotificationsWithError(notification: NSNotification) {
        appDelegateRegistrationCalled = true
        guard let error = notification.object as? Error else {
            return
        }
        notifyListeners("registrationError", data: [
            "error": error.localizedDescription
        ])
    }
}
`;
  fs.writeFileSync(pushPluginFullPath, pushPluginContent, 'utf8');
  console.log(`[patch-capacitor] Overwrote: ${pushPluginFile}`);
}

// 3. Patch @capacitor/local-notifications: LocalNotificationsHandler.swift
const localHandlerFile = 'node_modules/@capacitor/local-notifications/ios/Sources/LocalNotificationsPlugin/LocalNotificationsHandler.swift';
const localHandlerFullPath = path.join(rootDir, localHandlerFile);
if (fs.existsSync(localHandlerFullPath)) {
  let content = fs.readFileSync(localHandlerFullPath, 'utf8');
  if (!content.includes('import Foundation')) {
    content = 'import Foundation\n' + content;
  }
  content = content.replace(
    /if let optionsString = self\.plugin\?\.getConfig\(\)\.getString\("presentationOptions"\)[\s\S]*?return presentationOptions\s*\}/,
    `if let config = self.plugin?.getConfig() {
            var presentationOptions = UNNotificationPresentationOptions.init()
            let configJson = config.getConfigJSON()
            var optionsArray: [String] = []
            if let arr = configJson["presentationOptions"] as? [String] {
                optionsArray = arr
            } else if let str = configJson["presentationOptions"] as? String {
                optionsArray = str.components(separatedBy: ",")
            }

            for rawOption in optionsArray {
                let option = rawOption.trimmingCharacters(in: CharacterSet.whitespaces)
                switch option {
                case "badge":
                    presentationOptions.insert(.badge)
                case "sound":
                    presentationOptions.insert(.sound)
                case "alert", "banner", "list":
                    presentationOptions.insert(.banner)
                    presentationOptions.insert(.list)
                default:
                    break
                }
            }

            if !presentationOptions.isEmpty {
                return presentationOptions
            }
        }`
  );
  content = content.replace(
    /if let userInfo = JSTypes\.coerceDictionaryToJSObject\(request\.content\.userInfo\) \{[\s\S]*?notificationData\["extra"\] = userInfo\s*\}/,
    `var userInfoObj = JSObject()
        for (k, v) in request.content.userInfo {
            if let key = k as? String {
                if let val = v as? JSValue { userInfoObj[key] = val } else { userInfoObj[key] = "\\(v)" }
            }
        }
        if !userInfoObj.isEmpty {
            notificationData["extra"] = userInfoObj
        }`
  );
  fs.writeFileSync(localHandlerFullPath, content, 'utf8');
  console.log(`[patch-capacitor] Patched: ${localHandlerFile}`);
}

// 4. Patch @capacitor/local-notifications: LocalNotificationsPlugin.swift
const localPluginFile = 'node_modules/@capacitor/local-notifications/ios/Sources/LocalNotificationsPlugin/LocalNotificationsPlugin.swift';
const localPluginFullPath = path.join(rootDir, localPluginFile);
if (fs.existsSync(localPluginFullPath)) {
  let content = fs.readFileSync(localPluginFullPath, 'utf8');
  content = content.replaceAll('call.getArray("notifications", JSObject.self)', '(call.options["notifications"] as? [JSObject])');
  content = content.replaceAll('call.getArray("notifications")', '(call.options["notifications"] as? [JSObject])');
  content = content.replaceAll('call.getArray("types", JSObject.self)', '(call.options["types"] as? [JSObject])');
  content = content.replaceAll('call.getArray("types")', '(call.options["types"] as? [JSObject])');
  fs.writeFileSync(localPluginFullPath, content, 'utf8');
  console.log(`[patch-capacitor] Patched: ${localPluginFile}`);
}

console.log('[patch-capacitor] Plugin patches applied successfully.');
