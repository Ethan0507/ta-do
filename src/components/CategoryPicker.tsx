import { useState } from 'react'
import type { Category } from '../types'

interface CategoryPickerProps {
  allCategories: Category[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
  onCreateCategory: (name: string) => Promise<void>
}

export function CategoryPicker({ allCategories, selectedIds, onChange, onCreateCategory }: CategoryPickerProps) {
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)

  function toggle(id: string) {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((existing) => existing !== id))
    } else {
      onChange([...selectedIds, id])
    }
  }

  async function handleAdd() {
    if (!newName.trim()) return
    setAdding(true)
    await onCreateCategory(newName.trim())
    setNewName('')
    setAdding(false)
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {allCategories.map((cat) => (
        <button
          key={cat.id}
          type="button"
          onClick={() => toggle(cat.id)}
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            selectedIds.includes(cat.id)
              ? 'bg-[var(--color-primary)] text-[var(--color-primary-on)]'
              : 'bg-white/45 text-[var(--color-text-muted)]'
          }`}
        >
          {cat.name}
        </button>
      ))}
      <input
        type="text"
        placeholder="+ new"
        value={newName}
        onChange={(e) => setNewName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            handleAdd()
          }
        }}
        disabled={adding}
        className="w-16 rounded-full border border-dashed border-[var(--glass-border)] bg-transparent px-2.5 py-1 text-xs text-[var(--color-text-muted)]"
      />
    </div>
  )
}
