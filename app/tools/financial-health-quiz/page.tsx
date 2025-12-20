'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import CTABanner from '@/components/tools/CTABanner';

interface Question {
  id: string;
  question: string;
  options: { label: string; value: number; description?: string }[];
}

const questions: Question[] = [
  {
    id: 'emergency_fund',
    question: 'How many months of expenses do you have in an emergency fund?',
    options: [
      { label: 'None', value: 0, description: 'No emergency savings' },
      { label: 'Less than 1 month', value: 5, description: 'Just getting started' },
      { label: '1-3 months', value: 10, description: 'Building a buffer' },
      { label: '3-6 months', value: 15, description: 'Good foundation' },
      { label: '6+ months', value: 20, description: 'Excellent safety net' },
    ],
  },
  {
    id: 'savings_rate',
    question: 'What percentage of your income do you save each month?',
    options: [
      { label: '0% (living paycheck to paycheck)', value: 0 },
      { label: '1-10%', value: 5 },
      { label: '10-20%', value: 10 },
      { label: '20-30%', value: 15 },
      { label: '30%+', value: 20 },
    ],
  },
  {
    id: 'retirement',
    question: 'Are you contributing to retirement accounts (401k, IRA, etc.)?',
    options: [
      { label: 'No', value: 0 },
      { label: 'Yes, but less than employer match', value: 5 },
      { label: 'Yes, getting full employer match', value: 10 },
      { label: 'Yes, maxing out contributions', value: 15 },
    ],
  },
  {
    id: 'debt',
    question: 'How would you describe your debt situation?',
    options: [
      { label: 'Overwhelming debt, struggling to pay minimums', value: 0 },
      { label: 'High-interest debt (credit cards)', value: 5 },
      { label: 'Only low-interest debt (mortgage, student loans)', value: 10 },
      { label: 'Debt-free except mortgage', value: 15 },
      { label: 'Completely debt-free', value: 20 },
    ],
  },
  {
    id: 'budget',
    question: 'Do you follow a budget or track spending?',
    options: [
      { label: 'No idea where my money goes', value: 0 },
      { label: 'I have a rough idea', value: 5 },
      { label: 'I check my accounts occasionally', value: 10 },
      { label: 'I track spending regularly', value: 15 },
    ],
  },
];

