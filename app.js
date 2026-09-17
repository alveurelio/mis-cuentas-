/* ==========================================================
   app.js — Lógica de la aplicación
   ========================================================== */

/* ---------- Catálogos fijos ---------- */
const SERVICIOS = [
  { id: "corte",      nombre: "Corte",      ic: "✂️" },
  { id: "unas",        nombre: "Uñas",        ic: "💅" },
  { id: "peinado",     nombre: "Peinado",     ic: "💇‍♀️" },
  { id: "maquillaje",  nombre: "Maquillaje",  ic: "💄" },
  { id: "queratina",   nombre: "Queratina",   ic: "✨" },
  { id: "otro_serv",   nombre: "Otro",        ic: "➕" },
];

const FUENTES_EXTERNAS = [
  { id: "esposo",     nombre: "Del esposo",     ic: "🤝" },
  { id: "cobro",      nombre: "Cobro de deuda", ic: "💰" },
  { id: "prestamo",   nombre: "Préstamo hecho", ic: "🏦" },
  { id: "otro_ext",   nombre: "Otro",           ic: "➕" },
];

const CATEGORIAS_GASTO = [
  { id: "casa",         nombre: "Casa",              ic: "🏠" },
  { id: "insumos",      nombre: "Insumos",           ic: "🧴" },
  { id: "proveedores",  nombre: "Proveedores",       ic: "📦" },
  { id: "banco",        nombre: "Deuda bancaria",    ic: "🏛️" },
  { id: "familiar",     nombre: "Préstamo familiar", ic: "👪" },
  { id: "chulco",       nombre: "Chulco",            ic: "⏳" },
  { id: "hijos",        nombre: "Hijos",             ic: "🎈" },
  { id: "otro_gasto",   nombre: "Otro",              ic: "➕" },
];

function buscarEnCatalogo(lista, id) {
  return lista.find(x => x.id === id) || { nombre: id, ic: "•" };
}

/* ---------- Utilidades de fecha y moneda ---------- */
function formatoMoneda(n) {
  const num = Number(n) || 0;
  return "$" + num.toLocaleString("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}

function fechaLegible(iso) {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("es-EC", { day: "numeric", month: "short" });
}

// Devuelve el lunes de la semana de una fecha dada (ISO string)
function lunesDeSemana(iso) {
  const d = new Date(iso + "T12:00:00");
  const dia = d.getDay(); // 0=domingo
  const diff = dia === 0 ? -6 : 1 - dia;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function domingoDeSemana(iso) {
  const lunes = new Date(lunesDeSemana(iso) + "T12:00:00");
  lunes.setDate(lunes.getDate() + 6);
  return lunes.toISOString().slice(0, 10);
}

function primerDiaDelMes(iso) {
  return iso.slice(0, 7) + "-01";
}

function ultimoDiaDelMes(iso) {
  const d = new Date(iso.slice(0,7) + "-01T12:00:00");
  d.setMonth(d.getMonth() + 1);
  d.setDate(0);
  return d.toISOString().slice(0, 10);
}

function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("mostrar");
  clearTimeout(toast._h);
  toast._h = setTimeout(() => t.classList.remove("mostrar"), 2200);
}

/* ---------- Estado en memoria (se recarga de la DB) ---------- */
let ESTADO = {
  movimientos: [],
  deudasPropias: [],
  deudasAjenas: [],
  abonos: [],
  metas: [],
  aportesMeta: [],
};

async function recargarEstado() {
  ESTADO.movimientos   = await dbObtenerTodos("movimientos");
  ESTADO.deudasPropias = await dbObtenerTodos("deudasPropias");
  ESTADO.deudasAjenas  = await dbObtenerTodos("deudasAjenas");
  ESTADO.abonos        = await dbObtenerTodos("abonos");
  ESTADO.metas         = await dbObtenerTodos("metas");
  ESTADO.aportesMeta   = await dbObtenerTodos("aportesMeta");
}

/* ---------- Cálculos de saldo de deudas ---------- */
function saldoDeuda(deuda) {
  const abonosDeuda = ESTADO.abonos.filter(a => a.deudaId === deuda.id);
  const totalAbonado = abonosDeuda.reduce((s, a) => s + a.monto, 0);
  return Math.max(0, deuda.montoInicial - totalAbonado);
}

function totalAbonadoDeuda(deuda) {
  return ESTADO.abonos.filter(a => a.deudaId === deuda.id).reduce((s, a) => s + a.monto, 0);
}

/* ==========================================================
   NAVEGACIÓN ENTRE PANTALLAS
   ========================================================== */
const NOMBRES_PANTALLA = {
  inicio: "Inicio",
  deudas: "Deudas",
  analisis: "Análisis",
  meta: "Meta de ahorro",
  historial: "Historial",
};

function irAPantalla(nombre) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("activa"));
  document.getElementById("screen-" + nombre).classList.add("activa");
  document.querySelectorAll(".tab").forEach(b => b.classList.toggle("activo", b.dataset.tab === nombre));
  document.getElementById("tituloPantalla").textContent = NOMBRES_PANTALLA[nombre];
  renderizarPantalla(nombre);
  window.scrollTo(0, 0);
}

function renderizarPantalla(nombre) {
  if (nombre === "inicio") renderInicio();
  if (nombre === "deudas") renderDeudas();
  if (nombre === "analisis") renderAnalisis();
  if (nombre === "meta") renderMeta();
  if (nombre === "historial") renderHistorial();
}

function refrescarTodo() {
  const activa = document.querySelector(".screen.activa").id.replace("screen-", "");
  renderizarPantalla(activa);
}

/* ==========================================================
   PANTALLA: INICIO (resumen semanal)
   ========================================================== */
