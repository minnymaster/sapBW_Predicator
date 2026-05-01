import { useState, useMemo } from 'react';
import Header from '../components/Header';
import {
  useQuestions,
  useCreateQuestion,
  useUpdateQuestion,
  useDeleteQuestion,
  useCompetencies,
  useGenerateQuestions,
} from '../hooks/useQuestions';
import type {
  QuestionItem,
  QuestionType,
  DifficultyLevel,
  CreateQuestionDto,
  CreateAnswerOptionDto,
} from '../types/questions';

// ─── Constants ────────────────────────────────────────────────────────────────

const DIFFICULTY_LABELS: Record<DifficultyLevel, string> = {
  easy: 'Лёгкий',
  medium: 'Средний',
  hard: 'Сложный',
};

const TYPE_LABELS: Record<QuestionType, string> = {
  single_choice: 'Один ответ',
  multiple_choice: 'Несколько ответов',
  short_answer: 'Краткий ответ',
  open_text: 'Развёрнутый ответ',
};

const GRADE_TO_DIFFICULTY: Record<string, DifficultyLevel> = {
  K1: 'easy', K2: 'easy', K3: 'medium', K4: 'hard', K5: 'hard',
};

// ─── Primitives ───────────────────────────────────────────────────────────────

function Badge({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
      {children}
    </span>
  );
}

function Spinner() {
  return (
    <div className="flex justify-center items-center py-16">
      <div className="w-8 h-8 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
    </div>
  );
}

function Modal({ title, onClose, children }: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-800">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-4">{children}</div>
      </div>
    </div>
  );
}

