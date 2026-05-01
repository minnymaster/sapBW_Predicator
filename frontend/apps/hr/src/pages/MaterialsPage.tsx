import { useState, useCallback, useRef } from 'react';
import Header from '../components/Header';
import {
  useCourses,
  useCourse,
  useCreateCourse,
  useUpdateCourse,
  useDeleteCourse,
  useCreateMaterial,
  useDeleteMaterial,
  useUploadFile,
} from '../hooks/useCourses';
import type { Course, CourseModule, MaterialType, CourseStatus } from '../types/courses';

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<CourseStatus, string> = {
  draft: 'Черновик',
  published: 'Опубликован',
  archived: 'В архиве',
};

const STATUS_COLORS: Record<CourseStatus, string> = {
  draft: 'bg-gray-100 text-gray-600',
  published: 'bg-green-50 text-green-700',
  archived: 'bg-amber-50 text-amber-700',
};

const MATERIAL_ICONS: Record<MaterialType, string> = {
  video: '🎬',
  document: '📄',
  article: '📰',
  link: '🔗',
  interactive: '🎮',
};

const ACCEPTED_TYPES =
  '.pdf,.mp4,.webm,.pptx,.ppt,.docx,.doc,.html,.txt,.png,.jpg,.gif';

// ─── Primitives ───────────────────────────────────────────────────────────────

function Spinner({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const sz = size === 'sm' ? 'w-4 h-4 border-2' : 'w-7 h-7 border-4';
  return (
    <div className={`${sz} border-violet-200 border-t-violet-600 rounded-full animate-spin`} />
  );
}

function Modal({ title, onClose, children }: {
  title: string; onClose: () => void; children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-800">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-4">{children}</div>
      </div>
    </div>
  );
}

// ─── Course form modal ────────────────────────────────────────────────────────

function CourseModal({
  initial,
  onClose,
  onSubmit,
  isLoading,
}: {
  initial?: Partial<Course>;
  onClose: () => void;
  onSubmit: (data: { title: string; description: string; status: CourseStatus }) => void;
  isLoading: boolean;
}) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [status, setStatus] = useState<CourseStatus>(initial?.status ?? 'draft');

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); if (title.trim()) onSubmit({ title: title.trim(), description, status }); }}
      className="space-y-4"
    >
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Название *</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm
                     focus:outline-none focus:ring-2 focus:ring-violet-400"
          placeholder="Введите название курса…"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Описание</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none
                     focus:outline-none focus:ring-2 focus:ring-violet-400"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Статус</label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as CourseStatus)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white
                     focus:outline-none focus:ring-2 focus:ring-violet-400"
        >
          {(Object.entries(STATUS_LABELS) as [CourseStatus, string][]).map(([k, l]) => (
            <option key={k} value={k}>{l}</option>
          ))}
        </select>
      </div>
      <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
        <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600">Отмена</button>
        <button
          type="submit"
          disabled={isLoading || !title.trim()}
          className="px-5 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg
                     hover:bg-violet-700 disabled:opacity-50 transition"
        >
          {isLoading ? 'Сохранение…' : 'Сохранить'}
        </button>
      </div>
    </form>
  );
}

// ─── Drop zone ────────────────────────────────────────────────────────────────

