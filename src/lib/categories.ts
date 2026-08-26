import { supabase } from './supabase'
import type { Category } from '../types'

export async function fetchCategories(): Promise<Category[]> {
  const { data, error } = await supabase.from('categories').select('*').order('name')
  if (error) throw error
  return data as Category[]
}

export async function createCategory(userId: string, name: string): Promise<Category> {
  const { data, error } = await supabase
    .from('categories')
    .insert({ user_id: userId, name })
    .select()
    .single()
  if (error) throw error
  return data as Category
}
