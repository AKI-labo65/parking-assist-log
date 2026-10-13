import Foundation
import ActivityKit

@available(iOS 16.1, *)
struct ParkingActivityAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var status: String
        var spot: String
        var startedAt: Date
        var issuedAt: Date?
    }

    var activityId: String
}
