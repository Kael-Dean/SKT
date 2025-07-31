const Topbar = ({ onToggleSidebar, darkMode, setDarkMode }) => {
  return (
    <div className="bg-white dark:bg-gray-800 shadow px-4 py-3 flex items-center justify-between">
      <button
        className="text-2xl font-bold md:hidden"
        onClick={onToggleSidebar}
      >
        ☰
      </button>

      <div className="text-xl font-bold hidden md:block">โลโก้องค์กร</div>

      <div className="flex items-center gap-3">
        <input
          type="text"
          placeholder="🔍 ค้นหา..."
          className="border rounded px-3 py-1 w-40 md:w-64 bg-white dark:bg-gray-700 dark:border-gray-600"
        />
        <button
          onClick={() => setDarkMode(!darkMode)}
          className="text-xl hover:scale-110 transition-transform"
        >
          {darkMode ? '☀️' : '🌙'}
        </button>
      </div>
    </div>
  )
}

export default Topbar
