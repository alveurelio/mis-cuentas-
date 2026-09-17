/* ==========================================================
   db.js — Capa de almacenamiento local (IndexedDB)
   Todo se guarda en el celular. No requiere internet.
   ========================================================== */

const DB_NOMBRE = "cuentasApp";
const DB_VERSION = 1;
let dbConexion = null;

function abrirDB() {
  return new Promise((resolve, reject) => {
    if (dbConexion) return resolve(dbConexion);
    const req = indexedDB.open(DB_NOMBRE, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = e.target.result;

      // Movimientos: ingresos y gastos
      if (!db.objectStoreNames.contains("movimientos")) {
        const store = db.createObjectStore("movimientos", { keyPath: "id", autoIncrement: true });
        store.createIndex("fecha", "fecha");
        store.createIndex("tipo", "tipo");
      }

      // Deudas que ELLA debe (proveedores, bancos, prestamos, chulco)
      if (!db.objectStoreNames.contains("deudasPropias")) {
        db.createObjectStore("deudasPropias", { keyPath: "id", autoIncrement: true });
      }

      // Deudas que LE DEBEN a ella (clientes, personas)
      if (!db.objectStoreNames.contains("deudasAjenas")) {
        db.createObjectStore("deudasAjenas", { keyPath: "id", autoIncrement: true });
      }

      // Abonos hechos a cada deuda (de cualquiera de los dos tipos)
      if (!db.objectStoreNames.contains("abonos")) {
        const store = db.createObjectStore("abonos", { keyPath: "id", autoIncrement: true });
        store.createIndex("deudaId", "deudaId");
      }

      // Meta(s) de ahorro
      if (!db.objectStoreNames.contains("metas")) {
        db.createObjectStore("metas", { keyPath: "id", autoIncrement: true });
      }

      // Aportes a la meta de ahorro
      if (!db.objectStoreNames.contains("aportesMeta")) {
        const store = db.createObjectStore("aportesMeta", { keyPath: "id", autoIncrement: true });
        store.createIndex("metaId", "metaId");
      }
    };

    req.onsuccess = (e) => { dbConexion = e.target.result; resolve(dbConexion); };
    req.onerror = (e) => reject(e.target.error);
  });
}

function txStore(nombre, modo = "readonly") {
  return dbConexion.transaction(nombre, modo).objectStore(nombre);
}

/* ---------- Utilidades genéricas ---------- */
function dbAgregar(store, objeto) {
  return new Promise((resolve, reject) => {
    const req = txStore(store, "readwrite").add(objeto);
    req.onsuccess = () => resolve(req.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

function dbActualizar(store, objeto) {
  return new Promise((resolve, reject) => {
    const req = txStore(store, "readwrite").put(objeto);
    req.onsuccess = () => resolve(req.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

function dbEliminar(store, id) {
  return new Promise((resolve, reject) => {
    const req = txStore(store, "readwrite").delete(id);
    req.onsuccess = () => resolve();
    req.onerror = (e) => reject(e.target.error);
  });
}

function dbObtenerTodos(store) {
  return new Promise((resolve, reject) => {
    const req = txStore(store).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

function dbObtenerPorIndice(store, indice, valor) {
  return new Promise((resolve, reject) => {
    const req = txStore(store).index(indice).getAll(valor);
    req.onsuccess = () => resolve(req.result);
    req.onerror = (e) => reject(e.target.error);
  });
}
