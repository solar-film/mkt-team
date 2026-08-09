import React, { useState, useRef, useEffect } from 'react';

interface Option {
  value: string;
  label: string | React.ReactNode;
}

interface MultiSelectDropdownProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}

export default function MultiSelectDropdown({ options, value, onChange, placeholder }: MultiSelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const selectedValues = value ? value.split(',').filter(Boolean) : [];
  
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleToggle = (val: string) => {
    if (val === 'all') {
      onChange('all');
      setIsOpen(false);
      return;
    }
    
    let newValues = [...selectedValues];
    if (newValues.includes('all')) newValues = []; 
    
    if (newValues.includes(val)) {
      newValues = newValues.filter(v => v !== val);
    } else {
      newValues.push(val);
    }
    onChange(newValues.join(','));
  };

  const displayText = selectedValues.length === 0 
    ? `-- ${placeholder} --` 
    : selectedValues.includes('all') 
      ? '👥 ทุกคน' 
      : selectedValues.map(v => options.find(o => o.value === v)?.label).filter(Boolean).join(', ');

  return (
    <div style={{ position: 'relative' }} ref={dropdownRef}>
      <div 
        className="form-select" 
        style={{ 
          cursor: 'pointer', 
          minHeight: '42px', 
          display: 'flex', 
          alignItems: 'center', 
          whiteSpace: 'nowrap', 
          overflow: 'hidden', 
          textOverflow: 'ellipsis',
          userSelect: 'none',
          paddingRight: '2rem'
        }} 
        onClick={() => setIsOpen(!isOpen)}
      >
        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>
          {displayText}
        </div>
      </div>
      {isOpen && (
        <div style={{ 
          position: 'absolute', 
          top: '100%', 
          left: 0, 
          right: 0, 
          zIndex: 50, 
          backgroundColor: 'white', 
          border: '1px solid #cbd5e1', 
          borderRadius: '8px', 
          marginTop: '4px', 
          maxHeight: '250px', 
          overflowY: 'auto', 
          boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' 
        }}>
          {options.map((opt) => (
            <div 
              key={opt.value} 
              style={{ 
                padding: '8px 12px', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px', 
                cursor: 'pointer', 
                borderBottom: '1px solid #f1f5f9',
                backgroundColor: selectedValues.includes(opt.value) ? '#f0fdf4' : 'transparent'
              }}
              onClick={() => handleToggle(opt.value)}
            >
              <input 
                type="checkbox" 
                checked={selectedValues.includes(opt.value)} 
                readOnly
                style={{ cursor: 'pointer', accentColor: '#22c55e', width: '16px', height: '16px' }}
              />
              <span style={{ fontSize: '0.95rem', color: '#334155' }}>{opt.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
