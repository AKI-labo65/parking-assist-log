import Foundation
import SwiftUI

struct NativeParkingRecord: Identifiable, Hashable {
    let id: String
    var spot: String?
    var status: String
    var startedAt: Date
    var issuedAt: Date?
    var settledAt: Date?
    var memo: String

    init?(dictionary: [String: Any]) {
        guard
            let id = dictionary["id"] as? String,
            let status = dictionary["status"] as? String,
            let startedAtValue = dictionary["startedAt"] as? String,
            let startedAt = NativeParkingRecord.parseDate(startedAtValue)
        else {
            return nil
        }

        self.id = id
        self.spot = (dictionary["spot"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines)
        self.status = status
        self.startedAt = startedAt
        self.issuedAt = NativeParkingRecord.parseDate(dictionary["issuedAt"] as? String)
        self.settledAt = NativeParkingRecord.parseDate(dictionary["settledAt"] as? String)
        let presets = (dictionary["notePresets"] as? [String]) ?? []
        let freeMemo = (dictionary["memo"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        self.memo = ([presets.joined(separator: "、"), freeMemo].filter { !$0.isEmpty }).joined(separator: "、")
    }

    init(id: String = UUID().uuidString, spot: String?, status: String, startedAt: Date = .now, issuedAt: Date? = nil, settledAt: Date? = nil, memo: String = "") {
        self.id = id
        self.spot = spot
        self.status = status
        self.startedAt = startedAt
        self.issuedAt = issuedAt
        self.settledAt = settledAt
        self.memo = memo
    }

    var displaySpot: String {
        guard let spot, !spot.isEmpty else { return "番号未入力" }
        return spot.allSatisfy(\.isNumber) ? "\(spot)番" : spot
    }

    var elapsedSeconds: Int {
        let end = issuedAt ?? .now
        return max(0, Int(end.timeIntervalSince(startedAt)))
    }

    static func parseDate(_ value: String?) -> Date? {
        guard let value else { return nil }
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter.date(from: value) ?? {
            formatter.formatOptions = [.withInternetDateTime]
            return formatter.date(from: value)
        }()
    }
}

final class NativeParkingStore: ObservableObject {
    @Published var records: [NativeParkingRecord]
    @Published var issueTarget: NativeParkingRecord?

    let storeLabel: String
    let layoutID: String

    init(storeLabel: String, layoutID: String, records: [NativeParkingRecord]) {
        self.storeLabel = storeLabel
        self.layoutID = layoutID
        self.records = records
    }

    var parkingRecords: [NativeParkingRecord] {
        records.filter { $0.status == "parking" }.sorted { $0.startedAt < $1.startedAt }
    }

    var issuedRecords: [NativeParkingRecord] {
        records.filter { $0.status == "issued" }.sorted { ($0.issuedAt ?? $0.startedAt) < ($1.issuedAt ?? $1.startedAt) }
    }

    var settledRecords: [NativeParkingRecord] {
        records.filter { $0.status == "settled" }.sorted { ($0.settledAt ?? $0.startedAt) > ($1.settledAt ?? $1.startedAt) }
    }

    func start(spot: String) {
        guard !records.contains(where: { $0.status != "settled" && $0.spot == spot }) else { return }
        records.append(NativeParkingRecord(spot: spot, status: "parking"))
    }

    func issue(record: NativeParkingRecord, spot: String) {
        guard let index = records.firstIndex(where: { $0.id == record.id }) else { return }
        let normalizedSpot = spot.trimmingCharacters(in: .whitespacesAndNewlines)
        let nextSpot = normalizedSpot.isEmpty ? record.spot : normalizedSpot
        let duplicate = nextSpot.flatMap { candidate in
            records.first(where: { $0.id != record.id && $0.status != "settled" && $0.spot == candidate })
        }
        guard duplicate == nil else { return }
        records[index].spot = nextSpot
        records[index].issuedAt = .now
        records[index].status = "issued"
        issueTarget = nil
    }

    func settle(_ record: NativeParkingRecord) {
        guard let index = records.firstIndex(where: { $0.id == record.id }) else { return }
        records[index].settledAt = .now
        records[index].status = "settled"
    }
}

struct NativeParkingRootView: View {
    @StateObject private var store: NativeParkingStore
    @Environment(\.dismiss) private var dismiss
    @State private var selectedTab: NativeParkingTab = .record

    init(storeLabel: String, layoutID: String, records: [NativeParkingRecord]) {
        _store = StateObject(wrappedValue: NativeParkingStore(storeLabel: storeLabel, layoutID: layoutID, records: records))
    }

    var body: some View {
        ZStack {
            NativeBackground()
            ScrollView {
                VStack(spacing: 18) {
                    NativeHeader(storeLabel: store.storeLabel, onClose: { dismiss() })
                    NativeGlassCard {
                        HStack(spacing: 12) {
                            Image(systemName: "sparkles")
                                .font(.title3.weight(.bold))
                                .foregroundStyle(.blue)
                            VStack(alignment: .leading, spacing: 3) {
                                Text("SwiftUIネイティブ版")
                                    .font(.headline)
                                Text("Apple純正Glassの試作画面です。現行Web版の記録を読み込んでいます。")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            Spacer(minLength: 0)
                        }
                    }

                    Group {
                        switch selectedTab {
                        case .record:
                            NativeRecordView(store: store)
                        case .issued:
                            NativeIssuedView(store: store)
                        case .history:
                            NativeHistoryView(store: store)
                        }
                    }
                }
                .padding(.horizontal, 16)
                .padding(.top, 10)
                .padding(.bottom, 24)
            }
        }
        .safeAreaInset(edge: .bottom) {
            NativeTabBar(selectedTab: $selectedTab, store: store)
                .padding(.horizontal, 12)
                .padding(.bottom, 4)
        }
        .sheet(item: $store.issueTarget) { record in
            NativeIssueSheet(record: record, onConfirm: { spot in
                store.issue(record: record, spot: spot)
            })
            .presentationDetents([.medium, .large])
            .presentationDragIndicator(.visible)
        }
    }
}

private enum NativeParkingTab: String, CaseIterable {
    case record
    case issued
    case history

    var title: String {
        switch self {
        case .record: return "記録"
        case .issued: return "精算待ち"
        case .history: return "履歴"
        }
    }

    var icon: String {
        switch self {
        case .record: return "rectangle.grid.2x2"
        case .issued: return "checkmark"
        case .history: return "clock"
        }
    }
}

private struct NativeBackground: View {
    var body: some View {
        ZStack {
            Color(uiColor: .systemGroupedBackground)
            RadialGradient(colors: [.blue.opacity(0.18), .clear], center: .topTrailing, startRadius: 40, endRadius: 520)
            RadialGradient(colors: [.cyan.opacity(0.12), .clear], center: .bottomLeading, startRadius: 30, endRadius: 440)
        }
        .ignoresSafeArea()
    }
}

private struct NativeHeader: View {
    let storeLabel: String
    let onClose: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 8) {
                    Circle()
                        .fill(.orange)
                        .frame(width: 12, height: 12)
                    Text("精算機補助")
                        .font(.title2.weight(.bold))
                }
                Text(storeLabel)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Button(action: onClose) {
                Image(systemName: "xmark")
                    .font(.body.weight(.bold))
                    .frame(width: 42, height: 42)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("閉じる")
            .background(.ultraThinMaterial, in: Circle())
        }
        .padding(.horizontal, 4)
    }
}

private struct NativeRecordView: View {
    @ObservedObject var store: NativeParkingStore

    private var spots: [String] {
        store.layoutID == "sugie"
            ? ["15", "14", "13", "12", "10", "9", "8", "7", "6", "5", "4", "3", "2", "1", "16", "17", "18", "19", "20", "21", "23"]
            : ["1", "21", "2", "20", "3", "19", "4", "18", "5", "17", "6", "16", "7", "15", "8", "14", "13", "12", "10", "9"]
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            NativeSectionTitle(title: "駐車番号を選択", detail: "\(store.parkingRecords.count)台対応中")

            if !store.parkingRecords.isEmpty {
                VStack(spacing: 12) {
                    ForEach(store.parkingRecords) { record in
                        NativeActiveRecordCard(record: record) {
                            store.issueTarget = record
                        }
                    }
                }
            }

            NativeGlassCard {
                VStack(alignment: .leading, spacing: 14) {
                    HStack {
                        Text("駐車位置番号")
                            .font(.headline)
                        Spacer()
                        Text(store.layoutID == "sugie" ? "杉栄店の配置" : "名東本通店の配置")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(.secondary)
                    }
                    Text("番号が分かるときはタップ。分からないときは発行時に入力できます。")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)

                    LazyVGrid(columns: [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)], spacing: 12) {
                        ForEach(spots, id: \.self) { spot in
                            NativeSpotButton(spot: spot, record: store.records.first(where: { $0.status != "settled" && $0.spot == spot })) {
                                store.start(spot: spot)
                            } onOpen: { record in
                                if record.status == "parking" { store.issueTarget = record }
                            }
                        }
                    }
                }
            }
        }
    }
}

