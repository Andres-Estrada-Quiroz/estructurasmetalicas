
import { useCallback, useEffect, useMemo, useState } from "react";

// ==========================================
// SISTEMA WEB CORPORACIÓN ORTEGA
// MÓDULO ÚNICO DE ALMACÉN
// ==========================================

const TIPOS = [
  { value: "und", label: "Solo cantidad (unidades)" },
  { value: "m", label: "Cantidad y largo (metros)" },
  { value: "m2", label: "Cantidad, largo y ancho (m²)" },
  { value: "m3", label: "Cantidad, largo, ancho y alto (m³)" },
];

const PESTANAS = [
  { id: "registro", nombre: "Registrar material" },
  { id: "entradas", nombre: "Entradas" },
  { id: "salidas", nombre: "Salidas" },
  { id: "inventario", nombre: "Inventario" },
  { id: "historial", nombre: "Historial" },
];

const MATERIAL_INICIAL = {
  codigo: "",
  nombre: "",
  unidadMedida: "und",
  descripcion: "",
  idAlmacen: "",
  cantidadPiezas: "",
  largoMetros: "",
  anchoMetros: "",
  altoMetros: "",
};

const MOVIMIENTO_INICIAL = {
  idAlmacen: "",
  idMaterial: "",
  idPresentacion: "",
  cantidadPiezas: "",
  largoMetros: "",
  anchoMetros: "",
  altoMetros: "",
  motivo: "",
  referencia: "",
};

// ==========================================
// FUNCIONES AUXILIARES
// ==========================================

function activo(valor) {
  return (
    valor === true ||
    valor === 1 ||
    valor === "1" ||
    valor === "true"
  );
}

function formato(valor) {
  return new Intl.NumberFormat("es-PE", {
    maximumFractionDigits: 3,
  }).format(Number(valor) || 0);
}

function fecha(valor) {
  if (!valor) return "—";

  const resultado = new Date(valor);

  return Number.isNaN(resultado.getTime())
    ? String(valor)
    : resultado.toLocaleString("es-PE");
}

function simbolo(unidad) {
  if (unidad === "m2") return "m²";
  if (unidad === "m3") return "m³";
  return unidad || "und";
}

function camposMedida(unidad) {
  if (unidad === "m") {
    return [
      ["largoMetros", "Largo por pieza (metros)"],
    ];
  }

  if (unidad === "m2") {
    return [
      ["largoMetros", "Largo por pieza (metros)"],
      ["anchoMetros", "Ancho por pieza (metros)"],
    ];
  }

  if (unidad === "m3") {
    return [
      ["largoMetros", "Largo por pieza (metros)"],
      ["anchoMetros", "Ancho por pieza (metros)"],
      ["altoMetros", "Alto por pieza (metros)"],
    ];
  }

  return [];
}

function factor(unidad, datos) {
  if (unidad === "und") return 1;

  const largo = Number(datos?.largoMetros) || 0;
  const ancho = Number(datos?.anchoMetros) || 0;
  const alto = Number(datos?.altoMetros) || 0;

  if (unidad === "m") return largo;
  if (unidad === "m2") return largo * ancho;
  if (unidad === "m3") return largo * ancho * alto;

  return 0;
}

function calcularTotal(unidad, cantidad, medidas) {
  const resultado =
    Number(cantidad || 0) * factor(unidad, medidas);

  return Number.isFinite(resultado)
    ? resultado
    : 0;
}

function descripcionMedida(datos, unidad) {
  if (unidad === "und") return "No aplica";
  if (!datos) return "—";

  const campos = camposMedida(unidad);
  const valores = campos.map(([campo]) => {
    const valor = datos[campo];

    return valor === null ||
      valor === undefined ||
      valor === ""
      ? "—"
      : formato(valor);
  });

  return `${valores.join(" × ")} m`;
}

function validarEntero(valor) {
  const texto = String(valor ?? "").trim();

  return (
    /^\d+$/.test(texto) &&
    Number.isSafeInteger(Number(texto)) &&
    Number(texto) > 0
  );
}

function validarDimensiones(unidad, datos) {
  for (const [campo, nombre] of camposMedida(unidad)) {
    const texto = String(datos[campo] ?? "").trim();

    if (
      !/^\d+(\.\d{1,3})?$/.test(texto) ||
      Number(texto) <= 0
    ) {
      throw new Error(
        `${nombre}: ingresa un número positivo ` +
        "con máximo tres decimales."
      );
    }
  }

  const total = calcularTotal(
    unidad,
    datos.cantidadPiezas,
    datos
  );

  if (total <= 0 || Math.round(total * 1000) === 0) {
    throw new Error(
      "La cantidad total calculada debe ser mayor que cero."
    );
  }

  if (
    Math.abs(total - Math.round(total * 1000) / 1000) >
    0.000000001
  ) {
    throw new Error(
      "El total no puede expresarse con tres decimales. " +
      "Revisa las medidas ingresadas."
    );
  }
}

function medidasApi(unidad, datos) {
  return {
    largoMetros:
      unidad === "und"
        ? null
        : Number(datos.largoMetros),

    anchoMetros:
      ["m2", "m3"].includes(unidad)
        ? Number(datos.anchoMetros)
        : null,

    altoMetros:
      unidad === "m3"
        ? Number(datos.altoMetros)
        : null,
  };
}

