import { useCallback, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import CountdownTimer from '../components/test/CountdownTimer';
import QuestionCard from '../components/test/QuestionCard';
import { useNextQuestion, useSubmitAnswer, useFinishAttempt } from '../hooks/useTests';
import type { SubmitAnswerResponse } from '../types/tests';

export default function TestAttemptPage() {
  const { attemptId = '' } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();

  const [selectedOptionIds, setSelectedOptionIds] = useState<string[]>([]);
  const [answerText, setAnswerText] = useState('');
  const [feedback, setFeedback] = useState<SubmitAnswerResponse | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const questionQuery = useNextQuestion(attemptId);
  const submitAnswer = useSubmitAnswer(attemptId);
  const finishAttempt = useFinishAttempt(attemptId);

  const questionData = questionQuery.data;

  function handleToggleOption(optionId: string) {
    if (submitted) return;
    if (!questionData || questionData.done) return;
    const { type } = questionData.question;

    if (type === 'single_choice') {
      setSelectedOptionIds([optionId]);
    } else {
      setSelectedOptionIds((prev) =>
        prev.includes(optionId) ? prev.filter((id) => id !== optionId) : [...prev, optionId],
      );
    }
  }

  function handleSubmitAnswer() {
    if (!questionData || questionData.done) return;
    const { type, question_id } = questionData.question;
    const isText = type === 'short_answer' || type === 'open_text';
    if (!isText && selectedOptionIds.length === 0) return;

    submitAnswer.mutate(
      {
        questionId: question_id,
        selectedOptionIds: isText ? undefined : selectedOptionIds,
        answerText: isText ? answerText : undefined,
      },
      {
        onSuccess: (data) => {
          setFeedback(data);
          setSubmitted(true);
        },
      },
    );
  }

  const handleNext = useCallback(() => {
    setSelectedOptionIds([]);
    setAnswerText('');
    setFeedback(null);
    setSubmitted(false);
    // questionQuery is invalidated by useSubmitAnswer → auto-refetch
  }, []);

  const handleFinish = useCallback(() => {
    finishAttempt.mutate();
  }, [finishAttempt]);

  // ── Derived state ──────────────────────────────────────────────────────────

  if (questionQuery.isError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <p className="text-2xl mb-2">⚠️</p>
          <p className="text-gray-700 font-medium">Не удалось загрузить вопрос</p>
          <button
            onClick={() => questionQuery.refetch()}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm"
          >
            Повторить
          </button>
        </div>
      </div>
    );
  }

  const current = questionData?.done === false ? questionData.current_index + 1 : null;
  const total = questionData?.total_questions;
  const progress = current && total ? (current / total) * 100 : 0;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* ── Sticky header ───────────────────────────────────────────────────── */}
      <header className="bg-slate-800 sticky top-0 z-10 shadow-md">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => navigate('/tests')}
              className="text-slate-400 hover:text-white text-sm transition flex-shrink-0"
            >
              ← Тесты
            </button>
            <span className="text-slate-500 hidden sm:block">|</span>
            <span className="text-white text-sm font-semibold truncate hidden sm:block">
              Прохождение теста
            </span>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            {total && (
              <span className="text-slate-300 text-xs tabular-nums hidden sm:block">
                {current ?? '—'} / {total}
              </span>
            )}
            {/* Timer — shown only if test had a time limit */}
            {questionData && !questionData.done && (
              <CountdownTimer
                initialSeconds={0}
                onExpire={handleFinish}
              />
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-slate-700">
          <div
            className="h-full bg-blue-500 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </header>

      {/* ── Main content ────────────────────────────────────────────────────── */}
      <main className="flex-1 flex items-start justify-center px-4 sm:px-6 py-8">
        <div className="w-full max-w-3xl">

          {/* Loading skeleton */}
          {questionQuery.isLoading && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 animate-pulse space-y-4">
              <div className="flex gap-2">
                <div className="h-5 w-16 bg-gray-200 rounded-full" />
                <div className="h-5 w-24 bg-gray-200 rounded-full" />
              </div>
              <div className="h-6 bg-gray-200 rounded w-3/4" />
              <div className="h-6 bg-gray-200 rounded w-full" />
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-12 bg-gray-100 rounded-xl" />
              ))}
            </div>
          )}

          {/* Done screen */}
          {questionData?.done && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
              <div className="text-5xl mb-4">🎉</div>
              <h2 className="text-xl font-bold text-gray-800 mb-2">
                Вы ответили на все вопросы!
              </h2>
              <p className="text-gray-500 text-sm mb-6">
                Нажмите «Завершить тест» для подсчёта результатов
              </p>
              <button
                onClick={handleFinish}
                disabled={finishAttempt.isPending}
                className="px-8 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-60
                           text-white font-semibold rounded-xl transition"
              >
                {finishAttempt.isPending ? 'Подсчёт…' : 'Завершить тест'}
              </button>
            </div>
          )}

          {/* Active question */}
          {questionData && !questionData.done && (
            <div className="space-y-4">
              {/* Question number + progress */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-700">
                  Вопрос {questionData.current_index + 1}
                  <span className="text-gray-400 font-normal"> / {questionData.total_questions}</span>
                </span>
                <span className="text-xs text-gray-400">
                  {Math.round(progress)}% завершено
                </span>
              </div>

              {/* Card */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                <QuestionCard
                  question={questionData.question}
                  selectedOptionIds={selectedOptionIds}
                  answerText={answerText}
                  onToggleOption={handleToggleOption}
                  onTextChange={setAnswerText}
                  feedback={feedback ? { isCorrect: feedback.is_correct, explanation: feedback.explanation } : null}
                  submitted={submitted}
                />
              </div>

              {/* Action buttons */}
              <div className="flex justify-end gap-3">
                {!submitted ? (
                  <button
                    onClick={handleSubmitAnswer}
                    disabled={
                      submitAnswer.isPending ||
                      (questionData.question.type !== 'short_answer' &&
                        questionData.question.type !== 'open_text' &&
                        selectedOptionIds.length === 0)
                    }
                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50
                               text-white font-semibold rounded-xl text-sm transition"
                  >
                    {submitAnswer.isPending ? 'Отправка…' : 'Ответить'}
                  </button>
                ) : (
                  <button
                    onClick={handleNext}
                    className="px-6 py-2.5 bg-slate-700 hover:bg-slate-800
                               text-white font-semibold rounded-xl text-sm transition"
                  >
                    Следующий вопрос →
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
