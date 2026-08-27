import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('[patch-capacitor] Starting comprehensive Capacitor plugin Swift audit & patch...');

// =========================================================================
// 1. @capacitor/push-notifications: PushNotificationsHandler.swift
// =========================================================================
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

// =========================================================================
// 2. @capacitor/push-notifications: PushNotificationsPlugin.swift
// =========================================================================
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

    private func rejectCall(_ call: CAPPluginCall, _ message: String, _ code: String? = nil, _ error: Error? = nil) {
        let errData: PluginCallResultData? = nil
        call.errorHandler(CAPPluginCallError(message: message, code: code, error: error, data: errData))
    }

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

    @objc func register(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            UIApplication.shared.registerForRemoteNotifications()
        }
        call.resolve()
    }

    @objc func unregister(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            UIApplication.shared.unregisterForRemoteNotifications()
        }
        call.resolve()
    }

    @objc override public func checkPermissions(_ call: CAPPluginCall) {
        self.notificationDelegateHandler.checkPermissions { status in
            var result: PushNotificationsPermissions = .prompt
            switch status {
            case .notDetermined:
                result = .prompt
            case .denied:
                result = .denied
            case .authorized, .ephemeral, .provisional:
                result = .granted
            @unknown default:
                result = .prompt
            }
            call.resolve(["receive": result.rawValue])
        }
    }

    @objc override public func requestPermissions(_ call: CAPPluginCall) {
        self.notificationDelegateHandler.requestPermissions { granted, error in
            guard error == nil else {
                self.rejectCall(call, error!.localizedDescription)
                return
            }
            var result: PushNotificationsPermissions = .denied
            if granted {
                result = .granted
            }
            call.resolve(["receive": result.rawValue])
        }
    }

    @objc func getDeliveredNotifications(_ call: CAPPluginCall) {
        UNUserNotificationCenter.current().getDeliveredNotifications { notifications in
            let ret = notifications.map { notification -> JSObject in
                return self.notificationDelegateHandler.makeNotificationRequestJSObject(notification.request)
            }
            call.resolve(["notifications": ret])
        }
    }

    @objc func removeDeliveredNotifications(_ call: CAPPluginCall) {
        guard let notifications = call.options["notifications"] as? [JSObject] else {
            self.rejectCall(call, "Must supply notifications to remove")
            return
        }

        let ids = notifications.compactMap { $0["id"] as? String }
        UNUserNotificationCenter.current().removeDeliveredNotifications(withIdentifiers: ids)
        call.resolve()
    }

    @objc func removeAllDeliveredNotifications(_ call: CAPPluginCall) {
        UNUserNotificationCenter.current().removeAllDeliveredNotifications()
        call.resolve()
    }

    @objc func createChannel(_ call: CAPPluginCall) {
        call.resolve()
    }

    @objc func deleteChannel(_ call: CAPPluginCall) {
        call.resolve()
    }

    @objc func listChannels(_ call: CAPPluginCall) {
        call.resolve(["channels": []])
    }

    @objc public func didRegisterForRemoteNotificationsWithDeviceToken(notification: NSNotification) {
        if let deviceToken = notification.object as? Data {
            let deviceTokenString = deviceToken.reduce("", {$0 + String(format: "%02X", $1)})
            notifyListeners("registration", data: ["value": deviceTokenString])
        } else if let stringToken = notification.object as? String {
            notifyListeners("registration", data: ["value": stringToken])
        } else {
            let errData: PluginCallResultData? = nil
            notifyListeners("registrationError", data: [
                "error": CAPPluginCallError(message: PushNotificationError.tokenParsingFailed.localizedDescription, code: nil, error: PushNotificationError.tokenParsingFailed, data: errData)
            ])
        }
    }

    @objc public func didFailToRegisterForRemoteNotificationsWithError(notification: NSNotification) {
        guard let err = notification.object as? Error else { return }
        let errData: PluginCallResultData? = nil
        notifyListeners("registrationError", data: [
            "error": CAPPluginCallError(message: err.localizedDescription, code: nil, error: err, data: errData)
        ])
    }
}
`;
  fs.writeFileSync(pushPluginFullPath, pushPluginContent, 'utf8');
  console.log(`[patch-capacitor] Overwrote: ${pushPluginFile}`);
}

// =========================================================================
// 3. @capacitor/local-notifications: LocalNotificationsHandler.swift
// =========================================================================
const localHandlerFile = 'node_modules/@capacitor/local-notifications/ios/Sources/LocalNotificationsPlugin/LocalNotificationsHandler.swift';
const localHandlerFullPath = path.join(rootDir, localHandlerFile);
if (fs.existsSync(localHandlerFullPath)) {
  let content = fs.readFileSync(localHandlerFullPath, 'utf8');
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

// =========================================================================
// 4. @capacitor/local-notifications: LocalNotificationsPlugin.swift
// =========================================================================
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

// =========================================================================
// 5. @capacitor/status-bar: StatusBar.swift & StatusBarPlugin.swift
// =========================================================================
const statusBarFile = 'node_modules/@capacitor/status-bar/ios/Sources/StatusBarPlugin/StatusBar.swift';
const statusBarFullPath = path.join(rootDir, statusBarFile);
if (fs.existsSync(statusBarFullPath)) {
  const statusBarContent = `import Foundation
