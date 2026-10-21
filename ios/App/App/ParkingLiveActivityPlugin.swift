import ActivityKit
import Capacitor

@objc(ParkingLiveActivityPlugin)
public class ParkingLiveActivityPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ParkingLiveActivityPlugin"
    public let jsName = "ParkingLiveActivity"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "sync", returnType: CAPPluginReturnPromise),
    ]

    @objc func sync(_ call: CAPPluginCall) {
        guard #available(iOS 16.1, *) else {
            call.reject("Live ActivitiesにはiOS 16.1以降が必要です")
            return
        }

        let records = (call.getArray("records") as? [[String: Any]]) ?? []
        Task {
            await reconcile(records: records)
            call.resolve()
        }
    }

    @available(iOS 16.1, *)
    private func reconcile(records: [[String: Any]]) async {
        guard ActivityAuthorizationInfo().areActivitiesEnabled else {
            CAPLog.print("Live Activitiesが端末設定で無効になっています")
            return
        }

        let activeRecords = records.filter { record in
            guard let status = record["status"] as? String else { return false }
            return status == "parking" || status == "issued"
        }

        // Dynamic Island has one compact slot. Keep a single Live Activity so
        // iOS cannot choose an issued record over an actively running timer.
        // The oldest parking timer is the most urgent one; when there are no
        // timers, fall back to the oldest certificate waiting for settlement.
        let parkingRecords = activeRecords
            .filter { ($0["status"] as? String) == "parking" }
            .sorted { recordDate($0, key: "startedAt") < recordDate($1, key: "startedAt") }
        let issuedRecords = activeRecords
            .filter { ($0["status"] as? String) == "issued" }
            .sorted { recordDate($0, key: "issuedAt") < recordDate($1, key: "issuedAt") }
        let selectedRecord = (parkingRecords.first ?? issuedRecords.first)
        let selectedId = selectedRecord?["id"] as? String
        let activeIds = selectedId.map { Set([$0]) } ?? []

        for activity in Activity<ParkingActivityAttributes>.activities
            where !activeIds.contains(activity.attributes.activityId) {
            await activity.end(using: activity.contentState, dismissalPolicy: .immediate)
        }

        guard let record = selectedRecord else { return }

        do {
            guard
                let id = record["id"] as? String,
                let status = record["status"] as? String,
                let startedAt = isoDate(record["startedAt"] as? String)
            else { return }

            let spot = (record["spot"] as? String) ?? ""
            let issuedAt = isoDate(record["issuedAt"] as? String)
            let state = ParkingActivityAttributes.ContentState(
                status: status,
                spot: spot,
                startedAt: startedAt,
                issuedAt: issuedAt
            )
            let matchingActivities = Activity<ParkingActivityAttributes>.activities.filter {
                $0.attributes.activityId == id
            }

            if let activity = matchingActivities.first {
                await activity.update(using: state)
                for duplicate in matchingActivities.dropFirst() {
                    await duplicate.end(using: state, dismissalPolicy: .immediate)
                }
            } else {
                _ = try Activity.request(
                    attributes: ParkingActivityAttributes(activityId: id),
                    contentState: state,
                    pushType: nil
                )
            }
        } catch {
            CAPLog.print("Live Activityの開始・更新に失敗しました: \(error.localizedDescription)")
        }
    }

    @available(iOS 16.1, *)
    private func recordDate(_ record: [String: Any], key: String) -> Date {
        isoDate(record[key] as? String) ?? .distantFuture
    }

    @available(iOS 16.1, *)
    private func isoDate(_ value: String?) -> Date? {
        guard let value else { return nil }
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = formatter.date(from: value) { return date }
        formatter.formatOptions = [.withInternetDateTime]
        return formatter.date(from: value)
    }
}
