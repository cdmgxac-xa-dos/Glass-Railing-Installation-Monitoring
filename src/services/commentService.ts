import { supabase, isSupabaseConfigured } from '../lib/supabaseClient'
import type { LocationComment } from '../types'
import { MOCK_COMMENTS } from '../data/mockData'

// ---------------------------------------------------------------------------
// Comment service — backed by gr_comments. DUAL MODE, same pattern as the
// other services: mock in-memory store when Supabase isn't configured,
// real queries when it is.
// ---------------------------------------------------------------------------

interface GrCommentRow {
  id: string
  location_id: string
  author: string
  text: string
  created_at: string
}

function mapRow(row: GrCommentRow): LocationComment {
  return {
    id: row.id,
    locationId: row.location_id,
    author: row.author,
    text: row.text,
    createdAt: row.created_at,
  }
}

// Mock-only in-memory store.
const mockStore: LocationComment[] = [...MOCK_COMMENTS]

export async function getCommentsForLocation(locationId: string): Promise<LocationComment[]> {
  if (!isSupabaseConfigured) {
    return mockStore
      .filter((c) => c.locationId === locationId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  // Newest-first, enforced at the database level rather than client-side —
  // equivalent to the mock's localeCompare sort, just done in the query.
  const { data, error } = await supabase!
    .from('gr_comments')
    .select('*')
    .eq('location_id', locationId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data as GrCommentRow[]).map(mapRow)
}

export async function addComment(locationId: string, author: string, text: string): Promise<LocationComment> {
  if (!isSupabaseConfigured) {
    const comment: LocationComment = {
      id: `CMT-${Date.now()}`,
      locationId,
      author,
      text,
      createdAt: new Date().toISOString(),
    }
    mockStore.push(comment)
    return comment
  }

  const { data, error } = await supabase!
    .from('gr_comments')
    .insert({ location_id: locationId, author, text })
    .select('*')
    .single()

  if (error) throw error
  return mapRow(data as GrCommentRow)
}
