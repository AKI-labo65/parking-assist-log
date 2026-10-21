import Capacitor
import UIKit
import SwiftUI

@objc(ParkingNativePreviewPlugin)
public class ParkingNativePreviewPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ParkingNativePreviewPlugin"
    public let jsName = "ParkingNativePreview"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "open", returnType: CAPPluginReturnPromise),
    ]

    @objc func open(_ call: CAPPluginCall) {
        let storeLabel = call.getString("storeLabel") ?? "名東本通店"
        let layoutID = call.getString("layoutID") ?? "meito"
        let payload = (call.getArray("records") as? [[String: Any]]) ?? []
        let records = payload.compactMap(NativeParkingRecord.init(dictionary:))

        DispatchQueue.main.async { [weak self] in
            guard let self, let presenter = self.topViewController(from: self.bridge?.viewController) else {
                call.reject("ネイティブ画面を表示できませんでした")
                return
            }

            let rootView = NativeParkingRootView(storeLabel: storeLabel, layoutID: layoutID, records: records)
            let hostingController = UIHostingController(rootView: rootView)
            hostingController.modalPresentationStyle = .fullScreen
            presenter.present(hostingController, animated: true) {
                call.resolve()
            }
        }
    }

    private func topViewController(from root: UIViewController?) -> UIViewController? {
        if let presented = root?.presentedViewController {
            return topViewController(from: presented)
        }
        if let navigation = root as? UINavigationController {
            return topViewController(from: navigation.visibleViewController)
        }
        if let tab = root as? UITabBarController {
            return topViewController(from: tab.selectedViewController)
        }
        return root
    }
}