function Select({
  label, value, onChange, options, placeholder,
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
}) {
  return (
    <div>
      {label && <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white
                   focus:outline-none focus:ring-2 focus:ring-violet-400 text-gray-700"
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

function TextArea({
  label, value, onChange, rows = 3, required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm
                   focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none"
      />
    </div>
  );
}

// ─── Answer options editor ────────────────────────────────────────────────────

function AnswerOptionsEditor({
  options,
  onChange,
  multi,
}: {
  options: CreateAnswerOptionDto[];
  onChange: (opts: CreateAnswerOptionDto[]) => void;
  multi: boolean;
}) {
  function add() {
    onChange([...options, { text: '', isCorrect: false, orderNumber: options.length + 1 }]);
  }
  function remove(i: number) {
    onChange(options.filter((_, idx) => idx !== i).map((o, idx) => ({ ...o, orderNumber: idx + 1 })));
  }
  function update(i: number, patch: Partial<CreateAnswerOptionDto>) {
    const next = options.map((o, idx) => idx === i ? { ...o, ...patch } : o);
    if (!multi && patch.isCorrect) {
      onChange(next.map((o, idx) => ({ ...o, isCorrect: idx === i })));
    } else {
      onChange(next);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-gray-600">Варианты ответов</label>
        <button
          type="button"
          onClick={add}
          className="text-xs text-violet-600 hover:underline"
        >+ Добавить</button>
      </div>
      {options.map((opt, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            type={multi ? 'checkbox' : 'radio'}
            checked={opt.isCorrect}
            onChange={(e) => update(i, { isCorrect: e.target.checked })}
            className="accent-violet-600 flex-shrink-0"
          />
          <input
            type="text"
            value={opt.text}
            onChange={(e) => update(i, { text: e.target.value })}
            placeholder={`Вариант ${i + 1}`}
            className="flex-1 border border-gray-200 rounded px-2 py-1 text-sm
                       focus:outline-none focus:ring-2 focus:ring-violet-300"
          />
          <button
            type="button"
            onClick={() => remove(i)}
            className="text-gray-300 hover:text-red-500 text-lg leading-none flex-shrink-0"
          >&times;</button>
        </div>
      ))}
      {options.length === 0 && (
        <p className="text-xs text-gray-400">Нажмите «+ Добавить», чтобы добавить варианты</p>
      )}
    </div>
  );
}

// ─── Create / Edit modal ──────────────────────────────────────────────────────

interface FormState {
  competencyId: string;
  type: QuestionType;
  difficulty: DifficultyLevel;
  text: string;
  explanation: string;
  maxScore: string;
  answerOptions: CreateAnswerOptionDto[];
}

function emptyForm(): FormState {
  return {
    competencyId: '',
    type: 'single_choice',
    difficulty: 'medium',
    text: '',
    explanation: '',
    maxScore: '1',
    answerOptions: [],
  };
}

function questionToForm(q: QuestionItem): FormState {
  return {
    competencyId: q.competencyId,
    type: q.type,
    difficulty: q.difficulty,
    text: q.text,
    explanation: q.explanation ?? '',
    maxScore: String(q.maxScore),
    answerOptions: q.answerOptions.map((o) => ({
      text: o.text,
      isCorrect: o.isCorrect,
      orderNumber: o.orderNumber,
    })),
  };
}

function QuestionFormModal({
  initial,
  onClose,
  onSubmit,
  isLoading,
}: {
  initial: FormState;
  onClose: () => void;
  onSubmit: (dto: CreateQuestionDto) => void;
  isLoading: boolean;
}) {
  const [form, setForm] = useState<FormState>(initial);
  const { data: competencies } = useCompetencies();
  const needOptions = form.type === 'single_choice' || form.type === 'multiple_choice';

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.competencyId || !form.text.trim()) return;
    const dto: CreateQuestionDto = {
      competencyId: form.competencyId,
      type: form.type,
      difficulty: form.difficulty,
      text: form.text.trim(),
      ...(form.explanation.trim() ? { explanation: form.explanation.trim() } : {}),
      maxScore: parseInt(form.maxScore) || 1,
      ...(needOptions ? { answerOptions: form.answerOptions } : {}),
    };
    onSubmit(dto);
  }

  const compOptions = (competencies ?? []).map((c) => ({
    value: c.competencyId,
    label: `${c.name} (${c.area})`,
  }));

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Select
        label="Компетенция *"
        value={form.competencyId}
        onChange={(v) => set('competencyId', v)}
        options={compOptions}
        placeholder="Выберите компетенцию…"
      />
      <div className="grid grid-cols-2 gap-3">
        <Select
          label="Тип вопроса"
          value={form.type}
          onChange={(v) => set('type', v as QuestionType)}
          options={Object.entries(TYPE_LABELS).map(([k, l]) => ({ value: k, label: l }))}
        />
        <Select
          label="Сложность"
          value={form.difficulty}
          onChange={(v) => set('difficulty', v as DifficultyLevel)}
          options={Object.entries(DIFFICULTY_LABELS).map(([k, l]) => ({ value: k, label: l }))}
        />
      </div>
      <TextArea label="Текст вопроса" value={form.text} onChange={(v) => set('text', v)} rows={3} required />
      <TextArea label="Объяснение (необязательно)" value={form.explanation} onChange={(v) => set('explanation', v)} rows={2} />
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Максимальный балл</label>
        <input
          type="number"
          min={1}
          max={10}
          value={form.maxScore}
          onChange={(e) => set('maxScore', e.target.value)}
          className="w-24 border border-gray-200 rounded-lg px-3 py-2 text-sm
                     focus:outline-none focus:ring-2 focus:ring-violet-400"
        />
      </div>
      {needOptions && (
        <AnswerOptionsEditor
          options={form.answerOptions}
          onChange={(opts) => set('answerOptions', opts)}
          multi={form.type === 'multiple_choice'}
        />
      )}
      <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
        <button type="button" onClick={onClose}
          className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
          Отмена
        </button>
        <button
          type="submit"
          disabled={isLoading || !form.competencyId || !form.text.trim()}
          className="px-5 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg
                     hover:bg-violet-700 disabled:opacity-50 transition"
        >
          {isLoading ? 'Сохранение…' : 'Сохранить'}
        </button>
      </div>
    </form>
  );
}

// ─── AI Generate modal ────────────────────────────────────────────────────────

function AiGenerateModal({ onClose }: { onClose: () => void }) {
  const { data: competencies } = useCompetencies();
  const generate = useGenerateQuestions();
  const [competencyId, setCompetencyId] = useState('');
  const [grade, setGrade] = useState<string>('K3');
  const [count, setCount] = useState(5);
  const [done, setDone] = useState(false);

  const difficulty = GRADE_TO_DIFFICULTY[grade] ?? 'medium';

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!competencyId) return;
    generate.mutate(
      { competencyId, dto: { difficulty, count } },
      { onSuccess: () => setDone(true) },
    );
  }

  const compOptions = (competencies ?? []).map((c) => ({
    value: c.competencyId,
    label: `${c.name} (${c.area})`,
  }));

  if (done) {
    return (
      <div className="text-center py-8 space-y-3">
        <div className="text-4xl">✅</div>
        <p className="text-gray-700 font-medium">
          {count} вопрос(-а) успешно сгенерированы
        </p>
        <p className="text-sm text-gray-400">Таблица обновится автоматически</p>
        <button
          onClick={onClose}
          className="mt-2 px-5 py-2 bg-violet-600 text-white text-sm rounded-lg hover:bg-violet-700 transition"
        >
          Закрыть
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-gray-500">
        LLM сгенерирует вопросы на основе компетенции и сложности. Они появятся в банке вопросов сразу после генерации.
      </p>
      <Select
        label="Компетенция *"
        value={competencyId}
        onChange={setCompetencyId}
        options={compOptions}
        placeholder="Выберите компетенцию…"
      />
      <div className="grid grid-cols-2 gap-3">
        <Select
          label="Целевой грейд"
          value={grade}
          onChange={setGrade}
          options={['K1','K2','K3','K4','K5'].map((g) => ({ value: g, label: g }))}
        />
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Количество (1–10)</label>
          <input
            type="number"
            min={1}
            max={10}
            value={count}
            onChange={(e) => setCount(Math.min(10, Math.max(1, Number(e.target.value))))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm
                       focus:outline-none focus:ring-2 focus:ring-violet-400"
          />
        </div>
      </div>
      <div className="bg-violet-50 rounded-lg px-4 py-3 text-xs text-violet-700 space-y-0.5">
        <p><strong>Сложность:</strong> {DIFFICULTY_LABELS[difficulty]} (из грейда {grade})</p>
        <p><strong>Тип:</strong> single_choice (по умолчанию для LLM)</p>
      </div>
      {generate.isError && (
        <p className="text-xs text-red-600">Ошибка генерации. Попробуйте ещё раз.</p>
      )}
      <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
        <button type="button" onClick={onClose}
          className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
          Отмена
        </button>
        <button
          type="submit"
          disabled={generate.isPending || !competencyId}
          className="px-5 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg
                     hover:bg-violet-700 disabled:opacity-50 transition"
        >
          {generate.isPending ? 'Генерация…' : '✨ Сгенерировать'}
        </button>
      </div>
    </form>
  );
}

// ─── Delete confirm ───────────────────────────────────────────────────────────

function DeleteConfirm({ question, onClose }: { question: QuestionItem; onClose: () => void }) {
  const del = useDeleteQuestion();
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-700">
        Удалить вопрос <strong className="text-gray-900">«{question.text.slice(0, 80)}…»</strong>?
        Это действие необратимо.
      </p>
      <div className="flex justify-end gap-3">
        <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
          Отмена
        </button>
        <button
          onClick={() => del.mutate(question.questionId, { onSuccess: onClose })}
          disabled={del.isPending}
          className="px-5 py-2 bg-red-600 text-white text-sm font-medium rounded-lg
                     hover:bg-red-700 disabled:opacity-50 transition"
        >
          {del.isPending ? 'Удаление…' : 'Удалить'}
        </button>
      </div>
    </div>
  );
}

