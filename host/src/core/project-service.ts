/**
 * Project Service
 * 
 * Business logic for Project management.
 */
import type { Project } from '../types.js';
import * as db from '../db/index.js';
import path from 'path';

export class ProjectService {
    /**
     * Get all projects sorted by last opened
     */
    getAllProjects(): Project[] {
        return db.getAllProjects();
    }

    /**
     * Get a project by ID
     */
    getProject(projectId: string): Project | null {
        return db.getProject(projectId);
    }

    /**
     * Create a new project (or return existing if path matches - TODO: path uniqueness check?)
     * For now, we assume explicit creation.
     */
    createProject(projectPath: string, name?: string): Project {
        const id = `proj_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const project: Project = {
            id,
            path: projectPath,
            name: name || path.basename(projectPath),
            createdAt: Date.now(),
            lastOpenedAt: Date.now()
        };
        db.createProject(project);
        return project;
    }

    /**
     * Open a project (update timestamp)
     */
    openProject(projectId: string): Project | null {
        const project = db.getProject(projectId);
        if (!project) return null;

        db.updateProject(projectId, { lastOpenedAt: Date.now() });
        return { ...project, lastOpenedAt: Date.now() };
    }

    /**
     * Update project details
     */
    updateProject(projectId: string, updates: Partial<Pick<Project, 'name' | 'path'>>): void {
        db.updateProject(projectId, updates);
    }

    /**
     * Delete a project
     */
    deleteProject(projectId: string): void {
        db.deleteProject(projectId);
    }
}

// Singleton instance
export const projectService = new ProjectService();
