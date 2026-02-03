import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Customer } from '../types';

interface CustomerSearchProps {
  customers: Customer[];
  onSelectCustomer: (customer: Customer) => void;
  onCreateNew: (query: string) => void;
}

const CustomerSearch: React.FC<CustomerSearchProps> = ({ customers, onSelectCustomer, onCreateNew }) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter customers locally (Instant search)
  const filteredCustomers = useMemo(() => {
    if (!query.trim()) return [];
    
    const lowerQ = query.toLowerCase();
    return customers.filter(c => 
      c.name.toLowerCase().includes(lowerQ) || c.phone.includes(lowerQ)
    ).slice(0, 5); // Limit to 5 results
  }, [customers, query]);

  // Handle clicking outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const totalItems = filteredCustomers.length + (query.trim() !== '' ? 1 : 0); // +1 for "Create New"

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev + 1) % totalItems);
      setIsOpen(true);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev - 1 + totalItems) % totalItems);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < filteredCustomers.length) {
        // Selected existing customer
        onSelectCustomer(filteredCustomers[highlightedIndex]);
        setQuery('');
        setIsOpen(false);
      } else if (highlightedIndex === filteredCustomers.length && query.trim()) {
        // Selected "Create New"
        onCreateNew(query);
        setQuery('');
        setIsOpen(false);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  const handleSelect = (c: Customer) => {
    onSelectCustomer(c);
    setQuery('');
    setIsOpen(false);
  };

  // Helper to highlight matched text
  const HighlightText = ({ text, highlight }: { text: string, highlight: string }) => {
    if (!highlight.trim()) return <>{text}</>;
    const parts = text.split(new RegExp(`(${highlight})`, 'gi'));
    return (
      <>
        {parts.map((part, i) => 
          part.toLowerCase() === highlight.toLowerCase() 
            ? <span key={i} className="font-extrabold text-coffee-700 bg-yellow-100">{part}</span> 
            : part
        )}
      </>
    );
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Input Field */}
      <div className="relative group">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <svg className={`h-5 w-5 transition-colors ${isOpen ? 'text-coffee-600' : 'text-gray-400'}`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
          </svg>
        </div>
        <input
          ref={inputRef}
          type="text"
          className="block w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-coffee-500 focus:border-coffee-500 transition-shadow shadow-sm sm:text-sm"
          placeholder="Buscar cliente (Nombre o Tel)..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
            setHighlightedIndex(0); // Reset selection on type
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          autoComplete="off"
        />
        {query && (
            <button 
                onClick={() => { setQuery(''); setIsOpen(false); inputRef.current?.focus(); }}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
            </button>
        )}
      </div>

      {/* Dropdown Results */}
      {isOpen && query.trim().length > 0 && (
        <div className="absolute z-50 mt-1 w-full bg-white shadow-xl max-h-80 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm animate-fade-in">
          
          {/* Matches */}
          {filteredCustomers.length > 0 ? (
            filteredCustomers.map((customer, index) => (
              <div
                key={customer.id}
                onClick={() => handleSelect(customer)}
                className={`cursor-pointer select-none relative py-3 pl-3 pr-9 border-b border-gray-50 last:border-0 ${
                  highlightedIndex === index ? 'bg-coffee-50 text-coffee-900' : 'text-gray-900'
                }`}
              >
                <div className="flex items-center justify-between">
                    <div>
                        <span className="block font-medium truncate">
                            <HighlightText text={customer.name} highlight={query} />
                        </span>
                        <span className="block text-xs text-gray-500 font-mono">
                             📱 <HighlightText text={customer.phone} highlight={query} />
                        </span>
                    </div>
                    {/* Badge Stamp Count */}
                    <div className="flex items-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                            customer.stamps >= 10 ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-600'
                        }`}>
                            {customer.stamps >= 10 ? '🎁' : '🏅'} {customer.stamps}
                        </span>
                    </div>
                </div>
              </div>
            ))
          ) : (
            <div className="py-2 px-4 text-xs text-gray-500 italic">No hay coincidencias exactas...</div>
          )}

          {/* Create New Option (Always visible if query exists) */}
          <div
            onClick={() => { onCreateNew(query); setQuery(''); setIsOpen(false); }}
            className={`cursor-pointer select-none relative py-3 pl-3 pr-9 border-t-2 border-gray-100 ${
              highlightedIndex === filteredCustomers.length ? 'bg-green-50 text-green-900' : 'text-green-700'
            }`}
          >
             <div className="flex items-center gap-2 font-bold">
                 <div className="bg-green-100 p-1 rounded-full">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                 </div>
                 <span>Crear nuevo cliente: "{query}"</span>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerSearch;