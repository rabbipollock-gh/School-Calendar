// Loads Montserrat TTF fonts from /public/fonts/ and registers them with a jsPDF instance.
// Falls back silently to helvetica if the files aren't found.

let cache = null

function arrayBufferToBase64(buffer) {
  let binary = ''
  const bytes = new Uint8Array(buffer)
  const chunkSize = 8192
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }
  return btoa(binary)
}

async function fetchFont(path) {
  const resp = await fetch(path)
  if (!resp.ok) throw new Error(`Font not found: ${path}`)
  return arrayBufferToBase64(await resp.arrayBuffer())
}

export async function loadMontserrat(doc) {
  if (!cache) {
    try {
      const [bold, semibold] = await Promise.all([
        fetchFont('/fonts/Montserrat-ExtraBold.ttf'),
        fetchFont('/fonts/Montserrat-SemiBold.ttf'),
      ])
      cache = { bold, semibold }
    } catch {
      return false  // fonts not available — caller falls back to helvetica
    }
  }

  doc.addFileToVFS('Montserrat-ExtraBold.ttf', cache.bold)
  doc.addFont('Montserrat-ExtraBold.ttf', 'Montserrat', 'bold')
  doc.addFileToVFS('Montserrat-SemiBold.ttf', cache.semibold)
  doc.addFont('Montserrat-SemiBold.ttf', 'Montserrat', 'normal')
  return true
}
