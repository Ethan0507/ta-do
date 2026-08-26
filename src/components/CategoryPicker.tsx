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
          className={`rounded-full px-2.5 py-0.5 text-xs ${
            selectedIds.includes(cat.id) ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
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
        className="w-16 rounded-full border border-dashed border-slate-300 bg-transparent px-2 py-0.5 text-xs"
      />
    </div>
  )
}
