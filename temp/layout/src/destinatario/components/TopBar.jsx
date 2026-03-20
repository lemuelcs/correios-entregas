export default function TopBar({ title, onBack, right }) {
  return (
    <div className="flex items-center h-14 px-4 bg-[#003399] text-white shrink-0">
      {onBack ? (
        <button onClick={onBack} className="w-9 h-9 flex items-center justify-center -ml-2 rounded-full hover:bg-white/10">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      ) : (
        <div className="w-7 h-7 bg-[#FFD600] rounded-lg flex items-center justify-center text-[#003399] font-black text-xs mr-2">
          C
        </div>
      )}
      <h1 className="flex-1 text-base font-semibold text-center">{title}</h1>
      <div className="w-9 flex justify-end">{right || null}</div>
    </div>
  )
}