import Capacitor
import UIKit

public class StatusBar {
    private var bridge: CAPBridgeProtocol
    private var isOverlayingWebview = true
    private var backgroundColor = UIColor.black
    private var backgroundView: UIView?
    private var observers: [NSObjectProtocol] = []

    init(bridge: CAPBridgeProtocol, config: StatusBarConfig) {
        self.bridge = bridge
        setupObservers(with: config)
    }

    deinit {
        observers.forEach { NotificationCenter.default.removeObserver($0) }
    }

    private func setupObservers(with config: StatusBarConfig) {
        observers.append(NotificationCenter.default.addObserver(forName: .capacitorViewDidAppear, object: .none, queue: .none) { [weak self] _ in
            self?.handleViewDidAppear(config: config)
        })
        observers.append(NotificationCenter.default.addObserver(forName: .capacitorStatusBarTapped, object: .none, queue: .none) { [weak self] _ in
            self?.bridge.triggerJSEvent(eventName: "statusTap", target: "window")
        })
        observers.append(NotificationCenter.default.addObserver(forName: .capacitorViewWillTransition, object: .none, queue: .none) { [weak self] _ in
            self?.handleViewWillTransition()
        })
    }

    private func handleViewDidAppear(config: StatusBarConfig) {
        setStyle(config.style)
        setBackgroundColor(config.backgroundColor)
        setOverlaysWebView(config.overlaysWebView)
    }

