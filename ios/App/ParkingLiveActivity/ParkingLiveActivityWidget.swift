import ActivityKit
import SwiftUI
import WidgetKit

@available(iOSApplicationExtension 16.1, *)
struct ParkingLiveActivityWidget: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: ParkingActivityAttributes.self) { context in
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Label(context.state.status == "parking" ? "駐車中" : "証明書発行済み", systemImage: "car.fill")
                        .font(.headline)
                    Spacer()
                    Text(context.state.spot.isEmpty ? "番号未入力" : "\(context.state.spot)番")
                        .font(.title3.bold())
                }
                if context.state.status == "parking" {
                    Text(timerInterval: context.state.startedAt...Date(), countsDown: false)
                        .font(.system(.title2, design: .rounded).monospacedDigit())
                        .foregroundStyle(.orange)
                } else {
                    Text(context.state.issuedAt ?? context.state.startedAt, style: .time)
                        .font(.title2.bold())
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .activityBackgroundTint(Color.blue.opacity(0.92))
            .activitySystemActionForegroundColor(.white)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("駐車位置")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                        Text(context.state.spot.isEmpty ? "未入力" : "\(context.state.spot)番")
                            .font(.title3.bold())
                    }
                }
                DynamicIslandExpandedRegion(.trailing) {
                    if context.state.status == "parking" {
                        Text(timerInterval: context.state.startedAt...Date(), countsDown: false)
                            .font(.title3.monospacedDigit())
                    } else {
                        Text("発行済み")
                            .font(.caption.bold())
                            .foregroundStyle(.green)
                    }
                }
                DynamicIslandExpandedRegion(.bottom) {
                    Label(
                        context.state.status == "parking" ? "証明書発行時に番号を確認" : "精算待ち",
                        systemImage: context.state.status == "parking" ? "timer" : "checkmark.circle"
                    )
                    .font(.caption)
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
            } compactLeading: {
                Text(context.state.spot.isEmpty ? "?" : context.state.spot)
                    .font(.caption2.bold())
            } compactTrailing: {
                if context.state.status == "parking" {
                    Text(timerInterval: context.state.startedAt...Date(), countsDown: false)
                        .font(.caption2.monospacedDigit())
                } else {
                    Text("発行")
                        .font(.caption2.bold())
                        .foregroundStyle(.green)
                }
            } minimal: {
                Image(systemName: context.state.status == "parking" ? "car.fill" : "checkmark.circle.fill")
            }
            .widgetURL(URL(string: "parkingassist://record/\(context.attributes.activityId)"))
            .keylineTint(.orange)
        }
    }
}

@main
struct ParkingLiveActivityBundle: WidgetBundle {
    var body: some Widget {
        ParkingLiveActivityWidget()
    }
}
