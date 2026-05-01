import { useState } from 'react';
import Header from '../components/Header';
import {
  useKpiTargets,
  useCreateKpi,
  useUpdateKpi,
  useDeleteKpi,
  useCompetencies,
  useDepartments,
} from '../hooks/useKpi';
import type { KpiTarget, CreateKpiDto, CompetencyGrade } from '../types/director';

const GRADES: CompetencyGrade[] = ['K1', 'K2', 'K3', 'K4', 'K5'];

const EMPTY: CreateKpiDto = {
  competencyId: '',
  competencyName: '',
  targetGrade: 'K3',
  targetPercent: 80,
  periodStart: new Date().toISOString().slice(0, 10),
  periodEnd: '',
  departmentId: '',
};

// ─── Form modal ───────────────────────────────────────────────────────────────

function KpiFormModal({
  initial,
  onClose,
}: {
  initial: CreateKpiDto & { kpiId?: string };
  onClose: () => void;
}) {
  const isEdit = Boolean(initial.kpiId);
  const comps = useCompetencies();
  const depts = useDepartments();
  const create = useCreateKpi();
  const update = useUpdateKpi();

  const [form, setForm] = useState<CreateKpiDto>({
    competencyId: initial.competencyId,
    competencyName: initial.competencyName,
    targetGrade: initial.targetGrade,
    targetPercent: initial.targetPercent,
    periodStart: initial.periodStart,
    periodEnd: initial.periodEnd ?? '',
    departmentId: initial.departmentId ?? '',
  });
  const [error, setError] = useState('');

  function set<K extends keyof CreateKpiDto>(key: K, val: CreateKpiDto[K]) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!form.competencyId) { setError('Выберите компетенцию'); return; }
    if (form.targetPercent < 1 || form.targetPercent > 100) {
      setError('Целевой % должен быть от 1 до 100');
      return;
    }

    const selectedComp = comps.data?.find((c) => c.competencyId === form.competencyId);
    const dto: CreateKpiDto = {
      ...form,
      competencyName: selectedComp?.name ?? form.competencyName,
      departmentId: form.departmentId || undefined,
      periodEnd: form.periodEnd || undefined,
    };

    try {
      if (isEdit) {
        await update.mutateAsync({ id: initial.kpiId!, dto });
      } else {
        await create.mutateAsync(dto);
      }
      onClose();
    } catch {
      setError('Ошибка сохранения. Проверьте данные.');
    }
  }

  const busy = create.isPending || update.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6">
        <h2 className="text-base font-semibold text-gray-800 mb-4">
          {isEdit ? 'Редактировать KPI' : 'Добавить целевой KPI'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-3">

          {/* Competency */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Компетенция *</label>
            <select
              value={form.competencyId}
              onChange={(e) => set('competencyId', e.target.value)}
              required
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">— выберите —</option>
              {comps.data?.map((c) => (
                <option key={c.competencyId} value={c.competencyId}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Department (optional) */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Подразделение (необязательно)</label>
            <select
              value={form.departmentId}
              onChange={(e) => set('departmentId', e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">Все подразделения</option>
              {depts.data?.map((d) => (
                <option key={d.departmentId} value={d.departmentId}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          {/* Target grade + percent */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600 mb-1">Целевой грейд *</label>
              <select
                value={form.targetGrade}
                onChange={(e) => set('targetGrade', e.target.value as CompetencyGrade)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600 mb-1">Целевой % сотрудников *</label>
              <input
                type="number" min={1} max={100}
                value={form.targetPercent}
                onChange={(e) => set('targetPercent', Number(e.target.value))}
                required
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          {/* Dates */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600 mb-1">Начало периода *</label>
              <input
                type="date"
                value={form.periodStart}
                onChange={(e) => set('periodStart', e.target.value)}
                required
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600 mb-1">Конец периода</label>
              <input
                type="date"
                value={form.periodEnd ?? ''}
                onChange={(e) => set('periodEnd', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition">
              Отмена
            </button>
            <button type="submit" disabled={busy}
              className="flex-1 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 disabled:opacity-50 transition">
              {busy ? 'Сохранение…' : isEdit ? 'Сохранить' : 'Создать'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Delete confirm ───────────────────────────────────────────────────────────

function DeleteConfirm({ target, onClose }: { target: KpiTarget; onClose: () => void }) {
  const del = useDeleteKpi();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-6 space-y-4">
        <h2 className="text-base font-semibold text-gray-800">Удалить KPI?</h2>
        <p className="text-sm text-gray-600">
          «{target.competencyName}» — {target.targetGrade} / {target.targetPercent}%
          {target.departmentName ? ` (${target.departmentName})` : ''}
        </p>
        <div className="flex gap-2">
          <button onClick={onClose}
            className="flex-1 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition">
            Отмена
          </button>
          <button
            onClick={async () => { await del.mutateAsync(target.kpiId); onClose(); }}
            disabled={del.isPending}
            className="flex-1 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 transition">
            {del.isPending ? 'Удаление…' : 'Удалить'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Modal =
  | { type: 'create' }
  | { type: 'edit'; target: KpiTarget }
  | { type: 'delete'; target: KpiTarget }
  | null;

export default function KpiTargetsPage() {
  const targets = useKpiTargets();
  const [modal, setModal] = useState<Modal>(null);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-screen-lg mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-lg font-bold text-gray-900">Целевые KPI</h1>
            <p className="text-xs text-gray-500 mt-0.5">Целевые показатели компетенций по подразделениям</p>
          </div>
          <button
            onClick={() => setModal({ type: 'create' })}
            className="px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition">
            + Добавить KPI
          </button>
        </div>

        {targets.isLoading && <p className="text-sm text-gray-400">Загрузка…</p>}
        {targets.error && <p className="text-sm text-red-500">Ошибка загрузки</p>}

        {targets.data && targets.data.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">🎯</p>
            <p className="text-sm">Целевые KPI не установлены. Добавьте первый показатель.</p>
          </div>
        )}

        {targets.data && targets.data.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wide">
                  <th className="px-4 py-3 text-left">Компетенция</th>
                  <th className="px-4 py-3 text-left">Подразделение</th>
                  <th className="px-4 py-3 text-center">Грейд</th>
                  <th className="px-4 py-3 text-center">% сотрудников</th>
                  <th className="px-4 py-3 text-left">Период</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {targets.data.map((t) => (
                  <tr key={t.kpiId} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3 font-medium text-gray-800">{t.competencyName}</td>
                    <td className="px-4 py-3 text-gray-600">{t.departmentName ?? <span className="text-gray-400">Все</span>}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs font-bold bg-brand-100 text-brand-700">
                        {t.targetGrade}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center font-semibold text-gray-800">{t.targetPercent}%</td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {t.periodStart.slice(0, 10)}
                      {t.periodEnd ? ` — ${t.periodEnd.slice(0, 10)}` : ' — …'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => setModal({ type: 'edit', target: t })}
                          className="text-xs text-brand-600 hover:underline">
                          Изменить
                        </button>
                        <button
                          onClick={() => setModal({ type: 'delete', target: t })}
                          className="text-xs text-red-500 hover:underline">
                          Удалить
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {modal?.type === 'create' && (
        <KpiFormModal initial={{ ...EMPTY }} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'edit' && (
        <KpiFormModal
          initial={{
            kpiId: modal.target.kpiId,
            competencyId: modal.target.competencyId,
            competencyName: modal.target.competencyName,
            targetGrade: modal.target.targetGrade,
            targetPercent: modal.target.targetPercent,
            periodStart: modal.target.periodStart.slice(0, 10),
            periodEnd: modal.target.periodEnd?.slice(0, 10) ?? '',
            departmentId: modal.target.departmentId ?? '',
          }}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === 'delete' && (
        <DeleteConfirm target={modal.target} onClose={() => setModal(null)} />
      )}
    </div>
  );
}