export default function FinancialHealthQuiz() {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [showResults, setShowResults] = useState(false);

  const handleAnswer = (questionId: string, value: number) => {
    setAnswers({ ...answers, [questionId]: value });
    
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      setShowResults(true);
    }
  };

  const results = useMemo(() => {
    const totalScore = Object.values(answers).reduce((sum, val) => sum + val, 0);
    const maxScore = 85; // Maximum possible score
    const percentage = Math.round((totalScore / maxScore) * 100);

    let grade = '';
    let gradeColor = '';
    let summary = '';
    let tips: string[] = [];

    if (percentage >= 80) {
      grade = 'A';
      gradeColor = 'text-green-500';
      summary = 'Excellent! You have a strong financial foundation.';
      tips = [
        'Consider increasing investments for faster wealth building',
        'Look into tax optimization strategies',
        'Explore real estate or alternative investments',
      ];
    } else if (percentage >= 60) {
      grade = 'B';
      gradeColor = 'text-blue-500';
      summary = 'Good job! You\'re on the right track with some areas to improve.';
      tips = [
        'Focus on building your emergency fund to 6 months',
        'Increase your savings rate if possible',
        'Pay down any high-interest debt',
      ];
    } else if (percentage >= 40) {
      grade = 'C';
      gradeColor = 'text-yellow-500';
      summary = 'You\'re making progress, but there\'s significant room for improvement.';
      tips = [
        'Start with a $1,000 emergency fund',
        'Create and stick to a monthly budget',
        'Focus on eliminating high-interest debt',
        'Contribute at least enough to get employer 401k match',
      ];
    } else {
      grade = 'D';
      gradeColor = 'text-red-500';
      summary = 'Your finances need attention. Let\'s build a plan to improve.';
      tips = [
        'Track every expense for one month to understand spending',
        'Start a small emergency fund ($500-$1000)',
        'List all debts and create a payoff plan',
        'Look for ways to increase income or reduce expenses',
      ];
    }

    // Specific tips based on answers
    if (answers.emergency_fund < 10) {
      tips.unshift('Priority: Build your emergency fund');
    }
    if (answers.debt < 10) {
      tips.unshift('Priority: Create a debt payoff plan');
    }
    if (answers.budget < 10) {
      tips.unshift('Priority: Start tracking your spending');
    }

    return { totalScore, maxScore, percentage, grade, gradeColor, summary, tips: tips.slice(0, 4) };
  }, [answers]);

  const restartQuiz = () => {
    setCurrentQuestion(0);
    setAnswers({});
    setShowResults(false);
  };

  if (showResults) {
    return (
      <div className="py-12 px-4 sm:px-6 lg:px-8 max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-3">
            Your Financial Health Score
          </h1>
        </div>

        {/* Score Card */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 text-center mb-8">
          <div className={`text-8xl font-bold ${results.gradeColor} mb-4`}>
            {results.grade}
          </div>
          <div className="text-2xl font-semibold text-slate-900 dark:text-white mb-2">
            {results.percentage}%
          </div>
          <p className="text-slate-600 dark:text-slate-400">
            {results.summary}
          </p>
        </div>

        {/* Progress Bar */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 mb-8">
          <div className="flex justify-between text-sm text-slate-500 dark:text-slate-400 mb-2">
            <span>Score: {results.totalScore} / {results.maxScore}</span>
          </div>
          <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-1000 ${
                results.percentage >= 80 ? 'bg-green-500' :
                results.percentage >= 60 ? 'bg-blue-500' :
                results.percentage >= 40 ? 'bg-yellow-500' : 'bg-red-500'
              }`}
              style={{ width: `${results.percentage}%` }}
            />
          </div>
        </div>

        {/* Tips */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 mb-8">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
            Personalized Recommendations
          </h2>
          <ul className="space-y-3">
            {results.tips.map((tip, index) => (
              <li key={index} className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center text-sm font-medium">
                  {index + 1}
                </span>
                <span className="text-slate-600 dark:text-slate-400">{tip}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4">
          <button
            onClick={restartQuiz}
            className="flex-1 px-6 py-3 border border-slate-300 dark:border-slate-700 rounded-xl font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            Retake Quiz
          </button>
          <Link
            href="/tools"
            className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors text-center"
          >
            Explore Tools
          </Link>
        </div>

        {/* CTA */}
        <div className="mt-8">
          <CTABanner 
            title="Get a Complete Financial Picture"
            description="Upload your bank statements and let Adphex analyze your actual spending, savings rate, and financial health automatically."
          />
        </div>
      </div>
    );
  }

  const question = questions[currentQuestion];

  return (
    <div className="py-12 px-4 sm:px-6 lg:px-8 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-3">
          Financial Health Quiz
        </h1>
        <p className="text-slate-600 dark:text-slate-400">
          Answer {questions.length} quick questions to assess your financial health and get personalized tips.
        </p>
      </div>

      {/* Progress */}
      <div className="mb-8">
        <div className="flex justify-between text-sm text-slate-500 dark:text-slate-400 mb-2">
          <span>Question {currentQuestion + 1} of {questions.length}</span>
          <span>{Math.round(((currentQuestion) / questions.length) * 100)}% complete</span>
        </div>
        <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
          <div 
            className="h-full bg-blue-500 transition-all duration-300"
            style={{ width: `${((currentQuestion) / questions.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Question */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-6">
          {question.question}
        </h2>
        
        <div className="space-y-3">
          {question.options.map((option, index) => (
            <button
              key={index}
              onClick={() => handleAnswer(question.id, option.value)}
              className="w-full text-left p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all group"
            >
              <span className="font-medium text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400">
                {option.label}
              </span>
              {option.description && (
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  {option.description}
                </p>
              )}
            </button>
          ))}
        </div>
      </div>

      {currentQuestion > 0 && (
        <button
          onClick={() => setCurrentQuestion(currentQuestion - 1)}
          className="mt-4 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
        >
          ← Previous question
        </button>
      )}
    </div>
  );
}


