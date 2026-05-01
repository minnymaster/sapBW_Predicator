import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { DataGrid, type GridColDef, type GridRenderCellParams } from '@mui/x-data-grid';
import { useTests, useStartTest } from '../hooks/useTests';
import type { TestListItem } from '../types/tests';

function formatDuration(sec: number | null): string {
  if (!sec) return '—';
  const m = Math.floor(sec / 60);
  return m >= 60 ? `${Math.floor(m / 60)} ч ${m % 60} мин` : `${m} мин`;
}

function StartCell({ row }: { row: TestListItem }) {
  const startTest = useStartTest();
  return (
    <button
      disabled={startTest.isPending}
      onClick={(e) => {
        e.stopPropagation();
        startTest.mutate(row.testId);
      }}
      className="px-3 py-1 text-xs font-semibold rounded-lg bg-blue-600 text-white
                 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
    >
      {startTest.isPending ? '…' : 'Начать'}
    </button>
  );
}

export default function TestsPage() {
  const navigate = useNavigate();
  const { data: tests, isLoading, isError, refetch } = useTests();

  const columns = useMemo<GridColDef<TestListItem>[]>(
    () => [
      {
        field: 'title',
        headerName: 'Название теста',
        flex: 2.5,
        minWidth: 200,
        renderCell: (params: GridRenderCellParams<TestListItem, string>) => (
          <span className="font-medium text-gray-800">{params.value}</span>
        ),
      },
      {
        field: 'questionCount',
        headerName: 'Вопросов',
        width: 100,
        align: 'center',
        headerAlign: 'center',
        valueGetter: (_value: unknown, row: TestListItem) => row._count.testQuestions,
      },
      {
        field: 'timeLimitSec',
        headerName: 'Время',
        width: 110,
        align: 'center',
        headerAlign: 'center',
        valueFormatter: (value: number | null) => formatDuration(value),
      },
      {
        field: 'passingScore',
        headerName: 'Проходной',
        width: 110,
        align: 'center',
        headerAlign: 'center',
        valueFormatter: (value: number) => `${value}%`,
      },
      {
        field: 'maxAttempts',
        headerName: 'Попыток',
        width: 90,
        align: 'center',
        headerAlign: 'center',
      },
      {
        field: 'isActive',
        headerName: 'Статус',
        width: 110,
        align: 'center',
        headerAlign: 'center',
        renderCell: (params: GridRenderCellParams<TestListItem, boolean>) =>
          params.value ? (
            <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">
              Активен
            </span>
          ) : (
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
              Неактивен
            </span>
          ),
      },
      {
        field: 'actions',
        headerName: '',
        width: 110,
        sortable: false,
        disableColumnMenu: true,
        renderCell: (params: GridRenderCellParams<TestListItem>) => (
          <StartCell row={params.row} />
        ),
      },
    ],
    [],
  );

  const rows = useMemo(
    () => (tests ?? []).map((t) => ({ ...t, id: t.testId })),
    [tests],
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-slate-800 sticky top-0 z-10 shadow-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/dashboard')}
              className="text-slate-400 hover:text-white text-sm transition"
            >
              ← Главная
            </button>
            <span className="text-slate-500">|</span>
            <span className="text-white font-semibold text-sm">Мои тесты</span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <div className="mb-5">
          <h1 className="text-xl font-bold text-gray-800">Доступные тесты</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Нажмите «Начать» для прохождения аттестации
          </p>
        </div>

        {isError && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex gap-3">
            <span>⚠️ Не удалось загрузить тесты.</span>
            <button onClick={() => refetch()} className="underline">
              Повторить
            </button>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <DataGrid
            rows={rows}
            columns={columns}
            loading={isLoading}
            autoHeight
            disableRowSelectionOnClick
            pageSizeOptions={[10, 25, 50]}
            initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
            localeText={{
              noRowsLabel: 'Нет доступных тестов',
              footerRowSelected: (count) => `${count} выбрано`,
              footerTotalRows: 'Всего строк:',
            }}
            sx={{
              border: 'none',
              fontFamily: 'inherit',
              fontSize: '0.875rem',
              '& .MuiDataGrid-columnHeaders': {
                backgroundColor: '#f8fafc',
                color: '#475569',
                fontWeight: 600,
                borderBottom: '1px solid #e2e8f0',
              },
              '& .MuiDataGrid-row:hover': { backgroundColor: '#f0f7ff' },
              '& .MuiDataGrid-cell': { borderColor: '#f1f5f9' },
              '& .MuiDataGrid-footerContainer': { borderTop: '1px solid #e2e8f0' },
            }}
          />
        </div>
      </main>
    </div>
  );
}