function renderInicio() {
  const cont = document.getElementById("screen-inicio");
  const hoy = hoyISO();
  const inicioSemana = lunesDeSemana(hoy);
  const finSemana = domingoDeSemana(hoy);

  const movSemana = ESTADO.movimientos.filter(m => m.fecha >= inicioSemana && m.fecha <= finSemana);
  const ingresos = movSemana.filter(m => m.tipo === "ingreso").reduce((s, m) => s + m.monto, 0);
  const gastos = movSemana.filter(m => m.tipo === "gasto").reduce((s, m) => s + m.monto, 0);
  const saldo = ingresos - gastos;

  const deudaTotalPropia = ESTADO.deudasPropias.reduce((s, d) => s + saldoDeuda(d), 0);
  const deudaTotalAjena = ESTADO.deudasAjenas.reduce((s, d) => s + saldoDeuda(d), 0);

  const ultimosMov = [...ESTADO.movimientos].sort((a, b) => b.id - a.id).slice(0, 5);

  cont.innerHTML = `
    <div class="card" style="background:linear-gradient(135deg, var(--rose), var(--rose-dark)); color:#fff;">
      <div class="muted" style="color:rgba(255,255,255,0.85); font-weight:700; font-size:12px; margin-bottom:4px;">
        Semana del ${fechaLegible(inicioSemana)} al ${fechaLegible(finSemana)}
      </div>
      <div style="font-size:34px; font-weight:800; margin:4px 0;">${formatoMoneda(saldo)}</div>
      <div class="muted" style="color:rgba(255,255,255,0.85); font-size:13px;">
        ${saldo >= 0 ? "Te queda esto esta semana" : "Gastaste más de lo que entró"}
      </div>
      <div class="fila" style="margin-top:16px; gap:10px;">
        <div style="flex:1; background:rgba(255,255,255,0.18); border-radius:12px; padding:10px 12px;">
          <div class="muted" style="color:rgba(255,255,255,0.85); font-size:11px;">Entró</div>
          <div style="font-weight:800; font-size:16px;">${formatoMoneda(ingresos)}</div>
        </div>
        <div style="flex:1; background:rgba(255,255,255,0.18); border-radius:12px; padding:10px 12px;">
          <div class="muted" style="color:rgba(255,255,255,0.85); font-size:11px;">Salió</div>
          <div style="font-weight:800; font-size:16px;">${formatoMoneda(gastos)}</div>
        </div>
      </div>
    </div>

    <div class="card">
      <h2>Lo que debes en total</h2>
      <div class="fila" style="padding:6px 0;">
        <span class="muted">Tú debes</span>
        <span class="monto-gasto">${formatoMoneda(deudaTotalPropia)}</span>
      </div>
      <div class="fila" style="padding:6px 0;">
        <span class="muted">A ti te deben</span>
        <span class="monto-ingreso">${formatoMoneda(deudaTotalAjena)}</span>
      </div>
    </div>

    <div class="card">
      <div class="fila" style="margin-bottom:10px;">
        <h2 style="margin:0;">Últimos movimientos</h2>
        <button class="btn-ghost" style="width:auto; padding:4px 0;" onclick="irAPantalla('historial')">Ver todo</button>
      </div>
      ${ultimosMov.length === 0 ? `
        <div class="vacio">
          <span class="ic">🧾</span>
          Aún no hay registros.<br>Toca el botón + para anotar el primero.
        </div>
      ` : ultimosMov.map(filaMovimientoHTML).join("")}
    </div>
  `;
}

function filaMovimientoHTML(m) {
  const cat = m.tipo === "ingreso"
    ? (m.fuente === "negocio" ? buscarEnCatalogo(SERVICIOS, m.detalle) : buscarEnCatalogo(FUENTES_EXTERNAS, m.detalle))
    : buscarEnCatalogo(CATEGORIAS_GASTO, m.detalle);
  return `
    <div class="fila" style="padding:10px 0; border-top:1px solid var(--line);">
      <div style="display:flex; align-items:center; gap:10px;">
        <span style="font-size:20px;">${cat.ic}</span>
        <div>
          <div style="font-weight:700; font-size:14px;">${cat.nombre}</div>
          <div class="muted" style="font-size:12px;">${fechaLegible(m.fecha)}${m.nota ? " · " + escaparHTML(m.nota) : ""}</div>
        </div>
      </div>
      <span class="${m.tipo === 'ingreso' ? 'monto-ingreso' : 'monto-gasto'}">
        ${m.tipo === 'ingreso' ? '+' : '−'}${formatoMoneda(m.monto)}
      </span>
    </div>
  `;
}

function escaparHTML(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

/* ==========================================================
   MODAL: REGISTRAR MOVIMIENTO
   ========================================================== */
let registroTemp = { tipo: "ingreso", fuente: "negocio", detalle: null };

function abrirModalRegistro() {
  registroTemp = { tipo: "ingreso", fuente: "negocio", detalle: null };
  const overlay = crearOverlay("modalRegistro", renderContenidoRegistro());
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add("activo"));
}

function renderContenidoRegistro() {
  return `
    <div class="asa"></div>
    <h2>Nuevo registro</h2>

    <div class="segmentado ${registroTemp.tipo === 'gasto' ? 'gasto' : ''}" id="segTipo">
      <button type="button" class="${registroTemp.tipo === 'ingreso' ? 'sel' : ''}" onclick="cambiarTipoRegistro('ingreso')">Ingreso</button>
      <button type="button" class="${registroTemp.tipo === 'gasto' ? 'sel' : ''}" onclick="cambiarTipoRegistro('gasto')">Gasto</button>
    </div>

    <div id="zonaFuenteDetalle">${renderZonaFuenteDetalle()}</div>

    <label class="campo">
      <span>¿Cuánto?</span>
      <input type="number" inputmode="decimal" id="inpMonto" placeholder="0.00" step="0.01" min="0">
    </label>

    <label class="campo">
      <span>Nota (opcional)</span>
      <textarea id="inpNota" rows="2" placeholder="Ej: el cliente me debe la mitad"></textarea>
    </label>

    <label class="campo">
      <span>Fecha</span>
      <input type="date" id="inpFecha" value="${hoyISO()}">
    </label>

    <button class="btn btn-primary" onclick="guardarRegistro()">Guardar</button>
    <button class="btn btn-ghost" onclick="cerrarOverlay('modalRegistro')">Cancelar</button>
  `;
}

