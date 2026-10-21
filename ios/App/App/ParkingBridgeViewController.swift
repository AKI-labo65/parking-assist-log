import Capacitor

final class ParkingBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(ParkingLiveActivityPlugin())
        bridge?.registerPluginInstance(ParkingNativePreviewPlugin())
    }
}