function DropZone({ moduleId, onDone }: { moduleId: string; onDone: () => void }) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<string>('');
  const [uploadError, setUploadError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadFile = useUploadFile();
  const createMaterial = useCreateMaterial();

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files?.length) return;
      const file = files[0];
      setUploading(true);
      setUploadError('');
      setProgress(`Загрузка «${file.name}»…`);

      try {
        const result = await uploadFile.mutateAsync(file);
        setProgress('Создание записи материала…');

        const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
        const typeMap: Record<string, MaterialType> = {
          mp4: 'video', webm: 'video',
          pdf: 'document', docx: 'document', doc: 'document', pptx: 'document', ppt: 'document',
          html: 'article', txt: 'article',
          png: 'document', jpg: 'document', gif: 'document',
        };
        const materialType: MaterialType = typeMap[ext] ?? 'document';

        await createMaterial.mutateAsync({
          moduleId,
          title: file.name.replace(/\.[^.]+$/, ''),
          type: materialType,
          fileKey: result.fileKey,
        });

        setProgress('');
        onDone();
      } catch {
        setUploadError('Ошибка загрузки. Проверьте формат файла (PDF, MP4, DOCX, PPTX).');
        setProgress('');
      } finally {
        setUploading(false);
      }
    },
    [moduleId, uploadFile, createMaterial, onDone],
  );

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition
          ${dragging ? 'border-violet-500 bg-violet-50' : 'border-gray-200 hover:border-violet-300 hover:bg-gray-50'}`}
      >
        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <Spinner />
            <p className="text-sm text-gray-500">{progress}</p>
          </div>
        ) : (
          <>
            <div className="text-3xl mb-2">📁</div>
            <p className="text-sm font-medium text-gray-700">Перетащите файл сюда</p>
            <p className="text-xs text-gray-400 mt-1">или нажмите для выбора</p>
            <p className="text-[10px] text-gray-300 mt-2">PDF, MP4, DOCX, PPTX, HTML · до 200 МБ</p>
          </>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES}
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      {uploadError && (
        <p className="mt-2 text-xs text-red-600">{uploadError}</p>
      )}
    </div>
  );
}

// ─── Module panel (right side detail) ────────────────────────────────────────

function ModuleDetail({
  mod,
  onMaterialDeleted,
}: {
  mod: CourseModule;
  onMaterialDeleted: () => void;
}) {
  const deleteMaterial = useDeleteMaterial();
  const [showUpload, setShowUpload] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide">Модуль</p>
          <h2 className="text-base font-bold text-gray-800">{mod.title}</h2>
          {mod.description && <p className="text-xs text-gray-500 mt-0.5">{mod.description}</p>}
        </div>
        <button
          onClick={() => setShowUpload((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 text-white
                     text-xs font-medium rounded-lg hover:bg-violet-700 transition"
        >
          + Загрузить файл
        </button>
      </div>

      {showUpload && (
        <DropZone
          moduleId={mod.moduleId}
          onDone={() => { setShowUpload(false); onMaterialDeleted(); }}
        />
      )}

      <div className="space-y-2">
        {mod.materials.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-6">
            В этом модуле пока нет материалов. Загрузите первый файл.
          </p>
        )}
        {mod.materials.map((m) => (
          <div key={m.materialId}
            className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-xl group">
            <span className="text-xl flex-shrink-0">{MATERIAL_ICONS[m.type]}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">{m.title}</p>
              <p className="text-xs text-gray-400">
                {m.type}{m.durationMin ? ` · ${m.durationMin} мин` : ''}
              </p>
            </div>
            <button
              onClick={() => deleteMaterial.mutate(m.materialId, { onSuccess: onMaterialDeleted })}
              className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition text-lg leading-none"
            >&times;</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Course detail (right side) ───────────────────────────────────────────────

function CourseDetail({
  courseId,
  onDeleted,
}: {
  courseId: string;
  onDeleted: () => void;
}) {
  const { data: course, isLoading, refetch } = useCourse(courseId);
  const updateCourse = useUpdateCourse();
  const deleteCourse = useDeleteCourse();
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  if (isLoading) {
    return <div className="flex justify-center py-12"><Spinner /></div>;
  }
  if (!course) return null;

  const selectedMod = course.modules?.find((m) => m.moduleId === selectedModuleId) ?? null;

  return (
    <div className="space-y-4">
      {/* Course header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium mb-1 ${STATUS_COLORS[course.status]}`}>
            {STATUS_LABELS[course.status]}
          </span>
          <h2 className="text-lg font-bold text-gray-800">{course.title}</h2>
          {course.description && <p className="text-sm text-gray-500 mt-1">{course.description}</p>}
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={() => setEditing(true)}
            className="px-3 py-1.5 text-xs text-violet-600 border border-violet-200 rounded-lg hover:bg-violet-50 transition"
          >Изменить</button>
          <button
            onClick={() => deleteCourse.mutate(courseId, { onSuccess: onDeleted })}
            className="px-3 py-1.5 text-xs text-red-500 border border-red-200 rounded-lg hover:bg-red-50 transition"
          >Архив</button>
        </div>
      </div>

      {/* Modules list */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
          Модули ({course.modules?.length ?? 0})
        </p>
        <div className="space-y-1">
          {(course.modules ?? []).map((mod) => (
            <button
              key={mod.moduleId}
              onClick={() => setSelectedModuleId(mod.moduleId === selectedModuleId ? null : mod.moduleId)}
              className={`w-full text-left px-3 py-2.5 rounded-xl text-sm transition flex items-center justify-between ${
                selectedModuleId === mod.moduleId
                  ? 'bg-violet-100 text-violet-800 font-medium'
                  : 'hover:bg-gray-100 text-gray-700'
              }`}
            >
              <span className="truncate">{mod.title}</span>
              <span className="text-xs text-gray-400 flex-shrink-0 ml-2">
                {mod.materials.length} файл{mod.materials.length !== 1 ? 'а' : ''}
              </span>
            </button>
          ))}
          {(course.modules?.length ?? 0) === 0 && (
            <p className="text-xs text-gray-400 px-2 py-3">
              У этого курса нет модулей. Создайте модуль через API или управляйте через admin-панель.
            </p>
          )}
        </div>
      </div>

      {/* Module detail */}
      {selectedMod && (
        <div className="border-t border-gray-100 pt-4">
          <ModuleDetail mod={selectedMod} onMaterialDeleted={() => refetch()} />
        </div>
      )}

      {editing && (
        <Modal title="Редактировать курс" onClose={() => setEditing(false)}>
          <CourseModal
            initial={course}
            onClose={() => setEditing(false)}
            onSubmit={(data) =>
              updateCourse.mutate(
                { id: courseId, dto: data },
                { onSuccess: () => setEditing(false) },
              )
            }
            isLoading={updateCourse.isPending}
          />
        </Modal>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MaterialsPage() {
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const { data, isLoading, isError, refetch } = useCourses({
    status: statusFilter || undefined,
    limit: 100,
  });
  const createCourse = useCreateCourse();

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="mb-5 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-800">Библиотека материалов</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Управление курсами, модулями и учебными материалами
            </p>
          </div>
          <button
            onClick={() => setCreating(true)}
            className="px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg
                       hover:bg-violet-700 transition"
          >
            + Создать курс
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-5 items-start">
          {/* Left: course tree */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            {/* Filter */}
            <div className="px-4 py-3 border-b border-gray-100">
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setSelectedCourseId(null); }}
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white
                           focus:outline-none focus:ring-2 focus:ring-violet-400"
              >
                <option value="">Все статусы</option>
                {(Object.entries(STATUS_LABELS) as [CourseStatus, string][]).map(([k, l]) => (
                  <option key={k} value={k}>{l}</option>
                ))}
              </select>
            </div>

            {/* Course list */}
            <div className="divide-y divide-gray-50 max-h-[calc(100vh-220px)] overflow-y-auto">
              {isLoading && (
                <div className="flex justify-center py-8"><Spinner /></div>
              )}
              {isError && (
                <div className="px-4 py-6 text-center text-sm text-red-500">
                  Ошибка.{' '}
                  <button onClick={() => refetch()} className="underline">Повторить</button>
                </div>
              )}
              {!isLoading && !isError && (data?.data?.length ?? 0) === 0 && (
                <div className="px-4 py-8 text-center text-sm text-gray-400">
                  Курсы не найдены
                </div>
              )}
              {(data?.data ?? []).map((course) => (
                <button
                  key={course.courseId}
                  onClick={() =>
                    setSelectedCourseId(
                      course.courseId === selectedCourseId ? null : course.courseId,
                    )
                  }
                  className={`w-full text-left px-4 py-3 transition ${
                    selectedCourseId === course.courseId
                      ? 'bg-violet-50 border-l-2 border-violet-500'
                      : 'hover:bg-gray-50 border-l-2 border-transparent'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-800 truncate pr-2">
                      {course.title}
                    </p>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${STATUS_COLORS[course.status]}`}>
                      {STATUS_LABELS[course.status]}
                    </span>
                  </div>
                  {course.description && (
                    <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{course.description}</p>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Right: detail panel */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 min-h-[400px]">
            {!selectedCourseId ? (
              <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                <div className="text-5xl mb-3">📚</div>
                <p className="text-sm">Выберите курс из списка слева</p>
                <p className="text-xs mt-1">или создайте новый</p>
              </div>
            ) : (
              <CourseDetail
                courseId={selectedCourseId}
                onDeleted={() => setSelectedCourseId(null)}
              />
            )}
          </div>
        </div>
      </main>

      {creating && (
        <Modal title="Создать курс" onClose={() => setCreating(false)}>
          <CourseModal
            onClose={() => setCreating(false)}
            onSubmit={(data) =>
              createCourse.mutate(data, { onSuccess: () => setCreating(false) })
            }
            isLoading={createCourse.isPending}
          />
        </Modal>
      )}
    </div>
  );
}
