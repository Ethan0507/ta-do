import SwiftUI

extension EntryType {
    /// SF Symbols matching the web TypeSelector icons (lightbulb / checked square / flag).
    var symbol: String {
        switch self {
        case .thought: "lightbulb"
        case .task: "checkmark.square"
        case .goal: "flag"
        }
    }
}

/// The web's glass "Thoughts ⌄" pill — a native Menu underneath.
struct TypeMenu: View {
    @Binding var selection: EntryType

    var body: some View {
        Menu {
            Picker("Type", selection: $selection) {
                ForEach(EntryType.allCases) { type in
                    Label(type.plural, systemImage: type.symbol).tag(type)
                }
            }
        } label: {
            HStack(spacing: 8) {
                Image(systemName: selection.symbol)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Theme.primary)
                Text(selection.plural)
                    .font(.system(size: 14.5, weight: .bold))
                    .foregroundStyle(Theme.text)
                Image(systemName: "chevron.down")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(Theme.textMuted)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            .glassCard(cornerRadius: 22)
        }
        .sensoryFeedback(.selection, trigger: selection)
    }
}
