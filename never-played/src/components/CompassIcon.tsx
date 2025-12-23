export default function CompassIcon({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${className} transition-transform duration-500 hover:rotate-12`}
    >
      {/* Outer Circle */}
      <circle
        cx="50"
        cy="50"
        r="45"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
      />
      
      {/* Inner Circle */}
      <circle
        cx="50"
        cy="50"
        r="35"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        opacity="0.5"
      />
      
      {/* North Arrow (Red) */}
      <path
        d="M50 15 L58 42 L50 38 L42 42 Z"
        fill="#ef4444"
        stroke="currentColor"
        strokeWidth="1"
      />
      
      {/* South Arrow (White) */}
      <path
        d="M50 85 L42 58 L50 62 L58 58 Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1"
      />
      
      {/* East Arrow */}
      <path
        d="M85 50 L58 58 L62 50 L58 42 Z"
        fill="currentColor"
        opacity="0.6"
        stroke="currentColor"
        strokeWidth="1"
      />
      
      {/* West Arrow */}
      <path
        d="M15 50 L42 42 L38 50 L42 58 Z"
        fill="currentColor"
        opacity="0.6"
        stroke="currentColor"
        strokeWidth="1"
      />
      
      {/* Center Dot */}
      <circle
        cx="50"
        cy="50"
        r="4"
        fill="currentColor"
      />
      
      {/* Cardinal Direction Marks */}
      <text
        x="50"
        y="12"
        textAnchor="middle"
        fontSize="10"
        fontWeight="bold"
        fill="currentColor"
      >
        N
      </text>
      <text
        x="50"
        y="92"
        textAnchor="middle"
        fontSize="8"
        fill="currentColor"
        opacity="0.7"
      >
        S
      </text>
      <text
        x="90"
        y="53"
        textAnchor="middle"
        fontSize="8"
        fill="currentColor"
        opacity="0.7"
      >
        E
      </text>
      <text
        x="10"
        y="53"
        textAnchor="middle"
        fontSize="8"
        fill="currentColor"
        opacity="0.7"
      >
        W
      </text>
    </svg>
  );
}
