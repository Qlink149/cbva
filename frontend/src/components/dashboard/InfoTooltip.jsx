import React, { useState, useRef, useEffect } from 'react';
import { HelpCircle } from 'lucide-react';
import { createPortal } from 'react-dom';

export default function InfoTooltip({ text }) {
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef(null);

  const updatePos = () => {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPos({
        top: rect.top + window.scrollY,
        left: rect.left + rect.width / 2 + window.scrollX,
      });
    }
  };

  const handleShow = () => { updatePos(); setShow(true); };
  const handleHide = () => setShow(false);

  return (
    <div className="relative inline-flex items-center">
      <button
        ref={btnRef}
        onMouseEnter={handleShow}
        onMouseLeave={handleHide}
        onFocus={handleShow}
        onBlur={handleHide}
        className="text-muted-foreground/50 hover:text-muted-foreground transition-colors"
        aria-label="More info"
      >
        <HelpCircle className="w-3.5 h-3.5" />
      </button>
      {show && createPortal(
        <div
          className="pointer-events-none"
          style={{
            position: 'absolute',
            top: pos.top - 8,
            left: pos.left,
            transform: 'translate(-50%, -100%)',
            zIndex: 9999,
          }}
        >
          <div className="w-60 bg-gray-900 text-white text-xs rounded-lg px-3 py-2.5 shadow-xl leading-relaxed">
            {text}
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}