private struct NativeActiveRecordCard: View {
    let record: NativeParkingRecord
    let onIssue: () -> Void

    var body: some View {
        NativeGlassCard {
            VStack(alignment: .leading, spacing: 14) {
                HStack(alignment: .firstTextBaseline) {
                    Text(record.displaySpot)
                        .font(.system(size: 38, weight: .bold, design: .rounded))
                    Spacer()
                    Text("駐車中")
                        .font(.caption.weight(.bold))
                        .padding(.horizontal, 10)
                        .padding(.vertical, 6)
                        .background(.green.opacity(0.18), in: Capsule())
                }
                TimelineView(.periodic(from: .now, by: 1)) { context in
                    HStack(alignment: .lastTextBaseline, spacing: 8) {
                        Text("\(max(0, Int(context.date.timeIntervalSince(record.startedAt))))秒")
                            .font(.system(size: 31, weight: .bold, design: .rounded))
                            .monospacedDigit()
                        Text("経過")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(.secondary)
                    }
                }
                NativeGlassButton(action: onIssue) {
                    Label("証明書発行＋番号入力", systemImage: "checkmark")
                        .frame(maxWidth: .infinity)
                }
            }
        }
    }
}

private struct NativeSpotButton: View {
    let spot: String
    let record: NativeParkingRecord?
    let onStart: () -> Void
    let onOpen: (NativeParkingRecord) -> Void

