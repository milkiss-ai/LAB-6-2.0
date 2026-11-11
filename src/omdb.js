const API_KEY = import.meta.env.VITE_OMDB_API_KEY?.trim()
const BASE_URL = 'https://www.omdbapi.com/'

async function request(params) {
  if (!API_KEY) {
    throw new Error('Не задан ключ OMDb API. Добавьте VITE_OMDB_API_KEY в файл .env')
  }

  const url = `${BASE_URL}?apikey=${encodeURIComponent(API_KEY)}&${params}`

  let res
  try {
    res = await fetch(url)
  } catch {
    throw new Error('Ошибка сети: не удалось связаться с OMDb')
  }

  if (res.status === 401) {
    throw new Error(
      'Ключ OMDb не принят (401): проверьте, что он активирован по ссылке из письма и вставлен без пробелов',
    )
  }

  if (!res.ok) {
    throw new Error(`Ошибка сети: сервер ответил ${res.status}`)
  }

  try {
    return await res.json()
  } catch {
    throw new Error('Сервер вернул некорректный ответ')
  }
}

export function searchMovies(query, page = 1) {
  return request(`s=${encodeURIComponent(query)}&page=${page}`)
}

const plotCache = new Map()

export async function fetchMoviePlot(imdbID) {
  if (plotCache.has(imdbID)) return plotCache.get(imdbID)

  const data = await request(`i=${encodeURIComponent(imdbID)}&plot=short`)
  const plot = data?.Plot && data.Plot !== 'N/A' ? data.Plot.trim() : ''

  plotCache.set(imdbID, plot)
  return plot
}