function renderZonaFuenteDetalle() {
  if (registroTemp.tipo === "gasto") {
    return `
      <label class="campo">
        <span>¿En qué se gastó?</span>
        <div class="scroller">
          ${CATEGORIAS_GASTO.map(c => chipHTML(c, registroTemp.detalle === c.id, `seleccionarDetalle('${c.id}')`)).join("")}
        </div>
      </label>
    `;
  }
  // Ingreso: primero fuente (negocio / externo)
  let html = `
    <label class="campo">
      <span>¿De dónde vino?</span>
      <div class="scroller">
        ${chipHTML({id:"negocio", nombre:"Negocio", ic:"💇‍♀️"}, registroTemp.fuente === "negocio", "seleccionarFuente('negocio')")}
        ${chipHTML({id:"externo", nombre:"Externo", ic:"🌐"}, registroTemp.fuente === "externo", "seleccionarFuente('externo')")}
      </div>
    </label>
  `;
  if (registroTemp.fuente === "negocio") {
    html += `
      <label class="campo">
        <span>¿Qué servicio?</span>
        <div class="scroller">
          ${SERVICIOS.map(c => chipHTML(c, registroTemp.detalle === c.id, `seleccionarDetalle('${c.id}')`)).join("")}
        </div>
      </label>
    `;
  } else {
    html += `
      <label class="campo">
        <span>¿Qué tipo?</span>
        <div class="scroller">
          ${FUENTES_EXTERNAS.map(c => chipHTML(c, registroTemp.detalle === c.id, `seleccionarDetalle('${c.id}')`)).join("")}
        </div>
      </label>
    `;
  }
  return html;
}

function chipHTML(c, seleccionado, onclick) {
  return `<button type="button" class="chip ${seleccionado ? 'sel' : ''}" onclick="${onclick}">
    <span class="ic">${c.ic}</span>${c.nombre}
  </button>`;
}

function cambiarTipoRegistro(tipo) {
  registroTemp.tipo = tipo;
  registroTemp.detalle = null;
  if (tipo === "ingreso") registroTemp.fuente = "negocio";
  actualizarModalRegistro();
}

function seleccionarFuente(fuente) {
  registroTemp.fuente = fuente;
  registroTemp.detalle = null;
  actualizarModalRegistro();
}

function seleccionarDetalle(id) {
  registroTemp.detalle = id;
  actualizarModalRegistro();
}

function actualizarModalRegistro() {
  const hoja = document.querySelector("#modalRegistro .hoja");
  const montoPrevio = document.getElementById("inpMonto")?.value || "";
  const notaPrevia = document.getElementById("inpNota")?.value || "";
  const fechaPrevia = document.getElementById("inpFecha")?.value || hoyISO();
  hoja.innerHTML = renderContenidoRegistro();
  document.getElementById("inpMonto").value = montoPrevio;
  document.getElementById("inpNota").value = notaPrevia;
  document.getElementById("inpFecha").value = fechaPrevia;
}

async function guardarRegistro() {
  const monto = parseFloat(document.getElementById("inpMonto").value);
  const nota = document.getElementById("inpNota").value.trim();
  const fecha = document.getElementById("inpFecha").value || hoyISO();

  if (!monto || monto <= 0) { toast("Escribe cuánto fue"); return; }
  if (!registroTemp.detalle) { toast("Elige una categoría"); return; }

  const mov = {
    tipo: registroTemp.tipo,
    fuente: registroTemp.tipo === "ingreso" ? registroTemp.fuente : null,
    detalle: registroTemp.detalle,
    monto: monto,
    nota: nota,
    fecha: fecha,
  };
  await dbAgregar("movimientos", mov);
  await recargarEstado();
  cerrarOverlay("modalRegistro");
  toast(registroTemp.tipo === "ingreso" ? "Ingreso guardado ✅" : "Gasto guardado ✅");
  refrescarTodo();
}

/* ==========================================================
   OVERLAYS / HOJAS INFERIORES (genérico)
   ========================================================== */
function crearOverlay(id, contenidoHTML) {
  let existente = document.getElementById(id);
  if (existente) existente.remove();
  const overlay = document.createElement("div");
  overlay.className = "overlay";
  overlay.id = id;
  overlay.innerHTML = `<div class="hoja">${contenidoHTML}</div>`;
  overlay.addEventListener("click", (e) => { if (e.target === overlay) cerrarOverlay(id); });
  return overlay;
}

function cerrarOverlay(id) {
  const overlay = document.getElementById(id);
  if (!overlay) return;
  overlay.classList.remove("activo");
  setTimeout(() => overlay.remove(), 200);
}

/* ==========================================================
   PANTALLA: DEUDAS
   ========================================================== */
let vistaDeudas = "propias"; // 'propias' o 'ajenas'

function renderDeudas() {
  const cont = document.getElementById("screen-deudas");
  const lista = vistaDeudas === "propias" ? ESTADO.deudasPropias : ESTADO.deudasAjenas;

  cont.innerHTML = `
    <div class="segmentado" id="segDeudas">
      <button type="button" class="${vistaDeudas === 'propias' ? 'sel' : ''}" onclick="cambiarVistaDeudas('propias')">Yo debo</button>
      <button type="button" class="${vistaDeudas === 'ajenas' ? 'sel' : ''}" onclick="cambiarVistaDeudas('ajenas')">Me deben</button>
    </div>

    <button class="btn btn-secondary" style="margin-bottom:14px;" onclick="abrirModalNuevaDeuda()">
      + ${vistaDeudas === 'propias' ? 'Agregar deuda' : 'Agregar quién me debe'}
    </button>

    ${lista.length === 0 ? `
      <div class="vacio">
        <span class="ic">${vistaDeudas === 'propias' ? '🧾' : '🤝'}</span>
        ${vistaDeudas === 'propias' ? 'No tienes deudas registradas.' : 'Nadie te debe por ahora.'}
      </div>
    ` : lista
        .slice()
        .sort((a,b) => saldoDeuda(b) - saldoDeuda(a))
        .map(d => tarjetaDeudaHTML(d)).join("")}
  `;
}