    private func handleViewWillTransition() {
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) { [weak self] in
            self?.resizeStatusBarBackgroundView()
            self?.resizeWebView()
        }
    }

    func setStyle(_ style: UIStatusBarStyle) {
        bridge.statusBarStyle = style
    }

    func setBackgroundColor(_ color: UIColor) {
        backgroundColor = color
        backgroundView?.backgroundColor = color
    }

    func setAnimation(_ animation: String) {
        if animation == "SLIDE" {
            bridge.statusBarAnimation = .slide
        } else if animation == "NONE" {
            bridge.statusBarAnimation = .none
        } else {
            bridge.statusBarAnimation = .fade
        }
    }

    func hide(animation: String) {
        setAnimation(animation)
        if bridge.statusBarVisible {
            bridge.statusBarVisible = false
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) { [weak self] in
                self?.resizeWebView()
                self?.backgroundView?.removeFromSuperview()
                self?.backgroundView?.isHidden = true
            }
        }
    }

    func show(animation: String) {
        setAnimation(animation)
        if !bridge.statusBarVisible {
            bridge.statusBarVisible = true
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) { [self] in
                resizeWebView()
                if !isOverlayingWebview {
                    resizeStatusBarBackgroundView()
                    bridge.webView?.superview?.addSubview(backgroundView!)
                }
                backgroundView?.isHidden = false
            }
        }
    }

    private func hexFromColor(_ color: UIColor) -> String {
        var red: CGFloat = 0
        var green: CGFloat = 0
        var blue: CGFloat = 0
        var alpha: CGFloat = 0
        guard color.getRed(&red, green: &green, blue: &blue, alpha: &alpha) else { return "#000000" }
        return String(format: "#%02lX%02lX%02lX", Int(round(red * 255)), Int(round(green * 255)), Int(round(blue * 255)))
    }

    func getInfo() -> StatusBarInfo {
        let style: String
        switch bridge.statusBarStyle {
        case .default:
            style = "DEFAULT"
        case .lightContent:
            style = "DARK"
        case .darkContent:
            style = "LIGHT"
        @unknown default:
            style = "DEFAULT"
        }

        return StatusBarInfo(
            overlays: isOverlayingWebview,
            visible: bridge.statusBarVisible,
            style: style,
            color: hexFromColor(backgroundColor),
            height: getStatusBarFrame().size.height
        )
    }

    func setOverlaysWebView(_ overlay: Bool) {
        if overlay == isOverlayingWebview { return }
        isOverlayingWebview = overlay
        if overlay {
            backgroundView?.removeFromSuperview()
        } else {
            initializeBackgroundViewIfNeeded()
            bridge.webView?.superview?.addSubview(backgroundView!)
        }
        resizeWebView()
    }

    private func resizeWebView() {
        let bounds: CGRect? = bridge.viewController?.view.window?.windowScene?.keyWindow?.bounds

        guard
            let webView = bridge.webView,
            let bounds = bounds
        else { return }
        bridge.viewController?.view.frame = bounds
        webView.frame = bounds
        let statusBarHeight = getStatusBarFrame().size.height
        var webViewFrame = webView.frame

        if isOverlayingWebview {
            let safeAreaTop = webView.safeAreaInsets.top
            if statusBarHeight >= safeAreaTop && safeAreaTop > 0 {
                webViewFrame.origin.y = safeAreaTop == 40 ? 20 : statusBarHeight - safeAreaTop
            } else {
                webViewFrame.origin.y = 0
            }
        } else {
            webViewFrame.origin.y = statusBarHeight
        }
        webViewFrame.size.height -= webViewFrame.origin.y
        webView.frame = webViewFrame
    }

    private func resizeStatusBarBackgroundView() {
        backgroundView?.frame = getStatusBarFrame()
    }

    private func getStatusBarFrame() -> CGRect {
        return bridge.viewController?.view.window?.windowScene?.statusBarManager?.statusBarFrame ?? .zero
    }

    private func initializeBackgroundViewIfNeeded() {
        if backgroundView == nil {
            backgroundView = UIView(frame: getStatusBarFrame())
            backgroundView!.backgroundColor = backgroundColor
            backgroundView!.autoresizingMask = [.flexibleWidth, .flexibleBottomMargin]
            backgroundView!.isHidden = !bridge.statusBarVisible
        }
    }
}
`;
  fs.writeFileSync(statusBarFullPath, statusBarContent, 'utf8');
  console.log(`[patch-capacitor] Overwrote: ${statusBarFile}`);
}

const statusBarPluginFile = 'node_modules/@capacitor/status-bar/ios/Sources/StatusBarPlugin/StatusBarPlugin.swift';
const statusBarPluginFullPath = path.join(rootDir, statusBarPluginFile);
if (fs.existsSync(statusBarPluginFullPath)) {
  const statusBarPluginContent = `import Foundation
import Capacitor
import UIKit

