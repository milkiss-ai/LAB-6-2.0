import { useEffect, useRef, useState } from 'react'
import Background from './Background.jsx'
import MovieCard from './MovieCard.jsx'
import { searchMovies } from './omdb.js'

const NOT_FOUND_MESSAGE = 'Ничего не найдено'
const API_ERRORS = {
  'Too many results.': 'Слишком много совпадений — уточните название',
}

const HISTORY_KEY = 'movie-search-history'
const HISTORY_LIMIT = 5
const DEBOUNCE_MS = 500
const MIN_QUERY_LENGTH = 3
const PAGE_SIZE = 10

function readHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    const list = raw ? JSON.parse(raw) : []
    if (!Array.isArray(list)) return []
    return list.filter((item) => typeof item === 'string').slice(0, HISTORY_LIMIT)
  } catch {
    return []
  }
}

function withQuery(history, value) {
  const next = [
    value,
    ...history.filter((item) => item.toLowerCase() !== value.toLowerCase()),
  ]
  return next.slice(0, HISTORY_LIMIT)
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="2.2" />
      <path d="M16 16L20.5 20.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  )
}

function App() {
  const [input, setInput] = useState('')
  const [page, setPage] = useState(1)
  const [movies, setMovies] = useState([])
  const [total, setTotal] = useState(0)
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState(null)
  const [history, setHistory] = useState(readHistory)
  const [yearFrom, setYearFrom] = useState('')
  const [yearTo, setYearTo] = useState('')
  const requestId = useRef(0)
  const queryRef = useRef('')

  const isLoading = status === 'loading'

  function resetResults() {
    requestId.current += 1
    queryRef.current = ''
    setMovies([])
    setTotal(0)
    setStatus('idle')
    setError(null)
    setPage(1)
  }

  async function fetchMovies(value, targetPage = 1) {
    const request = requestId.current + 1
    requestId.current = request
    queryRef.current = value

    setPage(targetPage)
    setStatus('loading')
    setError(null)

    try {
      const data = await searchMovies(value, targetPage)

      if (request !== requestId.current) return

      if (data.Error) {
        setMovies([])
        setTotal(0)
        setStatus('error')
        setError(
          data.Error === 'Movie not found!' ? NOT_FOUND_MESSAGE : (API_ERRORS[data.Error] ?? data.Error),
        )
        return
      }

      setMovies(Array.isArray(data.Search) ? data.Search : [])
      setTotal(Number(data.totalResults) || 0)
      setStatus('success')
      setHistory((prev) => withQuery(prev, value))
    } catch (err) {
      if (request !== requestId.current) return

      setMovies([])
      setTotal(0)
      setStatus('error')
      setError(err.message)
    }
  }

  useEffect(() => {
    const value = input.trim()

    if (value.length < MIN_QUERY_LENGTH) return

    const timer = setTimeout(() => {
      fetchMovies(value, 1)
    }, DEBOUNCE_MS)

    return () => clearTimeout(timer)
    // fetchMovies меняется на каждый рендер, поэтому зависимость только от input
  }, [input])

  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
    } catch {
      // хранилище недоступно — история просто не сохранится
    }
  }, [history])

  function handleChange(event) {
    const value = event.target.value
    setInput(value)

    if (value.trim().length < MIN_QUERY_LENGTH && status !== 'idle') resetResults()
  }

  function handleSubmit(event) {
    event.preventDefault()

    const value = input.trim()

    if (!value) {
      setMovies([])
      setTotal(0)
      setStatus('error')
      setError('Введите название фильма')
      return
    }

    fetchMovies(value, 1)
  }

  function runFromHistory(value) {
    setInput(value)
    fetchMovies(value, 1)
  }

  function goToPage(next) {
    if (!queryRef.current) return
    fetchMovies(queryRef.current, next)
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  const from = Number.parseInt(yearFrom, 10)
  const to = Number.parseInt(yearTo, 10)

  const visibleMovies = movies.filter((movie) => {
    const year = Number.parseInt(movie.Year, 10)
    if (Number.isNaN(year)) return true
    if (!Number.isNaN(from) && year < from) return false
    if (!Number.isNaN(to) && year > to) return false
    return true
  })

  const isFiltered = visibleMovies.length !== movies.length

  return (
    <div className="page">
      <Background />

      <main className="content">
        <h1 className="prompt">Введите название фильма:</h1>

        <form className="search" onSubmit={handleSubmit}>
          <input
            className="search__input"
            type="search"
            value={input}
            onChange={handleChange}
            aria-label="Название фильма"
            autoFocus
          />
          <button className="search__button" type="submit" disabled={isLoading} aria-label="Найти">
            {isLoading ? <span className="spinner" aria-hidden="true" /> : <SearchIcon />}
          </button>
        </form>

        {status !== 'idle' && (
          <div className="filters">
            <label className="filters__field">
              <span>Год от</span>
              <input
                type="number"
                inputMode="numeric"
                min="1900"
                max="2100"
                value={yearFrom}
                onChange={(event) => setYearFrom(event.target.value)}
              />
            </label>

            <label className="filters__field">
              <span>Год до</span>
              <input
                type="number"
                inputMode="numeric"
                min="1900"
                max="2100"
                value={yearTo}
                onChange={(event) => setYearTo(event.target.value)}
              />
            </label>

            {isFiltered && (
              <span className="filters__count">
                По фильтру: {visibleMovies.length} из {movies.length}
              </span>
            )}
          </div>
        )}

        {history.length > 0 && (
          <div className="history">
            <span className="history__label">Последние запросы:</span>
            <div className="history__list">
              {history.map((item) => (
                <button
                  key={item}
                  className="history__chip"
                  type="button"
                  onClick={() => runFromHistory(item)}
                >
                  {item}
                </button>
              ))}
            </div>
            <button className="history__clear" type="button" onClick={() => setHistory([])}>
              Очистить
            </button>
          </div>
        )}

        <section className="results">
          {status === 'error' && <p className="status">{error}</p>}

          {status === 'success' && movies.length === 0 && (
            <p className="status">{NOT_FOUND_MESSAGE}</p>
          )}

          {status === 'success' && movies.length > 0 && (
            <>
              {visibleMovies.length > 0 ? (
                <div className="movie-list">
                  {visibleMovies.map((movie) => (
                    <MovieCard key={movie.imdbID} movie={movie} />
                  ))}
                </div>
              ) : (
                <p className="status">В выбранном диапазоне годов ничего нет</p>
              )}

              {totalPages > 1 && (
                <nav className="pagination" aria-label="Постраничная навигация">
                  <button
                    className="pagination__button"
                    type="button"
                    onClick={() => goToPage(Math.max(1, page - 1))}
                    disabled={page <= 1 || isLoading}
                  >
                    Предыдущая
                  </button>

                  <span className="pagination__info">
                    Страница {page} из {totalPages}
                  </span>

                  <button
                    className="pagination__button"
                    type="button"
                    onClick={() => goToPage(Math.min(totalPages, page + 1))}
                    disabled={page >= totalPages || isLoading}
                  >
                    Следующая
                  </button>
                </nav>
              )}
            </>
          )}
        </section>
      </main>
    </div>
  )
}

export default App