function cambiarVistaDeudas(v) {
  vistaDeudas = v;
  renderDeudas();
}

function tarjetaDeudaHTML(d) {
  const saldo = saldoDeuda(d);
  const pagado = totalAbonadoDeuda(d);
  const pct = d.montoInicial > 0 ? Math.min(100, Math.round((pagado / d.montoInicial) * 100)) : 100;
  const saldada = saldo <= 0;
  return `
    <div class="card">
      <div class="fila">
        <div>
          <div style="font-weight:800; font-size:15px;">${escaparHTML(d.nombre)}</div>
          <div class="muted" style="font-size:12px;">${d.categoria ? buscarEnCatalogo(CATEGORIAS_GASTO, d.categoria).nombre + " · " : ""}Desde ${fechaLegible(d.fecha)}</div>
        </div>
        <div style="text-align:right;">
          <div style="font-weight:800; font-size:17px; color:${saldada ? 'var(--sage)' : 'var(--danger)'};">
            ${saldada ? "Saldada ✅" : formatoMoneda(saldo)}
          </div>
          <div class="muted" style="font-size:11px;">de ${formatoMoneda(d.montoInicial)}</div>
        </div>
      </div>
      <div class="barra-fondo" style="height:14px; margin:10px 0 8px;">
        <div class="barra-rellena" style="width:${pct}%; min-width:0;"></div>
      </div>
      ${d.nota ? `<div class="muted" style="font-size:12.5px; margin-bottom:8px;">${escaparHTML(d.nota)}</div>` : ""}
      <div class="fila" style="gap:8px;">
        ${!saldada ? `<button class="btn btn-primary" style="flex:1; padding:10px;" onclick="abrirModalAbono(${d.id})">Registrar abono</button>` : ""}
        <button class="btn btn-ghost" style="flex:0 0 auto; width:auto; padding:10px 12px;" onclick="abrirModalEditarDeuda(${d.id})">✏️</button>
        <button class="btn btn-ghost" style="flex:0 0 auto; width:auto; padding:10px 12px; color:var(--danger);" onclick="confirmarBorrarDeuda(${d.id})">🗑️</button>
      </div>
    </div>
  `;
}

/* ---- Nueva deuda ---- */
function abrirModalNuevaDeuda() {
  const esPropia = vistaDeudas === "propias";
  const overlay = crearOverlay("modalDeuda", `
    <div class="asa"></div>
    <h2>${esPropia ? "Nueva deuda" : "Nueva persona que me debe"}</h2>
    <label class="campo">
      <span>${esPropia ? "¿A quién le debes?" : "¿Quién te debe?"}</span>
      <input type="text" id="inpNombreDeuda" placeholder="${esPropia ? 'Ej: Distribuidora Pérez' : 'Ej: María, la vecina'}">
    </label>
    ${esPropia ? `
      <label class="campo">
        <span>Categoría</span>
        <div class="scroller" id="scrollerCatDeuda">
          ${CATEGORIAS_GASTO.filter(c => ["proveedores","banco","familiar","chulco","otro_gasto"].includes(c.id))
            .map(c => chipHTML(c, false, `seleccionarCategoriaDeuda('${c.id}')`)).join("")}
        </div>
      </label>
    ` : ""}
    <label class="campo">
      <span>¿Cuánto ${esPropia ? 'debes' : 'te debe'} en total?</span>
      <input type="number" inputmode="decimal" id="inpMontoDeuda" placeholder="0.00" step="0.01" min="0">
    </label>
    <label class="campo">
      <span>Nota (opcional)</span>
      <textarea id="inpNotaDeuda" rows="2" placeholder="Detalle adicional"></textarea>
    </label>
    <button class="btn btn-primary" onclick="guardarNuevaDeuda()">Guardar</button>
    <button class="btn btn-ghost" onclick="cerrarOverlay('modalDeuda')">Cancelar</button>
  `);
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add("activo"));
  window._categoriaDeudaTemp = null;
}

function seleccionarCategoriaDeuda(id) {
  window._categoriaDeudaTemp = id;
  document.querySelectorAll("#scrollerCatDeuda .chip").forEach(el => el.classList.remove("sel"));
  event.currentTarget.classList.add("sel");
}

async function guardarNuevaDeuda() {
  const nombre = document.getElementById("inpNombreDeuda").value.trim();
  const monto = parseFloat(document.getElementById("inpMontoDeuda").value);
  const nota = document.getElementById("inpNotaDeuda").value.trim();

  if (!nombre) { toast("Escribe el nombre"); return; }
  if (!monto || monto <= 0) { toast("Escribe el monto"); return; }

  const obj = {
    nombre, montoInicial: monto, nota,
    fecha: hoyISO(),
    categoria: window._categoriaDeudaTemp || null,
  };
  const store = vistaDeudas === "propias" ? "deudasPropias" : "deudasAjenas";
  await dbAgregar(store, obj);
  await recargarEstado();
  cerrarOverlay("modalDeuda");
  toast("Guardado ✅");
  renderDeudas();
}