@objc(StatusBarPlugin)
public class StatusBarPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "StatusBarPlugin"
    public let jsName = "StatusBar"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setStyle", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setBackgroundColor", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "show", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "hide", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getInfo", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setOverlaysWebView", returnType: CAPPluginReturnPromise)
    ]
    private var statusBar: StatusBar?
    private let statusBarVisibilityChanged = "statusBarVisibilityChanged"
    private let statusBarOverlayChanged = "statusBarOverlayChanged"

    private func colorFromHex(_ hex: String) -> UIColor? {
        var hexSanitized = hex.trimmingCharacters(in: .whitespacesAndNewlines)
        hexSanitized = hexSanitized.replacingOccurrences(of: "#", with: "")
        var rgb: UInt64 = 0
        guard Scanner(string: hexSanitized).scanHexInt64(&rgb) else { return nil }
        let length = hexSanitized.count
        if length == 6 {
            let r = CGFloat((rgb & 0xFF0000) >> 16) / 255.0
            let g = CGFloat((rgb & 0x00FF00) >> 8) / 255.0
            let b = CGFloat(rgb & 0x0000FF) / 255.0
            return UIColor(red: r, green: g, blue: b, alpha: 1.0)
        } else if length == 8 {
            let r = CGFloat((rgb & 0xFF000000) >> 24) / 255.0
            let g = CGFloat((rgb & 0x00FF0000) >> 16) / 255.0
            let b = CGFloat((rgb & 0x0000FF00) >> 8) / 255.0
            let a = CGFloat(rgb & 0x000000FF) / 255.0
            return UIColor(red: r, green: g, blue: b, alpha: a)
        }
        return nil
    }

    override public func load() {
        guard let bridge = bridge else { return }
        statusBar = StatusBar(bridge: bridge, config: statusBarConfig())
    }

    private func statusBarConfig() -> StatusBarConfig {
        var config = StatusBarConfig()
        let configJson = getConfig().getConfigJSON()
        if let overlays = configJson["overlaysWebView"] as? Bool {
            config.overlaysWebView = overlays
        }
        if let colorConfig = configJson["backgroundColor"] as? String, let color = colorFromHex(colorConfig) {
            config.backgroundColor = color
        }
        if let configStyle = configJson["style"] as? String {
            config.style = style(fromString: configStyle)
        }
        return config
    }

    private func style(fromString: String) -> UIStatusBarStyle {
        switch fromString.lowercased() {
        case "dark", "lightcontent":
            return .lightContent
        case "light", "darkcontent":
            return .darkContent
        case "default":
            return .default
        default:
            return .default
        }
    }

    @objc func setStyle(_ call: CAPPluginCall) {
        if let styleString = call.options["style"] as? String {
            statusBar?.setStyle(style(fromString: styleString))
        }
        call.resolve([:])
    }

    @objc func setBackgroundColor(_ call: CAPPluginCall) {
        guard
            let hexString = call.options["color"] as? String,
            let color = colorFromHex(hexString)
        else { return }
        DispatchQueue.main.async { [weak self] in
            self?.statusBar?.setBackgroundColor(color)
        }
        call.resolve()
    }

    @objc func hide(_ call: CAPPluginCall) {
        let animation = call.options["animation"] as? String ?? "FADE"
        DispatchQueue.main.async { [weak self] in
            self?.statusBar?.hide(animation: animation)
            guard
                let info = self?.statusBar?.getInfo(),
                let dict = self?.toDict(info),
                let event = self?.statusBarVisibilityChanged
            else { return }
            self?.notifyListeners(event, data: dict)
        }
        call.resolve()
    }

    @objc func show(_ call: CAPPluginCall) {
        let animation = call.options["animation"] as? String ?? "FADE"
        DispatchQueue.main.async { [weak self] in
            self?.statusBar?.show(animation: animation)
            guard
                let info = self?.statusBar?.getInfo(),
                let dict = self?.toDict(info),
                let event = self?.statusBarVisibilityChanged
            else { return }
            self?.notifyListeners(event, data: dict)
        }
        call.resolve()
    }

    @objc func getInfo(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            guard
                let info = self?.statusBar?.getInfo(),
                let dict = self?.toDict(info)
            else { return }
            call.resolve(dict)
        }
    }

    @objc func setOverlaysWebView(_ call: CAPPluginCall) {
        guard let overlay = call.options["overlay"] as? Bool else { return }
        DispatchQueue.main.async { [weak self] in
            self?.statusBar?.setOverlaysWebView(overlay)
            guard
                let info = self?.statusBar?.getInfo(),
                let dict = self?.toDict(info),
                let event = self?.statusBarOverlayChanged
            else { return }
            self?.notifyListeners(event, data: dict)
        }
        call.resolve()
    }

    private func toDict(_ info: StatusBarInfo) -> [String: Any] {
        return [
            "visible": info.visible ?? true,
            "style": info.style ?? "DEFAULT",
            "color": info.color ?? "#000000",
            "overlays": info.overlays ?? true,
            "height": info.height ?? 0
        ]
    }
}
`;
  fs.writeFileSync(statusBarPluginFullPath, statusBarPluginContent, 'utf8');
  console.log(`[patch-capacitor] Overwrote: ${statusBarPluginFile}`);
}

// =========================================================================
// 6. @capacitor/splash-screen: SplashScreenPlugin.swift
// =========================================================================
const splashPluginFile = 'node_modules/@capacitor/splash-screen/ios/Sources/SplashScreenPlugin/SplashScreenPlugin.swift';
const splashPluginFullPath = path.join(rootDir, splashPluginFile);
if (fs.existsSync(splashPluginFullPath)) {
  const splashPluginContent = `import Foundation
import Capacitor
import UIKit