async function procesarRespuesta(respuesta) {
  let datos;

  try {
    datos = await respuesta.json();
  } catch {
    throw new Error(
      `El servidor devolvió una respuesta no válida (${respuesta.status}).`
    );
  }

  if (!respuesta.ok || datos.ok === false) {
    const validaciones = datos.errors
      ? Object.values(datos.errors).flat()
      : [];

    throw new Error(
      validaciones[0] ||
      datos.mensaje ||
      datos.message ||
      `Error HTTP ${respuesta.status}`
    );
  }

  return datos;
}

async function api(ruta, metodo = "GET", cuerpo = null) {
  const headers = {
    Accept: "application/json",
  };

  if (metodo !== "GET") {
    const csrf = await procesarRespuesta(
      await fetch("/api/auth/csrf", {
        credentials: "include",
        headers: {
          Accept: "application/json",
        },
      })
    );

    if (!csrf.csrf_token) {
      throw new Error(
        "No se pudo obtener el token de seguridad."
      );
    }

    headers["X-CSRF-TOKEN"] = csrf.csrf_token;
    headers["Content-Type"] = "application/json";
  }

  return procesarRespuesta(
    await fetch(ruta, {
      method: metodo,
      credentials: "include",
      headers,
      ...(cuerpo !== null
        ? { body: JSON.stringify(cuerpo) }
        : {}),
    })
  );
}

// ==========================================
// COMPONENTE DE CAMPOS NUMÉRICOS
// ==========================================

function Medidas({
  unidad,
  datos,
  onChange,
  disabled = false,
}) {
  const campos = camposMedida(unidad);

  if (campos.length === 0) {
    return (
      <div className="col-12">
        <div className="alert alert-secondary mb-0">
          Este material se controla solo por cantidad.
          No necesita medidas.
        </div>
      </div>
    );
  }

  return campos.map(([campo, nombre]) => (
    <div className="col-md-4" key={campo}>
      <label className="form-label">{nombre}</label>

      <input
        type="number"
        inputMode="decimal"
        min="0.001"
        step="0.001"
        name={campo}
        className="form-control"
        value={datos[campo]}
        onChange={onChange}
        disabled={disabled}
        placeholder="0.000"
        required
      />
    </div>
  ));
}

// ==========================================
// COMPONENTE PRINCIPAL
// ==========================================