    var body: some View {
        Button {
            if let record { onOpen(record) } else { onStart() }
        } label: {
            VStack(spacing: 4) {
                Text(spot)
                    .font(.title2.weight(.bold))
                    .monospacedDigit()
                if let record {
                    Text(record.status == "parking" ? "対応中" : "待ち")
                        .font(.caption2.weight(.bold))
                }
            }
            .frame(maxWidth: .infinity)
            .frame(minHeight: 72)
        }
        .buttonStyle(.plain)
        .foregroundStyle(record == nil ? Color.primary : Color.blue)
        .background {
            if #available(iOS 26.0, *) {
                RoundedRectangle(cornerRadius: 20, style: .continuous)
                    .fill(record == nil ? .clear : .blue.opacity(0.12))
                    .glassEffect(.regular, in: .rect(cornerRadius: 20))
            } else {
                RoundedRectangle(cornerRadius: 20, style: .continuous)
                    .fill(record == nil ? Color.clear : Color.blue.opacity(0.12))
                    .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).stroke(.white.opacity(0.25)))
            }
        }
    }
}

private struct NativeIssuedView: View {
    @ObservedObject var store: NativeParkingStore

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            NativeSectionTitle(title: "発行済み・精算待ち", detail: "\(store.issuedRecords.count)件")
            if store.issuedRecords.isEmpty {
                NativeEmptyCard(text: "精算待ちの記録はありません")
            } else {
                ForEach(store.issuedRecords) { record in
                    NativeGlassCard {
                        HStack(spacing: 14) {
                            VStack(alignment: .leading, spacing: 5) {
                                Text(record.displaySpot)
                                    .font(.system(size: 32, weight: .bold, design: .rounded))
                                Text("経過 \(record.elapsedSeconds)秒　証明書発行 \(NativeTime.string(record.issuedAt))")
                                    .font(.caption.weight(.semibold))
                                    .foregroundStyle(.secondary)
                            }
                            Spacer()
                            NativeGlassButton(action: { store.settle(record) }) {
                                Text("精算")
                                    .font(.headline)
                                    .frame(width: 76, height: 48)
                            }
                        }
                    }
                }
            }
        }
    }
}

private struct NativeHistoryView: View {
    @ObservedObject var store: NativeParkingStore

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            NativeSectionTitle(title: "本日の履歴", detail: "\(store.settledRecords.count)件")
            if store.settledRecords.isEmpty {
                NativeEmptyCard(text: "完了した記録はありません")
            } else {
                ForEach(store.settledRecords) { record in
                    NativeGlassCard {
                        HStack {
                            VStack(alignment: .leading, spacing: 6) {
                                Text(record.displaySpot)
                                    .font(.title2.weight(.bold))
                                Text("経過 \(record.elapsedSeconds)秒　発行 \(NativeTime.string(record.issuedAt))　精算 \(NativeTime.string(record.settledAt))")
                                    .font(.caption.weight(.semibold))
                                    .foregroundStyle(.secondary)
                                if !record.memo.isEmpty {
                                    Text(record.memo)
                                        .font(.caption)
                                        .foregroundStyle(.orange)
                                }
                            }
                            Spacer()
                            Image(systemName: "checkmark.circle.fill")
                                .font(.title2)
                                .foregroundStyle(.green)
                        }
                    }
                }
            }
        }
    }
}