@objc(SplashScreenPlugin)
public class SplashScreenPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "SplashScreenPlugin"
    public let jsName = "SplashScreen"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "show", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "hide", returnType: CAPPluginReturnPromise)
    ]
    private var splashScreen: SplashScreen?

    private func rejectCall(_ call: CAPPluginCall, _ message: String) {
        let errData: PluginCallResultData? = nil
        call.errorHandler(CAPPluginCallError(message: message, code: nil, error: nil, data: errData))
    }

    private func colorFromHex(_ hex: String) -> UIColor? {
        var hexSanitized = hex.trimmingCharacters(in: .whitespacesAndNewlines)
        hexSanitized = hexSanitized.replacingOccurrences(of: "#", with: "")
        var rgb: UInt64 = 0
        guard Scanner(string: hexSanitized).scanHexInt64(&rgb) else { return nil }
        let length = hexSanitized.count
        if length == 6 {
            let r = CGFloat((rgb & 0xFF0000) >> 16) / 255.0
            let g = CGFloat((rgb & 0x00FF00) >> 8) / 255.0
            let b = CGFloat(rgb & 0x0000FF) / 255.0
            return UIColor(red: r, green: g, blue: b, alpha: 1.0)
        } else if length == 8 {
            let r = CGFloat((rgb & 0xFF000000) >> 24) / 255.0
            let g = CGFloat((rgb & 0x00FF0000) >> 16) / 255.0
            let b = CGFloat((rgb & 0x0000FF00) >> 8) / 255.0
            let a = CGFloat(rgb & 0x000000FF) / 255.0
            return UIColor(red: r, green: g, blue: b, alpha: a)
        }
        return nil
    }

    override public func load() {
        if let view = bridge?.viewController?.view {
            splashScreen = SplashScreen(parentView: view, config: splashScreenConfig())
            splashScreen?.showOnLaunch()
        }
    }

    private func splashScreenConfig() -> SplashScreenConfig {
        var config = SplashScreenConfig()
        let configJson = getConfig().getConfigJSON()

        if let backgroundColor = configJson["backgroundColor"] as? String, let color = colorFromHex(backgroundColor) {
            config.backgroundColor = color
        }
        if let spinnerStyle = configJson["androidSpinnerStyle"] as? String {
            config.spinnerStyle = spinnerStyle == "horizontal" ? .large : .medium
        }
        if let spinnerColor = configJson["spinnerColor"] as? String, let color = colorFromHex(spinnerColor) {
            config.spinnerColor = color
        }
        if let showSpinner = configJson["showSpinner"] as? Bool {
            config.showSpinner = showSpinner
        }
        if let launchShowDuration = configJson["launchShowDuration"] as? Int {
            config.launchShowDuration = launchShowDuration
        }
        if let launchAutoHide = configJson["launchAutoHide"] as? Bool {
            config.launchAutoHide = launchAutoHide
        }
        return config
    }

    private func splashScreenSettings(from call: CAPPluginCall) -> SplashScreenSettings {
        var settings = SplashScreenSettings()

        if let autoHide = call.options["autoHide"] as? Bool {
            settings.autoHide = autoHide
        }
        if let fadeInDuration = call.options["fadeInDuration"] as? Int {
            settings.fadeInDuration = fadeInDuration
        }
        if let fadeOutDuration = call.options["fadeOutDuration"] as? Int {
            settings.fadeOutDuration = fadeOutDuration
        }
        if let showDuration = call.options["showDuration"] as? Int {
            settings.showDuration = showDuration
        }
        return settings
    }

    @objc func show(_ call: CAPPluginCall) {
        if let splashScreen = splashScreen {
            let settings = splashScreenSettings(from: call)
            splashScreen.show(settings: settings, completion: {
                call.resolve()
            })
        } else {
            rejectCall(call, "Unable to show Splash Screen")
        }
    }

    @objc func hide(_ call: CAPPluginCall) {
        if let splashScreen = splashScreen {
            let settings = splashScreenSettings(from: call)
            splashScreen.hide(settings: settings)
            call.resolve()
        } else {
            rejectCall(call, "Unable to hide Splash Screen")
        }
    }
}
`;
  fs.writeFileSync(splashPluginFullPath, splashPluginContent, 'utf8');
  console.log(`[patch-capacitor] Overwrote: ${splashPluginFile}`);
}

const splashConfigFile = 'node_modules/@capacitor/splash-screen/ios/Sources/SplashScreenPlugin/SplashScreenConfig.swift';
const splashConfigFullPath = path.join(rootDir, splashConfigFile);
if (fs.existsSync(splashConfigFullPath)) {
  const splashConfigContent = `import UIKit

