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
                    Text(context.state.startedAt, style: .timer)
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
                        VStack(alignment: .leading, spacing: 3) {
                            // Expanded Dynamic Island gives leading and trailing equal space by default.
                            // Keep the label short so Japanese glyphs never get clipped at the edge.
                            Text(context.state.status == "parking" ? "駐車中" : "発行済み")
                                .font(.caption2.weight(.semibold))
                                .foregroundStyle(.secondary)
                                .lineLimit(1)
                            Text(context.state.spot.isEmpty ? "未入力" : "\(context.state.spot)番")
                                .font(.system(size: 24, weight: .bold, design: .rounded))
                                .lineLimit(1)
                                .minimumScaleFactor(0.72)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .layoutPriority(1)
                        .dynamicIsland(verticalPlacement: .belowIfTooWide)
                    }

                    DynamicIslandExpandedRegion(.trailing) {
                        VStack(alignment: .trailing, spacing: 3) {
                            Text(context.state.status == "parking" ? "経過" : "状態")
                                .font(.caption2.weight(.semibold))
                                .foregroundStyle(.secondary)
                                .lineLimit(1)
                            if context.state.status == "parking" {
                                Text(context.state.startedAt, style: .timer)
                                    .font(.system(size: 22, weight: .bold, design: .rounded).monospacedDigit())
                                    .lineLimit(1)
                                    .minimumScaleFactor(0.7)
                            } else {
                                Text("発行済み")
                                    .font(.caption.bold())
                                    .foregroundStyle(.green)
                                    .lineLimit(1)
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .trailing)
                        .layoutPriority(1)
                        .dynamicIsland(verticalPlacement: .belowIfTooWide)
                    }

                    DynamicIslandExpandedRegion(.bottom) {
                        HStack(spacing: 7) {
                            Image(systemName: context.state.status == "parking" ? "arrow.right.circle.fill" : "checkmark.circle.fill")
                                .imageScale(.small)
                            Text(context.state.status == "parking" ? "番号確認後に発行" : "精算待ち")
                                .lineLimit(1)
                                .minimumScaleFactor(0.78)
                        }
                        .font(.caption.weight(.medium))
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.leading, 2)
                    }
                } compactLeading: {
                    Text(context.state.spot.isEmpty ? "?" : context.state.spot)
                        .font(.system(size: 11, weight: .bold, design: .rounded))
                        .monospacedDigit()
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                        .frame(minWidth: 18, maxWidth: 22, alignment: .center)
                } compactTrailing: {
                    if context.state.status == "parking" {
                        Text(context.state.startedAt, style: .timer)
                            .font(.system(size: 11, weight: .semibold, design: .rounded).monospacedDigit())
                            .lineLimit(1)
                            .minimumScaleFactor(0.68)
                            .frame(minWidth: 30, maxWidth: 34, alignment: .trailing)
                    } else {
                        Text("発行")
                            .font(.system(size: 11, weight: .bold, design: .rounded))
                            .foregroundStyle(.green)
                            .frame(minWidth: 22, maxWidth: 24, alignment: .trailing)
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

#Preview(
    "Dynamic Island Expanded",
    as: .dynamicIsland(.expanded),
    using: ParkingActivityAttributes(activityId: "preview")
) {
    ParkingLiveActivityWidget()
} contentStates: {
    ParkingActivityAttributes.ContentState(
        status: "parking",
        spot: "1",
        startedAt: .now.addingTimeInterval(-34),
        issuedAt: nil
    )


}
