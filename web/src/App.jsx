import { useEffect, useMemo, useState } from 'react'
import { CircleMarker, MapContainer, Popup, TileLayer } from 'react-leaflet'
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import './App.css'

const MAX_RENDER_POINTS = 4000
const CONDITION_COLORS = ['#2b8a3e', '#e9c46a', '#f4a261', '#e76f51', '#6c757d']

const asChartRows = (pairs) =>
  (pairs || []).map(([label, count]) => ({
    label,
    count,
  }))

function App() {
  const [features, setFeatures] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [speciesFilter, setSpeciesFilter] = useState('All')
  const [conditionFilter, setConditionFilter] = useState('All')
  const [neighborhoodFilter, setNeighborhoodFilter] = useState('All')

  useEffect(() => {
    const load = async () => {
      try {
        const [geoRes, summaryRes] = await Promise.all([
          fetch('/data/trees.geojson'),
          fetch('/data/summary.json'),
        ])

        if (!geoRes.ok || !summaryRes.ok) {
          throw new Error('Data files are missing. Run the Python prep script first.')
        }

        const geojson = await geoRes.json()
        const summaryPayload = await summaryRes.json()

        setFeatures(geojson.features || [])
        setSummary(summaryPayload)
      } catch (err) {
        setError(err.message || 'Failed to load tree data.')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  const speciesOptions = useMemo(() => {
    const names = new Set(features.map((feature) => feature.properties.species))
    return ['All', ...Array.from(names).sort((a, b) => a.localeCompare(b))]
  }, [features])

  const conditionOptions = useMemo(() => {
    const values = new Set(features.map((feature) => feature.properties.condition))
    return ['All', ...Array.from(values).sort((a, b) => a.localeCompare(b))]
  }, [features])

  const neighborhoodOptions = useMemo(() => {
    const values = new Set(features.map((feature) => feature.properties.neighborhood))
    return ['All', ...Array.from(values).sort((a, b) => a.localeCompare(b))]
  }, [features])

  const filteredFeatures = useMemo(() => {
    return features.filter((feature) => {
      const props = feature.properties
      if (speciesFilter !== 'All' && props.species !== speciesFilter) return false
      if (conditionFilter !== 'All' && props.condition !== conditionFilter) return false
      if (neighborhoodFilter !== 'All' && props.neighborhood !== neighborhoodFilter) return false
      return true
    })
  }, [conditionFilter, features, neighborhoodFilter, speciesFilter])

  const mapFeatures = filteredFeatures.slice(0, MAX_RENDER_POINTS)
  const topSpeciesRows = asChartRows(summary?.top_species)
  const conditionRows = asChartRows(summary?.condition_distribution)
  const diameterRows = asChartRows(summary?.diameter_distribution)

  if (loading) {
    return <main className="status">Loading tree data...</main>
  }

  if (error) {
    return <main className="status error">{error}</main>
  }

  return (
    <main className="layout">
      <header>
        <h1>Portland Tree Explorer</h1>
        <p>
          React + Python workflow for mapping and analyzing Portland, Oregon tree records.
        </p>
      </header>

      <section className="stats">
        <article>
          <h2>Total trees</h2>
          <p>{(summary?.total_trees || 0).toLocaleString()}</p>
        </article>
        <article>
          <h2>Unique species</h2>
          <p>{(summary?.unique_species || 0).toLocaleString()}</p>
        </article>
        <article>
          <h2>Filtered trees</h2>
          <p>{filteredFeatures.length.toLocaleString()}</p>
        </article>
      </section>

      <section className="filters">
        <label>
          Species
          <select value={speciesFilter} onChange={(event) => setSpeciesFilter(event.target.value)}>
            {speciesOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label>
          Condition
          <select value={conditionFilter} onChange={(event) => setConditionFilter(event.target.value)}>
            {conditionOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label>
          Neighborhood
          <select value={neighborhoodFilter} onChange={(event) => setNeighborhoodFilter(event.target.value)}>
            {neighborhoodOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="map-panel">
        <MapContainer center={[45.523064, -122.676483]} zoom={11} scrollWheelZoom>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {mapFeatures.map((feature) => {
            const [lon, lat] = feature.geometry.coordinates
            const props = feature.properties
            return (
              <CircleMarker
                key={props.id}
                center={[lat, lon]}
                pathOptions={{ color: '#2f9e44', fillColor: '#74c69d', fillOpacity: 0.65 }}
                radius={3}
              >
                <Popup>
                  <strong>{props.species}</strong>
                  <br />
                  Condition: {props.condition}
                  <br />
                  Neighborhood: {props.neighborhood}
                  <br />
                  Diameter: {props.diameter ? `${props.diameter} in` : 'Unknown'}
                  <br />
                  Address: {props.address}
                </Popup>
              </CircleMarker>
            )
          })}
        </MapContainer>
        {filteredFeatures.length > MAX_RENDER_POINTS && (
          <p className="note">
            Showing {MAX_RENDER_POINTS.toLocaleString()} of {filteredFeatures.length.toLocaleString()} points for
            browser performance.
          </p>
        )}
      </section>

      <section className="charts">
        <article>
          <h2>Top species</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={topSpeciesRows} layout="vertical" margin={{ top: 6, right: 12, left: 24, bottom: 6 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis type="category" dataKey="label" width={120} />
              <Tooltip />
              <Bar dataKey="count" fill="#2f9e44" />
            </BarChart>
          </ResponsiveContainer>
        </article>

        <article>
          <h2>Condition distribution</h2>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={conditionRows} dataKey="count" nameKey="label" outerRadius={85} label>
                {conditionRows.map((row, index) => (
                  <Cell key={row.label} fill={CONDITION_COLORS[index % CONDITION_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </article>

        <article>
          <h2>Diameter classes</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={diameterRows}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#40916c" />
            </BarChart>
          </ResponsiveContainer>
        </article>
      </section>
    </main>
  )
}

export default App