public struct SplashScreenConfig {
    var backgroundColor: UIColor?
    var spinnerStyle: UIActivityIndicatorView.Style?
    var spinnerColor: UIColor?
    var showSpinner = false
    var launchShowDuration = 500
    var launchAutoHide = true
    var launchFadeInDuration = 0
}
`;
  fs.writeFileSync(splashConfigFullPath, splashConfigContent, 'utf8');
  console.log(`[patch-capacitor] Overwrote: ${splashConfigFile}`);
}

// =========================================================================
// 7. @capacitor/app: AppPlugin.swift
// =========================================================================
const appPluginFile = 'node_modules/@capacitor/app/ios/Sources/AppPlugin/AppPlugin.swift';
const appPluginFullPath = path.join(rootDir, appPluginFile);
if (fs.existsSync(appPluginFullPath)) {
  const appPluginContent = `import Foundation
import Capacitor
import UIKit

@objc(AppPlugin)
public class AppPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AppPlugin"
    public let jsName = "App"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "exitApp", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getInfo", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getAppLanguage", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getLaunchUrl", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getState", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "minimizeApp", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "toggleBackButtonHandler", returnType: CAPPluginReturnPromise)
    ]
    private var observers: [NSObjectProtocol] = []

    private func rejectCall(_ call: CAPPluginCall, _ message: String) {
        let errData: PluginCallResultData? = nil
        call.errorHandler(CAPPluginCallError(message: message, code: nil, error: nil, data: errData))
    }

    override public func load() {
        NotificationCenter.default.addObserver(self, selector: #selector(self.handleUrlOpened(notification:)), name: Notification.Name.capacitorOpenURL, object: nil)
        NotificationCenter.default.addObserver(self, selector: #selector(self.handleUniversalLink(notification:)), name: Notification.Name.capacitorOpenUniversalLink, object: nil)
        observers.append(NotificationCenter.default.addObserver(forName: UIApplication.didBecomeActiveNotification, object: nil, queue: OperationQueue.main) { [weak self] (_) in
            self?.notifyListeners("appStateChange", data: [
                "isActive": true
            ])
        })
        observers.append(NotificationCenter.default.addObserver(forName: UIApplication.willResignActiveNotification, object: nil, queue: OperationQueue.main) { [weak self] (_) in
            self?.notifyListeners("appStateChange", data: [
                "isActive": false
            ])
        })

        observers.append(NotificationCenter.default.addObserver(forName: UIApplication.didEnterBackgroundNotification, object: nil, queue: OperationQueue.main) { [weak self] (_) in
            self?.notifyListeners("pause", data: [:])
        })

        observers.append(NotificationCenter.default.addObserver(forName: UIApplication.willEnterForegroundNotification, object: nil, queue: OperationQueue.main) { [weak self] (_) in
            self?.notifyListeners("resume", data: [:])
        })
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
        for observer in observers {
            NotificationCenter.default.removeObserver(observer)
        }
    }

    @objc func handleUrlOpened(notification: NSNotification) {
        guard let object = notification.object as? [String: Any?] else {
            return
        }
        notifyListeners("appUrlOpen", data: makeUrlOpenObject(object), retainUntilConsumed: true)
    }

    @objc func handleUniversalLink(notification: NSNotification) {
        guard let object = notification.object as? [String: Any?] else {
            return
        }
        notifyListeners("appUrlOpen", data: makeUrlOpenObject(object), retainUntilConsumed: true)
    }

    func makeUrlOpenObject(_ object: [String: Any?]) -> JSObject {
        guard let url = object["url"] as? NSURL else {
            return [:]
        }
        let options = object["options"] as? [String: Any?] ?? [:]
        return [
            "url": url.absoluteString ?? "",
            "iosSourceApplication": options[UIApplication.OpenURLOptionsKey.sourceApplication.rawValue] as? String ?? "",
            "iosOpenInPlace": options[UIApplication.OpenURLOptionsKey.openInPlace.rawValue] as? String ?? ""
        ]
    }

    @objc func exitApp(_ call: CAPPluginCall) {
        let errData: PluginCallResultData? = nil
        call.errorHandler(CAPPluginCallError(message: "not implemented", code: "UNIMPLEMENTED", error: nil, data: errData))
    }

    @objc func getInfo(_ call: CAPPluginCall) {
        if let info = Bundle.main.infoDictionary {
            call.resolve([
                "name": info["CFBundleDisplayName"] as? String ?? "",
                "id": info["CFBundleIdentifier"] as? String ?? "",
                "build": info["CFBundleVersion"] as? String ?? "",
                "version": info["CFBundleShortVersionString"] as? String ?? ""
            ])
        } else {
            rejectCall(call, "Unable to get App Info")
        }
    }

    @objc func getLaunchUrl(_ call: CAPPluginCall) {
        if let lastUrl = ApplicationDelegateProxy.shared.lastURL {
            let urlValue = lastUrl.absoluteString
            call.resolve([
                "url": urlValue
            ])
        } else {
            call.resolve()
        }
    }

    @objc func getState(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            call.resolve([
                "isActive": UIApplication.shared.applicationState == .active
            ])
        }
    }

    @objc func minimizeApp(_ call: CAPPluginCall) {
        let errData: PluginCallResultData? = nil
        call.errorHandler(CAPPluginCallError(message: "not implemented", code: "UNIMPLEMENTED", error: nil, data: errData))
    }

    @objc func toggleBackButtonHandler(_ call: CAPPluginCall) {
        let errData: PluginCallResultData? = nil
        call.errorHandler(CAPPluginCallError(message: "not implemented", code: "UNIMPLEMENTED", error: nil, data: errData))
    }

    @objc func getAppLanguage(_ call: CAPPluginCall) {
        let languageCode = Locale.preferredLanguages.first ?? "en"
        call.resolve(["value": languageCode])
    }
}
`;
  fs.writeFileSync(appPluginFullPath, appPluginContent, 'utf8');
  console.log(`[patch-capacitor] Overwrote: ${appPluginFile}`);
}

// =========================================================================
// 8. @capacitor/haptics: HapticsPlugin.swift
// =========================================================================
const hapticsPluginFile = 'node_modules/@capacitor/haptics/ios/Sources/HapticsPlugin/HapticsPlugin.swift';
const hapticsPluginFullPath = path.join(rootDir, hapticsPluginFile);
if (fs.existsSync(hapticsPluginFullPath)) {
  const hapticsPluginContent = `import Foundation