export default function Almacen() {
  const [pestana, setPestana] = useState("registro");

  const [materiales, setMateriales] = useState([]);
  const [almacenes, setAlmacenes] = useState([]);
  const [existencias, setExistencias] = useState([]);
  const [presentaciones, setPresentaciones] = useState([]);
  const [movimientos, setMovimientos] = useState([]);

  const [formMaterial, setFormMaterial] = useState(
    MATERIAL_INICIAL
  );

  const [editandoMaterial, setEditandoMaterial] =
    useState(null);

  const [formMovimiento, setFormMovimiento] = useState(
    MOVIMIENTO_INICIAL
  );

  const [formMinimo, setFormMinimo] = useState(null);

  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  // ========================================
  // CARGA DE INFORMACIÓN
  // ========================================

  const cargarDatos = useCallback(async () => {
    setCargando(true);

    try {
      const [respuestaMateriales, respuestaExistencias, respuestaHistorial] =
        await Promise.all([
          api("/api/materiales"),
          api("/api/almacen/existencias"),
          api("/api/almacen/movimientos"),
        ]);

      setMateriales(
        respuestaMateriales.materiales || []
      );

      setAlmacenes(
        respuestaExistencias.almacenes || []
      );

      setExistencias(
        respuestaExistencias.existencias || []
      );

      setPresentaciones(
        respuestaExistencias.presentaciones || []
      );

      setMovimientos(
        respuestaHistorial.movimientos || []
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  // ========================================
  // INFORMACIÓN DERIVADA
  // ========================================

  const materialesActivos = materiales.filter(
    (m) => activo(m.estado)
  );

  const almacenPorDefecto =
    almacenes.length === 1
      ? String(almacenes[0].idAlmacen)
      : "";

  const almacenInicial =
    formMaterial.idAlmacen || almacenPorDefecto;

  const materialMovimiento = materiales.find(
    (m) =>
      String(m.idMaterial) ===
      String(formMovimiento.idMaterial)
  );

  const unidadMovimiento =
    materialMovimiento?.unidadMedida || "und";

  const existenciaMovimiento = existencias.find(
    (e) =>
      String(e.idMaterial) ===
        String(formMovimiento.idMaterial) &&
      String(e.idAlmacen) ===
        String(formMovimiento.idAlmacen)
  );

  const opcionesSalida = presentaciones.filter(
    (p) =>
      String(p.idMaterial) ===
        String(formMovimiento.idMaterial) &&
      String(p.idAlmacen) ===
        String(formMovimiento.idAlmacen) &&
      Number(p.cantidadPiezas) > 0
  );

  const presentacionSeleccionada = opcionesSalida.find(
    (p) =>
      String(p.idPresentacion) ===
      String(formMovimiento.idPresentacion)
  );

  const esEntrada = pestana === "entradas";

  const medidasActuales = esEntrada
    ? formMovimiento
    : presentacionSeleccionada;

  const totalMovimiento = calcularTotal(
    unidadMovimiento,
    formMovimiento.cantidadPiezas,
    medidasActuales || {}
  );

  const totalInicial = calcularTotal(
    formMaterial.unidadMedida,
    formMaterial.cantidadPiezas,
    formMaterial
  );

  const registrosInventario = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();

    return presentaciones.filter((p) =>
      `${p.codigo} ${p.material}`
        .toLowerCase()
        .includes(texto)
    );
  }, [presentaciones, busqueda]);

  const totalPiezas = presentaciones.reduce(
    (suma, p) => suma + Number(p.cantidadPiezas),
    0
  );

  function piezasPorExistencia(id) {
    return presentaciones
      .filter(
        (p) =>
          String(p.idExistencia) === String(id)
      )
      .reduce(
        (suma, p) =>
          suma + Number(p.cantidadPiezas),
        0
      );
  }

  // ========================================
  // NAVEGACIÓN
  // ========================================

  function cambiarPestana(nueva) {
    if (guardando) return;

    setPestana(nueva);
    setError("");
    setMensaje("");
    setFormMinimo(null);

    setFormMovimiento({
      ...MOVIMIENTO_INICIAL,
      idAlmacen: almacenPorDefecto,
    });
  }

  // ========================================
  // MATERIAL
  // ========================================

  function cambiarCampoMaterial(e) {
    const { name, value } = e.target;

    setFormMaterial((anterior) => ({
      ...anterior,
      [name]: value,

      ...(name === "unidadMedida"
        ? {
            largoMetros: "",
            anchoMetros: "",
            altoMetros: "",
          }
        : {}),
    }));
  }

  function editarMaterial(material) {
    setEditandoMaterial(material.idMaterial);

    setFormMaterial({
      ...MATERIAL_INICIAL,
      codigo: material.codigo || "",
      nombre: material.nombre || "",
      descripcion: material.descripcion || "",
      unidadMedida: material.unidadMedida || "und",
    });

    setPestana("registro");
    setError("");
    setMensaje("");
  }

  function cancelarEdicion() {
    setEditandoMaterial(null);
    setFormMaterial(MATERIAL_INICIAL);
  }

  async function guardarMaterial(e) {
    e.preventDefault();

    setError("");
    setMensaje("");

    if (
      !formMaterial.codigo.trim() ||
      !formMaterial.nombre.trim()
    ) {
      setError(
        "Ingresa el código y el nombre del material."
      );
      return;
    }

    const esEdicion = editandoMaterial !== null;

    const cantidadTexto = String(
      formMaterial.cantidadPiezas
    ).trim();

    // La cantidad inicial es opcional.
    // Si se ingresa, debe ser válida.

    const tieneInventario =
      !esEdicion && cantidadTexto !== "";

    if (tieneInventario) {
      if (!validarEntero(cantidadTexto)) {
        setError(
          "La cantidad inicial debe ser un número entero mayor que cero."
        );
        return;
      }

      if (!almacenInicial) {
        setError(
          "Selecciona el almacén."
        );
        return;
      }

      try {
        validarDimensiones(
          formMaterial.unidadMedida,
          formMaterial
        );
      } catch (err) {
        setError(err.message);
        return;
      }
    }

    const materialAnterior = esEdicion
      ? materiales.find(
          (m) =>
            String(m.idMaterial) ===
            String(editandoMaterial)
        )
      : null;

    if (esEdicion && !materialAnterior) {
      setError(
        "No se encontró el material que deseas editar."
      );
      return;
    }

    const resumen = esEdicion
      ? `¿Actualizar el material ${formMaterial.nombre}?`
      : tieneInventario
      ? `¿Registrar ${formMaterial.nombre}?\n\n` +
        `Cantidad: ${cantidadTexto}\n` +
        `Medidas: ${descripcionMedida(
          formMaterial,
          formMaterial.unidadMedida
        )}\n` +
        `Total: ${formato(totalInicial)} ${simbolo(
          formMaterial.unidadMedida
        )}`
      : `¿Registrar ${formMaterial.nombre} sin inventario inicial?`;

    if (!window.confirm(resumen)) return;

    setGuardando(true);

    try {
      const cuerpo = {
        codigo: formMaterial.codigo.trim(),
        nombre: formMaterial.nombre.trim(),
        descripcion:
          formMaterial.descripcion.trim() || null,

        unidadMedida: esEdicion
          ? materialAnterior.unidadMedida
          : formMaterial.unidadMedida,

        ...(esEdicion
          ? { estado: activo(materialAnterior.estado) }
          : {}),

        ...(tieneInventario
          ? {
              inventarioInicial: {
                idAlmacen: Number(almacenInicial),
                cantidadPiezas: Number(cantidadTexto),
                ...medidasApi(
                  formMaterial.unidadMedida,
                  formMaterial
                ),
                motivo: "Inventario inicial",
                referencia: null,
              },
            }
          : {}),
      };

      const resultado = await api(
        esEdicion
          ? `/api/materiales/${editandoMaterial}`
          : "/api/materiales",
        esEdicion ? "PUT" : "POST",
        cuerpo
      );

      cancelarEdicion();
      await cargarDatos();

      setMensaje(
        resultado.mensaje ||
          "Material guardado correctamente."
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  // ========================================
  // ENTRADAS Y SALIDAS
  // ========================================

  function cambiarCampoMovimiento(e) {
    const { name, value } = e.target;

    setFormMovimiento((anterior) => ({
      ...anterior,
      [name]: value,

      ...(
        name === "idMaterial" ||
        name === "idAlmacen"
          ? {
              idPresentacion: "",
              largoMetros: "",
              anchoMetros: "",
              altoMetros: "",
            }
          : {}
      ),
    }));
  }

  async function guardarMovimiento(e) {
    e.preventDefault();

    setError("");
    setMensaje("");

    if (
      !formMovimiento.idAlmacen ||
      !materialMovimiento
    ) {
      setError(
        "Selecciona un almacén y un material."
      );
      return;
    }

    if (
      !validarEntero(
        formMovimiento.cantidadPiezas
      )
    ) {
      setError(
        "La cantidad debe ser un número entero positivo."
      );
      return;
    }

    if (!formMovimiento.motivo.trim()) {
      setError(
        "Debes indicar el motivo del movimiento."
      );
      return;
    }

    if (!TIPOS.some(
      (t) => t.value === unidadMovimiento
    )) {
      setError(
        "El material tiene una unidad de medida no configurada."
      );
      return;
    }

    if (esEntrada) {
      try {
        validarDimensiones(
          unidadMovimiento,
          formMovimiento
        );
      } catch (err) {
        setError(err.message);
        return;
      }
    } else {
      if (!presentacionSeleccionada) {
        setError(
          "Selecciona las piezas o unidades que deseas retirar."
        );
        return;
      }

      if (
        Number(formMovimiento.cantidadPiezas) >
        Number(
          presentacionSeleccionada.cantidadPiezas
        )
      ) {
        setError(
          "La cantidad supera las piezas disponibles."
        );
        return;
      }

      if (
        totalMovimiento >
        Number(
          existenciaMovimiento?.stockDisponible || 0
        )
      ) {
        setError(
          "No hay suficiente stock disponible."
        );
        return;
      }
    }

    const tipo = esEntrada
      ? "ENTRADA"
      : "SALIDA";

    const texto =
      `${tipo} DE MATERIAL\n\n` +
      `Material: ${materialMovimiento.nombre}\n` +
      `Cantidad: ${formMovimiento.cantidadPiezas}\n` +
      `Medida: ${descripcionMedida(
        medidasActuales,
        unidadMovimiento
      )}\n` +
      `Total: ${formato(totalMovimiento)} ` +
      `${simbolo(unidadMovimiento)}\n\n` +
      `¿Confirmar el movimiento?`;

    if (!window.confirm(texto)) return;

    setGuardando(true);

    try {
      const cuerpo = {
        idAlmacen: Number(
          formMovimiento.idAlmacen
        ),

        idMaterial: Number(
          formMovimiento.idMaterial
        ),

        tipoMovimiento: tipo,

        cantidadPiezas: Number(
          formMovimiento.cantidadPiezas
        ),

        motivo: formMovimiento.motivo.trim(),

        referencia:
          formMovimiento.referencia.trim() || null,

        ...(esEntrada
          ? medidasApi(
              unidadMovimiento,
              formMovimiento
            )
          : {
              idPresentacion: Number(
                formMovimiento.idPresentacion
              ),
            }),
      };

      const resultado = await api(
        "/api/almacen/movimientos",
        "POST",
        cuerpo
      );

      setFormMovimiento({
        ...MOVIMIENTO_INICIAL,
        idAlmacen:
          String(formMovimiento.idAlmacen),
        idMaterial:
          String(formMovimiento.idMaterial),
      });

      await cargarDatos();

      setMensaje(
        `${resultado.mensaje} ` +
        `Cantidad: ${resultado.cantidadPiezas}. ` +
        `Total: ${formato(
          resultado.cantidadBase
        )} ${simbolo(resultado.unidadMedida)}.`
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  // ========================================
  // STOCK MÍNIMO
  // ========================================

  async function guardarStockMinimo() {
    if (!formMinimo) return;

    const valor = String(
      formMinimo.valor
    ).trim();

    if (
      !/^\d+(\.\d{1,3})?$/.test(valor) ||
      (
        formMinimo.unidadMedida === "und" &&
        !Number.isInteger(Number(valor))
      )
    ) {
      setError(
        "El stock mínimo debe ser un número válido."
      );
      return;
    }

    if (!window.confirm(
      "¿Actualizar el stock mínimo?"
    )) {
      return;
    }

    setGuardando(true);
    setError("");

    try {
      const resultado = await api(
        `/api/almacen/existencias/${formMinimo.id}/minimo`,
        "PUT",
        {
          stockMinimo: Number(valor),
        }
      );

      setFormMinimo(null);
      await cargarDatos();

      setMensaje(
        resultado.mensaje ||
          "Stock mínimo actualizado."
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  // ========================================
  // FORMULARIO DE MOVIMIENTO
  // ========================================

  function formularioMovimiento() {
    return (
      <div className="card border-0 shadow-sm">
        <div className="card-body p-4">

          <h5 className="mb-2">
            {esEntrada
              ? "Registrar entrada de materiales"
              : "Registrar salida de materiales"}
          </h5>

          <p className="text-muted">
            {esEntrada
              ? "Registra las piezas nuevas que ingresan al almacén."
              : "Selecciona las piezas que se retirarán del almacén."}
          </p>

          <form onSubmit={guardarMovimiento}>
            <div className="row g-3">

              <div className="col-md-6">
                <label className="form-label">
                  Almacén
                </label>

                <select
                  className="form-select"
                  name="idAlmacen"
                  value={formMovimiento.idAlmacen}
                  onChange={cambiarCampoMovimiento}
                  required
                >
                  <option value="">
                    Selecciona un almacén
                  </option>

                  {almacenes.map((a) => (
                    <option
                      key={a.idAlmacen}
                      value={a.idAlmacen}
                    >
                      {a.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-md-6">
                <label className="form-label">
                  Material
                </label>

                <select
                  className="form-select"
                  name="idMaterial"
                  value={formMovimiento.idMaterial}
                  onChange={cambiarCampoMovimiento}
                  required
                >
                  <option value="">
                    Selecciona un material
                  </option>

                  {materialesActivos.map((m) => (
                    <option
                      key={m.idMaterial}
                      value={m.idMaterial}
                    >
                      {m.codigo} — {m.nombre}
                      {" ("}{simbolo(m.unidadMedida)}{")"}
                    </option>
                  ))}
                </select>
              </div>

              {!esEntrada && materialMovimiento && (
                <div className="col-12">
                  <label className="form-label">
                    Medida o presentación disponible
                  </label>

                  <select
                    className="form-select"
                    name="idPresentacion"
                    value={formMovimiento.idPresentacion}
                    onChange={cambiarCampoMovimiento}
                    required
                  >
                    <option value="">
                      Selecciona las piezas que saldrán
                    </option>

                    {opcionesSalida.map((p) => (
                      <option
                        key={p.idPresentacion}
                        value={p.idPresentacion}
                      >
                        {descripcionMedida(
                          p,
                          p.unidadMedida
                        )}
                        {" — "}
                        {formato(p.cantidadPiezas)}
                        {" disponibles"}
                      </option>
                    ))}
                  </select>

                  {opcionesSalida.length === 0 && (
                    <div className="text-danger small mt-2">
                      No hay piezas clasificadas disponibles
                      de este material.
                    </div>
                  )}
                </div>
              )}

              <div className="col-md-4">
                <label className="form-label">
                  Cantidad de piezas o unidades
                </label>

                <input
                  type="number"
                  inputMode="numeric"
                  min="1"
                  step="1"
                  name="cantidadPiezas"
                  className="form-control"
                  value={formMovimiento.cantidadPiezas}
                  onChange={cambiarCampoMovimiento}
                  placeholder="Ejemplo: 5"
                  required
                />
              </div>

              {esEntrada &&
                materialMovimiento && (
                  <Medidas
                    unidad={unidadMovimiento}
                    datos={formMovimiento}
                    onChange={cambiarCampoMovimiento}
                  />
                )}

              <div className="col-md-6">
                <label className="form-label">
                  Motivo
                </label>

                <input
                  className="form-control"
                  name="motivo"
                  value={formMovimiento.motivo}
                  onChange={cambiarCampoMovimiento}
                  maxLength={100}
                  placeholder={
                    esEntrada
                      ? "Ejemplo: Compra recibida"
                      : "Ejemplo: Entrega a producción"
                  }
                  required
                />
              </div>

              <div className="col-md-6">
                <label className="form-label">
                  Referencia (opcional)
                </label>

                <input
                  className="form-control"
                  name="referencia"
                  value={formMovimiento.referencia}
                  onChange={cambiarCampoMovimiento}
                  maxLength={100}
                  placeholder="Factura u orden"
                />
              </div>

              {materialMovimiento && (
                <div className="col-12">
                  <div className="alert alert-info mb-0">

                    <strong>
                      Resumen del movimiento
                    </strong>

                    <div className="mt-2">
                      Cantidad:{" "}
                      <strong>
                        {formato(
                          formMovimiento.cantidadPiezas
                        )}
                      </strong>
                    </div>

                    {unidadMovimiento !== "und" && (
                      <div>
                        Medida por pieza:{" "}
                        <strong>
                          {descripcionMedida(
                            medidasActuales,
                            unidadMovimiento
                          )}
                        </strong>
                      </div>
                    )}

                    <div>
                      Total:{" "}
                      <strong>
                        {formato(totalMovimiento)}{" "}
                        {simbolo(unidadMovimiento)}
                      </strong>
                    </div>

                    {!esEntrada &&
                      existenciaMovimiento && (
                        <div className="mt-2">
                          Stock disponible general:{" "}
                          <strong>
                            {formato(
                              existenciaMovimiento.stockDisponible
                            )}{" "}
                            {simbolo(unidadMovimiento)}
                          </strong>
                        </div>
                      )}

                  </div>
                </div>
              )}
            </div>

            <button
              type="submit"
              className={
                "btn mt-4 " +
                (esEntrada
                  ? "btn-success"
                  : "btn-danger")
              }
              disabled={
                guardando ||
                cargando ||
                !materialMovimiento
              }
            >
              {guardando
                ? "Procesando..."
                : esEntrada
                ? "Revisar y registrar entrada"
                : "Revisar y registrar salida"}
            </button>
          </form>

        </div>
      </div>
    );
  }

  // ========================================
  // INTERFAZ PRINCIPAL
  // ========================================

  return (
    <div className="container-fluid py-3">

      <h2 className="mb-2">
        Almacén
      </h2>

      <p className="text-muted mb-4">
        Control de materiales, cantidades,
        medidas y movimientos físicos.
      </p>

      {/* MENSAJES */}

      {error && (
        <div
          className="alert alert-danger"
          role="alert"
        >
          {error}
        </div>
      )}

      {mensaje && (
        <div
          className="alert alert-success"
          role="status"
        >
          {mensaje}
        </div>
      )}

      {/* INDICADORES */}

      <div className="row g-3 mb-4">

        <div className="col-md-4">
          <div className="card border-0 shadow-sm">
            <div className="card-body">
              <div className="text-muted small">
                Materiales registrados
              </div>

              <h3>
                {materiales.length}
              </h3>
            </div>
          </div>
        </div>

        <div className="col-md-4">
          <div className="card border-0 shadow-sm">
            <div className="card-body">
              <div className="text-muted small">
                Piezas clasificadas
              </div>

              <h3>
                {formato(totalPiezas)}
              </h3>
            </div>
          </div>
        </div>

        <div className="col-md-4">
          <div className="card border-0 shadow-sm">
            <div className="card-body">
              <div className="text-muted small">
                Movimientos recientes
              </div>

              <h3>
                {movimientos.length}
              </h3>
            </div>
          </div>
        </div>

      </div>

      {/* MENÚ INTERNO */}

      <div className="card border-0 shadow-sm mb-4">
        <div className="card-body">

          <div className="d-flex flex-wrap gap-2">
            {PESTANAS.map((p) => (
              <button
                key={p.id}
                type="button"
                className={
                  "btn " +
                  (pestana === p.id
                    ? "btn-primary"
                    : "btn-outline-primary")
                }
                disabled={guardando}
                onClick={() =>
                  cambiarPestana(p.id)
                }
              >
                {p.nombre}
              </button>
            ))}

            <button
              type="button"
              className="btn btn-outline-secondary ms-auto"
              onClick={cargarDatos}
              disabled={cargando || guardando}
            >
              {cargando
                ? "Actualizando..."
                : "Actualizar"}
            </button>
          </div>

        </div>
      </div>

      {/* ==================================
          REGISTRAR MATERIAL
      ================================== */}

      {pestana === "registro" && (
        <>

          <div className="card border-0 shadow-sm mb-4">
            <div className="card-body p-4">

              <h5 className="mb-3">
                {editandoMaterial !== null
                  ? "Editar material"
                  : "Registrar material"}
              </h5>

              <form onSubmit={guardarMaterial}>

                <div className="row g-3">

                  <div className="col-md-4">
                    <label className="form-label">
                      Código
                    </label>

                    <input
                      type="text"
                      className="form-control"
                      name="codigo"
                      maxLength={50}
                      value={formMaterial.codigo}
                      onChange={cambiarCampoMaterial}
                      required
                    />
                  </div>

                  <div className="col-md-8">
                    <label className="form-label">
                      Nombre del material
                    </label>

                    <input
                      type="text"
                      className="form-control"
                      name="nombre"
                      maxLength={100}
                      value={formMaterial.nombre}
                      onChange={cambiarCampoMaterial}
                      required
                    />
                  </div>

                  <div className="col-12">
                    <label className="form-label">
                      Tipo de material
                    </label>

                    <select
                      className="form-select"
                      name="unidadMedida"
                      value={formMaterial.unidadMedida}
                      onChange={cambiarCampoMaterial}
                      disabled={
                        editandoMaterial !== null
                      }
                    >
                      {TIPOS.map((t) => (
                        <option
                          key={t.value}
                          value={t.value}
                        >
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-12">
                    <label className="form-label">
                      Descripción (opcional)
                    </label>

                    <textarea
                      className="form-control"
                      name="descripcion"
                      rows={2}
                      value={formMaterial.descripcion}
                      onChange={cambiarCampoMaterial}
                    />
                  </div>

                </div>

                {/* INVENTARIO INICIAL */}

                {editandoMaterial === null && (
                  <div className="border rounded p-3 mt-4">

                    <h6 className="mb-2">
                      Cantidad y medidas iniciales
                    </h6>

                    <p className="small text-muted">
                      Cantidad se ingresa con números enteros.
                      Las medidas permiten decimales.
                      Si no tienes stock inicial, deja
                      la cantidad vacía.
                    </p>

                    <div className="row g-3">

                      <div className="col-md-6">
                        <label className="form-label">
                          Almacén
                        </label>

                        <select
                          className="form-select"
                          name="idAlmacen"
                          value={almacenInicial}
                          onChange={cambiarCampoMaterial}
                          required={
                            formMaterial.cantidadPiezas !== ""
                          }
                        >
                          <option value="">
                            Selecciona almacén
                          </option>

                          {almacenes.map((a) => (
                            <option
                              key={a.idAlmacen}
                              value={a.idAlmacen}
                            >
                              {a.nombre}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="col-md-6">
                        <label className="form-label">
                          Cantidad inicial
                        </label>

                        <input
                          type="number"
                          inputMode="numeric"
                          min="1"
                          step="1"
                          className="form-control"
                          name="cantidadPiezas"
                          value={
                            formMaterial.cantidadPiezas
                          }
                          onChange={
                            cambiarCampoMaterial
                          }
                          placeholder="Ejemplo: 10"
                        />
                      </div>

                      {formMaterial.cantidadPiezas !== "" && (
                        <Medidas
                          unidad={
                            formMaterial.unidadMedida
                          }
                          datos={formMaterial}
                          onChange={
                            cambiarCampoMaterial
                          }
                        />
                      )}

                    </div>

                    {formMaterial.cantidadPiezas !== "" && (
                      <div className="alert alert-info mt-3 mb-0">

                        <div>
                          Cantidad:{" "}
                          <strong>
                            {formato(
                              formMaterial.cantidadPiezas
                            )}
                          </strong>
                        </div>

                        <div>
                          Medida:{" "}
                          <strong>
                            {descripcionMedida(
                              formMaterial,
                              formMaterial.unidadMedida
                            )}
                          </strong>
                        </div>

                        <div>
                          Total calculado:{" "}
                          <strong>
                            {formato(totalInicial)}{" "}
                            {simbolo(
                              formMaterial.unidadMedida
                            )}
                          </strong>
                        </div>

                      </div>
                    )}

                  </div>
                )}

                <div className="d-flex gap-2 mt-4">
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={guardando || cargando}
                  >
                    {guardando
                      ? "Guardando..."
                      : editandoMaterial !== null
                      ? "Actualizar material"
                      : "Revisar y registrar material"}
                  </button>

                  {editandoMaterial !== null && (
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      disabled={guardando}
                      onClick={cancelarEdicion}
                    >
                      Cancelar
                    </button>
                  )}
                </div>

              </form>
            </div>
          </div>

          {/* CATÁLOGO */}

          <div className="card border-0 shadow-sm">
            <div className="card-body">

              <h5>
                Materiales registrados
              </h5>

              <div className="table-responsive">
                <table className="table table-striped align-middle">
                  <thead>
                    <tr>
                      <th>Código</th>
                      <th>Nombre</th>
                      <th>Unidad</th>
                      <th>Estado</th>
                      <th>Acción</th>
                    </tr>
                  </thead>

                  <tbody>
                    {materiales.map((m) => (
                      <tr key={m.idMaterial}>
                        <td>{m.codigo}</td>
                        <td>{m.nombre}</td>
                        <td>{simbolo(m.unidadMedida)}</td>
                        <td>
                          {activo(m.estado)
                            ? "Activo"
                            : "Inactivo"}
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-primary"
                            disabled={guardando}
                            onClick={() =>
                              editarMaterial(m)
                            }
                          >
                            Editar
                          </button>
                        </td>
                      </tr>
                    ))}

                    {materiales.length === 0 && (
                      <tr>
                        <td
                          colSpan={5}
                          className="text-center text-muted"
                        >
                          No hay materiales registrados.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

            </div>
          </div>

        </>
      )}

      {/* ==================================
          ENTRADAS
      ================================== */}

      {pestana === "entradas" &&
        formularioMovimiento()}

      {/* ==================================
          SALIDAS
      ================================== */}

      {pestana === "salidas" &&
        formularioMovimiento()}

      {/* ==================================
          INVENTARIO
      ================================== */}

      {pestana === "inventario" && (
        <>

          <div className="card border-0 shadow-sm mb-4">
            <div className="card-body">

              <div className="d-flex flex-wrap gap-2 justify-content-between mb-3">

                <h5 className="mb-0">
                  Inventario físico
                </h5>

                <input
                  type="text"
                  className="form-control"
                  style={{ maxWidth: 300 }}
                  placeholder="Buscar material"
                  value={busqueda}
                  onChange={(e) =>
                    setBusqueda(e.target.value)
                  }
                />

              </div>

              <div className="table-responsive">
                <table className="table table-striped align-middle">

                  <thead>
                    <tr>
                      <th>Material</th>
                      <th>Cantidad</th>
                      <th>Medida por pieza</th>
                      <th>Total</th>
                      <th>Almacén</th>
                    </tr>
                  </thead>

                  <tbody>

                    {registrosInventario.map((p) => {
                      const existencia = existencias.find(
                        (e) =>
                          String(e.idExistencia) ===
                          String(p.idExistencia)
                      );

                      return (
                        <tr key={p.idPresentacion}>
                          <td>
                            {p.codigo} — {p.material}
                          </td>

                          <td>
                            <strong>
                              {formato(
                                p.cantidadPiezas
                              )}
                            </strong>
                          </td>

                          <td>
                            {descripcionMedida(
                              p,
                              p.unidadMedida
                            )}
                          </td>

                          <td>
                            {formato(
                              calcularTotal(
                                p.unidadMedida,
                                p.cantidadPiezas,
                                p
                              )
                            )}{" "}
                            {simbolo(p.unidadMedida)}
                          </td>

                          <td>
                            {existencia?.almacen || "—"}
                          </td>
                        </tr>
                      );
                    })}

                    {registrosInventario.length === 0 && (
                      <tr>
                        <td
                          colSpan={5}
                          className="text-center text-muted py-4"
                        >
                          Todavía no hay piezas
                          clasificadas en inventario.
                        </td>
                      </tr>
                    )}

                  </tbody>
                </table>
              </div>

            </div>
          </div>

          {/* RESUMEN DE EXISTENCIAS */}

          <div className="card border-0 shadow-sm">
            <div className="card-body">

              <h5 className="mb-3">
                Resumen general de existencias
              </h5>

              <div className="table-responsive">
                <table className="table table-striped align-middle">

                  <thead>
                    <tr>
                      <th>Material</th>
                      <th>Piezas clasificadas</th>
                      <th>Stock total</th>
                      <th>Reservado</th>
                      <th>Disponible</th>
                      <th>Mínimo</th>
                      <th>Acción</th>
                    </tr>
                  </thead>

                  <tbody>
                    {existencias.map((e) => (
                      <tr key={e.idExistencia}>

                        <td>{e.material}</td>

                        <td>
                          {formato(
                            piezasPorExistencia(
                              e.idExistencia
                            )
                          )}
                        </td>

                        <td>
                          {formato(e.stockActual)}{" "}
                          {simbolo(e.unidadMedida)}
                        </td>

                        <td>
                          {formato(e.stockReservado)}{" "}
                          {simbolo(e.unidadMedida)}
                        </td>

                        <td>
                          {formato(e.stockDisponible)}{" "}
                          {simbolo(e.unidadMedida)}
                        </td>

                        <td>
                          {formMinimo?.id ===
                            e.idExistencia ? (
                            <input
                              type="number"
                              min="0"
                              step={
                                e.unidadMedida === "und"
                                  ? "1"
                                  : "0.001"
                              }
                              className="form-control form-control-sm"
                              value={
                                formMinimo.valor
                              }
                              onChange={(ev) =>
                                setFormMinimo((anterior) => ({
                                  ...anterior,
                                  valor: ev.target.value,
                                }))
                              }
                            />
                          ) : (
                            <>
                              {formato(e.stockMinimo)}{" "}
                              {simbolo(e.unidadMedida)}
                            </>
                          )}
                        </td>

                        <td>
                          {formMinimo?.id ===
                            e.idExistencia ? (
                            <div className="d-flex gap-2">
                              <button
                                type="button"
                                className="btn btn-sm btn-success"
                                disabled={guardando}
                                onClick={guardarStockMinimo}
                              >
                                Guardar
                              </button>

                              <button
                                type="button"
                                className="btn btn-sm btn-secondary"
                                onClick={() =>
                                  setFormMinimo(null)
                                }
                              >
                                Cancelar
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-primary"
                              disabled={guardando}
                              onClick={() =>
                                setFormMinimo({
                                  id: e.idExistencia,
                                  valor: String(
                                    e.stockMinimo
                                  ),
                                  unidadMedida:
                                    e.unidadMedida,
                                })
                              }
                            >
                              Cambiar mínimo
                            </button>
                          )}
                        </td>

                      </tr>
                    ))}

                    {existencias.length === 0 && (
                      <tr>
                        <td
                          colSpan={7}
                          className="text-center text-muted"
                        >
                          No existen saldos registrados.
                        </td>
                      </tr>
                    )}

                  </tbody>
                </table>
              </div>

              <p className="small text-muted mb-0">
                Los saldos anteriores que todavía
                no tienen medidas clasificadas se
                conservan en el stock general.
              </p>

            </div>
          </div>

        </>
      )}

      {/* ==================================
          HISTORIAL
      ================================== */}

      {pestana === "historial" && (
        <div className="card border-0 shadow-sm">
          <div className="card-body">

            <h5 className="mb-3">
              Historial de movimientos
            </h5>

            <p className="small text-muted">
              Se muestran los últimos 200 movimientos.
            </p>

            <div className="table-responsive">
              <table className="table table-striped align-middle">

                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Material</th>
                    <th>Tipo</th>
                    <th>Cantidad</th>
                    <th>Medidas</th>
                    <th>Total</th>
                    <th>Usuario</th>
                    <th>Motivo</th>
                    <th>Referencia</th>
                  </tr>
                </thead>

                <tbody>
                  {movimientos.map((m) => (
                    <tr key={m.idMovimientoAlmacen}>

                      <td>
                        {fecha(m.fechaMovimiento)}
                      </td>

                      <td>
                        {m.codigo} — {m.material}
                      </td>

                      <td>
                        {m.tipoMovimiento}
                      </td>

                      <td>
                        {m.cantidadPiezas === null ||
                        m.cantidadPiezas === undefined
                          ? "Sin desglose"
                          : formato(m.cantidadPiezas)}
                      </td>

                      <td>
                        {descripcionMedida(
                          m,
                          m.unidadMedida
                        )}
                      </td>

                      <td>
                        {formato(m.cantidad)}{" "}
                        {simbolo(m.unidadMedida)}
                      </td>

                      <td>
                        {m.idUsuario}
                      </td>

                      <td>
                        {m.motivo}
                      </td>

                      <td>
                        {m.referencia || "—"}
                      </td>

                    </tr>
                  ))}

                  {movimientos.length === 0 && (
                    <tr>
                      <td
                        colSpan={9}
                        className="text-center text-muted"
                      >
                        Todavía no hay movimientos.
                      </td>
                    </tr>
                  )}

                </tbody>
              </table>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
