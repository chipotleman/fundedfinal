import useVoiceChatProbe, { VOICE_PROBE_STATUS } from '../../hooks/useVoiceChatProbe';

export default function VoiceChatTest() {
  const { status, message, details, runProbe } = useVoiceChatProbe();

  const colorClass =
    status === VOICE_PROBE_STATUS.SUCCESS ? 'text-green-400' :
    status === VOICE_PROBE_STATUS.WARNING ? 'text-yellow-400' :
    status === VOICE_PROBE_STATUS.ERROR ? 'text-red-400' :
    status === VOICE_PROBE_STATUS.RUNNING ? 'text-gray-300' : 'text-gray-400';

  return (
    <div className="bg-[#111] backdrop-blur-lg rounded-2xl border border-[#1a1a1a] p-8 mb-8">
      <h2 className="text-xl font-bold text-white mb-2">Voice Chat</h2>
      <p className="text-gray-400 text-sm mb-6">
        Run a quick test to check whether your network can reach our voice chat relay before joining a live battle.
      </p>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <button
          onClick={runProbe}
          disabled={status === VOICE_PROBE_STATUS.RUNNING}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            status === VOICE_PROBE_STATUS.RUNNING
              ? 'bg-[#1a1a1a] text-gray-400 cursor-not-allowed'
              : 'bg-green-500 hover:bg-green-600 text-black'
          }`}
        >
          {status === VOICE_PROBE_STATUS.RUNNING ? 'Testing…' : 'Test voice chat'}
        </button>
        {status !== VOICE_PROBE_STATUS.IDLE && (
          <div className={`text-sm ${colorClass}`}>
            {message}
            {details && status !== VOICE_PROBE_STATUS.RUNNING && (
              <div className="text-gray-500 text-xs mt-1">
                Candidates found — relay: {details.relay}, server-reflexive: {details.srflx}, host: {details.host}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