import Capacitor
import UIKit

@objc(HapticsPlugin)
public class HapticsPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "HapticsPlugin"
    public let jsName = "Haptics"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "impact", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "notification", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "selectionStart", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "selectionChanged", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "selectionEnd", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "vibrate", returnType: CAPPluginReturnPromise)
    ]
    private let implementation = Haptics()

    @objc public func impact(_ call: CAPPluginCall) {
        var impactStyle = UIImpactFeedbackGenerator.FeedbackStyle.heavy
        if let style = call.options["style"] as? String {
            if style == "MEDIUM" {
                impactStyle = UIImpactFeedbackGenerator.FeedbackStyle.medium
            } else if style == "LIGHT" {
                impactStyle = UIImpactFeedbackGenerator.FeedbackStyle.light
            }
        }
        DispatchQueue.main.async {
            self.implementation.impact(impactStyle)
        }
        call.resolve()
    }

    @objc public func notification(_ call: CAPPluginCall) {
        var notificationType = UINotificationFeedbackGenerator.FeedbackType.success
        if let type = call.options["type"] as? String {
            if type == "WARNING" {
                notificationType = UINotificationFeedbackGenerator.FeedbackType.warning
            } else if type == "ERROR" {
                notificationType = UINotificationFeedbackGenerator.FeedbackType.error
            }
        }
        DispatchQueue.main.async {
            self.implementation.notification(notificationType)
        }
        call.resolve()
    }

    @objc public func selectionStart(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.implementation.selectionStart()
        }
        call.resolve()
    }

    @objc public func selectionChanged(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.implementation.selectionChanged()
        }
        call.resolve()
    }

    @objc public func selectionEnd(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.implementation.selectionEnd()
        }
        call.resolve()
    }

    @objc public func vibrate(_ call: CAPPluginCall) {
        let duration = (call.options["duration"] as? Double ?? 300.0) / 1000.0
        DispatchQueue.main.async {
            self.implementation.vibrate(duration)
        }
        call.resolve()
    }
}
`;
  fs.writeFileSync(hapticsPluginFullPath, hapticsPluginContent, 'utf8');
  console.log(`[patch-capacitor] Overwrote: ${hapticsPluginFile}`);
}

console.log('[patch-capacitor] Plugin patching complete.');