/* ---- Editar deuda ---- */
function abrirModalEditarDeuda(id) {
  const store = vistaDeudas === "propias" ? "deudasPropias" : "deudasAjenas";
  const d = ESTADO[store].find(x => x.id === id);
  if (!d) return;
  const overlay = crearOverlay("modalEditarDeuda", `
    <div class="asa"></div>
    <h2>Editar</h2>
    <label class="campo">
      <span>Nombre</span>
      <input type="text" id="editNombre" value="${escaparHTML(d.nombre)}">
    </label>
    <label class="campo">
      <span>Monto total (original)</span>
      <input type="number" inputmode="decimal" id="editMonto" value="${d.montoInicial}" step="0.01" min="0">
    </label>
    <label class="campo">
      <span>Nota</span>
      <textarea id="editNota" rows="2">${escaparHTML(d.nota || "")}</textarea>
    </label>
    <button class="btn btn-primary" onclick="guardarEdicionDeuda(${id})">Guardar cambios</button>
    <button class="btn btn-ghost" onclick="cerrarOverlay('modalEditarDeuda')">Cancelar</button>
  `);
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add("activo"));
}

async function guardarEdicionDeuda(id) {
  const store = vistaDeudas === "propias" ? "deudasPropias" : "deudasAjenas";
  const d = ESTADO[store].find(x => x.id === id);
  d.nombre = document.getElementById("editNombre").value.trim();
  d.montoInicial = parseFloat(document.getElementById("editMonto").value) || d.montoInicial;
  d.nota = document.getElementById("editNota").value.trim();
  await dbActualizar(store, d);
  await recargarEstado();
  cerrarOverlay("modalEditarDeuda");
  toast("Actualizado ✅");
  renderDeudas();
}

async function confirmarBorrarDeuda(id) {
  const store = vistaDeudas === "propias" ? "deudasPropias" : "deudasAjenas";
  const overlay = crearOverlay("modalConfirmarBorrar", `
    <div class="asa"></div>
    <h2>¿Borrar este registro?</h2>
    <p class="muted">Esto también borrará los abonos hechos a esta deuda. No se puede deshacer.</p>
    <button class="btn btn-danger" onclick="borrarDeudaConfirmado(${id})">Sí, borrar</button>
    <button class="btn btn-ghost" onclick="cerrarOverlay('modalConfirmarBorrar')">Cancelar</button>
  `);
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add("activo"));
}

async function borrarDeudaConfirmado(id) {
  const store = vistaDeudas === "propias" ? "deudasPropias" : "deudasAjenas";
  const abonosDeuda = ESTADO.abonos.filter(a => a.deudaId === id);
  for (const a of abonosDeuda) await dbEliminar("abonos", a.id);
  await dbEliminar(store, id);
  await recargarEstado();
  cerrarOverlay("modalConfirmarBorrar");
  toast("Borrado");
  renderDeudas();
}

/* ---- Abonos ---- */
function abrirModalAbono(deudaId) {
  const overlay = crearOverlay("modalAbono", `
    <div class="asa"></div>
    <h2>Registrar abono</h2>
    <label class="campo">
      <span>¿Cuánto ${vistaDeudas === 'propias' ? 'pagaste' : 'te pagaron'}?</span>
      <input type="number" inputmode="decimal" id="inpMontoAbono" placeholder="0.00" step="0.01" min="0">
    </label>
    <label class="campo">
      <span>Fecha</span>
      <input type="date" id="inpFechaAbono" value="${hoyISO()}">
    </label>
    <button class="btn btn-primary" onclick="guardarAbono(${deudaId})">Guardar abono</button>
    <button class="btn btn-ghost" onclick="cerrarOverlay('modalAbono')">Cancelar</button>
  `);
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add("activo"));
}

async function guardarAbono(deudaId) {
  const monto = parseFloat(document.getElementById("inpMontoAbono").value);
  const fecha = document.getElementById("inpFechaAbono").value || hoyISO();
  if (!monto || monto <= 0) { toast("Escribe cuánto fue"); return; }

  await dbAgregar("abonos", { deudaId, monto, fecha });
  await recargarEstado();
  cerrarOverlay("modalAbono");
  toast("Abono guardado ✅");
  renderDeudas();
}

/* ==========================================================
   PANTALLA: ANÁLISIS (gráficos de pastel en SVG)
   ========================================================== */
let periodoAnalisis = "semana"; // semana | semanaAnterior | mes | mesAnterior

function rangoPeriodo(tipo) {
  const hoy = hoyISO();
  if (tipo === "semana") return [lunesDeSemana(hoy), domingoDeSemana(hoy)];
  if (tipo === "semanaAnterior") {
    const lunesAnt = new Date(lunesDeSemana(hoy) + "T12:00:00");
    lunesAnt.setDate(lunesAnt.getDate() - 7);
    const iso = lunesAnt.toISOString().slice(0,10);
    return [lunesDeSemana(iso), domingoDeSemana(iso)];
  }
  if (tipo === "mes") return [primerDiaDelMes(hoy), ultimoDiaDelMes(hoy)];
  if (tipo === "mesAnterior") {
    const d = new Date(primerDiaDelMes(hoy) + "T12:00:00");
    d.setDate(d.getDate() - 1);
    const iso = d.toISOString().slice(0,10);
    return [primerDiaDelMes(iso), ultimoDiaDelMes(iso)];
  }
  return [lunesDeSemana(hoy), domingoDeSemana(hoy)];
}

const PALETA = ["#B85C6B","#C9A15A","#5C7A6E","#8F4353","#DCE8E2".replace("#DCE8E2","#A9BDB4"),"#E0A899","#7A6F68","#D9C2A6"];

