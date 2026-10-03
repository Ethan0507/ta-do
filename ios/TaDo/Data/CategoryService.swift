import Foundation
import Supabase

/// Mirrors src/lib/categories.ts and the category helpers in src/lib/entries.ts.
enum CategoryService {
    static func fetchAll() async throws -> [Category] {
        try await supabase.from("categories").select().order("name").execute().value
    }

    static func create(userID: UUID, name: String) async throws -> Category {
        try await supabase
            .from("categories")
            .insert(["user_id": userID.uuidString, "name": name])
            .select()
            .single()
            .execute()
            .value
    }

    private struct Link: Codable {
        let entryID: UUID
        let categoryID: UUID
        enum CodingKeys: String, CodingKey {
            case entryID = "entry_id"
            case categoryID = "category_id"
        }
    }

    /// entry id → its category ids
    static func fetchEntryCategoryIDs() async throws -> [UUID: [UUID]] {
        let links: [Link] = try await supabase.from("entry_categories").select("entry_id, category_id").execute().value
        return Dictionary(grouping: links, by: \.entryID).mapValues { $0.map(\.categoryID) }
    }

    static func setCategories(entryID: UUID, categoryIDs: [UUID]) async throws {
        try await supabase.from("entry_categories").delete().eq("entry_id", value: entryID).execute()
        guard !categoryIDs.isEmpty else { return }
        try await supabase
            .from("entry_categories")
            .insert(categoryIDs.map { Link(entryID: entryID, categoryID: $0) })
            .execute()
    }
}
