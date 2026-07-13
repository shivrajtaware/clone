import { useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../../utils/api'
import { Spinner } from '../common/StatCard'

export default function PatientSearch({ value, onChange, placeholder = 'Search by name, UHID...' }) {
  const [searchText, setSearchText] = useState(value?.name || '')
  const [showDropdown, setShowDropdown] = useState(false)
  const searchInputRef = useRef(null)
  const dropdownRef = useRef(null)

  const { data: results, isLoading } = useQuery({
    queryKey: ['patient-search', searchText],
    queryFn: () => api.get('/patients/search', { params: { q: searchText } }).then(r => r.data.data),
    enabled: searchText.length >= 3,
    staleTime: 30000,
  })

  // Handle click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target) && searchInputRef.current && !searchInputRef.current.contains(event.target)) {
        setShowDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = (patient) => {
    onChange({
      id: patient.id,
      uhid: patient.uhid,
      name: `${patient.first_name} ${patient.last_name}`,
      patient,
    })
    setSearchText(`${patient.first_name} ${patient.last_name}`)
    setShowDropdown(false)
  }

  const handleInputChange = (e) => {
    const text = e.target.value
    setSearchText(text)
    if (text.length >= 3) {
      setShowDropdown(true)
    } else {
      setShowDropdown(false)
      if (!text) onChange(null)
    }
  }

  return (
    <div className="relative">
      <input
        ref={searchInputRef}
        type="text"
        className="input"
        placeholder={placeholder}
        value={searchText}
        onChange={handleInputChange}
        onFocus={() => searchText.length >= 3 && setShowDropdown(true)}
      />

      {/* Dropdown Results */}
      {showDropdown && (
        <div
          ref={dropdownRef}
          className="absolute top-full left-0 right-0 mt-1 bg-navy-800 border border-default rounded-lg z-50 max-h-64 overflow-y-auto"
        >
          {isLoading ? (
            <div className="p-4 flex justify-center">
              <Spinner size="sm" />
            </div>
          ) : (results || []).length === 0 ? (
            <div className="p-3 text-xs text-slate-400 text-center">No patients found</div>
          ) : (
            <div className="divide-y divide-default">
              {results.map((patient) => (
                <button
                  key={patient.id}
                  onClick={() => handleSelect(patient)}
                  className="w-full text-left px-4 py-3 hover:bg-navy-700 transition-colors text-sm"
                >
                  <div className="font-medium text-white">
                    {patient.first_name} {patient.last_name}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    UHID: <span className="font-mono text-cyan">{patient.uhid}</span> · {patient.gender} · {patient.phone}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Selected Patient Display */}
      {value?.uhid && (
        <div className="mt-2 p-2 bg-navy-800 rounded text-xs">
          <div className="text-slate-400">Selected:</div>
          <div className="font-medium text-white">{value.name}</div>
          <div className="text-cyan font-mono">{value.uhid}</div>
        </div>
      )}
    </div>
  )
}