function renderAnalisis() {
  const cont = document.getElementById("screen-analisis");
  const [desde, hasta] = rangoPeriodo(periodoAnalisis);
  const movs = ESTADO.movimientos.filter(m => m.fecha >= desde && m.fecha <= hasta);

  const ingresos = movs.filter(m => m.tipo === "ingreso");
  const gastos = movs.filter(m => m.tipo === "gasto");
  const totalIngresos = ingresos.reduce((s,m) => s+m.monto, 0);
  const totalGastos = gastos.reduce((s,m) => s+m.monto, 0);

  cont.innerHTML = `
    <label class="campo">
      <span>Periodo</span>
      <select id="selPeriodo" onchange="cambiarPeriodoAnalisis(this.value)">
        <option value="semana" ${periodoAnalisis==='semana'?'selected':''}>Esta semana</option>
        <option value="semanaAnterior" ${periodoAnalisis==='semanaAnterior'?'selected':''}>Semana anterior</option>
        <option value="mes" ${periodoAnalisis==='mes'?'selected':''}>Este mes</option>
        <option value="mesAnterior" ${periodoAnalisis==='mesAnterior'?'selected':''}>Mes anterior</option>
      </select>
    </label>

    <div class="card">
      <div class="fila" style="padding:4px 0;"><span class="muted">Ingresos</span><span class="monto-ingreso">${formatoMoneda(totalIngresos)}</span></div>
      <div class="fila" style="padding:4px 0;"><span class="muted">Gastos</span><span class="monto-gasto">${formatoMoneda(totalGastos)}</span></div>
      <div class="fila" style="padding:4px 0; border-top:1px solid var(--line); margin-top:4px; padding-top:10px;">
        <span style="font-weight:800;">Saldo</span>
        <span style="font-weight:800;">${formatoMoneda(totalIngresos - totalGastos)}</span>
      </div>
    </div>

    <div class="card">
      <h2>¿De dónde viene tu dinero?</h2>
      ${renderGraficoPastel(agruparIngresos(ingresos), totalIngresos)}
    </div>

    <div class="card">
      <h2>¿En qué se está yendo?</h2>
      ${renderGraficoPastel(agruparGastos(gastos), totalGastos)}
    </div>
  `;
}

function cambiarPeriodoAnalisis(v) {
  periodoAnalisis = v;
  renderAnalisis();
}

function agruparIngresos(ingresos) {
  const grupos = {};
  ingresos.forEach(m => {
    let etiqueta, ic;
    if (m.fuente === "negocio") {
      const s = buscarEnCatalogo(SERVICIOS, m.detalle);
      etiqueta = s.nombre; ic = s.ic;
    } else {
      const s = buscarEnCatalogo(FUENTES_EXTERNAS, m.detalle);
      etiqueta = s.nombre; ic = s.ic;
    }
    if (!grupos[etiqueta]) grupos[etiqueta] = { etiqueta, ic, total: 0 };
    grupos[etiqueta].total += m.monto;
  });
  return Object.values(grupos).sort((a,b) => b.total - a.total);
}

function agruparGastos(gastos) {
  const grupos = {};
  gastos.forEach(m => {
    const c = buscarEnCatalogo(CATEGORIAS_GASTO, m.detalle);
    if (!grupos[c.nombre]) grupos[c.nombre] = { etiqueta: c.nombre, ic: c.ic, total: 0 };
    grupos[c.nombre].total += m.monto;
  });
  return Object.values(grupos).sort((a,b) => b.total - a.total);
}

// Agrupa categorías pequeñas (<6%) en "Otros" para no saturar el gráfico
function simplificarGrupos(grupos, total) {
  if (total <= 0 || grupos.length <= 6) return grupos;
  const grandes = grupos.filter(g => g.total / total >= 0.06);
  const pequenos = grupos.filter(g => g.total / total < 0.06);
  if (pequenos.length > 0) {
    const sumaPeq = pequenos.reduce((s,g) => s+g.total, 0);
    grandes.push({ etiqueta: "Otros", ic: "➕", total: sumaPeq });
  }
  return grandes;
}

function renderGraficoPastel(grupos, total) {
  if (total <= 0 || grupos.length === 0) {
    return `<div class="vacio"><span class="ic">📭</span>No hay datos suficientes en este periodo.</div>`;
  }
  const grupoFinal = simplificarGrupos(grupos, total);

  let acumulado = 0;
  const R = 60, CX = 70, CY = 70;
  const arcos = grupoFinal.map((g, i) => {
    const inicioAngulo = (acumulado / total) * 360;
    acumulado += g.total;
    const finAngulo = (acumulado / total) * 360;
    const path = describirArco(CX, CY, R, inicioAngulo, finAngulo);
    return `<path d="${path}" fill="${PALETA[i % PALETA.length]}" stroke="var(--paper)" stroke-width="2"
              onclick="mostrarDetalleSegmento('${escaparHTML(g.etiqueta)}', ${g.total}, ${total})"></path>`;
  }).join("");

  const leyenda = grupoFinal.map((g, i) => {
    const pct = Math.round((g.total/total)*100);
    return `
      <div class="fila" style="padding:6px 0; cursor:pointer;" onclick="mostrarDetalleSegmento('${escaparHTML(g.etiqueta)}', ${g.total}, ${total})">
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="width:12px; height:12px; border-radius:3px; background:${PALETA[i % PALETA.length]}; display:inline-block;"></span>
          <span style="font-size:13.5px;">${g.ic} ${escaparHTML(g.etiqueta)}</span>
        </div>
        <span style="font-size:13px; font-weight:700;">${formatoMoneda(g.total)} · ${pct}%</span>
      </div>
    `;
  }).join("");

  return `
    <div style="display:flex; justify-content:center; margin-bottom:10px;">
      <svg width="140" height="140" viewBox="0 0 140 140">${arcos}</svg>
    </div>
    <div>${leyenda}</div>
  `;
}

function describirArco(cx, cy, r, anguloInicio, anguloFin) {
  if (anguloFin - anguloInicio >= 359.999) {
    // círculo completo (una sola categoría)
    return `M ${cx-r},${cy} a ${r},${r} 0 1,0 ${r*2},0 a ${r},${r} 0 1,0 ${-r*2},0`;
  }
  const puntoInicio = puntoEnCirculo(cx, cy, r, anguloInicio);
  const puntoFin = puntoEnCirculo(cx, cy, r, anguloFin);
  const grandeArco = anguloFin - anguloInicio > 180 ? 1 : 0;
  return `M ${cx},${cy} L ${puntoInicio.x},${puntoInicio.y} A ${r},${r} 0 ${grandeArco} 1 ${puntoFin.x},${puntoFin.y} Z`;
}

