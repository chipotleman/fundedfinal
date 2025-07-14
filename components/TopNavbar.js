import Image from 'next/image';

export default function TopNavbar({ bankroll, betCount, onBalanceClick, onSlipClick }) {
  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-black text-white px-6 py-4 flex justify-between items-center shadow-none">
      <div className="flex items-center space-x-4">
        <Image src="/rollr-logo.png" alt="Rollr Logo" width={150} height={40} priority />
      </div>

      <div className="flex items-center space-x-4">
        {betCount > 0 && (
          <div
            onClick={onSlipClick}
            className="cursor-pointer border border-green-400 rounded-lg px-4 py-2 text-green-400 text-center bg-zinc-900/60 shadow hover:bg-zinc-800 transition"
          >
            <div className="text-sm text-green-300">Slip</div>
            <div className="text-xl font-semibold">{betCount}</div>
          </div>
        )}
        <div
          onClick={onBalanceClick}
          className="cursor-pointer border border-green-400 rounded-lg px-4 py-2 text-green-400 text-center bg-zinc-900/60 shadow hover:bg-zinc-800 transition"
        >
          <div className="text-sm text-green-300">Balance</div>
          <div className="text-xl font-semibold">${bankroll}</div>
        </div>
      </div>
    </div>
  );
}
