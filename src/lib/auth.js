export function getAdmin() {
  try { return JSON.parse(localStorage.getItem('admin_token') || 'null') }
  catch { return null }
}

export function getRole() {
  return getAdmin()?.role || null
}

// Restituisce true se il ruolo ha accesso alla sezione richiesta
export function canAccess(section) {
  const role = getRole()
  const ACCESS = {
    senior:   ['dashboard','directory','admins','turni','log','riepilogo','richieste','statistiche'],
    superior: ['dashboard','turni','log','riepilogo','richieste','statistiche'],
    visual:   ['dashboard','log','riepilogo','statistiche'],
  }
  return ACCESS[role]?.includes(section) ?? false
}