function puntoEnCirculo(cx, cy, r, angulo) {
  const rad = (angulo - 90) * Math.PI / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function mostrarDetalleSegmento(etiqueta, monto, total) {
  const pct = Math.round((monto/total)*100);
  toast(`${etiqueta}: ${formatoMoneda(monto)} (${pct}%)`);
}

/* ==========================================================
   PANTALLA: META DE AHORRO
   ========================================================== */
function renderMeta() {
  const cont = document.getElementById("screen-meta");
  const meta = ESTADO.metas[0]; // manejamos una meta activa a la vez

  if (!meta) {
    cont.innerHTML = `
      <div class="card">
        <div class="vacio">
          <span class="ic">🎯</span>
          Aún no has puesto una meta de ahorro.
        </div>
        <button class="btn btn-primary" onclick="abrirModalNuevaMeta()">Crear meta de ahorro</button>
      </div>
    `;
    return;
  }

  const aportes = ESTADO.aportesMeta.filter(a => a.metaId === meta.id);
  const ahorrado = aportes.reduce((s,a) => s+a.monto, 0);
  const pct = meta.monto > 0 ? Math.min(100, Math.round((ahorrado / meta.monto) * 100)) : 0;
  const cumplida = ahorrado >= meta.monto;

  cont.innerHTML = `
    <div class="card">
      <h2 style="margin-bottom:4px;">${escaparHTML(meta.nombre)}</h2>
      <div class="muted" style="margin-bottom:14px;">Meta: ${formatoMoneda(meta.monto)}</div>

      <div class="barra-fondo">
        <div class="barra-rellena" style="width:${pct}%;"></div>
      </div>
      <div class="fila" style="margin-top:6px;">
        <span style="font-weight:800; color:var(--sage);">${formatoMoneda(ahorrado)} ahorrado</span>
        <span class="muted">${pct}%</span>
      </div>

      ${cumplida ? `<div style="text-align:center; margin-top:16px; font-weight:800; color:var(--sage);">🎉 ¡Meta cumplida!</div>` : ""}

      <button class="btn btn-primary" style="margin-top:16px;" onclick="abrirModalAporteMeta(${meta.id})">+ Guardé dinero en la alcancía</button>
      <button class="btn btn-ghost" onclick="confirmarEditarMeta(${meta.id})">Editar meta</button>
    </div>

    <div class="card">
      <h2>Historial de aportes</h2>
      ${aportes.length === 0 ? `<div class="muted">Todavía no has registrado ningún aporte.</div>` :
        aportes.slice().sort((a,b) => b.id - a.id).map(a => `
          <div class="fila" style="padding:8px 0; border-top:1px solid var(--line);">
            <span class="muted">${fechaLegible(a.fecha)}</span>
            <span class="monto-ingreso">+${formatoMoneda(a.monto)}</span>
          </div>
        `).join("")}
    </div>
  `;
}

function abrirModalNuevaMeta() {
  const overlay = crearOverlay("modalMeta", `
    <div class="asa"></div>
    <h2>Nueva meta de ahorro</h2>
    <label class="campo">
      <span>¿Para qué estás ahorrando?</span>
      <input type="text" id="inpNombreMeta" placeholder="Ej: Pagar deuda del banco">
    </label>
    <label class="campo">
      <span>¿Cuánto quieres ahorrar en total?</span>
      <input type="number" inputmode="decimal" id="inpMontoMeta" placeholder="0.00" step="0.01" min="0">
    </label>
    <button class="btn btn-primary" onclick="guardarNuevaMeta()">Crear meta</button>
    <button class="btn btn-ghost" onclick="cerrarOverlay('modalMeta')">Cancelar</button>
  `);
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add("activo"));
}

async function guardarNuevaMeta() {
  const nombre = document.getElementById("inpNombreMeta").value.trim();
  const monto = parseFloat(document.getElementById("inpMontoMeta").value);
  if (!nombre) { toast("Escribe el nombre de la meta"); return; }
  if (!monto || monto <= 0) { toast("Escribe el monto de la meta"); return; }

  await dbAgregar("metas", { nombre, monto, fecha: hoyISO() });
  await recargarEstado();
  cerrarOverlay("modalMeta");
  toast("Meta creada ✅");
  renderMeta();
}

function abrirModalAporteMeta(metaId) {
  const overlay = crearOverlay("modalAporteMeta", `
    <div class="asa"></div>
    <h2>Registrar ahorro</h2>
    <label class="campo">
      <span>¿Cuánto guardaste?</span>
      <input type="number" inputmode="decimal" id="inpMontoAporte" placeholder="0.00" step="0.01" min="0">
    </label>
    <label class="campo">
      <span>Fecha</span>
      <input type="date" id="inpFechaAporte" value="${hoyISO()}">
    </label>
    <button class="btn btn-primary" onclick="guardarAporteMeta(${metaId})">Guardar</button>
    <button class="btn btn-ghost" onclick="cerrarOverlay('modalAporteMeta')">Cancelar</button>
  `);
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add("activo"));
}

async function guardarAporteMeta(metaId) {
  const monto = parseFloat(document.getElementById("inpMontoAporte").value);
  const fecha = document.getElementById("inpFechaAporte").value || hoyISO();
  if (!monto || monto <= 0) { toast("Escribe cuánto guardaste"); return; }

  await dbAgregar("aportesMeta", { metaId, monto, fecha });
  await recargarEstado();
  cerrarOverlay("modalAporteMeta");
  toast("Ahorro registrado ✅");
  renderMeta();
}

