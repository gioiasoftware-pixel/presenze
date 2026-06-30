import TurniCell from './TurniCell'

export default function TurniGrid({ employees, days, shifts, templates, onCellChange }) {
  function getCell(empId, dateKey) {
    return shifts[empId]?.[dateKey] ?? null
  }

  return (
    <div className="overflow-x-auto rounded-2xl shadow-sm">
      <table className="min-w-full bg-white text-sm border-collapse">
        <thead>
          <tr className="bg-petrol-50 border-b-2 border-petrol-100">
            <th className="text-left px-5 py-4 font-bold text-petrol-700 text-xs uppercase tracking-wider min-w-[130px] sticky left-0 bg-petrol-50 z-10">
              Dipendente
            </th>
            {days.map(({ label, dateKey }) => (
              <th key={dateKey} className="px-2 py-4 font-semibold text-petrol-600 min-w-[175px] text-center text-xs uppercase tracking-wide">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-petrol-50">
          {employees.map(emp => (
            <tr key={emp.id} className="hover:bg-petrol-50/40 transition">
              <td className="px-5 py-3 font-bold text-petrol-900 sticky left-0 bg-white z-10 border-r-2 border-petrol-50 align-top pt-4">
                {emp.name}
              </td>
              {days.map(({ dateKey }) => (
                <td key={dateKey} className="border-l border-gray-50 align-top p-0">
                  <TurniCell
                    cell={getCell(emp.id, dateKey)}
                    templates={templates}
                    onChange={value => onCellChange(emp.id, dateKey, value)}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
