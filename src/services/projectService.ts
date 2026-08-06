import type { Project } from '../types'
import { MOCK_PROJECTS } from '../data/mockData'

export async function getProjects(): Promise<Project[]> {
  return MOCK_PROJECTS
}

export async function getProjectByCode(code: string): Promise<Project | undefined> {
  return MOCK_PROJECTS.find((p) => p.code === code)
}
