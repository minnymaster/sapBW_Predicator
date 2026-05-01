import { useState, useCallback } from 'react';
import Header from '../components/Header';
import {
  useEmployees,
  useDepartments,
  useTests,
  useCreateAssignment,
} from '../hooks/useAssignments';
import type { AssignmentResult } from '../hooks/useAssignments';

// ─── Primitives ───────────────────────────────────────────────────────────────

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-2xl border border-gray-200 shadow-sm p-6 ${className}`}>
      {children}
    </div>
  );
}

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-xs font-semibold text-gray-600 mb-1.5">
      {children}{required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  );
}

// ─── Employee search combobox ─────────────────────────────────────────────────

function EmployeeSearch({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string, name: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState('');

  const { data } = useEmployees({ search: search || undefined, limit: 30 });

  function select(id: string, name: string) {
    onChange(id, name);
    setSelectedLabel(name);
    setSearch('');
    setOpen(false);
  }

  return (
    <div className="relative">
      <Label required>Сотрудник</Label>
      <input
        type="text"
        value={open ? search : selectedLabel}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={(e) => { setSearch(e.target.value); setSelectedLabel(''); onChange('', ''); }}
        placeholder="Поиск по имени или email…"
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm
                   focus:outline-none focus:ring-2 focus:ring-violet-400"
      />
      {open && (data?.data?.length ?? 0) > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl
                        shadow-lg max-h-52 overflow-y-auto">
          {data!.data.map((emp) => (
            <button
              key={emp.employeeId}
              type="button"
              onMouseDown={() => select(emp.employeeId, emp.fullName)}
              className="w-full text-left px-4 py-2.5 text-sm hover:bg-violet-50 transition"
            >
              <p className="font-medium text-gray-800">{emp.fullName}</p>
              <p className="text-xs text-gray-400">{emp.email} · {emp.position ?? emp.role}</p>
            </button>
          ))}
        </div>
      )}
      {open && search && (data?.data?.length ?? 0) === 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl
                        shadow px-4 py-3 text-sm text-gray-400">
          Сотрудники не найдены
        </div>
      )}
    </div>
  );
}

// ─── Success panel ────────────────────────────────────────────────────────────

function SuccessPanel({
  results,
  onReset,
}: {
  results: AssignmentResult[];
  onReset: () => void;
}) {
  return (
    <Card>
      <div className="text-center space-y-3 py-4">
        <div className="text-5xl">✅</div>
        <h2 className="text-lg font-bold text-gray-800">
          Создано {results.length} назначение{results.length === 1 ? '' : results.length < 5 ? 'я' : 'й'}
        </h2>
        <p className="text-sm text-gray-500">
          Сотрудники получат уведомления и смогут приступить к тестированию
        </p>
      </div>
      <div className="mt-4 border-t border-gray-100 pt-4 space-y-2 max-h-64 overflow-y-auto">
        {results.map((r) => (
          <div key={r.assignmentId}
            className="flex items-center justify-between text-xs px-3 py-2 bg-gray-50 rounded-lg">
            <span className="text-gray-600 font-mono">{r.employeeId.slice(0, 8)}…</span>
            <span className="text-violet-600 font-medium">{r.status}</span>
            {r.deadline && (
              <span className="text-gray-400">до {r.deadline.slice(0, 10)}</span>
            )}
          </div>
        ))}
      </div>
      <button
        onClick={onReset}
        className="mt-5 w-full py-2.5 border border-violet-300 text-violet-700 text-sm
                   font-medium rounded-xl hover:bg-violet-50 transition"
      >
        Создать ещё одно назначение
      </button>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Mode = 'employee' | 'department';

export default function AssignmentsPage() {
  const [mode, setMode] = useState<Mode>('employee');
  const [employeeId, setEmployeeId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [testId, setTestId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [error, setError] = useState('');
  const [results, setResults] = useState<AssignmentResult[] | null>(null);

  const { data: departments } = useDepartments();
  const { data: testsData } = useTests();
  const createAssignment = useCreateAssignment();

  const selectedDept = departments?.find((d) => d.departmentId === departmentId);

  const reset = useCallback(() => {
    setEmployeeId('');
    setDepartmentId('');
    setTestId('');
    setDueDate('');
    setError('');
    setResults(null);
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!testId) { setError('Выберите тест'); return; }
    if (mode === 'employee' && !employeeId) { setError('Выберите сотрудника'); return; }
    if (mode === 'department' && !departmentId) { setError('Выберите подразделение'); return; }

    const dto = {
      testId,
      ...(mode === 'employee' ? { employeeId } : { departmentId }),
      ...(dueDate ? { dueDate } : {}),
    };

    createAssignment.mutate(dto, {
      onSuccess: (data) => setResults(data),
      onError: (err: unknown) => {
        const msg = (err as { response?: { data?: { message?: string } } })
          ?.response?.data?.message;
        setError(msg ?? 'Ошибка при создании назначения');
      },
    });
  }

  const minDate = new Date().toISOString().split('T')[0];

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-800">Назначение тестов</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Массовое или индивидуальное назначение теста сотрудникам
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* Form */}
          <Card>
            {results ? (
              <SuccessPanel results={results} onReset={reset} />
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Mode toggle */}
                <div>
                  <Label>Кому назначить</Label>
                  <div className="flex rounded-xl border border-gray-200 overflow-hidden text-sm">
                    {(['employee', 'department'] as Mode[]).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => { setMode(m); setEmployeeId(''); setDepartmentId(''); }}
                        className={`flex-1 py-2.5 font-medium transition ${
                          mode === m
                            ? 'bg-violet-600 text-white'
                            : 'text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        {m === 'employee' ? 'Сотруднику' : 'Подразделению'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Target selector */}
                {mode === 'employee' ? (
                  <EmployeeSearch
                    value={employeeId}
                    onChange={(id) => setEmployeeId(id)}
                  />
                ) : (
                  <div>
                    <Label required>Подразделение</Label>
                    <select
                      value={departmentId}
                      onChange={(e) => setDepartmentId(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white
                                 focus:outline-none focus:ring-2 focus:ring-violet-400"
                    >
                      <option value="">Выберите подразделение…</option>
                      {(departments ?? []).map((d) => (
                        <option key={d.departmentId} value={d.departmentId}>
                          {d.name}
                          {typeof d.employeeCount === 'number'
                            ? ` (${d.employeeCount} чел.)`
                            : ''}
                        </option>
                      ))}
                    </select>
                    {selectedDept && typeof selectedDept.employeeCount === 'number' && (
                      <p className="text-xs text-violet-600 mt-1.5">
                        Будет создано до {selectedDept.employeeCount} назначений
                        (дубли для текущих активных пропускаются)
                      </p>
                    )}
                  </div>
                )}

                {/* Test selector */}
                <div>
                  <Label required>Тест</Label>
                  <select
                    value={testId}
                    onChange={(e) => setTestId(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white
                               focus:outline-none focus:ring-2 focus:ring-violet-400"
                  >
                    <option value="">Выберите тест…</option>
                    {(testsData?.data ?? []).map((t) => (
                      <option key={t.testId} value={t.testId}>
                        {t.title} ({t.questionCount} вопросов)
                      </option>
                    ))}
                  </select>
                </div>

                {/* Deadline */}
                <div>
                  <Label>Дедлайн (необязательно)</Label>
                  <input
                    type="date"
                    min={minDate}
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm
                               focus:outline-none focus:ring-2 focus:ring-violet-400"
                  />
                  {!dueDate && (
                    <p className="text-xs text-gray-400 mt-1">
                      Без дедлайна — сотрудник выполняет в свободное время
                    </p>
                  )}
                </div>

                {error && (
                  <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={createAssignment.isPending}
                  className="w-full py-3 bg-violet-600 text-white text-sm font-semibold
                             rounded-xl hover:bg-violet-700 disabled:opacity-50 transition"
                >
                  {createAssignment.isPending
                    ? 'Создание назначений…'
                    : mode === 'department'
                      ? '📋 Назначить всему подразделению'
                      : '📋 Назначить тест'}
                </button>
              </form>
            )}
          </Card>

          {/* Info panel */}
          <div className="space-y-4">
            <Card className="bg-violet-50 border-violet-100">
              <h3 className="text-sm font-semibold text-violet-800 mb-3">Как работает назначение</h3>
              <ul className="text-sm text-violet-700 space-y-2">
                <li className="flex gap-2">
                  <span className="flex-shrink-0">1.</span>
                  <span>Выберите тест из активных тестов в системе</span>
                </li>
                <li className="flex gap-2">
                  <span className="flex-shrink-0">2.</span>
                  <span>Укажите сотрудника или целое подразделение</span>
                </li>
                <li className="flex gap-2">
                  <span className="flex-shrink-0">3.</span>
                  <span>Установите дедлайн — или оставьте поле пустым</span>
                </li>
                <li className="flex gap-2">
                  <span className="flex-shrink-0">4.</span>
                  <span>Дублирующие активные назначения пропускаются автоматически</span>
                </li>
              </ul>
            </Card>

            <Card>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Статусы назначений</h3>
              <div className="space-y-2 text-xs">
                {[
                  { label: 'Ожидает', color: 'bg-amber-100 text-amber-800', desc: 'Сотрудник ещё не начал' },
                  { label: 'В процессе', color: 'bg-blue-100 text-blue-800', desc: 'Тест начат' },
                  { label: 'Завершено', color: 'bg-green-100 text-green-800', desc: 'Тест сдан' },
                  { label: 'Просрочено', color: 'bg-red-100 text-red-800', desc: 'Дедлайн прошёл' },
                ].map((s) => (
                  <div key={s.label} className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 rounded-full font-medium ${s.color}`}>{s.label}</span>
                    <span className="text-gray-500">{s.desc}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