// ─── Main table ───────────────────────────────────────────────────────────────

type ModalMode =
  | { kind: 'create' }
  | { kind: 'edit'; question: QuestionItem }
  | { kind: 'delete'; question: QuestionItem }
  | { kind: 'ai' }
  | null;

export default function QuestionsPage() {
  // filters
  const [competencyFilter, setCompetencyFilter] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  const { data: competencies } = useCompetencies();
  const { data, isLoading, isError, refetch } = useQuestions({
    competencyId: competencyFilter || undefined,
    difficulty: difficultyFilter || undefined,
    page,
    limit: PAGE_SIZE,
  });

  const [modal, setModal] = useState<ModalMode>(null);
  const createQ = useCreateQuestion();
  const updateQ = useUpdateQuestion();

  const compMap = useMemo(() => {
    const m: Record<string, string> = {};
    (competencies ?? []).forEach((c) => { m[c.competencyId] = c.name; });
    return m;
  }, [competencies]);

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 1;

  function handleCreate(dto: CreateQuestionDto) {
    createQ.mutate(dto, { onSuccess: () => setModal(null) });
  }
  function handleUpdate(id: string, dto: CreateQuestionDto) {
    updateQ.mutate({ id, dto }, { onSuccess: () => setModal(null) });
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-4">
        {/* Page title */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-800">Банк вопросов</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {data ? `${data.total} вопросов` : 'Загрузка…'}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setModal({ kind: 'ai' })}
              className="flex items-center gap-1.5 px-4 py-2 bg-violet-100 text-violet-700
                         text-sm font-medium rounded-lg hover:bg-violet-200 transition"
            >
              ✨ Сгенерировать через AI
            </button>
            <button
              onClick={() => setModal({ kind: 'create' })}
              className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 text-white
                         text-sm font-medium rounded-lg hover:bg-violet-700 transition"
            >
              + Создать вопрос
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3
                        flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-gray-500 mb-1">Компетенция</label>
            <select
              value={competencyFilter}
              onChange={(e) => { setCompetencyFilter(e.target.value); setPage(1); }}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white
                         focus:outline-none focus:ring-2 focus:ring-violet-400 text-gray-700"
            >
              <option value="">Все компетенции</option>
              {(competencies ?? []).map((c) => (
                <option key={c.competencyId} value={c.competencyId}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="w-44">
            <label className="block text-xs font-medium text-gray-500 mb-1">Сложность</label>
            <select
              value={difficultyFilter}
              onChange={(e) => { setDifficultyFilter(e.target.value); setPage(1); }}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white
                         focus:outline-none focus:ring-2 focus:ring-violet-400 text-gray-700"
            >
              <option value="">Любая</option>
              {Object.entries(DIFFICULTY_LABELS).map(([k, l]) => (
                <option key={k} value={k}>{l}</option>
              ))}
            </select>
          </div>
          {(competencyFilter || difficultyFilter) && (
            <button
              onClick={() => { setCompetencyFilter(''); setDifficultyFilter(''); setPage(1); }}
              className="text-sm text-gray-400 hover:text-gray-600 underline self-end mb-2"
            >
              Сбросить
            </button>
          )}
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {isLoading && <Spinner />}
          {isError && (
            <div className="px-6 py-8 text-center text-sm text-red-600">
              Ошибка загрузки.{' '}
              <button onClick={() => refetch()} className="underline">Повторить</button>
            </div>
          )}
          {!isLoading && !isError && (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-[40%]">
                    Вопрос
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Компетенция
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Тип
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Сложность
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Балл
                  </th>
                  <th className="px-4 py-3 w-[130px]" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data?.data.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-400 text-sm">
                      Вопросы не найдены
                    </td>
                  </tr>
                )}
                {data?.data.map((q) => (
                  <tr key={q.questionId} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-700 leading-snug">
                      <div className="line-clamp-2 max-w-xs" title={q.text}>{q.text}</div>
                      {q.isLlmGenerated && (
                        <span className="text-[10px] text-violet-500 mt-0.5 block">✨ AI</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      {compMap[q.competencyId] ?? q.competencyId.slice(0, 8) + '…'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge color="bg-blue-50 text-blue-700">{TYPE_LABELS[q.type]}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge color={
                        q.difficulty === 'easy'
                          ? 'bg-green-50 text-green-700'
                          : q.difficulty === 'medium'
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-red-50 text-red-600'
                      }>
                        {DIFFICULTY_LABELS[q.difficulty]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-center">{q.maxScore}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setModal({ kind: 'edit', question: q })}
                          className="text-xs text-violet-600 hover:underline"
                        >Изменить</button>
                        <button
                          onClick={() => setModal({ kind: 'delete', question: q })}
                          className="text-xs text-red-500 hover:underline"
                        >Удалить</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 text-sm">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600
                         hover:bg-gray-50 disabled:opacity-40 transition"
            >← Назад</button>
            <span className="text-gray-500">Стр. {page} / {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600
                         hover:bg-gray-50 disabled:opacity-40 transition"
            >Вперёд →</button>
          </div>
        )}
      </main>

      {/* Modals */}
      {modal?.kind === 'create' && (
        <Modal title="Создать вопрос" onClose={() => setModal(null)}>
          <QuestionFormModal
            initial={emptyForm()}
            onClose={() => setModal(null)}
            onSubmit={handleCreate}
            isLoading={createQ.isPending}
          />
        </Modal>
      )}
      {modal?.kind === 'edit' && (
        <Modal title="Редактировать вопрос" onClose={() => setModal(null)}>
          <QuestionFormModal
            initial={questionToForm(modal.question)}
            onClose={() => setModal(null)}
            onSubmit={(dto) => handleUpdate(modal.question.questionId, dto)}
            isLoading={updateQ.isPending}
          />
        </Modal>
      )}
      {modal?.kind === 'delete' && (
        <Modal title="Удаление вопроса" onClose={() => setModal(null)}>
          <DeleteConfirm question={modal.question} onClose={() => setModal(null)} />
        </Modal>
      )}
      {modal?.kind === 'ai' && (
        <Modal title="✨ Генерация вопросов через AI" onClose={() => setModal(null)}>
          <AiGenerateModal onClose={() => setModal(null)} />
        </Modal>
      )}
    </div>
  );
}
