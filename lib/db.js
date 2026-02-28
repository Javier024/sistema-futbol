import { createClient } from '@libsql/client';

const url = process.env.TURSO_DATABASE_URL || 'file:local.db';
const authToken = process.env.TURSO_AUTH_TOKEN;

export const client = createClient({
  url: url,
  authToken: authToken,
});

export const initDb = async () => {
  try {
    console.log("🛠️ Verificando y creando tablas...");

    // --- Tablas de Sistema y Usuarios ---
    await client.execute(`CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      correo TEXT UNIQUE NOT NULL,
      hash_contrasena TEXT NOT NULL,
      rol TEXT DEFAULT 'admin',
      fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    await client.execute(`CREATE TABLE IF NOT EXISTS configuracion_sistema (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      valor_mensual INTEGER NOT NULL,
      moneda TEXT DEFAULT 'COP',
      nombre_escuela TEXT,
      telefono_contacto TEXT,
      fecha_actualizacion DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // --- Tablas del Negocio ---
    await client.execute(`CREATE TABLE IF NOT EXISTS categorias (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      edad_minima INTEGER NOT NULL,
      edad_maxima INTEGER NOT NULL
    )`);

    await client.execute(`CREATE TABLE IF NOT EXISTS acudientes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      telefono TEXT
    )`);

    await client.execute(`CREATE TABLE IF NOT EXISTS jugadores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombres TEXT NOT NULL,
      apellidos TEXT NOT NULL,
      fecha_nacimiento DATE NOT NULL,
      tipo_sangre TEXT,
      telefono TEXT,
      id_acudiente INTEGER,
      id_categoria INTEGER,
      fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (id_acudiente) REFERENCES acudientes(id),
      FOREIGN KEY (id_categoria) REFERENCES categorias(id)
    )`);

    // --- Finanzas ---
    await client.execute(`CREATE TABLE IF NOT EXISTS pagos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      id_jugador INTEGER NOT NULL,
      monto INTEGER NOT NULL,
      fecha_pago DATE NOT NULL,
      metodo_pago TEXT,
      notas TEXT,
      fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (id_jugador) REFERENCES jugadores(id)
    )`);

    await client.execute(`CREATE TABLE IF NOT EXISTS gastos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      concepto TEXT NOT NULL,
      monto INTEGER NOT NULL,
      fecha_gasto DATE NOT NULL,
      categoria TEXT,
      notas TEXT,
      fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // --- Inventario ---
    await client.execute(`CREATE TABLE IF NOT EXISTS inventario_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      categoria TEXT,
      stock INTEGER NOT NULL DEFAULT 0,
      stock_minimo INTEGER DEFAULT 0,
      fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // --- Asistencias (NUEVO) ---
    // UNIQUE(id_jugador, fecha) evita duplicados para el mismo día
    await client.execute(`CREATE TABLE IF NOT EXISTS asistencias (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      id_jugador INTEGER NOT NULL,
      fecha DATE NOT NULL,
      estado TEXT NOT NULL, -- Valores: 'P' (Presente), 'A' (Ausente), 'E' (Excusa)
      fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(id_jugador, fecha)
    )`);

    // --- Datos Semilla (Seed Data) ---
    const conf = await client.execute("SELECT * FROM configuracion_sistema WHERE id = 1");
    if (conf.rows.length === 0) {
        await client.execute("INSERT INTO configuracion_sistema (id, valor_mensual, nombre_escuela, moneda) VALUES (1, 50000, 'EFUSA MANAGER', 'COP')");
    }

    const users = await client.execute("SELECT * FROM usuarios");
    if (users.rows.length === 0) {
        // Contraseña por defecto: admin123
        await client.execute("INSERT INTO usuarios (correo, hash_contrasena, rol) VALUES (?, ?, ?)", ['admin@futbol.com', 'admin123', 'admin']);
    }

    console.log("✅ Base de datos lista y actualizada.");
  } catch (error) {
    console.error("❌ Error init DB:", error);
  }
};