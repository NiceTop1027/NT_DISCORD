export default function SettingsButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="p-2 rounded-full text-discord-gray-1 hover:bg-discord-dark-3 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-discord-dark-2 focus:ring-white"
      aria-label="User Settings"
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0L8.12 5.12c-.67.21-1.3.52-1.86.93l-1.73-1-1.44 2.49 1.3 1.59c-.04.32-.07.65-.07.98s.03.66.07.98l-1.3 1.59 1.44 2.49 1.73-1c.56.41 1.19.72 1.86.93l.39 1.95c.38 1.56 2.6 1.56 2.98 0l.39-1.95c.67-.21 1.3-.52 1.86-.93l1.73 1 1.44-2.49-1.3-1.59c.04-.32.07-.65.07-.98s-.03-.66-.07-.98l1.3-1.59-1.44-2.49-1.73 1c-.56-.41-1.19-.72-1.86-.93L11.49 3.17zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
      </svg>
    </button>
  );
}
