import dynamic from 'next/dynamic';

// Client component with Supabase Realtime
const LLMTrafficInspector = dynamic(
  () => import('@/components/admin/LLMTrafficInspector'),
  { ssr: false }
);

export default function AdminPage() {
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900">LLM Traffic Inspector</h2>
        <p className="mt-1 text-sm text-gray-600">
          Real-time monitoring of all LLM calls and tool executions in the application.
        </p>
      </div>
      
      <LLMTrafficInspector />
    </div>
  );
}
