import type { QuestionPayload, QuestionType } from '../../types/tests';

const DIFFICULTY_LABEL: Record<string, { label: string; cls: string }> = {
  easy:   { label: 'Лёгкий',   cls: 'bg-green-50 text-green-700 border-green-200' },
  medium: { label: 'Средний',  cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  hard:   { label: 'Сложный',  cls: 'bg-red-50 text-red-700 border-red-200' },
};

const TYPE_LABEL: Record<QuestionType, string> = {
  single_choice:   'Один вариант',
  multiple_choice: 'Несколько вариантов',
  short_answer:    'Краткий ответ',
  open_text:       'Развёрнутый ответ',
};

interface Props {
  question: QuestionPayload;
  selectedOptionIds: string[];
  answerText: string;
  onToggleOption: (id: string) => void;
  onTextChange: (text: string) => void;
  feedback: { isCorrect: boolean | null; explanation: string | null } | null;
  submitted: boolean;
}

export default function QuestionCard({
  question,
  selectedOptionIds,
  answerText,
  onToggleOption,
  onTextChange,
  feedback,
  submitted,
}: Props) {
  const diff = DIFFICULTY_LABEL[question.difficulty] ?? DIFFICULTY_LABEL.medium;
  const isMulti = question.type === 'multiple_choice';
  const isText = question.type === 'short_answer' || question.type === 'open_text';

  return (
    <div className="space-y-5">
      {/* Meta badges */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`text-xs border px-2 py-0.5 rounded-full ${diff.cls}`}>
          {diff.label}
        </span>
        <span className="text-xs border px-2 py-0.5 rounded-full bg-slate-50 text-slate-600 border-slate-200">
          {TYPE_LABEL[question.type]}
        </span>
        <span className="text-xs border px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border-blue-200">
          {question.max_score} балл{question.max_score === 1 ? '' : 'а'}
        </span>
      </div>

      {/* Question text */}
      <p className="text-gray-800 font-medium text-base leading-relaxed">{question.text}</p>

      {/* Options (choice questions) */}
      {!isText && question.answer_options.map((opt) => {
        const isSelected = selectedOptionIds.includes(opt.optionId);
        const isCorrectOpt = feedback?.isCorrect === true && isSelected;
        const isWrongOpt = feedback?.isCorrect === false && isSelected;

        return (
          <button
            key={opt.optionId}
            disabled={submitted}
            onClick={() => onToggleOption(opt.optionId)}
            className={`w-full text-left flex items-start gap-3 px-4 py-3 rounded-xl border transition
              ${submitted
                ? isCorrectOpt
                  ? 'border-green-400 bg-green-50 text-green-800'
                  : isWrongOpt
                  ? 'border-red-400 bg-red-50 text-red-800'
                  : 'border-gray-200 bg-gray-50 text-gray-500'
                : isSelected
                ? 'border-blue-500 bg-blue-50 text-blue-800 shadow-sm'
                : 'border-gray-200 bg-white text-gray-700 hover:border-blue-300 hover:bg-blue-50/40'
              }`}
          >
            {/* Radio / Checkbox indicator */}
            <span
              className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded-${isMulti ? 'sm' : 'full'} border-2 flex items-center justify-center
                ${isSelected
                  ? submitted
                    ? isWrongOpt ? 'border-red-500 bg-red-500' : 'border-blue-500 bg-blue-500'
                    : 'border-blue-500 bg-blue-500'
                  : 'border-gray-300 bg-white'
                }`}
            >
              {isSelected && (
                <span className="text-white text-[10px] font-bold leading-none">
                  {isMulti ? '✓' : '●'}
                </span>
              )}
            </span>
            <span className="text-sm">{opt.text}</span>
          </button>
        );
      })}

      {/* Text answer */}
      {isText && (
        <textarea
          disabled={submitted}
          value={answerText}
          onChange={(e) => onTextChange(e.target.value)}
          rows={question.type === 'open_text' ? 6 : 2}
          placeholder="Введите ответ…"
          className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-800
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                     disabled:bg-gray-50 disabled:text-gray-500 resize-none transition"
        />
      )}

      {/* Feedback */}
      {submitted && feedback && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm
            ${feedback.isCorrect === true
              ? 'bg-green-50 border-green-200 text-green-800'
              : feedback.isCorrect === false
              ? 'bg-red-50 border-red-200 text-red-800'
              : 'bg-blue-50 border-blue-200 text-blue-800'
            }`}
        >
          {feedback.isCorrect === true && <span className="font-semibold">✓ Верно! </span>}
          {feedback.isCorrect === false && <span className="font-semibold">✗ Неверно. </span>}
          {feedback.isCorrect === null && <span className="font-semibold">Ответ записан. </span>}
          {feedback.explanation && <span>{feedback.explanation}</span>}
          {feedback.isCorrect === null && !feedback.explanation && (
            <span>Развёрнутый ответ будет проверен HR.</span>
          )}
        </div>
      )}
    </div>
  );
}