function confirmarEditarMeta(metaId) {
  const meta = ESTADO.metas.find(m => m.id === metaId);
  const overlay = crearOverlay("modalEditarMeta", `
    <div class="asa"></div>
    <h2>Editar meta</h2>
    <label class="campo">
      <span>Nombre</span>
      <input type="text" id="editNombreMeta" value="${escaparHTML(meta.nombre)}">
    </label>
    <label class="campo">
      <span>Monto objetivo</span>
      <input type="number" inputmode="decimal" id="editMontoMeta" value="${meta.monto}" step="0.01" min="0">
    </label>
    <button class="btn btn-primary" onclick="guardarEdicionMeta(${metaId})">Guardar</button>
    <button class="btn btn-ghost" onclick="cerrarOverlay('modalEditarMeta')">Cancelar</button>
  `);
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add("activo"));
}

async function guardarEdicionMeta(metaId) {
  const meta = ESTADO.metas.find(m => m.id === metaId);
  meta.nombre = document.getElementById("editNombreMeta").value.trim();
  meta.monto = parseFloat(document.getElementById("editMontoMeta").value) || meta.monto;
  await dbActualizar("metas", meta);
  await recargarEstado();
  cerrarOverlay("modalEditarMeta");
  toast("Meta actualizada ✅");
  renderMeta();
}

/* ==========================================================
   PANTALLA: HISTORIAL COMPLETO
   ========================================================== */
function renderHistorial() {
  const cont = document.getElementById("screen-historial");
  const movs = [...ESTADO.movimientos].sort((a,b) => b.fecha.localeCompare(a.fecha) || b.id - a.id);

  if (movs.length === 0) {
    cont.innerHTML = `<div class="card"><div class="vacio"><span class="ic">📒</span>Aún no hay movimientos registrados.</div></div>`;
    return;
  }

  // Agrupar por fecha
  const porFecha = {};
  movs.forEach(m => {
    if (!porFecha[m.fecha]) porFecha[m.fecha] = [];
    porFecha[m.fecha].push(m);
  });

  cont.innerHTML = Object.keys(porFecha).map(fecha => `
    <div class="card">
      <h2>${fechaLegible(fecha)}</h2>
      ${porFecha[fecha].map(m => filaHistorialHTML(m)).join("")}
    </div>
  `).join("");
}

function filaHistorialHTML(m) {
  const cat = m.tipo === "ingreso"
    ? (m.fuente === "negocio" ? buscarEnCatalogo(SERVICIOS, m.detalle) : buscarEnCatalogo(FUENTES_EXTERNAS, m.detalle))
    : buscarEnCatalogo(CATEGORIAS_GASTO, m.detalle);
  return `
    <div class="fila" style="padding:10px 0; border-top:1px solid var(--line);" onclick="abrirModalEditarMovimiento(${m.id})">
      <div style="display:flex; align-items:center; gap:10px;">
        <span style="font-size:20px;">${cat.ic}</span>
        <div>
          <div style="font-weight:700; font-size:14px;">${cat.nombre}</div>
          ${m.nota ? `<div class="muted" style="font-size:12px;">${escaparHTML(m.nota)}</div>` : ""}
        </div>
      </div>
      <span class="${m.tipo === 'ingreso' ? 'monto-ingreso' : 'monto-gasto'}">
        ${m.tipo === 'ingreso' ? '+' : '−'}${formatoMoneda(m.monto)}
      </span>
    </div>
  `;
}

function abrirModalEditarMovimiento(id) {
  const m = ESTADO.movimientos.find(x => x.id === id);
  if (!m) return;
  const overlay = crearOverlay("modalEditarMov", `
    <div class="asa"></div>
    <h2>Editar registro</h2>
    <label class="campo">
      <span>Monto</span>
      <input type="number" inputmode="decimal" id="editMontoMov" value="${m.monto}" step="0.01" min="0">
    </label>
    <label class="campo">
      <span>Nota</span>
      <textarea id="editNotaMov" rows="2">${escaparHTML(m.nota || "")}</textarea>
    </label>
    <label class="campo">
      <span>Fecha</span>
      <input type="date" id="editFechaMov" value="${m.fecha}">
    </label>
    <button class="btn btn-primary" onclick="guardarEdicionMovimiento(${id})">Guardar cambios</button>
    <button class="btn btn-danger" onclick="confirmarBorrarMovimiento(${id})">Borrar registro</button>
    <button class="btn btn-ghost" onclick="cerrarOverlay('modalEditarMov')">Cancelar</button>
  `);
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add("activo"));
}

async function guardarEdicionMovimiento(id) {
  const m = ESTADO.movimientos.find(x => x.id === id);
  m.monto = parseFloat(document.getElementById("editMontoMov").value) || m.monto;
  m.nota = document.getElementById("editNotaMov").value.trim();
  m.fecha = document.getElementById("editFechaMov").value || m.fecha;
  await dbActualizar("movimientos", m);
  await recargarEstado();
  cerrarOverlay("modalEditarMov");
  toast("Actualizado ✅");
  refrescarTodo();
}

async function confirmarBorrarMovimiento(id) {
  await dbEliminar("movimientos", id);
  await recargarEstado();
  cerrarOverlay("modalEditarMov");
  toast("Borrado");
  refrescarTodo();
}

/* ==========================================================
   ARRANQUE DE LA APLICACIÓN
   ========================================================== */
async function iniciar() {
  await abrirDB();
  await recargarEstado();

  document.getElementById("fechaHoy").textContent = new Date().toLocaleDateString("es-EC", {
    weekday: "long", day: "numeric", month: "long"
  });

  document.querySelectorAll(".tab").forEach(btn => {
    btn.addEventListener("click", () => irAPantalla(btn.dataset.tab));
  });

  document.getElementById("btnRegistrar").addEventListener("click", abrirModalRegistro);

  renderInicio();

  // Registrar service worker para que funcione offline como PWA
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
}

document.addEventListener("DOMContentLoaded", iniciar);
