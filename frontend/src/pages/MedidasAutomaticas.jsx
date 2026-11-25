
import { useEffect, useState } from 'react'

export default function MedidasAutomaticas() {
  const [modelos, setModelos] = useState([])
  const [modeloId, setModeloId] = useState('')
  const [ancho, setAncho] = useState('1.20')
  const [alto, setAlto] = useState('1.50')
  const [profundidad, setProfundidad] = useState('0')
  const [resultado, setResultado] = useState(null)
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)

  useEffect(() => {
    async function cargarModelos() {
      try {
        const respuesta = await fetch('/api/modelos', {
          credentials: 'include',
          headers: {
            Accept: 'application/json',
          },
        })

        if (!respuesta.ok) {
          throw new Error(
            respuesta.status === 401
              ? 'Debes iniciar sesión para consultar los modelos.'
              : 'No se pudieron cargar los modelos.'
          )
        }

        const datos = await respuesta.json()
        const lista = datos.modelos || []

        setModelos(lista)

        if (lista.length > 0) {
          setModeloId(String(lista[0].idModeloProducto))
        }
      } catch (err) {
        setError(err.message)
      }
    }

    cargarModelos()
  }, [])

  async function calcular(evento) {
    evento.preventDefault()
    setError('')
    setResultado(null)

    if (!modeloId) {
      setError('Selecciona un modelo de estructura metálica.')
      return
    }

    if (
      !Number.isFinite(Number(ancho)) ||
      !Number.isFinite(Number(alto)) ||
      !Number.isFinite(Number(profundidad)) ||
      Number(ancho) <= 0 ||
      Number(alto) <= 0 ||
      Number(profundidad) < 0
    ) {
      setError('Las dimensiones no son válidas.')
      return
    }

    setCargando(true)

    try {
      const parametros = new URLSearchParams({
        ancho,
        alto,
        profundidad,
      })

      const respuesta = await fetch(
        `/api/modelos/${modeloId}/calcular?${parametros}`,
        {
          credentials: 'include',
          headers: {
            Accept: 'application/json',
          },
        }
      )

      const datos = await respuesta.json()

      if (!respuesta.ok) {
        throw new Error(
          datos.mensaje ||
          datos.message ||
          'No se pudo realizar el cálculo.'
        )
      }

      setResultado(datos.resultado)
    } catch (err) {
      setError(err.message)
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="container-fluid py-3">
      <h2 className="mb-3">Medidas automáticas</h2>

      <p className="text-muted">
        Calcula las piezas y materiales de una estructura
        metálica según sus dimensiones.
      </p>

      <div className="card shadow-sm mb-4">
        <div className="card-body">
          <form onSubmit={calcular}>
            <div className="row g-3">
              <div className="col-md-12">
                <label className="form-label">
                  Modelo de estructura
                </label>

                <select
                  className="form-select"
                  value={modeloId}
                  onChange={(e) => {
                    setModeloId(e.target.value)
                    setResultado(null)
                  }}
                  required
                >
                  {modelos.length === 0 && (
                    <option value="">
                      No hay modelos disponibles
                    </option>
                  )}

                  {modelos.map((modelo) => (
                    <option
                      key={modelo.idModeloProducto}
                      value={modelo.idModeloProducto}
                    >
                      {modelo.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-md-4">
                <label className="form-label">
                  Ancho (metros)
                </label>

                <input
                  className="form-control"
                  type="number"
                  min="0.001"
                  step="any"
                  value={ancho}
                  onChange={(e) => setAncho(e.target.value)}
                  required
                />
              </div>

              <div className="col-md-4">
                <label className="form-label">
                  Alto (metros)
                </label>

                <input
                  className="form-control"
                  type="number"
                  min="0.001"
                  step="any"
                  value={alto}
                  onChange={(e) => setAlto(e.target.value)}
                  required
                />
              </div>

              <div className="col-md-4">
                <label className="form-label">
                  Profundidad (metros)
                </label>

                <input
                  className="form-control"
                  type="number"
                  min="0"
                  step="any"
                  value={profundidad}
                  onChange={(e) => setProfundidad(e.target.value)}
                  required
                />
              </div>
            </div>

            <button
              className="btn btn-primary mt-4"
              type="submit"
              disabled={cargando || !modeloId}
            >
              {cargando
                ? 'Calculando...'
                : 'Calcular medidas'}
            </button>
          </form>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}

      {resultado && (
        <>
          <div className="card shadow-sm mb-4">
            <div className="card-body">
              <h4>Lista de piezas</h4>

              <p className="text-muted">
                {resultado.modelo}
              </p>

              <div className="table-responsive">
                <table className="table table-striped">
                  <thead>
                    <tr>
                      <th>Componente</th>
                      <th>Material</th>
                      <th>Cantidad</th>
                      <th>Medida por pieza</th>
                      <th>Total</th>
                    </tr>
                  </thead>

                  <tbody>
                    {resultado.componentes.map(
                      (pieza, indice) => (
                        <tr key={indice}>
                          <td>{pieza.componente}</td>
                          <td>{pieza.material}</td>
                          <td>{pieza.cantidadPiezas}</td>
                          <td>
                            {pieza.medidaPorPieza} {pieza.unidad}
                          </td>
                          <td>
                            {pieza.medidaTotal} {pieza.unidad}
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="card shadow-sm">
            <div className="card-body">
              <h4>Materiales requeridos</h4>

              <div className="table-responsive">
                <table className="table table-striped">
                  <thead>
                    <tr>
                      <th>Material</th>
                      <th>Cantidad neta</th>
                      <th>Merma</th>
                      <th>Con merma</th>
                    </tr>
                  </thead>

                  <tbody>
                    {resultado.materiales.map(
                      (material, indice) => (
                        <tr key={indice}>
                          <td>{material.material}</td>
                          <td>
                            {material.cantidadNeta} {material.unidad}
                          </td>
                          <td>{material.porcentajeMerma}%</td>
                          <td>
                            {material.cantidadConMerma} {material.unidad}
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
