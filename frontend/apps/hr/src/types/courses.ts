export type CourseStatus = 'draft' | 'published' | 'archived';
export type MaterialType = 'video' | 'document' | 'article' | 'link' | 'interactive';

export interface MaterialSummary {
  materialId: string;
  title: string;
  type: MaterialType;
  orderNumber: number;
  isActive: boolean;
  durationMin: number | null;
}

export interface CourseModule {
  moduleId: string;
  title: string;
  description: string | null;
  orderNumber: number;
  createdAt: string;
  updatedAt: string;
  materials: MaterialSummary[];
}

export interface Course {
  courseId: string;
  title: string;
  description: string | null;
  status: CourseStatus;
  competencyIds: string[];
  createdBy: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  modules?: CourseModule[];
}

export interface PaginatedCourses {
  data: Course[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateCourseDto {
  title: string;
  description?: string;
  status?: CourseStatus;
  competencyIds?: string[];
}

export interface CreateMaterialDto {
  moduleId: string;
  title: string;
  type: MaterialType;
  orderNumber?: number;
  fileKey?: string;
  url?: string;
  durationMin?: number;
}

export interface UploadResult {
  fileKey: string;
  originalName: string;
  size: number;
  mimeType: string;
  url: string;
}
