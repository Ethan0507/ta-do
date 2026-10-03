import SwiftUI

/// Several lines in the task capture → review them before creating (web BulkTaskDraftSheet).
struct BulkTaskReviewSheet: View {
    @Environment(\.dismiss) private var dismiss
    let onConfirm: ([String]) async -> Void

    private struct Draft: Identifiable { let id = UUID(); var text: String }
    @State private var drafts: [Draft]
    @State private var submitting = false

    init(lines: [String], onConfirm: @escaping ([String]) async -> Void) {
        self.onConfirm = onConfirm
        _drafts = State(initialValue: lines.map { Draft(text: $0) })
    }

    private var ready: [String] {
        drafts.map { $0.text.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
    }

    var body: some View {
        NavigationStack {
            List {
                Group {
                    Section {
                        ForEach($drafts) { $draft in
                            TextField("Task…", text: $draft.text)
                        }
                        .onDelete { drafts.remove(atOffsets: $0) }
                        Button("+ Add another") { drafts.append(Draft(text: "")) }
                    } footer: {
                        Text("Edit or swipe to remove any line, then create them all at once.")
                    }
                }
                .listRowBackground(Theme.glassFillStrong)
            }
            .scrollContentBackground(.hidden)
            .background(GlassBackdrop())
            .navigationTitle("Review \(ready.count) task\(ready.count == 1 ? "" : "s")")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button(submitting ? "Creating…" : "Create \(ready.count)") {
                        submitting = true
                        Task {
                            await onConfirm(ready)
                            dismiss()
                        }
                    }
                    .disabled(submitting || ready.isEmpty)
                }
            }
        }
        .tint(Theme.primary)
    }
}