private struct NativeIssueSheet: View {
    let record: NativeParkingRecord
    let onConfirm: (String) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var spot: String

    init(record: NativeParkingRecord, onConfirm: @escaping (String) -> Void) {
        self.record = record
        self.onConfirm = onConfirm
        _spot = State(initialValue: record.spot ?? "")
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    NativeGlassCard {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("証明書発行と同時に確定")
                                .font(.caption.weight(.bold))
                                .foregroundStyle(.secondary)
                            Text("番号を入力して発行")
                                .font(.title2.weight(.bold))
                            Text("開始時の番号が違っていても、ここで修正できます。")
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                        }
                    }
                    TextField("駐車位置番号", text: $spot)
                        .textFieldStyle(.roundedBorder)
                        .keyboardType(.numbersAndPunctuation)
                        .font(.title2.weight(.bold))
                    LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 4), spacing: 10) {
                        ForEach(["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "12", "13", "14", "15", "16", "17", "18", "19", "20", "21", "23"], id: \.self) { value in
                            Button(value) { spot = value }
                                .buttonStyle(.bordered)
                                .tint(spot == value ? .blue : .gray)
                        }
                    }
                    NativeGlassButton(action: { onConfirm(spot); dismiss() }) {
                        Text(spot.isEmpty ? "番号不明のまま発行" : "\(spot)番で発行確定")
                            .frame(maxWidth: .infinity)
                    }
                }
                .padding(16)
            }
            .navigationTitle("発行確認")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("キャンセル") { dismiss() }
                }
            }
        }
    }
}

private struct NativeSectionTitle: View {
    let title: String
    let detail: String

    var body: some View {
        HStack(alignment: .firstTextBaseline) {
            Text(title)
                .font(.title2.weight(.bold))
            Spacer()
            Text(detail)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(.secondary)
        }
    }
}

private struct NativeEmptyCard: View {
    let text: String

    var body: some View {
        NativeGlassCard {
            HStack {
                Image(systemName: "tray")
                    .foregroundStyle(.secondary)
                Text(text)
                    .foregroundStyle(.secondary)
                Spacer()
            }
        }
    }
}

private struct NativeGlassCard<Content: View>: View {
    let content: Content

    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    var body: some View {
        if #available(iOS 26.0, *) {
            content
                .padding(18)
                .glassEffect(.regular, in: .rect(cornerRadius: 26))
        } else {
            content
                .padding(18)
                .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 26, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 26, style: .continuous).stroke(.white.opacity(0.25)))
        }
    }
}

private struct NativeGlassButton<Label: View>: View {
    let action: () -> Void
    let label: Label

    init(action: @escaping () -> Void, @ViewBuilder label: () -> Label) {
        self.action = action
        self.label = label()
    }

    var body: some View {
        if #available(iOS 26.0, *) {
            Button(action: action) { label }
                .buttonStyle(.glassProminent)
        } else {
            Button(action: action) { label }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
        }
    }
}

private struct NativeTabBar: View {
    @Binding var selectedTab: NativeParkingTab
    @ObservedObject var store: NativeParkingStore

    var body: some View {
        let content = HStack(spacing: 8) {
            ForEach(NativeParkingTab.allCases, id: \.self) { tab in
                Button {
                    withAnimation(.easeInOut(duration: 0.25)) { selectedTab = tab }
                } label: {
                    VStack(spacing: 4) {
                        Image(systemName: tab.icon)
                        Text(tab.title)
                            .font(.caption2.weight(.bold))
                    }
                    .frame(maxWidth: .infinity)
                    .frame(height: 48)
                    .foregroundStyle(selectedTab == tab ? .blue : .secondary)
                }
                .buttonStyle(.plain)
                .overlay(alignment: .topTrailing) {
                    if tab == .issued && !store.issuedRecords.isEmpty {
                        Text("\(store.issuedRecords.count)")
                            .font(.caption2.weight(.bold))
                            .foregroundStyle(.white)
                            .padding(4)
                            .background(.red, in: Circle())
                    }
                }
            }
        }

        if #available(iOS 26.0, *) {
            GlassEffectContainer(spacing: 12) {
                content
                    .padding(8)
                    .glassEffect(.regular, in: .rect(cornerRadius: 28))
            }
        } else {
            content
                .padding(8)
                .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 28, style: .continuous))
        }
    }
}

private enum NativeTime {
    static let formatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "ja_JP")
        formatter.dateFormat = "HH:mm"
        return formatter
    }()

    static func string(_ date: Date?) -> String {
        guard let date else { return "—" }
        return formatter.string(from: date)
    }
}
