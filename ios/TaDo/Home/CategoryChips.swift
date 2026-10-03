import SwiftUI

/// Same as the web CategoryPicker: toggle chips plus a "+ new" field.
struct CategoryChips: View {
    let all: [Category]
    @Binding var selected: [UUID]
    let onCreate: (String) async -> Void
    @State private var newName = ""
    @State private var adding = false

    var body: some View {
        FlowLayout(spacing: 6) {
            ForEach(all) { category in
                let on = selected.contains(category.id)
                Button {
                    if on { selected.removeAll { $0 == category.id } } else { selected.append(category.id) }
                } label: {
                    Text(category.name)
                        .font(.system(size: 13, weight: .semibold))
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .foregroundStyle(on ? Theme.primaryOn : Theme.textMuted)
                        .background(on ? Theme.primary : Theme.field, in: Capsule())
                }
                .buttonStyle(.plain)
            }
            TextField("+ new", text: $newName)
                .font(.system(size: 13))
                .frame(width: 80)
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .overlay { Capsule().strokeBorder(Theme.glassBorder, style: StrokeStyle(lineWidth: 1, dash: [3])) }
                .submitLabel(.done)
                .disabled(adding)
                .onSubmit {
                    let name = newName.trimmingCharacters(in: .whitespaces)
                    guard !name.isEmpty else { return }
                    adding = true
                    Task {
                        await onCreate(name)
                        newName = ""
                        adding = false
                    }
                }
        }
    }
}

/// Wraps children onto new lines like CSS flex-wrap.
struct FlowLayout: Layout {
    var spacing: CGFloat = 6

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let rows = arrange(subviews, width: proposal.width ?? .infinity)
        let height = rows.reduce(0) { $0 + $1.height } + spacing * CGFloat(max(rows.count - 1, 0))
        return CGSize(width: proposal.width ?? rows.map(\.width).max() ?? 0, height: height)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var y = bounds.minY
        for row in arrange(subviews, width: bounds.width) {
            var x = bounds.minX
            for index in row.indices {
                let size = subviews[index].sizeThatFits(.unspecified)
                subviews[index].place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(size))
                x += size.width + spacing
            }
            y += row.height + spacing
        }
    }

    private struct Row { var indices: [Int] = []; var width: CGFloat = 0; var height: CGFloat = 0 }

    private func arrange(_ subviews: Subviews, width: CGFloat) -> [Row] {
        var rows: [Row] = [Row()]
        for index in subviews.indices {
            let size = subviews[index].sizeThatFits(.unspecified)
            if !rows[rows.count - 1].indices.isEmpty, rows[rows.count - 1].width + spacing + size.width > width {
                rows.append(Row())
            }
            var row = rows[rows.count - 1]
            row.width += (row.indices.isEmpty ? 0 : spacing) + size.width
            row.height = max(row.height, size.height)
            row.indices.append(index)
            rows[rows.count - 1] = row
        }
        return rows
    }
}
